#!/usr/bin/env node
import { samePath } from './path-identity.mjs';
import { activeWorkers } from './worker-lifecycle.mjs';
import { execFileSync } from 'node:child_process';
import { realpathSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLedger, initializeLedger, changeLedger, commonDir, CAPACITY_STATES } from './ledger-store.mjs';
import { repoPath, sprintData, frontmatter, verifyClean, inspectWorktreeSprints } from './validate-workflow.mjs';
import { acceptancePlan } from './acceptance-contract.mjs';
const fail = message => { throw new Error(message); };
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function projectionIdentity(data, e) { return data.sprint === e.id && data.epic === e.epic && (data.worktree === e.branch || (typeof data.worktree === 'string' && isAbsolute(data.worktree) && samePath(data.worktree, e.worktree, { allowMissing: true }))); }
function carrier(root, e) {
  let target;
  try { target = realpathSync(e.worktree); } catch { fail(`Missing carrier for ${e.id}: ${e.worktree}; reconcile explicitly`); }
  if (!samePath(commonDir(target), commonDir(root)) || git(target, 'symbolic-ref', '--short', 'HEAD') !== e.branch) fail(`Wrong carrier repository/branch for ${e.id}`);
  repoPath(target, e.document);
  return target;
}
function mainProjection(root, state, entry) {
  repoPath(root, entry.document);
  return frontmatter(git(root, 'show', `refs/heads/${state.mainRef}:${entry.document}`));
}
export function doctor(root, state = readLedger(root)) {
  for (const e of Object.values(state.sprints)) {
    if (['reserved', 'cancelled'].includes(e.state)) continue; // Holds capacity even if interrupted before creation.
    const data = CAPACITY_STATES.has(e.state) ? sprintData(carrier(root, e), e.document) : mainProjection(root, state, e);
    if (!projectionIdentity(data, e) || data.state !== e.state || (['merged', 'closed'].includes(e.state) && data['merged-commit'] !== e.landing)) fail(`Projection mismatch for ${e.id}: shared ${e.state}, document ${data.state}; repair projection from shared state, never import over it`);
  }
  return { revision: state.revision, ok: true };
}
export function checkAcceptance(root, id) {
  const state = readLedger(root), e = state.sprints[id];
  if (!e || e.state !== 'acceptance') fail('Shared acceptance is required before merge');
  const target = carrier(root, e), current = verifyClean(target, e.document, e.evidence.record);
  if (current.fingerprint !== e.evidence.fingerprint || git(target, 'rev-parse', 'HEAD') !== e.evidence.commit) fail('Candidate differs from shared acceptance; review again');
  return { revision: state.revision, id, commit: e.evidence.commit, tree: e.evidence.tree };
}
export function initialize(root, sprintsDir, limit, importing = false, mainRef = 'main') {
  const dir = repoPath(root, sprintsDir), wipLimit = Number(limit);
  if (!Number.isSafeInteger(wipLimit) || wipLimit < 1) fail('Limit must be a positive integer');
  git(root, 'check-ref-format', '--branch', mainRef);
  git(root, 'rev-parse', '--verify', `refs/heads/${mainRef}^{commit}`);
  const found = inspectWorktreeSprints(root, dir);
  if (found.entries.length && !importing) fail('Existing sprint documents require explicit import, not empty initialization');
  const state = { schema: 1, revision: 0, wipLimit, mainRef, sprintsDir: dir, sprints: {}, events: [], operations: [] };
  for (const item of found.entries) {
    const d = item.data;
    if (!/^[A-Za-z][\w.-]{0,80}$/.test(d.sprint) || !d.epic || !d.worktree) fail(`Import requires explicit id, epic and carrier identity for ${d.sprint}`);
    const copies = item.locations.map(location => ({ location, data: sprintData(location, item.document) }));
    if (copies.some(c => c.data.state !== d.state)) fail(`Conflicting import states for ${d.sprint}; resolve explicitly before import`);
    if (d.state === 'acceptance') fail(`Legacy acceptance ${d.sprint} requires explicit revocation to active and fresh shared review; import never trusts old pass`);
    let owners = [];
    for (const location of item.locations) {
      const branch = git(location, 'symbolic-ref', '--short', 'HEAD');
      if (d.worktree === branch || (isAbsolute(d.worktree) && samePath(d.worktree, location, { allowMissing: true }))) owners.push({ location, branch });
    }
    if (d.state === 'active' && owners.length !== 1) fail(`Ambiguous import carrier for ${d.sprint}; use its exact branch or absolute worktree in the document`);
    const owner = owners[0] ?? { location: root, branch: d.worktree };
    const e = { id: d.sprint, epic: d.epic, document: item.document, branch: owner.branch, worktree: owner.location, state: d.state, evidence: null, landing: null };
    if (['merged', 'closed'].includes(d.state)) {
      const hash = d['merged-commit'];
      if (!/^[a-f0-9]{40,64}$/.test(hash ?? '')) fail(`Missing import landing for ${d.sprint}`);
      git(root, 'merge-base', '--is-ancestor', hash, `refs/heads/${mainRef}`); e.landing = hash;
    }
    state.sprints[e.id] = e;
  }
  if (Object.values(state.sprints).filter(e => CAPACITY_STATES.has(e.state)).length > wipLimit) fail('Imported work exceeds WIP limit; choose an explicit matching limit');
  return initializeLedger(root, state);
}
export function mutate(root, command, options) {
  const id = options['--id'];
  if (!/^[A-Za-z][\w.-]{0,80}$/.test(id ?? '')) fail('A valid --id is required');
  const payload = Object.fromEntries(Object.entries(options).filter(([k]) => !['--revision', '--operation'].includes(k)));
  payload.id = id;
  return changeLedger(root, Number(options['--revision']), options['--operation'], command, payload, state => {
    let e = Object.hasOwn(state.sprints, id) ? state.sprints[id] : null;
    if (command === 'reserve') {
      if (e) fail(`Sprint ${id} already exists; no id reuse`);
      doctor(root, state);
      if (Object.values(state.sprints).filter(s => CAPACITY_STATES.has(s.state)).length >= state.wipLimit) fail('Shared WIP limit reached; reservation remains blocked');
      const epic = options['--epic'], branch = options['--branch'], worktree = options['--worktree'];
      const document = repoPath(root, options['--document']);
      if (!epic || !branch || !isAbsolute(worktree ?? '') || !document.startsWith(`${state.sprintsDir}/`)) fail('Reserve requires epic, branch, absolute worktree and document within sprintsDir');
      git(root, 'check-ref-format', '--branch', branch);
      if (Object.values(state.sprints).some(s => samePath(resolve(root, s.document), resolve(root, document), { allowMissing: true }) || s.branch === branch || samePath(s.worktree, resolve(worktree), { allowMissing: true }))) fail('Sprint document/branch/carrier already reserved');
      state.sprints[id] = { id, epic, document, branch, worktree: resolve(worktree), state: 'reserved', evidence: null, landing: null };
      return;
    }
    if (!e) fail(`Unknown shared sprint ${id}`);
    if (command === 'cancel-reservation') {
      if (e.state !== 'reserved') fail('cancel-reservation requires reserved; active work cannot be released');
      try { lstatSync(e.worktree); fail('Reservation carrier path exists; reconcile before cancellation'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      try { git(root, 'show-ref', '--verify', '--quiet', `refs/heads/${e.branch}`); fail('Reservation branch exists; reconcile before cancellation'); }
      catch (error) { if (error.status !== 1) throw error; }
      const registered = git(root, 'worktree', 'list', '--porcelain', '-z').split('\0');
      if (registered.some(field => field.startsWith('worktree ') && samePath(field.slice(9), e.worktree, { allowMissing: true }))) fail('Reservation has a registered worktree; reconcile before cancellation');
      e.state = 'cancelled';
    } else if (command === 'activate') {
      if (e.state !== 'reserved') fail('activate requires reserved');
      const target = carrier(root, e), d = sprintData(target, e.document);
      if (!projectionIdentity(d, e) || d.state !== 'active') fail('Carrier needs matching active sprint projection before activate');
      acceptancePlan(readFileSync(resolve(target, e.document), 'utf8'), 'sprint');
      e.state = 'active';
    } else if (command === 'review-begin') {
      if (!['active', 'acceptance'].includes(e.state)) fail('review-begin requires active or acceptance');
      carrier(root, e); e.state = 'active'; e.evidence = null;
    } else if (command === 'review-pass') {
      if (e.state !== 'active') fail('review-pass requires active');
      const target = carrier(root, e), d = sprintData(target, e.document);
      if (!projectionIdentity(d, e)) fail('Wrong sprint projection');
      const evidence = verifyClean(target, e.document, d['acceptance-record']);
      e.evidence = { ...evidence, commit: git(target, 'rev-parse', 'HEAD'), tree: git(target, 'rev-parse', 'HEAD^{tree}') };
      e.state = 'acceptance';
    } else if (command === 'review-blocked') {
      if (e.state !== 'active') fail('review-blocked requires active');
      const d = sprintData(carrier(root, e), e.document);
      if (!projectionIdentity(d, e) || d.state !== 'active') fail('Blocked review requires active projection');
      e.evidence = null;
    } else if (command === 'land') {
      if (e.state !== 'acceptance') fail('land requires shared acceptance');
      if (activeWorkers(state, e.epic).some(worker => worker.sprint === e.id)) fail('Settle active child worker executions before landing Sprint; unknown liveness keeps WIP');
      const landing = options['--landing'], main = options['--main'];
      if (!/^[a-f0-9]{40,64}$/.test(landing ?? '') || !main) fail('land requires full --landing commit and --main ref');
      if (main !== state.mainRef) fail('Landing target differs from the approved shared mainRef');
      git(root, 'merge-base', '--is-ancestor', landing, `refs/heads/${state.mainRef}`);
      if (git(root, 'rev-parse', `${landing}^{tree}`) !== e.evidence.tree) fail('Landing tree differs from shared accepted tree; do not mark merged');
      e.state = 'merged'; e.landing = landing;
    } else if (command === 'close') {
      if (e.state !== 'merged') fail('close requires merged');
      const d = mainProjection(root, state, e);
      if (!projectionIdentity(d, e) || d.state !== 'merged' || d['merged-commit'] !== e.landing) fail('Repair merged projection and landing before close');
      e.state = 'closed';
    } else fail(`Unknown ledger mutation: ${command}`);
  });
}
export function main(args) {
  const [command, ...rest] = args, options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || !rest[i + 1] || Object.hasOwn(options, rest[i])) fail('Expected unique --option value pairs');
    options[rest[i]] = rest[i + 1];
  }
  const common = ['--id', '--revision', '--operation'];
  const fields = { init: ['--sprints-dir', '--limit'], import: ['--sprints-dir', '--limit'], status: [], doctor: [], check: ['--id'], reserve: [...common, '--epic', '--document', '--branch', '--worktree'], activate: common, 'cancel-reservation': common, 'review-begin': common, 'review-pass': common, 'review-blocked': common, land: [...common, '--landing', '--main'], close: common };
  if (!fields[command] || fields[command].some(k => !options[k]) || Object.keys(options).some(k => !fields[command].includes(k) && !(['init', 'import'].includes(command) && k === '--main'))) fail('Commands: init/import --sprints-dir PATH --limit N; status; doctor; reserve/activate/review-begin/review-pass/review-blocked/land/close (see docs/shared-ledger.md)');
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const result = command === 'status' ? readLedger(root) : command === 'doctor' ? doctor(root) : command === 'check' ? checkAcceptance(root, options['--id']) : ['init', 'import'].includes(command) ? initialize(root, options['--sprints-dir'], options['--limit'], command === 'import', options['--main'] ?? 'main') : mutate(root, command, options);
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`shared ledger: ${error.message}`); process.exitCode = 1; }
}
