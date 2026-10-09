// Entry point: boot, main loop, title flyover, pointer-lock handling.
import { Game } from './game/game.js';
import { SETTLE } from './world/layout.js';

const canvas = document.getElementById('c');
const game = new Game(canvas);
window.__game = game;
const params = new URLSearchParams(location.search);

let last = performance.now();
let titleT = 0;

function titleCamera(dt) {
  titleT += dt * 0.035;
  const P = game.player;
  const S = SETTLE.greywater;
  const cx = S.x + 10, cz = S.z - 5;
  const r = 95;
  const x = cx + Math.cos(titleT) * r, z = cz + Math.sin(titleT) * r;
  P.pos.set(x, S.ty + 34, z);
  const dx = cx - x, dz = cz - z;
  P.yaw = Math.atan2(-dx, -dz);
  P.pitch = -0.22;
  game.time.hour = 17.6 + Math.sin(titleT * 0.5) * 0.4;
  game.time.real += dt;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === 'title') {
    titleCamera(dt);
    game.fx && game.fx.update(dt);
    game.updateProps && game.updateProps(dt);
    game.render(dt);
  } else if (game.state === 'play') {
    game.update(dt);
    game.ui.update(dt);
    game.ui.updateDialogue(dt);
    game.audio.update(dt);
    game.render(dt);
  }
  game.input.endFrame();
  requestAnimationFrame(frame);
}

canvas.addEventListener('click', () => {
  if (game.state === 'play' && !game.ui.modal && !game.player.dead) game.input.lock();
  game.audio.start();
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && game.state === 'play' && !game.ui.modal && !game.player.dead && !game.ui.settings.touch) setTimeout(() => { if (!game.ui.modal && document.pointerLockElement !== canvas) game.ui.openPause(); }, 30);
});

(async () => {
  game.ui.loading(0, 'Charting the isle…');
  await game.load((p, m) => game.ui.loading(p, m));
  // warm up chunks around the title camera
  titleCamera(0);
  game.chunks.update(game.player.pos.x, game.player.pos.z, 1e9, true);
  game.ui.loading(1, '');
  if (params.get('auto')) {
    game.newGame();
    game.ui.startPlay();
    const tp = params.get('tp');
    if (tp) { const [x, z] = tp.split(',').map(Number); game.player.pos.set(x, game.world.groundY(x, z) + 1, z); }
    if (params.get('h')) game.time.hour = +params.get('h');
    if (params.get('yaw')) game.player.yaw = +params.get('yaw');
    if (params.get('pitch')) game.player.pitch = +params.get('pitch');
    if (params.get('w')) game.weather.set(params.get('w')), (game.weather.cur = { overcast: 0.9, rain: params.get('w') === 'rain' ? 0.8 : 0, fog: 1.4, wind: 1.5 });
    game.chunks.update(game.player.pos.x, game.player.pos.z, 1e9, true);
    const f = document.getElementById('fade'); f.style.transition = 'none'; f.style.opacity = 0; f.innerHTML = '';
  } else if (location.hash === '#continue' && game.hasSave()) {
    location.hash = '';
    if (game.loadSave()) game.ui.startPlay(); else game.ui.titleScreen();
  } else game.ui.titleScreen();
  let n = 0;
  const ready = () => { if (++n > 4) window.__ready = true; else requestAnimationFrame(ready); };
  requestAnimationFrame(ready);
  requestAnimationFrame(frame);
})().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;top:0;left:0;color:#f88;z-index:9;white-space:pre-wrap;padding:10px">${e.stack || e}</pre>`); });
