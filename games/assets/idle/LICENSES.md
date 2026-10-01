# Art, textures and fonts used by the idle and farm games

Every sprite here is a 3D model rendered in Blender 4.2 (Cycles, `render/iso_render.py`) from a fixed 2:1 isometric camera under a warm
golden-hour sun with real cast shadows, then packed into one WebP atlas per game by `pack_atlas.py`. Nothing is drawn by an AI image
generator; no model was made for this repo except where a row says so.

| Files | What | Source | Licence |
| --- | --- | --- | --- |
| `empire.webp`, `farm.webp`, `harvest.webp` (buildings, houses, shops, trees, tractor, barn, silos, windmill, greenhouse, farm animals, crops in three growth stages, fountain, lantern, bench, mailbox) | Rendered sprites | Models already made for Claire's Big Life Adventure (`assets/meadow/models`): Quaternius Simple Buildings, Farm Buildings and Ultimate Crops packs, Kenney Nature Kit, Fantasy Town Kit, Furniture Kit and City Kit Commercial, plus the project's own farm props. Licence files: `claires-big-life-adventure/assets/meadow/licenses/` | CC0 1.0 (Quaternius, Kenney); project-owned models |
| `tex/mountain_grass.jpg`, `dirt_track.jpg`, `plaza_stone.jpg`, `soil_tilled.jpg`, `soil_dirt.jpg`, `rock.jpg`, `straw.jpg`, `planks_warm.jpg` | Ground, rock and wood textures (resized to 256 px) | ambientCG, via `claires-big-life-adventure/assets/meadow/textures` | CC0 1.0 |
| `tex/paper.jpg` | Parchment paper for the cards | Generated with Python and NumPy noise for this game | Original work |
| `monsters.webp` (Tap Monsters) | Rendered sprites of the Ultimate Monsters pack | Quaternius, https://quaternius.com/packs/ultimatemonsters.html | CC0 1.0 |
| `../fonts/fraunces-latin.woff2`, `../fonts/dmsans-latin.woff2` | Fraunces (titles) and DM Sans (interface), Latin subset | Google Fonts | SIL Open Font License 1.1 |

Sounds are the arcade's shared kit (`ArcadeSDK.sfx`, made with ElevenLabs, see the arcade repo `assets/sfx/kit.json`).
