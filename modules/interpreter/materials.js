/* Creates / caches Three.js materials[1] */
import * as THREE from 'three';

export class FixedMaterialManager {
  constructor() {
    this.materials = new Map();
  }

  createMaterial(name, def = {}) {
    if (this.materials.has(name)) return this.materials.get(name);

    // ── normalise colour ──────────────────────────────────────────────
    let colour = def.color ?? '#ffffff';
    if (typeof colour === 'string' && !colour.startsWith('#') && colour.length === 6)
      colour = `#${colour}`;                  // allow “ff9900” shorthand

    const mat = new THREE.MeshStandardMaterial({
      color      : colour,                    // MeshStandardMaterial accepts all three forms[1]
      roughness  : def.roughness  ?? 0.5,
      metalness  : def.metalness  ?? 0.0,
      transparent: def.opacity    !== undefined,
      opacity    : def.opacity    ?? 1.0
    });

    this.materials.set(name, mat);
    return mat;
  }

  getMaterial(name) { return this.materials.get(name); }
}

