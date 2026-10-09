(() => {
  const g = __game, P = g.player;
  P.pos.set(610, 46, 1500); g.chunks.update(610, 1500, 1e9, true);
  const out = [];
  for (const hour of [9, 13, 23]) {
    g.time.hour = hour; g.flagVersion++;
    for (let i = 0; i < 60 * 40; i++) g.update(1 / 60);
    const bad = [];
    for (const a of g.npcs.list) {
      if (a.hidden || a.npc.settlement !== 'greywater') continue;
      const t = g.npcs.currentTask(a);
      if (!t || !t.spotPos) continue;
      const d = Math.hypot(a.pos.x - t.spotPos.x, a.pos.z - t.spotPos.z);
      if (d > (t.act === 'wander' ? (t.r || 8) + 4 : 3)) bad.push(`${a.name}:${t.key}:${d.toFixed(0)}`);
    }
    out.push(hour + 'h stuck=' + bad.length + ' ' + bad.join(' | '));
  }
  // save/load
  g.inventory.add('gem', 2); P.gold = 321; g.flags.testflag = true;
  g.save();
  P.gold = 0; g.inventory.remove('gem', 2);
  g.loadSave();
  out.push('load gold=' + P.gold + ' gems=' + g.inventory.count('gem') + ' flag=' + g.flags.testflag + ' quest=' + g.quests.stageOf('mq_tents'));
  return out;
})()
