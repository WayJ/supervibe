import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { initializeLedger, readLedger, changeLedger, commonDir } from '../scripts/ledger-store.mjs';
import { readConfig, validateConfig, validateTask, validateResult, validateIterationConfig, confirmIterationConfig, readIterationConfig, iterationConfigFingerprint } from '../scripts/collaboration-contract.mjs';
const cli = resolve('scripts/collaboration-contract.mjs');
function fixture(t, mode = 'native') {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.invalid');
  const config = (m = mode) => writeFileSync(join(root, 'AGENTS.md'), `# Host\n## supervibe\n- collaboration_mode: ${m}\n- collaboration_provider: ${m === 'native' ? 'harness' : 'orca'}\n`);
  config(); git(root, 'add', '.'); git(root, 'commit', '-m', 'fixture');
  initializeLedger(root, { schema: 1, revision: 0, wipLimit: 1, mainRef: 'main', sprintsDir: 'sprints', events: [], operations: [], sprints: { S1: { id: 'S1', epic: 'E1', state: 'active', document: 'sprints/S1.md', branch: 'main', worktree: root } } });
  const iteration = { schema: 1, epic: 'E1', revision: 1, mode, provider: mode === 'native' ? 'harness' : 'orca', maxWorkers: 2, status: 'confirmed', confirmation: { by: 'user', source: 'fixture:user-message-1', at: '2026-10-31T00:00:00Z' }, allowMixed: false, ...(mode === 'native' ? { workerHarness: 'inherit' } : { workerHarnesses: ['codex'] }) };
  confirmIterationConfig(root, { ledgerRevision: 0, operation: 'confirm-fixture', config: iteration });
  const task = { iterationConfigRevision: 1, iterationConfigFingerprint: iterationConfigFingerprint(iteration), workerHarness: mode === 'native' ? 'inherit' : 'codex', schema: 1, sprint: 'S1', taskId: 'T1', objective: 'Implement bounded change', worktree: root, allowedPaths: ['src/'], acceptance: ['Tests pass'], mode, provider: mode === 'native' ? 'harness' : 'orca' };
  const result = { workerHarness: task.workerHarness, iterationConfigRevision: task.iterationConfigRevision, iterationConfigFingerprint: task.iterationConfigFingerprint, schema: 1, sprint: 'S1', taskId: 'T1', worktree: root, mode, provider: task.provider, status: 'succeeded', execution: mode === 'native' ? { workerId: 'worker-1' } : { runId: 'run-1', taskId: 'orca-task-1', dispatchId: 'dispatch-1' }, evidence: ['tests: pass; evidence saved in sprint task record'], blockers: [] };
  return { root, git, config, task, result, iteration };
}
test('only two explicit mode/provider pairs; no default or superpowers provider', () => {
  for (const [mode, provider] of [['native', 'harness'], ['external', 'orca']]) assert.deepEqual(validateConfig({ mode, provider }), { mode, provider });
  for (const config of [{}, { mode: 'single', provider: 'harness' }, { mode: 'native', provider: 'orca' }, { mode: 'external', provider: 'superpowers' }, { mode: 'external' }]) assert.throws(() => validateConfig(config));
});
test('configuration is scoped, unique, explicit and fails closed', t => {
  const f = fixture(t);
  assert.deepEqual(readConfig(f.root), { mode: 'native', provider: 'harness' });
  for (const source of ['## other\n- collaboration_mode: native\n- collaboration_provider: harness\n', '## supervibe\n- collaboration_mode: native\n## other\n- collaboration_provider: harness\n', '## supervibe\n- collaboration_mode: native\n- collaboration_mode: external\n- collaboration_provider: harness\n', '## supervibe\n- collaboration_mode: unconfigured\n- collaboration_provider: unconfigured\n']) {
    writeFileSync(join(f.root, 'AGENTS.md'), source); assert.throws(() => readConfig(f.root));
  }
});
test('native contract validates but does not dispatch, mutate WIP or accept sprint', t => {
  const f = fixture(t), before = readLedger(f.root);
  assert.match(validateTask(f.root, f.task).validation, /contract-only/);
  assert.equal(validateResult(f.root, { task: f.task, result: f.result }).sprintAccepted, false);
  assert.deepEqual(readLedger(f.root), before);
  for (const patch of [{ schema: 2 }, { acceptance: [] }, { objective: '' }, { mode: 'external', provider: 'orca' }, { sprint: 'missing' }, { worktree: '.' }, { allowedPaths: ['../outside'] }, { allowedPaths: ['.git/config'] }, { allowedPaths: ['./.git/config'] }]) assert.throws(() => validateTask(f.root, { ...f.task, ...patch }));
});
test('worker placement rejects independent clone and unreserved linked carrier', t => {
  const f = fixture(t), other = join(f.root, 'independent'), linked = join(f.root, 'linked');
  mkdirSync(other); f.git(other, 'init', '-b', 'main');
  assert.throws(() => validateTask(f.root, { ...f.task, worktree: other }), /same local Git common-dir/);
  f.git(f.root, 'worktree', 'add', '-b', 'other', linked);
  assert.throws(() => validateTask(f.root, { ...f.task, worktree: linked }), /sprint carrier/);
});
test('result identity, evidence and blockers are explicit; host session is optional', t => {
  const f = fixture(t), check = patch => validateResult(f.root, { task: f.task, result: { ...f.result, ...patch } });
  for (const patch of [{ sprint: 'S2' }, { taskId: 'T2' }, { mode: 'external' }, { provider: 'orca' }, { status: 'ready' }, { evidence: [] }, { blockers: ['unfinished'] }, { execution: {} }, { worktree: '.' }, { status: 'failed' }]) assert.throws(() => check(patch));
  for (const status of ['failed', 'blocked']) assert.equal(check({ status, evidence: [], blockers: ['Need user input'] }).sprintAccepted, false);
  assert.equal(check({ execution: { workerId: 'worker-1', sessionId: 'actual-host-session' } }).sprintAccepted, false);
});
test('Orca uses Run/Task/Dispatch receipts, not terminal or session as mandatory identity', t => {
  const f = fixture(t, 'external');
  assert.equal(validateResult(f.root, { task: f.task, result: f.result }).execution.dispatchId, 'dispatch-1');
  for (const key of ['runId', 'taskId', 'dispatchId']) {
    const execution = { ...f.result.execution }; delete execution[key];
    assert.throws(() => validateResult(f.root, { task: f.task, result: { ...f.result, execution } }), new RegExp(`execution.${key}`));
  }
});
test('CLI handles JSON contracts and bad config without launching providers', t => {
  const f = fixture(t);
  const run = (command, input) => spawnSync(process.execPath, [cli, command], { cwd: f.root, input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(run('config').status, 0);
  assert.equal(run('task', f.task).status, 0);
  assert.equal(JSON.parse(run('result', { task: f.task, result: f.result }).stdout).sprintAccepted, false);
  assert.equal(run('launch').status, 1);
  f.config('unconfigured'); assert.equal(run('config').status, 1);
  assert.equal(run('task', f.task).status, 0); // confirmed iteration, not changed host proposal, owns execution
});

test('canonical carrier must remain on its registered branch, including result collection', t => {
  const f = fixture(t);
  f.git(f.root, 'checkout', '-b', 'wrong-branch');
  assert.throws(() => validateTask(f.root, f.task), /branch differs/);
  assert.throws(() => validateResult(f.root, { task: f.task, result: f.result }), /branch differs/);
  f.git(f.root, 'checkout', '--detach');
  assert.throws(() => validateTask(f.root, f.task), /detached HEAD/);
  assert.throws(() => validateResult(f.root, { task: f.task, result: f.result }), /detached HEAD/);
  f.git(f.root, 'checkout', 'main');
  assert.equal(validateResult(f.root, { task: f.task, result: f.result }).sprintAccepted, false);
});


test('iteration config rejects invalid caps, fake/missing confirmation and native overrides', t => {
  const f = fixture(t);
  for (const maxWorkers of [undefined, null, 0, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateIterationConfig({ ...f.iteration, maxWorkers }));
  for (const patch of [{ status: 'draft' }, { confirmation: null }, { confirmation: { by: 'assistant', source: 'guess', at: '2026-10-31' } }, { confirmation: { by: 'user', source: '', at: '2026-10-31' } }, { workerHarness: 'codex' }, { allowMixed: true }, { workerHarnesses: ['claude'] }]) assert.throws(() => validateIterationConfig({ ...f.iteration, ...patch }));
  assert.throws(() => validateTask(f.root, { ...f.task, workerHarness: 'claude' }), /workerHarness/);
});
test('Orca selection is allowlisted and multi-harness needs explicit consent', t => {
  const f = fixture(t, 'external');
  assert.throws(() => validateTask(f.root, { ...f.task, workerHarness: 'claude' }), /workerHarness/);
  assert.throws(() => validateIterationConfig({ ...f.iteration, workerHarnesses: ['codex', 'claude'] }), /allowMixed/);
  const mixed = { ...f.iteration, revision: 2, workerHarnesses: ['codex', 'claude'], allowMixed: true, confirmation: { ...f.iteration.confirmation, source: 'fixture:user-message-2' } };
  confirmIterationConfig(f.root, { ledgerRevision: 1, operation: 'mixed', config: mixed });
  assert.equal(validateTask(f.root, { ...f.task, workerHarness: 'claude', iterationConfigRevision: 2, iterationConfigFingerprint: iterationConfigFingerprint(mixed) }).workerHarness, 'claude');
  assert.throws(() => validateTask(f.root, f.task), /fingerprint/);
});
test('resume reuses saved config across worktrees without mutation; changes require CAS and new provenance', t => {
  const f = fixture(t), before = readLedger(f.root), linked = join(f.root, 'linked');
  f.git(f.root, 'worktree', 'add', '-b', 'resume', linked);
  assert.deepEqual(readIterationConfig(linked, 'E1'), f.iteration);
  assert.deepEqual(readLedger(f.root), before);
  assert.throws(() => readIterationConfig(f.root, 'E2'), /Missing iteration config/);
  const request = { ledgerRevision: 1, operation: 'changed', config: { ...f.iteration, revision: 2, maxWorkers: 4 } };
  assert.throws(() => confirmIterationConfig(f.root, request), /fresh user confirmation/);
  request.config.confirmation = { ...f.iteration.confirmation, source: 'fixture:user-message-2' };
  assert.throws(() => confirmIterationConfig(f.root, { ...request, ledgerRevision: 0 }), /Stale revision/);
  confirmIterationConfig(f.root, request);
  assert.equal(confirmIterationConfig(f.root, request).replayed, true);
  assert.equal(readIterationConfig(linked, 'E1').maxWorkers, 4);
  assert.throws(() => validateTask(f.root, f.task), /fingerprint/);
  assert.notEqual(iterationConfigFingerprint(f.iteration), iterationConfigFingerprint({ ...f.iteration, maxWorkers: 3 }));
});


test('missing policy blocks tasks and CLI saves explicit confirmed envelope, not defaults', t => {
  const f = fixture(t);
  changeLedger(f.root, 1, 'fixture-remove-policy', 'fixture-only', {}, state => { delete state.iterationConfigs; });
  assert.throws(() => validateTask(f.root, f.task), /Missing iteration config/);
  const run = (command, input) => spawnSync(process.execPath, [cli, command], { cwd: f.root, input: JSON.stringify(input), encoding: 'utf8' });
  const envelope = { ledgerRevision: 2, operation: 'restore-policy', config: f.iteration };
  assert.equal(run('confirm-config', { ...envelope, config: { ...f.iteration, status: 'draft' } }).status, 1);
  assert.equal(run('confirm-config', envelope).status, 0);
  const saved = JSON.parse(run('iteration-config', { epic: 'E1' }).stdout);
  assert.deepEqual(saved.config, f.iteration);
  assert.equal(saved.fingerprint, f.task.iterationConfigFingerprint);
  assert.equal(run('task', f.task).status, 0);
});


test('receipts bind harness and config identity; old receipt cannot be replayed with a new task', t => {
  const f = fixture(t, 'external');
  for (const patch of [{ workerHarness: undefined }, { workerHarness: 'claude' }, { iterationConfigRevision: undefined }, { iterationConfigRevision: 2 }, { iterationConfigFingerprint: undefined }, { iterationConfigFingerprint: 'other' }]) {
    assert.throws(() => validateResult(f.root, { task: f.task, result: { ...f.result, ...patch } }), /does not match task/);
  }
  const config = { ...f.iteration, revision: 2, maxWorkers: 4, confirmation: { ...f.iteration.confirmation, source: 'fixture:user-message-new' } };
  confirmIterationConfig(f.root, { ledgerRevision: 1, operation: 'new-policy', config });
  const task = { ...f.task, iterationConfigRevision: 2, iterationConfigFingerprint: iterationConfigFingerprint(config) };
  assert.throws(() => validateResult(f.root, { task, result: f.result }), /iterationConfigRevision/);
  assert.equal(validateResult(f.root, { task, result: { ...f.result, iterationConfigRevision: task.iterationConfigRevision, iterationConfigFingerprint: task.iterationConfigFingerprint } }).sprintAccepted, false);
});
test('reordered provenance or timestamp-only edits are not fresh user confirmation', t => {
  const f = fixture(t);
  for (const confirmation of [
    { source: f.iteration.confirmation.source, at: f.iteration.confirmation.at, by: 'user' },
    { ...f.iteration.confirmation, at: '2026-11-01T00:00:00Z' },
    { ...f.iteration.confirmation, source: ` ${f.iteration.confirmation.source} ` }
  ]) assert.throws(() => confirmIterationConfig(f.root, { ledgerRevision: 1, operation: 'changed', config: { ...f.iteration, revision: 2, maxWorkers: 4, confirmation } }), /fresh user confirmation/);
  assert.equal(readLedger(f.root).revision, 1);
});


test('corrupt optional iterationConfigs fails closed before save, never silently drops policy', t => {
  const f = fixture(t), before = readLedger(f.root), file = join(commonDir(f.root), 'supervibe', 'state.json');
  for (const iterationConfigs of [[], null, 'bad', 3]) {
    writeFileSync(file, JSON.stringify({ ...before, iterationConfigs }));
    assert.throws(() => readLedger(f.root), /Corrupt shared iterationConfigs/);
    assert.throws(() => confirmIterationConfig(f.root, { ledgerRevision: 1, operation: 'new', config: f.iteration }), /Corrupt shared iterationConfigs/);
  }
  const legacy = { ...before }; delete legacy.iterationConfigs;
  writeFileSync(file, JSON.stringify(legacy));
  assert.equal(readLedger(f.root).iterationConfigs, undefined);
});
