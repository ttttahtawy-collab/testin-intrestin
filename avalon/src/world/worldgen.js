// Composes the hand-designed world: settlements, castles, ruins, camps,
// dungeons and landmarks, then scatters vegetation around them.
import { B } from './blocks.js';
import { World, WX, WZ, SEA } from './world.js';
import { buildTemplates, TPL } from './templates.js';
import { generateTerrain, placeVegetation } from './terrain.js';
import { SETTLE } from './layout.js';
import {
  initMeta, house, tower, wallLine, palisade, fence, lampPost, stall, well, tent, campfire, cropField,
  windmill, dock, boat, bridge, tunnel, room, decay, stiltHouse, boardwalk, banner, lighthouse, groundAt, Frame, carveSphere,
} from './builder.js';
import { rng, hash2 } from '../core/noise.js';

function paveDisc(world, cx, cz, r, b = B.COBBLE, jag = 0.3) {
  for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d > r + (hash2(x, z, 8) - 0.5) * r * jag) continue;
    world.surf[z * WX + x] = b; world.mask[z * WX + x] = 1;
  }
}
function paveLine(world, x0, z0, x1, z1, w = 2, b = B.COBBLE) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
  for (let k = 0; k <= n; k++) {
    const cx = x0 + (x1 - x0) * k / n, cz = z0 + (z1 - z0) * k / n;
    for (let dz = -w; dz <= w; dz++) for (let dx = -w; dx <= w; dx++) {
      const x = Math.round(cx + dx), z = Math.round(cz + dz);
      if (Math.hypot(dx, dz) > w + 0.3) continue;
      if (hash2(x, z, 12) < 0.08 && Math.hypot(dx, dz) > w - 1) continue;
      world.surf[z * WX + x] = b; world.mask[z * WX + x] = 1;
    }
  }
}

export function generateWorld(progress = () => {}) {
  buildTemplates();
  const world = new World();
  initMeta(world);
  progress(0.05, 'Raising the isle…');
  generateTerrain(world);
  progress(0.4, 'Building settlements…');
  const spawns = [];
  const waypoints = [];
  world.spawns = spawns; world.waypoints = waypoints;

  buildGreywater(world, spawns, waypoints);
  buildQuarantine(world, waypoints);
  buildFarmstead(world, spawns);
  buildLodge(world, waypoints);
  buildBanditCamp(world, spawns);
  buildKingsfall(world, spawns, waypoints);
  buildCaerDawn(world, spawns, waypoints);
  buildStillwater(world, spawns, waypoints);
  buildSaltby(world, waypoints);
  buildLighthouse(world);
  buildMine(world, spawns, waypoints);
  buildCrossroads(world, waypoints);
  buildWatchtower(world, spawns);
  buildDeserterCamp(world, spawns);
  buildMireHeart(world, spawns);
  buildBearDen(world, spawns);
  buildHollowCave(world, spawns);
  buildWreck(world);
  buildSunMeadow(world, waypoints);
  // bridges where roads cross rivers
  for (const c of world.crossings) bridge(world, c);
  progress(0.6, 'Growing the forests…');
  // landmark tree
  const eb = SETTLE.elderBloom;
  world.addFeature(eb.x, groundAt(world, eb.x, eb.z) + 1, eb.z, TPL.blossom[0]);
  for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) world.mask[(eb.z + dz) * WX + eb.x + dx] = 1;
  const maskDisc = (x, z, r) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < WX && zz < WZ) world.mask[zz * WX + xx] = 1; } };
  maskDisc(SETTLE.greywater.x, SETTLE.greywater.z, 64);
  maskDisc(SETTLE.quarantine.x, SETTLE.quarantine.z, 30);
  maskDisc(SETTLE.saltby.x, SETTLE.saltby.z, 46);
  maskDisc(SETTLE.kingsfall.x, SETTLE.kingsfall.z, 58);
  maskDisc(SETTLE.banditCamp.x, SETTLE.banditCamp.z, 30);
  maskDisc(SETTLE.lodge.x, SETTLE.lodge.z, 16);
  maskDisc(SETTLE.farmstead.x, SETTLE.farmstead.z, 44);
  for (let z = 550; z <= 732; z++) for (let x = 1406; x <= 1574; x++) world.mask[z * WX + x] = 1;
  placeVegetation(world);
  addWildSpawns(world, spawns);
  progress(0.7, 'Lighting the hearths…');
  return world;
}

// ------------------------------------------------------------------
function buildGreywater(world, spawns, waypoints) {
  const S = SETTLE.greywater; const cx = S.x, cz = S.z;
  paveDisc(world, cx, cz, 13);
  paveLine(world, cx, cz, cx, cz - 64, 2);
  paveLine(world, cx, cz, cx + 64, cz, 2);
  paveLine(world, cx, cz, cx + 28, cz + 60, 2);
  paveLine(world, cx, cz, cx - 50, cz + 20, 2);
  well(world, cx, cz);
  const hs = {};
  hs.inn = house(world, { x: cx, z: cz - 25, rot: 2, w: 17, d: 11, floors: 2, roof: B.ROOF_RED, type: 'inn', name: 'inn', style: 'timber' });
  hs.healer = house(world, { x: cx - 30, z: cz - 6, rot: 1, w: 11, d: 9, floors: 1, roof: B.THATCH, type: 'healer', name: 'healer', style: 'cream', shutters: B.CLOTH_BLUE });
  hs.smith = house(world, { x: cx + 30, z: cz - 8, rot: 3, w: 11, d: 9, floors: 1, roof: B.ROOF_SLATE, type: 'smith', name: 'smithy', style: 'mixed' });
  hs.elder = house(world, { x: cx, z: cz + 27, rot: 0, w: 13, d: 9, floors: 2, roof: B.ROOF_BLUE, type: 'home', name: 'elder', style: 'timber' });
  hs.shop = house(world, { x: cx + 29, z: cz + 18, rot: 3, w: 11, d: 9, floors: 2, roof: B.ROOF_GREEN, type: 'shop', name: 'shop', style: 'timber', shutters: B.CLOTH_RED });
  const homes = [
    [cx - 30, cz + 20, 1, B.ROOF_RED], [cx - 28, cz - 34, 1, B.ROOF_BROWN], [cx + 30, cz - 36, 3, B.THATCH],
    [cx - 50, cz - 10, 1, B.THATCH], [cx + 50, cz + 12, 3, B.ROOF_RED], [cx - 8, cz + 50, 0, B.THATCH], [cx + 24, cz + 45, 0, B.ROOF_BROWN],
    [cx - 46, cz + 38, 1, B.ROOF_BLUE],
  ];
  homes.forEach(([x, z, rot, roof], i) => {
    hs['home' + i] = house(world, { x, z, rot, w: 9 + (i % 2) * 2, d: 9, floors: i % 3 === 0 ? 2 : 1, roof, type: 'home', name: 'gw.home' + i, style: i % 2 ? 'timber' : 'cream', seed: i * 13 });
  });
  stall(world, cx - 15, cz + 4, 1, B.CLOTH_RED, 'produce', 'gw.stall1');
  stall(world, cx + 15, cz + 6, 3, B.CLOTH_BLUE, 'cloth', 'gw.stall2');
  for (const [dx, dz] of [[-12, -12], [12, -12], [-12, 12], [12, 12], [4, -45], [45, 4], [-4, 40]]) lampPost(world, cx + dx, cz + dz);
  // palisade ring
  const pts = [];
  for (let a = 0; a <= 48; a++) { const t = (a / 48) * Math.PI * 2; pts.push([Math.round(cx + Math.cos(t) * 66), Math.round(cz + Math.sin(t) * 62)]); }
  palisade(world, pts, { h: 7, gaps: [[cx + 4, cz - 62, 7], [cx + 66, cz, 7], [cx + 30, cz + 56, 8], [cx - 60, cz + 26, 6]] });
  // gate towers
  tower(world, { x: cx - 6, z: cz - 64, r: 3, h: 12, roof: B.ROOF_RED, door: false });
  tower(world, { x: cx + 14, z: cz - 64, r: 3, h: 12, roof: B.ROOF_RED, door: false });
  // gardens
  cropField(world, cx - 52, cz + 50, cx - 36, cz + 56, B.CABBAGE);
  fence(world, [[cx - 53, cz + 49], [cx - 35, cz + 49], [cx - 35, cz + 57], [cx - 53, cz + 57], [cx - 53, cz + 49]]);
  // docks on the mere
  const dk = dock(world, 703, 1446, 1, 16, 4);
  boat(world, 712, dk, 1440, 1);
  world.meta.spots['gw.dock'] = { x: 716, y: dk + 1, z: 1448, yaw: Math.PI / 2 };
  const cf = campfire(world, cx - 16, cz - 22, { name: 'Greywater Hollow', id: 'wp_greywater' });
  waypoints.push({ id: 'wp_greywater', name: 'Greywater Hollow', x: cf.x, y: cf.y, z: cf.z + 3 });
  world.meta.spots['gw.plaza'] = { x: cx + 4, y: S.ty + 1, z: cz + 6, yaw: 0 };
  world.meta.spots['gw.gate'] = { x: cx + 4, y: S.ty + 1, z: cz - 58, yaw: 0 };
  world.meta.spots['gw.fire'] = { x: cf.x + 2.5, y: cf.y, z: cf.z, yaw: -Math.PI / 2 };
  // chickens & sheep
  spawns.push({ type: 'chicken', x: cx - 44, z: cz + 50, n: 5, r: 6 }, { type: 'chicken', x: cx + 10, z: cz + 10, n: 3, r: 8 });
  spawns.push({ type: 'cat', x: cx, z: cz, n: 2, r: 20 });
}

function buildQuarantine(world, waypoints) {
  const S = SETTLE.quarantine; const cx = S.x, cz = S.z;
  const t1 = tent(world, cx - 10, cz - 6, 1, B.CLOTH_WHITE, 9, 7);
  tent(world, cx + 8, cz - 8, 3, B.CLOTH_WHITE, 9, 7);
  tent(world, cx - 2, cz + 12, 0, B.WOOL_GREY, 8, 7);
  // cots inside first tent
  const F = new Frame(world, cx - 10, groundAt(world, cx - 10, cz - 6) + 1, cz - 6, 1);
  F.set(-1, 0, 1, B.BED); F.set(-1, 0, 2, B.BED);
  F.set(1, 0, 1, B.BED); F.set(1, 0, 2, B.BED);
  world.meta.spots['start.cot'] = { ...F.wp(-1, 1, 0), yaw: 0 };
  world.meta.spots['start.cot'].x += 0.5; world.meta.spots['start.cot'].z += 0.5;
  palisade(world, [[cx - 28, cz - 26], [cx + 26, cz - 26], [cx + 26, cz + 26], [cx - 28, cz + 26], [cx - 28, cz - 26]], { h: 6, gaps: [[cx + 26, cz - 6, 4], [cx + 26, cz - 18, 4]] });
  const cf = campfire(world, cx + 2, cz + 2, { rest: true, name: 'The Sick-Tents', id: 'wp_tents' });
  waypoints.push({ id: 'wp_tents', name: 'The Sick-Tents', x: cf.x + 3, y: cf.y, z: cf.z });
  world.meta.spots['q.fire'] = { x: cf.x - 2.5, y: cf.y, z: cf.z, yaw: Math.PI / 2 };
  world.meta.spots['q.gate'] = { x: cx + 22, y: cf.y, z: cz - 12, yaw: Math.PI / 2 };
  world.meta.containers.push({ x: cx + 18, y: groundAt(world, cx + 18, cz + 18) + 1, z: cz + 18, kind: 'chest', loot: 'tents', id: 'tents.chest' });
  world.set(cx + 18, groundAt(world, cx + 18, cz + 18) + 1, cz + 18, B.CRATE);
}

function buildFarmstead(world, spawns) {
  const S = SETTLE.farmstead; const cx = S.x, cz = S.z;
  house(world, { x: cx - 10, z: cz - 6, rot: 0, w: 11, d: 9, roof: B.THATCH, type: 'home', name: 'farm', style: 'cream' });
  house(world, { x: cx + 14, z: cz - 4, rot: 3, w: 13, d: 11, roof: B.ROOF_BROWN, type: 'barn', name: 'barn', style: 'plank', chimney: false, shutters: null });
  windmill(world, cx + 2, cz + 26, 0);
  cropField(world, cx - 40, cz + 8, cx - 16, cz + 30, B.WHEAT);
  cropField(world, cx + 20, cz + 14, cx + 40, cz + 30, B.WHEAT);
  cropField(world, cx - 40, cz - 30, cx - 22, cz - 16, B.PUMPKIN);
  fence(world, [[cx - 42, cz + 6], [cx - 14, cz + 6], [cx - 14, cz + 32], [cx - 42, cz + 32], [cx - 42, cz + 6]]);
  fence(world, [[cx + 26, cz - 30], [cx + 46, cz - 30], [cx + 46, cz - 14], [cx + 26, cz - 14], [cx + 26, cz - 22]]);
  spawns.push({ type: 'sheep', x: cx + 36, z: cz - 22, n: 5, r: 6 }, { type: 'chicken', x: cx - 4, z: cz + 4, n: 4, r: 6 }, { type: 'cow', x: cx + 36, z: cz - 22, n: 2, r: 6 });
}

function buildLodge(world, waypoints) {
  const S = SETTLE.lodge; const cx = S.x, cz = S.z;
  house(world, { x: cx, z: cz - 6, rot: 2, w: 11, d: 9, roof: B.ROOF_BROWN, type: 'home', name: 'lodge', style: 'plank', shutters: null });
  const by = groundAt(world, cx + 10, cz + 4) + 1;
  // tanning racks
  for (let k = 0; k < 3; k++) { const x = cx + 8 + k * 3; for (let y = 0; y < 4; y++) world.set(x, by + y, cz + 6, B.LOG); world.set(x, by + 3, cz + 7, B.STRAW); world.set(x, by + 2, cz + 7, B.STRAW); }
  const cf = campfire(world, cx - 4, cz + 8, { name: "Hunter's Lodge", id: 'wp_lodge' });
  waypoints.push({ id: 'wp_lodge', name: "Hunter's Lodge", x: cf.x + 3, y: cf.y, z: cf.z });
  world.meta.spots['lodge.fire'] = { x: cf.x + 2.5, y: cf.y, z: cf.z, yaw: -Math.PI / 2 };
  fence(world, [[cx - 14, cz - 16], [cx + 14, cz - 16], [cx + 14, cz + 14], [cx + 4, cz + 14]]);
}

function buildBanditCamp(world, spawns) {
  const S = SETTLE.banditCamp; const cx = S.x, cz = S.z;
  const pts = [];
  for (let a = 0; a <= 32; a++) { const t = (a / 32) * Math.PI * 2; pts.push([Math.round(cx + Math.cos(t) * 30), Math.round(cz + Math.sin(t) * 28)]); }
  palisade(world, pts, { h: 6, gaps: [[cx - 6, cz + 28, 5], [cx + 28, cz - 8, 4]] });
  tent(world, cx - 14, cz - 8, 1, B.CLOTH_RED, 8, 7);
  tent(world, cx + 10, cz - 14, 2, B.WOOL_GREY, 8, 7);
  tent(world, cx + 14, cz + 8, 3, B.CLOTH_RED, 8, 7);
  campfire(world, cx, cz, { rest: false });
  // chief's platform
  const by = groundAt(world, cx, cz - 20) + 1;
  for (let x = cx - 4; x <= cx + 4; x++) for (let z = cz - 24; z <= cz - 18; z++) world.set(x, by + 4, z, B.PLANKS_DARK);
  for (const [x, z] of [[cx - 4, cz - 24], [cx + 4, cz - 24], [cx - 4, cz - 18], [cx + 4, cz - 18]]) for (let y = 0; y < 8; y++) world.set(x, by + y, z, B.LOG);
  for (let k = 0; k < 4; k++) world.set(cx + 5 + k, by + k, cz - 17, B.PLANKS_DARK);
  for (let x = cx - 5; x <= cx + 5; x++) world.set(x, by + 8, cz - 25 + ((x + 100) % 2), B.CLOTH_RED);
  world.meta.containers.push({ x: cx, y: by + 5, z: cz - 22, kind: 'chest', loot: 'bandit_chief', id: 'osric.chest' });
  world.set(cx, by + 5, cz - 22, B.CRATE);
  world.meta.containers.push({ x: cx - 12, y: groundAt(world, cx - 12, cz + 14) + 1, z: cz + 14, kind: 'crate', loot: 'bandit', id: 'bandit.crate1' });
  world.set(cx - 12, groundAt(world, cx - 12, cz + 14) + 1, cz + 14, B.CRATE);
  world.meta.spots['osric'] = { x: cx + 0.5, y: by + 5, z: cz - 20, yaw: Math.PI };
  world.meta.spots['bandit.cart'] = { x: cx + 6, y: groundAt(world, cx + 6, cz + 4) + 1, z: cz + 4, yaw: 0 };
  spawns.push({ type: 'bandit', x: cx, z: cz, n: 4, r: 16, group: 'osric' }, { type: 'bandit_archer', x: cx, z: cz - 6, n: 2, r: 12, group: 'osric' });
  spawns.push({ type: 'osric', x: cx, z: cz - 14, n: 1, r: 2, unique: 'osric', group: 'osric' });
}

function buildKingsfall(world, spawns, waypoints) {
  const S = SETTLE.kingsfall; const cx = S.x, cz = S.z; const y = S.ty + 1;
  // outer walls
  const x0 = cx - 42, x1 = cx + 42, z0 = cz - 38, z1 = cz + 38;
  wallLine(world, x0, z0, x1, z0, { h: 14, y });
  wallLine(world, x1, z0, x1, z1, { h: 14, y });
  wallLine(world, x1, z1, cx + 8, z1, { h: 14, y });
  wallLine(world, cx - 8, z1, x0, z1, { h: 14, y });
  wallLine(world, x0, z1, x0, z0, { h: 14, y });
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) tower(world, { x: tx, z: tz, r: 6, h: 24, crenel: true, roof: B.ROOF_SLATE, y, lit: false });
  tower(world, { x: cx - 9, z: z1, r: 5, h: 20, crenel: true, roof: null, y, door: false, lit: false });
  tower(world, { x: cx + 9, z: z1, r: 5, h: 20, crenel: true, roof: null, y, door: false, lit: false });
  // keep
  const kx = cx, kz = cz - 10;
  const F = new Frame(world, kx, y, kz, 0);
  F.fill(-14, -1, -12, 14, -1, 12, B.COBBLE);
  for (let yy = 0; yy < 30; yy++) for (let lz = -12; lz <= 12; lz++) for (let lx = -14; lx <= 14; lx++) {
    const edge = Math.abs(lx) === 14 || Math.abs(lz) === 12;
    if (edge) F.set(lx, yy, lz, yy % 10 === 9 ? B.STONE : B.STONE_DARK);
    else if (yy % 10 === 9) F.set(lx, yy, lz, B.PLANKS_DARK);
    else F.set(lx, yy, lz, B.AIR);
  }
  for (let yy = 0; yy < 6; yy++) for (let lx = -1; lx <= 1; lx++) { F.set(lx, yy, 12, B.AIR); }
  for (let yy = 2; yy < 28; yy += 10) for (let lx = -10; lx <= 10; lx += 5) { F.set(lx, yy + 1, -12, B.GLASS_DARK); F.set(lx, yy + 2, -12, B.GLASS_DARK); F.set(lx, yy + 1, 12, B.GLASS_DARK); F.set(lx, yy + 2, 12, B.GLASS_DARK); }
  for (const [tx, tz] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) tower(world, { x: kx + tx, z: kz + tz, r: 4, h: 36, crenel: true, roof: B.ROOF_SLATE, y, door: false, lit: false });
  // banners (tattered)
  banner(world, kx - 4, y + 18, kz + 13, 0, 1, B.CLOTH_RED, 7);
  banner(world, kx + 3, y + 18, kz + 13, 0, 1, B.CLOTH_RED, 5);
  // great hall tables
  for (let lz = -8; lz <= 6; lz++) { F.set(-5, 0, lz, B.TABLE); F.set(5, 0, lz, B.TABLE); }
  // dungeon entrance: stairs going down in keep
  const dy = y - 14;
  for (let k = 0; k < 14; k++) for (let w = 0; w < 3; w++) {
    const sz = kz - 2 - k;
    for (let hh = 0; hh < 5; hh++) world.set(kx + 8 + w, y - k + hh, sz, B.AIR);
    world.set(kx + 8 + w, y - k - 1, sz, B.STONE_DARK);
  }
  // dungeon rooms
  room(world, kx + 2, dy, kz - 34, kx + 16, dy + 6, kz - 16);
  room(world, kx - 30, dy, kz - 30, kx - 12, dy + 7, kz - 14);
  room(world, kx - 30, dy, kz - 8, kx - 14, dy + 6, kz + 8);
  tunnel(world, [[kx + 4, dy, kz - 24], [kx - 13, dy, kz - 22]], 2, B.STONE_DARK);
  tunnel(world, [[kx - 22, dy, kz - 14], [kx - 22, dy, kz - 7]], 2, B.STONE_DARK);
  for (let z = kz - 17; z <= kz - 14; z++) for (let x = kx + 8; x <= kx + 10; x++) { world.set(x, dy - 1, z, B.STONE_DARK); for (let yy = dy; yy < dy + 5; yy++) world.set(x, yy, z, B.AIR); }
  for (const [lx, lz] of [[kx + 9, kz - 25], [kx - 21, kz - 22], [kx - 22, kz]]) { world.set(lx, dy + 4, lz, B.LANTERN); world.meta.lights.push({ x: lx + 0.5, y: dy + 4.5, z: lz + 0.5, color: 0xff9040, intensity: 1.3, radius: 16, flicker: true }); }
  // archive with bookshelves
  for (let x = kx - 29; x <= kx - 15; x += 2) { world.set(x, dy, kz + 7, B.BOOKSHELF); world.set(x, dy + 1, kz + 7, B.BOOKSHELF); world.set(x, dy + 2, kz + 7, B.BOOKSHELF); }
  world.set(kx - 22, dy, kz, B.TABLE);
  world.meta.containers.push({ x: kx - 22, y: dy + 1, z: kz, kind: 'desk', loot: 'archive', id: 'kingsfall.desk' });
  world.meta.containers.push({ x: kx - 28, y: dy, z: kz - 28, kind: 'chest', loot: 'malric', id: 'kingsfall.chest' });
  world.set(kx - 28, dy, kz - 28, B.CRATE);
  world.meta.spots['kingsfall.archive'] = { x: kx - 22, y: dy, z: kz + 2, yaw: 0 };
  world.meta.spots['kingsfall.vault'] = { x: kx - 21, y: dy, z: kz - 22, yaw: 0 };
  world.meta.spots['kingsfall.gate'] = { x: cx, y, z: z1 + 6, yaw: 0 };
  world.meta.interiors.push({ x0: kx - 32, x1: kx + 18, z0: kz - 36, z1: kz + 10, y0: dy - 1, y1: dy + 8, name: 'kingsfall.dungeon', dungeon: true });
  // ruin it
  decay(world, x0 - 7, y, z0 - 7, x1 + 7, y + 44, z1 + 7, 0.55, 11);
  spawns.push({ type: 'deserter', x: cx, z: cz + 10, n: 3, r: 18 }, { type: 'deserter', x: cx - 20, z: cz - 25, n: 2, r: 8 });
  spawns.push({ type: 'rat', x: kx + 9, z: kz - 25, n: 3, r: 4, y: dy, under: true }, { type: 'rat', x: kx - 22, z: kz - 2, n: 2, r: 4, y: dy, under: true });
  spawns.push({ type: 'malric', x: kx - 21, z: kz - 22, n: 1, r: 1, y: dy, unique: 'malric', under: true });
  const cf = campfire(world, cx - 6, z1 + 24, { name: 'Kingsfall Gate', id: 'wp_kingsfall' });
  waypoints.push({ id: 'wp_kingsfall', name: 'Kingsfall Gate', x: cf.x + 3, y: cf.y, z: cf.z });
}

function buildCaerDawn(world, spawns, waypoints) {
  const S = SETTLE.caerdawn; const cx = S.x, cz = S.z, y = S.ty + 1;
  const x0 = 1412, x1 = 1568, z0 = 556, z1 = 726;
  paveLine(world, cx, z1 + 20, cx, 600, 3);
  paveDisc(world, cx, 655, 18);
  paveLine(world, x0 - 10, 620, cx, 620, 2);
  paveLine(world, cx, 655, x1 - 20, 655, 2);
  wallLine(world, x0, z0, x1, z0, { h: 16, thick: 4, y });
  wallLine(world, x1, z0, x1, z1, { h: 16, thick: 4, y });
  wallLine(world, x1, z1, cx + 9, z1, { h: 16, thick: 4, y });
  wallLine(world, cx - 9, z1, x0, z1, { h: 16, thick: 4, y });
  wallLine(world, x0, z1, x0, 627, { h: 16, thick: 4, y });
  wallLine(world, x0, 613, x0, z0, { h: 16, thick: 4, y });
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [x1, 640], [cx - 12, z1], [cx + 12, z1], [x0, 606], [x0, 634], [cx, z0]]) {
    tower(world, { x: tx, z: tz, r: 6, h: 26, crenel: true, roof: B.ROOF_BLUE, y, door: false });
  }
  // gate arch with portcullis bars above
  for (let x = cx - 8; x <= cx + 8; x++) for (let yy = 12; yy < 18; yy++) world.set(x, y + yy, z1, B.STONE_DARK);
  banner(world, cx - 6, y + 14, z1 + 3, 0, 1, B.CLOTH_BLUE, 8);
  banner(world, cx + 5, y + 14, z1 + 3, 0, 1, B.CLOTH_BLUE, 8);
  // keep / great hall in the north
  const keep = house(world, { x: cx, z: 585, rot: 2, w: 29, d: 21, floors: 2, roof: B.ROOF_SLATE, type: 'hall', name: 'hall', style: 'stone', y, shutters: null, lit: 0.9 });
  for (const [tx, tz] of [[cx - 16, 573], [cx + 16, 573], [cx - 16, 597], [cx + 16, 597]]) tower(world, { x: tx, z: tz, r: 4, h: 30, crenel: true, roof: B.ROOF_BLUE, y, door: false });
  banner(world, cx - 8, y + 10, 596, 0, 1, B.CLOTH_BLUE, 7);
  banner(world, cx + 7, y + 10, 596, 0, 1, B.CLOTH_BLUE, 7);
  // inner bailey wall
  wallLine(world, cx - 30, 610, cx - 6, 610, { h: 8, thick: 2, y });
  wallLine(world, cx + 6, 610, cx + 30, 610, { h: 8, thick: 2, y });
  // town houses along streets
  const roofs = [B.ROOF_RED, B.ROOF_BLUE, B.ROOF_SLATE, B.ROOF_BROWN, B.ROOF_GREEN];
  let n = 0;
  const addH = (x, z, rot, opts = {}) => { house(world, { x, z, rot, w: opts.w || 11, d: opts.d || 9, floors: opts.floors || (n % 3 === 0 ? 1 : 2), roof: opts.roof || roofs[n % roofs.length], type: opts.type || 'home', name: opts.name || 'cd.home' + n, style: opts.style || (n % 3 === 1 ? 'mixed' : 'timber'), y, seed: n * 7, shutters: [B.CLOTH_GREEN, B.CLOTH_BLUE, B.CLOTH_RED][n % 3] }); n++; };
  // main street (north-south) both sides
  for (let z = 680; z >= 625; z -= 15) { if (Math.abs(z - 655) < 16) continue; addH(cx - 16, z, 1); addH(cx + 16, z, 3); }
  addH(cx - 16, 700, 1, { name: 'cd.inn', type: 'inn', w: 15, d: 11, floors: 2 });
  addH(cx + 17, 702, 3, { name: 'cd.smith', type: 'smith', floors: 1, style: 'mixed' });
  addH(cx - 30, 655, 1, { name: 'cd.shop', type: 'shop' });
  addH(cx + 32, 640, 3, { name: 'cd.captain', type: 'home', floors: 2, style: 'stone' });
  for (const [x, z, r] of [[1440, 590], [1440, 700], [1545, 590], [1545, 700], [1450, 650], [1530, 680], [1530, 615], [1455, 680], [1440, 645], [1545, 655]]) addH(x, z, r === undefined ? (x < cx ? 1 : 3) : r);
  stall(world, cx - 10, 646, 1, B.CLOTH_BLUE, 'produce', 'cd.stall1');
  stall(world, cx + 10, 646, 3, B.CLOTH_RED, 'cloth', 'cd.stall2');
  stall(world, cx - 10, 664, 1, B.CLOTH_GREEN, 'metal', 'cd.stall3');
  stall(world, cx + 10, 664, 3, B.CLOTH_YELLOW, 'fish', 'cd.stall4');
  well(world, cx, 655);
  for (let z = 615; z <= 720; z += 14) { lampPost(world, cx - 5, z); lampPost(world, cx + 5, z + 7); }
  world.meta.spots['cd.gate'] = { x: cx, y, z: z1 + 8, yaw: 0 };
  world.meta.spots['cd.gate.in'] = { x: cx + 3, y, z: z1 - 8, yaw: Math.PI };
  world.meta.spots['cd.square'] = { x: cx + 4, y, z: 660, yaw: 0 };
  world.meta.spots['cd.wall'] = { x: cx + 14, y, z: z1 - 10, yaw: Math.PI };
  const cf = campfire(world, cx + 22, z1 + 26, { name: 'Caer Dawn Gate', id: 'wp_caerdawn' });
  waypoints.push({ id: 'wp_caerdawn', name: 'Caer Dawn Gate', x: cf.x + 3, y: cf.y, z: cf.z });
  spawns.push({ type: 'dog', x: cx, z: 660, n: 2, r: 20 }, { type: 'chicken', x: 1455, z: 690, n: 4, r: 8 });
  spawns.push({ type: 'guard', x: cx, z: z1 + 4, n: 2, r: 3 });
}

function buildStillwater(world, spawns, waypoints) {
  const S = SETTLE.stillwater; const cx = S.x, cz = S.z;
  const homes = [[cx - 22, cz - 14, 1], [cx + 20, cz - 18, 3], [cx - 18, cz + 18, 0], [cx + 22, cz + 16, 3], [cx, cz - 30, 2], [cx + 2, cz + 32, 0]];
  const names = ['sw.home0', 'sw.elder', 'sw.home2', 'sw.trader', 'sw.home4', 'sw.maskmaker'];
  let deckY = 0;
  homes.forEach(([x, z, r], i) => { const h = stiltHouse(world, x, z, r, { name: names[i], type: i === 3 ? 'shop' : 'home' }); deckY = Math.max(deckY, h.deckY); });
  // central platform
  const by = deckY;
  for (let z = cz - 8; z <= cz + 8; z++) for (let x = cx - 8; x <= cx + 8; x++) { world.set(x, by - 1, z, B.PLANKS_DARK); world.mask[z * WX + x] = 1; }
  for (const [x, z] of [[cx - 8, cz - 8], [cx + 8, cz - 8], [cx - 8, cz + 8], [cx + 8, cz + 8]]) for (let yy = by - 12; yy < by + 3; yy++) world.set(x, yy, z, B.LOG);
  for (const [x, z] of homes) boardwalk(world, [[cx, cz], [x, z]], by);
  boardwalk(world, [[cx, cz], [cx, cz - 60]], by);
  boardwalk(world, [[cx, cz + 32], [cx + 4, cz + 60]], by);
  const cf = { x: cx, y: by, z: cz };
  world.meta.campfires.push({ x: cx + 0.5, y: by, z: cz + 0.5, rest: true, name: 'Stillwater', id: 'wp_stillwater', raised: true });
  world.meta.lights.push({ x: cx + 0.5, y: by + 1, z: cz + 0.5, color: 0xff7a2a, intensity: 1.6, radius: 20, flicker: true });
  for (const [dx, dz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 0]]) world.set(cx + dx, by - 1, cz + dz, B.COBBLE);
  waypoints.push({ id: 'wp_stillwater', name: 'Stillwater', x: cf.x + 3, y: cf.y, z: cf.z });
  world.meta.spots['sw.square'] = { x: cx + 4, y: by, z: cz + 3, yaw: 0 };
  for (const [x, z] of [[cx - 7, cz - 7], [cx + 7, cz + 7]]) { world.set(x, by, z, B.IRON); world.set(x, by + 1, z, B.IRON); world.set(x, by + 2, z, B.LANTERN); world.meta.lights.push({ x: x + 0.5, y: by + 2.5, z: z + 0.5, color: 0xffb060, intensity: 1, radius: 14, flicker: true }); }
  spawns.push({ type: 'duck', x: cx + 30, z: cz, n: 4, r: 10 });
}

function buildSaltby(world, waypoints) {
  const S = SETTLE.saltby; const cx = S.x, cz = S.z;
  paveDisc(world, cx, cz, 10, B.GRAVEL);
  const hs = [[cx - 20, cz - 12, 1], [cx + 20, cz - 14, 3], [cx - 22, cz + 12, 1], [cx - 4, cz - 26, 2], [cx + 18, cz + 14, 3], [cx - 40, cz, 1]];
  hs.forEach(([x, z, r], i) => house(world, { x, z, rot: r, w: 9 + (i % 2) * 2, d: 9, floors: 1, roof: i % 2 ? B.ROOF_BLUE : B.THATCH, type: i === 1 ? 'shop' : 'home', name: i === 0 ? 'sb.fisher' : i === 1 ? 'sb.trader' : 'sb.home' + i, style: 'cream', seed: i * 3, shutters: B.CLOTH_BLUE }));
  // drying racks with fish
  const by = groundAt(world, cx + 6, cz + 22) + 1;
  for (let k = 0; k < 4; k++) { const x = cx - 2 + k * 3; world.set(x, by, cz + 22, B.LOG); world.set(x, by + 1, cz + 22, B.LOG); world.set(x, by + 2, cz + 22, B.LOG); }
  for (let x = cx - 2; x <= cx + 7; x++) { world.set(x, by + 3, cz + 22, B.ROPE); if (x % 2) world.set(x, by + 2, cz + 22, B.WOOL_GREY); }
  // docks into the water to the south-east
  const dk = dock(world, cx + 30, cz + 24, 2, 18, 4);
  boat(world, cx + 37, dk - 1, cz + 34, 0);
  boat(world, cx + 26, dk - 1, cz + 40, 0);
  const cf = campfire(world, cx + 6, cz + 4, { name: 'Saltby', id: 'wp_saltby' });
  waypoints.push({ id: 'wp_saltby', name: 'Saltby', x: cf.x + 3, y: cf.y, z: cf.z });
  world.meta.spots['sb.dock'] = { x: cx + 32, y: dk + 1, z: cz + 30, yaw: Math.PI };
  world.meta.spots['sb.square'] = { x: cx, y: S.ty + 1, z: cz, yaw: 0 };
  lampPost(world, cx - 8, cz - 6); lampPost(world, cx + 10, cz + 10);
}

function buildLighthouse(world) {
  const S = SETTLE.lighthouse;
  const lh = lighthouse(world, S.x, S.z);
  house(world, { x: S.x - 14, z: S.z - 4, rot: 1, w: 9, d: 9, roof: B.ROOF_RED, type: 'home', name: 'keeper', style: 'cream', seed: 5 });
  world.meta.spots['lighthouse.top'] = { x: S.x + 0.5, y: lh.baseY, z: S.z - 1.5, yaw: 0 };
  world.meta.containers.push({ x: S.x + 2, y: lh.baseY, z: S.z + 2, kind: 'chest', loot: 'lighthouse', id: 'lighthouse.chest' });
  world.set(S.x + 2, lh.baseY, S.z + 2, B.CRATE);
  world.set(S.x - 2, lh.baseY, S.z + 1, B.BARREL); world.set(S.x - 2, lh.baseY + 1, S.z + 1, B.BARREL);
}

function buildMine(world, spawns, waypoints) {
  const S = SETTLE.mine; const cx = S.x, cz = S.z;
  const gy = groundAt(world, cx, cz) + 1;
  // entrance frame on the road, tunnel heads north into the mountain
  const pts = [[cx, gy, cz], [cx, gy - 2, cz - 30], [cx - 18, gy - 6, cz - 55], [cx - 10, gy - 8, cz - 85], [cx + 20, gy - 8, cz - 92]];
  tunnel(world, pts, 2.5, B.DEEPSTONE, true);
  carveSphere(world, cx - 10, gy - 3, cz - 85, 9, B.DEEPSTONE);
  carveSphere(world, cx + 22, gy - 4, cz - 95, 7, B.DEEPSTONE);
  for (let k = 0; k < 7; k++) for (let dy = 0; dy < 6; dy++) { world.set(cx - 3, gy + dy, cz + k, B.BEAM); world.set(cx + 3, gy + dy, cz + k, B.BEAM); }
  for (let dx = -4; dx <= 4; dx++) world.set(cx + dx, gy + 6, cz + 3, B.BEAM);
  world.set(cx - 4, gy + 4, cz + 6, B.LANTERN);
  world.meta.lights.push({ x: cx - 3.5, y: gy + 4.5, z: cz + 6.5, color: 0xffb060, intensity: 1, radius: 14, flicker: true });
  house(world, { x: cx + 20, z: cz + 18, rot: 3, w: 9, d: 9, roof: B.ROOF_SLATE, type: 'home', name: 'mine.hut', style: 'plank', shutters: null });
  const cf = campfire(world, cx - 14, cz + 18, { name: 'Ironhollow', id: 'wp_mine' });
  waypoints.push({ id: 'wp_mine', name: 'Ironhollow', x: cf.x + 3, y: cf.y, z: cf.z });
  world.meta.spots['mine.inside'] = { x: cx - 10, y: gy - 8, z: cz - 80, yaw: 0 };
  world.meta.spots['mine.deep'] = { x: cx + 22, y: gy - 8, z: cz - 95, yaw: 0 };
  world.meta.spots['mine.front'] = { x: cx + 6, y: gy, z: cz + 12, yaw: 0 };
  world.meta.interiors.push({ x0: cx - 30, x1: cx + 32, z0: cz - 105, z1: cz + 2, y0: gy - 14, y1: gy + 4, name: 'mine', dungeon: true });
  world.meta.containers.push({ x: cx + 24, y: gy - 9, z: cz - 98, kind: 'chest', loot: 'mine', id: 'mine.chest' });
  world.set(cx + 24, gy - 9, cz - 98, B.CRATE);
  spawns.push({ type: 'rat', x: cx - 10, z: cz - 80, n: 4, r: 6, y: gy - 8, under: true }, { type: 'brigand', x: cx + 20, z: cz - 92, n: 2, r: 4, y: gy - 8, under: true });
}

function buildCrossroads(world, waypoints) {
  const S = SETTLE.crossroads;
  const cf = campfire(world, S.x + 8, S.z + 8, { name: "Crow's Crossroads", id: 'wp_cross' });
  waypoints.push({ id: 'wp_cross', name: "Crow's Crossroads", x: cf.x + 3, y: cf.y, z: cf.z });
  const by = groundAt(world, S.x - 6, S.z - 6) + 1;
  // signpost
  for (let y = 0; y < 6; y++) world.set(S.x - 6, by + y, S.z - 6, B.LOG);
  world.set(S.x - 5, by + 4, S.z - 6, B.PLANKS); world.set(S.x - 4, by + 4, S.z - 6, B.PLANKS);
  world.set(S.x - 6, by + 5, S.z - 5, B.PLANKS); world.set(S.x - 6, by + 5, S.z - 4, B.PLANKS);
  world.set(S.x - 7, by + 3, S.z - 6, B.PLANKS);
  world.meta.signs.push({ x: S.x - 6, y: by, z: S.z - 6, text: 'North — Kingsfall · East — Caer Dawn · South — Greywater · West — the Weald' });
  tent(world, S.x + 16, S.z + 2, 3, B.CLOTH_GREEN, 6, 5);
  world.meta.spots['cross.trader'] = { x: S.x + 12, y: cf.y, z: S.z + 3, yaw: Math.PI / 2 };
}

function buildWatchtower(world, spawns) {
  const S = SETTLE.watchtower;
  tower(world, { x: S.x, z: S.z, r: 5, h: 26, crenel: true, roof: null, lit: false });
  decay(world, S.x - 8, groundAt(world, S.x, S.z) + 6, S.z - 8, S.x + 8, groundAt(world, S.x, S.z) + 30, S.z + 8, 0.45, 21);
  world.meta.containers.push({ x: S.x + 1, y: groundAt(world, S.x, S.z) + 1, z: S.z + 2, kind: 'chest', loot: 'watchtower', id: 'watchtower.chest' });
  world.set(S.x + 1, groundAt(world, S.x, S.z) + 1, S.z + 2, B.CRATE);
  spawns.push({ type: 'wolf', x: S.x + 10, z: S.z + 10, n: 3, r: 8, group: 'millwolves' });
}

function buildDeserterCamp(world, spawns) {
  const S = SETTLE.deserterCamp;
  tent(world, S.x - 8, S.z, 1, B.CLOTH_BLUE, 8, 7);
  tent(world, S.x + 8, S.z - 4, 3, B.WOOL_GREY, 8, 7);
  campfire(world, S.x, S.z + 8, { rest: false });
  wallLine(world, S.x - 18, S.z - 16, S.x + 18, S.z - 16, { h: 4, thick: 1, mat: B.LOG, crenel: false });
  world.meta.containers.push({ x: S.x, y: groundAt(world, S.x, S.z - 10) + 1, z: S.z - 10, kind: 'chest', loot: 'deserter', id: 'deserter.chest' });
  world.set(S.x, groundAt(world, S.x, S.z - 10) + 1, S.z - 10, B.CRATE);
  spawns.push({ type: 'deserter', x: S.x, z: S.z, n: 3, r: 12, group: 'deserter_camp' });
}

function buildMireHeart(world, spawns) {
  const S = SETTLE.mireHeart;
  // ruined stilt hut & gorm's lair of bones & blight
  for (let z = S.z - 16; z <= S.z + 16; z++) for (let x = S.x - 16; x <= S.x + 16; x++) {
    if (Math.hypot(x - S.x, z - S.z) > 16) continue;
    const i = z * WX + x;
    world.surf[i] = hash2(x, z, 3) < 0.7 ? B.BLIGHT : B.MUD;
    if (world.water[i] > world.height[i]) { world.height[i] = world.water[i]; world.water[i] = 0; }
  }
  const h = stiltHouse(world, S.x + 22, S.z - 10, 1, { name: 'mire.hut' });
  decay(world, S.x + 10, h.deckY, S.z - 24, S.x + 34, h.deckY + 14, S.z + 4, 0.5, 31);
  world.meta.containers.push({ x: S.x, y: groundAt(world, S.x, S.z) + 1, z: S.z, kind: 'chest', loot: 'gorm', id: 'gorm.chest' });
  world.set(S.x, groundAt(world, S.x, S.z) + 1, S.z, B.CRATE);
  world.meta.spots['mire.heart'] = { x: S.x + 3, y: groundAt(world, S.x, S.z) + 1, z: S.z + 3, yaw: 0 };
  spawns.push({ type: 'gorm', x: S.x + 2, z: S.z + 4, n: 1, r: 2, unique: 'gorm' });
  spawns.push({ type: 'plaguehound', x: S.x - 30, z: S.z - 20, n: 3, r: 10 }, { type: 'plaguehound', x: S.x - 120, z: S.z - 80, n: 2, r: 10 });
}

function buildBearDen(world, spawns) {
  const S = SETTLE.bearDen;
  const gy = groundAt(world, S.x, S.z) + 1;
  tunnel(world, [[S.x, gy, S.z], [S.x - 8, gy - 1, S.z - 14], [S.x - 10, gy - 2, S.z - 24]], 3.5, B.GRANITE);
  carveSphere(world, S.x - 10, gy + 2, S.z - 28, 7, B.GRANITE);
  world.meta.spots['bear.den'] = { x: S.x - 10, y: gy - 2, z: S.z - 26, yaw: 0 };
  world.meta.containers.push({ x: S.x - 13, y: gy - 3, z: S.z - 31, kind: 'remains', loot: 'den', id: 'den.remains' });
  spawns.push({ type: 'grimtooth', x: S.x - 10, z: S.z - 26, n: 1, r: 2, unique: 'grimtooth', y: gy - 2 });
  spawns.push({ type: 'wolf', x: S.x + 30, z: S.z + 30, n: 3, r: 12 });
}

function buildHollowCave(world, spawns) {
  const S = SETTLE.hollowCave;
  const gy = groundAt(world, S.x, S.z) + 1;
  tunnel(world, [[S.x, gy, S.z], [S.x - 10, gy - 3, S.z - 12], [S.x - 22, gy - 6, S.z - 14], [S.x - 30, gy - 6, S.z - 30]], 2.5, B.MOSS_STONE);
  carveSphere(world, S.x - 30, gy - 2, S.z - 32, 7, B.MOSS_STONE);
  world.meta.spots['cave.end'] = { x: S.x - 30, y: gy - 6, z: S.z - 30, yaw: 0 };
  world.meta.spots['cave.mouth'] = { x: S.x + 3, y: gy, z: S.z + 3, yaw: 0 };
  world.meta.containers.push({ x: S.x - 33, y: gy - 6, z: S.z - 34, kind: 'chest', loot: 'cave', id: 'cave.chest' });
  world.set(S.x - 33, gy - 6, S.z - 34, B.CRATE);
  world.meta.interiors.push({ x0: S.x - 40, x1: S.x + 2, z0: S.z - 42, z1: S.z + 1, y0: gy - 10, y1: gy + 3, name: 'cave', dungeon: true });
  world.set(S.x - 26, gy - 2, S.z - 28, B.LANTERN);
  world.meta.lights.push({ x: S.x - 25.5, y: gy - 1.5, z: S.z - 27.5, color: 0xffa040, intensity: 0.9, radius: 12, flicker: true });
  spawns.push({ type: 'wolf', x: S.x - 30, z: S.z - 30, n: 2, r: 4, y: gy - 6, under: true, group: 'cavewolves' });
}

function buildWreck(world) {
  const S = SETTLE.wreck;
  const by = groundAt(world, S.x, S.z) + 1;
  const F = new Frame(world, S.x, by, S.z, 1);
  for (let lz = -12; lz <= 12; lz++) {
    const half = Math.max(1, 5 - Math.floor(Math.abs(lz) / 3));
    for (let lx = -half; lx <= half; lx++) {
      if (hash2(lx, lz, 9) < 0.25 && lz > -6) continue;
      F.set(lx, 0, lz, B.PLANKS_DARK);
      if (Math.abs(lx) === half) for (let y = 1; y < 5 - (lz > 4 ? 2 : 0); y++) if (hash2(lx * 3, lz + y, 7) > 0.3) F.set(lx + (lx < 0 ? -0 : 0), y, lz, B.PLANKS_DARK);
    }
  }
  for (let y = 0; y < 12; y++) F.set(0, y, -2 + Math.floor(y / 4), B.LOG);
  F.set(1, 9, 0, B.CLOTH_WHITE); F.set(2, 8, 0, B.CLOTH_WHITE); F.set(1, 8, 0, B.CLOTH_WHITE);
  const p = F.wp(0, 1, 6);
  world.meta.containers.push({ x: p.x, y: p.y, z: p.z, kind: 'chest', loot: 'wreck', id: 'wreck.chest' });
  world.set(p.x, p.y, p.z, B.CRATE);
}

function buildSunMeadow(world, waypoints) {
  const S = SETTLE.sunMeadow;
  for (let z = S.z - 22; z <= S.z + 22; z++) for (let x = S.x - 22; x <= S.x + 22; x++) {
    const d = Math.hypot(x - S.x, z - S.z);
    if (d > 22) continue;
    const i = z * WX + x;
    world.surf[i] = B.GRASS;
    world.mask[i] = 1;
    if (hash2(x, z, 41) < 0.1 && d < 16) world.set(x, world.height[i] + 1, z, B.SUNPETAL);
    else if (hash2(x, z, 42) < 0.25) world.set(x, world.height[i] + 1, z, B.TUFT);
  }
  const cf = campfire(world, S.x + 18, S.z + 18, { name: 'Sunpetal Meadow', id: 'wp_meadow' });
  waypoints.push({ id: 'wp_meadow', name: 'Sunpetal Meadow', x: cf.x + 3, y: cf.y, z: cf.z });
  world.meta.spots['meadow.center'] = { x: S.x, y: groundAt(world, S.x, S.z) + 1, z: S.z, yaw: 0 };
}

function addWildSpawns(world, spawns) {
  const r = rng(77);
  // ambient wildlife & roaming threats by biome
  for (let i = 0; i < 520; i++) {
    const x = r.int(60, WX - 60), z = r.int(60, WZ - 60);
    const k = z * WX + x;
    if (world.water[k] || world.height[k] <= SEA + 1 || world.mask[k]) continue;
    const b = world.biome[k];
    const near = (id, d) => Math.hypot(x - SETTLE[id].x, z - SETTLE[id].z) < d;
    if (near('greywater', 150) || near('caerdawn', 170) || near('saltby', 90) || near('quarantine', 110)) {
      if (r() < 0.5) spawns.push({ type: r() < 0.5 ? 'rabbit' : 'crow', x, z, n: r.int(1, 3), r: 6 });
      continue;
    }
    const roll = r();
    switch (b) {
      case 1: // weald
        if (roll < 0.25) spawns.push({ type: 'wolf', x, z, n: r.int(2, 3), r: 10 });
        else if (roll < 0.45) spawns.push({ type: 'deer', x, z, n: r.int(1, 3), r: 8 });
        else if (roll < 0.6) spawns.push({ type: 'boar', x, z, n: 1, r: 4 });
        else if (roll < 0.7) spawns.push({ type: 'bandit', x, z, n: 2, r: 6 });
        else spawns.push({ type: 'rabbit', x, z, n: 2, r: 6 });
        break;
      case 2: // mire
        if (roll < 0.35) spawns.push({ type: 'plaguehound', x, z, n: r.int(1, 3), r: 8 });
        else if (roll < 0.5) spawns.push({ type: 'brute', x, z, n: 1, r: 4 });
        else if (roll < 0.7) spawns.push({ type: 'boar', x, z, n: 1, r: 4 });
        else spawns.push({ type: 'crow', x, z, n: 3, r: 6 });
        break;
      case 3: case 7: // highland / snow
        if (roll < 0.3) spawns.push({ type: 'wolf', x, z, n: r.int(2, 4), r: 10 });
        else if (roll < 0.45) spawns.push({ type: 'bear', x, z, n: 1, r: 4 });
        else if (roll < 0.7) spawns.push({ type: 'deer', x, z, n: 2, r: 8 });
        else spawns.push({ type: 'goat', x, z, n: 2, r: 6 });
        break;
      case 5: // moor
        if (roll < 0.2) spawns.push({ type: 'deserter', x, z, n: 2, r: 6 });
        else if (roll < 0.4) spawns.push({ type: 'wolf', x, z, n: 2, r: 8 });
        else if (roll < 0.65) spawns.push({ type: 'deer', x, z, n: 2, r: 8 });
        else spawns.push({ type: 'crow', x, z, n: 3, r: 6 });
        break;
      default:
        if (roll < 0.12) spawns.push({ type: 'bandit', x, z, n: 2, r: 6 });
        else if (roll < 0.3) spawns.push({ type: 'boar', x, z, n: 1, r: 4 });
        else if (roll < 0.55) spawns.push({ type: 'deer', x, z, n: 2, r: 8 });
        else if (roll < 0.75) spawns.push({ type: 'rabbit', x, z, n: 2, r: 6 });
        else spawns.push({ type: 'crow', x, z, n: 3, r: 6 });
    }
  }
}
