// Branching dialogue for Chapter One.
// Node: { t: text|fn(g), o: [ { t, n: next|'end'|'shop', c: cond(g), d: action(g), check: {attr,min} } ] }
import { RUMORS } from './npcdata.js';

const S = (g, q) => (g.quests.isActive(q) ? g.quests.stageOf(q) : null);
const A = (g, q) => g.quests.isActive(q);
const D = (g, q) => g.quests.isDone(q);
const has = (g, id, n = 1) => g.inventory.has(id, n);
const flag = (g, f) => !!g.flags[f];
const set = (g, f) => g.setFlag(f);
const rumor = () => RUMORS[Math.floor(Math.random() * RUMORS.length)];

export const DLG = {};

// ---------------------------------------------------------------- MAEVE
DLG.maeve = {
  start: (g) => {
    const t = g.quests.stageOf('mq_tents');
    if (!t) return 'wake';
    if (A(g, 'mq_tents')) return { wake: 'wake', gear: 'gear', equip: 'gear', herbs: 'herbs', return: 'herbsdone', craft: 'craft', show: 'show', bram: 'bram' }[t] || 'hub';
    if (S(g, 'mq_draught') === 'brew') return 'brew';
    if (S(g, 'mq_draught') === 'wait') return flag(g, 'draught_ready') ? 'cure' : 'waiting';
    if (S(g, 'mq_draught') === 'cure') return 'cure';
    if (S(g, 'mq_kingsfall') === 'report') return 'corvinback';
    return 'hub';
  },
  nodes: {
    wake: {
      t: 'Easy — don\'t sit up so fast. You\'ve been asleep two days. Bram dragged you out of the surf with a lantern still clenched in your fist. Do you remember your name? Anything at all?',
      o: [
        { t: 'Nothing. Only the cold… and the light.', n: 'wake2' },
        { t: 'Where am I?', n: 'where' },
      ],
    },
    where: { t: 'The sick-tents, outside Greywater Hollow. On the isle of Avalon. We keep the newcomers here until we know they don\'t carry the Withering.', o: [{ t: 'The Withering?', n: 'withering' }] },
    wake2: { t: 'That\'s more than most castaways keep. Light, then. You\'ll be the Lantern-Bearer until you think of something better.', o: [{ t: 'Why am I being kept here?', n: 'withering' }] },
    withering: {
      t: 'Since the old king died, a grey fog has crept out of the Mirefen. Where it settles, the wheat blackens and folk start to cough grey. The Withering. My poultices slow it. Nothing stops it.',
      o: [{ t: 'What do you need from me?', n: 'task' }],
    },
    task: {
      t: 'Prove your lungs are clear and your hands are useful. Your things are in the supply chest by the fence. Arm yourself — the wolves come close at night — then come back to me.',
      o: [{ t: 'I\'ll fetch my things.', n: 'end', d: (g) => g.quests.setStage('mq_tents', 'gear') }],
    },
    gear: { t: 'The chest by the fence. And put that tunic on, at least. You look like a drowned rat.', o: [{ t: 'On my way.', n: 'end' }] },
    herbs: { t: 'Yarrow. White, flat flower-heads, past the east gate of the tents. Three stems. Pull them up gently — the roots matter.', o: [{ t: 'Three yarrow. Got it.', n: 'end' }] },
    herbsdone: {
      t: (g) => has(g, 'yarrow', 3) ? 'Good, good — and no cough. Now watch. Yarrow, mashed with clean linen, pressed to the wound. Here, take some linen. Make a poultice at the fire yourself.' : 'You don\'t have three yarrow yet. White flowers, past the east gate.',
      o: [
        { t: 'I\'ll make it at the fire.', c: (g) => has(g, 'yarrow', 3), n: 'end', d: (g) => { g.inventory.add('linen', 2); g.quests.setStage('mq_tents', 'craft'); } },
        { t: 'I\'ll keep looking.', c: (g) => !has(g, 'yarrow', 3), n: 'end' },
      ],
    },
    craft: { t: 'Kneel at the campfire and use what you\'ve got. Two yarrow, one linen. Don\'t burn your fingers.', o: [{ t: 'Right.', n: 'end' }] },
    show: {
      t: 'Let me see… Not bad at all. Neat edges. You\'ve a steady hand, castaway. I\'ll tell Bram you\'re clear. Go into Greywater and find Elder Wynn — he\'ll want a pair of hands like yours.',
      o: [{ t: 'Thank you, Maeve.', n: 'end', d: (g) => { set(g, 'tents_cleared'); g.quests.setStage('mq_tents', 'bram'); } }],
    },
    bram: { t: 'Bram knows. Go on — he\'ll open the gate.', o: [{ t: 'Farewell for now.', n: 'end' }] },
    hub: {
      t: (g) => g.isNight() ? 'Can\'t sleep either? The coughing keeps me up.' : 'Lantern-Bearer. What ails you?',
      o: [
        { t: 'Do you need anything?', c: (g) => !g.quests.stageOf('sq_herbs') && D(g, 'mq_tents'), n: 'herbquest' },
        { t: 'I\'ve brought the herbs.', c: (g) => S(g, 'sq_herbs') === 'back' || (A(g, 'sq_herbs') && has(g, 'yarrow', 5) && has(g, 'comfrey', 3)), n: 'herbgive' },
        { t: 'Tell me more about the Withering.', n: 'withering2' },
        { t: 'Can you patch me up?', n: 'heal' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    withering2: { t: 'It starts as a tickle in the chest. Then grey threads under the skin. Corvin — the king\'s physician — said it was something in the fog. He went to Kingsfall to look in the old archives. That was months ago.', o: [{ t: 'Back.', n: 'hub' }] },
    heal: { t: 'Sit. Hold still… There. Don\'t make a habit of bleeding.', o: [{ t: 'Thanks.', n: 'hub', d: (g) => { g.player.hp = g.player.maxHp; g.ui.toast('Maeve tends your wounds.', 2); } }] },
    herbquest: {
      t: 'Always. Five yarrow, three comfrey — the purple one. My patients go through them faster than I can pick.',
      o: [{ t: 'I\'ll gather them.', n: 'end', d: (g) => g.quests.start('sq_herbs') }, { t: 'Not now.', n: 'hub' }],
    },
    herbgive: {
      t: 'Bless you. That\'s a week of poultices. Take this — willowbark tonic, my own brew.',
      o: [{ t: 'Glad to help.', n: 'hub', d: (g) => { g.inventory.remove('yarrow', 5); g.inventory.remove('comfrey', 3); g.quests.complete('sq_herbs'); } }],
    },
    corvinback: { t: 'Corvin! Alive! Talk to him — he\'s barely stopped lecturing me since he walked in.', o: [{ t: 'I will.', n: 'end' }] },
    brew: {
      t: (g) => has(g, 'sunpetal', 3) && has(g, 'bitterroot', 3) ? 'Sunpetal… and bitterroot. You actually did it. Corvin! Get the copper pot. It must steep through the night — come back in the morning.' : 'Corvin says we need three Sunpetal blooms and three Bitterroot. Bring them both.',
      o: [
        { t: 'I\'ll rest until morning.', c: (g) => has(g, 'sunpetal', 3) && has(g, 'bitterroot', 3), n: 'end', d: (g) => { g.inventory.remove('sunpetal', 3); g.inventory.remove('bitterroot', 3); g.flags.draught_brew_t = g.time.total; g.quests.setStage('mq_draught', 'wait'); } },
        { t: 'Not yet.', c: (g) => !(has(g, 'sunpetal', 3) && has(g, 'bitterroot', 3)), n: 'end' },
      ],
    },
    waiting: { t: 'Not yet. It needs the whole night. Rest at a fire — the time will pass faster than you think.', o: [{ t: 'Very well.', n: 'end' }] },
    cure: {
      t: 'Look at it. Grey as fog, but it shines. One sip and the threads under Wenna\'s skin faded in an hour. This is the Grey Draught. Corvin has written the recipe down. Now — who gets it first? The Steward will want to control it. Ysolde will want to give it away.',
      o: [{ t: 'I\'ll decide what happens to it.', n: 'end', d: (g) => { g.inventory.add('grey_draught', 1); g.quests.setStage('mq_draught', 'choice'); } }],
    },
  },
};

// ---------------------------------------------------------------- BRAM
DLG.bram = {
  start: (g) => S(g, 'mq_tents') === 'bram' ? 'open' : D(g, 'mq_tents') ? 'after' : 'closed',
  nodes: {
    closed: { t: 'Gate stays shut till Maeve clears you. Nothing personal. Last castaway I let through coughed himself to death in the inn.', o: [{ t: 'How did you find me?', n: 'found' }, { t: 'Fair enough.', n: 'end' }] },
    found: { t: 'Storm night. You were face-down in the shallows, holding a lantern so tight I had to pry your fingers off it. The flame was still lit. Never seen the like.', o: [{ t: 'Strange.', n: 'end' }] },
    open: { t: 'Maeve says you\'re clean. Go on, then. Greywater\'s up the hill — follow the path to the gate. Elder Wynn\'s usually in the square.', o: [{ t: 'Thanks, Bram.', n: 'end', d: (g) => g.quests.complete('mq_tents') }] },
    after: { t: 'Still alive, Lantern-Bearer? Good.', o: [{ t: 'Any news?', n: 'news' }, { t: 'Farewell.', n: 'end' }] },
    news: { t: () => rumor(), o: [{ t: 'Thanks.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- WYNN
DLG.wynn = {
  start: (g) => {
    if (S(g, 'mq_greywater') === 'elder') return 'meet';
    if (S(g, 'mq_greywater') === 'report') return has(g, 'osric_letter') ? 'report' : 'nopaper';
    return 'hub';
  },
  nodes: {
    meet: {
      t: 'So you\'re Maeve\'s castaway. Welcome to Greywater Hollow — such as it is. I\'d offer you a feast, but our larders are thin and our herbs thinner. Do you know what keeps this village alive? Medicine carts from Caer Dawn. And they\'ve stopped coming.',
      o: [{ t: 'Why have they stopped?', n: 'why' }, { t: 'How can I help?', n: 'help' }],
    },
    why: { t: 'The last cart left the castle three weeks ago and never arrived. The Steward\'s clerks say it was sent. So where is it? Somewhere on the Kingsway, between here and Crow\'s Crossroads.', o: [{ t: 'I\'ll find it.', n: 'help' }] },
    help: {
      t: 'Walk the Kingsway north. Look for the cart — or what\'s left of it. And speak to Haldor the smith before you go; that rusty sword won\'t frighten a goose.',
      o: [{ t: 'I\'ll search the road.', n: 'end', d: (g) => g.quests.setStage('mq_greywater', 'cart') }],
    },
    nopaper: { t: 'Osric\'s Hollow, in the Weald. If he has our herbs, he has a reason. Find it.', o: [{ t: 'I\'m going.', n: 'end' }] },
    report: {
      t: '"Take every herb-cart on the Kingsway. The Steward pays in silver. — H." H… Harlan. The Steward himself. He starves the villages of medicine while the castle hoards it. Why?',
      o: [
        { t: 'Control. Whoever holds the medicine holds Avalon.', n: 'report2' },
        { t: 'Maybe it\'s a forgery.', n: 'report2' },
      ],
    },
    report2: {
      t: 'Whatever his reason, we can\'t fight a Steward with pitchforks. Go to Caer Dawn. Captain Ysolde of the Watch is an honest woman — if anyone will listen, she will. Take this, for the road.',
      o: [{ t: 'I\'ll go to Caer Dawn.', n: 'end', d: (g) => g.quests.complete('mq_greywater') }],
    },
    hub: {
      t: 'Lantern-Bearer. The village is talking about you.',
      o: [
        { t: 'Tell me about Avalon.', n: 'lore' },
        { t: 'Any work in the village?', n: 'work' },
        { t: 'Heard any rumours?', n: 'rumor' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    lore: { t: 'Avalon was the king\'s isle. King Aldric ruled from Caer Dawn; his fathers ruled from Kingsfall, before the war burned it. When Aldric died without an heir, his Steward took the keys "until the heir is found." That was eleven months ago. Then came the fog.', o: [{ t: 'Back.', n: 'hub' }] },
    work: { t: 'Edda at Brannoc Farm is losing sheep to wolves. Haldor wants ore for his forge. Tamsin has lost something at the mere — and Rowena… poor Rowena. Her boy went into the woods and hasn\'t come back.', o: [{ t: 'I\'ll ask around.', n: 'hub', d: (g) => set(g, 'heard_rowena') }] },
    rumor: { t: () => rumor(), o: [{ t: 'Back.', n: 'hub' }] },
  },
};

// ---------------------------------------------------------------- HALDOR
DLG.haldor = {
  start: (g) => S(g, 'sq_iron') === 'back' || (A(g, 'sq_iron') && has(g, 'iron_ore', 4)) ? 'ore' : 'hub',
  nodes: {
    hub: {
      t: 'Haldor. I make things sharp. You buying, or are you selling that rust?',
      o: [
        { t: 'Show me your wares.', n: 'shop' },
        { t: 'Need anything done?', c: (g) => !S(g, 'sq_iron'), n: 'iron' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    iron: { t: 'Ore. The Ironhollow carts stopped too — brigands, I hear. Bring me four lumps of iron ore and I\'ll forge you something worth carrying.', o: [{ t: 'Four ore. I\'ll find them.', n: 'end', d: (g) => g.quests.start('sq_iron') }, { t: 'Maybe later.', n: 'hub' }] },
    ore: {
      t: 'Now that\'s honest rock. Give me an hour… there. Pick one: a proper sword, or a shield that won\'t splinter.',
      o: [
        { t: 'The sword.', n: 'end', d: (g) => { g.inventory.remove('iron_ore', 4); g.inventory.add('sword_militia', 1); g.quests.complete('sq_iron'); set(g, 'haldor_discount'); } },
        { t: 'The shield.', n: 'end', d: (g) => { g.inventory.remove('iron_ore', 4); g.inventory.add('shield_iron', 1); g.quests.complete('sq_iron'); set(g, 'haldor_discount'); } },
      ],
    },
  },
  shop: 'smith',
};

// ---------------------------------------------------------------- MIRELA / GODRIC / shopkeepers
DLG.mirela = { start: () => 'hub', shop: 'general', nodes: { hub: { t: 'Welcome, welcome. Linen, bread, a lamp for the dark nights. What\'ll it be?', o: [{ t: 'Let me see your goods.', n: 'shop' }, { t: 'Any news?', n: 'news' }, { t: 'Farewell.', n: 'end' }] }, news: { t: () => rumor(), o: [{ t: 'Back.', n: 'hub' }] } } };
DLG.godric = {
  start: () => 'hub', shop: 'inn',
  nodes: {
    hub: { t: 'Welcome to the Weary Lantern. No cider — the apples went grey. But the stew\'s hot and the beds are dry.', o: [{ t: 'I\'ll eat.', n: 'shop' }, { t: 'Rent a bed (5 crowns).', c: (g) => g.player.gold >= 5, n: 'end', d: (g) => { g.player.gold -= 5; g.rest(8, 'The Weary Lantern'); } }, { t: 'Heard anything?', n: 'news' }, { t: 'Farewell.', n: 'end' }] },
    news: { t: () => rumor(), o: [{ t: 'Back.', n: 'hub' }] },
  },
};
DLG.aldwin = {
  start: () => 'hub', shop: 'inn',
  nodes: {
    hub: { t: 'The Gilded Hart. Gilded once, anyway. Food, bed, gossip — pick two.', o: [{ t: 'Food.', n: 'shop' }, { t: 'A bed (10 crowns).', c: (g) => g.player.gold >= 10, n: 'end', d: (g) => { g.player.gold -= 10; g.rest(8, 'The Gilded Hart'); } }, { t: 'Gossip.', n: 'news' }, { t: 'Farewell.', n: 'end' }] },
    news: { t: () => rumor(), o: [{ t: 'Back.', n: 'hub' }] },
  },
};
DLG.hilde = { start: () => 'hub', shop: 'castle', nodes: { hub: { t: 'Remedies are dear these days. The Steward\'s men buy up every tonic that comes through the gate. Still — I keep a few back for honest customers.', o: [{ t: 'Show me.', n: 'shop' }, { t: 'Farewell.', n: 'end' }] } } };
DLG.brom = { start: () => 'hub', shop: 'armorer', nodes: { hub: { t: 'Castle steel. If it breaks, bring me the pieces and I\'ll laugh at you.', o: [{ t: 'Let\'s see it.', n: 'shop' }, { t: 'Farewell.', n: 'end' }] } } };
DLG.lio = { start: () => 'hub', shop: 'fen', nodes: { hub: { t: 'Fen goods. Filters for your mask, stew for your belly. Fair prices, for the end of the world.', o: [{ t: 'Trade.', n: 'shop' }, { t: 'Farewell.', n: 'end' }] } } };
DLG.fenn = {
  start: () => 'hub', shop: 'peddler',
  nodes: {
    hub: { t: 'Fenn the Peddler, at your service! Pitch pots, knives, herbs, lamp-wick. Three villages\' worth of wares. Well — two.', o: [{ t: 'Show me.', n: 'shop' }, { t: 'Seen any herb-carts pass?', c: (g) => A(g, 'mq_greywater'), n: 'cart' }, { t: 'Rumours?', n: 'news' }, { t: 'Farewell.', n: 'end' }] },
    cart: { t: 'Carts? Not for weeks. But I saw torchlight on the Kingsway one night, south of here, and heard wheels going west — into the Weald. Nobody takes a cart into the Weald for honest reasons.', o: [{ t: 'Thanks.', n: 'hub' }] },
    news: { t: () => rumor(), o: [{ t: 'Back.', n: 'hub' }] },
  },
};

// ---------------------------------------------------------------- TAMSIN
DLG.tamsin = {
  start: (g) => S(g, 'sq_ring') === 'back' ? 'back' : D(g, 'sq_ring') ? 'after' : A(g, 'sq_ring') ? 'waiting' : 'hub',
  nodes: {
    hub: { t: 'Oh! You\'re the castaway. Um. You haven\'t seen a ring, have you? Gold, with a little blue stone. It was my mother\'s.', o: [{ t: 'Where did you lose it?', n: 'where' }, { t: 'Sorry, no.', n: 'end' }] },
    where: { t: 'Down by the jetty on the mere. I was skipping stones. It slipped right off. Father will be furious.', o: [{ t: 'I\'ll look for it.', n: 'end', d: (g) => g.quests.start('sq_ring') }, { t: 'I hope you find it.', n: 'end' }] },
    waiting: { t: 'The jetty, on the mere — east of the village. Please hurry before the herons swallow it.', o: [{ t: 'I\'m looking.', n: 'end' }] },
    back: {
      t: 'You found it?!',
      o: [
        { t: 'Here. Your mother\'s ring.', n: 'end', d: (g) => { g.inventory.remove('lost_ring', 1); g.inventory.add('gold', 30); g.inventory.add('poultice', 2); g.quests.complete('sq_ring'); g.ui.toast('Tamsin hugs the ring to her chest.', 3); } },
        { t: 'Finders keepers.', n: 'keep' },
      ],
    },
    keep: { t: 'What? But… it\'s all I have of her. You — you\'re as bad as the Steward\'s men.', o: [{ t: '(Keep it.)', n: 'end', d: (g) => { g.quests.complete('sq_ring'); set(g, 'kept_ring'); } }, { t: 'I\'m joking. Here.', n: 'end', d: (g) => { g.inventory.remove('lost_ring', 1); g.inventory.add('gold', 30); g.inventory.add('poultice', 2); g.quests.complete('sq_ring'); } }] },
    after: { t: (g) => flag(g, 'kept_ring') ? '…' : 'I wear it on a string now. Around my neck. Thank you again.', o: [{ t: 'Farewell.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- ROWENA & PIP
DLG.rowena = {
  start: (g) => S(g, 'sq_pip') === 'back' ? 'back' : D(g, 'sq_pip') ? 'after' : A(g, 'sq_pip') ? 'waiting' : 'hub',
  nodes: {
    hub: { t: 'Please — you go out on the roads, don\'t you? My son, Pip. Eight years old. He chased a red fox past the farm two days ago and never came back. The men say the Weald is too dangerous.', o: [{ t: 'Where would he go?', n: 'where' }, { t: 'I\'m sorry.', n: 'end' }] },
    where: { t: 'He always talks about the Hollow Oak Cave — the hunters\' children dare each other to touch the back wall. It\'s west, past Garrick\'s lodge. Please.', o: [{ t: 'I\'ll bring him home.', n: 'end', d: (g) => g.quests.start('sq_pip') }] },
    waiting: { t: 'The Hollow Oak Cave. West of the lodge. Please, hurry.', o: [{ t: 'I\'m going.', n: 'end' }] },
    back: { t: 'He came running into the square an hour ago, filthy and grinning like nothing happened! I don\'t have much. This was my husband\'s satchel — he was the best herbalist in the Hollow. Take it.', o: [{ t: 'Keep him close.', n: 'end', d: (g) => g.quests.complete('sq_pip') }] },
    after: { t: 'He\'s grounded until he\'s forty.', o: [{ t: 'Fair.', n: 'end' }] },
  },
};
DLG.pip = {
  start: (g) => S(g, 'sq_pip') === 'talk' || (A(g, 'sq_pip') && !flag(g, 'pip_saved')) ? 'cave' : 'hub',
  nodes: {
    cave: { t: 'Are the wolves gone? I wasn\'t scared. I was… hiding strategically. The fox lives back there, did you see it? It has three kits!', o: [{ t: 'Your mother is worried sick. Go home, now.', n: 'cave2' }] },
    cave2: { t: 'Aw. Fine. Don\'t tell her I cried. I didn\'t cry.', o: [{ t: 'Run along. Stay on the path.', n: 'end', d: (g) => { set(g, 'pip_saved'); g.quests.setStage('sq_pip', 'back'); } }] },
    hub: { t: 'Want to see me throw a stone across the whole mere? I almost did it once.', o: [{ t: 'Another time.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- EDDA
DLG.edda = {
  start: (g) => S(g, 'sq_wolves') === 'back' ? 'back' : D(g, 'sq_wolves') ? 'after' : A(g, 'sq_wolves') ? 'waiting' : 'hub',
  nodes: {
    hub: { t: 'If you\'re here to buy wool, there\'s precious little left. Wolves have taken five ewes. They den at the old watchtower up the Kingsway — I hear them howling every night.', o: [{ t: 'I\'ll deal with them.', n: 'end', d: (g) => g.quests.start('sq_wolves') }, { t: 'Rough times.', n: 'end' }] },
    waiting: { t: 'The watchtower, north up the Kingsway. Three of the beasts, maybe more.', o: [{ t: 'On it.', n: 'end' }] },
    back: { t: 'Truly? You\'ve a stronger stomach than our watchmen. Here — my husband\'s axe, and some bread. And come by any time; there\'ll always be a crust for you here.', o: [{ t: 'Thank you, Edda.', n: 'end', d: (g) => g.quests.complete('sq_wolves') }] },
    after: { t: 'Not a howl since. The sheep are grazing again.', o: [{ t: 'Good.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- GARRICK
DLG.garrick = {
  start: (g) => S(g, 'mq_greywater') === 'tracks' ? 'tracks' : 'hub',
  shop: 'hunter',
  nodes: {
    tracks: {
      t: 'You followed those cart ruts, did you? So did I. A dozen men in red rags, hauling crates up to Osric\'s Hollow — the old bandit camp north-east of here. Red Osric pays in silver these days. Where\'s a cut-throat get silver?',
      o: [{ t: 'Who is Red Osric?', n: 'osric' }, { t: 'I\'m going there.', n: 'warn' }],
    },
    osric: { t: 'A deserter from the old king\'s guard. Quick with a sabre, quicker with his mouth. He\'ll want to talk before he fights. They always do. Use that.', o: [{ t: 'Anything else?', n: 'warn' }] },
    warn: {
      t: 'Take the trail north from the Weald Path. Archers on the walls. And if you want a better bow than that stick, bring me three wolf pelts sometime.',
      o: [{ t: 'Thanks, Garrick.', n: 'end', d: (g) => { set(g, 'garrick_told'); g.quests.setStage('mq_greywater', 'osric'); if (!g.quests.stageOf('sq_pelts')) g.quests.start('sq_pelts'); } }],
    },
    hub: {
      t: 'Hunter\'s Lodge. Mind the traps.',
      o: [
        { t: 'Trade.', n: 'shop' },
        { t: 'I have the wolf pelts.', c: (g) => A(g, 'sq_pelts') && has(g, 'wolf_pelt', 3), n: 'pelts' },
        { t: 'Need any help?', c: (g) => !g.quests.stageOf('sq_pelts'), n: 'peltq' },
        { t: 'Teach me about hunting.', n: 'teach' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    peltq: { t: 'Wolf pelts. Three. Wolves are thick in the Weald this year. Bring them and I\'ll give you something better than that.', o: [{ t: 'Deal.', n: 'end', d: (g) => g.quests.start('sq_pelts') }] },
    pelts: { t: 'Clean kills, too. Here — my old hunting spear, and arrows. Long reach keeps wolves honest.', o: [{ t: 'Thank you.', n: 'end', d: (g) => { g.inventory.remove('wolf_pelt', 3); g.quests.complete('sq_pelts'); } }] },
    teach: { t: 'Crouch [C] and the beasts hear less. Hit an unaware foe from hiding and you\'ll hit twice as hard — harder. Deer bolt; wolves circle; boars charge in a straight line, so step aside. And cook meat at a fire before you eat it.', o: [{ t: 'Good advice.', n: 'hub' }] },
  },
};

// ---------------------------------------------------------------- OSRIC (parley)
DLG.osric = {
  start: () => 'parley',
  nodes: {
    parley: {
      t: 'Well, well. A lantern in the woods. You walked through my front gate like you were invited. Speak quick, castaway — my lads are bored and I\'m curious.',
      o: [
        { t: 'You\'ve been stealing Greywater\'s medicine. Hand it back.', n: 'demand' },
        { t: 'Who pays you to rob herb-carts?', n: 'who' },
        { t: 'Garrick sends his regards.', c: (g) => flag(g, 'garrick_told'), n: 'garrick' },
      ],
    },
    demand: { t: 'Back? It\'s gone, friend. Sold. Delivered. Paid for. You\'re a few weeks too late and a few dozen men too few.', o: [{ t: 'Then who bought it?', n: 'who' }, { t: 'Then you\'ll pay in blood.', n: 'fight' }] },
    garrick: { t: 'Ha! That old badger still breathing? He\'s watched us for weeks. Never had the spine to come in. You, though… you might.', o: [{ t: 'Who pays you?', n: 'who' }, { t: 'Draw your sabre.', n: 'fight' }] },
    who: {
      t: 'Now that is a valuable question. I\'ve a letter in my coat that would answer it. Tell you what — a hundred and twenty crowns, and the letter\'s yours. Then I take my lads and sail for the mainland. Everyone lives.',
      o: [
        { t: '(Pay 120 crowns.)', c: (g) => g.player.gold >= 120, n: 'paid', d: (g) => { g.player.gold -= 120; } },
        { t: '[Might 4] "Or I take it off your corpse."', check: { attr: 'might', min: 4 }, n: 'cowed' },
        { t: 'I\'ll take it off your corpse.', n: 'fight' },
      ],
    },
    paid: { t: 'A pleasure doing business. Here. Read it somewhere I can\'t see your face. Lads! Pack it up — we\'re done with this soggy rock.', o: [{ t: '(Take the letter.)', n: 'end', d: (g) => { g.inventory.add('osric_letter', 1); g.osricLeaves(); } }] },
    cowed: { t: '…You mean it, don\'t you. I\'ve seen that look on men who don\'t lose. Fine. FINE. Take the cursed letter. My boys and I will find a softer kingdom.', o: [{ t: '(Take the letter.)', n: 'end', d: (g) => { g.inventory.add('osric_letter', 1); g.player.gainXp(60, 'Intimidation'); g.osricLeaves(); } }] },
    fight: { t: 'Pity. I liked you. LADS! Bleed the lantern-bearer!', o: [{ t: '(Fight.)', n: 'end', d: (g) => g.osricFight() }] },
  },
};

// ---------------------------------------------------------------- YSOLDE
DLG.ysolde = {
  start: (g) => {
    if (S(g, 'mq_gates') === 'travel') return 'meet';
    if (S(g, 'mq_gates') === 'deserters') return 'waiting';
    if (S(g, 'mq_gates') === 'ysolde') return 'pass';
    if (S(g, 'mq_draught') === 'choice') return 'choice';
    if (S(g, 'mq_draught') === 'confront') return 'confront';
    return 'hub';
  },
  nodes: {
    meet: {
      t: 'Halt. Caer Dawn is closed to outsiders by order of the Steward — quarantine. I\'m sorry, traveller, but you\'ll have to turn back.',
      o: [
        { t: 'I carry proof the Steward is starving the villages.', c: (g) => has(g, 'osric_letter'), n: 'letter' },
        { t: 'I need to speak with the Steward.', n: 'no' },
      ],
    },
    no: { t: 'Everyone needs to speak with the Steward. The Steward needs to speak with no one. Turn back.', o: [{ t: 'Wait — read this letter.', c: (g) => has(g, 'osric_letter'), n: 'letter' }, { t: 'Fine.', n: 'end' }] },
    letter: {
      t: '…"The Steward pays in silver. — H." Keep your voice down. I\'ve suspected for months. Half my Watch deserted when he cut their pay; the other half are his creatures. I can\'t move against him on one bandit\'s scrawl.',
      o: [{ t: 'Then what can you do?', n: 'deal' }],
    },
    deal: {
      t: 'I can let you in, with a writ of passage — if you earn it in front of my men. A band of deserters is camped on the East Road, robbing everyone who passes. Clear them out and no one will question your writ.',
      o: [{ t: 'Consider it done.', n: 'end', d: (g) => g.quests.setStage('mq_gates', 'deserters') }],
    },
    waiting: { t: 'The deserters\' camp, west along the East Road, near the river bridge. Come back when it\'s quiet.', o: [{ t: 'Understood.', n: 'end' }] },
    pass: {
      t: 'My scouts say the camp\'s a graveyard. Well done. Here is your writ. Go to the great hall and present yourself to the Steward — he\'ll want to see the castaway everyone\'s whispering about. And whatever he tells you… come to me after.',
      o: [{ t: 'I will, Captain.', n: 'end', d: (g) => { g.inventory.add('gate_pass', 1); set(g, 'cd_pass'); g.quests.setStage('mq_gates', 'steward'); } }],
    },
    hub: {
      t: 'Lantern-Bearer. The Watch has eyes on you — the good kind, mostly.',
      o: [
        { t: 'What do you know of the Steward?', n: 'steward' },
        { t: 'Any news?', n: 'news' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    steward: { t: 'Harlan was the king\'s treasurer before he was Steward. He counts everything. Coin, grain, men… and now medicine. Every poultice in the castle is under his seal. I\'d give a great deal to know why.', o: [{ t: 'Back.', n: 'hub' }] },
    news: { t: () => rumor(), o: [{ t: 'Back.', n: 'hub' }] },
    choice: {
      t: 'Is that… the cure? Maeve\'s Draught? By the dawn. With this, and the letter, and Corvin\'s journal, I can stand in front of the whole Watch and the Steward\'s own clerks and tell them what he did.',
      o: [
        { t: 'Then let\'s end his rule. Together.', c: (g) => has(g, 'osric_letter') && has(g, 'journal'), n: 'together' },
        { t: 'I need the letter and the journal first.', c: (g) => !(has(g, 'osric_letter') && has(g, 'journal')), n: 'end' },
        { t: 'I haven\'t decided yet.', n: 'end' },
      ],
    },
    together: { t: 'Meet me in the great hall. I\'ll bring every honest sword I have left. Bring the evidence — and keep your blade sheathed until I say otherwise.', o: [{ t: 'I\'ll be there.', n: 'end', d: (g) => { set(g, 'side_ysolde'); g.quests.setStage('mq_draught', 'confront'); } }] },
    confront: { t: 'The Watch is ready. Speak to the Steward. When he lies, I\'ll be the one holding the shackles.', o: [{ t: 'Let\'s go.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- HARLAN
DLG.harlan = {
  start: (g) => {
    if (S(g, 'mq_gates') === 'steward') return 'meet';
    if (S(g, 'mq_draught') === 'choice') return 'offer';
    if (S(g, 'mq_draught') === 'confront') return 'confront';
    if (D(g, 'mq_draught')) return 'after';
    return 'hub';
  },
  nodes: {
    meet: {
      t: 'The famous castaway. Forgive the quarantine — rules protect the many from the careless few. You\'ve made yourself useful, I hear. Bandits, deserters. Avalon needs useful people.',
      o: [
        { t: 'Why have the medicine carts stopped reaching the villages?', n: 'carts' },
        { t: 'What can be done about the Withering?', n: 'cure' },
      ],
    },
    carts: { t: 'Bandits, as you have seen. We send what we can. The castle\'s needs come first — if Caer Dawn falls, Avalon falls. Surely you understand that.', o: [{ t: 'What of a cure?', n: 'cure' }] },
    cure: {
      t: 'There is no cure. Physician Corvin believed otherwise. He went digging in the ruins of Kingsfall, chasing old scrolls, and never returned. If you truly wish to help… find him. Or what remains of his research.',
      o: [{ t: 'I\'ll go to Kingsfall.', n: 'end', d: (g) => g.quests.complete('mq_gates') }],
    },
    hub: { t: 'Order, castaway. Order is everything. Do you have business with the Steward?', o: [{ t: 'No, my lord.', n: 'end' }] },
    offer: {
      t: 'I hear Maeve of Greywater has brewed something remarkable. And that you carry it. Let me be plain: a cure belongs in the hands of the state, distributed with care, at a fair price. Give it to me, and you\'ll have five hundred crowns and a seat at my table.',
      o: [
        { t: '(Sell the Draught to Harlan.)', n: 'sold', d: (g) => { g.inventory.remove('grey_draught', 1); g.inventory.add('gold', 500); set(g, 'side_harlan'); } },
        { t: 'Not a chance.', n: 'end' },
      ],
    },
    sold: { t: 'A sensible soul, at last. Rest assured, the villages will receive the Draught — in due course. Once the treasury is restored. Off you go.', o: [{ t: '…', n: 'end', d: (g) => g.quests.complete('mq_draught') }] },
    confront: {
      t: 'Captain Ysolde. And the castaway. What is the meaning of this?',
      o: [{ t: 'You paid bandits to steal medicine, and jailed Corvin to hide the cure.', n: 'accuse' }],
    },
    accuse: {
      t: 'Lies. Forgeries. Who will believe a drowned nobody and a captain with an empty barracks? …Ysolde. Put that sword down. I am the Steward of Avalon.',
      o: [
        { t: 'Here is your letter, "H." And Corvin\'s own journal.', n: 'proof' },
      ],
    },
    proof: {
      t: '(The clerks lean in. The guards shift their feet. One by one, the Steward\'s men lower their halberds.) …You don\'t understand. Without control, there would be riots. Hoarding. I kept order. I KEPT ORDER!',
      o: [
        { t: 'Captain, he\'s yours.', n: 'arrest' },
        { t: 'Let him leave Avalon. Exile is punishment enough.', n: 'exile' },
      ],
    },
    arrest: { t: '(Ysolde snaps the shackles shut.) "Harlan, Steward of Avalon, you are under arrest in the name of the people you starved." (The hall erupts.)', o: [{ t: '(It is done.)', n: 'end', d: (g) => { set(g, 'harlan_arrested'); g.quests.complete('mq_draught'); } }] },
    exile: { t: '(Ysolde hesitates, then nods.) "Take him to Saltby. Put him on the first boat west. If he returns, he hangs." (Harlan says nothing as they lead him out.)', o: [{ t: '(It is done.)', n: 'end', d: (g) => { set(g, 'harlan_exiled'); g.quests.complete('mq_draught'); } }] },
    after: { t: (g) => flag(g, 'side_harlan') ? 'Ah, my friend. The treasury thanks you. The villages… will wait.' : '…', o: [{ t: 'Farewell.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- CORVIN
DLG.corvin = {
  start: (g) => {
    if (S(g, 'mq_kingsfall') === 'corvin') return 'cell';
    if (S(g, 'mq_kingsfall') === 'journal') return 'journal';
    if (S(g, 'mq_kingsfall') === 'report') return 'report';
    return 'hub';
  },
  nodes: {
    cell: {
      t: 'Light! Real light! Who — no, it doesn\'t matter. Malric is dead? Then help me up. I am Corvin, physician to the late king, and I have been in this hole for four months because I found the answer the Steward didn\'t want found.',
      o: [{ t: 'What answer?', n: 'answer' }],
    },
    answer: {
      t: 'The Withering is not a curse, whatever the fen-folk whisper. It is a fungus. Its spores ride the fog out of the Mire\'s heart. They root in lungs, in wheat, in wool. And fungus can be killed.',
      o: [{ t: 'How?', n: 'how' }],
    },
    how: {
      t: 'Two plants the spores cannot abide: Sunpetal, which grows only above the snowline on Highcrag, and Bitterroot, which grows in the very heart of the Mire. Brewed together, they make a draught that kills the threads in the blood. My notes are in the archive desk, through the west passage. Take them.',
      o: [{ t: 'And the Steward imprisoned you for this?', n: 'why' }],
    },
    why: { t: 'Harlan hoards every poultice in Avalon and sells relief to whoever bows lowest. A cure that anyone can brew would end that. So: Malric, chains, darkness. I\'ll make my own way to Greywater — Maeve and I trained together. Get the journal, and meet me there.', o: [{ t: 'Go safely.', n: 'end', d: (g) => { set(g, 'corvin_freed'); g.quests.setStage('mq_kingsfall', 'journal'); } }] },
    journal: { t: 'The archive is through the west passage. The desk, with the candle stubs. Go!', o: [{ t: 'Going.', n: 'end' }] },
    report: {
      t: 'You have the journal — good. Maeve has already boiled half her kitchen. Now listen: Sunpetal blooms on a high meadow past Ironhollow, above the snow. Bitterroot grows only at the Heart of the Mire, where the fog is thickest. You\'ll need a fen-mask for that — the folk of Stillwater make them.',
      o: [{ t: 'Sunpetal and Bitterroot. I\'ll bring both.', n: 'end', d: (g) => g.quests.complete('mq_kingsfall') }],
    },
    hub: { t: 'Wash your hands. Then we can talk about spores.', o: [{ t: 'Tell me about the Mire.', n: 'mire' }, { t: 'Farewell.', n: 'end' }] },
    mire: { t: 'Something at the Heart breathes out the fog. A rot in the deep peat, perhaps — I\'ve theories. The Draught will save the sick. But to end the Withering for good, someone will have to go deeper than the Heart. Not this year, I think.', o: [{ t: 'Back.', n: 'hub' }] },
  },
};

// ---------------------------------------------------------------- ELOWEN
DLG.elowen = {
  start: (g) => S(g, 'sq_pages') === 'back' ? 'all' : 'hub',
  nodes: {
    hub: {
      t: 'The Chronicle of Avalon. Eight hundred years of kings, in one book — and some vandal tore out the last eight pages and scattered them. If you find any, bring them to me.',
      o: [
        { t: 'I\'ll keep an eye out.', c: (g) => !g.quests.stageOf('sq_pages'), n: 'end', d: (g) => g.quests.start('sq_pages') },
        { t: 'What\'s in the missing pages?', n: 'what' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    what: { t: 'The last years of King Aldric, mostly. Including — so the index claims — the line of succession. Who his heir is. You can imagine why someone might want those pages lost.', o: [{ t: 'Back.', n: 'hub' }] },
    all: {
      t: 'All eight! Let me see… "…and the king, knowing his illness, sent his only child across the sea for safety, bearing the royal lantern…" The royal lantern. Lantern-Bearer. Where did you say you washed ashore?',
      o: [{ t: '…I don\'t remember.', n: 'all2' }],
    },
    all2: { t: 'Hm. Perhaps a coincidence. Perhaps not. Here — payment, as promised. And come back when you remember more. I\'d very much like to talk to you again.', o: [{ t: 'I will.', n: 'end', d: (g) => { for (let i = 1; i <= 8; i++) g.inventory.remove('page' + i, 1); g.quests.complete('sq_pages'); set(g, 'heir_hint'); } }] },
  },
};

// ---------------------------------------------------------------- PELL
DLG.pell = {
  start: (g) => S(g, 'sq_bounty') === 'back' ? 'claim' : 'hub',
  nodes: {
    hub: {
      t: 'Bounty board\'s mostly empty. Folk can\'t afford to pay for heroes. Except one — the Watch\'ll pay a hundred and fifty crowns for the hide of Grimtooth, the great bear on the High Pass.',
      o: [
        { t: 'I\'ll take the bounty.', c: (g) => !g.quests.stageOf('sq_bounty'), n: 'end', d: (g) => g.quests.start('sq_bounty') },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    claim: { t: 'Grimtooth? Dead? The lads didn\'t believe me when I said you\'d do it. Here\'s your bounty.', o: [{ t: 'Pleasure.', n: 'end', d: (g) => g.quests.complete('sq_bounty') }] },
  },
};

// ---------------------------------------------------------------- STILLWATER
DLG.odran = {
  start: () => 'hub',
  nodes: {
    hub: { t: 'Welcome to Stillwater, dry-foot. We live on the boards because the ground here eats boots, and sometimes men. What brings you into the fen?', o: [{ t: 'I need to reach the Heart of the Mire.', n: 'heart' }, { t: 'Tell me about the fog.', n: 'fog' }, { t: 'Farewell.', n: 'end' }] },
    heart: { t: 'Then you need Nessa\'s mask, and a strong arm. A brute calls himself king of the Heart now — Gorm. Taller than a door, and he takes our catch as tribute. Kill him and the fen will sing your name.', o: [{ t: 'Back.', n: 'hub' }] },
    fog: { t: 'Our grandmothers called it the Wyrd-breath, and said the drowned were angry. Your physician says spores. I say: it kills either way. We burn comfrey in the masks and keep living.', o: [{ t: 'Back.', n: 'hub' }] },
  },
};
DLG.nessa = {
  start: (g) => S(g, 'mq_mire') === 'stillwater' ? 'meet' : S(g, 'mq_mire') === 'mask' ? 'mask' : 'hub',
  shop: 'fen',
  nodes: {
    meet: { t: 'A mask for the Heart? Ha. I\'ve made forty masks. Thirty-one came back. Comfrey filters keep the spores out of your lungs, but only for a few minutes each.', o: [{ t: 'What do you need to make one?', n: 'need' }] },
    need: { t: 'Three comfrey — purple flowers, grows on the moors — and two clean linen. Or eighty crowns, and I use my own.', o: [{ t: 'I\'ll gather the materials.', n: 'end', d: (g) => g.quests.setStage('mq_mire', 'mask') }] },
    mask: {
      t: 'Got my comfrey? Or my crowns?',
      o: [
        { t: 'Here: 3 comfrey and 2 linen.', c: (g) => has(g, 'comfrey', 3) && has(g, 'linen', 2), n: 'made', d: (g) => { g.inventory.remove('comfrey', 3); g.inventory.remove('linen', 2); } },
        { t: '(Pay 80 crowns.)', c: (g) => g.player.gold >= 80, n: 'made', d: (g) => { g.player.gold -= 80; } },
        { t: 'Not yet.', n: 'end' },
      ],
    },
    made: { t: 'There. Fen-mask, and three filters. Use a filter [X] when you smell the rot — it lasts about two minutes. Buy more from Lio or brew them: two comfrey, one linen, at a fire. Don\'t die.', o: [{ t: 'Thank you, Nessa.', n: 'end', d: (g) => { g.inventory.add('fog_mask', 1); g.inventory.add('mask_filter', 3); g.quests.setStage('mq_mire', 'heart'); } }] },
    hub: { t: 'Need filters? I\'ve a few.', o: [{ t: 'Trade.', n: 'shop' }, { t: 'Farewell.', n: 'end' }] },
  },
};

// ---------------------------------------------------------------- SALTBY & LIGHTHOUSE
DLG.aldo = {
  start: (g) => S(g, 'sq_net') === 'back' ? 'back' : A(g, 'sq_net') ? 'waiting' : D(g, 'sq_net') ? 'after' : 'hub',
  nodes: {
    hub: { t: 'Storm took my best net. Saw it tangled on the wreck of the Merrow, west along the beach — but I\'m too old to climb wet timber, and the tide\'s cruel there.', o: [{ t: 'I\'ll fetch it.', n: 'end', d: (g) => g.quests.start('sq_net') }, { t: 'A hard loss.', n: 'end' }] },
    waiting: { t: 'West along the shore. The Merrow. Mind the gulls; they bite.', o: [{ t: 'Right.', n: 'end' }] },
    back: { t: 'My net! Barely a tear. Here — fresh grilled trout, and coin. You\'ve a fisherman\'s heart.', o: [{ t: 'Good fishing, Aldo.', n: 'end', d: (g) => { g.inventory.remove('net', 1); g.quests.complete('sq_net'); } }] },
    after: { t: 'Caught a pike this morning. Ugly beast. Delicious.', o: [{ t: 'Farewell.', n: 'end' }] },
  },
};
DLG.ines = {
  start: () => 'hub', shop: 'coast',
  nodes: {
    hub: { t: 'Salt, oil, twine. What do you need?', o: [{ t: 'Trade.', n: 'shop' }, { t: 'Morwen needs lamp oil for the lighthouse.', c: (g) => S(g, 'sq_light') === 'oil' && !has(g, 'lamp_oil'), n: 'oil' }, { t: 'Farewell.', n: 'end' }] },
    oil: { t: 'For the light? Take it — no charge. My brother\'s boat was the second one lost on Gull Point rocks.', o: [{ t: 'Thank you.', n: 'end', d: (g) => g.inventory.add('lamp_oil', 1) }] },
  },
};
DLG.morwen = {
  start: (g) => S(g, 'sq_light') === 'back' ? 'back' : A(g, 'sq_light') ? 'waiting' : D(g, 'sq_light') ? 'after' : 'hub',
  nodes: {
    hub: { t: 'The light at Gull Point has burned for two hundred years. It went dark the week the Steward stopped sending oil. Three ships have broken on the rocks since. Will you fetch oil from Ines in Saltby?', o: [{ t: 'I will.', n: 'end', d: (g) => g.quests.start('sq_light') }, { t: 'Not now.', n: 'end' }] },
    waiting: { t: (g) => has(g, 'lamp_oil') ? 'Pour it into the reservoir at the foot of the tower — the old wick-pump carries it up to the great lamp. My knees won\'t take the stair any more.' : 'Ines, in Saltby. She\'ll have oil.', o: [{ t: 'Right.', n: 'end' }] },
    back: { t: 'I saw it from the cottage. Burning again. Take my old brass lantern — it was my father\'s. It\'s right that a lantern-bearer should have it.', o: [{ t: 'Thank you, Morwen.', n: 'end', d: (g) => g.quests.complete('sq_light') }] },
    after: { t: 'No ships lost this week.', o: [{ t: 'Good.', n: 'end' }] },
  },
};
DLG.durk = {
  start: (g) => S(g, 'sq_mine') === 'back' ? 'back' : 'hub', shop: 'miner',
  nodes: {
    hub: {
      t: 'Ironhollow. Best ore on the isle. Brigands squatting in the deep tunnels though — my lads won\'t go down. Can\'t sell ore I can\'t dig.',
      o: [
        { t: 'I\'ll clear the tunnels.', c: (g) => !g.quests.stageOf('sq_mine'), n: 'end', d: (g) => g.quests.start('sq_mine') },
        { t: 'Sell me some ore.', n: 'shop' },
        { t: 'Farewell.', n: 'end' },
      ],
    },
    back: { t: 'Clear? Truly? Then the forges of Avalon owe you. Take this, and some ore besides.', o: [{ t: 'Glad to help.', n: 'end', d: (g) => g.quests.complete('sq_mine') }] },
  },
};

// ---------------------------------------------------------------- generic villager
DLG.villager = {
  start: () => 'hub',
  nodes: {
    hub: {
      t: (g, a) => (a.npc && a.npc.line) || 'Hm? Oh — you\'re the castaway.',
      o: [{ t: 'Heard any rumours?', n: 'rumor' }, { t: 'Farewell.', n: 'end' }],
    },
    rumor: { t: () => rumor(), o: [{ t: 'Thanks.', n: 'end' }] },
  },
};
