# supervibe board — static roadmap viewer

- date: 2026-10-01
- status: approved-design (pending implementation)
- scope: `web/board.html` (+ `web/parser.js`), optional `skills/board`, tests

## 1. Goal

A read-only web view of a host repo's supervibe artifact tree. The user opens one
self-contained HTML file shipped with the plugin, picks the host's
`docs/superpowers` directory once, and sees every epic with its full breakdown:
epic → sprints (stub rows + sprint docs) → wave plans (links only).

## 2. Non-goals

- No write path. The board never mutates artifacts; it renders them. State
  transitions stay in the skills.
- No server, no build step, no generator script, no network requests (no CDN
  fonts, no analytics). The page works fully offline from `file://`.
- No plan-content parsing. Wave plans (`plans/`) are listed by filename from
  sprint-doc links; their bodies belong to the superpowers execution layer.
- No `acceptances/` parsing — acceptance records are reachable from their
  sprint docs' evidence links; the board does not model them.
- No multi-repo or hosted/deployed mode.

## 3. Architecture

```
plugin/
  web/
    board.html    # shell + styles + views; classic <script src="parser.js">
    parser.js     # pure parsing/aggregation functions, no DOM
  skills/board/   # optional: opens board.html in browser, explains folder pick
  tests/          # node tests for parser.js
```

- `parser.js` is a classic script (NOT an ES module — module scripts are
  CORS-blocked on `file://`; classic sibling scripts are not). It exposes a
  global `BoardParser` and also sets `module.exports` when loaded under Node,
  so the same file runs in the browser and in unit tests.
- `board.html` loads exactly one sibling script (`parser.js`) and holds all
  markup/styles/render logic inline. Two files total, zero dependencies.

## 4. Directory access

- Picker: `<input type="file" webkitdirectory>` — the user picks the
  `docs/superpowers` folder in the browser's native dialog (its confirm
  button is browser-labeled 上传 and not page-controllable; accepted by user
  preference 2026-10-01 over showDirectoryPicker's dialog). Any read or
  parse failure surfaces in a visible fatal banner — never a silent dead
  end.
- Chromium persistence: `showDirectoryPicker` + IndexedDB handle storage,
  wired only behind the "remember this folder" button; on later opens the
  page re-reads the stored handle (permission re-grant may prompt) and skips
  manual picking. Absent API → the button stays hidden.
- A "change folder" button always re-opens the picker.
- Rationale: a `file://` page cannot read local paths by string (URL params
  included) — the pick gesture is the only portable permission grant.

## 5. Parsing model

All section matching is on exact English heading strings — same
machine-identifier class as YAML keys and skill headings.

### 5.1 Epic docs (`roadmaps/*.md`)

- Frontmatter: `epic`, `status`, `date`. Epic display title = the doc's H1
  (frontmatter carries no title field).
- Sections by heading: `## Sprint Breakdown` (stub rows: sprint id, state,
  note — template vocabulary is planned/ready/started, but §5.4 accepts the
  full state chain), `## Decisions (ADR)` (id, decision, rationale),
  `## Definition of Done` (checkboxes), `## Open Questions` (id + statement +
  lifecycle markers), `## Asset Disposition`, `## Cross-cutting`.
- Markdown tables parsed row-wise; checkbox items `- [x]` / `- [ ]` counted.

### 5.2 Sprint docs (`sprints/*.md`)

- Frontmatter: `sprint`, `epic`, `state`, `worktree`, `early-start`,
  `deferred-dependency`, `clauses`, `merged-commit`.
- Sections: `## Decisions (D-x)`, `## Stories & Tasks` (plan links extracted
  from markdown link targets ending in `.md` under `../plans/`),
  `## Definition of Done`, `## Acceptance Scenarios (S1–Sn)`,
  `## Handover Clauses`.
- `Acceptance Scenarios` appears in two shapes — the template's four-column
  table and backfilled bullet lists. Both parse; items are extracted whole
  (full row / full bullet text) for detail-view rendering, not just counted.
- `Handover Clauses` appears in three shapes; all are parsed:
  1. Entity table — one clause per row, columns `| id | target | trigger |
     obligation | status | evidence |` (the template's normative form).
  2. Field/value vertical table — a single clause as `| field | value |` rows
     (backfill-era form, e.g. dsh-enterprise S6's HC1).
  3. Bullet reference list — target-side docs holding only clause-id
     references (`clauses: [HC#]` pointers); parsed as references, never as
     clause bodies.
  Any other shape surfaces as a data smell, never a silent drop.

### 5.3 Plans (`plans/`)

- Not parsed. A plan appears in the board only when a sprint doc links it;
  rendering is filename + relative path. Clicking a link navigates to the
  local file when the browser allows it (may prompt); a copy-path affordance
  covers the rest.

### 5.4 Aggregation

- Epics sorted by frontmatter `date`, then id.
- Sprint cards merged from two sources: epic stub rows and sprint docs, joined
  on sprint id. Where both exist the sprint doc wins (its frontmatter state is
  truth). Stub-state vocabulary is the full state chain, not only pre-start:
  a stub row may carry a post-start state (`active`…`closed`) when the sprint
  was closed out without a doc (mini close-out) or the doc was later added —
  column placement follows the effective state either way:
  - doc exists → doc frontmatter state, no smell;
  - no doc, stub state pre-start (`planned`/`ready`) → normal stub card;
  - no doc, stub state post-start → card placed in that state's column AND
    flagged as a data smell (`started` missing its doc, or a mini close-out
    recorded only in the stub).
- Cards grouped by state columns: planned / ready / active / acceptance /
  merged / closed (effective state per §5.4 — stubs carrying post-start
  states land in their state's column with a smell flag).
- Handover clauses join issuer sprint → target sprint by id; open clauses get
  an indicator on both cards. A target-side reference (bullet list or
  frontmatter `clauses`) whose issuing body is not found renders as a
  "clause body not found" warning row — never silently dropped.
- No index file is written anywhere; aggregation is in-memory only — the
  decentralized-ledger principle preserved.

## 6. Views

- Left rail: epic list (id, title, status, DoD progress `x/y`, open-question
  count). Clicking switches the main area.
- Main area default: kanban of sprint cards grouped by state column. Card shows
  sprint id, title, worktree, merged-commit, early-start badge, clause badge.
- Card click → detail drawer: stories & plan links, DoD checklist, acceptance
  scenarios, handover-clause table, ADR rows relevant to the sprint.
- Epic header band: DoD checklist, open questions with lifecycle, ADR table,
  asset disposition, cross-cutting rows (collapsed sections).
- Empty/error states are explicit: missing `roadmaps/` or `sprints/` dirs, a
  file with unparsable frontmatter, an orphan sprint doc (epic id unknown) —
  each surfaces as a visible warning row, never silently dropped.

## 7. Visual design

Follows `DESIGN.md` (Claude warm-editorial system) with one offline
constraint: no webfont loading, so the documented local fallback stacks apply.

- Canvas `#faf9f5`, ink `#141413`, cards `#efe9de` on cream, hairline
  `#e6dfd8`; commit hashes / paths / frontmatter values render on dark
  `#181715` code chips (JetBrains Mono / ui-monospace stack).
- Coral `#cc785c` reserved: primary "select folder" CTA, active epic marker,
  inline links. Never a background wash.
- Display type (epic titles, section heads): serif stack
  `Garamond, Georgia, 'Times New Roman', serif`, weight 400, negative
  letter-spacing. Body/UI: `-apple-system, 'Segoe UI', Roboto, sans-serif`
  (StyreneB/Inter are licensed; the Garamond-family and humanist-sans local
  stacks are the documented substitutes).
- Radius: 8px controls, 12px cards, pill badges. Spacing scale 4px base,
  32px card padding. State columns use badge pills (`planned` muted, `active`
  coral-text, `merged`/`closed` success-tinted).
- No hover styling beyond documented press-darkening; no shadows except the
  documented faint hover shadow.

## 8. Data boundary

- The page issues zero network requests. Host artifact data is parsed in
  memory only. Nothing is written to disk (IndexedDB holds only the directory
  handle). The supervibe repo never contains host data — the board ships as
  an empty-shell viewer, so the public-repo boundary is structural.

## 9. Testing

- `tests/board-parser.test.mjs` (Node, same runner pattern as existing
  tests): fixtures for epic doc, sprint doc, stub/doc merge (including a
  post-start stub without a doc — the S8/S9 mini close-out shape), clause
  join in each of the three clause shapes plus a dangling target-side
  reference, malformed frontmatter, orphan sprint. Parser is DOM-free, so
  Node covers it.
- `tests/check-artifacts.mjs`: extend to assert `web/board.html` +
  `web/parser.js` exist and that board.html references parser.js; assert
  `skills/board/SKILL.md` ⇄ `SKILL.zh.md` pair if the skill ships.
- Manual visual pass: open board.html against dsh-enterprise
  `docs/superpowers` (7 sprints, 30+ plan links) and supervibe's own tree.

## 10. Wiring

- Optional `skills/board` (sixth skill): description is trigger-only per the
  repo's SDO rule (e.g. "Use when the user wants to see roadmaps and sprint
  breakdowns as a visual board"); body = locate plugin `web/` dir, open
  `board.html` in the default browser, tell the user to pick
  `docs/superpowers`. Read-only, no artifact writes.
- README (both languages): short "Board" section with a screenshot-free
  description and usage steps.
