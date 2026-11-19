// The hero from itemnaut's Meshy model (Masked Goblin): 2,080-vertex quad mesh + 2K colour map,
// auto-rigged offline (geodesic skin weights over 11 bones) and posed with the same procedural
// angles as the old primitive hero, so every move (run, combo, slam, imp glide) still works.
import * as THREE from 'three';
import { ramp } from './core.js';
import { heroAngles } from './character.js';
import { POS, UV, IDX, SKI, SKW, BONES, TEX } from './goblin_data.js';

const dec = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
// back-face ink shell that follows the skin
const inkSkin = new THREE.ShaderMaterial({
  uniforms: { t: { value: 0.011 } }, side: THREE.BackSide,
  vertexShader: `uniform float t;
    #include <common>
    #include <skinning_pars_vertex>
    void main(){
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
      vec3 n = normalize(normalMatrix * objectNormal);
      mv.xyz += n * (t + (-mv.z) * t * 0.06);
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `void main(){ gl_FragColor = vec4(0.075, 0.06, 0.075, 1.0); }`
});
const ARM_REST = 0.115;   // the model's arms hang ~6.6° out from vertical
const qRestL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ARM_REST));
const qRestR = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -ARM_REST));

let geo = null, mat = null;
function shared() {
  if (geo) return;
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dec(POS, Float32Array), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(dec(UV, Float32Array), 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(dec(SKI, Uint8Array)), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(dec(SKW, Float32Array), 4));
  geo.setIndex(new THREE.BufferAttribute(dec(IDX, Uint16Array), 1));
  geo.computeVertexNormals();
  mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp });
  const img = new Image();
  img.onload = () => { const tex = new THREE.Texture(img); tex.flipY = true; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true; mat.map = tex; mat.needsUpdate = true; };
  img.src = TEX;
}

export function buildHeroSkinned() {
  shared();
  const root = new THREE.Group();
  const pivot = new THREE.Group(); pivot.position.y = 0.9; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -0.9; pivot.add(body);
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.frustumCulled = false; body.add(mesh);
  const bones = {}, list = [];
  for (const B of BONES) {
    const b = new THREE.Bone(); b.name = B.name; bones[B.name] = b; list.push(b);
    const par = B.parent ? BONES.find(x => x.name === B.parent).pos : [0, 0, 0];
    b.position.set(B.pos[0] - par[0], B.pos[1] - par[1], B.pos[2] - par[2]);
    (B.parent ? bones[B.parent] : mesh).add(b);
  }
  mesh.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(list);
  mesh.bind(skel);
  const ink = new THREE.SkinnedMesh(geo, inkSkin); ink.frustumCulled = false; ink.bind(skel, mesh.bindMatrix); body.add(ink);
  // hand anchors (the imp hangs from these while gliding)
  const handL = new THREE.Object3D(); handL.position.set(0.0, -0.26, 0.0); bones.elL.add(handL);
  const handR = new THREE.Object3D(); handR.position.set(0.0, -0.26, 0.0); bones.elR.add(handR);
  root.traverse(o => o.layers.set(1));
  return { root, pivot, body, mesh, bones, handL, handR, skinned: true,
    state: { runPh: 0, att: 0, attKind: 0, hurt: 0, glide: 0, air: 0, flip: -1, land: 0, idle: 0, wall: 0, pound: 0 } };
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function setRot(b, x, y, z, k, rest = null) {
  _q.setFromEuler(_e.set(x, y, z)); if (rest) _q.multiply(rest);
  b.quaternion.slerp(_q, k);
}
export function poseHeroSkinned(P, s, dt) {
  const A = heroAngles(s), B = P.bones, k = Math.min(1, dt * 18);
  setRot(B.shL, A.shLx, 0, A.shLz, k, qRestL.clone().invert());
  setRot(B.shR, A.shRx, 0, A.shRz, k, qRestR.clone().invert());
  setRot(B.elL, A.elL * 0.85, 0, 0, k); setRot(B.elR, A.elR * 0.85, 0, 0, k);
  const cl = v => Math.max(-0.95, Math.min(0.6, v));
  setRot(B.hipL, cl(A.hipL * 0.75), 0, 0, k); setRot(B.hipR, cl(A.hipR * 0.75), 0, 0, k);
  setRot(B.knL, A.knL * 0.6, 0, 0, k); setRot(B.knR, A.knR * 0.6, 0, 0, k);
  setRot(B.head, A.headRx * 0.7, A.headRy, 0, k);
  setRot(B.spine, 0, A.headRy * 0.6, 0, k);
  const sq = A.sq;
  P.body.position.y = -0.9 + A.bodyY - sq * 0.08;
  P.body.scale.set(1 + sq * 0.12, 1 - sq * 0.12, 1 + sq * 0.12);
  P.pivot.rotation.x = s.flip >= 0 ? s.flip * Math.PI * 2 : THREE.MathUtils.lerp(P.pivot.rotation.x % (Math.PI * 2), A.bodyRx, k);
  const st = A.armStretch; B.elL.scale.y = B.elR.scale.y = 1; B.shL.scale.y = B.shR.scale.y = st;
}
