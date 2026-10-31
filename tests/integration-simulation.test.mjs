// Synthetic execution/preflight receipts only: not native, Orca, browser, or SSH E2E.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import { initializeLedger, readLedger } from '../scripts/ledger-store.mjs';
import { acceptanceWake, iterationConfigFingerprint } from '../scripts/collaboration-contract.mjs';
import { snapshot, verify, verifyClean, roadmapSnapshot, roadmapVerify, roadmapVerifyClean } from '../scripts/validate-workflow.mjs';
import { mutateResources } from '../scripts/resource-policy.mjs';
import { scenario, planBlock, resultsBlock } from './acceptance-fixtures.mjs';
const block=(tag,o)=>'\n```'+tag+'\n'+JSON.stringify(o)+'\n```\n';
for (const scope of ['sprint', 'roadmap']) for (const mode of ['native', 'external']) for (const independent of [false, true]) {
 test(`combined ${scope} / ${mode} / independent=${independent}: acceptance and resource lifecycle`, t => {
 const root = mkdtempSync(join(tmpdir(), 'sv-combined-'));
 t.after(() => rmSync(root, { recursive: true, force: true }));
 const git=(...a)=>execFileSync('git',['-C',root,...a],{encoding:'utf8',stdio:'pipe'}).trim();
 const write=(p,s)=>writeFileSync(root+'/'+p,s);
 git('init','-b','main');git('config','core.autocrlf','false');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');mkdirSync(root+'/sprints');mkdirSync(root+'/acceptances');
 const document=scope==='sprint'?'sprints/S1.md':'E1.md',record='acceptances/result.md';
 const sc={...scenario,resourceGroups:['env']};
 const content=scope==='sprint'?'---\nsprint: S1\nstate: active\n---\n':'---\nepic: E1\nstatus: open\nfinal-acceptance-record: null\nfinal-accepted-at: null\n---\n## Sprint Breakdown\n| sprint | state | note |\n|---|---|---|\n| S1 | merged | landed |\n\n## Overall Acceptance\n';
 write(document,content+planBlock(scope,[sc]));write('code.js','baseline');git('add','.');git('commit','-m','upfront plan');
 const confirmation={by:'user',source:'synthetic:test',at:'2026-10-31T00:00:00Z'};
 const config={schema:1,epic:'E1',revision:1,mode,provider:mode==='native'?'harness':'orca',maxWorkers:1,independentAcceptance:independent,status:'confirmed',confirmation,allowMixed:false,...(mode==='native'?{workerHarness:'inherit'}:{workerHarnesses:['codex']})};
 initializeLedger(root,{schema:1,revision:0,wipLimit:1,mainRef:'main',sprintsDir:'sprints',events:[],operations:[],iterationConfigs:{E1:config},sprints:{S1:{id:'S1',epic:'E1',state:scope==='sprint'?'active':'merged',document:'sprints/S1.md',branch:'main',worktree:root,...(scope==='roadmap'?{landing:git('rev-parse','HEAD')}:{})}}});
 let n=0;const mutate=(cmd,payload)=>mutateResources(root,cmd,{ledgerRevision:readLedger(root).revision,operation:'op-'+(++n),payload});
 const v=n=>({cpu:n,memoryBytes:n*1024,diskBytes:n*1024});
 mutate('host',{id:'ssh',kind:'ssh',machineId:'cloud-1',sshAlias:'synthetic-build',budget:v(4),reserve:v(1),confirmation,status:'ready',preflightRef:'synthetic-ready'});
 mutate('group',{id:'env',host:'ssh',targets:['host/cloud-1/port/3000','global/account/synthetic-user'],footprint:v(2),confirmation});
 const fp=iterationConfigFingerprint(config),harness=mode==='native'?'inherit':'codex';
 const owner=independent?{role:'worker',mode,workerId:'reviewer',workerHarness:harness}:{role:'main',sessionId:'main-session'};
 const acquire={id:'claim',group:'env',scope,epic:'E1',...(scope==='sprint'?{sprint:'S1'}:{}),owner,configRevision:1,configFingerprint:fp};
 mutate('acquire',acquire);
 const evidence=scope==='sprint'?snapshot(root,document,record):roadmapSnapshot(root,document,record,'main');
 const candidate=evidence.fingerprint;
 const proof=()=>{const c=readLedger(root).resourceClaims.claim;return {id:'claim',owner:c.owner,generation:c.generation,token:c.token,host:'ssh',candidate};};
 const freezeProof=()=>{const {host,candidate,...p}=proof();return p;};
 mutate('freeze',{...freezeProof(),candidate});
 const execution=mode==='native'?{workerId:'reviewer'}:{runId:'run',taskId:'task',dispatchId:'dispatch',executorIdentity:{kind:'session',id:'reviewer',source:'synthetic:receipt'}};
 const developer=mode==='native'?{workerId:'developer'}:{executorIdentity:{kind:'session',id:'developer',source:'synthetic:receipt'}};
 const context={wakeId:'wake-1',wakeSequence:1,candidate,build:'build-1',environmentRevision:'env-1',record,developers:[{mode,execution:developer}]};
 const task={schema:1,scope,epic:'E1',...(scope==='roadmap'?{epicDocument:document}:{sprint:'S1'}),role:'acceptance',taskId:'accept',objective:'Test integrated path',worktree:root,allowedPaths:['acceptances/'],acceptance:['All scenarios'],mode,provider:config.provider,workerHarness:harness,iterationConfigRevision:1,iterationConfigFingerprint:fp,acceptanceContext:context};
 const preflight={schema:1,status:'ready',wakeId:context.wakeId,wakeSequence:1,candidate,build:context.build,environmentRevision:context.environmentRevision,executor:mode==='native'?'native:reviewer':'orca:session:reviewer',evidence:record+'#preflight',checks:Object.fromEntries(['targetBuild','environment','resourceSafety','authorization','testData','evidenceRecording','capability:cli'].map(k=>[k,{status:'ready',evidence:'synthetic:fixture-only'}]))};
 const result={...task,execution,preflight,status:'succeeded',evidence:[preflight.evidence],blockers:[]};
 if(independent) acceptanceWake(root,{ledgerRevision:readLedger(root).revision,operation:'wake',task});
 const receipt={schema:1,scope,epic:'E1',...(scope==='sprint'?{sprint:'S1'}:{}),candidate,claims:[proof()]};
 const save=(r=result,rc=receipt)=>write(record,'## Verdict\npass\n'+block('supervibe-evidence',evidence)+resultsBlock(candidate,scope,[sc])+(independent?block('supervibe-acceptance-execution',{task,result:r}):'')+block('supervibe-resource-execution',rc));
 save();write(document,(scope==='sprint'?content.replace('state: active',`state: acceptance\nacceptance-record: ${record}\naccepted-at: 2026-10-31`):content.replace('final-acceptance-record: null','final-acceptance-record: '+record).replace('final-accepted-at: null','final-accepted-at: 2026-10-31'))+planBlock(scope,[sc]));
 const check=()=>scope==='sprint'?verify(root,document,record):roadmapVerify(root,document,record,'main');
 assert.equal(check().fingerprint,candidate);
 git('add','.');git('commit','-m','synthetic acceptance');
 assert.equal((scope==='sprint'?verifyClean(root,document,record):roadmapVerifyClean(root,document,record,'main')).fingerprint,candidate);
 const paths=['positive','committed evidence stays fresh'];
 assert.throws(()=>mutate('acquire',{...acquire,id:'competitor'}));paths.push('resource contention blocks');
 mutate('host-status',{id:'ssh',status:'unknown'});assert.throws(check,/not preflight-ready/);assert.equal(readLedger(root).resourceClaims.claim.status,'held');paths.push('unknown SSH blocks and retains claim');
 mutate('host-status',{id:'ssh',status:'ready',preflightRef:'synthetic-rechecked'});assert.equal(check().fingerprint,candidate);
 save(result,{...receipt,claims:[{...proof(),candidate:'wrong'}]});assert.throws(check,/candidate/);save();paths.push('wrong frozen candidate blocks');
 if(independent){
  mutate('release',{...freezeProof(),quiescence:{by:'coordinator',stopped:true,evidenceRef:'synthetic-stopped'}});
  mutate('acquire',{...acquire,owner:{...owner,workerId:'developer'}});mutate('freeze',{...freezeProof(),candidate});
  save(result,{...receipt,claims:[proof()]});assert.throws(check,/actual acceptance executor/);
  mutate('release',{...freezeProof(),quiescence:{by:'coordinator',stopped:true,evidenceRef:'synthetic-stopped'}});
  mutate('acquire',acquire);mutate('freeze',{...freezeProof(),candidate});receipt.claims=[proof()];save();assert.equal(check().fingerprint,candidate);
  paths.push('developer-held environment blocks until explicit release and acceptance handoff');
  write('code.js','modified candidate');assert.throws(check);write('code.js','baseline');assert.equal(check().fingerprint,candidate);paths.push('modified code invalidates combined acceptance');
  save({...result,preflight:{...preflight,checks:{...preflight.checks,resourceSafety:{status:'unknown',evidence:'unknown'}}}});assert.throws(check);save();
  save({...result,execution:mode==='native'?developer:{...execution,executorIdentity:developer.executorIdentity}});assert.throws(check,/independent/);save();
  paths.push('unknown preflight blocks','same development executor blocks');
  const next={...task,acceptanceContext:{...context,wakeId:'wake-2',wakeSequence:2}};
  acceptanceWake(root,{ledgerRevision:readLedger(root).revision,operation:'resume',task:next});assert.throws(check,/stale/);paths.push('resume invalidates old receipt');
 }else{
  mutate('release',{...freezeProof(),quiescence:{by:'coordinator',stopped:true,evidenceRef:'synthetic-stopped'}});assert.throws(check,/holder/);paths.push('released claim blocks');
 }
 t.diagnostic(`${paths.length} combined path checkpoints: ${paths.join('; ')}`);
 });
}
