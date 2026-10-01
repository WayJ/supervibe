// check-artifacts — supervibe CI check #2 (spec §7): skill pairing, template completeness, assembly dry-run. Zero deps, Node >= 20.
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TPL = process.env.TEMPLATES_DIR ?? 'templates';
const SKILLS = process.env.SKILLS_DIR ?? 'skills';

const SKILL_DIRS = ['roadmap', 'start', 'accept', 'merge', 'sync', 'board'];
const EPIC_H2 = ['## Deliverables', '## Definition of Done', '## Sprint Breakdown',
  '## Decisions (ADR)', '## Asset Disposition', '## Open Questions', '## Cross-cutting'];
const SPRINT_H2 = ['## Decisions (D-x)', '## Stories & Tasks', '## Definition of Done',
  '## Acceptance Scenarios (S1–Sn)', '## Handover Clauses']; // (S1–Sn) = U+2013 en dash
const LEDGER_KEYS = ['sprint', 'epic', 'state', 'worktree', 'early-start', 'deferred-dependency', 'clauses', 'merged-commit'];
const ACC_H2 = ['## Verdict', '## Scenario Results', '## DoD Checklist', '## Obstacles (verbatim)', '## Doc-Drift Audit'];
const CLAUSE_LABELS = ['id HC#', 'issuer sprint', 'target sprint', 'trigger', 'obligation', 'status (open|discharged)', 'evidence'];
const DEBT_LABELS = ['id', 'date', 'severity', 'owner', 'description', 'repayment criteria', 'status', 'evidence commit'];
const CONFIG_KEYS = ['roadmaps_dir', 'sprints_dir', 'acceptances_dir', 'notes', 'debt_tracker', 'wip_limit'];

let checks = 0;
const failures = [];

function ok(cond, label) {
  checks++;
  if (!cond) failures.push(label);
  return cond;
}

const lines = (t) => t.split(/\r?\n/);

function readIf(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

function assertHeadings(text, headings, ctx) {
  const ls = lines(text);
  for (const h of headings) ok(ls.includes(h), `${ctx}: heading ${JSON.stringify(h)} present`);
}

function assertLabels(text, labels, ctx, form) {
  for (const l of labels) ok(text.includes(form(l)), `${ctx}: label "${l}" verbatim`);
}

function frontmatter(text) {
  const ls = lines(text);
  if (ls[0] !== '---') return null;
  const end = ls.indexOf('---', 1);
  return end === -1 ? null : ls.slice(1, end);
}

function listSkillDirs() {
  if (!existsSync(SKILLS)) return null;
  return readdirSync(SKILLS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

function checkSkills(dirs) {
  if (!ok(dirs !== null, `skills: dir ${SKILLS} exists`)) return;
  ok(dirs.length === SKILL_DIRS.length && SKILL_DIRS.every((d) => dirs.includes(d)),
    `skills: exactly [${SKILL_DIRS}] (found [${dirs}])`);
  for (const d of dirs) {
    for (const f of ['SKILL.md', 'SKILL.zh.md']) {
      const p = join(SKILLS, d, f);
      if (!ok(existsSync(p), `skills/${d}/${f}: exists`)) continue;
      const t = readIf(p);
      ok(t.trim().length > 0, `skills/${d}/${f}: non-empty`);
      ok(t.startsWith('---'), `skills/${d}/${f}: frontmatter opens line 1`);
    }
  }
}

function checkTemplates() {
  const epic = readIf(join(TPL, 'epic.md'));
  if (ok(epic !== null, 'templates/epic.md: exists')) assertHeadings(epic, EPIC_H2, 'epic.md');

  const sprint = readIf(join(TPL, 'sprint.md'));
  if (ok(sprint !== null, 'templates/sprint.md: exists')) {
    assertHeadings(sprint, SPRINT_H2, 'sprint.md');
    const fm = frontmatter(sprint);
    if (ok(fm !== null, 'sprint.md: frontmatter block')) {
      for (const k of LEDGER_KEYS)
        ok(fm.some((l) => l.startsWith(k + ':')), `sprint.md: ledger key "${k}:"`);
    }
  }

  const acc = readIf(join(TPL, 'acceptance-record.md'));
  if (ok(acc !== null, 'templates/acceptance-record.md: exists'))
    assertHeadings(acc, ACC_H2, 'acceptance-record.md');

  const clause = readIf(join(TPL, 'handover-clause.md'));
  if (ok(clause !== null, 'templates/handover-clause.md: exists'))
    assertLabels(clause, CLAUSE_LABELS, 'handover-clause.md', (l) => `- ${l}:`);

  const debt = readIf(join(TPL, 'debt-entry.md'));
  if (ok(debt !== null, 'templates/debt-entry.md: exists'))
    assertLabels(debt, DEBT_LABELS, 'debt-entry.md', (l) => `| ${l} |`);
}

// Slice the `## supervibe` section proper — search anchored AFTER the heading and
// stopped at the next `## `, so foreign same-name headings cannot satisfy it.
function sectionOf(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return null;
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

function assemblyDryrun() {
  const tmp = mkdtempSync(join(tmpdir(), 'check-artifacts-'));
  try {
    const sections = readIf(join(TPL, 'agents-sections.md'));
    if (ok(sections !== null, 'templates/agents-sections.md: exists')) {
      const sec = sectionOf('# AGENTS\n\nexisting content\n' + sections, '## supervibe');
      ok(sec !== null, 'assembly: ## supervibe section found');
      for (const k of CONFIG_KEYS)
        ok(sec !== null && sec.includes(k + ':'), `assembly: "${k}:" inside supervibe section`);
      ok(sec !== null && sec.includes('### gates'), 'assembly: ### gates inside supervibe section');
      ok(sec !== null && sec.includes('### doc_sync_map'), 'assembly: ### doc_sync_map inside supervibe section');
    }
    for (const f of ['epic.md', 'sprint.md']) {
      if (!existsSync(join(TPL, f))) continue;
      copyFileSync(join(TPL, f), join(tmp, f));
      const filled = readFileSync(join(tmp, f), 'utf8').replace(/<!-- placeholder:[\s\S]*?-->/g, 'filled');
      writeFileSync(join(tmp, 'filled-' + f), filled);
      ok(!filled.includes('<!-- placeholder:'), `dry-run ${f}: no placeholder survives fill`);
      assertHeadings(filled, f === 'epic.md' ? EPIC_H2 : SPRINT_H2, 'filled ' + f);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function checkBoard() {
  // board — static viewer artifacts (spec specs/2026-10-01-board-design.md)
  ok(existsSync('web/board.html'), 'web/board.html exists');
  ok(existsSync('web/parser.js'), 'web/parser.js exists');
  const boardHtml = readFileSync('web/board.html', 'utf8');
  ok(/<script src="parser\.js">/.test(boardHtml), 'board.html loads parser.js');
  ok(!/(src|href)="https?:\/\//.test(boardHtml), 'board.html issues no network requests');
  ok(!/@import\s+url\(/.test(boardHtml), 'board.html loads no remote css');
}

function main() {
  try {
    checkSkills(listSkillDirs());
    checkTemplates();
    checkBoard();
    assemblyDryrun();
  } catch (e) {
    failures.push(`unexpected error: ${e.message}`);
  }
  if (failures.length) {
    console.error(`check-artifacts: FAIL ${failures.length}/${checks} assertion(s):`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log(`check-artifacts: OK (${checks} checks)`);
}

main();
