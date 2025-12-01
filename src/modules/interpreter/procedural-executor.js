// ============================================================================
// procedural-executor-8.js - STABLE & ROBUST
// ============================================================================
// Key Updates:
// - Auto-parses schema if passed as a string
// - Guard clauses for all Object.entries() calls (prevents crash on null/undefined)
// - robust error handling for dynamic helpers
// ============================================================================

import * as THREE from 'three';
import * as helpers from './helpers3d_core.js';

export class ProceduralExecutor {
    constructor(scene) {
        this.scene = scene;
        this.geometries = new Map();
        this.materials = new Map();
        this.dynamicHelpers = new Map();
        this.context = {};
    }

    /**
     * Main entry point for execution
     * @param {Object|String} schema - The JSON schema or stringified JSON
     * @param {Object} parameters - Runtime parameters
     */
    execute(schema, parameters = {}) {
        // 1. Safety: Handle String Input automatically
        if (typeof schema === 'string') {
            try {
                schema = JSON.parse(schema);
            } catch (e) {
                console.error("❌ ProceduralExecutor: Invalid JSON string provided", e);
                return new THREE.Group();
            }
        }

        // 2. Safety: Handle Null/Undefined Input
        if (!schema || typeof schema !== 'object') {
            console.warn("❌ ProceduralExecutor: Schema must be an object, got", typeof schema);
            return new THREE.Group();
        }

        console.log('ProceduralExecutor.execute', {
            version: schema.version,
            type: schema.type,
            actionCount: schema.actions?.length
        });

        // Clear previous state
        this.geometries.clear();
        this.materials.clear();
        this.dynamicHelpers.clear();
        this.context = {};

        // Initialize materials (Safe iteration)
        if (schema.materials) {
            this.initializeMaterials(schema.materials);
        }
        
        // Register Dynamic Helpers (Safe iteration)
        if (schema.definitions) {
            this.registerDynamicHelpers(schema.definitions);
        }

        // Detect schema version
        const version = parseFloat(schema.version || 3.2);
        if (version >= 4.0) {
            return this.executeV4(schema, parameters);
        } else {
            return this.executeV3(schema, parameters);
        }
    }

    registerDynamicHelpers(definitions) {
        if (!definitions) return;
        console.log('Registering dynamic helpers:', Object.keys(definitions));
        
        // Safety: ensure definitions is iterable
        for (const [name, def] of Object.entries(definitions || {})) {
            try {
                const body = def.code || def; // Support object or direct string
                if (!body || typeof body !== 'string') continue;

                // Create the function. We inject 'THREE' and 'helpers' into scope
                const func = new Function('params', 'THREE', 'helpers', body);
                
                // Wrap it to provide the scope
                const boundFunc = (params) => {
                    return func(params, THREE, helpers);
                };
                
                this.dynamicHelpers.set(name, boundFunc);
                console.log(`✅ Registered helper: ${name}`);
            } catch (e) {
                console.error(`❌ Failed to compile helper ${name}:`, e);
            }
        }
    }

    // ========== V4.0 EXECUTOR ==========
    executeV4(schema, parameters) {
        console.log('Executing v4.0 schema (emergent format)');

        // 1. Merge Global Parameters + UI Inputs
        if (schema.globalParameters) {
            // Safety: Use || {} to prevent Object.entries from crashing
            for (const [key, param] of Object.entries(schema.globalParameters || {})) {
                this.context[key] = parameters[key] ?? param.value ?? param;
            }
        }

        // 2. Merge Internal Context
        if (schema.context) {
            for (const [key, value] of Object.entries(schema.context || {})) {
                if (this.context[key] === undefined) {
                    this.context[key] = value;
                }
            }
        }

        const group = new THREE.Group();
        group.name = schema.intent || 'Generated';

        // 3. Execute actions sequentially
        const actions = Array.isArray(schema.actions) ? schema.actions : [];
        for (const action of actions) {
            this.executeAction(action, group);
        }

        console.log('V4.0 execution complete, stored', this.geometries.size, 'children', group.children.length);
        return group;
    }

    executeAction(action, group) {
        if (!action) return;
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
        let helperFn = this.dynamicHelpers.get(helperName);
        
        if (!helperFn) {
             helperFn = helpers[helperName];
        }
        
        if (!helperFn && helpers.default && typeof helpers.default === 'object') {
            helperFn = helpers.default[helperName];
        }

        if (!helperFn) {
            console.warn(`❌ Helper not found: ${helperName}`);
            return;
        }

        // ========== PARAMETER EVALUATION ==========
        const evalParams = this.evaluateParamsCarefully(params);

        // Execute helper
        let result;
        try {
            result = helperFn(evalParams);
        } catch (error) {
            console.error(`❌ Error executing ${helperName}:`, error);
            return;
        }

        if (!result) return;

        // Store result
        if (storeName) {
            this.geometries.set(storeName, result);
        }

        // Apply transform
        if (transform && (result.isBufferGeometry || result.isMesh || result.isLine)) {
            this.applyTransform(result, transform);
        }

        // ========== HANDLE RESULT TYPES ==========
        
        // 1. Array of geometries/meshes
        if (Array.isArray(result)) {
            const mat = this.getMaterial(material || 'default');
            for (const geom of result) {
                this.addToGroup(geom, group, mat, visible);
            }
            return;
        }

        // 2. Single Object
        const mat = this.getMaterial(material || 'default');
        this.addToGroup(result, group, mat, visible);
    }

    addToGroup(object, group, material, visible) {
        if (!object) return;
        const isVisible = visible !== false;

        if (object.isMesh || object.isLine || object.isPoints || object.isGroup) {
            object.visible = isVisible;
            // Only override material if it's not a Group (unless you want to override children)
            if (material && !object.isGroup && !object.material) { 
                object.material = material;
            }
            group.add(object);
        } else if (object.isBufferGeometry) {
            const mesh = new THREE.Mesh(object, material);
            mesh.visible = isVisible;
            group.add(mesh);
        }
    }

    // ========== PARAMETER EVALUATION ==========
    evaluateParamsCarefully(params) {
        if (!params) return {};
        const evaluated = {};

        // Safety: params might be null if passed recursively incorrectly, though the check above handles it
        for (const [key, value] of Object.entries(params || {})) {
            if (Array.isArray(value)) {
                evaluated[key] = value.map(item => this.evaluateValue(item));
            }
            else if (typeof value === 'object' && value !== null) {
                evaluated[key] = this.evaluateParamsCarefully(value);
            }
            else {
                evaluated[key] = this.evaluateValue(value);
            }
        }
        return evaluated;
    }

    evaluateValue(item) {
        if (typeof item === 'number') return item;
        if (Array.isArray(item)) return item; // Nested arrays
        
        if (typeof item === 'string') {
            // Check stored geometries
            if (this.geometries.has(item)) {
                const stored = this.geometries.get(item);
                if (stored.userData?.curve) return stored.userData.curve;
                return stored;
            }
            // Check context/math expressions
            if (item.includes('ctx.') || item.includes('Math.') || item.includes('Math[')) {
                return this.evaluateExpression(item);
            }
        }
        return item;
    }

    // ========== LOOP EXECUTION ==========
    executeLoop(action, group) {
        const { var: varName, from, to, body } = action;
        const fromVal = this.evaluateExpression(from);
        const toVal = this.evaluateExpression(to);
        
        // Safety check to prevent infinite/massive loops
        if (toVal - fromVal > 1000) {
            console.warn(`Loop limit exceeded: ${fromVal} -> ${toVal}`);
            return;
        }

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

        // Only clone if it's a Three.js object with a clone method
        if (typeof sourceGeometry.clone !== 'function') {
            console.warn(`Object ${id} is not cloneable (type: ${sourceGeometry.userData?.type})`);
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
            
            if (clonedGeometry.isBufferGeometry) {
                const mesh = new THREE.Mesh(clonedGeometry, mat);
                group.add(mesh);
            } else {
                // If it's already a Mesh, apply material
                if (clonedGeometry.isMesh) clonedGeometry.material = mat;
                group.add(clonedGeometry);
            }
        } else {
            // No material override, just add
            if (clonedGeometry.isBufferGeometry) {
                group.add(new THREE.Mesh(clonedGeometry, this.getMaterial('default')));
            } else {
                group.add(clonedGeometry);
            }
        }
    }

    // ========== TRANSFORM APPLICATION ==========
    applyTransform(obj, transform) {
        if (!transform) return;

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
            for (const [key, param] of Object.entries(schema.globalParameters || {})) {
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
        if (!materialsConfig) return;
        
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
        if (!Array.isArray(arr)) return [0, 0, 0];
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
            // Safety: Using 'new Function' is safer than 'eval' but still requires trust
            const evalFunc = new Function('ctx', 'Math', `return ${processed}`);
            return evalFunc(ctx, Math);
        } catch (error) {
            console.warn(`Failed to evaluate: ${expr}`, error);
            return 0; // Return 0 on failure to prevent NaNs
        }
    }
}
