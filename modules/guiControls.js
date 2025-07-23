/* dat.gui UI driven only by schema */
import * as dat from 'dat.gui';

export function initGUI(schema, objects, regenerate) {
  const gui      = new dat.GUI({ width: 350 });
  const folders  = new Map();
  const groupMeta = schema.ui_controls?.groups ?? {};

  // walk every parametric template
  for (const child of schema.children) {
    if (child.type !== 'parametric_template') continue;

    for (const [pName, pDef] of Object.entries(child.parameters)) {
      const groupId = pDef.group || 'default';
      const meta    = groupMeta[groupId] ?? {};

      // ── create / reuse folder ───────────────────────────────────────
      let folder = folders.get(groupId);
      if (!folder) {
        folder = gui.addFolder(meta.label || groupId);        // 📐 Dimensions etc.
        folders.set(groupId, folder);

        // open / close as defined in schema
        meta.default_open ? folder.open() : folder.close();
      }

      // ── controller ─────────────────────────────────────────────────
      let ctrl;
      switch (pDef.type) {
        case 'number':
        case 'integer':
          ctrl = folder.add(pDef, 'value', pDef.min, pDef.max, pDef.step ?? 1);
          break;
        case 'enum':
          ctrl = folder.add(pDef, 'value', pDef.options);
          break;
        default:
          continue;
      }
      ctrl.name(pDef.label || pName).onChange(() => regenerate(child.id, pName));
    }
  }

  // ── optional: sort folders by "order" field ─────────────────────────
  [...folders.entries()]
    .map(([id, folder]) => ({ folder, order: groupMeta[id]?.order ?? 0 }))
    .sort((a, b) => a.order - b.order)
    .forEach(({ folder }) => gui.__ul.appendChild(folder.domElement.parentElement));
}
