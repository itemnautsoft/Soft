// Toy Hoboken — adapted from Stick Head: Garden State (itemnautsoft/Tuto nj/). x = east, z = -north.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { renderer, ramp, toon, mesh, COL } from './core.js';
import { scene } from './core.js';
const S = 0.625, FLOOR_M = 3.1, STEP = 0.5, WATER_Y = -1.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const noOutline = m => { m.userData.outlineParameters = { visible: false }; return m; };
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[(rnd() * a.length) | 0];

// shared window texture: white wall (tinted by vertex colour), dark window, little sill
const winTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#3a3350'; x.fillRect(19, 14, 26, 32);
  x.fillStyle = '#7d9fc4'; x.fillRect(22, 17, 8, 11);
  x.fillStyle = '#cfc6b8'; x.fillRect(16, 46, 32, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
const bldgMat = noOutline(new THREE.MeshToonMaterial({ vertexColors: true, map: winTex, gradientMap: ramp,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
const farMat = noOutline(new THREE.MeshToonMaterial({ vertexColors: true, map: winTex, gradientMap: ramp }));
const edgeMat = noOutline(new THREE.LineBasicMaterial({ color: 0x1a1418, transparent: true, opacity: 0.85 }));

// ---------- geometry buffer: flat-shaded prisms with window UVs + ink edges ----------
class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.l = []; }
  tri(a, b, c, nr, col, ua, ub, uc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * nr[0] + cy * nr[1] + cz * nr[2] < 0) { const t = b; b = c; c = t; const tu = ub; ub = uc; uc = tu; }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) { this.n.push(nr[0], nr[1], nr[2]); this.c.push(col.r, col.g, col.b); }
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }
  line(a, b) { this.l.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
}
const PLAIN = [0.03, 0.03];
function prism(buf, poly, base, ground, top, color, o = {}) {
  const col = new THREE.Color(color);
  const rc = o.roof != null ? new THREE.Color(o.roof) : col.clone().multiplyScalar(0.8);
  const n = poly.length;
  let A = 0;
  for (let i = 0; i < n; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % n]; A += x1 * z2 - x2 * z1; }
  const sg = A > 0 ? 1 : -1, fh = FLOOR_M * S, ww = (o.winW || 3.4) * S;
  let run = 0;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % n];
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const nr = [sg * dz / len, 0, -sg * dx / len];
    let u0 = run / ww, u1 = (run + len) / ww, v0 = (base - ground) / fh, v1 = (top - ground) / fh; run += len;
    if (o.noWin) { u0 = u1 = v0 = v1 = 0.03; }
    const a = [x1, base, z1], b = [x2, base, z2], c = [x2, top, z2], d = [x1, top, z1];
    buf.tri(a, b, c, nr, col, [u0, v0], [u1, v0], [u1, v1]);
    buf.tri(a, c, d, nr, col, [u0, v0], [u1, v1], [u0, v1]);
    if (o.lines !== false) {
      buf.line([x1, top, z1], [x2, top, z2]);
      const [xp, zp] = poly[(i - 1 + n) % n], ex = x1 - xp, ez = z1 - zp, el = Math.hypot(ex, ez);
      if (el > 1e-4 && (ex * dx + ez * dz) / (el * len) < 0.94) buf.line([x1, Math.max(ground, base), z1], [x1, top, z1]);
    }
  }
  let tris;
  if (n === 4 || n === 3) tris = n === 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
  else tris = THREE.ShapeUtils.triangulateShape(poly.map(p => new THREE.Vector2(p[0], p[1])), []);
  for (const [i, j, k] of tris) buf.tri([poly[i][0], top, poly[i][1]], [poly[j][0], top, poly[j][1]], [poly[k][0], top, poly[k][1]], [0, 1, 0], rc, PLAIN, PLAIN, PLAIN);
}
function bufMesh(buf, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(buf.c, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, mat);
}

// ---------- 2D helpers ----------
function pointInPoly(x, z, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
function distToPoly(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = l2 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

// ---------- world container ----------
const CELL = 16, CHUNK = 160;
let world = null;
function newWorld(b, terrM, name) {
  if (world) {
    scene.remove(world.root);
    world.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData.own) { o.material.map?.dispose(); o.material.dispose(); } });
    world.npcs.forEach(n => n.tag.material.map.dispose());
  }
  world = { b, terrM, name, root: new THREE.Group(), grid: new Map(), chunks: new Map(), ops: [], trees: [], npcs: [], zones: [],
    spawn: { x: 0, n: 0, dir: 0, sit: false }, attribution: '' };
  world.tU = (x, z) => terrM(x / S, -z / S) * S;
  scene.add(world.root);
  return world;
}
const M = (x, n) => [x * S, -n * S];
function chunkBuf(w, x, z) {
  const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
  let b = w.chunks.get(k); if (!b) { b = new Buf(); w.chunks.set(k, b); } return b;
}
function addCollider(w, poly, top, kind = 'solid', base = -1e9) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const c = { poly, top, kind, base, x0, x1, z0, z1 };
  for (let i = Math.floor((x0 - 1) / CELL); i <= Math.floor((x1 + 1) / CELL); i++)
    for (let j = Math.floor((z0 - 1) / CELL); j <= Math.floor((z1 + 1) / CELL); j++) {
      const k = i + ',' + j; let a = w.grid.get(k); if (!a) w.grid.set(k, a = []); a.push(c);
    }
  return c;
}
const cellAt = (x, z) => world.grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
function solidAt(x, z, h, r) {
  const a = cellAt(x, z); if (!a) return false;
  for (const c of a) {
    if (c.kind !== 'solid' || c.top <= h + STEP || c.base > h + 1.6) continue;
    if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
    if (pointInPoly(x, z, c.poly) || distToPoly(x, z, c.poly) < r) return true;
  }
  return false;
}
function floorAt(x, z, h) {
  let f = world.tU(x, z);
  const a = cellAt(x, z); if (!a) return f;
  for (const c of a) {
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    if (c.kind === 'water') { if (pointInPoly(x, z, c.poly)) f = Math.min(f, -6 * S); continue; }
    if (c.kind !== 'solid') continue;
    if (c.top > f && c.top <= h + STEP && pointInPoly(x, z, c.poly)) f = c.top;
  }
  return f;
}

// paint layers: 0 base, 1 blocks, 2 roads, 3 markings, 4 areas, 5 footprints, 6 labels
const paint = (layer, fn) => world.ops.push([layer, fn]);

function addBuilding(w, polyM, hM, color, o = {}) {
  const poly = polyM.map(([x, n]) => M(x, n));
  let gmin = Infinity, gsum = 0;
  for (const p of poly) { const t = w.tU(p[0], p[1]); gmin = Math.min(gmin, t); gsum += t; }
  const ground = o.ground != null ? o.ground : gsum / poly.length;
  const base = (o.base != null ? o.base : gmin - 1.5), top = (o.atop != null ? o.atop : ground + hM * S);
  prism(chunkBuf(w, poly[0][0], poly[0][1]), poly, base, ground, top, color, o);
  if (o.collide !== false) addCollider(w, poly, top, 'solid', base);
  if (o.paint !== false) paint(5, (x, P) => { x.fillStyle = '#6d6474'; P.poly(polyM); x.fill(); });
  return top;
}
const rect = (x0, n0, x1, n1) => [[x0, n0], [x1, n0], [x1, n1], [x0, n1]];

function addTree(w, xM, nM, s = 1, kind = 0) { const [x, z] = M(xM, nM); w.trees.push({ x, z, y: w.tU(x, z), s, kind }); }

// =====================================================================
//  HOBOKEN — hand-built from the real street grid & landmarks (approximate)
// =====================================================================
const PAL = {
  brick: [0xB5533C, 0xC4643F, 0xA9483A, 0xC97A55, 0x9B4F3E],
  brown: [0x8A5A44, 0x7A4E3C, 0x9C6B4E],
  pastel: [0xE9D8B4, 0xB0A2C4, 0x9DB89A, 0xE6B9A6, 0xF0D27A, 0x9CC3D5],
  modern: [0xC9CED6, 0xA9B8C9, 0xE3DDD0, 0x8FA3B8, 0xD8C8B0],
  awning: [0xE8502E, 0x2E7D5B, 0x2A4C8C, 0xF3C23C, 0x7E6C9C, 0x1a1418]
};
function buildHoboken() {
  seed = 11;
  const shoreM = n => n < 20 ? 410 : (n > 195 && n < 265) ? 470 : (n > 470 && n < 930) ? 390 : 352;
  const terrM = (x, n) => {
    if (x > shoreM(n)) return -6;
    let h = 0;
    const dx = (x - 300) / 92, dn = (n - 690) / 185;
    h += 21 * sstep(1.0, 0.5, Math.hypot(dx, dn));          // Castle Point
    h += 46 * sstep(-786, -800, x);                           // the Palisades cliff
    return h;
  };
  const w = newWorld({ x0: -900, x1: 560, n0: -130, n1: 1425 }, terrM, 'Hoboken');
  w.attribution = 'Hoboken layout hand-built from the real street grid (approximate) · 🗺 loads real OpenStreetMap data';

  const NS = [['Monroe St', -750, 10], ['Madison St', -675, 10], ['Jefferson St', -600, 10], ['Adams St', -525, 10], ['Grand St', -450, 10],
    ['Clinton St', -375, 10], ['Willow Ave', -300, 12], ['Park Ave', -225, 12], ['Garden St', -150, 10], ['Bloomfield St', -75, 10],
    ['Washington St', 0, 16], ['Hudson St', 150, 11]];
  const ewN = ['Observer Hwy', 'Newark St', '1st St', '2nd St', '3rd St', '4th St', '5th St', '6th St', '7th St', '8th St', '9th St',
    '10th St', '11th St', '12th St', '13th St', '14th St', '15th St'];
  const EW = ewN.map((nm, i) => [nm, i * 85, i === 0 ? 16 : 10]);
  const N_TOP = EW[EW.length - 1][1];
  const SW = 3.5; // sidewalk
  const roads = [];
  const road = (name, x0, n0, x1, n1, wd, vert) => roads.push({ name, x0, n0, x1, n1, wd, vert });

  // north-south streets
  for (const [nm, x, wd] of NS) road(nm, x, 0, x, N_TOP, wd, true);
  road('River St', 230, 0, 230, 340, 10, true);
  road('Sinatra Dr', 330, 100, 330, 470, 12, true);
  road('Sinatra Dr', 330, 930, 330, N_TOP, 12, true);
  // east-west streets
  EW.forEach(([nm, n, wd], i) => {
    let xe = 150;
    if (i === 0) xe = 405; else if (i <= 5 || i >= 11) xe = 330;
    road(nm, -755, n, xe, n, wd, false);
  });

  // ---- parks & special blocks ----
  const parks = [];
  const park = (name, x0, n0, x1, n1) => parks.push({ name, x0, n0, x1, n1 });
  park('Church Square Park', -294, 431, -155, 504);
  park('Columbus Park', -445, 856, -380, 929);
  park('Elysian Park', 156, 941, 324, 1014);
  park('Stevens Park', 156, 346, 324, 419);
  park('Pier A Park', 356, 200, 466, 260);
  const inPark = (x, n) => parks.some(p => x > p.x0 - 8 && x < p.x1 + 8 && n > p.n0 - 8 && n < p.n1 + 8);

  // ---- blocks ----
  const cols = NS.map(s => s[1]), colW = NS.map(s => s[2]);
  const blocks = [];
  for (let i = 0; i < EW.length - 1; i++) {
    const n0 = EW[i][1] + EW[i][2] / 2 + SW, n1 = EW[i + 1][1] - EW[i + 1][2] / 2 - SW;
    for (let j = 0; j < cols.length - 1; j++) {
      blocks.push({ x0: cols[j] + colW[j] / 2 + SW, x1: cols[j + 1] - colW[j + 1] / 2 - SW, n0, n1, i, j });
    }
    // east of Hudson
    const hx = 150 + 5.5 + SW;
    if (i <= 3) blocks.push({ x0: hx, x1: 230 - 5 - SW, n0, n1, i, j: 'river' });
    if (i >= 1 && i <= 3) blocks.push({ x0: 230 + 5 + SW, x1: 330 - 6 - SW, n0: i === 1 ? 100 + SW : n0, n1, i, j: 'water' });
    if (i >= 12) blocks.push({ x0: hx, x1: 330 - 6 - SW, n0, n1, i, j: 'north' });
  }

  // ---- paint the ground ----
  paint(0, (x, P) => { x.fillStyle = '#e4dccd'; P.rect(-900, -130, 560, 1425); x.fill(); });
  paint(0, (x, P) => { // rail yard gravel + rails
    x.fillStyle = '#a49a90'; P.rect(-760, -128, 200, -10); x.fill();
    x.strokeStyle = '#6b5f5a'; x.lineWidth = 1.4 * P.k;
    for (let n = -118; n < -16; n += 7.5) { x.beginPath(); x.moveTo(P.X(-760), P.Y(n)); x.lineTo(P.X(200), P.Y(n)); x.stroke(); }
  });
  paint(0, (x, P) => { x.fillStyle = '#d7cfc0'; P.rect(150, -14, 410, 0); x.fill(); });   // terminal plaza
  paint(0, (x, P) => { x.fillStyle = '#8fc77e'; P.rect(-900, -130, -790, 1425); x.fill(); }); // palisades top
  paint(1, (x, P) => {
    for (const bl of blocks) { x.fillStyle = '#b9c79a'; P.rect(bl.x0, bl.n0, bl.x1, bl.n1); x.fill(); }
    x.fillStyle = '#9fcf87'; P.rect(156, 431, 385, 929); x.fill();                         // campus lawn
    x.fillStyle = '#cfc6b6'; P.rect(334, 100, 352, 470); x.fill(); P.rect(334, 930, 352, N_TOP); x.fill(); // promenade
  });
  paint(2, (x, P) => {
    x.fillStyle = '#5b5566';
    for (const r of roads) {
      if (r.vert) P.rect(r.x0 - r.wd / 2, r.n0 - 8, r.x0 + r.wd / 2, r.n1 + 8);
      else P.rect(r.x0 - 8, r.n0 - r.wd / 2, r.x1 + 8, r.n0 + r.wd / 2);
      x.fill();
    }
  });
  paint(3, (x, P) => {
    x.strokeStyle = '#f3c23c'; x.lineWidth = 0.5 * P.k; x.setLineDash([3 * P.k, 4 * P.k]);
    for (const r of roads) { x.beginPath(); x.moveTo(P.X(r.x0), P.Y(r.n0)); x.lineTo(P.X(r.x1), P.Y(r.n1)); x.stroke(); }
    x.setLineDash([]);
    // zebra crossings at every intersection
    x.fillStyle = 'rgba(255,255,255,.85)';
    for (const v of roads.filter(r => r.vert)) for (const h of roads.filter(r => !r.vert)) {
      if (v.x0 < h.x0 - 1 || v.x0 > h.x1 + 1 || h.n0 < v.n0 - 1 || h.n0 > v.n1 + 1) continue;
      for (const s of [-1, 1]) {
        const ny = h.n0 + s * (h.wd / 2 + 1.6);
        for (let k = -v.wd / 2 + 0.6; k < v.wd / 2 - 0.4; k += 1.6) { P.rect(v.x0 + k, ny - 1.2, v.x0 + k + 0.8, ny + 1.2); x.fill(); }
        const nx = v.x0 + s * (v.wd / 2 + 1.6);
        for (let k = -h.wd / 2 + 0.6; k < h.wd / 2 - 0.4; k += 1.6) { P.rect(nx - 1.2, h.n0 + k, nx + 1.2, h.n0 + k + 0.8); x.fill(); }
      }
    }
  });
  paint(4, (x, P) => {
    for (const p of parks) {
      x.fillStyle = '#86c870'; P.rect(p.x0, p.n0, p.x1, p.n1); x.fill();
      x.strokeStyle = '#e8dcc0'; x.lineWidth = 3 * P.k;
      x.beginPath(); x.moveTo(P.X(p.x0), P.Y(p.n0)); x.lineTo(P.X(p.x1), P.Y(p.n1)); x.moveTo(P.X(p.x1), P.Y(p.n0)); x.lineTo(P.X(p.x0), P.Y(p.n1)); x.stroke();
      x.beginPath(); x.arc(P.X((p.x0 + p.x1) / 2), P.Y((p.n0 + p.n1) / 2), 7 * P.k, 0, 7); x.fillStyle = '#e8dcc0'; x.fill();
    }
    x.strokeStyle = '#d8ccb0'; x.lineWidth = 3 * P.k; x.beginPath(); // campus paths
    x.moveTo(P.X(160), P.Y(560)); x.quadraticCurveTo(P.X(300), P.Y(600), P.X(300), P.Y(690));
    x.moveTo(P.X(160), P.Y(800)); x.quadraticCurveTo(P.X(300), P.Y(780), P.X(300), P.Y(690)); x.stroke();
  });
  paint(6, (x, P) => {
    x.fillStyle = 'rgba(255,255,255,.88)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `${Math.round(6 * P.k)}px "Patrick Hand", sans-serif`;
    for (const r of roads) {
      if (r.vert) {
        for (let i = 0; i < EW.length - 1; i += 2) {
          const n = (EW[i][1] + EW[i + 1][1]) / 2; if (n < r.n0 || n > r.n1) continue;
          x.save(); x.translate(P.X(r.x0), P.Y(n)); x.rotate(-Math.PI / 2); x.fillText(r.name.toUpperCase(), 0, 0); x.restore();
        }
      } else {
        for (let j = 0; j < cols.length - 1; j += 2) {
          const xx = (cols[j] + cols[j + 1]) / 2; if (xx < r.x0 || xx > r.x1) continue;
          x.fillText(r.name.toUpperCase(), P.X(xx), P.Y(r.n0));
        }
      }
    }
  });

  // ---- rowhouses ----
  function lots(a0, a1, step) { const out = []; let a = a0; while (a < a1 - 0.5) { let s = step * (0.8 + rnd() * 0.5); if (a1 - (a + s) < step * 0.6) s = a1 - a; out.push([a, a + s]); a += s; } return out; }
  function house(polyM, floors, color, front) {
    const top = addBuilding(w, polyM, floors * FLOOR_M + 0.4, color);
    if (rnd() < 0.55) { // cornice
      const [[ax, an], , [bx, bn]] = polyM, e = 0.35;
      addBuilding(w, rect(Math.min(ax, bx) - e, Math.min(an, bn) - e, Math.max(ax, bx) + e, Math.max(an, bn) + e), 0, new THREE.Color(color).multiplyScalar(0.7).getHex(),
        { base: top - 0.55 * S, atop: top + 0.15 * S, noWin: true, collide: false, paint: false });
    }
    if (front) { // storefront awning sticking out over the sidewalk
      const [fx0, fn0, fx1, fn1] = front;
      addBuilding(w, rect(fx0, fn0, fx1, fn1), 0, pick(PAL.awning), { base: 2.5 * S, atop: 3.0 * S, noWin: true, collide: false, paint: false, ground: 0 });
    }
  }
  function fillBlock(bl) {
    const W = bl.x1 - bl.x0, H = bl.n1 - bl.n0;
    const west = bl.x0 < -380, north = bl.j === 'north', waterSide = bl.j === 'water';
    const big = north || waterSide || (west && rnd() < 0.35) || (bl.i === 0 && rnd() < 0.5);
    if (big) { // modern mid-rise filling most of the block
      const fl = north ? 7 + ((rnd() * 6) | 0) : 5 + ((rnd() * 5) | 0), c = pick(PAL.modern), m = 2;
      if (W > 50 && rnd() < 0.6) {
        const mid = bl.x0 + W / 2;
        addBuilding(w, rect(bl.x0, bl.n0, mid - 4, bl.n1), fl * FLOOR_M, c, { winW: 2.6 });
        addBuilding(w, rect(mid + 4, bl.n0, bl.x1, bl.n1 - m * 6), (fl - 2) * FLOOR_M, pick(PAL.modern), { winW: 2.6 });
      } else addBuilding(w, rect(bl.x0, bl.n0, bl.x1, bl.n1), fl * FLOOR_M, c, { winW: 2.6 });
      return;
    }
    const D = Math.min(14, W / 2 - 1, H / 2 - 1);
    const onWash = s => (s === 'e' && Math.abs(bl.x1 - (0 - 8 - SW)) < 1) || (s === 'w' && Math.abs(bl.x0 - (0 + 8 + SW)) < 1);
    const onHud = s => (s === 'e' && Math.abs(bl.x1 - (150 - 5.5 - SW)) < 1) || (s === 'w' && Math.abs(bl.x0 - (150 + 5.5 + SW)) < 1);
    const style = s => onWash(s) ? { fl: 4 + (rnd() < 0.4), pal: PAL.pastel.concat(PAL.brick), shop: true }
      : onHud(s) ? { fl: 4, pal: PAL.brown.concat(PAL.brick) } : { fl: 3 + (rnd() < 0.45), pal: rnd() < 0.7 ? PAL.brick : PAL.pastel };
    for (const [a, b] of lots(bl.x0, bl.x1, 7.5)) {  // south & north faces
      const s1 = style('s'); house(rect(a, bl.n0, b, bl.n0 + D), s1.fl, pick(s1.pal));
      const s2 = style('n'); house(rect(a, bl.n1 - D, b, bl.n1), s2.fl, pick(s2.pal));
    }
    for (const [a, b] of lots(bl.n0 + D, bl.n1 - D, 7)) {  // west & east faces
      const sw = style('w'), se = style('e');
      house(rect(bl.x0, a, bl.x0 + D, b), sw.fl, pick(sw.pal), sw.shop ? [bl.x0 - 1.6, a + 0.4, bl.x0, b - 0.4] : null);
      house(rect(bl.x1 - D, a, bl.x1, b), se.fl, pick(se.pal), se.shop ? [bl.x1, a + 0.4, bl.x1 + 1.6, b - 0.4] : null);
    }
  }
  for (const bl of blocks) {
    if (inPark((bl.x0 + bl.x1) / 2, (bl.n0 + bl.n1) / 2)) continue;
    if (bl.i === 1 && bl.j === 9) continue;  // City Hall block
    fillBlock(bl);
  }

  // ---- landmarks ----
  // City Hall (Washington St, between Newark & 1st)
  const ch = blocks.find(b => b.i === 1 && b.j === 9);
  addBuilding(w, rect(ch.x0 + 18, ch.n0 + 6, ch.x1, ch.n1 - 6), 4 * FLOOR_M, 0xE9D8B4, { roof: 0x9DB89A });
  const chTop = addBuilding(w, rect(ch.x1 - 18, ch.n0 + 32, ch.x1 - 8, ch.n1 - 32), 4 * FLOOR_M + 9, 0xF3E6C8, { noWin: true, roof: 0x6FA58C });
  paint(4, (x, P) => { x.fillStyle = '#9fd08a'; P.rect(ch.x0, ch.n0, ch.x0 + 16, ch.n1); x.fill(); });
  addTree(w, ch.x0 + 7, ch.n0 + 15, 1.1); addTree(w, ch.x0 + 7, ch.n1 - 15, 1.1);

  // Hoboken Terminal: long copper-green hall + clock tower, ferry slips on the river
  addBuilding(w, rect(205, -78, 392, -16), 15, 0xE3D6B8, { roof: 0x6FA58C, winW: 4.5 });
  addBuilding(w, rect(203, -80, 394, -14), 0, 0x6FA58C, { base: 15 * S - 0.1, atop: 15 * S + 1.4, noWin: true, collide: false, paint: false, ground: 0 });
  addBuilding(w, rect(310, -12, 336, 6), 0, 0x6FA58C, { base: 4.8 * S, atop: 5.6 * S, noWin: true, ground: 0, paint: false }); // canopy
  const towerTop = addBuilding(w, rect(318, -62, 334, -46), 46, 0x6FA58C, { noWin: true, ground: 0 });
  addBuilding(w, rect(320, -60, 332, -48), 0, 0xE3D6B8, { base: towerTop, atop: towerTop + 6 * S, noWin: true, collide: false, paint: false });
  for (let i = 0; i < 4; i++) addBuilding(w, rect(395 + 0, -76 + i * 16, 410, -66 + i * 16), 0, 0x8a7f78, { base: -3, atop: 0.8, noWin: true, ground: 0, paint: false }); // slips
  { // clock faces
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#fff8e6'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#1a1418'; x.stroke();
    x.lineCap = 'round'; x.lineWidth = 8; x.beginPath(); x.moveTo(64, 64); x.lineTo(64, 26); x.moveTo(64, 64); x.lineTo(92, 74); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = noOutline(new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.userData.own = true;
    const cx = 326 * S, cz = 54 * S, y = towerTop - 4 * S, hw = 8 * S + 0.05;
    [[0, hw, 0], [Math.PI, -hw, 0], [Math.PI / 2, 0, hw], [-Math.PI / 2, 0, -hw]].forEach(([ry, ox, oz]) => {
      const p = new THREE.Mesh(new THREE.CircleGeometry(5 * S, 24), m);
      p.position.set(cx + (ry === Math.PI / 2 ? hw : ry === -Math.PI / 2 ? -hw : 0), y, cz + (ry === 0 ? hw : ry === Math.PI ? -hw : 0));
      p.rotation.y = ry; w.root.add(p);
    });
  }
  // trains in the yard (roofs reachable with a double-jump)
  for (const [n, n2, x0] of [[-40, -36.8, -120], [-62, -58.8, -60], [-86, -82.8, -170]]) {
    for (let k = 0; k < 3; k++) {
      const a = x0 + k * 27;
      addBuilding(w, rect(a, n, a + 25, n2), 4.2, 0xC9CED6, { winW: 2.2, ground: 0, base: 0.4 });
      addBuilding(w, rect(a - 0.05, n - 0.05, a + 25.05, n2 + 0.05), 0, 0x2A4C8C, { base: 1.1 * S, atop: 1.7 * S, noWin: true, collide: false, paint: false, lines: false });
    }
  }
  // Stevens campus on Castle Point
  const campus = [[170, 450, 230, 490, 5, 0xA9483A], [250, 445, 330, 478, 4, 0xC4643F], [170, 830, 240, 890, 6, 0x9B4F3E],
    [260, 860, 330, 905, 4, 0xE3DDD0], [168, 600, 200, 680, 4, 0xB5533C], [200, 520, 238, 560, 3, 0x8A5A44]];
  for (const [x0, n0, x1, n1, f, c] of campus) addBuilding(w, rect(x0, n0, x1, n1), f * FLOOR_M, c);
  addBuilding(w, rect(294, 684, 306, 696), 0, 0xF3E6C8, { base: w.tU(300 * S, -690 * S) + 2.6 * S, atop: w.tU(300 * S, -690 * S) + 3.4 * S, noWin: true, roof: 0xE8502E, paint: false }); // lookout gazebo roof
  for (const [dx, dn] of [[-5, -5], [5, -5], [5, 5], [-5, 5]]) addBuilding(w, rect(300 + dx - 0.4, 690 + dn - 0.4, 300 + dx + 0.4, 690 + dn + 0.4), 2.6, 0xF3E6C8, { noWin: true, paint: false });
  // Palisades: a few houses on top of the cliff
  for (let n = -100; n < 1400; n += 22 + rnd() * 30) addBuilding(w, rect(-880, n, -862 + rnd() * 6, n + 12), (2 + ((rnd() * 2) | 0)) * FLOOR_M, pick(PAL.pastel));
  // fences at the north & south ends
  addBuilding(w, rect(-790, -129, 410, -127.5), 1.4, 0x7E6C9C, { noWin: true, ground: 0 });
  addBuilding(w, rect(-790, N_TOP + 24, 352, N_TOP + 25.5), 1.4, 0x7E6C9C, { noWin: true });
  // waterfront railing (low — you can hop it… into the Hudson)
  for (const [n0, n1, x] of [[20, 195, 351], [265, 470, 351], [930, N_TOP + 24, 351], [470, 930, 389]]) addBuilding(w, rect(x, n0, x + 0.6, n1), 1.0, 0x1a1418, { noWin: true, lines: false, paint: false });
  addBuilding(w, rect(466, 195, 467, 265), 1.0, 0x1a1418, { noWin: true, lines: false, paint: false });

  // ---- trees & benches ----
  for (const p of parks) {
    const area = (p.x1 - p.x0) * (p.n1 - p.n0), cnt = Math.round(area / 260);
    for (let k = 0; k < cnt; k++) {
      const x = p.x0 + 4 + rnd() * (p.x1 - p.x0 - 8), n = p.n0 + 4 + rnd() * (p.n1 - p.n0 - 8);
      const u = (x - p.x0) / (p.x1 - p.x0), v = (n - p.n0) / (p.n1 - p.n0);
      if (Math.abs(u - v) < 0.08 || Math.abs(u + v - 1) < 0.08) continue; // keep paths clear
      addTree(w, x, n, 0.9 + rnd() * 0.6, rnd() < 0.15 ? 1 : 0);
    }
    for (let k = 0; k < 4; k++) {
      const cx = (p.x0 + p.x1) / 2, cn = (p.n0 + p.n1) / 2, a = k * Math.PI / 2 + 0.4, r = 11;
      const bx = cx + Math.cos(a) * r, bn = cn + Math.sin(a) * r;
      addBuilding(w, rect(bx - 1, bn - 0.35, bx + 1, bn + 0.35), 0.5, 0x8A5A44, { noWin: true, paint: false });
    }
  }
  for (let k = 0; k < 60; k++) { const x = 175 + rnd() * 200, n = 440 + rnd() * 480; if (Math.abs(x - 300) + Math.abs(n - 690) > 25) addTree(w, x, n, 1 + rnd() * 0.5); }
  for (const [, n, wd] of EW) for (let x = -745; x < 140; x += 18) {
    if (cols.some(c => Math.abs(c - x) < 12) || inPark(x, n) || rnd() < 0.45) continue;
    addTree(w, x, n + wd / 2 + 1.6, 0.75); addTree(w, x + 9, n - wd / 2 - 1.6, 0.75);
  }
  for (let n = 110; n < N_TOP; n += 16) if (n < 470 || n > 930) addTree(w, 343, n, 0.8);

  // ---- Manhattan, across the river (generic skyline) ----
  const far = new Buf();
  for (let n = -900; n < 2600; n += 38 + rnd() * 30) {
    for (let x = 1520; x < 2100; x += 45 + rnd() * 40) {
      const dense = (n < -350 ? 2.4 : n > 1500 ? 2.1 : 1) * (1 - (x - 1520) / 900);
      const hgt = (18 + rnd() * 50) * (rnd() < 0.18 ? 2.6 * dense : 1) + (rnd() < 0.04 ? 150 : 0);
      const wd = 20 + rnd() * 26, dp = 20 + rnd() * 26;
      prism(far, rect(x, n, x + wd, n + dp).map(([a, b]) => M(a, b)), -1, 0, hgt * S, pick([0xC6D3DE, 0xAFC0D2, 0xD8D6E0, 0xB9B2C8, 0xE2D8C8]), { lines: false, winW: 2.4 });
    }
  }
  const farMesh = bufMesh(far, farMat); w.root.add(farMesh);
  const farLand = noOutline(new THREE.Mesh(new THREE.PlaneGeometry(900 * S, 4000 * S), new THREE.MeshToonMaterial({ color: 0xB5BFA4, gradientMap: ramp })));
  farLand.material.userData.own = true;
  farLand.rotation.x = -Math.PI / 2; farLand.position.set(1950 * S, 0.2, -850 * S); w.root.add(farLand);

  // ---- people ----
  w.npcs = [
    { name: 'Rosa', role: 'Ticket Agent', x: 290, n: -4, shirt: 0x2A4C8C, skin: 0x8D5A3B, hat: 'cap', hatC: 0x2A4C8C, lines: [
      'Welcome to Hoboken Terminal! Trains, the PATH, the ferry… all of it leaves from right here.',
      'Manhattan\'s right across the river. Don\'t even think about it — you\'ve got business in Jersey first.',
      'Hoboken\'s called the Mile Square City. Go see it. Washington Street\'s a few blocks west.'] },
    { name: 'Sal', role: 'Shopkeeper', x: -10, n: 360, shirt: 0xF3E6C8, skin: 0xE0AC82, hat: 'none', lines: [
      'Washington Street! Best stroll in the Mile Square City.',
      'You got a lightning button? Run like that and you\'ll make it to Elysian Park before your coffee gets cold.',
      'Just don\'t knock over my cannoli display.'] },
    { name: 'Prof. Ivy', role: 'Professor', x: 300, n: 690, shirt: 0x7E6C9C, skin: 0xC68E66, hat: 'bun', hatC: 0x2A2630, lines: [
      'You climbed Castle Point! Highest ground in Hoboken.',
      'From up here you can see the whole skyline across the Hudson.',
      'Fun fact: this hill is serpentinite — green rock that came up from deep in the Earth.'] },
    { name: 'Gus', role: 'Fisherman', x: 455, n: 228, shirt: 0xE8502E, skin: 0xF0C29E, hat: 'beanie', hatC: 0x2E7D5B, lines: [
      'Careful by that railing, kid. The Hudson\'s colder than it looks.',
      'Caught a striper here once. Big as you. Bigger, maybe. Your head\'s pretty big.'] },
    { name: 'Coach', role: 'Baseball Fan', x: 240, n: 990, shirt: 0xFFFFFF, skin: 0xB07850, hat: 'cap', hatC: 0xE8502E, lines: [
      'Elysian Park! Around here they\'ll tell you the first organized baseball game was played nearby, back in 1846.',
      'Whether that\'s true or not, people around here will argue about it all day.'] },
    { name: 'Dee', role: 'Dog Walker', x: -222, n: 468, shirt: 0x9DB89A, skin: 0x6E4630, hat: 'none', lines: [
      'Church Square Park. My dog Biscuit runs this place.',
      'Little tip: double-jump, then hold jump to glide. Biscuit can\'t do that.',
      'Oh, and run straight at a building and keep holding — you\'ll run right up the wall. Trees around here are bouncy, too.'] }
  ];
  w.zones = [
    ['Pier A Park', 'On the Hudson', 352, 195, 472, 268], ['City Hall', 'Hoboken', ch.x0, ch.n0, ch.x1, ch.n1],
    ['Church Square Park', 'Since the 1800s', -300, 425, -150, 510], ['Columbus Park', '', -450, 850, -375, 935],
    ['Elysian Park', 'Baseball country', 150, 935, 330, 1020], ['Stevens Park', '', 150, 340, 330, 425],
    ['Castle Point', 'Stevens Institute of Technology', 155, 425, 400, 935],
    ['Hoboken Terminal', 'Trains · PATH · Ferry', 150, -14, 420, 20], ['Rail Yard', 'Watch your step', -760, -130, 410, -14],
    ['Washington Street', 'Main street of the Mile Square City', -8, 0, 8, N_TOP], ['The Palisades', 'Jersey City Heights is up there', -900, -130, -785, 1425],
    ['Sinatra Drive', 'Hudson River waterfront', 324, 0, 470, N_TOP]
  ];
  w.spawn = { x: 262, n: -5, dir: 0, sit: true };
  w.title = 'Hoboken, New Jersey';
  finishWorld(w, 2.2, 5);
}

// =====================================================================
//  finishing a world: paint the ground canvas, build meshes, trees, people
// =====================================================================
function lpGeo(geo) { geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); const g = mergeVertices(geo); g.computeVertexNormals(); return g; }
const ownToon = (c, flat = false) => { const m = new THREE.MeshToonMaterial({ color: c, gradientMap: ramp, flatShading: flat }); m.userData.own = true; return m; };
const miniCv = document.getElementById('mini'), miniCtx = miniCv.getContext('2d');
let miniBase = null;

function textSprite(text, sub) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d');
  x.font = '34px "Patrick Hand", sans-serif'; const tw = Math.min(240, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(255,248,230,.95)'; x.strokeStyle = '#1a1418'; x.lineWidth = 5;
  x.beginPath(); x.roundRect(128 - tw / 2, 6, tw, 46, 12); x.fill(); x.stroke();
  x.fillStyle = '#1a1418'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 30);
  if (sub) { x.font = '20px "Patrick Hand", sans-serif'; x.fillStyle = '#fff'; x.strokeStyle = '#1a1418'; x.lineWidth = 4; x.strokeText(sub, 128, 66); x.fillText(sub, 128, 66); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: t, depthWrite: false })));
  sp.scale.set(2.6, 0.81, 1); return sp;
}
const bangTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff3c4'; x.strokeStyle = '#1a1418'; x.lineWidth = 5; x.beginPath(); x.arc(32, 30, 24, 0, 7); x.fill(); x.stroke();
  x.fillStyle = '#E8502E'; x.font = 'bold 36px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

function buildNPC(o) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) { const leg = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.55, 10), COL.pants); leg.position.set(0.14 * s, 0.28, 0); body.add(leg);
    const shoe = mesh(new RoundedBoxGeometry(0.22, 0.14, 0.32, 3, 0.05), 0x1a1418); shoe.position.set(0.14 * s, 0.07, 0.05); body.add(shoe); }
  const torso = mesh(new THREE.CapsuleGeometry(0.3, 0.42, 4, 14), o.shirt); torso.position.y = 0.92; body.add(torso);
  for (const s of [-1, 1]) { const arm = mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), o.shirt); arm.position.set(0.36 * s, 0.9, 0); arm.rotation.z = 0.18 * s; body.add(arm);
    const hand = mesh(new THREE.SphereGeometry(0.09, 10, 8), o.skin); hand.position.set(0.41 * s, 0.62, 0); body.add(hand); }
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.34, 24, 18), o.skin));
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(1, 10, 8), COL.ink, false); e.scale.set(0.035, 0.055, 0.02); e.position.set(0.11 * s, 0.04, 0.32); head.add(e); }
  const m = mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 14, Math.PI).rotateZ(Math.PI), COL.ink, false); m.position.set(0, -0.1, 0.325); head.add(m);
  if (o.hat === 'cap') { const c = mesh(new THREE.SphereGeometry(0.355, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), o.hatC); c.position.y = 0.04; head.add(c);
    const br = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), o.hatC); br.scale.z = 1.3; br.position.set(0, 0.07, 0.3); head.add(br); }
  else if (o.hat === 'beanie') { const c = mesh(new THREE.SphereGeometry(0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), o.hatC); c.scale.y = 1.15; c.position.y = 0.05; head.add(c);
    const pom = mesh(new THREE.SphereGeometry(0.1, 10, 8), 0xfff3c4); pom.position.y = 0.47; head.add(pom); }
  else if (o.hat === 'bun') { const c = mesh(new THREE.SphereGeometry(0.355, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), o.hatC); c.position.y = 0.03; c.rotation.x = -0.35; head.add(c);
    const bun = mesh(new THREE.SphereGeometry(0.15, 12, 10), o.hatC); bun.position.set(0, 0.32, -0.16); head.add(bun); }
  const tag = textSprite(o.name, o.role); tag.position.y = 2.55; g.add(tag);
  const bang = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: bangTex, depthWrite: false }))); bang.scale.setScalar(0.6); bang.position.y = 2.05; bang.visible = false; g.add(bang);
  return { g, body, head, tag, bang, spec: o, yaw: 0, ph: rnd() * 6 };
}

function finishWorld(w, PPM, segM) {
  const b = w.b, Wm = b.x1 - b.x0, Hm = b.n1 - b.n0;
  PPM = Math.min(PPM, 4096 / Wm, 4096 / Hm);
  const cv = document.createElement('canvas'); cv.width = Math.round(Wm * PPM); cv.height = Math.round(Hm * PPM);
  const x = cv.getContext('2d');
  const P = { k: PPM, X: v => (v - b.x0) * PPM, Y: n => (b.n1 - n) * PPM,
    rect(x0, n0, x1, n1) { x.beginPath(); x.rect(P.X(Math.min(x0, x1)), P.Y(Math.max(n0, n1)), Math.abs(x1 - x0) * PPM, Math.abs(n1 - n0) * PPM); },
    poly(pts, close = true) { x.beginPath(); pts.forEach(([a, n], i) => i ? x.lineTo(P.X(a), P.Y(n)) : x.moveTo(P.X(a), P.Y(n))); if (close) x.closePath(); } };
  w.ops.sort((p, q) => p[0] - q[0]);
  for (const [, fn] of w.ops) { x.save(); fn(x, P); x.restore(); }
  w.ops = [];

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const segX = Math.max(1, Math.round(Wm / segM)), segZ = Math.max(1, Math.round(Hm / segM));
  const gg = new THREE.PlaneGeometry(Wm * S, Hm * S, segX, segZ); gg.rotateX(-Math.PI / 2);
  gg.translate((b.x0 + Wm / 2) * S, 0, -(b.n0 + Hm / 2) * S);
  const pa = gg.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setY(i, w.tU(pa.getX(i), pa.getZ(i)));
  gg.computeVertexNormals();
  const gmat = noOutline(new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp })); gmat.userData.own = true;
  w.root.add(new THREE.Mesh(gg, gmat));
  const water = noOutline(new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshToonMaterial({ color: 0x4FA9D6, gradientMap: ramp })));
  water.material.userData.own = true; water.rotation.x = -Math.PI / 2; water.position.set((b.x0 + Wm / 2) * S, WATER_Y, -(b.n0 + Hm / 2) * S);
  w.root.add(water); w.water = water;

  for (const buf of w.chunks.values()) {
    if (!buf.p.length) continue;
    w.root.add(bufMesh(buf, bldgMat));
    if (buf.l.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(buf.l, 3)); w.root.add(new THREE.LineSegments(lg, edgeMat)); }
  }
  w.chunks.clear();

  // trees (merged, outlined, faceted)
  if (w.trees.length) {
    const can = lpGeo(new THREE.IcosahedronGeometry(1, 0)), trk = lpGeo(new THREE.CylinderGeometry(0.15, 0.22, 1, 6).translate(0, 0.5, 0));
    const sets = [[], []], trunks = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const t of w.trees) {
      const s = t.s * S;
      q.setFromAxisAngle(up0, rnd() * 6.28);
      m4.compose(v.set(t.x, t.y + 3.9 * s, t.z), q, sc.set(2.3 * s, 2.0 * s, 2.3 * s)); sets[t.kind].push(can.clone().applyMatrix4(m4));
      m4.compose(v.set(t.x, t.y, t.z), q, sc.set(1.6 * s, 2.6 * s, 1.6 * s)); trunks.push(trk.clone().applyMatrix4(m4));
      const cr = 2.3 * s, tc = addCollider(w, rect(-cr, -cr, cr, cr).map(([a, c]) => [t.x + a, t.z + c]), t.y + 5.9 * s, 'tree');
      Object.assign(tc, { cx: t.x, cz: t.z, cy: t.y + 3.9 * s, r: cr, ry: 2.0 * s, tr: 0.3 * s + 0.1, cool: 0 });
    }
    const cols = [0x6DBE5A, 0x8E6CC0];
    sets.forEach((arr, i) => { if (arr.length) w.root.add(new THREE.Mesh(mergeGeometries(arr), ownToon(cols[i], true))); });
    w.root.add(new THREE.Mesh(mergeGeometries(trunks), ownToon(0x6b4a3a, true)));
  }
  // people
  w.npcs = w.npcs.map(o => {
    const n = buildNPC(o), [px, pz] = M(o.x, o.n);
    n.x = px; n.z = pz; n.g.position.set(px, floorAt(px, pz, 999 * 0 + w.tU(px, pz) + 0.3), pz);
    n.yaw = rnd() * 6.28; n.g.rotation.y = n.yaw;
    w.root.add(n.g);
    addCollider(w, rect(-0.35, -0.35, 0.35, 0.35).map(([a, c]) => [px + a, pz + c]), n.g.position.y + 1.9).noClimb = true;
    return n;
  });
  // minimap
  const sc = Math.min(132 / cv.width, 170 / cv.height);
  miniCv.width = Math.round(cv.width * sc); miniCv.height = Math.round(cv.height * sc);
  miniBase = document.createElement('canvas'); miniBase.width = miniCv.width; miniBase.height = miniCv.height;
  miniBase.getContext('2d').drawImage(cv, 0, 0, miniBase.width, miniBase.height);
  w.miniK = sc * PPM;
  const attr = document.getElementById('attr'); attr.textContent = w.attribution; 
}
const up0 = new THREE.Vector3(0, 1, 0);

export { buildHoboken, world, S, M, WATER_Y, textSprite, noOutline, miniBase };
