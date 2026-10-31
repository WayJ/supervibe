#!/usr/bin/env node
// Read-only mechanical precheck. Passing does not prove document correctness.
import { execFileSync } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateDocSyncRule, globMatch } from './doc-sync-rules.mjs';

function git(root, ...args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function literalPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(p => !p || ['.', '..', '.git'].includes(p))) throw new Error('Expected repository-relative task/epic path without traversal');
  return path;
}
export async function checkDocSync(root, { base, tip = 'HEAD', taskPaths = [], epicDocument, config } = {}) {
  root = resolve(root);
  if (typeof base !== 'string' || !base || typeof tip !== 'string' || !tip) throw new Error('Explicit --base and valid --tip are required');
  const revision = ref => git(root, 'rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`).trim();
  const baseCommit = revision(base), tipCommit = revision(tip);
  const bases = git(root, 'merge-base', '--all', baseCommit, tipCommit).trim().split('\n').filter(Boolean);
  if (bases.length !== 1) throw new Error('Expected a unique merge-base; resolve ambiguous history first');
  const mergeBase = bases[0];
  if (!Array.isArray(taskPaths)) throw new Error('taskPaths must be an array');
  taskPaths.forEach(literalPath);
  if (epicDocument !== undefined) literalPath(epicDocument);
  config ??= (await import('./host-config.mjs')).readHostConfig(root);
  if (!Array.isArray(config.doc_sync_map)) throw new Error('doc_sync_map must be an array');
  const rules = config.doc_sync_map.map(validateDocSyncRule);
  const changedPaths = git(root, 'diff', '--name-only', '-z', '--no-renames', mergeBase, tipCommit, '--').split('\0').filter(Boolean);
  const commits = git(root, 'rev-list', '--reverse', `${mergeBase}..${tipCommit}`, '--').trim().split('\n').filter(Boolean).map(commit => ({
    commit, paths: git(root, 'show', '--format=', '--name-only', '-z', '--no-renames', '--diff-merges=first-parent', commit, '--').split('\0').map(p => p.replace(/^\n+/, '')).filter(Boolean)
  }));
  // A net tree diff hides changed-then-reverted paths. Per-commit obligations
  // apply to the full history, including additions/deletions and both rename ends.
  const historyPaths = [...new Set(commits.flatMap(c => c.paths))].sort();
  const paths = [...new Set([...changedPaths, ...historyPaths, ...taskPaths])].sort();
  const checks = [];
  for (const path of paths) for (const rule of rules) {
    if (!globMatch(rule.change, path)) continue;
    let owed = rule.owes, matchesOwed = p => globMatch(owed, p);
    if (owed === '{epic}') {
      if (!epicDocument) throw new Error('Matching {epic} rule requires explicit --epic-document');
      owed = epicDocument; matchesOwed = p => p === epicDocument;
    } else if (owed.startsWith('{dir}/')) {
      const dir = posix.dirname(path);
      const prefix = dir === '.' ? '' : `${dir}/`, suffix = owed.slice(6);
      owed = prefix + suffix; matchesOwed = p => p.startsWith(prefix) && globMatch(suffix, p.slice(prefix.length));
    }
    const touching = commits.filter(c => c.paths.includes(path));
    const modeAt = (commit, p) => {
      const entry = git(root, 'ls-tree', '-z', commit, '--', `:(literal)${p}`);
      return entry ? entry.split(' ', 1)[0] : null;
    };
    const regular = mode => mode === '100644' || mode === '100755';
    const missing = touching.filter(c => !c.paths.some(p => p !== path && matchesOwed(p) && (
      (regular(modeAt(c.commit, p)) && regular(modeAt(tipCommit, p))) ||
      (modeAt(c.commit, path) === null && modeAt(tipCommit, path) === null &&
       modeAt(c.commit, p) === null && modeAt(tipCommit, p) === null)
    ))).map(c => c.commit);
    checks.push({ path, owed, status: !touching.length ? 'no-source-commit' : missing.length ? 'missing-same-commit-doc' : 'pass', commits: touching.map(c => c.commit), missing });
  }
  return { schema: 1, pass: checks.every(c => c.status === 'pass'), mergeBase, tip: tipCommit, changedPaths, historyPaths, taskPaths, checks, semanticReviewRequired: true, limitation: 'Only committed path cochanges are checked; document meaning and uncommitted edits are not validated.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2), options = { taskPaths: [] }, seen = new Set(); let root = process.cwd();
    while (args.length) {
      const flag = args.shift(), value = args.shift();
      if (!value || !['--root', '--base', '--tip', '--task-path', '--epic-document'].includes(flag)) throw new Error('Usage: doc-sync.mjs --base REF [--tip REF] [--root DIR] [--task-path PATH ...] [--epic-document PATH]');
      if (flag !== '--task-path' && seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
      seen.add(flag);
      if (flag === '--root') root = value;
      else if (flag === '--task-path') options.taskPaths.push(value);
      else options[flag === '--epic-document' ? 'epicDocument' : flag.slice(2)] = value;
    }
    const report = await checkDocSync(root, options); console.log(JSON.stringify(report, null, 2));
    if (!report.pass) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
