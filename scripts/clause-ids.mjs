#!/usr/bin/env node
// ID allocation only: clause bodies and discharge evidence remain in sprint Markdown.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLedger, changeLedger } from './ledger-store.mjs';
import { inspectWorktreeSprints, repoPath } from './validate-workflow.mjs';

function validOperation(value) { return typeof value === 'string' && /^[\w.-]{1,128}$/.test(value); }
function namespace(state, required = true) {
  const n = state.clauseIds;
  if (n === undefined && !required) return undefined;
  if (n === undefined) throw new Error('Clause IDs not bootstrapped; explicitly bootstrap with legacy writers quiescent');
  const bad = () => { throw new Error('Corrupt clauseIds namespace; stop and repair explicitly'); };
  if (!n || n.schema !== 1 || !Number.isSafeInteger(n.floor) || n.floor < 0 || !Number.isSafeInteger(n.highWater) || n.highWater < n.floor || !validOperation(n.bootstrapOperation) || !Array.isArray(n.reservations) || n.highWater - n.floor !== n.reservations.length) bad();
  const operations = new Set([n.bootstrapOperation]);
  n.reservations.forEach((r, index) => {
    if (!r || r.id !== `HC${n.floor + index + 1}` || typeof r.issuer !== 'string' || !/^[A-Za-z][\w.-]{0,80}$/.test(r.issuer) || !validOperation(r.operation) || operations.has(r.operation)) bad();
    operations.add(r.operation);
  });
  return n;
}
function request(revision, operation) {
  if (!Number.isSafeInteger(revision) || revision < 0 || !validOperation(operation)) throw new Error('Requires nonnegative --revision and unique --operation');
}
function highWater(root, state) {
  const inspection = inspectWorktreeSprints(root, state.sprintsDir);
  if (inspection.missingLedgerDirs.length) throw new Error('Missing sprint directory in a registered worktree; restore it before bootstrap');
  let max = 0;
  function scan(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error(`Symlink in sprint directory: ${path}`);
      if (item.isDirectory()) { scan(path); continue; }
      if (!item.name.endsWith('.md')) continue;
      if (!lstatSync(path).isFile()) throw new Error(`Unreadable sprint document: ${path}`);
      for (const match of readFileSync(path, 'utf8').matchAll(/\bHC(\d+)\b/g)) {
        const number = Number(match[1]);
        if (!Number.isSafeInteger(number)) throw new Error(`Unsafe HC number in ${path}`);
        max = Math.max(max, number);
      }
    }
  }
  for (const tree of inspection.scannedWorktrees) scan(resolve(tree, repoPath(tree, state.sprintsDir)));
  return max;
}
export function bootstrap(root, revision, operation, confirmQuiescent = false) {
  request(revision, operation);
  if (confirmQuiescent !== true) throw new Error('Bootstrap requires --confirm-quiescent: stop legacy clause writers first');
  const current = readLedger(root), previous = namespace(current, false);
  if (previous) {
    if (previous.bootstrapOperation !== operation) throw new Error('Clause IDs already bootstrapped; never reset the counter');
    return { revision: current.revision, highWater: previous.highWater, replayed: true };
  }
  const state = changeLedger(root, revision, operation, 'clause-bootstrap', {}, state => {
    if (namespace(state, false)) throw new Error('Clause IDs already bootstrapped');
    const floor = highWater(root, state);
    state.clauseIds = { schema: 1, floor, highWater: floor, bootstrapOperation: operation, reservations: [] };
  });
  return { revision: state.revision, highWater: namespace(state).highWater, replayed: !!state.replayed };
}
export function reserve(root, revision, operation, issuer) {
  request(revision, operation);
  if (typeof issuer !== 'string' || !/^[A-Za-z][\w.-]{0,80}$/.test(issuer)) throw new Error('Requires valid --issuer sprint ID');
  const current = readLedger(root), n = namespace(current);
  const prior = n.reservations.find(r => r.operation === operation);
  if (prior) {
    if (prior.issuer !== issuer) throw new Error('Operation id reused for a different request');
    return { ...prior, revision: current.revision, replayed: true };
  }
  if (n.bootstrapOperation === operation) throw new Error('Operation id reused for a different request');
  const state = changeLedger(root, revision, operation, 'clause-reserve', { issuer }, state => {
    const ids = namespace(state);
    if (!Object.hasOwn(state.sprints, issuer) || !['reserved', 'active'].includes(state.sprints[issuer].state)) throw new Error('Issuer must be a shared-ledger reserved or active sprint');
    if (ids.highWater === Number.MAX_SAFE_INTEGER) throw new Error('Clause ID range exhausted');
    ids.highWater++;
    ids.reservations.push({ id: `HC${ids.highWater}`, issuer, operation });
  });
  const result = namespace(state).reservations.find(r => r.operation === operation);
  if (!result || result.issuer !== issuer) throw new Error('Operation does not identify a clause reservation');
  return { ...result, revision: state.revision, replayed: !!state.replayed };
}
export function status(root) {
  const state = readLedger(root), ids = namespace(state);
  return { revision: state.revision, ...ids };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      const key = args[i];
      if (!['--revision', '--operation', '--issuer', '--confirm-quiescent'].includes(key) || Object.hasOwn(options, key)) throw new Error(`Unknown/duplicate option: ${key}`);
      if (key === '--confirm-quiescent') options[key] = true;
      else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value: ${key}`); options[key] = args[++i]; }
    }
    const allowed = command === 'status' ? [] : command === 'bootstrap' ? ['--revision', '--operation', '--confirm-quiescent'] : command === 'reserve' ? ['--revision', '--operation', '--issuer'] : null;
    if (!allowed || Object.keys(options).some(key => !allowed.includes(key))) throw new Error('Usage: clause-ids.mjs status | bootstrap --revision N --operation OP --confirm-quiescent | reserve --issuer S1 --revision N --operation OP');
    const revision = /^\d+$/.test(options['--revision'] ?? '') ? Number(options['--revision']) : NaN;
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const result = command === 'status' ? status(root) : command === 'bootstrap' ? bootstrap(root, revision, options['--operation'], options['--confirm-quiescent']) : reserve(root, revision, options['--operation'], options['--issuer']);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
