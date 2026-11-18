# itemnautsoft/ISLANAUT — instructions for Claude

This repo is the home for **every game and app itemnaut and Claude make together**. Whenever a
session builds or changes one, push it here without being asked. That is the standing
agreement with itemnaut.

## Adding or updating a game

1. One folder per game: `games/<slug>/` (kebab-case, e.g. `crowd-crossing`).
   - `index.html` — the playable game. One self-contained file is the norm. Extra assets
     (music, textures, models) go next to it and are loaded with relative paths.
   - `game.json` — metadata for the front page:
     ```json
     {
       "title": "Crowd Crossing",
       "blurb": "Frogger inside out: gather strays, hold hands, cross together.",
       "date": "2026-11-01",
       "updated": "2026-11-06",
       "tags": ["mobile", "arcade"],
       "controls": "Drag to move, tap to grab hands",
       "artifact": "https://claude.ai/artifact/..."
     }
     ```
     Bump `updated` on every change, because the front page sorts by it.
   - `thumb.png` or `thumb.jpg` (optional, about 16:10) is the card image. Without one, a
     coloured letter tile is shown.
2. Don't edit the root `index.html` by hand. `scripts/build-index.mjs` builds it from the
   `game.json` files. Run `node scripts/build-index.mjs` locally to preview it.
3. Commit with a message like `crowd-crossing: add hand-holding chain` and push to `main`.
   The Pages workflow deploys within about a minute to
   `https://itemnautsoft.github.io/ISLANAUT/games/<slug>/`.
4. If the game is also a claude.ai artifact, keep the two in sync and put the artifact link
   in `game.json`.

## Apps

Apps (tools rather than games, e.g. ROOSTER) live in `apps/<slug>/` and follow the same rules
as games, with `app.json` in place of `game.json` (same fields). The front page lists them in
their own Apps section, and they deploy to `https://itemnautsoft.github.io/ISLANAUT/apps/<slug>/`.
For home-screen installs, give an app `manifest.webmanifest` plus `icon-180/192/512.png`.

## Notes
- Exclude Sid Dash. It isn't itemnaut's work.
- Large binaries: keep single files under about 50 MB. Prefer compressed audio (ogg/mp3).
- Games that already have their own repo (e.g. `itemnautsoft/Tuto`, `itemnautsoft/TiTaTo-`) can
  still get a folder here, either as a copy or as a small redirect page to their own
  Pages site.
- **Names (2026-11-17):** the creator goes by **itemnaut** everywhere: credits, comments, docs and
  commit messages. Never use the creator's real name or old handle. The collection is called
  **Itemnaut**. The GitHub account is `itemnautsoft`, with repos `itemnautsoft/ISLANAUT`,
  `itemnautsoft/Tuto` and `itemnautsoft/TiTaTo-`, and Pages live at
  `https://itemnautsoft.github.io/...`. The repo is still named ISLANAUT, so keep that word in URLs
  and repo paths until the repo is renamed.
- **Photos:** strip all metadata (EXIF, GPS location, camera, XMP) from any image before committing
  it. Phone photos of sketches carry the location where they were taken. In Pillow, re-save
  without `exif=` and check `getexif()` comes back empty.
