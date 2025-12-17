/**
 * PROCEDURAL EXECUTOR - UPDATED WITH DEFORMER INTEGRATION
 * Key changes from v2:
 * - DeformerRegistry injected into helper context
 * - deformGeometry and deformGeometryStack helpers ready to use
 * - Automatic resolution of geometry references (strings)
 * - Support for deformer parameter merging with global context
 */

// Pseudo-imports (in real implementation, these are actual imports at top of file)
// import DeformerRegistry from './vertex-shader-library.js';
// import { deformGeometry, deformGeometryStack } from './deform-helpers.js';

import { DeformerRegistry } from './deform-library.js';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { LoopSubdivision } from 'https://cdn.jsdelivr.net/npm/three-subdivide@1.1.5/build/index.module.js';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';

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

export class ProceduralExecutor {
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    this.geometries = new Map();
    this.materials = new Map();
    this.dynamicHelpers = new Map();
    this.context = {};
    this.loadedFonts = new Map();
    this.fontLoader = new FontLoader();
    this.pendingFonts = new Map();
    this.TextGeometry = TextGeometry;
    this.messages = [];

    // ============================================================================
    // NEW: Import DeformerRegistry (injected at construction time)
    // In real implementation, ensure DeformerRegistry is in scope
    // ============================================================================
    this.DeformerRegistry = typeof DeformerRegistry !== 'undefined' ? DeformerRegistry : {};

    // Standard dependencies
    this.noise = new SimplexNoise(42);
    this.BufferGeometryUtils = BufferGeometryUtils;
    this.resolvers = Resolvers;
    this.wrappers = Wrappers;

    console.log('ProceduralExecutor initialized with DeformerRegistry:', 
      Object.keys(this.DeformerRegistry).length, 'deformers');
  }

  // ============================================================================
  // DEFORMER HELPERS - Built-in to executor
  // ============================================================================

  /**
   * Apply a single deformer to geometry
   * Called from schema: { helperName: "deformGeometry", params: {...} }
   */
  deformGeometry(params) {
    const {
      geometry,
      mode,
      params: deformerParams = {},
      recomputeNormals = false
    } = params;

    if (!geometry || !geometry.isBufferGeometry) {
      console.warn('deformGeometry: Invalid geometry');
      return null;
    }

    const result = geometry.clone();
    const posAttr = result.getAttribute('position');
    if (!posAttr) {
      console.warn('deformGeometry: No position attribute');
      return result;
    }

    let normAttr = result.getAttribute('normal');
    if (!normAttr && recomputeNormals) {
      result.computeVertexNormals();
      normAttr = result.getAttribute('normal');
    }

    const positions = posAttr.array;
    const normals = normAttr ? normAttr.array : null;

    // Get deformer from registry
    const deformer = this.DeformerRegistry[mode];
    if (!deformer || typeof deformer.func !== 'function') {
      console.warn(`deformGeometry: Deformer '${mode}' not found`);
      return result;
    }

    // Merge global context into deformer params
    const mergedParams = { ...this.context, ...deformerParams };
    const ctx = { params: mergedParams, geometry: result };

    // Apply deformer to each vertex
    const stride = 3;
    for (let i = 0; i < positions.length; i += stride) {
      const p = {
        x: positions[i],
        y: positions[i + 1],
        z: positions[i + 2]
      };

      const n = normals ? {
        x: normals[i],
        y: normals[i + 1],
        z: normals[i + 2]
      } : { x: 0, y: 0, z: 0 };

      const transformed = deformer.func(p, n, ctx);
      if (transformed) {
        positions[i] = transformed.x;
        positions[i + 1] = transformed.y;
        positions[i + 2] = transformed.z;
      }
    }

    posAttr.needsUpdate = true;
    if (recomputeNormals) {
      result.computeVertexNormals();
    }

    return result;
  }

  /**
   * Apply a stack (pipeline) of deformers to geometry
   * Called from schema: { helperName: "deformGeometryStack", params: {...} }
   */
  deformGeometryStack(params) {
    const {
      geometry,
      stack = [],
      recomputeNormals = false
    } = params;

    if (!geometry || !geometry.isBufferGeometry) {
      console.warn('deformGeometryStack: Invalid geometry');
      return null;
    }

    let result = geometry.clone();

    if (!Array.isArray(stack) || stack.length === 0) {
      console.warn('deformGeometryStack: Stack is empty');
      return result;
    }

    // Apply each deformer in sequence
    for (let idx = 0; idx < stack.length; idx++) {
      const step = stack[idx];
      const { mode, params: deformerParams = {} } = step;

      if (!mode) {
        console.warn(`deformGeometryStack: Step ${idx} has no mode`);
        continue;
      }

      const deformer = this.DeformerRegistry[mode];
      if (!deformer || typeof deformer.func !== 'function') {
        console.warn(`deformGeometryStack: Step ${idx} - Deformer '${mode}' not found`);
        continue;
      }

      // Apply deformer
      result = this._applyDeformerToGeometry(result, deformer, deformerParams);
      if (!result) {
        console.warn(`deformGeometryStack: Step ${idx} failed`);
        return null;
      }
    }

    if (recomputeNormals) {
      result.computeVertexNormals();
    }

    return result;
  }

  /**
   * Internal: Apply single deformer to geometry
   */
  _applyDeformerToGeometry(geometry, deformer, deformerParams) {
    if (!geometry || !geometry.isBufferGeometry) return null;

    const result = geometry.clone();
    const posAttr = result.getAttribute('position');
    if (!posAttr) return result;

    let normAttr = result.getAttribute('normal');
    const positions = posAttr.array;
    const normals = normAttr ? normAttr.array : null;

    const mergedParams = { ...this.context, ...deformerParams };
    const ctx = { params: mergedParams, geometry: result };

    const stride = 3;
    for (let i = 0; i < positions.length; i += stride) {
      const p = { x: positions[i], y: positions[i + 1], z: positions[i + 2] };
      const n = normals ? {
        x: normals[i],
        y: normals[i + 1],
        z: normals[i + 2]
      } : { x: 0, y: 0, z: 0 };

      const transformed = deformer.func(p, n, ctx);
      if (transformed) {
        positions[i] = transformed.x;
        positions[i + 1] = transformed.y;
        positions[i + 2] = transformed.z;
      }
    }

    posAttr.needsUpdate = true;
    return result;
  }

  // ============================================================================
  // EXISTING METHODS (unchanged from v2)
  // ============================================================================

  addMessage(level, text) {
    this.messages.push({ level, text, time: Date.now() });
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
    if (this.loadedFonts.has(fontPath)) {
      return this.loadedFonts.get(fontPath);
    }
    if (this.pendingFonts.has(fontPath)) {
      return this.pendingFonts.get(fontPath);
    }

    const promise = new Promise((resolve, reject) => {
      this.fontLoader.load(
        fontPath,
        (font) => {
          this.loadedFonts.set(fontPath, font);
          this.pendingFonts.delete(fontPath);
          resolve(font);
        },
        (progress) => {
          // Silent progress
        },
        (error) => {
          this.pendingFonts.delete(fontPath);
          reject(error);
        }
      );
    });

    this.pendingFonts.set(fontPath, promise);
    return promise;
  }

  async execute(schema, parameters) {
    console.log('Checkpoint 1: Execute Start');

    const DEFAULT_FONT_URL = 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';
    
    if (!schema.fonts) schema.fonts = [];
    if (!schema.fonts.includes(DEFAULT_FONT_URL)) {
      schema.fonts.push(DEFAULT_FONT_URL);
    }

    try {
      const fontPromises = schema.fonts.map(path => this.loadFont(path));
      await Promise.all(fontPromises);
    } catch (error) {
      console.warn('Some fonts failed to load:', error);
      // Continue anyway
    }

    const safeParams = typeof parameters === 'object' ? parameters : {};

    if (typeof schema === 'string') {
      try {
        schema = JSON.parse(schema);
      } catch (e) {
        console.error('Invalid JSON string');
        return new this.THREE.Group();
      }
    }

    if (!schema || typeof schema !== 'object') {
      console.warn('Invalid schema object');
      return new this.THREE.Group();
    }

    console.log('Checkpoint 2: Schema Validated');

    // Setup materials
    if (schema.materials) {
      this.safeLoop(schema.materials, (name, config) => {
        if (!config) return;
        this.materials.set(
          name,
          new this.THREE.MeshStandardMaterial({
            color: new this.THREE.Color(config.color || 0x808080),
            roughness: config.roughness ?? 0.5,
            metalness: config.metalness ?? 0.0,
            transparent: config.transparent ?? false,
            opacity: config.opacity ?? 1.0,
            side: this.THREE.DoubleSide,
            vertexColors: config.vertexColors ?? false
          })
        );
      });
    }

    // Register dynamic helpers
    if (schema.definitions && Object.keys(schema.definitions).length > 0) {
      this.registerDynamicHelpers(schema.definitions);
    }

    console.log('Checkpoint 3: Setup Complete');

    const version = parseFloat(schema.version || 3.0);
    try {
      if (version >= 4.0) {
        return this.executeV4(schema, safeParams);
      } else {
        return this.executeV3(schema, safeParams);
      }
    } catch (err) {
      console.error('Crash inside Versioned Execution:', err);
      return new this.THREE.Group();
    }
  }

  registerDynamicHelpers(definitions) {
    this.safeLoop(definitions, (name, def) => {
      try {
        const body = typeof def === 'object' ? def.code : def;
        if (!body || typeof body !== 'string') {
          console.warn(`Helper ${name}: No code found`);
          return;
        }

        // CRITICAL: Inject DeformerRegistry into function scope
        const func = new Function(
          'params',
          'THREE',
          'helpers',
          'noise',
          'BufferGeometryUtils',
          'MarchingCubes',
          'ConvexGeometry',
          'LoopSubdivision',
          'ParametricGeometry',
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
          'DeformerRegistry',  // <-- NEW
          body
        );

        const helperUtils = {
          log: (level, text) => {
            console.log ? console[level](text) : console.log(text);
            this.addMessage(level, text);
          },
          call: (name, p) => {
            const fn = this.dynamicHelpers.get(name);
            if (!fn) throw new Error(`Helper not found: ${name}`);
            return fn(p);
          }
        };

        const boundFunc = (p) => func(
          p,
          this.THREE,
          helperUtils,
          this.noise,
          this.BufferGeometryUtils,
          MarchingCubes,
          ConvexGeometry,
          LoopSubdivision,
          ParametricGeometry,
          this.resolvers.resolveCurve,
          this.resolvers.resolveField,
          this.resolvers.resolvePoints2D,
          this.resolvers.resolveVoxelGrid,
          this.wrappers.wrapCurveAsLine,
          this.wrappers.wrapFieldAsObject,
          this.wrappers.wrapGridAsObject,
          this.loadedFonts,
          this.TextGeometry,
          Math,
          this.DeformerRegistry  // <-- NEW: Pass registry
        );

        this.dynamicHelpers.set(name, boundFunc);
        console.log(`Registered helper: ${name}`);
      } catch (e) {
        console.warn(`Skipping helper ${name}:`, e.message.substring(0, 80));
      }
    });
  }

  executeV4(schema, parameters) {
    if (schema.globalParameters) {
      this.safeLoop(schema.globalParameters, (key, param) => {
        const defaultVal = param && param.value !== undefined ? param.value : param;
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
    group.name = schema.intent + ' (Generated)';

    if (Array.isArray(schema.actions)) {
      schema.actions.forEach((action, idx) => {
        this.executeAction(action, group, idx);
      });
    }

    console.log('Checkpoint 4: V4 Execution Finished');
    return group;
  }

  executeAction(action, group, index) {
    if (!action) return;

    const {
      thought,
      do: helperName,
      params,
      transform,
      material,
      as: storeName,
      visible
    } = action;

    if (thought) console.log(thought);

    if (helperName === 'loop') {
      return this.executeLoop(action, group);
    }

    if (helperName === 'clone') {
      return this.executeClone(action, group);
    }

    // ========================================================================
    // NEW: Built-in deformer helpers registered directly
    // ========================================================================
    if (helperName === 'deformGeometry') {
      const evalParams = this.evaluateParamsCarefully(params);
      try {
        const result = this.deformGeometry(evalParams);
        if (!result) return;
        if (storeName) this.geometries.set(storeName, result);
        if (transform) this.applyTransform(result, transform);
        const mat = this.getMaterial(material);
        this.addToGroup(result, group, mat, visible);
      } catch (error) {
        const msg = `Error in deformGeometry: ${error.message}`;
        console.error(msg, error);
        if (this.addMessage) this.addMessage('error', msg);
      }
      return;
    }

    if (helperName === 'deformGeometryStack') {
      const evalParams = this.evaluateParamsCarefully(params);
      try {
        const result = this.deformGeometryStack(evalParams);
        if (!result) return;
        if (storeName) this.geometries.set(storeName, result);
        if (transform) this.applyTransform(result, transform);
        const mat = this.getMaterial(material);
        this.addToGroup(result, group, mat, visible);
      } catch (error) {
        const msg = `Error in deformGeometryStack: ${error.message}`;
        console.error(msg, error);
        if (this.addMessage) this.addMessage('error', msg);
      }
      return;
    }

    // ========================================================================
    // Original: Look up dynamic/registry helpers
    // ========================================================================
    let helperFn = this.dynamicHelpers.get(helperName);
    if (!helperFn) {
      console.warn(`Action ${index}: Helper '${helperName}' not found`);
      return;
    }

    const evalParams = this.evaluateParamsCarefully(params);
    let result;
    try {
      result = helperFn(evalParams);
    } catch (error) {
      const msg = `Error in ${helperName}: ${error.message}`;
      console.error(msg, error);
      if (this.addMessage) this.addMessage('error', msg);
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
      } else if (value && typeof value === 'object' && !value.isBufferGeometry) {
        evaluated[key] = this.evaluateParamsCarefully(value);
      } else if (typeof value === 'string') {
        if (key === 'geometries' && value.includes(',')) {
          const names = value
            .trim()
            .replace(/[\[\]]/g, '')
            .split(',')
            .map(n => n.trim())
            .filter(n => n.length > 0);
          evaluated[key] = names.map(name => this.evaluateValue(name));
        } else {
          evaluated[key] = this.evaluateValue(value);
        }
      } else {
        evaluated[key] = this.evaluateValue(value);
      }
    });

    return evaluated;
  }

  evaluateValue(item) {
    if (typeof item === 'number') return item;
    if (typeof item === 'string') {
      if (item.startsWith('font:')) {
        const fontPath = item.substring(5);
        const font = this.loadedFonts.get(fontPath);
        if (font) return font;
        console.warn(`Font not found: ${fontPath}`);
        return null;
      }
      if (this.geometries.has(item)) {
        const stored = this.geometries.get(item);
        return stored.userData?.curve || stored;
      }
      if (item.includes('ctx.') || item.includes('Math.')) {
        return this.evaluateExpression(item);
      }
      return item;
    }
    return item;
  }

  evaluateExpression(expr) {
    if (typeof expr !== 'string') return expr;
    if (!isNaN(Number(expr))) return Number(expr);

    try {
      const func = new Function('Math', 'ctx', `try { with (ctx) { return ${expr}; } } catch (e) { return 0; }`);
      return func(Math, this.context);
    } catch (e) {
      console.warn(`Eval failed: ${expr}`);
      return 0;
    }
  }

  getMaterial(name) {
    return this.materials.get(name) || 
           this.materials.get('default') || 
           new this.THREE.MeshStandardMaterial({ color: 0x808080 });
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
      if (mat) obj.material = mat;
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

    const pos = transform.position ? t(transform.position) : null;
    const rot = transform.rotation ? t(transform.rotation) : null;
    const scl = transform.scale ? t(transform.scale) : null;

    if (obj.isBufferGeometry) {
      if (scl) obj.scale(scl[0], scl[1], scl[2]);
      if (rot) {
        obj.rotateX(rot[0]);
        obj.rotateY(rot[1]);
        obj.rotateZ(rot[2]);
      }
      if (pos) obj.translate(pos[0], pos[1], pos[2]);
    } else {
      if (pos) obj.position.set(pos[0], pos[1], pos[2]);
      if (rot) obj.rotation.set(rot[0], rot[1], rot[2]);
      if (scl) obj.scale.set(scl[0], scl[1], scl[2]);
    }
  }

  executeLoop(action, group) {
    const { varName, from, to, body } = action;
    const start = this.evaluateExpression(from);
    const end = this.evaluateExpression(to);

    if (Math.abs(end - start) > 1000) return;

    for (let i = start; i <= end; i++) {
      this.context[varName] = i;
      if (Array.isArray(body)) {
        body.forEach(a => this.executeAction(a, group));
      }
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
    if (procedure) {
      (procedure.steps || []).forEach(step => {
        this.executeAction(
          {
            do: step.helper,
            params: step.params,
            as: step.store,
            transform: step.transform,
            material: step.material
          },
          group
        );
      });
    }
    return group;
  }
}

export default ProceduralExecutor;