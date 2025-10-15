import * as THREE from 'three';

export const geometryPlugins = {
  box: ([w, h, d]) => new THREE.BoxGeometry(w, h, d),
  cylinder: ([rt, rb, h]) => new THREE.CylinderGeometry(rt, rb, h, 16),
  sphere: ([r]) => new THREE.SphereGeometry(r, 16, 12),
  plane: ([w, h]) => new THREE.PlaneGeometry(w, h),
  torus: ([r, t, rs = 8, ts = 24]) => new THREE.TorusGeometry(r, t, rs, ts),
  cone: ([r, h, rs = 8]) => new THREE.ConeGeometry(r, h, rs),

  extrude: (dims, evaluator = null, ctx = {}) => {
    if (!dims || !Array.isArray(dims.outer) || dims.outer.length < 3)
      return new THREE.BufferGeometry();

    // 1. Evaluate numeric exprs for shape outer
    const evalNumber = v =>
      typeof v === 'string' && evaluator ? evaluator.evaluate(v, ctx) : v;

    // 2. Build outer contour
    const outer = dims.outer.map(pt => [
      evalNumber(pt[0]),
      evalNumber(pt[1])
    ]);
    const shape = new THREE.Shape();
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; ++i)
      shape.lineTo(outer[i][0], outer[i][1]);
    shape.closePath();

    // 3. Add holes, if any
    if (Array.isArray(dims.holes)) {
      for (const holePoly of dims.holes) {
        if (!Array.isArray(holePoly) || holePoly.length < 3) continue;
        const h = new THREE.Path();
        h.moveTo(evalNumber(holePoly[0][0]), evalNumber(holePoly[0][1]));
        for (let i = 1; i < holePoly.length; ++i)
          h.lineTo(evalNumber(holePoly[i][0]), evalNumber(holePoly[i][1]));
        h.closePath();
        shape.holes.push(h);
      }
    }

    // 4. Collect options, insert extrudePath if provided
    const opts = {
      depth: 0.1,
      steps: 1,
      curveSegments: 12,
      bevelEnabled: false,
      ...(dims.options || {})
    };

    // Evaluate numeric options if passed as strings!
    for (const key of [
      "depth",
      "steps",
      "curveSegments",
      "bevelThickness",
      "bevelSize",
      "bevelOffset",
      "bevelSegments"
    ]) {
      if (typeof opts[key] === "string")
        opts[key] = evalNumber(opts[key]);
    }

    // Patch in extrudePath IF present and valid
    if (
      opts.extrudePath &&
      typeof opts.extrudePath.getPoint === "function"
    ) {
      // nothing to change, already correct
    } else {
      delete opts.extrudePath;
    }

    // 5. Return geometry
    try {
      const geom = new THREE.ExtrudeGeometry(shape, opts);
geom.computeVertexNormals();
return geom;
    } catch (e) {
      console.warn("Failed to extrude shape:", e);
      return new THREE.BufferGeometry(); // fallback, invisible
    }
  }
};
