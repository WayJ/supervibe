#!/usr/bin/env node
// Read-only structural preflight. Shared state remains the runtime authority.
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import board from '../web/parser.js';
import { frontmatter, repoPath, inspectWorktreeSprints } from './validate-workflow.mjs';
import { readLedger } from './ledger-store.mjs';
import { doctor } from './shared-ledger.mjs';
import { readHostConfig } from './host-config.mjs';

export function inventory(root, { epic, sprint, config = readHostConfig(root) } = {}) {
  root = resolve(root);
  const report = { ok: false, scope: 'current checkout artifacts and shared-ledger carriers; not a readiness verdict', epics: [], sprints: [], stubs: [], selection: {}, issues: [], ledgerRevision: null };
  const issue = (code, message, path) => report.issues.push({ code, message, ...(path ? { path } : {}) });
  const clauses = new Map();
  function scan(dir, kind) {
    const path = repoPath(root, dir);
    try {
      if (!lstatSync(resolve(root, path)).isDirectory()) throw new Error('Artifact directory must be a real directory');
      for (const entry of readdirSync(resolve(root, path), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.name.endsWith('.md')) continue;
        const document = `${path}/${entry.name}`;
        try {
          if (!entry.isFile()) throw new Error('Artifact must be a regular file, not a symlink');
          const source = readFileSync(resolve(root, document), 'utf8'), data = frontmatter(source);
          const id = data[kind];
          if (!/^[A-Za-z][\w.-]{0,80}$/.test(id ?? '')) throw new Error(`Invalid ${kind} identity`);
          if (kind === 'epic') {
            if (!['open', 'closed'].includes(data.status)) throw new Error('Invalid epic status');
            report.epics.push({ id, document, status: data.status });
            const sections = board.splitSections(source).sections;
            if ((source.match(/^## Sprint Breakdown\s*$/gm) ?? []).length !== 1) throw new Error('Expected exactly one Sprint Breakdown section');
            const table = board.parseTable(sections['Sprint Breakdown']);
            if (!table.headers || table.headers.slice(0, 3).join('|') !== 'sprint|state|note') throw new Error('Unsupported Sprint Breakdown table');
            for (const row of table.rows) {
              if (row.length !== 3 || !/^[A-Za-z][\w.-]{0,80}$/.test(row[0]) || !['planned', 'ready', 'started'].includes(row[1])) {
                issue('invalid-stub', 'Expected sprint id and planned|ready|started stub state', document); continue;
              }
              report.stubs.push({ id: row[0], state: row[1], note: row[2], epic: id, document });
            }
          } else {
            if (!data.epic || !['active', 'acceptance', 'merged', 'closed'].includes(data.state)) throw new Error('Invalid sprint epic/state');
            report.sprints.push({ id, epic: data.epic, document, state: data.state });
            const section = board.splitSections(source).sections['Handover Clauses'] ?? '';
            const parsed = board.parseClauses(section);
            for (const smell of parsed.smells) issue('invalid-clause', smell, document);
            for (const clause of parsed.clauses) {
              if (clauses.has(clause.id)) issue('duplicate-clause', `${clause.id} body also occurs in ${clauses.get(clause.id)}; this detector does not allocate ids`, document);
              else clauses.set(clause.id, document);
            }
          }
        } catch (error) { issue('invalid-artifact', error.message, document); }
      }
      return true;
    } catch (error) { issue('artifact-directory', error.message, path); return false; }
  }
  scan(config.roadmaps_dir, 'epic');
  const sprintDirectory = scan(config.sprints_dir, 'sprint');
  for (const [kind, entries] of [['epic', report.epics], ['sprint', report.sprints], ['stub', report.stubs]]) {
    const seen = new Set();
    for (const item of entries) { if (seen.has(item.id)) issue(`duplicate-${kind}`, `Duplicate ${kind} id ${item.id}`, item.document); seen.add(item.id); }
  }
  let shared;
  try {
    shared = readLedger(root); report.ledgerRevision = shared.revision;
    if (repoPath(root, config.sprints_dir) !== shared.sprintsDir || config.wip_limit !== shared.wipLimit) issue('ledger-config', 'Host sprint directory/WIP limit differs from shared ledger');
    for (const [id, entry] of Object.entries(shared.sprints)) {
      try { doctor(root, { ...shared, sprints: { [id]: entry } }); } catch (error) { issue('ledger-projection', error.message, entry.document); }
    }
  } catch (error) { issue('ledger-unavailable', error.message); }
  if (sprintDirectory) {
    try { inspectWorktreeSprints(root, config.sprints_dir); } catch (error) { issue('worktree-inventory', error.message); }
  }
  for (const stub of report.stubs) {
    const local = report.sprints.filter(item => item.id === stub.id);
    const entry = shared?.sprints[stub.id];
    const materialized = local.length || (entry && !['reserved', 'cancelled'].includes(entry.state));
    if (stub.state === 'started' && !materialized) issue('started-without-document', `Started stub ${stub.id} has no materialized document`, stub.document);
    if (stub.state !== 'started' && materialized) issue('unstarted-with-document', `${stub.state} stub ${stub.id} already has a sprint document`, stub.document);
    if (local.some(item => item.epic !== stub.epic) || (entry && entry.epic !== stub.epic)) issue('epic-mismatch', `Stub ${stub.id} and sprint ownership differ`, stub.document);
  }
  for (const doc of report.sprints) {
    if (!report.stubs.some(stub => stub.id === doc.id && stub.epic === doc.epic)) issue('document-without-stub', `Sprint ${doc.id} has no matching local epic stub`, doc.document);
    if (shared && !Object.hasOwn(shared.sprints, doc.id)) issue('document-without-ledger', `Sprint ${doc.id} is absent from shared state; explicit reconciliation required`, doc.document);
  }
  // Resolve only unique identities; a requested id never falls back to a title or filename.
  if (epic !== undefined) {
    const hits = report.epics.filter(item => item.id === epic);
    if (hits.length !== 1) issue('epic-resolution', `Expected one epic ${epic}; found ${hits.length}`);
    else report.selection.epic = hits[0];
  }
  if (sprint !== undefined) {
    const hits = report.stubs.filter(item => item.id === sprint);
    if (hits.length !== 1 || report.sprints.filter(item => item.id === sprint).length > 1 || (epic !== undefined && hits[0]?.epic !== epic)) issue('sprint-resolution', `Expected one stub ${sprint}${epic ? ` owned by ${epic}` : ''}`);
    else report.selection.sprint = { ...hits[0], sprintDocuments: report.sprints.filter(item => item.id === sprint), shared: shared?.sprints[sprint] ?? null };
  }
  report.ok = report.issues.length === 0;
  return report;
}
export function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--root', '--epic', '--sprint'].includes(args[i]) || !args[i + 1] || Object.hasOwn(options, args[i])) throw new Error('Usage: artifact-inventory.mjs [--root PATH] [--epic ID] [--sprint ID]');
    options[args[i]] = args[i + 1];
  }
  const root = options['--root'] ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const report = inventory(root, { epic: options['--epic'], sprint: options['--sprint'] });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
