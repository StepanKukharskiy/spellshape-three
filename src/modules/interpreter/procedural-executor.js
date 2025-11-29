// ============================================================================
// procedural-executor-5.js - UPDATED WITH RESOLVER INTEGRATION
// ============================================================================
// Key changes:
// - Simpler executeAction (no manual unwrapping needed)
// - Handles wrapped curves, fields, grids seamlessly
// - Resolver layer handles all input normalization
// ============================================================================

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

    // ✅ SIMPLIFIED: executeAction now relies on resolver layer
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

    // ========== HELPER LOOKUP ==========
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

    // ========== PARAMETER EVALUATION ==========
    const evalParams = this.evaluateParamsCarefully(params);

    console.log(`Calling ${helperName}:`, { rawParams: params, evalParams });

    // Execute helper
    let result;
    try {
        result = helperFn(evalParams);
        console.log(`✅ ${helperName}:`, {
            success: !!result,
            resultType: result?.type || result?.userData?.type || typeof result
        });
    } catch (error) {
        console.error(`❌ Error executing ${helperName}:`, error);
        console.error('Stack:', error.stack);
        return;
    }

    if (!result) {
        console.warn(`⚠️ ${helperName} returned no result`);
        return;
    }

    // Store result (could be geometry, curve, field, grid, or wrapped object)
    if (storeName) {
        this.geometries.set(storeName, result);
        console.log(`📦 Stored: ${storeName}`, result.userData?.type || 'geometry');
    }

    // Apply transform if provided
    if (transform && (result.isBufferGeometry || result.isMesh || result.isLine)) {
        this.applyTransform(result, transform);
    }

    // ========== HANDLE DIFFERENT RESULT TYPES ==========

    // Is it a renderable object? (Line, Mesh, Group)
    if (result.isLine || result.isMesh || result.isGroup) {
        result.visible = visible !== false;
        group.add(result);
        return;
    }

    // Is it a bare geometry? Wrap in mesh
    if (result.isBufferGeometry) {
        const mat = this.getMaterial(material || 'default');
        const mesh = new THREE.Mesh(result, mat);
        mesh.visible = visible !== false;
        group.add(mesh);
        return;
    }
      
      // ✅ Handle array of geometries (from createFlowPipes, distributions, etc)
if (Array.isArray(result)) {
  console.log(`📦 Processing array of ${result.length} geometries`);
  const mat = this.getMaterial(material || 'default');
  
  for (const geom of result) {
    if (geom.isBufferGeometry) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = visible !== false;
      group.add(mesh);
    } else if (geom.isMesh || geom.isGroup || geom.isLine) {
      geom.visible = visible !== false;
      group.add(geom);
    }
  }
  return;
}

    // Is it a wrapped data object? (field, grid, points, etc.)
    if (result.userData) {
        const type = result.userData.type;
        console.log(`✓ Stored non-visual data: ${type}`);
        return;
    }

    console.warn(`⚠️ Unknown result type from ${helperName}:`, result);
}

    // ========== PARAMETER EVALUATION ==========
    evaluateParamsCarefully(params) {
    if (!params) return {};

    const evaluated = {};

    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            evaluated[key] = value.map(item => {
                if (typeof item === 'number') return item;
                if (Array.isArray(item)) return item;
                if (typeof item === 'string' && this.geometries.has(item)) {
                    return this.geometries.get(item);
                }
                if (typeof item === 'string' && (item.includes('ctx.') || item.includes('Math'))) {
                    return this.evaluateExpression(item);
                }
                return item;
            });
        }
        else if (typeof value === 'object' && value !== null) {
            evaluated[key] = this.evaluateParamsCarefully(value);
        }
        else if (typeof value === 'string') {
            // ✅ NEW: Check if it references a stored wrapped object
            if (this.geometries.has(value)) {
                const stored = this.geometries.get(value);
                // ✅ If it's wrapped (field, grid, curve), pass it unwrapped
                if (stored.userData?.curve) {
                    evaluated[key] = stored.userData.curve;  // Unwrap curve
                } // Helpers need metadata (size, segments, etc.), so pass the full wrapper.
                else if (stored.userData?.field || stored.userData?.grid || stored.userData?.voxels) {
                    evaluated[key] = stored; // <--- PASS THE FULL OBJECT
                
                } else {
                    evaluated[key] = stored;  // Not wrapped, use as-is
                }
            }
            else if (value.includes('ctx.') || value.includes('Math.') || value.includes('Math[')) {
                evaluated[key] = this.evaluateExpression(value);
            }
            else {
                evaluated[key] = value;
            }
        }
        else {
            evaluated[key] = value;
        }
    }

    return evaluated;
}


    // ========== LOOP EXECUTION ==========
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

    // ========== CLONE EXECUTION ==========
    executeClone(action, group) {
        const { params, transform, material } = action;
        const id = params?.id;

        if (!id) return;

        const sourceGeometry = this.geometries.get(id);
        if (!sourceGeometry) {
            console.warn(`Clone source not found: ${id}`);
            return;
        }

        // Handle wrapped objects vs geometries
        let geometry = sourceGeometry;
        if (sourceGeometry.userData) {
            if (sourceGeometry.userData.type === 'geometry') {
                geometry = sourceGeometry;
            } else {
                console.warn(`Cannot clone non-geometry: ${sourceGeometry.userData.type}`);
                return;
            }
        }

        const clonedGeometry = geometry.clone();

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

    // ========== TRANSFORM APPLICATION ==========
    applyTransform(obj, transform) {
        if (transform.position) {
            const pos = this.evaluateArray(transform.position);
            if (obj.isBufferGeometry) {
                obj.translate(pos[0], pos[1], pos[2]);
            } else if (obj.position) {
                obj.position.set(pos[0], pos[1], pos[2]);
            }
        }

        if (transform.rotation) {
            const rot = this.evaluateArray(transform.rotation);
            if (obj.isBufferGeometry) {
                obj.rotateX(rot[0]);
                obj.rotateY(rot[1]);
                obj.rotateZ(rot[2]);
            } else if (obj.rotation) {
                obj.rotation.set(rot[0], rot[1], rot[2]);
            }
        }

        if (transform.scale) {
            const scl = this.evaluateArray(transform.scale);
            if (obj.isBufferGeometry) {
                obj.scale(scl[0], scl[1], scl[2]);
            } else if (obj.scale) {
                obj.scale.set(scl[0], scl[1], scl[2]);
            }
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
            console.warn(`Failed to evaluate: ${expr}`, error);
            return expr;
        }
    }
}