import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkDocSync } from '../scripts/doc-sync.mjs';
import { validateDocSyncRule, globMatch } from '../scripts/doc-sync-rules.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-doc-sync-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'test');
  const write = (path, text = 'initial') => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const commit = () => { git('add', '.'); git('commit', '-qm', 'test'); return git('rev-parse', 'HEAD'); };
  write('README.md'); const base = commit();
  return { root, git, write, commit, base };
}
const config = { doc_sync_map: [{ change: 'skills/**/SKILL.md', owes: '{dir}/SKILL.zh.md' }] };
test('strict portable glob grammar rejects prose, traversal and unknown requirements', () => {
  for (const owes of ['matching file', '../README.md', '/README.md', '{unknown}', '.git/config', '**/***/bad']) assert.throws(() => validateDocSyncRule({ change: 'skills/**', owes }));
  assert.throws(() => validateDocSyncRule({ change: 'skills/**', owes: 'README.md', optional: true }));
  assert.equal(globMatch('skills/**/SKILL.md', 'skills/a/b/SKILL.md'), true);
  assert.equal(globMatch('skills/**/SKILL.md', 'skills/SKILL.md'), true);
  assert.equal(globMatch('skills/*/SKILL.md', 'skills/a/b/SKILL.md'), false);
  assert.equal(globMatch('a?.md', 'ab.md'), true);
});
test('same-commit sibling cochange passes, report remains explicitly mechanical', async t => {
  const f = fixture(t); f.write('skills/a/SKILL.md'); f.write('skills/a/SKILL.zh.md'); f.commit();
  const report = await checkDocSync(f.root, { base: f.base, config });
  assert.equal(report.pass, true); assert.equal(report.checks.length, 1); assert.equal(report.semanticReviewRequired, true);
  assert.equal(f.git('status', '--porcelain'), '');
});
test('later doc-only repair does not erase arrears; every code commit is checked', async t => {
  const f = fixture(t); f.write('skills/a/SKILL.md'); const bad = f.commit(); f.write('skills/a/SKILL.zh.md'); f.commit();
  const report = await checkDocSync(f.root, { base: f.base, config });
  assert.equal(report.pass, false); assert.deepEqual(report.checks[0].missing, [bad]);
});
test('merge-base scopes branch changes, supplied task paths are not guessed', async t => {
  const f = fixture(t); f.git('checkout', '-qb', 'topic'); f.write('unmapped.txt'); f.commit();
  const report = await checkDocSync(f.root, { base: f.base, config, taskPaths: ['skills/missing/SKILL.md'] });
  assert.equal(report.pass, false); assert.equal(report.checks[0].status, 'no-source-commit');
  await assert.rejects(checkDocSync(f.root, { base: f.base, config, taskPaths: ['../outside'] }));
  await assert.rejects(checkDocSync(f.root, { config }));
});
test('epic target requires explicit binding and a separate changed file', async t => {
  const f = fixture(t); const config = { doc_sync_map: [{ change: 'specs/**', owes: '{epic}' }] };
  f.write('specs/a.md'); f.write('roadmaps/epic.md'); f.commit();
  await assert.rejects(checkDocSync(f.root, { base: f.base, config }), /epic-document/);
  assert.equal((await checkDocSync(f.root, { base: f.base, config, epicDocument: 'roadmaps/epic.md' })).pass, true);
  assert.equal((await checkDocSync(f.root, { base: f.base, config, epicDocument: 'specs/a.md' })).pass, false);
});
test('deleted owed file cannot count as synchronization', async t => {
  const f = fixture(t); f.write('skills/a/SKILL.md'); f.write('skills/a/SKILL.zh.md'); const base = f.commit();
  f.write('skills/a/SKILL.md', 'changed'); rmSync(join(f.root, 'skills/a/SKILL.zh.md')); f.commit();
  assert.equal((await checkDocSync(f.root, { base, config })).pass, false);
});
test('divergent base changes are excluded by merge-base, not diff base tip', async t => {
  const f = fixture(t); f.git('checkout', '-qb', 'upstream'); f.write('skills/upstream/SKILL.md'); const upstream = f.commit();
  f.git('checkout', '-qb', 'topic', f.base); f.write('unmapped.txt'); f.commit();
  const report = await checkDocSync(f.root, { base: upstream, config });
  assert.equal(report.mergeBase, f.base); assert.equal(report.pass, true); assert.deepEqual(report.changedPaths, ['unmapped.txt']);
});
test('rename source and sibling together is checked without hiding old path', async t => {
  const f = fixture(t); f.write('skills/a/SKILL.md'); f.write('skills/a/SKILL.zh.md'); const base = f.commit();
  f.git('mv', 'skills/a', 'skills/b'); f.commit();
  const report = await checkDocSync(f.root, { base, config });
  // Paired removals at the old location and paired additions at the new location satisfy synchronization.
  assert.equal(report.checks.find(c => c.path === 'skills/b/SKILL.md').status, 'pass');
  assert.equal(report.checks.find(c => c.path === 'skills/a/SKILL.md').status, 'pass');
});
test('CLI loads strict host map and emits a failing machine-readable report without mutation', t => {
  const f = fixture(t); f.write('AGENTS.md', '## supervibe\n\n### doc_sync_map\n\n| change | owes |\n|---|---|\n| `skills/**/SKILL.md` | `{dir}/SKILL.zh.md` |\n');
  f.write('skills/a/SKILL.md'); f.commit();
  const cli = new URL('../scripts/doc-sync.mjs', import.meta.url);
  try { execFileSync(process.execPath, [cli.pathname, '--root', f.root, '--base', f.base], { encoding: 'utf8', stdio: 'pipe' }); assert.fail('must fail'); }
  catch (e) { assert.equal(e.status, 1); assert.equal(JSON.parse(e.stdout).checks[0].status, 'missing-same-commit-doc'); }
  assert.equal(f.git('status', '--porcelain'), '');
});
test('changed then reverted source retains per-commit obligations despite empty net diff', async t => {
  const f = fixture(t); f.write('skills/a/SKILL.md', 'original'); f.write('skills/a/SKILL.zh.md'); const base = f.commit();
  f.write('skills/a/SKILL.md', 'changed'); const change = f.commit();
  f.git('revert', '--no-edit', change);
  const report = await checkDocSync(f.root, { base, config });
  assert.deepEqual(report.changedPaths, []);
  assert.deepEqual(report.historyPaths, ['skills/a/SKILL.md']);
  assert.equal(report.pass, false);
  assert.equal(report.checks[0].missing.length, 2);
});
test('added then deleted source is not erased from the historical path inventory', async t => {
  const f = fixture(t); f.write('skills/transient/SKILL.md'); f.commit();
  rmSync(join(f.root, 'skills/transient/SKILL.md')); f.commit();
  const report = await checkDocSync(f.root, { base: f.base, config });
  assert.deepEqual(report.changedPaths, []);
  assert.equal(report.pass, false);
  assert.equal(report.checks[0].path, 'skills/transient/SKILL.md');
  assert.equal(report.checks[0].commits.length, 2);
});
test('symlink owed documents are neither regular proof nor paired deletions', async t => {
  const f = fixture(t); f.write('skills/a/SKILL.md');
  symlinkSync('/tmp/nonexistent-supervibe-owed-document', join(f.root, 'skills/a/SKILL.zh.md')); f.commit();
  let report = await checkDocSync(f.root, { base: f.base, config });
  assert.equal(report.pass, false);
  const base = f.git('rev-parse', 'HEAD');
  rmSync(join(f.root, 'skills/a/SKILL.md'));
  rmSync(join(f.root, 'skills/a/SKILL.zh.md'));
  symlinkSync('/tmp/another-nonexistent-supervibe-document', join(f.root, 'skills/a/SKILL.zh.md')); f.commit();
  report = await checkDocSync(f.root, { base, config });
  assert.equal(report.pass, false);
});
