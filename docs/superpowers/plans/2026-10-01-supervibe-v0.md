# SuperVibe v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship supervibe v0.1.0 — a Claude Code plugin (iteration-management layer pairing with superpowers) with 5 bilingual skills, 6 artifact templates, 1 validation test script, self-marketplace manifest, and bilingual README.

**Architecture:** Pure-content plugin: no runtime code except one zero-dependency Node validation script. Skills are imperative instruction documents (EN source of truth + ZH mirror); templates are plain markdown with placeholder comments; all project specifics stay in host AGENTS.md. Coupling to superpowers is artifact-contract only (dispatch-if-present, degrade gracefully).

**Tech Stack:** Claude Code plugin format (`.claude-plugin/plugin.json` + `marketplace.json`, skills-only), Node ≥ 20 for `tests/check-artifacts.mjs`, `claude plugin validate --strict` as gate.

**Spec:** `docs/superpowers/specs/2026-10-01-supervibe-v0-design.md` (authoritative — read before Task 1; terminology: epic/sprint/DoD/story per spec §1 术语策略)

**Conventions for all tasks:**

- Windows Git Bash. Repo root = `D:/lc_projects/blue_dsh/supervibe`. All relative paths below are from repo root.
- Commit identity: `git -c user.name="jw083" -c user.email="jw083@local" commit`.
- Every SKILL.md (EN and ZH) starts with `---` on line 1 (loader rule; ZH mirrors keep frontmatter for symmetry).
- EN skill bodies: imperative, terse, ≤ ~150 lines each. ZH mirror: faithful translation, technical terms stay English.
- Frontmatter `description` ≤ ~300 chars (hard loader cap 1,536 far above), Scrum vocabulary in the first sentence (sprint/epic/DoD/review) for trigger matching.
- No file outside spec §8 manifest gets created (YAGNI).

---

### Task 1: Plugin manifest + self-marketplace + LICENSE + CHANGELOG

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `LICENSE`
- Create: `CHANGELOG.md`

- [x] **Step 1: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "supervibe",
  "displayName": "SuperVibe",
  "version": "0.1.0",
  "description": "Iteration management layer for Claude Code: roadmap, sprint adjudication, DoD acceptance, merge close-out. Pairs with superpowers.",
  "author": { "name": "jw083" },
  "homepage": "https://example.com/supervibe",
  "repository": "https://example.com/supervibe",
  "license": "MIT",
  "keywords": ["iteration", "roadmap", "sprint", "scrum", "planning", "workflow"]
}
```

Note: `homepage` placeholder MUST stay a parsable URL (loader hard-fails otherwise; replaced at publish).

- [x] **Step 2: Write `.claude-plugin/marketplace.json`**

```json
{
  "name": "supervibe",
  "owner": { "name": "jw083" },
  "plugins": [
    {
      "name": "supervibe",
      "source": "./",
      "description": "Iteration management layer for Claude Code. Pairs with superpowers.",
      "category": "workflow"
    }
  ]
}
```

Note: entry `name` MUST equal manifest `name` (official rule). Version intentionally omitted here — `plugin.json` is authoritative.

- [x] **Step 3: Write `LICENSE`** — standard MIT text, copyright `2026 supervibe contributors`.

- [x] **Step 4: Write `CHANGELOG.md`**

```markdown
# Changelog

## 0.1.0 (unreleased)

Initial release: 5 skills (roadmap / start / accept / merge / sync), 6 artifact
templates, self-marketplace manifest, bilingual skill bodies, artifact
validation script.
```

- [x] **Step 5: Commit**

```bash
git add .claude-plugin LICENSE CHANGELOG.md
git commit -m "feat: plugin manifest, self-marketplace, MIT license, changelog"
```

(Validation deferred to Task 2 — `claude plugin validate` on a skill-less plugin is not the gate we care about.)

---

### Task 2: `roadmap` skill (EN + ZH) + first validate gate

**Files:**
- Create: `skills/roadmap/SKILL.md`
- Create: `skills/roadmap/SKILL.zh.md`

**Content requirements (both versions, mirrored):**

Frontmatter (EN file):

```yaml
---
name: roadmap
description: Manage the strategic roadmap — scaffold a repo for supervibe, add epics with Definition of Done, record ADR decisions, manage open questions, asset disposition, and tech-debt entries. Use when the user mentions roadmap, epic, ADR, tech debt, or wiring a project to supervibe.
argument-hint: [scaffold|epic|adr|question|asset|debt|ready|close]
---
```

Body sections (in order):

1. `# supervibe:roadmap — strategic truth source` — one-paragraph scope: everything in `roadmap.md` plus the AGENTS.md supervibe section.
2. `## Read host config first` — grep the AGENTS.md `## supervibe` section (spec §5); if absent, the only legal next action is the `scaffold` subcommand.
3. `## scaffold` — create `roadmap.md` from `templates/roadmap.md`, splice `templates/agents-sections.md` into AGENTS.md, create the notes dir. **Idempotent: never overwrite existing sections — emit a diff proposal instead.**
4. `## epic` — add epic row; **reject if DoD missing** (spec §2.1). Copy DoD verbatim into the row.
5. `## adr` — append numbered ADR row + amendment rows; enforce doc-before-code narrative (the decision text must be written before implementation begins).
6. `## question` — open/close/defer open questions with decision-record links.
7. `## asset` — update asset disposition (reuse / retire / re-order / watch).
8. `## debt` — add entry (severity/owner/repayment criteria via `templates/debt-entry.md`), repay (close with evidence commit hash), route observation items to an owning epic.
9. `## ready / close` — ledger transitions: planned→ready (go decision); →closed only when the sprint's handover clauses are discharged or none were registered (spec §2.2). Every mutation: append date + evidence link.

- [x] **Step 1: Write `skills/roadmap/SKILL.md`** (EN source of truth, per above)
- [x] **Step 2: Write `skills/roadmap/SKILL.zh.md`** (faithful ZH mirror, same frontmatter, same section order)
- [x] **Step 3: Validate**

Run: `claude plugin validate . --strict`
Expected: pass, no errors. If `--strict` flags missing components beyond warnings, read the message; skills present since this task so errors here are real defects — fix before commit.

- [x] **Step 4: Commit**

```bash
git add skills/roadmap
git commit -m "feat: roadmap skill (scaffold/epic/adr/question/asset/debt/ready/close), EN+ZH"
```

---

### Task 3: `start` skill (EN + ZH)

**Files:**
- Create: `skills/start/SKILL.md`
- Create: `skills/start/SKILL.zh.md`

Frontmatter (EN):

```yaml
---
name: start
description: Start a sprint from a roadmap epic — readiness adjudication (dependencies, WIP limit, early start, deferred dependency), read past lesson notes, scaffold the sprint plan with verbatim DoD, then dispatch superpowers to fill it. Use when the user says start, begin, or pull a sprint/epic/line.
argument-hint: <epic-id>
---
```

Body sections:

1. `# supervibe:start — open a sprint` 
2. `## Read host config` — AGENTS.md section (paths, wip_limit).
3. `## Readiness adjudication` — dependency check; count active sprints in the ledger vs wip_limit; **early start** ruling (estimate file intersection with active sprints — safe if ≈ zero, record flag in ledger); **deferred dependency** ruling (implement-on-current-baseline + register handover clause per `templates/handover-clause.md` in plan + ledger).
4. `## Read history first` — search the notes dir for prior lessons matching this epic's domain + stack; extract relevant lessons into the plan's decision context (spec §2.4).
5. `## Scaffold the sprint plan` — copy `templates/plan.md` to `<plans dir>/YYYY-MM-DD-<sprint>-plan.md`; **DoD copied verbatim from the epic row — never edited in place**; write the opening note entry per §2.4 (filename `YYYY-MM-DD-<sprint>-open.md`).
6. `## Dispatch execution` — if superpowers skills are available: invoke `superpowers:brainstorming`, then `superpowers:writing-plans`, **directing both to fill the scaffolded path; five-section structure and verbatim DoD are immutable**. Otherwise print manual instructions. Update ledger ready→active.

- [ ] **Step 1: Write `skills/start/SKILL.md`** 
- [ ] **Step 2: Write `skills/start/SKILL.zh.md`**
- [ ] **Step 3: Validate** — Run: `claude plugin validate . --strict` — Expected: pass.
- [ ] **Step 4: Commit** — `git add skills/start && git commit -m "feat: start skill (adjudication, read-history, plan scaffold, dispatch), EN+ZH"`

---

### Task 4: `accept` skill (EN + ZH)

**Files:**
- Create: `skills/accept/SKILL.md`
- Create: `skills/accept/SKILL.zh.md`

Frontmatter (EN):

```yaml
---
name: accept
description: Run sprint acceptance — execute S1–Sn scenarios as real verifications, check DoD, log obstacles verbatim, audit doc drift. Use when the user says accept, review, verify, or asks whether a sprint is done.
argument-hint: <sprint-or-plan-path>
---
```

Body sections:

1. `# supervibe:accept — sprint review gate`
2. `## Inputs` — plan path; config (acceptance dir, doc_sync_map).
3. `## Execute scenarios` — each S-scenario runs for real (browser, CLI, stack commands as the scenario specifies). **Never claim pass without running.** On obstacles: first search notes history for a prior workaround; if hit, reuse and cite the source entry.
4. `## DoD checklist` — every item checked with evidence; substituted evidence must be labeled as such.
5. `## Obstacles log` — verbatim recording; no greenwashing (every blocker, workaround, and substitution recorded as it happened).
6. `## Doc-drift audit` — run the periodic doc-sync pass against the doc_sync_map; emit a drift report section.
7. `## Verdict + record` — write `<acceptance dir>/YYYY-MM-DD-<sprint>-acceptance.md` from `templates/acceptance-record.md`; verdict pass/blocked; update ledger →acceptance.

- [ ] **Step 1: Write `skills/accept/SKILL.md`**
- [ ] **Step 2: Write `skills/accept/SKILL.zh.md`**
- [ ] **Step 3: Validate** — `claude plugin validate . --strict` — pass.
- [ ] **Step 4: Commit** — `git add skills/accept && git commit -m "feat: accept skill (real scenario execution, DoD, obstacles log, drift audit), EN+ZH"`

---

### Task 5: `merge` skill (EN + ZH)

**Files:**
- Create: `skills/merge/SKILL.md`
- Create: `skills/merge/SKILL.zh.md`

Frontmatter (EN):

```yaml
---
name: merge
description: Close out a sprint — run gates including doc-sync arrears, verify acceptance verdict, merge to main, tear down worktree, finalize the ledger row, fire handover clauses, write the closing note. Use when the user says merge, close out, ship, or finish a sprint.
argument-hint: <sprint>
---
```

Body sections:

1. `# supervibe:merge — sprint close-out`
2. `## Ordered sequence, stop on red` — numbered list, hard stops between stages:
   1. Gates: run every command in the AGENTS.md gates list + **doc-sync arrears final check** (mapping table — any owed doc without a same-commit change blocks).
   2. Acceptance verdict in place (pass; blocked = stop).
   3. Merge to main — conflict checklist per spec §2.5: generated artifacts → regenerate and compare; handwritten files → item-by-item review list.
   4. Worktree/branch teardown.
   5. Ledger row finalized with merge commit hash.
   6. Handover clauses fired — now binding on target sprints.
   7. Closing note per §2.4 (`YYYY-MM-DD-<sprint>-close.md`), evidence commit hash, cross-referenced with the acceptance record.
3. `## Never` — no red gate, no missing verdict, no unverified clause discharge (that belongs to sync).

- [ ] **Step 1: Write `skills/merge/SKILL.md`**
- [ ] **Step 2: Write `skills/merge/SKILL.zh.md`**
- [ ] **Step 3: Validate** — `claude plugin validate . --strict` — pass.
- [ ] **Step 4: Commit** — `git add skills/merge && git commit -m "feat: merge skill (gates, arrears check, close-out sequence, clause firing), EN+ZH"`

---

### Task 6: `sync` skill (EN + ZH)

**Files:**
- Create: `skills/sync/SKILL.md`
- Create: `skills/sync/SKILL.zh.md`

Frontmatter (EN):

```yaml
---
name: sync
description: Cross-sprint cadence sync — merge origin/main into active sprints, classify conflicts (generated vs handwritten), check incoming diffs against open handover clauses, discharge verified clauses with evidence. Use when the user says sync, pull main, update branches, or integrate upstream changes.
argument-hint: [sprint-id|all]
---
```

Body sections:

1. `# supervibe:sync — cadence + clause discharge`
2. `## Cadence merge` — `origin/main` into the named sprint (or all ledger-active sprints).
3. `## Conflict re-verify checklist` — generated → regenerate and compare; handwritten → emit item-by-item review list; report.
4. `## Handover clause check` — diff incoming changes against open clauses (path/feature match → surface the obligation verbatim).
5. `## Discharge` — when the target sprint's obligation is verified: record evidence (commit hash / verification transcript), set clause status discharged, notify ledger.

- [ ] **Step 1: Write `skills/sync/SKILL.md`**
- [ ] **Step 2: Write `skills/sync/SKILL.zh.md`**
- [ ] **Step 3: Validate** — `claude plugin validate . --strict` — pass.
- [ ] **Step 4: Commit** — `git add skills/sync && git commit -m "feat: sync skill (cadence, conflict checklist, clause discharge), EN+ZH"`

---

### Task 7: Six artifact templates

**Files:**
- Create: `templates/roadmap.md`
- Create: `templates/plan.md`
- Create: `templates/acceptance-record.md`
- Create: `templates/handover-clause.md`
- Create: `templates/debt-entry.md`
- Create: `templates/agents-sections.md`

Common rules: plain markdown; `<!-- placeholder: ... -->` comments for fill-in points; one worked example row per table; no templating engine.

- [ ] **Step 1: `templates/roadmap.md`** — six required H2 sections (exact headings, the test script asserts them):

```
## Epics
## Sprint Ledger
## Decisions (ADR)
## Asset Disposition
## Open Questions
## Cross-cutting
```

Each with a one-row worked example (Epics row includes a DoD cell; Sprint Ledger row includes all spec §2.1b fields).

- [ ] **Step 2: `templates/plan.md`** — header block (sprint id, epic ref, state copy, date) + five required H2 sections (exact headings):

```
## Decisions (D-x)
## Stories & Tasks
## Definition of Done
## Acceptance Scenarios (S1–Sn)
## Handover Clauses
```

Include the invariant comment: *DoD is copied verbatim from the roadmap epic row; changes go to the roadmap, never edited here.*

- [ ] **Step 3: `templates/acceptance-record.md`** — sections: `## Verdict`, `## Scenario Results` (table: id / command / expected / actual / pass), `## DoD Checklist`, `## Obstacles (verbatim)`, `## Doc-Drift Audit`.

- [ ] **Step 4: `templates/handover-clause.md`** — field block: `id / issuer sprint / target sprint / trigger / obligation / status (open|discharged) / evidence`.

- [ ] **Step 5: `templates/debt-entry.md`** — row format: `id / date / severity / owner / description / repayment criteria / status / evidence commit`.

- [ ] **Step 6: `templates/agents-sections.md`** — the exact §5 config block from the spec (roadmap / notes / plans / acceptance / debt_tracker / wip_limit / gates / doc_sync_map), placeholder commands marked.

- [ ] **Step 7: Commit**

```bash
git add templates
git commit -m "feat: six artifact templates (roadmap, plan, acceptance, clause, debt, agents-sections)"
```

---

### Task 8: `tests/check-artifacts.mjs` (the only code — TDD-style red/green verification)

**Files:**
- Create: `tests/check-artifacts.mjs`

Zero npm deps, Node ≥ 20. Reads templates dir from `process.env.TEMPLATES_DIR ?? 'templates'` and skills dir from `process.env.SKILLS_DIR ?? 'skills'` (env overrides exist solely to enable the negative test below).

Checks:
1. **Bilingual pairing** — every `skills/*/SKILL.md` has a sibling `SKILL.zh.md`; both non-empty; both start with `---` on line 1; exactly 5 skill dirs.
2. **Template completeness** — required H2 headings per template (exact sets from Task 7 Steps 1–3). For `handover-clause.md` and `debt-entry.md`: assert the defined field labels are present verbatim (`id`, `trigger`, `obligation`, `status`, `evidence` / `id`, `date`, `severity`, `owner`, `repayment criteria`, `status`, `evidence commit`).
3. **Assembly dry-run** — in a temp dir: splice `agents-sections.md` into a fixture AGENTS.md; assert the assembled output contains every config key (`roadmap`, `notes`, `plans`, `acceptance`, `debt_tracker`, `wip_limit`, `gates`, `doc_sync_map`); copy `roadmap.md`/`plan.md` templates, **simulate the fill-in first (regex-replace each `<!-- placeholder: ... -->` comment with an example line — a bare copy would fail its own check by construction)**, then assert headers block + all required H2s present and no `<!-- placeholder:` remains.

Exit 0 with a summary line `check-artifacts: OK (n checks)`; non-zero + `check-artifacts: FAIL <reason>` on any miss.

- [ ] **Step 1: Write the script**
- [ ] **Step 2: Run green**

Run: `node tests/check-artifacts.mjs`
Expected: `check-artifacts: OK`, exit 0.

- [ ] **Step 3: Verify red path (proves the checks can fail)**

```bash
tmp=$(mktemp -d) && cp -r templates "$tmp/templates" && cp -r skills "$tmp/skills" \
  && sed -i 's/^## Definition of Done$/## Done/' "$tmp/templates/plan.md" \
  && TEMPLATES_DIR="$tmp/templates" SKILLS_DIR="$tmp/skills" node tests/check-artifacts.mjs
echo "exit=$?"
```

Expected: `check-artifacts: FAIL ...` and `exit=1`... one nuance: `sed -i` breaks the heading → completeness check must catch it. Then clean: `rm -rf "$tmp"`.

- [ ] **Step 4: Commit**

```bash
git add tests/check-artifacts.mjs
git commit -m "test: check-artifacts — bilingual pairing, template completeness, assembly dry-run"
```

---

### Task 9: Self-hosting `roadmap.md` (dogfood)

**Files:**
- Create: `roadmap.md` (repo root — note: NOT `docs/roadmap.md`; root path is the documented self-host override)

- [ ] **Step 1: Bootstrap from own template** — copy `templates/roadmap.md`, fill:
  - Epic: `E1 — plugin v0.1.0 published` with DoD (5 skills validate clean / templates complete via check-artifacts / bilingual pairs / README bilingual / marketplace installs locally via `--plugin-dir`)
  - Sprint Ledger row: `S1` → this v0 sprint, epic `E1`, worktree `-` (main), state `active`
  - ADR row: `D1` — skills-only (no commands/), artifact-contract coupling to superpowers, five-skill set (cites spec)
  - Open Questions: the two from spec §10, plus a third: **CI workflow file deferred until hosting is decided (§10.1) — local final gates stand in; record here so the deferral is not silent drift**
- [ ] **Step 2: Run `node tests/check-artifacts.mjs`** — still OK (roadmap.md at root is not the template; no interference).
- [ ] **Step 3: Commit** — `git add roadmap.md && git commit -m "docs: self-hosting roadmap (E1 plugin v0.1.0, ledger S1, ADR D1)"`

---

### Task 10: README bilingual + final gates + version close

**Files:**
- Create: `README.md`
- Create: `README.zh-CN.md`
- Modify: `CHANGELOG.md` (drop `(unreleased)` → date 2026-10-01)

- [ ] **Step 1: `README.md` (EN)** — sections:
  1. What it is — iteration layer; pairs with superpowers (one table: strategy vs tactics)
  2. **Terminology first screen** — Scrum mapping (epic/sprint/DoD/story/review) + the four new nouns (sprint ledger / handover clause / early start / deferred dependency), one line each; two explicit diffs from standard Scrum (value-boxed not time-boxed; DoD at epic level)
  3. Install — `/plugin marketplace add <owner>/supervibe` → `/plugin install supervibe@supervibe`; local dev: `claude --plugin-dir .`
  4. The five skills — one line each + `/supervibe:...` invocation
  5. Host AGENTS.md config section (the §5 block)
  6. Degradation: works without superpowers (artifact contract, manual fill)
  7. Dev: `node tests/check-artifacts.mjs`, `claude plugin validate . --strict`
- [ ] **Step 2: `README.zh-CN.md`** — faithful mirror.
- [ ] **Step 3: Final gates**

```bash
claude plugin validate . --strict && node tests/check-artifacts.mjs
```

Expected: both green.

- [ ] **Step 3b: Local-install smoke (closes the E1 DoD item "marketplace installs locally via --plugin-dir")** — run `claude --plugin-dir . -p "list your available supervibe skills, one line each" ` (or equivalent one-shot invocation); expected: the session starts and recognizes the supervibe skills. If the one-shot form is impractical in the harness, an interactive `claude --plugin-dir .` start with a `/supervibe:roadmap` skill listing counts as evidence — record which form was used in the commit message.

- [ ] **Step 4: CHANGELOG 0.1.0 dated**; **Step 5: Commit**

```bash
git add README.md README.zh-CN.md CHANGELOG.md
git commit -m "docs: bilingual README (terminology table, install, config, degradation); 0.1.0"
```

- [ ] **Step 6: Ledger update** — `roadmap.md` S1 state → merged (with the Task-10 commit hash); commit. v0.1.0 tag optional at publish time, not now (hosting URL unresolved — spec §10.1).

---

## Exit criteria (whole plan)

- `claude plugin validate . --strict` green
- `node tests/check-artifacts.mjs` green (incl. proven red path)
- 5 skills × 2 languages, 6 templates, self-hosting roadmap, bilingual README — exactly the spec §8 manifest, nothing more
- Publish itself (hosting, homepage URL, tag) remains open per spec §10.1 — out of plan scope
