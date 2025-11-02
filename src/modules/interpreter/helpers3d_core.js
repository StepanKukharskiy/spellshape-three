import {
  rect2d,
  roundedRect2d,
  polygon2d,
  ellipse2d
} from './helpers2d.js';

// Core Three.js
import * as THREE from 'three';

// Geometry utils
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// // Subdivision surface modifier
// import { SubdivisionModifier } from 'three/examples/jsm/modifiers/SubdivisionModifier.js';

// Convex hull geometry
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

// // Voronoi diagrams in 3D (if using voronoiDivision)
// import { Voronoi } from 'voronoi-diagram-3d';

// // Constructive Solid Geometry (CSG)
// import { CSG } from 'three-csg-ts';

// // Perlin/Simplex noise for deformation, fields, etc.
// import { noise } from 'perlin-noise-3d';

// // For labeledPoint (if using text labels)
// import SpriteText from 'three-spritetext'; // Or another Three.js text renderer



// 1. createBox
export function createBox(params = {}) {
  console.log('createBox', params);
  const {
    width = 1,
    height = 1,
    depth = 1,
    material = null,
    position = [0, 0, 0],  // ✅ ADD
    rotation = [0, 0, 0],  // ✅ ADD
    scale = [1, 1, 1],      // ✅ ADD
    id = 'box'
  } = params;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;

  // ✅ APPLY transforms
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);

  return mesh;
}


// 2. createCylinder
export function createCylinder(params = {}) {
  console.log('createCylinder', params);
  const {
    radiusTop = 1,
    radiusBottom = 1,
    height = 1,
    radialSegments = 32,
    openEnded = false,
    material = null,
    position = [0, 0, 0],  // ✅ ADD
    rotation = [0, 0, 0],  // ✅ ADD
    scale = [1, 1, 1],      // ✅ ADD
    id = 'cylinder'
  } = params;

  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    1,
    openEnded
  );
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;

  // ✅ APPLY transforms
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);

  return mesh;
}


// 3. createSphere
export function createSphere(params = {}) {
  console.log('createSphere', params);
  const {
    radius = 1,
    widthSegments = 32,
    heightSegments = 16,
    material = null,
    position = [0, 0, 0],  // ✅ ADD
    rotation = [0, 0, 0],  // ✅ ADD
    scale = [1, 1, 1],      // ✅ ADD
    id = 'sphere'
  } = params;

  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;

  // ✅ APPLY transforms
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);

  return mesh;
}


// 4. createExtrude
export function createExtrude(params = {}) {
  console.log('createExtrude', params);
  const {
    profile = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1], [-0.5, 0]],
    depth = 1,
    holes = [],
    bevelEnabled = false,
    bevelThickness = 0.1,
    bevelSize = 0.1,
    bevelSegments = 3,
    steps = 1,
    curveSegments = 12,
    pos = [0, 0, 0],
    rot = [0, 0, 0],
    material = null,
    id = 'extrude'
  } = params;
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const holeProfile of holes) {
    const holePath = new THREE.Path(holeProfile.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(holePath);
  }
  const extrudeSettings = {
    depth,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    bevelSegments,
    steps,
    curveSegments
  };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.name = id;
  return mesh;
}

// 5. createLoft
export function createLoft(params = {}) {
  console.log('createLoft', params);
  const {
    profiles = [
      [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]],
      [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [-0.7, -0.7]]
    ],
    closed = false,
    heights = null,
    pos = [0, 0, 0],
    rot = [0, 0, 0],
    material = null,
    segments = 32,
    id = "loft"
  } = params;
  if (profiles.length < 2) {
    console.warn('createLoft: at least two profiles required');
    return new THREE.Group();
  }
  const profileHeights = heights || profiles.map((_, i) => i / (profiles.length - 1));
  const curves = profiles.map((profile, i) =>
    new THREE.CatmullRomCurve3(
      profile.map(([x, z]) => new THREE.Vector3(x, profileHeights[i], z)),
      true
    )
  );
  const pointsPerProfile = Math.max(profiles[0].length, segments);
  const vertices = [];
  const indices = [];
  for (let i = 0; i < curves.length; i++) {
    for (let j = 0; j < pointsPerProfile; j++) {
      const t = j / pointsPerProfile;
      const point = curves[i].getPoint(t);
      vertices.push(point.x, point.y, point.z);
    }
  }
  for (let i = 0; i < curves.length - 1; i++) {
    for (let j = 0; j < pointsPerProfile; j++) {
      const a = i * pointsPerProfile + j;
      const b = i * pointsPerProfile + ((j + 1) % pointsPerProfile);
      const c = (i + 1) * pointsPerProfile + ((j + 1) % pointsPerProfile);
      const d = (i + 1) * pointsPerProfile + j;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  if (closed && curves.length > 2) {
    const lastIdx = curves.length - 1;
    for (let j = 0; j < pointsPerProfile; j++) {
      const a = lastIdx * pointsPerProfile + j;
      const b = lastIdx * pointsPerProfile + ((j + 1) % pointsPerProfile);
      const c = ((j + 1) % pointsPerProfile);
      const d = j;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  mesh.name = id;
  return mesh;
}

// 6. translateGeometry
export function translateGeometry(params = {}) {
  console.log('translateGeometry', params);
  const { mesh, vector = [0, 0, 0] } = params;
  const clone = mesh.clone();
  clone.position.add(new THREE.Vector3(...vector));
  return clone;
}

// 7. rotateGeometry
export function rotateGeometry(params = {}) {
  console.log('rotateGeometry', params);
  const { mesh, angles = [0, 0, 0] } = params;
  const clone = mesh.clone();
  clone.rotation.x += angles[0];
  clone.rotation.y += angles[1];
  clone.rotation.z += angles[2];
  return clone;
}

// 8. scaleGeometry
export function scaleGeometry(params = {}) {
  console.log('scaleGeometry', params);
  const { mesh, factors = [1, 1, 1] } = params;
  const clone = mesh.clone();
  clone.scale.set(...factors);
  return clone;
}

// 9. twistGeometry
export function twistGeometry(params = {}) {
  console.log('twistGeometry', params);
  const { mesh, angle = Math.PI / 4, axis = [0, 1, 0], height = null, segments = 20 } = params;
  const cloned = mesh.clone();
  const geom = cloned.geometry;
  const bufferGeom = geom.isBufferGeometry ? geom : new THREE.BufferGeometry().fromGeometry(geom);
  const positions = bufferGeom.attributes.position;
  const count = positions.count;
  bufferGeom.computeBoundingBox();
  const bbox = bufferGeom.boundingBox;
  const axisNorm = new THREE.Vector3(...axis).normalize();
  const isYAxis = Math.abs(axisNorm.y) > 0.99;
  const minH = isYAxis ? bbox.min.y : bbox.min.z;
  const maxH = isYAxis ? bbox.max.y : bbox.max.z;
  const range = height || (maxH - minH);
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const h = isYAxis ? y : z;
    const t = (h - minH) / (range || 1);
    const theta = angle * t;
    if (isYAxis) {
      const newX = x * Math.cos(theta) - z * Math.sin(theta);
      const newZ = x * Math.sin(theta) + z * Math.cos(theta);
      positions.setXYZ(i, newX, y, newZ);
    } else {
      const newX = x * Math.cos(theta) - y * Math.sin(theta);
      const newY = x * Math.sin(theta) + y * Math.cos(theta);
      positions.setXYZ(i, newX, newY, z);
    }
  }
  positions.needsUpdate = true;
  bufferGeom.computeVertexNormals();
  cloned.geometry = bufferGeom;
  return cloned;
}

// 10. taperGeometry
export function taperGeometry(params = {}) {
  console.log('taperGeometry', params);
  const { mesh, topScale = [0.5, 0.5], axis = [0, 1, 0], height = null } = params;
  const cloned = mesh.clone();
  const geom = cloned.geometry;
  const bufferGeom = geom.isBufferGeometry ? geom : new THREE.BufferGeometry().fromGeometry(geom);
  const positions = bufferGeom.attributes.position;
  const count = positions.count;
  bufferGeom.computeBoundingBox();
  const bbox = bufferGeom.boundingBox;
  const axisNorm = new THREE.Vector3(...axis).normalize();
  const isYAxis = Math.abs(axisNorm.y) > 0.99;
  const minH = isYAxis ? bbox.min.y : bbox.min.z;
  const maxH = isYAxis ? bbox.max.y : bbox.max.z;
  const range = height || (maxH - minH);
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const h = isYAxis ? y : z;
    const t = (h - minH) / (range || 1);
    const scaleX = 1.0 + (topScale[0] - 1.0) * t;
    const scaleZ = 1.0 + (topScale[1] - 1.0) * t;
    positions.setXYZ(i, x * scaleX, y, z * scaleZ);
  }
  positions.needsUpdate = true;
  bufferGeom.computeVertexNormals();
  cloned.geometry = bufferGeom;
  return cloned;
}

// 11. mirrorGeometry
export function mirrorGeometry(params = {}) {
  console.log('mirrorGeometry', params);
  const { mesh, plane = { normal: [1, 0, 0], constant: 0 } } = params;
  const geom = mesh.geometry.clone();
  const normal = new THREE.Vector3(...plane.normal).normalize();
  const matrix = new THREE.Matrix4();
  const nx = normal.x, ny = normal.y, nz = normal.z, c = -plane.constant;
  matrix.set(
    1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * nz, 2 * c * nx,
    -2 * ny * nx, 1 - 2 * ny * ny, -2 * ny * nz, 2 * c * ny,
    -2 * nz * nx, -2 * nz * ny, 1 - 2 * nz * nz, 2 * c * nz,
    0, 0, 0, 1
  );
  geom.applyMatrix4(matrix);
  return new THREE.Mesh(geom, mesh.material);
}

// 12. arrayGeometry
export function arrayGeometry(params = {}) {
  console.log('arrayGeometry', params);
  const { mesh, matrices = [] } = params;
  const group = new THREE.Group();
  for (const matrix of matrices) {
    const instance = mesh.clone();
    instance.geometry = mesh.geometry.clone();
    instance.applyMatrix4(matrix instanceof THREE.Matrix4 ? matrix : new THREE.Matrix4().fromArray(matrix.flat()));
    group.add(instance);
  }
  return group;
}

// 13. repeatLinear3d - Repeat geometry in a line with incremental transforms
export function repeatLinear3d(params = {}) {
  console.log('repeatLinear3d', params);
  const {
    geometry,              // Geometry to repeat (required)
    count = 3,
    spacing = 1,
    axis = 'x',           // 'x', 'y', or 'z'
    centered = false,
    rotationPerStep = null,  // [rx, ry, rz] - rotation increment per instance
    scalePerStep = null,     // [sx, sy, sz] - scale increment per instance
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'linearRepeat'
  } = params;

  if (!geometry) {
    console.warn('repeatLinear3d: geometry parameter is required');
    return new THREE.Group();
  }

  const group = new THREE.Group();
  const axisVec = axis === 'y' ? new THREE.Vector3(0, 1, 0) :
    (axis === 'z' ? new THREE.Vector3(0, 0, 1) :
      new THREE.Vector3(1, 0, 0));
  const offset = centered ? -spacing * (count - 1) / 2 : 0;

  for (let i = 0; i < count; i++) {
    const mesh = geometry.clone();
    mesh.__index = i;

    // Position along axis
    mesh.position.addScaledVector(axisVec, offset + i * spacing);

    // Apply incremental rotation
    if (rotationPerStep) {
      const euler = new THREE.Euler(
        rotationPerStep[0] * i,
        rotationPerStep[1] * i,
        rotationPerStep[2] * i,
        'XYZ'
      );
      const quat = new THREE.Quaternion().setFromEuler(euler);
      mesh.quaternion.multiplyQuaternions(quat, mesh.quaternion);
    }

    // Apply incremental scale
    if (scalePerStep) {
      mesh.scale.set(
        mesh.scale.x + scalePerStep[0] * i,
        mesh.scale.y + scalePerStep[1] * i,
        mesh.scale.z + scalePerStep[2] * i
      );
    }

    group.add(mesh);
  }

  group.name = id;
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.scale.set(scale[0], scale[1], scale[2]);

  return group;
}


// 16. repeatAlongCurve3d - Repeat geometry along curve with incremental transforms
export function repeatAlongCurve3d(params = {}) {
  console.log('repeatAlongCurve3d', params);
  const {
    curve,                // THREE.Curve object (required)
    geometry,             // Geometry to repeat (required)
    count = 10,
    align = true,         // Align to curve tangent
    rotationPerStep = null,  // Additional rotation per instance
    scalePerStep = null,     // Scale change per instance
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'curveRepeat'
  } = params;

  if (!curve || !(curve instanceof THREE.Curve)) {
    console.warn('repeatAlongCurve3d: curve parameter must be a THREE.Curve');
    return new THREE.Group();
  }

  if (!geometry) {
    console.warn('repeatAlongCurve3d: geometry parameter is required');
    return new THREE.Group();
  }

  const group = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const pos = curve.getPoint(t);
    const mesh = geometry.clone();
    mesh.position.copy(pos);

    // Align to curve if requested
    if (align) {
      const tangent = curve.getTangent(t).normalize();
      const upVec = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
      const orthogonalUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      const rotMatrix = new THREE.Matrix4().makeBasis(tangent, orthogonalUp, normal);
      const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix, 'XYZ');
      mesh.rotation.copy(euler);
    }

    // Apply incremental rotation
    if (rotationPerStep) {
      mesh.rotation.set(
        mesh.rotation.x + rotationPerStep[0] * i,
        mesh.rotation.y + rotationPerStep[1] * i,
        mesh.rotation.z + rotationPerStep[2] * i
      );
    }

    // Apply incremental scale
    if (scalePerStep) {
      mesh.scale.set(
        mesh.scale.x + scalePerStep[0] * i,
        mesh.scale.y + scalePerStep[1] * i,
        mesh.scale.z + scalePerStep[2] * i
      );
    }

    group.add(mesh);
  }

  group.name = id;
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.scale.set(scale[0], scale[1], scale[2]);

  return group;
}



// 15. repeatRadial3d - Repeat geometry in a circle with incremental transforms
export function repeatRadial3d(params = {}) {
  console.log('repeatRadial3d', params);
  const {
    geometry,
    count = 8,
    radius = 5,
    startAngle = 0,
    endAngle = Math.PI * 2,
    axis = 'y',           // Rotation axis: 'x', 'y', or 'z'
    faceCenter = true,    // Automatically face toward/away from center
    rotationPerStep = null,  // Additional rotation per instance
    scalePerStep = null,     // Scale change per instance
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'radialRepeat'
  } = params;

  if (!geometry) {
    console.warn('repeatRadial3d: geometry parameter is required');
    return new THREE.Group();
  }

  const group = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = startAngle + (endAngle - startAngle) * t;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    const mesh = geometry.clone();

    // Position based on axis
    if (axis === 'y') {
      mesh.position.set(x, 0, z);
      if (faceCenter) mesh.rotation.y = angle + Math.PI / 2;
    } else if (axis === 'x') {
      mesh.position.set(0, x, z);
      if (faceCenter) mesh.rotation.x = angle + Math.PI / 2;
    } else if (axis === 'z') {
      mesh.position.set(x, z, 0);
      if (faceCenter) mesh.rotation.z = angle + Math.PI / 2;
    }

    // Apply incremental rotation
    if (rotationPerStep) {
      mesh.rotation.set(
        mesh.rotation.x + rotationPerStep[0] * i,
        mesh.rotation.y + rotationPerStep[1] * i,
        mesh.rotation.z + rotationPerStep[2] * i
      );
    }

    // Apply incremental scale
    if (scalePerStep) {
      mesh.scale.set(
        mesh.scale.x + scalePerStep[0] * i,
        mesh.scale.y + scalePerStep[1] * i,
        mesh.scale.z + scalePerStep[2] * i
      );
    }

    group.add(mesh);
  }

  group.name = id;
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.scale.set(scale[0], scale[1], scale[2]);

  return group;
}


// 16. distributeAlongPerimeter3d
export function distributeAlongPerimeter3d(params = {}) {
  console.log('distributeAlongPerimeter3d', params);
  const { geometry, path, count = 8, id = 'perimeterDistribute' } = params;
  const curve = new THREE.CatmullRomCurve3(path.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true);
  return repeatAlongCurve3d({ geometry, curve, count, align: true, id });
}

// 17. distributeOnSurface3d
export function distributeOnSurface3d(params = {}) {
  console.log('distributeOnSurface3d', params);
  const { geometry, surfaceFunc, density = 10, id = 'surfaceDistribute' } = params;
  const group = new THREE.Group();
  for (let i = 0; i < density; i++) {
    for (let j = 0; j < density; j++) {
      const u = i / (density - 1), v = j / (density - 1);
      const pos = surfaceFunc(u, v);
      const mesh = typeof geometry === 'function' ? geometry(u, v) : geometry.clone();
      mesh.position.copy(pos);
      group.add(mesh);
    }
  }
  group.name = id;
  return group;
}

// 18. distributeInVolume3d
export function distributeInVolume3d(params = {}) {
  console.log('distributeInVolume3d', params);
  const { geometry, bounds = [[0, 0, 0], [1, 1, 1]], density = 10, id = 'volumeDistribute' } = params;
  const [min, max] = bounds;
  const group = new THREE.Group();
  for (let i = 0; i < density; i++) {
    for (let j = 0; j < density; j++) {
      for (let k = 0; k < density; k++) {
        const x = min[0] + (max[0] - min[0]) * (i / (density - 1));
        const y = min[1] + (max[1] - min[1]) * (j / (density - 1));
        const z = min[2] + (max[2] - min[2]) * (k / (density - 1));
        const mesh = typeof geometry === 'function' ? geometry(x, y, z, i, j, k) : geometry.clone();
        mesh.position.set(x, y, z);
        group.add(mesh);
      }
    }
  }
  group.name = id;
  return group;
}

// 19. distributeOnGrid3d - Distribute geometry in a grid pattern
// ADD THIS AT THE START OF distributeOnGrid3d():
export function distributeOnGrid3d(params = {}) {
  console.log('distributeOnGrid3d', params);
  const {
    geometry,
    rows = 3,
    cols = 3,
    spacing = [2, 0, 2],
    centered = true,
    rotationPerStep = null,
    scalePerStep = null,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'gridDistribution'
  } = params;

  if (!geometry) {
    console.warn('distributeOnGrid3d: geometry parameter is required');
    return new THREE.Group();
  }

  const group = new THREE.Group();
  const [spacingX, spacingY, spacingZ] = Array.isArray(spacing) ? spacing : [spacing, 0, spacing];
  const offsetX = centered ? -spacingX * (cols - 1) / 2 : 0;
  const offsetZ = centered ? -spacingZ * (rows - 1) / 2 : 0;
  let instanceIndex = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mesh = geometry.clone();
      mesh.position.set(
        offsetX + col * spacingX,
        row * spacingY,
        offsetZ + row * spacingZ
      );

      // Apply incremental rotation
      if (rotationPerStep) {
        const rotStep = typeof rotationPerStep === 'function'
          ? rotationPerStep(row, col)
          : rotationPerStep;
        if (rotStep) {
          mesh.rotation.set(
            mesh.rotation.x + rotStep * instanceIndex,
            mesh.rotation.y + rotStep * instanceIndex,
            mesh.rotation.z + rotStep * instanceIndex
          );
        }
      }

      // Apply incremental scale
      if (scalePerStep) {
        const scaleStep = typeof scalePerStep === 'function'
          ? scalePerStep(row, col)
          : scalePerStep;
        if (scaleStep) {
          mesh.scale.set(
            mesh.scale.x + scaleStep * instanceIndex,
            mesh.scale.y + scaleStep * instanceIndex,
            mesh.scale.z + scaleStep * instanceIndex
          );
        }
      }

      group.add(mesh);
      instanceIndex++;
    }
  }

  group.name = id;
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.scale.set(scale[0], scale[1], scale[2]);
  return group;
}



// 20. distributeRandom3d
export function distributeRandom3d(params = {}) {
  console.log('distributeRandom3d', params);
  const { geometry, bounds = [[0, 0, 0], [1, 1, 1]], count = 50, seed = 42, id = 'randomDistribute' } = params;
  const random = (() => {
    let a = seed;
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  })();
  const [min, max] = bounds;
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const x = min[0] + (max[0] - min[0]) * random();
    const y = min[1] + (max[1] - min[1]) * random();
    const z = min[2] + (max[2] - min[2]) * random();
    const mesh = typeof geometry === 'function' ? geometry(i) : geometry.clone();
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  group.name = id;
  return group;
}

// 21. sweepGeometry
export function sweepGeometry(params = {}) {
  console.log('sweepGeometry', params);
  const {
    profilePoints,
    path,
    rotation = 0,
    scale = 1,
    material = null,
    position = [0, 0, 0],  // ✅ ADD
    id = 'sweep'
  } = params;

  const shape = new THREE.Shape(
    profilePoints.map(pt => new THREE.Vector2(pt.x, pt.y))
  );
  const geometry = new THREE.ExtrudeGeometry(shape, {
    steps: 100,
    extrudePath: path,
    bevelEnabled: false
  });
  geometry.scale(scale, scale, scale);
  geometry.rotateZ(rotation);

  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;

  // ✅ APPLY position
  mesh.position.set(position[0], position[1], position[2]);

  return mesh;
}


// 22. createPipe
export function createPipe(params = {}) {
  console.log('createPipe', params);
  const {
    path,
    radius = 1,
    tubularSegments = 64,
    radialSegments = 8,
    closed = false,
    material = null,
    position = [0, 0, 0],  // ✅ ADD
    rotation = [0, 0, 0],  // ✅ ADD
    id = 'pipe'
  } = params;

  const geometry = new THREE.TubeGeometry(
    path,
    tubularSegments,
    radius,
    radialSegments,
    closed
  );
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;

  // ✅ APPLY transforms
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);

  return mesh;
}


// 23. createArcPath
export function createArcPath(params = {}) {
  console.log('createArcPath', params);
  const { center = [0, 0, 0], radius = 1, angles = [0, Math.PI], normal = [0, 1, 0], segments = 32, id = 'arcPath' } = params;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = angles[0] + (angles[1] - angles[0]) * i / segments;
    const x = center[0] + radius * Math.cos(theta);
    const y = center[1] + radius * Math.sin(theta);
    points.push(new THREE.Vector3(x, y, center[2]));
  }
  return new THREE.CatmullRomCurve3(points, false);
}

// 24. createSplinePath
export function createSplinePath(params = {}) {
  console.log('createSplinePath', params);
  const { controlPoints, segments = 64, id = 'splinePath' } = params;
  const points = controlPoints.map(pt => Array.isArray(pt) ? new THREE.Vector3(...pt) : pt);
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
}

// 25. createHelixPath
export function createHelixPath(params = {}) {
  console.log('createHelixPath', params);
  const { radius = 1, height = 3, turns = 3, segments = 128, id = 'helixPath' } = params;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = 2 * Math.PI * turns * t;
    const x = radius * Math.cos(theta);
    const y = height * t;
    const z = radius * Math.sin(theta);
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(points, false);
}

// 26. createGridPath
export function createGridPath(params = {}) {
  console.log('createGridPath', params);
  const { bounds = [[0, 0, 0], [1, 1, 1]], rows = 4, cols = 4, id = 'gridPath' } = params;
  const [min, max] = bounds;
  const dx = (max[0] - min[0]) / (cols - 1);
  const dz = (max[2] - min[2]) / (rows - 1);
  const points = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const x = min[0] + dx * j;
      const z = min[2] + dz * i;
      const y = min[1];
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  return new THREE.CatmullRomCurve3(points, false);
}

// 27. offsetCurve
export function offsetCurve(params = {}) {
  console.log('offsetCurve', params);
  const { path, distance = 1, steps = 100, id = 'curveOffset' } = params;
  const points = path.getPoints(steps);
  const offsetPoints = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let n;
    if (i === 0) n = new THREE.Vector3().subVectors(points[1], points[0]);
    else if (i === points.length - 1) n = new THREE.Vector3().subVectors(points[i], points[i - 1]);
    else n = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]);
    n = new THREE.Vector3(-n.y, n.x, 0).normalize();
    offsetPoints.push(new THREE.Vector3().addVectors(p, n.multiplyScalar(distance)));
  }
  return new THREE.CatmullRomCurve3(offsetPoints, false);
}

// 28. connectPaths
export function connectPaths(params = {}) {
  console.log('connectPaths', params);
  const { pathA, pathB, blendRadius = 0.2, steps = 20, id = 'pathConnection' } = params;
  const aEnd = pathA.getPoint(1);
  const bStart = pathB.getPoint(0);
  const ctrl1 = aEnd.clone().lerp(bStart, blendRadius);
  const ctrl2 = bStart.clone().lerp(aEnd, blendRadius);
  return new THREE.CatmullRomCurve3([aEnd, ctrl1, ctrl2, bStart], false);
}

// 29. loftBetweenCurves
export function loftBetweenCurves(params = {}) {
  console.log('loftBetweenCurves', params);
  const { curveA, curveB, segments = 20, material = null, id = 'loftBetweenCurves' } = params;
  const aPoints = curveA.getPoints(segments);
  const bPoints = curveB.getPoints(segments);
  if (aPoints.length !== bPoints.length) {
    console.warn('loftBetweenCurves: curves must have same point count');
    return new THREE.Group();
  }
  const vertices = [];
  for (let i = 0; i < aPoints.length; i++) {
    vertices.push(aPoints[i].x, aPoints[i].y, aPoints[i].z);
    vertices.push(bPoints[i].x, bPoints[i].y, bPoints[i].z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const mat = material ?? new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;
  return mesh;
}

// 30. tessellateSurface
export function tessellateSurface(params = {}) {
  console.log('tessellateSurface', params);
  const { mesh, subdivisions = 2, id = 'tessellate' } = params;
  // Needs SubdivisionModifier from three/examples/jsm/modifiers/
  if (!THREE.SubdivisionModifier) {
    throw new Error('tessellateSurface: THREE.SubdivisionModifier not found');
  }
  const modifier = new THREE.SubdivisionModifier(subdivisions);
  const smoothed = mesh.clone();
  smoothed.geometry = mesh.geometry.clone();
  smoothed.geometry = modifier.modify(smoothed.geometry);
  smoothed.name = id;
  return smoothed;
}

// 31. thickenSurface
export function thickenSurface(params = {}) {
  console.log('thickenSurface', params);
  const { mesh, thickness = 0.2, direction = [0, 1, 0], id = 'thicken' } = params;
  const geom = mesh.geometry.clone();
  const normalVec = new THREE.Vector3(...direction).normalize().multiplyScalar(thickness);
  const geom2 = geom.clone();
  geom2.translate(normalVec.x, normalVec.y, normalVec.z);
  const merged = BufferGeometryUtils.mergeBufferGeometries([geom, geom2], false);
  const thickened = new THREE.Mesh(merged, mesh.material);
  thickened.name = id;
  return thickened;
}

// 32. normalOnSurface
export function normalOnSurface(params = {}) {
  console.log('normalOnSurface', params);
  const { mesh, u, v, id = 'normalOnSurface' } = params;
  const uvAttr = mesh.geometry.attributes.uv;
  let bestIdx = 0, bestDist = 1e9;
  for (let i = 0; i < uvAttr.count; i++) {
    const uv = [uvAttr.getX(i), uvAttr.getY(i)];
    const d = Math.hypot(uv[0] - u, uv[1] - v);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  const normAttr = mesh.geometry.attributes.normal;
  return new THREE.Vector3(normAttr.getX(bestIdx), normAttr.getY(bestIdx), normAttr.getZ(bestIdx));
}

// 33. uvOnSurface
export function uvOnSurface(params = {}) {
  console.log('uvOnSurface', params);
  const { mesh, u, v, id = 'uvOnSurface' } = params;
  const uvAttr = mesh.geometry.attributes.uv;
  let bestIdx = 0, bestDist = 1e9;
  for (let i = 0; i < uvAttr.count; i++) {
    const uvi = [uvAttr.getX(i), uvAttr.getY(i)];
    const d = Math.hypot(uvi[0] - u, uvi[1] - v);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  const posAttr = mesh.geometry.attributes.position;
  return new THREE.Vector3(posAttr.getX(bestIdx), posAttr.getY(bestIdx), posAttr.getZ(bestIdx));
}

// 34. projectOnSurface
export function projectOnSurface(params = {}) {
  console.log('projectOnSurface', params);
  const { geometry, surfaceMesh, direction = [0, -1, 0], id = 'projectOnSurface' } = params;
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3(...direction).normalize();
  const projectedVerts = [];
  const posAttr = geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const origin = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    ray.set(origin, dir);
    const intersects = ray.intersectObject(surfaceMesh);
    projectedVerts.push(intersects.length ? intersects[0].point.clone() : origin.clone());
  }
  const projGeom = new THREE.BufferGeometry().setFromPoints(projectedVerts);
  const mesh = new THREE.Mesh(projGeom, surfaceMesh.material);
  mesh.name = id;
  return mesh;
}

// 35. deformByNoise
export function deformByNoise(params = {}) {
  console.log('deformByNoise', params);
  const { mesh, amount = 0.2, frequency = 1.0, axis = [0, 1, 0], id = 'deformByNoise' } = params;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  const axisV = new THREE.Vector3(...axis).normalize();
  for (let i = 0; i < pos.count; i++) {
    const vert = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const val = noise.noise(vert.x * frequency, vert.y * frequency, vert.z * frequency);
    vert.add(axisV.clone().multiplyScalar(val * amount));
    pos.setXYZ(i, vert.x, vert.y, vert.z);
  }
  geom.computeVertexNormals();
  const newMesh = new THREE.Mesh(geom, mesh.material);
  newMesh.name = id;
  return newMesh;
}

// 36. deformByVectorField
export function deformByVectorField(params = {}) {
  console.log('deformByVectorField', params);
  const { mesh, vectorField, strength = 1.0, id = 'deformByVectorField' } = params;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vert = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const fieldVec = vectorField(vert.x, vert.y, vert.z);
    vert.add(fieldVec.multiplyScalar(strength));
    pos.setXYZ(i, vert.x, vert.y, vert.z);
  }
  geom.computeVertexNormals();
  const newMesh = new THREE.Mesh(geom, mesh.material);
  newMesh.name = id;
  return newMesh;
}

// 37. deformByAttractor
export function deformByAttractor(params = {}) {
  console.log('deformByAttractor', params);
  const { mesh, points, falloff = 2.0, strength = 0.2, id = 'deformByAttractor' } = params;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vert = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    for (const pt of points) {
      const p = Array.isArray(pt) ? new THREE.Vector3(...pt) : pt;
      const d = vert.distanceTo(p);
      if (d < 1e-6) continue;
      const force = (1 / Math.pow(d, falloff)) * strength;
      vert.add(p.clone().sub(vert).normalize().multiplyScalar(force));
    }
    pos.setXYZ(i, vert.x, vert.y, vert.z);
  }
  geom.computeVertexNormals();
  const newMesh = new THREE.Mesh(geom, mesh.material);
  newMesh.name = id;
  return newMesh;
}

// 38. morphBetween
export function morphBetween(params = {}) {
  console.log('morphBetween', params);
  const { geometryA, geometryB, t = 0.5, id = 'morphBetween' } = params;
  const aPos = geometryA.attributes.position, bPos = geometryB.attributes.position;
  if (aPos.count !== bPos.count) throw new Error('morphBetween: vertex count mismatch');
  const vertices = [];
  for (let i = 0; i < aPos.count; i++) {
    const ax = aPos.getX(i), ay = aPos.getY(i), az = aPos.getZ(i);
    const bx = bPos.getX(i), by = bPos.getY(i), bz = bPos.getZ(i);
    vertices.push(ax * (1 - t) + bx * t, ay * (1 - t) + by * t, az * (1 - t) + bz * t);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  geom.name = id;
  return geom;
}

// 39. bendAlongCurve
export function bendAlongCurve(params = {}) {
  console.log('bendAlongCurve', params);
  const { mesh, curve, axis = 'x', id = 'bendAlongCurve' } = params;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    let t = axis === 'x' ? (v.x + 0.5) / 1.0 : axis === 'z' ? (v.z + 0.5) / 1.0 : (v.y + 0.5) / 1.0;
    t = Math.max(0, Math.min(1, t));
    v = curve.getPoint(t);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  const meshOut = new THREE.Mesh(geom, mesh.material);
  meshOut.name = id;
  return meshOut;
}

// 40. radialDeform
export function radialDeform(params = {}) {
  console.log('radialDeform', params);
  const { mesh, center = [0, 0, 0], strength = 0.3, radius = 5.0, id = 'radialDeform' } = params;
  const geom = mesh.geometry.clone();
  const pos = geom.attributes.position;
  const centerV = new THREE.Vector3(...center);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const dist = v.distanceTo(centerV);
    const f = Math.exp(-((dist / radius) ** 2)) * strength;
    v.add(v.clone().sub(centerV).normalize().multiplyScalar(f));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  const meshOut = new THREE.Mesh(geom, mesh.material);
  meshOut.name = id;
  return meshOut;
}

// 41. createVectorField
export function createVectorField(params = {}) {
  console.log('createVectorField', params);
  const { bounds, fn, density = 10, id = 'vectorField' } = params;
  const [min, max] = bounds;
  const vectors = [];
  for (let i = 0; i < density; i++)
    for (let j = 0; j < density; j++)
      for (let k = 0; k < density; k++) {
        const x = min[0] + (max[0] - min[0]) * (i / (density - 1));
        const y = min[1] + (max[1] - min[1]) * (j / (density - 1));
        const z = min[2] + (max[2] - min[2]) * (k / (density - 1));
        const fieldValue = fn(x, y, z);
        vectors.push({ position: new THREE.Vector3(x, y, z), vector: fieldValue });
      }
  return vectors;
}

// 42. attractorField
export function attractorField(params = {}) {
  console.log('attractorField', params);
  const { points, strength = 1, falloff = 2, id = 'attractorField' } = params;
  return (x, y, z) => {
    let v = new THREE.Vector3(0, 0, 0);
    for (const pt of points) {
      const p = Array.isArray(pt) ? new THREE.Vector3(...pt) : pt;
      const dist = Math.max(0.01, p.distanceTo(new THREE.Vector3(x, y, z)));
      v.add(p.clone().sub(new THREE.Vector3(x, y, z)).multiplyScalar(strength / (dist ** falloff)));
    }
    return v;
  };
}

// 43. repellerField
export function repellerField(params = {}) {
  console.log('repellerField', params);
  const { points, strength = 1, falloff = 2, id = 'repellerField' } = params;
  return (x, y, z) => {
    let v = new THREE.Vector3(0, 0, 0);
    for (const pt of points) {
      const p = Array.isArray(pt) ? new THREE.Vector3(...pt) : pt;
      const dist = Math.max(0.01, p.distanceTo(new THREE.Vector3(x, y, z)));
      v.add(new THREE.Vector3(x, y, z).sub(p).multiplyScalar(strength / (dist ** falloff)));
    }
    return v;
  };
}

// 44. flowField
export function flowField(params = {}) {
  console.log('flowField', params);
  const { seed = 42, turbulence = 1.0, octaves = 3, id = 'flowField' } = params;
  noise.seed(seed);
  return (x, y, z) => {
    const fx = noise.noise(x * turbulence, y * turbulence, z * turbulence, octaves);
    const fy = noise.noise(y * turbulence, z * turbulence, x * turbulence, octaves);
    const fz = noise.noise(z * turbulence, x * turbulence, y * turbulence, octaves);
    return new THREE.Vector3(fx, fy, fz);
  };
}

// 45. combineFields
export function combineFields(params = {}) {
  console.log('combineFields', params);
  const { fields, weights, id = 'combineFields' } = params;
  return (x, y, z) => {
    let v = new THREE.Vector3(0, 0, 0);
    fields.forEach((fn, i) => v.add(fn(x, y, z).multiplyScalar(weights[i])));
    return v;
  };
}

// 46. unionGeometries
export function unionGeometries(params = {}) {
  console.log('unionGeometries', params);
  const { meshes, id = 'union' } = params;
  let result = meshes[0];
  for (let i = 1; i < meshes.length; i++) {
    result = CSG.union(result, meshes[i]);
  }
  result.name = id;
  return result;
}

// 47. subtractGeometries
export function subtractGeometries(params = {}) {
  console.log('subtractGeometries', params);
  const { base, subtract, id = 'subtract' } = params;
  const result = CSG.subtract(base, subtract);
  result.name = id;
  return result;
}

// 48. intersectGeometries
export function intersectGeometries(params = {}) {
  console.log('intersectGeometries', params);
  const { geometries, id = 'intersect' } = params;
  let result = geometries[0];
  for (let i = 1; i < geometries.length; i++) {
    result = CSG.intersect(result, geometries[i]);
  }
  result.name = id;
  return result;
}

// 49. splitGeometryByPlane
export function splitGeometryByPlane(params = {}) {
  console.log('splitGeometryByPlane', params);
  const { mesh, plane = [0, 1, 0, 0], id = 'split' } = params;
  throw new Error('splitGeometryByPlane: requires mesh splitting library');
}

// 50. voronoiDivision
export function voronoiDivision(params = {}) {
  console.log('voronoiDivision', params);
  const { bounds, sites, depth = 2, id = 'voronoiDivision' } = params;
  const diagram = new Voronoi(sites, bounds);
  return diagram.getMeshes(depth);
}

// 51. delaunayTriangulation
export function delaunayTriangulation(params = {}) {
  console.log('delaunayTriangulation', params);
  throw new Error('delaunayTriangulation: requires triangulation implementation');
}

// 52. subdivisionSurface
export function subdivisionSurface(params = {}) {
  console.log('subdivisionSurface', params);
  const { mesh, iterations = 2, type = "CatmullClark", id = 'subdivisionSurface' } = params;
  const modifier = new SubdivisionModifier(iterations);
  const smoothed = mesh.clone();
  smoothed.geometry = mesh.geometry.clone();
  smoothed.geometry = modifier.modify(smoothed.geometry);
  smoothed.name = id;
  return smoothed;
}

// 53. lSystemGeometry
export function lSystemGeometry(params = {}) {
  console.log('lSystemGeometry', params);
  throw new Error('lSystemGeometry: implement L-system interpreter');
}

// 54. noisefield
export function noisefield(params = {}) {
  console.log('noisefield', params);
  const { bounds, frequency = 1, octaves = 3, id = 'noisefield' } = params;
  noise.seed(Math.random());
  return (x, y, z) => noise.noise(x * frequency, y * frequency, z * frequency, octaves);
}

// 55. convexHullGeometry
export function convexHullGeometry(params = {}) {
  console.log('convexHullGeometry', params);
  const {
    points,
    material = null,
    position = [0, 0, 0],  // ✅ ADD
    rotation = [0, 0, 0],  // ✅ ADD
    id = 'convexHull'
  } = params;

  const geom = new ConvexGeometry(points);
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = id;

  // ✅ APPLY transforms
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);

  return mesh;
}


// 56. skeletonizeGeometry
export function skeletonizeGeometry(params = {}) {
  console.log('skeletonizeGeometry', params);
  throw new Error('skeletonizeGeometry: needs medial axis transform implementation');
}

// 57. packingAlgorithm
export function packingAlgorithm(params = {}) {
  console.log('packingAlgorithm', params);
  throw new Error('packingAlgorithm: needs packing solver');
}

// 58. cellularAutomata
export function cellularAutomata(params = {}) {
  console.log('cellularAutomata', params);

  const {
    rules,
    iterations = 32,
    gridSize = 32,
    cellSize = 1,
    seed
  } = params;

  const defaultRules = {
    survive: [2, 3],
    born: [3]
  };

  const ruleSet = rules || defaultRules;
  let grid = [];
  for (let x = 0; x < gridSize; x++) {
    let col = [];
    for (let y = 0; y < gridSize; y++) {
      col.push(seed ? seed[x]?.[y] ?? 0 : (Math.random() > 0.8 ? 1 : 0));
    }
    grid.push(col);
  }

  function neighborCount(x, y) {
    let n = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (dx !== 0 || dy !== 0) {
          const xx = (x + dx + gridSize) % gridSize;
          const yy = (y + dy + gridSize) % gridSize;
          n += grid[xx][yy];
        }
    return n;
  }

  for (let iter = 0; iter < iterations; iter++) {
    let next = [];
    for (let x = 0; x < gridSize; x++) {
      next[x] = [];
      for (let y = 0; y < gridSize; y++) {
        const count = neighborCount(x, y);
        if (grid[x][y] === 1) {
          next[x][y] = ruleSet.survive.includes(count) ? 1 : 0;
        } else {
          next[x][y] = ruleSet.born.includes(count) ? 1 : 0;
        }
      }
    }
    grid = next;
  }

  const group = new THREE.Group();
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (grid[x][y]) {
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(cellSize, cellSize, cellSize),
          new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        cube.position.set(x * cellSize, 0, y * cellSize);
        group.add(cube);
      }
    }
  }
  return group;
}


// 59. differentialGrowth
export function differentialGrowth(params = {}) {
  console.log('differentialGrowth', params);
  const { seed = [], iterations = 100, attract = 0.005, repel = 1.0, minDist = 0.2, maxDist = 0.6 } = params;
  let points = seed.map(pt => Array.isArray(pt) ? new THREE.Vector3(...pt) : pt.clone());

  for (let iter = 0; iter < iterations; iter++) {
    // Edge subdivision
    let newPoints = [];
    for (let i = 0; i < points.length; i++) {
      newPoints.push(points[i]);
      const next = points[(i + 1) % points.length];
      const d = points[i].distanceTo(next);
      if (d > maxDist) {
        newPoints.push(points[i].clone().lerp(next, 0.5));
      }
    }

    // Differential forces
    let updated = [];
    for (let i = 0; i < newPoints.length; i++) {
      const prev = newPoints[(i - 1 + newPoints.length) % newPoints.length];
      const next = newPoints[(i + 1) % newPoints.length];
      const p = newPoints[i].clone();

      // Edge attraction
      const edgeForce = prev.clone().add(next).multiplyScalar(0.5).sub(p).multiplyScalar(attract);
      p.add(edgeForce);

      // Repulsion
      for (let j = 0; j < newPoints.length; j++) {
        if (j === i) continue;
        const dist = p.distanceTo(newPoints[j]);
        if (dist < minDist && dist > 1e-6) {
          const repulse = p.clone().sub(newPoints[j]).normalize().multiplyScalar(repel * (minDist - dist));
          p.add(repulse);
        }
      }
      updated.push(p);
    }
    points = updated;
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0xff00ff });
  const line = new THREE.Line(geometry, mat);
  return line;
}


// 60. reactionDiffusion
export function reactionDiffusion(params = {}) {
  console.log('reactionDiffusion', params);
  // See previous message for implementation
  throw new Error('reactionDiffusion: provide implementation as above');
}

// 61. meshFromParametric
export function meshFromParametric(params = {}) {
  console.log('meshFromParametric', params);
  const { fn, uSeg = 10, vSeg = 10, material = null, id = 'meshFromParametric' } = params;
  const positions = [];
  for (let i = 0; i <= uSeg; i++) {
    for (let j = 0; j <= vSeg; j++) {
      const u = i / uSeg, v = j / vSeg;
      const xyz = fn(u, v);
      positions.push(...xyz);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = id;
  return mesh;
}

// 62. meshFromVoxelGrid
export function meshFromVoxelGrid(params = {}) {
  console.log('meshFromVoxelGrid', params);
  const { grid, voxelSize = 1, material = null, id = 'meshFromVoxelGrid' } = params;
  const group = new THREE.Group();
  for (let x = 0; x < grid.length; x++)
    for (let y = 0; y < grid[0].length; y++)
      for (let z = 0; z < grid[0][0].length; z++)
        if (grid[x][y][z]) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize),
            material ?? new THREE.MeshStandardMaterial({ color: 0xffffff })
          );
          mesh.position.set(x * voxelSize, y * voxelSize, z * voxelSize);
          group.add(mesh);
        }
  group.name = id;
  return group;
}

// 63. meshFromMarchingCubes
export function meshFromMarchingCubes(params = {}) {
  console.log('meshFromMarchingCubes', params);
  throw new Error('meshFromMarchingCubes: Needs marching cubes polyfill');
}

// 64. randomPointsInMesh
export function randomPointsInMesh(params = {}) {
  console.log('randomPointsInMesh', params);
  throw new Error('randomPointsInMesh: Needs mesh sampling algorithm');
}

// 65. pointSetCentroid
export function pointSetCentroid(params = {}) {
  console.log('pointSetCentroid', params);
  const { points, id = 'pointSetCentroid' } = params;
  const sum = new THREE.Vector3();
  points.forEach(pt => sum.add(Array.isArray(pt) ? new THREE.Vector3(...pt) : pt));
  return sum.multiplyScalar(1 / points.length);
}

// 66. pointSetBoundingBox
export function pointSetBoundingBox(params = {}) {
  console.log('pointSetBoundingBox', params);
  const { points, id = 'pointSetBoundingBox' } = params;
  const bbox = new THREE.Box3();
  points.forEach(pt => bbox.expandByPoint(Array.isArray(pt) ? new THREE.Vector3(...pt) : pt));
  return bbox;
}

// 67. closestPointOnCurve
export function closestPointOnCurve(params = {}) {
  console.log('closestPointOnCurve', params);
  const { curve, point, id = 'closestPointOnCurve' } = params;
  const samples = curve.getPoints(100);
  let minDist = Infinity, closest = null;
  const pt = Array.isArray(point) ? new THREE.Vector3(...point) : point;
  samples.forEach(s => {
    const d = s.distanceTo(pt); if (d < minDist) { minDist = d; closest = s; }
  });
  return closest;
}

// 68. signedDistanceToMesh
export function signedDistanceToMesh(params = {}) {
  console.log('signedDistanceToMesh', params);
  throw new Error('signedDistanceToMesh: Needs distance computation.');
}

// 69. createArrow
export function createArrow(params = {}) {
  console.log('createArrow', params);
  const { from, to = null, length = 1, color = 0xff0000, headSize = 0.2, id = 'arrow' } = params;
  const group = new THREE.Group();
  const origin = Array.isArray(from) ? new THREE.Vector3(...from) : from;
  const vec = to ? (Array.isArray(to) ? new THREE.Vector3(...to) : to).clone().sub(origin) : new THREE.Vector3(0, length, 0);
  const arrowDir = vec.clone().normalize();
  const shaftLen = vec.length() - headSize;
  const shaftGeom = new THREE.CylinderGeometry(0.05, 0.05, shaftLen, 12);
  const shaft = new THREE.Mesh(shaftGeom, new THREE.MeshStandardMaterial({ color }));
  shaft.position.copy(origin).add(arrowDir.clone().multiplyScalar(shaftLen / 2));
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDir);
  group.add(shaft);
  const headGeom = new THREE.ConeGeometry(headSize, headSize * 2, 12);
  const head = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial({ color }));
  head.position.copy(origin).add(arrowDir.clone().multiplyScalar(shaftLen + headSize / 2));
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDir);
  group.add(head);
  group.name = id;
  return group;
}

// 70. labeledPoint
export function labeledPoint(params = {}) {
  console.log('labeledPoint', params);
  const { position, label = "", radius = 0.15, color = 0x00ff00, id = 'labeledPoint' } = params;
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 12),
    new THREE.MeshStandardMaterial({ color })
  );
  sphere.position.copy(Array.isArray(position) ? new THREE.Vector3(...position) : position);
  group.add(sphere);
  // Place for label (SpriteText or text geometry needed)
  group.name = id;
  return group;
}

// 71. optimizeTopology
export function optimizeTopology(params = {}) {
  console.log('optimizeTopology', params);
  throw new Error('optimizeTopology: Connect to mesh/FEA topology optimizer.');
}

// 72. calculateAcoustics
export function calculateAcoustics(params = {}) {
  console.log('calculateAcoustics', params);
  throw new Error('calculateAcoustics: Needs sound simulation backend.');
}

// 73. deepCloneNode
export function deepCloneNode(params = {}) {
  console.log('deepCloneNode', params);
  const { node, suffix = "" } = params;
  if (node instanceof THREE.Mesh) {
    const geom = node.geometry.clone();
    const mat = node.material.clone();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = node.name + suffix;
    mesh.position.copy(node.position);
    mesh.rotation.copy(node.rotation);
    mesh.scale.copy(node.scale);
    return mesh;
  } else if (node instanceof THREE.Group) {
    const group = new THREE.Group();
    group.name = node.name + suffix;
    node.children.forEach(child => group.add(deepCloneNode({ node: child, suffix })));
    return group;
  } else if (node instanceof THREE.BufferGeometry) {
    return node.clone();
  }
  throw new Error('deepCloneNode: Unsupported type');
}

// 74. samplePointOnPath
export function samplePointOnPath(params = {}) {
  console.log('samplePointOnPath', params);
  const { curve, t = 0.5 } = params;
  return curve.getPoint(t);
}

// 75. tangentOnPath
export function tangentOnPath(params = {}) {
  console.log('tangentOnPath', params);
  const { curve, t = 0.5 } = params;
  return curve.getTangent(t).normalize();
}

// 76. boundingBox
export function boundingBox(params = {}) {
  console.log('boundingBox', params);
  const { obj } = params;
  let bbox = new THREE.Box3();
  if (obj instanceof THREE.Mesh || obj instanceof THREE.BufferGeometry) {
    const geom = obj instanceof THREE.Mesh ? obj.geometry : obj;
    geom.computeBoundingBox();
    bbox.copy(geom.boundingBox);
  } else if (obj instanceof THREE.Group) {
    obj.updateMatrixWorld();
    bbox.setFromObject(obj);
  }
  return bbox;
}

// 77. calculateFootprintCentroid
export function calculateFootprintCentroid(params = {}) {
  console.log('calculateFootprintCentroid', params);
  return pointSetCentroid(params); // See helper 65
}

// 78. closestPointOnMesh
export function closestPointOnMesh(params = {}) {
  console.log('closestPointOnMesh', params);
  const { point, mesh } = params;
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  let minDist = Infinity, closest = null;
  const target = Array.isArray(point) ? new THREE.Vector3(...point) : point;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const d = v.distanceTo(target);
    if (d < minDist) { minDist = d; closest = v.clone(); }
  }
  return closest;
}

// 79. intersectRayMesh
export function intersectRayMesh(params = {}) {
  console.log('intersectRayMesh', params);
  const { origin, direction, mesh } = params;
  const raycaster = new THREE.Raycaster();
  raycaster.set(Array.isArray(origin) ? new THREE.Vector3(...origin) : origin,
    Array.isArray(direction) ? new THREE.Vector3(...direction) : direction.normalize());
  const hits = raycaster.intersectObject(mesh, true);
  return hits.length ? hits[0].point : null;
}

// 80. measureDistance
export function measureDistance(params = {}) {
  console.log('measureDistance', params);
  const { pointA, pointB } = params;
  const va = Array.isArray(pointA) ? new THREE.Vector3(...pointA) : pointA;
  const vb = Array.isArray(pointB) ? new THREE.Vector3(...pointB) : pointB;
  return va.distanceTo(vb);
}

// 81. measureArea
export function measureArea(params = {}) {
  console.log('measureArea', params);
  const { mesh } = params;
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const index = geom.index;
  let area = 0;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = new THREE.Vector3(pos.getX(index.getX(i)), pos.getY(index.getX(i)), pos.getZ(index.getX(i)));
      const b = new THREE.Vector3(pos.getX(index.getX(i + 1)), pos.getY(index.getX(i + 1)), pos.getZ(index.getX(i + 1)));
      const c = new THREE.Vector3(pos.getX(index.getX(i + 2)), pos.getY(index.getX(i + 2)), pos.getZ(index.getX(i + 2)));
      area += new THREE.Triangle(a, b, c).getArea();
    }
  }
  return area;
}

// 82. measureVolume
export function measureVolume(params = {}) {
  console.log('measureVolume', params);
  const { mesh } = params;
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const index = geom.index;
  let volume = 0;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = new THREE.Vector3(pos.getX(index.getX(i)), pos.getY(index.getX(i)), pos.getZ(index.getX(i)));
      const b = new THREE.Vector3(pos.getX(index.getX(i + 1)), pos.getY(index.getX(i + 1)), pos.getZ(index.getX(i + 1)));
      const c = new THREE.Vector3(pos.getX(index.getX(i + 2)), pos.getY(index.getX(i + 2)), pos.getZ(index.getX(i + 2)));
      volume += a.dot(b.cross(c)) / 6;
    }
  }
  return Math.abs(volume);
}

// 83. validateGeometry
export function validateGeometry(params = {}) {
  console.log('validateGeometry', params);
  const { mesh } = params;
  const geom = mesh instanceof THREE.Mesh ? mesh.geometry : mesh;
  try {
    geom.computeBoundingBox();
    geom.computeVertexNormals();
    return true;
  } catch (e) {
    return false;
  }
}

// 84. mergeGeometries
export function mergeGeometries(params = {}) {
  console.log('mergeGeometries', params);
  const { meshes, material = null, id = 'mergeGeometries' } = params;
  const geometries = meshes.map(m => m instanceof THREE.Mesh ? m.geometry : m);
  const merged = BufferGeometryUtils.mergeBufferGeometries(geometries, true);
  const mesh = new THREE.Mesh(merged, material ?? new THREE.MeshStandardMaterial());
  mesh.name = id;
  return mesh;
}

// 85. flockingBehavior
export function flockingBehavior(agents, params = {}, steps = 100) {
  console.log('flockingBehavior', params);
  const alignment = params.alignment ?? 1.0;
  const cohesion = params.cohesion ?? 0.8;
  const separation = params.separation ?? 1.5;
  const neighborRadius = params.neighborRadius ?? 5.0;
  const separationDist = params.separationDist ?? 1.0;
  const maxSpeed = params.maxSpeed ?? 0.2;
  const agentRadius = params.agentRadius ?? 0.2;

  // Deep copy agents
  let state = agents.map(a => ({
    position: a.position.clone(),
    velocity: a.velocity.clone()
  }));

  for (let step = 0; step < steps; step++) {
    // For each agent, compute boid forces
    let snapshots = state.map(agent => ({ ...agent, position: agent.position.clone() }));
    for (let i = 0; i < state.length; i++) {
      let agent = state[i];
      let align = new THREE.Vector3();
      let cohere = new THREE.Vector3();
      let separate = new THREE.Vector3();
      let neighbors = 0;
      for (let j = 0; j < state.length; j++) {
        if (i === j) continue;
        let other = state[j];
        let dist = agent.position.distanceTo(other.position);
        if (dist < neighborRadius) {
          neighbors++;
          align.add(other.velocity);
          cohere.add(other.position);
          if (dist < separationDist) {
            separate.sub(other.position.clone().sub(agent.position));
          }
        }
      }
      if (neighbors > 0) {
        align.multiplyScalar(1 / neighbors).sub(agent.velocity).multiplyScalar(alignment);
        cohere.multiplyScalar(1 / neighbors).sub(agent.position).multiplyScalar(cohesion);
        separate.multiplyScalar(separation);
        agent.velocity.add(align).add(cohere).add(separate);
      }
      // Limit speed
      if (agent.velocity.length() > maxSpeed) agent.velocity.setLength(maxSpeed);
    }
    // Update positions
    state.forEach(agent => agent.position.add(agent.velocity));
  }

  // Visualize final positions
  const group = new THREE.Group();
  state.forEach(agent => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(agentRadius, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x2090ff })
    );
    mesh.position.copy(agent.position);
    group.add(mesh);
  });
  return group;
}

// 86. antColonyOptimization
export function antColonyOptimization(params = {}) {
  console.log('antColonyOptimization', params);
  const {
    start, end, obstacles = [],
    steps = 100,
    ants = 32,
    moveRadius = 1,
    trailColor = 0xffff00
  } = params;

  // Obstacles: array of bounding box objects {min: Vector3, max: Vector3}
  const isBlocked = (pos) =>
    obstacles.some(ob =>
      pos.x >= ob.min.x && pos.x <= ob.max.x &&
      pos.y >= ob.min.y && pos.y <= ob.max.y &&
      pos.z >= ob.min.z && pos.z <= ob.max.z
    );

  const group = new THREE.Group();
  for (let k = 0; k < ants; k++) {
    let pos = start.clone();
    let path = [pos.clone()];
    for (let s = 0; s < steps; s++) {
      let dir = end.clone().sub(pos).normalize();
      dir.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      )).normalize();
      let nextPos = pos.clone().add(dir.multiplyScalar(moveRadius));
      if (isBlocked(nextPos)) break;
      path.push(nextPos.clone());
      pos.copy(nextPos);
      if (pos.distanceTo(end) < moveRadius) break;
    }
    // Visualize path
    const geometry = new THREE.BufferGeometry().setFromPoints(path);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: trailColor, opacity: 0.7, transparent: true }));
    group.add(line);
  }
  return group;
}

//87. articleSwarmOptimization
export function particleSwarmOptimization(params = {}) {
  console.log('particleSwarmOptimization', params);
  const {
    objective, bounds, inertia = 0.7, cognitive = 1.4, social = 1.4,
    particles = 32, steps = 100, id = 'particleSwarmOptimization'
  } = params;

  let swarm = [];
  let globalBest = null;
  for (let i = 0; i < particles; i++) {
    let pos = new THREE.Vector2(
      Math.random() * (bounds[1][0] - bounds[0][0]) + bounds[0][0],
      Math.random() * (bounds[1][1] - bounds[0][1]) + bounds[0][1]
    );
    let vel = new THREE.Vector2((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
    let evalVal = objective(pos.x, pos.y);
    let pBest = pos.clone(), pBestEval = evalVal;
    if (!globalBest || evalVal < globalBest.pBestEval) globalBest = { pos: pos.clone(), pBestEval: evalVal };

    swarm.push({ pos, vel, pBest, pBestEval });
  }

  for (let s = 0; s < steps; s++) {
    for (let p of swarm) {
      let evalVal = objective(p.pos.x, p.pos.y);
      if (evalVal < p.pBestEval) {
        p.pBest = p.pos.clone();
        p.pBestEval = evalVal;
        if (evalVal < globalBest.pBestEval) {
          globalBest = { pos: p.pos.clone(), pBestEval: evalVal };
        }
      }
      let rp = Math.random(), rg = Math.random();
      p.vel.multiplyScalar(inertia)
        .add(p.pBest.clone().sub(p.pos).multiplyScalar(cognitive * rp))
        .add(globalBest.pos.clone().sub(p.pos).multiplyScalar(social * rg));
      if (p.vel.length() > 1) p.vel.setLength(1);
      p.pos.add(p.vel);
      p.pos.x = Math.max(bounds[0][0], Math.min(bounds[1][0], p.pos.x));
      p.pos.y = Math.max(bounds[0][1], Math.min(bounds[1][1], p.pos.y));
    }
  }

  const group = new THREE.Group();
  for (const p of swarm) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffa500 })
    );
    sphere.position.set(p.pos.x, 0, p.pos.y);
    group.add(sphere);
  }
  const bestMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xff2222 })
  );
  bestMesh.position.set(globalBest.pos.x, 0, globalBest.pos.y);
  group.add(bestMesh);

  group.name = id;
  return group;
}

// 88. agentBasedGrowth
export function agentBasedGrowth(params = {}) {
  console.log('agentBasedGrowth', params);
  const { seed, rules, iterations = 100, id = 'agentBasedGrowth' } = params;
  let agents = seed.map(pt => Array.isArray(pt) ? new THREE.Vector3(...pt) : pt.clone());
  let allPoints = [...agents];
  let state = { allPoints: allPoints.slice(), iteration: 0 };

  for (let step = 0; step < iterations; step++) {
    let nextAgents = [];
    for (const agent of agents) {
      const newPoints = rules(agent, state); // returns array of Vector3
      newPoints.forEach(p => {
        allPoints.push(p);
        nextAgents.push(p);
      });
    }
    agents = nextAgents;
    state = { allPoints: allPoints.slice(), iteration: step + 1 };
    if (agents.length === 0) break;
  }

  const group = new THREE.Group();
  allPoints.forEach(pt => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x00ff99 })
    );
    sphere.position.copy(pt);
    group.add(sphere);
  });
  group.name = id;
  return group;
}

// 89. createArchModule - Compound helper for Roman-style arches
export function createArchModule(params = {}) {
  console.log('createArchModule', params);
  const {
    width = 6,
    pierHeight = 4,
    archHeight = 3,
    spandrelHeight = 1,
    depth = 3,
    wallThickness = 0.8,
    archSegments = 32,
    holeSupport = true,
    material = null,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'arch_module'
  } = params;

  const hw = width / 2;
  const margin = wallThickness;
  const totalHeight = pierHeight + archHeight + spandrelHeight;

  // Create outer profile
  const outer = [
    [-hw - margin, 0],
    [hw + margin, 0],
    [hw + margin, totalHeight],
    [-hw - margin, totalHeight],
    [-hw - margin, 0]
  ];

  // Create arch opening (semi-ellipse)
  const ellipseCenterY = pierHeight;
  const verticalRadius = archHeight;

  const archCurve = [];
  for (let i = 0; i <= archSegments; i++) {
    const angle = Math.PI - (i / archSegments) * Math.PI;
    const x = hw * Math.cos(angle);
    const y = ellipseCenterY + verticalRadius * Math.sin(angle);
    archCurve.push([x, y]);
  }

  // Close the hole
  const hole = [
    ...archCurve,
    [hw, 0],
    [-hw, 0],
    archCurve[0]
  ];

  // Create THREE.js shape
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));

  if (holeSupport) {
    const holePath = new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(holePath);
  }

  const extrudeSettings = {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: Math.max(4, Math.floor(archSegments / 2))
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // Apply material
  const mat = material && typeof material === 'object'
    ? material
    : new THREE.MeshStandardMaterial({
      color: 0xd4c5b9,
      roughness: 0.8,
      metalness: 0.0
    });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = id;

  // Apply transforms
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);

  return mesh;
}

// 90. group
export function group(params = {}) {
  console.log('group', params);
  const {
    children = [],
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'group'
  } = params;

  const grp = new THREE.Group();
  grp.name = id;

  for (const child of children) {
    if (child && child.isObject3D) {
      grp.add(child);
    }
  }

  grp.position.set(position[0], position[1], position[2]);
  grp.rotation.set(rotation[0], rotation[1], rotation[2]);
  grp.scale.set(scale[0], scale[1], scale[2]);

  return grp;
}

// 91. repeatWithFunction
export function repeatWithFunction(params = {}) {
  console.log('repeatWithFunction', params);
  const {
    geometryFunction,  // Function that takes (index) => THREE.Object3D
    count = 10,
    spacing = 1,
    axis = 'x',
    centered = false,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'repeatFunction'
  } = params;

  if (!geometryFunction || typeof geometryFunction !== 'function') {
    console.warn('repeatWithFunction: geometryFunction must be a function');
    return new THREE.Group();
  }

  const group = new THREE.Group();
  const axisVec = axis === 'y' ? new THREE.Vector3(0, 1, 0) :
    (axis === 'z' ? new THREE.Vector3(0, 0, 1) :
      new THREE.Vector3(1, 0, 0));
  const offset = centered ? -spacing * (count - 1) / 2 : 0;

  for (let i = 0; i < count; i++) {
    const obj = geometryFunction(i);
    if (obj && obj.isObject3D) {
      obj.position.addScaledVector(axisVec, offset + i * spacing);
      group.add(obj);
    }
  }

  group.name = id;
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.scale.set(scale[0], scale[1], scale[2]);

  return group;
}

// 92. createFacadePanel

export function createFacadePanel(params = {}) {
  console.log('createFacadePanel', params);
  const {
    width = 1,
    height = 3,
    depth = 0.3,
    type = 'wall',  // 'wall', 'window', 'glass', 'solid'
    pattern = 'flat',  // 'flat', 'inset', 'frame'
    frameWidth = 0.1,
    insetDepth = 0.05,
    material = null,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    id = 'panel'
  } = params;

  const group = new THREE.Group();

  if (pattern === 'flat') {
    // Simple flat panel
    const panel = createBox({
      width, height, depth,
      material, position: [0, 0, 0], id: `${id}_main`
    });
    group.add(panel);

  } else if (pattern === 'inset') {
    // Frame + inset
    const frame = createBox({
      width, height, depth,
      material, position: [0, 0, 0], id: `${id}_frame`
    });
    group.add(frame);

    if (type === 'window' || type === 'glass') {
      const inset = createBox({
        width: width - frameWidth * 2,
        height: height - frameWidth * 2,
        depth: insetDepth,
        material,
        position: [0, 0, depth / 2 - insetDepth / 2],
        id: `${id}_glass`
      });
      group.add(inset);
    }

  } else if (pattern === 'frame') {
    // Just frame outline
    const frames = [
      // Top
      createBox({ width, height: frameWidth, depth, position: [0, (height - frameWidth) / 2, 0] }),
      // Bottom  
      createBox({ width, height: frameWidth, depth, position: [0, -(height - frameWidth) / 2, 0] }),
      // Left
      createBox({ width: frameWidth, height: height - frameWidth * 2, depth, position: [-(width - frameWidth) / 2, 0, 0] }),
      // Right
      createBox({ width: frameWidth, height: height - frameWidth * 2, depth, position: [(width - frameWidth) / 2, 0, 0] })
    ];
    frames.forEach(f => group.add(f));
  }

  group.name = id;
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.scale.set(scale[0], scale[1], scale[2]);

  return group;
}




// Full helpers list for copy-paste 
// createBox, createCylinder, createSphere, createExtrude, createLoft, translateGeometry, rotateGeometry, scaleGeometry, twistGeometry, taperGeometry, mirrorGeometry, arrayGeometry, repeatLinear3d, repeatAlongCurve3d, repeatRadial3d, distributeAlongPerimeter3d, distributeOnSurface3d, distributeInVolume3d, distributeOnGrid3d, distributeRandom3d, sweepGeometry, createPipe, createArcPath, createSplinePath, createHelixPath, createGridPath, offsetCurve, connectPaths, loftBetweenCurves, tessellateSurface, thickenSurface, normalOnSurface, uvOnSurface, projectOnSurface, deformByNoise, deformByVectorField, deformByAttractor, morphBetween, bendAlongCurve, radialDeform, createVectorField, attractorField, repellerField, flowField, combineFields, unionGeometries, subtractGeometries, intersectGeometries, splitGeometryByPlane, voronoiDivision, delaunayTriangulation, subdivisionSurface, lSystemGeometry, noisefield, convexHullGeometry, skeletonizeGeometry, packingAlgorithm, cellularAutomata, differentialGrowth, reactionDiffusion, meshFromParametric, meshFromVoxelGrid, meshFromMarchingCubes, randomPointsInMesh, pointSetCentroid, pointSetBoundingBox, closestPointOnCurve, signedDistanceToMesh, createArrow, labeledPoint, optimizeTopology, calculateAcoustics, deepCloneNode, samplePointOnPath, tangentOnPath, boundingBox, calculateFootprintCentroid, closestPointOnMesh, intersectRayMesh, measureDistance, measureArea, measureVolume, validateGeometry, mergeGeometries, flockingBehavior, antColonyOptimization, particleSwarmOptimization, agentBasedGrowth

