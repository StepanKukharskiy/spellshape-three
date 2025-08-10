/* Three.js geometry factories[1] */
import * as THREE from 'three';

export const geometryPlugins = {
  box:          ([w, h, d])            => new THREE.BoxGeometry(w, h, d),
  cylinder:     ([rt, rb, h])          => new THREE.CylinderGeometry(rt, rb, h, 16),
  sphere:       ([r])                  => new THREE.SphereGeometry(r, 16, 12),
  plane:        ([w, h])               => new THREE.PlaneGeometry(w, h),
  torus:        ([r, t, rs = 8, ts=24])=> new THREE.TorusGeometry(r, t, rs, ts),
  cone:         ([r, h, rs = 8])       => new THREE.ConeGeometry(r, h, rs)
};
