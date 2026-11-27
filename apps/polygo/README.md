# Polygo

Touch-first low-poly modelling and retopology in the browser (three.js). Live at
https://itemnautsoft.github.io/Soft/apps/polygo/ and kept in sync with the claude.ai
artifact https://claude.ai/artifact/9r6kfueP1DJ5TWi8ZPS6yf. It was called Retopo Studio until 2026-11-26;
the old address `apps/retopo-studio/` redirects here.

## Modes
- **Retopology:** import a sculpt (BLEND, OBJ, GLB/glTF, STL, PLY, FBX, Collada) and build a separate
  low-poly mesh that snaps to its surface. You can hide the sculpt, fade the low-poly, put the sculpt's
  texture on the low-poly (🎨) or run a rough automatic pass (✨) that makes triangles to clean up by hand.
- **Free modelling:** turn snapping off (🧲) to place points on a plane facing the camera.
- **Reference box (📐):** a blank cube. Hold a face to put a front, back, side or top drawing on it, then
  shape the box to match.
- **Wood carving (🪵):** a block with real growth rings. Use the gouge, chisel, V-tool, knife or sandpaper.
  Cutting across the grain can chip, and undo only goes back five steps.
- **Mirror (🪞):** copies every edit across the centre line (x = 0), including the carving.

## Retopology helpers
- **Auto retopology (✨):** choose *Quads that follow the shape* or *Quick triangles*, a face count, smoothness, and
  whether to mirror across the centre line. The quad option is the Instant Meshes method (orientation field, position
  field, then extraction), written in JavaScript in `qremeshSrc` inside the page. It runs in a background worker that
  starts only when you press Make quads, with a progress bar and Cancel. Tested: 83 to 97% quads and closed meshes on
  test shapes; a 330,000-triangle sculpt becomes 1,500 quads in about 3 s on a laptop.
- **Overlap warnings:** faces that overlap or cross, fold back over a neighbour, or twist into a bow-tie turn red.
  The ⚠ counter at the top left jumps to each one. Faces are also kept wound the same way, so exports have clean normals.
- **Ring tool:** hold a quad and two arrows appear along its directions. Tap one to wrap quads of the same width around
  the sculpt until the ring meets the first face (spacing is evened out when it closes). Works with mirror.

## Tuto
Tuto from [Tuto](https://github.com/itemnautsoft/Tuto) lives in the app, with his body, poses and basketball dribble
copied straight from Tuto Maker. He laps your model dribbling (crossovers, spin moves, fingertip spins), leaps up
to swing from your points, goes hand over hand along your edges, and stands on the top points. He only looks at the
mesh and never changes it. If you drag a point he's holding, he holds on. Poke him and he hops out of the way, or
hangs on no longer; drag him to carry him somewhere else. 🏀 turns him on or off.

## Touch controls
- Tap the surface to drop a point. Four points make a quad, or tap the first point again to make a triangle.
- Drag a point or an edge to move it.
- Double-tap an edge to extrude it.
- Hold an edge to add an edge loop. Hold a point to delete it.
- Drag one finger on empty space to orbit. Use two fingers to zoom and pan.
- ✕ cancels an unfinished face.

## Files
- **Export (⬇):** OBJ (keeps quads), GLB, STL or PLY. On this site they download directly. In the
  claude.ai version they arrive as a .zip, because artifacts can only save certain file types.
- **.blend import:** reads mesh geometry and object placement from Blender 2.6 to 5.x files, including
  compressed ones. Materials and modifiers aren't read. For Multires sculpts only the base mesh comes
  through, so apply the modifier first.

## Not done yet
- In-app drawing on the reference box.
