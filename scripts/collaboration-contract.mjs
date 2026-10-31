#!/usr/bin/env node
// Contract validation and explicit confirmed-config persistence, never a worker launcher.
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateConfig, validateIterationConfig, iterationConfigFingerprint, readIterationConfig } from './iteration-policy.mjs';
export { validateConfig, validateIterationConfig, iterationConfigFingerprint, readIterationConfig } from './iteration-policy.mjs';
import { snapshot, roadmapSnapshot, frontmatter } from './validate-workflow.mjs';
import { samePath } from './path-identity.mjs';
import { workerEntry, activeWorkers } from './worker-lifecycle.mjs';
import { readHostConfig } from './host-config.mjs';
import { fileURLToPath } from 'node:url';
import { commonDir, readLedger, changeLedger } from './ledger-store.mjs';
import { validateAcceptanceTask, validateAcceptanceResult, registerAcceptanceWake } from './acceptance-worker.mjs';

const fail = message => { throw new Error(message); };
const object = (value, label) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value; };
const text = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a nonempty string`); return value; };
const list = (value, label, nonempty = false) => {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail(`${label} must be ${nonempty ? 'a nonempty' : 'an'} array`);
  value.forEach(item => text(item, label)); return value;
};
export function readConfig(root) {
  const config = readHostConfig(root);
  return validateConfig({ mode: config.collaboration_mode, provider: config.collaboration_provider });
}
// Iteration snapshots are the execution authority; host config is only a proposal.
export function confirmIterationConfig(root, input) {
  const config = validateIterationConfig(input.config);
  return changeLedger(root, input.ledgerRevision, input.operation, 'confirm-iteration-config', config, state => {
    if (state.iterationConfigs !== undefined) object(state.iterationConfigs, 'iterationConfigs');
    if (activeWorkers(state, config.epic).length) fail('Settle active worker executions before changing iteration configuration');
    const previous = state.iterationConfigs && Object.hasOwn(state.iterationConfigs, config.epic) ? validateIterationConfig({ ...state.iterationConfigs[config.epic], independentAcceptance: state.iterationConfigs[config.epic].independentAcceptance === undefined ? false : state.iterationConfigs[config.epic].independentAcceptance }) : undefined;
    if (config.revision !== (previous?.revision ?? 0) + 1) fail('Stale config revision; reuse confirmed config on resume, reconfirm only changes');
    if (previous && config.confirmation.source.trim() === previous.confirmation.source.trim()) fail('Changed config requires fresh user confirmation provenance');
    state.iterationConfigs ??= {};
    state.iterationConfigs[config.epic] = config;
  });
}
function validateWorktree(root, task, allowAccepted, registration = false) {
  const state = readLedger(root), entry = state.sprints[task.sprint];
  if (!entry || !['active', ...(allowAccepted ? ['acceptance'] : [])].includes(entry.state)) fail('Task requires a shared active sprint (result may also be acceptance); no new WIP reservation per subtask');
  if (!isAbsolute(task.worktree)) fail('worktree must be absolute');
  const target = realpathSync(task.worktree);
  if (!samePath(commonDir(target), commonDir(root))) fail('Worker must stay within the same local Git common-dir');
  const canonical = samePath(target, entry.worktree);
  if (!canonical && task.role === 'acceptance') fail('Acceptance must target canonical integrated Sprint carrier');
  const worker = !registration && (state.workerExecutions || !canonical) ? workerEntry(state, task) : undefined;
  if (!canonical && !worker) fail('Child worktree requires registered worker placement under the sprint carrier');
  if (worker && !allowAccepted && worker.state === 'settled') fail('Settled worker cannot receive more work; reserve a new execution');
  let branch;
  try { branch = execFileSync('git', ['-C', target, 'symbolic-ref', '--quiet', '--short', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch { fail('Sprint carrier must be on its registered branch, not detached HEAD'); }
  if (branch !== (canonical ? entry.branch : worker.branch)) fail('Sprint carrier branch differs from shared ledger');
  return target;
}
export function validateTask(root, input, allowAccepted = false, registration = false) {
  const task = object(input, 'task');
  if (task.schema !== 1) fail('Unsupported task schema');
  for (const key of ['taskId', 'objective', 'worktree']) text(task[key], key);
  const state = readLedger(root), roadmap = task.scope === 'roadmap';
  if (task.scope !== undefined && !['sprint', 'roadmap'].includes(task.scope)) fail('Invalid task scope');
  const entry = roadmap ? { epic: text(task.epic, 'epic'), document: text(task.epicDocument, 'epicDocument') } : state.sprints[text(task.sprint, 'sprint')];
  if (!entry) fail('Task requires a shared active sprint');
  if (roadmap && (task.role !== 'acceptance' || task.sprint !== undefined)) fail('Roadmap tasks are acceptance-only, not sprint reservations');
  const config = readIterationConfig(root, entry.epic);
  if (task.iterationConfigFingerprint !== iterationConfigFingerprint(config)) fail('Task iteration config fingerprint mismatch');
  if (task.iterationConfigRevision !== config.revision) fail('Task must reference current confirmed iterationConfigRevision');
  if (task.mode !== config.mode || task.provider !== config.provider) fail('Task mode/provider differs from confirmed iteration configuration');
  if (config.mode === 'native' ? task.workerHarness !== 'inherit' : !config.workerHarnesses.includes(task.workerHarness)) fail('Task workerHarness is not allowed by iteration config');
  list(task.acceptance, 'acceptance', true);
  list(task.allowedPaths, 'allowedPaths', true);
  for (const path of task.allowedPaths) {
    const parts = path.split('/');
    const windowsAlias = process.platform === 'win32' && (path.includes(':') || parts.some(part => part.toLowerCase() === '.git' || (/[. ]$/.test(part) && part !== '.')));
    if (isAbsolute(path) || path.includes('\\') || parts.includes('..') || parts.includes('.git') || windowsAlias) fail('allowedPaths must be repository-relative and outside Git metadata');
  }
  if (!roadmap) validateWorktree(root, task, allowAccepted, registration);
  else {
    if (!registration && state.workerExecutions) {
      const worker = workerEntry(state, task);
      if (!allowAccepted && worker.state === 'settled') fail('Settled worker cannot receive more work; reserve a new execution');
    }
    if (!isAbsolute(task.worktree) || !samePath(commonDir(task.worktree), commonDir(root))) fail('Roadmap worktree must share local Git common-dir');
    if (execFileSync('git', ['-C', task.worktree, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim() !== state.mainRef) fail('Roadmap acceptance requires stored main branch');
    if (frontmatter(readFileSync(resolve(task.worktree, entry.document), 'utf8')).epic !== task.epic) fail('Roadmap epic identity mismatch');
  }
  if (task.role !== undefined && !['development', 'acceptance'].includes(task.role)) fail('Unknown task role');
  if (task.role === 'acceptance' && !config.independentAcceptance) fail('Independent acceptance is disabled; current main agent performs acceptance');
  if (task.role === 'acceptance') validateAcceptanceTask(root, task, config, entry, (roadmap ? roadmapSnapshot(task.worktree, entry.document, task.acceptanceContext?.record, state.mainRef) : snapshot(task.worktree, entry.document, task.acceptanceContext?.record)).fingerprint);
  return { ...task, validation: 'contract-only; backend capability and execution not verified' };
}
export function validateResult(root, input) {
  object(input, 'result envelope');
  const task = validateTask(root, input.task, true), result = object(input.result, 'result');
  if (result.schema !== 1) fail('Unsupported result schema');
  for (const key of ['scope', 'epic', 'epicDocument', 'sprint', 'taskId', 'mode', 'provider', 'workerHarness', 'iterationConfigRevision', 'iterationConfigFingerprint', 'workerExecutionId']) if (result[key] !== task[key]) fail(`Result ${key} does not match task`);
  if (!['succeeded', 'failed', 'blocked'].includes(result.status)) fail('Result status must be succeeded, failed or blocked');
  if (!isAbsolute(text(result.worktree, 'result.worktree'))) fail('result.worktree must be absolute');
  if (!samePath(result.worktree, task.worktree)) fail('Result worktree differs from assigned carrier');
  const execution = object(result.execution, 'execution');
  const identities = task.mode === 'native' ? ['workerId'] : ['runId', 'taskId', 'dispatchId'];
  identities.forEach(key => text(execution[key], `execution.${key}`));
  list(result.evidence, 'evidence', result.status === 'succeeded');
  list(result.blockers, 'blockers', result.status !== 'succeeded');
  if (result.status === 'succeeded' && result.blockers.length) fail('A successful result cannot hide open blockers');
  if (task.role === 'acceptance') validateAcceptanceResult(root, task, result);
  else if (result.role === 'acceptance') fail('Development result cannot be acceptance evidence');
  return { ...result, sprintAccepted: false, validation: 'contract-only; worker success is not sprint acceptance' };
}
export function acceptanceWake(root, input) {
  const task = validateTask(root, input.task, true);
  if (task.role !== 'acceptance') fail('Acceptance wake requires acceptance role');
  return registerAcceptanceWake(root, { ...input, task });
}
export function main(args) {
  if (args.length !== 1 || !['task', 'result', 'config', 'iteration-config', 'confirm-config', 'acceptance-wake'].includes(args[0])) fail('Usage: collaboration-contract.mjs config|iteration-config|confirm-config|acceptance-wake|task|result (JSON stdin except host config)');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const command = args[0];
  const input = command === 'config' ? null : JSON.parse(readFileSync(0, 'utf8'));
  const output = command === 'config' ? readConfig(root) : command === 'iteration-config' ? (() => { const config = readIterationConfig(root, input.epic); return { config, fingerprint: iterationConfigFingerprint(config) }; })() : command === 'confirm-config' ? confirmIterationConfig(root, input) : command === 'acceptance-wake' ? acceptanceWake(root, input) : (command === 'task' ? validateTask : validateResult)(root, input);
  console.log(JSON.stringify(output, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`collaboration contract: ${error.message}`); process.exitCode = 1; }
}
