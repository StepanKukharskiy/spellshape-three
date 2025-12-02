/**
 * ProceduralExecutor v2 - Fixed with dependencies
 * Handles procedural 3D geometry generation with proper error handling
 * All external dependencies are loaded and injected into helper context
 */
import * as THREE from 'three';
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
// BUFFER GEOMETRY UTILITIES
// =========================================================================
const BufferGeometryUtils = {
    mergeGeometries: (geometries, useGroups = false) => {
        const isIndexed = geometries[0] && geometries[0].index !== null;
        const attributeNames = Object.keys(geometries[0]?.attributes || {});
        const mergedGeometry = new THREE.BufferGeometry();
        let offset = 0;

        // Collect all attributes
        const attributes = {};
        attributeNames.forEach(name => {
            attributes[name] = [];
        });

        geometries.forEach((geo) => {
            if (!geo || !geo.attributes) return;
            
            attributeNames.forEach(name => {
                const attr = geo.attributes[name];
                if (attr) {
                    attributes[name].push(attr.array);
                }
            });
        });

        // Merge attributes
        attributeNames.forEach(name => {
            const arrays = attributes[name];
            if (arrays.length > 0) {
                const itemSize = geometries[0].attributes[name].itemSize;
                const merged = new Float32Array(
                    arrays.reduce((sum, arr) => sum + arr.length, 0)
                );
                let position = 0;
                arrays.forEach(arr => {
                    merged.set(arr, position);
                    position += arr.length;
                });
                mergedGeometry.setAttribute(name, new THREE.BufferAttribute(merged, itemSize));
            }
        });

        // Merge indices if present
        if (isIndexed) {
            const indices = [];
            geometries.forEach((geo) => {
                if (geo.index) {
                    const idx = geo.index.array;
                    for (let i = 0; i < idx.length; i++) {
                        indices.push(idx[i] + offset);
                    }
                    offset += geo.attributes.position.count;
                }
            });
            mergedGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        }

        return mergedGeometry;
    }
};

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
    constructor(scene) {
        this.scene = scene;
        this.geometries = new Map();
        this.materials = new Map();
        this.dynamicHelpers = new Map();
        this.context = {};

        // Initialize dependencies
        this.noise = new SimplexNoise(42);
        this.BufferGeometryUtils = BufferGeometryUtils;
        this.resolvers = Resolvers;
        this.wrappers = Wrappers;

        console.log('✅ ProceduralExecutor initialized with dependencies');
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

    execute(schema, parameters) {
        console.log("🚩 Checkpoint 1: Execute Start");

        const safeParams = (parameters && typeof parameters === 'object') ? parameters : {};

        if (typeof schema === 'string') {
            try {
                schema = JSON.parse(schema);
            } catch (e) {
                console.error("❌ Invalid JSON string");
                return new THREE.Group();
            }
        }

        if (!schema || typeof schema !== 'object') {
            console.warn("❌ Invalid schema object");
            return new THREE.Group();
        }

        console.log("🚩 Checkpoint 2: Schema Validated", {
            version: schema.version,
            intent: schema.intent
        });

        this.geometries.clear();
        this.materials.clear();
        this.dynamicHelpers.clear();
        this.context = {};

        // Setup materials
        if (schema.materials) {
            this.safeLoop(schema.materials, (name, config) => {
                if (!config) return;
                this.materials.set(name, new THREE.MeshStandardMaterial({
                    color: new THREE.Color(config.color || '#808080'),
                    roughness: config.roughness ?? 0.5,
                    metalness: config.metalness ?? 0.0,
                    transparent: config.transparent ?? false,
                    opacity: config.opacity ?? 1.0,
                    side: THREE.DoubleSide
                }));
            });
        }

        if (schema.definitions) {
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
            return new THREE.Group();
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
                    'resolveCurve',
                    'resolveField',
                    'resolvePoints2D',
                    'resolveVoxelGrid',
                    'wrapCurveAsLine',
                    'wrapFieldAsObject',
                    'wrapGridAsObject',
                    'Math',
                    body
                );

                const boundFunc = (p) => func(
                    p,
                    THREE,
                    {},
                    this.noise,
                    this.BufferGeometryUtils,
                    this.resolvers.resolveCurve,
                    this.resolvers.resolveField,
                    this.resolvers.resolvePoints2D,
                    this.resolvers.resolveVoxelGrid,
                    this.wrappers.wrapCurveAsLine,
                    this.wrappers.wrapFieldAsObject,
                    this.wrappers.wrapGridAsObject,
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

        const group = new THREE.Group();
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
        return this.materials.get(name) || this.materials.get('default') || new THREE.MeshStandardMaterial({ color: 0x808080 });
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
            const m = new THREE.Mesh(obj, mat);
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
        const group = new THREE.Group();
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