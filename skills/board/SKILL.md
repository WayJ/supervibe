---
name: board
description: Use when the user wants to view roadmaps and sprint breakdowns as a visual board in a browser.
---

# supervibe:board — read-only roadmap viewer

Open the plugin's bundled static board in the user's browser.

1. Resolve the HTML: `<this skill's base dir>/../../web/board.html` (the
   plugin ships `web/board.html` + `web/parser.js` together).
2. Open it in the default browser — Windows: `start "" "<path>"`, macOS:
   `open "<path>"`, Linux: `xdg-open "<path>"`.
3. Tell the user: in the page, pick the host's configured `roadmaps_dir`
   parent — normally `docs/superpowers` (from the host AGENTS.md `## supervibe`
   section). On Chromium, "记住此文件夹" avoids re-picking.

Read-only: this skill writes no artifacts, flips no state, and touches no
ledger. Board rendering issues (missing columns, unparsed tables) are data
smells surfaced in the page's warning bar — report them, do not edit files
to silence them.
