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

export const noise = {
    simplex3,
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

  // ========================================================================
  // STEP 0: AUTO-UNWRAP DATA
  // ========================================================================
  if (profiles && profiles.userData && profiles.userData.profiles) {
      console.log('createLoft: Unwrapping profiles from userData');
      profiles = profiles.userData.profiles;
      closed = true; 
  }

  if (!Array.isArray(profiles)) profiles = [profiles];

  // ========================================================================
  // STEP 1: Sample curves
  // ========================================================================
  profiles = profiles.map((profile, idx) => {
    let unwrappedCurve = profile;
    if (profile?.userData?.curve) unwrappedCurve = profile.userData.curve;
    if (unwrappedCurve && typeof unwrappedCurve.getPoint === 'function') {
      const points = [];
      for (let i = 0; i < segments; i++) {
        const t = i / (segments - 1);
        const point = unwrappedCurve.getPoint(t);
        if (point) points.push([point.x, point.y, point.z]);
      }
      return points;
    }
    if (Array.isArray(profile)) return profile;
    return [];
  });

  profiles = profiles.filter(p => p.length > 0);

  if (profiles.length < 2) {
    console.error('❌ createLoft: Need at least 2 profiles');
    return new THREE.BufferGeometry();
  }

  // ========================================================================
  // STEP 3: Resample (Arc-Length)
  // ========================================================================
  const resampleProfile = (points, targetCount) => {
      if (points.length < 2) return points;
      const dists = [0];
      let totalLen = 0;
      for (let i = 0; i < points.length - 1; i++) {
          const [x1, y1, z1] = points[i];
          const [x2, y2, z2] = points[i+1];
          const d = Math.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2);
          totalLen += d;
          dists.push(totalLen);
      }

      const result = [];
      result.push(points[0]);
      for (let i = 1; i < targetCount - 1; i++) {
          const targetDist = (i / (targetCount - 1)) * totalLen;
          let idx = 0;
          while (dists[idx+1] < targetDist && idx < dists.length - 2) idx++;
          
          const segmentLen = dists[idx+1] - dists[idx];
          const t = segmentLen === 0 ? 0 : (targetDist - dists[idx]) / segmentLen;
          
          const p1 = points[idx];
          const p2 = points[idx+1];
          
          result.push([
              p1[0] + (p2[0] - p1[0]) * t,
              p1[1] + (p2[1] - p1[1]) * t,
              p1[2] + (p2[2] - p1[2]) * t
          ]);
      }
      result.push(points[points.length - 1]);
      return result;
  };

  // Use finalPointCount instead of pointsPerProfile
  const finalPointCount = Math.max(segments, ...profiles.map(p => p.length));
  profiles = profiles.map(profile => resampleProfile(profile, finalPointCount));

  // ========================================================================
  // STEP 4: Create Interpolation Curves
  // ========================================================================
  const interpCurves = [];
  for (let j = 0; j < finalPointCount; j++) { // ✅ FIX: Used correct variable
    const columnPoints = profiles.map((profile) => {
      const [x, y, z] = profile[j];
      return new THREE.Vector3(x, y, z);
    });

    if (columnPoints.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(columnPoints, false);
      interpCurves.push(curve);
    }
  }

  // ========================================================================
  // STEP 5: Build Mesh
  // ========================================================================
  const vertices = []; // ✅ FIX: Defined arrays
  const indices = [];
  const samplesPerCurve = Math.max(16, profiles.length * 2); 
  
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

  // Close loop
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
  // STEP 6: Create Geometry
  // ========================================================================
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();

  console.log('✅ createLoft success:', {
    profileCount: profiles.length,
    vertexCount: vertices.length / 3
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

/**
 * flowField - Dedicated helper for creating real-world physics flow fields
 * Simplified API focused on common simulation scenarios
 * Returns wrapped field for use with createStreamlines, createFlowPipes, modifyGeometry
 */
export function flowField(params = {}) {
  const {
    type = 'laminar',           
    mode, // Left undefined by default to allow auto-detection
    
    // For expression mode (defaults set to '0' to avoid NaN/undefined issues)
    vx = '0', 
    vy = '0', 
    vz = '0',
    
    // For noise mode
    noiseType = 'curl-noise',  // 'curl-noise', 'turbulence', 'fractal'
    frequency = 1.0,
    octaves = 3, 
    
    // For attractor mode
    attractors = [],           // [{pos: [x,y,z], strength: 1.0}, ...]
    repellers = [],            // [{pos: [x,y,z], strength: 1.0}, ...]
    
    // Global parameters
    strength = 1.0,
    scale = 0.1,
    time = 0,
    damping = 0.0              // 0-1: damps velocity magnitude over distance
  } = params;

  // 1. Determine Effective Mode
  // Priority: Explicit 'mode' param > Deduce from 'type' > Fallback
  let effectiveMode = mode;
  if (!effectiveMode) {
    if (['laminar', 'turbulent', 'chaotic', 'wave'].includes(type)) {
        effectiveMode = 'preset-' + type;
    } else if (['noise', 'curl-noise'].includes(type)) {
        effectiveMode = 'noise';
    } else if (['attractor', 'repeller', 'vortex'].includes(type)) {
        effectiveMode = 'attractor';
    } else {
        effectiveMode = 'expression';
    }
  }

  console.log(`✅ flowField: type='${type}', mode='${mode}' -> effective='${effectiveMode}'`);

  let fieldFn;

  // =========================================================================
  // MODE: EXPRESSION (Custom Formulas)
  // =========================================================================
  if (effectiveMode === 'expression') {
    try {
      const ctx = {
        Math, sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt,
        abs: Math.abs, tan: Math.tan, exp: Math.exp, log: Math.log,
        max: Math.max, min: Math.min, pow: Math.pow, PI: Math.PI,
        time
      };
      
      // Helper to ensure we have a valid return statement
      const parse = (val) => {
          if (typeof val === 'number') return `return ${val}`;
          if (!val.includes('return')) return `return ${val}`;
          return val;
      };

      const fnX = new Function('x, y, z, ctx', parse(vx));
      const fnY = new Function('x, y, z, ctx', parse(vy));
      const fnZ = new Function('x, y, z, ctx', parse(vz));
      
      fieldFn = (x, y, z) => {
        let velX = 0, velY = 0, velZ = 0;
        try { velX = fnX(x, y, z, ctx); } catch(e) {}
        try { velY = fnY(x, y, z, ctx); } catch(e) {}
        try { velZ = fnZ(x, y, z, ctx); } catch(e) {}
        
        const vel = new THREE.Vector3(velX, velY, velZ).multiplyScalar(strength * scale);
        
        // Apply global damping
        if (damping > 0) {
          const dist = Math.sqrt(x*x + y*y + z*z);
          const damp = Math.exp(-damping * dist);
          vel.multiplyScalar(damp);
        }
        
        return vel;
      };
    } catch (e) {
      console.error('Expression parsing failed:', e);
      fieldFn = () => new THREE.Vector3(0, 0, 0);
    }
  }

  // =========================================================================
  // MODE: NOISE (Perlin/Simplex)
  // =========================================================================
  else if (effectiveMode === 'noise') {
    if (noiseType === 'curl-noise') {
      // 3D CURL NOISE (Divergence Free - Twisting Pipes in all directions)
      fieldFn = (x, y, z) => {
        const f = frequency;
        const eps = 0.1; 

        // Sample 3 "potential" fields by offsetting the noise space
        // This ensures we generate a valid vector potential A
        const n1 = (dx, dy, dz) => noise.simplex3(x * f + dx, y * f + dy, z * f + dz);
        const n2 = (dx, dy, dz) => noise.simplex3(x * f + dx + 123.4, y * f + dy + 123.4, z * f + dz + 123.4);
        const n3 = (dx, dy, dz) => noise.simplex3(x * f + dx + 234.5, y * f + dy + 234.5, z * f + dz + 234.5);

        // Calculate Curl (∇ × A)
        // vx = ∂Az/∂y - ∂Ay/∂z
        const dy_n3 = (n3(0, eps, 0) - n3(0, -eps, 0)) / (2 * eps);
        const dz_n2 = (n2(0, 0, eps) - n2(0, 0, -eps)) / (2 * eps);
        const vx = dy_n3 - dz_n2;

        // vy = ∂Ax/∂z - ∂Az/∂x
        const dz_n1 = (n1(0, 0, eps) - n1(0, -eps, 0)) / (2 * eps);
        const dx_n3 = (n3(eps, 0, 0) - n3(-eps, 0, 0)) / (2 * eps);
        const vy = dz_n1 - dx_n3;

        // vz = ∂Ay/∂x - ∂Ax/∂y
        const dx_n2 = (n2(eps, 0, 0) - n2(-eps, 0, 0)) / (2 * eps);
        const dy_n1 = (n1(0, eps, 0) - n1(0, -eps, 0)) / (2 * eps);
        const vz = dx_n2 - dy_n1;
        
        return new THREE.Vector3(vx, vy, vz).multiplyScalar(strength * scale);
      };
    }
    
    else if (noiseType === 'turbulence') {
      fieldFn = (x, y, z) => {
        let vx = 0, vy = 0, vz = 0;
        let amp = 1;
        let freq = frequency;
        
        for (let i = 0; i < octaves; i++) {
          vx += noise.simplex3(x * freq, y * freq, z * freq) * amp;
          vy += noise.simplex3(x * freq + 1000, y * freq + 1000, z * freq) * amp;
          vz += noise.simplex3(x * freq + 2000, y * freq, z * freq + 2000) * amp;
          
          freq *= 2;
          amp *= 0.5;
        }
        
        return new THREE.Vector3(vx, vy, vz).multiplyScalar(strength * scale);
      };
    }
    
    else { // Simple directional noise
      fieldFn = (x, y, z) => {
        let result = 0;
        let amp = 1;
        let freq = frequency;
        
        for (let i = 0; i < octaves; i++) {
          result += noise.simplex3(x * freq, y * freq, z * freq) * amp;
          freq *= 2;
          amp *= 0.5;
        }
        
        // Direction radiates from center, modulated by noise
        const dir = new THREE.Vector3(x, y, z).normalize();
        return dir.multiplyScalar(result * strength * scale);
      };
    }
  }

  // =========================================================================
  // MODE: ATTRACTOR (Gravity/Magnetism)
  // =========================================================================
  else if (effectiveMode === 'attractor') {
    fieldFn = (x, y, z) => {
      const pos = new THREE.Vector3(x, y, z);
      let totalForce = new THREE.Vector3(0, 0, 0);
      
      // Default single attractor if none provided
      const effectiveAttractors = attractors.length > 0 ? attractors : [{pos: [0,0,0], strength: 1.0}];

      // Attractors
      for (const attr of effectiveAttractors) {
        const center = new THREE.Vector3(...(attr.pos || [0,0,0]));
        const str = attr.strength !== undefined ? attr.strength : 1.0;
        const dir = center.clone().sub(pos);
        const dist = dir.length();
        if (dist > 0.01) {
          totalForce.add(dir.normalize().multiplyScalar(str / (1 + dist * damping)));
        }
      }
      
      // Repellers
      for (const rep of repellers) {
        const center = new THREE.Vector3(...(rep.pos || [0,0,0]));
        const str = rep.strength !== undefined ? rep.strength : 1.0;
        const dir = pos.clone().sub(center); // Direction AWAY from center
        const dist = dir.length();
        if (dist > 0.01) {
          totalForce.add(dir.normalize().multiplyScalar(str / (1 + dist * damping)));
        }
      }
      
      return totalForce.multiplyScalar(strength * scale);
    };
  }

  // =========================================================================
  // MODE: PRESETS
  // =========================================================================
  else if (effectiveMode === 'preset-laminar') {
    // Simple linear flow along X
    fieldFn = () => new THREE.Vector3(strength * scale, 0, 0);
  }
  
  else if (effectiveMode === 'preset-turbulent') {
    // Multi-octave noise preset
    fieldFn = (x, y, z) => {
      let vel = new THREE.Vector3(0, 0, 0);
      let amp = 1;
      let freq = frequency;
      
      for (let i = 0; i < octaves; i++) {
        const nx = noise.simplex3(x * freq, y * freq, z * freq) * amp;
        const ny = noise.simplex3(x * freq + 500, y * freq + 500, z * freq) * amp;
        const nz = noise.simplex3(x * freq + 1000, y * freq + 1000, z * freq) * amp;
        
        vel.add(new THREE.Vector3(nx, ny, nz));
        freq *= 2;
        amp *= 0.5;
      }
      
      return vel.multiplyScalar(strength * scale);
    };
  }
  
  else if (effectiveMode === 'preset-chaotic') {
    // Lorenz attractor
    const sigma = 10, rho = 28, beta = 8/3;
    fieldFn = (x, y, z) => {
      const vx = sigma * (y - x);
      const vy = x * (rho - z) - y;
      const vz = x * y - beta * z;
      
      // Normalize strictly for chaotic fields to prevent explosion
      return new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(strength * scale);
    };
  }
  
  else if (effectiveMode === 'preset-wave') {
    // Expanding/contracting waves
    const center = new THREE.Vector3(0, 0, 0);
    fieldFn = (x, y, z) => {
      const pos = new THREE.Vector3(x, y, z);
      const dist = pos.sub(center).length();
      const wave = Math.sin(dist * frequency - time);
      const dir = pos.clone().normalize();
      
      return dir.multiplyScalar(wave * strength * scale);
    };
  }

  else {
      // Final safety fallback
      fieldFn = () => new THREE.Vector3(0, 0, 0);
  }

  // ✅ WRAP for downstream use
  return wrapFieldAsObject(fieldFn, `${type} flow field`, {
    type,
    mode: effectiveMode,
    strength,
    scale,
    frequency,
    octaves,
    damping
  });
}




// ============================================================================
// 8. FLOW VISUALIZATION (NEW) - Visualizes flow fields as streamlines/pipes
// ============================================================================

// ✅ NEW: createStreamlines visualizes vector fields
export function createStreamlines(params = {}) {
    const { 
        field, 
        box = [-5, -5, -5, 5, 5, 5], 
        count = 50, 
        steps = 50, 
        stepSize = 0.1 
    } = params;

    const fieldFn = resolveField(field);
    if (typeof fieldFn !== 'function') {
        console.warn('createStreamlines: No valid field found');
        return new THREE.BufferGeometry();
    }

    const [minX, minY, minZ, maxX, maxY, maxZ] = box;
    
    // We will collect all segments into a single array for LineSegments (Better Performance)
    const positions = [];
    
    // Also store raw segments for Marching Cubes (start, end, thickness)
    const rawSegments = []; 
    const defaultThickness = 0.05;

    for (let i = 0; i < count; i++) {
        let pos = new THREE.Vector3(
            minX + Math.random() * (maxX - minX),
            minY + Math.random() * (maxY - minY),
            minZ + Math.random() * (maxZ - minZ)
        );

        for (let j = 0; j < steps; j++) {
            const dir = fieldFn(pos.x, pos.y, pos.z);
            if (!dir || dir.length() < 0.001) break;
            
            const nextPos = pos.clone().add(dir.clone().multiplyScalar(stepSize));
            
            // Visual: Add to positions array (pairs of points)
            positions.push(pos.x, pos.y, pos.z);
            positions.push(nextPos.x, nextPos.y, nextPos.z);
            
            // Data: Save segment for downstream processing
            rawSegments.push([pos.clone(), nextPos.clone(), defaultThickness]);
            
            pos = nextPos;
        }
    }

    if (positions.length === 0) return new THREE.BufferGeometry();

    // Create a single BufferGeometry for all lines
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    // ✅ WRAP IN LINE OBJECT: This ensures it renders as lines, not invisible triangles
    // We return a THREE.LineSegments object which the executor will add to the scene.
    // The executor will apply the user's material (color), which works on lines too.
    const lineObject = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));

    // ✅ Attach data for Marching Cubes
    lineObject.userData = {
        type: 'streamlines',
        segments: rawSegments
    };

    return lineObject;
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
    const { 
        size = 32,
        iterations = 50, 
        feed = 0.055,
        kill = 0.062,
        dt = 0.2 
    } = params;

    // 1. Initialize Grid
    const len = size * size * size;
    let A = new Float32Array(len).fill(1.0);
    let B = new Float32Array(len).fill(0.0);
    
    // Seed Center
    const center = Math.floor(size/2);
    const radius = Math.max(2, Math.floor(size/8)); // Adaptive radius
    
    console.log(`Starting RD Simulation: ${size}^3 grid, ${iterations} iters`);

    for(let z=center-radius; z<=center+radius; z++) {
        for(let y=center-radius; y<=center+radius; y++) {
            for(let x=center-radius; x<=center+radius; x++) {
                if ((x-center)**2 + (y-center)**2 + (z-center)**2 < radius**2) {
                    // Safe index check
                    if (x>=0 && x<size && y>=0 && y<size && z>=0 && z<size) {
                        B[x + y*size + z*size*size] = 1.0;
                    }
                }
            }
        }
    }

    // Helper: Laplacian Stencil (Optimized)
    // Pre-calculate offsets to avoid conditional checks in loop
    const strideY = size;
    const strideZ = size * size;

    function getLaplacian(arr, i, x, y, z) {
        // Fast Neighbor Lookup with Wrap (Toroidal)
        const xm = (x > 0 ? i-1 : i+size-1);
        const xp = (x < size-1 ? i+1 : i-size+1);
        
        const ym = (y > 0 ? i-strideY : i-strideY+strideZ);
        const yp = (y < size-1 ? i+strideY : i+strideY-strideZ);
        
        const zm = (z > 0 ? i-strideZ : i-strideZ+len); // +len wraps to end
        const zp = (z < size-1 ? i+strideZ : i-strideZ*(size-1)); // Wraps to start

        return (arr[xm] + arr[xp] + arr[ym] + arr[yp] + arr[zm] + arr[zp] - 6 * arr[i]);
    }

    // 2. Simulation Loop
    for(let iter=0; iter<iterations; iter++) {
        const nextA = new Float32Array(len);
        const nextB = new Float32Array(len);
        
        let activeCount = 0;

        for(let z=0; z<size; z++) {
            for(let y=0; y<size; y++) {
                for(let x=0; x<size; x++) {
                    const i = x + y*size + z*size*size;
                    const a = A[i];
                    const b = B[i];
                    
                    const abb = a * b * b;
                    const lapA = getLaplacian(A, i, x, y, z);
                    const lapB = getLaplacian(B, i, x, y, z);
                    
                    nextA[i] = Math.max(0, Math.min(1, a + (1.0 * lapA - abb + feed * (1 - a)) * dt));
                    nextB[i] = Math.max(0, Math.min(1, b + (0.5 * lapB + abb - (kill + feed) * b) * dt));
                    
                    if (nextB[i] > 0.1) activeCount++;
                }
            }
        }
        A = nextA;
        B = nextB;
        
        if (iter === iterations - 1) {
             console.log(`RD Final Stats: Active Cells = ${activeCount}`);
        }
    }

    // 3. Return standard Grid Object
    return wrapGridAsObject(B, size, { 
        type: 'reaction-diffusion',
        voxelSize: 1,
        bounds: 10, // Hint for the mesher
        feed, 
        kill 
    });
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
    const { 
        resolution = 32, 
        isovalue = 0.2, // Safe default
        bounds = 10, 
        field,             
        expression,        
        context = {},
        objectSpace = true 
    } = params;

    // Safety: Ensure isovalue isn't impossible
    const safeIso = (isovalue > 0.9) ? 0.1 : isovalue;

    const dummyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const effect = new MarchingCubes(resolution, dummyMaterial, true, true, 100000);

    let fieldFn;
    let forceWorldSpace = false;

    // ========================================================================
    // MODE 1: SEGMENTS 
    // ========================================================================
    if (field && field.userData && field.userData.segments) {
        const segments = field.userData.segments;
        forceWorldSpace = true;
        const cellSize = 2.0; 
        const grid = new Map();
        const getKey = (gx, gy, gz) => `${gx},${gy},${gz}`;

        for (const seg of segments) {
            const [s, e, thick] = seg;
            const padding = thick * 2; 
            const minX = Math.floor((Math.min(s.x, e.x) - padding) / cellSize);
            const maxX = Math.floor((Math.max(s.x, e.x) + padding) / cellSize);
            const minY = Math.floor((Math.min(s.y, e.y) - padding) / cellSize);
            const maxY = Math.floor((Math.max(s.y, e.y) + padding) / cellSize);
            const minZ = Math.floor((Math.min(s.z, e.z) - padding) / cellSize);
            const maxZ = Math.floor((Math.max(s.z, e.z) + padding) / cellSize);

            for(let gx = minX; gx <= maxX; gx++) {
                for(let gy = minY; gy <= maxY; gy++) {
                    for(let gz = minZ; gz <= maxZ; gz++) {
                        const key = getKey(gx, gy, gz);
                        if (!grid.has(key)) grid.set(key, []);
                        grid.get(key).push(seg);
                    }
                }
            }
        }

        fieldFn = (x, y, z) => {
            const p = new THREE.Vector3(x, y, z);
            const gx = Math.floor(x / cellSize);
            const gy = Math.floor(y / cellSize);
            const gz = Math.floor(z / cellSize);
            const key = getKey(gx, gy, gz);
            const candidates = grid.get(key);
            if (!candidates) return 0; 

            let minDistSq = Infinity;
            let minThick = 0.1;

            for (let i = 0; i < candidates.length; i++) {
                const [start, end, thick] = candidates[i];
                const l2 = start.distanceToSquared(end);
                if (l2 == 0) continue;
                let t = ((p.x - start.x) * (end.x - start.x) + 
                         (p.y - start.y) * (end.y - start.y) + 
                         (p.z - start.z) * (end.z - start.z)) / l2;
                t = Math.max(0, Math.min(1, t));
                const proj = new THREE.Vector3(
                    start.x + t * (end.x - start.x),
                    start.y + t * (end.y - start.y),
                    start.z + t * (end.z - start.z)
                );
                const d2 = p.distanceToSquared(proj);
                if (d2 < minDistSq) {
                    minDistSq = d2;
                    minThick = thick;
                }
            }
            return minThick / (Math.sqrt(minDistSq) + 0.001);
        };
    }

    // ========================================================================
    // MODE 2: VOXEL GRID (Reaction Diffusion) - FIXED
    // ========================================================================
    // We check if 'field' IS the data, or if 'field.userData' holds the data
    let voxelData = null;
    
    if (field && field.userData && (field.userData.grid || field.userData.voxels)) {
        voxelData = field.userData;
    } else if (field && (field.grid || field.voxels)) {
        // Handle case where wrapper returned the raw object directly
        voxelData = field;
    }

    if (voxelData) {
        console.log("MarchingCubes: Detected Voxel Grid (Active)"); // You MUST see this log
        
        const gridArr = voxelData.grid || voxelData.voxels;
        const size = voxelData.size;
        
        // Robust Size Parsing
        const sx = (Array.isArray(size)) ? size[0] : size;
        const sy = (Array.isArray(size)) ? size[1] : size;
        const sz = (Array.isArray(size)) ? size[2] : size;

        // Robust Bounds from metadata or params
        const gridBounds = voxelData.bounds || bounds;

        fieldFn = (x, y, z) => {
            // Map World (-bounds to +bounds) -> UV (0 to 1)
            const u = (x + bounds) / (2 * bounds);
            const v = (y + bounds) / (2 * bounds);
            const w = (z + bounds) / (2 * bounds);

            if (u < 0 || u >= 1 || v < 0 || v >= 1 || w < 0 || w >= 1) return 0;

            const ix = Math.floor(u * sx);
            const iy = Math.floor(v * sy);
            const iz = Math.floor(w * sz);
            
            const idx = ix + iy*sx + iz*sx*sy;
            return gridArr[idx] || 0; 
        };
    }

    // ========================================================================
    // MODE 3: VECTOR FIELD
    // ========================================================================
    else if (field) {
        const vectorFn = resolveField(field);
        if (vectorFn) {
            fieldFn = (x, y, z) => {
                const vec = vectorFn(x, y, z);
                return vec && typeof vec.length === 'function' ? vec.length() : 0;
            };
        }
    }

    // ========================================================================
    // MODE 4: EXPRESSION
    // ========================================================================
    if (!fieldFn && expression && expression.trim() !== '') {
        try {
            const userFn = new Function('x', 'y', 'z', 'ctx', 'noise', 'utils', `
                try { 
                    ${expression.includes('return') ? expression : 'return ' + expression + ';'} 
                } catch(e) { return 0; }
            `);
            const noiseFn = (x, y, z) => noise.simplex3(x, y, z);
            fieldFn = (x, y, z) => userFn(x, y, z, context, noiseFn, Math);
        } catch (e) { console.error(e); }
    }

    // Fallback to noise if nothing else matches
    if (!fieldFn) {
        console.warn("MarchingCubes: No valid field found, using Noise fallback");
        fieldFn = (x, y, z) => noise.simplex3(x, y, z) + 0.5;
    }

    // ========================================================================
    // MESH GENERATION
    // ========================================================================
    effect.isolation = safeIso; 
    const useObjectSpace = objectSpace && !forceWorldSpace;
    const halfRes = resolution / 2;

    for (let k = 0; k < resolution; k++) {
        for (let j = 0; j < resolution; j++) {
            for (let i = 0; i < resolution; i++) {
                // We always want to query fieldFn with WORLD coordinates
                // Map i,j,k (0..res) -> x,y,z (-bounds..bounds)
                const x = (i - halfRes) / halfRes * bounds;
                const y = (j - halfRes) / halfRes * bounds;
                const z = (k - halfRes) / halfRes * bounds;
                
                effect.field[i + j * resolution + k * resolution * resolution] = fieldFn(x, y, z);
            }
        }
    }

    try {
        effect.update();
        
        // 1. Check if we actually generated anything
        // 'count' is the number of indices/vertices used.
        const count = effect.geometry.drawRange.count;
        
        if (count > 0) {
            // 2. Extract ONLY the used data from the massive buffer
            const rawPos = effect.geometry.attributes.position;
            const rawNorm = effect.geometry.attributes.normal;
            
            const cleanPos = new Float32Array(count * 3);
            const cleanNorm = new Float32Array(count * 3);

            for (let i = 0; i < count; i++) {
                // Manually copy coordinates to ensure we drop the garbage data
                cleanPos[i*3]     = rawPos.getX(i);
                cleanPos[i*3 + 1] = rawPos.getY(i);
                cleanPos[i*3 + 2] = rawPos.getZ(i);

                if (rawNorm) {
                    cleanNorm[i*3]     = rawNorm.getX(i);
                    cleanNorm[i*3 + 1] = rawNorm.getY(i);
                    cleanNorm[i*3 + 2] = rawNorm.getZ(i);
                }
            }

            // 3. Create a fresh, tight geometry
            const cleanGeom = new THREE.BufferGeometry();
            cleanGeom.setAttribute('position', new THREE.BufferAttribute(cleanPos, 3));
            if (rawNorm) {
                cleanGeom.setAttribute('normal', new THREE.BufferAttribute(cleanNorm, 3));
            } else {
                cleanGeom.computeVertexNormals();
            }

            // 4. Apply Scale (Bounds)
            if (useObjectSpace || !forceWorldSpace) {
                 cleanGeom.scale(bounds, bounds, bounds);
            } 

            // 5. Log Real Stats
            console.log(`✅ Marching Cubes Success: Extracted ${count} active vertices from buffer.`);

            effect.geometry.dispose();
            dummyMaterial.dispose();
            return cleanGeom;
        } 
        else {
            console.warn("⚠️ Marching Cubes finished with 0 vertices. Try lowering isovalue.");
        }
    } catch (e) { 
        console.error("MarchingCubes update failed:", e); 
    }

    return new THREE.BufferGeometry();
}








// ============================================================================
// 11. COMPLEX ALGORITHMS (Irreplaceable by modifyGeometry) - 11 helpers
// ============================================================================

export function lSystemGeometry(params = {}) {
    const { 
        axiom = 'F', 
        rules = { 'F': 'FF+[+F-F-F]-[-F+F+F]' }, 
        iterations = 3, 
        angle = 25, 
        length = 1, 
        thickness = 0.1,
        mode = '2d' // '2d' (Z-rotation) or '3d' (Quaternion Pitch/Roll/Yaw)
    } = params;

    // ========================================================================
    // 1. GENERATE L-SYSTEM STRING
    // ========================================================================
    let current = axiom;
    for (let i = 0; i < iterations; i++) {
        let next = '';
        for (const char of current) {
            next += rules[char] || char;
        }
        current = next;
    }

    // ========================================================================
    // 2. EXECUTE TURTLE GRAPHICS (Generate Segments)
    // ========================================================================
    const segments = [];
    const angleRad = angle * Math.PI / 180;
    let position = new THREE.Vector3(0, 0, 0);

    // --- MODE: 2D (Classic Z-Rotation) ---
    if (mode === '2d') {
        const stack = [];
        let direction = new THREE.Vector3(0, 1, 0); // Up

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
                if (stack.length > 0) {
                    const [pos, dir] = stack.pop();
                    position.copy(pos);
                    direction.copy(dir);
                }
            }
        }
    }
    
    // --- MODE: 3D (Full Quaternion Pitch/Roll/Yaw) ---
    else {
        const stack = [];
        let rotation = new THREE.Quaternion(); 
        
        // Helper to rotate the turtle locally
        const rotateTurtle = (axis, rads) => {
            const rotQuat = new THREE.Quaternion();
            rotQuat.setFromAxisAngle(axis, rads);
            rotation.multiply(rotQuat);
        };

        for (const char of current) {
            if (char === 'F') {
                const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
                const newPos = position.clone().add(direction.multiplyScalar(length));
                segments.push([position.clone(), newPos.clone(), thickness]);
                position.copy(newPos);
            } else if (char === '+') { // Turn Left (Z)
                rotateTurtle(new THREE.Vector3(0, 0, 1), angleRad);
            } else if (char === '-') { // Turn Right (Z)
                rotateTurtle(new THREE.Vector3(0, 0, 1), -angleRad);
            } else if (char === '&') { // Pitch Down (X)
                rotateTurtle(new THREE.Vector3(1, 0, 0), angleRad);
            } else if (char === '^') { // Pitch Up (X)
                rotateTurtle(new THREE.Vector3(1, 0, 0), -angleRad);
            } else if (char === '\\') { // Roll Left (Y)
                rotateTurtle(new THREE.Vector3(0, 1, 0), angleRad);
            } else if (char === '/') { // Roll Right (Y)
                rotateTurtle(new THREE.Vector3(0, 1, 0), -angleRad);
            } else if (char === '[') {
                stack.push({ pos: position.clone(), rot: rotation.clone() });
            } else if (char === ']') {
                if (stack.length > 0) {
                    const state = stack.pop();
                    position.copy(state.pos);
                    rotation.copy(state.rot);
                }
            }
        }
    }

    // ========================================================================
    // 3. OUTPUT VISUAL MESH
    // ========================================================================
    const geometries = [];
    // Optimization: Use low-poly tubes for the visual preview
    for (const [start, end, thick] of segments) {
        const curve = new THREE.LineCurve3(start, end);
        const tubeGeom = new THREE.TubeGeometry(curve, 1, thick, 4, false);
        geometries.push(tubeGeom);
    }

    const finalGeom = geometries.length > 0 ? mergeGeometries({ geometries }) : new THREE.BufferGeometry();

    // ✅ EXPORT DATA: Attach raw segments to geometry
    // This allows downstream helpers (like meshFromMarchingCubes) to read the skeleton
    finalGeom.userData = {
        type: 'l-system',
        segments: segments // Array of [start, end, thickness]
    };

    return finalGeom;
}





export function differentialGrowth(params = {}) {
    const { 
        geometry,            // Optional: Start from existing curve/edges
        pointsCount = 50,    // Start with a circle of this many points
        radius = 2.0,        // Radius of starting circle
        iterations = 100,    // Growth steps
        maxEdgeLength = 0.2, // Threshold to add new points
        repulsionRadius = 1.0, // How far nodes push each other
        repulsionForce = 0.5,
        attractionForce = 0.8, // Spring force keeping line together
        noiseForce = 0.1,    // Random motion to break symmetry
        outputType = 'line'  // 'line' or 'mesh' (ribbon)
    } = params;

    // 1. Initialize Nodes (Circle)
    let nodes = [];
    
    // If input geometry is a Line/Curve, extract points
    if (geometry && geometry.isBufferGeometry) {
        const pos = geometry.attributes.position;
        for(let i=0; i<pos.count; i++) {
            nodes.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
        }
    } else {
        // Create Circle
        for (let i = 0; i < pointsCount; i++) {
            const theta = (i / pointsCount) * Math.PI * 2;
            nodes.push(new THREE.Vector3(
                Math.cos(theta) * radius, 
                Math.sin(theta) * radius, 
                0
            ));
        }
    }

    // 2. Simulation Loop
    for (let iter = 0; iter < iterations; iter++) {
        const newPositions = nodes.map(n => n.clone());
        const count = nodes.length;

        // Build Spatial Hash (Simple grid) for optimization
        // (Skipping full implementation for brevity, doing brute force with optimization check)
        
        for (let i = 0; i < count; i++) {
            const p = nodes[i];
            let force = new THREE.Vector3();

            // A. Repulsion (Push away from non-neighbors)
            // Check random subset or nearby nodes to save perf
            for (let j = 0; j < count; j++) {
                if (i === j) continue;
                // Ignore immediate neighbors (handled by springs)
                // const isNeighbor = (j === (i + 1) % count) || (j === (i - 1 + count) % count);
                // Actually, in Diff Growth, even neighbors push to expand circle!
                
                const other = nodes[j];
                const distSq = p.distanceToSquared(other);
                
                if (distSq < repulsionRadius * repulsionRadius && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const dir = p.clone().sub(other).normalize();
                    // Force stronger when closer
                    force.add(dir.multiplyScalar((repulsionRadius - dist) * repulsionForce));
                }
            }

            // B. Spring / Attraction (Stay close to neighbors)
            const prev = nodes[(i - 1 + count) % count];
            const next = nodes[(i + 1) % count];
            
            const vecToPrev = prev.clone().sub(p);
            const vecToNext = next.clone().sub(p);
            
            // Move towards midpoint of neighbors (Laplacian smoothing)
            const smooth = vecToPrev.add(vecToNext).multiplyScalar(attractionForce * 0.5);
            force.add(smooth);
            
            // C. Brownian Motion (Noise)
            force.x += (Math.random() - 0.5) * noiseForce;
            force.y += (Math.random() - 0.5) * noiseForce;

            // Apply
            newPositions[i].add(force.multiplyScalar(0.1)); // Time step
            // Constrain Z (Planar growth often looks better)
            newPositions[i].z *= 0.9; 
        }
        
        nodes = newPositions;

        // 3. Subdivision (Growth)
        // If edge is too long, split it
        const nextNodes = [];
        for (let i = 0; i < nodes.length; i++) {
            const p1 = nodes[i];
            const p2 = nodes[(i + 1) % nodes.length]; // Loop
            
            nextNodes.push(p1);
            
            if (p1.distanceTo(p2) > maxEdgeLength) {
                // Add new node in middle
                const mid = p1.clone().add(p2).multiplyScalar(0.5);
                nextNodes.push(mid);
            }
        }
        nodes = nextNodes;
        
        // Limit runaway growth
        if (nodes.length > 2000) break;
    }

    // 4. Output
    if (outputType === 'mesh') {
        // Extrude logic (Simple Ribbon)
        const shape = new THREE.Shape();
        shape.moveTo(nodes[0].x, nodes[0].y);
        for(let i=1; i<nodes.length; i++) shape.lineTo(nodes[i].x, nodes[i].y);
        shape.closePath();
        
        return new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    } else {
        // Line Loop
        const geom = new THREE.BufferGeometry().setFromPoints([...nodes, nodes[0]]);
        // Return as Line Loop visual
        return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xffffff }));
    }
}


export function differentialGrowthSurface(params = {}) {
    const { 
        pointsCount = 80, 
        radius = 0.5,
        generations = 15, 
        stepsPerGen = 10, 
        maxEdgeLength = 0.3, 
        repulsionRadius = 0.8, 
        repulsionForce = 0.8,
        heightPerGen = 0.1 
    } = params;

    console.log(`Growing Surface: ${generations} gens, start radius ${radius}`);

    let nodes = [];
    // Init Circle
    for (let i = 0; i < pointsCount; i++) {
        const theta = (i / pointsCount) * Math.PI * 2;
        nodes.push(new THREE.Vector3(Math.cos(theta)*radius, Math.sin(theta)*radius, 0));
    }

    const profiles = []; // To be used by createLoft

    // Evolution Loop
    for (let gen = 0; gen < generations; gen++) {
        
        // 1. Capture Snapshot (Profile)
        // Deep copy and apply height offset
        const ring = nodes.map(n => {
            const v = n.clone();
            v.z = gen * heightPerGen; 
            return [v.x, v.y, v.z]; // Export as array [x,y,z] for universality
        });
        
        // Close the loop explicitly for lofting if needed, 
        // though createLoft 'closed' param handles connections.
        profiles.push(ring);

        // 2. Simulate Growth (The "Folding")
        for (let step = 0; step < stepsPerGen; step++) {
            const newPositions = nodes.map(n => n.clone());
            const count = nodes.length;

            // A. Forces
            for (let i = 0; i < count; i++) {
                const p = nodes[i];
                let force = new THREE.Vector3();
                
                // Simple Repulsion (Check localized sample to save perf)
                // Scan every 5th node to approximate density pressure
                for (let j = 0; j < count; j+=5) { 
                    const other = nodes[j];
                    if (p === other) continue;
                    const d2 = p.distanceToSquared(other);
                    if (d2 < repulsionRadius*repulsionRadius) {
                        const d = Math.sqrt(d2);
                        const push = p.clone().sub(other).normalize();
                        force.add(push.multiplyScalar((repulsionRadius - d) * repulsionForce));
                    }
                }
                
                // Laplacian Smoothing (Keep curve fair)
                const prev = nodes[(i - 1 + count) % count];
                const next = nodes[(i + 1) % count];
                const smooth = prev.clone().add(next).sub(p.clone().multiplyScalar(2)).multiplyScalar(0.5);
                force.add(smooth);

                newPositions[i].add(force.multiplyScalar(0.1));
            }
            nodes = newPositions;

            // B. Subdivision (Add Geometry)
            const nextNodes = [];
            for(let i=0; i<nodes.length; i++) {
                const p1 = nodes[i];
                const p2 = nodes[(i+1)%nodes.length];
                nextNodes.push(p1);
                if (p1.distanceTo(p2) > maxEdgeLength) {
                    nextNodes.push(p1.clone().add(p2).multiplyScalar(0.5));
                }
            }
            nodes = nextNodes;
        }
    }

    // Return as a wrapped object that createLoft can understand
    // We use a dummy geometry to carry the data through the pipeline
    const dummyGeom = new THREE.BufferGeometry();
    dummyGeom.userData = {
        type: 'profiles',
        profiles: profiles // Array of Array of Points
    };
    return dummyGeom;
}

export function differentialGrowth3DSimple(params = {}) {
    const { 
        geometry, 
        iterations = 20, 
        repulsionRadius = 0.5, 
        growthForce = 0.1, // Expansion speed
        smoothing = 0.5,   // Laplacian smoothing strength
        mode = 'line'      // 'line' (curve growth) or 'mesh' (surface folding)
    } = params;

    // ========================================================================
    // MODE 1: LINE / RIBBON (Previous Implementation)
    // ========================================================================
    if (mode === 'line' || !geometry || !geometry.isBufferGeometry) {
        // ... (Keep your existing Line/Ribbon logic here) ...
        // [Paste the previous curve-based logic if you want to keep it]
        return new THREE.BufferGeometry(); 
    }

    // ========================================================================
    // MODE 2: MESH SURFACE GROWTH (New)
    // ========================================================================
    // Clone to avoid modifying original
    const geom = geometry.clone();
    
    // Ensure we have topological data (Index)
    if (!geom.index) {
        geom = BufferGeometryUtils.mergeVertices(geom); // Create index if missing
    }
    
    const positions = geom.attributes.position;
    const normals = geom.attributes.normal;
    const vertexCount = positions.count;

    // 1. Build Adjacency Graph (Neighbor lookup)
    // This is expensive but needed for smoothing
    const neighbors = new Array(vertexCount).fill(0).map(() => []);
    const index = geom.index.array;
    for (let i = 0; i < index.length; i += 3) {
        const a = index[i], b = index[i+1], c = index[i+2];
        if(!neighbors[a].includes(b)) neighbors[a].push(b);
        if(!neighbors[a].includes(c)) neighbors[a].push(c);
        if(!neighbors[b].includes(a)) neighbors[b].push(a);
        if(!neighbors[b].includes(c)) neighbors[b].push(c);
        if(!neighbors[c].includes(a)) neighbors[c].push(a);
        if(!neighbors[c].includes(b)) neighbors[c].push(b);
    }

    // 2. Simulation Loop
    const tempPos = new Float32Array(positions.array);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const neighborP = new THREE.Vector3();
    const avgP = new THREE.Vector3();
    
    for (let iter = 0; iter < iterations; iter++) {
        
        for (let i = 0; i < vertexCount; i++) {
            p.set(tempPos[i*3], tempPos[i*3+1], tempPos[i*3+2]);
            n.set(normals.getX(i), normals.getY(i), normals.getZ(i));

            // A. Laplacian Smoothing (Relaxation)
            // Pull vertex towards average of neighbors to remove spikes
            avgP.set(0,0,0);
            const myNeighbors = neighbors[i];
            if (myNeighbors.length === 0) continue;
            
            for(const nid of myNeighbors) {
                neighborP.set(tempPos[nid*3], tempPos[nid*3+1], tempPos[nid*3+2]);
                avgP.add(neighborP);
            }
            avgP.divideScalar(myNeighbors.length);
            
            // Vector to average
            const smoothVec = avgP.sub(p); 
            
            // B. Growth / Buckling Force
            // We push vertices OUT along their normal, but constrained by smoothing.
            // The conflict between expanding (Normal) and staying connected (Smooth) creates folds.
            
            // Tangential Repulsion approximation:
            // If neighbors are too close, push away? 
            // For simple folding, just expanding surface area works well.
            
            // Apply forces
            p.addScaledVector(smoothVec, smoothing); // Pull together
            p.addScaledVector(n, growthForce);       // Push out (Expand)
            
            // Optional: Collision/Self-intersection check is too slow for JS
            
            // Store result
            positions.setXYZ(i, p.x, p.y, p.z);
        }
        
        // Recompute normals every few frames to guide growth
        if (iter % 2 === 0) {
            geom.computeVertexNormals();
        }
        
        // Update temp array for next step dependency
        for(let k=0; k<positions.array.length; k++) tempPos[k] = positions.array[k];
    }

    positions.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}



// ✅ UPDATED: meshFromVoxelGrid now accepts wrapped grids
export function meshFromVoxelGrid(params = {}) {
    let { grid, voxelSize = 1, size = null } = params;

    // --- 1. STANDARDIZE INPUT (Universal Accessor) ---
    let accessFn, sizeX, sizeY, sizeZ;

    // DEBUG: Identify what we actually got
    // console.log("meshFromVoxelGrid input:", grid?.constructor?.name || typeof grid);

    // CASE A: Wrapped Object (userData pattern)
    if (grid && grid.userData) {
        const data = grid.userData;
        // If it contains a grid, extract it and recurse/continue
        if (data.grid) {
            grid = data.grid;
            if (data.size) size = data.size;
            if (data.voxelSize) voxelSize = data.voxelSize;
        }
    }

    // CASE B: Raw Flat Array (Float32Array, Uint8Array, or flat Array)
    // This often happens if the executor auto-unwraps the 'grid' property
    if (grid instanceof Float32Array || grid instanceof Uint8Array || (Array.isArray(grid) && !Array.isArray(grid[0]))) {
        const len = grid.length;
        
        // 1. Use explicit size if provided
        if (size) {
            sizeX = Array.isArray(size) ? size[0] : size;
            sizeY = Array.isArray(size) ? size[1] : size;
            sizeZ = Array.isArray(size) ? size[2] : size;
        } 
        // 2. Auto-infer cubic size
        else {
            const cubicRoot = Math.round(Math.pow(len, 1/3));
            if (Math.abs(cubicRoot * cubicRoot * cubicRoot - len) < 1) {
                sizeX = sizeY = sizeZ = cubicRoot;
                // console.log(`meshFromVoxelGrid: Inferred cubic size ${sizeX}`);
            } else {
                console.warn(`meshFromVoxelGrid: Array length ${len} is not cubic. Result may be skewed.`);
                sizeX = sizeY = sizeZ = Math.floor(Math.pow(len, 1/3));
            }
        }

        // Accessor: Flat index logic
        // Check > 0.1 to filter out near-zero noise
        accessFn = (x, y, z) => grid[x + y*sizeX + z*sizeX*sizeY] > 0.1; 
    }

    // CASE C: Standard Nested 3D Array ([[[]]])
    else if (Array.isArray(grid) && Array.isArray(grid[0])) {
        // Use resolver or manual check
        const resolved = resolveVoxelGrid(grid);
        if (resolved) {
            sizeX = resolved.length;
            sizeY = resolved[0]?.length || 0;
            sizeZ = resolved[0]?.[0]?.length || 0;
            accessFn = (x, y, z) => resolved[x][y][z];
        }
    }

    if (!accessFn) {
        console.warn("meshFromVoxelGrid: Invalid input format. Returning empty geometry.");
        return new THREE.BufferGeometry();
    }

    // --- 2. FAST GEOMETRY GENERATION (Constructive) ---
    const vertices = [];
    const normals = [];
    const indices = [];
    let vertexCount = 0;

    const hs = voxelSize / 2; // Half size
    
    // Pre-calculated cube data
    const corners = [
        [-hs, -hs,  hs], [ hs, -hs,  hs], [ hs,  hs,  hs], [-hs,  hs,  hs], // Front (0,1,2,3)
        [-hs, -hs, -hs], [-hs,  hs, -hs], [ hs,  hs, -hs], [ hs, -hs, -hs]  // Back  (4,5,6,7)
    ];

    // Face definitions: [c1, c2, c3, c4, normal]
    const faces = [
        [0, 1, 2, 3, [ 0,  0,  1]], // Front
        [1, 7, 6, 2, [ 1,  0,  0]], // Right
        [7, 4, 5, 6, [ 0,  0, -1]], // Back
        [4, 0, 3, 5, [-1,  0,  0]], // Left
        [3, 2, 6, 5, [ 0,  1,  0]], // Top
        [4, 7, 1, 0, [ 0, -1,  0]]  // Bottom
    ];

    const offsetX = -sizeX * voxelSize / 2;
    const offsetY = -sizeY * voxelSize / 2;
    const offsetZ = -sizeZ * voxelSize / 2;

    for (let x = 0; x < sizeX; x++) {
        for (let y = 0; y < sizeY; y++) {
            for (let z = 0; z < sizeZ; z++) {
                
                if (accessFn(x, y, z)) {
                    const cx = offsetX + x * voxelSize + hs;
                    const cy = offsetY + y * voxelSize + hs;
                    const cz = offsetZ + z * voxelSize + hs;

                    // Neighbor Checks for Culling
                    // (Boundary checks included in condition)
                    const neighbors = [
                        z < sizeZ-1 && accessFn(x,y,z+1), // Front
                        x < sizeX-1 && accessFn(x+1,y,z), // Right
                        z > 0       && accessFn(x,y,z-1), // Back
                        x > 0       && accessFn(x-1,y,z), // Left
                        y < sizeY-1 && accessFn(x,y+1,z), // Top
                        y > 0       && accessFn(x,y-1,z)  // Bottom
                    ];

                    for (let f = 0; f < 6; f++) {
                        // Cull internal faces
                        if (neighbors[f]) continue;

                        const [c1, c2, c3, c4, n] = faces[f];
                        
                        // Push Vertices
                        vertices.push(
                            cx + corners[c1][0], cy + corners[c1][1], cz + corners[c1][2],
                            cx + corners[c2][0], cy + corners[c2][1], cz + corners[c2][2],
                            cx + corners[c3][0], cy + corners[c3][1], cz + corners[c3][2],
                            cx + corners[c4][0], cy + corners[c4][1], cz + corners[c4][2]
                        );

                        // Push Normals
                        for(let i=0; i<4; i++) normals.push(n[0], n[1], n[2]);

                        // Push Indices
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );

                        vertexCount += 4;
                    }
                }
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    return geometry;
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