/* dat.gui UI driven only by schema */
import * as dat from 'dat.gui';

/* -------------------------------------------------
   Keep a single GUI instance per page
------------------------------------------------- */
let gui;              // will hold the active dat.GUI panel

export function initGUI(schema, objects, regenerate) {
	/* ▸ Remove any previous GUI to avoid duplicates */
	if (gui) gui.destroy();

	gui = new dat.GUI({ width: 350 });

	const folders   = new Map();
	const groupMeta = schema.ui_controls?.groups ?? {};

	/* -------------------------------------------------
	   Walk every parametric template in the schema
	------------------------------------------------- */
	for (const child of schema.children ?? []) {
		if (child.type !== 'parametric_template') continue;

		for (const [pName, pDef] of Object.entries(child.parameters ?? {})) {
			const groupId = pDef.group || 'default';
			const meta    = groupMeta[groupId] ?? {};

			/* ── create / reuse folder ───────────────────────────── */
			let folder = folders.get(groupId);
			if (!folder) {
				folder = gui.addFolder(meta.label || groupId);
				folders.set(groupId, folder);
				meta.default_open ? folder.open() : folder.close();
			}

			/* ── controller ───────────────────────────────────────── */
			let ctrl;
			const step = pDef.step ?? (pDef.type === 'integer' ? 1 : 0.01);

			switch (pDef.type) {
				case 'number':
				case 'integer':
					ctrl = folder.add(pDef, 'value', pDef.min, pDef.max, step);
					break;
				case 'enum':
					ctrl = folder.add(pDef, 'value', pDef.options);
					break;
				case 'boolean':
					ctrl = folder.add(pDef, 'value');
					break;
				default:
					continue;    // unsupported parameter type
			}

			ctrl.name(pDef.label || pName)
			    .onChange(() => regenerate(child.id, pName));
		}
	}

	/* -------------------------------------------------
	   Optional: sort folders by the "order" field
	------------------------------------------------- */
	[...folders.entries()]
		.map(([id, folder]) => ({ folder, order: groupMeta[id]?.order ?? 0 }))
		.sort((a, b) => a.order - b.order)
		.forEach(({ folder }) =>
			gui.__ul.appendChild(folder.domElement.parentElement)
		);

	return gui;   // hand the instance back to the caller if needed
}

/* -------------------------------------------------
   Helper for manual cleanup
------------------------------------------------- */
export function destroyGUI() {
    if (gui) {
        gui.destroy();
        gui = null; // Important: set to null after destroying
    }
}
