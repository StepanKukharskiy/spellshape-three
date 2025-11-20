// /modules/interpreter/evaluator.js
// ---------------------------------------------------------------------------
//  FixedExpressionEvaluator
//  ------------------------
//  Resolves $parameter references, supports basic math, utility helpers,
//  nested if() expressions and a small cache for performance.
//  Updated to support geometry-based helpers3D_core functions
// ---------------------------------------------------------------------------

import {
  arc2d, bezier2d, polygon2d, ellipse2d, catmullRom2d,
  line2d, polyline2d, regularStar2d, rect2d, roundedRect2d,
  offset2d, mirror2d, transform2d, spiral2d, kochSnowflake2d
} from './helpers2d.js';

// Import old helpers (if still needed for backwards compatibility)
import {
  checkerboardPanels3D, waveFacade3D, perimeterPanels3D, grid3D
} from './helpers3d.js';

import {
  towerStructure3D, coreBox3D, extrude3D, columnGrid3D,
  floorSlab3D, taperTransform3D, twistTransform3D, repeatLinear3D, 
  addVectors, arrayHelper3D, radialArray3D, samplePointOnPathLinear,
  tangentOnPathLinear, pathFollowHelper3D, voussoirArchModule, 
  repeatAlongCurve3D,
} from './helpers3d_extended.js';

// NEW: Import all 88 geometry-returning helpers from helpers3D_core
import { 
  // Basic geometry (14)
    createBox, createSphere, createCylinder, createCone, createTorus, createTorusKnot,
    createPlane, createCircle, createRing, createPolyhedron, createIcosahedron,
    createOctahedron, createTetrahedron, createDodecahedron,

    // Advanced geometry (6)
    createExtrude, createLoft, createLathe, createConvexHull, createParametricSurface, createText3D,

    // Curves & paths (6)
    createLinePath, createSplinePath, createArcPath, createHelixPath, createBezierPath, createPipe,

    // Deformations (5)
    twistGeometry, taperGeometry, bendGeometry, deformByNoise, deformByVectorField,

    // Boolean & utilities (4)
    mergeGeometries, unionGeometry, subtractGeometry, intersectGeometry,

    // Distribution (5)
    repeatLinear3d, repeatRadial3d, repeatAlongCurve3d, distributeOnGrid3d, distributeRandom3d,

    // Fields & attractors (2)
    createVectorField, flowField,

    // Procedural patterns (2)
    cellularAutomata, reactionDiffusion,

    // Emergent features (2)
    modifyGeometry, meshFromMarchingCubes,

    // Complex algorithms (11)
    lSystemGeometry, differentialGrowth, meshFromVoxelGrid,
    pointSetCentroid, pointSetBoundingBox, closestPointOnCurve, signedDistanceToMesh,
    measureVolume, measureArea, subdivisionSurface, voronoiDivision, convexHullGeometry
} from './helpers3d_core.js';

export class FixedExpressionEvaluator {
  constructor() {
    // Memo-cache → key = expr + JSON.stringify(context)
    this.cache = new Map();

    // Functions and constants that the mini-language understands
    this.functions = {
      /* Functions from helpers2d.js */
      arc2d, bezier2d, polygon2d, ellipse2d, catmullRom2d,
      line2d, polyline2d, regularStar2d, rect2d, roundedRect2d,
      offset2d, mirror2d, transform2d, spiral2d, kochSnowflake2d,
      spline2d: catmullRom2d,

      /* Legacy helpers3d.js (backwards compatibility) */
      checkerboardPanels3D, waveFacade3D, perimeterPanels3D, grid3D,

      /* helpers3d_extended.js */
      towerStructure3D, coreBox3D, extrude3D, columnGrid3D,
      floorSlab3D, taperTransform3D, twistTransform3D, repeatLinear3D, 
      addVectors, arrayHelper3D, radialArray3D, samplePointOnPathLinear,
      tangentOnPathLinear, pathFollowHelper3D, voussoirArchModule, 
      repeatAlongCurve3D,

      /* NEW: All 88 geometry-returning helpers from helpers3D_core */
      createBox, createCylinder, createSphere, createExtrude, createLoft,
      translateGeometry, rotateGeometry, scaleGeometry, twistGeometry,
      taperGeometry, mirrorGeometry, arrayGeometry, repeatLinear3d,
      repeatAlongCurve3d, repeatRadial3d, distributeAlongPerimeter3d,
      distributeOnSurface3d, distributeInVolume3d, distributeOnGrid3d,
      distributeRandom3d, sweepGeometry, createPipe, createArcPath,
      createSplinePath, createHelixPath, createGridPath, offsetCurve,
      connectPaths, loftBetweenCurves, tessellateSurface, thickenSurface,
      normalOnSurface, uvOnSurface, projectOnSurface, deformByNoise,
      deformByVectorField, deformByAttractor, morphBetween, bendAlongCurve,
      radialDeform, createVectorField, attractorField, repellerField,
      flowField, combineFields, unionGeometries, subtractGeometries,
      intersectGeometries, splitGeometryByPlane, voronoiDivision,
      delaunayTriangulation, subdivisionSurface, lSystemGeometry, noisefield,
      convexHullGeometry, skeletonizeGeometry, packingAlgorithm,
      cellularAutomata, differentialGrowth, reactionDiffusion,
      meshFromParametric, meshFromVoxelGrid, meshFromMarchingCubes,
      randomPointsInMesh, pointSetCentroid, pointSetBoundingBox,
      closestPointOnCurve, signedDistanceToMesh, createArrow, labeledPoint,
      optimizeTopology, calculateAcoustics, deepCloneNode, samplePointOnPath,
      tangentOnPath, boundingBox, calculateFootprintCentroid,
      closestPointOnMesh, intersectRayMesh, measureDistance, measureArea,
      measureVolume, validateGeometry, mergeGeometries, flockingBehavior,
      antColonyOptimization, particleSwarmOptimization, agentBasedGrowth, createArchModule, group, repeatWithFunction, createFacadePanel,

      /* Math functions */
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow,
      min: Math.min, max: Math.max,
      floor: Math.floor, ceil: Math.ceil, round: Math.round,

      /* Constants */
      pi: Math.PI, e: Math.E,

      /* Utility helpers */
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
      lerp: (a, b, t) => a + (b - a) * t,
      mod: (a, b) => ((a % b) + b) % b,

      /* HSV → Hex */
      hsv_to_hex: (h, s, v) => {
        if (h <= 1) h *= 360;
        h = ((h % 360) + 360) % 360;
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b)
          .toString(16)
          .slice(1);
      },

      /* Array helpers */
      alternating: (i, ...vals) => vals[i % vals.length],
      nth: (arr, i) => Array.isArray(arr) ? arr[i % arr.length] : arr
    };
  }

  /* --------------------------------------------------------------------- */
  /* Public API */
  /* --------------------------------------------------------------------- */

  evaluate(expression, context = {}, debug = false) {
    if (typeof expression === 'number') return expression;
    if (typeof expression !== 'string') return expression;

    const key = expression + JSON.stringify(context);
    if (this.cache.has(key)) return this.cache.get(key);

    let result = 0;
    try {
      result = this._evaluateWithContext(expression, context);
      if (debug) console.debug(`[Eval] '${expression}' →`, result);
    } catch (err) {
      console.warn(`[Eval] "${expression}" failed: ${err.message}`);
    }

    this.cache.set(key, result);
    return result;
  }

  clearCache() { this.cache.clear(); }

  /* --------------------------------------------------------------------- */
  /* Internal helpers */
  /* --------------------------------------------------------------------- */

  _evaluateWithContext(expression, context) {
    let expr = expression;

    /* 1. Replace $parameter tokens ------------------------------------ */
    expr = expr.replace(/\$(\w+)/g, (_, p) => {
      const v = context[p];
      if (v === undefined) return 0;
      const val = (typeof v === 'object' && v.value !== undefined) ? v.value : v;
      return (typeof val === 'string') ? `"${val}"` : val;
    });

    /* 2. Handle nested if() first → turn into JS ternary -------------- */
    expr = this._convertIfToTernary(expr);

    /* 3. Evaluate custom function calls (clamp, alternating, …) ------- */
    expr = this._inlineFunctions(expr, context);

    /* 4. Inline numeric constants (pi, e, …) -------------------------- */
    for (const [name, val] of Object.entries(this.functions))
      if (typeof val === 'number')
        expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), val.toString());

    /* 5. Inline bare numeric variables still present ------------------ */
    const keysByLen = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const k of keysByLen)
      if (typeof context[k] === 'number')
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), context[k]);

    /* 6. Final safe evaluation ---------------------------------------- */
    return this._safeEval(expr);
  }

  /* ---------- if(condition, a, b) → (condition ? a : b) ------------- */
  _convertIfToTernary(expr) {
    const IF_RE = /\bif\s*\(/g;
    let changed = true;
    const MAX_RUN = 10;
    for (let run = 0; changed && run < MAX_RUN; ++run) {
      changed = false;
      let match;
      while ((match = IF_RE.exec(expr))) {
        const start = match.index;
        const open = start + match[0].length - 1;
        const close = this._findMatchingParen(expr, open);
        if (close === -1) break;
        const args = this._splitArgs(expr.slice(open + 1, close));
        if (args.length !== 3) continue;
        expr = `${expr.slice(0, start)}((${args[0]})?(${args[1]}):(${args[2]}))${expr.slice(close + 1)}`;
        changed = true;
        break;
      }
    }
    return expr;
  }

  /* ---------- call user function ------------------------------------- */
  _inlineFunctions(expr, ctx) {
    for (const [name, fn] of Object.entries(this.functions)) {
      if (typeof fn !== 'function') continue;
      const RE = new RegExp(`\\b${name}\\s*\\(`, 'g');
      let match;
      while ((match = RE.exec(expr))) {
        const start = match.index;
        const open = start + match[0].length - 1;
        const close = this._findMatchingParen(expr, open);
        if (close === -1) break;
        const rawArgs = this._splitArgs(expr.slice(open + 1, close));
        const args = rawArgs.map(a => {
          if (/^["'].*["']$/.test(a.trim())) return a.slice(1, -1);
          return this._safeEval(this._evaluateWithContext(a.trim(), ctx).toString());
        });
        let out;
        try { out = fn.apply(null, args); }
        catch (e) { out = 0; console.warn(`[Eval] ${name}(): ${e.message}`); }
        const outStr = (typeof out === 'string') ? `"${out}"` : out;
        expr = `${expr.slice(0, start)}${outStr}${expr.slice(close + 1)}`;
        RE.lastIndex = start + String(outStr).length;
      }
    }
    return expr;
  }

  /* ---------- tiny parser helpers ------------------------------------- */
  _splitArgs(argStr) {
    const args = [];
    let buff = '', depth = 0, inStr = false, strChr = '';
    for (let i = 0; i < argStr.length; ++i) {
      const c = argStr[i];
      if (!inStr && (c === '"' || c === "'")) { inStr = true; strChr = c; buff += c; continue; }
      if (inStr && c === strChr) { inStr = false; buff += c; continue; }
      if (!inStr && c === '(') { depth++; buff += c; continue; }
      if (!inStr && c === ')') { depth--; buff += c; continue; }
      if (!inStr && c === ',' && depth === 0) { args.push(buff.trim()); buff = ''; continue; }
      buff += c;
    }
    if (buff.trim()) args.push(buff.trim());
    return args;
  }

  _findMatchingParen(str, openPos) {
    let depth = 1;
    for (let i = openPos + 1; i < str.length; ++i) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')' && --depth === 0) return i;
    }
    return -1;
  }

  /* ---------- very small "sandbox" eval ------------------------------- */
  _safeEval(expr) {
    if (!/^[\d+\-*/%.()<>!=&|,\s'"?:#\w\[\]]+$/.test(expr))
      throw new Error('unsafe characters in expression');
    const fixed = expr
      .replace(/("[^"]*")\s*==\s*("[^"]*")/g, (_, a, b) => (a === b ? 'true' : 'false'))
      .replace(/("[^"]*")\s*!=\s*("[^"]*")/g, (_, a, b) => (a !== b ? 'true' : 'false'));
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + fixed + ')')();
  }
}
