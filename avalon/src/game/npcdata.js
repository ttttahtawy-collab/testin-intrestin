// Named NPCs: appearance, daily routine, trade stock and barks.
// Schedule entries: [fromHour, toHour, spotName, activity, extra]

const F = true;
const day = (spot, act = 'idle') => [[0, 24, spot, act]];

export const NPCS = {
  // ---------- the sick-tents & Greywater ----------
  maeve: {
    name: 'Maeve', title: 'Healer of Greywater', settlement: 'greywater',
    app: { female: F, skin: 0xc89474, hair: 0x3a2214, eyes: 0x4a6a3a, scarf: 0x5a6a4a, top: 0x6a7a5a, topStyle: 'dress', topTrim: 0xd8cfa8, belt: 0x5a3a22, boots: 0x3a2a1a },
    schedule: (g) => (!g.flags.tents_cleared && !g.quests.isDone('mq_tents')) ? day('q.fire', 'work') : [[0, 6, 'healer.cot0', 'sleep'], [6, 21, 'healer.work', 'work'], [21, 24, 'healer.cot0', 'sleep']],
    barks: { greet: ['Breathe slow. The grey settles in quick lungs.', 'Wash your hands before you touch anything.', 'Still standing? Good.'] },
    alwaysTalk: true,
  },
  bram: {
    name: 'Old Bram', title: 'Warden of the Sick-Tents', settlement: 'quarantine',
    app: { skin: 0xb88a64, hair: 0xa8a49a, beard: 'full', beardColor: 0xb8b4aa, top: 0x5a4a3a, topStyle: 'coat', fur: 0x7a6a5a, legs: 0x3a3028, helmet: 'cap', capColor: 0x4a3a2a },
    weapon: 'spear_hunter',
    schedule: day('q.gate', 'idle'),
    barks: { greet: ['No one leaves till Maeve says so.', 'Mind the fence, stranger.', 'Saw your kind wash up before. Most of them coughed.'] },
    alwaysTalk: true,
  },
  wynn: {
    name: 'Elder Wynn', title: 'Elder of Greywater', settlement: 'greywater',
    app: { skin: 0xc8946c, hair: 0xd8d4cc, hairStyle: 'bald', beard: 'full', beardColor: 0xe0dcd4, top: 0x3a4a6a, topStyle: 'robe', topTrim: 0xb08a3a, belt: 0x5a3a22 },
    weapon: null,
    schedule: [[0, 7, 'elder.bed', 'sleep'], [7, 12, 'gw.plaza', 'idle'], [12, 14, 'elder.table', 'sit'], [14, 19, 'gw.plaza', 'wander', { r: 5 }], [19, 22, 'inn.seat1', 'sit'], [22, 24, 'elder.bed', 'sleep']],
    barks: { greet: ['Greywater endures. Somehow.', 'Mind the children near the mere.', 'The carts used to come every week.'] },
    alwaysTalk: true,
  },
  haldor: {
    name: 'Haldor', title: 'Smith', settlement: 'greywater', shop: 'smith',
    app: { skin: 0xa87850, hair: 0x2a1a10, beard: 'full', beardColor: 0x2a1a10, top: 0x8a6a4a, topStyle: 'apron', apron: 0x3a2a1a, legs: 0x3a3028, gloves: 0x3a2a1a },
    weapon: 'hammer_smith',
    schedule: [[0, 6, 'smithy.bed', 'sleep'], [6, 19, 'smithy.anvil', 'work'], [19, 22, 'inn.seat2', 'sit'], [22, 24, 'smithy.bed', 'sleep']],
    barks: { greet: ['Steel needs fire. Fire needs coal. Coal needs coin.', 'That blade of yours wants an edge.', 'Hammer and patience. That\'s the trade.'] },
  },
  mirela: {
    name: 'Mirela', title: 'Shopkeeper', settlement: 'greywater', shop: 'general',
    app: { female: F, skin: 0xd8a888, hair: 0x6a3a1a, scarf: 0x8a3a3a, top: 0x8a5a3a, topStyle: 'dress', topTrim: 0xe8d8b8, belt: 0x3a2414 },
    schedule: [[0, 7, 'shop.bed', 'sleep'], [7, 20, 'shop.counter', 'idle'], [20, 24, 'shop.hearth', 'idle']],
    barks: { greet: ['Bread, linen, lamp-wick. Look around.', 'Prices are up. Everything\'s up.', 'Come in, out of the damp.'] },
    alwaysTalk: true,
  },
  godric: {
    name: 'Godric', title: 'Keeper of the Weary Lantern', settlement: 'greywater', shop: 'inn',
    app: { skin: 0xd09a78, hair: 0x5a3a1a, hairStyle: 'bald', beard: 'mustache', beardColor: 0x5a3a1a, top: 0xd8cfb8, topStyle: 'apron', apron: 0x6a4a2a, legs: 0x3a3028 },
    schedule: [[0, 6, 'inn.room1', 'sleep'], [6, 24, 'inn.counter', 'idle']],
    barks: { greet: ['Warm stew and a dry bench. That\'s all I can promise.', 'Sit, sit. The fire\'s free.', 'No cider today — apples blackened on the bough.'] },
    alwaysTalk: true,
  },
  tamsin: {
    name: 'Tamsin', title: "Innkeeper's Daughter", settlement: 'greywater',
    app: { female: F, skin: 0xd8a888, hair: 0xa86a2a, scarf: 0x3a5a7a, top: 0x5a6a8a, topStyle: 'dress', topTrim: 0xe8e0c8 },
    schedule: [[0, 7, 'inn.room2', 'sleep'], [7, 12, 'gw.dock', 'wander', { r: 4 }], [12, 21, 'inn.seat3', 'idle'], [21, 24, 'inn.room2', 'sleep']],
    barks: { greet: ['Have you been down to the mere? Mind the reeds.', 'Father says not to talk to strangers. You look harmless.'] },
  },
  rowena: {
    name: 'Rowena', title: 'Widow of Greywater', settlement: 'greywater',
    app: { female: F, skin: 0xc8946c, hair: 0x2a1a10, scarf: 0x2a2a2a, top: 0x3a3a3a, topStyle: 'dress', topTrim: 0x6a6a6a },
    schedule: [[0, 7, 'gw.home1.bed', 'sleep'], [7, 20, 'gw.home1.front', 'idle'], [20, 24, 'gw.home1.bed', 'sleep']],
    barks: { greet: ['Have you seen my boy? Small, freckles, never listens.', 'Please… if you go west, look for Pip.'] },
    alwaysTalk: true,
  },
  pip: {
    name: 'Pip', title: "Rowena's son", settlement: 'greywater',
    app: { skin: 0xd8a888, hair: 0xa86a2a, top: 0x6a8a4a, topStyle: 'tunic', legs: 0x5a4a3a, scale: 0.68 },
    schedule: (g) => g.quests.stageOf('sq_pip') && !g.flags.pip_saved ? day('cave.end', 'sit') : [[0, 8, 'gw.home1.bed', 'sleep'], [8, 20, 'gw.plaza', 'wander', { r: 10 }], [20, 24, 'gw.home1.bed', 'sleep']],
    hiddenUntil: (g) => !!g.quests.stageOf('sq_pip'),
    barks: { greet: ['Did you see the fox? It went that way!', 'I\'m not lost. I\'m exploring.'] },
    alwaysTalk: true,
  },
  edda: {
    name: 'Edda Brannoc', title: 'Farmer', settlement: 'farm',
    app: { female: F, skin: 0xc88e68, hair: 0x8a6a3a, scarf: 0xa88a5a, top: 0x7a6a4a, topStyle: 'dress', topTrim: 0x5a4a3a, boots: 0x3a2a1a },
    weapon: 'axe_wood',
    schedule: [[0, 6, 'farm.bed', 'sleep'], [6, 12, 'barn.work', 'work'], [12, 14, 'farm.table', 'sit'], [14, 20, 'barn.work', 'work'], [20, 24, 'farm.bed', 'sleep']],
    barks: { greet: ['Lost three ewes this month. Wolves, from the old tower.', 'The wheat\'s spotted grey. Don\'t touch it.'] },
    alwaysTalk: true,
  },
  garrick: {
    name: 'Garrick', title: 'Hunter of the Weald', settlement: 'lodge', shop: 'hunter',
    app: { skin: 0xb88660, hair: 0x4a3a2a, beard: 'full', beardColor: 0x4a3a2a, top: 0x4a5a3a, topStyle: 'coat', fur: 0x8a7a5a, legs: 0x4a3a2a, hood: 0x3a4a2a, quiver: true },
    weapon: 'bow_hunting',
    schedule: [[0, 6, 'lodge.bed', 'sleep'], [6, 11, 'lodge.front', 'wander', { r: 8 }], [11, 24, 'lodge.fire', 'sit']],
    barks: { greet: ['Quiet. You\'ll scare the deer.', 'Wolves are bold this year. Too bold.'] },
    alwaysTalk: true,
  },
  fenn: {
    name: 'Fenn', title: 'Peddler', settlement: 'crossroads', shop: 'peddler',
    app: { skin: 0xc8946c, hair: 0x6a5a4a, beard: 'stubble', top: 0x8a3a2a, topStyle: 'coat', fur: 0x6a5a3a, legs: 0x3a3a3a, helmet: 'cap', capColor: 0x2a4a3a },
    schedule: day('cross.trader', 'idle'),
    barks: { greet: ['Wares from three villages! Well — two, now.', 'Crows at the crossroads mean the harvest failed again.'] },
    alwaysTalk: true,
  },
  // ---------- Caer Dawn ----------
  ysolde: {
    name: 'Captain Ysolde', title: 'Captain of the Dawn Watch', settlement: 'caerdawn',
    app: { female: F, skin: 0xd8a888, hair: 0x2a1a10, eyes: 0x3a4a6a, topStyle: 'mail', tabard: 0x23406e, topTrim: 0xb08a2a, helmet: 'coif', cloak: 0x23406e },
    weapon: 'sword_knight', offhand: 'shield_dawn', brave: true,
    schedule: (g) => g.quests.stageOf('mq_draught') === 'confront' ? day('hall.in', 'idle') : [[0, 6, 'cd.captain.bed', 'sleep'], [6, 21, 'cd.gate', 'idle'], [21, 24, 'cd.captain.table', 'sit']],
    barks: { greet: ['State your business.', 'Keep your blade sheathed inside the walls.', 'The Watch stands. For now.'] },
    alwaysTalk: true,
  },
  harlan: {
    name: 'Steward Harlan', title: 'Steward of Avalon', settlement: 'caerdawn',
    app: { skin: 0xe0b098, hair: 0x8a8a8a, beard: 'mustache', beardColor: 0x8a8a8a, top: 0x5a1a3a, topStyle: 'robe', topTrim: 0xd8b040, belt: 0xb08a3a, cloak: 0x2a1a2a },
    schedule: day('hall.seat', 'sit'),
    barks: { greet: ['Ah. The castaway.', 'Order, friend. Order is everything.'] },
    alwaysTalk: true,
  },
  elowen: {
    name: 'Elowen', title: 'Archivist of Caer Dawn', settlement: 'caerdawn',
    app: { female: F, skin: 0xd0a080, hair: 0x5a4a3a, scarf: 0x4a3a5a, top: 0x3a3a5a, topStyle: 'robe', topTrim: 0xc8b890 },
    schedule: [[0, 7, 'cd.home2.bed', 'sleep'], [7, 21, 'cd.home2.table', 'sit'], [21, 24, 'cd.home2.bed', 'sleep']],
    barks: { greet: ['Mind the ink. And the dust.', 'Have you any old pages? Anything at all?'] },
    alwaysTalk: true,
  },
  brom: {
    name: 'Brom', title: 'Castle Smith', settlement: 'caerdawn', shop: 'armorer',
    app: { skin: 0x9a6a48, hair: 0x1a1a1a, hairStyle: 'bald', beard: 'full', beardColor: 0x1a1a1a, top: 0x5a5a5a, topStyle: 'apron', apron: 0x2a1a10, gloves: 0x2a1a10 },
    weapon: 'hammer_smith',
    schedule: [[0, 6, 'cd.smith.bed', 'sleep'], [6, 20, 'cd.smith.anvil', 'work'], [20, 24, 'cd.smith.bed', 'sleep']],
    barks: { greet: ['Castle steel. Not cheap, not pretty, not breaking.', 'If you\'re buying, buy. If not, mind the sparks.'] },
  },
  hilde: {
    name: 'Hilde', title: 'Merchant', settlement: 'caerdawn', shop: 'castle',
    app: { female: F, skin: 0xe0b098, hair: 0xd8b860, scarf: 0x6a2a4a, top: 0x6a2a4a, topStyle: 'dress', topTrim: 0xd8b040 },
    schedule: [[0, 7, 'cd.shop.bed', 'sleep'], [7, 20, 'cd.shop.counter', 'idle'], [20, 24, 'cd.shop.bed', 'sleep']],
    barks: { greet: ['Finest goods this side of the Mire. Which isn\'t saying much.', 'Remedies are dear. The Steward\'s men buy them all.'] },
    alwaysTalk: true,
  },
  aldwin: {
    name: 'Aldwin', title: 'Keeper of the Gilded Hart', settlement: 'caerdawn', shop: 'inn',
    app: { skin: 0xd09a78, hair: 0x8a5a2a, beard: 'stubble', top: 0xd8cfb8, topStyle: 'apron', apron: 0x3a5a3a },
    schedule: [[0, 6, 'cd.inn.room1', 'sleep'], [6, 24, 'cd.inn.counter', 'idle']],
    barks: { greet: ['Room\'s a crown a night. Stew\'s extra.'] },
    alwaysTalk: true,
  },
  pell: {
    name: 'Sergeant Pell', title: 'Dawn Watch', settlement: 'caerdawn',
    app: { skin: 0xb88a64, hair: 0x6a4a2a, beard: 'mustache', topStyle: 'mail', tabard: 0x23406e, topTrim: 0xb08a2a, helmet: 'kettle' },
    weapon: 'sword_militia', offhand: 'shield_dawn', brave: true,
    schedule: [[0, 6, 'cd.home8.bed', 'sleep'], [6, 22, 'cd.square', 'idle'], [22, 24, 'cd.home8.bed', 'sleep']],
    barks: { greet: ['Bounties posted. Coin for anyone with the stomach.', 'Move along. Or don\'t. Free town.'] },
    alwaysTalk: true,
  },
  corvin: {
    name: 'Corvin', title: 'Royal Physician', settlement: 'kingsfall',
    app: { skin: 0xd8b098, hair: 0x9a9a9a, beard: 'full', beardColor: 0xaaaaaa, top: 0x4a3a2a, topStyle: 'robe', topTrim: 0x8a7a5a, belt: 0x3a2414 },
    schedule: (g) => g.flags.corvin_freed ? [[0, 6, 'healer.cot1', 'sleep'], [6, 22, 'healer.in', 'work'], [22, 24, 'healer.cot1', 'sleep']] : day('kingsfall.cell', 'sit'),
    hiddenUntil: (g) => !!g.quests.stageOf('mq_kingsfall'),
    barks: { greet: ['Fungus. It was always fungus.', 'Have you washed? Wash.'] },
    alwaysTalk: true,
  },
  // ---------- Stillwater ----------
  odran: {
    name: 'Odran', title: 'Elder of Stillwater', settlement: 'stillwater',
    app: { skin: 0xa88060, hair: 0xb8b4aa, beard: 'full', beardColor: 0xc8c4ba, top: 0x4a5a4a, topStyle: 'coat', fur: 0x6a6a5a, hood: 0x3a4a3a },
    weapon: null,
    schedule: [[0, 7, 'sw.elder.bed', 'sleep'], [7, 21, 'sw.square', 'idle'], [21, 24, 'sw.elder.bed', 'sleep']],
    barks: { greet: ['The fen gives and the fen takes.', 'Walk the boards, not the mud.'] },
    alwaysTalk: true,
  },
  nessa: {
    name: 'Nessa', title: 'Mask-Maker', settlement: 'stillwater', shop: 'fen',
    app: { female: F, skin: 0xb8906c, hair: 0x3a2a1a, scarf: 0x5a6a4a, top: 0x6a6a4a, topStyle: 'dress', topTrim: 0xc8c0a0 },
    schedule: [[0, 7, 'sw.maskmaker.bed', 'sleep'], [7, 21, 'sw.maskmaker.in', 'work'], [21, 24, 'sw.maskmaker.bed', 'sleep']],
    barks: { greet: ['Breathe the Heart-fog unmasked and you\'ll cough grey till you die.', 'Linen, comfrey, patience. That\'s a mask.'] },
    alwaysTalk: true,
  },
  lio: {
    name: 'Lio', title: 'Fen Trader', settlement: 'stillwater', shop: 'fen',
    app: { skin: 0xa07a58, hair: 0x2a1a10, beard: 'stubble', top: 0x5a4a2a, topStyle: 'vest', shirt: 0xb8a888 },
    schedule: [[0, 7, 'sw.trader.bed', 'sleep'], [7, 21, 'sw.trader.counter', 'idle'], [21, 24, 'sw.trader.bed', 'sleep']],
    barks: { greet: ['Eels, reeds, rope. Fen goods.'] },
    alwaysTalk: true,
  },
  // ---------- Saltby ----------
  aldo: {
    name: 'Aldo', title: 'Fisher of Saltby', settlement: 'saltby',
    app: { skin: 0xb07a50, hair: 0x5a5a5a, beard: 'full', beardColor: 0x6a6a6a, top: 0x3a4a5a, topStyle: 'coat', fur: 0x8a8a7a, helmet: 'cap', capColor: 0x3a3a4a },
    schedule: [[0, 5, 'sb.fisher.bed', 'sleep'], [5, 18, 'sb.dock', 'work'], [18, 24, 'sb.fisher.hearth', 'idle']],
    barks: { greet: ['Fish are scarce. Even the gulls are thin.', 'Tide\'s turning.'] },
    alwaysTalk: true,
  },
  ines: {
    name: 'Ines', title: 'Trader of Saltby', settlement: 'saltby', shop: 'coast',
    app: { female: F, skin: 0xc8946c, hair: 0x1a1a1a, scarf: 0x2a5a6a, top: 0x2a5a6a, topStyle: 'dress', topTrim: 0xe8e0c8 },
    schedule: [[0, 7, 'sb.trader.bed', 'sleep'], [7, 20, 'sb.trader.counter', 'idle'], [20, 24, 'sb.trader.bed', 'sleep']],
    barks: { greet: ['Salt, oil, net-twine. All you need by the sea.'] },
    alwaysTalk: true,
  },
  morwen: {
    name: 'Morwen', title: 'Keeper of Gull Point', settlement: 'lighthouse',
    app: { female: F, skin: 0xc0906c, hair: 0x9a9a9a, scarf: 0x4a4a5a, top: 0x3a3a4a, topStyle: 'dress', topTrim: 0x8a8a9a },
    schedule: [[0, 7, 'keeper.bed', 'sleep'], [7, 24, 'keeper.front', 'idle']],
    barks: { greet: ['Three ships lost since the light went dark.', 'Wind\'s from the west. Smells of rain.'] },
    alwaysTalk: true,
  },
  durk: {
    name: 'Foreman Durk', title: 'Ironhollow Mine', settlement: 'mine', shop: 'miner',
    app: { skin: 0xa07050, hair: 0x2a2a2a, beard: 'full', beardColor: 0x2a2a2a, top: 0x5a5048, topStyle: 'apron', apron: 0x3a2a1a, helmet: 'cap', capColor: 0x3a3a30 },
    weapon: 'pick_miner',
    schedule: [[0, 6, 'mine.hut.bed', 'sleep'], [6, 22, 'mine.front', 'idle'], [22, 24, 'mine.hut.bed', 'sleep']],
    barks: { greet: ['Ore\'s there. Men to dig it aren\'t.', 'Keep out of the deep shafts, unless you\'re feeling brave.'] },
    alwaysTalk: true,
  },
};

// Shops: [itemId, stock]
export const SHOPS = {
  smith: [['sword_militia', 1], ['axe_wood', 1], ['shield_plank', 2], ['shield_iron', 1], ['cap_leather', 1], ['gambeson', 1], ['throwknife', 8], ['arrow', 40]],
  general: [['bread', 6], ['apple', 8], ['linen', 10], ['bandage', 4], ['poultice', 2], ['tea_marigold', 2], ['lantern_tin', 1], ['hood', 1]],
  inn: [['bread', 6], ['stew', 4], ['apple', 5], ['fish', 3]],
  hunter: [['bow_hunting', 1], ['arrow', 60], ['jerkin', 1], ['knife_hunting', 1], ['venison', 3], ['belt_hunter', 1]],
  peddler: [['linen', 6], ['poultice', 3], ['firepot', 2], ['throwknife', 4], ['apple', 6], ['tea_marigold', 3], ['lantern_tin', 1]],
  armorer: [['sword_knight', 1], ['mail', 1], ['kettle_helm', 1], ['shield_dawn', 1], ['belt_knight', 1], ['bascinet', 1], ['arrow', 40], ['firepot', 3]],
  castle: [['tonic', 3], ['poultice', 4], ['linen', 10], ['bread', 6], ['bow_yew', 1], ['ranger_coat', 1], ['lantern_brass', 1], ['tea_marigold', 4]],
  fen: [['mask_filter', 3], ['stew', 4], ['linen', 6], ['comfrey', 4], ['fish_raw', 4], ['firepot', 2]],
  coast: [['fish', 6], ['bread', 4], ['linen', 6], ['lamp_oil', 2], ['arrow', 30], ['tea_marigold', 3]],
  miner: [['iron_ore', 6], ['pick_miner', 1], ['bread', 4], ['lantern_tin', 1]],
};

// Generic villagers (procedurally dressed) per settlement
export const VILLAGERS = {
  greywater: { n: 7, spots: ['gw.plaza', 'gw.stall1', 'gw.stall2', 'inn.in', 'gw.dock'], homes: ['gw.home0', 'gw.home2', 'gw.home3', 'gw.home4', 'gw.home5', 'gw.home6', 'gw.home7'] },
  caerdawn: { n: 12, spots: ['cd.square', 'cd.stall1', 'cd.stall2', 'cd.stall3', 'cd.stall4', 'cd.inn.in', 'cd.gate.in'], homes: ['cd.home0', 'cd.home1', 'cd.home3', 'cd.home9', 'cd.home10', 'cd.home11', 'cd.home12', 'cd.home13', 'cd.home14', 'cd.home15', 'cd.home16', 'cd.home17'] },
  saltby: { n: 3, spots: ['sb.square', 'sb.dock'], homes: ['sb.home2', 'sb.home3', 'sb.home4'] },
  stillwater: { n: 3, spots: ['sw.square'], homes: ['sw.home0', 'sw.home2', 'sw.home4'] },
};

export const NAMES_M = ['Alric', 'Bennet', 'Cador', 'Dunstan', 'Edric', 'Fergus', 'Gawen', 'Hob', 'Iver', 'Jory', 'Kenelm', 'Lorcan', 'Merrick', 'Nyle', 'Osmond', 'Piran', 'Rhys', 'Selwyn', 'Talan', 'Ulric', 'Wat', 'Yestin'];
export const NAMES_F = ['Aelis', 'Branwen', 'Cerys', 'Dilys', 'Elspeth', 'Gwenda', 'Heledd', 'Isolde', 'Jenet', 'Kenna', 'Lowri', 'Morgan', 'Nia', 'Olwen', 'Rhian', 'Sian', 'Tegan', 'Wenna'];

export const GENERIC_BARKS = {
  greet: ['Morning.', 'Evening.', 'Mind the puddles.', 'Grey again today.', 'Keep well, traveller.', 'You\'re not from here.', 'Another cough in the night. Another.', 'Stay out of the fog.'],
  fear: ['Run! Run!', 'Watch out!', 'Help! Someone!', 'Get inside!'],
  hit: ['Hey! Watch that blade!', 'Are you mad?', 'Keep your hands to yourself!'],
  night: ['Late to be wandering.', 'Lock your door tonight.'],
  rain: ['Wet to the bone.', 'This rain won\'t quit.'],
};

export const ENEMY_BARKS = {
  bandit: { aggro: ['Fresh meat!', 'Your purse, now!', 'Should\'ve stayed on the road!', 'Get \'em!'] },
  deserter: { aggro: ['No more orders!', 'You\'re a long way from help.', 'For no king!', 'Draw, then.'] },
  brute: { aggro: ['MINE!', 'Crush you…', 'Little thing come to Gorm\'s fen?'] },
};

export const RUMORS = [
  'They say wolves den by the old watchtower on the Kingsway. Edda at the farm lost half her flock.',
  'Old Fenn at Crow\'s Crossroads sells pitch pots. Nasty things. Useful, though.',
  'There\'s a cave in the Weald — Hollow Oak, the hunters call it. Kids dare each other to go in.',
  'The Steward hasn\'t left Caer Dawn since the king died. Some say he likes the chair too much.',
  'A ship broke up on the south shore last winter. The Merrow. Nobody\'s been brave enough to pick through it.',
  'Highcrag snow never melts above the pass. Flowers grow up there anyway. Gold ones.',
  'The fen folk wear masks in the deep Mire. Without one, the fog eats your lungs.',
  'A bear the size of a cart haunts the High Pass. Grimtooth, they call it. The Watch put a price on it.',
  'Ironhollow\'s gone quiet. Brigands moved into the deep tunnels, I heard.',
  'The lighthouse at Gull Point went dark. Morwen\'s been asking for oil.',
  'There\'s a great tree east of the Weald that blooms purple all year. The Elder Bloom. Old folk leave things in its roots.',
  'Pages of the old Chronicle are scattered all over the isle. The archivist in Caer Dawn pays for them.',
];
