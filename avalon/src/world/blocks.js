// Block palette. Colors are sRGB hex; converted to linear for vertex colors.
// kind: 0 air, 1 solid, 2 water, 3 plant (non-solid small geometry), 4 fire (non-solid emissive)

export const B = {};
export const BLOCKS = [];

function def(name, o) {
  const id = BLOCKS.length;
  B[name] = id;
  BLOCKS.push({
    name,
    kind: o.kind ?? 1,
    top: o.top ?? o.c,
    side: o.side ?? o.c,
    bottom: o.bottom ?? o.side ?? o.c,
    v: o.v ?? 0.12, // per-voxel brightness variation
    emit: o.emit ?? 0,
    sway: o.sway ?? 0,
    shape: o.shape ?? null,
    pattern: o.pattern ?? null,
  });
}

def('AIR', { kind: 0, c: 0 });
def('GRASS', { top: 0x587d38, side: 0x4a6a30, v: 0.16 });
def('GRASS_DARK', { top: 0x3c5e2b, side: 0x334f25, v: 0.16 });
def('GRASS_DRY', { top: 0x8a8c45, side: 0x76733b, v: 0.15 });
def('GRASS_MARSH', { top: 0x5c6436, side: 0x4c5230, v: 0.18 });
def('DIRT', { c: 0x6b4d32, v: 0.12 });
def('MUD', { c: 0x463627, v: 0.12 });
def('SAND', { c: 0xc9b57f, v: 0.08 });
def('GRAVEL', { c: 0x857b6c, v: 0.2 });
def('STONE', { c: 0x7d7b77, v: 0.12 });
def('STONE_DARK', { c: 0x4d4b4b, v: 0.12, pattern: 'brick' });
def('COBBLE', { c: 0x8c877d, v: 0.26, pattern: 'cobble' });
def('SNOW', { c: 0xe9eef2, v: 0.04 });
def('MOSS_STONE', { top: 0x5a6a3a, side: 0x666a5a, v: 0.2 });
def('CLAY', { c: 0x9a6b4c, v: 0.1 });
def('WATER', { kind: 2, c: 0x2a4f5a, v: 0 });
def('PLANKS', { c: 0x8f6a42, v: 0.1, pattern: 'plank' });
def('PLANKS_DARK', { c: 0x5a3f28, v: 0.1, pattern: 'plank' });
def('LOG', { top: 0x8a6a45, side: 0x5a4330, v: 0.1 });
def('BEAM', { c: 0x3a2a1e, v: 0.06 });
def('PLASTER', { c: 0xe2dccb, v: 0.04 });
def('PLASTER_CREAM', { c: 0xd8c497, v: 0.05 });
def('ROOF_RED', { c: 0x9a3a2a, v: 0.1, pattern: 'shingle' });
def('ROOF_BLUE', { c: 0x3d5068, v: 0.1, pattern: 'shingle' });
def('ROOF_BROWN', { c: 0x6a4a32, v: 0.1, pattern: 'shingle' });
def('THATCH', { c: 0xa8894a, v: 0.18 });
def('ROOF_SLATE', { c: 0x45474f, v: 0.12, pattern: 'shingle' });
def('BRICK', { c: 0x8a4a38, v: 0.12, pattern: 'brick' });
def('GLASS_LIT', { c: 0xe8c66a, v: 0.05, emit: 1 });
def('GLASS_DARK', { c: 0x2c3540, v: 0.05 });
def('LEAVES_OAK', { c: 0x4a7330, v: 0.2, sway: 1 });
def('LEAVES_PINE', { c: 0x30553a, v: 0.18, sway: 0.5 });
def('LEAVES_BIRCH', { c: 0xc9a33a, v: 0.2, sway: 1 });
def('LEAVES_DARK', { c: 0x2f4a26, v: 0.2, sway: 0.8 });
def('LEAVES_PURPLE', { c: 0x9a5cb8, v: 0.22, sway: 1 });
def('BIRCH_LOG', { top: 0xb0a080, side: 0xd8d2c4, v: 0.15 });
def('PINE_LOG', { top: 0x7a5a3a, side: 0x4a3626, v: 0.1 });
def('TUFT', { kind: 3, c: 0x5b8a3a, shape: 'tuft', v: 0.2, sway: 1 });
def('FLOWER_RED', { kind: 3, c: 0xc0392b, shape: 'flower', sway: 1 });
def('FLOWER_YELLOW', { kind: 3, c: 0xe8c840, shape: 'flower', sway: 1 });
def('FLOWER_BLUE', { kind: 3, c: 0x4a6ad0, shape: 'flower', sway: 1 });
def('FLOWER_PURPLE', { kind: 3, c: 0x9a50c0, shape: 'flower', sway: 1 });
def('FLOWER_WHITE', { kind: 3, c: 0xeeeeee, shape: 'flower', sway: 1 });
def('WHEAT', { kind: 3, c: 0xcfae55, shape: 'crop', sway: 1 });
def('REED', { kind: 3, c: 0x6a7a40, shape: 'reed', sway: 1 });
def('FERN', { kind: 3, c: 0x3f6a2e, shape: 'fern', sway: 1 });
def('HAY', { top: 0xd2b45a, side: 0xbf9f48, v: 0.12 });
def('CLOTH_RED', { c: 0x8e1f1f, v: 0.05 });
def('CLOTH_BLUE', { c: 0x23406e, v: 0.05 });
def('CLOTH_GREEN', { c: 0x2c5a34, v: 0.05 });
def('CLOTH_WHITE', { c: 0xddd6c4, v: 0.05 });
def('CLOTH_YELLOW', { c: 0xc8a234, v: 0.05 });
def('IRON', { c: 0x34363a, v: 0.06 });
def('GOLD_TRIM', { c: 0xb88a2a, v: 0.08 });
def('LANTERN', { c: 0xffd58a, v: 0.0, emit: 1.6 });
def('FIRE', { kind: 4, c: 0xff8a2a, emit: 2, shape: 'fire' });
def('ICE', { c: 0xa8c8dc, v: 0.05 });
def('GRANITE', { c: 0x6c6a6e, v: 0.14 });
def('ROCK_MOSSY', { top: 0x55663a, side: 0x6e6e66, v: 0.18 });
def('MUSHROOM_RED', { kind: 3, c: 0xb02a20, shape: 'mushroom' });
def('MUSHROOM_BROWN', { kind: 3, c: 0x8a6a4a, shape: 'mushroom' });
def('CRATE', { c: 0x9a7448, v: 0.08, pattern: 'crate' });
def('BARREL', { top: 0x7a5434, side: 0x6a4a2e, v: 0.06, pattern: 'barrel' });
def('BOOKSHELF', { top: 0x5a3f28, side: 0x6a3a2a, v: 0.3, pattern: 'books' });
def('BED', { top: 0x8e2f2f, side: 0x6a4a32, v: 0.05 });
def('CARPET', { c: 0x7a2424, v: 0.08 });
def('STRAW', { c: 0xb89a55, v: 0.2 });
def('BLIGHT', { top: 0x6a5a6e, side: 0x4a3f48, v: 0.25 });
def('BLIGHT_GROWTH', { kind: 3, c: 0x8a7a9a, shape: 'mushroom', emit: 0.25 });
def('SUNPETAL', { kind: 3, c: 0xffc23a, shape: 'flower', emit: 0.4, sway: 1 });
def('BITTERROOT', { kind: 3, c: 0x8a3a5a, shape: 'fern', sway: 1 });
def('ORE', { c: 0x6a5a50, v: 0.3, pattern: 'ore' });
def('DEEPSTONE', { c: 0x45434a, v: 0.12 });
def('TABLE', { top: 0x7a5434, side: 0x5a3f28, v: 0.06 });
def('WOOL_GREY', { c: 0x8a8682, v: 0.05 });
def('ROOF_GREEN', { c: 0x3c5a3a, v: 0.1, pattern: 'shingle' });
def('STONE_LIGHT', { c: 0xa29c90, v: 0.1, pattern: 'brick' });
def('RUBBLE', { c: 0x77736c, v: 0.3 });
def('BUSH', { c: 0x3e6a2c, v: 0.22, sway: 0.6 });
def('BERRY_BUSH', { c: 0x3a5a2a, v: 0.2, sway: 0.6, pattern: 'berries' });
def('PUMPKIN', { top: 0x5a6a2a, side: 0xd07a22, v: 0.08 });
def('CABBAGE', { kind: 3, c: 0x6a9a4a, shape: 'mushroom' });
def('HEDGE', { c: 0x35602a, v: 0.18 });
def('ROPE', { c: 0x9a8058, v: 0.1 });
def('WAX_CANDLE', { c: 0xfff0c0, emit: 1.2 });
def('SKY_STONE', { c: 0x9aa0a8, v: 0.1 });
def('DIRT_PATH', { c: 0x7e6248, v: 0.16 });
def('BLOOD', { c: 0x6a1010, v: 0.1 });

export const KIND = new Uint8Array(256);
export const OPAQUE = new Uint8Array(256); // blocks faces of neighbours
export const SOLID = new Uint8Array(256); // collides
BLOCKS.forEach((b, i) => {
  KIND[i] = b.kind;
  OPAQUE[i] = b.kind === 1 ? 1 : 0;
  SOLID[i] = b.kind === 1 ? 1 : 0;
});

function srgbToLin(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexLin(h) {
  return [srgbToLin((h >> 16) & 255), srgbToLin((h >> 8) & 255), srgbToLin(h & 255)];
}

// Linear colors: [top, side, bottom] each [r,g,b]
export const COLORS = BLOCKS.map((b) => [hexLin(b.top), hexLin(b.side), hexLin(b.bottom)]);
export const VARIATION = new Float32Array(BLOCKS.map((b) => b.v));
export const EMIT = new Float32Array(BLOCKS.map((b) => b.emit));
export const SWAY = new Float32Array(BLOCKS.map((b) => b.sway));
export const PATTERN = BLOCKS.map((b) => b.pattern);
export const SHAPE = BLOCKS.map((b) => b.shape);
export const SRGB = BLOCKS.map((b) => b.top);
