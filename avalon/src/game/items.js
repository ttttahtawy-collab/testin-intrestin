// Item catalogue.
import { SHAPE_OF } from './itemshapes.js';

export const ITEMS = {};
function it(id, o) { ITEMS[id] = { id, stack: false, value: 1, rarity: 'common', ...o }; SHAPE_OF[id] = o.shape; }

// ---- weapons (main hand) ----
it('sword_rusty', { name: 'Rusty Shortsword', type: 'weapon', slot: 'main', shape: 'sword_rusty', value: 8, dmg: 9, speed: 1.0, reach: 4.6, stam: 14,
  desc: 'Notched, pitted, and still the best friend you have on the road.' });
it('knife_hunting', { name: 'Hunting Knife', type: 'weapon', slot: 'main', shape: 'knife', value: 12, dmg: 7, speed: 1.45, reach: 3.8, stam: 9,
  desc: 'Quick and quiet. Skins a hare or settles an argument.' });
it('axe_wood', { name: "Woodsman's Axe", type: 'weapon', slot: 'main', shape: 'axe', value: 22, dmg: 15, speed: 0.78, reach: 4.6, stam: 20, stagger: 1.3,
  desc: 'Meant for oak, not men. It does not seem to know the difference.' });
it('sword_militia', { name: 'Militia Sword', type: 'weapon', slot: 'main', shape: 'sword_militia', value: 45, dmg: 14, speed: 1.0, reach: 4.8, stam: 14, rarity: 'uncommon',
  desc: 'Plain steel issued to the Greywater watch. Well balanced, well loved.' });
it('hammer_smith', { name: "Brannoc's Hammer", type: 'weapon', slot: 'main', shape: 'hammer', value: 60, dmg: 19, speed: 0.72, reach: 4.4, stam: 22, stagger: 1.8, rarity: 'uncommon',
  desc: 'A forge hammer re-hafted for war. Shields crack beneath it.' });
it('spear_hunter', { name: "Hunter's Spear", type: 'weapon', slot: 'main', shape: 'spear', value: 55, dmg: 15, speed: 0.95, reach: 6.0, stam: 15, rarity: 'uncommon',
  desc: 'Long reach keeps the wolves at a respectful distance.' });
it('sword_knight', { name: 'Caer Dawn Longsword', type: 'weapon', slot: 'main', shape: 'sword_knight', value: 140, dmg: 20, speed: 1.0, reach: 5.2, stam: 15, rarity: 'rare',
  desc: 'Forged in the castle smithy and stamped with the dawn-star of the old house.' });
it('sword_red', { name: "Red Fang", type: 'weapon', slot: 'main', shape: 'sword_red', value: 180, dmg: 22, speed: 1.15, reach: 5.0, stam: 13, rarity: 'epic',
  desc: "Osric's sabre. Its guard is wrapped in red leather, dark where his hand once sweated." });
it('sword_oath', { name: 'Oathbreaker', type: 'weapon', slot: 'main', shape: 'sword_oath', value: 260, dmg: 30, speed: 0.82, reach: 5.6, stam: 22, stagger: 1.6, rarity: 'epic',
  desc: 'Ser Malric swore on this blade to defend the king. He kept the blade.' });
it('club_gorm', { name: "Gorm's Cudgel", type: 'weapon', slot: 'main', shape: 'club', value: 120, dmg: 26, speed: 0.65, reach: 4.8, stam: 26, stagger: 2.2, rarity: 'rare',
  desc: 'A young oak with the roots knocked off. Heavier than it has any right to be.' });
it('pick_miner', { name: "Miner's Pick", type: 'weapon', slot: 'main', shape: 'pick', value: 20, dmg: 12, speed: 0.85, reach: 4.4, stam: 17,
  desc: 'Bites stone and bone alike.' });

// ---- off hand ----
it('shield_plank', { name: 'Plank Shield', type: 'shield', slot: 'off', shape: 'shield_plank', value: 10, block: 0.6, armor: 1,
  desc: 'Three boards and a hope. Better than nothing, but only just.' });
it('shield_iron', { name: 'Iron-Banded Shield', type: 'shield', slot: 'off', shape: 'shield_iron', value: 55, block: 0.75, armor: 2, rarity: 'uncommon',
  desc: 'Oak bound with iron straps. Takes a blow and asks for another.' });
it('shield_dawn', { name: 'Dawn-Star Heater', type: 'shield', slot: 'off', shape: 'shield_dawn', value: 150, block: 0.88, armor: 4, rarity: 'rare',
  desc: 'The blue and gold of Caer Dawn. Commoners step aside when they see it.' });
it('shield_deserter', { name: "Deserter's Shield", type: 'shield', slot: 'off', shape: 'shield_deserter', value: 70, block: 0.8, armor: 3, rarity: 'uncommon',
  desc: 'Its crest has been scraped off with a knife.' });
it('lantern_tin', { name: 'Tin Lantern', type: 'light', slot: 'off', shape: 'lantern', value: 15, light: 60,
  desc: 'A smoky little flame behind dented tin. The dark is a little less sure of itself.' });
it('lantern_brass', { name: 'Brass Lantern', type: 'light', slot: 'off', shape: 'lantern_brass', value: 60, light: 95, rarity: 'uncommon',
  desc: 'Polished brass and clear glass. Throws light twice as far as tin.' });

// ---- bows (on the back) ----
it('bow_hunting', { name: 'Hunting Bow', type: 'bow', slot: 'back', shape: 'bow_hunting', value: 30, dmg: 12, draw: 0.75,
  desc: 'Ash and gut string. Fine for deer; adequate for men.' });
it('bow_yew', { name: 'Yew Longbow', type: 'bow', slot: 'back', shape: 'bow_yew', value: 120, dmg: 20, draw: 0.95, rarity: 'rare',
  desc: 'Taller than a boy and twice as stubborn. Draws slowly, hits like a mule.' });
it('arrow', { name: 'Arrows', type: 'ammo', shape: 'arrows', value: 1, stack: true, desc: 'Goose-fletched, iron-tipped.' });

// ---- body ----
it('tunic_tattered', { name: 'Tattered Tunic', type: 'body', slot: 'body', shape: 'tunic', value: 2, armor: 2, app: { top: 0x7a6a4a, topStyle: 'tunic' },
  desc: 'Salt-stiff and torn at the shoulder. You woke up wearing it.' });
it('gambeson', { name: 'Padded Gambeson', type: 'body', slot: 'body', shape: 'gambeson', value: 35, armor: 7, app: { top: 0xb8a888, topStyle: 'coat', topTrim: 0x8a7a5a },
  desc: 'Twenty layers of quilted linen. Warm, and it stops more than you would think.' });
it('jerkin', { name: 'Leather Jerkin', type: 'body', slot: 'body', shape: 'jerkin', value: 45, armor: 9, stamBonus: 10, app: { top: 0x6a4a2a, topStyle: 'vest', shirt: 0xc8b898 },
  desc: 'Boiled leather that moves with you. Favoured by hunters and thieves.' });
it('ranger_coat', { name: "Ranger's Coat", type: 'body', slot: 'body', shape: 'coat', value: 90, armor: 11, stamBonus: 20, rarity: 'uncommon', app: { top: 0x3a4a3a, topStyle: 'coat', fur: 0x8a7a5a },
  desc: 'Waxed wool lined with fox fur. The rain beads and runs off it.' });
it('mail', { name: 'Mail Hauberk', type: 'body', slot: 'body', shape: 'mail', value: 160, armor: 16, rarity: 'rare', app: { topStyle: 'mail', tabard: 0x23406e, topTrim: 0xb08a2a },
  desc: 'Riveted rings over a blue tabard of Caer Dawn. Heavy, and worth every ounce.' });
it('plate_deserter', { name: "Deserter's Plate", type: 'body', slot: 'body', shape: 'plate', value: 220, armor: 21, rarity: 'epic', app: { topStyle: 'plate', tabard: 0x4a1a1a, topTrim: 0x2a2a2e },
  desc: 'A knight\'s harness, the heraldry burned away. It still remembers how to turn a blade.' });

// ---- head ----
it('hood', { name: 'Wool Hood', type: 'head', slot: 'head', shape: 'hood', value: 5, armor: 1, app: { hood: 0x4a4a3a },
  desc: 'Keeps the drizzle off your neck and your face out of other people\'s business.' });
it('cap_leather', { name: 'Leather Cap', type: 'head', slot: 'head', shape: 'cap', value: 15, armor: 3, app: { helmet: 'cap', capColor: 0x5a3a24 },
  desc: 'Stiffened leather with a wool lining.' });
it('kettle_helm', { name: 'Kettle Helm', type: 'head', slot: 'head', shape: 'kettle', value: 60, armor: 6, rarity: 'uncommon', app: { helmet: 'kettle' },
  desc: 'A wide iron brim. Arrows and rain both slide off.' });
it('bascinet', { name: 'Knight\'s Bascinet', type: 'head', slot: 'head', shape: 'bascinet', value: 150, armor: 10, rarity: 'rare', app: { helmet: 'bascinet' },
  desc: 'A visored helm. You will see less of the world, and it will see less of you.' });

// ---- belt (practical gear, no talismans) ----
it('belt_hunter', { name: "Hunter's Belt", type: 'belt', slot: 'belt', shape: 'belt', value: 30, bowBonus: 0.15, rarity: 'uncommon',
  desc: 'Loops for knives, a pouch for arrowheads. Your shots land a little truer.' });
it('belt_herbalist', { name: "Herbalist's Satchel", type: 'belt', slot: 'belt', shape: 'satchel', value: 40, healBonus: 0.35, rarity: 'uncommon',
  desc: 'Compartments for every leaf. Remedies you prepare go further.' });
it('belt_soldier', { name: "Soldier's Girdle", type: 'belt', slot: 'belt', shape: 'belt', value: 50, stamBonus: 20, rarity: 'uncommon',
  desc: 'A broad belt that braces the back. You can swing longer before you tire.' });
it('belt_knight', { name: 'Sword Belt of the Watch', type: 'belt', slot: 'belt', shape: 'belt', value: 90, dmgBonus: 0.1, armor: 2, rarity: 'rare',
  desc: 'Well-worn leather with a brass buckle. Your grip is surer with it on.' });

// ---- remedies ----
it('poultice', { name: 'Herbal Poultice', type: 'consumable', shape: 'poultice', value: 12, stack: true, use: { hot: 40, dur: 4 },
  desc: 'Yarrow and comfrey mashed into linen. Pressed to a wound, it stops the bleeding and soothes the ache.' });
it('bandage', { name: 'Linen Bandage', type: 'consumable', shape: 'bandage', value: 6, stack: true, use: { heal: 18 },
  desc: 'Clean linen, tightly rolled.' });
it('tonic', { name: 'Willowbark Tonic', type: 'consumable', shape: 'tonic', value: 25, stack: true, use: { hot: 70, dur: 6 }, rarity: 'uncommon',
  desc: 'Bitter as regret. Eases pain and steadies the heart.' });
it('tea_marigold', { name: 'Marigold Tea', type: 'consumable', shape: 'tea', value: 8, stack: true, use: { stamRegen: 1.8, dur: 40 },
  desc: 'Warm and golden. Your breath comes easier for a while.' });
it('mask_filter', { name: 'Fog-Mask Filter', type: 'consumable', shape: 'mask', value: 15, stack: true, use: { mask: 120 },
  desc: 'Comfrey-soaked linen for a fen mask. Keeps the Withering fog out of your lungs for two minutes.' });

// ---- provisions ----
it('bread', { name: 'Rye Bread', type: 'food', shape: 'bread', value: 3, stack: true, use: { hot: 15, dur: 10 }, desc: 'Dense and sour. Fills the belly.' });
it('apple', { name: 'Apple', type: 'food', shape: 'apple', value: 2, stack: true, use: { hot: 8, dur: 5 }, desc: 'Small, red and a little wrinkled.' });
it('berries', { name: 'Hedge Berries', type: 'food', shape: 'berries', value: 1, stack: true, use: { hot: 6, dur: 4 }, desc: 'Tart and dark. Stains your fingers.' });
it('venison_raw', { name: 'Raw Venison', type: 'food', shape: 'meat', value: 4, stack: true, use: { hot: 5, dur: 5 }, cook: 'venison', desc: 'Cook it over a fire first.' });
it('venison', { name: 'Roast Venison', type: 'food', shape: 'meat_cooked', value: 10, stack: true, use: { hot: 45, dur: 12 }, desc: 'Charred outside, tender within.' });
it('hare_raw', { name: 'Raw Hare', type: 'food', shape: 'meat', value: 2, stack: true, use: { hot: 3, dur: 5 }, cook: 'hare', desc: 'Cook it over a fire first.' });
it('hare', { name: 'Roast Hare', type: 'food', shape: 'meat_cooked', value: 6, stack: true, use: { hot: 25, dur: 10 }, desc: 'Lean and smoky.' });
it('fish_raw', { name: 'Raw Trout', type: 'food', shape: 'fish', value: 3, stack: true, use: { hot: 4, dur: 5 }, cook: 'fish', desc: 'Still cold from the water.' });
it('fish', { name: 'Grilled Trout', type: 'food', shape: 'fish_cooked', value: 8, stack: true, use: { hot: 30, dur: 10 }, desc: 'Flaky and salted.' });
it('stew', { name: 'Fen Stew', type: 'food', shape: 'stew', value: 14, stack: true, use: { hot: 60, dur: 15 }, desc: 'Whatever was in the pot. Warm, which is what matters.' });
it('mushroom', { name: 'Brown Cap', type: 'food', shape: 'mushroom', value: 2, stack: true, use: { hot: 6, dur: 4 }, desc: 'An honest mushroom. Safe to eat.' });

// ---- materials ----
it('yarrow', { name: 'Yarrow', type: 'ingredient', shape: 'herb', value: 3, stack: true, desc: 'White-flowered wound-wort. The base of most poultices.' });
it('comfrey', { name: 'Comfrey', type: 'ingredient', shape: 'herb_purple', value: 3, stack: true, desc: 'Knitbone. Soothes and filters.' });
it('marigold', { name: 'Marigold', type: 'ingredient', shape: 'herb_yellow', value: 3, stack: true, desc: 'Bright and bitter. Brewed into tea.' });
it('redcap', { name: 'Redcap Mushroom', type: 'ingredient', shape: 'mushroom_red', value: 6, stack: true, desc: 'Poisonous to eat. Apothecaries pay for them.' });
it('linen', { name: 'Linen Scrap', type: 'ingredient', shape: 'linen', value: 2, stack: true, desc: 'Clean enough for bandages.' });
it('wolf_pelt', { name: 'Wolf Pelt', type: 'ingredient', shape: 'pelt', value: 14, stack: true, desc: 'Coarse grey fur. Hunters and tanners pay well.' });
it('deer_hide', { name: 'Deer Hide', type: 'ingredient', shape: 'hide', value: 10, stack: true, desc: 'Soft once tanned.' });
it('boar_hide', { name: 'Boar Hide', type: 'ingredient', shape: 'hide', value: 12, stack: true, desc: 'Thick and bristled. Makes good boots.' });
it('bear_pelt', { name: 'Bear Pelt', type: 'ingredient', shape: 'pelt', value: 45, stack: true, rarity: 'uncommon', desc: 'Heavy enough to sleep under in a snowstorm.' });
it('fang', { name: 'Wolf Fang', type: 'ingredient', shape: 'fang', value: 5, stack: true, desc: 'Long and yellowed.' });
it('tusk', { name: 'Boar Tusk', type: 'ingredient', shape: 'fang', value: 8, stack: true, desc: 'Curved and sharp. Carvers like these.' });
it('iron_ore', { name: 'Iron Ore', type: 'ingredient', shape: 'ore', value: 6, stack: true, desc: 'Rust-streaked rock from Ironhollow.' });
it('gem', { name: 'River Sapphire', type: 'misc', shape: 'gem', value: 80, stack: true, rarity: 'rare', desc: 'A blue stone, rough-cut. Worth a small fortune to the right merchant.' });
it('bone', { name: 'Old Bone', type: 'misc', shape: 'bone', value: 0, stack: true, desc: 'Gnawed.' });

// ---- throwables ----
it('firepot', { name: 'Pitch Pot', type: 'throwable', shape: 'firepot', value: 18, stack: true, rarity: 'uncommon', desc: 'Clay pot of pitch and oil with a burning rag. Throw it and step back.' });
it('throwknife', { name: 'Throwing Knife', type: 'throwable', shape: 'throwknife', value: 6, stack: true, desc: 'Balanced for the air rather than the hand.' });

// ---- quest & keepsakes ----
it('ledger', { name: 'Supply Ledger', type: 'quest', shape: 'book', rarity: 'unique', desc: "Greywater's tally of medicine and grain. Pages torn out near the end." });
it('osric_letter', { name: "Osric's Orders", type: 'quest', shape: 'letter', rarity: 'unique', desc: 'Sealed with blue wax: "Take every herb-cart on the Kingsway. The Steward pays in silver. — H."' });
it('gate_pass', { name: 'Writ of Passage', type: 'quest', shape: 'pass', rarity: 'unique', desc: 'Signed by Captain Ysolde. Lets the bearer through the gates of Caer Dawn.' });
it('journal', { name: "Physician Corvin's Journal", type: 'quest', shape: 'book', rarity: 'unique', desc: 'Water-stained notes on the Withering: the fog, the fungus, and a cure that needs Sunpetal and Bitterroot.' });
it('fog_mask', { name: 'Fen-Mask', type: 'quest', shape: 'mask', rarity: 'unique', desc: 'A linen mask stitched by the fen-folk. With filters, it lets you breathe in the Withering fog.' });
it('sunpetal', { name: 'Sunpetal Bloom', type: 'quest', shape: 'sunpetal', stack: true, rarity: 'unique', desc: 'A golden flower that grows only above the snowline. It smells of honey and cold air.' });
it('bitterroot', { name: 'Bitterroot', type: 'quest', shape: 'root', stack: true, rarity: 'unique', desc: 'A purple root from the heart of the Mire. The fungus will not touch it.' });
it('grey_draught', { name: 'The Grey Draught', type: 'quest', shape: 'vial', rarity: 'unique', desc: 'Maeve\'s cure for the Withering. It glows faintly, like dawn through fog.' });
it('lost_ring', { name: "Tamsin's Ring", type: 'quest', shape: 'ring', rarity: 'unique', desc: 'A plain gold band with a chip of blue stone.' });
it('mill_key', { name: 'Watchtower Key', type: 'quest', shape: 'key', rarity: 'unique', desc: 'Heavy iron, rusted at the teeth.' });
it('lamp_oil', { name: 'Lamp Oil', type: 'quest', shape: 'tonic', stack: true, rarity: 'unique', desc: 'A jug of whale oil for the lighthouse.' });
it('net', { name: "Fisher's Net", type: 'quest', shape: 'linen', rarity: 'unique', desc: 'A good net, carefully mended.' });
it('steward_seal', { name: "Steward's Seal", type: 'quest', shape: 'ring', rarity: 'unique', desc: 'Heavy silver signet of Steward Harlan. Proof enough for any court.' });
it('cart_wheel', { name: 'Herb-Cart Manifest', type: 'quest', shape: 'letter', rarity: 'unique', desc: 'A list of herbs that never reached Greywater.' });
it('pelts_bundle', { name: 'Bundle of Pelts', type: 'quest', shape: 'pelt', rarity: 'unique', desc: 'Garrick\'s pelts, tied for market.' });
// Lore pages
for (let i = 1; i <= 8; i++) it('page' + i, { name: `Chronicle Page ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i - 1]}`, type: 'lore', shape: 'page', rarity: 'rare', value: 0, desc: 'A page torn from the Chronicle of Avalon.' });

export const RARITY_COLOR = { common: '#d8cfb8', uncommon: '#8fc06a', rare: '#6aa0e0', epic: '#c07ae0', unique: '#e0a040' };
export const RARITY_NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', unique: 'Unique' };
export const TYPE_NAME = {
  weapon: 'Weapon', shield: 'Shield', light: 'Lantern', bow: 'Bow', ammo: 'Ammunition', body: 'Armour', head: 'Headwear', belt: 'Belt',
  consumable: 'Remedy', food: 'Provision', ingredient: 'Material', misc: 'Valuable', throwable: 'Throwable', quest: 'Keepsake', lore: 'Lore',
};
export const CATEGORIES = [
  { id: 'all', name: 'Everything', icon: 'satchel', test: () => true },
  { id: 'arms', name: 'Arms', icon: 'sword_militia', test: (d) => ['weapon', 'shield', 'bow', 'ammo', 'throwable'].includes(d.type) },
  { id: 'apparel', name: 'Apparel', icon: 'tunic', test: (d) => ['body', 'head', 'belt', 'light'].includes(d.type) },
  { id: 'remedies', name: 'Remedies', icon: 'poultice', test: (d) => d.type === 'consumable' },
  { id: 'food', name: 'Provisions', icon: 'bread', test: (d) => d.type === 'food' },
  { id: 'materials', name: 'Materials', icon: 'herb', test: (d) => ['ingredient', 'misc'].includes(d.type) },
  { id: 'letters', name: 'Keepsakes', icon: 'letter', test: (d) => ['quest', 'lore'].includes(d.type) },
];

export const RECIPES = [
  { id: 'poultice', out: 'poultice', n: 1, needs: { yarrow: 2, linen: 1 }, at: 'fire' },
  { id: 'bandage', out: 'bandage', n: 2, needs: { linen: 2 }, at: 'any' },
  { id: 'tea', out: 'tea_marigold', n: 1, needs: { marigold: 2 }, at: 'fire' },
  { id: 'filter', out: 'mask_filter', n: 2, needs: { comfrey: 2, linen: 1 }, at: 'fire' },
  { id: 'tonic', out: 'tonic', n: 1, needs: { yarrow: 2, comfrey: 1, marigold: 1 }, at: 'fire' },
  { id: 'venison', out: 'venison', n: 1, needs: { venison_raw: 1 }, at: 'fire' },
  { id: 'hare', out: 'hare', n: 1, needs: { hare_raw: 1 }, at: 'fire' },
  { id: 'fish', out: 'fish', n: 1, needs: { fish_raw: 1 }, at: 'fire' },
  { id: 'stew', out: 'stew', n: 1, needs: { mushroom: 2, venison_raw: 1 }, at: 'fire' },
];

// Loot tables: [itemId, chance, min, max]
export const LOOT = {
  home: [['bread', 0.5, 1, 2], ['apple', 0.4, 1, 3], ['linen', 0.5, 1, 2], ['gold', 0.6, 2, 9], ['bandage', 0.2, 1, 1]],
  food: [['bread', 0.8, 1, 3], ['apple', 0.6, 1, 4], ['stew', 0.3, 1, 1]],
  smith: [['iron_ore', 0.6, 1, 3], ['gold', 0.7, 5, 15], ['throwknife', 0.4, 2, 4]],
  shop: [['gold', 0.8, 8, 20], ['linen', 0.6, 1, 3], ['tea_marigold', 0.3, 1, 1]],
  herbs: [['yarrow', 0.9, 2, 4], ['comfrey', 0.6, 1, 2], ['marigold', 0.6, 1, 2], ['linen', 0.8, 1, 3], ['poultice', 0.4, 1, 1]],
  noble: [['gold', 1, 30, 60], ['gem', 0.3, 1, 1], ['tonic', 0.4, 1, 1]],
  farm: [['apple', 0.8, 2, 5], ['bread', 0.4, 1, 2], ['linen', 0.4, 1, 2]],
  tents: [['bandage', 1, 2, 2], ['bread', 1, 1, 1], ['linen', 1, 2, 2]],
  bandit: [['gold', 0.9, 8, 20], ['arrow', 0.6, 4, 10], ['bread', 0.5, 1, 2], ['poultice', 0.3, 1, 1], ['throwknife', 0.3, 1, 3]],
  bandit_chief: [['gold', 1, 60, 90], ['osric_letter', 1, 1, 1], ['ranger_coat', 1, 1, 1], ['tonic', 1, 1, 1]],
  archive: [['journal', 1, 1, 1], ['page4', 1, 1, 1], ['gold', 1, 15, 25]],
  malric: [['plate_deserter', 1, 1, 1], ['gold', 1, 50, 80], ['gem', 0.6, 1, 1]],
  watchtower: [['bow_hunting', 1, 1, 1], ['arrow', 1, 12, 12], ['page2', 1, 1, 1], ['gold', 1, 10, 18]],
  deserter: [['gold', 1, 20, 35], ['kettle_helm', 0.6, 1, 1], ['tonic', 0.5, 1, 1], ['firepot', 0.6, 1, 2]],
  gorm: [['gold', 1, 40, 70], ['page6', 1, 1, 1], ['gem', 1, 1, 2], ['belt_soldier', 1, 1, 1]],
  den: [['bone', 1, 2, 3], ['gold', 1, 30, 50], ['bascinet', 1, 1, 1], ['page7', 1, 1, 1]],
  cave: [['gold', 1, 20, 30], ['belt_hunter', 1, 1, 1], ['page3', 1, 1, 1]],
  wreck: [['gold', 1, 40, 60], ['gem', 1, 1, 1], ['page5', 1, 1, 1], ['shield_iron', 1, 1, 1]],
  lighthouse: [['gold', 1, 25, 40], ['lantern_brass', 1, 1, 1], ['page8', 1, 1, 1]],
  mine: [['iron_ore', 1, 3, 6], ['gold', 1, 20, 40], ['pick_miner', 1, 1, 1], ['gem', 0.5, 1, 1]],
  wolf: [['wolf_pelt', 0.9, 1, 1], ['fang', 0.6, 1, 2]],
  boar: [['boar_hide', 0.9, 1, 1], ['tusk', 0.7, 1, 2]],
  deer: [['venison_raw', 1, 1, 2], ['deer_hide', 0.9, 1, 1]],
  rabbit: [['hare_raw', 1, 1, 1]],
  bear: [['bear_pelt', 1, 1, 1], ['fang', 0.8, 2, 3]],
  rat: [['gold', 0.1, 1, 2]],
  plaguehound: [['wolf_pelt', 0.5, 1, 1], ['fang', 0.6, 1, 2]],
  bandit_body: [['gold', 0.8, 3, 12], ['bread', 0.3, 1, 1], ['arrow', 0.3, 3, 6], ['bandage', 0.25, 1, 1]],
  deserter_body: [['gold', 0.9, 6, 16], ['poultice', 0.25, 1, 1], ['linen', 0.3, 1, 2]],
  brute_body: [['gold', 1, 10, 25], ['mushroom', 0.5, 1, 3], ['bitterroot', 0.15, 1, 1]],
  brigand_body: [['gold', 0.9, 5, 14], ['iron_ore', 0.4, 1, 2]],
};
