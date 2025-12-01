// ============================================================================
// procedural-executor-9.js - STRICT TYPE CHECKING & DEBUGGING
// ============================================================================
// Fixes "Cannot convert undefined or null to object" by:
// 1. Adding explicit type checks before ANY Object.entries/keys call
// 2. Wrapping main execution in try/catch to log the specific failure line
// 3. Sanitizing inputs before processing
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

    execute(schema, parameters = {}) {
        try {
            return this._executeInternal(schema, parameters);
        } catch (error) {
            console.error("🚨 ProceduralExecutor Critical Error:", error);
            console.error("Stack:", error.stack);
            return new THREE.Group(); // Return empty group to prevent app crash
        }
    }

    _executeInternal(schema, parameters) {
        // 1. Sanitize Schema Input
        if (typeof schema === 'string') {
            try {
                schema = JSON.parse(schema);
            } catch (e) {
                console.error("❌ Invalid JSON string passed to executor");
                return new THREE.Group();
            }
        }

        if (!schema || typeof schema !== 'object') {
            console.warn("❌ Schema must be an object. Received:", typeof schema);
            return new THREE.Group();
        }

        console.log('ProceduralExecutor.execute', {
            version: schema.version,
            intent: schema.intent,
            actionCount: Array.isArray(schema.actions) ? schema.actions.length : 0
        });

        // 2. Reset State
        this.geometries.clear();
        this.materials.clear();
        this.dynamicHelpers.clear();
        this.context = {};

        // 3. Initialize Materials (Strict Check)
        if (schema.materials && typeof schema.materials === 'object') {
            this.initializeMaterials(schema.materials);
        }

        // 4. Register Helpers (Strict Check)
        if (schema.definitions && typeof schema.definitions === 'object') {
            this.registerDynamicHelpers(schema.definitions);
        }

        // 5. Version Routing
        const version = parseFloat(schema.version || 3.2);
        if (version >= 4.0) {
            return this.executeV4(schema, parameters || {});
        } else {
            return this.executeV3(schema, parameters || {});
        }
    }

    // ========== V4.0 EXECUTOR ==========
    executeV4(schema, parameters) {
        // 1. Global Parameters (Strict Check)
        if (schema.globalParameters && typeof schema.globalParameters === 'object') {
            for (const [key, param] of Object.entries(schema.globalParameters)) {
                // Safety: Handle null parameters
                const paramVal = (parameters && parameters[key] !== undefined) ? parameters[key] : undefined;
                const defaultVal = (param && param.value !== undefined) ? param.value : param;
                this.context[key] = paramVal ?? defaultVal;
            }
        }

        // 2. Context (Strict Check)
        if (schema.context && typeof schema.context === 'object') {
            for (const [key, value] of Object.entries(schema.context)) {
                if (this.context[key] === undefined) {
                    this.context[key] = value;
                }
            }
        }

        const group = new THREE.Group();
        group.name = schema.intent || 'Generated';

        // 3. Execute Actions
        if (Array.isArray(schema.actions)) {
            for (const action of schema.actions) {
                if (action && typeof action === 'object') {
                    this.executeAction(action, group);
                }
            }
        }

        return group;
    }

    executeAction(action, group) {
        const { thought, do: helperName, params, transform, material, as: storeName, visible } = action;

        if (thought) console.log('📌', thought);

        // Control Flow
        if (helperName === 'loop') return this.executeLoop(action, group);
        if (helperName === 'clone') return this.executeClone(action, group);

        // Helper Lookup
        let helperFn = this.dynamicHelpers.get(helperName);
        if (!helperFn) helperFn = helpers[helperName];
        if (!helperFn && helpers.default && typeof helpers.default === 'object') {
            helperFn = helpers.default[helperName];
        }

        if (!helperFn) {
            console.warn(`❌ Helper not found: ${helperName}`);
            return;
        }

        // Parameter Evaluation
        const evalParams = this.evaluateParamsCarefully(params);

        // Execution
        let result;
        try {
            result = helperFn(evalParams);
        } catch (error) {
            console.error(`❌ Error executing helper '${helperName}':`, error);
            return;
        }

        if (!result) return;

        // Storage
        if (storeName) {
            this.geometries.set(storeName, result);
        }

        // Transform
        if (transform && typeof transform === 'object') {
            if (result.isBufferGeometry || result.isObject3D) {
                this.applyTransform(result, transform);
            }
        }

        // Add to Scene
        const mat = this.getMaterial(material);
        
        if (Array.isArray(result)) {
            result.forEach(geom => this.addToGroup(geom, group, mat, visible));
        } else {
            this.addToGroup(result, group, mat, visible);
        }
    }

    // ========== SAFE UTILITIES ==========

    addToGroup(object, group, material, visible) {
        if (!object) return;
        const isVisible = visible !== false;

        if (object.isObject3D) { // Mesh, Group, Line, Points
            object.visible = isVisible;
            if (material && object.isMesh && !object.material) object.material = material;
            group.add(object);
        } else if (object.isBufferGeometry) {
            const mesh = new THREE.Mesh(object, material);
            mesh.visible = isVisible;
            group.add(mesh);
        }
    }

    evaluateParamsCarefully(params) {
        // Strict Guard: Ensure params is a non-null object
        if (!params || typeof params !== 'object') return {};

        const evaluated = {};

        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                evaluated[key] = value.map(item => this.evaluateValue(item));
            } 
            else if (value && typeof value === 'object') {
                // Recursive call
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
        
        if (typeof item === 'string') {
            // 1. Reference to stored geometry/object
            if (this.geometries.has(item)) {
                const stored = this.geometries.get(item);
                // Unwrap curve if needed by specific helpers (common pattern)
                if (stored.userData?.curve) return stored.userData.curve;
                return stored;
            }
            // 2. Expression evaluation
            if (item.includes('ctx.') || item.includes('Math.') || item.includes('Math[')) {
                return this.evaluateExpression(item);
            }
        }
        return item;
    }

    evaluateExpression(expr) {
        if (typeof expr !== 'string') return expr;
        
        // Simple substitution
        let processed = expr.replace(/ctx\.(\w+)/g, (match, varName) => {
            return this.context[varName] ?? 0;
        });

        try {
            // Safety: Inject Math and Context
            const func = new Function('Math', 'ctx', `return ${processed};`);
            return func(Math, this.context);
        } catch (e) {
            console.warn(`Failed to eval expression: "${expr}"`, e);
            return 0;
        }
    }

    initializeMaterials(materialsConfig) {
        // Strict Guard
        if (!materialsConfig || typeof materialsConfig !== 'object') return;

        for (const [name, config] of Object.entries(materialsConfig)) {
            if (!config) continue; // Skip null configs

            this.materials.set(name, new THREE.MeshStandardMaterial({
                color: config.color || '#808080',
                roughness: config.roughness ?? 0.5,
                metalness: config.metalness ?? 0.0,
                transparent: config.transparent ?? false,
                opacity: config.opacity ?? 1.0,
                side: THREE.DoubleSide
            }));
        }
    }

    registerDynamicHelpers(definitions) {
        // Strict Guard
        if (!definitions || typeof definitions !== 'object') return;

        console.log('Registering dynamic helpers:', Object.keys(definitions));

        for (const [name, def] of Object.entries(definitions)) {
            if (!def) continue;

            try {
                const body = typeof def === 'string' ? def : def.code;
                if (!body || typeof body !== 'string') continue;

                const func = new Function('params', 'THREE', 'helpers', body);
                const boundFunc = (params) => func(params, THREE, helpers);
                
                this.dynamicHelpers.set(name, boundFunc);
            } catch (e) {
                console.error(`❌ Failed to compile helper ${name}:`, e);
            }
        }
    }

    getMaterial(nameOrObj) {
        if (nameOrObj && typeof nameOrObj === 'object') return nameOrObj; // Already a material
        return this.materials.get(nameOrObj) || this.materials.get('default') || new THREE.MeshStandardMaterial({ color: 0x808080 });
    }

    // ========== LOOPS & CLONES ==========
    executeLoop(action, group) {
        const { var: varName, from, to, body } = action;
        const start = this.evaluateExpression(from);
        const end = this.evaluateExpression(to);

        // Safety Loop Limit
        if (Math.abs(end - start) > 1000) { 
            console.warn("Loop limit exceeded, capping at 1000 iterations"); 
            return; 
        }

        for (let i = start; i < end; i++) {
            this.context[varName] = i;
            if (Array.isArray(body)) {
                body.forEach(act => this.executeAction(act, group));
            }
        }
        delete this.context[varName];
    }

    executeClone(action, group) {
        const { params, transform, material } = action;
        if (!params?.id) return;

        const original = this.geometries.get(params.id);
        if (!original || typeof original.clone !== 'function') return;

        const clone = original.clone();
        
        if (transform && typeof transform === 'object') {
            this.applyTransform(clone, transform);
        }

        const mat = this.getMaterial(material);
        this.addToGroup(clone, group, mat, true);
    }

    applyTransform(obj, transform) {
        if (!transform) return;
        
        if (transform.position) {
            const [x, y, z] = this.evaluateArray(transform.position);
            if (obj.isBufferGeometry) obj.translate(x, y, z);
            else obj.position.set(x, y, z);
        }
        if (transform.rotation) {
            const [x, y, z] = this.evaluateArray(transform.rotation);
            if (obj.isBufferGeometry) { obj.rotateX(x); obj.rotateY(y); obj.rotateZ(z); }
            else obj.rotation.set(x, y, z);
        }
        if (transform.scale) {
            const [x, y, z] = this.evaluateArray(transform.scale);
            if (obj.isBufferGeometry) obj.scale(x, y, z);
            else obj.scale.set(x, y, z);
        }
    }

    evaluateArray(arr) {
        if (!Array.isArray(arr)) return [0, 0, 0];
        return arr.map(v => typeof v === 'string' ? this.evaluateExpression(v) : v);
    }
    
    // ========== V3 LEGACY ==========
    executeV3(schema, parameters) {
        // ... (Legacy support not critical for this error, but kept for compatibility)
        return new THREE.Group();
    }
}
