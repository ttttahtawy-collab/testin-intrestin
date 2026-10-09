// Inventory: list of stacks {id, n}. Equipment lives on the player.
import { ITEMS } from './items.js';

export class Inventory {
  constructor(game) { this.game = game; this.items = []; this.newIds = new Set(); }
  find(id) { return this.items.find((s) => s.id === id); }
  count(id) { return this.items.filter((s) => s.id === id).reduce((a, s) => a + s.n, 0); }
  has(id, n = 1) { return this.count(id) >= n; }
  add(id, n = 1, quiet = false) {
    if (id === 'gold') { this.game.player.gold += n; if (!quiet) this.game.ui.pickup('gold', n); this.game.audio.coins(); return; }
    const d = ITEMS[id];
    if (!d) { console.warn('unknown item', id); return; }
    if (d.stack) { const s = this.find(id); if (s) s.n += n; else this.items.push({ id, n }); }
    else for (let i = 0; i < n; i++) this.items.push({ id, n: 1 });
    this.newIds.add(id);
    if (!quiet) this.game.ui.pickup(id, n);
    this.game.events.emit('item', { id, n });
    if (d.type === 'lore') this.game.events.emit('lore', { id });
  }
  remove(id, n = 1) {
    let left = n;
    for (const s of [...this.items]) {
      if (s.id !== id || left <= 0) continue;
      const take = Math.min(s.n, left);
      s.n -= take; left -= take;
      if (s.n <= 0) this.items.splice(this.items.indexOf(s), 1);
    }
    // unequip if removed equipped item and none left
    const P = this.game.player;
    for (const k in P.equip) if (P.equip[k] === id && !this.has(id)) P.equip[k] = null;
    return n - left;
  }
  serialize() { return this.items.map((s) => [s.id, s.n]); }
  load(arr) { this.items = arr.filter(([id]) => ITEMS[id]).map(([id, n]) => ({ id, n })); }
}
