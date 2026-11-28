// Grumps: little storm-cloud blobs of Hoboken gloom. Beat them and they cheer up
// (turn pastel, smile, float away) instead of dying — itemnaut's inverted premise.
import * as THREE from 'three';
import { toon, inkify } from './core.js';
const M = (g, c) => new THREE.Mesh(g, toon(c));
const sph = (r = 1, w = 22, h = 16) => new THREE.SphereGeometry(r, w, h);
const KIND = {
  g: { body: 0x5E5279, belly: 0x7C70A0, size: 0.55, hp: 30, dmg: 9, xp: 12, speed: 3.6 },
  b: { body: 0x3F3554, belly: 0x5C4F78, size: 0.95, hp: 95, dmg: 16, xp: 36, speed: 2.6 },
  boss: { body: 0x352B47, belly: 0x54466E, size: 2.3, hp: 1100, dmg: 22, xp: 320, speed: 3.0 }
};
export { KIND };
export function buildGrump(kind = 'g') {
  const K = KIND[kind], s = K.size;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const blob = M(sph(1, 28, 20), K.body); blob.scale.set(s, s * 0.82, s * 0.9); blob.position.y = s * 0.85; body.add(blob);
  const belly = M(sph(1, 20, 14), K.belly); belly.scale.set(s * 0.62, s * 0.5, s * 0.4); belly.position.set(0, s * 0.68, s * 0.55); belly.userData.noInk = true; body.add(belly);
  // cloud puffs on top
  const puffs = [];
  for (const [x, y, z, r] of [[-0.45, 1.45, 0, 0.42], [0.1, 1.6, -0.1, 0.5], [0.55, 1.4, 0.05, 0.38]]) {
    const p = M(sph(1, 16, 12), K.body); p.scale.setScalar(r * s); p.position.set(x * s, y * s, z * s); body.add(p); puffs.push(p);
  }
  if (kind !== 'g') for (const sx of [-1, 1]) { const h = M(new THREE.ConeGeometry(0.14 * s, 0.4 * s, 8), 0xF3EFD6); h.position.set(0.48 * s * sx, 1.45 * s, 0.25 * s); h.rotation.z = -0.5 * sx; body.add(h); }
  if (kind === 'boss') { // crown of lightning
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const c = M(new THREE.ConeGeometry(0.12 * s, 0.45 * s, 4), 0xF5DD16);
      c.position.set(Math.sin(a) * 0.38 * s, 1.95 * s, Math.cos(a) * 0.38 * s); body.add(c); }
  }
  // angry face
  const face = new THREE.Group(); face.position.set(0, s * 0.95, s * 0.8); body.add(face);
  const eyes = [], brows = [];
  for (const sx of [-1, 1]) {
    const e = M(sph(1, 14, 10), 0xffffff); e.scale.set(0.16 * s, 0.14 * s, 0.08 * s); e.position.set(0.22 * s * sx, 0, 0); face.add(e);
    const p = M(sph(1, 10, 8), 0x0E0E10); p.scale.set(0.07 * s, 0.08 * s, 0.05 * s); p.position.set(0.2 * s * sx, -0.02 * s, 0.06 * s); p.userData.noInk = true; face.add(p);
    const b = M(new THREE.BoxGeometry(0.3 * s, 0.07 * s, 0.06 * s), 0x0E0E10); b.position.set(0.2 * s * sx, 0.15 * s, 0.05 * s); b.rotation.z = -0.45 * sx; face.add(b);
    eyes.push(e, p); brows.push(b);
  }
  const frown = M(new THREE.TorusGeometry(0.12 * s, 0.03 * s, 6, 14, Math.PI), 0x0E0E10); frown.position.set(0, -0.25 * s, 0.03 * s); face.add(frown);
  // happy face (hidden until cheered)
  const happy = new THREE.Group(); happy.visible = false; face.add(happy);
  for (const sx of [-1, 1]) { const a = M(new THREE.TorusGeometry(0.09 * s, 0.03 * s, 6, 12, Math.PI), 0x0E0E10); a.position.set(0.21 * s * sx, -0.02 * s, 0.03 * s); happy.add(a);
    const ch = M(sph(1, 10, 8), 0xFF8FB8); ch.scale.set(0.09 * s, 0.06 * s, 0.03 * s); ch.position.set(0.36 * s * sx, -0.18 * s, 0); ch.userData.noInk = true; happy.add(ch); }
  const smile = M(new THREE.TorusGeometry(0.13 * s, 0.03 * s, 6, 14, Math.PI), 0x0E0E10); smile.rotation.z = Math.PI; smile.position.set(0, -0.15 * s, 0.03 * s); happy.add(smile);
  // stubby feet
  const feet = [];
  for (const sx of [-1, 1]) { const f = M(sph(1, 12, 8), 0x2A2338); f.scale.set(0.2 * s, 0.12 * s, 0.26 * s); f.position.set(0.3 * s * sx, 0.1 * s, 0.1 * s); body.add(f); feet.push(f); }
  inkify(root, 0.02 * Math.max(1, s * 0.8));
  const tint = [blob, ...puffs]; const tintB = [belly];
  return { root, body, face, frown, happy, eyes, brows, feet, kind, K, tint, tintB, size: s };
}
const pastel = [0xFFB3D1, 0xA8E6CF, 0xFFE38A, 0xB5C7FF, 0xFFC9A8];
export function cheerUp(e) {
  const c = pastel[(Math.random() * pastel.length) | 0];
  for (const m of e.tint) m.material = toon(c);
  for (const m of e.tintB) m.material = toon(0xFFFFFF);
  e.frown.visible = false; e.happy.visible = true; for (const x of e.eyes) x.visible = false; for (const b of e.brows) b.visible = false;
  e.happy.traverse(o => o.layers.set(1));
}
