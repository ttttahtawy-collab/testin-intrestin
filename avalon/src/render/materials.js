import * as THREE from 'three';

export const U = {
  time: { value: 0 },
  wind: { value: 1 },
  emit: { value: 0.3 },
  sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  sunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  skyColor: { value: new THREE.Color(0.5, 0.6, 0.7) },
  horizon: { value: new THREE.Color(0.7, 0.75, 0.8) },
  rain: { value: 0 },
};

export function makeVoxelMaterial(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uWind = U.wind;
    sh.uniforms.uEmit = U.emit;
    sh.uniforms.uRain = U.rain;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aFlags; uniform float uTime; uniform float uWind;
        varying float vEmit; varying float vSky; varying vec3 vWPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEmit = aFlags.x * 2.55; vSky = aFlags.z;
        vec4 wpS = modelMatrix * vec4(transformed, 1.0);
        float sw = aFlags.y;
        if (sw > 0.0) {
          float ph = wpS.x * 0.31 + wpS.z * 0.23;
          transformed.x += (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 3.7 + ph * 2.1) * 0.25) * 0.09 * sw * uWind;
          transformed.z += cos(uTime * 1.25 + ph * 1.3) * 0.06 * sw * uWind;
        }
        vWPos = wpS.xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uEmit; uniform float uRain; uniform float uTime; varying float vEmit; varying float vSky; varying vec3 vWPos;`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        irradiance *= (0.22 + 0.78 * vSky);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * vEmit * uEmit;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, 0.72, uRain * vSky);`);
  };
  mat.customProgramCacheKey = () => 'voxel';
  return mat;
}

export function makeWaterMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uSky: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uDeep: { value: new THREE.Color(0x0f2a30) },
    uShallow: { value: new THREE.Color(0x2e5a58) }, uNight: { value: 0 }, uMurk: { value: 0 },
  }]);
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec4 color;
      varying vec3 vW; varying float vDepth; varying float vSide; varying vec3 vN;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vDepth = color.r; vSide = color.g; vN = normal;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uHor;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform float uNight; uniform float uMurk;
      varying vec3 vW; varying float vDepth; varying float vSide; varying vec3 vN;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        vec3 col;
        if (vSide > 0.5) {
          // falling water
          float s = n(vec2(vW.x + vW.z, vW.y * 0.6 + uTime * 6.0) * 1.5);
          col = mix(uShallow * 1.3, vec3(0.85, 0.9, 0.95), smoothstep(0.55, 0.9, s));
          gl_FragColor = vec4(col * (0.4 + 0.6 * (1.0 - uNight)), 0.85);
        } else {
          vec2 p = vW.xz * 0.35;
          float e = 0.15;
          float t = uTime * 0.6;
          float a = n(p + vec2(t, t * 0.7)) + n(p * 2.1 - vec2(t * 0.8, -t)) * 0.5;
          float bx = n(p + vec2(e, 0) + vec2(t, t * 0.7)) + n((p + vec2(e, 0)) * 2.1 - vec2(t * 0.8, -t)) * 0.5;
          float bz = n(p + vec2(0, e) + vec2(t, t * 0.7)) + n((p + vec2(0, e)) * 2.1 - vec2(t * 0.8, -t)) * 0.5;
          vec3 N = normalize(vec3((a - bx) * 1.2, 1.0, (a - bz) * 1.2));
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 base = mix(uShallow, uDeep, clamp(vDepth, 0.0, 1.0));
          base = mix(base, vec3(0.16, 0.15, 0.1), uMurk);
          vec3 refl = mix(uHor, uSky, clamp(reflect(-V, N).y * 2.0, 0.0, 1.0));
          col = mix(base * (0.35 + 0.65 * (1.0 - uNight)), refl, fres * 0.7);
          vec3 Hh = normalize(uSun + V);
          float spec = pow(max(dot(N, Hh), 0.0), 120.0) * step(0.0, uSun.y);
          col += uSunCol * spec * 1.6;
          float alpha = mix(0.72, 0.95, clamp(vDepth, 0.0, 1.0));
          alpha = max(alpha, fres);
          gl_FragColor = vec4(col, alpha);
        }
        #include <fog_fragment>
      }`,
  });
  return mat;
}
