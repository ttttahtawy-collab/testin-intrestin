// Sky dome with sun, moon, stars and aurora; time-of-day palette.
import * as THREE from 'three';

const KEYS = [
  // hour, zenith, horizon, sun color, sun intensity, ambient sky, ambient ground, fog
  [0, 0x05080f, 0x0e1522, 0x8090c0, 0.0, 0x2e3a56, 0x15161a, 0x0e141e],
  [4.5, 0x0a0e1c, 0x1c2030, 0x8090c0, 0.0, 0x323c58, 0x17181c, 0x161a26],
  [5.8, 0x2a3454, 0x9a6a5a, 0xff9a60, 0.4, 0x5a6078, 0x3a3430, 0x6a5a5a],
  [7.0, 0x4a6a98, 0xd8a880, 0xffc890, 1.0, 0x8090a8, 0x4e4838, 0xa8a4a0],
  [9.0, 0x5582b8, 0xb0c0cc, 0xfff0d8, 1.5, 0x8ea4bc, 0x5a5444, 0xb4bec4],
  [13.0, 0x4f7cb4, 0xbccad4, 0xfff4e4, 1.65, 0x94a8c0, 0x5e5848, 0xbcc6cc],
  [17.0, 0x4a6ea4, 0xd0bc98, 0xffe0b0, 1.35, 0x909eb2, 0x5a5040, 0xb8b4a8],
  [18.8, 0x34406c, 0xd0784a, 0xff8a4a, 0.75, 0x7a7488, 0x4a3e38, 0x8a6a5a],
  [20.0, 0x141a30, 0x3a3048, 0xa07070, 0.05, 0x3e425c, 0x1c1a20, 0x262636],
  [21.5, 0x06090f, 0x101622, 0x8090c0, 0.0, 0x2e3a56, 0x15161a, 0x10141e],
  [24, 0x05080f, 0x0e1522, 0x8090c0, 0.0, 0x2e3a56, 0x15161a, 0x0e141e],
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpHex(a, b, t, out) { tmpA.setHex(a); tmpB.setHex(b); return out.copy(tmpA).lerp(tmpB, t); }

export class Sky {
  constructor(scene) {
    this.uniforms = {
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3() },
      uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 },
      uCloud: { value: 0 }, uAurora: { value: 0.0 }, uFogCol: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uZen, uHor, uSun, uMoon, uSunCol, uFogCol; uniform float uNight, uTime, uCloud, uAurora;
        varying vec3 vDir;
        float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float a=h3(vec3(i,1.)), b=h3(vec3(i+vec2(1,0),1.)), c=h3(vec3(i+vec2(0,1),1.)), d=h3(vec3(i+vec2(1,1),1.)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
        void main(){
          vec3 d = normalize(vDir);
          float y = d.y;
          float t = pow(clamp(y, 0.0, 1.0), 0.45);
          vec3 col = mix(uHor, uZen, t);
          // below horizon fades into fog
          col = mix(col, uFogCol, smoothstep(0.05, -0.15, y));
          // sun
          float sd = max(dot(d, normalize(uSun)), 0.0);
          col += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.25 + pow(sd, 3.0) * 0.08) * (1.0 - uCloud * 0.7);
          // moon
          float md = max(dot(d, normalize(uMoon)), 0.0);
          col += vec3(0.85, 0.88, 0.95) * (smoothstep(0.9993, 0.9996, md) * 1.4 + pow(md, 60.0) * 0.15) * uNight;
          // stars
          if (uNight > 0.01 && y > 0.0) {
            vec3 p = d * 260.0;
            vec3 c = floor(p);
            float s = h3(c);
            if (s > 0.9975) {
              vec3 f = fract(p) - 0.5;
              float tw = 0.6 + 0.4 * sin(uTime * 3.0 + s * 100.0);
              col += vec3(1.0, 0.95, 0.85) * smoothstep(0.35, 0.0, length(f)) * tw * uNight * (1.0 - uCloud) * smoothstep(0.0, 0.25, y);
            }
          }
          // aurora (natural northern lights)
          if (uAurora > 0.01 && y > 0.05) {
            vec2 q = d.xz / (y + 0.25);
            float band = n2(vec2(q.x * 1.5 + uTime * 0.03, q.y * 0.4)) ;
            float curtain = smoothstep(0.35, 0.8, band) * smoothstep(0.05, 0.3, y) * smoothstep(0.9, 0.4, y);
            float north = smoothstep(0.2, -0.6, d.z);
            col += vec3(0.15, 0.85, 0.5) * curtain * north * uAurora * uNight * 0.55 * (1.0 - uCloud);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
    this.state = {
      zen: new THREE.Color(), hor: new THREE.Color(), sunCol: new THREE.Color(), sunI: 0,
      ambSky: new THREE.Color(), ambGround: new THREE.Color(), fog: new THREE.Color(),
      sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), night: 0,
    };
  }

  // hour 0..24
  update(hour, time, camPos, overcast = 0) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (hour - a[0]) / (b[0] - a[0]);
    const S = this.state;
    lerpHex(a[1], b[1], t, S.zen); lerpHex(a[2], b[2], t, S.hor); lerpHex(a[3], b[3], t, S.sunCol);
    S.sunI = a[4] + (b[4] - a[4]) * t;
    lerpHex(a[5], b[5], t, S.ambSky); lerpHex(a[6], b[6], t, S.ambGround); lerpHex(a[7], b[7], t, S.fog);
    // overcast desaturates
    if (overcast > 0) {
      const g = (c, k) => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; c.lerp(tmpA.setRGB(l, l, l), k); };
      g(S.zen, overcast * 0.75); g(S.hor, overcast * 0.6); g(S.fog, overcast * 0.6);
      S.zen.multiplyScalar(1 - overcast * 0.35); S.hor.multiplyScalar(1 - overcast * 0.2);
      S.sunI *= 1 - overcast * 0.7;
    }
    // sun path: rises east (+x) at 6, sets west at 18, tilted south
    const ang = ((hour - 6) / 12) * Math.PI;
    S.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    S.moonDir.set(-Math.cos(ang), -Math.sin(ang), -0.25).normalize();
    S.night = THREE.MathUtils.clamp(1 - (S.sunDir.y + 0.15) / 0.35, 0, 1);
    const u = this.uniforms;
    u.uZen.value.copy(S.zen); u.uHor.value.copy(S.hor); u.uSun.value.copy(S.sunDir); u.uMoon.value.copy(S.moonDir);
    u.uSunCol.value.copy(S.sunCol); u.uNight.value = S.night; u.uTime.value = time; u.uCloud.value = overcast;
    u.uFogCol.value.copy(S.fog);
    this.mesh.position.copy(camPos);
    return S;
  }
}
