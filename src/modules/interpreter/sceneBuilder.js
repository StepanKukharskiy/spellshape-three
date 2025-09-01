/* Turns build-nodes into real Three.js objects (simplified)[1] */
import * as THREE from 'three';
import { geometryPlugins } from '../plugins/geometry.js';
import { FixedMaterialManager } from './materials.js';
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
  const objects = new Map();

  console.log(schema)
  console.log(schema.children)

  // Initialize global context with _ranges values
  const globalContext = {};
  if (schema._ranges) {
    for (const [key, range] of Object.entries(schema._ranges)) {
      if (range.value !== undefined) {
        globalContext[key] = range.value;
      }
    }
  }

  schema.children.forEach(child => _build(child, scene, '', globalContext));

  function _disposeRecursively(object) {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => mat.dispose());
      } else {
        object.material.dispose();
      }
    }
    if (object.children) {
      object.children.forEach(child => _disposeRecursively(child));
    }
  }

  /* ---------- public helpers ---------- */
  function regenerate(path) {
    const entry = objects.get(path); if (!entry) return;
    evaluator.clearCache();

    // Properly dispose all resources
    _disposeRecursively(entry.node);

    entry.node.clear();
    entry.schema.parameters && validator.validateConstraints(entry);

    // Create context for regeneration
    const regenContext = { ...globalContext };
    if (entry.schema.parameters) {
      for (const [key, param] of Object.entries(entry.schema.parameters)) {
        regenContext[key] = param.value !== undefined ? param.value : evaluator.evaluate(param, regenContext);
      }
    }

    processor.process(entry.schema.template, entry.schema.parameters, entry.schema.expressions, regenContext)
      .forEach(n => _build(n, entry.node, path, regenContext));
  }

  return { registry, objects, regenerate };

  /* ---------- internal walk ---------- */
  function _build(node, parent, prefix, currentContext = globalContext) {
    const path = prefix ? `${prefix}.${node.id}` : node.id;

    if (node.type === 'parametric_template') {
      const grp = new THREE.Group();
      grp.name = path;
      node.position && grp.position.set(...node.position);
      node.rotation && grp.rotation.set(...node.rotation);
      node.scale && grp.scale.set(...node.scale);
      parent.add(grp);
      objects.set(path, { node: grp, schema: node });
      validator.validateConstraints({ schema: node });

      // Create context for this template
      const templateContext = { ...currentContext };
      if (node.parameters) {
        for (const [key, param] of Object.entries(node.parameters)) {
          templateContext[key] = param.value !== undefined ? param.value : evaluator.evaluate(param, templateContext);
        }
      }

      processor.process(node.template, node.parameters, node.expressions, templateContext)
        .forEach(n => _build(n, grp, path, templateContext));
      return;
    }

    if (node.type === 'group') {
      const grp = new THREE.Group();
      grp.name = path;
      node.position && grp.position.set(...node.position);
      node.rotation && grp.rotation.set(...node.rotation);
      node.scale && grp.scale.set(...node.scale);
      parent.add(grp);
      node.children && node.children.forEach(n => _build(n, grp, path, currentContext));
      return;
    }

    const geoFactory = geometryPlugins[node.type];
    if (!geoFactory) {
      console.warn('No geometry', node.type);
      return;
    }

    // Fix material handling
    const materialName = node.material || 'default';
    const matDef = schema.materials?.[materialName] || {
      color: '#ffffff',
      roughness: 0.5,
      metalness: 0.0
    };

    // Always create/get material with proper definition
    let material = materialManager.getMaterial(materialName);
    if (!material) {
      material = materialManager.createMaterial(materialName, matDef);
    }

    // CRITICAL FIX: Pass evaluator and context to geometry factory
    const mesh = new THREE.Mesh(
      geoFactory(node.dimensions, evaluator, currentContext),
      material
    );

    mesh.name = path;
    node.position && mesh.position.set(...node.position);
    node.rotation && mesh.rotation.set(...node.rotation);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    registry.set(path, mesh);
  }
}
