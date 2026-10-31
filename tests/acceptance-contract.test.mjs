import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { acceptancePlan, verifyResults } from '../scripts/acceptance-contract.mjs';
import { roadmapSnapshot, roadmapVerify, roadmapVerifyClean } from '../scripts/validate-workflow.mjs';
import { initializeLedger, readLedger, changeLedger } from '../scripts/ledger-store.mjs';
import { scenario, planBlock, resultsBlock } from './acceptance-fixtures.mjs';
const browser = { ...scenario, modality: 'browser', steps: ['open browser', 'click export', 'inspect download'] };
test('required browser acceptance rejects not-run, substitutions, missing observations and evidence', () => {
  const plan = planBlock('sprint', [browser]), good = resultsBlock('candidate', 'sprint', [browser]);
  assert.equal(verifyResults(plan, good, 'sprint', 'candidate').results.length, 1);
  for (const bad of [good.replace('"passed"', '"not-run"'), good.replace('"passed"', '"substituted"'), good.replace('"browser"', '"api"'), good.replace('"environment":"real"', '"environment":"fixture"'), good.replace('"observed":"works"', '"observed":""'), good.replace('"artifacts":["fixture.log"]', '"artifacts":[]'), good.replace('"blockers":[]', '"blockers":["browser unavailable"]'), good.replace('"steps":["open browser","click export","inspect download"]', '"steps":["static screenshot"]')]) assert.throws(() => verifyResults(plan, bad, 'sprint', 'candidate'));
  assert.throws(() => verifyResults(plan, good, 'sprint', 'different'), /candidate/);
  assert.throws(() => acceptancePlan(planBlock('sprint', [{ ...browser, required: false }]), 'sprint'), /Browser/);
  assert.throws(() => acceptancePlan(planBlock('sprint', [{ ...browser, environment: 'fixture' }]), 'sprint'), /Browser/);
});
test('plans and result coverage fail closed, optional non-pass cannot disguise missing required proof', () => {
  const plan = planBlock('sprint', [scenario]);
  for (const invalid of ['', plan + plan, planBlock('sprint', []), planBlock('sprint', [scenario, scenario]), planBlock('sprint', [{ ...scenario, required: false }])]) assert.throws(() => acceptancePlan(invalid, 'sprint'));
  const good = resultsBlock('candidate');
  for (const bad of [good.replace('"id":"A1"', '"id":"unknown"'), good.replace(/"results":\[[\s\S]*\]}/, '"results":[]}'), resultsBlock('candidate', 'roadmap'), good.replace('"steps":["run test"]', '"steps":[]')]) {
    assert.throws(() => verifyResults(plan, bad, 'sprint', 'candidate'));
  }
});
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-roadmap-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  const write = (path, content) => writeFileSync(join(root, path), content);
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  mkdirSync(join(root, 'acceptances'));
  const epic = 'E1.md', record = 'acceptances/E1.md';
  write(epic, '---\nepic: E1\nstatus: open\nfinal-acceptance-record: null\nfinal-accepted-at: null\n---\n## Sprint Breakdown\n\n| sprint | state | note |\n|---|---|---|\n| S1 | started | implemented |\n\n## Overall Acceptance\n' + planBlock('roadmap', [browser]));
  write('code.js', 'integrated'); git('add', '.'); git('commit', '-m', 'integrated upfront plan');
  initializeLedger(root, { schema: 1, revision: 0, wipLimit: 1, mainRef: 'main', sprintsDir: 'sprints', sprints: { S1: { id: 'S1', epic: 'E1', document: 'sprints/S1.md', branch: 'sprint/S1', worktree: root, state: 'merged', landing: git('rev-parse', 'HEAD') } }, events: [], operations: [] });
  const accept = () => {
    const evidence = roadmapSnapshot(root, epic, record, 'main');
    write(record, '## Verdict\npass\n\n```supervibe-evidence\n' + JSON.stringify(evidence) + '\n```\n' + resultsBlock(evidence.fingerprint, 'roadmap', [browser]));
    write(epic, readFileSync(join(root, epic), 'utf8').replace('final-acceptance-record: null', `final-acceptance-record: ${record}`).replace('final-accepted-at: null', 'final-accepted-at: 2026-10-31'));
    return evidence;
  };
  return { root, git, write, epic, record, accept };
}
test('roadmap requires separate integrated acceptance; committing evidence does not stale its fingerprint', t => {
  const f = fixture(t); assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'));
  const evidence = f.accept();
  assert.deepEqual(roadmapVerify(f.root, f.epic, f.record, 'main'), evidence);
  f.git('add', '.'); f.git('commit', '-m', 'final evidence');
  assert.deepEqual(roadmapVerify(f.root, f.epic, f.record, 'main'), evidence);
  const script = resolve('scripts/validate-workflow.mjs');
  for (const command of ['roadmap-verify', 'roadmap-verify-clean']) {
    const output = execFileSync(process.execPath, [script, command, '--epic', f.epic, '--record', f.record, '--main-ref', 'main'], { cwd: f.root, encoding: 'utf8' });
    assert.equal(JSON.parse(output).scope, 'roadmap');
  }
});
test('integrated code changes stale the final roadmap record; dirty input and wrong branch fail', t => {
  const f = fixture(t); f.accept(); f.git('add', '.'); f.git('commit', '-m', 'evidence');
  f.write('code.js', 'changed');
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /Commit integrated/);
  f.git('add', '.'); f.git('commit', '-m', 'new integration');
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /Stale/);
  f.git('checkout', '-b', 'other'); f.write('code.js', 'other'); f.git('add', '.'); f.git('commit', '-m', 'other candidate');
  assert.throws(() => roadmapSnapshot(f.root, f.epic, f.record, 'main'), /integrated main/);
});
test('roadmap cannot close with missing, pending or omitted shared sprint', t => {
  const f = fixture(t); f.accept();
  changeLedger(f.root, 0, 'pending', 'test', {}, state => { state.sprints.S1.state = 'active'; });
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /not landed/);
  changeLedger(f.root, 1, 'omit', 'test', {}, state => { state.sprints.S1.state = 'merged'; state.sprints.S2 = { ...state.sprints.S1, id: 'S2' }; });
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /missing from breakdown/);
  assert.equal(readLedger(f.root).revision, 2);
});
test('caller cannot override the shared main branch even with newly written result metadata', t => {
  const f = fixture(t); f.git('branch', 'release'); f.accept();
  f.write(f.record, readFileSync(join(f.root, f.record), 'utf8').replace('"mainRef":"main"', '"mainRef":"release"'));
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'release'), /Main ref differs/);
  assert.throws(() => roadmapSnapshot(f.root, f.epic, f.record, 'HEAD'), /local branch/);
});
test('unstarted stubs block despite fresh final results; historical merged projection remains compatible', t => {
  const f = fixture(t);
  f.write(f.epic, readFileSync(join(f.root, f.epic), 'utf8').replace('| S1 | started |', '| S1 | planned |'));
  f.git('add', '.'); f.git('commit', '-m', 'unstarted stub'); f.accept();
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /planned\/ready/);
  f.write(f.epic, readFileSync(join(f.root, f.epic), 'utf8').replace('| S1 | planned |', '| S1 | merged |'));
  f.git('add', '.'); f.git('commit', '-m', 'historical projection'); f.accept();
  assert.equal(roadmapVerify(f.root, f.epic, f.record, 'main').scope, 'roadmap');
});

test('final close requires committed tracked evidence, not an ignored or untracked record', t => {
  const f = fixture(t); f.accept();
  assert.throws(() => roadmapVerifyClean(f.root, f.epic, f.record, 'main'), /must be tracked/);
  f.git('add', '.');
  assert.throws(() => roadmapVerifyClean(f.root, f.epic, f.record, 'main'), /candidate must be clean/);
  f.git('commit', '-m', 'final evidence');
  assert.equal(roadmapVerifyClean(f.root, f.epic, f.record, 'main').scope, 'roadmap');
  f.git('rm', '--cached', f.record); f.write('.gitignore', 'acceptances/\n'); f.git('add', '.'); f.git('commit', '-m', 'ignored evidence');
  f.accept(); // A newly claimed pass can have a valid fingerprint, but not durable evidence.
  assert.equal(roadmapVerify(f.root, f.epic, f.record, 'main').scope, 'roadmap');
  assert.throws(() => roadmapVerifyClean(f.root, f.epic, f.record, 'main'), /must be tracked/);
});
test('indented planned rows cannot disappear from roadmap closure coverage', t => {
  const f = fixture(t);
  f.write(f.epic, readFileSync(join(f.root, f.epic), 'utf8').replace('| S1 | started | implemented |', '| S1 | started | implemented |\n   | S2 | planned | next wave |'));
  f.git('add', '.'); f.git('commit', '-m', 'indented pending wave'); f.accept();
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /planned\/ready/);
});
test('clearing the final pointer before a rerun revokes an old pass even with unchanged inputs', t => {
  const f = fixture(t); const before = f.accept();
  f.git('add', '.'); f.git('commit', '-m', 'previous final pass');
  assert.equal(roadmapVerifyClean(f.root, f.epic, f.record, 'main').fingerprint, before.fingerprint);
  f.write(f.epic, readFileSync(join(f.root, f.epic), 'utf8').replace(`final-acceptance-record: ${f.record}`, 'final-acceptance-record: null').replace('final-accepted-at: 2026-10-31', 'final-accepted-at: null'));
  assert.equal(roadmapSnapshot(f.root, f.epic, f.record, 'main').fingerprint, before.fingerprint);
  assert.throws(() => roadmapVerify(f.root, f.epic, f.record, 'main'), /pointer mismatch/);
  f.git('add', '.'); f.git('commit', '-m', 'revoke before new review');
  assert.throws(() => roadmapVerifyClean(f.root, f.epic, f.record, 'main'), /pointer mismatch/);
});
