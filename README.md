# SpellShape Three Runtime

A lightweight, modular runtime that loads and renders `.spell` parametric models, now packaged for npm and built with Vite.

## ✨ Key Features
- AI-native format – consumes plain-text `.spell` files produced by LLMs or hand-written by humans.
- Headless interpreter – evaluates expressions, resolves constraints, and flattens templates without touching WebGL.
- Plugin-driven geometry – add new shapes or distribution strategies in one file, no core patches.
- Live GUI – every parameter declared in the schema appears automatically in a collapsible dat.GUI panel.
- Hot rebuild – changing a single slider re-evaluates only the affected subtree; the rest of the scene stays untouched.
- Modern build – Vite library mode outputs ES and UMD bundles for use in apps and script tags.

## 🚀 Installation

- Using npm:
  - npm install spellshape-three
- Peer dependency:
  - three is a peer dependency; install it in the host project:
  - npm install three

## 🧪 Try the Dev Playground (Vite)

- Clone and run the local demo:
  - git clone 
  - cd spellshape-three
  - npm install
  - npm run dev
- Open the printed local URL to view the demo with HMR.
- Build the library:
  - npm run build
- Preview the production build:
  - npm run preview

Output files:
- dist/spellshape-three.js (ESM)
- dist/spellshape-three.umd.cjs (UMD for script tags)

## 📦 Using the Package

### In an ES module project (recommended)

```js
import * as THREE from 'three';
import { start, buildSceneFromSchema } from 'spellshape-three';

// Example minimal schema
const schema = {
  materials: { default: { color: '#ffffff' } },
  children: [
    {
      type: 'parametric_template',
      id: 'demo',
      parameters: {},
      template: [
        { type: 'box', id: 'cube', dimensions: [1, 1, 1], position: [0, 0, 0], material: 'default' }
      ]
    }
  ]
};

const canvas = document.querySelector('#canvas');
const fw = start(canvas, schema);

// Optional helpers
fw.fitToScene();
fw.setView('front'); // top | bottom | front | back | left | right
```

### In plain HTML via script tag (UMD)

```html




  const { start } = SpellshapeThree;
  const canvas = document.getElementById('canvas');
  const schema = { /* ...as above... */ };
  start(canvas, schema);

```

## 📂 Folder Layout

| Path | Purpose |
|------|---------|
| /src/index.js | Library entry that re-exports runtime modules |
| /src/framework.js | Boots Three.js, interpreter, GUI, and viewer helpers |
| /src/modules/interpreter/ | Evaluator, validator, processor, materials, scene builder |
| /src/modules/plugins/ | Geometry and distribution factories (user-extendable) |
| /src/guiControls.js | dat.GUI bindings generated from schema metadata |
| /vite.config.js | Vite library-mode build configuration |
| /dist/ | Built ESM/UMD outputs (generated) |
| /examples/ | Optional example app(s) using the library |

## 🛠️ API Overview

Exports from spellshape-three:
- start(canvas, schema) – Boot the viewer with GUI and helpers; returns { exportOBJ, destroy, fitToScene, setView }.
- buildSceneFromSchema(schema, scene, opts) – Build scene graph into an existing THREE.Scene.
- FixedExpressionEvaluator – Mini-language evaluator with functions and caching.
- FixedTemplateProcessor – Expands parametric templates into concrete nodes.
- FixedMaterialManager – Creates and caches Three.js materials.
- FixedConstraintValidator – Validates parameter constraints and renders messages.
- geometryPlugins – Built-in geometry factories (box, cylinder, sphere, plane, torus, cone).
- distributionPlugins – Generators for repeat nodes (linear, grid, radial).
- initGUI, destroyGUI – GUI utilities.

## 🧩 Extending

1) New geometry
- Create src/modules/plugins/geometry-extra.js and export factories:
  - export const geometryPlugins = { torus_knot: ([r, t, p, q]) => new THREE.TorusKnotGeometry(r, t, p, q) };
- Import once in src/index.js (or consumer app) to register.

2) Custom functions in expressions
- evaluator.functions.rgb = (r, g, b) => (r << 16) | (g << 8) | b;
- Use inside schema expressions, e.g. "color_hex": "rgb(200,120,50)".

3) Integrate with another renderer
- Interpreter is renderer-agnostic; re-implement sceneBuilder.js for WebGPU/Unity/Blender while keeping evaluator/processor/validator intact.

## 📜 Vite Build Details

- Commands:
  - npm run dev – Local dev server with HMR for examples.
  - npm run build – Library build (ESM + UMD).
  - npm run preview – Preview the built demo (if present).
- Library config (vite.config.js):
  - build.lib.entry: src/index.js
  - build.lib.formats: ['es', 'umd']
  - Externalized: three, dat.gui, three/addons/*
  - Globals for UMD: THREE and dat

## 🚢 Publishing to npm

- Ensure version is bumped:
  - npm version patch | minor | major
- Publish:
  - npm publish
- Prepublish hook builds automatically if "prepublishOnly": "npm run build" is set.
- Check contents before publishing:
  - npm pack --dry-run

## 🗺️ Roadmap
- Full documentation site with examples and FAQ.

## 🤝 Contributing
- Fork and create a feature branch.
- Run tests (if present) and ensure build passes.
- Open a pull request with a concise description; maintainers will review promptly.

## ⚖️ License
Released under the MIT License. See LICENSE for details.