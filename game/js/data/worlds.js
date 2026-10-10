// World & level registry. To add a level: G.Worlds.addLevel({...}) in a
// data/levels/*.js file and list its id in the world's `levels` array.
(function (G) {
  'use strict';
  const W = (G.Worlds = {
    list: [
      { id: 1, name: 'Sunny Meadows', theme: 'meadow', music: 'w1', color: '#5fd04a', accent: '#ffd84a', levels: ['1-1', '1-2', '1-3', '1-B'] },
      { id: 2, name: 'Crystal Caverns', theme: 'caves', music: 'w2', color: '#8a6bff', accent: '#3ee0c8', levels: ['2-1', '2-2', '2-3', '2-B'] },
      { id: 3, name: 'Frostwind Peaks', theme: 'peaks', music: 'w3', color: '#6cc8ff', accent: '#ffffff', levels: ['3-1', '3-2', '3-3', '3-B'] },
      { id: 4, name: 'The Grey Citadel', theme: 'citadel', music: 'w4', color: '#ff6a2a', accent: '#b3a7c0', levels: ['4-1', '4-2', '4-3', '4-B'] },
    ],
    levels: {},
  });

  W.addLevel = function (def) {
    if (Array.isArray(def.segments)) def.map = W.join(def.segments);
    W.levels[def.id] = def;
  };
  // Concatenate map segments horizontally. Every segment must have the same
  // number of rows; each is padded to its own widest row.
  W.join = function (segs) {
    const rows = segs[0].length;
    const out = new Array(rows).fill('');
    segs.forEach((s, si) => {
      if (s.length !== rows) throw new Error('Segment ' + si + ' has ' + s.length + ' rows, expected ' + rows);
      const w = Math.max.apply(null, s.map((r) => r.length));
      for (let i = 0; i < rows; i++) out[i] += s[i].padEnd(w, '.');
    });
    return out;
  };
  W.order = function () {
    const o = [];
    W.list.forEach((w) => w.levels.forEach((id) => o.push(id)));
    return o;
  };
  W.next = function (id) {
    const o = W.order();
    const i = o.indexOf(id);
    return i >= 0 && i < o.length - 1 ? o[i + 1] : null;
  };
  W.worldOf = function (id) { return W.list[parseInt(id, 10) - 1]; };
  W.isBoss = (id) => /-B$/.test(id);
  W.label = (id) => (W.isBoss(id) ? id.replace('-B', '-★') : id);
})(window.G);
