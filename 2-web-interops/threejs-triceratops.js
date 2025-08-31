// your-script.js
// This script sets up a Three.js scene inside the DOM element with ID "threejs-container"

(function () {
  // Container
  const container = document.getElementById('threejs-container');
  if (!container) {
    console.warn('[threejs] Container #threejs-container not found');
    return;
  }
  const scene = new THREE.Scene();

  // Camera
  const width = container.clientWidth;
  const height = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(8, 8, 8);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  renderer.setClearColor(0x0d1220, 1);
  container.appendChild(renderer.domElement);

  // Resize
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dl = new THREE.DirectionalLight(0xffffff, 0.6);
  dl.position.set(5, 10, 7);
  scene.add(dl);

  // Grid helper (subtle)
  const grid = new THREE.GridHelper(20, 20, 0x3a4152, 0x242a36);
  grid.material.opacity = 0.25; grid.material.transparent = true;
  scene.add(grid);

  // Controls
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.update();

  // Load Three.js JSON
  const loader = new THREE.ObjectLoader();
  let root = null;
  loader.load(
    // Path is relative to index.html (root). JSON is at 2-web-interops/triceratops.json
    '2-web-interops/triceratops.json',
    (obj) => {
      root = obj;
      scene.add(root);
      // Scale if needed
      root.scale.set(0.1, 0.1, 0.1);
      // Frame camera to object
      const bbox = new THREE.Box3().setFromObject(root);
      if (!bbox.isEmpty()) {
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fit = maxDim * 1.2;
        const fov = camera.fov * (Math.PI / 180);
        const dist = fit / (2 * Math.tan(fov / 2));
        camera.position.copy(center.clone().add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(dist * 1.6)));
        controls.target.copy(center);
        controls.update();
      }
    },
    undefined,
    (err) => {
      console.error('Failed to load Three.js JSON:', err);
    }
  );

  // Animate
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
})();
