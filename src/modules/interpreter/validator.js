/* Checks parameter constraints; shows violations in DOM[1] */
export class FixedConstraintValidator {
  constructor(evaluator){
    this.evaluator = evaluator;
    this.panel     = document.getElementById('validation-panel');
  }

  validateConstraints({schema}) {
    const params = Object.fromEntries(
      Object.entries(schema.parameters).map(([k,v])=>[k, (v&&v.value!==undefined)?v.value:v])
    );
    const out=[];
    for(const cat of Object.values(schema.constraints||{}))
      for(const [name,c] of Object.entries(cat)){
        try{
          if(!this.evaluator.evaluate(c.expression,params))
            out.push({name,msg:c.message||name,severity:c.severity||'warning'});
        }catch(e){ out.push({name,msg:e.message,severity:'error'}); }
      }
    this._render(out);
    return out;
  }

  _render(list){
    if(!this.panel) return;
    if(!list.length){ this.panel.style.display='none'; return; }
    this.panel.innerHTML = list.map(v=>`• ${v.msg}`).join('<br>');
    this.panel.style.display='block';
  }
}

