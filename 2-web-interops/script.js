// ES module: UI + Rhino Compute wiring + minimal Three.js viewer
import rhino3dm from 'rhino3dm'
import { RhinoCompute } from 'rhinocompute'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ---------- UI wiring ----------
const leftPanel = document.getElementById('leftPanel')
const panelToggle = document.getElementById('panelToggle')
const panelClose = document.getElementById('panelClose')
const slider1 = document.getElementById('slider1')
const out1 = document.getElementById('out1')
const slider2 = document.getElementById('slider2')
const out2 = document.getElementById('out2')
const runGhBtn = document.getElementById('runGhBtn')
const computeUrlEl = document.getElementById('computeUrl')
const statusEl = document.getElementById('status')

function togglePanel(expand) {
	const willExpand = typeof expand === 'boolean' ? expand : leftPanel.classList.contains('collapsed')
	leftPanel.classList.toggle('collapsed', !willExpand)
	panelToggle.setAttribute('aria-expanded', String(willExpand))
	setTimeout(onResize, 240)
}
panelToggle?.addEventListener('click', () => togglePanel())
panelClose?.addEventListener('click', () => togglePanel(false))

function bindRange(range, out, formatter = (v) => v) {
	if (!range || !out) return
	const update = () => (out.textContent = formatter(range.value))
	range.addEventListener('input', update)
	update()
}
bindRange(slider1, out1, (v) => `${v}`)
bindRange(slider2, out2, (v) => Number(v).toFixed(1))

// ---------- Three.js viewer ----------
const canvas = document.getElementById('viewerCanvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
const scene = new THREE.Scene()
scene.background = null
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
camera.position.set(6, 6, 6)
camera.lookAt(0, 0, 0)
const light = new THREE.DirectionalLight(0xffffff, 1.0)
light.position.set(5, 10, 5)
scene.add(light, new THREE.AmbientLight(0xffffff, 0.3))
let meshGroup = new THREE.Group()
scene.add(meshGroup)
// Helpers
const grid = new THREE.GridHelper(100, 100, 0x3a4152, 0x242a36)
grid.material.opacity = 0.3; grid.material.transparent = true
scene.add(grid)
const axes = new THREE.AxesHelper(2)
scene.add(axes)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

function onResize() {
	const rect = canvas.getBoundingClientRect()
	const w = Math.max(1, Math.floor(rect.width))
	const h = Math.max(1, Math.floor(rect.height))
	renderer.setSize(w, h, false)
	camera.aspect = w / h
	camera.updateProjectionMatrix()
}
new ResizeObserver(onResize).observe(document.querySelector('.viewer'))
window.addEventListener('orientationchange', onResize)
onResize()

function animate() {
	requestAnimationFrame(animate)
		controls.update()
		renderer.render(scene, camera)
}
animate()

// ---------- Rhino Compute ----------
let rhino
const ghPath = './box.gh' // local file served by VS Code or a web server

async function ensureRhino() {
	if (rhino) return rhino
	rhino = await rhino3dm()
	console.log('Loaded rhino3dm', rhino)
	return rhino
}

async function initCompute() {
	const serverUrl = computeUrlEl.value.trim()
	if (!serverUrl) throw new Error('Compute server URL required')
	RhinoCompute.url = serverUrl
	try { localStorage.setItem('compute:url', serverUrl) } catch {}
}

async function loadGhDefinition(path) {
	// fetch as ArrayBuffer then base64 for compute
	const res = await fetch(path)
	if (!res.ok) throw new Error('Failed to load Grasshopper file: ' + path)
	const ab = await res.arrayBuffer()
	return new Uint8Array(ab)
}

function clearMeshes() {
	meshGroup.clear()
}

function rhinoMeshToThree(mesh) {
	const verts = mesh.vertices()
	const faces = mesh.faces()
	const geom = new THREE.BufferGeometry()
	const positions = []
	for (let i = 0; i < faces.count; i++) {
		const f = faces.get(i)
		// f is [a,b,c,d]; if d==c it's a triangle; else quad -> two triangles
		const a = f[0], b = f[1], c = f[2], d = f[3]
		const va = verts.get(a), vb = verts.get(b), vc = verts.get(c)
		positions.push(va[0], va[1], va[2], vb[0], vb[1], vb[2], vc[0], vc[1], vc[2])
		if (d !== c) {
			const vd = verts.get(d)
			positions.push(va[0], va[1], va[2], vc[0], vc[1], vc[2], vd[0], vd[1], vd[2])
		}
	}
	geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geom.computeVertexNormals()
	return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x6aa9ff, metalness: 0.1, roughness: 0.7 }))
}

async function evaluateBoxGh() {
	setStatus('Loading rhino3dm…')
	await ensureRhino()
	setStatus('Connecting to Compute…')
	await initCompute()

	// Load GH definition bytes
	setStatus('Loading Grasshopper file…')
	const ghBytes = await loadGhDefinition(ghPath)

	// Build input tree(s). For a basic box.gh we assume sliders map to numeric params named e.g. X, Y, Z or similar.
	// We'll send one number called X for demo; adjust names once definition IO names are known.
	const trees = []
	function makeTree(name, value) {
		return {
			ParamName: name,
			InnerTree: { '{0}': [{ type: 'System.Double', data: value }] }
		}
	}
	trees.push(makeTree('A', Number(slider1?.value ?? 50)))
	trees.push(makeTree('B', Number(slider2?.value ?? 5)))

	// Evaluate on Compute
	setStatus('Evaluating on Compute…')
	const res = await RhinoCompute.Grasshopper.evaluateDefinition(ghBytes, trees)

	// Parse results to Rhino3dm objects
	clearMeshes()
	let bbox = new THREE.Box3()
	for (const value of res.values) {
		const keys = Object.keys(value.InnerTree)
		for (const key of keys) {
			for (const item of value.InnerTree[key] || []) {
			const data = item.data
			if (!data) continue
			const obj = rhino.CommonObject.decode(data)
			if (!obj) continue
				if (obj instanceof rhino.Mesh) {
					const m = rhinoMeshToThree(obj)
					meshGroup.add(m)
					bbox.expandByObject(m)
				} else if (obj instanceof rhino.Brep) {
					// Meshing Breps on client as a fallback
					const brepMeshes = rhino.Mesh.createFromBrep(obj)
					if (brepMeshes) {
						for (let i = 0; i < brepMeshes.length; i++) {
							const m = rhinoMeshToThree(brepMeshes[i])
							meshGroup.add(m)
							bbox.expandByObject(m)
						}
					}
				}
			}
		}
	}
	// Frame camera
	if (!bbox.isEmpty()) {
		const size = bbox.getSize(new THREE.Vector3()).length()
		const center = bbox.getCenter(new THREE.Vector3())
		const dist = size / (2 * Math.tan((camera.fov * Math.PI) / 360)) + 1
		camera.position.copy(center.clone().add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(dist)))
		camera.lookAt(center)
		controls.target.copy(center)
	}
	setStatus('Done')
}

runGhBtn?.addEventListener('click', () => {
	setStatus('')
	evaluateBoxGh().catch((err) => {
		console.error(err)
		setStatus(err.message || String(err), true)
	})
})

// Load saved settings
try {
	const savedUrl = localStorage.getItem('compute:url')
	if (savedUrl) computeUrlEl.value = savedUrl
} catch {}

function setStatus(msg, isError = false) {
	if (!statusEl) return
	statusEl.textContent = msg
	statusEl.classList.toggle('error', !!isError)
}
