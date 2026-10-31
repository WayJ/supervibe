import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory } from '../scripts/artifact-inventory.mjs';
import { initializeLedger, readLedger, commonDir } from '../scripts/ledger-store.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-inventory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  mkdirSync(join(root, 'roadmaps')); mkdirSync(join(root, 'sprints'));
  const put = (name, content) => writeFileSync(join(root, name), content);
  const epic = (rows = '| S1 | ready | first |', id = 'E1') => `---\nepic: ${id}\nstatus: open\n---\n## Sprint Breakdown\n| sprint | state | note |\n|---|---|---|\n${rows}\n`;
  const sprint = (id = 'S1', extra = '') => `---\nsprint: ${id}\nepic: E1\nstate: active\nworktree: main\n---\n${extra}`;
  put('roadmaps/E1.md', epic()); git('add', '.'); git('commit', '-m', 'base');
  initializeLedger(root, { schema: 1, revision: 0, wipLimit: 1, mainRef: 'main', sprintsDir: 'sprints', sprints: {}, events: [], operations: [] });
  const config = { roadmaps_dir: 'roadmaps', sprints_dir: 'sprints', wip_limit: 1 };
  const run = options => inventory(root, { config, ...options });
  const seed = entries => put('.git/supervibe/state.json', JSON.stringify({ ...readLedger(root), sprints: entries }));
  const entry = (id = 'S1') => ({ id, epic: 'E1', state: 'active', document: `sprints/${id}.md`, branch: 'main', worktree: root });
  return { root, put, epic, sprint, run, seed, entry, git };
}
test('unique ready stub resolves read-only without fabricating a sprint or ledger reservation', t => {
  const f = fixture(t), before = readFileSync(join(commonDir(f.root), 'supervibe/state.json'), 'utf8');
  const result = f.run({ epic: 'E1', sprint: 'S1' });
  assert.equal(result.ok, true); assert.equal(result.selection.sprint.state, 'ready');
  assert.equal(result.selection.sprint.shared, null);
  assert.equal(readFileSync(join(commonDir(f.root), 'supervibe/state.json'), 'utf8'), before);
  assert.equal(f.run({ epic: 'missing' }).ok, false);
});
test('duplicate epic ids and stub ids block deterministic resolution', t => {
  const f = fixture(t); f.put('roadmaps/other.md', f.epic());
  const r = f.run({ epic: 'E1', sprint: 'S1' });
  for (const code of ['duplicate-epic', 'duplicate-stub', 'epic-resolution', 'sprint-resolution']) assert.ok(r.issues.some(i => i.code === code));
  assert.deepEqual(r.selection, {});
});
test('started without document, ready with document and missing authority are reported', t => {
  const f = fixture(t); f.put('roadmaps/E1.md', f.epic('| S1 | started | first |'));
  assert.ok(f.run().issues.some(i => i.code === 'started-without-document'));
  f.put('roadmaps/E1.md', f.epic()); f.put('sprints/S1.md', f.sprint());
  const r = f.run();
  assert.ok(r.issues.some(i => i.code === 'unstarted-with-document'));
  assert.ok(r.issues.some(i => i.code === 'document-without-ledger'));
});
test('valid active projection passes; wrong carrier and state drift are rejected', t => {
  const f = fixture(t); f.put('roadmaps/E1.md', f.epic('| S1 | started | first |')); f.put('sprints/S1.md', f.sprint()); f.seed({ S1: f.entry() });
  assert.equal(f.run().ok, true);
  f.seed({ S1: { ...f.entry(), worktree: join(f.root, 'absent') } });
  assert.ok(f.run().issues.some(i => i.code === 'ledger-projection' && /Missing carrier/.test(i.message)));
  f.seed({ S1: f.entry() }); f.put('sprints/S1.md', f.sprint().replace('state: active', 'state: closed'));
  assert.ok(f.run().issues.some(i => i.code === 'ledger-projection' && /Projection mismatch/.test(i.message)));
});
test('missing shared ledger is a blocker, not a branch-scan fallback', t => {
  const f = fixture(t); rmSync(join(commonDir(f.root), 'supervibe/state.json'));
  const r = f.run(); assert.equal(r.ok, false); assert.equal(r.ledgerRevision, null);
  assert.ok(r.issues.some(i => i.code === 'ledger-unavailable'));
});
test('reject symlink artifacts and duplicate frontmatter; report duplicate clause bodies', t => {
  const f = fixture(t); symlinkSync('E1.md', join(f.root, 'roadmaps/link.md'));
  f.put('roadmaps/bad.md', f.epic().replace('epic: E1', 'epic: E2\nepic: E3'));
  const clause = '## Handover Clauses\n| id | target | trigger | obligation | status | evidence |\n|---|---|---|---|---|---|\n| HC1 | S3 | path | review | open | none |';
  f.put('sprints/S1.md', f.sprint('S1', clause)); f.put('sprints/S2.md', f.sprint('S2', clause));
  const r = f.run(); assert.equal(r.issues.filter(i => i.code === 'invalid-artifact').length, 2);
  assert.ok(r.issues.some(i => i.code === 'duplicate-clause'));
});
test('started stub can resolve a valid shared carrier without a local sprint document', t => {
  const f = fixture(t), carrier = `${f.root}-worker`;
  t.after(() => rmSync(carrier, { recursive: true, force: true }));
  f.git('worktree', 'add', '-b', 'sprint/S1', carrier);
  mkdirSync(join(carrier, 'sprints'));
  writeFileSync(join(carrier, 'sprints/S1.md'), f.sprint().replace('worktree: main', 'worktree: sprint/S1'));
  f.put('roadmaps/E1.md', f.epic('| S1 | started | first |'));
  f.seed({ S1: { ...f.entry(), worktree: carrier, branch: 'sprint/S1' } });
  const r = f.run({ epic: 'E1', sprint: 'S1' });
  assert.equal(r.ok, true, JSON.stringify(r.issues)); assert.equal(r.selection.sprint.shared.worktree, carrier);
  assert.deepEqual(r.selection.sprint.sprintDocuments, []);
});
test('duplicate local sprint documents cannot produce an unambiguous selection', t => {
  const f = fixture(t); f.put('sprints/S1.md', f.sprint()); f.put('sprints/duplicate.md', f.sprint());
  const r = f.run({ sprint: 'S1' });
  assert.ok(r.issues.some(i => i.code === 'duplicate-sprint')); assert.equal(r.selection.sprint, undefined);
});
