# Tetherfall

A blocky, high-speed grappling-hook action game that runs in the browser. Three great walls ring a kingdom of towns and farmland. Beyond them lie a forest of giant trees, ruins and an endless supply of titans. Swing through it all on a two-anchor **Tether Rig**, and fell titans by cutting the glowing core at the back of their necks.

Built with [Three.js](https://threejs.org) (vendored in `vendor/`). The source runs without a build step. All textures, models, the world and the sound effects are generated in code.

## Play without a server

Open `tetherfall-standalone.html` directly in Chrome, Edge or Firefox (double-click it). It holds the whole game in one file. Rebuild it after code changes with `node build.mjs` (needs `esbuild`: `npm i -D esbuild`).

## Run it from source

Browsers block ES modules loaded from `file://`, so serve the folder over HTTP:

```bash
cd tetherfall
python3 -m http.server 8000   # or: npx http-server -p 8000
```

Then open <http://localhost:8000>. You need a mouse and keyboard. Generating the world takes a few seconds.

## Controls

| Key | Action |
| --- | --- |
| LMB / RMB (hold) | fire and hold the left / right anchor |
| Q / C (hold) | alternative anchor keys (for trackpads) |
| Space | jump on the ground · gas boost in the air (along your aim) |
| Shift | reel in hard while anchored |
| G | landing thrusters (brake) |
| WASD | run · steer and pump swings in the air |
| F | slash (a spin cut above ~80 km/h) · hammer it to cut free when grabbed |
| T / Tab | lock on to a titan (cycles) |
| X / middle mouse | **Nape Strike**: dash straight at the nape and cut |
| R | swap in a fresh pair of blades |
| E | talk · resupply at a green depot · free trapped people · open caches · light signal fires |
| U | upgrades (at a depot inside the walls) |
| M | map, mission log and fast travel |
| B | build mode (LMB break, RMB place, 1–6 pick a block) |
| V / F5 | third / first person |
| H | hide the help panel |
| Esc | pause |

## The world

The map is 2 km × 2 km.

- **Merrow** is the capital, inside the **Inner Wall**.
- The **Middle Territory** holds villages, farms and the **Cadet Training Camp**.
- **Corvane District** bulges out of the **Middle Wall**.
- The **Outer Territory** holds more villages and farmland.
- **Tharsk District** bulges out of the **Outer Wall** at the southern tip.
- **Beyond the Walls** lie the Forest of Giants, the Old Keep, abandoned villages, eight watchtowers, supply caches and lost insignias.

Everything except the bare ground can be destroyed:

- Titans walk straight through houses and fell giant trees.
- They pound holes in the great walls. Once a breach opens, others follow them through it.
- A falling titan crushes whatever it lands on.

Townsfolk wander the streets. When a wall near them breaks, they run for the next gate in.

## Gameplay

- **Tether Rig.** Anchors bite whatever is under the crosshair, up to 95 m away (more with upgrades). Ropes only shorten, so you swing like a pendulum. Anchors can also hook onto titans.
- **Flight assist** (on by default, toggle it in Settings):
  - If you aim slightly off, the anchor snaps to the nearest surface (dashed crosshair).
  - Flying at a wall slides you along it instead of smashing you into it.
  - Falling too fast toward the ground fires the landing thrusters for you.
- **Gas** lasts a long time now (upgrades make the tank bigger). Cyan canisters and green depots refill it.
- **Nape Strike (X).** With a nape within ~40 m and a clear line to it, the rig fires both anchors into the titan and throws you at its neck. From behind it is deadly. Head-on, a titan that is watching you will often snatch you out of the air.
- **Grabs.** Most titans grab rather than swat. Hammer **F** to cut through the fingers before you reach the mouth. Nearby scouts may cut you free. Cutting the arm or nape of a titan that holds someone saves them.
- **Titan types.**
  - Regular titans come in every size, with random builds, faces and hair.
  - **Abnormals** sprint, turn without warning and leap at fliers.
  - **Crawlers** run on all fours and pounce.
  - **The Jaw** is tiny, very fast and bites.
  - **The Armored** shatters blades: cut both knees to make it kneel, then strike the nape. It smashes gates in seconds.
  - **The Beast** hurls boulders that smash buildings, and roars for reinforcements.
  - **The Colossal** towers over the wall, kicks gates in and vents scalding steam. Strike between the bursts.
- **Scouts and garrison soldiers** fly and fight alongside you. They chat on the radio, cut napes, cut you free, and sometimes get eaten.
- **Marks** come from kills, rescues, missions, bounties and collectibles. Spend them with Quartermaster Bram (or press U at a depot) on six upgrades: gas tanks, tempered steel, rig motor, long cables, padded harness and blade boxes.

## Modes

- **Story**, five chapters:
  - **First Flight** — cadet training.
  - **The Day the Gate Fell** — the Colossal kicks in Tharsk's gate, you evacuate the district, and the Armored goes for the inner gate.
  - **Hold Corvane** — three waves and the Jaw.
  - **Beyond the Walls** — light the signal fires, rescue a stranded squad at the Old Keep, kill the Beast.
  - **Reclaim the Wall** — defend the engineers sealing the breach, then kill the Armored and the Colossal.

  Between chapters the world is open: take bounties from Clerk Osric in Corvane, explore beyond the walls, and repel incursions when titans mass against the Outer Wall.
- **Siege of Tharsk** — endless waves with bosses, until the inner gate falls.
- **Training** — replay First Flight.

Progress, marks and upgrades are saved in the browser.

## Code map

| File | Purpose |
| --- | --- |
| `src/main.js` | bootstrap, game loop, camera, aiming and assist, combat, people, HUD, map, shop |
| `src/story.js` | chapters, open world, bounties, incursions, background director, siege |
| `src/titans.js` | titan types and AI: hunting, grabbing, leaping, throwing, steam, wall bashing |
| `src/smash.js` | destruction: carving, collapsing buildings, falling trees, wall breaches and sealing, boulders, debris |
| `src/npcs.js` | scouts, townsfolk and named characters |
| `src/player.js` | player physics, rope constraints, gas, flight assist, nape-strike dash, animation |
| `src/world.js` | sectioned voxel storage with heightmap terrain, DDA raycast, AABB collision |
| `src/worldgen.js` | walls, districts, towns with street graphs, villages, camp, forests, ruins, points of interest |
| `src/mesher.js` | chunk meshing with face culling and ambient occlusion, streamed around the camera |
| `src/blocks.js` | block registry and the procedurally painted texture atlas |
| `src/models.js` | player, titan and people models, character portraits |
| `src/audio.js` | synthesized sound effects |
