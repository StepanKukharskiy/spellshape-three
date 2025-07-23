// /modules/interpreter/evaluator.js
// ---------------------------------------------------------------------------
//  FixedExpressionEvaluator
//  ------------------------
//  Resolves $parameter references, supports basic math, utility helpers,
//  nested if() expressions and a small cache for performance.
// ---------------------------------------------------------------------------

export class FixedExpressionEvaluator {
  constructor() {
    // Memo-cache →  key = expr + JSON.stringify(context)
    this.cache = new Map();

    // Functions and constants that the mini-language understands
    this.functions = {
      /* Math functions */
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow,
      min: Math.min, max: Math.max,
      floor: Math.floor, ceil: Math.ceil, round: Math.round,

      /* Constants */
      pi: Math.PI, e: Math.E,

      /* Utility helpers */
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
      lerp:  (a, b, t) => a + (b - a) * t,
      mod:   (a, b)    => ((a % b) + b) % b,

      /* NEW — HSV → Hex */
      hsv_to_hex: (h,s,v) => {
        // h 0–360 or 0–1,  s & v 0–1
        if (h <= 1) h *= 360;          // allow 0–1 hue
        h = ((h % 360) + 360) % 360;   // keep positive
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r=0, g=0, b=0;
        if (h <  60) { r = c; g = x; }
        else if (h <120) { r = x; g = c; }
        else if (h <180) { g = c; b = x; }
        else if (h <240) { g = x; b = c; }
        else if (h <300) { r = x; b = c; }
        else             { r = c; b = x; }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b)
                     .toString(16)
                     .slice(1);
      },

      /* Array helpers */
      alternating: (i, ...vals) => vals[i % vals.length],
      nth: (arr, i) => Array.isArray(arr) ? arr[i % arr.length] : arr
    };
  }

  /* --------------------------------------------------------------------- */
  /*  Public API                                                           */
  /* --------------------------------------------------------------------- */

  evaluate(expression, context = {}, debug = false) {
    if (typeof expression === 'number') return expression;
    if (typeof expression !== 'string')  return expression;

    const key = expression + JSON.stringify(context);
    if (this.cache.has(key)) return this.cache.get(key);

    let result = 0;
    try {
      result = this._evaluateWithContext(expression, context);
      if (debug) console.debug(`[Eval] '${expression}' →`, result);
    } catch (err) {
      console.warn(`[Eval] "${expression}" failed: ${err.message}`);
    }

    this.cache.set(key, result);
    return result;
  }

  clearCache() { this.cache.clear(); }

  /* --------------------------------------------------------------------- */
  /*  Internal helpers                                                     */
  /* --------------------------------------------------------------------- */

  _evaluateWithContext(expression, context) {
    let expr = expression;

    /* 1.  Replace $parameter tokens ------------------------------------ */
    expr = expr.replace(/\$(\w+)/g, (_, p) => {
      const v = context[p];
      if (v === undefined) return 0;
      const val = (typeof v === 'object' && v.value !== undefined) ? v.value : v;
      return (typeof val === 'string') ? `"${val}"` : val;
    });

    /* 2.  Handle nested if() first → turn into JS ternary -------------- */
    expr = this._convertIfToTernary(expr);

    /* 3.  Evaluate custom function calls (clamp, alternating, …) ------- */
    expr = this._inlineFunctions(expr, context);

    /* 4.  Inline numeric constants (pi, e, …) -------------------------- */
    for (const [name, val] of Object.entries(this.functions))
      if (typeof val === 'number')
        expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), val.toString());

    /* 5.  Inline bare numeric variables still present ------------------ */
    const keysByLen = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const k of keysByLen)
      if (typeof context[k] === 'number')
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), context[k]);

    /* 6.  Final safe evaluation ---------------------------------------- */
    return this._safeEval(expr);
  }

  /* ---------- if(condition, a, b)  →  (condition ? a : b) ------------- */
  _convertIfToTernary(expr) {
    const IF_RE = /\bif\s*\(/g;
    let changed   = true;
    const MAX_RUN = 10;

    for (let run = 0; changed && run < MAX_RUN; ++run) {
      changed = false;
      let match;
      while ((match = IF_RE.exec(expr))) {
        const start = match.index;
        const open  = start + match[0].length - 1;
        const close = this._findMatchingParen(expr, open);
        if (close === -1) break;

        const args = this._splitArgs(expr.slice(open + 1, close));
        if (args.length !== 3) continue;

        expr = `${expr.slice(0, start)}((${args[0]})?(${args[1]}):(${args[2]}))${expr.slice(close + 1)}`;
        changed = true;
        break;          // restart RegExp scan
      }
    }
    return expr;
  }

  /* ---------- call user function  ------------------------------------- */
  _inlineFunctions(expr, ctx) {
    for (const [name, fn] of Object.entries(this.functions)) {
      if (typeof fn !== 'function') continue;

      const RE = new RegExp(`\\b${name}\\s*\\(`, 'g');
      let match;
      while ((match = RE.exec(expr))) {
        const start = match.index;
        const open  = start + match[0].length - 1;
        const close = this._findMatchingParen(expr, open);
        if (close === -1) break;

        const rawArgs = this._splitArgs(expr.slice(open + 1, close));
        const args    = rawArgs.map(a => {
          if (/^["'].*["']$/.test(a.trim())) return a.slice(1, -1);   // keep strings
          return this._safeEval(this._evaluateWithContext(a.trim(), ctx).toString());
        });

        let out;
        try { out = fn.apply(null, args); }
        catch (e) { out = 0; console.warn(`[Eval] ${name}(): ${e.message}`); }

        const outStr = (typeof out === 'string') ? `"${out}"` : out;
        expr = `${expr.slice(0, start)}${outStr}${expr.slice(close + 1)}`;
        RE.lastIndex = start + String(outStr).length;   // resume after replacement
      }
    }
    return expr;
  }

  /* ---------- tiny parser helpers ------------------------------------- */
  _splitArgs(argStr) {
    const args = [];
    let buff = '', depth = 0, inStr = false, strChr = '';
    for (let i = 0; i < argStr.length; ++i) {
      const c = argStr[i];
      if (!inStr && (c === '"' || c === "'")) { inStr = true; strChr = c; buff += c; continue; }
      if (inStr && c === strChr) { inStr = false; buff += c; continue; }
      if (!inStr && c === '(')  { depth++; buff += c; continue; }
      if (!inStr && c === ')')  { depth--; buff += c; continue; }
      if (!inStr && c === ',' && depth === 0) { args.push(buff.trim()); buff = ''; continue; }
      buff += c;
    }
    if (buff.trim()) args.push(buff.trim());
    return args;
  }

  _findMatchingParen(str, openPos) {
    let depth = 1;
    for (let i = openPos + 1; i < str.length; ++i) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')' && --depth === 0) return i;
    }
    return -1;
  }

  /* ---------- very small “sandbox” eval ------------------------------- */
  _safeEval(expr) {
    // quick sanity check: only allow rudimentary chars
    if (!/^[\d+\-*/%.()<>!=&|,\s'"?:#\w]+$/.test(expr))
      throw new Error('unsafe characters in expression');
    // string equality needs manual handling because `"a" == "b"` is not allowed in strict mode
    const fixed = expr
      .replace(/("[^"]*")\s*==\s*("[^"]*")/g, (_, a, b) => (a === b ? 'true' : 'false'))
      .replace(/("[^"]*")\s*!=\s*("[^"]*")/g, (_, a, b) => (a !== b ? 'true' : 'false'));

    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + fixed + ')')();
  }
}
