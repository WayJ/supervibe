import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initialize, mutate } from '../scripts/shared-ledger.mjs';
import { readLedger } from '../scripts/ledger-store.mjs';
import { repoPath } from '../scripts/validate-workflow.mjs';
import { planBlock } from './acceptance-fixtures.mjs';

function setup(t) {
  const base = mkdtempSync(join(tmpdir(), 'supervibe-path-policy-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'Repo With Spaces'), worktree = join(base, 'Carrier With Spaces');
  mkdirSync(root);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'core.autocrlf', 'false');
  mkdirSync(join(root, 'sprints')); writeFileSync(join(root, 'sprints', '.gitkeep'), '');
  git('add', '.'); git('commit', '-m', 'base');
  initialize(root, 'sprints', 3);
  const options = (id, extra = {}) => ({ '--id': id, '--revision': String(readLedger(root).revision), '--operation': `${id}-${readLedger(root).revision}`, ...extra });
  const reserve = (id = 'S1', extra = {}) => mutate(root, 'reserve', options(id, { '--epic': 'E1', '--document': `sprints/${id}.md`, '--branch': `sprint/${id}`, '--worktree': worktree, ...extra }));
  return { root, worktree, git, options, reserve };
}

test('missing but Git-registered carrier cannot be cancelled even without its branch', t => {
  const f = setup(t); f.reserve();
  f.git('worktree', 'add', '-b', 'sprint/S1', f.worktree);
  rmSync(f.worktree, { recursive: true, force: true });
  f.git('update-ref', '-d', 'refs/heads/sprint/S1');
  assert.throws(() => mutate(f.root, 'cancel-reservation', f.options('S1')), /registered worktree/);
  assert.equal(readLedger(f.root).sprints.S1.state, 'reserved');
  assert.equal(readLedger(f.root).revision, 1);
});

test('Windows repository paths reject drive-relative, alternate-stream and .git aliases', { skip: process.platform !== 'win32' }, t => {
  const f = setup(t);
  for (const path of ['D:escape.md', 'C:escape.md', 'sprints/file.md:stream', '.GIT/config', '.git./config', '.git /config']) {
    assert.throws(() => repoPath(f.root, path), /repository-relative|inside the repository/);
  }
  assert.equal(repoPath(f.root, 'sprints\\S1.md'), 'sprints/S1.md');
});

test('Windows reserves cannot alias an existing carrier or document by case', { skip: process.platform !== 'win32' }, t => {
  const f = setup(t); f.reserve();
  assert.throws(() => f.reserve('S2', { '--worktree': f.worktree.toUpperCase().replaceAll('\\', '/') }), /already reserved/);
  assert.throws(() => f.reserve('S2', { '--document': 'sprints/s1.md', '--worktree': f.worktree + '-other' }), /already reserved/);
  assert.equal(readLedger(f.root).revision, 1);
});

test('Windows absolute projection identity accepts Git slash and case aliases', { skip: process.platform !== 'win32' }, t => {
  const f = setup(t); f.reserve();
  f.git('worktree', 'add', '-b', 'sprint/S1', f.worktree);
  writeFileSync(join(f.worktree, 'sprints', 'S1.md'), `---\nsprint: S1\nepic: E1\nstate: active\nworktree: ${f.worktree.toUpperCase().replaceAll('\\', '/')}\n---\n` + planBlock());
  mutate(f.root, 'activate', f.options('S1'));
  assert.equal(readLedger(f.root).sprints.S1.state, 'active');
});
