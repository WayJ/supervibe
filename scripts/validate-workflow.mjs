#!/usr/bin/env node
// Read-only workflow guards. No dependencies; Node >= 20.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLedger, CAPACITY_STATES } from './ledger-store.mjs';
import { acceptancePlan, verifyResults, jsonBlock } from './acceptance-contract.mjs';

const STATES = new Set(['active', 'acceptance', 'merged', 'closed']);
export const IN_FLIGHT = new Set(['active', 'acceptance']);
export const LANDED = new Set(['merged', 'closed']);
const fail = (message) => { throw new Error(message); };
function git(root, ...args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
export function repoPath(root, value) {
  if (!value || isAbsolute(value)) fail('Use a non-empty repository-relative path');
  const path = relative(root, resolve(root, value)).split(sep).join('/');
  if (!path || path === '..' || path.startsWith('../') || path === '.git' || path.startsWith('.git/')) fail('Path must stay inside the repository');
  let parent = root;
  for (const part of path.split('/').slice(0, -1)) {
    parent = resolve(parent, part);
    try {
      if (lstatSync(parent).isSymbolicLink()) fail('Path must not traverse a symlink directory');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return path;
}
export function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) fail('Missing frontmatter');
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (!m) fail(`Unsupported frontmatter line: ${line}`);
    if (Object.hasOwn(data, m[1])) fail(`Duplicate frontmatter key: ${m[1]}`);
    const value = m[2].replace(/\s*<!--.*?-->\s*$/, '').trim();
    data[m[1]] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
  return data;
}
export function sprintData(root, sprint) {
  const file = resolve(root, sprint);
  if (!lstatSync(file).isFile()) fail('Sprint must be a regular file');
  const data = frontmatter(readFileSync(file, 'utf8'));
  if (!data.sprint || !STATES.has(data.state)) fail('Malformed sprint id/state');
  return data;
}
function normalizedSprint(text) {
  // These are the only fields accept writes. Body/scenarios/DoD remain bound.
  return text.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (_, body) =>
    `---\n${body.split(/\r?\n/).filter(l => !/^(state|acceptance-record|accepted-at):/.test(l)).join('\n')}\n---`);
}
function contentSnapshot(root, sprintInput, recordInput, roadmap = false) {
  root = resolve(root);
  const sprint = repoPath(root, sprintInput), record = repoPath(root, recordInput);
  if (sprint === record || !record.endsWith('.md')) fail('Acceptance record must be a separate Markdown file');
  if (git(root, 'ls-files', '--unmerged').trim()) fail('Resolve Git conflicts before acceptance');
  const data = roadmap ? frontmatter(readFileSync(resolve(root, sprint), 'utf8')) : sprintData(root, sprint);
  if (roadmap && (!data.epic || !['open', 'closed'].includes(data.status))) fail('Malformed epic id/status');
  if (!roadmap && !IN_FLIGHT.has(data.state)) fail('Acceptance requires an active or acceptance sprint');
  const names = new Set(git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean));
  if (!names.has(sprint)) fail('Sprint must be tracked or non-ignored');
  const hash = createHash('sha256');
  for (const path of [...names].sort()) {
    if (path === record) continue;
    const full = resolve(root, path);
    let stat;
    try { stat = lstatSync(full); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    let mode, content;
    if (stat.isSymbolicLink()) { mode = '120000'; content = Buffer.from(readlinkSync(full)); }
    else if (stat.isFile()) {
      mode = stat.mode & 0o111 ? '100755' : '100644';
      content = readFileSync(full);
      if (path === sprint) content = Buffer.from(roadmap ? normalizedEpic(content.toString('utf8')) : normalizedSprint(content.toString('utf8')));
    } else fail(`Unsupported entry (including submodule): ${path}`);
    // Length framing avoids path/content ambiguity, including unusual filenames.
    for (const chunk of [Buffer.from(path), Buffer.from(mode), content]) hash.update(`${chunk.length}:`).update(chunk);
  }
  return { schema: 1, sprint, record, fingerprint: hash.digest('hex') };
}
export function snapshot(root, sprintInput, recordInput) { return contentSnapshot(root, sprintInput, recordInput); }
function normalizedEpic(text) {
  return text.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (_, body) =>
    `---\n${body.split(/\r?\n/).filter(l => !/^(status|final-acceptance-record|final-accepted-at):/.test(l)).join('\n')}\n---`);
}
export function roadmapSnapshot(root, epicInput, recordInput, mainRef) {
  root = resolve(root);
  if (!mainRef || mainRef.startsWith('-') || git(root, 'rev-parse', '--symbolic-full-name', mainRef).trim() !== `refs/heads/${mainRef}`) fail('Main ref must be a local branch');
  if (git(root, 'rev-parse', 'HEAD').trim() !== git(root, 'rev-parse', mainRef).trim()) fail('Final acceptance must run on the current integrated main candidate');
  const epic = repoPath(root, epicInput), record = repoPath(root, recordInput);
  if (!lstatSync(resolve(root, epic)).isFile()) fail('Epic must be a regular file');
  const document = readFileSync(resolve(root, epic), 'utf8');
  acceptancePlan(document, 'roadmap');
  const changed = new Set([...git(root, 'diff', '--name-only', '-z', 'HEAD').split('\0'), ...git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean));
  for (const path of changed) {
    if (path === record) continue;
    if (path !== epic || normalizedEpic(document) !== normalizedEpic(git(root, 'show', `HEAD:${epic}`))) fail('Commit integrated inputs and upfront plan before final acceptance');
  }
  const base = contentSnapshot(root, epic, record, true);
  return { schema: 1, scope: 'roadmap', epic, record, mainRef, fingerprint: base.fingerprint };
}
export function roadmapVerify(root, epic, record, mainRef) {
  const current = roadmapSnapshot(root, epic, record, mainRef);
  const document = readFileSync(resolve(root, current.epic), 'utf8'), data = frontmatter(document);
  if (data['final-acceptance-record'] !== current.record) fail('Final acceptance record pointer mismatch');
  if (!data['final-accepted-at'] || Number.isNaN(Date.parse(data['final-accepted-at']))) fail('Missing final acceptance date');
  const recordPath = resolve(root, current.record);
  if (!lstatSync(recordPath).isFile()) fail('Acceptance record must be a regular file');
  const result = readFileSync(recordPath, 'utf8');
  assertPass(result);
  const evidence = jsonBlock(result, 'supervibe-evidence');
  for (const key of Object.keys(current)) if (evidence[key] !== current[key]) fail(`Stale or mismatched roadmap ${key}; rerun integrated acceptance`);
  verifyResults(document, result, 'roadmap', current.fingerprint);
  const sections = [...document.matchAll(/^## Sprint Breakdown\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (sections.length !== 1) fail('Missing or duplicate Sprint Breakdown');
  const rows = sections[0][1].split(/\r?\n/).map(line => line.trimStart()).filter(line => /^\|/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim())).filter(cells => cells[0] !== 'sprint' && !/^[-:]+$/.test(cells[0]));
  if (rows.some(cells => !/^S\d+$/.test(cells[0]) || !['started', 'merged', 'closed'].includes(cells[1]))) fail('Every roadmap stub must be started or historically landed; planned/ready blocks closure');
  const ids = rows.map(cells => cells[0]);
  if (!ids.length || new Set(ids).size !== ids.length) fail('Missing or duplicate sprint stubs');
  const ledger = readLedger(root);
  if (ledger.mainRef !== mainRef) fail('Main ref differs from shared ledger');
  if (Object.values(ledger.sprints).some(s => s.epic === data.epic && s.state !== 'cancelled' && !ids.includes(s.id))) fail('Shared epic sprint missing from breakdown');
  for (const id of ids) {
    const sprint = ledger.sprints[id];
    if (!sprint || sprint.epic !== data.epic || !LANDED.has(sprint.state)) fail(`Roadmap sprint is not landed: ${id}`);
    try { git(root, 'merge-base', '--is-ancestor', sprint.landing, mainRef); } catch { fail(`Sprint landing not reachable from integrated main: ${id}`); }
  }
  return current;
}
export function roadmapVerifyClean(root, epic, record, mainRef) {
  const evidence = roadmapVerify(root, epic, record, mainRef);
  for (const path of [evidence.epic, evidence.record]) {
    if (!git(root, 'ls-files', '-z', '--', path).split('\0').includes(path)) fail('Epic and final acceptance record must be tracked before roadmap close');
  }
  if (git(root, 'status', '--porcelain', '--untracked-files=all').trim()) fail('Commit all integrated inputs and final evidence before roadmap close; candidate must be clean');
  return evidence;
}
function assertPass(text) {
  const verdicts = [...text.matchAll(/^## Verdict\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (verdicts.length !== 1 || !/^\s*pass(?:\s|$|[—-])/.test(verdicts[0][1])) fail('Acceptance verdict is not pass');
}
export function verify(root, sprint, record) {
  const current = snapshot(root, sprint, record);
  const data = sprintData(root, current.sprint);
  if (data.state !== 'acceptance') fail('Sprint is not in acceptance state');
  if (data['acceptance-record'] !== current.record) fail('Acceptance record pointer mismatch');
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(data['accepted-at'] ?? '') || Number.isNaN(Date.parse(data['accepted-at']))) fail('Missing or invalid accepted-at date');
  const file = resolve(root, current.record);
  if (!lstatSync(file).isFile()) fail('Acceptance record must be a regular file');
  const text = readFileSync(file, 'utf8');
  const verdicts = [...text.matchAll(/^## Verdict\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (verdicts.length !== 1 || !/^\s*pass(?:\s|$|[—-])/.test(verdicts[0][1])) fail('Acceptance verdict is not pass');
  const blocks = [...text.matchAll(/^```supervibe-evidence\s*\r?\n([\s\S]*?)^```\s*$/gm)];
  if (blocks.length !== 1) fail('Expected exactly one supervibe-evidence block; reaccept legacy records');
  let evidence;
  try { evidence = JSON.parse(blocks[0][1]); } catch { fail('Malformed acceptance evidence JSON'); }
  for (const key of ['schema', 'sprint', 'record', 'fingerprint']) if (evidence[key] !== current[key]) fail(`Stale or mismatched acceptance ${key}; run accept again`);
  verifyResults(readFileSync(resolve(root, current.sprint), 'utf8'), text, 'sprint', current.fingerprint);
  return current;
}
export function verifyClean(root, sprint, record) {
  const evidence = verify(root, sprint, record);
  for (const path of [evidence.sprint, evidence.record]) {
    if (!git(root, 'ls-files', '-z', '--', path).split('\0').includes(path)) fail('Sprint and acceptance record must be tracked before complete');
  }
  if (git(root, 'status', '--porcelain', '--untracked-files=all').trim()) fail('Commit all reviewed files and acceptance metadata before complete; candidate must be clean');
  return evidence;
}
function linkedWorktrees(root) {
  const records = [];
  let entry = {};
  for (const field of git(root, 'worktree', 'list', '--porcelain', '-z').split('\0')) {
    if (!field) {
      if (entry.worktree) records.push(entry);
      entry = {};
      continue;
    }
    const space = field.indexOf(' ');
    entry[space < 0 ? field : field.slice(0, space)] = space < 0 ? true : field.slice(space + 1);
  }
  if (entry.worktree) records.push(entry);
  return records;
}
export function inspectWorktreeSprints(root, dirInput, limitInput = Number.MAX_SAFE_INTEGER) {
  root = realpathSync(resolve(root));
  const dir = repoPath(root, dirInput);
  const limit = Number(limitInput);
  if (!Number.isSafeInteger(limit) || limit < 1) fail('WIP limit must be a positive integer');
  const commonDir = realpathSync(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim());
  const copies = new Map(), scannedWorktrees = [], missingLedgerDirs = [];
  for (const tree of linkedWorktrees(root)) {
    if (tree.bare) continue;
    if (tree.prunable) fail(`Stale registered worktree: ${tree.worktree}; inspect and repair its registration before starting`);
    let location;
    try { location = realpathSync(tree.worktree); } catch { fail(`Unavailable registered worktree: ${tree.worktree}; restore or reconcile it before starting`); }
    let treeCommon;
    try { treeCommon = realpathSync(git(location, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim()); }
    catch { fail(`Invalid registered worktree: ${tree.worktree}`); }
    if (treeCommon !== commonDir) fail(`Registered worktree belongs to another repository: ${tree.worktree}`);
    // Each copy uses the same host-config-relative ledger path. Directory absence
    // in an older checkout means no ledger there; missing worktrees are NOT ignored.
    repoPath(location, dir);
    const ledgerDir = resolve(location, dir);
    let entries;
    try {
      if (!lstatSync(ledgerDir).isDirectory()) fail(`Ledger path must be a real directory: ${ledgerDir}`);
      entries = readdirSync(ledgerDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' && location !== root) { missingLedgerDirs.push(location); continue; }
      throw error;
    }
    scannedWorktrees.push(location);
    const localIds = new Set();
    for (const entry of entries) {
      if (!entry.name.endsWith('.md')) continue;
      if (!entry.isFile()) fail(`Sprint entry must be a regular file: ${ledgerDir}/${entry.name}`);
      const path = `${dir}/${entry.name}`, data = sprintData(location, path);
      if (localIds.has(data.sprint)) fail(`Duplicate sprint id: ${data.sprint} in ${location}`);
      localIds.add(data.sprint);
      const previous = copies.get(data.sprint);
      const identity = JSON.stringify([path, data.epic ?? null, data.worktree ?? null]);
      if (previous && previous.identity !== identity) fail(`Conflicting copies of sprint ${data.sprint}: ${previous.locations[0]} and ${location}; reconcile duplicate paths/ownership`);
      if (previous) {
        previous.inFlight ||= IN_FLIGHT.has(data.state);
        previous.locations.push(location);
      } else copies.set(data.sprint, { identity, data, document: path, inFlight: IN_FLIGHT.has(data.state), locations: [location] });
    }
  }
  if (!scannedWorktrees.includes(root)) fail('Current worktree ledger directory was not scanned');
  const inFlight = [...copies].filter(([, data]) => data.inFlight).map(([id]) => id).sort();
  if (inFlight.length >= limit) fail(`WIP limit ${limit} reached across linked worktrees: ${inFlight.join(', ')}`);
  return { limit, count: inFlight.length, inFlight, scannedWorktrees, missingLedgerDirs, entries: [...copies.values()] };
}
export function checkWip(root, dirInput, limitInput) {
  const state = readLedger(root);
  if (state.sprintsDir !== repoPath(resolve(root), dirInput) || state.wipLimit !== Number(limitInput)) fail('Host configuration differs from shared ledger; reconcile explicitly');
  const inFlight = Object.values(state.sprints).filter(e => CAPACITY_STATES.has(e.state)).map(e => e.id).sort();
  if (inFlight.length >= state.wipLimit) fail(`Shared WIP limit ${state.wipLimit} reached: ${inFlight.join(', ')}`);
  return { revision: state.revision, limit: state.wipLimit, count: inFlight.length, inFlight };
}
export function main(args) {
  const [command, ...rest] = args, options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    if (!key?.startsWith('--') || !rest[i + 1] || Object.hasOwn(options, key)) fail('Expected unique --option value pairs');
    options[key] = rest[i + 1];
  }
  const roadmap = ['roadmap-snapshot', 'roadmap-verify', 'roadmap-verify-clean'].includes(command);
  const expected = roadmap ? ['--epic', '--record', '--main-ref'] : command === 'wip' ? ['--sprints-dir', '--limit'] : ['--sprint', '--record'];
  if (!['snapshot', 'verify', 'verify-clean', 'wip', 'roadmap-snapshot', 'roadmap-verify', 'roadmap-verify-clean'].includes(command) || Object.keys(options).some(k => !expected.includes(k)) || expected.some(k => !options[k])) fail('Usage: snapshot|verify|verify-clean --sprint PATH --record PATH; roadmap-snapshot|roadmap-verify|roadmap-verify-clean --epic PATH --record PATH --main-ref BRANCH; wip --sprints-dir PATH --limit N');
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel').trim();
  const result = roadmap ? (command === 'roadmap-snapshot' ? roadmapSnapshot : command === 'roadmap-verify-clean' ? roadmapVerifyClean : roadmapVerify)(root, options['--epic'], options['--record'], options['--main-ref']) : command === 'wip' ? checkWip(root, options['--sprints-dir'], options['--limit']) : (command === 'verify-clean' ? verifyClean : command === 'verify' ? verify : snapshot)(root, options['--sprint'], options['--record']);
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`workflow guard: ${error.message}`); process.exitCode = 1; }
}
