# SuperVibe v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship supervibe v0.1.0 — a Claude Code plugin (iteration-management layer pairing with superpowers) with 5 bilingual skills, 6 artifact templates, 1 validation test script, self-marketplace manifest, and bilingual README.

**Architecture:** Pure-content plugin: no runtime code except one zero-dependency Node validation script. Skills are imperative instruction documents (EN source of truth + ZH mirror); templates are plain markdown with placeholder comments; all project specifics stay in host AGENTS.md. Coupling to superpowers is artifact-contract only (dispatch-if-present, degrade gracefully). **Artifact model (2026-10-01 revision): dated directory tree under `docs/superpowers/{roadmaps,sprints,acceptances}/`, decentralized ledger in doc frontmatter, epic doc carries Sprint-breakdown stub rows for pre-start states.**

**Tech Stack:** Claude Code plugin format (`.claude-plugin/plugin.json` + `marketplace.json`, skills-only), Node ≥ 20 for `tests/check-artifacts.mjs`, `claude plugin validate --strict` as gate.

**Spec:** `docs/superpowers/specs/2026-10-01-supervibe-v0-design.md` (authoritative; revision approved through review round 3, commit f3133be — read §1 术语策略, §2 domain model, §3 SDO 铁律 before Task 2)

**Rebaseline note (2026-10-01):** Tasks 2–10 rewritten to the revised artifact model. Task 1 remains complete from the first pass (checkboxes kept; plugin.json URLs since resolved to `https://github.com/WayJ/supervibe` by the orchestrator, commit bfab215). Task 2's earlier delivery (`skills/roadmap`, commits 551ae82/bd5f798) implements the OLD single-file model with a workflow-summary description — it is reopened and will be **rewritten**, not patched.

**Conventions for all tasks:**

- Windows Git Bash. Repo root = `D:/lc_projects/blue_dsh/supervibe`. Branch: `feat/v0-scaffold`. Remote: `git@github.com:WayJ/supervibe.git`.
- Commit identity: `git -c user.name="jw083" -c user.email="jw083@local" commit`.
- Every SKILL.md (EN and ZH) starts with `---` on line 1.
- EN skill bodies: imperative, terse, ≤ ~160 lines each. ZH mirror: faithful translation, technical terms stay English.
- **SDO 铁律 (from superpowers 6.x writing-skills, spec §3): `description` = trigger conditions ONLY ("Use when..." style, Scrum trigger words first), NEVER a workflow summary. Keep frontmatter ≤ 1,024 chars; description aim < 300.**
- Config keys (host AGENTS.md `## supervibe` section, spec §5): `roadmaps_dir` / `sprints_dir` / `acceptances_dir` / `notes` / `debt_tracker` / `wip_limit` + `### gates` + `### doc_sync_map`. Skills never hardcode paths; defaults mirror spec §5.
- No file outside spec §8 manifest gets created (YAGNI). Exception already landed by orchestrator: `.gitignore`. (`AGENTS.md` is created by Task 9, not yet present.)

---

### Task 1: Plugin manifest + self-marketplace + LICENSE + CHANGELOG ✅ (complete)

Delivered in commits f43c922 + 9fca26b (marketplace description fix) + bfab215 (URLs resolved to github.com/WayJ/supervibe, author WayJ). Keep as-is.

- [x] plugin.json / marketplace.json / LICENSE / CHANGELOG.md, validate --strict passing

---

### Task 2 (REOPENED — rewrite): `roadmap` skill (EN + ZH) to the revised model

**Files:**
- Rewrite: `skills/roadmap/SKILL.md`
- Rewrite: `skills/roadmap/SKILL.zh.md`

Frontmatter (EN file — exactly this):

```yaml
---
name: roadmap
description: Use when the user mentions the roadmap, an epic, ADR decisions, open questions, asset disposition, tech debt, or wiring a project to supervibe.
argument-hint: [scaffold|epic|breakdown|adr|question|asset|debt|ready|close]
---
```

Body sections (in order):

1. `# supervibe:roadmap — strategic truth source` — one-paragraph scope: the `docs/superpowers/{roadmaps,sprints,acceptances}/` tree plus the AGENTS.md supervibe section. State: no central index file; state lives in doc frontmatter; ids by directory scan.
2. `## Read host config first` — grep the AGENTS.md `## supervibe` section; resolve configured dirs; verify they exist; missing → STOP and direct to `scaffold` or a config fix; never implicitly create artifacts outside `scaffold`. If the host's `doc_sync_map` covers an artifact path, the map takes precedence.
3. `## scaffold` — per §5 config paths create `roadmaps/`, `sprints/`, `acceptances/` dirs + splice `templates/agents-sections.md` into AGENTS.md + create the notes dir. **Never write `plans/` (superpowers execution domain).** Idempotent per artifact: existing dirs/sections untouched + diff proposal; missing ones created.
4. `## epic` — create `roadmaps/YYYY-MM-DD-<epic>.md` from `templates/epic.md`: frontmatter `{epic id (scan roadmaps/ for max+1), status: open, date}` + seven sections. **Reject if DoD missing.** `breakdown` subcommand: append stub rows `{sprint id (scan sprints/ docs AND all epic stub rows for max+1), state: planned, note}`.
5. `## adr` — append numbered decision row to the epic doc's ADR section + amendment rows; global numbering by scanning all epic docs; enforce doc-before-code narrative (decision text written before implementation; retroactive additions must flag the violation).
6. `## question` — open/close/defer open questions with decision-record links (ADR id / note / evidence commit).
7. `## asset` — update asset disposition (reuse / retire / re-order / watch); assets with no owning epic are a smell — name it.
8. `## debt` — add entry via `templates/debt-entry.md` (severity/owner/repayment criteria required); repay with evidence commit hash (no hash, no closure); create the tracker file with header if missing; route observation items to an owning epic.
9. `## ready / close` — `ready`: stub row planned→ready in the epic's breakdown section (go decision is strategic). `close`: sprint doc frontmatter state →closed, **precondition: state is merged only — closed does not block on handover clauses** (their lifecycle is independent; R3.6 evidence). No matching sprint doc → reject naming the unknown id. Epic doc status open→closed when its sprints are closed and no open questions block.
10. `## Invariants` — every mutation appends date + evidence link; ids never reused; never edit state owned by another skill.

Steps:

- [x] **Step 1:** Read spec §2 + current `skills/roadmap/SKILL.md` (the old-model text being replaced)
- [x] **Step 2:** Rewrite `skills/roadmap/SKILL.md` per above (EN source of truth, 90–160 lines)
- [x] **Step 3:** Rewrite `skills/roadmap/SKILL.zh.md` (faithful mirror, same frontmatter keys, description value natural Chinese, argument-hint unchanged)
- [x] **Step 4:** Validate: `claude plugin validate . --strict` — must pass
- [x] **Step 5:** Commit: `git add skills/roadmap && git commit -m "feat!: rewrite roadmap skill to dated-directory artifact model (epic docs, stub breakdown, decentralized ledger), SDO description, EN+ZH"`

---

### Task 3: `start` skill (EN + ZH)

**Files:**
- Create: `skills/start/SKILL.md`
- Create: `skills/start/SKILL.zh.md`

Frontmatter (EN):

```yaml
---
name: start
description: Use when the user says start, begin, kick off, or pull a sprint, epic, or iteration.
argument-hint: <epic-id> <sprint-id>
---
```

Body sections:

1. `# supervibe:start — open a sprint`
2. `## Read host config` — same gate pattern as the rewritten roadmap skill (copy from it: section-existence + path-resolution existence + stop-don't-create).
3. `## Locate the stub` — inputs are epic id + sprint id; find the epic doc in `roadmaps/`; find the `ready` stub row in its Sprint-breakdown section (stub id mandatory — one epic may hold several ready stubs = parallel waves). Unknown ids → reject naming them; stub not in ready state → reject.
4. `## Readiness adjudication` — dependency check; count active sprints (scan `sprints/` frontmatter `state`) vs `wip_limit` (at limit → stop, name them); early-start ruling (estimate file intersection with active sprints — safe if ≈ zero; set `early-start: true` in the new doc's frontmatter); deferred-dependency ruling (register a handover clause per `templates/handover-clause.md` in THIS sprint doc's Handover Clauses section — issuing side is the single source of truth; **clause id HC#: scan all sprint docs' Handover Clauses sections for max+1**; target reference per migration rule: target doc exists → add HC# to its frontmatter `clauses`; future sprint → record `target: <epic> breakdown S#` in the clause itself).
5. `## Read history first` — search the notes dir for prior entries matching this epic's domain + stack; extract relevant lessons into the plan's Decisions (D-x) context; cite source entries.
6. `## Materialize the sprint doc` — create `sprints/YYYY-MM-DD-<sprint>-plan.md` from `templates/sprint.md`: frontmatter `{sprint id, epic ref, state: active, worktree/branch, early-start, deferred-dependency refs, clauses: [], merged commit hash: null}`; five body sections with **DoD copied verbatim from the epic doc — never edited in place; changes go back to the epic doc**; stub row state →`started` (id pointer kept). Write the opening note `<notes>/YYYY-MM-DD-<sprint>-open.md` (four-section structure per spec §2.4).
7. `## Dispatch execution` — if superpowers skills available: invoke `superpowers:brainstorming` then `superpowers:writing-plans`, directing both to fill the materialized doc path; five-section structure + verbatim DoD are immutable. Otherwise print manual instructions.

Steps: write EN → write ZH mirror → validate --strict → commit `feat: start skill (stub materialization, adjudication, read-history, dispatch), EN+ZH`.

- [x] Step 1–4

---

### Task 4: `accept` skill (EN + ZH)

Frontmatter (EN):

```yaml
---
name: accept
description: Use when the user asks to accept, review, or verify a sprint, or asks whether a sprint is done.
argument-hint: <sprint-id or plan path>
---
```

Body sections:

1. `# supervibe:accept — sprint review gate`
2. `## Inputs` — sprint doc path; config (acceptances dir, doc_sync_map).
3. `## Execute scenarios` — each S-scenario runs for real (browser, CLI, stack commands as specified). **Evidence before claims — never claim pass without a fresh run** (identify the proving command → run it → read full output → only then claim). On obstacles: search notes history for prior workarounds; reuse and cite the source entry.
4. `## DoD checklist` — every item checked with evidence; substituted evidence labeled as such.
5. `## Obstacles log` — verbatim recording; no greenwashing.
6. `## Doc-drift audit` — periodic doc-sync pass against doc_sync_map; drift report section.
7. `## Verdict + record` — write `acceptances/YYYY-MM-DD-<sprint>-acceptance.md` from template; verdict pass/blocked; **update the sprint doc frontmatter** state →acceptance.

Steps: EN → ZH → validate → commit `feat: accept skill (evidence-before-claims scenarios, DoD, obstacles log, drift audit), EN+ZH`.

- [x] Step 1–4

---

### Task 5: `merge` skill (EN + ZH)

Frontmatter (EN):

```yaml
---
name: merge
description: Use when the user says merge, close out, ship, finish, or wrap up a sprint.
argument-hint: <sprint-id>
---
```

Body sections:

1. `# supervibe:merge — sprint close-out`
2. `## Ordered sequence, stop on red` — 1) gates: every AGENTS.md gates command + doc-sync arrears final check (any owed doc without a same-commit change blocks); 2) acceptance verdict pass in place; 3) merge to main — conflict checklist per spec §2.5 (generated → regenerate and compare; handwritten → item-by-item review list); 4) worktree/branch teardown; 5) **sprint doc frontmatter** finalized: state →merged + merge commit hash; 6) handover clauses fired — now binding on target sprints (target refs already placed at registration); 7) closing note per §2.4 (`YYYY-MM-DD-<sprint>-close.md`, evidence commit hash, cross-referenced with the acceptance record).
3. `## Never` — no red gate, no missing verdict; clause discharge belongs to sync, never here.

Steps: EN → ZH → validate → commit `feat: merge skill (gates, arrears check, close-out sequence, clause firing), EN+ZH`.

- [x] Step 1–4

---

### Task 6: `sync` skill (EN + ZH)

Frontmatter (EN):

```yaml
---
name: sync
description: Use when the user says sync, pull main, update branches, or integrate upstream changes.
argument-hint: [sprint-id|all]
---
```

Body sections:

1. `# supervibe:sync — cadence + clause discharge`
2. `## Cadence merge` — `origin/main` into the named sprint (or all frontmatter-active sprints).
3. `## Conflict re-verify checklist` — generated → regenerate and compare; handwritten → item-by-item review list; report.
4. `## Handover clause check` — scan `sprints/` frontmatter `clauses` references; resolve each HC# to its issuing doc's Handover Clauses section for the obligation text; diff incoming changes against triggers (path/feature hit → surface the obligation verbatim).
5. `## Discharge` — when the obligation is verified on the target side: record evidence (commit hash / verification transcript) and set the clause `status: discharged` **in the issuing doc's clause record** (single authority); leave a dated evidence link.

Steps: EN → ZH → validate → commit `feat: sync skill (cadence, conflict checklist, HC# resolution, discharge), EN+ZH`.

- [ ] Step 1–4

---

### Task 7: Six artifact templates (revised model)

Common rules: plain markdown; fill-in points use the EXACT placeholder syntax `<!-- placeholder: ... -->` (Task 8's dry-run regex asserts on this precise prefix — generic `<!-- -->` comments would make the no-residue check vacuously pass); one worked example row per table; no templating engine.

**Files:**
- Create: `templates/epic.md`
- Create: `templates/sprint.md`
- Create: `templates/acceptance-record.md`
- Create: `templates/handover-clause.md`
- Create: `templates/debt-entry.md`
- Create: `templates/agents-sections.md`

- [ ] **Step 1: `templates/epic.md`** — frontmatter `{epic: E#, status: open, date}` + seven required H2s (exact headings, asserted by tests):

```
## Deliverables
## Definition of Done
## Sprint Breakdown
## Decisions (ADR)
## Asset Disposition
## Open Questions
## Cross-cutting
```

Each with a one-row worked example; Sprint Breakdown example shows a `planned` row and a `started` row.

- [ ] **Step 2: `templates/sprint.md`** — frontmatter block with ALL ledger fields (`sprint`, `epic`, `state`, `worktree`, `early-start`, `deferred-dependency`, `clauses`, `merged-commit`) + five required H2s:

```
## Decisions (D-x)
## Stories & Tasks
## Definition of Done
## Acceptance Scenarios (S1–Sn)
## Handover Clauses
```

Invariant comment: DoD copied verbatim from the epic doc; changes go to the epic doc, never here. Handover Clauses section carries the clause record format inline (id HC# / target / trigger / obligation / status / evidence).

- [ ] **Step 3: `templates/acceptance-record.md`** — `## Verdict`, `## Scenario Results` (id/command/expected/actual/pass), `## DoD Checklist`, `## Obstacles (verbatim)`, `## Doc-Drift Audit`.
- [ ] **Step 4: `templates/handover-clause.md`** — field block: `id HC# / issuer sprint / target sprint / trigger / obligation / status (open|discharged) / evidence`.
- [ ] **Step 5: `templates/debt-entry.md`** — row: `id / date / severity / owner / description / repayment criteria / status / evidence commit`.
- [ ] **Step 6: `templates/agents-sections.md`** — the exact §5 config block (new keys `roadmaps_dir`/`sprints_dir`/`acceptances_dir`/`notes`/`debt_tracker`/`wip_limit`/gates/doc_sync_map), placeholder commands marked.
- [ ] **Step 7:** Commit `feat: six artifact templates for the dated-directory model (epic seven-section, sprint frontmatter ledger, clause, debt, agents-sections)`

---

### Task 8: `tests/check-artifacts.mjs`

Zero npm deps, Node ≥ 20. Env overrides `TEMPLATES_DIR`/`SKILLS_DIR` (for the negative test).

Checks:
1. **Bilingual pairing** — every `skills/*/SKILL.md` has sibling `SKILL.zh.md`; both non-empty; both line-1 `---`; exactly 5 skill dirs.
2. **Template completeness** — epic.md: the seven exact H2s; sprint.md: the five exact H2s + all eight frontmatter ledger keys; acceptance-record.md: its five H2s; handover-clause.md + debt-entry.md: field labels present verbatim.
3. **Assembly dry-run** — temp dir: splice `agents-sections.md` into a fixture AGENTS.md; assert config keys `roadmaps_dir`, `sprints_dir`, `acceptances_dir`, `notes`, `debt_tracker`, `wip_limit`, `gates`, `doc_sync_map` all present; copy epic/sprint templates, simulate fill-in (regex-replace each `<!-- placeholder: ... -->` with an example line), assert required H2s present and no `<!-- placeholder:` remains.

Exit 0 + `check-artifacts: OK (n checks)`; non-zero + `check-artifacts: FAIL <reason>` otherwise.

- [ ] **Step 1:** Write script
- [ ] **Step 2:** `node tests/check-artifacts.mjs` → OK, exit 0
- [ ] **Step 3:** Red path — copy templates+skills to temp, `sed -i 's/^## Definition of Done$/## Done/' "$tmp/templates/sprint.md"`, run with env overrides → FAIL, exit 1; clean up
- [ ] **Step 4:** Commit `test: check-artifacts — pairing, seven/five-section completeness, ledger keys, assembly dry-run`

---

### Task 9: Self-hosting artifacts (dogfood)

**Files:**
- Create: `docs/superpowers/roadmaps/2026-10-01-v0.md`
- Create: `AGENTS.md` (repo root)

- [ ] **Step 1:** Epic doc from `templates/epic.md`: `epic: E1`, title "plugin v0.1.0 published"; DoD (5 skills validate clean / templates complete via check-artifacts / bilingual pairs / README bilingual / marketplace installs via `--plugin-dir`); **Sprint Breakdown row: `S1, started, v0 implementation sprint (this branch)`** — demonstrating the stub lifecycle; ADR `D1` skills-only + artifact-contract coupling + five-skill set (cite spec); ADR `D2` dated-directory artifact model + decentralized ledger (cite spec revision f3133be); Open Questions: six entries — hosting (status closed, resolved by bfab215 → github.com/WayJ/supervibe), acceptance-verifier subagent (v0.2, YAGNI, open), CI workflow file deferred until hosting CI chosen (open; local gates stand in), stub-row cancellation flow (open: a stale planned/ready stub has no defined cancellation path and would block epic close — deferred to a spec revision, surfaced by Task 2 quality review), WIP-count semantics (open: acceptance-state sprints currently do NOT count toward wip_limit — intentional (transient review state) but undocumented in spec; surfaced by Task 3 quality review), acceptance→active rollback path (open: a state-flipped sprint whose merge hits a red gate has no defined way back to active for rework; surfaced by Task 4 quality review).
- [ ] **Step 2:** `AGENTS.md` — the §5 supervibe section with this repo's real values (roadmaps/sprints/acceptances dirs under `docs/superpowers/`, notes `.agents/notes/`, debt tracker path, wip_limit 1, gates: `claude plugin validate . --strict` + `node tests/check-artifacts.mjs`).
- [ ] **Step 3:** `node tests/check-artifacts.mjs` still OK; commit `docs: self-hosting epic E1 (S1 started stub demo) + AGENTS.md supervibe config`

---

### Task 10: README bilingual + final gates + version close

**Files:**
- Create: `README.md`
- Create: `README.zh-CN.md`
- Modify: `CHANGELOG.md` (date 2026-10-01)

- [ ] **Step 1: `README.md` (EN)** — 1) what it is + pairing table (strategy vs tactics); 2) terminology first screen: Scrum mapping + four new nouns + two explicit diffs from Scrum; **artifact-tree diagram** (`docs/superpowers/{specs,plans,roadmaps,sprints,acceptances}/` with one line each); 3) install: `/plugin marketplace add WayJ/supervibe` → `/plugin install supervibe@supervibe`; local dev `claude --plugin-dir .`; 4) five skills one line each; 5) host AGENTS.md config block; 6) degradation without superpowers; 7) dev: validate + check-artifacts commands.
- [ ] **Step 2:** `README.zh-CN.md` faithful mirror.
- [ ] **Step 3:** Final gates: `claude plugin validate . --strict && node tests/check-artifacts.mjs` — both green.
- [ ] **Step 3b:** Local-install smoke (closes the E1 DoD item): one-shot `claude --plugin-dir . -p "list your available supervibe skills, one line each"` — session starts and recognizes the skills; record the form used in the commit message.
- [ ] **Step 4:** CHANGELOG 0.1.0 dated; commit `docs: bilingual README (terminology, artifact tree, install, config, degradation); 0.1.0`.
- [ ] **Step 5:** Sprint state →merged with the Task-10 commit hash recorded in the E1 breakdown stub note (no S1 doc exists — v0 ran on the plan, dogfood ledger note suffices; per spec §2.2 S1 materialization is the post-v0 norm); tag `v0.1.0` optional at publish.
- [ ] **Step 6: Publish close-out (explicit)** — via superpowers:finishing-a-development-branch: merge `feat/v0-scaffold` to main, push main; then verify public install: `/plugin marketplace add WayJ/supervibe` succeeds and lists supervibe (record the marketplace name used). This closes the exit criterion "public marketplace install verified".

---

## Exit criteria (whole plan)

- `claude plugin validate . --strict` green
- `node tests/check-artifacts.mjs` green (incl. proven red path)
- 5 skills × 2 languages (SDO-compliant descriptions), 6 templates (epic seven-section / sprint ledger frontmatter), self-hosting epic + AGENTS.md, bilingual README — exactly the spec §8 manifest, nothing more
- All work merged to main and pushed to `git@github.com:WayJ/supervibe.git`; public marketplace install verified
