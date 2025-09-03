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
  camera.position.set(7, 7, 7);

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

  // Lights (brighter for a less dull scene)
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dl = new THREE.DirectionalLight(0xffffff, 1.1);
  dl.position.set(5, 10, 7);
  scene.add(dl);
  // Gentle fill from opposite side
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-6, 5, -4);
  scene.add(fill);

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

  // >>> MODEL SCALE CONTROL <<<
  // Change this number to test different uniform model scales:
  // 1 = 100% (original size), 0.1 = 10%, 0.01 = 1%, etc.
  const MODEL_SCALE = 0.001;

  // Camera framing tuning: lower multipliers = more zoomed-in initial view
  const CAMERA_FIT_MULT = 0.95;   // how much padding around model size (smaller = closer)
  const CAMERA_DIST_MULT = 0.9;   // how far from ideal distance (smaller = closer)

  // Simple controls panel helpers
  function ensureControlsPanel(container) {
    let panel = document.getElementById('controls-3');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'controls-3';
      panel.className = 'controls';
      const h = document.createElement('div');
      h.style.gridColumn = '1 / -1';
      h.style.fontWeight = '700';
      h.textContent = 'Visibility';
      panel.appendChild(h);
      container.parentNode.insertBefore(panel, container);
    }
    return panel;
  }

  function addToggle(panel, label, checked, onChange) {
    const wrapper = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.addEventListener('change', () => onChange(cb.checked));
    const span = document.createElement('span');
    span.textContent = label;
    wrapper.appendChild(cb);
    wrapper.appendChild(span);
    panel.appendChild(wrapper);
    return cb;
  }

  // Load Three.js JSON
  const loader = new THREE.ObjectLoader();
  let root = null;
  // Cache-bust so edits to triceratops.json show up immediately on reload
  const modelUrl = '2-web-interops/triceratops.json?v=' + Date.now();
  loader.load(
    // Path is relative to index.html (root). JSON is at 2-web-interops/triceratops.json
    modelUrl,
    (obj) => {
      root = obj;
      scene.add(root);
      // Apply the editable uniform model scale factor
      root.scale.setScalar(MODEL_SCALE);
      // Frame camera to object
      const bbox = new THREE.Box3().setFromObject(root);
      if (!bbox.isEmpty()) {
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fit = maxDim * CAMERA_FIT_MULT; // smaller = tighter framing
        const fov = camera.fov * (Math.PI / 180);
        const dist = fit / (2 * Math.tan(fov / 2));
        // lower multiplier => closer camera (more zoomed-in)
        camera.position.copy(center.clone().add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(dist * CAMERA_DIST_MULT)));
        controls.target.copy(center);
        controls.update();
      }

      // Build visibility toggles for each named object
      try {
        const objectsByName = new Map();
        root.traverse((o) => {
          if (!o) return;
          if (o.isMesh || o.isLine || o.isPoints) {
            const n = (o.name || '').trim();
            if (!n) return; // only toggles for named objects
            if (!objectsByName.has(n)) objectsByName.set(n, []);
            objectsByName.get(n).push(o);
          }
        });

        const panel = ensureControlsPanel(container);
        if (objectsByName.size === 0) {
          // Fallback toggle for whole model
          addToggle(panel, 'Model', true, (checked) => { root.visible = checked; });
        } else {
          objectsByName.forEach((objs, name) => {
            addToggle(panel, name, true, (checked) => {
              for (const o of objs) o.visible = checked;
            });
          });
        }
      } catch (e) {
        console.warn('Toggle UI error:', e);
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
