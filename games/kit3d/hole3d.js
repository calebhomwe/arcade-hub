/* hole3d.js: the 3D stage for hole.io-style games (Hole Grind, Hole Swallow).
 * three.js r180 (vendored, see vendor/three/VERSION.txt). Everything is in metres, y up.
 *
 *   const W = new HoleWorld(canvas, { quality: 'high' });
 *   await W.load('models/city.glb');           // one named mesh per Kenney model
 *   W.setGround(size, tile, paintTile);         // tiled canvas ground with a stencil cut for holes
 *   each frame: W.begin(); W.put(id, x, 0, z, yaw, s, ...); W.setHole(i, ...); W.end(); W.view(...); W.render(dt);
 *
 * Holes are real holes: a stencil disc keeps the ground from drawing inside the rim, and a dark
 * well below the ground shows props dropping into it. Props use the warm look: standard materials with baked
 * vertex-colour AO (High) or Lambert twins (Low), instanced per model, and only the ones near the camera are drawn.
 * The legacy toon() (ramp + rim) stays exported for the games that still import it.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function ramp() {
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
const RAMP = ramp();

/** Toon material with a soft rim light: the stylised look that Mini Life Sim and Bridge Race (neon-game-arcade) still import from here. */
export function toon(src, rim = 0.35) {
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
    map: src.map || null, gradientMap: RAMP,
    transparent: !!src.transparent, opacity: src.opacity == null ? 1 : src.opacity,
  });
  if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; }
  else if (!src.userData || !src.userData.linear) {
    // Kenney's untextured kits store their palette as sRGB numbers in a linear slot: read them as sRGB
    m.color.convertSRGBToLinear();
    if (/^leaf/i.test(src.name || '')) m.color.setStyle('#4fae45');   // city green rather than the kit's mint
  }
  m.userData.rim = { value: rim };
  m.onBeforeCompile = sh => {
    sh.uniforms.rimK = m.userData.rim;
    sh.fragmentShader = 'uniform float rimK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      'float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);\n' +
      'outgoingLight += vec3(1.0, 0.97, 0.9) * pow(rimF, 3.0) * rimK;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'toonrim';
  return m;
}
/** Prop material of the warm look: a slightly rough standard material with baked vertex-colour AO (see bakeAO);
 *  m.userData.lo is the cheap Lambert twin that the Low tier draws. HoleWorld.load() uses this one. */
export function prop(src) {
  const col = src.color ? src.color.clone() : new THREE.Color(1, 1, 1);
  const tr = !!src.transparent, op = src.opacity == null ? 1 : src.opacity;
  const m = new THREE.MeshStandardMaterial({ color: col, map: src.map || null, roughness: 0.66, metalness: 0.0, envMapIntensity: 0.5, vertexColors: true, transparent: tr, opacity: op });
  if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; }
  else if (!src.userData || !src.userData.linear) {
    m.color.convertSRGBToLinear();
    if (/^leaf/i.test(src.name || '')) m.color.setStyle('#4d9a3c');   // a natural leaf green rather than the kit's mint
  }
  m.userData.lo = new THREE.MeshLambertMaterial({ color: m.color.clone(), map: m.map, vertexColors: true, transparent: tr, opacity: op });
  return m;
}
/** bake ambient occlusion into vertex colours: dark at the foot of a prop, light at the top, a little darker on the sides */
function bakeAO(g, box) {
  const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), h = Math.max(1e-3, box.max.y - box.min.y);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - box.min.y) / h));
    const e = t * t * (3 - 2 * t), ao = 0.6 + 0.4 * e;
    col[i * 3] = ao * 1.0; col[i * 3 + 1] = ao * 0.97; col[i * 3 + 2] = ao * 0.94;   // AO leans warm
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** quantized (KHR_mesh_quantization) attributes back to plain floats, so geometry can be baked and merged */
export function dequantize(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent ? a.getComponent(i, k) : [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)][k];
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  return g;
}

/** true when WebGL runs on a CPU rasteriser (SwiftShader, llvmpipe): such a device starts on Low */
export function softwareGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch (e) { return false; }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(),
  _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color(), _v = new THREE.Vector3();

export class HoleWorld {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.quality = opts.quality === 'low' ? 'low' : 'high';
    this.autoQ = opts.quality === 'auto';
    if (this.autoQ && softwareGL()) this.quality = 'low';
    // phones at 2x and up do not need MSAA; desktops on High get it
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === 'high' && (window.devicePixelRatio || 1) < 2, stencil: true, powerPreference: 'high-performance' });
    this.dyn = 1; this.ema = 16; this.lastT = 0; this.slowFor = 0; this.fastFor = 0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov = 34, 1, 0.5, 2000);
    this.skyTop = new THREE.Color(opts.skyTop || '#6fb6ff'); this.skyLow = new THREE.Color(opts.skyLow || '#dff1ff');
    s.fog = new THREE.Fog(this.skyLow.clone().convertLinearToSRGB(), 120, 400);
    this.hemi = new THREE.HemisphereLight('#a9c3e6', '#8a6a46', 0.95); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#ffc98c', 3.0);
    sun.castShadow = true; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target);
    this.sunDir = new THREE.Vector3(-0.6, 0.46, 0.5).normalize();   // golden hour: low, so shadows run long
    this._sky(); this._env();
    this.kinds = new Map(); this.batches = new Map(); this.statics = [];
    this.holes = []; this.parts = []; this.focus = new THREE.Vector3(); this.dist = 40;
    this._particles();
    this.setQuality(this.quality);
    this.resize();
  }

  _sky() {
    const g = new THREE.SphereGeometry(900, 24, 12);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: this.skyTop }, low: { value: this.skyLow } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); vec3 c = mix(low, top, pow(h,0.8)); gl_FragColor = vec4(pow(c, vec3(1.0/2.2)),1.0); }',
    });
    this.sky = new THREE.Mesh(g, m); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  /** a warm studio-sky environment for the reflections on standard materials */
  _env() {
    const pm = new THREE.PMREMGenerator(this.renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.ShaderMaterial({ side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vP; void main(){ float h=vP.y*0.5+0.5; gl_FragColor=vec4(mix(vec3(0.36,0.25,0.17),vec3(0.62,0.72,0.9),h),1.0);}' })));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: '#ffd9a8' })); p.material.color.multiplyScalar(4); p.position.set(-5, 5, 4); p.lookAt(0, 0, 0); es.add(p);
    this.scene.environment = pm.fromScene(es, 0.02).texture; this.scene.environmentIntensity = 0.5;
    pm.dispose();
  }

  setSky(top, low) {
    this.skyTop.set(top); this.skyLow.set(low); this.scene.fog.color.copy(this.skyLow).convertLinearToSRGB();
  }

  setQuality(q) {
    this.quality = q === 'low' ? 'low' : 'high';
    const hi = this.quality === 'high';
    this.dyn = 1;
    this.renderer.shadowMap.enabled = hi;
    this.sun.castShadow = hi;
    const ms = hi ? 2048 : 512;
    if (this.sun.shadow.mapSize.x !== ms) {
      this.sun.shadow.mapSize.set(ms, ms);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.drawK = hi ? 1.0 : 0.72;       // draw distance, as a share of the camera's view
    this.maxParts = hi ? 420 : 140;
    for (const st of this.statics) { st.visible = hi || !st.userData.detail; if (st.userData.pm) st.material = hi ? st.userData.pm : st.userData.pm.userData.lo; }
    for (const b of this.batches.values()) for (const im of b.meshes) if (im.userData.pm) im.material = hi ? im.userData.pm : im.userData.pm.userData.lo;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
    this.W = w; this.H = h;
  }

  /** Load a pack GLB: every top-level node is one model, named by its id. */
  async load(url) {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);   // packs are meshopt-compressed by gltfpack
    const mats = new Map();
    gltf.scene.updateMatrixWorld(true);
    for (const node of gltf.scene.children) {
      const parts = [];
      const box = new THREE.Box3();
      node.traverse(o => {
        if (!o.isMesh) return;
        const g = dequantize(o.geometry.clone()); g.applyMatrix4(o.matrixWorld);
        g.computeBoundingBox(); box.union(g.boundingBox);
        let m = mats.get(o.material);
        if (!m) { m = prop(o.material); mats.set(o.material, m); }
        parts.push({ g, m });
      });
      if (!parts.length) continue;
      for (const pt of parts) bakeAO(pt.g, box);
      const size = box.getSize(new THREE.Vector3());
      // footprint radius: half the longer side of the base; height from the ground up
      this.kinds.set(node.name, { parts, fr: Math.max(size.x, size.z) / 2, h: box.max.y, minY: box.min.y, cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2 });
    }
    return this.kinds;
  }

  has(id) { return this.kinds.has(id); }
  /** scale that makes model `id` span radius `r` on the ground */
  scaleFor(id, r) { const k = this.kinds.get(id); return k ? r / Math.max(0.05, k.fr) : 1; }
  heightOf(id, s) { const k = this.kinds.get(id); return k ? k.h * s : 1; }

  _batch(id) {
    let b = this.batches.get(id);
    if (b) return b;
    const k = this.kinds.get(id);
    if (!k) return null;
    b = { id, k, cap: 0, n: 0, meshes: [] };
    this.batches.set(id, b);
    this._grow(b, 32);
    return b;
  }
  _grow(b, cap) {
    for (const m of b.meshes) { this.scene.remove(m); m.dispose(); }
    b.meshes = b.k.parts.map(p => {
      const im = new THREE.InstancedMesh(p.g, this.quality === 'high' ? p.m : p.m.userData.lo, cap);
      im.userData.pm = p.m;
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      this.scene.add(im);
      return im;
    });
    b.cap = cap;
  }

  begin() { for (const b of this.batches.values()) b.n = 0; }

  /** Draw one instance of model `id`. tilt tips it toward (tx, tz) by `ang` radians; col tints it. */
  put(id, x, y, z, yaw, s, sy, tx, tz, ang, col) {
    const b = this._batch(id); if (!b) return;
    if (b.n >= b.cap) {
      // keep what is already written this frame, then grow
      const keep = b.meshes.map(m => ({ a: m.instanceMatrix.array.slice(0, b.n * 16), c: m.instanceColor.array.slice(0, b.n * 3) }));
      this._grow(b, b.cap * 2);
      b.meshes.forEach((m, i) => { m.instanceMatrix.array.set(keep[i].a); m.instanceColor.array.set(keep[i].c); });
    }
    const k = b.k;
    _q.setFromAxisAngle(_up, yaw || 0);
    if (ang) {
      _ax.set(tz, 0, -tx); if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0); _ax.normalize();
      _q2.setFromAxisAngle(_ax, ang); _q.premultiply(_q2);
    }
    _s.set(s, s * (sy || 1), s);
    // pivot at the model's footprint centre
    _p.set(-k.cx * s, 0, -k.cz * s).applyQuaternion(_q);
    _p.x += x; _p.y += y; _p.z += z;
    _m.compose(_p, _q, _s);
    const i = b.n++;
    if (col) _c.copy(col); else _c.setRGB(1, 1, 1);
    for (const m of b.meshes) { m.setMatrixAt(i, _m); m.setColorAt(i, _c); }
  }

  end() {
    for (const b of this.batches.values()) for (const m of b.meshes) {
      m.count = b.n;
      if (b.n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
  }

  /** Static decoration (drawn every frame, never simulated). `detail` pieces are dropped on Low. */
  addStatic(id, list, detail) {
    const k = this.kinds.get(id); if (!k || !list.length) return;
    for (const p of k.parts) {
      const im = new THREE.InstancedMesh(p.g, this.quality === 'high' ? p.m : p.m.userData.lo, list.length);
      im.userData.pm = p.m;
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      list.forEach((t, i) => {
        _q.setFromAxisAngle(_up, t.yaw || 0); _s.setScalar(t.s);
        _p.set(-k.cx * t.s, 0, -k.cz * t.s).applyQuaternion(_q); _p.x += t.x; _p.y += t.y || 0; _p.z += t.z;
        _m.compose(_p, _q, _s); im.setMatrixAt(i, _m);
      });
      im.userData.detail = !!detail;
      im.visible = this.quality === 'high' || !detail;
      this.scene.add(im); this.statics.push(im);
    }
  }
  clearStatics() { for (const s of this.statics) { this.scene.remove(s); s.dispose(); } this.statics = []; }

  /** Tiled ground: `paint(ctx, px)` paints one tile of `tile` metres; the plane spans x,z in [x0, x0+size]. */
  setGround(x0, z0, size, tile, paint, margin = 0) {
    if (this.ground) { this.scene.remove(this.ground); this.ground.geometry.dispose(); this.ground.material.map.dispose(); this.ground.material.dispose(); }
    const px = this.quality === 'high' ? 1024 : 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    paint(cv.getContext('2d'), px);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const full = size + margin * 2;
    tex.repeat.set(full / tile, full / tile);
    tex.offset.set(-margin / tile, -margin / tile);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    mat.stencilWrite = true; mat.stencilRef = 1; mat.stencilFunc = THREE.NotEqualStencilFunc;
    mat.stencilFail = mat.stencilZFail = mat.stencilZPass = THREE.KeepStencilOp;
    const g = new THREE.PlaneGeometry(full, full); g.rotateX(-Math.PI / 2);
    const m = this.ground = new THREE.Mesh(g, mat);
    m.position.set(x0 + size / 2, 0, z0 + size / 2);
    m.receiveShadow = true; m.renderOrder = -2;
    this.scene.add(m);
  }

  /** How many holes to show. Each has a stencil disc, a well and a glowing rim. */
  setHoleCount(n) {
    while (this.holes.length < n) this.holes.push(this._hole());
    this.holes.forEach((h, i) => { h.group.visible = i < n; });
  }
  _hole() {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp }));
    disc.position.y = 0.012; disc.renderOrder = -3;
    const wg = new THREE.CylinderGeometry(1, 1, 1, 48, 4, false);
    const col = [], pos = wg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const t = pos.getY(i) + 0.5; const c = 0.02 + 0.16 * Math.pow(t, 3); col.push(c * 0.7, c * 0.8, c * 1.3); }
    wg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    wg.translate(0, -0.5, 0);
    const well = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    const rimMat = new THREE.MeshBasicMaterial({ color: '#7fb2ff', transparent: true, opacity: 0.95, depthWrite: false, fog: false });
    const rim = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.1, 72).rotateX(-Math.PI / 2), rimMat);
    rim.position.y = 0.03; rim.renderOrder = 2;
    const lip = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.26, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#1a0e05', transparent: true, opacity: 0.3, depthWrite: false }));
    lip.position.y = 0.02; lip.renderOrder = 1;
    const pulseMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false });
    const pulse = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.05, 72).rotateX(-Math.PI / 2), pulseMat);
    pulse.position.y = 0.035; pulse.renderOrder = 3;
    // soft glow ring round the rim so the hole reads at any size (hole.io's halo)
    const haloMat = new THREE.MeshBasicMaterial({ color: '#7fb2ff', transparent: true, opacity: 0.28, depthWrite: false, fog: false });
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 72).rotateX(-Math.PI / 2), haloMat);
    halo.position.y = 0.025; halo.renderOrder = 2;
    group.add(disc, well, rim, lip, pulse, halo);
    this.scene.add(group);
    return { group, disc, well, rim, lip, pulse, rimMat, pulseMat, halo, haloMat };
  }
  /** pulse 0..1 flashes an outward ring (eating); sq squashes the rim (bigger bite, bigger squash). */
  setHole(i, x, z, r, color, pulse = 0, sq = 0) {
    const h = this.holes[i]; if (!h) return;
    h.group.position.set(x, 0, z);
    const sx = r * (1 + sq * 0.07), sz = r * (1 - sq * 0.05);
    h.disc.scale.set(sx, 1, sz); h.rim.scale.set(sx, 1, sz); h.lip.scale.set(sx, 1, sz);
    h.well.scale.set(r * 0.999, Math.max(4, r * 3), r * 0.999);
    h.rimMat.color.set(color); h.haloMat.color.set(color);
    const hw = Math.max(sx, 0.9);   // at least ~20 cm of halo when the hole is tiny
    h.halo.scale.set(sx + (hw - sx) * 0.3, 1, sz + (hw - sz) * 0.3);
    const k = 1 + (1 - pulse) * 0.35;
    h.pulse.scale.set(r * k, 1, r * k); h.pulseMat.opacity = pulse * 0.7;
  }

  _particles() {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshLambertMaterial({ color: '#fff' });
    const im = this.pmesh = new THREE.InstancedMesh(g, m, 420);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(420 * 3).fill(1), 3);
    im.frustumCulled = false; im.count = 0; im.castShadow = false;
    this.scene.add(im);
  }
  /** a pop of little cubes from (x, y, z), thrown up and out */
  burst(x, y, z, color, n, speed = 6, size = 0.25) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.parts.length < this.maxParts; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: speed * (0.6 + Math.random()), vz: Math.sin(a) * sp,
        t: 0, life: 0.5 + Math.random() * 0.5, s: size * (0.6 + Math.random() * 0.8), rx: Math.random() * 6, ry: Math.random() * 6, c });
    }
  }
  _stepParticles(dt) {
    const im = this.pmesh; let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt; if (p.t >= p.life) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.s / 2) { p.y = p.s / 2; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += dt * 7; p.ry += dt * 5;
      const k = p.s * (1 - Math.pow(p.t / p.life, 3));
      _q.setFromEuler(new THREE.Euler(p.rx, p.ry, 0)); _s.setScalar(Math.max(0.001, k)); _p.set(p.x, p.y, p.z);
      _m.compose(_p, _q, _s); im.setMatrixAt(n, _m); im.setColorAt(n, p.c); n++;
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  /** Camera looks at (fx, fz) from `dist` metres away at `pitch` radians above the ground, turned by `yaw`. */
  view(fx, fz, dist, pitch = 1.05, yaw = 0, shake = 0) {
    this.focus.set(fx, 0, fz); this.dist = dist; this.reach = 0.55 + 1.1 * Math.cos(pitch);
    const c = this.camera, cp = Math.cos(pitch);
    c.position.set(fx + Math.sin(yaw) * cp * dist, Math.sin(pitch) * dist, fz + Math.cos(yaw) * cp * dist);
    if (shake && !REDUCED) { c.position.x += (Math.random() - 0.5) * shake; c.position.z += (Math.random() - 0.5) * shake; }
    c.lookAt(fx, 0, fz);
    c.far = dist * 8 + 200; c.near = Math.max(0.3, dist * 0.02); c.updateProjectionMatrix();
    this.scene.fog.near = dist * (1.3 * this.drawK); this.scene.fog.far = dist * (3.2 * this.drawK) + 40;
    this.sky.position.copy(c.position);
    // sun and a tight shadow box around what the camera sees, snapped to texels so it does not shimmer
    const ext = dist * 0.95 + 8;
    const sh = this.sun.shadow.camera;
    sh.left = -ext; sh.right = ext; sh.top = ext; sh.bottom = -ext; sh.near = 1; sh.far = dist * 3 + 160;
    sh.updateProjectionMatrix();
    const texel = (2 * ext) / this.sun.shadow.mapSize.x;
    const sx = Math.round(fx / texel) * texel, sz = Math.round(fz / texel) * texel;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunDir.x * (dist + 80), this.sunDir.y * (dist + 80), sz + this.sunDir.z * (dist + 80));
  }
  /** radius (m) around the focus inside which props are worth drawing */
  drawRadius() { return this.dist * this.reach * this.drawK + 12; }

  /** screen position (CSS px) of a world point, or null behind the camera */
  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    if (_v.z > 1) return null;
    return { x: (_v.x + 1) / 2 * this.W, y: (1 - _v.y) / 2 * this.H };
  }
  /** ground point (x, z) under a screen position */
  pick(sx, sy) {
    _v.set(sx / this.W * 2 - 1, -(sy / this.H) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = _v.sub(o).normalize();
    if (d.y > -1e-4) return null;
    const t = -o.y / d.y;
    return { x: o.x + d.x * t, z: o.z + d.z * t };
  }

  /** device pixels per CSS pixel: capped at 2 on High and 1 on Low, lowered further while frames run slow */
  pixelRatio() { return Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1) * this.dyn); }
  _adapt() {
    const now = performance.now(), d = this.lastT ? now - this.lastT : 16; this.lastT = now;
    if (d > 500) return;                       // a hitch or a paused tab says nothing about the GPU
    this.ema += (d - this.ema) * 0.1;
    if (this.ema > 40) { this.slowFor += d; this.fastFor = 0; } else if (this.ema < 22) { this.fastFor += d; this.slowFor = 0; } else { this.slowFor = this.fastFor = 0; }
    let want = this.dyn;
    if (this.slowFor > 1500 && this.dyn > 0.5) want = Math.max(0.5, this.dyn * 0.8);
    if (this.fastFor > 4000 && this.dyn < 1) want = Math.min(1, this.dyn * 1.2);
    if (want !== this.dyn) { this.dyn = want; this.slowFor = this.fastFor = 0; this.resize(); }
  }

  render(dt) {
    this._adapt();
    // on a device that cannot keep up (under ~8 fps even at the lowest resolution) draw every other
    // frame, so input, pause and menus still get main-thread time between frames
    if (this.dyn <= 0.5 && this.ema > 120) { this.odd = !this.odd; if (this.odd) { this._stepSkipped = (this._stepSkipped || 0) + (dt || 0.016); return; } }
    if (this._stepSkipped) { dt = (dt || 0.016) + this._stepSkipped; this._stepSkipped = 0; }
    this._stepParticles(dt || 0.016);
    this.renderer.render(this.scene, this.camera);
  }
}
