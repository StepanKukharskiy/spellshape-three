// ============================================================================
// procedural-executor.js - FIXED MATERIAL EVALUATION
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
        console.log('🚀 ProceduralExecutor.execute', { version: schema.version, type: schema.type });

        // Clear previous state
        this.geometries.clear();
        this.materials.clear();
        this.context = {};

        // Initialize materials
        if (schema.materials) {
            this._initializeMaterials(schema.materials);
        }

        // Detect schema version
        const version = parseFloat(schema.version) || 3.2;

        if (version >= 4.0) {
            return this._executeV4(schema, parameters);
        } else {
            return this._executeV3(schema, parameters);
        }
    }

    // ============================================================================
    // V4.0 EXECUTOR (Emergent Format)
    // ============================================================================

    _executeV4(schema, parameters) {
        console.log('📘 Executing v4.0 schema (emergent format)');

        // 1. Merge Global Parameters (UI Inputs)
        if (schema.globalParameters) {
            for (const [key, param] of Object.entries(schema.globalParameters)) {
                // Priority: User Input > Default Value
                this.context[key] = parameters[key] ?? param.value ?? param;
            }
        }

        // 2. Merge Internal Context (Schema Variables)
        if (schema.context) {
            for (const [key, value] of Object.entries(schema.context)) {
                if (this.context[key] === undefined) {
                    this.context[key] = value;
                }
            }
        }

        const group = new THREE.Group();
        group.name = schema.intent || 'Generated';

        // Execute actions sequentially
        for (const action of schema.actions || []) {
            this._executeAction(action, group);
        }

        console.log('✅ V4.0 execution complete', { 
            stored: this.geometries.size,
            children: group.children.length 
        });

        return group;
    }

    _executeAction(action, group) {
        const { thought, do: helperName, params, transform, material, as: storeName } = action;

        if (thought) console.log('💭', thought);

        // Handle Control Flow
        if (helperName === 'loop') return this._executeLoop(action, group);
        if (helperName === 'clone') return this._executeClone(action, group);

        // Get helper function
        const helperFn = helpers[helperName] || (helpers.default && helpers.default[helperName]);

        if (!helperFn) {
            console.warn(`⚠️ Helper not found: ${helperName}`);
            return;
        }

        // Evaluate parameters
        const evalParams = this._evaluateParams(params);

        // Execute helper
        let geometry;
        try {
            geometry = helperFn(evalParams);
            console.log(`✓ ${helperName}`, { params: evalParams, success: !!geometry });
        } catch (error) {
            console.error(`❌ Error executing ${helperName}:`, error);
            return;
        }

        if (!geometry) return;

        // Store geometry if name provided
        if (storeName) {
            this.geometries.set(storeName, geometry);
            console.log(`💾 Stored geometry: ${storeName}`);
        }

        // Apply transform if provided (Initial baking)
        if (transform) {
            this._applyTransform(geometry, transform);
        }

        // Create mesh and add to group
        // Only add to scene if material is specified OR if it's a final output
        if (geometry.isBufferGeometry || geometry.isGroup) {
            if (material) {
                // FIX: Evaluate material string if it contains logic
                let materialName = material;
                if (typeof material === 'string' && (material.includes('?') || material.includes('ctx') || material.includes('i') || material.includes('mod'))) {
                    materialName = this._evaluateExpression(material);
                }

                const mat = this._getMaterial(materialName);
                const mesh = geometry.isGroup ? geometry : new THREE.Mesh(geometry, mat);
                if (!geometry.isGroup) mesh.material = mat;

                group.add(mesh);
                console.log(`➕ Added mesh to group (material: ${materialName})`);
            }
        }
    }

    _executeLoop(action, group) {
        const { var: varName, from, to, body } = action;

        const fromVal = this._evaluateExpression(from);
        const toVal = this._evaluateExpression(to);

        console.log(`🔁 Loop: ${varName} from ${fromVal} to ${toVal}`);

        for (let i = fromVal; i < toVal; i++) {
            // Set loop variable in context
            this.context[varName] = i;

            // Execute loop body
            for (const bodyAction of body || []) {
                this._executeAction(bodyAction, group);
            }
        }
        // Clean up
        delete this.context[varName];
    }

    _executeClone(action, group) {
        const { params, transform, material } = action;
        const { id } = params || {};

        if (!id) return;

        const sourceGeometry = this.geometries.get(id);
        if (!sourceGeometry) {
            console.warn(`⚠️ Clone: source geometry not found: ${id}`);
            return;
        }

        const clonedGeometry = sourceGeometry.clone();

        if (transform) {
            this._applyTransform(clonedGeometry, transform);
        }

        if (material) {
            // FIX: Evaluate material string logic here too
            let materialName = material;
            if (typeof material === 'string' && (material.includes('?') || material.includes('ctx') || material.includes('i') || material.includes('mod'))) {
                materialName = this._evaluateExpression(material);
            }

            const mat = this._getMaterial(materialName);
            const mesh = new THREE.Mesh(clonedGeometry, mat);
            group.add(mesh);
        }
    }

    _applyTransform(geometry, transform) {
        if (transform.position) {
            const pos = this._evaluateArray(transform.position);
            geometry.translate(pos[0], pos[1], pos[2]);
        }

        if (transform.rotation) {
            const rot = this._evaluateArray(transform.rotation);
            geometry.rotateX(rot[0]);
            geometry.rotateY(rot[1]);
            geometry.rotateZ(rot[2]);
        }

        if (transform.scale) {
            const scl = this._evaluateArray(transform.scale);
            geometry.scale(scl[0], scl[1], scl[2]);
        }
    }

    // ============================================================================
    // V3.2 EXECUTOR (Legacy Format)
    // ============================================================================

    _executeV3(schema, parameters) {
        console.log('📗 Executing v3.2 schema');

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
            this._executeStep(step, group);
        }

        return group;
    }

    _executeStep(step, group) {
        const { action, helper, params, material, store, transform } = step;

        const helperFn = helpers[helper] || (helpers.default && helpers.default[helper]);
        if (!helperFn) return;

        const evalParams = this._evaluateParams(params);
        let geometry = helperFn(evalParams);

        if (!geometry) return;

        if (store) this.geometries.set(store, geometry);
        if (transform) this._applyTransform(geometry, transform);

        if ((geometry.isBufferGeometry || geometry.isGroup) && material) {
            // V3.2 also needs evaluation for material logic
            let materialName = material;
            if (typeof material === 'string' && (material.includes('mod') || material.includes('index'))) {
                 // Mock index for V3 legacy 'repeat' logic is handled differently usually,
                 // but we'll try basic evaluation
                 materialName = this._evaluateExpression(material);
            }
            const mat = this._getMaterial(materialName);
            const mesh = geometry.isGroup ? geometry : new THREE.Mesh(geometry, mat);
            if (!geometry.isGroup) mesh.material = mat;
            group.add(mesh);
        }
    }

    // ============================================================================
    // SHARED UTILITIES
    // ============================================================================

    _initializeMaterials(materialsConfig) {
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

    _getMaterial(materialName) {
        return this.materials.get(materialName) || new THREE.MeshStandardMaterial({ color: 0x808080 });
    }

        _evaluateParams(params) {
        if (!params) return {};

        const evaluated = {};
        for (const [key, value] of Object.entries(params)) {
            
            // 1. Handle Raw Expression Strings (Interpolation only)
            if (key === 'expression') {
                let expr = value;
                // Replace ctx.varName with its numeric value
                expr = expr.replace(/ctx\.(\w+)/g, (match, varName) => {
                    return this.context[varName] ?? 0;
                });
                evaluated[key] = expr;
                continue;
            }

            // 2. Handle Arrays (Recursion is key here!)
            if (Array.isArray(value)) {
                evaluated[key] = value.map(item => {
                    if (typeof item === 'string') {
                        if (this.geometries.has(item)) return this.geometries.get(item);
                        return this._evaluateExpression(item);
                    }
                    // RECURSION: If item is an object (like an operation), evaluate IT too
                    if (typeof item === 'object' && item !== null) {
                        return this._evaluateParams(item);
                    }
                    return item;
                });
            } 
            
            // 3. Handle Geometry References
            else if (typeof value === 'string') {
                if (this.geometries.has(value)) {
                    evaluated[key] = this.geometries.get(value);
                } else {
                    evaluated[key] = this._evaluateExpression(value);
                }
            } 
            
            // 4. Handle Nested Objects
            else if (typeof value === 'object' && value !== null) {
                evaluated[key] = this._evaluateParams(value);
            } 
            
            // 5. Primitives
            else {
                evaluated[key] = value;
            }
        }
        return evaluated;
    }


    _evaluateArray(arr) {
        return arr.map(item => {
            if (typeof item === 'string') {
                return this._evaluateExpression(item);
            }
            return item;
        });
    }

    _evaluateExpression(expr) {
        if (typeof expr !== 'string') return expr;
        if (expr === 'x' || expr === 'y' || expr === 'z') return expr;

        let processed = expr;

        processed = processed.replace(/ctx\.(\w+)/g, (match, varName) => {
            return this.context[varName] ?? 0;
        });

        processed = processed.replace(/\$(\w+)/g, (match, varName) => {
            return this.context[varName] ?? 0;
        });

        try {
            const ctx = this.context;
            const evalFunc = new Function('ctx', 'Math', `with(ctx) { return ${processed}; }`);
            return evalFunc(ctx, Math);
        } catch (error) {
            // If it's a simple string like "wall", return it
            return expr;
        }
    }
}
