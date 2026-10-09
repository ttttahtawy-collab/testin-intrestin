// Species / archetype definitions for creatures and enemies.
// speed in voxels/s (2 voxels = 1 m)

const A = {};
export const ACTORS = A;

const sw = (o) => ({ windup: 0.45, active: 0.15, recover: 0.5, mult: 1, reach: 3.6, arc: 1.2, type: 'swing', anim: 'swing', ...o });

A.wolf = { name: 'Grey Wolf', model: 'wolf', ai: 'melee', faction: 'beast', hp: 42, dmg: 8, armor: 0, walk: 4, run: 14, radius: 0.6, height: 2.0, sight: 26, xp: 22, loot: 'wolf', poise: 20, nightAggro: true,
  attacks: [sw({ windup: 0.35, reach: 3.0, type: 'lunge', lunge: 12, anim: 'bite' }), sw({ windup: 0.55, reach: 3.4, mult: 1.4, type: 'lunge', lunge: 16, anim: 'bite' })], sounds: 'wolf', pack: true, fleeHp: 0.15 };
A.plaguehound = { ...A.wolf, name: 'Plague-Hound', model: 'plaguehound', hp: 58, dmg: 11, xp: 34, loot: 'plaguehound', run: 13.5, sight: 28, nightAggro: false, fleeHp: 0, rot: true };
A.boar = { name: 'Wild Boar', model: 'boar', ai: 'melee', faction: 'beast', hp: 64, dmg: 12, armor: 2, walk: 3, run: 13, radius: 0.7, height: 1.8, sight: 14, xp: 28, loot: 'boar', poise: 35, territorial: 9,
  attacks: [sw({ windup: 0.5, reach: 3.2, type: 'charge', charge: 1.1, speed: 17, mult: 1.3, anim: 'bite' }), sw({ windup: 0.35, reach: 2.8, anim: 'bite' })], sounds: 'boar' };
A.bear = { name: 'Brown Bear', model: 'bear', ai: 'melee', faction: 'beast', hp: 160, dmg: 21, armor: 3, walk: 3.5, run: 12, radius: 1.0, height: 3.2, sight: 18, xp: 75, loot: 'bear', poise: 80, territorial: 14,
  attacks: [sw({ windup: 0.6, reach: 4.0, arc: 1.4, anim: 'maul' }), sw({ windup: 0.9, reach: 4.4, mult: 1.7, arc: 1.8, unblockable: true, anim: 'maul' })], sounds: 'bear' };
A.grimtooth = { ...A.bear, name: 'Grimtooth', model: 'grimtooth', hp: 440, dmg: 28, armor: 6, xp: 380, loot: 'bear', poise: 160, radius: 1.4, height: 4.4, boss: true, territorial: 30, sight: 30,
  attacks: [sw({ windup: 0.6, reach: 5.0, arc: 1.5, anim: 'maul' }), sw({ windup: 1.0, reach: 5.6, mult: 1.8, arc: 2.2, unblockable: true, anim: 'maul' }), sw({ windup: 0.8, reach: 7, type: 'roar', mult: 0, anim: 'roar' })] };
A.rat = { name: 'Giant Rat', model: 'rat', ai: 'melee', faction: 'beast', hp: 14, dmg: 4, armor: 0, walk: 3, run: 10, radius: 0.35, height: 0.8, sight: 14, xp: 6, loot: 'rat', poise: 5,
  attacks: [sw({ windup: 0.3, reach: 2.2, type: 'lunge', lunge: 8, anim: 'bite' })], sounds: 'rat' };

// humanoids
const BANDIT_APPS = [
  { top: 0x5a4a3a, topStyle: 'vest', shirt: 0x8a7a6a, legs: 0x3a3028, hood: 0x3a3a30, beard: 'stubble' },
  { top: 0x4a3a2a, topStyle: 'tunic', legs: 0x2a2a24, hairStyle: 'short', hair: 0x2a1a10, beard: 'full' },
  { top: 0x6a2a20, topStyle: 'vest', shirt: 0x6a6050, legs: 0x3a3028, helmet: 'cap', beard: 'mustache' },
  { top: 0x3a4030, topStyle: 'coat', legs: 0x2a2a24, hood: 0x2a3020 },
];
A.bandit = { name: 'Bandit', model: 'human', apps: BANDIT_APPS, weapon: 'sword_rusty', ai: 'melee', faction: 'bandit', hp: 62, dmg: 10, armor: 4, walk: 4.5, run: 11.5, radius: 0.4, height: 3.5, sight: 26, xp: 32, loot: 'bandit_body', poise: 30,
  attacks: [sw({}), sw({ windup: 0.75, mult: 1.6, anim: 'overhead', stagger: 1.3 })], barks: 'bandit', blockChance: 0.15 };
A.bandit_archer = { ...A.bandit, name: 'Bandit Archer', weapon: 'bow_hunting', ai: 'archer', hp: 46, dmg: 9, xp: 34, quiver: true, attacks: [{ type: 'shoot', windup: 1.1, recover: 0.8, mult: 1, reach: 40 }], blockChance: 0 };
A.osric = { ...A.bandit, name: 'Red Osric', apps: [{ top: 0x7a1a1a, topStyle: 'coat', fur: 0x3a2a1a, cloak: 0x6a1010, legs: 0x2a2020, hair: 0x8a3a1a, beard: 'full', beardColor: 0x8a3a1a }], weapon: 'sword_red', hp: 270, dmg: 15, armor: 8, xp: 300, boss: true, poise: 90, run: 12.5,
  attacks: [sw({ windup: 0.32, recover: 0.25, combo: 3 }), sw({ windup: 0.7, mult: 1.8, anim: 'overhead', stagger: 1.5 }), sw({ windup: 0.5, type: 'lunge', lunge: 18, mult: 1.3 })], blockChance: 0.25, unique: 'osric', loot: null };
A.deserter = { name: 'Deserter', model: 'human', apps: [
  { topStyle: 'mail', tabard: 0x4a1a1a, topTrim: 0x2a2a2e, helmet: 'kettle', beard: 'stubble' },
  { topStyle: 'mail', tabard: 0x3a3a3a, topTrim: 0x2a2a2e, helmet: 'coif' },
  { topStyle: 'plate', tabard: 0x4a1a1a, helmet: 'kettle' },
], weapon: 'sword_militia', shield: 'shield_deserter', ai: 'melee', faction: 'deserter', hp: 92, dmg: 14, armor: 10, walk: 4, run: 10.5, radius: 0.42, height: 3.5, sight: 26, xp: 52, loot: 'deserter_body', poise: 55,
  attacks: [sw({}), sw({ windup: 0.85, mult: 1.7, anim: 'overhead', stagger: 1.4 }), sw({ windup: 0.5, type: 'bash', reach: 3.0, mult: 0.6, stagger: 2 })], barks: 'deserter', blockChance: 0.45 };
A.malric = { ...A.deserter, name: 'Ser Malric the Oathless', apps: [{ topStyle: 'plate', tabard: 0x1a1a1a, topTrim: 0x6a1a1a, helmet: 'bascinet', cloak: 0x2a1010 }], weapon: 'sword_oath', shield: null, hp: 400, dmg: 23, armor: 18, xp: 450, boss: true, poise: 140, radius: 0.5, scale: 1.12, height: 3.9,
  attacks: [sw({ windup: 0.55, reach: 4.6, combo: 2 }), sw({ windup: 1.0, mult: 1.9, anim: 'overhead', reach: 4.8, stagger: 2, unblockable: true }), sw({ windup: 0.6, type: 'lunge', lunge: 20, mult: 1.4, reach: 4.4 })], blockChance: 0.35, unique: 'malric', loot: null };
A.brute = { name: 'Mire Brute', model: 'human', apps: [{ top: 0x4a4a3a, topStyle: 'apron', apron: 0x3a2a1a, legs: 0x3a3028, skin: 0x9a8a7a, hairStyle: 'bald', beard: 'full', beardColor: 0x3a3028, scale: 1.45 }],
  weapon: 'club_gorm', ai: 'melee', faction: 'brute', hp: 170, dmg: 24, armor: 6, walk: 3.6, run: 9, radius: 0.6, height: 5.0, sight: 22, xp: 85, loot: 'brute_body', poise: 110,
  attacks: [sw({ windup: 0.8, reach: 4.6, anim: 'overhead' }), sw({ windup: 1.2, reach: 6, type: 'slam', radius: 5, mult: 1.5, unblockable: true, anim: 'overhead' })], barks: 'brute' };
A.gorm = { ...A.brute, name: 'Gorm the Mire-King', apps: [{ top: 0x3a3a2a, topStyle: 'coat', fur: 0x5a4a3a, legs: 0x2a2a20, skin: 0x8a7a6a, hairStyle: 'bald', beard: 'full', beardColor: 0x2a2a20, scale: 1.85 }],
  hp: 540, dmg: 30, armor: 10, xp: 550, boss: true, poise: 220, radius: 0.8, height: 6.4, unique: 'gorm', loot: null,
  attacks: [sw({ windup: 0.75, reach: 6, arc: 1.6, anim: 'overhead' }), sw({ windup: 1.25, reach: 8, type: 'slam', radius: 7, mult: 1.6, unblockable: true, anim: 'overhead' }), sw({ windup: 0.9, reach: 5.5, mult: 1.2, arc: 2.4 })] };
A.brigand = { ...A.bandit, name: 'Mine Brigand', weapon: 'pick_miner', hp: 70, dmg: 12, xp: 38, loot: 'brigand_body', apps: [{ top: 0x5a5048, topStyle: 'apron', apron: 0x3a2a1a, helmet: 'cap', capColor: 0x3a3a30, beard: 'full', beardColor: 0x3a2a1a }] };
A.guard = { name: 'Watchman', model: 'human', apps: [{ topStyle: 'mail', tabard: 0x23406e, topTrim: 0xb08a2a, helmet: 'kettle' }], weapon: 'sword_militia', shield: 'shield_dawn', ai: 'guard', faction: 'town', hp: 140, dmg: 14, armor: 12, walk: 4, run: 10, radius: 0.42, height: 3.5, sight: 24, xp: 0, poise: 80,
  attacks: [sw({}), sw({ windup: 0.8, mult: 1.6, anim: 'overhead' })], blockChance: 0.4 };

// wildlife & livestock
A.deer = { name: 'Red Deer', model: 'deer', ai: 'prey', faction: 'prey', hp: 30, walk: 3, run: 17, radius: 0.6, height: 3.0, sight: 24, xp: 10, loot: 'deer', skittish: 18 };
A.rabbit = { name: 'Hare', model: 'rabbit', ai: 'prey', faction: 'prey', hp: 6, walk: 2, run: 15, radius: 0.3, height: 0.7, sight: 14, xp: 3, loot: 'rabbit', skittish: 9, hop: true };
A.goat = { name: 'Mountain Goat', model: 'goat', ai: 'prey', faction: 'prey', hp: 24, walk: 2.5, run: 13, radius: 0.5, height: 2.0, sight: 18, xp: 6, loot: 'deer', skittish: 12 };
A.sheep = { name: 'Sheep', model: 'sheep', ai: 'livestock', faction: 'neutral', hp: 20, walk: 1.5, run: 8, radius: 0.55, height: 1.6, xp: 0, skittish: 4 };
A.cow = { name: 'Cow', model: 'cow', ai: 'livestock', faction: 'neutral', hp: 40, walk: 1.2, run: 6, radius: 0.8, height: 2.6, xp: 0, skittish: 3 };
A.chicken = { name: 'Hen', model: 'chicken', ai: 'livestock', faction: 'neutral', hp: 4, walk: 1.8, run: 7, radius: 0.25, height: 0.8, xp: 0, skittish: 5, peck: true };
A.duck = { name: 'Mallard', model: 'duck', ai: 'duck', faction: 'neutral', hp: 4, walk: 1.5, run: 6, radius: 0.25, height: 0.6, xp: 0, skittish: 7 };
A.crow = { name: 'Crow', model: 'crow', ai: 'bird', faction: 'neutral', hp: 3, walk: 1.5, run: 14, radius: 0.2, height: 0.6, xp: 0, skittish: 11, peck: true };
A.cat = { name: 'Cat', model: 'cat', ai: 'pet', faction: 'neutral', hp: 6, walk: 2, run: 9, radius: 0.25, height: 0.9, xp: 0, skittish: 0 };
A.dog = { name: 'Dog', model: 'dog', ai: 'pet', faction: 'neutral', hp: 30, walk: 3, run: 12, radius: 0.45, height: 1.6, xp: 0, skittish: 0 };

export const HOSTILE_FACTIONS = new Set(['beast', 'bandit', 'deserter', 'brute']);
