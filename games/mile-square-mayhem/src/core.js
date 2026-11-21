import * as THREE from 'three';
export const COL = {
  bg: 0x8FD0EE, head: 0xFDBA1C, face: 0xE4F400, torso: 0xF3C23C, pants: 0x2A2630,
  red: 0xE8502E, lav: 0xB0A2C4, lavDark: 0x7E6C9C, sticker: 0x5A4A78, ink: 0x161216
};
export const SKY = 0x9AD6F2;
export let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); }
catch (e) { document.getElementById('err').style.display = 'flex'; throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
export const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
export const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.25, 6000);
export const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const matCache = {};
export function toon(color, outline = true) {
  const k = color + (outline ? 'o' : 'n');
  if (!matCache[k]) matCache[k] = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
  return matCache[k];
}
export const mesh = (g, c) => new THREE.Mesh(g, toon(c));
// layers: 0 = world (gets the cel post pass), 1 = actors (drawn crisp on top, own ink hulls)
export const L_WORLD = 0, L_ACTOR = 1;
export const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7f9a, 1.3);
export const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-60, 120, 80);
for (const l of [hemi, sun]) l.layers.enableAll();
scene.add(hemi, sun);

// ---------- ink hulls: back-face shell pushed out along view-space normals ----------
const inkMats = {};
export function inkMat(t) {
  const k = t.toFixed(4);
  if (!inkMats[k]) inkMats[k] = new THREE.ShaderMaterial({
    uniforms: { t: { value: t } }, side: THREE.BackSide,
    vertexShader: `uniform float t; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal); mv.xyz += n * (t + (-mv.z) * t * 0.06);
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `void main(){ gl_FragColor = vec4(0.075, 0.06, 0.075, 1.0); }`
  });
  return inkMats[k];
}
// add a hull to every mesh under obj (skip ones flagged noInk), and put everything on a layer
export function inkify(obj, t = 0.012, layer = 1) {
  const list = [];
  obj.traverse(o => { if (o.isMesh && !o.userData.noInk && !o.userData.isInk) list.push(o); });
  for (const m of list) {
    const h = new THREE.Mesh(m.geometry, inkMat(m.userData.ink ?? t)); h.userData.isInk = true; h.castShadow = false;
    m.add(h);
  }
  obj.traverse(o => o.layers.set(layer));
  return obj;
}
