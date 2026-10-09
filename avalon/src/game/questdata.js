// Quest definitions for Chapter One: "The Withering".

export const QUESTS = {
  // ================= MAIN =================
  mq_tents: {
    name: 'Washed Ashore', main: true, chapter: 'I · The Sick-Tents',
    reward: { xp: 90, items: [['bandage', 2]] },
    stages: {
      wake: { text: 'Speak with Maeve, the healer tending the sick-tents.', target: 'npc:maeve' },
      gear: { text: 'Take your belongings from the supply chest by the fence.', target: 'q.chest', obj: { type: 'flag', flag: 'loot_tents.chest' }, next: 'equip' },
      equip: { text: 'Open your satchel [Tab] and take the sword in hand. Wear the tunic.', obj: { type: 'flag', flag: 'armed' }, next: 'herbs', target: 'npc:maeve' },
      herbs: { text: 'Gather 3 yarrow — white wound-wort flowers — growing past the east gate of the tents.', target: 'q.herbs', obj: { type: 'item', id: 'yarrow', n: 3 }, next: 'return' },
      return: { text: 'Bring the yarrow back to Maeve.', target: 'npc:maeve' },
      craft: { text: 'Prepare a Herbal Poultice at the campfire [E] — two yarrow and a scrap of linen.', target: 'q.fire', obj: { type: 'item', id: 'poultice', n: 1 }, next: 'show' },
      show: { text: 'Show Maeve the poultice.', target: 'npc:maeve' },
      bram: { text: 'Tell Old Bram at the gate that Maeve has cleared you.', target: 'npc:bram' },
    },
    onComplete: (g) => g.quests.start('mq_greywater'),
  },
  mq_greywater: {
    name: 'Grey Skies over Greywater', main: true, chapter: 'I · Greywater Hollow',
    reward: { xp: 260, gold: 40 },
    stages: {
      elder: { text: 'Present yourself to Elder Wynn in Greywater Hollow.', target: 'npc:wynn' },
      cart: { text: 'Search the Kingsway north of the village for the missing herb-cart.', target: 'cart.wreck', obj: { type: 'reach', spot: 'cart.wreck' }, next: 'tracks' },
      tracks: { text: "Cart tracks lead west into the Weald. Ask at the Hunter's Lodge.", target: 'npc:garrick', onEnter: (g) => { g.inventory.add('cart_wheel', 1); g.ui.toast('Deep wheel ruts and boot prints lead west, toward the Weald.', 4); } },
      osric: { text: "Find the bandit chief Red Osric at his camp, Osric's Hollow.", target: 'osric', obj: { type: 'item', id: 'osric_letter', n: 1 }, next: 'report' },
      report: { text: "Bring Osric's orders to Elder Wynn.", target: 'npc:wynn' },
    },
    onComplete: (g) => g.quests.start('mq_gates'),
  },
  mq_gates: {
    name: 'The Gates of Caer Dawn', main: true, chapter: 'II · Caer Dawn',
    reward: { xp: 260, gold: 50 },
    stages: {
      travel: { text: 'Take the East Road to Caer Dawn and seek entry at the south gate.', target: 'npc:ysolde' },
      deserters: { text: "Clear the Deserters' Camp on the East Road.", target: 'deserter.camp', obj: { type: 'kill', tag: 'deserter_camp', n: 3, label: 'Deserters' }, next: 'ysolde' },
      ysolde: { text: 'Return to Captain Ysolde at the south gate.', target: 'npc:ysolde' },
      steward: { text: 'Seek an audience with Steward Harlan in the great hall.', target: 'npc:harlan' },
    },
    onComplete: (g) => g.quests.start('mq_kingsfall'),
  },
  mq_kingsfall: {
    name: 'The Fallen Seat', main: true, chapter: 'II · Kingsfall',
    reward: { xp: 420 },
    stages: {
      go: { text: 'Search the ruins of Kingsfall for the royal physician, Corvin.', target: 'kingsfall.gate', obj: { type: 'reach', spot: 'kingsfall.gate' }, next: 'dungeon' },
      dungeon: { text: 'Find a way down beneath the ruined keep.', target: 'kingsfall.stairs', obj: { type: 'reach', spot: 'kingsfall.vault' }, next: 'malric' },
      malric: { text: 'Defeat Ser Malric the Oathless.', target: (g) => { const a = g.actors.find((x) => x.unique === 'malric' && x.alive); return a ? { x: a.pos.x, y: a.pos.y, z: a.pos.z } : null; }, obj: { type: 'kill', tag: 'malric', n: 1 }, next: 'corvin' },
      corvin: { text: 'Free Physician Corvin from his cell.', target: 'npc:corvin' },
      journal: { text: "Recover Corvin's journal from the archive desk.", target: 'kingsfall.archive', obj: { type: 'item', id: 'journal', n: 1 }, next: 'report' },
      report: { text: 'Meet Corvin and Maeve at the healer\'s house in Greywater.', target: 'npc:corvin' },
    },
    onComplete: (g) => { g.quests.start('mq_mire'); g.quests.start('mq_peak'); },
  },
  mq_mire: {
    name: 'Into the Mirefen', main: true, chapter: 'III · Root and Petal',
    reward: { xp: 450 },
    stages: {
      stillwater: { text: 'Travel to Stillwater, the fen village, and find the mask-maker Nessa.', target: 'npc:nessa' },
      mask: { text: 'Bring Nessa 3 comfrey and 2 linen scraps — or pay her 80 crowns — for a fen-mask.', target: 'npc:nessa' },
      heart: { text: 'Use a Fog-Mask Filter and push through the fog to the Heart of the Mire.', target: 'mire.heart', obj: { type: 'reach', spot: 'mire.heart' }, next: 'gorm' },
      gorm: { text: 'Defeat Gorm the Mire-King.', target: 'mire.heart', obj: { type: 'kill', tag: 'gorm', n: 1 }, next: 'roots' },
      roots: { text: 'Dig up 3 Bitterroot — purple-leafed plants around the Heart.', target: 'mire.heart', obj: { type: 'item', id: 'bitterroot', n: 3 }, next: 'complete' },
    },
    onComplete: (g) => g.checkDraught(),
  },
  mq_peak: {
    name: 'Above the Snowline', main: true, chapter: 'III · Root and Petal',
    reward: { xp: 450 },
    stages: {
      mine: { text: 'Take the Mountain Road north from Caer Dawn to Ironhollow.', target: 'mine.front', obj: { type: 'reach', spot: 'mine.front' }, next: 'meadow' },
      meadow: { text: 'Climb the High Pass to Sunpetal Meadow, above the snowline.', target: 'meadow.center', obj: { type: 'reach', spot: 'meadow.center' }, next: 'petals' },
      petals: { text: 'Gather 3 golden Sunpetal blooms.', target: 'meadow.center', obj: { type: 'item', id: 'sunpetal', n: 3 }, next: 'grimtooth', onEnter: (g) => g.scriptGrimtooth() },
      grimtooth: { text: 'Grimtooth guards the meadow. Kill the great bear — or outrun it down the pass.', target: (g) => { const a = g.actors.find((x) => x.unique === 'grimtooth' && x.alive); return a ? { x: a.pos.x, y: a.pos.y, z: a.pos.z } : null; }, obj: { type: 'flag', flag: 'grimtooth_done' }, next: 'complete' },
    },
    onComplete: (g) => g.checkDraught(),
  },
  mq_draught: {
    name: 'The Grey Draught', main: true, chapter: 'IV · The Grey Draught',
    reward: { xp: 650 },
    stages: {
      brew: { text: 'Bring the Sunpetal and Bitterroot to Maeve and Corvin in Greywater.', target: 'npc:maeve' },
      wait: { text: 'The Draught must steep overnight. Rest at a fire, then return to Maeve.', target: 'npc:maeve', obj: { type: 'flag', flag: 'draught_ready' }, next: 'cure' },
      cure: { text: 'Speak with Maeve — the Draught is ready.', target: 'npc:maeve' },
      choice: { text: 'Decide the Draught\'s fate: bring it to Captain Ysolde, or to Steward Harlan.', target: 'npc:ysolde' },
      confront: { text: 'Confront Steward Harlan in the great hall, with Captain Ysolde at your side.', target: 'npc:harlan' },
    },
    onComplete: (g) => g.endChapter(),
  },

  // ================= SIDE =================
  sq_wolves: {
    name: 'Wolves at the Watchtower', reward: { xp: 120, gold: 35, items: [['axe_wood', 1], ['bread', 2]] },
    stages: {
      hunt: { text: 'Kill the wolves denning by the old watchtower, north of Greywater.', target: 'watchtower', obj: { type: 'kill', tag: 'millwolves', n: 3, label: 'Wolves' }, next: 'back' },
      back: { text: 'Tell Edda at the farm the wolves are dead.', target: 'npc:edda' },
    },
  },
  sq_iron: {
    name: 'Iron for the Forge', reward: { xp: 130 },
    stages: {
      ore: { text: 'Bring Haldor the smith 4 iron ore. Ironhollow mine lies north of Caer Dawn.', target: 'mine.front', obj: { type: 'item', id: 'iron_ore', n: 4 }, next: 'back' },
      back: { text: 'Bring the ore to Haldor in Greywater.', target: 'npc:haldor' },
    },
  },
  sq_ring: {
    name: 'A Ring in the Mere', reward: { xp: 90 },
    stages: {
      find: { text: "Search the shore of Greywater Mere near the jetty for Tamsin's ring.", target: 'ring.spot', obj: { type: 'item', id: 'lost_ring', n: 1 }, next: 'back' },
      back: { text: 'Return the ring to Tamsin — or keep it.', target: 'npc:tamsin' },
    },
  },
  sq_pip: {
    name: 'Lost in the Weald', reward: { xp: 180, items: [['belt_herbalist', 1]] },
    stages: {
      find: { text: 'Pip chased a fox into the Weald. Search the Hollow Oak Cave, west of the lodge.', target: 'cave.mouth', obj: { type: 'reach', spot: 'cave.end' }, next: 'talk' },
      talk: { text: 'Find Pip in the cave and make sure he is safe.', target: 'npc:pip' },
      back: { text: 'Tell Rowena her son is coming home.', target: 'npc:rowena' },
    },
  },
  sq_pelts: {
    name: "The Hunter's Due", reward: { xp: 120, items: [['spear_hunter', 1], ['arrow', 20]] },
    stages: {
      pelts: { text: 'Bring Garrick 3 wolf pelts.', target: 'npc:garrick', obj: { type: 'item', id: 'wolf_pelt', n: 3 }, next: 'back' },
      back: { text: 'Bring the pelts to Garrick at the lodge.', target: 'npc:garrick' },
    },
  },
  sq_light: {
    name: 'Light at Gull Point', reward: { xp: 150, items: [['lantern_brass', 1]] },
    stages: {
      oil: { text: 'Fetch a jug of lamp oil from Ines, the trader in Saltby.', target: 'npc:ines', obj: { type: 'item', id: 'lamp_oil', n: 1 }, next: 'light' },
      light: { text: 'Pour the oil into the reservoir at the foot of the lighthouse — the wick-pump feeds the great lamp.', target: 'lighthouse.top', obj: { type: 'flag', flag: 'lighthouse_lit' }, next: 'back' },
      back: { text: 'Tell Morwen the light is burning.', target: 'npc:morwen' },
    },
  },
  sq_net: {
    name: "The Fisher's Net", reward: { xp: 110, gold: 25, items: [['fish', 3]] },
    stages: {
      find: { text: 'Aldo\'s best net washed down the coast to the Wreck of the Merrow. Retrieve it.', target: 'wreck', obj: { type: 'item', id: 'net', n: 1 }, next: 'back' },
      back: { text: 'Return the net to Aldo in Saltby.', target: 'npc:aldo' },
    },
  },
  sq_pages: {
    name: 'The Chronicle of Avalon', reward: { xp: 320, gold: 150 },
    stages: {
      collect: { text: 'Find the 8 torn pages of the Chronicle scattered across Avalon.', obj: [{ type: 'item', id: 'page1' }, { type: 'item', id: 'page2' }, { type: 'item', id: 'page3' }, { type: 'item', id: 'page4' }, { type: 'item', id: 'page5' }, { type: 'item', id: 'page6' }, { type: 'item', id: 'page7' }, { type: 'item', id: 'page8' }], next: 'back' },
      back: { text: 'Bring the complete Chronicle to Archivist Elowen in Caer Dawn.', target: 'npc:elowen' },
    },
  },
  sq_mine: {
    name: 'Trouble at Ironhollow', reward: { xp: 150, gold: 60, items: [['iron_ore', 3]] },
    stages: {
      clear: { text: 'Drive the brigands out of the deep tunnels of Ironhollow.', target: 'mine.deep', obj: { type: 'kill', tag: 'brigand', n: 2, label: 'Brigands' }, next: 'back' },
      back: { text: 'Tell Foreman Durk the tunnels are clear.', target: 'npc:durk' },
    },
  },
  sq_bounty: {
    name: 'Bounty: Grimtooth', reward: { xp: 100, gold: 150 },
    stages: {
      hunt: { text: 'Slay Grimtooth, the great bear of the High Pass. His den lies west of the pass.', target: 'bear.den', obj: { type: 'flag', flag: 'grimtooth_done' }, next: 'back' },
      back: { text: 'Claim the bounty from Sergeant Pell in Caer Dawn.', target: 'npc:pell' },
    },
  },
  sq_herbs: {
    name: 'Herbs for the Sick', reward: { xp: 100, gold: 60, items: [['tonic', 1]] },
    stages: {
      gather: { text: 'Gather 5 yarrow and 3 comfrey for Maeve\'s patients.', target: 'npc:maeve', obj: [{ type: 'item', id: 'yarrow', n: 5 }, { type: 'item', id: 'comfrey', n: 3 }], next: 'back' },
      back: { text: 'Bring the herbs to Maeve.', target: 'npc:maeve' },
    },
  },
};
