# Ember and the Shattered Prism — Progress Log

A complete 2D platformer that runs in any modern browser. No build step, no
dependencies: open `game/index.html` directly (works from `file://`) or serve the
folder (`npx http-server game`).

## Status: playable start to finish

### Completed features
- **Engine** (`js/core`): fixed 60 Hz timestep, adaptive-aspect logical view (540 tall,
  720–1260 wide) rendered at device-pixel resolution, scene manager with faceted wipe
  transitions, pooled particles, unified input (keyboard, gamepad, multi-touch virtual
  buttons, mouse/tap menus), screen shake, hitstop.
- **Player controller** (`js/game/player.js`, `abilities.js`): acceleration curves, coyote
  time, jump buffering, variable jump height, apex hang, corner correction, double jump,
  wall slide + wall jump, ground pound, dash (unlocked after World 2), punch combo with air
  punch, stomp bounce, knockback/invulnerability, moving-platform riding, drop-through
  one-way platforms. Abilities are plug-in modules.
- **Hero art** (`js/art/hero.js`): procedural, pose-driven, low-poly faceted head, matches the
  reference model. Animations: idle/breathe/blink, run cycle, skid, jump, fall, double-jump
  flip, wall slide, punches (alternating arms), ground pound, dash, hurt, death spin, victory.
- **Combat**: punch / stomp / pound / dash damage; punching enemy projectiles reflects them
  (reflected shots always hurt bosses); breakable blocks (punch, pound, head-bonk).
- **Enemies** (`js/game/enemies.js`, registry by map char): walker `w`, hopper `h`,
  spikeback `k` (unstompable), flyer `f`, turret `t`, charger `c` (dizzy on wall hits),
  cinderling `j` (leaps from liquid).
- **Bosses** (`js/game/bosses.js`): Glumbo (hops + shockwaves, summons), Quartzard (crystal
  arcs, slam + falling stalactites), Galewing (feather fans, swoop, wind gusts), King
  Monochrome (homing orbs, summons, slam, low/high laser beams, rage phase). Each has
  telegraphs, vulnerable windows (max 3 direct hits per window), phase 2 at half HP,
  intro dialogue, title banner, HP bar, death sequence, gate unlock.
- **Content**: 4 themed worlds × (3 levels + boss) = 16 stages, 36 Prism Shards, gems,
  hearts, checkpoints, springs, moving/vertical platforms, crumbling slabs, spikes,
  liquids (water / toxic / icy / lava), Lumi hint signs.
- **Story**: intro, per-world interludes, boss intros/outros, ending (variant for all 36
  shards), credits. Islands on the world map are grey until their boss is beaten.
- **Meta**: title (New / Load / Options / Quit), 3 save slots (overwrite confirm, delete),
  world map with node walking, Lumi's shop (heart crystals ×2, power fist, gem magnet),
  results screen (gems, shards, best time, falls), pause menu, options (music, SFX, shake,
  touch controls auto/on/off, speedrun timer, assist mode, fullscreen).
- **Audio**: all SFX synthesised with Web Audio; procedural music sequencer with 10 tracks.
- **Persistence**: `localStorage` (`ember_prism_slots_v1`, `ember_prism_options_v1`), saved
  on level clear, purchases, and tab hide.

### Tests / tools (`game/tools`)
- `node tools/validate-levels.js [ids]` — loads the real physics + controller headlessly and
  brute-forces jump / double-jump / wall-jump input patterns. Verifies every goal and shard
  is reachable (all 12 platforming levels pass). `MAP=1` prints reachable spots.
- `node tools/browser-tests.js` — every level renders/runs without errors; a bot defeats every
  boss and enters the gate.
- `node tools/flow-test.js` — audio engine, new game → clear level → save → reload → load,
  shop, phone landscape touch controls, frame cost.
- `node tools/smoke-test.js` — menu navigation screenshots.
- Debug URL: `index.html?level=2-3` (add `&dash=1`) jumps straight into a level.

### Implementation decisions
- Vanilla JS + Canvas instead of Phaser: zero downloads, runs offline/`file://`, full control
  of the faceted vector look. Global namespace `G`, classic `<script>` order in `index.html`.
- Levels are ASCII maps authored as 15-row horizontal segments (`G.Worlds.join`). Legend in
  `js/game/level.js`. Tile size 48.
- Static terrain is cached in lazily built chunk canvases (LRU); liquids/crumble drawn live.
- Physics constants live in `Player.C`; level design rules derived from them: single jump
  ≈ 2.9 tiles up / 4 tiles across, double jump ≈ 5 up / 6 across.
- Entities never call audio directly except via the `play` scene API, keeping the controller
  usable headlessly by the validator.

### Extending
- New level: `G.Worlds.addLevel({...})` in `js/data/levels/worldN.js`, add the id to the
  world's `levels` in `js/data/worlds.js`, run the validator.
- New enemy: subclass `G.Enemy`, `G.Enemies.register('<char>', Class)`.
- New boss: subclass `G.Boss`, add to `G.Bosses`, set `boss:` on the level, place `K` + `G`.
- New ability: `G.Abilities.register(...)` and add to `Player.abilityNames`.
- New world: theme in `js/art/themes.js`, world entry in `worlds.js`, music track in `music.js`.

### Remaining ideas / known limitations
- Enemies are not reset on respawn (defeated ones stay defeated) — intentional, forgiving.
- Levels 4-2 / 4-3 have relatively few placed gems (enemies and blocks drop more).
- Possible additions: per-level secret exits, costume shop, time-trial medals, key rebinding UI.
- Balance has been verified for reachability by bot, not by extensive human playtesting —
  tune `Player.C` and boss timers if it feels too hard/easy.
