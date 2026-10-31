import { planBlock, resultsBlock, mainAcceptancePolicy } from './acceptance-fixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initialize, mutate, checkAcceptance, doctor } from '../scripts/shared-ledger.mjs';
import { readLedger, commonDir } from '../scripts/ledger-store.mjs';
import { snapshot, checkWip } from '../scripts/validate-workflow.mjs';
const cli = resolve('scripts/shared-ledger.mjs');
function setup(t, limit = 1) {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-shared-'));
  const paths = [root]; t.after(() => paths.forEach(p => rmSync(p, { recursive: true, force: true })));
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git(root, 'init', '-b', 'main'); git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.invalid');
  for (const dir of ['sprints', 'acceptances']) { mkdirSync(join(root, dir)); writeFileSync(join(root, dir, '.gitkeep'), ''); }
  writeFileSync(join(root, 'code.js'), 'baseline'); git(root, 'add', '.'); git(root, 'commit', '-m', 'baseline');
  initialize(root, 'sprints', limit);
  // Fixture-only policy seed; keep lifecycle revision assertions independent.
  writeFileSync(join(commonDir(root), 'supervibe', 'state.json'), JSON.stringify({ ...readLedger(root), iterationConfigs: { E1: mainAcceptancePolicy } }));
  const options = (id, revision, operation, extra = {}) => ({ '--id': id, '--revision': String(revision), '--operation': operation, ...extra });
  const reserve = (id = 'S1', revision = readLedger(root).revision, operation = `reserve-${id}`) => {
    const worktree = `${root}-${id}`; paths.push(worktree);
    return mutate(root, 'reserve', options(id, revision, operation, { '--epic': 'E1', '--document': `sprints/${id}.md`, '--branch': `sprint/${id}`, '--worktree': worktree }));
  };
  const doc = (worktree, id, state, record = 'null', landing = 'null') => writeFileSync(join(worktree, `sprints/${id}.md`), `---\nsprint: ${id}\nepic: E1\nstate: ${state}\nworktree: sprint/${id}\nacceptance-record: ${record}\naccepted-at: 2026-10-31\nmerged-commit: ${landing}\n---\n## DoD\nWorks\n` + planBlock());
  const activate = (id = 'S1') => {
    const worktree = `${root}-${id}`; git(root, 'worktree', 'add', '-b', `sprint/${id}`, worktree); doc(worktree, id, 'active');
    mutate(root, 'activate', options(id, readLedger(root).revision, `activate-${id}`)); return worktree;
  };
  const accept = (worktree, id = 'S1', suffix = '') => {
    mutate(root, 'review-begin', options(id, readLedger(root).revision, `begin-${id}${suffix}`));
    doc(worktree, id, 'active');
    const record = `acceptances/${id}${suffix}.md`, evidence = snapshot(worktree, `sprints/${id}.md`, record);
    writeFileSync(join(worktree, record), `## Verdict\npass\n\n\`\`\`supervibe-evidence\n${JSON.stringify(evidence)}\n\`\`\`\n` + resultsBlock(evidence.fingerprint));
    doc(worktree, id, 'acceptance', record); git(worktree, 'add', '.'); git(worktree, 'commit', '-m', 'accepted candidate');
    return mutate(root, 'review-pass', options(id, readLedger(root).revision, `pass-${id}${suffix}`));
  };
  return { root, git, options, reserve, activate, accept, doc, paths };
}
test('linked worktrees share state; reservation survives interruption and stale revisions cannot overwrite', t => {
  const f = setup(t); f.reserve();
  assert.equal(readLedger(f.root).sprints.S1.state, 'reserved');
  assert.throws(() => f.reserve('S2'), /WIP limit/);
  assert.throws(() => f.reserve('S2', 0), /Stale revision/);
  assert.equal(f.reserve('S1', 0).replayed, true);
  const other = f.activate();
  assert.deepEqual(readLedger(other), readLedger(f.root));
  assert.throws(() => checkWip(other, 'sprints', 1), /Shared WIP/);
  assert.throws(() => checkWip(other, 'sprints', 3), /configuration differs/);
  assert.equal(doctor(f.root).ok, true);
});
test('two concurrent processes compete for one atomic WIP reservation', async t => {
  const f = setup(t), caller = `${f.root}-caller`; f.paths.push(caller);
  f.git(f.root, 'worktree', 'add', '-b', 'caller', caller);
  const run = promisify(execFile);
  const attempts = ['S1', 'S2'].map((id, index) => run(process.execPath, [cli, 'reserve', '--id', id, '--revision', '0', '--operation', id, '--epic', 'E1', '--document', `sprints/${id}.md`, '--branch', `sprint/${id}`, '--worktree', `${f.root}-${id}`], { cwd: index ? caller : f.root }));
  const results = await Promise.allSettled(attempts);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(Object.values(readLedger(f.root).sprints).length, 1);
  assert.equal(readLedger(caller).revision, 1);
});
test('full shared lifecycle, interrupted review, changed candidate and landed-before-projection recovery', t => {
  const f = setup(t); f.reserve(); const target = f.activate(); f.accept(target);
  assert.equal(checkAcceptance(f.root, 'S1').commit, f.git(target, 'rev-parse', 'HEAD'));
  f.git(f.root, 'checkout', '-b', 'old-view');
  assert.equal(readLedger(f.root).sprints.S1.state, 'acceptance'); f.git(f.root, 'checkout', 'main');
  mutate(f.root, 'review-begin', f.options('S1', readLedger(f.root).revision, 'interrupt-review'));
  assert.throws(() => checkAcceptance(f.root, 'S1'), /Shared acceptance/);
  f.doc(target, 'S1', 'active'); f.accept(target, 'S1', '-2');
  writeFileSync(join(target, 'code.js'), 'unreviewed');
  assert.throws(() => checkAcceptance(f.root, 'S1'));
  f.git(target, 'restore', 'code.js');
  const candidate = checkAcceptance(f.root, 'S1').commit;
  f.git(f.root, 'merge', '--no-ff', '--no-edit', 'sprint/S1'); const landing = f.git(f.root, 'rev-parse', 'HEAD');
  assert.notEqual(landing, candidate);
  const opts = f.options('S1', readLedger(f.root).revision, 'land-S1', { '--landing': landing, '--main': 'main' });
  mutate(f.root, 'land', opts);
  assert.equal(readLedger(target).sprints.S1.state, 'merged');
  assert.throws(() => doctor(f.root), /Projection mismatch/);
  assert.equal(mutate(f.root, 'land', opts).replayed, true);
  f.doc(f.root, 'S1', 'merged', 'acceptances/S1-2.md', landing); f.git(f.root, 'add', '.'); f.git(f.root, 'commit', '-m', 'merged projection');
  mutate(f.root, 'close', f.options('S1', readLedger(f.root).revision, 'close-S1'));
  f.doc(f.root, 'S1', 'closed', 'acceptances/S1-2.md', landing); f.git(f.root, 'add', '.'); f.git(f.root, 'commit', '-m', 'closed projection');
  assert.equal(doctor(f.root).ok, true);
  assert.equal(doctor(target).ok, true); // stale sprint copy must not override committed main projection
  assert.equal(checkWip(f.root, 'sprints', 1).count, 0);
});
test('missing, corrupt and locked ledgers fail closed; missing carrier blocks new reservation', t => {
  const f = setup(t, 2), base = join(commonDir(f.root), 'supervibe'), statePath = join(base, 'state.json');
  const original = readFileSync(statePath, 'utf8'); rmSync(statePath);
  assert.throws(() => checkWip(f.root, 'sprints', 2), /missing/);
  writeFileSync(statePath, '{bad'); assert.throws(() => f.reserve());
  writeFileSync(statePath, original); mkdirSync(join(base, 'write.lock'));
  assert.throws(() => f.reserve(), /locked/); rmSync(join(base, 'write.lock'), { recursive: true });
  f.reserve(); const target = f.activate(); rmSync(target, { recursive: true, force: true });
  assert.throws(() => f.reserve('S2'), /Missing carrier/);
});
test('import is explicit and conflicting states cannot silently choose an authority', t => {
  const f = setup(t), statePath = join(commonDir(f.root), 'supervibe/state.json');
  rmSync(statePath); f.doc(f.root, 'S1', 'active'); f.git(f.root, 'add', '.'); f.git(f.root, 'commit', '-m', 'legacy ledger');
  assert.throws(() => initialize(f.root, 'sprints', 1), /explicit import/);
  const other = `${f.root}-legacy`; f.paths.push(other); f.git(f.root, 'worktree', 'add', '-b', 'sprint/S1', other);
  f.doc(other, 'S1', 'acceptance');
  assert.throws(() => initialize(f.root, 'sprints', 1, true), /Conflicting import states/);
  f.doc(other, 'S1', 'active'); const imported = initialize(f.root, 'sprints', 1, true);
  assert.equal(imported.sprints.S1.worktree, other);
  assert.throws(() => initialize(f.root, 'sprints', 1, true), /already exists/);
});

test('landing cannot spoof the configured main branch', t => {
  const f = setup(t); f.reserve(); const target = f.activate(); f.accept(target);
  const candidate = f.git(target, 'rev-parse', 'HEAD');
  const args = f.options('S1', readLedger(f.root).revision, 'spoof-main', { '--landing': candidate, '--main': 'sprint/S1' });
  assert.throws(() => mutate(f.root, 'land', args), /approved shared mainRef/);
  assert.throws(() => mutate(f.root, 'land', { ...args, '--main': 'main' }));
  assert.equal(readLedger(f.root).sprints.S1.state, 'acceptance');
});
test('explicit reservation cancellation frees capacity only before any carrier artifacts exist', t => {
  const f = setup(t); f.reserve();
  mutate(f.root, 'cancel-reservation', f.options('S1', 1, 'cancel-S1'));
  assert.equal(readLedger(f.root).sprints.S1.state, 'cancelled');
  assert.equal(checkWip(f.root, 'sprints', 1).count, 0);
  assert.throws(() => f.reserve('S1', readLedger(f.root).revision, 'new-reserve-S1'), /already exists/);
  f.reserve('S2');
  f.git(f.root, 'branch', 'sprint/S2');
  assert.throws(() => mutate(f.root, 'cancel-reservation', f.options('S2', readLedger(f.root).revision, 'cancel-S2')), /branch exists/);
  f.git(f.root, 'branch', '-D', 'sprint/S2'); mkdirSync(`${f.root}-S2`);
  assert.throws(() => mutate(f.root, 'cancel-reservation', f.options('S2', readLedger(f.root).revision, 'cancel-S2')), /path exists/);
  assert.equal(readLedger(f.root).sprints.S2.state, 'reserved');
});
test('activation requires valid upfront scenario plan before granting execution state', t => {
  const f = setup(t); f.reserve();
  const worktree = `${f.root}-S1`; f.git(f.root, 'worktree', 'add', '-b', 'sprint/S1', worktree); f.doc(worktree, 'S1', 'active');
  const document = join(worktree, 'sprints/S1.md'), original = readFileSync(document, 'utf8');
  const before = readLedger(f.root);
  for (const invalid of [original.replace(/```supervibe-acceptance-plan[\s\S]*?```/, ''), original.replace('"scenarios":[{', '"scenarios":[BROKEN{'), original.replace('"required":true', '"required":false')]) {
    writeFileSync(document, invalid);
    assert.throws(() => mutate(f.root, 'activate', f.options('S1', before.revision, 'activate-missing-plan')));
    assert.deepEqual(readLedger(f.root), before);
  }
  writeFileSync(document, original);
  mutate(f.root, 'activate', f.options('S1', before.revision, 'activate-valid-plan'));
  assert.equal(readLedger(f.root).sprints.S1.state, 'active');
});

test('land blocks pending/running/unknown children, not settled cleanup-pending workspaces', t => {
  const f = setup(t); f.reserve(); const target = f.activate(); f.accept(target);
  f.git(f.root, 'merge', '--no-ff', '--no-edit', 'sprint/S1');
  const landing = f.git(f.root, 'rev-parse', 'HEAD');
  const statePath = join(commonDir(f.root), 'supervibe', 'state.json');
  const entry = { id: 'child', token: 'fixture-token', epic: 'E1', sprint: 'S1', branch: 'sprint/S1', ownership: 'borrowed', commonDir: commonDir(f.root), task: { workerExecutionId: 'child', worktree: target }, cleanup: 'cleanup_pending' };
  for (const status of ['pending', 'running', 'unknown']) {
    const state = readLedger(f.root);
    state.workerExecutions = { schema: 1, entries: { child: { ...entry, state: status } } };
    writeFileSync(statePath, JSON.stringify(state));
    assert.throws(() => mutate(f.root, 'land', f.options('S1', state.revision, `land-${status}`, { '--landing': landing, '--main': 'main' })), /active child/);
    assert.equal(readLedger(f.root).sprints.S1.state, 'acceptance');
  }
  const state = readLedger(f.root);
  state.workerExecutions.entries.child = { ...entry, state: 'settled', outcome: { status: 'pass' }, quiescence: { stopped: true } };
  writeFileSync(statePath, JSON.stringify(state));
  mutate(f.root, 'land', f.options('S1', state.revision, 'land-settled', { '--landing': landing, '--main': 'main' }));
  assert.equal(readLedger(f.root).sprints.S1.state, 'merged');
  assert.equal(readLedger(f.root).workerExecutions.entries.child.cleanup, 'cleanup_pending');
});
