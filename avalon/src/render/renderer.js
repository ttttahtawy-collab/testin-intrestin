// Renderer: scene, lights, shadows, sky, fog, post-processing and viewmodel layer.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Sky } from './sky.js';
import { U, makeVoxelMaterial, makeWaterMaterial } from './materials.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uSat: { value: 0.9 }, uContrast: { value: 1.08 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uVignette: { value: 0.35 }, uTime: { value: 0 }, uHurt: { value: 0 }, uGrain: { value: 0.025 }, uFogMask: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat, uContrast, uVignette, uTime, uHurt, uGrain, uFogMask; uniform vec3 uTint;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.18) * uContrast + 0.18;
      col *= uTint;
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.2;
      col *= v;
      // hurt / toxic vignette
      float edge = smoothstep(0.15, 0.55, length(d));
      col = mix(col, col * vec3(1.4, 0.25, 0.2), uHurt * edge);
      col = mix(col, col * vec3(0.75, 0.85, 0.55) + vec3(0.03, 0.04, 0.0), uFogMask * edge);
      col += (h(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 5000);
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 20);
    this.scene.fog = new THREE.FogExp2(0x9aa4a8, 0.004);

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x443322, 1.0);
    this.scene.add(this.hemi);
    // viewmodel lights
    this.vSun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.vHemi = new THREE.HemisphereLight(0x8899aa, 0x443322, 1.0);
    this.vPoint = new THREE.PointLight(0xffaa55, 0, 6, 1.2);
    this.vPoint.position.set(0.3, 0.2, 0.2);
    this.viewScene.add(this.vSun, this.vHemi, this.vPoint);

    // pooled point lights for lanterns/fires near the player
    this.points = [];
    for (let i = 0; i < 8; i++) {
      const p = new THREE.PointLight(0xffb060, 0, 18, 1.25);
      p.castShadow = false;
      this.scene.add(p);
      this.points.push(p);
    }

    this.sky = new Sky(this.scene);
    this.voxelMat = makeVoxelMaterial();
    this.waterMat = makeWaterMaterial();

    this.composer = new EffectComposer(this.renderer);
    this.rp = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.rp);
    this.vp = new RenderPass(this.viewScene, this.viewCamera);
    this.vp.clear = false; this.vp.clearDepth = true;
    this.composer.addPass(this.vp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.quality = 'high';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = q;
    const pr = Math.min(window.devicePixelRatio, q === 'low' ? 0.75 : q === 'medium' ? 1 : 1.5);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    this.bloom.enabled = q === 'high';
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h; this.viewCamera.updateProjectionMatrix();
    this.bloom.setSize(w / 2, h / 2);
  }

  // env: {hour, time, overcast, fogDensity, weatherDark, region tint}
  updateEnvironment(env) {
    const cam = this.camera;
    const S = this.sky.update(env.hour, env.time, cam.position, env.overcast);
    const night = S.night;
    // sun or moon as key light
    const useMoon = S.sunDir.y < 0.05;
    const dir = useMoon ? S.moonDir : S.sunDir;
    const k = useMoon ? 0.34 * (1 - env.overcast * 0.5) * Math.min(1, -S.sunDir.y * 6 + 0.25) : S.sunI;
    this.sun.color.copy(useMoon ? new THREE.Color(0.55, 0.65, 0.95) : S.sunCol);
    this.sun.intensity = k * 3.1;
    // snap shadow camera to texel grid to avoid shimmering
    const tgt = cam.position.clone();
    const snap = 140 / 2048;
    tgt.x = Math.round(tgt.x / snap) * snap; tgt.z = Math.round(tgt.z / snap) * snap; tgt.y = Math.round(tgt.y);
    this.sun.position.copy(tgt).addScaledVector(dir, 200);
    this.sun.target.position.copy(tgt);
    this.hemi.color.copy(S.ambSky); this.hemi.groundColor.copy(S.ambGround);
    this.hemi.intensity = (2.9 + night * 1.6) * (env.indoor ? 0.85 : 1);
    const fogC = S.fog.clone();
    if (env.fogTint) fogC.lerp(env.fogTint, env.fogTintAmt || 0);
    this.scene.fog.color.copy(fogC);
    this.scene.fog.density = env.fogDensity;
    this.sky.uniforms.uFogCol.value.copy(fogC);
    this.sky.uniforms.uAurora.value = env.aurora || 0;
    // shared uniforms
    U.time.value = env.time;
    U.emit.value = 0.15 + night * 0.95;
    U.wind.value = env.wind ?? 1;
    U.rain.value = env.rain ?? 0;
    U.sunDir.value.copy(S.sunDir);
    const wu = this.waterMat.uniforms;
    wu.uTime.value = env.time; wu.uSun.value.copy(dir); wu.uSunCol.value.copy(this.sun.color).multiplyScalar(k * 0.6);
    wu.uSky.value.copy(S.zen); wu.uHor.value.copy(fogC); wu.uNight.value = night; wu.uMurk.value = env.murk || 0;
    // viewmodel lighting mirrors world
    this.vSun.color.copy(this.sun.color); this.vSun.intensity = this.sun.intensity * 0.7;
    this.vSun.position.copy(dir).applyQuaternion(cam.quaternion.clone().invert()).multiplyScalar(5);
    this.vHemi.color.copy(S.ambSky); this.vHemi.groundColor.copy(S.ambGround); this.vHemi.intensity = this.hemi.intensity * (env.indoor ? 0.6 : 1);
    // grading
    const g = this.grade.uniforms;
    g.uTime.value = env.time;
    g.uSat.value = (env.saturation ?? 0.82) - night * 0.25;
    g.uTint.value.setRGB(1 - night * 0.18, 1 - night * 0.08, 1 + night * 0.08);
    g.uContrast.value = 1.06 + night * 0.05;
    this.renderer.toneMappingExposure = 1.0 + night * 0.35;
    return S;
  }

  render() { this.composer.render(); }
}
