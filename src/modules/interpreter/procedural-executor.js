// ============================================================================
// procedural-executor-diagnostic.js
// ============================================================================
// DEBUG MODE: Wraps all Object.entries calls to catch null/undefined
// Check your Console logs for "❌ CRITICAL: safeEntries failed"
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
     * Debug helper to safely iterate objects and log failures
     */
    safeEntries(obj, sourceName) {
        if (obj === undefined || obj === null) {
            console.error(`❌ CRITICAL: safeEntries failed for '${sourceName}'. Value is:`, obj);
            return [];
        }
        if (typeof obj !== 'object') {
            console.error(`❌ CRITICAL: safeEntries failed for '${sourceName}'. Expected object, got:`, typeof obj);
            return [];
        }
        return Object.entries(obj);
    }

    execute(schema, parameters = {}) {
        console.group("🚀 ProceduralExecutor.execute()");
        
        // 1. Input Validation & Parsing
        if (typeof schema === 'string') {
            console.log("ℹ️ Parsing schema from string...");
            try {
                schema = JSON.parse(schema);
            } catch (e) {
                console.error("❌ JSON Parse Error:", e);
                console.groupEnd();
                return new THREE.Group();
            }
        }

        if (!schema || typeof schema !== 'object') {
            console.error("❌ Invalid schema input:", schema);
            console.groupEnd();
            return new THREE.Group();
        }

        // 2. Debug Log the Schema Structure
        console.log("Schema Debug:", {
            version: schema.version,
            hasMaterials: !!schema.materials,
            hasDefinitions: !!schema.definitions,
            hasActions: !!schema.actions,
            materialsType: typeof schema.materials,
            definitionsType: typeof schema.definitions
        });

        // 3. Reset State
        this.geometries.clear();
        this.materials.clear();
        this.dynamicHelpers.clear();
        this.context = {};

        // 4. Initialize Materials (Guarded)
        if (schema.materials) {
            this.initializeMaterials(schema.materials);
        }
        
        // 5. Register Helpers (Guarded)
        if (schema.definitions) {
            this.registerDynamicHelpers(schema.definitions);
        }

        // 6. Run Versioned Executor
        const version = parseFloat(schema.version || 3.2);
        let result;
        
        try {
            if (version >= 4.0) {
                result = this.executeV4(schema, parameters);
            } else {
                result = this.executeV3(schema, parameters);
            }
        } catch (err) {
            console.error("❌ Execution Crash:", err);
            result = new THREE.Group();
        }

        console.groupEnd();
        return result;
    }

    registerDynamicHelpers(definitions) {
        // DEBUG: Use safeEntries
        const entries = this.safeEntries(definitions, 'definitions');
        
        for (const [name, def] of entries) {
            try {
                const body = def.code || def; 
                if (!body || typeof body !== 'string') continue;

                const func = new Function('params', 'THREE', 'helpers', body);
                const boundFunc = (params) => func(params, THREE, helpers);
                
                this.dynamicHelpers.set(name, boundFunc);
                console.log(`✅ Registered dynamic helper: ${name}`);
            } catch (e) {
                console.error(`❌ Failed to compile helper ${name}:`, e);
            }
        }
    }

    initializeMaterials(materialsConfig) {
        // DEBUG: Use safeEntries
        const entries = this.safeEntries(materialsConfig, 'materials');

        for (const [name, config] of entries) {
            if (!config) continue;
            this.materials.set(name, new THREE.MeshStandardMaterial({
                color: new THREE.Color(config.color || '#808080'),
                roughness: config.roughness ?? 0.5,
                metalness: config.metalness ?? 0.0,
                transparent: config.transparent ?? false,
                opacity: config.opacity ?? 1.0,
                side: THREE.DoubleSide
            }));
        }
    }

    // ========== V4.0 EXECUTOR ==========
    executeV4(schema, parameters) {
        // 1. Global Parameters
        if (schema.globalParameters) {
            const entries = this.safeEntries(schema.globalParameters, 'globalParameters');
            for (const [key, param] of entries) {
                this.context[key] = parameters[key] ?? param.value ?? param;
            }
        }

        // 2. Context
        if (schema.context) {
            const entries = this.safeEntries(schema.context, 'context');
            for (const [key, value] of entries) {
                if (this.context[key] === undefined) {
                    this.context[key] = value;
                }
            }
        }

        const group = new THREE.Group();
        group.name = schema.intent || 'Generated';

        // 3. Actions
        if (Array.isArray(schema.actions)) {
            schema.actions.forEach((action, index) => {
                // Pass index for debugging
                this.executeAction(action, group, index);
            });
        } else {
            console.warn("⚠️ Schema has no 'actions' array");
        }

        return group;
    }

    executeAction(action, group, index = 0) {
        if (!action) return;
        const { thought, do: helperName, params, transform, material, as: storeName, visible } = action;

        if (thought) console.log(`[Action ${index}] 📌 ${thought}`);

        if (helperName === 'loop') return this.executeLoop(action, group);
        if (helperName === 'clone') return this.executeClone(action, group);

        // Helper Lookup
        let helperFn = this.dynamicHelpers.get(helperName);
        if (!helperFn) helperFn = helpers[helperName];
        if (!helperFn && helpers.default) helperFn = helpers.default[helperName];

        if (!helperFn) {
            console.warn(`[Action ${index}] ❌ Helper not found: ${helperName}`);
            return;
        }

        // Parameter Evaluation
        // DEBUG: Log params before evaluation
        // console.log(`[Action ${index}] Params input:`, params);
        const evalParams = this.evaluateParamsCarefully(params, `action_${index}_params`);

        let result;
        try {
            result = helperFn(evalParams);
        } catch (error) {
            console.error(`[Action ${index}] ❌ Error running ${helperName}:`, error);
            return;
        }

        if (!result) return;

        if (storeName) this.geometries.set(storeName, result);

        if (transform) this.applyTransform(result, transform);

        const mat = this.getMaterial(material);
        if (Array.isArray(result)) {
            result.forEach(g => this.addToGroup(g, group, mat, visible));
        } else {
            this.addToGroup(result, group, mat, visible);
        }
    }

    // ========== PARAMETER EVALUATION (Probable Crash Site) ==========
    evaluateParamsCarefully(params, contextLabel = 'params') {
        // Guard Clause
        if (!params) return {}; 

        // DEBUG: Use safeEntries
        const entries = this.safeEntries(params, contextLabel);
        
        const evaluated = {};
        for (const [key, value] of entries) {
            if (Array.isArray(value)) {
                evaluated[key] = value.map(item => this.evaluateValue(item));
            }
            else if (typeof value === 'object' && value !== null) {
                // Recursion: Update label to track nesting
                evaluated[key] = this.evaluateParamsCarefully(value, `${contextLabel}.${key}`);
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
            if (this.geometries.has(item)) {
                const stored = this.geometries.get(item);
                return stored.userData?.curve || stored;
            }
            if (item.includes('ctx.') || item.includes('Math.') || item.includes('Math[')) {
                return this.evaluateExpression(item);
            }
        }
        return item;
    }

    evaluateExpression(expr) {
        if (typeof expr !== 'string') return expr;
        try {
            let processed = expr.replace(/ctx\.(\w+)/g, (_, v) => this.context[v] ?? 0);
            return new Function('Math', 'ctx', `return ${processed};`)(Math, this.context);
        } catch (e) {
            console.warn(`Expr Eval Failed: ${expr}`, e);
            return 0;
        }
    }

    // ========== UTILS ==========
    getMaterial(name) {
        return this.materials.get(name) || this.materials.get('default') || new THREE.MeshStandardMaterial({ color: 0x808080 });
    }

    addToGroup(obj, group, mat, visible) {
        if (!obj) return;
        const isVis = visible !== false;
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
        const t = (v) => this.evaluateArray(v);
        if (transform.position) {
            const [x,y,z] = t(transform.position);
            obj.isBufferGeometry ? obj.translate(x,y,z) : obj.position.set(x,y,z);
        }
        if (transform.rotation) {
            const [x,y,z] = t(transform.rotation);
            obj.isBufferGeometry ? (obj.rotateX(x), obj.rotateY(y), obj.rotateZ(z)) : obj.rotation.set(x,y,z);
        }
        if (transform.scale) {
            const [x,y,z] = t(transform.scale);
            obj.isBufferGeometry ? obj.scale(x,y,z) : obj.scale.set(x,y,z);
        }
    }

    evaluateArray(arr) {
        if (!Array.isArray(arr)) return [0,0,0];
        return arr.map(v => typeof v === 'string' ? this.evaluateExpression(v) : v);
    }

    // ========== LEGACY & FLOW ==========
    executeLoop(action, group) {
        const { var: varName, from, to, body } = action;
        const start = this.evaluateExpression(from);
        const end = this.evaluateExpression(to);
        if (Math.abs(end - start) > 1000) return; // Safety
        
        for (let i = start; i < end; i++) {
            this.context[varName] = i;
            if (Array.isArray(body)) body.forEach(a => this.executeAction(a, group));
        }
        delete this.context[varName];
    }

    executeClone(action, group) {
        // Cloning logic same as before...
        if (!action.params?.id) return;
        const src = this.geometries.get(action.params.id);
        if (src && src.clone) {
            const c = src.clone();
            if (action.transform) this.applyTransform(c, action.transform);
            this.addToGroup(c, group, this.getMaterial(action.material), true);
        }
    }

    executeV3(schema, parameters) {
        console.warn("V3 Legacy Executor not fully implemented in diagnostic mode");
        return new THREE.Group();
    }
}
