# Tetherfall

A blocky, high-speed grappling-hook action game that runs in the browser. Swing through a forest of giant trees on a two-anchor **Tether Rig**, manage your gas, and fell stone **Colossi** by cutting the glowing core at the back of their necks.

Built with [Three.js](https://threejs.org) (vendored in `vendor/`). There's no build step. All textures, models, the world and the sound effects are generated in code.

## Run it

Browsers block ES modules loaded from `file://`, so serve the folder over HTTP:

```bash
cd tetherfall
python3 -m http.server 8000   # or: npx http-server -p 8000
```

Then open <http://localhost:8000>. You need a mouse and keyboard.

## Controls

| Key | Action |
| --- | --- |
| LMB / RMB (hold) | fire and hold the left / right anchor |
| Q / C (hold) | alternative anchor keys (for trackpads) |
| Space | jump on the ground · gas boost in the air (along your aim) |
| Shift | reel in hard while anchored |
| G | landing thrusters (brake) |
| WASD | run · steer and pump swings in the air |
| F | slash (a spin cut when you're above ~80 km/h) |
| R | swap in a fresh pair of blades |
| E | resupply at a green beacon |
| B | build mode (LMB break, RMB place, 1–6 pick a block) |
| V / F5 | third / first person |
| H | hide the help panel |
| Esc | pause |

Raising mouse sensitivity in **Settings** makes high-speed flying much easier.

## Gameplay

- **Tether Rig.** Each anchor fires at whatever is under the crosshair, up to 90 m away. The crosshair turns cyan when a target is in range and orange when you're aiming at a colossus core. Ropes only shorten, never stretch, so you swing like a pendulum. Each attached anchor pulls you in, and Shift pulls hard. Anchors can also hook onto colossi.
- **Gas** powers the pull, the boost and the brakes. Pick up cyan canisters (+40%) or resupply at green beacons.
- **Impacts hurt.** Hitting a wall or the ground faster than about 86 km/h costs health. Brake with G.
- **Colossi** walk toward you, wind up and swipe at anything in front of them. Only a cut to the **nape core** kills one, and faster cuts do more damage. Cutting an arm stops it grabbing with that arm for a while. Cutting a leg makes it kneel.
- **Blades** dull with every hit. You carry 8 spare pairs.

## Modes

- **First Flight** is a guided tutorial: walk, use each anchor, boost, reel, land, cut the training dummy, swap blades, then fell a real colossus at the south gate. It hands over to free roam at the end.
- **Free Roam** keeps colossi spawning outside the walls, and more of them come as your kill count rises.

## Code map

| File | Purpose |
| --- | --- |
| `src/main.js` | bootstrap, game loop, camera, aiming, combat, HUD, minimap, tutorial |
| `src/player.js` | player physics, rope constraints, gas, impacts, animation |
| `src/colossus.js` | giant AI, attacks, nape and limb cuts, death |
| `src/world.js` | voxel storage, DDA raycast, AABB collision |
| `src/worldgen.js` | terrain, walled town, houses, towers, giant trees |
| `src/mesher.js` | per-chunk meshing with face culling and ambient occlusion |
| `src/blocks.js` | block registry and the procedurally painted texture atlas |
| `src/models.js` | blocky character models and portrait |
| `src/audio.js` | synthesized sound effects |
