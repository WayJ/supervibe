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

console.log(failures.length ? `FAIL (${failures.length}/${checks})` : `PASS (${checks})`);
failures.forEach((f) => console.error('  - ' + f));
process.exit(failures.length ? 1 : 0);
