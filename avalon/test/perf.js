(() => {
  const g = __game, P = g.player;
  const out = {};
  for (const [name, x, z] of [['greywater', 610, 1500], ['caerdawn', 1490, 660], ['weald', 520, 1000], ['open', 1000, 1100]]) {
    g.flags.cd_pass = true;
    P.pos.set(x, g.world.height[z * 2048 + x] + 1.5, z);
    g.chunks.update(x, z, 1e9, true);
    for (let i = 0; i < 3; i++) g.render(1 / 60);
    let verts = 0, meshes = 0, lodv = 0;
    g.chunks.group.traverse((o) => { if (o.isMesh && o.visible) { meshes++; verts += o.geometry.attributes.position.count; } });
    const t0 = performance.now(); for (let i = 0; i < 10; i++) g.update(1 / 60); const tu = (performance.now() - t0) / 10;
    const t1 = performance.now(); let n = 0; for (const [cx, cz] of [[x >> 5, z >> 5]]) { g.chunks.rebuildNear(cx, cz); n++; } const tm = performance.now() - t1;
    out[name] = { meshes, verts, near: g.chunks.near.size, actors: g.actors.length, updMs: tu.toFixed(2), meshMs: tm.toFixed(1), cache: g.world.cache.size };
  }
  return out;
})()
