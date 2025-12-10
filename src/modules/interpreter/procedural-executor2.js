/**
 * ProceduralExecutor v2 - Fixed with dependencies
 * Handles procedural 3D geometry generation with proper error handling
 * All external dependencies are loaded and injected into helper context
 */
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { LoopSubdivision } from 'https://cdn.jsdelivr.net/npm/three-subdivide@1.1.5/build/index.module.js';


// =========================================================================
// SIMPLEX NOISE IMPLEMENTATION (Inline)
// =========================================================================
class SimplexNoise {
    constructor(seed = 0) {
        this.p = [];
        this.permMod12 = [];
        this.perm = [];
        
        // Initialize permutation table with seed
        for (let i = 0; i < 256; i++) {
            const pi = Math.floor(Math.sin(seed + i) * 43758.5453) % 256;
            this.p[i] = pi;
        }
        
        // Duplicate for wrapping
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i % 256];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 8 ? y : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    simplex3(xin, yin, zin) {
        let n0, n1, n2, n3;
        
        const s = (xin + yin + zin) / 3;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const k = Math.floor(zin + s);
        
        const t = (i + j + k) / 6;
        const x0 = xin - (i - t);
        const y0 = yin - (j - t);
        const z0 = zin - (k - t);
        
        let i1, j1, k1;
        let i2, j2, k2;
        
        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0;
                i2 = 1; j2 = 1; k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0;
                i2 = 1; j2 = 0; k2 = 1;
            } else {
                i1 = 0; j1 = 0; k1 = 1;
                i2 = 1; j2 = 0; k2 = 1;
            }
        } else {
            if (y0 < z0) {
                i1 = 0; j1 = 0; k1 = 1;
                i2 = 0; j2 = 1; k2 = 1;
            } else if (x0 < z0) {
                i1 = 0; j1 = 1; k1 = 0;
                i2 = 0; j2 = 1; k2 = 1;
            } else {
                i1 = 0; j1 = 1; k1 = 0;
                i2 = 1; j2 = 1; k2 = 0;
            }
        }
        
        const x1 = x0 - i1 + 1/6;
        const y1 = y0 - j1 + 1/6;
        const z1 = z0 - k1 + 1/6;
        
        const x2 = x0 - i2 + 1/3;
        const y2 = y0 - j2 + 1/3;
        const z2 = z0 - k2 + 1/3;
        
        const x3 = x0 - 0.5;
        const y3 = y0 - 0.5;
        const z3 = z0 - 0.5;
        
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        
        const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
        const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
        const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];
        
        let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
        n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * this.grad(gi0, x0, y0, z0));
        
        let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
        n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * this.grad(gi1, x1, y1, z1));
        
        let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
        n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * this.grad(gi2, x2, y2, z2));
        
        let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
        n3 = t3 < 0 ? 0 : (t3 *= t3, t3 * t3 * this.grad(gi3, x3, y3, z3));
        
        return 32 * (n0 + n1 + n2 + n3);
    }
}



// =========================================================================
// RESOLVER FUNCTIONS (Unwrap wrapped data from helpers)
// =========================================================================
const Resolvers = {
    resolveCurve: (input) => {
        if (!input) return null;
        if (input?.userData?.curve) return input.userData.curve;
        if (input?.isCurve) return input;
        if (typeof input === 'function') return input;
        return null;
    },

    resolveField: (input) => {
        if (!input) return null;
        if (typeof input === 'function') return input;
        if (input?.userData?.field) return input.userData.field;
        return null;
    },

    resolvePoints2D: (input, segments = 32) => {
        if (!input) return [];
        
        // If it's a wrapped curve
        if (input?.userData?.curve) {
            const curve = input.userData.curve;
            const points = [];
            for (let i = 0; i < segments; i++) {
                const t = i / (segments - 1);
                const pt = curve.getPoint(t);
                points.push(new THREE.Vector2(pt.x, pt.y));
            }
            return points;
        }
        
        // If it's already an array
        if (Array.isArray(input)) {
            return input.map(p => 
                p instanceof THREE.Vector2 ? p : new THREE.Vector2(p[0], p[1])
            );
        }
        
        return [];
    },

    resolveVoxelGrid: (input) => {
        if (Array.isArray(input)) {
            if (Array.isArray(input[0])) {
                if (Array.isArray(input[0][0])) {
                    return input; // Already 3D
                }
            }
        }
        if (input?.data) return input.data;
        return input;
    }
};

// =========================================================================
// WRAPPER FUNCTIONS (Attach metadata to geometry for downstream use)
// =========================================================================
const Wrappers = {
    wrapCurveAsLine: (curve, segments = 32) => {
        const points = [];
        for (let i = 0; i < segments; i++) {
            const t = i / (segments - 1);
            points.push(curve.getPoint(t));
        }
        
        const positions = points.flatMap(p => [p.x, p.y, p.z]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        
        const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
        line.userData = { curve, type: 'curve' };
        return line;
    },

    wrapFieldAsObject: (fieldFn, label = 'vector field') => {
        const obj = { userData: { field: fieldFn, type: 'field', label } };
        obj.userData.field = fieldFn;
        return obj;
    },

    wrapGridAsObject: (grid, gridSize, iterations, rules) => {
        return {
            userData: {
                type: 'grid',
                grid,
                gridSize,
                iterations,
                rules
            }
        };
    }
};

// =========================================================================
// MAIN PROCEDURAL EXECUTOR CLASS
// =========================================================================
export class ProceduralExecutor {
    constructor(scene, THREE) {
        this.scene = scene;
        this.THREE = THREE;  // ← STORE THREE FOR LATER USE
        this.geometries = new Map();
        this.materials = new Map();
        this.dynamicHelpers = new Map();
        this.context = {};

      this.loadedFonts = new Map();              // Cache fonts
        this.fontLoader = new FontLoader();  // Font loader
        this.pendingFonts = new Map();             // Track loading
      this.TextGeometry = TextGeometry;

      this.messages = [];

        // Initialize dependencies
        this.noise = new SimplexNoise(42);
        this.BufferGeometryUtils = BufferGeometryUtils;
      
        this.resolvers = Resolvers;
        this.wrappers = Wrappers;
      

        console.log('✅ ProceduralExecutor initialized with dependencies');
      console.log('✅ BufferGeometryUtils loaded:', Object.keys(this.BufferGeometryUtils));
    }

  addMessage(level, text) {
  this.messages.push({
    level,
    text,
    time: Date.now()
  });
  // Optionally cap length
  if (this.messages.length > 200) this.messages.shift();
}

    safeLoop(obj, callback) {
        if (obj === undefined || obj === null) return;
        if (typeof obj !== 'object') return;

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                callback(key, obj[key]);
            }
        }
    }

  async loadFont(fontPath) {
    // Return cached font if available
    if (this.loadedFonts.has(fontPath)) {
        console.log(`✅ Font cached: ${fontPath}`);
        return this.loadedFonts.get(fontPath);
    }
    
    // Return existing promise if already loading
    if (this.pendingFonts.has(fontPath)) {
        console.log(`⏳ Font loading: ${fontPath}`);
        return this.pendingFonts.get(fontPath);
    }
    
    // Create new loading promise
    const promise = new Promise((resolve, reject) => {
        this.fontLoader.load(
            fontPath,
            (font) => {
                console.log(`✅ Font loaded: ${fontPath}`);
                this.loadedFonts.set(fontPath, font);
                this.pendingFonts.delete(fontPath);
                resolve(font);
            },
            (progress) => {
                console.log(`⏳ Loading ${fontPath}: ${Math.round(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error(`❌ Font failed: ${fontPath}`, error);
                this.pendingFonts.delete(fontPath);
                reject(error);
            }
        );
    });
    
    this.pendingFonts.set(fontPath, promise);
    return promise;
}

    async execute(schema, parameters) {
        console.log("🚩 Checkpoint 1: Execute Start");

      // Default font URL
    const DEFAULT_FONT_URL = 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';
    
    // Pre-load all fonts from schema + default
    if (!schema.fonts) schema.fonts = [];
    if (!schema.fonts.includes(DEFAULT_FONT_URL)) {
        schema.fonts.push(DEFAULT_FONT_URL);  // Always include default
    }
        try {
            console.log(`🔄 Pre-loading ${schema.fonts.length} font(s)...`);
            const fontPromises = schema.fonts.map(path => this.loadFont(path));
            await Promise.all(fontPromises);
            console.log('✅ All fonts pre-loaded');
        } catch (error) {
            console.warn('⚠️ Some fonts failed to load:', error);
            // Continue anyway - fallback will be used
        }
    

        const safeParams = (parameters && typeof parameters === 'object') ? parameters : {};

        if (typeof schema === 'string') {
            try {
                schema = JSON.parse(schema);
            } catch (e) {
                console.error("❌ Invalid JSON string");
                return new this.THREE.Group();
            }
        }

        if (!schema || typeof schema !== 'object') {
            console.warn("❌ Invalid schema object");
            return new this.THREE.Group();
        }

        console.log("🚩 Checkpoint 2: Schema Validated", {
            version: schema.version,
            intent: schema.intent
        });

        this.geometries.clear();
        this.materials.clear();
        this.context = {};

        // Setup materials
        if (schema.materials) {
            this.safeLoop(schema.materials, (name, config) => {
                if (!config) return;
                this.materials.set(name, new this.THREE.MeshStandardMaterial({
                    color: new this.THREE.Color(config.color || '#808080'),
                    roughness: config.roughness ?? 0.5,
                    metalness: config.metalness ?? 0.0,
                    transparent: config.transparent ?? false,
                    opacity: config.opacity ?? 1.0,
                    side: this.THREE.DoubleSide
                }));
            });
        }

        // Schema definitions are only for inline helpers, not for re-registering the registry
if (schema.definitions && Object.keys(schema.definitions).length > 0) {
    // Register schema-specific helpers
    this.registerDynamicHelpers(schema.definitions);
}

        console.log("🚩 Checkpoint 3: Setup Complete. Running Logic...");

        const version = parseFloat(schema.version || 3.2);
        try {
            if (version >= 4.0) {
                return this.executeV4(schema, safeParams);
            } else {
                return this.executeV3(schema, safeParams);
            }
        } catch (err) {
            console.error("❌ Crash inside Versioned Execution:", err);
            return new this.THREE.Group();
        }
    }

    registerDynamicHelpers(definitions) {
        this.safeLoop(definitions, (name, def) => {
            try {
                const body = (def && typeof def === 'object') ? def.code : def;
                if (!body || typeof body !== 'string') {
                    console.warn(`⚠️ Helper '${name}': No code found`);
                    return;
                }

                // Inject ALL dependencies into function context
                const func = new Function(
                    'params',
                    'THREE',
                    'helpers',
                    'noise',
                    'BufferGeometryUtils',
                  'MarchingCubes',
                  'ConvexGeometry',
                  'LoopSubdivision',
                    'resolveCurve',
                    'resolveField',
                    'resolvePoints2D',
                    'resolveVoxelGrid',
                    'wrapCurveAsLine',
                    'wrapFieldAsObject',
                    'wrapGridAsObject',
                  'loadedFonts',
                  'TextGeometry',
                    'Math',
                    body
                );

              const helperUtils = {
  log: (level, text) => {
    console[level] ? console[level](text) : console.log(text);
    this.addMessage(level, text);
  }
};

                const boundFunc = (p) => func(
                    p,
                    this.THREE,  // ← USE STORED THREE
                    {},
                    this.noise,
                    BufferGeometryUtils,
                  MarchingCubes,
                  ConvexGeometry,
                  LoopSubdivision,
                    this.resolvers.resolveCurve,
                    this.resolvers.resolveField,
                    this.resolvers.resolvePoints2D,
                    this.resolvers.resolveVoxelGrid,
                    this.wrappers.wrapCurveAsLine,
                    this.wrappers.wrapFieldAsObject,
                    this.wrappers.wrapGridAsObject,
                  this.loadedFonts, 
                  this.TextGeometry,
                    Math
                );

                this.dynamicHelpers.set(name, boundFunc);
                console.log(`✅ Registered helper: ${name}`);
            } catch (e) {
                console.warn(`⚠️ Skipping helper '${name}': ${e.message.substring(0, 80)}`);
                // Don't throw - gracefully skip broken helpers
            }
        });
    }

    executeV4(schema, parameters) {
        if (schema.globalParameters) {
            this.safeLoop(schema.globalParameters, (key, param) => {
                const defaultVal = (param && param.value !== undefined) ? param.value : param;
                this.context[key] = parameters[key] ?? defaultVal;
            });
        }

        if (schema.context) {
            this.safeLoop(schema.context, (key, value) => {
                if (this.context[key] === undefined) {
                    this.context[key] = value;
                }
            });
        }

        const group = new this.THREE.Group();
        group.name = schema.intent || 'Generated';

        if (Array.isArray(schema.actions)) {
            schema.actions.forEach((action, idx) => {
                this.executeAction(action, group, idx);
            });
        }

        console.log("🚩 Checkpoint 4: V4 Execution Finished");
        return group;
    }

    executeAction(action, group, index) {
        if (!action) return;
        const { thought, do: helperName, params, transform, material, as: storeName, visible } = action;

        if (thought) console.log(`📌 ${thought}`);

        if (helperName === 'loop') return this.executeLoop(action, group);
        if (helperName === 'clone') return this.executeClone(action, group);

        let helperFn = this.dynamicHelpers.get(helperName);
        if (!helperFn) {
            console.warn(`⚠️ Action ${index}: Helper '${helperName}' not found`);
            return;
        }

        const evalParams = this.evaluateParamsCarefully(params);

        let result;
        try {
            result = helperFn(evalParams);
        } catch (error) {
            console.error(`❌ Error in '${helperName}':`, error);
            return;
        }

        if (!result) return;

        if (storeName) this.geometries.set(storeName, result);
        if (transform) this.applyTransform(result, transform);

        const mat = this.getMaterial(material);
        this.addToGroup(result, group, mat, visible);
    }

    evaluateParamsCarefully(params) {
        if (!params || typeof params !== 'object') return {};

        const evaluated = {};

        this.safeLoop(params, (key, value) => {
            if (Array.isArray(value)) {
                evaluated[key] = value.map(item => this.evaluateValue(item));
            } else if (value && typeof value === 'object') {
                evaluated[key] = this.evaluateParamsCarefully(value);
            } else {
                evaluated[key] = this.evaluateValue(value);
            }
        });

        return evaluated;
    }

    evaluateValue(item) {
        if (typeof item === 'number') return item;
        if (typeof item === 'string') {

          // Handle font references
        if (item.startsWith('font:')) {
            const fontPath = item.substring(5);  // Remove 'font:' prefix
            const font = this.loadedFonts.get(fontPath);
            if (font) {
                console.log(`✅ Injecting font: ${fontPath}`);
                return font;
            } else {
                console.warn(`⚠️ Font not found: ${fontPath}`);
                return null;
            }
        }
          
            if (this.geometries.has(item)) {
                const stored = this.geometries.get(item);
                return stored.userData?.curve || stored;
            }
            if (item.includes('ctx.') || item.includes('Math.')) {
                return this.evaluateExpression(item);
            }
        }
        return item;
    }

    evaluateExpression(expr) {
        if (typeof expr !== 'string') return expr;
        try {
            const processed = expr.replace(/ctx\.(\w+)/g, (_, v) => this.context[v] ?? 0);
            return new Function('Math', 'ctx', `return ${processed};`)(Math, this.context);
        } catch (e) {
            return 0;
        }
    }

    getMaterial(name) {
        return this.materials.get(name) || this.materials.get('default') || new this.THREE.MeshStandardMaterial({ color: 0x808080 });
    }

    addToGroup(obj, group, mat, visible) {
        if (!obj) return;
        const isVis = visible !== false;

        if (Array.isArray(obj)) {
            obj.forEach(item => this.addToGroup(item, group, mat, visible));
            return;
        }

        if (obj.isObject3D) {
            obj.visible = isVis;
            if (mat && obj.isMesh && !obj.material) obj.material = mat;
            group.add(obj);
        } else if (obj.isBufferGeometry) {
            const m = new this.THREE.Mesh(obj, mat);
            m.visible = isVis;
            group.add(m);
        }
    }

    applyTransform(obj, transform) {
        if (!transform) return;
        const t = (v) => {
            if (!Array.isArray(v)) return [0, 0, 0];
            return v.map(val => typeof val === 'string' ? this.evaluateExpression(val) : val);
        };

        if (transform.position) {
            const [x, y, z] = t(transform.position);
            obj.isBufferGeometry ? obj.translate(x, y, z) : obj.position.set(x, y, z);
        }
        if (transform.rotation) {
            const [x, y, z] = t(transform.rotation);
            obj.isBufferGeometry ? (obj.rotateX(x), obj.rotateY(y), obj.rotateZ(z)) : obj.rotation.set(x, y, z);
        }
        if (transform.scale) {
            const [x, y, z] = t(transform.scale);
            obj.isBufferGeometry ? obj.scale(x, y, z) : obj.scale.set(x, y, z);
        }
    }

    executeLoop(action, group) {
        const { var: varName, from, to, body } = action;
        const start = this.evaluateExpression(from);
        const end = this.evaluateExpression(to);
        if (Math.abs(end - start) > 1000) return;

        for (let i = start; i < end; i++) {
            this.context[varName] = i;
            if (Array.isArray(body)) body.forEach(a => this.executeAction(a, group));
        }
        delete this.context[varName];
    }

    executeClone(action, group) {
        if (!action.params?.id) return;
        const src = this.geometries.get(action.params.id);
        if (src && src.clone) {
            const c = src.clone();
            if (action.transform) this.applyTransform(c, action.transform);
            this.addToGroup(c, group, this.getMaterial(action.material), true);
        }
    }

    executeV3(schema, parameters) {
        const group = new this.THREE.Group();
        const procedure = schema.procedures?.[0];
        if (procedure && procedure.steps) {
            procedure.steps.forEach(step => {
                this.executeAction({
                    do: step.helper,
                    params: step.params,
                    as: step.store,
                    transform: step.transform,
                    material: step.material
                }, group);
            });
        }
        return group;
    }
}


export default ProceduralExecutor;