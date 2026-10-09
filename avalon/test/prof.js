(() => {
  const g = __game, P = g.player;
  const x = 1490, z = 660; g.flags.cd_pass = true;
  P.pos.set(x, g.world.height[z * 2048 + x] + 1.5, z);
  g.chunks.update(x, z, 1e9, true);
  for (let i = 0; i < 240; i++) g.update(1 / 60);
  const T = {};
  const wrap = (obj, name, label) => { const f = obj[name].bind(obj); obj[name] = (...a) => { const t = performance.now(); const r = f(...a); T[label] = (T[label] || 0) + performance.now() - t; return r; }; };
  wrap(g, 'findInteraction', 'interact');
  wrap(g.player, 'update', 'player');
  wrap(g.combat, 'update', 'combat');
  wrap(g.spawner, 'update', 'spawner');
  wrap(g.fx, 'update', 'fx');
  wrap(g, 'scripts', 'scripts');
  wrap(g, 'updateProps', 'props');
  for (const a of g.actors) wrap(a, 'update', 'actor:' + (a.npc ? 'npc' : a.type));
  const fp = g.actors[0].constructor.prototype; const og = fp.goTo; let pc = 0; fp.goTo = function(...a){ const t=performance.now(); const r=og.apply(this,a); T.goTo=(T.goTo||0)+performance.now()-t; return r; };
  const t0 = performance.now();
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  T.total = performance.now() - t0;
  for (const k in T) T[k] = +(T[k] / 30).toFixed(2);
  return T;
})()
