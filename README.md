# SpellShape Three Runtime

*A lightweight, modular runtime that loads and renders `.spell` parametric models in any Web-GL2 browser.*

## ✨ Key Features
- **AI-native format** – consumes plain-text `.spell` files produced by LLMs or hand-written by humans.  
- **Headless interpreter** – evaluates expressions, resolves constraints, and flattens templates without touching WebGL.  
- **Plugin-driven geometry** – add new shapes or distribution strategies in one file, no core patches.  
- **Live GUI** – every parameter declared in the schema appears automatically in a collapsible dat.GUI panel.  
- **Hot rebuild** – changing a single slider re-evaluates only the affected subtree; the rest of the scene stays untouched.  
- **Zero build tools** – works straight from ES-modules; no bundler required.

## 🚀 Quick Start

```bash
git clone 
cd spellshape-three
# any static server will do
npx serve .
```

Open `index.html` in your browser and tweak the GUI controls — geometry, materials, and constraints update in real time.

## 📂 Folder Layout

| Path | Purpose |
|------|---------|
| `/modules/schema.js` | Example `.spell`-like JSON used by the demo viewer |
| `/modules/framework.js` | Entry point that wires Three.js, interpreter, GUI |
| `/modules/interpreter/` | Expression evaluator, constraint validator, template processor, material manager |
| `/modules/plugins/` | Geometry and distribution factories (user-extendable) |
| `/modules/guiControls.js` | dat.GUI bindings generated from schema metadata |
| `/index.html` | Minimal viewer with import-map, OrbitControls, lighting |

## 🛠️ Usage in Your Project

```js
import { ParametricFramework } from './modules/framework.js';

const canvas = document.querySelector('#canvas');
const fw = ParametricFramework({ canvas, enableGui: true });

// later …
fw.regenerate('storage_unit.drawer_compartments_2');
```

To load a different model just replace the object exported from `schema.js` or `fetch()` a `.spell` file at runtime and pass it to `buildSceneFromSchema()`.

## 🧩 Extending

1. **New geometry**  
   Create `modules/plugins/geometry-extra.js` and export a factory, e.g.  
   ```js
   export const geometryPlugins = {
     torus_knot: ([r, t, p, q]) => new THREE.TorusKnotGeometry(r, t, p, q)
   };
   ```
   Import the file once in `framework.js` and the new type is instantly available in every schema.

2. **Custom functions in expressions**  
   ```js
   evaluator.functions.rgb = (r, g, b) => (r << 16) | (g << 8) | b;
   ```
   Use it inside a `.spell` expression: `"color_hex": "rgb(200, 120, 50)"`.

3. **Integrate with another renderer**  
   The interpreter layer is renderer-agnostic; re-implement `sceneBuilder.js` for WebGPU, Unity, or Blender and keep the rest untouched.

## 🗺️ Roadmap  
- Full documentation site with examples and FAQ.

## 🤝 Contributing
- Fork and create a feature branch.  
- Run `npm test` to execute the headless Jest suite.  
- Open a pull request with a concise description; maintainers will review promptly.

## ⚖️ License
Released under the MIT License. See `LICENSE` for details.