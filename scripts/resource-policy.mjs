#!/usr/bin/env node
// Cooperative local control plane only. This never connects, starts, stops or resets a resource.
import { availableParallelism, cpus, totalmem, freemem, loadavg } from 'node:os';
import { statfsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readLedger, changeLedger } from './ledger-store.mjs';
import { validateIterationConfig, iterationConfigFingerprint } from './iteration-policy.mjs';
import { acceptancePlan, jsonBlock } from './acceptance-contract.mjs';
const dimensions = ['cpu', 'memoryBytes', 'diskBytes'];
const fail = message => { throw new Error(`Resource policy: ${message}`); };
const obj = (x, name) => { if (!x || typeof x !== 'object' || Array.isArray(x)) fail(`${name} must be an object`); return x; };
const id = (x, name = 'id') => { if (typeof x !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(x) || ['__proto__', 'constructor', 'prototype'].includes(x)) fail(`Invalid ${name}; use non-secret canonical identifiers`); return x; };
function keys(x, allowed, name) { obj(x, name); for (const key of Object.keys(x)) if (!allowed.includes(key)) fail(`Unexpected ${name}.${key}; secrets and arbitrary payloads are prohibited`); }
function confirmation(x) {
  keys(x, ['by', 'source', 'at'], 'confirmation');
  if (x.by !== 'user' || typeof x.source !== 'string' || !/^[A-Za-z0-9][\w:./-]{0,199}$/.test(x.source) || typeof x.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x.at) || !Number.isFinite(Date.parse(x.at))) fail('Explicit user confirmation source and timestamp required');
}
function vector(x, name, zero = false) {
  keys(x, dimensions, name);
  for (const k of dimensions) if (typeof x[k] !== 'number' || !Number.isFinite(x[k]) || x[k] < (zero ? 0 : Number.MIN_VALUE) || (k !== 'cpu' && !Number.isSafeInteger(x[k]))) fail(`${name}.${k} must be a known ${zero ? 'nonnegative' : 'positive'} estimate`);
  return x;
}
function digest(x) { return createHash('sha256').update(JSON.stringify(x)).digest('hex'); }
export function probeLocal(path = '.') {
  const disk = statfsSync(path, { bigint: true });
  return { schema: 1, observedAt: new Date().toISOString(), cpu: availableParallelism(), logicalCpus: cpus().length, memoryBytes: freemem(), totalMemoryBytes: totalmem(), diskBytes: Number(disk.bavail * disk.bsize), loadAverage: loadavg(), scope: 'local snapshot only; not a reserved budget or safe concurrency guarantee' };
}
export function recommendCapacity(input) {
  keys(input, ['budget', 'reserve', 'footprint', 'maxWorkers'], 'capacity');
  vector(input.budget, 'budget'); vector(input.reserve, 'reserve', true);
  if (!Number.isSafeInteger(input.maxWorkers) || input.maxWorkers < 1) fail('maxWorkers must be explicitly confirmed separately');
  if (!input.footprint || dimensions.some(k => input.footprint[k] == null)) return { environmentInstances: null, workerCap: input.maxWorkers, reason: 'Unknown workload footprint; measure/confirm before recommending concurrency' };
  vector(input.footprint, 'footprint');
  const byDimension = Object.fromEntries(dimensions.map(k => [k, Math.max(0, Math.floor((input.budget[k] - input.reserve[k]) / input.footprint[k]))]));
  return { environmentInstances: Math.min(...Object.values(byDimension)), workerCap: input.maxWorkers, byDimension, scope: 'environment instances, not agent count; estimates only' };
}
function hostValid(h) {
  keys(h, ['id', 'kind', 'machineId', 'sshAlias', 'budget', 'reserve', 'confirmation', 'status', 'preflightRef'], 'host');
  id(h.id); id(h.machineId, 'physical machine identity');
  if (!['local', 'ssh'].includes(h.kind) || !['planned', 'ready', 'unknown'].includes(h.status)) fail('Unknown host kind/status');
  if (h.kind === 'ssh') id(h.sshAlias, 'SSH config alias'); else if (h.sshAlias !== undefined) fail('Local host cannot have an SSH alias');
  vector(h.budget, 'budget'); vector(h.reserve, 'reserve', true); confirmation(h.confirmation);
  if (dimensions.some(k => h.reserve[k] >= h.budget[k])) fail('Host budget must leave capacity after reserves');
  if (h.status === 'ready' || h.preflightRef !== undefined) id(h.preflightRef, 'external preflight evidence reference');
}
function groupValid(g, hosts) {
  keys(g, ['id', 'host', 'targets', 'footprint', 'confirmation'], 'group');
  id(g.id); id(g.host); if (!hosts[g.host]) fail('Unknown group host');
  vector(g.footprint, 'footprint'); confirmation(g.confirmation);
  if (!Array.isArray(g.targets) || !g.targets.length || new Set(g.targets).size !== g.targets.length) fail('Group needs unique physical targets');
  for (const target of g.targets) {
    // Account aliases are global, not partitioned by SSH/local placement.
    if (typeof target !== 'string' || !/^(?:global\/(?:account|service)|host\/[A-Za-z0-9._-]+\/(?:docker-project|container|port|database|volume|browser-profile))\/[A-Za-z0-9._-]+$/.test(target)) fail('Invalid canonical physical target');
    if (target.startsWith('host/') && target.split('/')[1] !== hosts[g.host].machineId) fail('Physical target host differs from group machine');
    if (target.includes('/port/') && (!/^[1-9][0-9]*$/.test(target.split('/').at(-1)) || Number(target.split('/').at(-1)) > 65535)) fail('Port must be canonical decimal 1..65535');
  }
}
function ownerValid(o) {
  if (o?.role === 'main') { keys(o, ['role', 'sessionId'], 'owner'); id(o.sessionId, 'actual current main session identity'); return; }
  keys(o, ['role', 'mode', 'workerId', 'workerHarness'], 'owner');
  if (o.role !== 'worker') fail('Owner must be current main or actual worker');
  id(o.workerId, 'stable actual worker identity'); id(o.workerHarness, 'workerHarness');
  if (!['native', 'external'].includes(o.mode)) fail('Invalid owner mode');
}
function maps(state) {
  for (const key of ['resourceHosts', 'resourceGroups', 'resourceClaims']) if (state[key] !== undefined) obj(state[key], key);
  const hosts = state.resourceHosts ?? {}, groups = state.resourceGroups ?? {}, claims = state.resourceClaims ?? {};
  for (const [key, h] of Object.entries(hosts)) { hostValid(h); if (h.id !== key) fail('Corrupt host identity'); }
  if (new Set(Object.values(hosts).map(h => h.machineId)).size !== Object.keys(hosts).length) fail('Duplicate physical machine aliases');
  for (const [key, g] of Object.entries(groups)) { groupValid(g, hosts); if (g.id !== key) fail('Corrupt group identity'); }
  for (const [key, c] of Object.entries(claims)) {
    keys(c, ['id', 'group', 'scope', 'epic', 'sprint', 'owner', 'configRevision', 'configFingerprint', 'generation', 'token', 'status', 'ledgerRevision', 'operation', 'frozenCandidate', 'release'], 'claim'); ownerValid(c.owner);
    if (c.id !== key || !groups[c.group] || !['held', 'released'].includes(c.status) || !Number.isSafeInteger(c.generation) || c.generation < 1 || typeof c.token !== 'string' || !/^[a-f0-9]{64}$/.test(c.token) || !Number.isSafeInteger(c.configRevision) || c.configRevision < 1 || typeof c.configFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(c.configFingerprint) || !Number.isSafeInteger(c.ledgerRevision) || c.ledgerRevision < 1) fail('Corrupt resource claim');
    id(c.group); if (c.frozenCandidate !== null) id(c.frozenCandidate, 'frozen candidate');
    if (c.release !== undefined) { keys(c.release, ['by', 'stopped', 'evidenceRef'], 'release attestation'); if (c.release.by !== 'coordinator' || c.release.stopped !== true) fail('Corrupt release attestation'); id(c.release.evidenceRef); }
    id(c.epic); if (c.scope === 'sprint') id(c.sprint); else if (c.scope !== 'roadmap' || c.sprint !== undefined) fail('Corrupt claim scope'); id(c.operation);
  }
  const targets = new Set();
  for (const c of held(claims)) for (const target of groups[c.group].targets) { if (targets.has(target)) fail('Corrupt conflicting physical resource claims'); targets.add(target); }
  return { hosts, groups, claims };
}
function currentConfig(state, p) {
  if (p.scope === 'sprint') {
    const sprint = state.sprints[p.sprint];
    if (!sprint || sprint.epic !== p.epic || !['reserved', 'active', 'acceptance'].includes(sprint.state)) fail('Claim requires live sprint and matching epic');
  } else if (p.scope === 'roadmap' && p.sprint === undefined) {
    const entries = Object.values(state.sprints).filter(s => s.epic === p.epic);
    if (!entries.length || entries.some(s => !['merged', 'closed', 'cancelled'].includes(s.state)) || !entries.some(s => ['merged', 'closed'].includes(s.state))) fail('Roadmap acceptance resources require all epic sprints settled and at least one landed sprint');
  } else fail('Explicit sprint or roadmap scope required');
  const config = validateIterationConfig(state.iterationConfigs?.[p.epic]);
  if (p.configRevision !== config.revision || p.configFingerprint !== iterationConfigFingerprint(config)) fail('Claim must bind current iteration configuration');
  ownerValid(p.owner);
  if (p.owner.role === 'worker' && (p.owner.mode !== config.mode || (config.mode === 'native' ? p.owner.workerHarness !== 'inherit' : !config.workerHarnesses.includes(p.owner.workerHarness)))) fail('Worker identity/harness differs from confirmed configuration');
  return config;
}
const ownerKey = o => o.role === 'main' ? JSON.stringify(['main', o.sessionId]) : JSON.stringify(['worker', o.mode, o.workerId, o.workerHarness]);
const held = claims => Object.values(claims).filter(c => c.status === 'held');
function proof(c, p) {
  ownerValid(p.owner);
  if (!c || c.status !== 'held' || c.generation !== p.generation || c.token !== p.token || ownerKey(c.owner) !== ownerKey(p.owner)) fail('Exact live holder/generation/token required; stale or unknown owner');
}
function budgetCheck(host, groups, claims) {
  const used = Object.fromEntries(dimensions.map(k => [k, 0]));
  for (const c of held(claims)) if (groups[c.group].host === host.id) for (const k of dimensions) used[k] += groups[c.group].footprint[k];
  if (dimensions.some(k => used[k] > host.budget[k] - host.reserve[k])) fail('Host capacity shortage; lower environment concurrency or confirm more resources');
  return used;
}
export function mutateResources(root, command, input) {
  keys(input, ['ledgerRevision', 'operation', 'payload'], 'request'); obj(input.payload, 'payload');
  const p = input.payload;
  return changeLedger(root, input.ledgerRevision, input.operation, `resource-${command}`, p, state => {
    const { hosts, groups, claims } = maps(state);
    if (command === 'host') {
      hostValid(p);
      if (hosts[p.id] || Object.values(hosts).some(h => h.machineId === p.machineId)) fail('Host immutable; existing/aliased physical machine cannot be re-registered');
      hosts[p.id] = p;
    } else if (command === 'group') {
      groupValid(p, hosts); if (groups[p.id]) fail('Group immutable; use a new reviewed group ID'); groups[p.id] = p;
    } else if (command === 'host-status') {
      keys(p, ['id', 'status', 'preflightRef'], 'host-status');
      const h = hosts[id(p.id)]; if (!h) fail('Unknown host');
      if (!['unknown', 'ready'].includes(p.status)) fail('Explicit unknown or ready status required');
      if (p.status === 'ready' || p.preflightRef !== undefined) id(p.preflightRef, 'fresh external preflight evidence reference');
      h.status = p.status; if (p.status === 'ready') h.preflightRef = p.preflightRef;
      // All claims deliberately survive unknown/disconnected host status.
    } else if (command === 'acquire') {
      keys(p, ['id', 'group', 'scope', 'epic', 'sprint', 'owner', 'configRevision', 'configFingerprint'], 'acquire');
      id(p.id); id(p.group); id(p.epic); if (p.scope === 'sprint') id(p.sprint);
      const config = currentConfig(state, p), g = groups[p.group];
      if (!g || !hosts[g.host]) fail('Unknown group/host');
      if (hosts[g.host].status === 'unknown') fail('Host liveness unknown; retain existing claims and do not restart');
      const previous = claims[p.id]; if (previous?.status === 'held') fail('Claim already held');
      for (const c of held(claims)) if (groups[c.group].targets.some(target => g.targets.includes(target))) fail('Physical resource already held (possibly via another group alias)');
      const workers = new Set(held(claims).filter(c => c.epic === p.epic && c.owner.role === 'worker').map(c => ownerKey(c.owner))); if (p.owner.role === 'worker') workers.add(ownerKey(p.owner));
      if (workers.size > config.maxWorkers) fail('Confirmed worker cap exceeded; environment capacity is separate');
      const generation = (previous?.generation ?? 0) + 1;
      claims[p.id] = { ...p, generation, token: digest([p.id, generation, input.operation, state.revision + 1]), status: 'held', ledgerRevision: state.revision + 1, operation: input.operation, frozenCandidate: null };
      budgetCheck(hosts[g.host], groups, claims); // failure aborts the complete transaction
    } else if (['release', 'freeze'].includes(command)) {
      keys(p, command === 'release' ? ['id', 'owner', 'generation', 'token', 'quiescence'] : ['id', 'owner', 'generation', 'token', 'candidate'], command);
      const c = claims[id(p.id)]; proof(c, p);
      if (command === 'release') {
        keys(p.quiescence, ['by', 'stopped', 'evidenceRef'], 'quiescence');
        if (p.quiescence.by !== 'coordinator' || p.quiescence.stopped !== true) fail('Coordinator must attest resource users stopped/quiescent; expiry is not proof');
        id(p.quiescence.evidenceRef, 'quiescence evidence reference'); c.status = 'released'; c.release = p.quiescence;
      } else {
        id(p.candidate, 'candidate fingerprint'); currentConfig(state, c);
        if (hosts[groups[c.group].host].status !== 'ready') fail('Freeze requires ready host and actual environment preflight');
        if (c.frozenCandidate && c.frozenCandidate !== p.candidate) fail('Frozen candidate cannot change; release, reacquire and recheck acceptance');
        c.frozenCandidate = p.candidate;
      }
    } else fail('Unknown resource mutation');
    state.resourceHosts = hosts; state.resourceGroups = groups; state.resourceClaims = claims;
    maps(state);
  });
}
export function checkResourceClaim(root, p) {
  keys(p, ['id', 'owner', 'generation', 'token', 'host', 'candidate'], 'check');
  const state = readLedger(root), { hosts, groups, claims } = maps(state), c = claims[id(p.id)];
  proof(c, p); currentConfig(state, c);
  const group = groups[c.group], host = hosts[group.host];
  if (p.host !== host.id || host.status !== 'ready') fail('Wrong host or host not preflight-ready; unknown never means free');
  const used = budgetCheck(host, groups, claims);
  if (p.candidate !== undefined && (!c.frozenCandidate || p.candidate !== c.frozenCandidate)) fail('Acceptance candidate not frozen/mismatched; repeat self-check');
  return { ok: true, claim: c.id, group: c.group, scope: c.scope, epic: c.epic, sprint: c.sprint, owner: c.owner, generation: c.generation, host: host.id, used, preflightRef: host.preflightRef, ledgerRevision: state.revision, executionVerified: false, policyScope: 'policy/attestation only; actual backend, process liveness and environment must be independently checked' };
}
// Acceptance gate for explicitly declared environment groups. No external execution implied.
export function verifyAcceptanceResources(root, expected, planDocument, recordDocument) {
  const plan = acceptancePlan(planDocument, expected.scope), required = new Set();
  for (const scenario of plan.scenarios) {
    if (scenario.resourceGroups === undefined) continue;
    if (!Array.isArray(scenario.resourceGroups) || new Set(scenario.resourceGroups).size !== scenario.resourceGroups.length) fail('Scenario resourceGroups must be a unique array');
    for (const group of scenario.resourceGroups) { id(group, 'scenario resource group'); if (scenario.required) required.add(group); }
  }
  if (!required.size) return { requiredGroups: [], policyChecked: false };
  const receipt = jsonBlock(recordDocument, 'supervibe-resource-execution');
  keys(receipt, ['schema', 'scope', 'epic', 'sprint', 'candidate', 'claims'], 'resource receipt');
  if (receipt.schema !== 1 || receipt.scope !== expected.scope || receipt.epic !== expected.epic || receipt.sprint !== expected.sprint || receipt.candidate !== expected.candidate || !Array.isArray(receipt.claims)) fail('Resource acceptance receipt scope/candidate mismatch');
  const config = validateIterationConfig(readLedger(root).iterationConfigs?.[expected.epic]);
  const execution = config.independentAcceptance ? jsonBlock(recordDocument, 'supervibe-acceptance-execution') : null;
  const seen = new Set();
  for (const proof of receipt.claims) {
    if (proof.candidate !== expected.candidate) fail('Resource proof must bind acceptance candidate');
    const checked = checkResourceClaim(root, proof);
    if (checked.scope !== expected.scope || checked.epic !== expected.epic || checked.sprint !== expected.sprint || !required.has(checked.group) || seen.has(checked.group)) fail('Resource proof has wrong task/group or duplicate group');
    if (execution) {
      const actual = config.mode === 'native' ? execution.result?.execution?.workerId : execution.result?.execution?.executorIdentity?.id;
      if (checked.owner.role !== 'worker' || checked.owner.workerId !== actual || checked.owner.mode !== execution.task?.mode || checked.owner.workerHarness !== execution.task?.workerHarness) fail('Claim owner must match actual acceptance executor, not dispatch identity');
    } else if (checked.owner.role !== 'main') fail('Main acceptance requires current main session claim, not invented worker');
    seen.add(checked.group);
  }
  if (seen.size !== required.size) fail('Missing required acceptance resource group claims');
  return { requiredGroups: [...required], policyChecked: true, executionVerified: false };
}
export function main(args) {
  if (args.length !== 1) fail('Usage: resource-policy.mjs probe-local|recommend|host|group|host-status|acquire|release|freeze|check (JSON stdin except probe-local)');
  const command = args[0], input = command === 'probe-local' ? null : JSON.parse(readFileSync(0, 'utf8'));
  const result = command === 'probe-local' ? probeLocal() : command === 'recommend' ? recommendCapacity(input) : command === 'check' ? checkResourceClaim(process.cwd(), input) : mutateResources(process.cwd(), command, input);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
