// ============================================================================
// procedural-executor.js - FIXED with proper hierarchy flattening
// ============================================================================

import * as THREE from 'three';
import * as helpers from './helpers3d_core.js';
import * as helpers2d from './helpers2d.js';
import { FixedExpressionEvaluator } from './evaluator.js';
import { FixedMaterialManager } from './materials.js';

// procedural-executor.js - Updated for Emergent Architecture
// Supports both v3.2 (backward compatible) and v4.0 (new format)

// import * as THREE from 'three';
// import * as helpers from './helpers3d_core.js';

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

        // Merge context and parameters
        this.context = { ...schema.context, ...parameters };

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
        const { thought, do: helperName, params, transform, material, as: storeName, body } = action;

        if (thought) {
            console.log('💭', thought);
        }

        // Handle loop action
        if (helperName === 'loop') {
            return this._executeLoop(action, group);
        }

        // Handle clone action
        if (helperName === 'clone') {
            return this._executeClone(action, group);
        }

        // Get helper function
        const helperFn = helpers[helperName] || helpers.default[helperName];
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
            console.log(`✓ ${helperName}`, { params: evalParams, hasGeometry: !!geometry });
        } catch (error) {
            console.error(`❌ Error executing ${helperName}:`, error);
            return;
        }

        if (!geometry) {
            console.warn(`⚠️ ${helperName} returned null/undefined`);
            return;
        }

        // Store geometry if name provided
        if (storeName) {
            this.geometries.set(storeName, geometry);
            console.log(`💾 Stored geometry: ${storeName}`);
        }

        // Apply transform if provided
        if (transform) {
            this._applyTransform(geometry, transform);
        }

        // Create mesh and add to group
        if (geometry.isBufferGeometry) {
            const mat = this._getMaterial(material);
            const mesh = new THREE.Mesh(geometry, mat);
            group.add(mesh);
            console.log(`➕ Added mesh to group (material: ${material})`);
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

        // Clean up loop variable
        delete this.context[varName];
    }

    _executeClone(action, group) {
        const { params, transform } = action;
        const { id } = params || {};

        if (!id) {
            console.warn('⚠️ Clone action missing id parameter');
            return;
        }

        const sourceGeometry = this.geometries.get(id);
        if (!sourceGeometry) {
            console.warn(`⚠️ Clone: source geometry not found: ${id}`);
            return;
        }

        const clonedGeometry = sourceGeometry.clone();

        // Apply transform
        if (transform) {
            this._applyTransform(clonedGeometry, transform);
        }

        // Get material (usually from original)
        const mat = this.materials.values().next().value || new THREE.MeshStandardMaterial({ color: 0x808080 });
        const mesh = new THREE.Mesh(clonedGeometry, mat);
        group.add(mesh);
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
    // V3.2 EXECUTOR (Legacy Format - Backward Compatible)
    // ============================================================================

    _executeV3(schema, parameters) {
        console.log('📗 Executing v3.2 schema (legacy format)');

        // Merge global parameters
        if (schema.globalParameters) {
            for (const [key, param] of Object.entries(schema.globalParameters)) {
                this.context[key] = parameters[key] ?? param.value ?? param;
            }
        }

        const group = new THREE.Group();
        group.name = 'Generated';

        // Execute first procedure
        const procedure = schema.procedures?.[0];
        if (!procedure) {
            console.warn('⚠️ No procedures found in schema');
            return group;
        }

        console.log(`📋 Executing procedure: ${procedure.name}`);

        for (const step of procedure.steps || []) {
            this._executeStep(step, group);
        }

        console.log('✅ V3.2 execution complete', { 
            stored: this.geometries.size,
            children: group.children.length 
        });

        return group;
    }

    _executeStep(step, group) {
        const { action, helper, params, material, store, transform } = step;

        // Get helper function
        const helperFn = helpers[helper] || helpers.default[helper];
        if (!helperFn) {
            console.warn(`⚠️ Helper not found: ${helper}`);
            return;
        }

        // Evaluate parameters
        const evalParams = this._evaluateParams(params);

        // Execute helper
        let geometry;
        try {
            geometry = helperFn(evalParams);
            console.log(`✓ ${helper}`, { hasGeometry: !!geometry });
        } catch (error) {
            console.error(`❌ Error executing ${helper}:`, error);
            return;
        }

        if (!geometry) {
            console.warn(`⚠️ ${helper} returned null/undefined`);
            return;
        }

        // Store geometry
        if (store) {
            this.geometries.set(store, geometry);
            console.log(`💾 Stored: ${store}`);
        }

        // Apply transform
        if (transform) {
            this._applyTransform(geometry, transform);
        }

        // Create mesh and add to group
        if (geometry.isBufferGeometry && material) {
            const mat = this._getMaterial(material);
            const mesh = new THREE.Mesh(geometry, mat);
            group.add(mesh);
            console.log(`➕ Added mesh (material: ${material})`);
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
                opacity: config.opacity ?? 1.0
            });
            this.materials.set(name, material);
            console.log(`🎨 Material created: ${name}`);
        }
    }

    _getMaterial(materialName) {
        if (!materialName) {
            return new THREE.MeshStandardMaterial({ color: 0x808080 });
        }

        // Check if material exists
        if (this.materials.has(materialName)) {
            return this.materials.get(materialName);
        }

        // Default fallback
        console.warn(`⚠️ Material not found: ${materialName}, using default`);
        return new THREE.MeshStandardMaterial({ color: 0x808080 });
    }

    _evaluateParams(params) {
        if (!params) return {};

        const evaluated = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                // Handle geometry references
                if (this.geometries.has(value)) {
                    evaluated[key] = this.geometries.get(value);
                } else {
                    evaluated[key] = this._evaluateExpression(value);
                }
            } else if (Array.isArray(value)) {
                evaluated[key] = this._evaluateArray(value);
            } else if (typeof value === 'object' && value !== null) {
                evaluated[key] = this._evaluateParams(value);
            } else {
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

        // Replace $variable or ctx.variable with actual values
        let processed = expr;

        // Handle ctx.variable format (v4.0)
        processed = processed.replace(/ctx\.(\w+)/g, (match, varName) => {
            return this.context[varName] ?? 0;
        });

        // Handle $variable format (v3.2)
        processed = processed.replace(/\$(\w+)/g, (match, varName) => {
            return this.context[varName] ?? 0;
        });

        // Evaluate as JavaScript expression
        try {
            // Create safe evaluation context
            const ctx = this.context;
            const evalFunc = new Function('ctx', `with(ctx) { return ${processed}; }`);
            return evalFunc(ctx);
        } catch (error) {
            console.warn(`⚠️ Expression evaluation failed: ${expr}`, error);
            return 0;
        }
    }
}
