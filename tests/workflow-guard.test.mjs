import { directoryLink } from './filesystem-fixtures.mjs';
import { planBlock, resultsBlock, mainAcceptancePolicy } from './acceptance-fixtures.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshot, verify, verifyClean, inspectWorktreeSprints as checkWip, IN_FLIGHT, LANDED } from '../scripts/validate-workflow.mjs';
import { initializeLedger, changeLedger } from '../scripts/ledger-store.mjs';
const script = resolve('scripts/validate-workflow.mjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  mkdirSync(join(root, 'sprints')); mkdirSync(join(root, 'acceptances'));
  const sprint = 'sprints/S1.md', record = 'acceptances/S1.md';
  const write = (p, text) => writeFileSync(join(root, p), text);
  write(sprint, '---\nsprint: S1\nstate: active\n---\n## DoD\nWorks\n' + planBlock());
  write('code.js', 'original'); write('AGENTS.md', 'gates: test');
  git('add', '.'); git('commit', '-m', 'baseline');
  initializeLedger(root, { schema: 1, revision: 0, wipLimit: 1, mainRef: git('branch', '--show-current').toString().trim(), sprintsDir: 'sprints', sprints: { S1: { id: 'S1', epic: 'E1', document: sprint, branch: git('branch', '--show-current').toString().trim(), worktree: root, state: 'active' } }, events: [], operations: [], iterationConfigs: { E1: mainAcceptancePolicy } });
  const accept = () => {
    const evidence = snapshot(root, sprint, record);
    write(record, '## Verdict\n\npass — verified\n\n## Evidence\n```supervibe-evidence\n' + JSON.stringify(evidence) + '\n```\n' + resultsBlock(evidence.fingerprint));
    write(sprint, `---\nsprint: S1\nstate: acceptance\nacceptance-record: ${record}\naccepted-at: 2026-10-31\n---\n## DoD\nWorks\n` + planBlock());
    return evidence;
  };
  return { root, git, write, sprint, record, accept };
}
test('acceptance metadata and its commit do not invalidate evidence', t => {
  const f = fixture(t), before = f.accept();
  assert.deepEqual(verify(f.root, f.sprint, f.record), before);
  f.git('add', '.'); f.git('commit', '-m', 'acceptance');
  assert.deepEqual(verify(f.root, f.sprint, f.record), before);
});
for (const [name, path, content] of [['code', 'code.js', 'changed'], ['config', 'AGENTS.md', 'other gates'], ['new file', 'new.js', 'new'], ['DoD', 'sprints/S1.md', '---\nsprint: S1\nstate: acceptance\nacceptance-record: acceptances/S1.md\naccepted-at: 2026-10-31\n---\n## DoD\nDifferent\n']]) {
  test(`${name} changes invalidate old pass`, t => {
    const f = fixture(t); f.accept(); f.write(path, content);
    assert.throws(() => verify(f.root, f.sprint, f.record), /Stale/);
  });
}
test('deleted tracked file invalidates pass', t => {
  const f = fixture(t); f.accept(); rmSync(join(f.root, 'code.js'));
  assert.throws(() => verify(f.root, f.sprint, f.record), /Stale/);
});
test('POSIX executable mode invalidates pass', { skip: process.platform === 'win32' ? 'Windows chmod cannot change POSIX executable bits' : false }, t => {
  const f = fixture(t); f.accept(); chmodSync(join(f.root, 'code.js'), 0o755);
  assert.throws(() => verify(f.root, f.sprint, f.record), /Stale/);
});
test('reaccept is available after changes; interrupted review cannot complete', t => {
  const f = fixture(t); f.accept(); f.write('code.js', 'changed');
  const current = snapshot(f.root, f.sprint, 'acceptances/S1-2.md');
  assert.equal(current.schema, 1);
  f.write(f.sprint, readFileSync(join(f.root, f.sprint), 'utf8').replace('state: acceptance', 'state: active'));
  assert.throws(() => verify(f.root, f.sprint, f.record), /not in acceptance/);
  f.write('acceptances/S1-2.md', '## Verdict\npass\n\n```supervibe-evidence\n' + JSON.stringify(current) + '\n```\n' + resultsBlock(current.fingerprint));
  f.write(f.sprint, readFileSync(join(f.root, f.sprint), 'utf8').replace('state: active', 'state: acceptance').replace('acceptances/S1.md', 'acceptances/S1-2.md'));
  assert.deepEqual(verify(f.root, f.sprint, 'acceptances/S1-2.md'), current);
});
test('legacy, blocked, duplicate or malformed records fail closed', t => {
  const f = fixture(t); f.accept();
  const original = readFileSync(join(f.root, f.record), 'utf8');
  for (const text of ['## Verdict\npass\n', original.replace('pass —', 'blocked —'), original + original, original.replace('"schema":1', '"schema":2'), original.replace(/```supervibe-acceptance-results[\s\S]*?```/, '')]) {
    f.write(f.record, text); assert.throws(() => verify(f.root, f.sprint, f.record));
  }
});
test('pointer mismatch fails even when old pass remains unchanged', t => {
  const f = fixture(t); f.accept();
  f.write(f.sprint, readFileSync(join(f.root, f.sprint), 'utf8').replace('acceptances/S1.md', 'acceptances/other.md'));
  assert.throws(() => verify(f.root, f.sprint, f.record), /pointer mismatch/);
});
test('WIP counts acceptance, excludes merged and closed, rejects malformed ledgers', t => {
  const f = fixture(t); f.accept();
  assert.throws(() => checkWip(f.root, 'sprints', 1), /WIP limit 1 reached/);
  for (const state of ['merged', 'closed']) {
    f.write('sprints/S2.md', `---\nsprint: S2\nstate: ${state}\n---\n`);
    assert.equal(checkWip(f.root, 'sprints', 2).count, 1);
  }
  f.write('sprints/S2.md', '---\nsprint: S1\nstate: active\n---\n');
  assert.throws(() => checkWip(f.root, 'sprints', 3), /Duplicate sprint/);
  f.write('sprints/S2.md', '---\nsprint: S2\nstate: unknown\n---\n');
  assert.throws(() => checkWip(f.root, 'sprints', 3), /Malformed/);
  assert.throws(() => checkWip(f.root, 'sprints', 0), /positive integer/);
  assert.deepEqual([...IN_FLIGHT], ['active', 'acceptance']);
  assert.deepEqual([...LANDED], ['merged', 'closed']);
});
test('CLI is usable from host repository, paths and arguments fail closed', t => {
  const f = fixture(t); f.accept();
  const args = ['verify', '--sprint', f.sprint, '--record', f.record];
  const output = execFileSync(process.execPath, [script, ...args], { cwd: f.root, encoding: 'utf8' });
  assert.equal(JSON.parse(output).schema, 1);
  assert.throws(() => snapshot(f.root, '../outside.md', f.record), /inside/);
  assert.throws(() => snapshot(f.root, f.sprint, f.sprint), /separate/);
  assert.throws(() => execFileSync(process.execPath, [script, ...args, '--unknown', 'x'], { cwd: f.root, stdio: 'pipe' }));
});

test('paths through symlink directories fail closed', t => {
  const f = fixture(t);
  directoryLink(t, join(f.root, 'sprints'), join(f.root, 'alias'));
  assert.throws(() => snapshot(f.root, 'alias/S1.md', f.record), /symlink directory/);
  assert.throws(() => snapshot(f.root, f.sprint, 'alias/result.md'), /symlink directory/);
});
test('merged upstream payload invalidates an accepted branch', t => {
  const f = fixture(t);
  const branch = f.git('branch', '--show-current').toString().trim();
  f.git('checkout', '-b', 'upstream'); f.write('code.js', 'upstream change');
  f.git('add', '.'); f.git('commit', '-m', 'upstream change'); f.git('checkout', branch);
  f.accept(); f.git('add', '.'); f.git('commit', '-m', 'accepted');
  f.git('merge', 'upstream', '--no-edit');
  assert.throws(() => verify(f.root, f.sprint, f.record), /Stale/);
});

test('complete requires reviewed payload and evidence committed, not only working-tree equivalence', t => {
  const f = fixture(t); f.write('code.js', 'reviewed but uncommitted'); f.accept();
  assert.doesNotThrow(() => verify(f.root, f.sprint, f.record));
  assert.throws(() => verifyClean(f.root, f.sprint, f.record), /tracked before complete|candidate must be clean/);
  f.git('add', '.');
  assert.throws(() => verifyClean(f.root, f.sprint, f.record), /tracked before complete|candidate must be clean/);
  f.git('commit', '-m', 'reviewed candidate and evidence');
  assert.doesNotThrow(() => verifyClean(f.root, f.sprint, f.record));
});

test('an ignored acceptance record cannot authorize complete', t => {
  const f = fixture(t); f.write('.gitignore', 'acceptances/\n'); f.accept();
  f.git('add', '.'); f.git('commit', '-m', 'metadata but no ignored evidence');
  assert.throws(() => verifyClean(f.root, f.sprint, f.record), /tracked before complete/);
});

test('WIP sees a ledger created only in another linked worktree before a serial second start', t => {
  const f = fixture(t);
  f.git('rm', f.sprint);
  mkdirSync(join(f.root, 'sprints'), { recursive: true });
  f.write('sprints/.gitkeep', ''); f.git('add', '.'); f.git('commit', '-m', 'empty scaffold');
  const other = `${f.root}-linked`;
  t.after(() => rmSync(other, { recursive: true, force: true }));
  f.git('worktree', 'add', '-b', 'sprint/S2', other);
  writeFileSync(join(other, 'sprints/S2.md'), '---\nsprint: S2\nepic: E1\nstate: active\nworktree: sprint/S2\n---\n');
  assert.throws(() => checkWip(f.root, 'sprints', 1), /WIP limit 1 reached across linked worktrees: S2/);
  assert.deepEqual(checkWip(f.root, 'sprints', 2).inFlight, ['S2']);
  assert.deepEqual(checkWip(other, 'sprints', 2).inFlight, ['S2']);
});
test('WIP deduplicates matching copies, keeps stale active copies counted, rejects conflicting documents', t => {
  const f = fixture(t), other = `${f.root}-linked`;
  t.after(() => rmSync(other, { recursive: true, force: true }));
  f.git('worktree', 'add', '-b', 'copy', other);
  assert.equal(checkWip(f.root, 'sprints', 2).count, 1);
  f.write(f.sprint, '---\nsprint: S1\nstate: closed\n---\n');
  assert.equal(checkWip(f.root, 'sprints', 2).count, 1);
  // Exactly one S1 per worktree: only the cross-worktree path conflict applies.
  rmSync(join(other, 'sprints/S1.md'));
  writeFileSync(join(other, 'sprints/duplicate.md'), '---\nsprint: S1\nstate: active\n---\n');
  assert.throws(() => checkWip(f.root, 'sprints', 2), /Conflicting copies of sprint S1/);
});
test('WIP rejects duplicate IDs within one worktree independently of directory enumeration order', t => {
  const f = fixture(t);
  f.write('sprints/duplicate.md', '---\nsprint: S1\nstate: active\n---\n');
  assert.throws(() => checkWip(f.root, 'sprints', 2), /Duplicate sprint id/);
});
test('WIP fails closed on stale registered worktrees', t => {
  const f = fixture(t), other = `${f.root}-linked`;
  t.after(() => rmSync(other, { recursive: true, force: true }));
  f.git('worktree', 'add', '-b', 'missing', other);
  rmSync(other, { recursive: true, force: true });
  assert.throws(() => checkWip(f.root, 'sprints', 2), /Stale registered worktree|Unavailable registered worktree/);
});
test('tracked scaffold placeholders preserve empty artifact directories in a fresh worktree', t => {
  const f = fixture(t), other = `${f.root}-linked`;
  t.after(() => rmSync(other, { recursive: true, force: true }));
  for (const dir of ['acceptances', 'notes', 'roadmaps']) {
    mkdirSync(join(f.root, dir), { recursive: true }); f.write(`${dir}/.gitkeep`, '');
  }
  f.git('add', '.'); f.git('commit', '-m', 'preserve empty scaffold');
  f.git('worktree', 'add', '-b', 'fresh-scaffold', other);
  for (const dir of ['acceptances', 'notes', 'roadmaps']) assert.equal(readFileSync(join(other, dir, '.gitkeep'), 'utf8'), '');
});
test('a landed no-ff merge is detectable for resume even with the carrier still present', t => {
  const f = fixture(t), other = `${f.root}-linked`;
  t.after(() => rmSync(other, { recursive: true, force: true }));
  f.git('worktree', 'add', '-b', 'completed-sprint', other);
  writeFileSync(join(other, 'code.js'), 'completed work');
  execFileSync('git', ['-C', other, 'add', '.']);
  execFileSync('git', ['-C', other, 'commit', '-m', 'candidate'], { stdio: 'pipe' });
  const tip = f.git('rev-parse', 'completed-sprint').toString().trim();
  f.git('merge', '--no-ff', '--no-edit', 'completed-sprint');
  const landing = f.git('rev-parse', 'HEAD').toString().trim();
  assert.notEqual(landing, tip);
  assert.doesNotThrow(() => f.git('merge-base', '--is-ancestor', tip, landing));
  assert.throws(() => f.git('merge-base', '--is-ancestor', landing, tip));
  assert.equal(f.git('rev-parse', `${landing}^2`).toString().trim(), tip);
  // Recovery must examine landing evidence before the normal ancestry preflight.
  assert.equal(readFileSync(join(other, 'code.js'), 'utf8'), 'completed work');
});

test('Sprint final gate blocks missing claims declared by required scenarios', t => {
  const f = fixture(t); f.accept();
  f.write(f.sprint, readFileSync(join(f.root, f.sprint), 'utf8').replace('"required":true', '"required":true,"resourceGroups":["shared-db"]'));
  const evidence = snapshot(f.root, f.sprint, f.record);
  f.write(f.record, '## Verdict\npass\n\n```supervibe-evidence\n' + JSON.stringify(evidence) + '\n```\n' + resultsBlock(evidence.fingerprint));
  assert.throws(() => verify(f.root, f.sprint, f.record), /supervibe-resource-execution/);
});

test('sprint worktree frontmatter rejects relative locations, accepts branch or absolute identity', t => {
  const f = fixture(t);
  const doc = carrier => '---\nsprint: S1\nstate: active\nworktree: ' + carrier + '\n---\n## DoD\nWorks\n' + planBlock();
  for (const bad of ['../opentask-worktrees/S1', '..\\carriers\\S1', './carriers/S1', '~/carriers/S1']) {
    f.write(f.sprint, doc(bad));
    assert.throws(() => snapshot(f.root, f.sprint, f.record), /never a relative location/, bad);
  }
  for (const good of ['sprint/E1-S1', 'D:\\projects\\carriers\\S1']) {
    f.write(f.sprint, doc(good));
    assert.doesNotThrow(() => snapshot(f.root, f.sprint, f.record), good);
  }
});
