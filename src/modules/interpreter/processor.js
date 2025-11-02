/* processor.js - Geometry-First Edition
   Processes schema nodes, evaluates parameters, handles nested helper calls
   Returns processed nodes for sceneBuilder to render
*/

import * as THREE from 'three';
import { distributionPlugins } from '../plugins/distribution.js';
import {
  arc2d, bezier2d, polygon2d, ellipse2d, catmullRom2d,
  line2d, polyline2d, regularStar2d, rect2d, roundedRect2d,
  offset2d, mirror2d, transform2d, spiral2d, kochSnowflake2d
} from './helpers2d.js';

// Helper type checking functions
function isArc2d(obj) { return obj && typeof obj === 'object' && obj.kind === 'arc'; }
function isBezier2d(obj) { return obj?.kind === 'bezier'; }
function isEllipse2d(obj) { return obj?.kind === 'ellipse'; }
function isPolygon2d(obj) { return obj?.kind === 'polygon'; }
function isSpline2d(obj) { return obj?.kind === 'spline'; }
function isLine2d(obj) { return obj?.kind === 'line'; }
function isPolyline2d(obj) { return obj?.kind === 'polyline'; }
function isRegularStar2d(obj) { return obj?.kind === 'star'; }
function isRect2d(obj) { return obj?.kind === 'rect'; }
function isRoundedRect2d(obj) { return obj?.kind === 'roundedrect'; }
function isOffset2d(obj) { return obj?.kind === 'offset'; }
function isMirror2d(obj) { return obj?.kind === 'mirror'; }
function isTransform2d(obj) { return obj?.kind === 'transform'; }
function isSpiral2d(obj) { return obj?.kind === 'spiral'; }
function isKochSnowflake2d(obj) { return obj?.kind === 'kochsnowflake'; }

export class FixedTemplateProcessor {
  constructor(evaluator) {
    this.evaluator = evaluator;
  }

  process(template = [], parameters = {}, expressions = {}, context = {}) {
    return this._walk(template, context);
  }

  _walk(children, ctx) {
    const out = [];
    for (const it of children) {
      if (it.type === 'group') {
        out.push(this._group(it, ctx));
      } else if (it.type === 'repeat') {
        out.push(...this._repeat(it, ctx));
      } else {
        out.push(this._item(it, ctx));
      }
    }
    return out;
  }

  /* ========== GEOMETRY-FIRST: Handle helper3d nodes ========== */
  _item(it, ctx) {
    const node = { ...it };

    // NEW: Handle helper3d nodes - recursively evaluate params including nested helpers
    if (node.type === 'helper3d') {
      const helperFn = this.evaluator.functions[node.helper];
      if (!helperFn) {
        console.warn(`Helper function ${node.helper} not found`);
        return { type: 'group', id: node.id || 'unknown', children: [] };
      }

      // Recursively evaluate all params (handles nested helper3d calls)
      const evaluatedParams = {};
      for (const [key, value] of Object.entries(node.params || {})) {
        evaluatedParams[key] = this._evaluateParam(value, ctx);
      }

      // Call the helper function
      try {
        const result = helperFn(evaluatedParams);

        // Extract id from params (where it actually is)
        const resultId = evaluatedParams.id || node.id || node.helper;

        let material = node.material;
        if (material && typeof material === 'string') {
          // If it contains conditionals, evaluate it
          if (material.includes('if(') || material.includes('$') || material.includes('mod(')) {
            material = this.evaluator.evaluate(material, ctx);
          }
        }


        // Return a marker that tells sceneBuilder this is a geometry object
        return {
          type: '__helper3d_result',
          id: resultId,
          geometryObject: result,
          originalHelper: node.helper,
          material: material
        };
      } catch (e) {
        console.error(`Error calling helper ${node.helper}:`, e);
        return { type: 'group', id: node.id || 'error', children: [] };
      }
    }

    // Handle reference nodes (for cloning stored objects)
    if (node.type === 'reference') {
      const { target } = node;
      if (!target) {
        console.warn('reference node missing target:', node);
        return { type: 'group', id: node.id || 'empty_ref', children: [] };
      }

      return {
        type: '__reference',
        id: node.id || `ref_${target}`,
        target: target,
        position: node.position,
        rotation: node.rotation,
        scale: node.scale
      };
    }

    // Handle standard geometry nodes (box, extrude, etc.)
    if (node.dimensions) {
      node.dimensions = this._deepEvaluate(node.dimensions, ctx);
      if (node.dimensions.outer)
        node.dimensions.outer = this._expandArcsInArray(node.dimensions.outer, ctx);
      if (node.dimensions.holes)
        node.dimensions.holes = node.dimensions.holes.map(h =>
          this._expandArcsInArray(h, ctx)
        );
    }

    if (node.position)
      node.position = node.position.map(p => this.evaluator.evaluate(p, ctx));
    if (node.rotation)
      node.rotation = node.rotation.map(r => this.evaluator.evaluate(r, ctx));

    for (const key of ['material', 'id', 'name']) {
      if (typeof node[key] === 'string') {
        if (node[key].includes('if(') || node[key].includes('mod(')) {
          node[key] = this.evaluator.evaluate(node[key], ctx);
        } else if (/\$\w+/.test(node[key])) {
          node[key] = node[key].replace(/\$(\w+)/g, (_, p) => ctx[p] ?? `$${p}`);
        }
      }
    }

    if (node.children) node.children = this._walk(node.children, ctx);
    return node;
  }

  /* ========== GEOMETRY-FIRST: Recursively evaluate parameters ========== */
  _evaluateParam(value, ctx) {
    // If it's a helper3d descriptor, call it and return the geometry
    if (typeof value === 'object' && value !== null && value.type === 'helper3d') {
      const helperFn = this.evaluator.functions[value.helper];
      if (!helperFn) {
        console.warn(`Nested helper ${value.helper} not found`);
        return null;
      }

      // Recursively evaluate nested helper params
      const evaluatedParams = { ...ctx };  // ← Pass context as base!
      for (const [key, val] of Object.entries(value.params || {})) {
        evaluatedParams[key] = this._evaluateParam(val, ctx);
      }

      // Call the helper and return the actual THREE.js object
      try {
        return helperFn(evaluatedParams);
      } catch (e) {
        console.error(`Error calling nested helper ${value.helper}:`, e);
        return null;
      }
    }

    // If it's a reference, return marker for sceneBuilder to resolve
    if (typeof value === 'object' && value !== null && value.type === 'reference') {
      return { __reference: value.target };
    }

    // If it's a string with $variable or function call, evaluate it
    if (typeof value === 'string') {
      if (value.includes('$') || value.includes('(')) {
        return this.evaluator.evaluate(value, ctx);
      }
      return value;
    }

    // If it's an array, recursively evaluate each element
    if (Array.isArray(value)) {
      return value.map(v => this._evaluateParam(v, ctx));
    }

    // If it's an object, recursively evaluate properties
    if (typeof value === 'object' && value !== null) {
      const evaluated = {};
      for (const [key, val] of Object.entries(value)) {
        evaluated[key] = this._evaluateParam(val, ctx);
      }
      return evaluated;
    }

    // Otherwise return as-is (numbers, booleans, null)
    return value;
  }

  _group(g, ctx) {
    return {
      ...g,
      children: this._walk(g.children || [], ctx)
    };
  }

  _repeat(rep, ctx) {
    const count = this.evaluator.evaluate(rep.count, ctx);

    // Get distribution plugin
    const distro = distributionPlugins[rep.distribution?.type];

    // Calculate positions
    const poses = distro
      ? distro(rep.distribution, count, ctx, this.evaluator)
      : Array(count).fill([0, 0, 0]);

    const res = [];
    for (let i = 0; i < count; i++) {
      const subCtx = { ...ctx, index: i };
      if (rep.instance_parameters) {
        for (const [k, expr] of Object.entries(rep.instance_parameters))
          subCtx[k] = this.evaluator.evaluate(expr, subCtx);
      }
      res.push({
        type: 'group',
        id: `${rep.id}_${i}`,
        position: poses[i],
        children: this._walk(rep.children, subCtx)
      });
    }
    return res;
  }

  _deepEvaluate(obj, ctx) {
    if (typeof obj === 'string') return this.evaluator.evaluate(obj, ctx);
    if (typeof obj === 'number') return obj;
    if (Array.isArray(obj)) return obj.map(item => this._deepEvaluate(item, ctx));
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = this._deepEvaluate(v, ctx);
      }
      return out;
    }
    return obj;
  }

  _expandArcsInArray(arr, ctx) {
    const result = [];
    for (const item of arr) {
      if (isArc2d(item)) {
        const pts = arc2d(item);
        result.push(...pts);
      } else if (isBezier2d(item)) {
        const pts = bezier2d(item);
        result.push(...pts);
      } else if (isEllipse2d(item)) {
        const pts = ellipse2d(item);
        result.push(...pts);
      } else if (isPolygon2d(item)) {
        const pts = polygon2d(item);
        result.push(...pts);
      } else if (isSpline2d(item)) {
        const pts = catmullRom2d(item);
        result.push(...pts);
      } else if (isLine2d(item)) {
        const pts = line2d(item);
        result.push(...pts);
      } else if (isPolyline2d(item)) {
        const pts = polyline2d(item);
        result.push(...pts);
      } else if (isRegularStar2d(item)) {
        const pts = regularStar2d(item);
        result.push(...pts);
      } else if (isRect2d(item)) {
        const pts = rect2d(item);
        result.push(...pts);
      } else if (isRoundedRect2d(item)) {
        const pts = roundedRect2d(item);
        result.push(...pts);
      } else if (isOffset2d(item)) {
        const pts = offset2d(item);
        result.push(...pts);
      } else if (isMirror2d(item)) {
        const pts = mirror2d(item);
        result.push(...pts);
      } else if (isTransform2d(item)) {
        const pts = transform2d(item);
        result.push(...pts);
      } else if (isSpiral2d(item)) {
        const pts = spiral2d(item);
        result.push(...pts);
      } else if (isKochSnowflake2d(item)) {
        const pts = kochSnowflake2d(item);
        result.push(...pts);
      } else {
        result.push(this._deepEvaluate(item, ctx));
      }
    }
    return result;
  }
}