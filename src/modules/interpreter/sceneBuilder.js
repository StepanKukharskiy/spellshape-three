/* sceneBuilder.js - Geometry-First Edition - FIXED
   Builds Three.js scene from processed schema nodes
   Handles geometry objects from helpers, references, and materials
*/

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

  // Initialize materials from schema
  if (schema.materials) {
    for (const [name, matDef] of Object.entries(schema.materials)) {
      if (!materialManager.getMaterial(name)) {
        materialManager.createMaterial(name, matDef);
      }
    }
  }

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

  function regenerate(path) {
    const entry = objects.get(path);
    if (!entry) return;
    evaluator.clearCache();

    _disposeRecursively(entry.node);
    entry.node.clear();
    entry.schema.parameters && validator.validateConstraints(entry);

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

  /* ========== INTERNAL BUILD FUNCTION ========== */
  function _build(node, parent, prefix, currentContext = globalContext) {
    const path = prefix ? `${prefix}.${node.id}` : node.id;

    // Handle parametric_template
    if (node.type === 'parametric_template') {
      const grp = new THREE.Group();
      grp.name = path;
      node.position && grp.position.set(...node.position);
      node.rotation && grp.rotation.set(...node.rotation);
      node.scale && grp.scale.set(...node.scale);
      parent.add(grp);
      objects.set(path, { node: grp, schema: node });
      validator.validateConstraints({ schema: node });

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

    // Handle group
    if (node.type === 'group') {
      const grp = new THREE.Group();
      grp.name = path;
      node.position && grp.position.set(...node.position);
      node.rotation && grp.rotation.set(...node.rotation);
      node.scale && grp.scale.set(...node.scale);
      parent.add(grp);
      node.children && node.children.forEach(n => _build(n, grp, path, currentContext));
      registry.set(path, grp);
      return;
    }

    /* ========== GEOMETRY-FIRST: Handle __helper3d_result ========== */
    if (node.type === '__helper3d_result') {
      const geomObj = node.geometryObject;

      if (!geomObj) {
        console.warn('helper3d result has no geometryObject:', node);
        return;
      }

      // ✅ Get material once
      const materialName = node.material;
      let material = null;
      
      if (materialName) {
        material = materialManager.getMaterial(materialName);
        if (!material) {
          console.warn(`Material "${materialName}" not found, using default`);
          material = materialManager.getMaterial('default') || 
                    materialManager.createMaterial('default', { 
                      color: '#ffffff', 
                      roughness: 0.5, 
                      metalness: 0.0 
                    });
        }
      }

      // Handle THREE.Mesh
      if (geomObj instanceof THREE.Mesh) {
        if (material) {
          geomObj.material = material;
        }
        geomObj.name = node.id;
        geomObj.castShadow = geomObj.receiveShadow = true;
        parent.add(geomObj);
        registry.set(path, geomObj);
        return;
      }

      // Handle THREE.Group
      if (geomObj instanceof THREE.Group) {
        geomObj.name = node.id;
        parent.add(geomObj);
        
        // Apply material to all meshes in group
        let meshCount = 0;
        geomObj.traverse(child => {
          if (child instanceof THREE.Mesh) {
            // If the mesh already has a material name stored, use that
            // Otherwise use the group's material
            if (material) {
              child.material = material;
            }
            child.castShadow = child.receiveShadow = true;
            meshCount++;
          }
        });
        
        console.log(`📦 Group "${node.id}" added with ${meshCount} meshes, material: ${materialName}`);
        registry.set(path, geomObj);
        return;
      }

      // Handle THREE.Curve (store but don't render)
      if (geomObj instanceof THREE.Curve) {
        registry.set(path, geomObj);
        console.log(`📐 Curve stored: ${node.id}`, geomObj);
        return;
      }

      console.warn('Unknown geometry object type from helper3d:', geomObj);
      return;
    }

    /* ========== GEOMETRY-FIRST: Handle __reference ========== */
    if (node.type === '__reference') {
      const targetId = node.target;

      // Smart lookup with 3 strategies
      let targetObj = registry.get(targetId);

      if (!targetObj && prefix) {
        targetObj = registry.get(`${prefix}.${targetId}`);
      }

      if (!targetObj) {
        for (const [key, value] of registry.entries()) {
          if (key.endsWith(`.${targetId}`) || key === targetId) {
            targetObj = value;
            console.log(`✅ Found reference target via search: ${targetId} -> ${key}`);
            break;
          }
        }
      }

      if (!targetObj) {
        console.warn(`reference: target "${targetId}" not found in registry. Available keys:`, Array.from(registry.keys()));
        return;
      }

      // Clone the target object
      const cloned = targetObj.clone();
      cloned.name = node.id || `ref_${targetId}`;

      // Apply transforms from node if specified
      if (node.position) cloned.position.set(...node.position);
      if (node.rotation) cloned.rotation.set(...node.rotation);
      if (node.scale) cloned.scale.set(...node.scale);

      parent.add(cloned);
      registry.set(path, cloned);
      return;
    }

    // Handle standard geometry nodes (box, extrude, etc.) - backwards compatibility
    const geoFactory = geometryPlugins[node.type];
    if (!geoFactory) {
      console.warn('No geometry plugin for type:', node.type);
      return;
    }

    const materialName = node.material || 'default';
    let material = materialManager.getMaterial(materialName);
    if (!material) {
      const matDef = schema.materials?.[materialName] || {
        color: '#ffffff',
        roughness: 0.5,
        metalness: 0.0
      };
      material = materialManager.createMaterial(materialName, matDef);
    }

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
