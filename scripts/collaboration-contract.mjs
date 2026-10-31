#!/usr/bin/env node
// Read-only contract validation, not a worker launcher or capability detector.
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { commonDir, readLedger } from './ledger-store.mjs';

const fail = message => { throw new Error(message); };
const object = (value, label) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value; };
const text = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a nonempty string`); return value; };
const list = (value, label, nonempty = false) => {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail(`${label} must be ${nonempty ? 'a nonempty' : 'an'} array`);
  value.forEach(item => text(item, label)); return value;
};
export function validateConfig(config) {
  object(config, 'config');
  if (!['native', 'external'].includes(config.mode)) fail('Select collaboration_mode native or external explicitly; no fallback');
  if ((config.mode === 'native' && config.provider !== 'harness') || (config.mode === 'external' && config.provider !== 'orca')) fail('Supported pairs: native/harness or external/orca');
  return { mode: config.mode, provider: config.provider };
}
export function readConfig(root) {
  const source = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
  const sections = [...source.matchAll(/^## supervibe\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (sections.length !== 1) fail('Expected exactly one host ## supervibe section');
  const get = key => {
    const hits = [...sections[0][1].matchAll(new RegExp(`^- ${key}:\\s*([^\\r\\n]*)`, 'gm'))];
    if (hits.length !== 1) fail(`Declare exactly one ${key} in host ## supervibe`);
    return hits[0][1].replace(/\s*<!--.*?-->\s*$/, '').trim();
  };
  return validateConfig({ mode: get('collaboration_mode'), provider: get('collaboration_provider') });
}
function validateWorktree(root, task, allowAccepted) {
  const state = readLedger(root), entry = state.sprints[task.sprint];
  if (!entry || !['active', ...(allowAccepted ? ['acceptance'] : [])].includes(entry.state)) fail('Task requires a shared active sprint (result may also be acceptance); no new WIP reservation per subtask');
  if (!isAbsolute(task.worktree)) fail('worktree must be absolute');
  const target = realpathSync(task.worktree);
  if (commonDir(target) !== commonDir(root)) fail('Worker must stay within the same local Git common-dir');
  if (target !== realpathSync(entry.worktree)) fail('Worker placement must match the sprint carrier; a separate carrier needs its own sprint reservation');
  let branch;
  try { branch = execFileSync('git', ['-C', target, 'symbolic-ref', '--quiet', '--short', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch { fail('Sprint carrier must be on its registered branch, not detached HEAD'); }
  if (branch !== entry.branch) fail('Sprint carrier branch differs from shared ledger');
  return target;
}
export function validateTask(root, input, allowAccepted = false) {
  const task = object(input, 'task'), config = readConfig(root);
  if (task.schema !== 1) fail('Unsupported task schema');
  for (const key of ['sprint', 'taskId', 'objective', 'worktree']) text(task[key], key);
  if (task.mode !== config.mode || task.provider !== config.provider) fail('Task mode/provider differs from selected host configuration');
  list(task.acceptance, 'acceptance', true);
  list(task.allowedPaths, 'allowedPaths', true);
  for (const path of task.allowedPaths) {
    if (isAbsolute(path) || path.includes('\\') || path.split('/').includes('..') || path.split('/').includes('.git')) fail('allowedPaths must be repository-relative and outside Git metadata');
  }
  validateWorktree(root, task, allowAccepted);
  return { ...task, validation: 'contract-only; backend capability and execution not verified' };
}
export function validateResult(root, input) {
  object(input, 'result envelope');
  const task = validateTask(root, input.task, true), result = object(input.result, 'result');
  if (result.schema !== 1) fail('Unsupported result schema');
  for (const key of ['sprint', 'taskId', 'mode', 'provider']) if (result[key] !== task[key]) fail(`Result ${key} does not match task`);
  if (!['succeeded', 'failed', 'blocked'].includes(result.status)) fail('Result status must be succeeded, failed or blocked');
  if (!isAbsolute(text(result.worktree, 'result.worktree'))) fail('result.worktree must be absolute');
  if (realpathSync(result.worktree) !== realpathSync(task.worktree)) fail('Result worktree differs from assigned carrier');
  const execution = object(result.execution, 'execution');
  const identities = task.mode === 'native' ? ['workerId'] : ['runId', 'taskId', 'dispatchId'];
  identities.forEach(key => text(execution[key], `execution.${key}`));
  list(result.evidence, 'evidence', result.status === 'succeeded');
  list(result.blockers, 'blockers', result.status !== 'succeeded');
  if (result.status === 'succeeded' && result.blockers.length) fail('A successful result cannot hide open blockers');
  return { ...result, sprintAccepted: false, validation: 'contract-only; worker success is not sprint acceptance' };
}
export function main(args) {
  if (args.length !== 1 || !['task', 'result', 'config'].includes(args[0])) fail('Usage: collaboration-contract.mjs config|task|result (JSON stdin for task/result)');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const command = args[0];
  const output = command === 'config' ? readConfig(root) : (command === 'task' ? validateTask : validateResult)(root, JSON.parse(readFileSync(0, 'utf8')));
  console.log(JSON.stringify(output, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`collaboration contract: ${error.message}`); process.exitCode = 1; }
}
