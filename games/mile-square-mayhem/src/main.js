// MILE SQUARE MAYHEM — a cel-shaded action RPG in Hoboken.
// Real-city mode streams Google Photorealistic 3D Tiles; toy mode uses the hand-built
// Hoboken from Stick Head: Garden State. Everything collides by raycasting the world meshes.
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { renderer, scene, camera, toon, inkify, SKY, sun } from './core.js';
import { CelPost } from './post.js';
import { buildHero, poseHero } from './character.js';
import { buildImp, poseImp } from './imp.js';
import { buildGrump, cheerUp, KIND } from './enemies.js';
import * as Toy from './toyworld.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const IN_CLAUDE = /claude/i.test(location.hostname) || /claudeusercontent/i.test(location.hostname);
const DBG = window.MSM = { paused: false };

// ---------------------------------------------------------------- renderer / post
const post = new CelPost(renderer);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
}
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- save
const SAVE_KEY = 'msm-save-v1';
let save = { lv: 1, xp: 0, cleared: [] };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.lv) save = Object.assign(save, s); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------------------------------------------------------------- audio (tiny synth)
let AC = null;
function audio() { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function blip(type, f0, f1, dur, vol = 0.18, noise = false) {
  const a = AC; if (!a) return;
  const t = a.currentTime, g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.connect(a.destination);
  if (noise) {
    const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(); s.buffer = b; const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(fl); fl.connect(g); s.start(t); return;
  }
  const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); o.connect(g); o.start(t); o.stop(t + dur);
}
const SFX = {
  swing: () => blip('triangle', 500, 180, 0.09, 0.08, true),
  hit: () => { blip('square', 220, 60, 0.12, 0.14); blip('', 1800, 200, 0.1, 0.18, true); },
  big: () => { blip('sawtooth', 160, 40, 0.3, 0.2); blip('', 900, 80, 0.35, 0.25, true); },
  hurt: () => blip('square', 330, 110, 0.2, 0.14),
  jump: () => blip('sine', 300, 620, 0.12, 0.1),
  flap: () => blip('', 700, 300, 0.07, 0.06, true),
  cheer: () => { blip('sine', 660, 990, 0.12, 0.12); setTimeout(() => blip('sine', 880, 1320, 0.14, 0.1), 90); },
  lvl: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip('square', f, f, 0.16, 0.1), i * 110)),
  imp: () => { blip('sawtooth', 900, 300, 0.18, 0.1); blip('sine', 200, 900, 0.2, 0.08); }
};

// ---------------------------------------------------------------- world + collision
const hitRoots = [];            // meshes/groups the player & enemies collide with
let MODE = null;                // 'toy' | 'real'
let tiles = null, tilesHolder = null;
const rc = new THREE.Raycaster(); rc.firstHitOnly = true;
const _n = V(), _o = V(), _d = V();
function cast(o, d, far) {
  rc.set(o, d); rc.far = far;
  const h = rc.intersectObjects(hitRoots, true);
  if (!h.length) return null;
  const hit = h[0];
  if (hit.face) hit.wn = _n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).clone(); else hit.wn = new THREE.Vector3(0, 1, 0);
  return hit;
}
const DOWN = new THREE.Vector3(0, -1, 0);
function groundAt(x, y, z, up = 0.9, far = 80) { const h = cast(_o.set(x, y + up, z), DOWN, far + up); return h ? h.point.y : -Infinity; }

// geographic helpers (real mode): local x = east, z = south (metres), origin below.
const LAT0 = 40.7420, LON0 = -74.0290, D2R = Math.PI / 180;
const geo = (lat, lon) => [(lon - LON0) * Math.cos(LAT0 * D2R) * 111320, -(lat - LAT0) * 110574];

// ---------------------------------------------------------------- sites (quests)
const SITES = [
  { id: 'terminal', name: 'Hoboken Terminal', sub: 'Gloom on the ferry plaza', lat: 40.7361, lon: -74.0283, toy: [180, 4], foes: 'ggg' },
  { id: 'cityhall', name: 'City Hall', sub: 'Washington St & Newark St', lat: 40.7372, lon: -74.0310, toy: [0, 128], foes: 'gggg' },
  { id: 'piera', name: 'Pier A Park', sub: 'On the Hudson', lat: 40.7369, lon: -74.0263, toy: [410, 228], foes: 'ggggb' },
  { id: 'church', name: 'Church Square Park', sub: 'Since 1804', lat: 40.7423, lon: -74.0318, toy: [-225, 468], foes: 'gggggb' },
  { id: 'castle', name: 'Castle Point', sub: 'Stevens Institute of Technology', lat: 40.7447, lon: -74.0240, toy: [300, 690], foes: 'ggggbb' },
  { id: 'elysian', name: 'Elysian Park', sub: 'Where the Big Gloom sulks', lat: 40.7486, lon: -74.0262, toy: [240, 977], foes: 'boss', boss: true }
];
const SPAWN = { real: { lat: 40.7362, lon: -74.0287 }, toy: [262, -5] };
const BOSS_NEED = 4;
let sites = [];

// ---------------------------------------------------------------- actors
const hero = buildHero(); scene.add(hero.root);
const imp = buildImp(); scene.add(imp.root);
const P = {
  pos: V(), vel: V(), yaw: 0, grounded: false, jumps: 0, glide: false, glideAmt: 0, airT: 0, flipT: -1, wall: null, wallT: 0, wallAmt: 0,
  hp: 100, maxHp: 100, inv: 0, combo: 0, comboT: 0, att: 0, attKind: 0, attHit: false, attQueued: false, pound: false,
  runAmt: 0, runPh: 0, land: 0, hurt: 0, flaps: 0, lastSafe: V(), safeT: 0, dead: 0, impCd: 0, ready: false, push: V()
};
const IMP = { pos: V(), vel: V(), mode: 'follow', t: 0, target: null };
function stats() {
  const lv = save.lv;
  return { maxHp: 100 + 18 * (lv - 1), atk: 10 + 3.5 * (lv - 1), need: 40 + 35 * lv };
}

// ---------------------------------------------------------------- FX
const fxGroup = new THREE.Group(); scene.add(fxGroup);
const fx = [];
function burstTex(word, col) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.translate(128, 128); x.beginPath();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 70 : 118 + (i % 4 ? 0 : 6); x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 10; x.strokeStyle = '#161216'; x.stroke();
  x.rotate(-0.12); x.font = '64px Bangers, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.strokeStyle = '#161216'; x.strokeText(word, 0, 6); x.fillStyle = '#fff36a'; x.fillText(word, 0, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BURSTS = {};
function burst(word, pos, size = 1.4, col = '#e8306e') {
  const k = word + col; if (!BURSTS[k]) BURSTS[k] = burstTex(word, col);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: BURSTS[k], depthTest: false, transparent: true }));
  sp.position.copy(pos); sp.scale.setScalar(0.01); sp.layers.set(1); sp.renderOrder = 10; fxGroup.add(sp);
  sp.material.rotation = rand(-0.3, 0.3);
  fx.push({ o: sp, t: 0, life: 0.55, upd: (f, k2) => { const s = size * (k2 < 0.2 ? k2 / 0.2 * 1.15 : 1.15 - (k2 - 0.2) * 0.25); f.o.scale.setScalar(s); f.o.material.opacity = k2 > 0.7 ? (1 - k2) / 0.3 : 1; } });
}
const heartTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.font = '52px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('💖', 32, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function heart(pos) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true })); sp.layers.set(1); sp.position.copy(pos); sp.scale.setScalar(0.7); fxGroup.add(sp);
  fx.push({ o: sp, t: 0, life: 1.6, upd: (f, k) => { f.o.position.y += 0.03; f.o.material.opacity = 1 - k; } });
}
const ringGeo = new THREE.TorusGeometry(1, 0.08, 6, 48).rotateX(Math.PI / 2);
function ring(pos, r0, r1, life, col = 0xffffff) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true })); m.position.copy(pos); m.layers.set(1); fxGroup.add(m);
  const ink = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x161216, transparent: true })); ink.scale.set(1, 2.2, 1); ink.position.y = -0.02; ink.layers.set(1); m.add(ink);
  fx.push({ o: m, t: 0, life, upd: (f, k) => { const r = lerp(r0, r1, 1 - (1 - k) * (1 - k)); f.o.scale.set(r, 1 + r * 0.05, r); f.o.material.opacity = ink.material.opacity = 1 - k; } });
  return m;
}
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
function puff(pos, n = 6, sz = 0.3, col = 0xf3efe2) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, toon(col)); m.position.copy(pos); m.layers.set(1); fxGroup.add(m);
    const a = Math.random() * 6.28, v = new THREE.Vector3(Math.cos(a) * rand(1.5, 3.5), rand(0.5, 2.5), Math.sin(a) * rand(1.5, 3.5));
    fx.push({ o: m, t: 0, life: rand(0.4, 0.7), upd: (f, k, dt) => { f.o.position.addScaledVector(v, dt); v.multiplyScalar(0.92); f.o.scale.setScalar(sz * (1 - k * 0.9)); f.o.rotation.x += dt * 4; } });
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { fxGroup.remove(f.o); f.o.material.dispose?.(); fx.splice(i, 1); continue; }
    f.upd(f, k, dt);
  }
}
// floating damage numbers (DOM)
const dmgEls = [];
function dmgNum(pos, text, col = '#fff36a', big = false) {
  const el = document.createElement('div'); el.className = 'dmg'; el.textContent = text; el.style.color = col; if (big) el.style.fontSize = '36px';
  document.body.appendChild(el); dmgEls.push({ el, p: pos.clone(), t: 0, dx: rand(-0.4, 0.4) });
}
const _sp = V();
function updateDmg(dt) {
  for (let i = dmgEls.length - 1; i >= 0; i--) {
    const d = dmgEls[i]; d.t += dt;
    if (d.t > 0.9) { d.el.remove(); dmgEls.splice(i, 1); continue; }
    _sp.copy(d.p); _sp.y += d.t * 1.6; _sp.x += d.dx * d.t; _sp.project(camera);
    if (_sp.z > 1) { d.el.style.display = 'none'; continue; }
    d.el.style.display = '';
    const s = d.t < 0.12 ? 0.6 + d.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (d.t - 0.12));
    d.el.style.transform = `translate(${(_sp.x * 0.5 + 0.5) * innerWidth - 20}px, ${(-_sp.y * 0.5 + 0.5) * innerHeight - 20}px) scale(${s})`;
    d.el.style.left = '0'; d.el.style.top = '0'; d.el.style.opacity = d.t > 0.6 ? (0.9 - d.t) / 0.3 : 1;
  }
}
let shake = 0, hitStop = 0;

// ---------------------------------------------------------------- UI helpers
let sayTimer = 0;
function say(who, txt, ms = 3600) { $('say').querySelector('.who').textContent = who; $('say').querySelector('.txt').textContent = txt; $('say').style.opacity = 1; sayTimer = ms / 1000; }
let bannerT = 0;
function banner(big, small = '', ms = 1800) { $('banner').innerHTML = big + (small ? `<small>${small}</small>` : ''); $('banner').classList.add('show'); bannerT = ms / 1000; }
function busy(msg) { const b = $('busy'); if (!msg) { b.style.display = 'none'; return; } b.textContent = msg; b.style.display = 'block'; }
const IMP_LINES = [
  'Hold JUMP in the air and I\'ll carry you. Don\'t get used to it.',
  'You know these grumps cheer up if you bop them? Weird town.',
  'Run straight at a wall and keep going. You climb. Don\'t ask me how.',
  'Press IMP and I\'ll go bite something. I\'m very good at biting.',
  'Mile Square City. One mile. Square. I flew it in four minutes.',
  'You\'re grumpier than the grumps. I respect that.',
  'In the air, hit POW to slam down. Big crowd? Big slam.'
];
const GLIDE_LINES = ['Ugh! You\'re HEAVY!', 'Flap flap flap flap…', 'Who eats this many cannoli?!', 'My wings are filing a complaint.', 'Wheeee— I mean, ugh.'];

// ---------------------------------------------------------------- input
const keys = {};
const input = { x: 0, z: 0, jump: false, jumpPressed: false, run: false, atkPressed: false, impPressed: false };
addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true; audio();
  if (e.code === 'Space') input.jumpPressed = true;
  if (e.code === 'KeyJ' || e.code === 'KeyF' || e.code === 'Enter') input.atkPressed = true;
  if (e.code === 'KeyK' || e.code === 'KeyE') input.impPressed = true;
  if (e.code === 'Escape' && MODE) toggleMenu();
});
addEventListener('keyup', e => { keys[e.code] = false; });
let stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const zone = $('stickZone'), joy = $('joy'), knob = $('knob');
zone.addEventListener('pointerdown', e => { audio(); stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; zone.setPointerCapture(e.pointerId);
  joy.style.display = 'block'; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; knob.style.transform = ''; });
zone.addEventListener('pointermove', e => { if (e.pointerId !== stick.id) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), m = 50;
  if (l > m) { dx *= m / l; dy *= m / l; } stick.x = dx / m; stick.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; });
const endStick = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; joy.style.display = 'none'; };
zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
function holdBtn(id, down, up) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio(); b.classList.add('press'); b.setPointerCapture(e.pointerId); down(); });
  const u = e => { b.classList.remove('press'); up && up(); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u);
}
let btnJump = false;
holdBtn('bJump', () => { btnJump = true; input.jumpPressed = true; }, () => { btnJump = false; });
holdBtn('bAtk', () => { input.atkPressed = true; });
holdBtn('bImp', () => { input.impPressed = true; });
let runToggle = false;
holdBtn('bRun', () => { runToggle = !runToggle; $('bRun').classList.toggle('on', runToggle); });
$('bMenu').addEventListener('click', () => toggleMenu());

// camera orbit: drag anywhere else, wheel / pinch to zoom
const cam = { yaw: Math.PI, pitch: 0.32, dist: 7.5, drag: 0, idle: 9 };
const ptrs = new Map(); let pinch0 = 0;
renderer.domElement.addEventListener('pointerdown', e => { audio(); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  renderer.domElement.setPointerCapture(e.pointerId); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
renderer.domElement.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) { cam.yaw -= (e.clientX - p.x) * 0.006; cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * 0.004, -0.25, 1.35); cam.idle = 0; }
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) cam.dist = clamp(cam.dist * pinch0 / d, 3, 40); pinch0 = d; } });
const endPtr = e => { const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); pinch0 = 0;
  // a quick tap (mouse click) on the scene = attack, for desktop players
  if (p && e.pointerType === 'mouse' && Math.hypot(p.x - p.sx, p.y - p.sy) < 6 && performance.now() - p.t < 300 && MODE) input.atkPressed = true; };
renderer.domElement.addEventListener('pointerup', endPtr); renderer.domElement.addEventListener('pointercancel', endPtr);
addEventListener('wheel', e => { cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 3, 40); }, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());

function readInput() {
  let x = stick.x, z = stick.y;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) z -= 1; if (keys.KeyS || keys.ArrowDown) z += 1;
  const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  input.x = x; input.z = z; input.jump = !!(keys.Space || btnJump); input.run = !!(keys.ShiftLeft || keys.ShiftRight) || runToggle;
}

// ---------------------------------------------------------------- world setup
function clearWorld() {
  hitRoots.length = 0;
  if (tilesHolder) { scene.remove(tilesHolder); tiles.dispose(); tiles = null; tilesHolder = null; }
  if (Toy.world) { scene.remove(Toy.world.root); }
  for (const e of enemies) scene.remove(e.m.root); enemies.length = 0;
  for (const s of sites) scene.remove(s.beacon); sites = [];
}
function startToy() {
  clearWorld(); MODE = 'toy';
  busy('Building Hoboken…');
  setTimeout(() => {
    Toy.buildHoboken();
    const w = Toy.world;
    w.root.traverse(o => { if (o.isMesh && !o.isSprite) { o.layers.set(0); if (o.geometry && o.geometry.attributes.position.count > 30 && o !== w.water) o.geometry.computeBoundsTree(); } });
    w.npcs.forEach(n => n.g.traverse(o => o.layers.set(1)));
    for (const n of w.npcs) inkify(n.body, 0.01, 1);
    // collide with everything except the water sheet and NPC sprites
    w.root.children.forEach(o => { if (o !== w.water && o.isMesh) hitRoots.push(o); });
    post.u.toonAmt.value = 0; post.u.kuwa.value = 0; post.u.creaseAmt.value = 0.6; post.u.fogNear.value = 280; post.u.fogFar.value = 1500;
    camera.far = 2600; camera.updateProjectionMatrix();
    $('mini').style.display = 'block'; $('attr').textContent = w.attribution;
    const [sx, sz] = Toy.M(...SPAWN.toy);
    makeSites((x, n) => Toy.M(x, n), 'toy');
    spawnPlayer(sx, sz, 30);
    busy(null); begin();
  }, 30);
}
async function startReal(key, testUrl = null) {
  clearWorld(); MODE = 'real';
  busy('Calling Google for the 3D city…');
  let TR, PL, DRACO, MESHOPT;
  try {
    TR = await import('3d-tiles-renderer');
    PL = await import('3d-tiles-renderer/plugins');
    DRACO = (await import('three/addons/loaders/DRACOLoader.js')).DRACOLoader;
    MESHOPT = (await import('three/addons/libs/meshopt_decoder.module.js')).MeshoptDecoder;
  } catch (e) { console.error(e); busy(null); realFail('Could not load the 3D tiles code.'); return; }
  tiles = new TR.TilesRenderer(testUrl || undefined);
  if (!testUrl) tiles.registerPlugin(new PL.GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true }));
  const draco = new DRACO().setDecoderPath('./draco/');
  tiles.registerPlugin(new PL.GLTFExtensionsPlugin({ dracoLoader: draco, meshoptDecoder: MESHOPT }));
  tiles.registerPlugin(new PL.UnloadTilesPlugin());
  tiles.registerPlugin(testUrl ? new PL.ReorientationPlugin({ up: '+z', recenter: true }) : new PL.ReorientationPlugin({ lat: LAT0 * D2R, lon: LON0 * D2R, height: 0, recenter: true }));
  tiles.errorTarget = 8;
  tilesHolder = new THREE.Group(); tilesHolder.rotation.y = Math.PI; tilesHolder.add(tiles.group); scene.add(tilesHolder);
  hitRoots.push(tiles.group);
  let fails = 0;
  tiles.addEventListener('load-model', ({ scene: s }) => {
    s.traverse(o => {
      if (!o.isMesh) return;
      o.layers.set(0);
      const m = o.material, map = m && m.map;
      o.material = new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : (m && m.color ? m.color : 0xcccccc) });
      if (m) m.dispose();
      o.geometry.computeBoundsTree();
    });
  });
  tiles.addEventListener('dispose-model', ({ scene: s }) => s.traverse(o => { if (o.isMesh && o.geometry.boundsTree) o.geometry.disposeBoundsTree(); }));
  tiles.addEventListener('load-error', e => { fails++; console.warn('tile error', e.error); if (fails === 1 && !P.ready) realFail(IN_CLAUDE ?
    'The Claude viewer blocks downloads from Google, so the real city can\'t stream in here.' : 'Google refused the request. Check that the key is right and the Map Tiles API is on.'); });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35)); resize();
  post.u.toonAmt.value = 1; post.u.kuwa.value = 1; post.u.creaseAmt.value = 0.35; post.u.fogNear.value = 500; post.u.fogFar.value = 3200;
  camera.far = 6000; camera.updateProjectionMatrix();
  $('mini').style.display = 'block';
  makeSites(geo, 'real');
  const [sx, sz] = testUrl ? [0, 0] : geo(SPAWN.real.lat, SPAWN.real.lon);
  spawnPlayer(sx, sz, null);
  busy('Streaming Hoboken from Google…');
  begin();
}
function realFail(msg) {
  busy(null); MODE = null; showScreen('title');
  setTimeout(() => alertCard(msg), 50);
}
function alertCard(msg) {
  const d = document.createElement('div'); d.className = 'screen'; d.innerHTML = `<div class="card"><h2>Real Hoboken didn't load</h2><div>${msg}</div>
    ${IN_CLAUDE ? '<div class="note" style="margin-top:6px">Play it at <a href="https://itemnautsoft.github.io/Soft/games/mile-square-mayhem/" target="_blank" rel="noopener">itemnautsoft.github.io/Soft</a>.</div>' : ''}
    <div class="row"><button class="big yel">Play Toy Hoboken</button><button class="big">Close</button></div></div>`;
  document.body.appendChild(d);
  const [a, b] = d.querySelectorAll('button'); a.onclick = () => { d.remove(); $('title').style.display = 'none'; startToy(); }; b.onclick = () => d.remove();
}

// ---------------------------------------------------------------- sites / beacons
const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff36a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamDone = new THREE.MeshBasicMaterial({ color: 0x7dffb8, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamLock = new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function makeSites(toXZ, mode) {
  sites = SITES.map(S => {
    const [x, z] = mode === 'toy' ? toXZ(S.toy[0], S.toy[1]) : toXZ(S.lat, S.lon);
    const beacon = new THREE.Group(); beacon.position.set(x, 0, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 260, 20, 1, true), beamMat); beam.position.y = 130; beacon.add(beam);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), toon(0xfff36a)); star.position.y = 4; beacon.add(star);
    inkify(star, 0.03, 1); beacon.traverse(o => o.layers.set(1));
    scene.add(beacon);
    return { ...S, x, z, y: null, beacon, beam, star, state: save.cleared.includes(S.id) ? 'done' : 'idle', foesLeft: 0 };
  });
  refreshBeacons();
}
function refreshBeacons() {
  const n = save.cleared.filter(id => id !== 'elysian').length;
  for (const s of sites) {
    s.locked = s.boss && n < BOSS_NEED && s.state !== 'done';
    s.beam.material = s.state === 'done' ? beamDone : s.locked ? beamLock : beamMat;
    s.star.material = toon(s.state === 'done' ? 0x7dffb8 : s.locked ? 0x8a5cff : 0xfff36a);
  }
}
function siteGround(s) {
  if (s.y !== null) return true;
  const g = groundAt(s.x, 400, s.z, 0, 900);
  if (g > -Infinity) { s.y = g; s.beacon.position.y = g; return true; }
  return false;
}

// ---------------------------------------------------------------- enemies
const enemies = [];
function spawnEnemy(kind, x, z, site = null) {
  const y = groundAt(x, P.pos.y + 40, z, 0, 120);
  if (y === -Infinity) return null;
  const m = buildGrump(kind); m.root.position.set(x, y, z); scene.add(m.root);
  const lvBonus = 1 + 0.18 * (save.lv - 1);
  const e = { m, kind, K: m.K, pos: m.root.position, vel: V(), hp: Math.round(m.K.hp * (kind === 'boss' ? 1 : lvBonus)), maxHp: 0, state: 'idle', t: rand(0, 1),
    home: V().set(x, y, z), yaw: rand(0, 6.28), stun: 0, cd: rand(0.5, 1.5), grounded: true, site, cheer: 0, hopPh: rand(0, 6), summonT: 6, slamT: 3, flash: 0 };
  e.maxHp = e.hp; m.root.scale.setScalar(0.01);
  enemies.push(e); return e;
}
function spawnNest(s) {
  s.state = 'active';
  const list = s.boss ? ['boss', 'g', 'g'] : s.foes.split('');
  let n = 0;
  list.forEach((k, i) => {
    const a = i / list.length * Math.PI * 2 + rand(-0.3, 0.3), r = k === 'boss' ? 4 : rand(5, 10);
    const e = spawnEnemy(k, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, s); if (e) { n++; e.state = 'chase'; puff(e.pos.clone().setY(e.pos.y + 0.5), 8, 0.45, 0x5E5279); }
  });
  s.foesLeft = n;
  banner(s.boss ? 'THE BIG GLOOM!' : 'GLOOM ATTACK!', s.name, 1600);
  if (s.boss) say('Imp', 'That\'s the Big Gloom. Jump over its shockwaves. And maybe let me bite it.', 4500);
}
let roamT = 4;
function updateRoamers(dt) {
  roamT -= dt; if (roamT > 0) return; roamT = rand(6, 11);
  const roam = enemies.filter(e => !e.site && e.state !== 'cheer').length;
  if (roam >= 5 || sites.some(s => s.state === 'active')) return;
  for (let i = 0; i < 1 + (Math.random() < 0.4); i++) {
    const a = rand(0, 6.28), r = rand(22, 38), x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
    const y = groundAt(x, P.pos.y + 30, z, 0, 80);
    if (y === -Infinity || Math.abs(y - P.pos.y) > 4) continue;
    spawnEnemy(Math.random() < 0.15 + 0.03 * save.lv ? 'b' : 'g', x, z);
  }
}
function damageEnemy(e, dmg, dir, kb = 6, word = null) {
  if (e.state === 'cheer') return;
  const crit = Math.random() < 0.12; if (crit) dmg *= 2;
  dmg = Math.round(dmg * rand(0.9, 1.1));
  e.hp -= dmg; e.flash = 0.12;
  const kbm = e.kind === 'boss' ? 0.15 : e.kind === 'b' ? 0.5 : 1;
  e.vel.x += dir.x * kb * kbm; e.vel.z += dir.z * kb * kbm; if (e.kind !== 'boss') { e.vel.y = Math.max(e.vel.y, 3.5 * kbm); e.grounded = false; }
  e.stun = e.kind === 'boss' ? 0.08 : 0.35; e.state = e.state === 'idle' ? 'chase' : e.state;
  const top = e.pos.clone(); top.y += e.m.size * 1.7;
  dmgNum(top, crit ? dmg + '!' : '' + dmg, crit ? '#ff7ab0' : '#fff36a', crit);
  burst(word || ['POW!', 'BAM!', 'WHAM!', 'BOP!', 'ZAP!'][(Math.random() * 5) | 0], top.clone().lerp(P.pos, 0.3).setY(top.y - 0.3), crit ? 1.9 : 1.4);
  SFX.hit(); hitStop = Math.max(hitStop, crit ? 0.09 : 0.055); shake = Math.max(shake, crit ? 0.35 : 0.18);
  if (e.hp <= 0) cheerEnemy(e);
}
function cheerEnemy(e) {
  e.state = 'cheer'; e.cheer = 0; cheerUp(e.m); SFX.cheer();
  heart(e.pos.clone().setY(e.pos.y + e.m.size * 2));
  gainXp(e.K.xp);
  if (e.kind === 'boss') { banner('BIG GLOOM CHEERED UP!', 'Hoboken is sunny again ☀', 3200); shake = 0.8; }
  if (Math.random() < 0.18 && e.kind !== 'boss') dropCannoli(e.pos);
  if (e.site) {
    e.site.foesLeft--;
    if (e.site.foesLeft <= 0) siteCleared(e.site);
  }
}
function siteCleared(s) {
  s.state = 'done'; if (!save.cleared.includes(s.id)) save.cleared.push(s.id); persist();
  setTimeout(() => { banner('QUEST CLEARED!', s.name + ' cheered up · +60 XP', 2200); gainXp(60); refreshBeacons(); heal(stats().maxHp);
    const n = save.cleared.filter(id => id !== 'elysian').length;
    if (n === BOSS_NEED) setTimeout(() => say('Imp', 'Feel that? The Big Gloom is awake up at Elysian Park. Let\'s go ruin its day.', 5000), 2400);
    else if (save.cleared.length === sites.length) setTimeout(() => say('Imp', 'Every spot in town is cheered up. Even you look… slightly less grumpy.', 5000), 2400);
  }, 700);
}
// cannoli pickups heal
const pickups = [];
function dropCannoli(pos) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10).rotateZ(Math.PI / 2), toon(0xE0A050)); g.add(shell);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0xFFF8E8)); c.position.x = 0.27 * s; g.add(c); }
  inkify(g, 0.012, 1); g.position.copy(pos).setY(pos.y + 0.6); scene.add(g); pickups.push({ g, t: 0 });
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt; p.g.rotation.y += dt * 3; p.g.position.y += Math.sin(p.t * 4) * 0.004;
    if (p.g.position.distanceTo(_o.copy(P.pos).setY(P.pos.y + 0.6)) < 1.2) { heal(35); dmgNum(p.g.position, '+35', '#7dffb8'); SFX.cheer(); scene.remove(p.g); pickups.splice(i, 1); continue; }
    if (p.t > 30) { scene.remove(p.g); pickups.splice(i, 1); }
  }
}
function heal(n) { P.hp = Math.min(stats().maxHp, P.hp + n); }
function gainXp(n) {
  save.xp += n; let up = false;
  while (save.xp >= stats().need) { save.xp -= stats().need; save.lv++; up = true; }
  if (up) { P.hp = stats().maxHp; banner('LEVEL UP!', 'LV ' + save.lv + ' · more HP · harder punches', 2000); SFX.lvl(); ring(P.pos.clone().setY(P.pos.y + 0.1), 0.5, 5, 0.7, 0xfff36a); }
  persist();
}
function hurtPlayer(dmg, from) {
  if (P.inv > 0 || P.dead > 0) return;
  P.hp -= dmg; P.inv = 0.9; P.hurt = 0.35; SFX.hurt(); shake = Math.max(shake, 0.3);
  dmgNum(P.pos.clone().setY(P.pos.y + 2), '-' + dmg, '#ff6b8f');
  const d = V().subVectors(P.pos, from).setY(0).normalize();
  P.push.addScaledVector(d, 7); if (P.grounded) { P.vel.y = 2.5; P.grounded = false; }
  if (P.hp <= 0) { P.hp = 0; P.dead = 2.2; banner('K.O.!', 'the imp drags you back…', 2000); }
}

const _v1 = V(), _v2 = V();
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], m = e.m, K = e.K;
    m.root.scale.setScalar(Math.min(1, m.root.scale.x + dt * 4));
    e.t += dt;
    if (e.state === 'cheer') {
      e.cheer += dt; e.pos.y += dt * (1.2 + e.cheer * 1.5); m.body.rotation.y += dt * 6;
      if (e.cheer > 2.6) { scene.remove(m.root); enemies.splice(i, 1); }
      continue;
    }
    const toP = _v1.subVectors(P.pos, e.pos); toP.y = 0; const dist = toP.length(); toP.normalize();
    if (dist > 120 && !e.site) { scene.remove(m.root); enemies.splice(i, 1); continue; }
    e.stun -= dt; e.cd -= dt;
    let want = 0, face = null;
    if (e.state === 'idle') {
      if (dist < 14 && P.dead <= 0) e.state = 'chase';
      else { const w = Math.sin(e.t * 0.4 + e.hopPh); e.yaw += Math.sin(e.t * 0.7) * dt * 0.6; want = 0.35 * Math.max(0, w); }
    }
    if (e.state === 'chase' && e.stun <= 0) {
      face = Math.atan2(toP.x, toP.z);
      const reach = K === KIND.boss ? 4.2 : K === KIND.b ? 2.2 : 1.7;
      if (P.dead > 0) { e.state = 'idle'; }
      else if (dist > reach) want = 1;
      else if (e.cd <= 0) { e.state = 'wind'; e.t = 0; }
      if (e.kind === 'boss') {
        e.slamT -= dt; e.summonT -= dt;
        if (e.slamT <= 0 && e.grounded) { e.state = 'bossJump'; e.t = 0; e.vel.y = 13; e.grounded = false; e.slamT = rand(5, 7); }
        if (e.summonT <= 0) { e.summonT = 13; for (let k = 0; k < 2; k++) { const a = rand(0, 6.28); const s = spawnEnemy('g', e.pos.x + Math.cos(a) * 5, e.pos.z + Math.sin(a) * 5, e.site); if (s) { s.state = 'chase'; e.site.foesLeft++; puff(s.pos, 6, 0.4, 0x5E5279); } } say('Big Gloom', 'GRRRUMBLE. More of you, then.', 2500); }
      }
      if (dist > 45 && !e.site) e.state = 'idle';
    }
    if (e.state === 'wind') {
      face = Math.atan2(toP.x, toP.z);
      const wt = e.kind === 'g' ? 0.45 : e.kind === 'b' ? 0.7 : 0.6;
      m.body.position.x = Math.sin(e.t * 60) * 0.03 * e.m.size;
      if (e.t > wt) { e.state = 'lunge'; e.t = 0; m.body.position.x = 0;
        const sp = e.kind === 'g' ? 9 : e.kind === 'b' ? 7 : 11; e.vel.x = toP.x * sp; e.vel.z = toP.z * sp; e.vel.y = e.kind === 'b' ? 5 : 3; e.grounded = false; e.hit = false; }
    }
    if (e.state === 'lunge') {
      if (!e.hit && dist < (e.kind === 'boss' ? 3.4 : e.kind === 'b' ? 1.9 : 1.3) && Math.abs(P.pos.y - e.pos.y) < 1.6 * e.m.size + 0.6) { e.hit = true; hurtPlayer(Math.round(K.dmg * (1 + 0.08 * (save.lv - 1))), e.pos); }
      if (e.t > 0.25 && e.grounded) {
        if (e.kind === 'b') { ring(e.pos.clone().setY(e.pos.y + 0.1), 0.3, 2.6, 0.4, 0x8a5cff); if (dist < 2.6 && P.grounded) hurtPlayer(Math.round(K.dmg * 0.6), e.pos); }
        e.state = 'chase'; e.cd = e.kind === 'boss' ? 1.2 : rand(1.0, 1.6);
      }
    }
    if (e.state === 'bossJump') {
      face = Math.atan2(toP.x, toP.z); want = 0.9;
      if (e.t > 0.3 && e.grounded) { // SLAM: expanding shockwave you must jump over
        e.state = 'chase'; shake = 0.7; SFX.big(); burst('KA-BOOM!', e.pos.clone().setY(e.pos.y + 2), 3.2, '#8a5cff');
        const r = ring(e.pos.clone().setY(e.pos.y + 0.2), 1, 22, 1.6, 0x8a5cff); r.userData.shock = { c: e.pos.clone(), t: 0, hit: false };
        shocks.push({ c: e.pos.clone(), t: 0, hit: false, dmg: K.dmg });
      }
    }
    // movement
    if (face !== null) e.yaw += Math.atan2(Math.sin(face - e.yaw), Math.cos(face - e.yaw)) * Math.min(1, dt * 8);
    const sp = K.speed * want * (e.stun > 0 ? 0 : 1);
    if (e.grounded && e.state !== 'lunge') { e.vel.x = lerp(e.vel.x, Math.sin(e.yaw) * sp, Math.min(1, dt * 6)); e.vel.z = lerp(e.vel.z, Math.cos(e.yaw) * sp, Math.min(1, dt * 6)); }
    else { e.vel.x *= 1 - dt * 0.5; e.vel.z *= 1 - dt * 0.5; }
    // separation from other enemies and the player
    for (const o of enemies) if (o !== e && o.state !== 'cheer') { const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d = Math.hypot(dx, dz), r = (e.m.size + o.m.size) * 0.9;
      if (d < r && d > 1e-3) { e.pos.x += dx / d * (r - d) * 0.5; e.pos.z += dz / d * (r - d) * 0.5; } }
    if (dist < e.m.size * 0.9 + 0.35 && dist > 1e-3 && e.state !== 'lunge') { e.pos.x -= toP.x * (e.m.size * 0.9 + 0.35 - dist); e.pos.z -= toP.z * (e.m.size * 0.9 + 0.35 - dist); }
    // walls
    const hsp = Math.hypot(e.vel.x, e.vel.z);
    if (hsp > 0.01) {
      _d.set(e.vel.x / hsp, 0, e.vel.z / hsp);
      const h = cast(_o.set(e.pos.x, e.pos.y + e.m.size * 0.6, e.pos.z), _d, hsp * dt + e.m.size * 0.8);
      if (h && Math.abs(h.wn.y) < 0.6) { const n = h.wn.setY(0).normalize(), dn = e.vel.x * n.x + e.vel.z * n.z; if (dn < 0) { e.vel.x -= n.x * dn; e.vel.z -= n.z * dn; } if (e.state === 'idle') e.yaw += Math.PI * 0.7; }
    }
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    const g = groundAt(e.pos.x, e.pos.y, e.pos.z, 1.2, 40);
    if (e.grounded) {
      if (g > -Infinity && g > e.pos.y - 0.9 && g < e.pos.y + 1.0) e.pos.y = g;
      else if (g < e.pos.y - 0.9) e.grounded = false;
      else if (g === -Infinity) e.grounded = false;
    }
    if (!e.grounded) {
      e.vel.y -= 26 * dt; e.pos.y += e.vel.y * dt;
      if (g > -Infinity && e.pos.y <= g && e.vel.y <= 0) { e.pos.y = g; e.vel.y = 0; e.grounded = true; if (e.kind !== 'g') shake = Math.max(shake, 0.15); }
      if (g === -Infinity && e.pos.y < e.home.y - 60) { e.pos.copy(e.home); e.vel.set(0, 0, 0); e.grounded = true; }
    }
    // pose: hop & squash, flash white when hit
    e.hopPh += dt * (6 + 6 * (sp > 0.5 ? 1 : 0));
    const hop = e.grounded && sp > 0.3 ? Math.abs(Math.sin(e.hopPh)) : 0;
    m.body.position.y = hop * 0.18 * m.size;
    const sq = e.state === 'wind' ? 0.18 : (e.grounded ? -0.08 * hop + 0.04 * Math.sin(e.t * 3) : 0.1);
    m.body.scale.set(1 + sq, 1 - sq, 1 + sq);
    m.root.rotation.y = e.yaw;
    e.flash -= dt;
    m.body.visible = !(e.flash > 0 && ((e.flash * 40) | 0) % 2 === 0);
  }
}
const shocks = [];
function updateShocks(dt) {
  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i]; s.t += dt; const k = s.t / 1.6; if (k >= 1) { shocks.splice(i, 1); continue; }
    const r = lerp(1, 22, 1 - (1 - k) * (1 - k)), d = Math.hypot(P.pos.x - s.c.x, P.pos.z - s.c.z);
    if (!s.hit && Math.abs(d - r) < 0.9 && P.pos.y - s.c.y < 0.8) { s.hit = true; hurtPlayer(s.dmg, s.c); }
  }
}

// ---------------------------------------------------------------- player
const RAD = 0.42, SPEED = 5.2, RUN = 9.5, GRAV = 24, JUMP_V = 8.4, FLIP_V = 9.6, STEP = 0.55;
function spawnPlayer(x, z, yHint) {
  P.pos.set(x, yHint ?? 0, z); P.vel.set(0, 0, 0); P.push.set(0, 0, 0); P.grounded = false; P.ready = false; P.yaw = 0;
  P.maxHp = stats().maxHp; P.hp = P.maxHp; P.lastSafe.copy(P.pos);
  hero.root.position.copy(P.pos); IMP.pos.copy(P.pos).add(new THREE.Vector3(0.7, 2, -0.4));
}
function tryPlace() {
  // wait until there is ground under the spawn point (real mode streams it in)
  const g = groundAt(P.pos.x, 500, P.pos.z, 0, 1200);
  if (g === -Infinity) return false;
  P.pos.y = g; P.lastSafe.copy(P.pos); P.grounded = true; P.ready = true; return true;
}
function moveHoriz(dx, dz) {
  // slide along walls using two body-height probes; step up small ledges
  const len = Math.hypot(dx, dz); if (len < 1e-6) return { blocked: false };
  let blocked = null;
  for (const h of [0.35, 1.15]) {
    _d.set(dx / len, 0, dz / len);
    const hit = cast(_o.set(P.pos.x, P.pos.y + h, P.pos.z), _d, len + RAD);
    if (hit && Math.abs(hit.wn.y) < 0.65) {
      const n = hit.wn.clone().setY(0).normalize(); const dn = dx * n.x + dz * n.z;
      if (dn < 0) { dx -= n.x * dn; dz -= n.z * dn; blocked = n; }
      const pen = RAD - (hit.distance - len); if (pen > 0 && hit.distance < RAD) { P.pos.x += n.x * (RAD - hit.distance) * 0.5; P.pos.z += n.z * (RAD - hit.distance) * 0.5; }
    }
  }
  const nx = P.pos.x + dx, nz = P.pos.z + dz;
  if (P.grounded) {
    const g = groundAt(nx, P.pos.y, nz, STEP + 0.4, 6);
    if (g > P.pos.y + STEP) return { blocked: blocked || true };
  }
  P.pos.x = nx; P.pos.z = nz;
  return { blocked };
}
let wallPush = 0;
function updatePlayer(dt) {
  const st = stats();
  if (P.dead > 0) {
    P.dead -= dt; P.vel.set(0, 0, 0);
    if (P.dead <= 0) {
      // respawn at the last cleared site or the start
      const s = sites.filter(s => s.state === 'done' && s.y !== null).pop();
      if (s) P.pos.set(s.x + 3, s.y, s.z); else P.pos.copy(P.lastSafe);
      P.hp = st.maxHp; P.inv = 2; say('Imp', 'Up you get. I am NOT carrying you all the way home again.', 3000);
      for (const e of enemies) if (e.state !== 'cheer' && !e.site) e.state = 'idle';
    }
    return;
  }
  // camera-relative stick
  const fwd = _v1.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = _v2.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  const mx = right.x * input.x - fwd.x * input.z, mz = right.z * input.x - fwd.z * input.z;
  const mag = Math.min(1, Math.hypot(mx, mz));
  const attacking = P.att > 0 && P.attKind !== 3;
  const speed = (input.run ? RUN : SPEED) * (P.glide ? 1.2 : 1) * (attacking ? 0.25 : 1);
  if (mag > 0.05 && !P.wall) { const ty = Math.atan2(mx, mz); P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 12); }

  // jumping: ground jump, air flip (double jump), glide (hold while falling), extra flaps
  if (input.jumpPressed) {
    if (P.wall) { // kick off the wall
      P.wall = null; P.vel.y = JUMP_V; P.push.set(P.wallN.x * 6, 0, P.wallN.z * 6); P.yaw = Math.atan2(P.wallN.x, P.wallN.z); P.flipT = 0; SFX.jump();
    } else if (P.grounded) { P.vel.y = JUMP_V; P.grounded = false; P.jumps = 1; P.airT = 0; SFX.jump(); puff(P.pos, 4, 0.18); }
    else if (P.jumps < 2) { P.vel.y = FLIP_V; P.jumps = 2; P.flipT = 0; SFX.jump(); }
    else if (P.glide && P.flaps < 3) { P.vel.y = 4.2; P.flaps++; SFX.flap(); say('Imp', GLIDE_LINES[(Math.random() * GLIDE_LINES.length) | 0], 1500); }
  }
  // attacks
  if (input.atkPressed) {
    if (!P.grounded && !P.wall && P.att <= 0 && P.airT > 0.22) { P.att = 1; P.attKind = 3; P.pound = true; P.vel.y = 6; P.flipT = -1; SFX.swing(); }
    else if (P.att > 0 && P.attKind !== 3) P.attQueued = true;
    else if (P.att <= 0) startCombo();
  }
  if (input.impPressed && P.impCd <= 0) impDive();
  P.impCd = Math.max(0, P.impCd - dt);

  if (P.att > 0) {
    const dur = P.attKind === 2 ? 0.42 : P.attKind === 3 ? 9 : 0.26;
    if (P.attKind !== 3) P.att -= dt / dur;
    const k = 1 - P.att;
    if (!P.attHit && P.attKind !== 3 && k > 0.35) { P.attHit = true; meleeHit(P.attKind === 2 ? 2.1 : 1.65, P.attKind === 2 ? 1.7 : 1, P.attKind === 2 ? 9 : 4.5); }
    if (P.att <= 0) { P.att = 0; if (P.attQueued && P.combo < 3) startCombo(); else P.comboT = 0.35; }
  }
  P.comboT -= dt; if (P.comboT <= 0 && P.att <= 0) P.combo = 0;

  // wall run
  if (P.wall) {
    P.wallT += dt; P.vel.y = 7.2; P.glide = false;
    const hit = cast(_o.set(P.pos.x, P.pos.y + 1.1, P.pos.z), _d.set(-P.wallN.x, 0, -P.wallN.z), RAD + 0.7);
    if (!hit) { P.wall = null; P.vel.y = 6.5; P.push.set(-P.wallN.x * 4, 0, -P.wallN.z * 4); } // reached the top: hop onto the roof
    else if (P.wallT > 2.6 || mag < 0.3) { P.wall = null; P.vel.y = 1; P.push.set(P.wallN.x * 3, 0, P.wallN.z * 3); }
    else { P.pos.x = hit.point.x + P.wallN.x * (RAD + 0.05); P.pos.z = hit.point.z + P.wallN.z * (RAD + 0.05); }
    if (Math.random() < dt * 14) puff(_o.set(P.pos.x - P.wallN.x * 0.4, P.pos.y + 0.1, P.pos.z - P.wallN.z * 0.4), 1, 0.15);
  }

  // horizontal motion
  const tvx = mx * speed * (P.wall ? 0 : 1), tvz = mz * speed * (P.wall ? 0 : 1);
  const acc = P.grounded ? 14 : 5;
  P.vel.x = lerp(P.vel.x, tvx, Math.min(1, dt * acc)); P.vel.z = lerp(P.vel.z, tvz, Math.min(1, dt * acc));
  P.push.multiplyScalar(Math.max(0, 1 - dt * 5));
  let dx = (P.vel.x + P.push.x) * dt, dz = (P.vel.z + P.push.z) * dt;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  let blocked = null;
  if (!P.wall) for (let i = 0; i < steps; i++) { const r = moveHoriz(dx / steps, dz / steps); if (r.blocked) blocked = r.blocked; }
  // start a wall run: pushing into a wall with intent
  if (blocked && blocked !== true && !P.wall && mag > 0.6 && P.att <= 0) {
    const into = -(mx * blocked.x + mz * blocked.z) / (mag || 1);
    wallPush = into > 0.55 ? wallPush + dt : 0;
    if (wallPush > 0.12 && P.vel.y > -6) { P.wall = true; P.wallN = blocked.clone(); P.wallT = 0; P.grounded = false; P.glide = false; P.jumps = 1; P.yaw = Math.atan2(-blocked.x, -blocked.z); wallPush = 0; }
  } else if (!blocked) wallPush = 0;

  // vertical
  const g = groundAt(P.pos.x, P.pos.y, P.pos.z, STEP + 0.35, 200);
  if (P.grounded && !P.wall) {
    if (g > -Infinity && g >= P.pos.y - 0.7) { P.pos.y = g; P.vel.y = 0; }
    else { P.grounded = false; P.jumps = Math.max(P.jumps, 1); P.airT = 0; }
  }
  P.glide = !P.grounded && !P.wall && input.jump && P.vel.y < 0 && P.flipT < 0 && !P.pound;
  if (!P.grounded && !P.wall) {
    P.airT += dt;
    if (P.pound) P.vel.y = Math.max(P.vel.y - GRAV * 3 * dt, -32);
    else if (P.glide) P.vel.y = Math.max(P.vel.y - GRAV * 0.12 * dt, -1.6);
    else P.vel.y -= GRAV * dt;
    P.pos.y += P.vel.y * dt;
    // ceiling bonk
    if (P.vel.y > 0) { const c = cast(_o.set(P.pos.x, P.pos.y + 1.2, P.pos.z), _d.set(0, 1, 0), 0.7); if (c) P.vel.y = 0; }
    if (g > -Infinity && P.pos.y <= g && P.vel.y <= 0) land(g);
  }
  if (P.flipT >= 0) { P.flipT += dt / 0.6; if (P.flipT >= 1 || P.grounded) P.flipT = -1; }
  // falling into the Hudson / out of the world
  const waterY = MODE === 'toy' ? Toy.WATER_Y : -1e9;
  if (P.pos.y < waterY - 0.6 || P.pos.y < P.lastSafe.y - 120) {
    puff(P.pos.clone().setY(waterY), 10, 0.4, 0xbfe6ff); P.pos.copy(P.lastSafe); P.vel.set(0, 0, 0); P.push.set(0, 0, 0);
    P.hp = Math.max(1, P.hp - 10); say('Imp', MODE === 'toy' ? 'The Hudson is NOT for swimming. I fished you out. You\'re welcome.' : 'Whoa, fell off the world. Back you go.', 3000);
  }
  P.safeT += dt; if (P.grounded && P.safeT > 1 && P.pos.y > waterY + 0.3) { P.lastSafe.copy(P.pos); P.safeT = 0; }

  P.inv -= dt; P.hurt = Math.max(0, P.hurt - dt);
  P.land = Math.max(0, P.land - dt * 5);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  P.runAmt = lerp(P.runAmt, P.grounded ? clamp(hs / SPEED, 0, 1) : 0, Math.min(1, dt * 10));
  P.runPh += dt * (6 + hs * 1.3) * (P.grounded ? 1 : 0.3);
  P.glideAmt = lerp(P.glideAmt, P.glide ? 1 : 0, Math.min(1, dt * 10));
  P.wallAmt = lerp(P.wallAmt, P.wall ? 1 : 0, Math.min(1, dt * 12));
  if (P.grounded && hs > 7 && Math.random() < dt * 10) puff(P.pos, 1, 0.16);
}
function land(g) {
  const fall = -P.vel.y;
  P.pos.y = g; P.vel.y = 0; P.grounded = true; P.jumps = 0; P.flaps = 0; P.glide = false; P.flipT = -1;
  P.land = clamp(fall / 14, 0.15, 1);
  if (P.pound) {
    P.pound = false; P.att = 0;
    SFX.big(); shake = 0.6; burst('BOOM!', P.pos.clone().setY(P.pos.y + 1), 2.4, '#e8306e'); ring(P.pos.clone().setY(P.pos.y + 0.1), 0.5, 4.5, 0.45); puff(P.pos, 12, 0.35);
    const st = stats();
    for (const e of enemies) { if (e.state === 'cheer') continue; const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d < 4.2 + e.m.size && Math.abs(e.pos.y - P.pos.y) < 2.5) damageEnemy(e, st.atk * 1.8, V().subVectors(e.pos, P.pos).setY(0).normalize(), 10, 'BOOM!'); }
  } else if (fall > 9) puff(P.pos, 6, 0.25);
}
function startCombo() {
  P.attKind = P.combo % 3; P.combo++; P.att = 1; P.attHit = false; P.attQueued = false; SFX.swing();
  // snap to the nearest grump in front (soft lock-on)
  let best = null, bd = 4;
  for (const e of enemies) { if (e.state === 'cheer') continue; const d = e.pos.distanceTo(P.pos) - e.m.size; if (d < bd) { bd = d; best = e; } }
  if (best) P.yaw = Math.atan2(best.pos.x - P.pos.x, best.pos.z - P.pos.z);
  P.push.x += Math.sin(P.yaw) * 2.5; P.push.z += Math.cos(P.yaw) * 2.5;
}
function meleeHit(range, mult, kb) {
  const st = stats(), f = V(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  for (const e of enemies) {
    if (e.state === 'cheer') continue;
    const d = V().subVectors(e.pos, P.pos); const dy = d.y; d.y = 0; const dist = d.length();
    if (dist > range + e.m.size || dy > 2 * e.m.size + 1 || dy < -1.5) continue;
    if (dist > 0.6 && d.normalize().dot(f) < 0.25) continue;
    damageEnemy(e, st.atk * mult, f, kb);
  }
}
function impDive() {
  let best = null, bd = 20;
  for (const e of enemies) { if (e.state === 'cheer') continue; const d = e.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = e; } }
  P.impCd = 5; SFX.imp();
  if (!best) { IMP.mode = 'loop'; IMP.t = 0; say('Imp', 'Bite WHAT? There\'s nothing here!', 1800); return; }
  IMP.mode = 'dive'; IMP.target = best; IMP.t = 0; say('Imp', ['CHOMP TIME!', 'Mine!', 'Hold my tail… wait, don\'t.'][(Math.random() * 3) | 0], 1400);
}

// ---------------------------------------------------------------- imp companion
const _hl = V(), _hr = V();
function updateImp(dt, t) {
  let target;
  const carrying = P.glideAmt > 0.5 && IMP.mode === 'follow';
  if (IMP.mode === 'dive' && IMP.target) {
    IMP.t += dt; const e = IMP.target;
    target = e.pos.clone().setY(e.pos.y + e.m.size * 1.2);
    IMP.pos.lerp(target, Math.min(1, dt * 9));
    if (IMP.pos.distanceTo(target) < 0.6 + e.m.size || IMP.t > 1.2) {
      if (e.state !== 'cheer') damageEnemy(e, stats().atk * 2.6, V().subVectors(e.pos, P.pos).setY(0).normalize(), 8, 'CHOMP!');
      IMP.mode = 'return'; IMP.t = 0;
    }
  } else if (IMP.mode === 'loop') {
    IMP.t += dt; const a = IMP.t * 7; target = P.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.6, 2.4 + Math.sin(a * 0.5) * 0.4, Math.sin(a) * 1.6)); IMP.pos.lerp(target, Math.min(1, dt * 10));
    if (IMP.t > 1.2) IMP.mode = 'follow';
  } else if (carrying) {
    // hold the imp by its feet: it hovers right above the hero's raised hands
    hero.handL.getWorldPosition(_hl); hero.handR.getWorldPosition(_hr);
    target = _hl.add(_hr).multiplyScalar(0.5); target.y += 0.36;
    IMP.pos.lerp(target, Math.min(1, dt * 25));
  } else {
    if (IMP.mode === 'return') { IMP.t += dt; if (IMP.t > 0.6) IMP.mode = 'follow'; }
    const side = V(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    target = P.pos.clone().addScaledVector(side, -0.75).add(new THREE.Vector3(-Math.sin(P.yaw) * 0.3, 2.05 + Math.sin(t * 2.2) * 0.12, -Math.cos(P.yaw) * 0.3));
    IMP.pos.lerp(target, Math.min(1, dt * (IMP.mode === 'return' ? 6 : 4)));
  }
  imp.root.position.copy(IMP.pos);
  const faceYaw = carrying ? P.yaw : (IMP.mode === 'dive' && IMP.target ? Math.atan2(IMP.target.pos.x - IMP.pos.x, IMP.target.pos.z - IMP.pos.z) : P.yaw);
  imp.root.rotation.y += Math.atan2(Math.sin(faceYaw - imp.root.rotation.y), Math.cos(faceYaw - imp.root.rotation.y)) * Math.min(1, dt * 8);
  imp.root.rotation.x = carrying ? 0.15 : IMP.mode === 'dive' ? 0.7 : 0;
  poseImp(imp, carrying, P.vel.y < -1 ? 1 : 0.3, dt, t);
}

// ---------------------------------------------------------------- camera
const camT = V(), camP = V(), _cd = V();
function updateCamera(dt) {
  cam.idle += dt;
  const moving = Math.hypot(P.vel.x, P.vel.z) > 1;
  if (moving && cam.idle > 1.2 && !P.wall) { const behind = P.yaw + Math.PI; cam.yaw += Math.atan2(Math.sin(behind - cam.yaw), Math.cos(behind - cam.yaw)) * Math.min(1, dt * 1.2); }
  const ty = P.pos.y + 1.35 + (P.glide ? 0.4 : 0);
  camT.set(lerp(camT.x, P.pos.x, Math.min(1, dt * 12)), lerp(camT.y, ty, Math.min(1, dt * (P.grounded ? 8 : 4))), lerp(camT.z, P.pos.z, Math.min(1, dt * 12)));
  const d = cam.dist;
  _cd.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  // pull in when a building is between the hero and the camera
  const h = cast(_o.copy(camT), _cd, d);
  const dd = h ? Math.max(1.2, h.distance - 0.35) : d;
  camP.copy(camT).addScaledVector(_cd, dd);
  camera.position.lerp(camP, h ? 1 : Math.min(1, dt * 10));
  if (shake > 0) { camera.position.x += rand(-1, 1) * shake * 0.25; camera.position.y += rand(-1, 1) * shake * 0.25; shake = Math.max(0, shake - dt * 2.2); }
  camera.lookAt(camT);
}

// ---------------------------------------------------------------- HUD
const miniCv = $('mini'), mctx = miniCv.getContext('2d');
let hudT = 0;
function nextSite() {
  let best = null, bd = Infinity;
  for (const s of sites) { if (s.state === 'done' || s.locked) continue; const d = Math.hypot(s.x - P.pos.x, s.z - P.pos.z); if (d < bd) { bd = d; best = s; } }
  return [best, bd];
}
function updateHud(dt) {
  const st = stats();
  $('lv').textContent = 'LV ' + save.lv;
  $('hp').firstChild.style.width = (P.hp / st.maxHp * 100) + '%';
  $('hpT').textContent = Math.ceil(P.hp) + ' / ' + st.maxHp;
  $('xp').firstChild.style.width = (save.xp / st.need * 100) + '%';
  $('bImp').querySelector('.cd').style.height = (P.impCd / 5 * 100) + '%';
  const [s, d] = nextSite();
  const q = $('quest');
  if (s) {
    $('qName').textContent = s.state === 'active' ? s.name + ' · ' + s.foesLeft + ' left' : s.name;
    $('qSub').textContent = s.state === 'active' ? 'Cheer up every grump!' : Math.round(d * (MODE === 'toy' ? 1.6 : 1)) + ' m · ' + s.sub;
    const ang = Math.atan2(s.x - P.pos.x, s.z - P.pos.z) - cam.yaw - Math.PI;
    $('arrow').style.transform = `rotate(${-ang}rad)`;
  } else { $('qName').textContent = save.cleared.length >= sites.length ? 'Hoboken is cheered up!' : 'Clear 4 spots to wake the boss'; $('qSub').textContent = 'Roaming grumps still need hugs (punches)'; }
  q.style.top = (miniCv.style.display === 'block' ? miniCv.offsetHeight + 22 : 12) + 'px';
  // minimap: radar of sites, grumps and you
  hudT -= dt; if (hudT > 0) return; hudT = 0.1;
  const W = miniCv.width = 132, H = miniCv.height = 132, R = MODE === 'toy' ? 1.6 : 2.2;  // metres per pixel
  mctx.fillStyle = '#2b2433'; mctx.fillRect(0, 0, W, H);
  mctx.save(); mctx.translate(W / 2, H / 2); mctx.rotate(cam.yaw - Math.PI);
  if (MODE === 'toy' && Toy.miniBase && Toy.world) {
    const b = Toy.world.b, k = Toy.miniBase.width / (b.x1 - b.x0);
    const px = (P.pos.x / Toy.S - b.x0) * k, py = (b.n1 - (-P.pos.z / Toy.S)) * k;
    const sc = 1 / (R * k) * (1 / Toy.S) ;
    mctx.save(); mctx.scale(sc, sc); mctx.globalAlpha = 0.85; mctx.drawImage(Toy.miniBase, -px, -py); mctx.restore();
  } else { mctx.strokeStyle = 'rgba(255,255,255,.12)'; for (let r = 20; r < 90; r += 20) { mctx.beginPath(); mctx.arc(0, 0, r, 0, 7); mctx.stroke(); } }
  const dot = (x, z, r, c) => { let dx = (x - P.pos.x) / R, dy = (z - P.pos.z) / R; const l = Math.hypot(dx, dy); if (l > 60) { dx *= 60 / l; dy *= 60 / l; } mctx.fillStyle = c; mctx.beginPath(); mctx.arc(dx, dy, r, 0, 7); mctx.fill(); mctx.strokeStyle = '#161216'; mctx.lineWidth = 2; mctx.stroke(); };
  for (const e of enemies) if (e.state !== 'cheer') dot(e.pos.x, e.pos.z, e.kind === 'boss' ? 6 : 3, '#8a5cff');
  for (const s2 of sites) dot(s2.x, s2.z, 5, s2.state === 'done' ? '#7dffb8' : s2.locked ? '#8a5cff' : '#fff36a');
  mctx.restore();
  mctx.save(); mctx.translate(W / 2, H / 2); mctx.fillStyle = '#ff9cbd'; mctx.strokeStyle = '#161216'; mctx.lineWidth = 2;
  mctx.rotate(-(P.yaw - cam.yaw + Math.PI)); mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 5); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore();
}

// ---------------------------------------------------------------- screens
function showScreen(id) { for (const s of ['title', 'keyScreen', 'menu']) $(s).style.display = s === id ? 'flex' : 'none'; }
function setGameUI(on) { for (const id of ['hud', 'bJump', 'bAtk', 'bImp', 'bRun', 'bMenu']) $(id).style.display = on ? (id === 'hud' ? 'block' : 'flex') : 'none'; $('quest').style.display = on ? 'block' : 'none'; if (!on) $('mini').style.display = 'none'; }
function begin() { showScreen(null); setGameUI(true); cam.yaw = 0; P.yaw = Math.PI; cam.idle = 0;
  setTimeout(() => say('Imp', 'Hoboken\'s gone all gloomy. Follow the yellow beams, bop the grumps. Hold JUMP in the air and I\'ll carry you.', 6000), 1200); }
function toggleMenu() {
  if ($('menu').style.display === 'flex') { showScreen(null); DBG.paused = false; return; }
  DBG.paused = true; showScreen('menu');
  const n = save.cleared.filter(id => id !== 'elysian').length;
  $('qList').innerHTML = sites.map(s => `<div class="q ${s.state === 'done' ? 'done' : s.locked ? 'lock' : ''}"><span>${s.name}</span><span>${s.state === 'done' ? '✔ cheered up' : s.locked ? '🔒 clear ' + (BOSS_NEED - n) + ' more' : s.state === 'active' ? s.foesLeft + ' grumps' : '—'}</span></div>`).join('');
  $('statLine').textContent = `LV ${save.lv} · ATK ${Math.round(stats().atk)} · HP ${stats().maxHp} · ${MODE === 'real' ? 'Real Hoboken (Google 3D)' : 'Toy Hoboken'}`;
}
$('mResume').onclick = () => toggleMenu();
$('mTitle').onclick = () => { DBG.paused = false; clearWorld(); MODE = null; setGameUI(false); showScreen('title'); };
$('mReset').onclick = () => { save = { lv: 1, xp: 0, cleared: [] }; persist(); for (const s of sites) s.state = 'idle'; refreshBeacons(); P.hp = stats().maxHp; toggleMenu(); };
$('goToy').onclick = () => { audio(); showScreen(null); startToy(); };
$('goReal').onclick = () => { audio(); showScreen('keyScreen'); let k = ''; try { k = localStorage.getItem('msm-gkey') || ''; } catch (e) {}
  const qk = new URLSearchParams(location.search).get('key'); $('keyIn').value = qk || k; $('claudeNote').style.display = IN_CLAUDE ? 'block' : 'none'; };
$('keyBack').onclick = () => showScreen('title');
$('keyGo').onclick = () => { const k = $('keyIn').value.trim(); if (!k) { $('keyIn').focus(); return; } try { localStorage.setItem('msm-gkey', k); } catch (e) {} showScreen(null); startReal(k); };

// ---------------------------------------------------------------- main loop
let last = performance.now(), T = 0, impTalkT = 25;
const clock = { t: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  if (DBG.manual) { last = now; return; }
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  render();
}
function step(dt) {
  if (DBG.paused) { input.jumpPressed = input.atkPressed = input.impPressed = false; return; }
  readInput();
  T += dt;
  if (tiles) {
    tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, renderer); camera.updateMatrixWorld(); tiles.update();
    const at = tiles.getAttributions ? tiles.getAttributions() : [];
    if (at && at.length) $('attr').textContent = 'Google · ' + at.map(a => a.value).filter(v => typeof v === 'string').join(' · ');
  }
  if (MODE && !P.ready) {
    // real mode: hover the camera over the spawn until Google's ground arrives
    if (tryPlace()) { busy(null); camT.copy(P.pos); }
    else { camera.position.set(P.pos.x + 60, 160, P.pos.z + 120); camera.lookAt(P.pos.x, -30, P.pos.z); input.jumpPressed = input.atkPressed = input.impPressed = false; return; }
  }
  if (!MODE) { // title: slow orbit around the hero on a plinth
    clock.t += dt; camera.position.set(Math.sin(clock.t * 0.3) * 4.2, 1.6, Math.cos(clock.t * 0.3) * 4.2); camera.lookAt(0, 1.1, 0);
    hero.root.position.set(0, 0, 0); hero.root.rotation.y = 0; IMP.pos.set(0.75, 2.0 + Math.sin(clock.t * 2) * 0.1, -0.2); imp.root.position.copy(IMP.pos); imp.root.rotation.set(0, 0, 0);
    Object.assign(hero.state, { runAmt: 0, glide: 0, air: 0, flip: -1, land: 0, att: 0, hurt: 0, wall: 0, runPh: 0 }); poseHero(hero, hero.state, dt); poseImp(imp, false, 0, dt, clock.t);
    titleStage.visible = true; return;
  }
  titleStage.visible = false;
  if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
  updatePlayer(dt);
  for (const s of sites) {
    siteGround(s);
    s.star.rotation.y += dt * 2; s.star.position.y = 4 + Math.sin(T * 2) * 0.4;
    if (s.state === 'idle' && !s.locked && s.y !== null && P.dead <= 0 && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 28 && Math.abs(s.y - P.pos.y) < 25) spawnNest(s);
    if (s.locked && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 20 && sayTimer <= 0) say('Imp', 'Something big is sulking here. Cheer up ' + BOSS_NEED + ' other spots first.', 3000);
  }
  updateRoamers(dt);
  updateEnemies(dt); updateShocks(dt); updatePickups(dt);
  updateImp(dt, T);
  // NPC chatter (toy mode)
  if (MODE === 'toy' && Toy.world) for (const n of Toy.world.npcs) {
    const d = Math.hypot(n.g.position.x - P.pos.x, n.g.position.z - P.pos.z);
    n.bang.visible = d < 9 && d > 3;
    if (d < 3) { n.g.rotation.y = Math.atan2(P.pos.x - n.g.position.x, P.pos.z - n.g.position.z); if (!n.talkT || T - n.talkT > 4.5) { n.talkT = T; n.li = ((n.li ?? -1) + 1) % n.spec.lines.length; say(n.spec.name + ' · ' + n.spec.role, n.spec.lines[n.li], 4300); } }
    n.body.position.y = Math.abs(Math.sin(T * 2 + n.ph)) * 0.03;
  }
  impTalkT -= dt; if (impTalkT <= 0) { impTalkT = rand(28, 45); if (sayTimer <= 0) say('Imp', IMP_LINES[(Math.random() * IMP_LINES.length) | 0], 4000); }
  // hero transform + pose
  hero.root.position.copy(P.pos); hero.root.rotation.y = P.yaw;
  Object.assign(hero.state, { runAmt: P.runAmt, runPh: P.runPh, glide: P.glideAmt, air: P.grounded || P.wall ? 0 : clamp(P.airT * 6, 0, 1), flip: P.flipT,
    land: P.land, att: P.att, attKind: P.attKind, hurt: P.hurt, wall: P.wallAmt });
  poseHero(hero, hero.state, dt);
  hero.root.visible = !(P.inv > 0 && P.dead <= 0 && ((P.inv * 20) | 0) % 2 === 0);
  updateCamera(dt);
  updateFx(dt); updateDmg(dt);
  updateHud(dt);
  sun.position.set(P.pos.x - 60, P.pos.y + 120, P.pos.z + 80); sun.target.position.copy(P.pos); sun.target.updateMatrixWorld();
  if (sayTimer > 0) { sayTimer -= dt; if (sayTimer <= 0) $('say').style.opacity = 0; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  input.jumpPressed = input.atkPressed = input.impPressed = false;
}
function render() { post.render(scene, camera); }

// title stage: a little plinth + backdrop for the hero
const titleStage = new THREE.Group();
{ const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.2, 40), toon(0x2b2433)); plinth.position.y = -0.1; titleStage.add(plinth);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40).rotateX(-Math.PI / 2), toon(0xF6C2D8)); ground.position.y = -0.2; titleStage.add(ground);
  titleStage.traverse(o => o.layers.set(0)); scene.add(titleStage); }

// debug hooks for headless tests
Object.defineProperty(DBG, 'sites', { get: () => sites });
Object.assign(DBG, { post, P, enemies, input, keys, cam, save, startToy, startReal, step, render, hero, imp, IMP, stats, spawnEnemy, damageEnemy, camera });
requestAnimationFrame(frame);
