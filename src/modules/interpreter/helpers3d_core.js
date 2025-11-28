// ============================================================================
// helpers3d_core.js - COMPLETE EMERGENT VERSION WITH RESOLVER INTEGRATION
// ============================================================================
// Philosophy: Small core of flexible primitives + AI-driven logic via modifyGeometry
// Now with centralized resolver layer for seamless composition
// ============================================================================

import {
    rect2d,
    roundedRect2d,
    polygon2d,
    ellipse2d
} from './helpers2d.js';

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

// ✅ NEW: Import resolvers for seamless input handling
import {
    resolveCurve,
    resolvePoints,
    resolvePoints2D,
    resolveField,
    resolveVoxelGrid,
    wrapCurveAsLine,
    wrapFieldAsObject,
    wrapGridAsObject,
    sampleCurveAt,
    getCurveTangentAt,
    evaluateFieldAt
} from './resolvers.js';

// ============================================================================
// 0. INTERNAL NOISE IMPLEMENTATION (Simplex Noise - No External Dependencies)
// ============================================================================

const _grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

const _p = new Uint8Array(256);
for(let i=0; i<256; i++) _p[i] = Math.floor(Math.random()*256);

const _perm = new Uint8Array(512);
const _permMod12 = new Uint8Array(512);
for(let i=0; i<512; i++) {
    _perm[i] = _p[i & 255];
    _permMod12[i] = _perm[i] % 12;
}

function dot(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }

function simplex3(xin, yin, zin) {
    let n0, n1, n2, n3;
    const F3 = 1.0/3.0;
    const s = (xin+yin+zin)*F3;
    const i = Math.floor(xin+s), j = Math.floor(yin+s), k = Math.floor(zin+s);
    const G3 = 1.0/6.0;
    const t = (i+j+k)*G3;
    const X0 = i-t, Y0 = j-t, Z0 = k-t;
    const x0 = xin-X0, y0 = yin-Y0, z0 = zin-Z0;
    let i1, j1, k1, i2, j2, k2;
    if(x0>=y0) {
        if(y0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
        else if(x0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
        else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
        if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
        else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
        else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0*G3, y2 = y0 - j2 + 2.0*G3, z2 = z0 - k2 + 2.0*G3;
    const x3 = x0 - 1.0 + 3.0*G3, y3 = y0 - 1.0 + 3.0*G3, z3 = z0 - 1.0 + 3.0*G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const gi0 = _permMod12[ii+_perm[jj+_perm[kk]]];
    const gi1 = _permMod12[ii+i1+_perm[jj+j1+_perm[kk+k1]]];
    const gi2 = _permMod12[ii+i2+_perm[jj+j2+_perm[kk+k2]]];
    const gi3 = _permMod12[ii+1+_perm[jj+1+_perm[kk+1]]];
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    n0 = t0<0 ? 0.0 : (t0*=t0)*t0*dot(_grad3[gi0], x0, y0, z0);
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    n1 = t1<0 ? 0.0 : (t1*=t1)*t1*dot(_grad3[gi1], x1, y1, z1);
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    n2 = t2<0 ? 0.0 : (t2*=t2)*t2*dot(_grad3[gi2], x2, y2, z2);
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    n3 = t3<0 ? 0.0 : (t3*=t3)*t3*dot(_grad3[gi3], x3, y3, z3);
    return 70.0 * (n0 + n1 + n2 + n3);
}

const noise = {
    noise: simplex3,
    seed: (s) => {
        for(let i=0; i<256; i++) _p[i] = Math.floor((Math.sin(s + i) * 43758.5453) % 1 * 256);
        for(let i=0; i<512; i++) {
            _perm[i] = _p[i & 255];
            _permMod12[i] = _perm[i] % 12;
        }
    }
};

// ============================================================================
// 1. BASIC GEOMETRY CREATION (14 helpers)
// ============================================================================

export function createBox(params = {}) {
    const { width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1 } = params;
    return new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments);
}

export function createSphere(params = {}) {
    const { radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI } = params;
    return new THREE.SphereGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength);
}

export function createCylinder(params = {}) {
    const { radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2 } = params;
    return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
}

export function createCone(params = {}) {
    const { radius = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false } = params;
    return new THREE.ConeGeometry(radius, height, radialSegments, heightSegments, openEnded);
}

export function createTorus(params = {}) {
    const { radius = 1, tube = 0.4, radialSegments = 16, tubularSegments = 100, arc = Math.PI * 2 } = params;
    return new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments, arc);
}

export function createTorusKnot(params = {}) {
    const { radius = 1, tube = 0.4, tubularSegments = 64, radialSegments = 8, p = 2, q = 3 } = params;
    return new THREE.TorusKnotGeometry(radius, tube, tubularSegments, radialSegments, p, q);
}

export function createPlane(params = {}) {
    const { width = 1, height = 1, widthSegments = 1, heightSegments = 1 } = params;
    return new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
}

export function createCircle(params = {}) {
    const { radius = 1, segments = 32, thetaStart = 0, thetaLength = Math.PI * 2 } = params;
    return new THREE.CircleGeometry(radius, segments, thetaStart, thetaLength);
}

export function createRing(params = {}) {
    const { innerRadius = 0.5, outerRadius = 1, thetaSegments = 32, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2 } = params;
    return new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments, phiSegments, thetaStart, thetaLength);
}

export function createIcosahedron(params = {}) {
    const { radius = 1, detail = 0 } = params;
    return new THREE.IcosahedronGeometry(radius, detail);
}

export function createOctahedron(params = {}) {
    const { radius = 1, detail = 0 } = params;
    return new THREE.OctahedronGeometry(radius, detail);
}

export function createTetrahedron(params = {}) {
    const { radius = 1, detail = 0 } = params;
    return new THREE.TetrahedronGeometry(radius, detail);
}

export function createDodecahedron(params = {}) {
    const { radius = 1, detail = 0 } = params;
    return new THREE.DodecahedronGeometry(radius, detail);
}

export function createPolyhedron(params = {}) {
    const { vertices, indices, radius = 1, detail = 0 } = params;
    return new THREE.PolyhedronGeometry(vertices, indices, radius, detail);
}

// ============================================================================
// 2. ADVANCED GEOMETRY (6 helpers)
// ============================================================================

export function createExtrude(params = {}) {
    const { profile, depth = 1, bevelEnabled = false, bevelThickness = 0.2, bevelSize = 0.1, bevelSegments = 3, steps = 1, curveSegments = 12 } = params;

    if (!profile) {
        console.warn('createExtrude: No profile provided');
        return new THREE.BoxGeometry(1, 1, 1);
    }

    let shape;
    if (profile instanceof THREE.Shape) {
        shape = profile;
    } else if (Array.isArray(profile)) {
        shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
    } else {
        console.warn('createExtrude: Invalid profile format');
        return new THREE.BoxGeometry(1, 1, 1);
    }

    const extrudeSettings = { depth, bevelEnabled, bevelThickness, bevelSize, bevelSegments, steps, curveSegments };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

export function createLoft(params = {}) {
  let { profiles = [], heights = null, segments = 32, closed = false } = params;

  if (!Array.isArray(profiles)) profiles = [profiles];

  // ========================================================================
  // STEP 1: Unwrap and sample curves to 3D point arrays
  // ========================================================================
  profiles = profiles.map((profile, idx) => {
    let unwrappedCurve = profile;
    
    // Unwrap wrapped curves
    if (profile?.userData?.curve) {
      unwrappedCurve = profile.userData.curve;
    }

    // If it's a curve, sample points from it
    if (unwrappedCurve && typeof unwrappedCurve.getPoint === 'function') {
      console.log(`Profile ${idx}: Sampling curve with ${segments} points`);
      const points = [];
      for (let i = 0; i < segments; i++) {
        const t = i / (segments - 1);
        const point = unwrappedCurve.getPoint(t);
        if (point) {
          // ✅ KEY FIX: Store full 3D coordinates [x, y, z]
          // This preserves the curve's actual 3D shape!
          points.push([point.x, point.y, point.z]);
        }
      }
      return points;
    }

    // Already an array?
    if (Array.isArray(profile)) {
      return profile;
    }

    return [];
  });

  // ========================================================================
  // STEP 2: Validate we have at least 2 profiles
  // ========================================================================
  if (!Array.isArray(profiles) || profiles.length < 2) {
    console.error('❌ createLoft: Need at least 2 profiles');
    return new THREE.BufferGeometry();
  }

  // ========================================================================
  // STEP 3: Create interpolation curves between profiles
  // ========================================================================
  // Each profile is now a 3D point array
  // We need to:
  // 1. For each point index across profiles, create a curve
  // 2. These curves connect corresponding points on each profile

  const pointsPerProfile = Math.max(...profiles.map(p => p.length), segments);
  const vertices = [];
  const indices = [];

  // Ensure all profiles have same point count
  profiles = profiles.map(profile => {
    if (profile.length === pointsPerProfile) return profile;
    
    // Resample if needed
    const resampled = [];
    for (let i = 0; i < pointsPerProfile; i++) {
      const t = i / (pointsPerProfile - 1);
      const idx = Math.floor(t * (profile.length - 1));
      resampled.push(profile[idx]);
    }
    return resampled;
  });

  // ========================================================================
  // STEP 4: For each point column, create interpolation curve
  // ========================================================================
  const interpCurves = [];
  for (let j = 0; j < pointsPerProfile; j++) {
    // Collect the j-th point from each profile
    const columnPoints = profiles.map((profile, i) => {
      const [x, y, z] = profile[j];
      // ✅ Keep original positions, don't add profileHeights
      return new THREE.Vector3(x, y, z);
    });

    // Create curve through these points
    if (columnPoints.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(columnPoints, false);
      interpCurves.push(curve);
    }
  }

  // ========================================================================
  // STEP 5: Sample interpolation curves and build mesh
  // ========================================================================
  const samplesPerCurve = 16; // How many points to sample along each interpolation curve
  
  for (let j = 0; j < interpCurves.length; j++) {
    for (let k = 0; k < samplesPerCurve; k++) {
      const t = k / (samplesPerCurve - 1);
      const point = interpCurves[j].getPoint(t);
      vertices.push(point.x, point.y, point.z);
    }
  }

  // Create faces
  for (let j = 0; j < interpCurves.length - 1; j++) {
    for (let k = 0; k < samplesPerCurve - 1; k++) {
      const a = j * samplesPerCurve + k;
      const b = j * samplesPerCurve + k + 1;
      const c = (j + 1) * samplesPerCurve + k + 1;
      const d = (j + 1) * samplesPerCurve + k;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Close if needed
  if (closed && interpCurves.length > 1) {
    const lastIdx = interpCurves.length - 1;
    for (let k = 0; k < samplesPerCurve - 1; k++) {
      const a = lastIdx * samplesPerCurve + k;
      const b = lastIdx * samplesPerCurve + k + 1;
      const c = k + 1;
      const d = k;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // ========================================================================
  // STEP 6: Create geometry
  // ========================================================================
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();

  console.log('✅ createLoft success:', {
    profileCount: profiles.length,
    pointsPerProfile,
    interpCurveCount: interpCurves.length,
    sampleCount: samplesPerCurve,
    vertexCount: vertices.length / 3,
    faceCount: indices.length / 3
  });

  return geometry;
}




// ✅ UPDATED: createLathe now accepts curves via resolver
export function createLathe(params = {}) {
    let { points = [], segments = 12, phiStart = 0, phiLength = Math.PI * 2 } = params;

    // ✅ RESOLVER: Handles array, curve, or wrapped object
    const resolvedPoints2D = resolvePoints2D(points, segments);

    if (resolvedPoints2D.length === 0) {
        console.warn('createLathe: No valid points resolved');
        return new THREE.BufferGeometry();
    }

    // Convert to THREE.Vector2 if needed
    const lathePoints = resolvedPoints2D.map(p => 
        p instanceof THREE.Vector2 ? p : new THREE.Vector2(p.x || p[0], p.y || p[1])
    );

    try {
        return new THREE.LatheGeometry(lathePoints, segments, phiStart, phiLength);
    } catch (e) {
        console.error('LatheGeometry creation failed:', e);
        return new THREE.BufferGeometry();
    }
}

export function createConvexHull(params = {}) {
    const { points } = params;

    if (!points || points.length < 4) {
        console.warn('createConvexHull: Need at least 4 points');
        return new THREE.BufferGeometry();
    }

    const vectors = points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p);
    return new ConvexGeometry(vectors);
}

export function createParametricSurface(params = {}) {
    const { func, slices = 32, stacks = 32 } = params;
    return new THREE.ParametricGeometry(func, slices, stacks);
}

export function createText3D(params = {}) {
    console.warn('createText3D: Requires THREE.TextGeometry and loaded font');
    return new THREE.BoxGeometry(1, 1, 0.2);
}

// ============================================================================
// 3. CURVES & PATHS (6 helpers) - NOW WITH WRAPPER PROTOCOL
// ============================================================================

export function createLinePath(params = {}) {
    const { points } = params;

    if (!points || points.length < 2) {
        console.warn('createLinePath: Need at least 2 points');
        return new THREE.BufferGeometry();
    }

    const vectors = points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p);
    const curve = new THREE.LineCurve3(vectors[0], vectors[1]);

    // ✅ WRAPPED: Return visual with math object attached
    return wrapCurveAsLine(curve, 32);
}

export function createSplinePath(params = {}) {
    const { points, tension = 0.5 } = params;

    if (!points || points.length < 2) {
        console.warn('createSplinePath: Need at least 2 points');
        return new THREE.BufferGeometry();
    }

    const vectors = points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p);
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', tension);

    // ✅ WRAPPED: Return visual with math object attached
    return wrapCurveAsLine(curve, 64);
}

// ✅ UPDATED: createArcPath now wraps output
export function createArcPath(params = {}) {
    const { center = [0, 0, 0], radius = 1, startAngle = 0, endAngle = Math.PI, segments = 32 } = params;
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const theta = startAngle + (endAngle - startAngle) * i / segments;
        const x = center[0] + radius * Math.cos(theta);
        const y = center[1] + radius * Math.sin(theta);
        points.push(new THREE.Vector3(x, y, center[2]));
    }

    const curve = new THREE.CatmullRomCurve3(points, false);

    // ✅ WRAPPED: Return visual with math object attached
    return wrapCurveAsLine(curve, segments);
}

export function createHelixPath(params = {}) {
    const { radius = 1, height = 3, turns = 3, segments = 128 } = params;
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const theta = 2 * Math.PI * turns * t;
        const x = radius * Math.cos(theta);
        const y = height * t;
        const z = radius * Math.sin(theta);
        points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points, false);

    // ✅ WRAPPED: Return visual with math object attached
    return wrapCurveAsLine(curve, segments);
}

export function createBezierPath(params = {}) {
    const { start, control1, control2, end } = params;

    const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(...start),
        new THREE.Vector3(...control1),
        new THREE.Vector3(...control2),
        new THREE.Vector3(...end)
    );

    // ✅ WRAPPED: Return visual with math object attached
    return wrapCurveAsLine(curve, 64);
}

export function createPipe(params = {}) {
    const { path, radius = 0.2, tubularSegments = 64, radialSegments = 8, closed = false } = params;

    // ✅ RESOLVER: Handle wrapped curves
    const curve = resolveCurve(path);
    if (!curve) {
        console.warn('createPipe: No valid curve');
        return new THREE.BufferGeometry();
    }

    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
}

// ============================================================================
// 4. DEFORMATIONS (5 helpers)
// ============================================================================

export function twistGeometry(params = {}) {
    const { geometry, angle = Math.PI / 4, axis = [0, 1, 0], height = null } = params;

    const geom = geometry.clone();
    const positions = geom.attributes.position;
    const count = positions.count;

    geom.computeBoundingBox();
    const bbox = geom.boundingBox;

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
    geom.computeVertexNormals();
    return geom;
}

export function taperGeometry(params = {}) {
    const { geometry, topScale = [0.5, 0.5], axis = [0, 1, 0], height = null } = params;

    const geom = geometry.clone();
    const positions = geom.attributes.position;
    const count = positions.count;

    geom.computeBoundingBox();
    const bbox = geom.boundingBox;

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
    geom.computeVertexNormals();
    return geom;
}

export function bendGeometry(params = {}) {
    const { geometry, angle = Math.PI / 4, direction = [1, 0, 0] } = params;

    const geom = geometry.clone();
    const positions = geom.attributes.position;

    geom.computeBoundingBox();
    const bbox = geom.boundingBox;
    const range = bbox.max.x - bbox.min.x;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const t = (x - bbox.min.x) / range;
        const theta = angle * t;
        const radius = range / angle;
        const newX = Math.sin(theta) * radius;
        const newZ = z + radius - Math.cos(theta) * radius;

        positions.setXYZ(i, newX, y, newZ);
    }

    positions.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}

export function deformByNoise(params = {}) {
    const { geometry, amount = 0.2, frequency = 1.0, axis = [0, 1, 0] } = params;

    const geom = geometry.clone();
    const positions = geom.attributes.position;
    const axisVec = new THREE.Vector3(...axis).normalize();

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const noiseVal = noise.noise(x * frequency, y * frequency, z * frequency);
        const offset = axisVec.clone().multiplyScalar(noiseVal * amount);

        positions.setXYZ(i, x + offset.x, y + offset.y, z + offset.z);
    }

    positions.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}

export function deformByVectorField(params = {}) {
    const { geometry, field, amount = 1.0 } = params;

    // ✅ RESOLVER: Handle wrapped fields
    const fieldFn = resolveField(field);

    const geom = geometry.clone();
    const positions = geom.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const vec = fieldFn(x, y, z);

        positions.setXYZ(i, x + vec.x * amount, y + vec.y * amount, z + vec.z * amount);
    }

    positions.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}

// ============================================================================
// 5. BOOLEAN OPERATIONS & UTILITIES (4 helpers)
// ============================================================================

export function mergeGeometries(params = {}) {
    const { geometries = [] } = params;
    const validGeoms = geometries.filter(g => g && g.isBufferGeometry);

    if (validGeoms.length === 0) return new THREE.BufferGeometry();
    return BufferGeometryUtils.mergeGeometries(validGeoms, false);
}

export function unionGeometry(params = {}) {
    console.warn('unionGeometry: CSG operations require three-csg-ts library');
    return mergeGeometries(params);
}

export function subtractGeometry(params = {}) {
    console.warn('subtractGeometry: CSG operations require three-csg-ts library');
    return params.geometryA || new THREE.BufferGeometry();
}

export function intersectGeometry(params = {}) {
    console.warn('intersectGeometry: CSG operations require three-csg-ts library');
    return params.geometryA || new THREE.BufferGeometry();
}

// ============================================================================
// 6. DISTRIBUTION (5 helpers) - WITH RESOLVER INTEGRATION
// ============================================================================

export function repeatLinear3d(params = {}) {
    const { geometry, count = 3, spacing = 1, axis = 'x', centered = false, autoMerge = true } = params;

    if (!geometry) return autoMerge ? new THREE.BufferGeometry() : [];

    const results = [];
    const axisVec = axis === 'y' ? new THREE.Vector3(0, 1, 0) :
                    (axis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0));
    const offset = centered ? -spacing * (count - 1) / 2 : 0;

    for (let i = 0; i < count; i++) {
        const clone = geometry.clone();
        clone.translate(
            axisVec.x * (offset + i * spacing),
            axisVec.y * (offset + i * spacing),
            axisVec.z * (offset + i * spacing)
        );
        results.push(clone);
    }

    return autoMerge ? mergeGeometries({ geometries: results }) : results;
}

export function repeatRadial3d(params = {}) {
    const { geometry, count = 8, radius = 5, startAngle = 0, endAngle = Math.PI * 2, axis = 'y', faceCenter = true, autoMerge = true } = params;

    if (!geometry) return autoMerge ? new THREE.BufferGeometry() : [];

    const results = [];
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        const angle = startAngle + (endAngle - startAngle) * t;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const clone = geometry.clone();

        if (axis === 'y') {
            clone.translate(x, 0, z);
            if (faceCenter) clone.rotateY(angle + Math.PI / 2);
        }

        results.push(clone);
    }

    return autoMerge ? mergeGeometries({ geometries: results }) : results;
}

// ✅ UPDATED: repeatAlongCurve now accepts wrapped curves
export function repeatAlongCurve3d(params = {}) {
    const { geometry, curve, count = 10, align = true, autoMerge = true } = params;

    if (!geometry) return autoMerge ? new THREE.BufferGeometry() : [];

    // ✅ RESOLVER: Unwraps wrapped curves automatically
    const resolvedCurve = resolveCurve(curve);
    if (!resolvedCurve) {
        console.warn('repeatAlongCurve3d: No valid curve');
        return autoMerge ? new THREE.BufferGeometry() : [];
    }

    const results = [];
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const pos = resolvedCurve.getPoint(t);
        const clone = geometry.clone();
        clone.translate(pos.x, pos.y, pos.z);

        if (align) {
            const tangent = resolvedCurve.getTangent(t).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const orthogonalUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            const rotMatrix = new THREE.Matrix4().makeBasis(tangent, orthogonalUp, normal);
            clone.applyMatrix4(rotMatrix);
        }

        results.push(clone);
    }

    return autoMerge ? mergeGeometries({ geometries: results }) : results;
}

export function distributeOnGrid3d(params = {}) {
    const { geometry, rows = 3, cols = 3, spacing = [2, 0, 2], centered = true, autoMerge = true } = params;

    if (!geometry) return autoMerge ? new THREE.BufferGeometry() : [];

    const [spacingX, spacingY, spacingZ] = Array.isArray(spacing) ? spacing : [spacing, 0, spacing];
    const offsetX = centered ? -spacingX * (cols - 1) / 2 : 0;
    const offsetZ = centered ? -spacingZ * (rows - 1) / 2 : 0;

    const results = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const clone = geometry.clone();
            clone.translate(offsetX + col * spacingX, row * spacingY, offsetZ + row * spacingZ);
            results.push(clone);
        }
    }

    return autoMerge ? mergeGeometries({ geometries: results }) : results;
}

export function distributeRandom3d(params = {}) {
    const { geometry, bounds = [[0, 0, 0], [1, 1, 1]], count = 50, seed = 42, autoMerge = true } = params;

    const random = (() => {
        let a = seed;
        return () => {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    })();

    const [min, max] = bounds;
    const results = [];

    for (let i = 0; i < count; i++) {
        const x = min[0] + (max[0] - min[0]) * random();
        const y = min[1] + (max[1] - min[1]) * random();
        const z = min[2] + (max[2] - min[2]) * random();
        const clone = geometry.clone();
        clone.translate(x, y, z);
        results.push(clone);
    }

    return autoMerge ? mergeGeometries({ geometries: results }) : results;
}

// ============================================================================
// 7. FIELDS & ATTRACTORS (2 helpers) - NOW WITH WRAPPER PROTOCOL
// ============================================================================

// ✅ UPDATED: createVectorField now wraps output
export function createVectorField(params = {}) {
    const { type = 'attractor', center = [0, 0, 0], strength = 1.0 } = params;
    const centerVec = new THREE.Vector3(...center);

    let fieldFn;
    if (type === 'attractor') {
        fieldFn = (x, y, z) => {
            const pos = new THREE.Vector3(x, y, z);
            const dir = centerVec.clone().sub(pos);
            const dist = dir.length();
            return dir.normalize().multiplyScalar(strength / (1 + dist));
        };
    } else if (type === 'repeller') {
        fieldFn = (x, y, z) => {
            const pos = new THREE.Vector3(x, y, z);
            const dir = pos.clone().sub(centerVec);
            const dist = dir.length();
            return dir.normalize().multiplyScalar(strength / (1 + dist));
        };
    } else if (type === 'vortex') {
        fieldFn = (x, y, z) => {
            const pos = new THREE.Vector3(x, y, z);
            const dir = pos.clone().sub(centerVec);
            const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
            return tangent.multiplyScalar(strength);
        };
    } else {
        fieldFn = () => new THREE.Vector3(0, 0, 0);
    }

    // ✅ WRAPPED OUTPUT with field attached
    return wrapFieldAsObject(fieldFn, `${type} field at [${center}]`);
}

export function flowField(params = {}) {
    return createVectorField(params);
}

// ============================================================================
// 8. FLOW VISUALIZATION (NEW) - Visualizes flow fields as streamlines/pipes
// ============================================================================

// ✅ NEW: createStreamlines visualizes vector fields
export function createStreamlines(params = {}) {
    const { 
        field,              // Function or wrapped field
        box = [-5, -5, -5, 5, 5, 5],
        count = 50,
        steps = 50,
        stepSize = 0.1
    } = params;

    // ✅ RESOLVER: Unwraps field automatically
    const fieldFn = resolveField(field);

    if (typeof fieldFn !== 'function') {
        console.warn('createStreamlines: No valid field');
        return new THREE.BufferGeometry();
    }

    const [minX, minY, minZ, maxX, maxY, maxZ] = box;
    const lines = [];

    for (let i = 0; i < count; i++) {
        let pos = new THREE.Vector3(
            minX + Math.random() * (maxX - minX),
            minY + Math.random() * (maxY - minY),
            minZ + Math.random() * (maxZ - minZ)
        );

        const points = [pos.clone()];

        for (let j = 0; j < steps; j++) {
            const dir = fieldFn(pos.x, pos.y, pos.z);
            if (!dir || dir.length() < 0.001) break;

            pos.add(dir.clone().multiplyScalar(stepSize));
            points.push(pos.clone());
        }

        if (points.length > 1) {
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            lines.push(geom);
        }
    }

    return lines.length > 0 ? mergeGeometries({ geometries: lines }) : new THREE.BufferGeometry();
}

// ✅ NEW: createFlowPipes - Same as streamlines but as pipes/tubes
export function createFlowPipes(params = {}) {
    const { 
        field,
        box = [-5, -5, -5, 5, 5, 5],
        count = 20,
        steps = 40,
        stepSize = 0.1,
        radius = 0.1
    } = params;

    const fieldFn = resolveField(field);

    if (typeof fieldFn !== 'function') {
        console.warn('createFlowPipes: No valid field');
        return new THREE.BufferGeometry();
    }

    const [minX, minY, minZ, maxX, maxY, maxZ] = box;
    const pipes = [];

    for (let i = 0; i < count; i++) {
        let pos = new THREE.Vector3(
            minX + Math.random() * (maxX - minX),
            minY + Math.random() * (maxY - minY),
            minZ + Math.random() * (maxZ - minZ)
        );

        const points = [pos.clone()];

        for (let j = 0; j < steps; j++) {
            const dir = fieldFn(pos.x, pos.y, pos.z);
            if (!dir || dir.length() < 0.001) break;

            pos.add(dir.clone().multiplyScalar(stepSize));
            points.push(pos.clone());
        }

        if (points.length > 2) {
            const curve = new THREE.CatmullRomCurve3(points, false);
            const tubeGeom = new THREE.TubeGeometry(curve, 8, radius, 4, false);
            pipes.push(tubeGeom);
        }
    }

    return pipes.length > 0 ? mergeGeometries({ geometries: pipes }) : new THREE.BufferGeometry();
}

// ============================================================================
// 9. PROCEDURAL PATTERNS (3 helpers) - WITH RESOLVER INTEGRATION
// ============================================================================

// ✅ UPDATED: cellularAutomata now returns wrapped grid (data only)
export function cellularAutomata(params = {}) {
    const { gridSize = 10, iterations = 10, rules = { survive: [2, 3], born: [3] } } = params;

    const grid = new Array(gridSize);
    for (let x = 0; x < gridSize; x++) {
        grid[x] = new Array(gridSize);
        for (let y = 0; y < gridSize; y++) {
            grid[x][y] = new Array(gridSize);
            for (let z = 0; z < gridSize; z++) {
                grid[x][y][z] = Math.random() > 0.5 ? 1 : 0;
            }
        }
    }

    for (let iter = 0; iter < iterations; iter++) {
        const newGrid = JSON.parse(JSON.stringify(grid));

        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                for (let z = 0; z < gridSize; z++) {
                    let neighbors = 0;

                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dz = -1; dz <= 1; dz++) {
                                if (dx === 0 && dy === 0 && dz === 0) continue;
                                const nx = x + dx, ny = y + dy, nz = z + dz;
                                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && nz >= 0 && nz < gridSize) {
                                    neighbors += grid[nx][ny][nz];
                                }
                            }
                        }
                    }

                    if (grid[x][y][z] === 1) {
                        newGrid[x][y][z] = rules.survive.includes(neighbors) ? 1 : 0;
                    } else {
                        newGrid[x][y][z] = rules.born.includes(neighbors) ? 1 : 0;
                    }
                }
            }
        }

        Object.assign(grid, newGrid);
    }

    // ✅ WRAPPED OUTPUT: Returns data object, not geometry
    return wrapGridAsObject(grid, gridSize, { iterations, rules });
}

export function reactionDiffusion(params = {}) {
    console.warn('reactionDiffusion: Complex simulation - use cellularAutomata or modifyGeometry');
    return cellularAutomata({ ...params, iterations: 5 });
}

// ============================================================================
// 10. EMERGENT FEATURES (The AI Brain) - 2 helpers
// ============================================================================

export function modifyGeometry(params) {
    console.log('modifyGeometry', params);

    let { geometry, operations = [], expression, context = {} } = params;

    if (expression) {
        operations.push({ expression }); // Convert legacy single expression to array
    }

    if (!geometry) {
        console.warn("modifyGeometry: No geometry");
        return null;
    }

    const geom = geometry.clone();
    const positionAttribute = geom.attributes.position;
    const normalAttribute = geom.attributes.normal;

    if (!positionAttribute) return geom;

    const count = positionAttribute.count;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const utils = Math;

    // Pre-compile all operation functions
    const funcs = operations.map(op => {
        try {
            return new Function('p', 'n', 'i', 'ctx', 'utils', 'v', op.expression);
        } catch (e) {
            console.error("modifyGeometry: Failed to compile expression", op.expression, e);
            return null;
        }
    });

    // Iterate Vertices
    for (let i = 0; i < count; i++) {
        p.fromBufferAttribute(positionAttribute, i);
        if (normalAttribute) n.fromBufferAttribute(normalAttribute, i);

        // Run the pipeline
        funcs.forEach(fn => {
            if (fn) {
                fn(p, n, i, context, utils, p);
            }
        });

        positionAttribute.setXYZ(i, p.x, p.y, p.z);
    }

    geom.computeVertexNormals();
    positionAttribute.needsUpdate = true;
    return geom;
}

export function meshFromMarchingCubes(params = {}) {
    const { resolution = 32, isovalue = 0.5, bounds = 10, expression, context = {} } = params;

    const effect = new MarchingCubes(resolution, null, true, true, 100000);

    let fieldFn;
    if (expression) {
        try {
            const userFn = new Function('x', 'y', 'z', 'ctx', 'noise', 'utils', expression);
            const noiseFn = (x, y, z) => noise.noise(x, y, z);
            fieldFn = (x, y, z) => userFn(x, y, z, context, noiseFn, Math);
        } catch(e) { console.error(e); }
    }

    if (!fieldFn) fieldFn = (x, y, z) => noise.noise(x*0.1, y*0.1, z*0.1) + 0.5;

    const scaleFactor = 2 * bounds / resolution;
    effect.isolation = isovalue;

    for (let k = 0; k < resolution; k++) {
        for (let j = 0; j < resolution; j++) {
            for (let i = 0; i < resolution; i++) {
                const x = (i - resolution/2) * scaleFactor;
                const y = (j - resolution/2) * scaleFactor;
                const z = (k - resolution/2) * scaleFactor;
                const val = fieldFn(x, y, z);
                effect.field[i + j * resolution + k * resolution * resolution] = val;
            }
        }
    }

    effect.update();
    if (effect.geometry) {
        const exportedGeom = effect.geometry.clone();
        effect.geometry.dispose();
        return exportedGeom;
    }

    return new THREE.BufferGeometry();
}

// ============================================================================
// 11. COMPLEX ALGORITHMS (Irreplaceable by modifyGeometry) - 11 helpers
// ============================================================================

export function lSystemGeometry(params = {}) {
    const { axiom = 'F', rules = { 'F': 'FF+[+F-F-F]-[-F+F+F]' }, iterations = 3, angle = 25, length = 1, thickness = 0.1 } = params;

    let current = axiom;
    for (let i = 0; i < iterations; i++) {
        let next = '';
        for (const char of current) {
            next += rules[char] || char;
        }
        current = next;
    }

    const stack = [];
    const position = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(0, 1, 0);
    const angleRad = angle * Math.PI / 180;
    const segments = [];

    for (const char of current) {
        if (char === 'F') {
            const newPos = position.clone().add(direction.clone().multiplyScalar(length));
            segments.push([position.clone(), newPos.clone(), thickness]);
            position.copy(newPos);
        } else if (char === '+') {
            direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), angleRad);
        } else if (char === '-') {
            direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), -angleRad);
        } else if (char === '[') {
            stack.push([position.clone(), direction.clone()]);
        } else if (char === ']') {
            const [pos, dir] = stack.pop();
            position.copy(pos);
            direction.copy(dir);
        }
    }

    const geometries = [];
    for (const [start, end, thick] of segments) {
        const curve = new THREE.LineCurve3(start, end);
        const tubeGeom = new THREE.TubeGeometry(curve, 2, thick, 4, false);
        geometries.push(tubeGeom);
    }

    return geometries.length > 0 ? mergeGeometries({ geometries }) : new THREE.BufferGeometry();
}

export function differentialGrowth(params = {}) {
    const { geometry, iterations = 10, maxEdgeLength = 0.5, repulsionRadius = 0.3, repulsionStrength = 0.1, attractionStrength = 0.05 } = params;

    console.warn('differentialGrowth: Complex mesh topology modification - simplified version');

    let geom = geometry.clone();
    for (let iter = 0; iter < iterations; iter++) {
        const positions = geom.attributes.position;
        const count = positions.count;
        const forces = new Array(count).fill(null).map(() => new THREE.Vector3());

        for (let i = 0; i < count; i++) {
            const pi = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));

            for (let j = i + 1; j < count; j++) {
                const pj = new THREE.Vector3(positions.getX(j), positions.getY(j), positions.getZ(j));
                const diff = pi.clone().sub(pj);
                const dist = diff.length();

                if (dist < repulsionRadius && dist > 0.001) {
                    const force = diff.normalize().multiplyScalar(repulsionStrength / dist);
                    forces[i].add(force);
                    forces[j].sub(force);
                }
            }
        }

        for (let i = 0; i < count; i++) {
            const x = positions.getX(i) + forces[i].x;
            const y = positions.getY(i) + forces[i].y;
            const z = positions.getZ(i) + forces[i].z;
            positions.setXYZ(i, x, y, z);
        }

        positions.needsUpdate = true;
        geom.computeVertexNormals();
    }

    return geom;
}

// ✅ UPDATED: meshFromVoxelGrid now accepts wrapped grids
export function meshFromVoxelGrid(params = {}) {
    let { grid, voxelSize = 1 } = params;

    // ✅ RESOLVER: Unwraps if it's a wrapped grid
    if (grid && grid.userData && grid.userData.grid) {
        grid = grid.userData.grid;
        voxelSize = grid.userData?.voxelSize || voxelSize;
    }

    // ✅ RESOLVER: Also handles raw array
    grid = resolveVoxelGrid(grid);

    if (!grid || !Array.isArray(grid)) {
        console.warn('meshFromVoxelGrid: No valid grid');
        return new THREE.BufferGeometry();
    }

    const geometries = [];
    const boxGeom = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);

    const sizeX = grid.length;
    const sizeY = grid[0]?.length || 0;
    const sizeZ = grid[0]?.[0]?.length || 0;

    for (let x = 0; x < sizeX; x++) {
        for (let y = 0; y < sizeY; y++) {
            for (let z = 0; z < sizeZ; z++) {
                if (grid[x][y][z]) {
                    const clone = boxGeom.clone();
                    clone.translate(x * voxelSize, y * voxelSize, z * voxelSize);
                    geometries.push(clone);
                }
            }
        }
    }

    return geometries.length > 0 ? mergeGeometries({ geometries }) : new THREE.BufferGeometry();
}

export function pointSetCentroid(params = {}) {
    const { points } = params;

    if (!points || points.length === 0) return new THREE.Vector3();

    const centroid = new THREE.Vector3();
    for (const p of points) {
        const vec = Array.isArray(p) ? new THREE.Vector3(...p) : p;
        centroid.add(vec);
    }

    centroid.divideScalar(points.length);
    return centroid;
}

export function pointSetBoundingBox(params = {}) {
    const { points } = params;

    if (!points || points.length === 0) return new THREE.Box3();

    const box = new THREE.Box3();
    for (const p of points) {
        const vec = Array.isArray(p) ? new THREE.Vector3(...p) : p;
        box.expandByPoint(vec);
    }

    return box;
}

export function closestPointOnCurve(params = {}) {
    const { curve, point, samples = 100 } = params;

    if (!curve || !point) return new THREE.Vector3();

    // ✅ RESOLVER: Handle wrapped curves
    const resolvedCurve = resolveCurve(curve);
    if (!resolvedCurve) return new THREE.Vector3();

    const targetPoint = Array.isArray(point) ? new THREE.Vector3(...point) : point;
    let closestPoint = resolvedCurve.getPoint(0);
    let minDist = closestPoint.distanceTo(targetPoint);

    for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const p = resolvedCurve.getPoint(t);
        const dist = p.distanceTo(targetPoint);

        if (dist < minDist) {
            minDist = dist;
            closestPoint = p;
        }
    }

    return closestPoint;
}

export function signedDistanceToMesh(params = {}) {
    const { geometry, point } = params;

    if (!geometry || !point) return 0;

    const targetPoint = Array.isArray(point) ? new THREE.Vector3(...point) : point;
    const raycaster = new THREE.Raycaster(targetPoint, new THREE.Vector3(1, 0, 0));
    const tempMesh = new THREE.Mesh(geometry);
    const intersects = raycaster.intersectObject(tempMesh);

    if (intersects.length === 0) return Infinity;

    const closestDist = intersects[0].distance;
    return intersects.length % 2 === 0 ? closestDist : -closestDist;
}

export function measureVolume(params = {}) {
    const { geometry } = params;

    if (!geometry) return 0;

    let volume = 0;
    const positions = geometry.attributes.position;
    const index = geometry.index;

    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i), b = index.getX(i+1), c = index.getX(i+2);
            const v1 = new THREE.Vector3(positions.getX(a), positions.getY(a), positions.getZ(a));
            const v2 = new THREE.Vector3(positions.getX(b), positions.getY(b), positions.getZ(b));
            const v3 = new THREE.Vector3(positions.getX(c), positions.getY(c), positions.getZ(c));
            volume += v1.dot(new THREE.Vector3().crossVectors(v2, v3)) / 6;
        }
    }

    return Math.abs(volume);
}

export function measureArea(params = {}) {
    const { geometry } = params;

    if (!geometry) return 0;

    let area = 0;
    const positions = geometry.attributes.position;
    const index = geometry.index;

    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i), b = index.getX(i+1), c = index.getX(i+2);
            const v1 = new THREE.Vector3(positions.getX(a), positions.getY(a), positions.getZ(a));
            const v2 = new THREE.Vector3(positions.getX(b), positions.getY(b), positions.getZ(b));
            const v3 = new THREE.Vector3(positions.getX(c), positions.getY(c), positions.getZ(c));
            const edge1 = v2.clone().sub(v1);
            const edge2 = v3.clone().sub(v1);
            area += edge1.cross(edge2).length() / 2;
        }
    }

    return area;
}

export function subdivisionSurface(params = {}) {
    console.warn('subdivisionSurface: Requires SubdivisionModifier from three/examples');
    return params.geometry || new THREE.BufferGeometry();
}

export function voronoiDivision(params = {}) {
    console.warn('voronoiDivision: Complex algorithm - requires external library');
    return new THREE.BufferGeometry();
}

export function convexHullGeometry(params = {}) {
    return createConvexHull(params);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Basic geometry (14)
    createBox, createSphere, createCylinder, createCone, createTorus, createTorusKnot,
    createPlane, createCircle, createRing, createPolyhedron, createIcosahedron,
    createOctahedron, createTetrahedron, createDodecahedron,

    // Advanced geometry (6)
    createExtrude, createLoft, createLathe, createConvexHull, createParametricSurface, createText3D,

    // Curves & paths (6) - Now wrapped
    createLinePath, createSplinePath, createArcPath, createHelixPath, createBezierPath, createPipe,

    // Deformations (5)
    twistGeometry, taperGeometry, bendGeometry, deformByNoise, deformByVectorField,

    // Boolean & utilities (4)
    mergeGeometries, unionGeometry, subtractGeometry, intersectGeometry,

    // Distribution (5) - Now with resolver
    repeatLinear3d, repeatRadial3d, repeatAlongCurve3d, distributeOnGrid3d, distributeRandom3d,

    // Fields & attractors (2) - Now wrapped
    createVectorField, flowField,

    // Flow visualization (2 - NEW)
    createStreamlines, createFlowPipes,

    // Procedural patterns (3)
    cellularAutomata, reactionDiffusion,

    // Emergent features (2)
    modifyGeometry, meshFromMarchingCubes,

    // Complex algorithms (11)
    lSystemGeometry, differentialGrowth, meshFromVoxelGrid,
    pointSetCentroid, pointSetBoundingBox, closestPointOnCurve, signedDistanceToMesh,
    measureVolume, measureArea, subdivisionSurface, voronoiDivision, convexHullGeometry
};