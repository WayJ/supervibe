import { directoryLink } from './filesystem-fixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeLedger, readLedger, commonDir, changeLedger } from '../scripts/ledger-store.mjs';
import { bootstrap, reserve, status } from '../scripts/clause-ids.mjs';
const cli = resolve('scripts/clause-ids.mjs');
function fixture(t) {
  const parent = mkdtempSync(join(tmpdir(), 'clause-ids-')), root = join(parent, 'main'), linked = join(parent, 'linked');
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  mkdirSync(root);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' });
  git('init', '-b', 'main'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  mkdirSync(join(root, 'sprints')); writeFileSync(join(root, 'sprints/.gitkeep'), '');
  git('add', '.'); git('commit', '-m', 'baseline'); git('worktree', 'add', '-b', 'linked', linked);
  initializeLedger(root, { schema: 1, revision: 0, wipLimit: 3, mainRef: 'main', sprintsDir: 'sprints', sprints: { S1: { id: 'S1', state: 'reserved', document: 'sprints/S1.md', branch: 'linked', worktree: linked, epic: 'E1' } }, events: [], operations: [] });
  const seed = fn => { const state = readLedger(root); fn(state); writeFileSync(join(commonDir(root), 'supervibe/state.json'), JSON.stringify(state)); };
  const doc = (tree, id, body) => writeFileSync(join(tree, `sprints/${id}.md`), `---\nsprint: ${id}\nepic: E1\nstate: active\nworktree: linked\n---\n${body}\n`);
  return { root, linked, seed, doc };
}
test('explicit legacy bootstrap scans all worktree references and keeps permanent replay receipts', t => {
  const f = fixture(t); f.doc(f.root, 'S2', 'HC4'); f.doc(f.linked, 'S1', 'frontmatter/reference HC38 and discharged HC12');
  assert.throws(() => reserve(f.root, 0, 'a', 'S1'), /not bootstrapped/);
  assert.throws(() => bootstrap(f.root, 0, 'boot'), /quiescent/);
  assert.equal(bootstrap(f.root, 0, 'boot', true).highWater, 38);
  assert.equal(reserve(f.linked, 1, 'a', 'S1').id, 'HC39');
  assert.equal(reserve(f.root, 1, 'a', 'S1').replayed, true);
  assert.throws(() => reserve(f.root, 2, 'a', 'S2'), /different request/);
  for (let i = 0; i < 101; i++) changeLedger(f.root, readLedger(f.root).revision, `noise${i}`, 'test', {}, () => {});
  assert.equal(reserve(f.root, 1, 'a', 'S1').id, 'HC39');
  assert.equal(bootstrap(f.root, 0, 'boot', true).replayed, true);
  assert.throws(() => bootstrap(f.root, 0, 'newboot', true), /already bootstrapped/);
  assert.equal(reserve(f.root, readLedger(f.root).revision, 'b', 'S1').id, 'HC40');
});
test('actual concurrent linked-worktree processes: stale/locked loser rereads and gets unique ID', async t => {
  const f = fixture(t); bootstrap(f.root, 0, 'boot', true);
  const run = promisify(execFile);
  const attempts = await Promise.allSettled([f.root, f.linked].map((cwd, i) => run(process.execPath, [cli, 'reserve', '--issuer', 'S1', '--revision', '1', '--operation', `op${i}`], { cwd })));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  const loser = attempts.findIndex(r => r.status === 'rejected');
  assert.match(attempts[loser].reason.stderr, /Stale revision|locked/);
  const winner = JSON.parse(attempts[1 - loser].value.stdout);
  assert.equal(winner.id, 'HC1');
  const second = JSON.parse((await run(process.execPath, [cli, 'reserve', '--issuer', 'S1', '--revision', String(readLedger(f.root).revision), '--operation', `op${loser}`], { cwd: f.linked })).stdout);
  assert.equal(second.id, 'HC2');
  assert.throws(() => reserve(f.root, 1, 'stale', 'S1'), /Stale revision/);
});
test('issuer lifecycle, abandoned reservations and corrupt namespace fail closed', t => {
  const f = fixture(t); bootstrap(f.root, 0, 'boot', true);
  assert.throws(() => reserve(f.root, 1, 'missing', 'S99'), /Issuer/);
  reserve(f.root, 1, 'abandoned', 'S1');
  f.seed(s => { s.sprints.S1.state = 'cancelled'; });
  assert.throws(() => reserve(f.root, 2, 'closed', 'S1'), /Issuer/);
  assert.equal(reserve(f.root, 0, 'abandoned', 'S1').id, 'HC1');
  f.seed(s => { s.sprints.S1.state = 'active'; });
  assert.equal(reserve(f.root, 2, 'next', 'S1').id, 'HC2');
  f.seed(s => { s.clauseIds.highWater = 0; });
  assert.throws(() => status(f.root), /Corrupt clauseIds/);
  assert.throws(() => reserve(f.root, 3, 'another', 'S1'), /Corrupt clauseIds/);
});
test('bootstrap refuses missing worktrees, missing sprint directories and unsafe legacy IDs', t => {
  const f = fixture(t); rmSync(join(f.linked, 'sprints'), { recursive: true });
  assert.throws(() => bootstrap(f.root, 0, 'boot', true), /Missing sprint directory/);
  mkdirSync(join(f.linked, 'sprints')); f.doc(f.linked, 'S1', 'HC9007199254740992');
  assert.throws(() => bootstrap(f.root, 0, 'boot', true), /Unsafe HC/);
  rmSync(f.linked, { recursive: true });
  assert.throws(() => bootstrap(f.root, 0, 'boot', true), /Stale registered|Unavailable registered/);
  assert.equal(readLedger(f.root).clauseIds, undefined);
});

test('bootstrap rejects symlinked/unreadable nonregular sprint inputs without partial state', t => {
  const f = fixture(t);
  directoryLink(t, join(f.root, 'sprints'), join(f.linked, 'sprints', 'nested'));
  assert.throws(() => bootstrap(f.root, 0, 'boot', true), /Symlink/);
  rmSync(join(f.linked, 'sprints', 'nested'));
  mkdirSync(join(f.linked, 'sprints', 'bad.md'));
  assert.throws(() => bootstrap(f.root, 0, 'boot', true), /regular file/);
  assert.equal(readLedger(f.root).clauseIds, undefined);
});
