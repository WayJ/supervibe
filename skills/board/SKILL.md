---
name: board
description: Use when the user wants to view roadmaps and sprint breakdowns as a visual board in a browser.
---

# supervibe:board — read-only roadmap viewer

Generate a zero-pick board: the user opens the page and the content is
already there — no folder selection, ever.

1. Resolve the plugin's `web/` dir: `<this skill's base dir>/../../web`
   (ships `board.html`, `parser.js`, `build-data.mjs`).
2. Target dir in the host: `.agents/board/` (create it).
3. Copy `web/board.html` and `web/parser.js` into `.agents/board/`.
4. Bake the data (roadmaps_dir's parent is normally `docs/superpowers`,
   from the host AGENTS.md `## supervibe` section):
   `node <plugin web>/build-data.mjs <docs/superpowers> <host>/.agents/board/board-data.js`
5. Open `<host>/.agents/board/board.html` in the default browser — Windows:
   `start "" "<path>"`, macOS: `open`, Linux: `xdg-open`. The baked data
   autoloads; the folder picker stays as fallback only.

Refresh: re-run steps 3–4 (the user says board/看板 again). The baked copy is
a generation-time snapshot — the page's folder label says so.

Boundaries: read-only for artifacts; `.agents/board/` is derived output —
recommend the host gitignore it, and never copy host data into the plugin
repo. Board rendering issues (missing columns, unparsed tables) are data
smells surfaced in the page's warning bar — report them, do not edit files
to silence them.
