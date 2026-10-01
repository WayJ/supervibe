---
name: start
description: Use when the user says start, begin, kick off, or pull a sprint, epic, or iteration.
argument-hint: <epic-id> <sprint-id>
---

# supervibe:start — open a sprint

Materialize a `ready` stub from an epic doc's Sprint Breakdown into a sprint doc — the single door from planning into execution. Inputs are an epic id and a sprint id, both mandatory: one epic may hold several `ready` stubs (parallel waves), so the sprint id is never inferable from the epic alone. If either argument is missing, ask; never guess a wave.

Pre-start state lives in the stub row; from materialization on, the sprint doc's frontmatter is the ledger, created with `state: active`. A sprint is value-boxed — closed by DoD, never time-boxed; parallelism is bounded by `wip_limit`, not by the calendar.

Around that act: adjudicate readiness, read history, then hand a scaffolded doc to the execution layer. superpowers is the recommended pair — present, dispatch to it; absent, produce the same artifact contract manually. The coupling is artifact-contract only: this skill never forks or rewrites execution-layer skills. Zero stack assumptions: every path comes from host config, never hardcoded.

## Read host config

Before anything, grep the host AGENTS.md for the `## supervibe` section:

- Config keys this skill reads: `roadmaps_dir`, `sprints_dir`, `notes`, `wip_limit`; subsection `### doc_sync_map`.
- Defaults when a key is absent: `roadmaps_dir: docs/superpowers/roadmaps/`, `sprints_dir: docs/superpowers/sprints/`, `notes: .agents/notes/`, `wip_limit: 3`.
- Section absent entirely → STOP: the only legal next action is `supervibe:roadmap scaffold` — direct the user there and refuse everything else.
- Once the section exists, resolve the configured dirs this skill touches (`roadmaps_dir`, `sprints_dir`, `notes`) and verify they exist. Missing → STOP: direct the user to run `supervibe:roadmap scaffold` or fix the config path; never implicitly create artifacts — a config path typo must not silently fork the truth source.
- Resolve templates as `<plugin base dir>/templates/<file>` (here `sprint.md` and `handover-clause.md`); never assume they live in the host repo.
- Consult `### doc_sync_map` before writing the sprint doc: if the map covers an artifact path this skill writes, the map takes precedence — the "artifacts this skill writes owe no further doc-sync" exemption holds only for uncovered paths.
- Gate commands from `### gates` are not this skill's concern — gates bind at accept and merge; starting runs none.

## Locate the stub

- Find the epic doc in `roadmaps_dir` whose frontmatter `epic` id matches. No doc matches → reject, naming the unknown epic id.
- In its Sprint Breakdown section, find the stub row carrying the given sprint id — the id is mandatory because one epic may hold several `ready` stubs (parallel waves). No matching row → reject, naming the unknown sprint id.
- The stub must be in `ready` state:
  - `planned` → reject and route to `supervibe:roadmap ready` — the go decision is strategic and is not made here.
  - `started` → reject: already materialized; name the existing sprint doc (frontmatter `sprint` match in `sprints_dir`).
- Read the stub note before adjudicating: `supervibe:roadmap ready` recorded the strategic go rationale there — it is an input to the rulings below, not a verdict.

## Readiness adjudication

Four rulings before any file is written — each either blocks the start or shapes the doc being created. Every ruling outcome lands in the new doc's frontmatter flags and the opening note's decisions section:

1. **Dependencies** — read the stub note and the epic doc (Deliverables, Cross-cutting) for dependencies naming other sprints.
   - Dependency already merged → satisfied; verify and move on.
   - Dependency on an unmerged sprint → not a stopper; route to ruling 4.
2. **WIP limit** — count active sprints by scanning every doc in `sprints_dir` for frontmatter `state: active`.
   - Count at or above `wip_limit` → stop, naming the active sprints; one of them must merge or close before this start can proceed.
   - An early-started sprint is `active` and counts toward the limit like any other.
3. **Early start** — applies when a sprint this one follows is still in flight (not merged).
   - Estimate the file intersection between this sprint's expected scope (epic Deliverables + stub note) and the in-flight sprints' scopes (from their sprint docs).
   - Intersection ≈ zero → safe: set `early-start: true` in the new doc's frontmatter and record the estimate in the opening note.
   - Material overlap → not safe as an early start: wait, or route the overlap through ruling 4.
4. **Deferred dependency** — implement now on the current baseline as if the depended-on sprint were already merged, and bind the future review with a handover clause.
   - Register the clause per `templates/handover-clause.md` in this sprint doc's Handover Clauses section — the issuing side is the single source of truth for clause text; every other artifact holds references only.
   - **Clause id HC#: scan every sprint doc's Handover Clauses sections for max+1 (an empty scan starts at 1).**
   - Target reference per the migration rule: target sprint doc exists → append the HC# to its frontmatter `clauses` list; future sprint with no doc yet → record `target: <epic> breakdown S#` inside the clause itself.

## Read history first

Notes are a cross-sprint knowledge asset, not a diary — read them before writing a line of plan:

- Search the notes dir for prior entries matching this epic's domain and stack: grep by keywords drawn from the epic doc's Deliverables section (component names, stack nouns, failure modes).
- Prioritize entries whose lessons sections name environment pitfalls, process corrections, or rework root causes — those are the reusable classes.
- Extract relevant lessons into the new doc's Decisions (D-x) context and cite the source entries (file + section); an uncited lesson is opinion, a cited one is evidence.
- An empty notes dir is not an error — a first sprint has no history. Say so and proceed.

## Materialize the sprint doc

1. Create `<sprints_dir>/YYYY-MM-DD-<sprint>-plan.md` from `templates/sprint.md`. The file date is the materialization date (today), not the stub's planning date. Frontmatter `{sprint, epic, state: active, worktree, early-start, deferred-dependency, clauses, merged-commit: null}`:
   - `worktree` — the worktree/branch that will carry this sprint (one sprint = one worktree/branch).
   - `early-start` — the ruling above; `false` when it did not apply.
   - `deferred-dependency` — the HC# refs registered in ruling 4; empty when none.
   - `clauses` — seed with migrated HC# refs: scan every sprint doc's Handover Clauses section for clauses recording `target: <this epic> breakdown S#` matching this stub and pull their ids in — the clause text stays with the issuer, and the reference lands where sync will scan for it. Empty when nothing targets this stub.
2. Fill the five body sections per the template — Decisions (D-x) / Stories & Tasks / Definition of Done / Acceptance Scenarios (S1–Sn) / Handover Clauses. **DoD is copied verbatim from the epic doc's Definition of Done — never edited in place; a DoD change goes back to the epic doc by amendment and is re-copied from there.**
3. Flip the stub row state → `started`, keeping the sprint id pointer; append date + evidence link (the new doc path) to the stub note.
4. Write the opening note `<notes>/YYYY-MM-DD-<sprint>-open.md` per the four-section protocol: background (why this line opened, rulings made) / decisions (with rationale, including rejected options) / lessons (the history extracted above, with citations) / handover (clauses registered here, obligations owed).

## Dispatch execution

Execution belongs to the superpowers layer; this skill only hands over the artifact contract:

- Detect first: check whether `superpowers:brainstorming` and `superpowers:writing-plans` are available as invocable skills.
- Available → invoke `superpowers:brainstorming`, then `superpowers:writing-plans`, directing both to fill the materialized doc path. **The five-section structure and the verbatim DoD are immutable constraints** on what the execution layer produces — it extends the scaffolded doc, never replaces or rewrites it.
- Absent → print manual instructions producing the same artifact contract by hand: decompose the epic Deliverables into the doc's Stories & Tasks, keep the DoD verbatim, specify Acceptance Scenarios (S1–Sn) before review. The tooling degrades; the contract does not.

## Invariants

- This skill owns exactly one state transition: a `ready` stub → `started`, plus a sprint doc created with `state: active`. Never planned→ready (roadmap), never acceptance/merged/closed (accept/merge/roadmap), never clause discharge (sync).
- Never materialize a sprint doc by any other path — `sprints/` docs come only from `ready` stubs.
- DoD verbatim, always — the epic doc is its only home.
- HC# ids are never reused: max+1 across every sprint doc's Handover Clauses sections; an empty scan starts at 1.
- Clause text lives only in the issuing sprint doc; every other artifact holds references.
- The sprint doc and its opening note are written in the same act — a materialized sprint without its opening note is incomplete.
- Every mutation — stub flip, doc creation, clause registration, migrated reference — carries date + evidence link.
