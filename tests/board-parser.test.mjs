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

// ---- Task 3: sprint doc ----
const EN = '–'; // en dash — heading contains (S1–Sn), U+2013
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

console.log(failures.length ? `FAIL (${failures.length}/${checks})` : `PASS (${checks})`);
failures.forEach((f) => console.error('  - ' + f));
process.exit(failures.length ? 1 : 0);
