#!/usr/bin/env node
// Manual Skill helper. Read-only diagnostics; this CLI cannot authenticate a user trigger.
import { lstatSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readHostConfig, containedPath } from './host-config.mjs';
import { inventory } from './artifact-inventory.mjs';
import { commonDir, readLedger, CAPACITY_STATES } from './ledger-store.mjs';
import { validateConfig, validateIterationConfig } from './iteration-policy.mjs';
import { acceptancePlan } from './acceptance-contract.mjs';
import { inspectResourceMetadata } from './resource-policy.mjs';
const stat = path => { try { return lstatSync(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim();
export function projectDoctor(input = process.cwd()) {
  const checks = [];
  const add = (id, level, evidence, next) => checks.push({ id, level, evidence, next });
  add('runtime.node', Number(process.versions.node.split('.')[0]) >= 20 ? 'info' : 'blocker', 'Node major version: ' + process.versions.node.split('.')[0], 'Use Node 20 or newer.');
  let root, config, ledger, artifacts;
  try { root = git(resolve(input), 'rev-parse', '--show-toplevel'); add('repository.git', 'info', 'Git worktree detected.', 'Checks use the current checkout and its Git common-dir.'); }
  catch { add('repository.git', 'blocker', 'No readable Git worktree detected.', 'Select the intended Git project; initialize it only with explicit approval.'); }
  if (root) {
    try {
      if (!stat(join(root, 'AGENTS.md'))?.isFile()) throw new Error();
      config = readHostConfig(root);
      add('host.config', 'info', 'Host configuration parsed; values and commands withheld.', 'Host defaults are proposals, not user-confirmed iteration policy.');
      for (const key of ['roadmaps_dir', 'sprints_dir', 'acceptances_dir', 'notes']) add('host.' + key, stat(join(root, config[key]))?.isDirectory() ? 'info' : 'warning', 'Configured directory ' + (stat(join(root, config[key]))?.isDirectory() ? 'exists.' : 'is missing or not a directory.'), 'Create or correct this directory explicitly before its workflow needs it.');
      add('host.gates', config.gates.length ? 'info' : 'warning', `${config.gates.length} configured gates; none executed.`, 'Review gate safety and run the required gates separately during acceptance.');
      try { validateConfig({ mode: config.collaboration_mode, provider: config.collaboration_provider }); add('host.collaboration', 'info', 'Supported host mode/provider proposal.', 'Confirm worker count, harness selection and independent acceptance at kickoff.'); }
      catch { add('host.collaboration', 'warning', 'Host collaboration proposal missing or unsupported.', 'Choose native/harness or external/orca with the user.'); }
    } catch { add('host.config', 'blocker', 'Host configuration missing, malformed, unreadable or unsafe (including symlink paths).', 'Review AGENTS.md against the host configuration template; scaffold or repair only on explicit request.'); }
    try {
      const dir = join(commonDir(root), 'supervibe');
      if (!stat(dir)) add('ledger.state', 'warning', 'Shared runtime not initialized; normal for a new project.', 'Use explicit initialization or migration when starting iteration; this check creates nothing.');
      else if (!stat(dir).isDirectory() || !stat(join(dir, 'state.json'))?.isFile()) add('ledger.state', 'blocker', 'Shared runtime storage is missing, unsafe or not regular.', 'Inspect the local common-dir storage; do not follow symlinks or overwrite existing state.');
      else if (stat(join(dir, 'write.lock'))) add('ledger.lock', 'blocker', 'Ledger write lock exists; runtime inspection skipped.', 'Ask the coordinator to inspect the owner; never steal or expire the lock automatically.');
      else {
        ledger = readLedger(root); containedPath(root, ledger.sprintsDir);
        add('ledger.state', 'info', `Schema validated; revision ${ledger.revision}.`, 'This is a read-only snapshot, not a reservation or concurrency guarantee.');
        try { git(root, 'rev-parse', '--verify', '--end-of-options', `refs/heads/${ledger.mainRef}^{commit}`); add('ledger.main-ref', 'info', 'Stored main branch resolves locally.', 'No fetch or network verification performed.'); }
        catch { add('ledger.main-ref', 'blocker', 'Stored main branch does not resolve locally.', 'Confirm the intended main branch and explicitly reconcile runtime configuration.'); }
        const active = Object.values(ledger.sprints).filter(s => CAPACITY_STATES.has(s.state)).length;
        add('ledger.wip', active > ledger.wipLimit ? 'blocker' : 'info', `${active} occupied slots / ${ledger.wipLimit} shared WIP limit.`, 'Use shared reservations; do not infer capacity from Markdown.');
        const policies = Object.entries(ledger.iterationConfigs ?? {});
        let invalid = 0;
        for (const [id, policy] of policies) { try { validateIterationConfig(policy); if (id !== policy.epic) throw new Error(); } catch { invalid++; } }
        const missing = new Set(Object.values(ledger.sprints).filter(s => CAPACITY_STATES.has(s.state) && !Object.hasOwn(ledger.iterationConfigs ?? {}, s.epic)).map(s => s.epic)).size;
        add('iteration.policy', invalid || missing ? 'blocker' : policies.length ? 'info' : 'warning', `${policies.length} policies; ${invalid} invalid; ${missing} active epic policies missing.`, 'Before delegation obtain user-confirmed worker count, mode/harness and independent acceptance choice.');
        try { const counts = inspectResourceMetadata(ledger); add('resources.metadata', counts.hosts && counts.groups ? 'info' : 'warning', `${counts.hosts} hosts, ${counts.groups} groups, ${counts.held} held claims; metadata only.`, 'Confirm CPU/RAM/disk budgets and exclusive containers/accounts; SSH hosts need separate authorized readiness checks.'); }
        catch { add('resources.metadata', 'blocker', 'Resource metadata invalid or conflicting.', 'Review resource declarations and claim ownership; do not reset accounts, release claims or start containers here.'); }
      }
    } catch { ledger = undefined; add('ledger.state', 'blocker', 'Shared runtime unreadable, corrupt or unsafe.', 'Inspect schema and storage privately; reconcile explicitly without automatic repair.'); }
    if (config && ledger) {
      try {
        artifacts = inventory(root, { config });
        const counts = new Map();
        for (const issue of artifacts.issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
        // Only trusted fixed diagnostic codes and counts, never raw messages, paths or IDs.
        for (const [code, count] of counts) add('artifacts.' + code, 'blocker', `${count} structural issue(s).`, 'Review the corresponding artifact identities, shared-state projections and worktree carriers privately.');
        add('artifacts.inventory', artifacts.ok ? 'info' : 'warning', `${artifacts.epics.length} epics; ${artifacts.sprints.length} sprint documents.`, 'Markdown is a projection, not runtime authority.');
        let valid = 0, invalid = 0, liveInvalid = 0;
        for (const [scope, entries] of [['roadmap', artifacts.epics], ['sprint', artifacts.sprints]]) for (const item of entries) {
          try { containedPath(root, item.document); acceptancePlan(readFileSync(join(root, item.document), 'utf8'), scope); valid++; } catch { invalid++; if (item.status === 'open' || ['active', 'acceptance'].includes(item.state)) liveInvalid++; }
        }
        add('acceptance.plans', liveInvalid ? 'blocker' : invalid ? 'warning' : valid ? 'info' : 'warning', `${valid} valid structured plans; ${invalid} missing/invalid plans (${liveInvalid} on open/live artifacts).`, 'Define Sprint and Roadmap acceptance at planning time, including required real browser actions for UI; metadata does not prove execution.');
      } catch { add('artifacts.inventory', 'blocker', 'Artifact inventory unavailable or unsafe.', 'Review configured directories and projections; no repair was attempted.'); }
    } else add('artifacts.inventory', 'manual', 'Not inspected without valid configuration and unlocked runtime.', 'Resolve prerequisite findings, then manually invoke /supervibe:doctor again.');
  }
  add('runtime.capabilities', 'manual', 'Unknown: native subagent tools, Orca sessions, worker harnesses and live browser availability.', 'Have the current main agent verify actual exposed capabilities before delegation; installed binaries alone do not prove readiness.');
  add('acceptance.environment', 'manual', 'Unknown: live app, browser, test accounts, credentials and remote/SSH readiness.', 'At each acceptance-worker wake self-check required environment and exclusive resource access; never refresh shared credentials here.');
  const summary = Object.fromEntries(['blocker', 'warning', 'info', 'manual'].map(level => [level, checks.filter(c => c.level === level).length]));
  return { schema: 1, scope: 'Read-only structural compatibility snapshot; not live capability or E2E acceptance proof.', summary, checks };
}
export function main(args) {
  let root = process.cwd(), format = 'json'; const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--root', '--format'].includes(flag) || !value || seen.has(flag)) throw new Error();
    seen.add(flag); if (flag === '--root') root = value; else format = value;
  }
  if (!['json', 'text'].includes(format)) throw new Error();
  const report = projectDoctor(root);
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : [report.scope, ...report.checks.map(c => `[${c.level}] ${c.id}: ${c.evidence} Next: ${c.next}`)].join('\n'));
  if (report.summary.blocker) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch { console.error('Doctor could not complete. Usage: project-doctor.mjs [--root PATH] [--format json|text]. No repair attempted.'); process.exitCode = 2; }
}
