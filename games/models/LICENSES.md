# 3D models and libraries used by the hub games

| File | Used by | Contents | Source | Licence |
| --- | --- | --- | --- | --- |
| `../vendor/three/` | hole-swallow, helix-smash, stack-ball | three.js r180 build, GLTFLoader, BufferGeometryUtils | https://threejs.org | MIT (`../vendor/three/LICENSE`) |
| `hole-swallow.glb` | hole-swallow | Food Kit (cherries, apple, donut, birthday cake, watermelon, pizza); Platformer Kit (star); Car Kit (sedan, taxi, SUV, van); Nature Kit and City Kit Suburban (trees, houses); City Kit Commercial (building, skyscrapers); City Kit Roads (lamp); Furniture Kit (bench) | Kenney, https://kenney.nl/assets | CC0 1.0 |
| `tower-items.glb` | helix-smash, stack-ball | Platformer Kit jewel | Kenney, https://kenney.nl/assets/platformer-kit | CC0 1.0 |

Every model went through the arcade's `tools/blender/optimize_glb.py` (triangle budget,
textures 512 px or less), was packed into one file per game with shared textures, and
`hole-swallow.glb` was quantized with gltfpack (KHR_mesh_quantization). Tower platforms, the pole,
ball, shield, ring and magnet are modelled in code (`../kit3d/tower3d.js`); the park ground and
skies are drawn in code.
