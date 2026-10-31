// Shared, fail-closed local runtime storage. Node >= 20, no daemon or dependencies.
import { execFileSync } from 'node:child_process';
import { mkdirSync, lstatSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync, rmSync, realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
export const CAPACITY_STATES = new Set(['reserved', 'active', 'acceptance']);
export const LEDGER_STATES = new Set([...CAPACITY_STATES, 'merged', 'closed', 'cancelled']);
export function commonDir(root) { return realpathSync(execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim()); }
function paths(root) { const dir = join(commonDir(root), 'supervibe'); return { dir, file: join(dir, 'state.json'), lock: join(dir, 'write.lock') }; }
function regular(path) { if (!lstatSync(path).isFile()) throw new Error(`Not a regular ledger file: ${path}`); }
export function validateState(state) {
  if (!state || state.schema !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Number.isSafeInteger(state.wipLimit) || state.wipLimit < 1 || typeof state.mainRef !== 'string' || !state.mainRef || typeof state.sprintsDir !== 'string' || !state.sprintsDir || !state.sprints || Array.isArray(state.sprints) || typeof state.sprints !== 'object' || !Array.isArray(state.events) || !Array.isArray(state.operations)) throw new Error('Corrupt shared ledger schema; stop and repair explicitly');
  if (state.acceptanceWakes !== undefined && (!state.acceptanceWakes || typeof state.acceptanceWakes !== 'object' || Array.isArray(state.acceptanceWakes))) throw new Error('Corrupt shared acceptanceWakes; expected an object');
  if (state.iterationConfigs !== undefined && (!state.iterationConfigs || typeof state.iterationConfigs !== 'object' || Array.isArray(state.iterationConfigs))) throw new Error('Corrupt shared iterationConfigs; expected an object');
  const safeRelative = value => typeof value === 'string' && value && !isAbsolute(value) && !value.split(/[\\/]/).includes('..');
  if (!safeRelative(state.sprintsDir)) throw new Error('Corrupt shared ledger directory');
  for (const [id, e] of Object.entries(state.sprints)) {
    if (!e || e.id !== id || !LEDGER_STATES.has(e.state) || typeof e.document !== 'string' || !e.document || typeof e.branch !== 'string' || !e.branch || typeof e.worktree !== 'string' || !e.worktree || typeof e.epic !== 'string' || !e.epic) throw new Error(`Corrupt shared sprint ${id}`);
    if (!/^[A-Za-z][\w.-]{0,80}$/.test(id) || !safeRelative(e.document) || !isAbsolute(e.worktree)) throw new Error(`Corrupt shared identity/path: ${id}`);
    if (e.state === 'acceptance' && (!e.evidence?.record || !e.evidence?.fingerprint)) throw new Error(`Missing shared acceptance evidence: ${id}`);
    if (['merged', 'closed'].includes(e.state) && !e.landing) throw new Error(`Missing shared landing: ${id}`);
  }
  return state;
}
export function readLedger(root) {
  const p = paths(root);
  try {
    if (!lstatSync(p.dir).isDirectory()) throw new Error('Shared ledger directory must not be a symlink');
    regular(p.file);
    return validateState(JSON.parse(readFileSync(p.file, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Shared ledger missing; run explicit ledger init or import (never fallback to branch scans)');
    throw error;
  }
}
function locked(root, fn) {
  const p = paths(root);
  mkdirSync(p.dir, { recursive: true });
  if (!lstatSync(p.dir).isDirectory()) throw new Error('Shared ledger directory must not be a symlink');
  try { mkdirSync(p.lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Shared ledger locked at ${p.lock}; inspect the owner, never steal or expire a lock automatically`);
    throw error;
  }
  try {
    writeFileSync(join(p.lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return fn(p);
  } finally { rmSync(p.lock, { recursive: true }); }
}
function atomicWrite(p, state) {
  validateState(state);
  const temp = join(p.dir, `state-${randomUUID()}.tmp`);
  let fd;
  try {
    fd = openSync(temp, 'wx', 0o600); writeFileSync(fd, JSON.stringify(state, null, 2) + '\n'); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temp, p.file);
    const directory = openSync(p.dir, 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
export function initializeLedger(root, state) {
  return locked(root, p => {
    try { lstatSync(p.file); throw new Error('Shared ledger already exists; never overwrite it during init/import'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    atomicWrite(p, state); return state;
  });
}
export function changeLedger(root, revision, operation, action, payload, apply) {
  if (!Number.isSafeInteger(revision) || revision < 0 || !operation || !/^[\w.-]{1,128}$/.test(operation)) throw new Error('Mutation requires nonnegative --revision and unique --operation');
  const digest = createHash('sha256').update(JSON.stringify([action, payload])).digest('hex');
  return locked(root, p => {
    const state = readLedger(root);
    const prior = state.operations.find(item => item.operation === operation);
    if (prior) {
      if (prior.digest !== digest) throw new Error('Operation id reused for a different request');
      return { ...state, replayed: true };
    }
    if (state.revision !== revision) throw new Error(`Stale revision ${revision}; shared revision is ${state.revision}; reread before retry`);
    apply(state);
    state.revision++;
    state.events = [...state.events, { revision: state.revision, operation, action, id: payload.id ?? null, at: new Date().toISOString() }].slice(-100);
    state.operations = [...state.operations, { operation, digest, revision: state.revision }].slice(-100);
    atomicWrite(p, state); return state;
  });
}
