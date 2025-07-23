/* Expands a template tree into concrete build-nodes[1] */
import { distributionPlugins } from '../plugins/distribution.js';

export class FixedTemplateProcessor {
  constructor(evaluator){ this.evaluator = evaluator; }

  process(tpl, params, expr = {}, parentCtx = {}) {
    const ctx = this._resolveParams(params, expr, parentCtx);
    return this._walk(tpl, ctx);
  }

  /* ---------- internal ---------- */
  _walk(list, ctx){
    const out=[];
    for(const item of list){
      if(item.type==='repeat') out.push(...this._repeat(item,ctx));
      else out.push(this._item(item,ctx));
    }
    return out;
  }

  _repeat(rep, ctx){
    const count   = this.evaluator.evaluate(rep.count, ctx);
    const distro  = distributionPlugins[rep.distribution?.type];
    const poses   = distro?distro(rep.distribution,count,ctx,this.evaluator):Array(count).fill([0,0,0]);
    const res=[];
    for(let i=0;i<count;i++){
      const subCtx={...ctx,index:i};

      if (rep.instance_parameters) {
      for (const [k, expr] of Object.entries(rep.instance_parameters))
        subCtx[k] = this.evaluator.evaluate(expr, subCtx);
    }

      const grp={
        type:'group',
        id  :`${rep.id}_${i}`,
        position:poses[i],
        children:this._walk(rep.children,subCtx)
      };
      res.push(grp);
    }
    return res;
  }

  _item(it, ctx){
    const node={...it};
    if(node.dimensions) node.dimensions=node.dimensions.map(d=>this.evaluator.evaluate(d,ctx));
    if(node.position)   node.position  =node.position  .map(p=>this.evaluator.evaluate(p,ctx));
    if(node.rotation)   node.rotation  =node.rotation  .map(r=>this.evaluator.evaluate(r,ctx));
    for (const key of ['material', 'id', 'name']) {
      if (typeof node[key] === 'string' && node[key].startsWith('$')) {
        node[key] = this.evaluator.evaluate(node[key], ctx);
      }
    }
    if(node.children)   node.children  =this._walk(node.children,ctx);
    return node;
  }

  _resolveParams(p, expr, parent){
    const ctx={...parent};
    for(const [k,v] of Object.entries(p))
      ctx[k]= (v&&v.value!==undefined)?v.value: this.evaluator.evaluate(v,ctx);
    for(const [k,e] of Object.entries(expr||{}))
      ctx[k]= this.evaluator.evaluate(e,ctx);
    return ctx;
  }
}
