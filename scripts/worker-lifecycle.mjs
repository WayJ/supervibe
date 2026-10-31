#!/usr/bin/env node
// Coordinator-driven execution accounting; never a scheduler or provider launcher.
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { changeLedger, commonDir } from './ledger-store.mjs';
import { validateTask, validateResult } from './collaboration-contract.mjs';
import { normalizePathIdentity, pathIdentity, samePath } from './path-identity.mjs';
const fail = m => { throw new Error(m); };
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {encoding:'utf8',stdio:'pipe'}).trim();
const text = (v, label) => { if (typeof v !== 'string' || !v.trim()) fail(`${label} required`); return v; };
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k,canonical(v[k])])) : v;
const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const selfResolved = p => normalizePathIdentity(p) === pathIdentity(p);
const taskBinding = task => Object.fromEntries(Object.entries(task).filter(([k]) => k !== 'validation').map(([k,v]) => [k, k === 'worktree' ? pathIdentity(v) : v]));
const registeredWorktrees = root => git(root,'worktree','list','--porcelain','-z').split('\0').filter(line => line.startsWith('worktree ')).map(line => line.slice(9));
const registered = (root, path) => registeredWorktrees(root).some(p => samePath(p,path,{allowMissing:true}));
const protectedCarrier = (root, state, path) => [root, ...Object.values(state.sprints).map(s => s.worktree)].some(p => samePath(p,path,{allowMissing:true}));
export const activeWorkers = (state, epic) => Object.values(state.workerExecutions?.entries ?? {}).filter(e => (!epic || e.epic === epic) && ['pending','running','unknown'].includes(e.state));
export function workerEntry(state, task) {
  const e = state.workerExecutions?.entries?.[task.workerExecutionId];
  if (!e || !equal(taskBinding(e.task), taskBinding(task))) fail('Task requires its exact registered worker execution binding under the sprint carrier');
  return e;
}
function placement(root, path, branch) {
  if (!isAbsolute(path) || !selfResolved(path) || !samePath(commonDir(path), commonDir(root))) fail('Worker placement must be canonical within same local Git common-dir');
  if (git(path,'symbolic-ref','--quiet','--short','HEAD') !== branch) fail('Worker placement branch differs from registration');
}
function quiescent(q, execution) {
  if (q?.by !== 'coordinator' || q.stopped !== true) fail('Coordinator quiescence proof required; unknown liveness keeps its slot');
  text(q.evidenceRef,'quiescence evidenceRef');
  if (execution && !equal(q.execution, execution)) fail('Quiescence must bind exact backend execution');
}
export function mutateWorkers(root, command, input) {
  const p = input.payload ?? {};
  return changeLedger(root,input.ledgerRevision,input.operation,`worker-${command}`,p,state => {
    if (command === 'enable') {
      if (state.workerExecutions) fail('Worker registry already enabled');
      quiescent(p.quiescence);
      if (Object.values(state.resourceClaims ?? {}).some(c => c.status === 'held' && c.owner?.role === 'worker')) fail('Settle/release legacy worker resource claims before enabling registry');
      state.workerExecutions = {schema:1,entries:{},migration:p.quiescence}; return;
    }
    if (state.workerExecutions?.schema !== 1) fail('Explicit worker registry enable required after reconciling legacy workers');
    const entries = state.workerExecutions.entries;
    if (command === 'reserve') {
      if (!/^[\w.-]{1,128}$/.test(p.id ?? '') || Object.hasOwn(entries,p.id)) fail('Worker execution id invalid or already used; retries use new ids');
      const task = p.task && {...p.task}, roadmap = task?.scope === 'roadmap';
      const sprint = roadmap ? {epic:task.epic,worktree:task.worktree} : state.sprints[task?.sprint];
      if (!sprint) fail('Worker requires parent Sprint');
      if (roadmap && (p.ownership !== 'borrowed' || p.branch !== state.mainRef)) fail('Roadmap acceptance must borrow canonical main worktree');
      if (task.workerExecutionId !== p.id) fail('Task workerExecutionId must equal reservation id');
      validateTask(root,{...task,worktree:sprint.worktree},false,true);
      placement(root,task.worktree,text(p.branch,'branch'));
      if (!['managed','borrowed','provider'].includes(p.ownership)) fail('Explicit workspace ownership required');
      if (task.role === 'acceptance' && !samePath(task.worktree, sprint.worktree)) fail('Acceptance must target canonical integrated Sprint carrier');
      if (protectedCarrier(root,state,task.worktree) && p.ownership !== 'borrowed') fail('Canonical Sprint carrier is borrowed, never worker-owned');
      if (p.ownership !== 'borrowed' && p.branch === state.mainRef) fail('Cannot own main worktree; it must remain borrowed');
      if (Object.values(entries).some(e => samePath(e.task.worktree,task.worktree,{allowMissing:true}) && ((e.ownership !== 'borrowed' && e.cleanup !== 'removed') || (p.ownership !== 'borrowed' && ['pending','running','unknown'].includes(e.state))))) fail('Child worktree already has an owner');
      if (activeWorkers(state,sprint.epic).length >= state.iterationConfigs[sprint.epic].maxWorkers) fail('Confirmed worker cap exceeded');
      task.worktree = realpathSync(task.worktree);
      entries[p.id] = {id:p.id,epic:sprint.epic,...(roadmap ? {scope:'roadmap'} : {sprint:task.sprint}),task,branch:p.branch,ownership:p.ownership,commonDir:commonDir(root),token:randomUUID(),state:'pending',cleanup:'pending'}; return;
    }
    const e = entries[p.id];
    if (!e || p.token !== e.token) fail('Unknown worker execution or stale token');
    if (command === 'start') {
      if (!['pending','unknown'].includes(e.state) || e.execution) fail('Only unbound pending/unknown worker may bind backend execution');
      const keys = e.task.mode === 'native' ? ['workerId'] : ['runId','taskId','dispatchId'];
      keys.forEach(k => text(p.execution?.[k],`execution.${k}`));
      e.execution = p.execution; e.state = 'running'; return;
    }
    if (command === 'unknown') { if (e.state === 'settled') fail('Settled worker cannot become unknown'); e.state = 'unknown'; return; }
    if (command === 'abort') {
      if (e.state === 'settled' && e.outcome?.status === 'not-started' && equal(e.quiescence,p.quiescence)) return;
      if (e.state !== 'pending' || e.execution || p.quiescence?.neverStarted !== true) fail('Abort requires pending worker and proof it never started; otherwise reconcile backend and settle');
      quiescent(p.quiescence);
      e.outcome={status:'not-started'}; e.quiescence=p.quiescence; e.state='settled'; e.cleanup='cleanup_pending'; return;
    }
    if (command === 'settle') {
      if (e.state === 'settled') {
        if (!equal(e.outcome,p.result) || !equal(e.quiescence,p.quiescence)) fail('Settled receipt mismatch');
        return;
      }
      if (!e.execution) fail('Bind backend execution before settlement');
      quiescent(p.quiescence,e.execution);
      if (!equal(p.result?.execution,e.execution)) fail('Result must bind exact backend execution');
      validateResult(root,{task:e.task,result:p.result});
      e.outcome=p.result; e.quiescence=p.quiescence; e.state='settled'; e.cleanup='cleanup_pending'; return;
    }
    if (command === 'cleanup') {
      if (e.state !== 'settled') fail('Cleanup requires settled quiescent execution');
      if (e.cleanup === 'removed' || e.cleanup === 'retained') return;
      if (e.ownership === 'borrowed') { e.cleanup='retained'; return; }
      if (!samePath(commonDir(root),e.commonDir,{allowMissing:true}) || e.branch === state.mainRef || protectedCarrier(root,state,e.task.worktree)) fail('Unsafe cleanup target');
      if (activeWorkers(state).some(other => other.id !== e.id && samePath(other.task.worktree,e.task.worktree,{allowMissing:true}))) fail('Workspace still used by another active worker; retain it until quiescent');
      if (e.ownership === 'provider') {
        if (!p.providerReceipt || p.providerReceipt.action !== 'workspace-cleanup' || !equal(p.providerReceipt.execution,e.execution)) fail('Provider-owned workspace: invoke provider lifecycle then supply workspace-cleanup receipt; never git-remove behind provider');
        text(p.providerReceipt.evidenceRef,'provider cleanup evidenceRef');
        if (existsSync(e.task.worktree) || registered(root,e.task.worktree)) fail('Provider cleanup receipt requires removed workspace');
        e.providerReceipt=p.providerReceipt; e.cleanup='removed'; return;
      }
      if (p.preserveBranch !== true) fail('Explicit preserveBranch:true required; branch is retained for integration/recovery');
      git(root,'rev-parse','--verify',`refs/heads/${e.branch}`);
      if (!existsSync(e.task.worktree)) {
        if (registered(root,e.task.worktree)) fail('Missing directory still registered: inspect partial cleanup; no automatic prune');
        e.cleanup='removed'; return;
      }
      placement(root,e.task.worktree,e.branch);
      if (git(e.task.worktree,'status','--porcelain','--untracked-files=all','--ignored')) { e.cleanup='cleanup_pending'; e.cleanupReason='Dirty, untracked or ignored content retained; execution quota already released'; return; }
      git(root,'worktree','remove','--',e.task.worktree); // intentionally never --force, never deletes the branch
      e.cleanup='removed'; return;
    }
    fail('Unknown worker lifecycle command');
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(mutateWorkers(git(process.cwd(),'rev-parse','--show-toplevel'),process.argv[2],JSON.parse(readFileSync(0,'utf8'))),null,2)); }
  catch(e) { console.error(`worker lifecycle: ${e.message}`); process.exitCode=1; }
}
