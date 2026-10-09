// Voxel collision for upright cylinders approximated as AABBs.
import { SOLID, B } from '../world/blocks.js';

const GRAV = 46;

function solidAt(world, x, y, z) { return SOLID[world.get(x, y, z)] === 1; }

function boxHits(world, x, y, z, r, h) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r - 1e-4);
  const z0 = Math.floor(z - r), z1 = Math.floor(z + r - 1e-4);
  const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-4);
  for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (solidAt(world, xx, yy, zz)) return true;
  return false;
}

export function inWater(world, e) {
  return world.get(e.pos.x, e.pos.y + e.height * 0.45, e.pos.z) === B.WATER;
}

// e: {pos, vel, radius, height, onGround, stepUp}
export function moveEntity(world, e, dt, opts = {}) {
  const r = e.radius, h = e.height;
  const swim = inWater(world, e);
  e.inWater = swim;
  if (!e.flying) {
    if (swim) {
      e.vel.y += (-GRAV * 0.15) * dt;
      e.vel.y *= Math.pow(0.15, dt);
      if (opts.swimUp) e.vel.y = Math.max(e.vel.y, 4);
      // buoyancy to keep head above surface
      if (world.get(e.pos.x, e.pos.y + h * 0.8, e.pos.z) === B.WATER) e.vel.y += 30 * dt;
    } else e.vel.y -= GRAV * dt;
    if (e.vel.y < -60) e.vel.y = -60;
  }
  const p = e.pos;
  const wasGround = e.onGround;
  e.onGround = false;
  // horizontal X
  let dx = e.vel.x * dt, dz = e.vel.z * dt, dy = e.vel.y * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dy)) / 0.45));
  dx /= steps; dz /= steps; dy /= steps;
  let stepped = 0;
  for (let s = 0; s < steps; s++) {
    // X
    if (dx) {
      const nx = p.x + dx;
      if (!boxHits(world, nx, p.y, p.z, r, h)) p.x = nx;
      else if ((wasGround || swim) && e.stepUp && !boxHits(world, nx, p.y + 1.05, p.z, r, h) && !boxHits(world, p.x, p.y + 1.05, p.z, r, h)) { p.x = nx; p.y = Math.floor(p.y + 1.05) + 0.001; stepped += 1; }
      else { e.vel.x = 0; e.hitWall = true; dx = 0; }
    }
    if (dz) {
      const nz = p.z + dz;
      if (!boxHits(world, p.x, p.y, nz, r, h)) p.z = nz;
      else if ((wasGround || swim) && e.stepUp && !boxHits(world, p.x, p.y + 1.05, nz, r, h) && !boxHits(world, p.x, p.y + 1.05, p.z, r, h)) { p.z = nz; p.y = Math.floor(p.y + 1.05) + 0.001; stepped += 1; }
      else { e.vel.z = 0; e.hitWall = true; dz = 0; }
    }
    if (dy) {
      const ny = p.y + dy;
      if (!boxHits(world, p.x, ny, p.z, r, h)) p.y = ny;
      else {
        if (dy < 0) { p.y = Math.floor(ny) + 1; e.onGround = true; if (e.vel.y < -18 && e.onLand) e.onLand(-e.vel.y); }
        else p.y = Math.ceil(ny + h) - h - 0.001;
        e.vel.y = 0; dy = 0;
      }
    }
  }
  // ground probe for stable onGround
  if (!e.onGround && e.vel.y <= 0 && boxHits(world, p.x, p.y - 0.05, p.z, r * 0.9, 0.05)) e.onGround = true;
  e.stepped = stepped;
  // stuck inside a block (spawned in geometry): push up
  if (boxHits(world, p.x, p.y + 0.1, p.z, r * 0.8, h * 0.6)) { p.y += 1; }
  return e;
}
