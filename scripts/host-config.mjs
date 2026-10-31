#!/usr/bin/env node
// Read-only host proposals; never confirms iteration policy or runs gates.
import { readFileSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocSyncRule } from './doc-sync-rules.mjs';
const defaults = { roadmaps_dir: 'docs/superpowers/roadmaps/', sprints_dir: 'docs/superpowers/sprints/', acceptances_dir: 'docs/superpowers/acceptances/', notes: '.agents/notes/', debt_tracker: 'docs/tech-debt-tracker.md', wip_limit: 3 };
const dirs = ['roadmaps_dir', 'sprints_dir', 'acceptances_dir', 'notes'];
const keys = new Set([...Object.keys(defaults), 'collaboration_mode', 'collaboration_provider']);
const fail = message => { throw new Error(message); };
export function containedPath(root, value) {
  if (typeof value !== 'string' || !value || isAbsolute(value) || /[\\\s<>]/.test(value) || value.split('/').some(p => ['..', '.', '.git'].includes(p))) fail(`Invalid repository-relative path: ${value}`);
  const target = resolve(root, value), rel = relative(resolve(root), target);
  if (!rel || rel.startsWith('../') || isAbsolute(rel)) fail('Path must stay inside repository');
  let part = resolve(root);
  for (const component of rel.split('/')) {
    part = resolve(part, component);
    try { if (lstatSync(part).isSymbolicLink()) fail(`Configured path traverses symlink: ${value}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return value;
}
// Fenced examples are documentation, never live host configuration. Match the
// opening marker and minimum closing length (CommonMark permits <=3 spaces).
function withoutFencedCode(source) {
  let fence = null, comment = false;
  return source.split(/\r?\n/).map(line => {
    if (fence) {
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === fence.marker && close[1].length >= fence.length) fence = null;
      return '';
    }
    if (comment) {
      if (line.includes('-->')) comment = false;
      return '';
    }
    // Standalone/prose HTML comments can contain heading-shaped examples too.
    // Do not reinterpret comment bytes in scalar fields or gate commands.
    if (!/^- [\w-]+:/.test(line) && line.includes('<!--')) {
      const tail = line.slice(line.indexOf('<!--') + 4);
      comment = !tail.includes('-->'); return '';
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open && (open[1][0] !== '`' || !open[2].includes('`'))) {
      fence = { marker: open[1][0], length: open[1].length }; return '';
    }
    return line;
  }).join('\n');
}
export function readHostConfig(root, { requireDirs = [] } = {}) {
  const source = withoutFencedCode(readFileSync(resolve(root, 'AGENTS.md'), 'utf8'));
  const sections = [...source.matchAll(/^## supervibe[ \t]*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (sections.length !== 1) fail('Expected exactly one host ## supervibe section; use explicit scaffold if missing');
  const result = { ...defaults, gates: [], doc_sync_map: [] }, seen = new Set(), headings = new Set(), gateNames = new Set();
  let section = '', tableHeader = false, tableSeparator = false;
  const body = sections[0][1];
  for (const raw of body.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*<!--.*-->\s*$/.test(raw)) continue;
    const heading = raw.match(/^### (\S+)[ \t]*$/);
    if (heading) {
      section = heading[1];
      if (!['gates', 'doc_sync_map'].includes(section) || headings.has(section)) fail(`Unknown or duplicate config subsection: ${section}`);
      headings.add(section); continue;
    }
    if (!section) {
      const m = raw.match(/^- ([a-z_]+):[ \t]*(.*)$/);
      if (!m || !keys.has(m[1]) || seen.has(m[1]) || !m[2].trim()) fail(`Unknown, duplicate or malformed host field: ${raw}`);
      seen.add(m[1]); result[m[1]] = m[2].replace(/\s*<!--.*?-->\s*$/, '').trim();
      if (!result[m[1]]) fail(`Empty host field: ${m[1]}`);
    } else if (section === 'gates') {
      const m = raw.match(/^- ([\w-]+):[ \t]*(.*)$/);
      if (!m || gateNames.has(m[1]) || (!m[2].trim() || /^<!--.*-->$/.test(m[2].trim()))) fail(`Duplicate or empty gate: ${raw}`);
      gateNames.add(m[1]); result.gates.push({ name: m[1], command: m[2] });
    } else {
      if (/^\|\s*change\s*\|\s*owes\s*\|\s*$/.test(raw) && !tableHeader) { tableHeader = true; continue; }
      if (/^\|\s*:?-+:?\s*\|\s*:?-+:?\s*\|\s*$/.test(raw) && tableHeader && !tableSeparator) { tableSeparator = true; continue; }
      const m = raw.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/);
      if (!m || !tableSeparator) fail(`Unsupported doc_sync_map row: ${raw}`);
      const rule = { change: m[1], owes: m[2] }; validateDocSyncRule(rule);
      if (result.doc_sync_map.some(r => r.change === rule.change && r.owes === rule.owes)) fail('Duplicate doc_sync_map rule');
      result.doc_sync_map.push(rule);
    }
  }
  for (const key of [...dirs, 'debt_tracker']) containedPath(root, result[key]);
  if (!/^[1-9]\d*$/.test(String(result.wip_limit)) || !Number.isSafeInteger(Number(result.wip_limit))) fail('wip_limit must be a positive safe integer');
  result.wip_limit = Number(result.wip_limit);
  for (const key of requireDirs) {
    if (!dirs.includes(key)) fail(`Unknown required directory key: ${key}`);
    let stat; try { stat = lstatSync(resolve(root, result[key])); } catch {}
    if (!stat?.isDirectory()) fail(`Missing configured directory ${key}: ${result[key]}; run scaffold or fix config explicitly`);
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let root = process.cwd(); const requireDirs = [];
    for (let i = 2; i < process.argv.length; i++) {
      const flag = process.argv[i], value = process.argv[++i];
      if (!value || value.startsWith('--')) fail(`Missing value for ${flag}`);
      if (flag === '--root') root = value;
      else if (flag === '--require-dir') requireDirs.push(value);
      else fail(`Unknown option: ${flag}`);
    }
    console.log(JSON.stringify(readHostConfig(root, { requireDirs }), null, 2));
  } catch (e) { console.error(JSON.stringify({ ok: false, error: e.message })); process.exitCode = 1; }
}
