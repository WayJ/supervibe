// Bounded receipt checks only: no launcher, scheduler, resource locks or live attestation.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readLedger, changeLedger } from './ledger-store.mjs';
import { acceptancePlan } from './acceptance-contract.mjs';
import { realpathSync } from 'node:fs';
import { jsonBlock } from './acceptance-contract.mjs';
import { readIterationConfig, iterationConfigFingerprint } from './iteration-policy.mjs';
const fail = message => { throw new Error(message); };
const text = (v, label) => { if (typeof v !== 'string' || !v.trim()) fail(`Missing ${label}`); return v; };
const object = (v, label) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`Invalid ${label}`); return v; };
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const key = task => task.scope === 'roadmap' ? `roadmap:${task.epic}/${task.taskId}` : `${task.sprint}/${task.taskId}`;
const baseChecks = ['targetBuild', 'environment', 'resourceSafety', 'authorization', 'testData', 'evidenceRecording'];
// An Orca dispatch identifies an attempt, NOT an independent executor. Supply a
// durable backend identity observed in actual receipts, with its source reference.
export function executorIdentity(mode, execution) {
  object(execution, 'execution');
  if (mode === 'native') return `native:${text(execution.workerId, 'execution.workerId')}`;
  const identity = object(execution.executorIdentity, 'Orca durable executorIdentity');
  if (!['worker', 'session'].includes(identity.kind)) fail('Orca identity must be a durable worker or session, not a dispatch/terminal');
  text(identity.source, 'executorIdentity.source');
  return `orca:${identity.kind}:${text(identity.id, 'executorIdentity.id')}`;
}
export function validateAcceptanceTask(root, task, config, entry, candidate) {
  if (!config.independentAcceptance) fail('Independent acceptance is disabled; current main agent performs acceptance without a worker ID');
  const c = object(task.acceptanceContext, 'acceptanceContext');
  for (const name of ['wakeId', 'candidate', 'build', 'environmentRevision', 'record']) text(c[name], `acceptanceContext.${name}`);
  if (!Number.isSafeInteger(c.wakeSequence) || c.wakeSequence < 1) fail('wakeSequence must be a positive integer');
  if (c.candidate !== candidate) fail('Acceptance candidate differs from current worktree snapshot');
  if (!Array.isArray(c.developers) || !c.developers.length) fail('Developer executor identities are required to establish independence');
  c.developers.forEach(d => { object(d, 'developer'); if (!['native', 'external'].includes(d.mode)) fail('Invalid developer mode'); executorIdentity(d.mode, d.execution); });
  acceptancePlan(readFileSync(resolve(task.worktree, entry.document), 'utf8'), task.scope === 'roadmap' ? 'roadmap' : 'sprint');
  return c;
}
export function registerAcceptanceWake(root, input) {
  const { task } = input, c = task.acceptanceContext;
  return changeLedger(root, input.ledgerRevision, input.operation, 'acceptance-wake', task, state => {
    if (state.acceptanceWakes !== undefined) object(state.acceptanceWakes, 'acceptanceWakes');
    state.acceptanceWakes ??= {};
    const previous = state.acceptanceWakes[key(task)];
    if (c.wakeSequence !== (previous?.wakeSequence ?? 0) + 1) fail('Stale wakeSequence; each wake/resume requires the next sequence');
    if (previous?.wakeId === c.wakeId) fail('Every wake/resume needs a new wakeId; readiness cannot be reused');
    state.acceptanceWakes[key(task)] = { wakeId: c.wakeId, wakeSequence: c.wakeSequence, binding: binding(task), previousWakeId: previous?.wakeId ?? null };
  });
}
function binding(task) {
  // Only bounded fields: no self-referential validation or receipt content.
  return digest([task.scope, task.epic, task.epicDocument, task.sprint, task.taskId, task.role, task.mode, task.provider, task.workerHarness, task.iterationConfigRevision, task.iterationConfigFingerprint, task.acceptanceContext]);
}
export function validateAcceptanceResult(root, task, result) {
  if (result.role !== 'acceptance') fail('Acceptance result must explicitly bind role; a development result cannot be reused');
  if (result.status !== 'succeeded') return; // Missing capability/identity may be reported honestly as blocked.
  const c = task.acceptanceContext, state = readLedger(root);
  const wake = state.acceptanceWakes?.[key(task)];
  if (!wake || wake.wakeId !== c.wakeId || wake.binding !== binding(task)) fail('Missing or stale registered acceptance wake/context');
  const identity = executorIdentity(task.mode, result.execution);
  if (c.developers.some(d => d.mode !== task.mode || (task.mode === 'external' && d.execution.executorIdentity.kind !== result.execution.executorIdentity.kind))) fail('Cannot establish independence across incomparable executor identity namespaces');
  if (c.developers.some(d => executorIdentity(d.mode, d.execution) === identity)) fail('Acceptance executor must be independent from every development executor');
  const p = object(result.preflight, 'preflight');
  if (p.schema !== 1 || p.status !== 'ready') fail('Acceptance preflight is not ready');
  for (const field of ['wakeId', 'wakeSequence', 'candidate', 'build', 'environmentRevision']) if (p[field] !== c[field]) fail(`Preflight ${field} mismatch`);
  if (p.executor !== identity) fail('Preflight executor identity mismatch');
  const entry = task.scope === 'roadmap' ? { document: task.epicDocument } : state.sprints[task.sprint];
  const plan = acceptancePlan(readFileSync(resolve(task.worktree, entry.document), 'utf8'), task.scope === 'roadmap' ? 'roadmap' : 'sprint');
  const required = [...new Set([...baseChecks, ...plan.scenarios.filter(s => s.required).map(s => `capability:${s.modality}`)])];
  const checks = object(p.checks, 'preflight.checks');
  for (const name of required) {
    const check = object(checks[name], `preflight check ${name}`);
    if (check.status !== 'ready') fail(`Preflight blocked or unknown: ${name}`);
    text(check.evidence, `preflight ${name} evidence`);
  }
  // ready authorization/data can mean verified unnecessary for these scenarios,
  // but must explain why in evidence; unknown is never treated as not-needed.
  text(p.evidence, 'preflight evidence reference');
  if (typeof p.evidence !== 'string' || !result.evidence.includes(p.evidence)) fail('Result evidence must link the preflight evidence record');
}

// Final evidence gate. It consumes an execution receipt, never starts a worker.
export function verifyAcceptanceExecution(root, expected, recordDocument) {
  const config = readIterationConfig(root, expected.epic);
  if (!config.independentAcceptance) return; // Main agent: no fictitious worker ID.
  const envelope = jsonBlock(recordDocument, 'supervibe-acceptance-execution');
  const task = object(envelope.task, 'acceptance task'), result = object(envelope.result, 'acceptance result');
  if (task.schema !== 1) fail('Unsupported acceptance task schema');
  text(task.taskId, 'acceptance taskId');
  if ((task.scope ?? 'sprint') !== expected.scope || task.role !== 'acceptance') fail('Acceptance execution scope/role mismatch');
  if (expected.scope === 'roadmap' ? (task.epic !== expected.epic || task.epicDocument !== expected.document || task.sprint !== undefined) : (task.sprint !== expected.sprint || (task.epic !== undefined && task.epic !== expected.epic))) fail('Acceptance execution sprint/epic mismatch');
  if (realpathSync(task.worktree) !== realpathSync(root)) fail('Acceptance execution worktree mismatch');
  if (task.mode !== config.mode || task.provider !== config.provider || task.iterationConfigRevision !== config.revision || task.iterationConfigFingerprint !== iterationConfigFingerprint(config)) fail('Acceptance execution policy mismatch');
  if (config.mode === 'native' ? task.workerHarness !== 'inherit' : !config.workerHarnesses.includes(task.workerHarness)) fail('Acceptance worker harness is not allowed');
  if (task.acceptanceContext?.record !== expected.record) fail('Acceptance execution record mismatch');
  validateAcceptanceTask(root, task, config, { document: expected.document }, expected.candidate);
  for (const field of ['scope', 'epic', 'epicDocument', 'sprint', 'taskId', 'mode', 'provider', 'workerHarness', 'iterationConfigRevision', 'iterationConfigFingerprint', 'worktree']) if (result[field] !== task[field]) fail(`Acceptance result ${field} mismatch`);
  if (result.schema !== 1 || result.status !== 'succeeded' || !Array.isArray(result.evidence) || !Array.isArray(result.blockers) || result.blockers.length) fail('Acceptance execution must have successful evidence without blockers');
  result.evidence.forEach(e => text(e, 'acceptance evidence'));
  if (task.mode === 'external') for (const key of ['runId', 'taskId', 'dispatchId']) text(result.execution?.[key], `execution.${key}`);
  validateAcceptanceResult(root, task, result);
}
