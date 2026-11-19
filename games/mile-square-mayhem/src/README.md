# Mile Square Mayhem — source

`index.html` one level up is the built game. These are the source modules it is bundled from.

- `main.js` game loop, physics (raycasts against the world with three-mesh-bvh), combat, quests, HUD, Google 3D tiles mode
- `hero-skinned.js` + `goblin_data.js` the hero: itemnaut's Meshy model (Masked Goblin, 2,080 verts, 2K colour map), skinned to 11 bones. `rig/` holds the scripts that read the .blend (no Blender needed), cut the hand/belly contact zone and compute geodesic skin weights.
- `character.js` the old primitive hero; its `heroAngles()` still drives the poses (from itemnaut's turnaround and drawings) · `imp.js` the pink imp · `enemies.js` grumps
- `post.js` cel pass: Kuwahara + colour bands for the photo-scanned city, depth ink lines, haze
- `toyworld.js` toy Hoboken, adapted from Stick Head: Garden State (`itemnautsoft/Tuto` `nj/`)
- `build.mjs` esbuild bundle (three.js dev, NASA-AMMOS/3DTilesRendererJS, gkjohnson/three-mesh-bvh cloned from GitHub; run `gen-bvh.mjs` inside the three-mesh-bvh clone first)

Real Hoboken needs a Google Maps Platform key with the Map Tiles API enabled (entered in game, or `?key=`). The `draco/` folder holds the mesh decoder the tiles need.
