// Export all interpreter modules
export { FixedExpressionEvaluator } from './modules/interpreter/evaluator.js';
export { FixedConstraintValidator } from './modules/interpreter/validator.js';
export { FixedMaterialManager } from './modules/interpreter/materials.js';
export { FixedTemplateProcessor } from './modules/interpreter/processor.js';
export { buildSceneFromSchema } from './modules/interpreter/sceneBuilder.js';

// Export plugins
export { geometryPlugins } from './modules/plugins/geometry.js';
export { distributionPlugins } from './modules/plugins/distribution.js';

// Export framework and controls
export { start } from './modules/framework.js';
export { initGUI, destroyGUI } from './modules/guiControls.js';
