---
name: roadmap
description: Use when the user mentions the roadmap, an epic, ADR decisions, open questions, asset disposition, tech debt, or wiring a project to supervibe.
argument-hint: [scaffold|epic|breakdown|adr|question|asset|debt|ready|close]
---

# supervibe:roadmap — strategic truth source

Own the supervibe side of the dated artifact tree — `roadmaps/` (one `YYYY-MM-DD-<epic>.md` doc per epic), `sprints/` (one `YYYY-MM-DD-<sprint>-plan.md` doc per sprint), and `acceptances/` (default root `docs/superpowers/`, siblings of the superpowers execution dirs `specs/` and `plans/`) — plus the `## supervibe` section of the host's AGENTS.md. The shared common-dir ledger owns runtime state, reservations and WIP. Markdown remains the versioned planning contract and state projection; it is not a competing runtime authority. Terminology is Scrum-aligned: epic / sprint / DoD (Definition of Done) / story; a sprint is value-boxed — closed by DoD, never time-boxed. Sprint state is stored in two stages: pre-start (`planned` / `ready`) lives only in the epic doc's Sprint Breakdown stub rows; reservation onward lives in shared state and is projected into sprint frontmatter. Zero stack assumptions: paths, gate commands, and doc-sync mappings live in the host AGENTS.md — never hardcode any.

Dispatch on the subcommand argument (`scaffold|epic|breakdown|adr|question|asset|debt|ready|close`). If it is absent or unrecognized, list the subcommands and ask. Every path below comes from host config, not from assumptions about the host repo layout.

## Entry routing — before iteration side effects

First resolve the user's execution intent, before reading/initializing the shared ledger, asking for epic/sprint IDs, confirming iteration configuration, scaffolding, reserving WIP, or creating any iteration artifact. The default is **coordinator-led multi-agent iteration**. Explicit single-agent work with no subagents routes directly to available **superpowers** execution skills; do not activate SuperVibe iteration mode or create/change its state. Preserve the no-subagents constraint in that handoff. If superpowers is unavailable, report the missing capability; do not initialize an iteration as a fallback.

The pure helper `node "<plugin base dir>/scripts/iteration-route.mjs"` reads `{ "execution": "solo" }` or `{ "execution": "iteration" }` on stdin (omitted execution defaults to iteration). It only reports routing intent; it neither invokes skills nor probes harness capabilities. In iteration mode, use exactly native/harness or external/orca, inspect actual capabilities, and stop when the selected route is unavailable — never silently execute solo. `maxWorkers: 1` means **one worker plus the coordinating main agent**, not solo. The remaining instructions apply only after the iteration route is selected.

## Shared runtime authority

Read `<plugin base dir>/docs/shared-ledger.md`. From the host repository root run
`node "<plugin base dir>/scripts/shared-ledger.mjs" status` and reconcile the
requested sprint with its shared entry. The common-dir store, not Markdown,
owns runtime state and WIP; frontmatter checks below are projection checks.
No store → stop for explicit init/import, **except scaffold**, which may prepare directories/config and the authorized initial main commit before initialization. Use `doctor` to diagnose carrier or
projection drift; never silently recover authority from a branch copy. Every
mutation below requires `--id <sprint-id> --revision <current-revision>
--operation <unique-operation-id>`; reread status for each new action and keep
the same operation ID for an exact uncertain retry. Do not hand-edit the store.


## Read host config first

Before any subcommand, grep the host AGENTS.md for the `## supervibe` section:

- Config keys: `roadmaps_dir`, `sprints_dir`, `acceptances_dir`, `notes`, `debt_tracker`, `wip_limit`; subsections `### gates` and `### doc_sync_map`.
- Defaults when a key is absent: `roadmaps_dir: docs/superpowers/roadmaps/`, `sprints_dir: docs/superpowers/sprints/`, `acceptances_dir: docs/superpowers/acceptances/`, `notes: .agents/notes/`, `debt_tracker: docs/tech-debt-tracker.md`, `wip_limit: 3`.
- If the section is absent entirely, the only legal next action is `scaffold` — refuse everything else and say so.
- Once the section exists, resolve the configured dirs this subcommand touches and verify they exist. Missing → STOP: direct the user to run `scaffold` or fix the config path; never implicitly create artifacts outside `scaffold` — a config path typo must not silently fork the truth source.
- Resolve templates as `<plugin base dir>/templates/<file>`; never assume they live in the host repo.
- Read gate commands from `### gates`; never invent commands, runners, or stack specifics.
- Consult `### doc_sync_map` before any edit that touches a mapped path. If the map covers an artifact path this skill writes (epic doc, sprint doc, debt tracker), the map takes precedence — the "artifacts this skill writes are themselves documentation and owe no further doc-sync" exemption applies only to paths the map does not cover.

Collaboration configuration has no default: `collaboration_mode` / `collaboration_provider` must be selected as `native` / `harness` or `external` / `orca`. During scaffold, explain both routes and ask the user to choose; leave them explicitly unconfigured if no choice is supplied. Existing selections are not overwritten. Missing/invalid config blocks delegation, not roadmap editing; unavailable capabilities never silently change the selection. See [collaboration modes](../../docs/collaboration-modes.md).

At overall iteration/epic kickoff, before its first sprint starts, ask once for the worker concurrency cap and Orca worker harness/mixing choices, then confirm/save the iteration policy with user provenance. Host mode/provider is only a proposal; resume reuses the confirmed shared snapshot. Do not confuse worker cap with sprint WIP or fabricate defaults. See the kickoff rules in [collaboration modes](../../docs/collaboration-modes.md).

## scaffold

Wire a repo to supervibe:

1. Create the three artifact dirs at their configured paths: `roadmaps_dir`, `sprints_dir`, `acceptances_dir`.
2. Splice `templates/agents-sections.md` into AGENTS.md as the `## supervibe` section. If AGENTS.md does not exist yet, create it containing just the spliced section.
3. Create the notes dir (default `.agents/notes/`).
4. Git does not preserve empty directories: in each **empty, supervibe-owned** artifact/notes directory that must survive a new worktree, create a `.gitkeep` placeholder only if no content/placeholder already preserves it. Do not touch nonempty directories, unrelated paths, existing files, or `specs/`/`plans/`. Include the placeholders with AGENTS.md and the other scaffold changes in the same **authorized scaffold commit** before starting a worktree; never create a broader commit or push implicitly. If committing is not authorized, show the pending scaffold diff and explain that new worktrees will not inherit it yet.

5. **After the authorized scaffold commit**, verify the selected main branch exists and has a commit, then explicitly run shared-ledger `init --sprints-dir "<dir>" --limit "<n>"` for a new runtime or `import` to migrate existing docs. Optional `--main <branch>` defaults to main and fixes authoritative mainRef. If the initial commit/main is not available or authorized, stop and report before initialization; do not invent a branch or broader commit. Keep common-dir state out of Git commits.

**Never write `plans/` — that is the superpowers execution domain.** `specs/` and `plans/` stay owned by the execution layer; scaffold touches neither.

**Idempotent, per artifact: existing sections and nonempty dirs stay untouched and produce a diff proposal; missing dirs are created, and empty owned dirs are preserved as above.** An existing AGENTS.md `## supervibe` section gets a printed diff of what scaffold would add, for the user to apply manually; existing directories are left as is except the narrowly scoped empty-directory preservation above. The debt tracker is not created here — the `debt` subcommand creates it on first entry.

## epic

Create `<roadmaps_dir>/YYYY-MM-DD-<epic>.md` from `templates/epic.md`:

- Frontmatter: `{epic: E#, status: open, date}` — epic id by scanning every doc in `roadmaps/` for max+1.
- Body sections per the template: Deliverables / Definition of Done / Overall Acceptance Scenarios / Final Acceptance / Sprint Breakdown / Decisions (ADR) / Asset Disposition / Open Questions / Cross-cutting.
- **Reject if DoD missing** — an epic without a Definition of Done is invalid; stop and ask for one. DoD lives at epic level; sprint docs copy it verbatim, and later changes happen here by amendment, never inside a sprint doc.

Before implementation, define independent **Overall Acceptance Scenarios** for the integrated Roadmap outcome, with stable IDs, required modality/environment, steps and expected observations in the `supervibe-acceptance-plan` block. These are not the universal DoD: DoD is the reusable quality baseline copied to each sprint; no individual sprint must deliver the entire roadmap. Each breakdown stub must also name its own scope-specific acceptance goals, refined into executable scenarios before its work begins. UI goals require real browser actions and observed results; CI/API checks or screenshots without interaction cannot replace them. Missing required evidence blocks acceptance. Scope amendments require explicit user authorization recorded before a fresh run, never a retroactive green verdict.

`breakdown` subcommand — append stub rows to an epic doc's Sprint Breakdown section: `{sprint id, state: planned, note}`:

- Sprint id by scanning `sprints/` docs **and** every epic doc's stub rows for max+1 — both sources, every time: a pre-start stub has no doc yet, and skipping either side invites id collisions.
- The stub table is the only home for pre-start states. `supervibe:start` materializes a `ready` stub into a sprint doc and flips the stub to `started` (id pointer retained) — never create or materialize a sprint doc from here.

## adr

Append a numbered decision row to the epic doc's Decisions (ADR) section: id, decision, rationale; append amendment rows when a decision later changes.

- Numbering is global across all epics: scan every epic doc's ADR section for max+1; never number within a single epic.
- **Enforce doc-before-code: the decision text must be written into the epic doc before implementation begins.** If implementation already started, record the ADR now, mark it retroactive, and name the discipline breach.
- Link open questions or debt entries the decision settles.
- Every ADR mutation: append date + evidence link.

## question

Manage the epic doc's Open Questions through their lifecycle: open → closed / deferred.

- Open with an id and a one-line statement. Unnumbered questions rot; tracked ones close — everything gets a row.
- Close or defer only with a decision-record link: ADR id, note entry, or evidence commit.
- Reopen by appending a new row that references the old one; never rewrite history.

## asset

Update the epic doc's Asset Disposition for inherited assets. Dispositions: reuse / retire / re-order / watch.

- Record what changed and why — this section exists to stop silent drift between planned and actual reuse.
- Every change: append date + evidence link.
- An asset with no owning epic is a smell — name it, then route the asset to an owning epic or open a question. Floating assets rot.

## debt

- Add an entry to the configured debt tracker via `templates/debt-entry.md`: severity, owner, repayment criteria. An entry without repayment criteria is invalid.
- If the tracker file does not exist, create it with the row-format header per `templates/debt-entry.md` — `scaffold` does not create it.
- Repay: close the entry citing the evidence commit hash — no hash, no closure.
- Route observation items (symptoms without a fix decision) to an owning epic; they ride that epic's DoD, not the tracker's backlog.

## ready / close

This skill owns exactly two state transitions; refuse all others (stub materialization `ready→active` belongs to supervibe:start, `→acceptance` to supervibe:accept, `→merged` to supervibe:complete, clause discharge to supervibe:sync).

- **ready — planned → ready**: flip the stub row's state in the epic doc's Sprint Breakdown section. The go decision is strategic: verify the epic's universal DoD applies and the stub has explicit sprint-specific acceptance goals, then record the decision in the stub note. Detailed readiness adjudication (dependencies, WIP count, early start, deferred dependencies) happens at materialization under supervibe:start. No stub row matches the given sprint id → reject and state which id is unknown.
- **close — → closed**: call shared-ledger `close` with ID/revision/operation flags, then project `state: closed` into the sprint doc on stored mainRef and commit that projection before doctor or the next reserve. The close precondition reads its committed main-branch projection, not the caller's stale branch. **Precondition: current shared state is `merged`, and merged only — closed does not block on handover clauses.** Clause lifecycle is independent of closed: open clauses are discharged by the target side's sync at its own time, and the issuing side may close first (field-proven: R3.6 closed while its clause awaited the target's merge). No sprint doc matches the given id → reject naming the unknown id.
- **Epic closure**: enumerate **every Sprint Breakdown ID**, not a caller-selected subset or only existing shared entries; every planned sprint must have a matching same-epic shared entry in `merged` or `closed`. A planned/ready/unstarted stub, missing entry, or other state blocks closure. Also reconcile all same-epic shared entries, mainline projections and blocking open questions. All sprint passes/merges are necessary but **not sufficient**: require a separate, fresh final integrated acceptance covering the upfront Overall Acceptance Scenarios on the current integrated mainRef content.
- Run `supervibe:accept` for the roadmap's overall scenarios, preserving the same real-environment and no-substitution requirements as sprint review. Use `validate-workflow.mjs roadmap-snapshot --epic "<epic-doc>" --record "<new-final-record>" --main-ref "<stored-mainRef>"` before and after the review; results must bind to that fingerprint. Write an append-only final record, set only `final-acceptance-record` and `final-accepted-at`, then run `roadmap-verify` with the same arguments immediately before closure. Missing, blocked or stale evidence blocks closure. The exact record and only final status/pointer metadata are excluded/normalized to avoid self-reference; changes to scenario plans or integrated inputs require a new review. This guard checks metadata coverage/provenance, not the truth of browser observations — inspect actual artifacts and results.
- Commit the provisional record and pointer metadata within existing authorization, then run `roadmap-verify-clean` with the same arguments: both epic and record must be tracked and the working tree clean. An ignored/uncommitted record cannot authorize closure. Without commit authorization report ready-awaiting-commit, not closed. Only after this clean guard project `status: closed`; the final record pointer and timestamp provide the evidence link without appending body text. Prepare all body notes before snapshot; do not change reviewed content after verification. Commit only within existing authorization. Never treat CI/CD success alone as integrated user acceptance.

## Invariants

- Every mutation in this skill — epic doc, breakdown stub, ADR row, question, asset, debt entry, state flip — appends date + evidence link to the affected row or frontmatter.
- Ids are never reused: epic ids, sprint ids, and ADR numbers come from max+1 scans (an empty scan starts at 1) and stay unique across the whole tree, forever.
- Any subcommand referencing a nonexistent epic or sprint id → reject, naming the unknown id — uniform across all subcommands, not only ready/close.
- Never edit state owned by another skill: sprint-doc states before `closed`, stub `started` flips, handover-clause records, acceptance records.
- Never create a central index file — the directory scan is the aggregation.
