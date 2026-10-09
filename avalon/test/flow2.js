(() => {
  const g = __game, log = [];
  try {
  const P = g.player;
  P.hp = 1e6; P.maxHpOverride = true;
  const step = (n = 60) => { for (let i = 0; i < n; i++) { g.update(1 / 60); g.ui.update(1 / 60); g.ui.updateDialogue(1 / 60); g.input.endFrame(); } };
  const tpSpot = (name) => { const s = g.world.meta.spots[name]; if (!s) { log.push('NO SPOT ' + name); return; } P.pos.set(s.x + 1, s.y + 0.5, s.z + 1); g.chunks.update(P.pos.x, P.pos.z, 1e9, true); step(90); };
  const talk = (id, choices) => {
    const a = g.npcs.byId(id);
    if (!a) { log.push('NO NPC ' + id); return; }
    if (a.dist2D(P.pos) > 4) { P.pos.set(a.pos.x - 2, a.pos.y + 0.5, a.pos.z); }
    g.startDialogue(a);
    for (const c of choices) { step(500); g.ui.dlgChoose(c); }
    step(20);
    if (g.ui.modal === 'dialogue') g.ui.closeModal(false);
  };
  const killAll = (pred) => { let n = 0; for (const a of [...g.actors]) if (a.alive && pred(a)) { a.takeDamage(1e6, P, {}); n++; } step(10); return n; };
  const st = () => Object.entries(g.quests.state).filter(([k]) => k.startsWith('mq')).map(([k, v]) => k.slice(3, 7) + ':' + v.stage + (v.done ? '✓' : '')).filter((x) => !x.includes('✓')).join(' ');
  // fast-forward tents
  g.quests.setStage('mq_tents', 'bram'); talk('bram', [0]);
  talk('wynn', [0, 0, 0]); log.push('1 ' + st());
  tpSpot('cart.wreck'); log.push('2 ' + st());
  talk('garrick', [1, 0]); log.push('3 ' + st());
  P.gold = 500;
  tpSpot('osric'); step(60);
  log.push('osric dialogue: ' + (g.ui.modal) + ' ' + (g.ui.dlg && g.ui.dlg.full || '').slice(0, 40));
  step(500); g.ui.dlgChoose(1); step(500); g.ui.dlgChoose(0); step(500); g.ui.dlgChoose(0); step(200);
  log.push('4 ' + st() + ' letter=' + g.inventory.has('osric_letter'));
  talk('wynn', [0, 0]); log.push('5 ' + st());
  talk('ysolde', [0, 0, 0]); log.push('6 ' + st());
  tpSpot('deserter.camp'); step(120);
  log.push('deserters killed ' + killAll((a) => a.group === 'deserter_camp'));
  log.push('7 ' + st());
  talk('ysolde', [0]); log.push('8 ' + st() + ' pass=' + g.flags.cd_pass);
  talk('harlan', [0, 0, 0]); log.push('9 ' + st());
  tpSpot('kingsfall.gate'); log.push('10 ' + st());
  tpSpot('kingsfall.vault'); step(60);
  log.push('malric killed ' + killAll((a) => a.unique === 'malric'));
  log.push('11 ' + st());
  const corv = g.npcs.byId('corvin'); log.push('corvin hidden=' + corv.hidden + ' at ' + corv.pos.x.toFixed(0) + ',' + corv.pos.y.toFixed(0) + ',' + corv.pos.z.toFixed(0));
  talk('corvin', [0, 0, 0, 0]); log.push('12 ' + st());
  const desk = g.world.meta.containers.find((c) => c.id === 'kingsfall.desk');
  g.interact({ kind: 'container', obj: desk, label: 'Desk' }); g.ui.lootTakeAll(); step(5);
  log.push('13 ' + st());
  P.pos.set(610, 50, 1500); step(30);
  talk('corvin', [0]); log.push('14 ' + st());
  talk('nessa', [0, 0]); g.inventory.add('comfrey', 3); g.inventory.add('linen', 2); talk('nessa', [0, 0]); log.push('15 ' + st() + ' mask=' + g.inventory.has('fog_mask'));
  tpSpot('mire.heart'); step(60); log.push('gorm killed ' + killAll((a) => a.unique === 'gorm')); g.inventory.add('bitterroot', 3); step(5);
  log.push('16 ' + st());
  tpSpot('mine.front'); tpSpot('meadow.center'); g.inventory.add('sunpetal', 3); step(30);
  log.push('17 ' + st()); log.push('grim killed ' + killAll((a) => a.unique === 'grimtooth')); step(10);
  log.push('18 ' + st());
  P.pos.set(610, 50, 1500); step(30);
  g.inventory.add('sunpetal', 3); talk('maeve', [0]); log.push('19 ' + st());
  g.advanceTime(14); if (g.time.hour < 7) g.advanceTime(8); g.checkDraughtTimer(); step(10);
  log.push('20 ' + st() + ' ready=' + g.flags.draught_ready + ' h=' + g.time.hour.toFixed(1));
  talk('maeve', [0]); log.push('21 ' + st());
  talk('ysolde', [0, 0]); log.push('22 ' + st());
  talk('harlan', [0, 0, 0, 0]); log.push('23 ' + st() + ' arrested=' + g.flags.harlan_arrested);
  } catch (e) { log.push('ERR ' + e.message + ' ' + e.stack.slice(0, 500)); }
  log.push(JSON.stringify({pos:[g.player.pos.x,g.player.pos.y,g.player.pos.z], fade: document.getElementById('fade').style.opacity, modal: g.ui.modal, death: document.getElementById('death').style.opacity, dead:g.player.dead, hp:g.player.hp}));
  return log;
})()
