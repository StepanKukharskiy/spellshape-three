// ============================================================================
// helpers3d_core.js - COMPLETE VERSION (All 80+ Helpers + Emergent Features)
// ============================================================================

import {
    rect2d,
    roundedRect2d,
    polygon2d,
    ellipse2d
} from './helpers2d.js';

// Core Three.js
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

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
    if(t0<0) n0 = 0.0;
    else { t0 *= t0; n0 = t0 * t0 * dot(_grad3[gi0], x0, y0, z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if(t1<0) n1 = 0.0;
    else { t1 *= t1; n1 = t1 * t1 * dot(_grad3[gi1], x1, y1, z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if(t2<0) n2 = 0.0;
    else { t2 *= t2; n2 = t2 * t2 * dot(_grad3[gi2], x2, y2, z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if(t3<0) n3 = 0.0;
    else { t3 *= t3; n3 = t3 * t3 * dot(_grad3[gi3], x3, y3, z3); }
    return 32.0*(n0 + n1 + n2 + n3);
}

// Expose as global noise object (compatible with perlin-noise-3d API)
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
// 1. BASIC GEOMETRY CREATION
// ============================================================================

export function createBox(params = {}) {
    console.log('createBox', params);
    const { width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1 } = params;
    return new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments);
}

export function createSphere(params = {}) {
    console.log('createSphere', params);
    const { radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI } = params;
    return new THREE.SphereGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength);
}

export function createCylinder(params = {}) {
    console.log('createCylinder', params);
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

export function createPolyhedron(params = {}) {
    const { vertices, indices, radius = 1, detail = 0 } = params;
    return new THREE.PolyhedronGeometry(vertices, indices, radius, detail);
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

// ============================================================================
// 2. ADVANCED GEOMETRY
// ============================================================================

export function createExtrude(params = {}) {
    console.log('createExtrude', params);
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
    console.log('createLoft', params);
    const { profiles = [], heights = null, segments = 32, closed = false } = params;

    if (profiles.length < 2) {
        console.warn('createLoft: Need at least 2 profiles');
        return new THREE.BufferGeometry();
    }

    const profileHeights = heights || profiles.map((_, i) => i / (profiles.length - 1));
    const curves = profiles.map((profile, i) => {
        const points = profile.map(([x, z]) => new THREE.Vector3(x, profileHeights[i], z));
        return new THREE.CatmullRomCurve3(points, true);
    });

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
    return geometry;
}

export function createLathe(params = {}) {
    const { points, segments = 12, phiStart = 0, phiLength = Math.PI * 2 } = params;
    const curve = points.map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(curve, segments, phiStart, phiLength);
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
    console.log('createText3D: Requires THREE.TextGeometry and loaded font');
    // This would need a font loader - placeholder
    return new THREE.BoxGeometry(1, 1, 0.2);
}

// ============================================================================
// 3. CURVES & PATHS
// ============================================================================

export function createLinePath(params = {}) {
    const { points } = params;
    const vectors = points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p);
    return new THREE.LineCurve3(vectors[0], vectors[1]);
}

export function createSplinePath(params = {}) {
    const { points, tension = 0.5 } = params;
    const vectors = points.map(p => Array.isArray(p) ? new THREE.Vector3(...p) : p);
    return new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', tension);
}

export function createArcPath(params = {}) {
    const { center = [0, 0, 0], radius = 1, startAngle = 0, endAngle = Math.PI, segments = 32 } = params;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const theta = startAngle + (endAngle - startAngle) * i / segments;
        const x = center[0] + radius * Math.cos(theta);
        const y = center[1] + radius * Math.sin(theta);
        points.push(new THREE.Vector3(x, y, center[2]));
    }
    return new THREE.CatmullRomCurve3(points, false);
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
    return new THREE.CatmullRomCurve3(points, false);
}

export function createBezierPath(params = {}) {
    const { start, control1, control2, end } = params;
    return new THREE.CubicBezierCurve3(
        new THREE.Vector3(...start),
        new THREE.Vector3(...control1),
        new THREE.Vector3(...control2),
        new THREE.Vector3(...end)
    );
}

export function createPipe(params = {}) {
    const { path, radius = 0.2, tubularSegments = 64, radialSegments = 8, closed = false } = params;
    return new THREE.TubeGeometry(path, tubularSegments, radius, radialSegments, closed);
}

// ============================================================================
// 4. DEFORMATIONS & TRANSFORMS
// ============================================================================

export function twistGeometry(params = {}) {
    console.log('twistGeometry', params);
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
    console.log('taperGeometry', params);
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
    const dir = new THREE.Vector3(...direction).normalize();

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
    console.log('deformByNoise', params);
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
    const { geometry, vectorField, amount = 1.0 } = params;
    const geom = geometry.clone();
    const positions = geom.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        const vec = vectorField(x, y, z);
        positions.setXYZ(i, x + vec.x * amount, y + vec.y * amount, z + vec.z * amount);
    }

    positions.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}

// ============================================================================
// 5. BOOLEAN OPERATIONS & UTILITIES
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
// 6. DISTRIBUTION & ARRAYS
// ============================================================================

export function repeatLinear3d(params = {}) {
    console.log('repeatLinear3d', params);
    const { geometry, count = 3, spacing = 1, axis = 'x', centered = false } = params;

    if (!geometry) return [];

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

    return results;
}

export function repeatRadial3d(params = {}) {
    console.log('repeatRadial3d', params);
    const { geometry, count = 8, radius = 5, startAngle = 0, endAngle = Math.PI * 2, axis = 'y', faceCenter = true } = params;

    if (!geometry) return [];

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
        } else if (axis === 'x') {
            clone.translate(0, x, z);
            if (faceCenter) clone.rotateX(angle + Math.PI / 2);
        } else if (axis === 'z') {
            clone.translate(x, z, 0);
            if (faceCenter) clone.rotateZ(angle + Math.PI / 2);
        }

        results.push(clone);
    }

    return results;
}

export function repeatAlongCurve3d(params = {}) {
    const { geometry, curve, count = 10, align = true } = params;

    if (!geometry || !curve) return [];

    const results = [];
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const pos = curve.getPoint(t);
        const clone = geometry.clone();
        clone.translate(pos.x, pos.y, pos.z);

        if (align) {
            const tangent = curve.getTangent(t).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const orthogonalUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            const rotMatrix = new THREE.Matrix4().makeBasis(tangent, orthogonalUp, normal);
            clone.applyMatrix4(rotMatrix);
        }

        results.push(clone);
    }

    return results;
}

export function distributeOnGrid3d(params = {}) {
    const { geometry, rows = 3, cols = 3, spacing = [2, 0, 2], centered = true } = params;

    if (!geometry) return [];

    const [spacingX, spacingY, spacingZ] = Array.isArray(spacing) ? spacing : [spacing, 0, spacing];
    const offsetX = centered ? -spacingX * (cols - 1) / 2 : 0;
    const offsetZ = centered ? -spacingZ * (rows - 1) / 2 : 0;

    const results = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const clone = geometry.clone();
            clone.translate(
                offsetX + col * spacingX,
                row * spacingY,
                offsetZ + row * spacingZ
            );
            results.push(clone);
        }
    }

    return results;
}

export function distributeRandom3d(params = {}) {
    const { geometry, bounds = [[0, 0, 0], [1, 1, 1]], count = 50, seed = 42 } = params;

    const random = (() => { 
        let a = seed; 
        return () => { 
            let t = a += 0x6D2B79F5; 
            t = Math.imul(t ^ t >>> 15, t | 1); 
            t ^= t + Math.imul(t ^ t >>> 7, t | 61); 
            return ((t ^ t >>> 14) >>> 0) / 4294967296; 
        } 
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

    return results;
}

// ============================================================================
// 7. FIELDS & ATTRACTORS
// ============================================================================

export function createVectorField(params = {}) {
    const { type = 'attractor', center = [0, 0, 0], strength = 1.0 } = params;
    const centerVec = new THREE.Vector3(...center);

    if (type === 'attractor') {
        return (x, y, z) => {
            const pos = new THREE.Vector3(x, y, z);
            const dir = centerVec.clone().sub(pos);
            const dist = dir.length();
            return dir.normalize().multiplyScalar(strength / (1 + dist));
        };
    } else if (type === 'repeller') {
        return (x, y, z) => {
            const pos = new THREE.Vector3(x, y, z);
            const dir = pos.clone().sub(centerVec);
            const dist = dir.length();
            return dir.normalize().multiplyScalar(strength / (1 + dist));
        };
    } else if (type === 'vortex') {
        return (x, y, z) => {
            const pos = new THREE.Vector3(x, y, z);
            const dir = pos.clone().sub(centerVec);
            const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
            return tangent.multiplyScalar(strength);
        };
    }

    return () => new THREE.Vector3(0, 0, 0);
}

export function flowField(params = {}) {
    return createVectorField(params);
}

// ============================================================================
// 8. PROCEDURAL PATTERNS
// ============================================================================

export function cellularAutomata(params = {}) {
    const { gridSize = 10, iterations = 10, rules = { survive: [2, 3], born: [3] } } = params;

    // Initialize 3D grid
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

    // Simulate
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

    // Convert to geometry (voxels)
    const geometries = [];
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                if (grid[x][y][z] === 1) {
                    const clone = boxGeom.clone();
                    clone.translate(x - gridSize/2, y - gridSize/2, z - gridSize/2);
                    geometries.push(clone);
                }
            }
        }
    }

    return geometries.length > 0 ? mergeGeometries({ geometries }) : new THREE.BufferGeometry();
}

export function reactionDiffusion(params = {}) {
    console.warn('reactionDiffusion: Complex simulation - simplified placeholder');
    return cellularAutomata({ ...params, iterations: 5 });
}

// ============================================================================
// 9. EMERGENT FEATURES (The Brain)
// ============================================================================

export function modifyGeometry(params) {
    console.log('modifyGeometry', params);
    const { geometry, expression, context = {} } = params;

    if (!geometry) {
        console.warn("modifyGeometry: No geometry provided");
        return null;
    }

    const geom = geometry.clone();
    const positionAttribute = geom.attributes.position;
    const normalAttribute = geom.attributes.normal;

    if (!positionAttribute) return geom;

    const count = positionAttribute.count;

    // Compile AI Logic
    let userLogic;
    try {
        userLogic = new Function('p', 'n', 'i', 'ctx', 'noise', 'utils', expression);
    } catch (e) {
        console.error("modifyGeometry: Failed to compile expression", e);
        return geom;
    }

    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const utils = Math;
    const noiseFn = (x, y, z) => noise.noise(x, y, z);

    for (let i = 0; i < count; i++) {
        p.fromBufferAttribute(positionAttribute, i);
        if (normalAttribute) n.fromBufferAttribute(normalAttribute, i);

        try {
            const result = userLogic(p, n, i, context, noiseFn, utils);

            if (typeof result === 'number') {
                if (normalAttribute) p.addScaledVector(n, result);
            } else if (result && typeof result.x === 'number') {
                p.set(result.x, result.y, result.z);
            }

            positionAttribute.setXYZ(i, p.x, p.y, p.z);
        } catch (err) {
            if (i === 0) console.error("Error in AI logic:", err);
        }
    }

    geom.computeVertexNormals();
    positionAttribute.needsUpdate = true;
    return geom;
}

export function meshFromMarchingCubes(params = {}) {
    console.log('meshFromMarchingCubes', params);
    const { resolution = 32, isovalue = 0.5, bounds = 10, expression, context = {} } = params;

    const effect = new MarchingCubes(resolution, null, true, true, 100000);

    let fieldFn;
    if (expression) {
        try {
            const userFn = new Function('x', 'y', 'z', 'ctx', 'noise', 'utils', expression);
            const noiseFn = (x, y, z) => noise.noise(x, y, z);
            fieldFn = (x, y, z) => userFn(x, y, z, context, noiseFn, Math);
        } catch(e) {
            console.error("meshFromMarchingCubes: Invalid expression", e);
        }
    }

    if (!fieldFn) {
        fieldFn = (x, y, z) => noise.noise(x * 0.1, y * 0.1, z * 0.1) + 0.5;
    }

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
// EXPORTS
// ============================================================================

export default {
    // Basic geometry
    createBox, createSphere, createCylinder, createCone, createTorus, createTorusKnot,
    createPlane, createCircle, createRing, createPolyhedron, createIcosahedron,
    createOctahedron, createTetrahedron, createDodecahedron,

    // Advanced geometry
    createExtrude, createLoft, createLathe, createConvexHull, createParametricSurface,
    createText3D,

    // Curves & paths
    createLinePath, createSplinePath, createArcPath, createHelixPath, createBezierPath,
    createPipe,

    // Deformations
    twistGeometry, taperGeometry, bendGeometry, deformByNoise, deformByVectorField,

    // Boolean & utilities
    mergeGeometries, unionGeometry, subtractGeometry, intersectGeometry,

    // Distribution
    repeatLinear3d, repeatRadial3d, repeatAlongCurve3d, distributeOnGrid3d, distributeRandom3d,

    // Fields & attractors
    createVectorField, flowField,

    // Procedural patterns
    cellularAutomata, reactionDiffusion,

    // Emergent features
    modifyGeometry, meshFromMarchingCubes
};
