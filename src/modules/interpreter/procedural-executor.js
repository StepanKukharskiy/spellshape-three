// ============================================================================
// procedural-executor.js - FIXED with proper hierarchy flattening
// ============================================================================

import * as THREE from 'three';
import * as helpers3d from './helpers3d_core.js';
import * as helpers2d from './helpers2d.js';
import { FixedExpressionEvaluator } from './evaluator.js';
import { FixedMaterialManager } from './materials.js';

export class ProceduralExecutor {
  constructor(evaluator = null, materialManager = null) {
    this.evaluator = evaluator || new FixedExpressionEvaluator();
    this.materialManager = materialManager || new FixedMaterialManager();
    this.store = {};
    this.globalContext = {};
  }

  execute(schema, globalParams = {}) {
    this.store = {};
    this.globalContext = { ...globalParams };

    if (schema.materials) {
      for (const [name, matDef] of Object.entries(schema.materials)) {
        if (!this.materialManager.getMaterial(name)) {
          this.materialManager.createMaterial(name, matDef);
        }
      }
    }

    const results = [];
    if (schema.procedures) {
      for (const proc of schema.procedures) {
        const result = this._executeProcedure(proc, this.globalContext);
        if (result) results.push(result);
      }
    }

    if (results.length === 1) {
      return results[0];
    } else if (results.length > 1) {
      const group = new THREE.Group();
      results.forEach(r => group.add(r));
      return group;
    }
    return new THREE.Group();
  }

  _executeProcedure(procedure, context) {
    const procContext = { ...context };
    const steps = procedure.steps || [];

    let lastResult = null;
    for (const step of steps) {
      lastResult = this._executeStep(step, procContext);
    }

    return lastResult;
  }

  _executeStep(step, context) {
    if (!step || !step.action) {
      console.warn('Invalid step:', step);
      return null;
    }

    switch (step.action) {
      case 'loop':
        return this._executeLoop(step, context);
      case 'conditional':
        return this._executeConditional(step, context);
      case 'createGeometry':
        return this._executeCreateGeometry(step, context);
      case 'group':
        return this._executeGroup(step, context);
      case 'transform':
        return this._executeTransform(step, context);
      case 'store':
        return this._executeStore(step, context);
      case 'retrieve':
        return this._executeRetrieve(step, context);
      case 'repeat':
        return this._executeRepeat(step, context);
      default:
        console.warn(`Unknown action: ${step.action}`);
        return null;
    }
  }

  _executeLoop(step, context) {
    const { var: loopVar, from: fromExpr, to: toExpr, body } = step;

    const from = this._eval(fromExpr, context);
    const to = this._eval(toExpr, context);

    const results = [];
    for (let i = from; i < to; i++) {
      const loopContext = { ...context, [loopVar]: i };
      for (const substep of body) {
        const result = this._executeStep(substep, loopContext);
        if (result) results.push(result);
      }
    }

    if (results.length === 1) return results[0];
    if (results.length > 1) {
      const group = new THREE.Group();
      results.forEach(r => group.add(r));
      return group;
    }
    return null;
  }

  _executeConditional(step, context) {
    const { condition, body } = step;
    const result = this._eval(condition, context);

    if (result) {
      let lastResult = null;
      for (const substep of body) {
        lastResult = this._executeStep(substep, context);
      }
      return lastResult;
    }
    return null;
  }

  _executeCreateGeometry(step, context) {
    const { helper, params, material, transform, store, id } = step;

    const evaluatedParams = this._evalParams(params, context);

    const helperFn = helpers3d[helper];
    if (!helperFn) {
      console.warn(`Helper not found: ${helper}`);
      return null;
    }

    let geometry = helperFn(evaluatedParams);

    if (material) {
      const materialName = this._eval(material, context);
      const mat = this.materialManager.getMaterial(materialName);
      if (geometry instanceof THREE.Mesh) {
        geometry.material = mat;
      } else if (geometry instanceof THREE.Group) {
        geometry.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.material = mat;
          }
        });
      }
    }

    if (transform) {
      geometry = this._applyTransform(geometry, transform, context);
    }

    if (id) {
      geometry.name = this._eval(id, context);
    }

    if (store) {
      this.store[store] = geometry;
    }

    return geometry;
  }

  _executeGroup(step, context) {
    const { children, id, position, rotation, scale, material, store } = step;

    const group = new THREE.Group();

    if (children) {
      for (const childRef of children) {
        let child = null;

        if (typeof childRef === 'string') {
          child = this.store[childRef];
          if (!child) {
            console.warn(`Child not found in store: ${childRef}`);
            continue;
          }
        } else {
          child = childRef;
        }

        if (child) {
          const clonedChild = child.clone(true);
        group.add(clonedChild);
          //group.add(child);
        }
      }
    }

    if (position) {
      const pos = this._evalParams(position, context);
      group.position.set(pos[0], pos[1], pos[2]);
    }
    if (rotation) {
      const rot = this._evalParams(rotation, context);
      group.rotation.set(rot[0], rot[1], rot[2]);
    }
    if (scale) {
      const scl = this._evalParams(scale, context);
      group.scale.set(scl[0], scl[1], scl[2]);
    }

    if (material) {
      const materialName = this._eval(material, context);
      const mat = this.materialManager.getMaterial(materialName);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.material = mat;
        }
      });
    }

    if (id) {
      group.name = this._eval(id, context);
    }

    if (store) {
    this.store[store] = group;
  }

    return group;
  }

  _executeTransform(step, context) {
    const { target, ...transforms } = step;

    const geometry = this.store[target];
    if (!geometry) {
      console.warn(`Target not found: ${target}`);
      return null;
    }

    return this._applyTransform(geometry, transforms, context);
  }

  _executeStore(step, context) {
    const { target, value } = step;
    const geometry = value instanceof THREE.Object3D ? value : this.store[value];
    if (geometry) {
      this.store[target] = geometry;
    }
    return geometry;
  }

  _executeRetrieve(step, context) {
    const { from } = step;
    return this.store[from] || null;
  }

  _executeRepeat(step, context) {
  const { helper, params, count, axis, spacing, material, id } = step;
  const countVal = this._eval(count, context);
  const spacingVal = this._eval(spacing, context);
  const results = [];

  for (let i = 0; i < countVal; i++) {
    const repeatContext = { ...context, index: i };
    const evaluatedParams = this._evalParams(params, repeatContext);
    
    const helperFn = helpers3d[helper];
    if (!helperFn) {
      console.warn(`Helper not found: ${helper}`);
      continue;
    }
    
    // Create geometry (with position/rotation/scale from params already applied)
    let geometry = helperFn(evaluatedParams);
    
    // ✅ KEY FIX: Reset to origin, then apply ONLY spacing offset
    // This avoids double-application of position
    geometry.position.set(0, 0, 0);
    geometry.rotation.set(0, 0, 0);
    geometry.scale.set(1, 1, 1);
    
    // ✅ Now apply the base position from params
    const basePos = evaluatedParams.position 
      ? (Array.isArray(evaluatedParams.position) 
          ? evaluatedParams.position 
          : [evaluatedParams.position, 0, 0])
      : [0, 0, 0];
    
    // ✅ Calculate spacing offset
    const offset = [0, 0, 0];
    if (axis === 'x') offset[0] = i * spacingVal;
    else if (axis === 'y') offset[1] = i * spacingVal;
    else if (axis === 'z') offset[2] = i * spacingVal;
    
    // ✅ Apply combined position
    geometry.position.set(
      basePos[0] + offset[0],
      basePos[1] + offset[1],
      basePos[2] + offset[2]
    );
    
    // Apply material
    if (material) {
      const materialName = this._eval(material, repeatContext);
      const mat = this.materialManager.getMaterial(materialName);
      if (geometry instanceof THREE.Mesh) {
        geometry.material = mat;
      }
    }
    
    results.push(geometry);
  }
  
  const masterGroup = new THREE.Group();
  results.forEach(r => masterGroup.add(r));
  
  if (id) masterGroup.name = this._eval(id, context);
  if (step.store) this.store[step.store] = masterGroup;
  
  return masterGroup;
}


  _applyTransform(geometry, transforms, context) {
    if (!geometry) return null;

    if (transforms.position) {
      const pos = this._evalParams(transforms.position, context);
      geometry.position.set(pos[0], pos[1], pos[2]);
    }

    if (transforms.rotateX || transforms.rotateY || transforms.rotateZ || transforms.rotation) {
      let rot = transforms.rotation || [
        this._eval(transforms.rotateX || 0, context),
        this._eval(transforms.rotateY || 0, context),
        this._eval(transforms.rotateZ || 0, context)
      ];
      if (typeof rot === 'string') rot = this._eval(rot, context);
      if (Array.isArray(rot)) {
        const euler = new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ');
        const quat = new THREE.Quaternion().setFromEuler(euler);
        geometry.quaternion.multiplyQuaternions(quat, geometry.quaternion);
      }
    }

    if (transforms.scale) {
      const scl = this._evalParams(transforms.scale, context);
      geometry.scale.set(scl[0], scl[1], scl[2]);
    }

    return geometry;
  }

  _eval(expr, context) {
    if (typeof expr === 'string') {
      if (expr.includes('$') || expr.includes('(')) {
        return this.evaluator.evaluate(expr, context);
      }
      return expr;
    }
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'boolean') return expr;
    if (Array.isArray(expr)) {
      return expr.map(e => this._eval(e, context));
    }
    return expr;
  }

  _evalParams(params, context) {
  if (!params) return {};
  const evaluated = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && this.store[value]) {
      // String reference - resolve from store
      evaluated[key] = this.store[value];
    } else if (Array.isArray(value)) {
      // Recursively resolve string references in arrays
      evaluated[key] = value.map(item => {
        if (typeof item === 'string' && this.store[item]) {
          return this.store[item];
        } else if (typeof item === 'string') {
          return this._eval(item, context);
        }
        return item;
      });
    } else if (typeof value === "string" && this._is2DHelperCall(value)) {
      // ✅ NEW: Execute 2D helper function calls
      evaluated[key] = this._eval2DHelper(value, context);
    } else {
      evaluated[key] = this._eval(value, context);
    }
  }
  
  return evaluated;
}

// ✅ NEW: Check if string is a 2D helper call
_is2DHelperCall(str) {
  const helpers = ['rect2d', 'roundedRect2d', 'polygon2d', 'ellipse2d', 'arc2d', 
                   'bezier2d', 'catmullRom2d', 'spiral2d', 'regularStar2d', 
                   'kochSnowflake2d', 'line2d', 'polyline2d'];
  return helpers.some(h => str.includes(h + '('));
}

// ✅ NEW: Evaluate 2D helper function
_eval2DHelper(expr, context) {
  try {
    // First, evaluate any $variable patterns
    let evaluatedExpr = expr;
    const varPattern = /\$(\w+)/g;
    
    evaluatedExpr = evaluatedExpr.replace(varPattern, (match, varName) => {
      const value = context[varName];
      if (value !== undefined) {
        return value;
      }
      console.warn(`Variable ${varName} not found in context:`, varName);
      return match;
    });
    
    console.log('Evaluated 2D helper expression:', evaluatedExpr);
    
    // Create function with helpers2d functions in scope
    const func = new Function(
      ...Object.keys(helpers2d),
      `return ${evaluatedExpr};`
    );
    
    // Call with helpers2d functions as arguments
    const result = func(...Object.values(helpers2d));
    console.log('2D helper result:', result);
    return result;
  } catch (e) {
    console.error(`Failed to evaluate 2D helper: ${expr}`, e);
    return null;
  }
}




}

export function buildSceneFromProcedural(schema, scene, options = {}) {
  const {
    evaluator = new FixedExpressionEvaluator(),
    materialManager = new FixedMaterialManager()
  } = options;

  const executor = new ProceduralExecutor(evaluator, materialManager);
  const geometry = executor.execute(schema);

  if (geometry) {
    scene.add(geometry);
  }

  return { geometry, executor };
}