import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {initializeLedger,readLedger,changeLedger} from '../scripts/ledger-store.mjs';
import {iterationConfigFingerprint,validateTask,confirmIterationConfig} from '../scripts/collaboration-contract.mjs';
import {roadmapSnapshot,snapshot} from '../scripts/validate-workflow.mjs';
import {planBlock} from './acceptance-fixtures.mjs';
import {samePath} from '../scripts/path-identity.mjs';
import {mutateWorkers,activeWorkers} from '../scripts/worker-lifecycle.mjs';
const git=(r,...args)=>execFileSync('git',['-C',r,...args],{encoding:'utf8',stdio:'pipe'}).trim();
function fixture(t) {
 const dir=mkdtempSync(join(tmpdir(),'worker-lifecycle-')), root=join(dir,'repo');
 git(dir,'init','-b','main',root); git(root,'config','core.autocrlf','false'); git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');
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

function editLegacy(f, edit) {
 const state=readLedger(f.root);
 changeLedger(f.root,state.revision,`legacy-${state.revision}`,'legacy-fixture',{},edit);
}
const abort = (f,e) => f.call('abort',{id:e.id,token:e.token,quiescence:{by:'coordinator',stopped:true,neverStarted:true,evidenceRef:'never invoked'}});
const cleanup = (f,e) => f.call('cleanup',{id:e.id,token:e.token,preserveBranch:true});

test('cleanup rejects legacy worker-owned canonical, coordinator and other Sprint carriers',t=>{
 for(const target of ['sprint','coordinator','other-sprint']) {
  const f=fixture(t),e=f.reserve('child');
  const path=target==='coordinator'?f.root:target==='sprint'?f.carrier:e.task.worktree;
  editLegacy(f,state=>{
   if(target==='other-sprint') state.sprints.S2={...state.sprints.S1,id:'S2',worktree:path,branch:'child'};
   state.workerExecutions.entries[e.id].task.worktree=path;
  });
  abort(f,e);
  assert.throws(()=>cleanup(f,e),/Unsafe cleanup target/);
  assert.ok(existsSync(path));
  assert.equal(readLedger(f.root).workerExecutions.entries[e.id].cleanup,'cleanup_pending');
 }
});

test('ignored content and foreign Git common-dir remain protected during cleanup',t=>{
 const f=fixture(t),e=f.reserve('child'); abort(f,e);
 writeFileSync(join(e.task.worktree,'.gitignore'),'secret\n');
 git(e.task.worktree,'add','.gitignore');git(e.task.worktree,'commit','-m','ignore');
 writeFileSync(join(e.task.worktree,'secret'),'valuable');
 cleanup(f,e); assert.ok(existsSync(join(e.task.worktree,'secret')));
 const other=fixture(t);
 editLegacy(f,state=>{state.workerExecutions.entries[e.id].task.worktree=other.carrier;});
 assert.throws(()=>cleanup(f,e),/same local Git common-dir/);
 assert.ok(existsSync(other.carrier));
});

// These exercise real Windows Git worktrees, not simulated POSIX filenames.
const windowsAlias = path => path.replaceAll('\\','/').toUpperCase();
test('Windows case/slash aliases cannot own the canonical Sprint carrier', {skip:process.platform!=='win32'},t=>{
 const f=fixture(t),e=f.reserve('borrowed','borrowed',f.carrier),alias=windowsAlias(f.carrier);
 for(const ownership of ['managed','provider']) {
  const id=`bad-${ownership}`, task={...e.task,taskId:id,workerExecutionId:id,worktree:alias};
  assert.throws(()=>f.call('reserve',{id,task,branch:'sprint',ownership}),/borrowed, never worker-owned/);
 }
 const task={...e.task,taskId:'alias',workerExecutionId:'alias',worktree:alias};
 f.call('reserve',{id:'alias',task,branch:'sprint',ownership:'borrowed'});
 assert.equal(samePath(readLedger(f.root).workerExecutions.entries.alias.task.worktree,f.carrier),true);
 assert.equal(validateTask(f.root,task).taskId,'alias');
 abort(f,e);cleanup(f,e); assert.ok(existsSync(f.carrier));
});
test('Windows legacy alias cleanup fails closed and duplicate child ownership is rejected', {skip:process.platform!=='win32'},t=>{
 const f=fixture(t),e=f.reserve('child');
 const duplicate={...e.task,taskId:'duplicate',workerExecutionId:'duplicate',worktree:windowsAlias(e.task.worktree)};
 assert.throws(()=>f.call('reserve',{id:'duplicate',task:duplicate,branch:e.branch,ownership:'managed'}),/already has an owner/);
 editLegacy(f,state=>{state.workerExecutions.entries[e.id].task.worktree=windowsAlias(f.carrier); state.workerExecutions.entries[e.id].branch='sprint';});
 abort(f,e); assert.throws(()=>cleanup(f,e),/Unsafe cleanup target/); assert.ok(existsSync(f.carrier));
});
test('Windows missing worktree registration is detected across case/slash aliases without pruning', {skip:process.platform!=='win32'},t=>{
 const f=fixture(t),e=f.reserve('child'); abort(f,e);
 editLegacy(f,state=>{state.workerExecutions.entries[e.id].task.worktree=windowsAlias(e.task.worktree);});
 rmSync(e.task.worktree,{recursive:true,force:true});
 assert.throws(()=>cleanup(f,e),/Missing directory still registered/);
 assert.ok(git(f.root,'worktree','list','--porcelain').includes('refs/heads/child'));
 assert.ok(git(f.root,'rev-parse','refs/heads/child'));
});

test('Windows acceptance workers accept canonical carrier aliases but not child carriers', {skip:process.platform!=='win32'},t=>{
 const f=fixture(t),base=f.reserve('template','borrowed',f.carrier); abort(f,base);
 const config={...readLedger(f.root).iterationConfigs.E1,revision:2,independentAcceptance:true,confirmation:{by:'user',source:'test:alias-acceptance',at:'2026-10-31T00:00:00Z'}};
 confirmIterationConfig(f.root,{ledgerRevision:readLedger(f.root).revision,operation:'alias-acceptance',config});
 mkdirSync(join(f.carrier,'sprints'));
 writeFileSync(join(f.carrier,'sprints','S1.md'),'---\nsprint: S1\nepic: E1\nstate: active\n---\n'+planBlock('sprint'));
 const task={...base.task,role:'acceptance',taskId:'accept',workerExecutionId:'accept',worktree:windowsAlias(f.carrier),iterationConfigRevision:2,iterationConfigFingerprint:iterationConfigFingerprint(config),acceptanceContext:{wakeId:'accept',wakeSequence:1,candidate:snapshot(f.carrier,'sprints/S1.md','acceptance.md').fingerprint,build:'sprint',environmentRevision:'test',record:'acceptance.md',developers:[{mode:'native',execution:{workerId:'developer'}}]}};
 f.call('reserve',{id:'accept',task,branch:'sprint',ownership:'borrowed'});
 assert.equal(validateTask(f.root,task).taskId,'accept');
 const child=join(f.carrier,'..','child');git(f.root,'worktree','add','-b','child',child);
 const other={...task,taskId:'other',workerExecutionId:'other',worktree:windowsAlias(child)};
 assert.throws(()=>f.call('reserve',{id:'other',task:other,branch:'child',ownership:'managed'}),/Acceptance must target canonical/);
 const e=f.start(readLedger(f.root).workerExecutions.entries.accept);f.settle(e,'blocked');cleanup(f,e);
 assert.ok(existsSync(f.carrier));
});

test('main worktree remains borrowed even when coordinator runs from Sprint carrier',t=>{
 const f=fixture(t),base=f.reserve('template','borrowed',f.carrier);abort(f,base);
 for(const ownership of ['managed','provider']) {
  const id=`main-${ownership}`,task={...base.task,taskId:id,workerExecutionId:id,worktree:process.platform==='win32'?windowsAlias(f.root):f.root};
  assert.throws(()=>mutateWorkers(f.carrier,'reserve',{ledgerRevision:readLedger(f.root).revision,operation:id,payload:{id,task,branch:'main',ownership}}),/Cannot own main/);
 }
 assert.ok(existsSync(f.root));
});

test('live borrowed child blocks new ownership and legacy owned cleanup until borrower is quiescent',t=>{
 const f=fixture(t),e=f.reserve('borrower');
 editLegacy(f,state=>{state.workerExecutions.entries[e.id].ownership='borrowed';});
 const borrower=f.start(e);
 const path=process.platform==='win32'?windowsAlias(e.task.worktree):e.task.worktree;
 for(const ownership of ['managed','provider']) {
  const id=`owner-${ownership}`,task={...e.task,taskId:id,workerExecutionId:id,worktree:path};
  assert.throws(()=>f.call('reserve',{id,task,branch:e.branch,ownership}),/already has an owner/);
 }
 const owner={...e,id:'legacy-owner',token:'legacy-owner-token',ownership:'managed',task:{...e.task,taskId:'legacy-owner',workerExecutionId:'legacy-owner',worktree:path}};
 editLegacy(f,state=>{state.workerExecutions.entries[owner.id]=owner;});
 abort(f,owner);
 assert.throws(()=>cleanup(f,owner),/another active worker/);
 assert.ok(existsSync(e.task.worktree));
 f.settle(borrower,'failed');cleanup(f,owner);
 assert.equal(existsSync(e.task.worktree),false);
 assert.ok(git(f.root,'rev-parse',`refs/heads/${e.branch}`));
});

test('allowedPaths preserves repository-relative directories and wildcard scopes',t=>{
 const f=fixture(t),e=f.reserve('borrowed','borrowed',f.carrier);
 for(const path of ['src/','src/**','src/*.mjs','./src/']) {
  assert.equal(validateTask(f.root,{...e.task,allowedPaths:[path]},false,true).allowedPaths[0],path);
 }
});
test('Windows allowedPaths rejects metadata, drive-relative and alternate-stream aliases', {skip:process.platform!=='win32'},t=>{
 const f=fixture(t),e=f.reserve('borrowed','borrowed',f.carrier);
 for(const path of ['.GIT/config','src/.GiT/config','C:foo','C:/foo','src/file:stream','.git./config','.git /config','src./file','src /file']) {
  assert.throws(()=>validateTask(f.root,{...e.task,allowedPaths:[path]},false,true),/allowedPaths must be repository-relative/);
 }
});
