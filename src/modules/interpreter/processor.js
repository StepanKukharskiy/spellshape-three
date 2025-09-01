import * as THREE from 'three';
import { distributionPlugins } from '../plugins/distribution.js';
import { arc2d, bezier2d, polygon2d, ellipse2d, catmullRom2d, line2d, polyline2d,
  regularStar2d, rect2d, roundedRect2d, offset2d, mirror2d, transform2d,
  spiral2d, kochSnowflake2d  } from './helpers2d.js';


function isArc2d(obj) { return obj && typeof obj === 'object' && obj.kind === 'arc'; }
function isBezier2d(obj) { return obj?.kind === 'bezier'; }
function isEllipse2d(obj) { return obj?.kind === 'ellipse'; }
function isPolygon2d(obj) { return obj?.kind === 'polygon'; }
function isSpline2d(obj) { return obj?.kind === 'spline'; }
function isLine2d(obj) { return obj?.kind === 'line'; }
function isPolyline2d(obj) { return obj?.kind === 'polyline'; }
function isRegularStar2d(obj) { return obj?.kind === 'star'; }
function isRect2d(obj) { return obj?.kind === 'rect'; }
function isRoundedRect2d(obj) { return obj?.kind === 'rounded_rect'; }
function isOffset2d(obj) { return obj?.kind === 'offset'; }
function isMirror2d(obj) { return obj?.kind === 'mirror'; }
function isTransform2d(obj) { return obj?.kind === 'transform'; }
function isSpiral2d(obj) { return obj?.kind === 'spiral'; }
function isKochSnowflake2d(obj) { return obj?.kind === 'koch_snowflake'; }

//console.log(arc2d(0, 2.2, 0.8, 0, Math.PI, false, 18));


export class FixedTemplateProcessor {
  constructor(evaluator) {
    this.evaluator = evaluator;
  }

  process(tpl, params, expr = {}, parentCtx = {}) {
    const ctx = this._resolveParams(params, expr, parentCtx);
    return this._walk(tpl, ctx);
  }

  _walk(list, ctx) {
    const out = [];
    for (const item of list) {
      if (item.type === 'repeat') out.push(...this._repeat(item, ctx));
      else out.push(this._item(item, ctx));
    }
    return out;
  }

  _repeat(rep, ctx) {
    const count = this.evaluator.evaluate(rep.count, ctx);
    const distro = distributionPlugins[rep.distribution?.type];
    const poses = distro ? distro(rep.distribution, count, ctx, this.evaluator) : Array(count).fill([0, 0, 0]);
    const res = [];
    for (let i = 0; i < count; i++) {
      const subCtx = { ...ctx, index: i };
      if (rep.instance_parameters) {
        for (const [k, expr] of Object.entries(rep.instance_parameters))
          subCtx[k] = this.evaluator.evaluate(expr, subCtx);
      }
      res.push({
        type: 'group',
        id: `${rep.id}_${i}`,
        position: poses[i],
        children: this._walk(rep.children, subCtx)
      });
    }
    return res;
  }

  _expandArcsInArray(arr, ctx) {
    const out = [];
    for (let elem of arr) {
      if (isArc2d(elem)) {
        const cx = this.evaluator.evaluate(elem.cx, ctx);
        const cy = this.evaluator.evaluate(elem.cy, ctx);
        const r = this.evaluator.evaluate(elem.r, ctx);
        const a0 = this.evaluator.evaluate(elem.a0, ctx);
        const a1 = this.evaluator.evaluate(elem.a1, ctx);
        const segments =
          elem.segments !== undefined
            ? this.evaluator.evaluate(elem.segments, ctx)
            : 12;
        const clockwise =
          elem.clockwise !== undefined
            ? !!this.evaluator.evaluate(elem.clockwise, ctx)
            : false;
        out.push(...arc2d(cx, cy, r, a0, a1, clockwise, segments));
      }  else if (isBezier2d(elem)) {
    out.push(...bezier2d(elem.points, elem.segments));
  } else if (isEllipse2d(elem)) {
    out.push(...ellipse2d(elem.cx, elem.cy, elem.rx, elem.ry, elem.a0, elem.a1, elem.segments));
  } else if (isPolygon2d(elem)) {
    out.push(...polygon2d(elem.cx, elem.cy, elem.r, elem.sides, elem.rotation));
  } else if (isSpline2d(elem)) {
    out.push(...catmullRom2d(elem.points, elem.segments, elem.tension));
  }  else if (isBezier2d(elem)) {
      out.push(...bezier2d(elem.points, elem.segments));
    } else if (isEllipse2d(elem)) {
      out.push(...ellipse2d(elem.cx, elem.cy, elem.rx, elem.ry, elem.a0, elem.a1, elem.segments));
    } else if (isPolygon2d(elem)) {
      out.push(...polygon2d(elem.cx, elem.cy, elem.r, elem.sides, elem.rotation));
    } else if (isSpline2d(elem)) {
      out.push(...catmullRom2d(elem.points, elem.segments, elem.tension));
    } 
    // --- New: ---
    else if (isLine2d(elem)) {
      const [p0, p1, segments] = [elem.p0, elem.p1, elem.segments ?? 1].map(e => 
        (typeof e === 'string' ? this.evaluator.evaluate(e, ctx) : e)
      );
      out.push(...line2d(p0, p1, segments));
    } else if (isPolyline2d(elem)) {
      out.push(...polyline2d(elem.points));
    } else if (isRegularStar2d(elem)) {
      out.push(...regularStar2d(
        this.evaluator.evaluate(elem.cx, ctx),
        this.evaluator.evaluate(elem.cy, ctx),
        this.evaluator.evaluate(elem.rOuter, ctx),
        this.evaluator.evaluate(elem.rInner, ctx),
        this.evaluator.evaluate(elem.points, ctx),
        elem.rotation ? this.evaluator.evaluate(elem.rotation, ctx) : 0
      ));
    } else if (isRect2d(elem)) {
      out.push(...rect2d(
        this.evaluator.evaluate(elem.cx, ctx),
        this.evaluator.evaluate(elem.cy, ctx),
        this.evaluator.evaluate(elem.width, ctx),
        this.evaluator.evaluate(elem.height, ctx),
        elem.rotation ? this.evaluator.evaluate(elem.rotation, ctx) : 0
      ));
    } else if (isRoundedRect2d(elem)) {
      out.push(...roundedRect2d(
        this.evaluator.evaluate(elem.cx, ctx),
        this.evaluator.evaluate(elem.cy, ctx),
        this.evaluator.evaluate(elem.width, ctx),
        this.evaluator.evaluate(elem.height, ctx),
        this.evaluator.evaluate(elem.r, ctx),
        elem.segments ? this.evaluator.evaluate(elem.segments, ctx) : 8,
        elem.rotation ? this.evaluator.evaluate(elem.rotation, ctx) : 0
      ));
    } else if (isOffset2d(elem)) {
      out.push(...offset2d(
        elem.points,
        this.evaluator.evaluate(elem.distance, ctx)
      ));
    } else if (isMirror2d(elem)) {
      out.push(...mirror2d(
        elem.points,
        elem.axis || 'x',
        elem.value !== undefined ? this.evaluator.evaluate(elem.value, ctx) : 0
      ));
    } else if (isTransform2d(elem)) {
      out.push(...transform2d(
        elem.points,
        elem.matrix
      ));
    } else if (isSpiral2d(elem)) {
      out.push(...spiral2d(
        this.evaluator.evaluate(elem.cx, ctx),
        this.evaluator.evaluate(elem.cy, ctx),
        this.evaluator.evaluate(elem.r0, ctx),
        this.evaluator.evaluate(elem.turns, ctx),
        elem.expansion ? this.evaluator.evaluate(elem.expansion, ctx) : 1,
        elem.pointsPerTurn ? this.evaluator.evaluate(elem.pointsPerTurn, ctx) : 24
      ));
    } else if (isKochSnowflake2d(elem)) {
      out.push(...kochSnowflake2d(
        elem.p0,
        elem.p1,
        elem.level !== undefined ? this.evaluator.evaluate(elem.level, ctx) : 3
      ));
    } else if (
        Array.isArray(elem) &&
        elem.length === 2 &&
        typeof elem[0] !== 'object' &&
        typeof elem[1] !== 'object'
      ) {
        // [x, y] point
        out.push(
          elem.map(v => (typeof v === 'string' ? this.evaluator.evaluate(v, ctx) : v))
        );
      } else if (Array.isArray(elem)) {
        // Nested path/hole—recurse and flatten
        out.push(...this._expandArcsInArray(elem, ctx));
      } // else: skip
    }
    return out;
  }

  _compilePathSpec(spec) {
    if (!spec || typeof spec !== 'object') return null;
    // Compose a single array of points
    if (spec.type === 'points' && Array.isArray(spec.points)) {
      const pts = spec.points.map(p =>
        new THREE.Vector3(
          Number(p[0]) || 0,
          Number(p[1]) || 0,
          Number(p[2]) || 0
        )
      );
      return new THREE.CatmullRomCurve3(pts, !!spec.closed, spec.curveType || 'centripetal', spec.tension ?? 0.5);
    }
    if (spec.type === 'segments' && Array.isArray(spec.segments)) {
      let pos = spec.start && Array.isArray(spec.start) ? new THREE.Vector3(
        Number(spec.start[0]) || 0,
        Number(spec.start[1]) || 0,
        Number(spec.start[2]) || 0
      ) : new THREE.Vector3(0, 0, 0);
      let dir = new THREE.Vector3(1, 0, 0);

      const pathPoints = [pos.clone()];
      for (const s of spec.segments) {
        if (s.kind === 'line') {
          const d = Array.isArray(s.direction)
            ? new THREE.Vector3(Number(s.direction[0]) || 0, Number(s.direction[1]) || 0, Number(s.direction[2]) || 0).normalize()
            : dir.clone();
          const end = pos.clone().add(d.multiplyScalar(s.length || 0));
          pathPoints.push(end.clone());
          dir = end.clone().sub(pos).normalize();
          pos = end;
        } else if (s.kind === 'turn') {
          const angle = (s.angle || 0) * Math.PI / 180;
          const radius = Math.max(0.001, s.radius || 0.001);
          const up = new THREE.Vector3(0, 1, 0);
          const right = new THREE.Vector3().crossVectors(dir, up).normalize();
          const sign = Math.sign(angle);
          const center = pos.clone().add(right.multiplyScalar(radius * sign));
          const startAng = Math.atan2(pos.z - center.z, pos.x - center.x);
          const endAng = startAng + angle;
          const segments = Math.max(8, Math.floor(Math.abs(angle) / (Math.PI / 24)));
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const a = startAng + (endAng - startAng) * t;
            pathPoints.push(new THREE.Vector3(center.x + radius * Math.cos(a), pos.y, center.z + radius * Math.sin(a)));
          }
          pos = pathPoints[pathPoints.length - 1].clone();
          dir = new THREE.Vector3(Math.cos(endAng + Math.PI / 2), 0, Math.sin(endAng + Math.PI / 2)).normalize();
        } else if (s.kind === 'elevation') {
          let end = pos.clone().add(dir.clone().multiplyScalar(s.length || 0));
          if (typeof s.endHeight === 'number') end.y = s.endHeight;
          pathPoints.push(end.clone());
          pos = end;
          dir = end.clone().sub(pathPoints[pathPoints.length - 2]).normalize();
        }
      }
      // Result: CatmullRomCurve3 for smooth interpolation
      return new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
    }
    return null;
  }


  // Helper method to recursively evaluate all expressions in nested structures
  _evaluateRecursively(value, ctx) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      if (
        value.includes('$') ||
        value.includes('if(') ||
        value.includes('mod(')
      ) {
        return this.evaluator.evaluate(value, ctx);
      }
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(item => this._evaluateRecursively(item, ctx));
    }
    if (typeof value === 'object') {
      const ctor = value.constructor?.name;
      if (
        ctor === 'CurvePath' ||
        ctor?.endsWith('Curve3') ||
        ctor?.endsWith('Curve')
      ) {
        return value;
      }
      if (value.__spellshape_path === true) {
        return this._compilePathSpec(value.spec);
      }
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this._evaluateRecursively(val, ctx);
      }
      return result;
    }
    return value;
  }

  _deepEvaluate(value, ctx) {
    return this._evaluateRecursively(value, ctx);
  }

  _item(it, ctx) {
    const node = { ...it };
    if (node.dimensions) {
      // Step 1: Evaluate all expressions, so all values are numbers/objects, not strings
      node.dimensions = this._deepEvaluate(node.dimensions, ctx);
      // Step 2: Expand any arcs in outer/hole arrays
      if (node.dimensions.outer)
        node.dimensions.outer = this._expandArcsInArray(node.dimensions.outer, ctx);
      if (node.dimensions.holes)
        node.dimensions.holes = node.dimensions.holes.map(h =>
          this._expandArcsInArray(h, ctx)
        );
    }
    if (node.position)
      node.position = node.position.map(p => this.evaluator.evaluate(p, ctx));
    if (node.rotation)
      node.rotation = node.rotation.map(r => this.evaluator.evaluate(r, ctx));

    for (const key of ['material', 'id', 'name']) {
      if (typeof node[key] === 'string') {
        if (node[key].includes('if(') || node[key].includes('mod(')) {
          node[key] = this.evaluator.evaluate(node[key], ctx);
        } else if (/\$\w+/.test(node[key])) {
          node[key] = node[key].replace(/\$(\w+)/g, (_, p) => ctx[p] ?? `$${p}`);
        }
      }
    }

    if (node.children) node.children = this._walk(node.children, ctx);
    return node;
  }

  _resolveParams(p, expr, parent) {
    const ctx = { ...parent };
    for (const [k, v] of Object.entries(p))
      ctx[k] = (v && v.value !== undefined) ? v.value : this.evaluator.evaluate(v, ctx);
    for (const [k, e] of Object.entries(expr || {}))
      ctx[k] = this.evaluator.evaluate(e, ctx);
    return ctx;
  }
}
