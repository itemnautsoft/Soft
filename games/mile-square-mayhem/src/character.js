// The hero, built from itemnaut's turnaround + drawings: cream bald dome with pointy ears,
// grumpy yellow eyes in a black band, charcoal face mask + chunky neck gaiter, cropped grey
// hoodie with a round black eye-badge, huge black pants with grey cuffs, yellow socks,
// grey sneakers with black patches, black gloves with yellow wrist bands.
import * as THREE from 'three';
import { toon, inkify } from './core.js';

export const HC = {
  head: 0xF3EFD6, mask: 0x3A3C41, gaiter: 0x44464B, hood: 0x9C9DA1, hoodDark: 0x86878B, pants: 0x1E1E22,
  cuff: 0x4B4C51, sock: 0xF0D41C, shoe: 0xB5B6BA, patch: 0x1D1D20, sole: 0xF4F4F2, glove: 0x1C1C20,
  yel: 0xF5DD16, black: 0x0E0E10
};
const M = (g, c) => new THREE.Mesh(g, toon(c));
const sph = (r = 1, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);

export function buildHero() {
  const root = new THREE.Group();                 // feet at origin, faces +Z
  const pivot = new THREE.Group(); pivot.position.y = 0.9; root.add(pivot);   // flips spin around the belly
  const body = new THREE.Group(); body.position.y = -0.9; pivot.add(body);
  const P = { root, pivot, body };

  // ---------- legs (short and fat, mostly hidden inside the pants) ----------
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.14 * s, 0.44, 0); body.add(hip);
    const tube = M(new THREE.CapsuleGeometry(0.128, 0.16, 6, 16), HC.pants); tube.position.y = -0.14; hip.add(tube);
    const knee = new THREE.Group(); knee.position.y = -0.2; hip.add(knee);
    const cuff = M(new THREE.CylinderGeometry(0.138, 0.134, 0.07, 18), HC.cuff); cuff.position.y = -0.03; knee.add(cuff);
    const cuffLip = M(new THREE.TorusGeometry(0.134, 0.022, 8, 20).rotateX(Math.PI / 2), HC.cuff); cuffLip.position.y = 0.005; knee.add(cuffLip);
    const sock = M(new THREE.CylinderGeometry(0.072, 0.078, 0.08, 14), HC.sock); sock.position.y = -0.1; knee.add(sock);
    const foot = new THREE.Group(); foot.position.set(0, -0.175, 0.035); knee.add(foot);
    const shoe = M(sph(), HC.shoe); shoe.scale.set(0.105, 0.075, 0.165); shoe.position.y = 0.0; foot.add(shoe);
    const toe = M(sph(), HC.shoe); toe.scale.set(0.1, 0.07, 0.09); toe.position.set(0, -0.005, 0.085); foot.add(toe);
    const sole = M(new THREE.CylinderGeometry(1, 1, 1, 24), HC.sole); sole.scale.set(0.108, 0.028, 0.17); sole.position.set(0, -0.05, 0.02); foot.add(sole);
    // black patches: outer side swoosh, toe cap, heel
    const p1 = M(sph(1, 16, 12), HC.patch); p1.scale.set(0.03, 0.045, 0.075); p1.position.set(0.085 * s, 0.0, 0.02); p1.userData.noInk = true; foot.add(p1);
    const p2 = M(sph(1, 16, 12), HC.patch); p2.scale.set(0.055, 0.03, 0.04); p2.position.set(-0.02 * s, 0.035, 0.12); p2.userData.noInk = true; foot.add(p2);
    const p3 = M(sph(1, 16, 12), HC.patch); p3.scale.set(0.06, 0.04, 0.03); p3.position.set(0, 0.01, -0.145); p3.userData.noInk = true; foot.add(p3);
    P[s < 0 ? 'hipR' : 'hipL'] = hip; P[s < 0 ? 'knR' : 'knL'] = knee;
  }
  // ---------- the big pants (belly + seat) ----------
  const belly = M(sph(1, 32, 24), HC.pants); belly.scale.set(0.335, 0.4, 0.31); belly.position.set(0, 0.62, 0.0); body.add(belly);
  const gut = M(sph(1, 28, 20), HC.pants); gut.scale.set(0.27, 0.27, 0.23); gut.position.set(0, 0.62, 0.095); body.add(gut);
  const seat = M(sph(1, 28, 20), HC.pants); seat.scale.set(0.28, 0.25, 0.22); seat.position.set(0, 0.56, -0.09); body.add(seat);
  for (const s of [-1, 1]) { // pocket rivets (yellow dots from the drawing)
    const r = M(sph(0.016, 8, 6), HC.yel); r.position.set(0.255 * s, 0.82, 0.18); r.userData.noInk = true; body.add(r);
  }
  // ---------- cropped hoodie ----------
  const hood = M(sph(1, 32, 24), HC.hood); hood.scale.set(0.37, 0.23, 0.3); hood.position.set(0, 1.02, -0.005); body.add(hood);
  const hem = M(new THREE.TorusGeometry(0.33, 0.045, 10, 32).rotateX(Math.PI / 2), HC.hood); hem.scale.set(1, 1, 0.84); hem.position.y = 0.905; body.add(hem);
  // zipper seam (the hoodie opens a little off-centre in the turnaround)
  const zip = M(new THREE.BoxGeometry(0.008, 0.2, 0.01), HC.hoodDark); zip.position.set(0.02, 1.0, 0.296); zip.rotation.x = -0.25; zip.userData.noInk = true; body.add(zip);
  // the round black eye-badge on his right chest, hung on a cord from the collar
  const badge = new THREE.Group(); badge.position.set(-0.155, 1.06, 0.255); badge.rotation.set(-0.35, -0.42, 0); body.add(badge);
  const disc = M(new THREE.CylinderGeometry(0.068, 0.068, 0.035, 24).rotateX(Math.PI / 2), HC.black); badge.add(disc);
  const iris = M(sph(0.022, 12, 10), HC.yel); iris.scale.z = 0.5; iris.position.set(0.012, 0.012, 0.02); iris.userData.noInk = true; badge.add(iris);
  const pup = M(sph(0.009, 8, 6), HC.black); pup.position.set(0.016, 0.014, 0.03); pup.userData.noInk = true; badge.add(pup);
  const cord = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.07, 1.2, 0.22), new THREE.Vector3(-0.12, 1.16, 0.27), new THREE.Vector3(-0.15, 1.115, 0.27)]), 12, 0.009, 6), 0x6a6b70);
  cord.userData.noInk = true; body.add(cord);

  // ---------- arms: puffy sleeves, black gloves with a yellow wrist band ----------
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.335 * s, 1.11, -0.01); body.add(sh);
    const ball = M(sph(0.11, 18, 14), HC.hood); sh.add(ball);
    const up = M(new THREE.CapsuleGeometry(0.098, 0.12, 6, 14), HC.hood); up.position.y = -0.12; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.24; sh.add(el);
    const fore = M(new THREE.CapsuleGeometry(0.09, 0.1, 6, 14), HC.hood); fore.position.y = -0.08; el.add(fore);
    const cuff = M(new THREE.TorusGeometry(0.07, 0.03, 8, 16).rotateX(Math.PI / 2), HC.hoodDark); cuff.position.y = -0.17; el.add(cuff);
    const hand = new THREE.Group(); hand.position.y = -0.2; el.add(hand);
    const band = M(new THREE.CylinderGeometry(0.06, 0.062, 0.035, 14), HC.yel); band.position.y = 0.0; band.userData.noInk = true; hand.add(band);
    const palm = M(sph(1, 18, 14), HC.glove); palm.scale.set(0.065, 0.085, 0.055); palm.position.y = -0.07; hand.add(palm);
    const fing = M(new THREE.CapsuleGeometry(0.03, 0.05, 4, 8), HC.glove); fing.position.set(0, -0.14, 0.015); fing.scale.set(1.6, 1, 1); hand.add(fing);
    const thumb = M(new THREE.CapsuleGeometry(0.022, 0.04, 4, 8), HC.glove); thumb.position.set(-0.01 * s, -0.07, 0.055); thumb.rotation.x = 0.7; hand.add(thumb);
    P[s < 0 ? 'shR' : 'shL'] = sh; P[s < 0 ? 'elR' : 'elL'] = el; P[s < 0 ? 'handR' : 'handL'] = hand;
    P[s < 0 ? 'armR' : 'armL'] = [up, fore];
  }

  // ---------- neck gaiter (thick rolled collar) ----------
  const gaiter = M(new THREE.TorusGeometry(0.2, 0.1, 14, 32).rotateX(Math.PI / 2), HC.gaiter); gaiter.scale.set(1.05, 1, 0.95); gaiter.position.y = 1.2; body.add(gaiter);
  const gTop = M(new THREE.CylinderGeometry(0.24, 0.27, 0.1, 28), HC.gaiter); gTop.position.y = 1.26; body.add(gTop);

  // ---------- head ----------
  const head = new THREE.Group(); head.position.set(0, 1.23, 0.0); body.add(head); P.head = head;
  const prof = [[0.0, 0.565], [0.07, 0.56], [0.13, 0.54], [0.18, 0.505], [0.22, 0.45], [0.248, 0.38], [0.264, 0.3], [0.272, 0.22], [0.272, 0.14], [0.265, 0.07], [0.25, 0.01], [0.22, -0.03]]
    .reverse().map(([r, y]) => new THREE.Vector2(r, y));
  const skull = M(new THREE.LatheGeometry(prof, 40), HC.head); skull.scale.z = 0.96; head.add(skull);
  // pointy elf ears, sticking out sideways and a bit up/back
  for (const s of [-1, 1]) {
    const ear = M(new THREE.ConeGeometry(0.075, 0.25, 12), HC.head);
    ear.scale.z = 0.55; ear.rotation.set(0, 0.25 * s, -s * (Math.PI / 2 - 0.32)); ear.position.set(0.32 * s, 0.2, -0.03); head.add(ear);
  }
  // black eye band (a slice of a slightly bigger sphere across the front)
  const BR = 0.276;
  const band = M(new THREE.SphereGeometry(BR, 40, 8, 0.42, Math.PI - 0.84, Math.PI / 2 - 0.17, 0.3), HC.black);
  band.position.y = 0.25; band.userData.noInk = true; band.scale.z = 0.97; head.add(band);
  // the band reads as two narrowed eyes: yellow irises + a pupil, tucked under heavy brows
  for (const s of [-1, 1]) {
    const a = 0.34 * s, ex = Math.sin(a) * (BR + 0.004), ez = Math.cos(a) * (BR + 0.004) * 0.97;
    const eye = M(sph(1, 14, 10), HC.yel); eye.scale.set(0.03, 0.02, 0.01); eye.position.set(ex, 0.245, ez); eye.rotation.y = a; eye.userData.noInk = true; head.add(eye);
    const pupil = M(sph(1, 10, 8), HC.black); pupil.scale.set(0.011, 0.012, 0.006); pupil.position.set(ex * 1.01 - 0.004 * s, 0.245, ez + 0.007); pupil.rotation.y = a; pupil.userData.noInk = true; head.add(pupil);
    const brow = M(sph(1, 20, 14), HC.head); brow.scale.set(0.11, 0.05, 0.07); brow.position.set(0.09 * s, 0.3, 0.212);
    brow.rotation.set(0.1, 0.2 * s, -0.28 * s); head.add(brow);
    P[s < 0 ? 'eyeR' : 'eyeL'] = eye;
  }
  // charcoal face mask: a shell over the lower face (front only), rising to a point over the nose
  const mprof = [[0.236, -0.035], [0.262, 0.02], [0.274, 0.08], [0.279, 0.14], [0.28, 0.19]].map(([r, y]) => new THREE.Vector2(r + 0.008, y));
  const maskG = new THREE.LatheGeometry(mprof, 36, -1.75, 3.5);
  const mask = M(maskG, HC.mask); mask.scale.z = 0.97; head.add(mask);
  const cap = M(new THREE.SphereGeometry(0.288, 36, 6, 0, Math.PI * 2, Math.PI / 2 - 0.19, 0.17), HC.mask); cap.visible = false; head.add(cap);
  const ridge = M(new THREE.ConeGeometry(0.085, 0.13, 4), HC.mask); ridge.rotation.set(-0.42, Math.PI / 4, 0); ridge.scale.set(1, 1, 0.5);
  ridge.position.set(0, 0.2, 0.232); head.add(ridge);
  const snout = M(sph(1, 20, 14), HC.mask); snout.scale.set(0.12, 0.075, 0.05); snout.position.set(0, 0.15, 0.255); head.add(snout);

  inkify(root, 0.015);
  P.state = { runPh: 0, att: 0, attKind: 0, hurt: 0, glide: 0, air: 0, flip: -1, land: 0, idle: 0, wall: 0, pound: 0 };
  return P;
}

// ---------- posing ----------
const lerp = (a, b, k) => a + (b - a) * k;
export function heroAngles(s) {
  const t = performance.now() / 1000;
  const run = s.runAmt, id = 1 - run, g = s.glide, air = s.air * (1 - g);
  const sw = Math.sin(s.runPh), bob = Math.abs(Math.cos(s.runPh));
  // base: idle breathing / run
  let shLx = -sw * 0.9 * run, shRx = sw * 0.9 * run, shLz = 0.12 + 0.05 * Math.sin(t * 2) * id, shRz = -shLz;
  let elL = -0.25 - Math.max(0, -shLx) * 0.6 - 0.3 * run, elR = -0.25 - Math.max(0, -shRx) * 0.6 - 0.3 * run;
  let hipL = sw * 0.8 * run, hipR = -sw * 0.8 * run, knL = Math.max(0, -hipL) * 0.9, knR = Math.max(0, -hipR) * 0.9;
  let bodyY = 0.035 * bob * run + 0.008 * Math.sin(t * 2.2) * id, bodyRx = 0.12 * run, headRx = -0.06 * run, headRy = 0;
  let armStretch = 1;
  // airborne (jump): knees up, arms out
  if (air > 0) {
    shLx = lerp(shLx, -0.6, air); shRx = lerp(shRx, -0.6, air); shLz = lerp(shLz, 0.9, air); shRz = lerp(shRz, -0.9, air);
    hipL = lerp(hipL, -0.7, air); hipR = lerp(hipR, 0.2, air); knL = lerp(knL, 0.9, air); knR = lerp(knR, 0.4, air);
  }
  // glide: both arms straight up holding the imp, legs dangling and kicking a little
  if (g > 0) {
    const k = Math.sin(t * 9);
    shLx = lerp(shLx, -Math.PI + 0.05, g); shRx = lerp(shRx, -Math.PI + 0.05, g); shLz = lerp(shLz, -0.18, g); shRz = lerp(shRz, 0.18, g);
    elL = lerp(elL, 0, g); elR = lerp(elR, 0, g);
    hipL = lerp(hipL, 0.15 + 0.25 * k, g); hipR = lerp(hipR, 0.15 - 0.25 * k, g); knL = lerp(knL, 0.3, g); knR = lerp(knR, 0.3, g);
    bodyRx = lerp(bodyRx, 0.18, g); headRx = lerp(headRx, -0.35, g); armStretch = lerp(1, 1.32, g);
  }
  // wall run: arms pumping, body leaning into the wall
  if (s.wall > 0) { bodyRx = lerp(bodyRx, -0.35, s.wall); headRx = lerp(headRx, -0.4, s.wall); }
  // attacks: 0 jab R, 1 jab L, 2 big kick, 3 ground pound, 4 uppercut (air)
  if (s.att > 0) {
    const a = s.att, e = Math.sin(Math.min(1, a) * Math.PI);
    if (s.attKind === 0) { shRx = lerp(shRx, -1.55, e); shRz = lerp(shRz, 0.15, e); elR = lerp(elR, 0, e); bodyRx += 0.1 * e; headRy = -0.25 * e; shLx = lerp(shLx, -0.9, e); elL = lerp(elL, -1.6, e); }
    if (s.attKind === 1) { shLx = lerp(shLx, -1.55, e); shLz = lerp(shLz, -0.15, e); elL = lerp(elL, 0, e); bodyRx += 0.1 * e; headRy = 0.25 * e; shRx = lerp(shRx, -0.9, e); elR = lerp(elR, -1.6, e); }
    if (s.attKind === 2) { hipL = lerp(hipL, -1.6, e); knL = lerp(knL, 0.1, e); hipR = lerp(hipR, 0.25, e); bodyRx -= 0.35 * e; shLz = lerp(shLz, 1.1, e); shRz = lerp(shRz, -1.1, e); }
    if (s.attKind === 3) { shLx = lerp(shLx, -2.6, e); shRx = lerp(shRx, -2.6, e); elL = lerp(elL, -0.5, e); elR = lerp(elR, -0.5, e); hipL = lerp(hipL, -1, e); hipR = lerp(hipR, -1, e); knL = lerp(knL, 1.6, e); knR = lerp(knR, 1.6, e); bodyRx += 0.3 * e; }
    if (s.attKind === 4) { shRx = lerp(shRx, -2.9, e); elR = lerp(elR, -0.2, e); hipL = lerp(hipL, -1.2, e); knL = lerp(knL, 1.2, e); }
  }
  if (s.hurt > 0) { const h = Math.min(1, s.hurt * 3); bodyRx -= 0.45 * h; headRx -= 0.3 * h; shLz += 0.7 * h; shRz -= 0.7 * h; }
  return { shLx, shLz, shRx, shRz, elL, elR, hipL, hipR, knL, knR, bodyY, bodyRx, headRx, headRy, armStretch, sq: s.land };
}
export function poseHero(P, s, dt) {
  let { shLx, shLz, shRx, shRz, elL, elR, hipL, hipR, knL, knR, bodyY, bodyRx, headRx, headRy, armStretch } = heroAngles(s);
  const t = performance.now() / 1000;
  const sq = s.land;
  const k = Math.min(1, dt * 18);
  const R = (o, x, y, z) => { o.rotation.x = lerp(o.rotation.x, x, k); if (y != null) o.rotation.y = lerp(o.rotation.y, y, k); if (z != null) o.rotation.z = lerp(o.rotation.z, z, k); };
  R(P.shL, shLx, 0, shLz); R(P.shR, shRx, 0, shRz); R(P.elL, elL); R(P.elR, elR);
  R(P.hipL, hipL); R(P.hipR, hipR); R(P.knL, knL); R(P.knR, knR); R(P.head, headRx, headRy, 0);
  P.body.position.y = -0.9 + bodyY - sq * 0.08;
  P.body.scale.set(1 + sq * 0.12, 1 - sq * 0.12, 1 + sq * 0.12);
  P.pivot.rotation.x = s.flip >= 0 ? s.flip * Math.PI * 2 : lerp(P.pivot.rotation.x % (Math.PI * 2), bodyRx, k);
  for (const side of ['armL', 'armR']) for (const m of P[side]) m.scale.y = armStretch;
  P.elL.position.y = P.elR.position.y = -0.24 * armStretch; P.handL.position.y = P.handR.position.y = -0.2 * armStretch;
  // grumpy blink
  const bl = (t % 4.3) < 0.12 ? 0.15 : 1; P.eyeL.scale.y = P.eyeR.scale.y = 0.02 * bl;
}
