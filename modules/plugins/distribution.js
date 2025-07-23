/* Position generators for “repeat” nodes[1] */
export const distributionPlugins = {
  linear (d, count, ctx, ev) {
    const start = ev.evaluate(d.start, ctx);
    const step  = ev.evaluate(d.step , ctx);
    const axis  = {x:0, y:1, z:2}[d.axis] ?? 1;
    return Array.from({length:count}, (_,i)=>{
      const p=[0,0,0]; p[axis]=start+i*step; return p;
    });
  },

  grid (d, count, ctx, ev) {
    return d.positions.slice(0,count).map(pos=>pos.map(c=>ev.evaluate(c,ctx)));
  },

  radial (d, count, ctx, ev) {
    const R      = ev.evaluate(d.radius, ctx);
    const start  = ev.evaluate(d.startAngle||0,ctx);
    const fixedY = ev.evaluate(d.y||0,ctx);
    return Array.from({length:count}, (_,i)=>{
      const a=start + i*2*Math.PI/count;
      return [Math.cos(a)*R, fixedY, Math.sin(a)*R];
    });
  }
};
