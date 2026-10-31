import { directoryLink, fileLink } from './filesystem-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { projectDoctor } from '../scripts/project-doctor.mjs';
const repo = resolve(import.meta.dirname, '..');
function snapshot(root) {
  const result = {};
  function walk(path, rel = '') {
    for (const name of readdirSync(path).sort()) {
      const file = join(path, name), key = join(rel, name), s = lstatSync(file);
      result[key] = s.isSymbolicLink() ? ['link', readlinkSync(file)] : s.isDirectory() ? ['dir', s.mode] : ['file', s.mode, readFileSync(file).toString('base64')];
      if (s.isDirectory()) walk(file, key);
    }
  }
  walk(root); return result;
}
function fixture(t, configured = true) {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-project-doctor-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init', '-b', 'main'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  const put = (p, data) => writeFileSync(join(root, p), data);
  const config = '## supervibe\n- roadmaps_dir: roadmaps\n- sprints_dir: sprints\n- acceptances_dir: acceptances\n- notes: notes\n- wip_limit: 1\n- collaboration_mode: external\n- collaboration_provider: orca\n### gates\n- secret: touch DO_NOT_CREATE; echo password=TOP_SECRET\n';
  if (configured) {
    for (const p of ['roadmaps', 'sprints', 'acceptances', 'notes']) mkdirSync(join(root, p));
    put('AGENTS.md', config);
  }
  put('base', 'base'); git('add', '.'); git('commit', '-m', 'base');
  const state = { schema: 1, revision: 0, wipLimit: 1, mainRef: 'main', sprintsDir: 'sprints', sprints: {}, events: [], operations: [] };
  const seed = (s = state) => { mkdirSync(join(root, '.git/supervibe'), { recursive: true }); put('.git/supervibe/state.json', JSON.stringify(s)); };
  const run = () => { const before = snapshot(root); const result = projectDoctor(root); assert.deepEqual(snapshot(root), before, 'doctor must not mutate checkout or Git common-dir'); assert.doesNotMatch(JSON.stringify(result), /TOP_SECRET|DO_NOT_CREATE|password=|secret:/); return result; };
  return { root, put, config, state, seed, run };
}
const check = (r, id) => r.checks.find(c => c.id === id);
test('new repository gets actionable findings without initializing state', t => {
  const f = fixture(t, false), r = f.run();
  assert.equal(check(r, 'host.config').level, 'blocker');
  assert.equal(check(r, 'ledger.state').level, 'warning');
});
test('configured gates are not executed; static policy does not certify runtime', t => {
  const f = fixture(t); f.seed(); const r = f.run();
  assert.equal(check(r, 'host.gates').level, 'info');
  assert.equal(check(r, 'runtime.capabilities').level, 'manual');
  assert.match(check(r, 'runtime.capabilities').evidence, /Unknown/);
  assert.equal(check(r, 'iteration.policy').level, 'warning');
  assert.equal(check(r, 'resources.metadata').level, 'warning');
});
test('corrupt ledger errors and config errors never leak content', t => {
  const f = fixture(t); f.seed(); f.put('.git/supervibe/state.json', 'TOP_SECRET');
  assert.equal(check(f.run(), 'ledger.state').level, 'blocker');
  f.put('AGENTS.md', f.config + 'password=TOP_SECRET');
  assert.equal(check(f.run(), 'host.config').level, 'blocker');
});
test('existing write lock stops runtime inspection without stealing lock', t => {
  const f = fixture(t); f.seed(); mkdirSync(join(f.root, '.git/supervibe/write.lock'));
  f.put('.git/supervibe/write.lock/owner.json', '{"password":"TOP_SECRET"}');
  const r = f.run(); assert.equal(check(r, 'ledger.lock').level, 'blocker'); assert.equal(check(r, 'artifacts.inventory').level, 'manual');
});
test('unsafe configured paths and directory links fail closed', t => {
  const f = fixture(t); f.seed(); f.put('AGENTS.md', f.config.replace('roadmaps_dir: roadmaps', 'roadmaps_dir: ../TOP_SECRET'));
  assert.equal(check(f.run(), 'host.config').level, 'blocker');
  f.put('AGENTS.md', f.config); rmSync(join(f.root, 'roadmaps'), { recursive: true }); directoryLink(t, 'notes', join(f.root, 'roadmaps'));
  assert.equal(check(f.run(), 'host.config').level, 'blocker');
});
for (const [path, target, id] of [['AGENTS.md', 'base', 'host.config'], ['.git/supervibe/state.json', '../../base', 'ledger.state']]) {
  test(`${id} file symlink fails closed`, t => {
    const f = fixture(t); f.seed(); rmSync(join(f.root, path));
    if (!fileLink(t, target, join(f.root, path))) return;
    assert.equal(check(f.run(), id).level, 'blocker');
  });
}
test('duplicate artifact IDs, main ref and policy corruption get stable checks', t => {
  const f = fixture(t); f.seed({ ...f.state, mainRef: 'missing', iterationConfigs: { E1: { password: 'TOP_SECRET' } } });
  const epic = '---\nepic: E1\nstatus: open\n---\n## Sprint Breakdown\n| sprint | state | note |\n|---|---|---|\n| S1 | ready | TOP_SECRET |\n';
  f.put('roadmaps/a.md', epic); f.put('roadmaps/b.md', epic);
  const r = f.run(); assert.equal(check(r, 'artifacts.duplicate-epic').level, 'blocker'); assert.equal(check(r, 'iteration.policy').level, 'blocker'); assert.equal(check(r, 'ledger.main-ref').level, 'blocker');
});
test('CLI supports JSON/text and sanitized usage errors', t => {
  const f = fixture(t, false), before = snapshot(f.root), script = join(repo, 'scripts/project-doctor.mjs');
  const r = spawnSync(process.execPath, [script, '--root', f.root], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.equal(JSON.parse(r.stdout).schema, 1);
  assert.match(spawnSync(process.execPath, [script, '--root', f.root, '--format', 'text'], { encoding: 'utf8' }).stdout, /\[blocker\] host.config/);
  const bad = spawnSync(process.execPath, [script, '--password', 'TOP_SECRET'], { encoding: 'utf8' }); assert.equal(bad.status, 2); assert.doesNotMatch(bad.stderr, /TOP_SECRET/);
  assert.deepEqual(snapshot(f.root), before);
});
test('both Skill entrypoints enforce user-only frontmatter; no automatic wiring', () => {
  for (const name of ['SKILL.md', 'SKILL.zh.md']) {
    const source = readFileSync(join(repo, 'skills/doctor', name), 'utf8');
    const fm = source.match(/^---\n([\s\S]*?)\n---\n/)[1];
    const fields = Object.fromEntries(fm.split('\n').map(line => { const i = line.indexOf(':'); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
    assert.equal(fields.name, 'doctor'); assert.equal(fields['disable-model-invocation'], 'true'); assert.equal(fields['user-invocable'], 'true'); assert.equal(fields['allowed-tools'], undefined);
    assert.match(source, /project-doctor\.mjs/); assert.match(source, /\/supervibe:doctor/);
  }
  for (const dir of readdirSync(join(repo, 'skills')).filter(d => d !== 'doctor')) for (const name of ['SKILL.md', 'SKILL.zh.md']) assert.doesNotMatch(readFileSync(join(repo, 'skills', dir, name), 'utf8'), /supervibe:doctor|project-doctor\.mjs/);
  for (const file of readdirSync(join(repo, '.github/workflows'))) assert.doesNotMatch(readFileSync(join(repo, '.github/workflows', file), 'utf8'), /project-doctor\.mjs|supervibe:doctor/);
});
test('confirmed policy and structured acceptance plan are not live acceptance proof', t => {
  const f = fixture(t);
  const policy = { schema: 1, epic: 'E1', revision: 1, mode: 'native', provider: 'harness', maxWorkers: 2, independentAcceptance: true, status: 'confirmed', confirmation: { by: 'user', source: 'fixture', at: '2026-10-31T00:00:00Z' }, workerHarness: 'inherit', allowMixed: false };
  f.seed({ ...f.state, iterationConfigs: { E1: policy } });
  const plan = { schema: 1, scope: 'roadmap', scenarios: [{ id: 'S1', goal: 'UI works', expected: 'Visible result', steps: ['Open app'], required: true, modality: 'browser', environment: 'real' }] };
  const epic = '---\nepic: E1\nstatus: open\n---\n## Sprint Breakdown\n| sprint | state | note |\n|---|---|---|\n| S1 | ready | first |\n';
  f.put('roadmaps/epic.md', epic + '\n```supervibe-acceptance-plan\n' + JSON.stringify(plan) + '\n```\n');
  let r = f.run(); assert.equal(check(r, 'iteration.policy').level, 'info'); assert.equal(check(r, 'acceptance.plans').level, 'info'); assert.equal(check(r, 'acceptance.environment').level, 'manual');
  f.put('roadmaps/epic.md', epic); r = f.run(); assert.equal(check(r, 'acceptance.plans').level, 'blocker');
  f.put('roadmaps/epic.md', epic.replace('status: open', 'status: closed')); r = f.run(); assert.equal(check(r, 'acceptance.plans').level, 'warning');
});
test('invalid resource declarations do not leak credentials or trigger repair', t => {
  const f = fixture(t); f.seed({ ...f.state, resourceHosts: { local: { password: 'TOP_SECRET' } } });
  assert.equal(check(f.run(), 'resources.metadata').level, 'blocker');
});
