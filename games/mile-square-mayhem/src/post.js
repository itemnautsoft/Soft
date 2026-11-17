// Cel pass: renders the world (layer 0) into a target, then draws it to the screen with
// optional painterly flattening (Kuwahara) + colour banding for the photo-scanned city,
// depth-based ink lines and distance haze. It also writes the world depth back, so the
// actors (layer 1, toon + ink hulls) are drawn crisp on top with correct occlusion.
import * as THREE from 'three';
const FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near, far, toonAmt, kuwa, inkW, creaseAmt;
uniform vec3 fogCol; uniform float dbg; uniform float fogNear, fogFar;
varying vec2 vUv;
float rawD(vec2 uv){ return texture2D(tDepth, uv).r; }
float linD(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
float L(vec2 uv){ return linD(rawD(uv)); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
vec3 toS(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
vec3 toL(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 kuwahara(vec2 uv){
  vec2 px = 1.6 / res; vec3 best = vec3(0.0); float bv = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 sgn = vec2(q == 0 || q == 2 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
    vec3 m = vec3(0.0), s = vec3(0.0);
    for (int i = 0; i <= 2; i++) for (int j = 0; j <= 2; j++) {
      vec3 c = toS(texture2D(tColor, uv + vec2(float(i), float(j)) * sgn * px).rgb); m += c; s += c * c; }
    m /= 9.0; s = abs(s / 9.0 - m * m); float v = s.r + s.g + s.b;
    if (v < bv) { bv = v; best = m; }
  }
  return best;
}
void main(){
  float d = rawD(vUv);
  vec3 c = kuwa > 0.5 ? kuwahara(vUv) : toS(texture2D(tColor, vUv).rgb);
  float lc = linD(d);
  if (toonAmt > 0.0 && d < 1.0) {
    vec3 h = rgb2hsv(c); float b = 5.0; float v = h.z * b; float f = fract(v);
    float vq = (floor(v) + smoothstep(0.3, 0.7, f)) / b;
    h.z = mix(h.z, vq * 0.92 + 0.1, toonAmt); h.y = min(1.0, h.y * (1.0 + 0.5 * toonAmt));
    c = hsv2rgb(h);
  }
  // ink: positive depth laplacian = this pixel is in front of its neighbours (silhouette)
  vec2 o = inkW / res;
  float l1 = L(vUv + vec2(o.x, 0.0)), l2 = L(vUv - vec2(o.x, 0.0)), l3 = L(vUv + vec2(0.0, o.y)), l4 = L(vUv - vec2(0.0, o.y));
  float lx = l1 + l2 - 2.0 * lc, ly = l3 + l4 - 2.0 * lc;
  vec2 o2 = o * 2.0;
  float m1 = L(vUv + vec2(o2.x, 0.0)), m2 = L(vUv - vec2(o2.x, 0.0)), m3 = L(vUv + vec2(0.0, o2.y)), m4 = L(vUv - vec2(0.0, o2.y));
  lx = max(lx, (m1 + m2 - 2.0 * lc) * 0.5); ly = max(ly, (m3 + m4 - 2.0 * lc) * 0.5);
  float sil = smoothstep(0.035, 0.08, max(lx, ly) / lc);
  float crease = smoothstep(0.025, 0.06, max(-lx, -ly) / lc) * creaseAmt;
  float fg = d >= 1.0 ? 0.0 : smoothstep(fogNear, fogFar, lc);
  float e = max(sil, crease) * (1.0 - fg) * (d >= 1.0 ? 0.0 : 1.0);
  c = mix(c, toS(fogCol), fg * 0.9);
  c = mix(c, vec3(0.075, 0.06, 0.075), e);
  gl_FragColor = vec4(toL(c), 1.0);
  if (dbg > 0.5) gl_FragColor = vec4(vec3(fract(lc / 20.0)), 1.0);
  if (dbg > 1.5) gl_FragColor = vec4(vec3(sil, crease, 0.0), 1.0);
  #include <colorspace_fragment>
  gl_FragDepth = d;
}`;
export class CelPost {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.rt.depthTexture = new THREE.DepthTexture(4, 4); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.u = { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, res: { value: new THREE.Vector2(4, 4) },
      near: { value: 0.25 }, far: { value: 6000 }, toonAmt: { value: 0 }, kuwa: { value: 0 }, inkW: { value: 1.5 }, creaseAmt: { value: 0.5 },
      fogCol: { value: new THREE.Color(0x9AD6F2) }, dbg: { value: 0 }, fogNear: { value: 400 }, fogFar: { value: 2600 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h, pr) { this.rt.setSize(Math.round(w * pr), Math.round(h * pr)); this.u.res.value.set(Math.round(w * pr), Math.round(h * pr)); this.u.inkW.value = Math.max(1, 1.1 * pr); }
  render(scene, camera) {
    const r = this.renderer;
    this.u.near.value = camera.near; this.u.far.value = camera.far;
    camera.layers.set(0);
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    r.setRenderTarget(null); r.clear(); r.render(this.qs, this.qc);
    camera.layers.set(1);
    const bg = scene.background; scene.background = null;
    r.autoClear = false; r.render(scene, camera); r.autoClear = true;
    scene.background = bg;
    camera.layers.enableAll();
  }
}
