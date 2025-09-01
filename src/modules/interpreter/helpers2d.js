// src/modules/interpreter/helpers2d.js

// Arc 
export function arc2d(cx, cy, r, a0, a1, clockwise = false, segments = 12) {
  const pts = [];
  const delta = clockwise
    ? (a0 - a1) / segments
    : (a1 - a0) / segments;
  for (let i = 0; i <= segments; ++i) {
    const angle = clockwise
      ? a0 - i * delta
      : a0 + i * delta;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

// Bézier quadratic or cubic: returns points along the curve
export function bezier2d(points, segments = 24) {
  const out = [];
  for (let t = 0; t <= 1; t += 1/segments) {
    let p = [0, 0];
    if (points.length === 3) { // Quadratic
      const [p0, p1, p2] = points;
      p[0] = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0];
      p[1] = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1];
    } else if (points.length === 4) { // Cubic
      const [p0, p1, p2, p3] = points;
      p[0] = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0];
      p[1] = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1];
    }
    out.push(p);
  }
  return out;
}

// Regular polygon points
export function polygon2d(cx, cy, r, sides = 3, rotation = 0) {
  const pts = [];
  for (let i = 0; i < sides; ++i) {
    const ang = rotation + i * 2 * Math.PI / sides;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return pts;
}

// Ellipse points (full or partial arc)
export function ellipse2d(cx, cy, rx, ry, a0 = 0, a1 = 2*Math.PI, segments = 24) {
  const pts = [];
  const da = (a1 - a0) / segments;
  for (let i = 0; i <= segments; ++i) {
    const a = a0 + i * da;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

// Spline (Catmull-Rom through points)
export function catmullRom2d(points, segments = 32, tension = 0.5) {
  const out = [];
  for (let i = 0; i < points.length - 1; ++i) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    for (let t = 0; t <= 1; t += 1/segments) {
      const t2 = t*t, t3 = t2*t;
      const a0 = -tension*t3 + 2*tension*t2 - tension*t;
      const a1 = (2-tension)*t3 + (tension-3)*t2 + 1;
      const a2 = (tension-2)*t3 + (3-2*tension)*t2 + tension*t;
      const a3 = tension*t3 - tension*t2;
      out.push([
        a0*p0[0] + a1*p1[0] + a2*p2[0] + a3*p3[0],
        a0*p0[1] + a1*p1[1] + a2*p2[1] + a3*p3[1]
      ]);
    }
  }
  return out;
}

function third(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
// Single segment version of Koch snowflake
export function kochSnowflake2d(p0, p1, level = 3) {
  function recur(a, b, lvl) {
    if (lvl === 0) return [a, b];
    const ab = third(a, b, 1 / 3), bb = third(a, b, 2 / 3);
    // peak point
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 3;
    const dx = (bb[0] - ab[0]), dy = (bb[1] - ab[1]);
    const len = Math.hypot(dx, dy);
    const px = ab[0] + Math.cos(angle) * len;
    const py = ab[1] + Math.sin(angle) * len;
    // 4 segments
    const seg1 = recur(a, ab, lvl - 1);
    const seg2 = recur(ab, [px, py], lvl - 1).slice(1);
    const seg3 = recur([px, py], bb, lvl - 1).slice(1);
    const seg4 = recur(bb, b, lvl - 1).slice(1);
    return [].concat(seg1, seg2, seg3, seg4);
  }
  return recur(p0, p1, level);
}

export function spiral2d(cx, cy, r0, turns, expansion = 1, pointsPerTurn = 24) {
  // Archimedean if expansion==1, else logarithmic.
  const pts = [];
  const steps = Math.ceil(turns * pointsPerTurn);
  for (let i = 0; i <= steps; ++i) {
    const theta = 2 * Math.PI * i / pointsPerTurn;
    const r = r0 * Math.pow(expansion, i / pointsPerTurn);
    pts.push([
      cx + r * Math.cos(theta),
      cy + r * Math.sin(theta)
    ]);
  }
  return pts;
}

// matrix3: [a, b, c, d, e, f, g, h, i] or 3x3 array
export function transform2d(points, matrix) {
  // matrix is 3x3 flat array or nested
  function mult(p) {
    const x = p[0], y = p[1];
    if (Array.isArray(matrix[0])) { // 3x3 nested
      return [
        matrix[0][0] * x + matrix[0][1] * y + matrix[0][2],
        matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]
      ];
    } else { // flat
      return [
        matrix[0] * x + matrix[1] * y + matrix[2],
        matrix[3] * x + matrix[4] * y + matrix[5]
      ];
    }
  }
  return points.map(mult);
}

// Mirror 2d
export function mirror2d(points, axis = 'x', value = 0) {
  return points.map(([x, y]) =>
    axis === 'x' ? [2 * value - x, y] : [x, 2 * value - y]
  );
}

// Offset 
// Needs a simple normal calculation, works best for convex/simple polygon (not robust for self-intersecting)
export function offset2d(points, distance) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; ++i) {
    const p0 = points[(i + n - 1) % n], p1 = points[i], p2 = points[(i + 1) % n];
    // Edge vectors
    const v0 = [p1[0] - p0[0], p1[1] - p0[1]];
    const v1 = [p2[0] - p1[0], p2[1] - p1[1]];
    // Normalize perpendiculars
    const n0 = [v0[1], -v0[0]], n1 = [v1[1], -v1[0]];
    const n0len = Math.hypot(n0[0], n0[1]), n1len = Math.hypot(n1[0], n1[1]);
    const n0n = [n0[0] / n0len, n0[1] / n0len], n1n = [n1[0] / n1len, n1[1] / n1len];
    // Average
    const nx = (n0n[0] + n1n[0]) * 0.5, ny = (n0n[1] + n1n[1]) * 0.5;
    const nlen = Math.hypot(nx, ny);
    out.push([p1[0] + (nx / nlen) * distance, p1[1] + (ny / nlen) * distance]);
  }
  return out;
}

export function roundedRect2d(cx, cy, width, height, r, segments = 8, rotation = 0) {
  // Safe radii and dimensions
  r = Math.min(r, width / 2, height / 2);
  const hw = width / 2 - r, hh = height / 2 - r;
  const centers = [
    [cx + hw, cy + hh],     // Top-right
    [cx - hw, cy + hh],     // Top-left
    [cx - hw, cy - hh],     // Bottom-left
    [cx + hw, cy - hh],     // Bottom-right
  ];
  const startAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
  const out = [];
  for (let c = 0; c < 4; ++c) {
    const center = centers[c];
    const theta0 = startAngles[c];
    // Use < instead of <= so corners don't duplicate points
    for (let s = 0; s < segments; ++s) {
      const t = s / segments;
      const a = theta0 + t * (Math.PI / 2);
      let x = center[0] + r * Math.cos(a), y = center[1] + r * Math.sin(a);
      if (rotation !== 0) {
        const dx = x - cx, dy = y - cy;
        const xr = cx + dx * Math.cos(rotation) - dy * Math.sin(rotation);
        const yr = cy + dx * Math.sin(rotation) + dy * Math.cos(rotation);
        out.push([xr, yr]);
      } else {
        out.push([x, y]);
      }
    }
  }
  out.push(out[0]); // close shape
  return out;
}



export function rect2d(cx, cy, width, height, rotation = 0) {
  const hw = width / 2, hh = height / 2;
  const pts = [
    [-hw, -hh], [ hw, -hh], [ hw, hh], [ -hw, hh]
  ];
  if (rotation === 0) return pts.map(([x, y]) => [cx + x, cy + y]);
  return pts.map(([x, y]) => [
    cx + x * Math.cos(rotation) - y * Math.sin(rotation),
    cy + x * Math.sin(rotation) + y * Math.cos(rotation)
  ]);
}


export function regularStar2d(cx, cy, rOuter, rInner, points, rotation = 0) {
  const out = [];
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; ++i) {
    const r = (i % 2 === 0) ? rOuter : rInner;
    const a = i * step + rotation;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  out.push(out[0]);
  return out;
}


export function catmullRomSpline2d(points, segments = 32, tension = 0.5) {
  // Basic, open spline (no wrapping). If you want closed spline, repeat start points.
  function get(i) {
    if (i < 0) return points[0];
    if (i >= points.length) return points[points.length - 1];
    return points[i];
  }
  const out = [];
  for (let i = 0; i < points.length - 1; ++i) {
    for (let j = 0; j < segments; ++j) {
      const t = j / segments;
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      // Catmull-Rom to cubic Bezier
      const t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * t2 +
          (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * t2 +
          (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}


export function polyline2d(points) {
  // Just returns/unwraps point list for compatibility
  return points.map(p => [p[0], p[1]]);
}


export function line2d(p0, p1, segments = 1) {
  const out = [];
  for (let i = 0; i <= segments; ++i) {
    const t = i / segments;
    out.push([
      p0[0] * (1 - t) + p1[0] * t,
      p0[1] * (1 - t) + p1[1] * t
    ]);
  }
  return out;
}
