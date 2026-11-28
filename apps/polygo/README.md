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
- **Mirror (🪞):** copies every edit across the centre line (x = 0).

## Retopology helpers
- **Auto retopology (✨):** choose *Quads that follow the shape* or *Quick triangles*, a face count (slider from 100 to
  10,000, or quick picks Light 300, Medium 1,000, Detailed 3,000, Dense 8,000), smoothness, and
  whether to mirror across the centre line. The quad option is the Instant Meshes method (orientation field, position
  field, then extraction), written in JavaScript in `qremeshSrc` inside the page. It runs in a background worker that
  starts only when you press Make quads, with a progress bar and Cancel. Tested: 83 to 97% quads and closed meshes on
  test shapes; a 330,000-triangle sculpt becomes 1,500 quads in about 3 s on a laptop.
- **Overlap warnings:** faces that overlap or cross, fold back over a neighbour, or twist into a bow-tie turn red.
  The ⚠ counter at the top left jumps to each one. Faces are also kept wound the same way, so exports have clean normals.
- **Ring tool:** hold a quad and two arrows appear along its directions. Tap one and Polygo cuts a slice through the
  sculpt along each side of the quad, then lays evenly spaced quads along those two slice loops. A slice through a
  closed sculpt is always a closed loop, so the ring always reconnects exactly onto the first quad. On an open sculpt
  where the slice has a gap it says so instead of leaving half a ring. Works with mirror.
- **Lasso (➰):** Tuto jumps to the bottom-left corner and swings a lasso. Pick *Points* or *Faces*, then draw a loop:
  it gets an orange outline and fills with orange as you draw, and what it will catch lights up live. When you let go
  Tuto throws the rope, it pulls tight, and the catch is his. Only what you can see is caught: a depth snapshot taken
  when the loop starts leaves out anything hidden behind the figure. You can also tap points (or faces) one by one to
  add them, and tap again to let one go; tapping empty space lets go of everything. Drag the catch to move it, drag the
  *Scale* button left or right to shrink or grow it, or *Delete* it. Mirror keeps the other side matched, and with
  snapping on the catch is pressed back onto the sculpt when you let go. *Done* puts Tuto back in the scene.

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

Wood carving and the reference-image box were removed on 2026-11-27 (they're still in the repo history, up to commit `010476e`).
