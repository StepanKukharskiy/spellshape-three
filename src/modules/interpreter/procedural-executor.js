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
        this.geometries.clear();
        this.materials.clear();
        this.dynamicHelpers.clear();
        this.context = {};

        if (schema.materials) this.initializeMaterials(schema.materials);
        
        // Register Dynamic Helpers
        if (schema.definitions) {
            this.registerDynamicHelpers(schema.definitions);
        }

        const version = parseFloat(schema.version || 3.2);
        if (version >= 4.0) {
            return this.executeV4(schema, parameters);
        } else {
            return this.executeV3(schema, parameters);
        }
    }

    registerDynamicHelpers(definitions) {
        for (const [name, def] of Object.entries(definitions)) {
            try {
                let body = typeof def === 'object' ? def.code : def;
                if (!body) continue;

                // Safety: Ensure imports exist
                const safeTHREE = THREE;
                const safeHelpers = helpers;

                const func = new Function('params', 'THREE', 'helpers', body);
                const boundFunc = (params) => func(params, safeTHREE, safeHelpers);
                
                this.dynamicHelpers.set(name, boundFunc);
            } catch (e) {
                console.error(`Failed to compile ${name}:`, e);
            }
        }
    }

    executeV4(schema, parameters) {
        if (schema.globalParameters) {
            for (const [key, param] of Object.entries(schema.globalParameters)) {
                this.context[key] = parameters[key] ?? param.value ?? param;
            }
        }
        // Merge internal context
        if (schema.context) Object.assign(this.context, schema.context);

        const group = new THREE.Group();
        group.name = schema.intent || 'Generated';

        for (const action of schema.actions || []) {
            this.executeAction(action, group);
        }
        return group;
    }

    executeAction(action, group) {
        const { do: helperName, params, transform, material, as: storeName, visible } = action;

        // Helper Lookup
        let helperFn = this.dynamicHelpers.get(helperName);
        if (!helperFn) helperFn = helpers[helperName];
        if (!helperFn && helpers.default) helperFn = helpers.default[helperName];

        if (!helperFn) {
            console.warn(`Helper not found: ${helperName}`);
            return;
        }

        // Param Eval
        const evalParams = this.evaluateParamsCarefully(params);
        
        let result;
        try {
            result = helperFn(evalParams);
        } catch (e) {
            console.error(`Error in ${helperName}:`, e);
            return;
        }

        if (!result) return;

        if (storeName) this.geometries.set(storeName, result);

        if (transform) this.applyTransform(result, transform);

        // Render logic
        if (result.isObject3D || result.isBufferGeometry) {
            let obj = result;
            if (result.isBufferGeometry) {
                const mat = this.getMaterial(material);
                obj = new THREE.Mesh(result, mat);
            }
            obj.visible = visible !== false;
            group.add(obj);
        } else if (Array.isArray(result)) {
            // Handle arrays
            const mat = this.getMaterial(material);
            result.forEach(r => {
                if (r.isBufferGeometry) group.add(new THREE.Mesh(r, mat));
                else if (r.isObject3D) group.add(r);
            });
        }
    }

    evaluateParamsCarefully(params) {
        // FIX: Strict check
        if (!params || typeof params !== 'object') return {};

        const evaluated = {};
        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                evaluated[key] = value.map(v => this.resolveValue(v));
            } else if (typeof value === 'object' && value !== null) {
                evaluated[key] = this.evaluateParamsCarefully(value);
            } else {
                evaluated[key] = this.resolveValue(value);
            }
        }
        return evaluated;
    }

    resolveValue(val) {
        if (typeof val === 'string') {
            if (this.geometries.has(val)) return this.geometries.get(val);
            if (val.includes('ctx.') || val.includes('Math.')) return this.evaluateExpression(val);
        }
        return val;
    }

    // ... (Keep existing executeLoop, executeClone, applyTransform, executeV3, initializeMaterials, getMaterial, evaluateExpression, evaluateArray) ...
    // (Pasting the rest of your existing utility methods here)
    
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
    
    applyTransform(obj, transform) {
         if (transform.position) {
            const pos = this.evaluateArray(transform.position);
            if (obj.isBufferGeometry) obj.translate(pos[0], pos[1], pos[2]);
            else if (obj.position) obj.position.set(pos[0], pos[1], pos[2]);
        }
        // ... rest of transform logic
    }
    
    evaluateArray(arr) {
        return arr.map(item => typeof item === 'string' ? this.evaluateExpression(item) : item);
    }

    evaluateExpression(expr) {
        if (typeof expr !== 'string') return expr;
        if (expr.startsWith('ctx.')) return this.context[expr.replace('ctx.', '')] ?? 0;
        
        let processed = expr.replace(/ctx\.(\w+)/g, (m, v) => this.context[v] ?? 0);
        try {
            return new Function('ctx', 'Math', `return ${processed}`)(this.context, Math);
        } catch (e) {
            return expr;
        }
    }
}
