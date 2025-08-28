/* Boot-straps Three.js, interpreter & GUI[1] */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { buildSceneFromSchema } from '../index.js';
import { initGUI, destroyGUI } from './guiControls.js';

export function start(canvas, schema, enableGUI = false) {
  /* Three.js setup */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  // Helper function to get container dimensions
  function getCanvasContainerSize() {
    const container = canvas.parentElement;
    if (container) {
      return {
        width: container.clientWidth,
        height: container.clientHeight
      };
    }
    // Fallback to window size if container not found
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  // Set initial size based on container
  const initialSize = getCanvasContainerSize();
  renderer.setSize(initialSize.width, initialSize.height);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.autoClear = false;

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f8f9fa');
  const camera = new THREE.PerspectiveCamera(75, initialSize.width / initialSize.height, 0.1, 1000);
  camera.position.set(4, 3, 6);
  const ctrls = new OrbitControls(camera, renderer.domElement);

  // Create axis widget
  const axisWidget = createAxisWidget(camera, renderer);

  /* Lights / ground (same as original) */
  // Key Light (Main directional light from front-top-right)
  const sun = new THREE.DirectionalLight("#ffffff", 2.5);
  sun.position.set(8, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.bias = -0.0001;
  scene.add(sun);

  // Fill Light (Softer light from front-left to reduce harsh shadows)
  const fillLight = new THREE.DirectionalLight("#e6f3ff", 0.8);
  fillLight.position.set(-6, 8, 4);
  scene.add(fillLight);

  // Rim Light (Back light for edge definition and depth)
  const rimLight = new THREE.DirectionalLight("#fff8e1", 1.2);
  rimLight.position.set(-4, 6, -8);
  scene.add(rimLight);

  // Ambient Light (Soft overall illumination)
  const ambientLight = new THREE.AmbientLight("#f0f8ff", 0.3);
  scene.add(ambientLight);

  // Environment Light (Hemisphere for natural feel)
  const hemisphereLight = new THREE.HemisphereLight("#87ceeb", "#deb887", 0.6);
  scene.add(hemisphereLight);

  // Ground plane for better shadow reception
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  ground.name = 'ground'
  scene.add(ground);

  /* Build scene */
  const { objects, regenerate } = buildSceneFromSchema(schema, scene);

  function updateParameter(parameterName, newValue) {
    // Find the first parametric template that has this parameter
    for (const child of schema.children ?? []) {
      if (child.type === 'parametric_template' && child.parameters?.[parameterName]) {
        // Update the parameter value
        child.parameters[parameterName].value = newValue;
        
        // Regenerate this specific template
        regenerate(child.id);
        return true; // Success
      }
    }
    console.warn(`Parameter "${parameterName}" not found in any parametric template`);
    return false; // Not found
  }

  /* GUI */
  if (enableGUI) {
  initGUI(schema, objects, regenerate);
}

  /* Export OBJ */
  function exportOBJ(filename = 'scene.obj') {
    const exporter = new OBJExporter();

    const exportGroup = new THREE.Group();

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name !== 'ground') {
        // Clone the mesh so we don’t affect the scene
        const cloned = child.clone();

        // Make sure world transformations are up to date
        child.updateWorldMatrix(true, false);

        // Bake world transform into mesh geometry
        // This mutates the cloned geometry!
        cloned.geometry = cloned.geometry.clone();
        cloned.applyMatrix4(child.matrixWorld);

        // Apply position/rotation/scale = identity, since it’s all baked into geometry
        cloned.position.set(0, 0, 0);
        cloned.rotation.set(0, 0, 0);
        cloned.scale.set(1, 1, 1);

        exportGroup.add(cloned);
      }
    });

    // Export the group as OBJ
    const objData = exporter.parse(exportGroup);

    // Download
    const blob = new Blob([objData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename + '.obj';
    link.click();
    URL.revokeObjectURL(url);
  }

  function fitCameraToScene(camera, scene, controls, offset = 1.25) {
    // Create a temporary group to hold only the objects we want to consider
    const tempGroup = new THREE.Group();

    scene.traverse((object) => {
      // Skip objects with ShadowMaterial (your ground plane)
      if (object.isMesh && object.material instanceof THREE.ShadowMaterial) {
        return;
      }

      // Only consider visible meshes
      if (object.isMesh && object.visible) {
        tempGroup.add(object.clone());
      }
    });

    // Create bounding box from filtered objects
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(tempGroup);

    if (boundingBox.isEmpty()) {
      console.warn('Scene bounding box is empty');
      return;
    }

    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = camera.fov * (Math.PI / 180);
    const distance = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * offset;

    const direction = camera.position.clone().sub(center).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.lookAt(center);

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }

    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
  }

  function createAxisWidget(mainCamera, renderer) {
  // Simple axis widget: only axes, no text
  const axisScene = new THREE.Scene();
  const axisCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  axisCamera.position.set(3, 3, 3);

  const axisHelper = new THREE.AxesHelper(1);
  axisScene.add(axisHelper);

  return {
    scene: axisScene,
    camera: axisCamera,
    helper: axisHelper
  };
}

function setView(viewName) {
    const boundingBox = new THREE.Box3();
    const tempGroup = new THREE.Group();
    
    scene.traverse((object) => {
        if (object.isMesh && object.visible && !(object.material instanceof THREE.ShadowMaterial)) {
            tempGroup.add(object.clone());
        }
    });
    
    boundingBox.setFromObject(tempGroup);
    
    if (boundingBox.isEmpty()) {
        console.warn('Scene bounding box is empty');
        return;
    }
    
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;
    
    let newPosition;
    switch(viewName) {
        case 'top':
            newPosition = new THREE.Vector3(center.x, center.y + distance, center.z);
            break;
        case 'bottom':
            newPosition = new THREE.Vector3(center.x, center.y - distance, center.z);
            break;
        case 'front':
            newPosition = new THREE.Vector3(center.x, center.y, center.z + distance);
            break;
        case 'back':
            newPosition = new THREE.Vector3(center.x, center.y, center.z - distance);
            break;
        case 'left':
            newPosition = new THREE.Vector3(center.x - distance, center.y, center.z);
            break;
        case 'right':
            newPosition = new THREE.Vector3(center.x + distance, center.y, center.z);
            break;
        default:
            return;
    }
    
    camera.position.copy(newPosition);
    camera.lookAt(center);
    ctrls.target.copy(center);
    ctrls.update();
}




  /* Responsive */
  function handleResize() {
    const size = getCanvasContainerSize();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
  }
  
  window.addEventListener('resize', handleResize);

  /* Animate */
  (function animate() {
    requestAnimationFrame(animate);
    ctrls.update();
    
    // Get current container size for axis widget calculation
    const currentSize = getCanvasContainerSize();
    
    // Sync axis widget rotation with main camera
    axisWidget.camera.position.copy(camera.position);
    axisWidget.camera.position.sub(ctrls.target);
    axisWidget.camera.position.normalize();
    axisWidget.camera.position.multiplyScalar(5);
    axisWidget.camera.lookAt(0, 0, 0);
    
    // Clear and render main scene
    renderer.clear();
    renderer.render(scene, camera);
    
    // Render axis widget in lower left corner
    const size = Math.min(currentSize.width, currentSize.height) * 0.15; // 15% of smallest dimension
    renderer.setViewport(10, 10, size, size); // 10px margin from bottom-left
    renderer.render(axisWidget.scene, axisWidget.camera);
    
    // Reset viewport for next frame
    renderer.setViewport(0, 0, currentSize.width, currentSize.height);
  })();

  /* Cleanup function */
  function destroy() {
    // Cancel animation loop properly
    if (typeof animate !== 'undefined') {
      const animationId = requestAnimationFrame(animate);
      cancelAnimationFrame(animationId);
    }

    // Remove event listeners
    window.removeEventListener('resize', handleResize);

    // Destroy GUI
    if (enableGUI) {
  destroyGUI();
}

    // Dispose scene resources recursively
    scene.traverse((object) => {
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
    });

    // Clear scene
    scene.clear();

    // Dispose renderer
    renderer.dispose();

    // Dispose controls
    ctrls.dispose();

    // Clear any remaining references
    if (typeof materialManager !== 'undefined' && materialManager.clearUnusedMaterials) {
      materialManager.clearUnusedMaterials();
    }
  }


  // Return the export function along with other methods that may be added later
  return { exportOBJ, destroy, fitToScene: () => fitCameraToScene(camera, scene, ctrls), setView, regenerate, updateParameter };
}
