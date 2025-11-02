// helpers3d.js — Parametric 3D pattern helpers for spellshape-three
export * from './helpers3d_extended.js';

import { 
  rect2d, 
  roundedRect2d, 
  polygon2d, 
  ellipse2d 
} from './helpers2d.js';
  import * as THREE from 'three'

// Add this function to helpers3d.js
export function resolveParameters(params, context = {}) {
  if (params === null || params === undefined) return params;
  
  // Handle arrays - recursively resolve each element
  if (Array.isArray(params)) {
    return params.map(item => resolveParameters(item, context));
  }
  
  // Handle objects - recursively resolve each property
  if (typeof params === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      resolved[key] = resolveParameters(value, context);
    }
    return resolved;
  }
  
  // Handle strings that contain $ variable references
  if (typeof params === 'string' && params.includes('$')) {
    try {
      // Replace all $variable_name with actual values from context
      let result = params;
      
      // Match all $variable patterns
      const matches = params.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g);
      if (matches) {
        for (const match of matches) {
          const varName = match.substring(1); // Remove $
          if (context.hasOwnProperty(varName)) {
            result = result.replace(match, context[varName]);
          }
        }
      }
      
      // Now evaluate the expression if it's a math expression
      // Remove any remaining $ signs that couldn't be resolved
      if (!result.includes('$')) {
        // Safely evaluate using Function constructor
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


/**
 * Alternating wall/glass panel facade.
 * Generates a single array of panels, alternating along one axis.
 */

/**
 * Creates alternating wall/glass panels along a 2D path.
 *
 * @param {Object} params - Configuration parameters:
 *   path (Array of [x,z]): list of 2D points defining the path on the XZ-plane.
 *   count (int): Number of wall–glass *pairs* to place along the path.
 *   panelWidth, wallRatio, windowRatio: Base widths (wallWidth = panelWidth*wallRatio, etc.).
 *   height, wallHeight: Vertical heights for window and wall panels.
 *   wallDepth, windowDepth: Thickness (extrusion depth) of wall and glass panels.
 *   wallShape (string): 'rect2d' | 'roundedRect2d' | 'ellipse2d', shape type for wall panels.
 *   wallRadius (float): Corner radius for roundedRect2d (ignored otherwise).
 *   wallSegments (int): Tessellation segments for rounded/ellipse profiles.
 *   windowShape, windowRadius, windowSegments: same, for glass panels.
 *   wallMaterial, windowMaterial: material names for each panel type.
 *   startWith (string): 'wall' or 'window' – which segment type comes first.
 *   frequency (float): number of wave cycles over the whole path.
 *   amplitude (float): relative amplitude of width variation (0 = no variation).
 *   origin (array [x,y,z]): global offset for all panels (default [0,0,0]).
 *   id (string): ID for the returned group.
 *
 * @returns {Object} A `group` node with extruded panel children.
 *
 * Example usage:
 * checkerboardPanels3D({
 *   path: [[0,0], [10,0], [20,5], [30,0]],
 *   count: 5,
 *   panelWidth: 2, wallRatio: 0.6, windowRatio: 0.4,
 *   height: 4, wallHeight: 4,
 *   wallDepth: 0.3, windowDepth: 0.2,
 *   wallShape: 'roundedRect2d', wallRadius: 0.2, wallSegments: 16,
 *   windowShape: 'ellipse2d', windowRadius: 0.2, windowSegments: 32,
 *   wallMaterial: 'brick', windowMaterial: 'glass',
 *   startWith: 'wall', frequency: 1.5, amplitude: 0.5,
 *   origin: [0,0,0], id: 'facade_panels'
 * });
 */

// Requires THREE global and your 2D profile helpers (roundedRect2d, ellipse2d, polygon2d)
export function checkerboardPanels3D(params) {
// Simply use ALL numeric params as context
  const context = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number' || typeof value === 'string') {
      context[key] = value;
    }
  }
  
  // Resolve the path parameter specifically
  if (params.path && Array.isArray(params.path) && params.path.length > 0) {
    if (typeof params.path[0][0] === 'string') {
      // console.log('Resolving path with context:', context);
      params.path = resolveParameters(params.path, context);
      // console.log('Resolved path:', params.path);
    }
  }

  const {
    path = [[-10, -5], [10, -5], [10, 5], [-10, 5], [-10, -5]],
    count = 20,
    panelsPerWidth = null,
    panelsPerDepth = null,
    // kept for API compatibility
    // panelWidth = 2,
    wallRatio = 0.5,
    // windowRatio = 0.5,
    // nominal heights
    // height = 2.0,
    wallHeight = 3.0,
    // profile/thickness values (outward thickness)
    wallDepth = 0.2,
    windowDepth = 0.1,
    wallMaterial = "wall",
    windowMaterial = "window",
    wallShape = "rect",
    windowShape = "rect",
    alternating = false,
    wallSegments = 8,
    windowSegments = 8,
    cornerRadius = 0.1,
    startWith = "wall", // which subpanel starts first in the first panel
    frequency = 1,
    amplitude = 0.0,
    origin = [0, 0, 0],
    id = "facade_panels",
    // floor height settings
    floorHeight = 3,
    heightCoefficient = 1.0,
    // safety clamp to avoid zero widths
    minMultiplier = 0.05,
    // NEW: how far panels extend beyond side endpoints (along tangent). Default: max thickness
    cornerOverlap = 0
  } = params;

  // Add debug logging to see what's actually received
  // console.log('Path received:', path);
  // console.log('Path type:', typeof path, Array.isArray(path));
  // if (Array.isArray(path) && path.length > 0) {
  //   console.log('First point:', path[0], 'Types:', typeof path[0][0], typeof path[0][1]);
  // }

  // default cornerOverlap to the larger thickness if not provided
  const _cornerOverlap = (cornerOverlap === null || cornerOverlap === undefined)
    ? Math.max(wallDepth, windowDepth)
    : cornerOverlap;

  if (!Array.isArray(path) || path.length < 2) {
    console.warn('checkerboardPanels3D: "path" must be an array of >=2 points');
    return { type: "group", id, children: [] };
  }

  function generateProfileShape(shapeType, profileWidth, profileDepth, segments = 8, radius = 0.1) {
    const hw = profileWidth / 2;
    const hd = profileDepth / 2;

    switch (shapeType) {
      case "roundedRect":
        return roundedRect2d(0, hd, profileWidth, profileDepth, Math.min(radius, hw, hd), segments, 0);

      case "ellipse":
        return ellipse2d(0, hd, hw, hd, 0, Math.PI * 2, segments);

      case "polygon":
        return polygon2d(0, hd, Math.min(hw, hd), 6, 0);

      case "rect":
      default:
        // profile coords: X across width (-hw..hw), Y across thickness (0..profileDepth)
        // note: Y starts at 0 so Y=0 maps to the inner face (side line) if we place position at the side line
        return [
          [-hw, 0],
          [hw, 0],
          [hw, profileDepth],
          [-hw, profileDepth],
          [-hw, 0]
        ];
    }
  }

  const panels = [];

  // numeric path & 3D points in XZ plane
  const numericPath = path.map(pt => [
    typeof pt[0] === 'string' ? parseFloat(pt[0]) : pt[0],
    typeof pt[1] === 'string' ? parseFloat(pt[1]) : pt[1]
  ]);

  const pts3d = numericPath.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const isClosed = pts3d[0].distanceTo(pts3d[pts3d.length - 1]) < 0.001;

  // build sides
  const sides = [];
  const numSides = pts3d.length - 1;
  for (let i = 0; i < numSides; i++) {
    const p0 = pts3d[i];
    const p1 = pts3d[i + 1];
    const length = p0.distanceTo(p1);
    const tangent = new THREE.Vector3().subVectors(p1, p0).normalize();

    sides.push({
      start: p0,
      end: p1,
      length,
      tangent,
      index: i
    });
  }

  // panels per side
  let panelsPerSide;
  if (panelsPerWidth !== null && panelsPerDepth !== null && sides.length === 4) {
    panelsPerSide = [panelsPerWidth, panelsPerDepth, panelsPerWidth, panelsPerDepth];
  } else {
    const totalLength = sides.reduce((sum, side) => sum + side.length, 0);
    panelsPerSide = sides.map(side => Math.max(2, Math.round((side.length / totalLength) * count)));
  }

  // total panels overall (for wave u calculation)
  const totalPanels = panelsPerSide.reduce((a, b) => a + b, 0);
  if (totalPanels === 0) {
    return { type: "group", id, children: [] };
  }

  // precompute multipliers for every panel slot globally according to wave
  const multipliersGlobal = new Array(totalPanels);
  for (let gi = 0; gi < totalPanels; gi++) {
    const u = gi / Math.max(totalPanels - 1, 1);
    const m = 1 + amplitude * Math.sin(frequency * 2 * Math.PI * u);
    multipliersGlobal[gi] = Math.max(minMultiplier, m);
  }

  // centroid (XZ) for outward normal check if closed
  let centroidXZ = null;
  if (isClosed) {
    centroidXZ = numericPath.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]).map(v => v / numericPath.length);
  }

  // iterate per-side, but use the global multipliers slice for that side.
  let globalIndexCursor = 0;
  for (let sideIdx = 0; sideIdx < sides.length; sideIdx++) {
    const side = sides[sideIdx];
    const sideCount = panelsPerSide[sideIdx] || 0;

    if (sideCount <= 0) {
      globalIndexCursor += sideCount;
      continue;
    }

    // slice multipliers for this side
    const sliceMultipliers = multipliersGlobal.slice(globalIndexCursor, globalIndexCursor + sideCount);

    // We'll expand the side effective length so panels can overlap corners:
    // effectiveLength = side.length + 2 * cornerOverlap
    const effectiveLength = side.length + 2 * _cornerOverlap;

    // normalize multipliers so widths sum to effectiveLength
    const sum_m = sliceMultipliers.reduce((s, v) => s + v, 0) || 1;
    const widths = sliceMultipliers.map(m => (effectiveLength * m) / sum_m);

    // compute cumulative offsets starting at -cornerOverlap (so first panel begins before side.start)
    const offsets = new Array(sideCount);
    let accum = -_cornerOverlap;
    for (let j = 0; j < sideCount; j++) {
      offsets[j] = accum;
      accum += widths[j];
    }

    // generate each panel and its subpanels (wall/window split)
    for (let j = 0; j < sideCount; j++) {
      const panelGlobalIndex = globalIndexCursor + j;
      const thisPanelWidth = widths[j];

      // decide whether this panel starts with wall or window
      // const isWallFirst = (startWith === "wall") ? (panelGlobalIndex % 2 === 0) : (panelGlobalIndex % 2 === 1);
      // Use alternating parameter to control pattern
  let isWallFirst;
  if (alternating) {
    // Checkerboard: alternate based on panel and row indices
    isWallFirst = (startWith === "wall") ? (panelGlobalIndex % 2 === 0) : (panelGlobalIndex % 2 === 1);
  } else {
    // Consistent: all panels follow startWith parameter
    isWallFirst = (startWith === "wall");
  } 

      // split the panel width into wall / window by wallRatio (these are fractions of the panel width)
      const wallPortionWidth = thisPanelWidth * wallRatio;
      const windowPortionWidth = thisPanelWidth * (1 - wallRatio);
      // Calculate heights based on panel type
const wallPanelHeight = floorHeight * heightCoefficient;  // Expanded height for walls
const windowPanelHeight = floorHeight;  // Standard height for glass
console.log('Wall height:', wallPanelHeight, 'Window height:', windowPanelHeight, 'Coefficient:', heightCoefficient);

      const subPanels = isWallFirst ? [
        {
          type: 'wall',
          profileWidth: wallPortionWidth,
          profileDepth: wallDepth,
          extrudeHeight: wallPanelHeight,
          material: wallMaterial,
          shape: wallShape,
          segments: wallSegments,
          localOffset: 0
        },
        {
          type: 'window',
          profileWidth: windowPortionWidth,
          profileDepth: windowDepth,
          extrudeHeight: windowPanelHeight,
          material: windowMaterial,
          shape: windowShape,
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
          shape: windowShape,
          segments: windowSegments,
          localOffset: 0
        },
        {
          type: 'wall',
          profileWidth: wallPortionWidth,
          profileDepth: wallDepth,
          extrudeHeight: wallPanelHeight,
          material: wallMaterial,
          shape: wallShape,
          segments: wallSegments,
          localOffset: windowPortionWidth
        }
      ];

      // For each subpanel compute its absolute center along the side:
      for (let s = 0; s < subPanels.length; s++) {
        const subPanel = subPanels[s];

        // local center from the panel start
        const localCenterDist = subPanel.localOffset + subPanel.profileWidth / 2;
        // absolute distance along the side from side.start (can be negative or >side.length due to overlap)
        const absoluteDist = offsets[j] + localCenterDist;

        // compute param t relative to side (can be <0 or >1 — we intentionally extrapolate to allow overlap)
        const t = absoluteDist / side.length;

        // position along the side (extrapolated if t outside [0,1])
        const pos = new THREE.Vector3().lerpVectors(side.start, side.end, t);

        // build 2D profile
        const profileOuter = generateProfileShape(
          subPanel.shape,
          subPanel.profileWidth,
          subPanel.profileDepth,
          subPanel.segments,
          cornerRadius
        );

        // -------------------------------
        // Build rotation & offsets
        // local X = tangent (width along side),
        // local Y = outward normal (profile thickness),
        // local Z = up (extrusion -> vertical)
        // -------------------------------
        const tangent = new THREE.Vector3().subVectors(side.end, side.start).normalize();
        const upVec = new THREE.Vector3(0, 1, 0);

        // normal = tangent x up (consistent orientation)
        let normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();

        // flip normal if closed and pointing inward
        if (isClosed && centroidXZ) {
          const vecFromCentroid = new THREE.Vector3(pos.x - centroidXZ[0], 0, pos.z - centroidXZ[1]);
          if (vecFromCentroid.dot(normal) < 0) normal.negate();
        }

        // Basis mapping: local X = tangent, local Y = normal, local Z = upVec
        const rotMatrix = new THREE.Matrix4().makeBasis(tangent, normal, upVec);
        const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix, 'XYZ');
        const rotationCorrect = [euler.x, euler.y, euler.z];

        // vertical offset so bottom sits at origin[1]
        // const yOffset = subPanel.extrudeHeight / 2;
        const yOffset = - floorHeight / 2;

        // IMPORTANT: inner face (Y=0 in profile) should be at the side line => no outward centering offset
        // So outwardOffset = 0 places the profile's Y=0 exactly on the side line.
        const outwardOffset = new THREE.Vector3(0, 0, 0);

        const finalPos = pos.clone().add(outwardOffset);
        finalPos.y = origin[1] + yOffset;

        panels.push({
          type: "extrude",
          id: `${id}_side${sideIdx}_panel${j}_${subPanel.type}`,
          dimensions: {
            outer: profileOuter,
            options: {
              // extrusion along local Z (world up)
              depth: subPanel.extrudeHeight,
              bevelEnabled: false,
              steps: 1,
              curveSegments: 1
            }
          },
          position: [finalPos.x + origin[0], finalPos.y, finalPos.z + origin[2]],
          rotation: rotationCorrect,
          material: subPanel.material
        });
      }
    }

    globalIndexCursor += sideCount;
  }

  return {
    type: "group",
    id,
    children: panels
  };
}





/**
 * Wave facade 3D panel helper.
 * Panels arranged with sinusoidal offset along a chosen axis.
 */
export function waveFacade3D({ cols, rows, size = [1, 3, 0.1], amplitude = 0.5, frequency = 1.0, axis = 'z', material = 'wave_mat' }) {
  const panels = [];
  for (let r = 0; r < rows; ++r) {
    for (let c = 0; c < cols; ++c) {
      const norm = c / Math.max(cols - 1, 1);
      const waveOffset = Math.sin(norm * frequency * 2 * Math.PI) * amplitude;
      const pos = [c * size[0], 0, r * size[1]];
      if (axis === 'z') pos[2] += waveOffset;
      else if (axis === 'x') pos[0] += waveOffset;
      panels.push({
        type: 'box',
        dimensions: size,
        position: pos,
        material,
      });
    }
  }
  return panels;
}

/**
 * Perimeter panel facade helper.
 * Returns panels for the edges of a rectangular building.
 */
export function perimeterPanels3D({ width, depth, floorHeight, floors, panelWidth, panelHeight, materialArray }) {
  const panels = [];
  const countWidth = Math.floor(width / panelWidth);
  const countDepth = Math.floor(depth / panelWidth);
  for (let f = 0; f < floors; ++f) {
    const y = f * floorHeight;
    for (let c = 0; c < countWidth; ++c) {
      const x = -width / 2 + c * panelWidth + panelWidth / 2;
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [x, y, depth / 2],
        material: materialArray ? materialArray[c % materialArray.length] : 'wall_mat',
      });
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [x, y, -depth / 2],
        material: materialArray ? materialArray[c % materialArray.length] : 'wall_mat',
      });
    }
    for (let c = 0; c < countDepth; ++c) {
      const z = -depth / 2 + c * panelWidth + panelWidth / 2;
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [width / 2, y, z],
        material: materialArray ? materialArray[c % materialArray.length] : 'glass_mat',
      });
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [-width / 2, y, z],
        material: materialArray ? materialArray[c % materialArray.length] : 'glass_mat',
      });
    }
  }
  return panels;
}

/**
 * Custom grid3D helper for general rectangular arrays.
 */
export function grid3D({ xCount, yCount, cellSize = [1, 1, 0.1], origin = [0, 0, 0], material = 'default_mat' }) {
  const panels = [];
  for (let i = 0; i < xCount; ++i) {
    for (let j = 0; j < yCount; ++j) {
      panels.push({
        type: 'box',
        dimensions: cellSize,
        position: [
          origin[0] + i * cellSize[0],
          origin[1],
          origin[2] + j * cellSize[1]
        ],
        material,
      });
    }
  }
  return panels;
}
