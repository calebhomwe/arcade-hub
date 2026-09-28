/* tower3d.js: the 3D stage shared by Helix Smash and Stack Ball (three.js r180, vendored in ../vendor/three).
 *
 * The games keep their own rules and simulation (screen-px units, platform i sits at i * GAP);
 * this module draws it: a glossy pole, bevelled wedge platforms (instanced per colour), a glossy
 * ball with squash and stretch, pickups (Kenney jewels, a modelled shield, ring and magnet),
 * shatter debris, paint splats, particles, a gradient sky, soft shadows and fog.
 *
 *   const T = new TowerWorld(canvas, { quality, style: 'helix' | 'stack', colors: {name: '#hex'} });
 *   T.metrics(GAP, topOffset, ballR);              // whenever the game's layout changes
 *   per frame: T.begin(); T.platform(p); T.item(kind, i, off, y); T.ball(by, squash, stretch); T.end();
 *              T.view(by); T.render(dt);
 *   events:    T.shatter(p); T.splat(p, color); T.burst(by, color, n); T.ring(by, color)
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const TAU = Math.PI * 2, SEGS = 8, STEP = 3.1, R_OUT = 4.6, R_IN = 1.25, R_BALL = 0.5, R_TRACK = 3.0, THICK = 0.62;
const FRONT = Math.PI / 2;   // the ball sits on the +z side, facing the camera

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

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(),
  _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** a flat annular wedge (angle `a` wide), bevelled; `petal` rounds the outer edge into a scallop */
function wedgeGeometry(a, petal, THICK) {
  const sh = new THREE.Shape(), n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n, ang = t * a;
    const r = R_OUT + (petal ? Math.sin(t * Math.PI) * 0.45 : 0);
    const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  for (let i = n; i >= 0; i--) { const ang = i / n * a; sh.lineTo(Math.cos(ang) * R_IN, Math.sin(ang) * R_IN); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: THICK - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, -THICK + 0.08, 0);   // top face at y = 0
  g.computeVertexNormals();
  return g;
}
function shieldGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55); s.quadraticCurveTo(0.3, 0.42, 0.45, 0.45); s.quadraticCurveTo(0.48, -0.1, 0, -0.55);
  s.quadraticCurveTo(-0.48, -0.1, -0.45, 0.45); s.quadraticCurveTo(-0.3, 0.42, 0, 0.55);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
  g.center(); return g;
}
function magnetGeometry() {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(new THREE.Vector3(Math.cos(a) * 0.32, Math.sin(a) * 0.32 + 0.1, 0)); }
  pts.unshift(new THREE.Vector3(0.32, -0.25, 0)); pts.push(new THREE.Vector3(-0.32, -0.25, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.1, 10, false);
}
function splatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 30, 0, TAU); g.fill();
  for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, d = 28 + Math.random() * 22, r = 4 + Math.random() * 9; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class TowerWorld {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.style = opts.style || 'helix';
    this.quality = opts.quality === 'low' ? 'low' : 'high';
    this.autoQ = opts.quality === 'auto';
    if (this.autoQ && softwareGL()) this.quality = 'low';
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === 'high' && (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dyn = 1; this.ema = 16; this.lastT = 0; this.slowFor = 0; this.fastFor = 0;
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.3, 400);
    this.top = new THREE.Color(opts.skyTop || '#5b8cff'); this.low = new THREE.Color(opts.skyLow || '#ffd1e8');
    s.fog = new THREE.Fog(this.low.clone(), 18, 60);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#8a86b8', 1.0); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff6e8', 2.1);
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; s.add(sun, sun.target);
    this._sky(); this._env();
    this.colors = {}; this.mats = {}; this.inst = {};
    this.step = this.style === 'stack' ? 1.25 : 3.1;
    this.wedge = wedgeGeometry(TAU / SEGS - (this.style === 'helix' ? 0.035 : 0.006), this.style === 'stack', this.style === 'stack' ? 0.62 : THICK);
    for (const [k, v] of Object.entries(opts.colors || {})) this._colorMat(k, v);
    this._pole(); this._ball(); this._pickups(); this._fx();
    this.GAP = 100; this.top0 = 0; this.ballR = 30;
    this.debris = []; this.parts = []; this.rings = []; this.splats = [];
    this.setQuality(this.quality); this.resize();
  }
  _sky() {
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: this.top }, low: { value: this.low } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 vP; void main(){ float h = clamp(vP.y*0.9+0.5,0.0,1.0); gl_FragColor = vec4(mix(low, top, smoothstep(0.0,1.0,h)),1.0); }' });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), m); this.sky.frustumCulled = false; this.scene.add(this.sky);
  }
  _env() {
    // a soft studio environment for the glossy ball and jewels: sky gradient plus two light panels
    const pm = new THREE.PMREMGenerator(this.renderer), es = new THREE.Scene();
    const g = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.ShaderMaterial({ side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vP; void main(){ float h=vP.y*0.5+0.5; gl_FragColor=vec4(mix(vec3(0.25,0.22,0.35),vec3(0.9,0.95,1.0),h),1.0);}' }));
    es.add(g);
    for (const [x, y, z] of [[4, 6, 3], [-5, 3, -2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); p.material.color.multiplyScalar(4); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p); }
    this.scene.environment = pm.fromScene(es, 0.02).texture; this.scene.environmentIntensity = 0.55;
    pm.dispose();
  }
  setSky(top, low) { this.top.set(top); this.low.set(low); this.scene.fog.color.set(low); }
  _colorMat(name, hex) {
    this.colors[name] = hex;
    // Phong keeps the candy gloss at a fraction of the per-pixel cost of the PBR material (platforms fill the screen)
    const m = new THREE.MeshPhongMaterial({ color: hex, shininess: 70, specular: '#3a3a3a' });
    this.mats[name] = m;
    const im = new THREE.InstancedMesh(this.wedge, m, 8 * 40);
    im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(im); this.inst[name] = { im, n: 0 };
  }
  _pole() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, '#f4f1ff'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#e7e2fb');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(120,110,190,.10)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 6, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 30);
    const pole = this.pole = new THREE.Mesh(new THREE.CylinderGeometry(R_IN * 0.92, R_IN * 0.92, this.step * 60, 32, 1, true),
      new THREE.MeshPhongMaterial({ map: t, shininess: 40, specular: '#222222', color: this.style === 'stack' ? '#d9d4ff' : '#ffffff' }));
    pole.receiveShadow = true; pole.castShadow = false; this.scene.add(pole);
    // a collar where each platform meets the pole
    this.collar = new THREE.InstancedMesh(new THREE.TorusGeometry(R_IN * 0.95, 0.12, 8, 32).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), 40);
    this.collar.frustumCulled = false; this.collar.count = 0; this.scene.add(this.collar);
  }
  _ball() {
    const col = this.style === 'stack' ? '#38bdf8' : '#fbbf24';
    this.ballMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.18, metalness: 0.05, emissive: col, emissiveIntensity: 0.12 });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R_BALL, 32, 20), this.ballMat);
    this.ballMesh.castShadow = true; this.scene.add(this.ballMesh);
    // inverted-hull outline on the hero
    this.outline = new THREE.Mesh(this.ballMesh.geometry, new THREE.MeshBasicMaterial({ color: '#1b1333', side: THREE.BackSide }));
    this.outline.scale.setScalar(1.08); this.ballMesh.add(this.outline);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(R_BALL * 1.45, 24, 16), new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.22, depthWrite: false }));
    this.magnet = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f472b6', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(this.shield, this.magnet);
    this.trail = new THREE.InstancedMesh(new THREE.SphereGeometry(R_BALL, 12, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false }), 12);
    this.trail.frustumCulled = false; this.trail.count = 0; this.scene.add(this.trail);
    this.shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(R_BALL * 0.9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
    this.scene.add(this.shadowBlob);
  }
  _pickups() {
    const gem = new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.08, metalness: 0.2, emissive: '#0e7490', emissiveIntensity: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.15, metalness: 0.85, emissive: '#7a4a00', emissiveIntensity: 0.25 });
    const mk = (geo, mat, n = 24) => { const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.count = 0; im.castShadow = true; this.scene.add(im); return { im, n: 0 }; };
    // octahedral jewel until the Kenney jewel model loads
    this.items = {
      gem: mk(new THREE.OctahedronGeometry(0.28, 0).scale(1, 1.4, 1), gem),
      elite: mk(new THREE.OctahedronGeometry(0.38, 0).scale(1, 1.4, 1), gold.clone()),
      ring: mk(new THREE.TorusGeometry(0.3, 0.09, 12, 32), gold),
      shield: mk(shieldGeometry(), new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.25, metalness: 0.3, emissive: '#0891b2', emissiveIntensity: 0.3 })),
      magnet: mk(magnetGeometry(), new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.2 })),
    };
    this.items.elite.im.material.color.set('#fde047');
  }
  /** swap the jewel stand-ins for the Kenney platformer-kit jewel (CC0) */
  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const byName = {};
    for (const n of gltf.scene.children) n.traverse(o => { if (o.isMesh && !byName[n.name]) { const g = dequantize(o.geometry.clone()); g.applyMatrix4(o.matrixWorld); byName[n.name] = g; } });
    if (byName.jewel) {
      const g = byName.jewel; g.computeBoundingBox(); const b = g.boundingBox, h = b.max.y - b.min.y;
      g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2); g.scale(0.62 / h, 0.62 / h, 0.62 / h);
      for (const k of ['gem', 'elite']) { const it = this.items[k]; this.scene.remove(it.im); const im = new THREE.InstancedMesh(k === 'elite' ? g.clone().scale(1.35, 1.35, 1.35) : g, it.im.material, 24); im.frustumCulled = false; im.count = 0; im.castShadow = true; this.scene.add(im); it.im = im; }
    }
  }
  _fx() {
    this.pmesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 300);
    this.pmesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(900).fill(1), 3);
    this.pmesh.frustumCulled = false; this.pmesh.count = 0; this.scene.add(this.pmesh);
    this.ringMesh = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; this.scene.add(m); this.ringMesh.push(m); }
    this.splatMat = new THREE.MeshBasicMaterial({ map: splatTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.splatMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.splatMat, 40);
    this.splatMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120).fill(1), 3);
    this.splatMesh.frustumCulled = false; this.splatMesh.count = 0; this.scene.add(this.splatMesh);
  }

  setQuality(q) {
    this.quality = q === 'low' ? 'low' : 'high';
    const hi = this.quality === 'high';
    this.dyn = 1;
    this.renderer.shadowMap.enabled = hi; this.sun.castShadow = hi;
    const ms = hi ? 1024 : 256;
    if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.below = hi ? 11 : 6;          // platforms drawn under the ball (draw distance)
    this.maxParts = hi ? 300 : 90;
    this.shadowBlob.visible = !hi;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }
  pixelRatio() { return Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1) * this.dyn); }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio()); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); this.W = w; this.H = h;
  }
  metrics(GAP, top0, ballR) { this.GAP = GAP; this.top0 = top0; this.ballR = ballR; this.ballScale = ballR / Math.max(1, Math.min(this.W, this.H) * 0.075); }

  /** world y of a sim y (screen px, growing downward) */
  y(simY) { return -(simY + this.top0) / this.GAP * this.step; }
  /** sim platform angle -> world angle around the pole */
  ang(a) { return a + Math.PI / 2 + FRONT; }

  begin() {
    for (const k in this.inst) this.inst[k].n = 0;
    for (const k in this.items) this.items[k].n = 0;
    this.collarN = 0; this.splatMesh.count = 0; this.minY = this.focusY - this.step * (this.below + 1); this.maxY = this.focusY + this.step * 4;
  }
  _wedge(color, x, y, z, yawAng, sc, rx, rz) {
    const it = this.inst[color] || this.inst[this._fallback(color)];
    if (!it) return;
    if (it.n >= it.im.instanceMatrix.count) return;
    _e.set(rx || 0, -yawAng, rz || 0, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(sc || 1); _p.set(x, y, z);
    _m.compose(_p, _q, _s); it.im.setMatrixAt(it.n++, _m);
  }
  _fallback(c) { if (!this.inst[c]) this._colorMat(c, c.startsWith('#') ? c : '#94a3b8'); return c; }
  /** draw platform p ({i, rot, segs:[colour names], broken, gap}) */
  platform(p) {
    if (p.broken || p.gap || !p.segs || !p.segs.length) return;
    const y = -p.i * this.step;
    if (y < this.minY || y > this.maxY) return;
    const seg = TAU / SEGS;
    for (let k = 0; k < SEGS; k++) {
      const a0 = this.ang(p.rot + k * seg);
      this._wedge(this.tint(p, k), 0, y, 0, a0 + seg - (this.style === 'helix' ? 0.0175 : 0.003));
    }
    if (this.collarN < 40) { _m.makeTranslation(0, y + 0.02, 0); this.collar.setMatrixAt(this.collarN++, _m); }
    if (p.splats) for (const sp of p.splats) this._splatAt(y, this.ang(p.rot) + sp.a, sp);
  }
  _splatAt(y, a, sp) {
    const n = this.splatMesh.count; if (n >= 40) return;
    _q.setFromAxisAngle(_up, sp.spin); _s.set(sp.size, 1, sp.size); _p.set(Math.cos(a) * R_TRACK, y + 0.012, Math.sin(a) * R_TRACK);
    _m.compose(_p, _q, _s); this.splatMesh.setMatrixAt(n, _m); this.splatMesh.setColorAt(n, _c.set(sp.color)); this.splatMesh.count = n + 1;
  }
  /** what colour a platform part is drawn in (Stack Ball: one band colour per 10 platforms, deadly parts keep theirs) */
  tint(p, k) {
    const c = p.segs[k];
    if (this.style !== 'stack' || !this.bands || c === this.deadly) return c;
    const b = this.bands[Math.floor(p.i / 10) % this.bands.length];
    return b[k % 2];
  }
  /** leave a paint splat under the ball on platform p (it turns with the platform) */
  splat(p, color) {
    if (!p) return;
    p.splats = p.splats || [];
    if (p.splats.length > 2) p.splats.shift();
    p.splats.push({ a: FRONT - this.ang(p.rot), color, size: 0.9 + Math.random() * 0.5, spin: Math.random() * TAU });
  }
  /** a pickup: kind gem | elite | ring | shield | magnet, on platform i, `off` sim px to the side of the ball track */
  item(kind, simY, off, t) {
    const it = this.items[kind]; if (!it || it.n >= 24) return;
    const y = this.y(simY) + R_BALL * 1.3 + Math.sin(t * 3 + off) * 0.08;
    if (y < this.minY || y > this.maxY) return;
    const a = FRONT + off / Math.max(1, this.ballR) * 0.16;
    _e.set(kind === 'ring' ? Math.PI / 2 : 0, t * 2 + off, kind === 'ring' ? 0.3 : 0, 'YXZ'); _q.setFromEuler(_e);
    _s.setScalar(1); _p.set(Math.cos(a) * R_TRACK, y, Math.sin(a) * R_TRACK);
    _m.compose(_p, _q, _s); it.im.setMatrixAt(it.n++, _m);
  }
  /** the ball: by = sim y of its centre; squash 0..1 on landing; stretch while falling */
  ball(by, squash, stretch, opts = {}) {
    const b = this.ballMesh, sc = this.ballScale || 1;
    const bottom = this.y(by + this.ballR);
    let hop = 0;
    if (opts.resting && !REDUCED) hop = Math.abs(Math.sin(opts.t * 6.5)) * 0.32;
    const sq = squash + (opts.resting && !REDUCED ? Math.max(0, 0.25 - hop) * 0.8 : 0);
    const sx = 1 + sq * 0.3 - (stretch || 0) * 0.5, sy = 1 - sq * 0.35 + (stretch || 0);
    b.scale.set(sx * sc, sy * sc, sx * sc);
    b.position.set(0, bottom + R_BALL * sy * sc + hop, R_TRACK);
    b.visible = !opts.hidden;
    this.ballY = b.position.y;
    this.shield.visible = !!opts.shield && !opts.hidden; this.shield.position.copy(b.position); this.shield.scale.setScalar(sc * (1 + Math.sin(opts.t * 5) * 0.04));
    this.magnet.visible = !!opts.magnet && !opts.hidden; this.magnet.position.set(0, bottom + 0.05, R_TRACK); this.magnet.scale.setScalar(R_BALL * 6 * sc * 0.5);
    this.shadowBlob.position.set(0, bottom + 0.01, R_TRACK); this.shadowBlob.visible = this.quality === 'low' && !opts.hidden;
    // trail while falling
    const tr = opts.trail || []; this.trail.count = 0;
    if (!opts.hidden) for (let i = 0; i < tr.length && i < 12; i++) {
      const k = (i + 1) / tr.length; _s.setScalar(sc * (0.4 + 0.5 * k)); _p.set(0, this.y(tr[i] + this.ballR) + R_BALL * sc, R_TRACK); _q.identity();
      _m.compose(_p, _q, _s); this.trail.setMatrixAt(this.trail.count++, _m);
    }
    this.trail.instanceMatrix.needsUpdate = true;
  }
  end() {
    for (const k in this.inst) { const it = this.inst[k]; it.im.count = it.n; it.im.instanceMatrix.needsUpdate = true; }
    for (const k in this.items) { const it = this.items[k]; it.im.count = it.n; it.im.instanceMatrix.needsUpdate = true; }
    this.collar.count = this.collarN; this.collar.instanceMatrix.needsUpdate = true;
    this.splatMesh.instanceMatrix.needsUpdate = true; if (this.splatMesh.instanceColor) this.splatMesh.instanceColor.needsUpdate = true;
  }

  /** break platform p into its wedges, thrown outward */
  shatter(p) {
    if (!p || !p.segs) return;
    const y = -p.i * this.step, seg = TAU / SEGS, hi = this.quality === 'high';
    for (let k = 0; k < SEGS; k++) {
      const a0 = this.ang(p.rot + k * seg), mid = a0 + seg / 2;
      this.debris.push({ c: this.tint(p, k), a: a0 + seg, x: 0, y, z: 0, vx: Math.cos(mid) * (4 + Math.random() * 3), vz: Math.sin(mid) * (4 + Math.random() * 3), vy: 2 + Math.random() * 3, rx: 0, rz: 0, wx: (Math.random() - 0.5) * 8, wz: (Math.random() - 0.5) * 8, t: 0 });
      if (hi) this._burst(this.tint(p, k), 3, Math.cos(mid) * R_TRACK, y, Math.sin(mid) * R_TRACK);
    }
    p.splats = null;
  }
  /** little cubes of `color` bursting from the ball */
  burstBall(color, n) { this._burst(color, n, 0, (this.ballY || 0) - R_BALL * 0.6, R_TRACK); }
  /** ... or from a pickup at sim y, `off` px beside the track */
  burstAt(simY, off, color, n) { const a = FRONT + off / Math.max(1, this.ballR) * 0.16; this._burst(color, n, Math.cos(a) * R_TRACK, this.y(simY) + R_BALL * 1.3, Math.sin(a) * R_TRACK); }
  _burst(color, n, x, y, z) {
    const hex = this.colors[color] || color;
    for (let i = 0; i < n && this.parts.length < this.maxParts; i++) {
      const a = Math.random() * TAU, s = 2 + Math.random() * 4;
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * 4, vz: Math.sin(a) * s, t: 0, life: 0.45 + Math.random() * 0.4, s: 0.08 + Math.random() * 0.12, c: new THREE.Color(hex), r: Math.random() * 6 });
    }
  }
  /** a flat shock ring at the ball */
  ring(color) {
    const m = this.ringMesh.find(r => !r.visible); if (!m) return;
    m.visible = true; m.userData.t = 0; m.material.color.set(this.colors[color] || color);
    m.position.set(0, (this.ballY || 0) - R_BALL * 0.8, R_TRACK);
  }
  _stepFx(dt) {
    // debris wedges: reuse the colour instancing
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.t += dt;
      if (d.t > 1.1) { this.debris[i] = this.debris[this.debris.length - 1]; this.debris.pop(); continue; }
      d.vy -= 20 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.rz += d.wz * dt;
      this._wedge(d.c, d.x, d.y, d.z, d.a, Math.max(0.01, 1 - Math.pow(d.t / 1.1, 2)), d.rx, d.rz);
    }
    for (const k in this.inst) { const it = this.inst[k]; it.im.count = it.n; it.im.instanceMatrix.needsUpdate = true; }
    const im = this.pmesh; let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.t += dt;
      if (p.t >= p.life) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy -= 16 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += dt * 8;
      _e.set(p.r, p.r * 0.7, 0); _q.setFromEuler(_e); _s.setScalar(p.s * (1 - p.t / p.life)); _p.set(p.x, p.y, p.z);
      _m.compose(_p, _q, _s); im.setMatrixAt(n, _m); im.setColorAt(n, p.c); n++;
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    for (const m of this.ringMesh) if (m.visible) {
      m.userData.t += dt; const k = m.userData.t / 0.35;
      if (k >= 1) { m.visible = false; continue; }
      m.scale.setScalar(0.6 + k * 2.4); m.material.opacity = (1 - k) * 0.8;
    }
  }

  /** camera follows the ball down the tower */
  view(focusSimY, shake = 0) {
    const fy = this.y(focusSimY);
    this.focusY = this.focusY == null ? fy : this.focusY;
    this.focusY = fy;
    const c = this.camera, a = c.aspect;
    // fit the tower's width (plus margin) inside the horizontal field of view
    const vfov = c.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * a);
    const dist = Math.max(17, (R_OUT * 2 + 2.2) / (2 * Math.tan(hfov / 2)) + 4);
    c.position.set(0, fy + dist * 0.5, R_TRACK + dist * 0.86);
    if (shake && !REDUCED) { c.position.x += (Math.random() - 0.5) * shake; c.position.y += (Math.random() - 0.5) * shake; }
    c.lookAt(0, fy - 2.6, 0);
    c.far = 320; c.updateProjectionMatrix();
    this.scene.fog.near = dist + this.step * 2; this.scene.fog.far = dist + this.step * (this.below + 2);
    this.sky.position.copy(c.position);
    this.pole.position.y = fy - this.step * 20;
    this.sun.position.set(3, fy + 14, 9); this.sun.target.position.set(0, fy - 3, 0);
    const sh = this.sun.shadow.camera; sh.left = -7; sh.right = 7; sh.top = 7; sh.bottom = -7; sh.near = 1; sh.far = 40; sh.updateProjectionMatrix();
  }
  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return { x: (_v.x + 1) / 2 * this.W, y: (1 - _v.y) / 2 * this.H };
  }
  /** screen position of the ball, for score pop-ups */
  ballScreen(dy = 0) { return this.project(0, (this.ballY || 0) + dy, R_TRACK); }
  _adapt() {
    const now = performance.now(), d = this.lastT ? now - this.lastT : 16; this.lastT = now;
    if (d > 500) return;
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
    this._stepFx(dt || 0.016);
    this.renderer.render(this.scene, this.camera);
    this.splatMesh.count = 0;
  }
}
