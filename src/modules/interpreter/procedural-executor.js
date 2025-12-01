// ============================================================================
// procedural-executor-11.js - BULLETPROOF ITERATION
// ============================================================================
// Fixes: "TypeError: Cannot convert undefined or null to object"
// Method: Replaces all Object.entries() with safe for...in loops.
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

    // ✅ CORE FIX: A safe looping utility that CANNOT crash on null/undefined
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

        // 1. Input Sanitization
        // Handle parameters explicitly being null (common JS pitfall)
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

        // 2. Reset State
        this.geometries.clear();
        this.materials.clear();
        this.dynamicHelpers.clear();
        this.context = {};

        // 3. Initialize Materials
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

        // 4. Register Helpers
        if (schema.definitions) {
            this.registerDynamicHelpers(schema.definitions);
        }

        console.log("🚩 Checkpoint 3: Setup Complete. Running Logic...");

        // 5. Execute Versioned Logic
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
                if (!body || typeof body !== 'string') return;

                const func = new Function('params', 'THREE', 'helpers', body);
                const boundFunc = (p) => func(p, THREE, helpers);
                this.dynamicHelpers.set(name, boundFunc);
                console.log(`✅ Registered helper: ${name}`);
            } catch (e) {
                console.error(`❌ Helper compile error (${name}):`, e);
            }
        });
    }

    // ========== V4.0 EXECUTOR ==========
    executeV4(schema, parameters) {
        // 1. Global Parameters
        if (schema.globalParameters) {
            this.safeLoop(schema.globalParameters, (key, param) => {
                const defaultVal = (param && param.value !== undefined) ? param.value : param;
                this.context[key] = parameters[key] ?? defaultVal;
            });
        }

        // 2. Context
        if (schema.context) {
            this.safeLoop(schema.context, (key, value) => {
                if (this.context[key] === undefined) {
                    this.context[key] = value;
                }
            });
        }

        const group = new THREE.Group();
        group.name = schema.intent || 'Generated';

        // 3. Actions
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

        // Helper Lookup
        let helperFn = this.dynamicHelpers.get(helperName);
        if (!helperFn) helperFn = helpers[helperName];
        if (!helperFn && helpers.default) helperFn = helpers.default[helperName];

        if (!helperFn) {
            console.warn(`⚠️ Action ${index}: Helper '${helperName}' not found`);
            return;
        }

        // Parameter Evaluation
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

    // ========== SAFE PARAMETER EVALUATION ==========
    evaluateParamsCarefully(params) {
        if (!params || typeof params !== 'object') return {};

        const evaluated = {};
        
        // USE SAFE LOOP instead of Object.entries
        this.safeLoop(params, (key, value) => {
            if (Array.isArray(value)) {
                evaluated[key] = value.map(item => this.evaluateValue(item));
            }
            else if (value && typeof value === 'object') {
                evaluated[key] = this.evaluateParamsCarefully(value);
            }
            else {
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
            if (item.includes('ctx.') || item.includes('Math.') || item.includes('Math[')) {
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

    // ========== UTILITIES ==========
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
             if (!Array.isArray(v)) return [0,0,0];
             return v.map(val => typeof val === 'string' ? this.evaluateExpression(val) : val);
        };

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

    // ========== LOGIC HELPERS ==========
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
        // Basic legacy support
        const group = new THREE.Group();
        const procedure = schema.procedures?.[0];
        if (procedure && procedure.steps) {
             procedure.steps.forEach(step => {
                 // Map V3 step to V4 action structure
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
