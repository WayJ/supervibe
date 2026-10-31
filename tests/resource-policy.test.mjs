import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { initializeLedger, readLedger, commonDir } from '../scripts/ledger-store.mjs';
import { iterationConfigFingerprint } from '../scripts/collaboration-contract.mjs';
import { probeLocal, recommendCapacity, mutateResources, checkResourceClaim, verifyAcceptanceResources } from '../scripts/resource-policy.mjs';
const cli = resolve('scripts/resource-policy.mjs');
const confirmation = { by: 'user', source: 'fixture:message-1', at: '2026-10-31T00:00:00Z' };
const owner = { role: 'worker', mode: 'native', workerId: 'worker-1', workerHarness: 'inherit' };
const vector = n => ({ cpu: n, memoryBytes: n * 1024, diskBytes: n * 1024 });
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'sv-resource-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(join(root, 'fixture'), 'fixture'); git('add', '.'); git('commit', '-m', 'fixture');
  const config = { schema: 1, epic: 'E1', revision: 1, mode: 'native', provider: 'harness', maxWorkers: 2, independentAcceptance: false, status: 'confirmed', confirmation, allowMixed: false, workerHarness: 'inherit' };
  initializeLedger(root, { schema: 1, revision: 0, wipLimit: 1, mainRef: 'main', sprintsDir: 'sprints', events: [], operations: [], sprints: { S1: { id: 'S1', epic: 'E1', state: 'active', document: 'sprints/S1.md', branch: 'main', worktree: root } }, iterationConfigs: { E1: config } });
  let n = 0;
  const mutate = (cmd, payload, operation = `op-${++n}`) => mutateResources(root, cmd, { ledgerRevision: readLedger(root).revision, operation, payload });
  const host = (extra = {}) => ({ id: 'local', kind: 'local', machineId: 'machine-1', budget: vector(5), reserve: vector(1), confirmation, status: 'ready', preflightRef: 'fixture-preflight-1', ...extra });
  mutate('host', host());
  const group = (id = 'g1', targets = ['host/machine-1/port/3000'], extra = {}) => ({ id, host: 'local', targets, footprint: vector(2), confirmation, ...extra });
  mutate('group', group());
  const acquire = (id = 'c1', group = 'g1', extra = {}) => ({ id, group, scope: 'sprint', epic: 'E1', sprint: 'S1', owner, configRevision: 1, configFingerprint: iterationConfigFingerprint(config), ...extra });
  const proof = (id = 'c1') => { const c = readLedger(root).resourceClaims[id]; return { id, owner: c.owner, generation: c.generation, token: c.token }; };
  const release = (id = 'c1') => mutate('release', { ...proof(id), quiescence: { by: 'coordinator', stopped: true, evidenceRef: 'fixture-stopped' } });
  return { root, git, mutate, group, host, acquire, proof, release, config };
}
test('read-only actual local capacity probe and estimate, unknown footprint never invents count', t => {
  const f = fixture(t), before = readLedger(f.root), snapshot = probeLocal(f.root);
  assert.ok(snapshot.cpu > 0); assert.ok(snapshot.memoryBytes > 0); assert.ok(snapshot.diskBytes > 0); assert.match(snapshot.scope, /snapshot only/);
  assert.deepEqual(readLedger(f.root), before);
  const input = { budget: vector(8), reserve: vector(2), footprint: vector(2), maxWorkers: 8 };
  assert.equal(recommendCapacity(input).environmentInstances, 3);
  assert.equal(recommendCapacity(input).workerCap, 8);
  assert.equal(recommendCapacity({ ...input, footprint: null }).environmentInstances, null);
  assert.equal(recommendCapacity({ ...input, footprint: vector(9) }).environmentInstances, 0);
  assert.throws(() => recommendCapacity({ ...input, reserve: vector(-1) }));
});
test('physical aliases collide, all-or-none rollback, independent resource groups coexist', t => {
  const f = fixture(t); f.mutate('acquire', f.acquire());
  f.mutate('group', f.group('alias', ['host/machine-1/port/3001', 'host/machine-1/port/3000']));
  const before = readLedger(f.root);
  assert.throws(() => f.mutate('acquire', f.acquire('alias-claim', 'alias')), /already held/);
  assert.deepEqual(readLedger(f.root), before);
  f.mutate('group', f.group('g2', ['host/machine-1/port/3001']));
  f.mutate('acquire', f.acquire('c2', 'g2', { owner: { ...owner, workerId: 'worker-2' } }));
  assert.equal(Object.values(readLedger(f.root).resourceClaims).filter(c => c.status === 'held').length, 2);
});
test('capacity rollback and actual worker cap are separate constraints', t => {
  const f = fixture(t); f.mutate('acquire', f.acquire());
  f.mutate('group', f.group('large', ['host/machine-1/port/3002'], { footprint: vector(3) }));
  const before = readLedger(f.root);
  assert.throws(() => f.mutate('acquire', f.acquire('c2', 'large')), /capacity shortage/);
  assert.deepEqual(readLedger(f.root), before);
  for (const [i, port] of [[2, 3002], [3, 3003]]) f.mutate('group', f.group(`small${i}`, [`host/machine-1/port/${port}`], { footprint: vector(1) }));
  f.mutate('acquire', f.acquire('c2', 'small2', { owner: { ...owner, workerId: 'worker-2' } }));
  assert.throws(() => f.mutate('acquire', f.acquire('c3', 'small3', { owner: { ...owner, workerId: 'worker-3' } })), /worker cap/);
});
test('release requires exact owner, generation and quiescence; no automatic expiry or stealing', t => {
  const f = fixture(t); f.mutate('acquire', f.acquire()); const old = f.proof();
  assert.throws(() => f.mutate('release', { ...old, quiescence: { by: 'coordinator', stopped: false, evidenceRef: 'unknown' } }), /stopped/);
  assert.throws(() => f.mutate('release', { ...old, owner: { ...owner, workerId: 'other' }, quiescence: { by: 'coordinator', stopped: true, evidenceRef: 'stopped' } }), /holder/);
  f.release(); f.mutate('acquire', f.acquire());
  assert.equal(f.proof().generation, 2);
  assert.throws(() => checkResourceClaim(f.root, { ...old, host: 'local' }), /holder/);
  assert.throws(() => f.mutate('release', { ...old, quiescence: { by: 'coordinator', stopped: true, evidenceRef: 'stopped' } }), /holder/);
});
test('acceptance freeze binds immutable candidate and ownership preflight, not execution proof', t => {
  const f = fixture(t); f.mutate('acquire', f.acquire());
  assert.throws(() => checkResourceClaim(f.root, { ...f.proof(), host: 'local', candidate: 'tree-1' }), /not frozen/);
  f.mutate('freeze', { ...f.proof(), candidate: 'tree-1' });
  assert.equal(checkResourceClaim(f.root, { ...f.proof(), host: 'local', candidate: 'tree-1' }).executionVerified, false);
  assert.throws(() => f.mutate('freeze', { ...f.proof(), candidate: 'tree-2' }), /cannot change/);
  assert.throws(() => checkResourceClaim(f.root, { ...f.proof(), host: 'other' }), /Wrong host/);
});
test('SSH metadata is not connection: planned/unknown hosts cannot pass readiness, disconnect retains claims', t => {
  const f = fixture(t);
  f.mutate('host', f.host({ id: 'remote', kind: 'ssh', machineId: 'machine-2', sshAlias: 'approved-build', status: 'planned' }));
  f.mutate('group', f.group('remote-env', ['host/machine-2/port/3000', 'global/account/test-user'], { host: 'remote' }));
  f.mutate('acquire', f.acquire('remote-claim', 'remote-env'));
  assert.throws(() => checkResourceClaim(f.root, { ...f.proof('remote-claim'), host: 'remote' }), /not preflight-ready/);
  f.mutate('host-status', { id: 'remote', status: 'ready', preflightRef: 'external-verified-environment-1' });
  assert.equal(checkResourceClaim(f.root, { ...f.proof('remote-claim'), host: 'remote' }).executionVerified, false);
  f.mutate('host-status', { id: 'remote', status: 'unknown' });
  assert.equal(readLedger(f.root).resourceClaims['remote-claim'].status, 'held');
  assert.throws(() => checkResourceClaim(f.root, { ...f.proof('remote-claim'), host: 'remote' }), /not preflight-ready/);
  assert.throws(() => f.mutate('acquire', f.acquire('duplicate', 'remote-env')), /liveness unknown/);
  f.mutate('group', f.group('local-account', ['global/account/test-user']));
  assert.throws(() => f.mutate('acquire', f.acquire('account', 'local-account')), /already held/);
});
test('reject unknown identities, secret fields, host aliases, noncanonical ports and unconfirmed inputs', t => {
  const f = fixture(t);
  assert.throws(() => f.mutate('host', f.host({ id: 'alias' })), /aliased/);
  assert.throws(() => f.mutate('host', f.host({ id: 'remote', machineId: 'machine-2', password: 'never-store' })), /prohibited/);
  assert.throws(() => f.mutate('group', f.group('bad', ['host/machine-1/port/03000'])), /Port/);
  assert.throws(() => f.mutate('group', f.group('bad', ['host/machine-2/port/3000'])), /differs/);
  assert.throws(() => f.mutate('group', f.group('bad', ['global/account/one'], { confirmation: { ...confirmation, by: 'agent' } })), /confirmation/);
  assert.throws(() => f.mutate('acquire', f.acquire('c1', 'missing')), /Unknown group/);
  assert.throws(() => f.mutate('acquire', f.acquire('c1', 'g1', { owner: { ...owner, workerHarness: 'codex' } })), /harness/);
  assert.throws(() => f.mutate('acquire', f.acquire('c1', 'g1', { configRevision: 2 })), /configuration/);
});
test('corrupt resource maps fail closed without mutations', t => {
  const f = fixture(t), file = join(commonDir(f.root), 'supervibe/state.json'), base = readLedger(f.root);
  for (const key of ['resourceHosts', 'resourceGroups', 'resourceClaims']) {
    for (const value of [null, [], 'bad']) {
      writeFileSync(file, JSON.stringify({ ...base, [key]: value }));
      assert.throws(() => f.mutate('acquire', f.acquire()), /must be an object/);
    }
  }
  writeFileSync(file, JSON.stringify(base));
});
test('same operation replay idempotent; stale CAS or reused operation cannot change claims', t => {
  const f = fixture(t), input = { ledgerRevision: readLedger(f.root).revision, operation: 'fixed', payload: f.acquire() };
  mutateResources(f.root, 'acquire', input);
  assert.equal(mutateResources(f.root, 'acquire', input).replayed, true);
  assert.throws(() => mutateResources(f.root, 'acquire', { ...input, operation: 'another' }), /Stale revision/);
  assert.throws(() => mutateResources(f.root, 'acquire', { ...input, payload: f.acquire('different') }), /reused/);
});
test('concurrent OS processes across linked worktrees cannot double-acquire', async t => {
  const f = fixture(t), linked = join(f.root, 'linked'); f.git('worktree', 'add', '-b', 'linked', linked);
  const revision = readLedger(f.root).revision;
  const run = (cwd, claim) => new Promise(resolve => {
    const child = spawn(process.execPath, [cli, 'acquire'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let err = ''; child.stderr.on('data', x => { err += x; }); child.stdout.resume();
    child.on('close', code => resolve({ code, err })); child.stdin.end(JSON.stringify({ ledgerRevision: revision, operation: claim, payload: f.acquire(claim) }));
  });
  const results = await Promise.all([run(f.root, 'first'), run(linked, 'second')]);
  assert.equal(results.filter(r => r.code === 0).length, 1, JSON.stringify(results));
  assert.match(results.find(r => r.code !== 0).err, /locked|Stale revision|already held/);
  assert.equal(Object.values(readLedger(linked).resourceClaims).filter(c => c.status === 'held').length, 1);
});

test('roadmap acceptance can hold environments after sprint settlement and main needs no fictitious worker', t => {
  const f = fixture(t), main = { role: 'main', sessionId: 'actual-current-session' };
  f.mutate('acquire', f.acquire('main-claim', 'g1', { owner: main }));
  assert.equal(checkResourceClaim(f.root, { ...f.proof('main-claim'), host: 'local' }).ok, true);
  f.release('main-claim');
  const roadmap = f.acquire('roadmap-claim', 'g1', { scope: 'roadmap', sprint: undefined, owner: main });
  assert.throws(() => f.mutate('acquire', roadmap), /all epic sprints settled/);
  const state = readLedger(f.root); state.sprints.S1.state = 'merged'; state.sprints.S1.landing = { commit: 'fixture' };
  writeFileSync(join(commonDir(f.root), 'supervibe/state.json'), JSON.stringify(state));
  f.mutate('acquire', roadmap);
  f.mutate('freeze', { ...f.proof('roadmap-claim'), candidate: 'roadmap-tree' });
  assert.equal(checkResourceClaim(f.root, { ...f.proof('roadmap-claim'), host: 'local', candidate: 'roadmap-tree' }).ok, true);
});

test('owner identity is independent of JSON property order', t => {
  const f = fixture(t); f.mutate('acquire', f.acquire());
  const reordered = { workerHarness: owner.workerHarness, workerId: owner.workerId, mode: owner.mode, role: owner.role };
  assert.equal(checkResourceClaim(f.root, { ...f.proof(), owner: reordered, host: 'local' }).ok, true);
  f.mutate('release', { ...f.proof(), owner: reordered, quiescence: { by: 'coordinator', stopped: true, evidenceRef: 'stopped' } });
  assert.throws(() => f.mutate('host', f.host({ id: 'new-host', machineId: 'other', status: 'planned', preflightRef: { password: 'never-store' } })), /preflight evidence reference/);
});
test('declared acceptance groups require exact live main-owned proofs and cannot be omitted', t => {
  const f = fixture(t), main = { role: 'main', sessionId: 'actual-main-session' };
  f.mutate('acquire', f.acquire('c1', 'g1', { owner: main })); f.mutate('freeze', { ...f.proof(), candidate: 'tree-1' });
  const expected = { scope: 'sprint', epic: 'E1', sprint: 'S1', candidate: 'tree-1' };
  const scenario = { id: 'test', goal: 'exercise environment', expected: 'works', steps: ['run'], required: true, modality: 'cli', environment: 'real' };
  const block = (name, payload) => '\n```' + name + '\n' + JSON.stringify(payload) + '\n```\n';
  const plan = groups => block('supervibe-acceptance-plan', { schema: 1, scope: 'sprint', scenarios: [{ ...scenario, ...(groups === undefined ? {} : { resourceGroups: groups }) }] });
  const receipt = claims => block('supervibe-resource-execution', { schema: 1, ...expected, claims });
  const proof = { ...f.proof(), host: 'local', candidate: 'tree-1' };
  assert.equal(verifyAcceptanceResources(f.root, expected, plan(), '').policyChecked, false);
  assert.throws(() => verifyAcceptanceResources(f.root, expected, plan('g1'), ''), /unique array/);
  assert.throws(() => verifyAcceptanceResources(f.root, expected, plan(['g1']), ''), /supervibe-resource-execution/);
  assert.throws(() => verifyAcceptanceResources(f.root, expected, plan(['g1']), receipt([])), /Missing required/);
  assert.equal(verifyAcceptanceResources(f.root, expected, plan(['g1']), receipt([proof])).policyChecked, true);
  assert.throws(() => verifyAcceptanceResources(f.root, expected, plan(['g1']), receipt([proof, proof])), /duplicate/);
  assert.throws(() => verifyAcceptanceResources(f.root, expected, plan(['g1']), receipt([{ ...proof, candidate: 'other' }])), /candidate/);
  f.release(); assert.throws(() => verifyAcceptanceResources(f.root, expected, plan(['g1']), receipt([proof])), /holder/);
});

test('main environment consumes capacity but does not consume worker cap', t => {
  const f = fixture(t);
  for (let i = 1; i <= 3; i++) f.mutate('group', f.group(`tiny${i}`, [`host/machine-1/port/${4000 + i}`], { footprint: vector(1) }));
  f.mutate('acquire', f.acquire('one', 'tiny1'));
  f.mutate('acquire', f.acquire('two', 'tiny2', { owner: { ...owner, workerId: 'worker-2' } }));
  f.mutate('acquire', f.acquire('main', 'tiny3', { owner: { role: 'main', sessionId: 'actual-session' } }));
  assert.equal(Object.values(readLedger(f.root).resourceClaims).filter(c => c.status === 'held').length, 3);
});
test('independent acceptance claim must match actual executor for native and external modes', t => {
  for (const mode of ['native', 'external']) {
    const f = fixture(t), state = readLedger(f.root);
    const config = { ...f.config, independentAcceptance: true, mode, provider: mode === 'native' ? 'harness' : 'orca' };
    if (mode === 'external') { delete config.workerHarness; config.workerHarnesses = ['codex']; }
    state.iterationConfigs.E1 = config; writeFileSync(join(commonDir(f.root), 'supervibe/state.json'), JSON.stringify(state));
    const actualOwner = { ...owner, mode, workerHarness: mode === 'native' ? 'inherit' : 'codex' };
    f.mutate('acquire', f.acquire('c1', 'g1', { owner: actualOwner, configFingerprint: iterationConfigFingerprint(config) }));
    f.mutate('freeze', { ...f.proof(), candidate: 'tree-1' });
    const expected = { scope: 'sprint', epic: 'E1', sprint: 'S1', candidate: 'tree-1' };
    const block = (name, payload) => '\n```' + name + '\n' + JSON.stringify(payload) + '\n```\n';
    const plan = block('supervibe-acceptance-plan', { schema: 1, scope: 'sprint', scenarios: [{ id: 'test', goal: 'run', expected: 'works', steps: ['run'], required: true, modality: 'cli', environment: 'real', resourceGroups: ['g1'] }] });
    const receipt = block('supervibe-resource-execution', { schema: 1, ...expected, claims: [{ ...f.proof(), host: 'local', candidate: 'tree-1' }] });
    const execution = workerId => block('supervibe-acceptance-execution', { task: { mode, workerHarness: actualOwner.workerHarness }, result: { execution: mode === 'native' ? { workerId } : { executorIdentity: { kind: 'worker', id: workerId, source: 'actual-receipt' } } } });
    assert.throws(() => verifyAcceptanceResources(f.root, expected, plan, receipt + execution('developer-other')), /actual acceptance executor/);
    assert.equal(verifyAcceptanceResources(f.root, expected, plan, receipt + execution('worker-1')).policyChecked, true);
  }
});

test('registry quota ignores settled retained claims, but checks active execution ownership and cap', t => {
  const f = fixture(t);
  f.mutate('acquire', f.acquire()); // Legacy environment retained after migration/settlement.
  const seed = entries => {
    const state = readLedger(f.root);
    state.workerExecutions = { schema: 1, entries };
    writeFileSync(join(commonDir(f.root), 'supervibe', 'state.json'), JSON.stringify(state));
  };
  const entry = (id, state = 'running') => ({ id, token: `token-${id}`, epic: 'E1', sprint: 'S1', branch: 'main', ownership: 'borrowed', commonDir: commonDir(f.root), state,
    task: { workerExecutionId: id, worktree: f.root, mode: 'native', workerHarness: 'inherit' }, execution: { workerId: id },
    ...(state === 'settled' ? { outcome: { status: 'pass' }, quiescence: { stopped: true }, cleanup: 'cleanup_pending' } : {}) });
  const entries = { 'worker-1': entry('worker-1', 'settled'), 'worker-2': entry('worker-2'), 'worker-3': entry('worker-3') };
  seed(entries);
  f.mutate('group', f.group('g2', ['host/machine-1/port/3002']));
  f.mutate('acquire', f.acquire('c2', 'g2', { owner: { ...owner, workerId: 'worker-2' } }));
  assert.equal(readLedger(f.root).resourceClaims.c1.status, 'held');
  f.release('c2');
  assert.throws(() => f.mutate('acquire', f.acquire('c2', 'g2')), /registered active/);
  seed({ ...entries, 'worker-4': entry('worker-4', 'unknown') });
  assert.throws(() => f.mutate('acquire', f.acquire('c2', 'g2', { owner: { ...owner, workerId: 'worker-2' } })), /worker cap/);
  assert.equal(readLedger(f.root).resourceClaims.c2.status, 'released');
});

test('external resource owner requires actual executor identity, not a compatible dispatch', t => {
  const f = fixture(t), state = readLedger(f.root);
  const config = { ...f.config, mode: 'external', provider: 'orca', workerHarnesses: ['claude-code'] };
  delete config.workerHarness;
  state.iterationConfigs.E1 = config;
  const entry = { id: 'external', token: 'fixture-token', epic: 'E1', sprint: 'S1', branch: 'main', ownership: 'borrowed', commonDir: commonDir(f.root), state: 'running',
    task: { workerExecutionId: 'external', worktree: f.root, mode: 'external', workerHarness: 'claude-code' }, execution: { runId: 'run', taskId: 'task', dispatchId: 'dispatch' } };
  state.workerExecutions = { schema: 1, entries: { external: entry } };
  const statePath = join(commonDir(f.root), 'supervibe', 'state.json');
  writeFileSync(statePath, JSON.stringify(state));
  const claim = f.acquire('c1', 'g1', { owner: { role: 'worker', mode: 'external', workerId: 'executor', workerHarness: 'claude-code' }, configFingerprint: iterationConfigFingerprint(config) });
  assert.throws(() => f.mutate('acquire', claim), /executor identity unavailable or mismatched/);
  entry.execution.executorIdentity = { id: 'executor' };
  writeFileSync(statePath, JSON.stringify(state));
  f.mutate('acquire', claim);
  assert.equal(readLedger(f.root).resourceClaims.c1.owner.workerId, 'executor');
});
