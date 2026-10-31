import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { initializeLedger, readLedger } from '../scripts/ledger-store.mjs';
import { readConfig, validateConfig, validateTask, validateResult } from '../scripts/collaboration-contract.mjs';
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
  const task = { schema: 1, sprint: 'S1', taskId: 'T1', objective: 'Implement bounded change', worktree: root, allowedPaths: ['src/'], acceptance: ['Tests pass'], mode, provider: mode === 'native' ? 'harness' : 'orca' };
  const result = { schema: 1, sprint: 'S1', taskId: 'T1', worktree: root, mode, provider: task.provider, status: 'succeeded', execution: mode === 'native' ? { workerId: 'worker-1' } : { runId: 'run-1', taskId: 'orca-task-1', dispatchId: 'dispatch-1' }, evidence: ['tests: pass; evidence saved in sprint task record'], blockers: [] };
  return { root, git, config, task, result };
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
  f.config('unconfigured'); assert.equal(run('task', f.task).status, 1);
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
