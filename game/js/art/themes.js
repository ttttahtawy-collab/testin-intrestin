// Visual themes per world. Adding a world = adding a theme entry here plus
// a world definition in data/worlds.js.
(function (G) {
  'use strict';
  G.Themes = {
    meadow: {
      sky: ['#5fc3ff', '#bdeeff', '#fff2c9'],
      sun: { x: 0.78, y: 0.2, r: 60, color: '#fff6c8' },
      layers: [
        { kind: 'mountains', colors: ['#8fc0ea', '#a9d1f0'], base: 0.62, amp: 0.3, par: 0.08, seed: 1, snow: '#eef7ff' },
        { kind: 'hills', colors: ['#6cc46a', '#86d47a'], base: 0.74, amp: 0.13, par: 0.22, seed: 2 },
        { kind: 'trees', colors: ['#3e9e57', '#4fb563'], base: 0.84, amp: 0.08, par: 0.4, seed: 3, trunk: '#7a4f33' },
      ],
      ground: { top: '#5fd04a', topDark: '#3fae3a', body: '#9a6440', bodyDark: '#744528', edge: '#5a341d' },
      stone: { top: '#c9b48e', body: '#a48a66', bodyDark: '#836a4b', edge: '#5e4a33' },
      platform: '#c8874a',
      liquid: { color: '#36a8f0', light: '#8fdcff', glow: false, name: 'water' },
      ambient: 'pollen',
      decor: ['flower', 'tuft', 'tuft', 'bush'],
      enemyTint: '#8d8aa3',
    },
    caves: {
      sky: ['#140f2d', '#2c1d55', '#4a2a73'],
      sun: null,
      layers: [
        { kind: 'crystals', colors: ['#2a2058', '#33276a'], base: 0.55, amp: 0.35, par: 0.1, seed: 11, glow: '#6f5bd8' },
        { kind: 'stalag', colors: ['#3a2c74', '#46358a'], base: 0.75, amp: 0.2, par: 0.25, seed: 12 },
        { kind: 'crystals', colors: ['#4b3a92', '#5a46a8'], base: 0.88, amp: 0.15, par: 0.45, seed: 13, glow: '#3ee6d0' },
      ],
      ground: { top: '#3ee0c8', topDark: '#22a99b', body: '#4c3f7c', bodyDark: '#372c5e', edge: '#211a3b' },
      stone: { top: '#a98ef0', body: '#6d58b5', bodyDark: '#54418f', edge: '#2e2356' },
      platform: '#7c66d6',
      liquid: { color: '#28d9b0', light: '#9dfff0', glow: true, name: 'toxic pool' },
      ambient: 'sparkle',
      decor: ['crystal', 'crystal', 'mushroom', 'tuft'],
      dark: 0.0,
      enemyTint: '#6c6a86',
    },
    peaks: {
      sky: ['#4c7fe0', '#a8b9f3', '#ffd2dc'],
      sun: { x: 0.25, y: 0.3, r: 46, color: '#fff0f3' },
      layers: [
        { kind: 'mountains', colors: ['#a7b6e8', '#bfcaf2'], base: 0.55, amp: 0.42, par: 0.06, seed: 21, snow: '#ffffff' },
        { kind: 'mountains', colors: ['#7f93d6', '#93a6e2'], base: 0.7, amp: 0.3, par: 0.18, seed: 22, snow: '#f4f8ff' },
        { kind: 'pines', colors: ['#3d5b9a', '#4b6bad'], base: 0.86, amp: 0.06, par: 0.38, seed: 23, snow: '#eaf3ff' },
      ],
      ground: { top: '#f3f8ff', topDark: '#c9d8f2', body: '#6f7fae', bodyDark: '#56668f', edge: '#36405f' },
      stone: { top: '#bfe6ff', body: '#7db7e0', bodyDark: '#5b93bf', edge: '#335a7c' },
      platform: '#9fb0d9',
      liquid: { color: '#6cc8ff', light: '#e2f6ff', glow: false, name: 'icy water' },
      ambient: 'snow',
      decor: ['icicle', 'tuft', 'rock'],
      enemyTint: '#7c7f99',
    },
    citadel: {
      sky: ['#1c0b16', '#4a1424', '#b2401f'],
      sun: { x: 0.7, y: 0.42, r: 80, color: '#ff8a3a' },
      layers: [
        { kind: 'spires', colors: ['#3a1a2a', '#45202f'], base: 0.58, amp: 0.35, par: 0.07, seed: 31 },
        { kind: 'spires', colors: ['#2a1420', '#331826'], base: 0.74, amp: 0.25, par: 0.2, seed: 32 },
        { kind: 'rocks', colors: ['#1d1018', '#26141e'], base: 0.88, amp: 0.1, par: 0.4, seed: 33 },
      ],
      ground: { top: '#8b8199', topDark: '#665d74', body: '#3e3549', bodyDark: '#2d2636', edge: '#17121d' },
      stone: { top: '#b3a7c0', body: '#5d5170', bodyDark: '#463c56', edge: '#221b2c' },
      platform: '#6d6280',
      liquid: { color: '#ff5a1a', light: '#ffd06a', glow: true, name: 'lava' },
      ambient: 'embers',
      decor: ['rock', 'spikeplant', 'tuft'],
      enemyTint: '#5f5b6b',
    },
  };
})(window.G);
