# supervibe board — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a self-contained static roadmap viewer (`web/board.html` + `web/parser.js`) that renders a host's supervibe artifact tree (epic → sprints → plan links) with zero network, zero build.

**Architecture:** One classic-script parser module (DOM-free, Node-testable, browser-loaded via `<script src>` because ES modules are CORS-blocked on `file://`) plus one HTML shell holding all styles and render logic. Directory access via `<input webkitdirectory>` with a Chromium-only `showDirectoryPicker` + IndexedDB remember-path. Aggregation is in-memory only — no index file ever lands on disk.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5-compatible parser, modern-but-broad JS in the shell), Node >= 20 for tests (zero deps), DESIGN.md warm-editorial tokens.

**Spec:** `docs/superpowers/specs/2026-10-01-board-design.md` (authoritative). Doc-sync debt for this feature is covered by epic ADR **D3** (already in `docs/superpowers/roadmaps/2026-10-01-v0.md`); no new ADR needed.

**Critical details executors must not get wrong:**

- The heading `## Acceptance Scenarios (S1–Sn)` contains **U+2013 en dash**, not hyphen. Copy the exact string; never retype it.
- `parser.js` is a **classic script** (`var BoardParser = (function(){...})();` + CommonJS guard). No `export`, no `import` inside it.
- `board.html` must contain **zero** `http://` / `https://` resource references (fonts included) — check-artifacts enforces this.
- All user-content strings rendered into HTML go through `esc()` — artifact text is untrusted input.
- Commits in this repo use `-c user.name="jw083" -c user.email="jw083@local"`.
- Working tree: `D:/lc_projects/blue_dsh/supervibe/.claude/worktrees/board` (branch `2026-10-01-board`). All paths below are relative to it.

---

### Task 0: sprint stub (self-hosting bookkeeping)

**Files:**
- Modify: `docs/superpowers/roadmaps/2026-10-01-v0.md` (Sprint Breakdown section)

- [ ] **Step 1: Append stub row**

In `## Sprint Breakdown`, append after the S1 row:

```markdown
| S2 | planned | board static viewer — web/board.html + web/parser.js per specs/2026-10-01-board-design.md (D3) |
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/roadmaps/2026-10-01-v0.md
git -c user.name="jw083" -c user.email="jw083@local" commit -m "roadmap: S2 stub — board static viewer"
```

---

### Task 1: parser primitives — frontmatter, sections, tables, checklists

**Files:**
- Create: `web/parser.js`
- Test: `tests/board-parser.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/board-parser.test.mjs` (this header + task-1 tests now; later tasks append test blocks before the summary footer):

```js
// board-parser tests — zero-dep, Node >= 20. Run: node tests/board-parser.test.mjs
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../web/parser.js');

let checks = 0;
const failures = [];
const ok = (c, l) => { checks++; if (!c) failures.push(l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} — got ${JSON.stringify(a)}`);

// ---- Task 1: primitives ----
const fm = P.parseFrontmatter('---\nsprint: S5\nepic: E1\nearly-start: true\nclauses:\n---\n\nbody here');
eq(fm.data.sprint, 'S5', 'frontmatter scalar');
eq(fm.data['early-start'], 'true', 'frontmatter key with dash');
eq(fm.data.clauses, '', 'frontmatter empty value');
ok(fm.body.trim() === 'body here', 'frontmatter body split');
ok(P.parseFrontmatter('no fence').error === 'missing frontmatter fence', 'missing fence error');
ok(P.parseFrontmatter('---\nx: 1\n').error === 'unterminated frontmatter', 'unterminated fence error');

const sec = P.splitSections('# Title H1\n\nintro\n\n## One\na\nb\n\n## Two\nc');
eq(sec.title, 'Title H1', 'H1 title');
eq(sec.sections['One'], 'a\nb\n', 'section text');
eq(sec.sections['Two'], 'c', 'second section');

const tbl = P.parseTable('| id | state |\n|---|---|\n| S1 | planned |\n| S2 | ready |');
eq(tbl.headers, ['id', 'state'], 'table headers');
eq(tbl.rows, [['S1', 'planned'], ['S2', 'ready']], 'table rows');
const headerless = P.parseTable('| a | b |\n| 1 | 2 |');
eq(headerless.headers, null, 'headerless table');

const cl = P.parseChecklist('- [x] done thing\n- [ ] open thing\nplain line');
eq(cl, [{ done: true, text: 'done thing' }, { done: false, text: 'open thing' }], 'checklist');

console.log(failures.length ? `FAIL (${failures.length}/${checks})` : `PASS (${checks})`);
failures.forEach((f) => console.error('  - ' + f));
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 2: Run, verify fail**

Run: `node tests/board-parser.test.mjs`
Expected: module-not-found crash (`Cannot find module '../web/parser.js'`).

- [ ] **Step 3: Implement `web/parser.js` (primitives only)**

```js
// parser.js — supervibe board parsing/aggregation. Pure functions, no DOM.
// Classic script by design: ES modules are CORS-blocked on file:// pages,
// classic sibling scripts are not. board.html loads this via <script src>;
// Node tests load it through the CommonJS guard at the bottom.
var BoardParser = (function () {
  'use strict';

  var CLAUSE_FIELDS = ['id', 'issuer sprint', 'issuer', 'target sprint', 'target',
    'trigger', 'obligation', 'status', 'evidence'];

  // ---- primitives ----

  function parseFrontmatter(text) {
    var s = String(text).replace(/^\uFEFF/, '');
    if (!(s.startsWith('---\n') || s.startsWith('---\r\n'))) {
      return { data: null, body: s, error: 'missing frontmatter fence' };
    }
    var rest = s.replace(/^---\r?\n/, '');
    var m = /^---\r?\n/m.exec(rest);
    if (!m) return { data: null, body: s, error: 'unterminated frontmatter' };
    var data = {};
    rest.slice(0, m.index).split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var i = line.indexOf(':');
      if (i < 1) return;
      data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return { data: data, body: rest.slice(m.index + m[0].length), error: null };
  }

  function splitSections(body) {
    var title = null;
    var sections = {};
    var current = null;
    String(body).split(/\r?\n/).forEach(function (line) {
      if (current === null && title === null && /^# [^#]/.test(line)) {
        title = line.slice(2).trim();
        return;
      }
      var m = /^## (.*)$/.exec(line);
      if (m) { current = m[1].trim(); sections[current] = []; return; }
      if (current !== null) sections[current].push(line);
    });
    var out = { title: title, sections: {} };
    Object.keys(sections).forEach(function (k) { out.sections[k] = sections[k].join('\n'); });
    return out;
  }

  function parseTable(text) {
    var rows = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (t.charAt(0) === '|') {
        var inner = t.endsWith('|') ? t.slice(1, -1) : t.slice(1);
        rows.push(inner.split('|').map(function (c) { return c.trim(); }));
      }
    });
    if (!rows.length) return { headers: null, rows: [] };
    if (rows.length > 1 && rows[1].every(function (c) { return /^:?-{3,}:?$/.test(c); })) {
      return { headers: rows[0], rows: rows.slice(2) };
    }
    return { headers: null, rows: rows };
  }

  function parseChecklist(text) {
    var items = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var m = /^\s*-\s+\[( |x|X)\]\s*(.*)$/.exec(line);
      if (m) items.push({ done: m[1].toLowerCase() === 'x', text: m[2].trim() });
    });
    return items;
  }

  function parseBullets(text) {
    var items = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var m = /^\s*-\s+(.+)$/.exec(line);
      if (m) items.push(m[1].trim());
    });
    return items;
  }

  function extractPlanLinks(text) {
    var seen = {};
    var out = [];
    var re = /\]\(([^)]+\.md)\)/g;
    var m;
    while ((m = re.exec(String(text))) !== null) {
      var p = m[1];
      if (/(^|\/)plans\//.test(p) && !seen[p]) { seen[p] = true; out.push(p); }
    }
    return out;
  }

  return {
    parseFrontmatter: parseFrontmatter,
    splitSections: splitSections,
    parseTable: parseTable,
    parseChecklist: parseChecklist,
    parseBullets: parseBullets,
    extractPlanLinks: extractPlanLinks
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BoardParser;
```

- [ ] **Step 4: Run, verify pass**

Run: `node tests/board-parser.test.mjs`
Expected: PASS, zero failures (exact count informational).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js tests/board-parser.test.mjs
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): parser primitives — frontmatter, sections, tables, checklists"
```

---

### Task 2: epic doc parser

**Files:**
- Modify: `web/parser.js`
- Test: `tests/board-parser.test.mjs` (append block before the `console.log` summary)

- [ ] **Step 1: Append failing tests**

Insert before the summary footer:

```js
// ---- Task 2: epic doc ----
const epicText = [
  '---',
  'epic: E1',
  'status: open',
  'date: 2026-09-24',
  '---',
  '',
  '# E1 · Xiaolan platform v1',
  '',
  '## Sprint Breakdown',
  '',
  '| sprint | state | note |',
  '|---|---|---|',
  '| S1 | merged | r0 poc |',
  '| S9 | planned | later |',
  '',
  '## Decisions (ADR)',
  '',
  '| id | decision | rationale | date | evidence |',
  '|---|---|---|---|---|',
  '| D1 | five skills | small | 2026-10-01 | spec §4 |',
  '',
  '## Definition of Done',
  '',
  '- [x] first',
  '- [ ] second',
  '',
  '## Open Questions',
  '',
  '| id | question | status | resolution |',
  '|---|---|---|---|',
  '| Q1 | where? | closed | commit |',
  '',
  '## Asset Disposition',
  '',
  '| asset | disposition | note |',
  '|---|---|---|',
  '| superpowers | reuse | execution layer |',
  '',
  '## Cross-cutting',
  '',
  '| concern | note |',
  '|---|---|',
  '| brand | later |'
].join('\n');
const e = P.parseEpic('2026-09-24-e1.md', epicText);
eq(e.id, 'E1', 'epic id');
eq(e.status, 'open', 'epic status');
eq(e.title, 'E1 · Xiaolan platform v1', 'epic title from H1');
eq(e.stubs.length, 2, 'stub count');
eq(e.stubs[0], { sprint: 'S1', state: 'merged', note: 'r0 poc' }, 'stub row shape');
eq(e.dod.filter((d) => d.done).length, 1, 'dod checked count');
eq(e.questions[0].id, 'Q1', 'question row');
eq(e.assets[0].asset, 'superpowers', 'asset row');
eq(e.crosscut.length, 1, 'crosscut row');
eq(e.adr[0].decision, 'five skills', 'adr row');
```

- [ ] **Step 2: Run, verify fail**

Run: `node tests/board-parser.test.mjs`
Expected: `FAIL` — `P.parseEpic is not a function`.

- [ ] **Step 3: Implement**

In `web/parser.js`, add before `return {` (and add `parseEpic: parseEpic` to the returned object):

```js
  function parseEpic(name, text) {
    var fm = parseFrontmatter(text);
    var sec = splitSections(fm.body);
    var S = sec.sections;
    var epic = {
      file: name,
      id: fm.data ? fm.data.epic : null,
      status: fm.data ? fm.data.status : null,
      date: fm.data ? fm.data.date : null,
      title: sec.title,
      frontmatterError: fm.error,
      dod: parseChecklist(S['Definition of Done'] || ''),
      stubs: [], adr: [], questions: [], assets: [], crosscut: []
    };
    parseTable(S['Sprint Breakdown'] || '').rows.forEach(function (r) {
      epic.stubs.push({ sprint: r[0], state: r[1], note: r.slice(2).join(' ').trim() });
    });
    parseTable(S['Decisions (ADR)'] || '').rows.forEach(function (r) {
      epic.adr.push({ id: r[0], decision: r[1], rationale: r[2], date: r[3], evidence: r[4] });
    });
    parseTable(S['Open Questions'] || '').rows.forEach(function (r) {
      epic.questions.push({ id: r[0], question: r[1], status: r[2], resolution: r.slice(3).join(' ').trim() });
    });
    parseTable(S['Asset Disposition'] || '').rows.forEach(function (r) {
      epic.assets.push({ asset: r[0], disposition: r[1], note: r.slice(2).join(' ').trim() });
    });
    parseTable(S['Cross-cutting'] || '').rows.forEach(function (r) {
      epic.crosscut.push(r.join(' — '));
    });
    return epic;
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `node tests/board-parser.test.mjs`
Expected: PASS, zero failures (exact count informational).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js tests/board-parser.test.mjs
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): epic doc parser"
```

---

### Task 3: sprint doc parser — scenarios (two shapes) + clauses (three shapes)

**Files:**
- Modify: `web/parser.js`
- Test: `tests/board-parser.test.mjs` (append block)

- [ ] **Step 1: Append failing tests**

```js
// ---- Task 3: sprint doc ----
const EN = '\u2013'; // en dash — heading contains (S1\u2013Sn), U+2013
const sprintText = [
  '---',
  'sprint: S6',
  'epic: E1',
  'state: merged',
  'worktree: （已拆除）',
  'early-start: true',
  'deferred-dependency:',
  'clauses:',
  'merged-commit: 88313f9',
  '---',
  '',
  '# S6 · R3.6 UX',
  '',
  '## Decisions (D-x)',
  '',
  '| id | decision | rationale | evidence |',
  '|---|---|---|---|',
  '| R3.6-D1 | async prepare | see plan | work区 docs/r3.6-plan.md |',
  '',
  '## Stories & Tasks',
  '',
  '| story/task | note |',
  '|---|---|',
  '| W1 cold start | page — [w1](../plans/2026-09-30-r36-w1-ux.md) and [ref](../specs/other.md) |',
  '',
  '## Definition of Done',
  '',
  '- [ ] five items green',
  '',
  '## Acceptance Scenarios (S1' + EN + 'Sn)',
  '',
  '- **S1** cold start visible',
  '- **S2** hot path fast',
  '',
  '## Handover Clauses',
  '',
  '| 字段 | 值 |',
  '|---|---|',
  '| id | HC1 |',
  '| issuer sprint | S6 |',
  '| target sprint | S5 |',
  '| trigger | merge arrives |',
  '| obligation | recheck chain |',
  '| status | open |',
  '| evidence | — |'
].join('\n');
const sp = P.parseSprint('2026-09-30-S6.md', sprintText);
eq(sp.id, 'S6', 'sprint id');
eq(sp.epic, 'E1', 'sprint epic link');
eq(sp.state, 'merged', 'sprint state');
eq(sp.mergedCommit, '88313f9', 'merged-commit');
eq(sp.earlyStart, true, 'early-start bool');
eq(sp.title, 'S6 · R3.6 UX', 'sprint title H1');
eq(sp.stories[0].plans, ['../plans/2026-09-30-r36-w1-ux.md'], 'plan link extracted, non-plan .md excluded');
eq(sp.scenarios, ['**S1** cold start visible', '**S2** hot path fast'], 'scenario bullets shape');

// clause shape 2: field/value vertical table
eq(sp.clauses.length, 1, 'one clause from field/value table');
eq(sp.clauses[0].id, 'HC1', 'clause id');
eq(sp.clauses[0]['target sprint'], 'S5', 'clause target');
eq(sp.clauses[0].status, 'open', 'clause status');
eq(sp.refs.length, 0, 'no refs in issuer doc');

// clause shape 1: entity table (template normative)
const entText = [
  '## Handover Clauses',
  '',
  '| id | target | trigger | obligation | status | evidence |',
  '|---|---|---|---|---|---|',
  '| HC2 | S9 | arrival | review | open | — |'
].join('\n');
const ent = P.parseClauses(entText);
eq(ent.clauses.length, 1, 'entity-table clause count');
eq(ent.clauses[0].target, 'S9', 'entity-table clause target');
eq(ent.clauses[0].obligation, 'review', 'entity-table obligation');

// clause shape 3: bullet reference list (target side)
const refText = '## Handover Clauses\n\n- **HC1** issuer S6 — 复核入口链\n';
const rf = P.parseClauses(refText);
eq(rf.clauses.length, 0, 'bullet list yields no clause bodies');
eq(rf.refs.length, 1, 'bullet list yields one ref');
eq(rf.refs[0].id, 'HC1', 'ref id');

// scenarios table shape
const scTable = P.parseTable('| # | scenario |\n|---|---|\n| S1 | e2e 39/39 |');
eq(scTable.rows[0][1], 'e2e 39/39', 'scenario table shape rows');

// empty section
const none = P.parseClauses('## Handover Clauses\n\n（无）\n');
eq(none.clauses.length, 0, '（无） yields no clauses');
eq(none.refs.length, 0, '（无） yields no refs');

// unrecognized table = smell, not crash
const bad = P.parseClauses('## Handover Clauses\n\n| x | y | z |\n|---|---|---|\n| 1 | 2 | 3 |\n');
ok(bad.smells.length === 1, 'unrecognized clause table flagged as smell');
```

Note the parse order inside `parseClauses` below: bullets are checked **first** (before tables) — a section is either a table or a bullet list, and shape-3 detection must not be confused by stray pipes in bullet text. The tests above pass under either order, but implementer must keep bullet-first.

- [ ] **Step 2: Run, verify fail**

Run: `node tests/board-parser.test.mjs`
Expected: `FAIL` — `P.parseSprint is not a function`.

- [ ] **Step 3: Implement**

Add to `web/parser.js` before `return {` (export `parseClauses` and `parseSprint` too):

```js
  function parseClauses(sectionText) {
    var result = { clauses: [], refs: [], smells: [] };
    var text = String(sectionText || '');
    var bullets = parseBullets(text).filter(function (b) { return /HC\d+/.test(b); });
    if (bullets.length) {
      // shape 3: target-side reference list — ids only, never bodies
      bullets.forEach(function (b) {
        (b.match(/\bHC\d+\b/g) || []).forEach(function (id) {
          result.refs.push({ id: id, text: b });
        });
      });
      return result;
    }
    var t = parseTable(text);
    if (!t.rows.length) return result; // empty / （无）
    if (t.headers && t.headers.length >= 5) {
      // shape 1: entity table (template normative)
      t.rows.forEach(function (r) {
        var row = {};
        t.headers.forEach(function (h, i) { row[h.toLowerCase()] = r[i] || ''; });
        if (/^HC\d+$/.test(row.id || '')) result.clauses.push(row);
        else result.smells.push('unrecognized clause row: ' + r.join(' | ').slice(0, 80));
      });
      return result;
    }
    if (t.headers && t.headers.length === 2) {
      // shape 2: field/value vertical table — one clause
      var row2 = {};
      var known = 0;
      t.rows.forEach(function (r) {
        var k = (r[0] || '').toLowerCase();
        if (CLAUSE_FIELDS.indexOf(k) >= 0) { row2[k] = r[1] || ''; known++; }
      });
      if (known >= 3 && row2.id) { result.clauses.push(row2); return result; }
    }
    result.smells.push('unrecognized Handover Clauses table shape');
    return result;
  }

  function parseSprint(name, text) {
    var fm = parseFrontmatter(text);
    var d = fm.data || {};
    var sec = splitSections(fm.body);
    var S = sec.sections;
    var sprint = {
      file: name,
      id: d.sprint || null,
      epic: d.epic || null,
      state: d.state || null,
      worktree: d.worktree || '',
      earlyStart: d['early-start'] === 'true',
      deferred: d['deferred-dependency'] || '',
      clausesFront: d.clauses || '',
      mergedCommit: d['merged-commit'] || '',
      title: sec.title,
      frontmatterError: fm.error,
      dod: parseChecklist(S['Definition of Done'] || ''),
      decisions: [], stories: [], scenarios: [],
      clauses: [], refs: [], smells: []
    };
    parseTable(S['Decisions (D-x)'] || '').rows.forEach(function (r) {
      sprint.decisions.push({ id: r[0], decision: r[1], rationale: r[2], evidence: r.slice(3).join(' ').trim() });
    });
    parseTable(S['Stories & Tasks'] || '').rows.forEach(function (r) {
      var joined = r.join(' — ');
      sprint.stories.push({ text: joined, plans: extractPlanLinks(joined) });
    });
    var sc = S['Acceptance Scenarios (S1\u2013Sn)'] || '';
    var scTable = parseTable(sc);
    sprint.scenarios = (scTable.rows.length && scTable.headers)
      ? scTable.rows.map(function (r) { return r.join(' — '); })
      : parseBullets(sc);
    var cl = parseClauses(S['Handover Clauses'] || '');
    sprint.clauses = cl.clauses;
    sprint.refs = cl.refs;
    sprint.smells = cl.smells;
    return sprint;
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `node tests/board-parser.test.mjs`
Expected: PASS, zero failures (exact count informational).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js tests/board-parser.test.mjs
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): sprint doc parser — dual scenario shapes, three clause shapes"
```

---

### Task 4: aggregation — merge, effective state, clause join, warnings

**Files:**
- Modify: `web/parser.js`
- Test: `tests/board-parser.test.mjs` (append block)

- [ ] **Step 1: Append failing tests**

```js
// ---- Task 4: aggregate ----
const epicA = { name: '2026-09-24-e1.md', text: [
  '---', 'epic: E1', 'status: open', 'date: 2026-09-24', '---', '',
  '# E1 · demo', '',
  '## Sprint Breakdown', '',
  '| sprint | state | note |', '|---|---|---|',
  '| S1 | merged | has doc |',
  '| S8 | merged | mini close-out no doc |',
  '| S10 | planned | future |',
  '', '## Definition of Done', '', '- [x] one', '',
  '## Decisions (ADR)', '', '| id | decision | rationale | date | evidence |', '|---|---|---|---|---|',
  '', '## Asset Disposition', '', '## Open Questions', '', '## Cross-cutting', ''
].join('\n') };
const docS1 = { name: '2026-09-24-S1.md', text: sprintText.replace('sprint: S6', 'sprint: S1') };
const docS9 = { name: '2026-09-30-S9.md', text: [
  '---', 'sprint: S9', 'epic: E1', 'state: active', 'worktree: wt-9',
  'early-start: false', 'deferred-dependency:', 'clauses:', 'merged-commit:',
  '---', '', '# S9 · no stub row', '',
  '## Handover Clauses', '', '- **HC1** issuer S1 — ref only', ''
].join('\n') };
const docOrphan = { name: '2026-10-01-SX.md', text: [
  '---', 'sprint: SX', 'epic: E9', 'state: active', 'worktree: w', 'early-start: false',
  'deferred-dependency:', 'clauses:', 'merged-commit:', '---', '', '# SX · orphan', ''
].join('\n') };

const agg = P.aggregate({ roadmaps: [epicA], sprints: [docS1, docS9, docOrphan] });
const e1 = agg.epics[0];

// stub/doc merge: doc wins
const c1 = e1.cards.find((c) => c.id === 'S1');
ok(c1 && c1.source === 'doc', 'S1 doc wins over merged stub');
ok(!c1.smell, 'S1 no smell');
// post-start stub without doc: placed in merged column + smell (S8 mini close-out)
const c8 = e1.cards.find((c) => c.id === 'S8');
ok(c8 && c8.state === 'merged' && c8.source === 'stub' && c8.smell === true, 'S8 effective state + smell');
// pre-start stub: normal
const c10 = e1.cards.find((c) => c.id === 'S10');
ok(c10 && c10.source === 'stub' && c10.smell === false, 'S10 normal stub card');
// doc with no stub row still appears (S9)
const c9 = e1.cards.find((c) => c.id === 'S9');
ok(c9 && c9.source === 'doc', 'doc without stub row attached');
// clause join: S9 refs HC1, S1 (docS1 = sprintText clone) holds HC1 body → no dangling warning
ok(!agg.warnings.some((w) => w.kind === 'clause-body-not-found'), 'clause ref joined to issuer body');
// orphan doc → warning
ok(agg.warnings.some((w) => w.kind === 'orphan' && /SX/.test(w.msg)), 'orphan sprint doc warned');
// stub-no-doc smell warning
ok(agg.warnings.some((w) => w.kind === 'stub-no-doc' && /S8/.test(w.msg)), 'post-start stub warning');

// dangling ref
const dangling = P.aggregate({ roadmaps: [epicA], sprints: [docS9] });
ok(dangling.warnings.some((w) => w.kind === 'clause-body-not-found'), 'dangling ref warned');
// empty dirs
const empty = P.aggregate({ roadmaps: [], sprints: [] });
ok(empty.warnings.some((w) => w.kind === 'missing-dir'), 'missing-dir warning');
// started stub without doc (template vocabulary) — spec §5.4 post-start branch
const epicStarted = { name: '2026-10-02-e2.md', text: [
  '---', 'epic: E2', 'status: open', 'date: ' + new Date().toISOString().slice(0, 10), '---', '',
  '# E2 · started stub', '',
  '## Sprint Breakdown', '',
  '| sprint | state | note |', '|---|---|---|',
  '| S12 | started | ghost sprint |',
  '', '## Definition of Done', '', '## Decisions (ADR)', '',
  '## Asset Disposition', '', '## Open Questions', '', '## Cross-cutting', ''
].join('\n') };
const agg2 = P.aggregate({ roadmaps: [epicStarted], sprints: [] });
const c12 = agg2.epics[0].cards.find((c) => c.id === 'S12');
ok(c12 && c12.smell === true, 'started stub without doc = smell');
ok(agg2.warnings.some((w) => w.kind === 'stub-no-doc' && /S12/.test(w.msg)), 'started stub warning');
```

- [ ] **Step 2: Run, verify fail**

Run: `node tests/board-parser.test.mjs`
Expected: `FAIL` — `P.aggregate is not a function`.

- [ ] **Step 3: Implement**

Add to `web/parser.js` (export `aggregate`):

```js
  var POST_START = ['started', 'active', 'acceptance', 'merged', 'closed'];

  function aggregate(input) {
    var warnings = [];
    if (!input.roadmaps.length) warnings.push({ kind: 'missing-dir', msg: 'roadmaps/ has no markdown files — pick the docs/superpowers folder' });
    if (!input.sprints.length) warnings.push({ kind: 'missing-dir', msg: 'sprints/ has no markdown files' });

    var epics = [];
    input.roadmaps.forEach(function (f) {
      var e = parseEpic(f.name, f.text);
      if (!e.id) { warnings.push({ kind: 'bad-frontmatter', msg: f.name + ': ' + (e.frontmatterError || 'no epic key') }); return; }
      e.cards = [];
      epics.push(e);
    });
    epics.sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id));
    });
    var byEpic = {};
    epics.forEach(function (e) { byEpic[e.id] = e; });

    var docs = {};
    input.sprints.forEach(function (f) {
      var s = parseSprint(f.name, f.text);
      if (!s.id || !s.epic) { warnings.push({ kind: 'bad-frontmatter', msg: f.name + ': ' + (s.frontmatterError || 'missing sprint/epic key') }); return; }
      if (docs[s.id]) warnings.push({ kind: 'duplicate', msg: 'two sprint docs claim ' + s.id + ' (' + docs[s.id].file + ', ' + f.name + ')' });
      s.card = {
        id: s.id, state: s.state, source: 'doc',
        smell: s.smells.length > 0,
        title: s.title || s.id, doc: s
      };
      docs[s.id] = s;
    });

    epics.forEach(function (e) {
      e.stubs.forEach(function (stub) {
        var doc = docs[stub.sprint];
        if (doc) {
          if (doc.epic !== e.id) warnings.push({ kind: 'cross-epic', msg: stub.sprint + ' stub in epic ' + e.id + ' but doc claims epic ' + doc.epic });
          e.cards.push(doc.card);
          return;
        }
        var postStart = POST_START.indexOf(stub.state) >= 0;
        e.cards.push({
          id: stub.sprint, state: stub.state, source: 'stub', smell: postStart,
          title: (stub.note || stub.sprint).split('（')[0].slice(0, 60),
          note: stub.note
        });
        if (postStart) warnings.push({ kind: 'stub-no-doc', msg: 'sprint ' + stub.sprint + ' stub carries post-start state ' + stub.state + ' with no sprint doc' });
      });
    });
    Object.keys(docs).forEach(function (id) {
      var s = docs[id];
      var e = byEpic[s.epic];
      if (!e) { warnings.push({ kind: 'orphan', msg: s.file + ' claims unknown epic ' + s.epic }); return; }
      if (!e.cards.some(function (c) { return c.id === id; })) e.cards.push(s.card);
    });
    epics.forEach(function (e) {
      e.cards.sort(function (a, b) {
        return (parseInt(a.id.replace(/\D/g, ''), 10) || 0) - (parseInt(b.id.replace(/\D/g, ''), 10) || 0);
      });
    });

    // clause join: issuer bodies vs target-side refs
    var bodies = {};
    Object.keys(docs).forEach(function (id) {
      docs[id].clauses.forEach(function (c) {
        (bodies[c.id] = bodies[c.id] || []).push({ sprint: id, clause: c });
      });
    });
    Object.keys(docs).forEach(function (id) {
      var refs = docs[id].refs.slice();
      (String(docs[id].clausesFront).match(/\bHC\d+\b/g) || []).forEach(function (cid) {
        refs.push({ id: cid, text: 'frontmatter clauses' });
      });
      refs.forEach(function (r) {
        if (!bodies[r.id]) warnings.push({ kind: 'clause-body-not-found', msg: 'sprint ' + id + ' references ' + r.id + ' but no sprint doc holds its body' });
      });
    });

    return { epics: epics, warnings: warnings };
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `node tests/board-parser.test.mjs`
Expected: PASS, zero failures (exact count informational).

- [ ] **Step 5: Commit**

```bash
git add web/parser.js tests/board-parser.test.mjs
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): aggregation — effective state, clause join, smell warnings"
```

---

### Task 5: board.html — shell, tokens, directory access

No automated DOM tests (file:// page, no harness) — this task is verified by check-artifacts assertions (Task 7) and the manual visual pass (Task 8). Node-parseable logic stays in `parser.js` by design.

**Files:**
- Create: `web/board.html`

- [ ] **Step 1: Write the full shell**

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>supervibe board</title>
<style>
  /* DESIGN.md warm-editorial tokens — offline local font stacks only */
  :root {
    --primary: #cc785c; --primary-active: #a9583e; --primary-disabled: #e6dfd8;
    --ink: #141413; --body: #3d3d3a; --muted: #6c6a64; --muted-soft: #8e8b82;
    --hairline: #e6dfd8; --hairline-soft: #ebe6df;
    --canvas: #faf9f5; --surface-soft: #f5f0e8; --surface-card: #efe9de;
    --surface-cream-strong: #e8e0d2; --surface-dark: #181715; --surface-dark-elevated: #252320;
    --on-primary: #fff; --on-dark: #faf9f5; --on-dark-soft: #a09d96;
    --accent-teal: #5db8a6; --success: #5db872; --warning: #d4a017; --error: #c64545;
    --serif: Garamond, Georgia, 'Times New Roman', serif;
    --sans: -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, monospace;
    --r-md: 8px; --r-lg: 12px; --r-pill: 9999px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--canvas); color: var(--body);
    font: 400 16px/1.55 var(--sans); }
  h1, h2, h3 { font-family: var(--serif); font-weight: 400; color: var(--ink);
    margin: 0; letter-spacing: -0.5px; }
  button { font: 500 14px/1 var(--sans); cursor: pointer; }
  .btn-primary { background: var(--primary); color: var(--on-primary);
    border: none; border-radius: var(--r-md); padding: 12px 20px; height: 40px; }
  .btn-primary:active { background: var(--primary-active); }
  .btn-secondary { background: var(--canvas); color: var(--ink);
    border: 1px solid var(--hairline); border-radius: var(--r-md);
    padding: 12px 20px; height: 40px; }
  .topbar { display: flex; align-items: center; gap: 16px; padding: 0 24px;
    height: 64px; border-bottom: 1px solid var(--hairline); }
  .topbar .wordmark { font-family: var(--serif); font-size: 18px; color: var(--ink); }
  .topbar .folder { color: var(--muted); font-size: 13px; }
  .layout { display: grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 64px); }
  .rail { border-right: 1px solid var(--hairline); padding: 16px; }
  .rail button { display: block; width: 100%; text-align: left; background: none;
    border: none; padding: 10px 12px; border-radius: var(--r-md); color: var(--muted); }
  .rail button.active { background: var(--surface-card); color: var(--ink); }
  .rail .meta { font-size: 12px; color: var(--muted-soft); }
  .content { padding: 24px 32px; max-width: 1200px; }
  .epic-head h1 { font-size: 36px; }
  .badge { display: inline-block; border-radius: var(--r-pill); padding: 4px 12px;
    font: 500 13px/1.4 var(--sans); background: var(--surface-card); color: var(--ink); }
  .badge.coral { background: var(--primary); color: var(--on-primary);
    text-transform: uppercase; letter-spacing: 1.5px; font-size: 12px; }
  .badge.state-active { color: var(--primary); background: var(--surface-card); }
  .badge.state-merged, .badge.state-closed { color: var(--success); background: var(--surface-card); }
  .columns { display: flex; gap: 16px; align-items: flex-start; overflow-x: auto; }
  .col { flex: 0 0 260px; }
  .col > h3 { font-size: 16px; font-family: var(--sans); font-weight: 500;
    color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px; font-size: 12px; }
  .card { background: var(--surface-card); border-radius: var(--r-lg);
    padding: 16px; margin-top: 12px; color: var(--ink); }
  .card:hover { box-shadow: 0 1px 3px rgba(20,20,19,0.08); }
  .card .id { font: 500 16px/1.4 var(--sans); }
  .card .sub { font-size: 13px; color: var(--muted); margin-top: 4px; }
  .chip { display: inline-block; background: var(--surface-dark); color: var(--on-dark);
    font: 400 12px/1.6 var(--mono); border-radius: 4px; padding: 1px 6px; }
  .smell { color: var(--warning); }
  .empty { display: grid; place-items: center; min-height: 60vh; text-align: center; }
  .empty h1 { font-size: 48px; }
  .empty p { color: var(--muted); max-width: 480px; }
  .warnbar { background: var(--surface-soft); border-bottom: 1px solid var(--hairline);
    padding: 8px 24px; font-size: 13px; }
  .warnbar div { color: var(--warning); }
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px;
    background: var(--canvas); border-left: 1px solid var(--hairline);
    padding: 24px; overflow-y: auto; }
  .drawer h2 { font-size: 28px; }
  .drawer details { border-top: 1px solid var(--hairline-soft); padding: 12px 0; }
  .drawer summary, .band summary { cursor: pointer; font: 500 14px/1.4 var(--sans); color: var(--muted); }
  .drawer table { border-collapse: collapse; width: 100%; font-size: 13px; }
  .drawer td, .drawer th { border-bottom: 1px solid var(--hairline-soft);
    padding: 6px 8px; text-align: left; vertical-align: top; }
  .planlink { color: var(--primary); cursor: pointer; text-decoration: underline;
    font-family: var(--mono); font-size: 12px; word-break: break-all; }
  .band { margin: 16px 0 24px; }
  .band details { border-top: 1px solid var(--hairline-soft); padding: 8px 0; }
</style>
</head>
<body>
<header class="topbar">
  <span class="wordmark">supervibe board</span>
  <button class="btn-secondary" id="pick">选择 docs/superpowers 文件夹</button>
  <button class="btn-secondary" id="remember" hidden>记住此文件夹（Chromium）</button>
  <button class="btn-secondary" id="restore" hidden>恢复上次文件夹</button>
  <span class="folder" id="folderName"></span>
  <input type="file" id="dirInput" webkitdirectory multiple hidden>
</header>
<div id="warnbar" class="warnbar" hidden></div>
<main id="app" class="empty">
  <div>
    <h1>Roadmap board</h1>
    <p>选择仓库的 <code>docs/superpowers</code> 文件夹（含 roadmaps/ 与 sprints/）。
    页面只在本机内存解析，不发出任何网络请求，不写任何文件。</p>
    <button class="btn-primary" id="pickHero">选择文件夹</button>
  </div>
</main>
<script src="parser.js"></script>
<script>
'use strict';
var P = BoardParser;
var state = { files: null, model: null, epicIndex: 0, folderName: '' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---- directory access ----
document.getElementById('pick').onclick =
document.getElementById('pickHero').onclick = function () { document.getElementById('dirInput').click(); };
document.getElementById('dirInput').onchange = function (ev) {
  var roadmaps = [], sprints = [];
  var files = Array.prototype.slice.call(ev.target.files);
  var pending = files.length;
  if (!pending) return;
  state.folderName = (files[0].webkitRelativePath || '').split('/')[0];
  files.forEach(function (f) {
    // webkitRelativePath INCLUDES the picked folder name as its first segment
    // ("superpowers/roadmaps/x.md") — strip it; fall back to bare name when
    // the browser omits the prefix.
    var raw = f.webkitRelativePath || f.name;
    var rel = raw.split('/').slice(1).join('/') || raw;
    var reader = new FileReader();
    reader.onload = function () {
      if (/^roadmaps\/[^/]+\.md$/.test(rel)) roadmaps.push({ name: rel, text: String(reader.result) });
      if (/^sprints\/[^/]+\.md$/.test(rel)) sprints.push({ name: rel, text: String(reader.result) });
      if (--pending === 0) load({ roadmaps: roadmaps, sprints: sprints });
    };
    reader.readAsText(f);
  });
};

// Chromium remember-path: showDirectoryPicker + IndexedDB handle store
function idb() {
  return new Promise(function (res, rej) {
    var rq = indexedDB.open('supervibe-board', 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore('handles'); };
    rq.onsuccess = function () { res(rq.result); };
    rq.onerror = function () { rej(rq.error); };
  });
}
document.getElementById('remember').onclick = function () {
  if (!window.showDirectoryPicker) return;
  window.showDirectoryPicker().then(function (h) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(h, 'dir');
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }).then(function () { location.reload(); }).catch(function () {});
};
function readHandle(h) {
  var roadmaps = [], sprints = [];
  function walk(dir, prefix) {
    var iter = dir.entries();
    function step() {
      var n = iter.next();
      if (n.done) return Promise.resolve();
      var entry = n.value;
      var rel = prefix + entry[0];
      if (entry[1].kind === 'directory') {
        if (entry[0] === 'roadmaps' || entry[0] === 'sprints') return walk(entry[1], rel + '/').then(step);
        return step();
      }
      if (/^roadmaps\/[^/]+\.md$/.test(rel)) return entry[1].getFile().then(function (f) {
        return f.text().then(function (t) { roadmaps.push({ name: rel, text: t }); });
      }).then(step);
      if (/^sprints\/[^/]+\.md$/.test(rel)) return entry[1].getFile().then(function (f) {
        return f.text().then(function (t) { sprints.push({ name: rel, text: t }); });
      }).then(step);
      return step();
    }
    return step();
  }
  return walk(h, '').then(function () { return { roadmaps: roadmaps, sprints: sprints }; });
}
(function tryRestore() {
  if (!window.showDirectoryPicker || !window.indexedDB) return;
  idb().then(function (db) {
    return new Promise(function (res) {
      var tx = db.transaction('handles', 'readonly');
      var rq = tx.objectStore('handles').get('dir');
      rq.onsuccess = function () { res(rq.result || null); };
      rq.onerror = function () { res(null); };
    });
  }).then(function (h) {
    if (!h) return;
    state.folderName = h.name;
    var btn = document.getElementById('restore');
    btn.hidden = false;
    btn.onclick = function () {
      h.requestPermission({ mode: 'read' }).then(function (p) {
        if (p !== 'granted') return;
        readHandle(h).then(load);
      });
    };
    // auto-load when permission is already granted
    h.queryPermission({ mode: 'read' }).then(function (p) {
      if (p === 'granted') readHandle(h).then(load);
    });
  }).catch(function () {});
})();

// ---- model + render ----
function load(files) {
  state.files = files;
  state.model = P.aggregate(files);
  document.getElementById('folderName').textContent = state.folderName || '(unnamed folder)';
  var rb = document.getElementById('remember');
  if (window.showDirectoryPicker) rb.hidden = false;
  render();
}
function render() { /* Task 6 implements rail + columns + drawer */ }
</script>
</body>
</html>
```

- [ ] **Step 2: Syntax sanity**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('web/board.html','utf8');const m=t.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('inline JS parses')"`
Expected: `inline JS parses`.

- [ ] **Step 3: Commit**

```bash
git add web/board.html
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): html shell — tokens, layout, directory access"
```

---

### Task 6: board.html — render (rail, columns, drawer, warnings)

**Files:**
- Modify: `web/board.html` (replace the stub `render()` and empty `<script>` tail)

- [ ] **Step 1: Implement render inside the inline script**

Replace `function render() { /* Task 6 ... */ }` with:

```js
var STATES = ['planned', 'ready', 'active', 'acceptance', 'merged', 'closed'];

// Column mapping: template-vocabulary `started` rides the active column;
// any unknown state gets an explicit catch-all column — never invisible.
function colOf(state) {
  if (STATES.indexOf(state) >= 0) return state;
  if (state === 'started') return 'active';
  return 'other';
}
// Card label without duplicating the sprint id when the title already leads with it.
function cardLabel(c) {
  var t = String(c.title || '');
  return t.indexOf(c.id) === 0 ? t : c.id + ' · ' + t;
}

function render() {
  var app = document.getElementById('app');
  app.className = '';
  app.innerHTML = '';
  var m = state.model;
  renderWarnings(m.warnings);
  if (!m.epics.length) {
    app.className = 'empty';
    app.innerHTML = '<div><h1>No epics found</h1><p>roadmaps/ 里没有可解析的 epic 文档——确认选中的是 docs/superpowers 文件夹。</p></div>';
    return;
  }
  var rail = document.createElement('nav');
  rail.className = 'rail';
  var layout = document.createElement('div');
  layout.className = 'layout';
  layout.appendChild(rail);
  var content = document.createElement('div');
  content.className = 'content';
  layout.appendChild(content);
  app.appendChild(layout);
  m.epics.forEach(function (epic, i) {
    var open = epic.questions.filter(function (q) { return q.status === 'open'; }).length;
    var done = epic.dod.filter(function (d) { return d.done; }).length;
    var b = document.createElement('button');
    b.innerHTML = esc(epic.id + ' · ' + (epic.title || '')) +
      '<div class="meta">DoD ' + done + '/' + epic.dod.length + ' · open Q ' + open + '</div>';
    b.onclick = function () { state.epicIndex = i; render(); };
    if (i === state.epicIndex) b.className = 'active';
    rail.appendChild(b);
  });
  renderEpic(content, m.epics[state.epicIndex]);
}

function renderWarnings(warnings) {
  var bar = document.getElementById('warnbar');
  if (!warnings.length) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = warnings.map(function (w) {
    return '<div>' + esc(w.kind + ': ' + w.msg) + '</div>';
  }).join('');
}

function renderEpic(root, epic) {
  var open = epic.questions.filter(function (q) { return q.status === 'open'; }).length;
  var done = epic.dod.filter(function (d) { return d.done; }).length;
  var head = document.createElement('header');
  head.className = 'epic-head';
  head.innerHTML = '<h1>' + esc(epic.title || epic.id) + '</h1>' +
    '<p><span class="badge ' + (epic.status === 'open' ? 'coral' : '') + '">' + esc(epic.status || '?') + '</span> ' +
    '<span class="badge">DoD ' + done + '/' + epic.dod.length + '</span> ' +
    '<span class="badge">open Q ' + open + '</span> <span class="chip">' + esc(epic.file) + '</span></p>';
  root.appendChild(head);

  var band = document.createElement('div');
  band.className = 'band';
  band.innerHTML =
    details('Definition of Done', '<ul>' + epic.dod.map(function (d) {
      return '<li>' + (d.done ? '☑' : '☐') + ' ' + esc(d.text) + '</li>';
    }).join('') + '</ul>') +
    details('Open Questions', tableHtml(epic.questions.map(function (q) {
      return [q.id, q.question, q.status, q.resolution];
    }))) +
    details('Decisions (ADR)', tableHtml(epic.adr.map(function (a) {
      return [a.id, a.decision, a.rationale, a.evidence];
    }))) +
    details('Asset Disposition', tableHtml(epic.assets.map(function (a) {
      return [a.asset, a.disposition, a.note];
    }))) +
    details('Cross-cutting', '<ul>' + epic.crosscut.map(function (c) {
      return '<li>' + esc(c) + '</li>';
    }).join('') + '</ul>');
  root.appendChild(band);

  var cols = document.createElement('div');
  cols.className = 'columns';
  var colStates = STATES.slice();
  if (epic.cards.some(function (c) { return colOf(c.state) === 'other'; })) colStates.push('other');
  colStates.forEach(function (st) {
    var col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = '<h3>' + esc(st) + '</h3>';
    epic.cards.filter(function (c) { return colOf(c.state) === st; }).forEach(function (c) {
      col.appendChild(cardEl(c));
    });
    cols.appendChild(col);
  });
  root.appendChild(cols);
}

function cardEl(c) {
  var el = document.createElement('div');
  el.className = 'card';
  var sub = [];
  if (c.source === 'doc') {
    var d = c.doc;
    if (d.mergedCommit && d.mergedCommit !== 'null') sub.push('<span class="chip">' + esc(d.mergedCommit) + '</span>');
    if (d.worktree) sub.push(esc(String(d.worktree).slice(0, 40)));
    if (d.earlyStart) sub.push('<span class="badge">early-start</span>');
    if (d.clauses && d.clauses.length) sub.push('<span class="badge">HC×' + d.clauses.length + '</span>');
    if (d.refs && d.refs.length) sub.push('<span class="badge">HC ref×' + d.refs.length + '</span>');
  }
  if (c.smell) sub.push('<span class="smell">⚠ smell</span>');
  el.innerHTML = '<div class="id">' + esc(cardLabel(c)) + '</div>' +
    (sub.length ? '<div class="sub">' + sub.join(' · ') + '</div>' : '');
  el.onclick = function () { openDrawer(c); };
  return el;
}

function openDrawer(c) {
  var old = document.querySelector('.drawer');
  if (old) old.remove();
  var dr = document.createElement('aside');
  dr.className = 'drawer';
  var html = '<h2>' + esc(cardLabel(c)) + '</h2>' +
    '<p><span class="badge state-' + esc(c.state) + '">' + esc(c.state) + '</span> ' +
    '<span class="badge">' + esc(c.source) + '</span>' + (c.smell ? ' <span class="smell">⚠ data smell</span>' : '') + '</p>';
  if (c.source === 'stub') {
    html += '<p>' + esc(c.note || '') + '</p>';
  } else {
    var d = c.doc;
    html += '<p><span class="chip">' + esc(d.file) + '</span></p>';
    if (d.worktree) html += '<p>worktree: ' + esc(d.worktree) + '</p>';
    if (d.mergedCommit && d.mergedCommit !== 'null') html += '<p>merged-commit: <span class="chip">' + esc(d.mergedCommit) + '</span></p>';
    html += details('Stories & Tasks', '<ul>' + d.stories.map(function (s) {
      var plans = s.plans.map(function (p) {
        return '<br><span class="planlink" data-path="' + esc(p) + '">' + esc(p) + '</span>';
      }).join('');
      return '<li>' + esc(s.text) + plans + '</li>';
    }).join('') + '</ul>');
    html += details('Definition of Done', '<ul>' + d.dod.map(function (x) {
      return '<li>' + (x.done ? '☑' : '☐') + ' ' + esc(x.text) + '</li>';
    }).join('') + '</ul>');
    html += details('Acceptance Scenarios', '<ul>' + d.scenarios.map(function (x) {
      return '<li>' + esc(x) + '</li>';
    }).join('') + '</ul>');
    if (d.decisions.length) html += details('Decisions', tableHtml(d.decisions.map(function (x) {
      return [x.id, x.decision, x.rationale];
    })));
    if (d.clauses.length) html += details('Handover Clauses (issued)', tableHtml(d.clauses.map(function (cl) {
      return [cl.id, cl['target sprint'] || cl.target, cl.obligation, cl.status, cl.evidence];
    })));
    if (d.refs.length) html += details('Handover Clauses (references)', '<ul>' + d.refs.map(function (r) {
      return '<li>' + esc(r.id) + ' — ' + esc(r.text) + '</li>';
    }).join('') + '</ul>');
  }
  html += '<p><button class="btn-secondary" onclick="this.closest(\'.drawer\').remove()">关闭</button></p>';
  dr.innerHTML = html;
  dr.addEventListener('click', function (ev) {
    var t = ev.target.closest('.planlink');
    if (!t) return;
    ev.stopPropagation();
    var path = t.getAttribute('data-path');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(path).catch(function () { window.prompt('复制路径', path); });
    } else window.prompt('复制路径', path);
  });
  document.body.appendChild(dr);
}

function details(title, inner) {
  return '<details><summary>' + esc(title) + '</summary>' + inner + '</details>';
}
function tableHtml(rows) {
  if (!rows.length) return '<p class="sub">（空）</p>';
  return '<table>' + rows.map(function (r) {
    return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</table>';
}
```

- [ ] **Step 2: Syntax sanity (same command as Task 5 Step 2)**

Expected: `inline JS parses`.

- [ ] **Step 3: Commit**

```bash
git add web/board.html
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): render — rail, state columns, detail drawer, warnings"
```

---

### Task 7: skill pair, check-artifacts extension, README

**Files:**
- Create: `skills/board/SKILL.md`, `skills/board/SKILL.zh.md`
- Modify: `tests/check-artifacts.mjs`
- Modify: `README.md`, `README.zh-CN.md`

- [ ] **Step 1: Write `skills/board/SKILL.md`**

```markdown
---
name: board
description: Use when the user wants to view roadmaps and sprint breakdowns as a visual board in a browser
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
```

- [ ] **Step 2: Write `skills/board/SKILL.zh.md`**（frontmatter `name: board`，description 同义中文，正文逐节对应翻译）

- [ ] **Step 3: Extend `tests/check-artifacts.mjs`**

In the constants block: add `'board'` to `SKILL_DIRS`. After the existing template checks add:

```js
// board — static viewer artifacts (spec specs/2026-10-01-board-design.md)
ok(existsSync('web/board.html'), 'web/board.html exists');
ok(existsSync('web/parser.js'), 'web/parser.js exists');
const boardHtml = readFileSync('web/board.html', 'utf8');
ok(/<script src="parser\.js">/.test(boardHtml), 'board.html loads parser.js');
ok(!/(src|href)="https?:\/\//.test(boardHtml), 'board.html issues no network requests');
ok(!/@import\s+url\(/.test(boardHtml), 'board.html loads no remote css');
```

(`existsSync`/`readFileSync` already imported at the top of the file.)

- [ ] **Step 4: Run all gates**

Run: `node tests/check-artifacts.mjs && node tests/board-parser.test.mjs`
Expected: both PASS, zero failures. Then `claude plugin validate . --strict` — Expected: passes.

- [ ] **Step 5: README sections**

`README.md` — new `## Board` section (after Lifecycle): 3–5 lines, usage steps (open `web/board.html`, pick `docs/superpowers`, Chromium remember-path), zero-network/read-only guarantees, pointer to spec. `README.zh-CN.md` — mirrored Chinese section at the matching position.

- [ ] **Step 6: Commit**

```bash
git add skills/board tests/check-artifacts.mjs README.md README.zh-CN.md
git -c user.name="jw083" -c user.email="jw083@local" commit -m "feat(board): skill pair, artifact checks, readme sections"
```

---

### Task 8: manual visual pass + merge prep

**Files:** none created (verification only; epic stub flip in merge, not here)

- [ ] **Step 1: Open board against real corpus**

Run: `start "" "web/board.html"` (from worktree root), pick `D:\lc_projects\blue_dsh\dsh-enterprise\docs\superpowers`. Verify:

- E1 appears in rail with DoD 4/6, open questions count
- Six state columns; S1–S7 in merged (docs), S8/S9 in merged **with ⚠ smell**, S10/S11 in planned
- S5 card: active, worktree text, HC ref badge; S6 drawer: HC1 clause table (field/value shape parsed), plan links list (2 plans: w1, w2)
- Warning bar lists the two stub-no-doc smells; no crash on `（已拆除）` worktree values

- [ ] **Step 2: Open board against supervibe's own tree**

Pick `D:\lc_projects\blue_dsh\supervibe\.claude\worktrees\board\docs\superpowers` (the worktree copy — the S2 stub row exists only on this branch, and the main checkout's docs/superpowers has no `sprints/` dir). Verify E1 renders, S1 merged card, S2 planned stub, Q2–Q7 open count = 6.

- [ ] **Step 3: Record results in a dev note**

Append findings to `.agents/notes/2026-10-01-board-visual-pass.md` (create; date-prefixed per repo convention). Any visual defect found → fix, amend note, re-run gates.

- [ ] **Step 4: Final gate run + commit**

```bash
node tests/board-parser.test.mjs && node tests/check-artifacts.mjs && claude plugin validate . --strict
git add .agents/notes/2026-10-01-board-visual-pass.md
git -c user.name="jw083" -c user.email="jw083@local" commit -m "docs(notes): board manual visual pass"
```

- [ ] **Step 5: Hand off to superpowers:finishing-a-development-branch**

Merge via the standard finish flow. Post-merge ledger duties (not in this plan's scope, handled by supervibe:merge discipline on the host side): flip epic stub S2 `planned → merged` with evidence commit, no sprint doc needed (mini close-out, same as S1).
