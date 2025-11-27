import * as THREE from 'three';
import * as helpers from './helpers3d_core.js';

export class ProceduralExecutor {
  constructor(scene) {
    this.scene = scene;
    this.geometries = new Map();
    this.materials = new Map();
    this.context = {};
  }

  execute(schema, parameters = {}) {
    console.log('ProceduralExecutor.execute', {
      version: schema.version,
      type: schema.type,
      actionCount: schema.actions?.length
    });

    // Clear previous state
    this.geometries.clear();
    this.materials.clear();
    this.context = {};

    // Initialize materials
    if (schema.materials) {
      this.initializeMaterials(schema.materials);
    }

    // Detect schema version
    const version = parseFloat(schema.version || 3.2);

    if (version >= 4.0) {
      return this.executeV4(schema, parameters);
    } else {
      return this.executeV3(schema, parameters);
    }
  }

  // ========== V4.0 EXECUTOR ==========
  executeV4(schema, parameters) {
    console.log('Executing v4.0 schema (emergent format)');

    // 1. Merge Global Parameters + UI Inputs
    if (schema.globalParameters) {
      for (const [key, param] of Object.entries(schema.globalParameters)) {
        this.context[key] = parameters[key] ?? param.value ?? param;
      }
    }

    // 2. Merge Internal Context
    if (schema.context) {
      for (const [key, value] of Object.entries(schema.context)) {
        if (this.context[key] === undefined) {
          this.context[key] = value;
        }
      }
    }

    const group = new THREE.Group();
    group.name = schema.intent || 'Generated';

    // 3. Execute actions sequentially
    for (const action of schema.actions || []) {
      this.executeAction(action, group);
    }

    console.log('V4.0 execution complete, stored', this.geometries.size, 'children', group.children.length);
    return group;
  }

  executeAction(action, group) {
    const { thought, do: helperName, params, transform, material, as: storeName, visible } = action;

    if (thought) console.log('📌', thought);

    // Handle Control Flow
    if (helperName === 'loop') {
      return this.executeLoop(action, group);
    }
    if (helperName === 'clone') {
      return this.executeClone(action, group);
    }

    // ========== FIXED HELPER LOOKUP ==========
    let helperFn = helpers[helperName];
    if (!helperFn && helpers.default && typeof helpers.default === 'object') {
      helperFn = helpers.default[helperName];
    }

    if (!helperFn) {
      console.warn(`❌ Helper not found: ${helperName}`, {
        availableFunctions: Object.keys(helpers)
          .filter(k => typeof helpers[k] === 'function')
          .slice(0, 10)
          .join(', ')
      });
      return;
    }

    // ========== FIXED PARAMETER EVALUATION ==========
    // CRITICAL: Keep arrays as arrays, don't stringify them
    const evalParams = this.evaluateParamsCarefully(params);

    console.log(`Calling ${helperName}:`, { rawParams: params, evalParams });

    // Execute helper
    let geometry;
    try {
      geometry = helperFn(evalParams);
      console.log(`✅ ${helperName}:`, {
        success: !!geometry,
        geometryType: geometry?.type || typeof geometry
      });
    } catch (error) {
      console.error(`❌ Error executing ${helperName}:`, error);
      console.error('Stack:', error.stack);
      return;
    }

    if (!geometry) {
      console.warn(`⚠️ ${helperName} returned no geometry`);
      return;
    }

    // Store geometry
    if (storeName) {
      this.geometries.set(storeName, geometry);
      console.log(`📦 Stored: ${storeName}`);
    }

    // Apply transform if provided
    if (transform) {
      this.applyTransform(geometry, transform);
    }

    // Create mesh and add to group
    if (geometry.isBufferGeometry || geometry.isGroup) {
      if (material) {
        let materialName = material;
        if (typeof material === 'string' && (material.includes('?') || material.includes('ctx.'))) {
          materialName = this.evaluateExpression(material);
        }
        const mat = this.getMaterial(materialName);
        const mesh = geometry.isGroup ? geometry : new THREE.Mesh(geometry, mat);
        if (!geometry.isGroup) mesh.material = mat;
        mesh.visible = visible !== false;
        group.add(mesh);
      } else if (!geometry.isGroup) {
        const defaultMat = this.getMaterial('default');
        const mesh = new THREE.Mesh(geometry, defaultMat);
        mesh.visible = visible !== false;
        group.add(mesh);
      } else {
        geometry.visible = visible !== false;
        group.add(geometry);
      }
    }
  }

  // ========== NEW METHOD: Careful parameter evaluation ==========
  // This preserves arrays and objects, only evaluates strings with expressions
  evaluateParamsCarefully(params) {
    if (!params) return {};

    const evaluated = {};

    for (const [key, value] of Object.entries(params)) {
      // CRITICAL: Arrays stay as arrays
      if (Array.isArray(value)) {
        evaluated[key] = value.map(item => {
          // If item is a number or already processed, keep it
          if (typeof item === 'number') return item;
          // If it's an array (nested), keep it
          if (Array.isArray(item)) return item;
          // If it's a string that references a geometry, resolve it
          if (typeof item === 'string' && this.geometries.has(item)) {
            return this.geometries.get(item);
          }
          // If it's an expression string, evaluate it
          if (typeof item === 'string' && (item.includes('ctx.') || item.includes('Math'))) {
            return this.evaluateExpression(item);
          }
          return item;
        });
      }
      // Objects stay as objects
      else if (typeof value === 'object' && value !== null) {
        evaluated[key] = this.evaluateParamsCarefully(value);
      }
      // Strings: only evaluate if they contain expressions
      else if (typeof value === 'string') {
        // Check if it's a geometry reference
        if (this.geometries.has(value)) {
          evaluated[key] = this.geometries.get(value);
        }
        // Check if it's an expression (not just a plain string)
        else if (value.includes('ctx.') || value.includes('Math.') || value.includes('Math[')) {
          evaluated[key] = this.evaluateExpression(value);
        }
        // Otherwise keep the string as-is
        else {
          evaluated[key] = value;
        }
      }
      // Numbers and booleans stay as-is
      else {
        evaluated[key] = value;
      }
    }

    return evaluated;
  }

  executeLoop(action, group) {
    const { var: varName, from, to, body } = action;
    const fromVal = this.evaluateExpression(from);
    const toVal = this.evaluateExpression(to);

    console.log(`Loop: ${varName} from ${fromVal} to ${toVal}`);

    for (let i = fromVal; i < toVal; i++) {
      this.context[varName] = i;
      for (const bodyAction of body || []) {
        this.executeAction(bodyAction, group);
      }
    }

    delete this.context[varName];
  }

  executeClone(action, group) {
    const { params, transform, material } = action;
    const id = params?.id;

    if (!id) return;

    const sourceGeometry = this.geometries.get(id);
    if (!sourceGeometry) {
      console.warn(`Clone source not found: ${id}`);
      return;
    }

    const clonedGeometry = sourceGeometry.clone();

    if (transform) {
      this.applyTransform(clonedGeometry, transform);
    }

    if (material) {
      let materialName = material;
      if (typeof material === 'string' && material.includes('?')) {
        materialName = this.evaluateExpression(material);
      }
      const mat = this.getMaterial(materialName);
      const mesh = new THREE.Mesh(clonedGeometry, mat);
      group.add(mesh);
    }
  }

  applyTransform(geometry, transform) {
    if (transform.position) {
      const pos = this.evaluateArray(transform.position);
      geometry.translate(pos[0], pos[1], pos[2]);
    }
    if (transform.rotation) {
      const rot = this.evaluateArray(transform.rotation);
      geometry.rotateX(rot[0]);
      geometry.rotateY(rot[1]);
      geometry.rotateZ(rot[2]);
    }
    if (transform.scale) {
      const scl = this.evaluateArray(transform.scale);
      geometry.scale(scl[0], scl[1], scl[2]);
    }
  }

  // ========== V3.2 EXECUTOR (Legacy) ==========
  executeV3(schema, parameters) {
    console.log('Executing v3.2 schema (legacy format)');

    if (schema.globalParameters) {
      for (const [key, param] of Object.entries(schema.globalParameters)) {
        this.context[key] = parameters[key] ?? param.value ?? param;
      }
    }

    const group = new THREE.Group();
    group.name = 'Generated';
    const procedure = schema.procedures?.[0];

    if (!procedure) return group;

    for (const step of procedure.steps || []) {
      this.executeStep(step, group);
    }

    return group;
  }

  executeStep(step, group) {
    const { action, helper, params, material, store, transform } = step;
    const helperFn = helpers[helper] || (helpers.default?.[helper]);

    if (!helperFn) return;

    const evalParams = this.evaluateParamsCarefully(params);
    let geometry = helperFn(evalParams);

    if (!geometry) return;

    if (store) {
      this.geometries.set(store, geometry);
    }

    if (transform) {
      this.applyTransform(geometry, transform);
    }

    if (geometry.isBufferGeometry || geometry.isGroup) {
      const mat = this.getMaterial(material || 'default');
      const mesh = geometry.isGroup ? geometry : new THREE.Mesh(geometry, mat);
      if (!geometry.isGroup) mesh.material = mat;
      group.add(mesh);
    }
  }

  // ========== SHARED UTILITIES ==========

  initializeMaterials(materialsConfig) {
    for (const [name, config] of Object.entries(materialsConfig)) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.color || '#808080'),
        roughness: config.roughness ?? 0.5,
        metalness: config.metalness ?? 0.0,
        transparent: config.transparent ?? false,
        opacity: config.opacity ?? 1.0,
        side: THREE.DoubleSide
      });
      this.materials.set(name, material);
    }
  }

  getMaterial(materialName) {
    return this.materials.get(materialName) || new THREE.MeshStandardMaterial({ color: 0x808080 });
  }

  evaluateArray(arr) {
    return arr.map(item => {
      if (typeof item === 'string') {
        return this.evaluateExpression(item);
      }
      return item;
    });
  }

  evaluateExpression(expr) {
    if (typeof expr !== 'string') return expr;

    // Quick check for simple context variables
    if (expr.startsWith('ctx.')) {
      const varName = expr.replace('ctx.', '');
      return this.context[varName] ?? 0;
    }

    // Replace all ctx.variable references
    let processed = expr;
    processed = processed.replace(/ctx\.(\w+)/g, (match, varName) => {
      return this.context[varName] ?? 0;
    });

    // Try to evaluate as JavaScript
    try {
      const ctx = this.context;
      const evalFunc = new Function('ctx', 'Math', `return ${processed}`);
      return evalFunc(ctx, Math);
    } catch (error) {
      // If evaluation fails, return the string as-is
      console.warn(`Failed to evaluate: ${expr}`, error);
      return expr;
    }
  }
}