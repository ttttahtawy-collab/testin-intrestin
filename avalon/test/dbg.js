(() => {
  const g = __game, P = g.player;
  const step = (n = 60) => { for (let i = 0; i < n; i++) { g.update(1 / 60); g.input.endFrame(); } };
  g.quests.setStage('mq_greywater', 'osric');
  const s = g.world.meta.spots['osric'];
  P.pos.set(s.x + 1, s.y + 0.5, s.z + 1); g.chunks.update(P.pos.x, P.pos.z, 1e9, true); step(120);
  const sp = g.spawner.spawns.filter((x) => x.group === 'osric');
  return { spot: s, spawns: sp.map((x) => ({ t: x.type, active: x.active, n: x.actors.length, d: Math.hypot(x.x - P.pos.x, x.z - P.pos.z) })), osric: g.actors.filter((a) => a.unique === 'osric').map((a) => [a.pos.x, a.pos.y, a.pos.z, a.alive, a.dist2D(P.pos)]), state: g.state, modal: g.ui.modal, stage: g.quests.stageOf('mq_greywater'), flags: g.flags };
})()
