/* Boot-straps Three.js, interpreter & GUI[1] */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { universalSchema } from './schema.js';
import { buildSceneFromSchema } from './interpreter/index.js';
import { initGUI } from './guiControls.js';

export function start(canvas){
  /* Three.js setup */
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.shadowMap.enabled=true;

  const scene=new THREE.Scene(); scene.background=new THREE.Color('#f8f9fa');
  const camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,100);
  camera.position.set(4,3,6);
  const ctrls=new OrbitControls(camera,renderer.domElement);

  /* Lights / ground (same as original) */
  scene.add(new THREE.AmbientLight('#fff',0.4));
  const dir=new THREE.DirectionalLight('#fff',1.2); dir.position.set(5,10,5); dir.castShadow=true; scene.add(dir);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#f0f0f0'}));
  g.rotation.x=-Math.PI/2; g.receiveShadow=true; scene.add(g);

  /* Build scene */
  const {objects,regenerate}=buildSceneFromSchema(universalSchema,scene);

  /* GUI */
  initGUI(universalSchema,objects,regenerate);

  /* Responsive */
  window.addEventListener('resize',()=>{
    camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  });

  /* Animate */
  (function animate(){
    requestAnimationFrame(animate);
    ctrls.update(); renderer.render(scene,camera);
  })();
}
