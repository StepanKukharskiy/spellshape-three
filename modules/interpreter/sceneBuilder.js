/* Turns build-nodes into real Three.js objects (simplified)[1] */
import * as THREE from 'three';
import { geometryPlugins }     from '../plugins/geometry.js';
import { FixedMaterialManager }from './materials.js';
import { FixedTemplateProcessor } from './processor.js';
import { FixedExpressionEvaluator } from './evaluator.js';
import { FixedConstraintValidator } from './validator.js';

export function buildSceneFromSchema(schema, scene, {
  evaluator = new FixedExpressionEvaluator(),
  materialManager = new FixedMaterialManager(),
  processor = new FixedTemplateProcessor(evaluator),
  validator = new FixedConstraintValidator(evaluator)
} = {}) {
  const registry = new Map();
  const objects  = new Map();

  schema.children.forEach(child=>_build(child,scene,''));

  /* ---------- public helpers ---------- */
  function regenerate(path){
    const entry=objects.get(path); if(!entry) return;
    evaluator.clearCache();
    entry.node.clear();
    entry.node.children.forEach(c=>c.geometry?.dispose());
    entry.schema.parameters && validator.validateConstraints(entry);
    processor.process(entry.schema.template,entry.schema.parameters,entry.schema.expressions)
             .forEach(n=>_build(n,entry.node,path));
  }

  return {registry,objects,regenerate};

  /* ---------- internal walk ---------- */
  function _build(node,parent,prefix){
    const path = prefix?`${prefix}.${node.id}`:node.id;

    if(node.type==='parametric_template'){
      const grp=new THREE.Group(); grp.name=path;
      node.position && grp.position.set(...node.position);
      node.rotation && grp.rotation.set(...node.rotation);
      node.scale && grp.scale.set(...node.scale);
      parent.add(grp);
      objects.set(path,{node:grp,schema:node});
      validator.validateConstraints({schema:node});
      processor.process(node.template,node.parameters,node.expressions)
               .forEach(n=>_build(n,grp,path));
      return;
    }

    if(node.type==='group'){
      const grp=new THREE.Group(); grp.name=path;
      node.position && grp.position.set(...node.position);
      node.rotation && grp.rotation.set(...node.rotation);
      node.scale && grp.scale.set(...node.scale);
      parent.add(grp);
      node.children && node.children.forEach(n=>_build(n,grp,path));
      return;
    }

    const geoFactory = geometryPlugins[node.type];
    if(!geoFactory){ console.warn('No geometry',node.type); return; }

    const matDef =
    schema.materials?.[node.material] 
    ?? {}; 

    const mesh=new THREE.Mesh(
      geoFactory(node.dimensions),
      materialManager.getMaterial(node.material) ?? materialManager.createMaterial(node.material, matDef));
    mesh.name=path;
    node.position && mesh.position.set(...node.position);
    node.rotation && mesh.rotation.set(...node.rotation);
    mesh.castShadow=mesh.receiveShadow=true;
    parent.add(mesh);
    registry.set(path,mesh);
  }
}
