import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {initializeLedger,readLedger} from '../scripts/ledger-store.mjs';
import {iterationConfigFingerprint,validateTask,confirmIterationConfig} from '../scripts/collaboration-contract.mjs';
import {roadmapSnapshot} from '../scripts/validate-workflow.mjs';
import {planBlock} from './acceptance-fixtures.mjs';
import {mutateWorkers,activeWorkers} from '../scripts/worker-lifecycle.mjs';
const git=(r,...args)=>execFileSync('git',['-C',r,...args],{encoding:'utf8',stdio:'pipe'}).trim();
function fixture(t) {
 const dir=mkdtempSync(join(tmpdir(),'worker-lifecycle-')), root=join(dir,'repo');
 git(dir,'init','-b','main',root); git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');
 writeFileSync(join(root,'file'),'x');git(root,'add','.');git(root,'commit','-m','fixture');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const config={schema:1,epic:'E1',revision:1,mode:'native',provider:'harness',maxWorkers:3,independentAcceptance:false,status:'confirmed',confirmation:{by:'user',source:'test:user',at:'2026-10-31T00:00:00Z'},allowMixed:false,workerHarness:'inherit'};
 const carrier=join(dir,'sprint');git(root,'worktree','add','-b','sprint',carrier);
 initializeLedger(root,{schema:1,revision:0,wipLimit:1,mainRef:'main',sprintsDir:'sprints',events:[],operations:[],sprints:{S1:{id:'S1',epic:'E1',state:'active',document:'sprints/S1.md',branch:'sprint',worktree:carrier}},iterationConfigs:{E1:config}});
 let op=0;const call=(c,p)=>mutateWorkers(root,c,{ledgerRevision:readLedger(root).revision,operation:`op-${++op}`,payload:p});
 call('enable',{quiescence:{by:'coordinator',stopped:true,evidenceRef:'no legacy workers'}});
 function reserve(id,ownership='managed',path=join(dir,id)) {
  if(path!==carrier) git(root,'worktree','add','-b',id,path);
  const task={schema:1,sprint:'S1',taskId:id,workerExecutionId:id,objective:'test',worktree:path,mode:'native',provider:'harness',workerHarness:'inherit',iterationConfigRevision:1,iterationConfigFingerprint:iterationConfigFingerprint(config),allowedPaths:['file'],acceptance:['pass']};
  call('reserve',{id,task,branch:path===carrier?'sprint':id,ownership}); return readLedger(root).workerExecutions.entries[id];
 }
 function start(e){call('start',{id:e.id,token:e.token,execution:{workerId:e.id}});return readLedger(root).workerExecutions.entries[e.id];}
 function settle(e,status='succeeded') {const {objective,allowedPaths,acceptance,...bound}=e.task;return call('settle',{id:e.id,token:e.token,result:{...bound,status,execution:e.execution,evidence:status==='succeeded'?['pass']:[],blockers:status==='succeeded'?[]:['failure']},quiescence:{by:'coordinator',stopped:true,evidenceRef:'backend stopped',execution:e.execution}});}
 return {root,carrier,call,reserve,start,settle};
}
test('WIP one supports three child worktrees; terminal success/failure frees execution quota independently of cleanup',t=>{
 const f=fixture(t), a=f.start(f.reserve('a')),b=f.start(f.reserve('b')),c=f.start(f.reserve('c'));
 assert.equal(Object.keys(readLedger(f.root).sprints).length,1);
 for(const e of [a,b,c]) assert.equal(validateTask(f.root,e.task).taskId,e.id);
 assert.throws(()=>f.reserve('d'),/worker cap/);
 f.call('unknown',{id:c.id,token:c.token});assert.equal(activeWorkers(readLedger(f.root)).length,3);
 writeFileSync(join(a.task.worktree,'valuable'),'keep');f.settle(a);
 f.call('cleanup',{id:a.id,token:a.token,preserveBranch:true});assert.ok(existsSync(join(a.task.worktree,'valuable')));
 assert.equal(readLedger(f.root).workerExecutions.entries.a.cleanup,'cleanup_pending');
 f.settle(b,'failed');assert.equal(activeWorkers(readLedger(f.root)).length,1);
 f.reserve('e'); assert.equal(activeWorkers(readLedger(f.root)).length,2);
 f.call('cleanup',{id:b.id,token:b.token,preserveBranch:true});assert.equal(existsSync(b.task.worktree),false);
 assert.ok(git(f.root,'rev-parse','refs/heads/b'));f.call('cleanup',{id:b.id,token:b.token,preserveBranch:true});f.settle(b,'failed');
 assert.throws(()=>f.call('cleanup',{id:c.id,token:c.token,preserveBranch:true}),/settled/);
 assert.throws(()=>f.call('settle',{id:a.id,token:'stale'}),/stale token/);
});
test('canonical borrowed workspace survives settlement and child task bindings cannot drift',t=>{
 const f=fixture(t),a=f.start(f.reserve('a','borrowed',f.carrier));
 assert.throws(()=>validateTask(f.root,{...a.task,allowedPaths:['other']}),/exact registered/);
 f.settle(a);f.call('cleanup',{id:a.id,token:a.token});assert.ok(existsSync(f.carrier));
 assert.throws(()=>validateTask(f.root,a.task),/Settled/);
});

test('never-launched pending reservation has fenced idempotent abort, not timeout expiry',t=>{
 const f=fixture(t),a=f.reserve('a');
 assert.throws(()=>f.call('abort',{id:a.id,token:a.token,quiescence:{by:'coordinator',stopped:true,evidenceRef:'unknown'}}),/never started/);
 const payload={id:a.id,token:a.token,quiescence:{by:'coordinator',stopped:true,neverStarted:true,evidenceRef:'launch was never invoked'}};
 f.call('abort',payload);f.call('abort',payload);assert.equal(activeWorkers(readLedger(f.root)).length,0);
 f.call('cleanup',{id:a.id,token:a.token,preserveBranch:true});assert.equal(existsSync(a.task.worktree),false);
});

const reorder = v => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])) : v;
test('equivalent reordered task, execution and terminal receipts remain valid',t=>{
 const f=fixture(t),a=f.reserve('a');
 f.call('start',{id:a.id,token:a.token,execution:{workerId:'a',sessionId:'session'}});
 const e=readLedger(f.root).workerExecutions.entries.a;
 assert.equal(validateTask(f.root,reorder(e.task)).taskId,'a');
 f.settle(e);
 const settled=readLedger(f.root).workerExecutions.entries.a;
 f.call('settle',{id:a.id,token:a.token,result:reorder(settled.outcome),quiescence:reorder(settled.quiescence)});
 assert.equal(activeWorkers(readLedger(f.root)).length,0);
});
test('roadmap acceptance borrows main under same epic cap with no Sprint reservation',t=>{
 const f=fixture(t),config={...readLedger(f.root).iterationConfigs.E1,revision:2,independentAcceptance:true,confirmation:{by:'user',source:'test:independent',at:'2026-10-31T00:00:00Z'}};
 confirmIterationConfig(f.root,{ledgerRevision:readLedger(f.root).revision,operation:'independent',config});
 writeFileSync(join(f.root,'E1.md'),'---\nepic: E1\nstatus: open\n---\n'+planBlock('roadmap'));
 git(f.root,'add','.');git(f.root,'commit','-m','roadmap plan');
 const candidate=roadmapSnapshot(f.root,'E1.md','acceptance.md','main').fingerprint;
 const task={schema:1,scope:'roadmap',epic:'E1',epicDocument:'E1.md',role:'acceptance',taskId:'final',workerExecutionId:'final',objective:'Final acceptance',worktree:f.root,mode:'native',provider:'harness',workerHarness:'inherit',iterationConfigRevision:2,iterationConfigFingerprint:iterationConfigFingerprint(config),allowedPaths:['acceptance.md'],acceptance:['Final acceptance'],acceptanceContext:{wakeId:'wake-final',wakeSequence:1,candidate,build:'main',environmentRevision:'test',record:'acceptance.md',developers:[{mode:'native',execution:{workerId:'developer'}}]}};
 assert.throws(()=>f.call('reserve',{id:'final',task,branch:'main',ownership:'managed'}),/borrow/);
 f.call('reserve',{id:'final',task,branch:'main',ownership:'borrowed'});
 assert.equal(validateTask(f.root,task).taskId,'final');
 assert.equal(Object.keys(readLedger(f.root).sprints).length,1);
 assert.equal(activeWorkers(readLedger(f.root),'E1').length,1);
 const e=f.start(readLedger(f.root).workerExecutions.entries.final);f.settle(e,'blocked');
 f.call('cleanup',{id:e.id,token:e.token});assert.ok(existsSync(f.root));assert.equal(activeWorkers(readLedger(f.root)).length,0);
});
