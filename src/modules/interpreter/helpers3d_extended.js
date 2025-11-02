// helpers3d_extended.js
// Ready-to-paste consolidated helpers for lego-like, footprint-driven towers.
// Requires:
//   - global THREE (imported here)
//   - your 2D helpers: rect2d, roundedRect2d, polygon2d, ellipse2d (imported below)
// Outputs JSON nodes compatible with an interpreter that understands
// nodes: { type: 'group'|'extrude'|'box'|'cylinder' } and transform hints.
//
// Security note: parseFunctionParam uses new Function when allowUnsafe=true.
// Only enable allowUnsafe for trusted configs.

import {
  rect2d,
  roundedRect2d,
  polygon2d,
  ellipse2d
} from './helpers2d.js';
import * as THREE from 'three';

/////////////////////// Utility: call 2D helper resolver ///////////////////////
export function call2DHelper(descriptor, callByName = null) {
  if (typeof descriptor === 'function') return descriptor();

  if (descriptor && typeof descriptor === 'object' && typeof descriptor.helper === 'string') {
    if (typeof callByName === 'function') {
      return callByName(descriptor.helper, descriptor.params || {});
    } else {
      throw new Error('call2DHelper: registry caller function required for descriptor.helper usage.');
    }
  }

  if (typeof descriptor === 'string') {
    switch (descriptor) {
      case 'roundedRect':
        return roundedRect2d(0, 0.5, 1.0, 1.0, 0.1, 8, 0);
      case 'ellipse':
        return ellipse2d(0, 0.5, 0.5, 0.5, 0, Math.PI * 2, 16);
      case 'polygon':
        return polygon2d(0, 0.5, 0.5, 6, 0);
      case 'rect':
      default:
        return [
          [-0.5, 0],
          [0.5, 0],
          [0.5, 1],
          [-0.5, 1],
          [-0.5, 0]
        ];
    }
  }

  throw new Error('call2DHelper: unsupported descriptor: ' + JSON.stringify(descriptor));
}

/////////////////////// Parameter resolution ///////////////////////
export function resolveParameters(params, context = {}) {
  if (params === null || params === undefined) return params;

  if (Array.isArray(params)) {
    return params.map(item => resolveParameters(item, context));
  }

  if (typeof params === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      resolved[key] = resolveParameters(value, context);
    }
    return resolved;
  }

  if (typeof params === 'string' && params.includes('$')) {
    try {
      let result = params;
      const matches = params.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g);
      if (matches) {
        for (const match of matches) {
          const varName = match.substring(1);
          if (context.hasOwnProperty(varName)) {
            result = result.replace(new RegExp('\\' + match, 'g'), String(context[varName]));
          }
        }
      }
      if (!result.includes('$')) {
        const evaluated = new Function(`'use strict'; return (${result})`)();
        return evaluated;
      }
      console.warn('Could not fully resolve:', params, 'Result:', result);
      return parseFloat(result) || result;
    } catch (e) {
      console.error('Failed to resolve parameter:', params, e);
      return params;
    }
  }

  return params;
}

/////////////////////// Core primitive nodes ///////////////////////
export function extrude3D(params = {}) {
  const {
    profile = [[-0.5,0],[0.5,0],[0.5,1],[-0.5,1],[-0.5,0]],
    height = 1,
    material = 'default',
    id = 'extrude',
    position = [0, height / 2, 0],
    rotation = [0, 0, 0],
    options = {}
  } = params;

  return {
    type: 'extrude',
    id,
    dimensions: {
      outer: profile,
      options: Object.assign({
        depth: height,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 8
      }, options)
    },
    position,
    rotation,
    material
  };
}

export function coreBox3D(params = {}) {
  const {
    width = 1, height = 1, depth = 1,
    material = 'default',
    id = 'box',
    position = [0, 0, 0],
    rotation = [0, 0, 0]
  } = params;

  return {
    type: 'box',
    id,
    material,
    dimensions: [width, height, depth],
    position,
    rotation
  };
}

export function columnGrid3D(params = {}) {
  const {
    side = 'all',
    count = 3,
    columnsPerSide = 3,
    buildingHalfWidth = 10,
    buildingHalfDepth = 6,
    columnRadius = 0.3,
    columnHeight = 3,
    columnOffset = 2,
    material = 'column',
    id = 'columnGrid',
    position = [0, 0, 0]
  } = params;

  const children = [];
  const pushCylinder = (pos, nameSuffix) => {
    children.push({
      type: 'cylinder',
      id: `${id}_col_${nameSuffix}`,
      material,
      dimensions: [columnRadius, columnRadius, columnHeight],
      position: [pos[0] + position[0], pos[1] + position[1], pos[2] + position[2]]
    });
  };

  if (side === 'front' || side === 'all') {
    for (let i = 0; i < columnsPerSide; i++) {
      const step = (buildingHalfWidth * 2 - columnOffset * 2) / Math.max(columnsPerSide - 1, 1);
      const x = -buildingHalfWidth + columnOffset + i * step;
      const z = buildingHalfDepth - columnOffset;
      pushCylinder([x, 0, z], `front_${i}`);
    }
  }

  if (side === 'back' || side === 'all') {
    for (let i = 0; i < columnsPerSide; i++) {
      const step = (buildingHalfWidth * 2 - columnOffset * 2) / Math.max(columnsPerSide - 1, 1);
      const x = buildingHalfWidth - columnOffset - i * step;
      const z = -buildingHalfDepth + columnOffset;
      pushCylinder([x, 0, z], `back_${i}`);
    }
  }

  const lateralCount = Math.max(columnsPerSide - 2, 0);
  if ((side === 'left' || side === 'all') && lateralCount > 0) {
    for (let i = 0; i < lateralCount; i++) {
      const step = (buildingHalfDepth * 2 - columnOffset * 2) / Math.max(columnsPerSide - 1, 1);
      const z = -buildingHalfDepth + columnOffset + (i + 1) * step;
      const x = -buildingHalfWidth + columnOffset;
      pushCylinder([x, 0, z], `left_${i}`);
    }
  }
  if ((side === 'right' || side === 'all') && lateralCount > 0) {
    for (let i = 0; i < lateralCount; i++) {
      const step = (buildingHalfDepth * 2 - columnOffset * 2) / Math.max(columnsPerSide - 1, 1);
      const z = buildingHalfDepth - columnOffset - (i + 1) * step;
      const x = buildingHalfWidth - columnOffset;
      pushCylinder([x, 0, z], `right_${i}`);
    }
  }

  return {
    type: 'group',
    id,
    children
  };
}

export function floorSlab3D(params = {}) {
  const {
    footprint = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1]
    ],
    thickness = 0.3,
    id = 'floor_slab',
    material = 'floor_slab',
    position = [0, -thickness / 2, 0]
  } = params;

  const rotation = [Math.PI / 2, 0, 0];

  return {
    type: 'extrude',
    id,
    dimensions: {
      outer: footprint,
      options: {
        depth: thickness,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 8
      }
    },
    position,
    rotation,
    material
  };
}

export function taperTransform3D(params = {}) {
  const {
    node = null,
    scaleX = 1,
    scaleZ = 1,
    pivot = [0, 0, 0],
    id = 'taper'
  } = params;

  if (!node) return { type: 'group', id, children: [] };

  return {
    type: 'group',
    id,
    transform: {
      translate: [-pivot[0], -pivot[1], -pivot[2]],
      scale: [scaleX, 1, scaleZ],
      translateBack: pivot
    },
    children: [node]
  };
}

export function twistTransform3D(params = {}) {
  const {
    node = null,
    angleRadians = 0,
    axis = [0, 1, 0],
    pivot = [0, 0, 0],
    id = 'twist'
  } = params;

  if (!node) return { type: 'group', id, children: [] };

  return {
    type: 'group',
    id,
    transform: {
      translate: [-pivot[0], -pivot[1], -pivot[2]],
      rotate: { axis, angle: angleRadians },
      translateBack: pivot
    },
    children: [node]
  };
}

/////////////////////// Footprint utilities ///////////////////////
export function polygonToSides(footprint = [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]) {
  const pts = footprint.map(p => [parseFloat(p[0]), parseFloat(p[1])]);

  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dist = Math.hypot(first[0] - last[0], first[1] - last[1]);
    if (dist > 1e-6) pts.push([first[0], first[1]]);
  }

  const sides = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const tangent = len > 0 ? [dx / len, dz / len] : [0, 0];
    const normal = len > 0 ? [-dz / len, dx / len] : [0, 0];
    sides.push({
      start: a,
      end: b,
      length: len,
      tangent,
      normal,
      midpoint: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    });
  }
  return sides;
}

export function calculateFootprintCentroid(pts) {
  if (!pts || pts.length === 0) return [0, 0];

  let area2 = 0;
  let cx = 0, cz = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[(i + 1) % n];
    const a = xi * zj - xj * zi;
    area2 += a;
    cx += (xi + xj) * a;
    cz += (zi + zj) * a;
  }
  if (Math.abs(area2) > 1e-9) {
    const area = area2 / 2;
    return [cx / (6 * area), cz / (6 * area)];
  }
  let sx = 0, sz = 0;
  for (const [x, z] of pts) { sx += x; sz += z; }
  return [sx / pts.length, sz / pts.length];
}

export function isPointInPolygon(point, polygon) {
  const [x, z] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersect = ((zi > z) !== (zj > z)) &&
      (x < (xj - xi) * (z - zi) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function footprintBounds(footprint) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of footprint) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return {
    minX, maxX, minZ, maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2
  };
}

/////////////////////// Footprint helpers ///////////////////////
export const footprintShapes = {
  rectangle: (width, depth) => {
    const hw = width / 2, hd = depth / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
  },

  ellipse: (width, depth, segments = 48) => {
    const hw = width / 2, hd = depth / 2;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push([hw * Math.cos(theta), hd * Math.sin(theta)]);
    }
    return points;
  },

  // renamed to lShape for consistency with documentation
  lShape: (widthBig, depthBig, cutWidth, cutDepth, corner = 'bottom-left') => {
    const hw = widthBig / 2, hd = depthBig / 2;
    const cw = cutWidth, cd = cutDepth;

    const xA = -hw, zA = -hd;
    const xB = hw, zB = -hd;
    const xC = hw, zC = hd - cd;
    const xD = hw - cw, zD = hd - cd;
    const xE = hw - cw, zE = hd;
    const xF = -hw, zF = hd;

    const bottomLeft = [[xA,zA],[xB,zB],[xC,zC],[xD,zD],[xE,zE],[xF,zF],[xA,zA]];

    switch (corner) {
      case 'bottom-left': return bottomLeft;
      case 'bottom-right': return bottomLeft.map(([x,z]) => [-x, z]);
      case 'top-right': return bottomLeft.map(([x,z]) => [-x, -z]);
      case 'top-left': return bottomLeft.map(([x,z]) => [ x, -z ]);
      default: return bottomLeft;
    }
  },

  tShape: (stemWidth, stemDepth, topWidth, topDepth) => {
    const hsw = stemWidth / 2, hsd = stemDepth / 2;
    const htw = topWidth / 2, htd = topDepth / 2;
    return [
      [-hsw, -hsd],
      [hsw, -hsd],
      [hsw, hsd - topDepth],
      [htw, hsd - topDepth],
      [htw, hsd],
      [-htw, hsd],
      [-htw, hsd - topDepth],
      [-hsw, hsd - topDepth],
      [-hsw, -hsd]
    ];
  },

  courtyard: (outerWidth, outerDepth) => {
    const how = outerWidth / 2, hod = outerDepth / 2;
    return [
      [-how, -hod],
      [how, -hod],
      [how, hod],
      [-how, hod],
      [-how, -hod]
    ];
  },

  plusShape: (width, depth, thickness) => {
    const hw = width / 2, hd = depth / 2, ht = thickness / 2;
    return [
      [-ht, -hd],
      [ht, -hd],
      [ht, -ht],
      [hw, -ht],
      [hw, ht],
      [ht, ht],
      [ht, hd],
      [-ht, hd],
      [-ht, ht],
      [-hw, ht],
      [-hw, -ht],
      [-ht, -ht],
      [-ht, -hd]
    ];
  },

  freeform: (controlPoints, segments = 32) => {
    const points = [];
    const n = controlPoints.length;
    if (n === 0) return points;
    for (let i = 0; i < n; i++) {
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      const segsPerEdge = Math.ceil(segments / n);
      for (let j = 0; j < segsPerEdge; j++) {
        const t = j / segsPerEdge;
        points.push([
          p1[0] * (1 - t) + p2[0] * t,
          p1[1] * (1 - t) + p2[1] * t
        ]);
      }
    }
    if (points.length > 0) points.push([...points[0]]);
    return points;
  }
};

/////////////////////// Footprint utilities: scale, translate, validate ///////////////////////
export function scaleFootprint(footprint, scaleX, scaleZ = null) {
  const sz = (scaleZ !== null) ? scaleZ : scaleX;
  return footprint.map(([x, z]) => [x * scaleX, z * sz]);
}

export function translateFootprint(footprint, offsetX, offsetZ = 0) {
  return footprint.map(([x, z]) => [x + offsetX, z + offsetZ]);
}

export function validateFootprint(footprint) {
  if (!Array.isArray(footprint) || footprint.length < 3) {
    return { valid: false, error: 'Footprint must have at least 3 points' };
  }
  for (let i = 0; i < footprint.length; i++) {
    const pt = footprint[i];
    if (!Array.isArray(pt) || pt.length !== 2) {
      return { valid: false, error: `Invalid point at index ${i}` };
    }
    if (isNaN(pt[0]) || isNaN(pt[1])) {
      return { valid: false, error: `NaN coordinate at index ${i}` };
    }
  }
  return { valid: true };
}

/////////////////////// footprintFacadeHelper ///////////////////////
export function footprintFacadeHelper(params = {}) {
  const {
    footprint = [[-5,-3],[5,-3],[5,3],[-5,3],[-5,-3]],
    totalPanelCount = null,
    panelsPerSideWidth = 10,
    panelsPerSideDepth = 8,
    wallRatio = 0.5,
    floorHeight = 3,
    heightCoefficient = 1.0,
    wallDepth = 0.2,
    windowDepth = 0.1,
    id = 'footprint_facade',
    origin = [0, 0, 0],
    call2DHelperByName = null,
    ...rest
  } = params;

  const sides = polygonToSides(footprint);
  const isRectangular = (sides.length === 4);

  return checkerboardPanels3D({
    path: footprint,
    panelsPerWidth: isRectangular ? panelsPerSideWidth : null,
    panelsPerDepth: isRectangular ? panelsPerSideDepth : null,
    totalPanelCount: !isRectangular ? totalPanelCount : null,
    wallRatio,
    floorHeight,
    heightCoefficient,
    wallDepth,
    windowDepth,
    origin,
    id,
    call2DHelperByName,
    ...rest
  });
}

/////////////////////// Column distribution on arbitrary footprint (fixed rounding) ///////////////////////
export function distributeColumnsOnFootprint(params = {}) {
  const {
    footprint = [[-5,-3],[5,-3],[5,3],[-5,3],[-5,-3]],
    distribution = 'perimeter',
    count = 12,
    radius = 0.3,
    height = 3,
    offset = 1.5,
    material = 'column',
    id = 'columns'
  } = params;

  const children = [];
  const sides = polygonToSides(footprint);
  const centroid = calculateFootprintCentroid(footprint);

  if (distribution === 'perimeter') {
    const totalLength = sides.reduce((s, side) => s + side.length, 0);
    if (totalLength <= 1e-9) return { type: 'group', id, children };

    // FIXED: Instead of distributing by sides, distribute evenly along total perimeter
    const spacing = totalLength / count;
    let accumulatedLength = 0;
    let colIdx = 0;
    
    for (let si = 0; si < sides.length && colIdx < count; si++) {
      const side = sides[si];
      const sideStartLength = accumulatedLength;
      const sideEndLength = accumulatedLength + side.length;
      
      // Place columns at regular spacing intervals along this side
      while (colIdx < count) {
        const targetLength = colIdx * spacing;
        
        // Check if this column position is on the current side
        if (targetLength >= sideStartLength && targetLength < sideEndLength) {
          const localT = (targetLength - sideStartLength) / side.length;
          const x = side.start[0] * (1 - localT) + side.end[0] * localT;
          const z = side.start[1] * (1 - localT) + side.end[1] * localT;

          let dx = centroid[0] - x;
          let dz = centroid[1] - z;
          let dist = Math.hypot(dx, dz);
          if (dist < 1e-6) {
            dx = -side.normal[0] || -1;
            dz = -side.normal[1] || 0;
            dist = Math.hypot(dx, dz) || 1;
          }
          const offsetX = x + (dx / dist) * offset;
          const offsetZ = z + (dz / dist) * offset;

          children.push({
            type: 'cylinder',
            id: `${id}_col_${colIdx}`,
            material,
            dimensions: [radius, radius, height],
            position: [offsetX, 0, offsetZ]
          });
          
          colIdx++;
        } else if (targetLength >= sideEndLength) {
          // Move to next side
          break;
        } else {
          colIdx++;
        }
      }
      
      accumulatedLength += side.length;
    }
  } else if (distribution === 'grid') {
    const bounds = footprintBounds(footprint);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    let colIdx = 0;
    for (let r = 0; r < rows && colIdx < count; r++) {
      for (let c = 0; c < cols && colIdx < count; c++) {
        const x = bounds.minX + offset + (c / Math.max(1, cols - 1)) * (bounds.width - 2 * offset || 0);
        const z = bounds.minZ + offset + (r / Math.max(1, rows - 1)) * (bounds.depth - 2 * offset || 0);

        if (isPointInPolygon([x, z], footprint)) {
          children.push({
            type: 'cylinder',
            id: `${id}_col_${colIdx}`,
            material,
            dimensions: [radius, radius, height],
            position: [x, 0, z]
          });
          colIdx++;
        }
      }
    }
  } else if (distribution === 'corners') {
    for (let i = 0; i < Math.min(footprint.length - 1, count); i++) {
      const [x, z] = footprint[i];
      let dx = centroid[0] - x;
      let dz = centroid[1] - z;
      let dist = Math.hypot(dx, dz);
      if (dist < 1e-6) { dx = -1; dz = 0; dist = 1; }
      const offsetX = x + (dx / dist) * offset;
      const offsetZ = z + (dz / dist) * offset;

      children.push({
        type: 'cylinder',
        id: `${id}_col_${i}`,
        material,
        dimensions: [radius, radius, height],
        position: [offsetX, 0, offsetZ]
      });
    }
  }

  return { type: 'group', id, children };
}


/////////////////////// Sweep helper (with safety flag) ///////////////////////
export function parseFunctionParam(fnOrStr, allowUnsafe = false) {
  if (typeof fnOrStr === 'function') return fnOrStr;
  if (typeof fnOrStr === 'string') {
    if (!allowUnsafe) {
      console.warn('parseFunctionParam: string functions disabled for security. Pass allowUnsafe=true if input is trusted.');
      return null;
    }
    const s = fnOrStr.trim();
    if (s.includes('=>')) {
      const parts = s.split('=>');
      const args = parts[0].trim().replace(/^\(|\)$/g,'');
      const body = parts.slice(1).join('=>').trim();
      try {
        // return function using strict mode
        return new Function(args, `'use strict'; return (${body});`);
      } catch (e) {
        console.warn('parseFunctionParam: failed to parse arrow function string', e);
        return null;
      }
    }
    if (!isNaN(Number(s))) {
      const n = Number(s);
      return (() => n);
    }
  }
  return null;
}

function sampleCatmull(centerlinePoints, t) {
  const curve = new THREE.CatmullRomCurve3(centerlinePoints.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const p = curve.getPoint(t);
  const tangent = curve.getTangent(t).normalize();
  return { position: p, tangent };
}

export function sweepApproxExtrude(params = {}) {
  const {
    centerline = [[0,0,0], [0,3,2], [1,6,4], [0,9,6]],
    profileFn = (w,d,idx,t) => roundedRect2d(0, 0, w, d, Math.min(w,d)*0.1, 8, 0),
    slices = 12,
    widthFunc = (t) => 4 + Math.sin(t * 2 * Math.PI) * 0.5,
    depthFunc = (t) => 3,
    twistFunc = (t) => 0,
    material = 'default',
    slabThickness = 0.3,
    id = 'sweep',
    allowUnsafeFunctionStrings = false
  } = params;

  const widthF = parseFunctionParam(widthFunc, allowUnsafeFunctionStrings) || widthFunc;
  const depthF = parseFunctionParam(depthFunc, allowUnsafeFunctionStrings) || depthFunc;
  const twistF = parseFunctionParam(twistFunc, allowUnsafeFunctionStrings) || twistFunc;

  const children = [];
  const useCatmull = centerline.length > 2;
  for (let s = 0; s <= slices; s++) {
    const t = s / Math.max(1, slices);
    const { position, tangent } = useCatmull ? sampleCatmull(centerline, t) : (() => {
      const N = centerline.length;
      const u = Math.min(Math.max(t,0),1) * (N - 1);
      const i = Math.floor(u);
      const f = u - i;
      const a = new THREE.Vector3(...centerline[i]);
      const b = new THREE.Vector3(...centerline[Math.min(i+1, N-1)]);
      const p = new THREE.Vector3().lerpVectors(a, b, f);
      const tan = new THREE.Vector3().subVectors(b, a).normalize();
      return { position: p, tangent: tan };
    })();

    const up = new THREE.Vector3(0,1,0);
    let normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (normal.length() < 1e-6) normal.set(1,0,0);

    const rotMatrix = new THREE.Matrix4().makeBasis(tangent, normal, up);
    const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix, 'XYZ');

    const w = (typeof widthF === 'function') ? widthF(t) : widthF;
    const d = (typeof depthF === 'function') ? depthF(t) : depthF;
    const twist = (typeof twistF === 'function') ? twistF(t) : twistF;

    const profile = profileFn(w, d, s, t);

    children.push({
      type: 'extrude',
      id: `${id}_slice_${s}`,
      dimensions: {
        outer: profile,
        options: {
          depth: slabThickness,
          bevelEnabled: false,
          steps: 1,
          curveSegments: 8
        }
      },
      position: [position.x, position.y, position.z],
      rotation: [Math.PI / 2 + euler.x, euler.y + twist, euler.z],
      material: material
    });
  }

  return { type: 'group', id, children };
}

/////////////////////// Checkerboard facade (updated panel heuristic) ///////////////////////
export function checkerboardPanels3D(params = {}) {
  const cfg = Object.assign({}, params);
  const call2DHelperByName = cfg.call2DHelperByName || null;

  // Build context from all numeric, string, and boolean parameters
  const context = {};
  for (const [key, value] of Object.entries(cfg)) {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      context[key] = value;
    }
  }

  // Resolve path parameters if they contain string references
  if (cfg.path && Array.isArray(cfg.path) && cfg.path.length > 0) {
    const needsResolution = cfg.path.some(pt => 
      Array.isArray(pt) && pt.length >= 2 && (
        (typeof pt[0] === 'string') || 
        (typeof pt[1] === 'string')
      )
    );
    
    if (needsResolution) {
      cfg.path = resolveParameters(cfg.path, context);
    }
  }

  const {
    path = [[-10, -5], [10, -5], [10, 5], [-10, 5], [-10, -5]],
    panelsPerWidth = null,
    panelsPerDepth = null,
    wallRatio = 0.5,
    floorHeight = 3.0,
    wallDepth = 0.2,
    windowDepth = 0.1,
    wallMaterial = 'wall',
    windowMaterial = 'window',
    wallShape = 'rect',
    windowShape = 'rect',
    alternating = false,
    startWith = 'wall',
    frequency = 1,
    amplitude = 0.0,
    origin = [0, 0, 0],
    id = 'facade_panels',
    heightCoefficient = 1.0,
    cornerRadius = 0.1,
    totalPanelCount = null,
    wallSegments = 8,
    windowSegments = 8,
    cornerOverlap = 0
  } = cfg;

  // Convert path to numeric values and validate
  const numericPath = path.map((pt, idx) => {
    if (!Array.isArray(pt) || pt.length < 2) {
      console.error(`Invalid point at index ${idx}:`, pt);
      return [0, 0];
    }
    const x = parseFloat(pt[0]);
    const z = parseFloat(pt[1]);
    
    if (isNaN(x) || isNaN(z)) {
      console.error(`NaN values in path at index ${idx}:`, pt, `=> x:${x}, z:${z}`);
      return [0, 0];
    }
    
    return [x, z];
  });

  // Validate that we have a valid path
  if (numericPath.length < 3) {
    console.error('Path must have at least 3 points, got:', numericPath.length);
    return { type: 'group', id, children: [] };
  }

  const pts3d = numericPath.map(([x, z]) => new THREE.Vector3(x, 0, z));
  
  // Validate pts3d array
  if (pts3d.length === 0 || !pts3d[0]) {
    console.error('Failed to create pts3d array from numericPath:', numericPath);
    return { type: 'group', id, children: [] };
  }

  const isClosed = pts3d[0].distanceTo(pts3d[pts3d.length - 1]) < 0.001;

  const sides = [];
  for (let i = 0; i < pts3d.length - 1; i++) {
    const p0 = pts3d[i];
    const p1 = pts3d[i + 1];
    const length = p0.distanceTo(p1);
    const tangent = new THREE.Vector3().subVectors(p1, p0).normalize();
    sides.push({ start: p0, end: p1, length, tangent, index: i });
  }

  let panelsPerSide;
  if (panelsPerWidth !== null && panelsPerDepth !== null && sides.length === 4) {
    panelsPerSide = [panelsPerWidth, panelsPerDepth, panelsPerWidth, panelsPerDepth];
  } else if (totalPanelCount && totalPanelCount > 0) {
    const totalLength = sides.reduce((s, side) => s + side.length, 0);
    panelsPerSide = sides.map(side => Math.max(1, Math.round((side.length / totalLength) * totalPanelCount)));
  } else {
    const totalLength = sides.reduce((s, side) => s + side.length, 0);
    const avgPanelWidth = 1.5;
    const estimatedTotal = Math.max(sides.length * 2, Math.round(totalLength / Math.max(0.0001, avgPanelWidth)));
    panelsPerSide = sides.map(side => Math.max(1, Math.round((side.length / totalLength) * estimatedTotal)));
  }

  const totalPanels = panelsPerSide.reduce((a, b) => a + b, 0);
  if (totalPanels === 0) return { type: 'group', id, children: [] };

  const multipliersGlobal = new Array(totalPanels);
  for (let gi = 0; gi < totalPanels; gi++) {
    const u = gi / Math.max(totalPanels - 1, 1);
    const m = 1 + amplitude * Math.sin(frequency * 2 * Math.PI * u);
    multipliersGlobal[gi] = Math.max(0.0001, m);
  }

  let centroidXZ = null;
  if (isClosed) {
    centroidXZ = numericPath.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]).map(v => v / numericPath.length);
  }

  const genProfile = (descriptor, desiredWidth, desiredDepth, segments = 8, radius = 0.1) => {
    if (descriptor && typeof descriptor === 'object' && typeof descriptor.helper === 'string') {
      const p = Object.assign({}, descriptor.params || {}, { width: desiredWidth, depth: desiredDepth, segments, radius });
      if (!call2DHelperByName) throw new Error('checkerboardPanels3D: call2DHelperByName is required to resolve descriptor.helper names.');
      return call2DHelperByName(descriptor.helper, p);
    }
    if (typeof descriptor === 'function') return descriptor(desiredWidth, desiredDepth, segments, radius);

    const hw = desiredWidth / 2;
    const hd = desiredDepth / 2;
    switch (descriptor) {
      case 'roundedRect':
        return roundedRect2d(0, hd, desiredWidth, desiredDepth, Math.min(radius, hw, hd), segments, 0);
      case 'ellipse':
        return ellipse2d(0, hd, hw, hd, 0, Math.PI * 2, segments);
      case 'polygon':
        return polygon2d(0, hd, Math.min(hw, hd), 6, 0);
      case 'rect':
      default:
        return [
          [-hw, 0],
          [hw, 0],
          [hw, desiredDepth],
          [-hw, desiredDepth],
          [-hw, 0]
        ];
    }
  };

  const panels = [];
  let globalIndexCursor = 0;

  for (let sideIdx = 0; sideIdx < sides.length; sideIdx++) {
    const side = sides[sideIdx];
    const sideCount = panelsPerSide[sideIdx] || 0;
    if (sideCount <= 0) { globalIndexCursor += sideCount; continue; }

    const baseWidth = side.length / sideCount;
    const offsets = new Array(sideCount);
    let acc = 0;
    for (let i = 0; i < sideCount; i++) { offsets[i] = acc; acc += baseWidth; }

    for (let j = 0; j < sideCount; j++) {
      const panelGlobalIndex = globalIndexCursor + j;
      const thisPanelWidth = baseWidth;

      let isWallFirst = (startWith === 'wall');
      if (alternating) {
        isWallFirst = (panelGlobalIndex % 2 === 0) ? (startWith === 'wall') : (startWith !== 'wall');
      }

      const wallPortionWidth = thisPanelWidth * wallRatio;
      const windowPortionWidth = Math.max(0, thisPanelWidth - wallPortionWidth);

      const wallPanelHeight = floorHeight * heightCoefficient;
      const windowPanelHeight = floorHeight;

      const subPanels = isWallFirst ? [
        { 
          type: 'wall', 
          profileWidth: wallPortionWidth, 
          profileDepth: wallDepth, 
          extrudeHeight: wallPanelHeight, 
          material: wallMaterial, 
          shapeDesc: wallShape, 
          segments: wallSegments, 
          localOffset: 0 
        },
        { 
          type: 'window', 
          profileWidth: windowPortionWidth, 
          profileDepth: windowDepth, 
          extrudeHeight: windowPanelHeight, 
          material: windowMaterial, 
          shapeDesc: windowShape, 
          segments: windowSegments, 
          localOffset: wallPortionWidth 
        }
      ] : [
        { 
          type: 'window', 
          profileWidth: windowPortionWidth, 
          profileDepth: windowDepth, 
          extrudeHeight: windowPanelHeight, 
          material: windowMaterial, 
          shapeDesc: windowShape, 
          segments: windowSegments, 
          localOffset: 0 
        },
        { 
          type: 'wall', 
          profileWidth: wallPortionWidth, 
          profileDepth: wallDepth, 
          extrudeHeight: wallPanelHeight, 
          material: wallMaterial, 
          shapeDesc: wallShape, 
          segments: wallSegments, 
          localOffset: windowPortionWidth 
        }
      ];

      for (let s = 0; s < subPanels.length; s++) {
        const sp = subPanels[s];
        if (sp.profileWidth <= 1e-6) continue;

        const localCenterDist = sp.localOffset + sp.profileWidth / 2;
        const absoluteDist = offsets[j] + localCenterDist;
        const t = Math.min(1, Math.max(0, absoluteDist / side.length));

        const pos = new THREE.Vector3().lerpVectors(side.start, side.end, t);

        const profile = genProfile(sp.shapeDesc, sp.profileWidth, sp.profileDepth, sp.segments, cornerRadius || 0.1);

        const tangent = new THREE.Vector3().subVectors(side.end, side.start).normalize();
        const upVec = new THREE.Vector3(0, 1, 0);
        let normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
        if (isClosed && centroidXZ) {
          const vfc = new THREE.Vector3(pos.x - centroidXZ[0], 0, pos.z - centroidXZ[1]);
          if (vfc.dot(normal) < 0) normal.negate();
        }

        const rotMatrix = new THREE.Matrix4().makeBasis(tangent, normal, upVec);
        const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix, 'XYZ');
        const rotationCorrect = [euler.x, euler.y, euler.z];

        const finalPos = pos.clone();
        finalPos.y = origin[1];

        panels.push({
          type: 'extrude',
          id: `${id}_side${sideIdx}_panel${j}_${sp.type}`,
          dimensions: {
            outer: profile,
            options: {
              depth: sp.extrudeHeight,
              bevelEnabled: false,
              steps: 1,
              curveSegments: 8
            }
          },
          position: [finalPos.x + origin[0], finalPos.y, finalPos.z + origin[2]],
          rotation: rotationCorrect,
          material: sp.material
        });
      }
    }

    globalIndexCursor += sideCount;
  }

  return { type: 'group', id, children: panels };
}



/////////////////////// towerStructure3D (integrated) ///////////////////////
/**
 * towerStructure3D - Universal tower builder for any footprint
 *
 * Examples:
 * towerStructure3D({ floors: 20, floorShape: 'rectangle', floorShapeParams: { width: 25, depth: 15 } })
 * towerStructure3D({
 *   floors: 30,
 *   floorShape: 'lShape',
 *   floorShapeParams: { widthBig: 30, depthBig: 40, cutWidth: 15, cutDepth: 20, corner: 'bottom-left' }
 * })
 * towerStructure3D({ floors: 25, floorShape: [[0,0],[10,2],[8,10],[-5,8],[0,0]] })
 */
export function towerStructure3D(params = {}) {
  const cfg = Object.assign({}, params);
  
  // Build context with ALL top-level parameters FIRST
  const context = {};
  for (const [key, value] of Object.entries(cfg)) {
    context[key] = value;
  }
  
  console.log('Context keys:', Object.keys(context));
  console.log('ellipseSegments in context:', context.ellipseSegments);
  
  // Resolve floorShapeParams using the full context
  if (cfg.floorShapeParams && typeof cfg.floorShapeParams === 'object') {
    console.log('Before resolution:', cfg.floorShapeParams);
    cfg.floorShapeParams = resolveParameters(cfg.floorShapeParams, context);
    console.log('After resolution:', cfg.floorShapeParams);
  }

  const {
    floors = 10,
    floorHeight = 3,
    buildingWidth = 10,
    buildingDepth = 6,

    taperWaveAmplitude = 0.0,
    taperWaveFrequency = 1.0,
    taperWaveOffset = 0.0,
    totalTwistDegrees = 0,
    twistZone = 35,

    coreWidth = 4,
    coreDepth = 3,
    slabThickness = 0.3,
    columnsPerSide = 3,
    columnRadius = 0.25,
    columnOffset = 1.5,
    columnCount = 12,

    panelsPerSideWidth = 10,
    panelsPerSideDepth = 8,
    totalPanelCount = null,
    minWallRatio = 0.2,
    maxWallRatio = 0.8,
    waveFrequency = 2.0,
    wallDepth = 0.2,
    windowDepth = 0.1,
    heightCoefficient = 1.0,

    wallMaterial = 'wall',
    windowMaterial = 'window',
    wallShape = 'roundedRect',
    windowShape = 'rect',
    alternating = true,
    wallSegments = 12,
    windowSegments = 12,
    cornerRadius = 0.08,

    facadeHelper = null,
    floorShape = 'rectangle',
    floorShapeParams = {},
    id = 'tower'
  } = cfg;

  const totalTwistRadians = (totalTwistDegrees * Math.PI) / 180;
  const twistStart = (50 - twistZone / 2) / 100;
  const twistEnd = (50 + twistZone / 2) / 100;
  const wallRatioCenter = (minWallRatio + maxWallRatio) / 2;
  const wallRatioAmplitude = (maxWallRatio - minWallRatio) / 2;

  const children = [];
  let finalScaleX = 1, finalScaleZ = 1, finalTwist = 0;
  let lastFootprint = null;

  for (let fi = 0; fi < floors; fi++) {
    const normalized = fi / Math.max(floors - 1, 1);

    const scaleX = 1 + taperWaveAmplitude * Math.sin(normalized * taperWaveFrequency * 2 * Math.PI + taperWaveOffset);
    const scaleZ = 1 + taperWaveAmplitude * Math.sin(normalized * taperWaveFrequency * 2 * Math.PI + taperWaveOffset);

    let floorTwist = 0;
    if (totalTwistRadians !== 0) {
      if (normalized >= twistStart && normalized <= twistEnd) {
        const twistProgress = (normalized - twistStart) / Math.max(twistEnd - twistStart, 0.01);
        floorTwist = totalTwistRadians * twistProgress;
      } else if (normalized > twistEnd) {
        floorTwist = totalTwistRadians;
      }
    }

    const waveInput = normalized * waveFrequency * 2 * Math.PI;
    const floorWallRatio = wallRatioCenter + wallRatioAmplitude * Math.sin(waveInput);

    const floorStartWith = (fi % 2 === 0) ? 'wall' : 'window';

    if (fi === floors - 1) { finalScaleX = scaleX; finalScaleZ = scaleZ; finalTwist = floorTwist; }

    const floorGroup = {
      type: 'group',
      id: `${id}_floor_${fi}`,
      children: [],
      position: [0, fi * floorHeight + floorHeight / 2, 0]
    };

    if (floorTwist !== 0) floorGroup.rotation = [0, floorTwist, 0];

    // Compute footprint for this floor - floorShapeParams is already resolved
    let footprint;
    if (typeof floorShape === 'string' && footprintShapes[floorShape]) {
      const p = floorShapeParams || {}; // Already resolved above
      
      if (floorShape === 'rectangle') {
        const w = p.width || buildingWidth * scaleX;
        const d = p.depth || buildingDepth * scaleZ;
        footprint = footprintShapes.rectangle(w, d);
      } else if (floorShape === 'ellipse') {
        const w = p.width || buildingWidth * scaleX;
        const d = p.depth || buildingDepth * scaleZ;
        const segments = p.segments || 48; // Now this should be a number
        footprint = footprintShapes.ellipse(w, d, segments);
      } else if (floorShape === 'lShape') {
        const widthBig = p.widthBig || buildingWidth * scaleX;
        const depthBig = p.depthBig || buildingDepth * scaleZ;
        const cutW = p.cutWidth || Math.max(1, widthBig * 0.4);
        const cutD = p.cutDepth || Math.max(1, depthBig * 0.4);
        const corner = p.corner || 'bottom-left';
        footprint = footprintShapes.lShape(widthBig, depthBig, cutW, cutD, corner);
      } else {
        footprint = footprintShapes.rectangle(buildingWidth * scaleX, buildingDepth * scaleZ);
      }
    } else if (Array.isArray(floorShape)) {
      footprint = scaleFootprint(floorShape, scaleX, scaleZ);
    } else if (typeof floorShape === 'object' && floorShape.helper && footprintShapes[floorShape.helper]) {
      const p = Object.assign({}, floorShape.params || {});
      footprint = footprintShapes[floorShape.helper](...(p.args || []));
    } else {
      footprint = footprintShapes.rectangle(buildingWidth * scaleX, buildingDepth * scaleZ);
    }

    // Validate footprint
    const validation = validateFootprint(footprint);
    if (!validation.valid) {
      console.error(`Invalid footprint at floor ${fi}:`, validation.error);
      console.error('Footprint:', footprint);
      console.error('floorShape:', floorShape, 'floorShapeParams:', floorShapeParams);
      continue;
    }

    lastFootprint = footprint;

    // Floor slab
    floorGroup.children.push(floorSlab3D({
      footprint,
      thickness: slabThickness,
      id: `${id}_slab_${fi}`,
      position: [0, -floorHeight / 2 + slabThickness, 0]
    }));

    // Columns
    floorGroup.children.push(distributeColumnsOnFootprint({
      footprint,
      distribution: 'perimeter',
      count: columnCount || columnsPerSide * 4,
      radius: columnRadius,
      height: floorHeight,
      offset: columnOffset,
      material: 'column',
      id: `${id}_columns_${fi}`
    }));

    // Core centered at footprint centroid
    const centroid = calculateFootprintCentroid(footprint);
    floorGroup.children.push(coreBox3D({
      width: coreWidth * scaleX,
      height: floorHeight,
      depth: coreDepth * scaleZ,
      material: 'core',
      id: `${id}_core_${fi}`,
      position: [centroid[0], 0, centroid[1]]
    }));

    // Facade
    if (facadeHelper) {
      const floorContext = {
        buildingHalfWidth: (buildingWidth / 2) * scaleX,
        buildingHalfDepth: (buildingDepth / 2) * scaleZ,
        panelsPerWidth: panelsPerSideWidth,
        panelsPerDepth: panelsPerSideDepth,
        wallRatio: floorWallRatio,
        floorHeight: floorHeight,
        heightMultiplier: heightCoefficient,
        wallDepth: wallDepth,
        windowDepth: windowDepth,
        wallMaterial: wallMaterial,
        windowMaterial: windowMaterial,
        wallShape: wallShape,
        windowShape: windowShape,
        alternating: alternating,
        startWith: floorStartWith,
        frequency: waveFrequency,
        amplitude: wallRatioAmplitude,
        wallSegments: wallSegments,
        windowSegments: windowSegments,
        cornerRadius: cornerRadius,
        building_half_width: (buildingWidth / 2) * scaleX,
        building_half_depth: (buildingDepth / 2) * scaleZ,
        panels_per_side_width: panelsPerSideWidth,
        panels_per_side_depth: panelsPerSideDepth,
        height_coefficient: heightCoefficient,
        wall_depth: wallDepth,
        window_depth: windowDepth,
        current_floor_base: -floorHeight / 2,
        currentFloorBase: -floorHeight / 2
      };

      if (typeof facadeHelper === 'function') {
        const facadeNode = facadeHelper({
          ...floorContext,
          footprint,
          origin: [0, -floorHeight / 2, 0],
          id: `${id}_facade_${fi}`
        });
        floorGroup.children.push(facadeNode);
      } else if (typeof facadeHelper === 'object') {
        if (facadeHelper.helper === 'checkerboardPanels3D') {
          const facadeParams = {
            path: footprint,
            panelsPerWidth: panelsPerSideWidth,
            panelsPerDepth: panelsPerSideDepth,
            totalPanelCount: totalPanelCount,
            wallRatio: floorWallRatio,
            floorHeight: floorHeight,
            heightCoefficient: heightCoefficient,
            wallDepth: wallDepth,
            windowDepth: windowDepth,
            wallMaterial: wallMaterial,
            windowMaterial: windowMaterial,
            wallShape: wallShape,
            windowShape: windowShape,
            wallSegments: wallSegments,
            windowSegments: windowSegments,
            cornerRadius: cornerRadius,
            alternating: alternating,
            startWith: floorStartWith,
            origin: [0, -floorHeight / 2, 0],
            id: `${id}_facade_${fi}`,
            ...(facadeHelper.params || {})
          };

          floorGroup.children.push(checkerboardPanels3D(facadeParams));
        } else if (facadeHelper.helper === 'sweepApproxExtrude') {
          const sweepParams = Object.assign({}, facadeHelper.params || {}, {
            centerline: facadeHelper.params.centerline || [[0,0,0],[0,floorHeight,0]],
            id: `${id}_facade_${fi}`
          });
          floorGroup.children.push(sweepApproxExtrude(sweepParams));
        } else {
          floorGroup.children.push({
            type: 'helper3d',
            helper: facadeHelper.helper || 'checkerboardPanels3D',
            params: Object.assign({}, facadeHelper.params || {}, {
              path: footprint,
              wallRatio: floorWallRatio,
              floorHeight,
              id: `${id}_facade_${fi}`
            })
          });
        }
      }
    }

    // Add roof slab to the top floor
    if (fi === floors - 1) {
      floorGroup.children.push(floorSlab3D({
        footprint,
        thickness: slabThickness,
        id: `${id}_roof`,
        position: [0, floorHeight / 2, 0],
        material: 'floor_slab'
      }));
    }

    children.push(floorGroup);
  }

  return {
    type: 'group',
    id,
    children
  };
}



///////////////////// small utilities /////////////////////
export function deepCloneNode(node, idSuffix = '') {
  if (!node) return null;
  const clone = JSON.parse(JSON.stringify(node));
  function appendIds(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.id === 'string') obj.id = `${obj.id}${idSuffix}`;
    if (Array.isArray(obj.children)) {
      for (const ch of obj.children) appendIds(ch);
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object') {
        // avoid infinite recursion for deeply nested non-node objects is fine
        appendIds(v);
      }
    }
  }
  appendIds(clone);
  return clone;
}

export function repeatLinear3D(params = {}) {
  const { module, count = 5, spacing = 5, axis = 'x', centered = true, id = 'linear_array' } = params;
  
  console.log('repeatLinear3D called with count:', count);
  console.log('Module:', module);
  
  if (!module) {
    console.error('No module provided to repeatLinear3D!');
    return { type: 'group', id, children: [] };
  }
  
  const children = [];
  const startOffset = centered ? -(count - 1) / 2 * spacing : 0;
  
  for (let i = 0; i < count; i++) {
    const copy = deepCloneNode(module, `_${i}`);
    const offset = startOffset + i * spacing;
    const pos = axis === 'x' ? [offset, 0, 0]
              : axis === 'y' ? [0, offset, 0]
              : [0, 0, offset];
    
    copy.position = copy.position || [0, 0, 0];
    copy.position = [
      copy.position[0] + pos[0],
      copy.position[1] + pos[1],
      copy.position[2] + pos[2]
    ];
    
    console.log(`Created copy ${i} at position:`, copy.position);
    children.push(copy);
  }
  
  console.log(`repeatLinear3D created ${children.length} children`);
  return { type: 'group', id, children };
}


export function addVectors(a = [0,0,0], b = [0,0,0]) {
  return [
    (a[0] || 0) + (b[0] || 0),
    (a[1] || 0) + (b[1] || 0),
    (a[2] || 0) + (b[2] || 0)
  ];
}

///////////////////// linear & radial repeaters /////////////////////
/**
 * uh_arrayHelper3D({ element, count, direction, spacing, offsetFunction, center, id })
 * - element: node to clone (object)
 * - direction: 'x'|'y'|'z' or custom [x,y,z]
 * - offsetFunction(i, count) => [x,y,z] optional
 */
export function arrayHelper3D(params = {}) {
  const {
    element = null,
    count = 5,
    direction = 'x',
    spacing = 5,
    offsetFunction = null,
    center = true,
    id = 'array'
  } = params;

  if (!element) return { type: 'group', id, children: [] };

  const children = [];
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const suffix = `_${i}`;
    const copy = deepCloneNode(element, suffix);
    let localOffset;
    if (typeof offsetFunction === 'function') {
      localOffset = offsetFunction(i, count);
    } else if (Array.isArray(direction)) {
      localOffset = [direction[0] * i * spacing, (direction[1] || 0) * i * spacing, (direction[2] || 0) * i * spacing];
    } else {
      const idx = center ? (i - half) : i;
      if (direction === 'x') localOffset = [idx * spacing, 0, 0];
      else if (direction === 'y') localOffset = [0, idx * spacing, 0];
      else localOffset = [0, 0, idx * spacing]; // z
    }
    copy.position = copy.position ? addVectors(copy.position, localOffset) : localOffset;
    children.push(copy);
  }
  return { type: 'group', id, children };
}

/**
 * uh_radialArray3D({ element, count, radius, angleStart, angleEnd, rotateElements, center, id })
 */
export function radialArray3D(params = {}) {
  const {
    element = null,
    count = 12,
    radius = 10,
    angleStart = 0,
    angleEnd = Math.PI * 2,
    rotateElements = true,
    center = [0, 0, 0],
    id = 'radial_array'
  } = params;

  if (!element) return { type: 'group', id, children: [] };

  const children = [];
  const angleStep = (angleEnd - angleStart) / Math.max(1, count);
  for (let i = 0; i < count; i++) {
    const angle = angleStart + i * angleStep;
    const x = center[0] + radius * Math.cos(angle);
    const z = center[2] + radius * Math.sin(angle);
    const copy = eepCloneNode(element, `_${i}`);
    copy.position = copy.position ? addVectors(copy.position, [x, 0, z]) : [x, 0, z];
    if (rotateElements) {
      copy.rotation = copy.rotation || [0, 0, 0];
      copy.rotation[1] = angle + Math.PI / 2;
    }
    children.push(copy);
  }
  return { type: 'group', id, children };
}

///////////////////// simple path sampling helpers /////////////////////
export function samplePointOnPathLinear(path, t) {
  if (!Array.isArray(path) || path.length === 0) return [0,0,0];
  const n = path.length;
  if (t <= 0) return path[0];
  if (t >= 1) return path[n-1];
  const segLens = [];
  let total = 0;
  for (let i = 0; i < n-1; i++) {
    const a = path[i], b = path[i+1];
    const dx = (b[0] - a[0]) || 0;
    const dy = (b[1] - a[1]) || 0;
    const dz = (b[2] || 0) - (a[2] || 0);
    const L = Math.hypot(dx, dy, dz);
    segLens.push(L);
    total += L;
  }
  if (total <= 1e-9) return path[0];
  const target = t * total;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    const L = segLens[i];
    if (acc + L >= target) {
      const localT = (target - acc) / Math.max(1e-9, L);
      const a = path[i], b = path[i+1];
      return [
        a[0] * (1 - localT) + b[0] * localT,
        (a[1] || 0) * (1 - localT) + (b[1] || 0) * localT,
        (a[2] || 0) * (1 - localT) + (b[2] || 0) * localT
      ];
    }
    acc += L;
  }
  return path[path.length - 1];
}

export function tangentOnPathLinear(path, t, delta = 1e-4) {
  const p0 = samplePointOnPathLinear(path, Math.max(0, t - delta));
  const p1 = samplePointOnPathLinear(path, Math.min(1, t + delta));
  return [p1[0] - p0[0], p1[1] - p0[1], (p1[2] || 0) - (p0[2] || 0)];
}

///////////////////// path-follow repeater /////////////////////
/**
 * uh_pathFollowHelper3D({
 *   element, path, count, alignToPath, useCatmull, id
 * })
 * - uses your sampleCatmull() if useCatmull===true and path length > 2
 */
export function pathFollowHelper3D(params = {}) {
  const {
    element = null,
    path = [[0,0,0],[10,0,0]],
    count = 8,
    alignToPath = true,
    useCatmull = true,
    id = 'path_follow'
  } = params;

  if (!element) return { type: 'group', id, children: [] };
  const children = [];
  const hasCatmull = (useCatmull && Array.isArray(path) && path.length > 2);

  // if catmull available in file, use the internal sampleCatmull (it expects arrays or Vec3)
  for (let i = 0; i < count; i++) {
    const t = (count === 1) ? 0.5 : i / (count - 1);
    let pos, tangent;
    if (hasCatmull && typeof sampleCatmull === 'function') {
      // adapt: sampleCatmull(centerlinePoints, t) in your file expects array of arrays => it returns pos Vector3 + tangent Vector3
      const sample = sampleCatmull(path.map(p => [p[0], p[1], p[2] || 0]), t);
      pos = [sample.position.x, sample.position.y, sample.position.z];
      tangent = [sample.tangent.x, sample.tangent.y, sample.tangent.z];
    } else {
      pos = samplePointOnPathLinear(path, t);
      tangent = tangentOnPathLinear(path, t);
    }

    const copy = deepCloneNode(element, `_${i}`);
    copy.position = copy.position ? addVectors(copy.position, pos) : pos;

    if (alignToPath && tangent) {
      const tx = tangent[0] || 0, ty = tangent[1] || 0, tz = tangent[2] || 0;
      const horizLen = Math.hypot(tx, tz) || 1e-9;
      const yaw = Math.atan2(tz, tx);
      const pitch = Math.atan2(ty, horizLen);
      copy.rotation = copy.rotation || [0, 0, 0];
      // set rotation conventions similar to other helpers in your file
      copy.rotation[0] = -pitch; // test in your renderer and invert sign if necessary
      copy.rotation[1] = yaw;
    }
    children.push(copy);
  }

  return { type: 'group', id, children };
}

///////////////////// arch modules /////////////////////
/**
 * uh_createArchModule(params)
 * - returns a module group containing either extrude with holes (preferred)
 *   or a solid wall plus a separate hole extrude (for CSG), plus a top bearing box.
 * - params: { width, height, depth, pierBearing, throatDepth, holeSupport, voussoirCount, id, material, archSegments }
 */
/**
 * Parametric arch module with optional hole support
 * Uses ellipse2d for smooth semicircular arch openings
 */
/**
 * Parametric arch module with proper height control
 */
/**
 * Parametric arch module with proper ground-level opening
 * Pier sections are solid wall; arch opening starts at ground
 */
/**
 * Parametric arch module with correct ellipse positioning
 */
/**
 * Parametric arch module with ellipse centered at spring line
 */
export function createArchModule(params = {}) {
  const {
    width = 4,
    pierHeight = 2,
    archHeight = 3,
    spandrelHeight = 1,
    depth = 2,
    wallThickness = 0.6,
    holeSupport = true,
    archSegments = 24,
    archStyle = 'semicircular',
    id = 'arch_module',
    material = 'stone'
  } = params;
  
  const hw = width / 2;
  const margin = wallThickness;
  
  const totalHeight = pierHeight + archHeight + spandrelHeight;
  const archTopY = pierHeight + archHeight;  // Crown of arch
  
  // Outer wall profile
  const outer = [
    [-hw - margin, 0],
    [hw + margin, 0],
    [hw + margin, totalHeight],
    [-hw - margin, totalHeight],
    [-hw - margin, 0]
  ];
  
  // Generate arch hole
  let hole = [];
  
  if (archStyle === 'semicircular') {
    // Ellipse center at spring line (pierHeight)
    // Vertical radius = archHeight so it reaches up to pierHeight + archHeight
    const ellipseCenterY = pierHeight;
    const verticalRadius = archHeight;
    
    const archCurve = ellipse2d(
      0,                    // cx
      ellipseCenterY,       // cy - center at spring line
      hw,                   // rx - horizontal radius
      verticalRadius,       // ry - extends up by archHeight
      Math.PI,              // start (180°)
      0,                    // end (0°)
      archSegments
    );
    
    // Close at spring line
    hole = [
      ...archCurve,
      [hw, 0],
      [-hw, 0],
      archCurve[0]
    ];
    
  } else if (archStyle === 'elliptical') {
    const ellipseCenterY = pierHeight;
    const verticalRadius = archHeight;
    
    const archCurve = ellipse2d(
      0,
      ellipseCenterY,
      hw,
      verticalRadius,
      Math.PI,
      0,
      archSegments
    );
    
    hole = [
      ...archCurve,
      [hw, 0],
      [-hw, 0],
      archCurve[0]
    ];
    
  } else if (archStyle === 'segmental') {
    const radius = (hw * hw + archHeight * archHeight) / (2 * archHeight);
    const angleSpan = Math.asin(hw / radius);
    const startAngle = Math.PI / 2 - angleSpan;
    const endAngle = Math.PI / 2 + angleSpan;
    
    const centerY = pierHeight + radius - archHeight;
    
    const archCurve = ellipse2d(
      0,
      centerY,
      radius,
      radius,
      startAngle,
      endAngle,
      archSegments
    );
    
    hole = [
      ...archCurve,
      [hw, pierHeight],
      [-hw, pierHeight],
      archCurve[0]
    ];
  }
  
  const children = [];
  
  if (holeSupport) {
    children.push({
      type: 'extrude',
      id: `${id}_wall`,
      dimensions: {
        outer,
        holes: [hole],
        options: { 
          depth, 
          bevelEnabled: false, 
          steps: 1, 
          curveSegments: Math.max(4, Math.floor(archSegments / 2))
        }
      },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      material
    });
  } else {
    children.push({
      type: 'extrude',
      id: `${id}_wall_solid`,
      dimensions: { 
        outer, 
        options: { depth, bevelEnabled: false, steps: 1 } 
      },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      material
    });
  }
  
  return {
    type: 'group',
    id,
    children,
    meta: {
      width,
      pierHeight,
      archHeight,
      spandrelHeight,
      totalHeight,
      archTopY,
      depth,
      anchors: [
        { name: 'base', pos: [0, 0, 0], dir: [0, 1, 0] },
        { name: 'spring_line', pos: [0, pierHeight, 0], dir: [0, 0, 1] },
        { name: 'arch_crown', pos: [0, archTopY, 0], dir: [0, 0, 1] },
        { name: 'wall_top', pos: [0, totalHeight, 0], dir: [0, 1, 0] }
      ]
    }
  };
}







/**
 * uh_voussoirArchModule(params)
 * - explicit voussoir-only module that assembles wedge/box voussoirs around a semicircle.
 * - useful when you want purely brick-like construction without extrude holes/CSG.
 */
export function voussoirArchModule(params = {}) {
  const {
    width = 4,
    height = 3,
    depth = 2,
    voussoirCount = 16,
    radialOffset = 0.02,
    id = 'voussoirArch',
    material = 'stone'
  } = params;

  const children = [];
  const r = width / 2;
  const archTop = Math.min(height, r);

  for (let k = 0; k < voussoirCount; k++) {
    const ta = Math.PI + (k / voussoirCount) * Math.PI;
    const tb = Math.PI + ((k + 1) / voussoirCount) * Math.PI;
    const mid = (ta + tb) / 2;
    const aX = r * Math.cos(ta);
    const bX = r * Math.cos(tb);
    const aY = archTop * (1 - Math.cos(ta));
    const bY = archTop * (1 - Math.cos(tb));
    const midX = r * Math.cos(mid);
    const midY = archTop * (1 - Math.cos(mid));

    // approximate wedge as box sized to chord between a and b and small thickness
    const chord = Math.hypot(bX - aX, bY - aY);
    const boxWidth = Math.max(0.05, chord * 0.95);
    const boxHeight = Math.max(0.05, Math.max(aY, bY) - 0 + 0.05);
    const boxDepth = depth + 0.02;

    children.push({
      type: 'box',
      id: `${id}_voussoir_${k}`,
      material,
      dimensions: [boxWidth, boxHeight, boxDepth],
      position: [midX + (Math.cos(mid) * radialOffset), boxHeight / 2, 0],
      rotation: [0, -mid + Math.PI / 2, 0]
    });
  }

  // supporting piers (left & right halves) optionally can be added externally by the assembly
  const node = { type: 'group', id, children, meta: { anchors: [{ name: 'base', pos: [0, 0, 0] }, { name: 'top', pos: [0, archTop + 0.05, 0] }] } };
  return node;
}

/**
 * Repeat module along a curved path with proper orientation
 */
/**
 * Repeat module along a curved path with proper matrix-based orientation
 * Uses the same rotation logic as checkerboardPanels3D for precise alignment
 */
export function repeatAlongCurve3D(params = {}) {
  const {
    module,
    path = [[0, 0, 0], [10, 0, 0]],
    count = 5,
    alignToPath = true,
    upVector = [0, 1, 0],
    id = 'curve_array'
  } = params;
  
  if (!module) {
    console.error('repeatAlongCurve3D: module is required');
    return { type: 'group', id, children: [] };
  }
  
  if (!Array.isArray(path) || path.length < 2) {
    console.error('repeatAlongCurve3D: path must have at least 2 points');
    return { type: 'group', id, children: [module] };
  }
  
  const children = [];
  
  // Convert path to THREE.Vector3 for easier manipulation
  const pathVectors = path.map(p => new THREE.Vector3(
    p[0] || 0,
    p[1] || 0,
    p[2] || 0
  ));
  
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    
    // Sample position along path
    const p = samplePointOnPath(path, t);
    const tan = tangentOnPath(path, t);
    
    const copy = deepCloneNode(module, `_${i}`);
    
    // Set position
    copy.position = copy.position || [0, 0, 0];
    copy.position = [
      p[0] + copy.position[0],
      p[1] + copy.position[1],
      p[2] + copy.position[2]
    ];
    
    if (alignToPath) {
      // Use the SAME rotation logic as checkerboardPanels3D
      const tangent = new THREE.Vector3(tan[0], tan[1], tan[2]).normalize();
      const upVec = new THREE.Vector3(upVector[0], upVector[1], upVector[2]);
      
      // Calculate normal vector perpendicular to tangent and up
      const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
      
      // Recalculate up vector to ensure orthogonality
      const orthogonalUp = new THREE.Vector3().crossVectors(tangent, normal).normalize();
      
      // Create rotation matrix from basis vectors
      // Note: makeBasis expects (x-axis, y-axis, z-axis)
      // For arch: tangent = forward (X), normal = right (Z), up = up (Y)
      const rotMatrix = new THREE.Matrix4().makeBasis(
        tangent,      // X-axis: forward along path
        orthogonalUp, // Y-axis: up
        normal        // Z-axis: right/normal to path
      );
      
      // Extract Euler angles from rotation matrix
      const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix, 'XYZ');
      
      copy.rotation = copy.rotation || [0, 0, 0];
      copy.rotation = [euler.x, euler.y, euler.z];
    }
    
    children.push(copy);
  }
  
  return { type: 'group', id, children };
}



/**
 * Sample point along path using linear interpolation with cumulative arc length
 */
function samplePointOnPath(path, t) {
  if (!Array.isArray(path) || path.length === 0) return [0, 0, 0];
  const n = path.length;
  if (t <= 0) return [...path[0]];
  if (t >= 1) return [...path[n - 1]];
  
  // Compute cumulative arc lengths
  const segLens = [];
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = (b[2] || 0) - (a[2] || 0);
    const L = Math.hypot(dx, dy, dz);
    segLens.push(L);
    total += L;
  }
  
  if (total === 0) return [...path[0]];
  
  // Find segment containing target distance
  const target = t * total;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    const L = segLens[i];
    if (acc + L >= target) {
      const localT = (target - acc) / Math.max(1e-9, L);
      const a = path[i], b = path[i + 1];
      return [
        a[0] + (b[0] - a[0]) * localT,
        a[1] + (b[1] - a[1]) * localT,
        (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * localT
      ];
    }
    acc += L;
  }
  return [...path[path.length - 1]];
}

/**
 * Get tangent vector at point on path
 */
function tangentOnPath(path, t, delta = 0.01) {
  const p0 = samplePointOnPath(path, Math.max(0, t - delta));
  const p1 = samplePointOnPath(path, Math.min(1, t + delta));
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return [dx / len, dy / len, dz / len];
}

/**
 * Generate a circular arc path
 */
export function createArcPath(params = {}) {
  const {
    center = [0, 0, 0],
    radius = 50,
    startAngle = 0,        // degrees
    endAngle = 90,         // degrees
    segments = 16,
    plane = 'xz'           // 'xy', 'xz', or 'yz'
  } = params;
  
  const path = [];
  const a0 = startAngle * Math.PI / 180;
  const a1 = endAngle * Math.PI / 180;
  const da = (a1 - a0) / segments;
  
  for (let i = 0; i <= segments; i++) {
    const angle = a0 + i * da;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    
    if (plane === 'xy') {
      path.push([center[0] + x, center[1] + y, center[2]]);
    } else if (plane === 'xz') {
      path.push([center[0] + x, center[1], center[2] + y]);
    } else if (plane === 'yz') {
      path.push([center[0], center[1] + x, center[2] + y]);
    }
  }
  
  return path;
}

/**
 * Generate a spline path through control points
 */
export function createSplinePath(params = {}) {
  const {
    controlPoints = [[0,0,0], [10,5,0], [20,0,0]],
    segments = 32,
    tension = 0.5
  } = params;
  
  const path = [];
  const n = controlPoints.length;
  
  for (let i = 0; i < n - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(n - 1, i + 2)];
    
    const steps = Math.floor(segments / (n - 1));
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      const t2 = t * t, t3 = t2 * t;
      
      // Catmull-Rom spline
      const a0 = -tension * t3 + 2 * tension * t2 - tension * t;
      const a1 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
      const a2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t;
      const a3 = tension * t3 - tension * t2;
      
      path.push([
        a0 * p0[0] + a1 * p1[0] + a2 * p2[0] + a3 * p3[0],
        a0 * p0[1] + a1 * p1[1] + a2 * p2[1] + a3 * p3[1],
        a0 * (p0[2]||0) + a1 * (p1[2]||0) + a2 * (p2[2]||0) + a3 * (p3[2]||0)
      ]);
    }
  }
  
  path.push([...controlPoints[n - 1]]);
  return path;
}

/**
 * THE ONLY MODULE HELPER YOU NEED
 * Everything else is schema composition
 */
export function createExtrudeWithHole3D(params = {}) {
  const {
    outerProfile,
    holeProfile = null,
    depth = 2,
    holeSupport = true,
    rotation = [Math.PI / 2, 0, 0],
    position = [0, 0, 0],
    id = 'extrude_module',
    material = 'default'
  } = params;
  
  if (!outerProfile) {
    console.error('createExtrudeWithHole3D: outerProfile is required');
    return { type: 'group', id, children: [] };
  }
  
  const dimensions = {
    outer: outerProfile,
    options: { depth, bevelEnabled: false, steps: 1, curveSegments: 12 }
  };
  
  if (holeProfile && holeSupport) {
    dimensions.holes = [holeProfile];
  }
  
  return {
    type: 'group',
    id,
    children: [{
      type: 'extrude',
      id: `${id}_extrude`,
      dimensions,
      position,
      rotation,
      material
    }],
    meta: { depth, hasHole: !!(holeProfile && holeSupport) }
  };
}





