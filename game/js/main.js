// Boot + fixed-timestep main loop (60 Hz simulation, render every frame).
(function (G) {
  'use strict';
  const STEP = 1 / 60;
  let acc = 0, last = 0;

  function boot() {
    const canvas = document.getElementById('game');
    G.Save.load();
    G.R.init(canvas);
    G.Input.init(canvas);
    G.Audio.init();
    G.Input.layoutTouch(G.R.W, G.R.H);
    const start = () => {
      const boot = document.getElementById('boot');
      if (boot) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 500); }
      // debug/test hook: ?level=1-2 jumps straight into a level with a temp save
      const q = new URLSearchParams(location.search);
      if (q.get('level') && G.Worlds.levels[q.get('level')]) {
        G.Save.slot = -1;
        G.Save.data = G.Save.fresh();
        G.Save.data.upgrades.dash = q.get('dash') === '1';
        G.Scenes.go('play', { id: q.get('level') }, { instant: true });
      } else G.Scenes.go('title', {}, { instant: true });
      requestAnimationFrame(frame);
    };
    // wait (briefly) for the web font so menus render with it
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load('700 20px Fredoka'), new Promise((r) => setTimeout(r, 1500))]).then(start, start);
    } else start();
  }

  function frame(t) {
    const now = t / 1000;
    let dt = last ? now - last : STEP;
    last = now;
    if (dt > 0.1) dt = 0.1; // tab was hidden / long hitch: don't spiral
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      G.Input.update();
      G.Scenes.update(STEP);
      if (G.Save.data && G.Save.slot >= 0) G.Save.data.playTime += STEP;
      acc -= STEP;
      steps++;
    }
    if (steps >= 6) acc = 0;
    G.R.begin();
    G.Scenes.render(G.R.ctx);
    G.R.end();
    requestAnimationFrame(frame);
  }

  // Persist on tab close/hide.
  window.addEventListener('pagehide', () => { if (G.Save.slot >= 0) G.Save.persist(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.Save.slot >= 0) G.Save.persist(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.G);
