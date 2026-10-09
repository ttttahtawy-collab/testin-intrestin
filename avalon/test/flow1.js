(() => {
  const g = __game, log = [];
  const step = (n = 60) => { for (let i = 0; i < n; i++) { g.update(1 / 60); g.ui.update(1 / 60); g.ui.updateDialogue(1 / 60); g.input.endFrame(); } };
  const talk = (id, choices) => {
    const a = g.npcs.byId(id);
    g.player.pos.set(a.pos.x - 2, a.pos.y + 0.5, a.pos.z);
    g.startDialogue(a);
    for (const c of choices) { step(400); log.push(id + ': ' + (g.ui.dlg && g.ui.dlg.full || '').slice(0, 50)); g.ui.dlgChoose(c); }
    step(30);
    if (g.ui.modal) g.ui.closeModal(false);
  };
  const st = () => JSON.stringify(Object.fromEntries(Object.entries(g.quests.state).map(([k, v]) => [k, v.stage + (v.done ? '✓' : '')])));
  talk('maeve', [0, 0, 0, 0]);
  log.push('after maeve: ' + st());
  const c = g.world.meta.containers.find((c) => c.id === 'tents.chest');
  g.interact({ kind: 'container', obj: c, label: 'Chest' });
  g.ui.lootTakeAll();
  step(5);
  log.push('after chest: ' + st() + ' inv=' + g.inventory.items.map((s) => s.id).join(','));
  g.equipItem('sword_rusty'); g.equipItem('tunic_tattered');
  step(5);
  log.push('after equip: ' + st());
  g.inventory.add('yarrow', 3);
  step(5);
  log.push('after yarrow: ' + st());
  talk('maeve', [0]);
  log.push('after return: ' + st());
  const r = (g.ui && null);
  g.craft({ out: 'poultice', n: 1, needs: { yarrow: 2, linen: 1 } });
  step(5);
  log.push('after craft: ' + st());
  talk('maeve', [0]);
  talk('bram', [0]);
  log.push('after bram: ' + st());
  talk('wynn', [0, 0]);
  log.push('after wynn: ' + st());
  // combat test: spawn a wolf and a bandit
  const { x, y, z } = g.player.pos;
  const A = g.actors[0].constructor;
  const wolf = new A(g, { type: 'wolf', x: x + 6, y: y + 1, z });
  const ban = new A(g, { type: 'bandit', x: x - 6, y: y + 1, z });
  g.actors.push(wolf, ban);
  g.player.hp = 9999;
  for (let i = 0; i < 40; i++) {
    const t = i % 2 ? wolf : ban;
    if (!t.alive) continue;
    g.player.yaw = Math.atan2(-(t.pos.x - g.player.pos.x), -(t.pos.z - g.player.pos.z));
    if (!g.player.atk) g.player.startAttack(i % 5 === 0);
    step(25);
  }
  log.push(`wolf alive=${wolf.alive} hp=${wolf.hp} state=${wolf.state}; bandit alive=${ban.alive} hp=${ban.hp} state=${ban.state}; player hp=${g.player.hp|0} xp=${g.player.xp} lvl=${g.player.level}`);
  g.ui.toggleBook('path'); step(2); g.ui.toggleBook('bearer'); step(2); g.ui.toggleBook('map'); step(2); g.ui.closeModal(false);
  g.ui.openCampfire(g.world.meta.campfires[0]); step(2); g.ui.closeModal(false);
  g.rest(3, 'test'); step(120);
  log.push('time ' + g.time.hour.toFixed(2) + ' day ' + g.time.day);
  g.save(); log.push('saved ' + g.hasSave());
  return log;
})()
