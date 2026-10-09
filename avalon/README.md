# Avalon: The Withering

A first-person voxel RPG inspired by the dark Arthurian world of *Tainted Grail: The Fall of Avalon*. It is reimagined without magic or religious symbolism: abilities are martial techniques, remedies are herbal, and the "Wyrdness" is replaced by the Withering, a fungal blight carried by fog from the Mirefen.

Open `dist/index.html` in a desktop browser. It is a single self-contained file. Click the game to capture the mouse.

## What's in Chapter One

- **World**: a 1 km × 1 km island (2048² voxels at 0.5 m each) with eight regions: Greywater Hollow, the Rowan Weald, Kingsfall ruins and their dungeon, the Heather Moor, Caer Dawn castle town, the Mirefen and its stilt village, Highcrag's snowy peaks and mine, and Saltby's fishing coast and lighthouse. There are rivers with waterfalls, lakes, roads with bridges, and the landmark Elder Bloom tree.
- **Main story**: 7 quests across 4 chapters, with branching choices (bargain with, intimidate or fight Red Osric; give the cure to the Watch or sell it to the Steward; arrest or exile the Steward).
- **Side quests**: 11, including the missing boy, the lost ring, the lighthouse, the mine brigands, the Grimtooth bounty and the 8 Chronicle pages.
- **28 named NPCs** plus villagers, all on daily routines (work, meals, inn, sleep). There are 4 bosses and 15+ creature and enemy types.
- **Combat**: light combos, hold-to-charge heavy attacks, blocking and parrying, dodging with i-frames, telegraphed unblockable attacks, stagger and poise, sneak attacks, a bow, pitch pots and throwing knives.
- **Progression**: XP and levels, 4 attributes, 14 feats (4 Resolve abilities), loot with rarities, equipment slots, crafting and cooking at campfires, trading, fast travel between campfires, and saving (autosaves when you rest).
- **Living world**: day/night cycle, weather (fog, rain, storms with lightning, snow at altitude), drifting voxel clouds, aurora, wildlife that flees or flocks, animated mills, doors, smoke, fireflies and falling leaves. Sound is fully synthesized ambience and effects; there is no music.
- **UI**: compass with markers, rotating circular minimap, quest tracker, health/resolve/stamina bars, quick-item diamond, a parchment dialogue panel with portraits, and a book-style journal (Satchel with 3D paper-doll, The Path, Bearer, Map).

## Controls

| Action | Key |
|---|---|
| Move / sprint / jump | WASD / Shift / Space |
| Attack (tap) · heavy (hold) | Left mouse |
| Block · parry (just before a hit) | Right mouse |
| Dodge | V or Alt |
| Interact / talk / loot / gather | E |
| Abilities | 1–4 |
| Use quick item / cycle it | X / Z |
| Throw pitch pot or knife | G |
| Bow / sheathe / sneak / lantern | B / F / C / L |
| Satchel / The Path / Bearer / Map | Tab or I / J or Q / K / M |
| Pause / help | Esc / H |

Touch controls appear automatically on phones (or enable them in Settings).

## Building

```
npm install
node build.mjs src/main.js dist/index.html   # also writes dist/avalon-artifact.html
```

Built with Three.js and bundled with esbuild. Blender wasn't available in the build environment and isn't needed: all geometry (terrain, buildings, characters, items) is generated in code from voxels.

## Layout

- `src/world`: block palette, terrain and region generation, vegetation templates, the modular building kit, and the world composition.
- `src/render`: chunk mesher (AO, sky occlusion, LOD), streaming, sky, weather, water, particles, post-processing.
- `src/entities`: voxel character and creature rigs, animation, physics, pathfinding, AI.
- `src/game`: player, combat, items, inventory, quests, dialogue, NPCs, spawning, the game loop.
- `src/ui`, `src/audio`: HUD and book UI, procedural sound.
- `test/`: Playwright scripts that drive the full main story and check systems end to end.
