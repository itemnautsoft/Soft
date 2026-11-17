// The little pink demon from itemnaut's drawing: round pink head, black eye-holes with yellow
// pupils, big round nose, long droopy yellow beak-tongue, one fang, small horns, bat wings,
// skinny limbs and a curly tail. He carries the hero when the hero glides.
import * as THREE from 'three';
import { toon, inkify } from './core.js';
const PINK = 0xF27BB0, WING = 0xC2508A, DARK = 0x9E3F70, BLACK = 0x0E0E10, YEL = 0xF7E81E;
const M = (g, c) => new THREE.Mesh(g, toon(c));
const sph = (r = 1, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);

function wingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.06, 0.2); s.lineTo(0.03, 0.34); s.lineTo(0.13, 0.27); s.lineTo(0.27, 0.36);
  s.lineTo(0.22, 0.2); s.lineTo(0.17, 0.22); s.lineTo(0.14, 0.11); s.lineTo(0.08, 0.13); s.lineTo(0.05, 0.02); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }); g.translate(0, 0, -0.006); return g;
}
export function buildImp() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const P = { root, body };
  const head = M(sph(0.16, 28, 20), PINK); head.scale.set(1, 0.95, 0.95); body.add(head);
  // eye holes: angry black almonds with a yellow pupil
  for (const s of [-1, 1]) {
    const hole = M(sph(1, 16, 12), BLACK); hole.scale.set(0.055, 0.04, 0.03); hole.position.set(0.06 * s, 0.03, 0.135);
    hole.rotation.set(-0.2, 0.4 * s, -0.45 * s); hole.userData.noInk = true; body.add(hole);
    const pu = M(sph(0.014, 10, 8), YEL); pu.position.set(0.065 * s, 0.022, 0.162); pu.userData.noInk = true; body.add(pu);
  }
  const nose = M(sph(0.06, 18, 14), PINK); nose.position.set(-0.01, -0.035, 0.17); body.add(nose);
  // long yellow beak-tongue drooping down-forward
  const beak = M(new THREE.ConeGeometry(0.032, 0.2, 12), YEL); beak.position.set(0.02, -0.13, 0.155); beak.rotation.x = 2.75; body.add(beak);
  const fang = M(new THREE.ConeGeometry(0.014, 0.04, 6), 0xffffff); fang.position.set(0.06, -0.085, 0.14); fang.rotation.x = Math.PI; body.add(fang);
  for (const s of [-1, 1]) {
    const horn = M(new THREE.ConeGeometry(0.028, 0.08, 8), PINK); horn.position.set(0.085 * s, 0.13, 0.0); horn.rotation.z = -0.5 * s; body.add(horn);
  }
  // wings on top/back, pointing up like the drawing
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(0.05 * s, 0.11, -0.07); body.add(w);
    const m = M(wingGeo(), WING); m.scale.x = s; m.rotation.y = 0; w.add(m);
    P[s < 0 ? 'wingR' : 'wingL'] = w;
  }
  // skinny body, arms, legs with pointy feet
  const torso = M(new THREE.CapsuleGeometry(0.045, 0.07, 4, 10), PINK); torso.position.set(0, -0.2, -0.04); torso.rotation.x = 0.3; body.add(torso);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.05 * s, -0.17, -0.02); body.add(arm);
    const a = M(new THREE.CapsuleGeometry(0.016, 0.1, 4, 6), PINK); a.position.y = -0.06; arm.add(a);
    const c = M(new THREE.ConeGeometry(0.02, 0.05, 5), DARK); c.position.y = -0.135; c.rotation.x = Math.PI; arm.add(c);
    arm.rotation.z = 0.6 * s;
    const leg = new THREE.Group(); leg.position.set(0.035 * s, -0.25, -0.05); body.add(leg);
    const l = M(new THREE.CapsuleGeometry(0.018, 0.11, 4, 6), PINK); l.position.y = -0.065; leg.add(l);
    const f = M(new THREE.ConeGeometry(0.022, 0.07, 5), PINK); f.position.set(0, -0.135, 0.025); f.rotation.x = Math.PI / 2 + 0.3; leg.add(f);
    P[s < 0 ? 'armR' : 'armL'] = arm; P[s < 0 ? 'legR' : 'legL'] = leg;
  }
  // curly tail with a little spade
  const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, a = u * 9.5; const r = 0.07 * (1 - u * 0.75);
    pts.push(new THREE.Vector3(0.02 + (u < 0.5 ? u * 0.3 : 0.15 + Math.sin(a) * r), -0.27 - u * 0.12 + (u > 0.5 ? Math.cos(a) * r : 0), -0.09 - u * 0.12)); }
  const tail = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 6), PINK); body.add(tail);
  inkify(root, 0.007);
  P.state = { flap: 0 };
  return P;
}
export function poseImp(P, carrying, strain, dt, t) {
  const f = carrying ? 15 : 6.5;
  const a = Math.sin(t * f) * (carrying ? 0.9 : 0.55);
  P.wingL.rotation.set(0.15, -0.3 - a * 0.6, -0.5 + a); P.wingR.rotation.set(0.15, 0.3 + a * 0.6, 0.5 - a);
  const k = Math.min(1, dt * 10);
  const armUp = carrying ? 0 : 0.6;
  P.armL.rotation.z += (armUp - P.armL.rotation.z) * k; P.armR.rotation.z += (-armUp - P.armR.rotation.z) * k;
  const kick = carrying ? Math.sin(t * 12) * 0.25 : Math.sin(t * 3) * 0.2;
  P.legL.rotation.x = kick; P.legR.rotation.x = -kick;
  const sq = carrying ? 0.06 * Math.sin(t * f * 2) + strain * 0.08 : 0;
  P.body.scale.set(1 + sq, 1 - sq, 1 + sq);
}
