// ============================================================================
// resolvers.js - CENTRALIZED INPUT NORMALIZATION LAYER
// ============================================================================
// Philosophy: Helpers don't need to know about unwrapping. Resolvers do it once.
// All input type conversions happen here, keeping helpers clean and composable.
// ============================================================================

import * as THREE from 'three';

/**
 * Resolve any input to a THREE.Curve object
 * Handles:
 *   - THREE.Curve (already a curve)
 *   - THREE.Line/Mesh with userData.curve (wrapped visual)
 *   - Array of points (converts to spline)
 */
export function resolveCurve(input, divisions = 32) {
    if (!input) return null;

    // Already a curve?
    if (input && typeof input.getPoint === 'function') {
        return input;
    }

    // Wrapped in a visual object? (Our protocol: line.userData.curve)
    if (input && input.userData && input.userData.curve) {
        return input.userData.curve;
    }

    // Array of points → convert to spline
    if (Array.isArray(input)) {
        const points = input.map(p => 
            Array.isArray(p) ? new THREE.Vector3(...p) : p
        );
        if (points.length < 2) return null;
        return new THREE.CatmullRomCurve3(points, false);
    }

    return null;
}

/**
 * Resolve any input to a points array (3D Vector3 or [x,y,z])
 * Handles:
 *   - THREE.Curve (samples it)
 *   - THREE.Line/Mesh with userData.curve (unwraps and samples)
 *   - Raw array of points
 *   - BufferGeometry (extracts positions)
 */
export function resolvePoints(input, divisions = 32) {
    if (!input) return [];

    // It's a curve? Sample it
    if (input && typeof input.getPoints === 'function') {
        return input.getPoints(divisions);
    }

    // Wrapped visual object with curve?
    if (input && input.userData && input.userData.curve) {
        return input.userData.curve.getPoints(divisions);
    }

    // Already an array of points?
    if (Array.isArray(input)) {
        return input.map(p => 
            Array.isArray(p) ? new THREE.Vector3(...p) : p
        );
    }

    // BufferGeometry? Extract positions
    if (input && (input.isBufferGeometry || input.attributes?.position)) {
        const positions = input.attributes.position;
        const points = [];
        for (let i = 0; i < positions.count; i++) {
            points.push(new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            ));
        }
        return points;
    }

    return [];
}

/**
 * Resolve any input to a 2D points array (for Lathe, 2D profiles, etc.)
 * Same as resolvePoints but returns Vector2 instead of Vector3
 */
export function resolvePoints2D(input, divisions = 32) {
    const points3D = resolvePoints(input, divisions);
    return points3D.map(p => new THREE.Vector2(p.x, p.y));
}

/**
 * Resolve any input to a vector field function
 * Handles:
 *   - Functions (already a field)
 *   - Objects with userData.field (wrapped field)
 *   - Returns null field (zero vector) as fallback
 */
export function resolveField(input) {
    if (!input) {
        return () => new THREE.Vector3(0, 0, 0);
    }

    if (typeof input === 'function') {
        return input;
    }

    if (input && input.userData && typeof input.userData.field === 'function') {
        return input.userData.field;
    }

    // Fallback: null field
    return () => new THREE.Vector3(0, 0, 0);
}

/**
 * Resolve any input to a voxel grid (3D array of 0s and 1s)
 * Handles:
 *   - Raw 3D array
 *   - Objects with userData.grid (wrapped grid from cellularAutomata)
 */
export function resolveVoxelGrid(input) {
    if (!input) return null;

    // Raw grid array?
    if (Array.isArray(input) && input.length > 0) {
        return input;
    }

    // Wrapped grid object?
    if (input && input.userData && input.userData.grid) {
        return input.userData.grid;
    }

    return null;
}

/**
 * ============================================================================
 * WRAPPER PROTOCOL: All helpers that return non-Geometries should use these
 * ============================================================================
 */

/**
 * Wrap a Curve as a THREE.Line (visual) with source data attached
 * This makes curves renderable by the Executor while preserving the math object
 */
export function wrapCurveAsLine(curve, divisions = 32, color = 0xffffff) {
    if (!curve) return null;

    const points = curve.getPoints(divisions);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);

    // CRITICAL: Attach source data for downstream helpers
    line.userData.curve = curve;
    line.userData.type = 'curve';
    line.userData.divisions = divisions;

    return line;
}

/**
 * Wrap a vector field function as an object with attached function
 * This makes fields storable and passable to downstream helpers
 */
export function wrapFieldAsObject(fieldFn, description = '') {
    const wrapper = {};
    wrapper.userData = {
        field: fieldFn,
        type: 'field',
        description
    };
    return wrapper;
}

/**
 * Wrap a voxel grid (3D array) as an object with attached metadata
 * Separates data generation from rendering
 */
export function wrapGridAsObject(grid, gridSize, metadata = {}) {
    const wrapper = {};
    wrapper.userData = {
        grid: grid,
        gridSize: gridSize,
        type: 'voxelGrid',
        ...metadata
    };
    return wrapper;
}

/**
 * Wrap a set of points as an object (for reuse in multiple contexts)
 */
export function wrapPointsAsObject(points, description = '') {
    const wrapper = {};
    wrapper.userData = {
        points: points,
        type: 'pointSet',
        description
    };
    return wrapper;
}

/**
 * ============================================================================
 * QUERY HELPERS: Check what type something is (useful in schema logic)
 * ============================================================================
 */

export function isCurve(obj) {
    return obj && (typeof obj.getPoint === 'function' || 
                   (obj.userData && obj.userData.type === 'curve'));
}

export function isField(obj) {
    return obj && (typeof obj === 'function' || 
                   (obj.userData && obj.userData.type === 'field'));
}

export function isVoxelGrid(obj) {
    return obj && (Array.isArray(obj) || 
                   (obj.userData && obj.userData.type === 'voxelGrid'));
}

export function isPointSet(obj) {
    return obj && (Array.isArray(obj) || 
                   (obj.userData && obj.userData.type === 'pointSet'));
}

/**
 * ============================================================================
 * UTILITIES: Common operations on resolved data
 * ============================================================================
 */

/**
 * Sample a curve or any resolvable input at a specific parameter
 */
export function sampleCurveAt(input, t = 0.5, divisions = 32) {
    const curve = resolveCurve(input, divisions);
    if (!curve) return new THREE.Vector3(0, 0, 0);
    return curve.getPoint(Math.max(0, Math.min(1, t)));
}

/**
 * Get tangent vector from a curve or resolvable input
 */
export function getCurveTangentAt(input, t = 0.5, divisions = 32) {
    const curve = resolveCurve(input, divisions);
    if (!curve) return new THREE.Vector3(0, 1, 0);
    return curve.getTangent(Math.max(0, Math.min(1, t))).normalize();
}

/**
 * Evaluate a field at a specific point (handles wrapped fields)
 */
export function evaluateFieldAt(field, x = 0, y = 0, z = 0) {
    const fieldFn = resolveField(field);
    return fieldFn(x, y, z);
}

export default {
    // Core resolvers
    resolveCurve,
    resolvePoints,
    resolvePoints2D,
    resolveField,
    resolveVoxelGrid,

    // Wrappers
    wrapCurveAsLine,
    wrapFieldAsObject,
    wrapGridAsObject,
    wrapPointsAsObject,

    // Query helpers
    isCurve,
    isField,
    isVoxelGrid,
    isPointSet,

    // Utilities
    sampleCurveAt,
    getCurveTangentAt,
    evaluateFieldAt
};