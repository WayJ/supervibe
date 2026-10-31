---
name: start
description: Use when the user says start, begin, kick off, or pull a sprint, epic, or iteration.
argument-hint: <epic-id> <sprint-id>
---

# supervibe:start — open a sprint

Materialize a `ready` stub from an epic doc's Sprint Breakdown into a sprint doc — the single door from planning into execution. Inputs are an epic id and a sprint id, both mandatory: one epic may hold several `ready` stubs (parallel waves), so the sprint id is never inferable from the epic alone. If either argument is missing, ask; never guess a wave.

Pre-start planning lives in the stub row; admission and runtime state live in the shared ledger. The sprint doc projects `active` after reservation and activation. A sprint is value-boxed — closed by DoD, never time-boxed; parallelism is bounded by `wip_limit`, not by the calendar.

Around that act: adjudicate readiness, read history, then hand a scaffolded doc to the execution layer. superpowers is the recommended pair — present, dispatch to it; absent, produce the same artifact contract manually. The coupling is artifact-contract only: this skill never forks or rewrites execution-layer skills. Zero stack assumptions: every path comes from host config, never hardcoded.

## Entry routing — before iteration side effects

First resolve the user's execution intent, before reading/initializing the shared ledger, asking for epic/sprint IDs, confirming iteration configuration, scaffolding, reserving WIP, or creating any iteration artifact. The default is **coordinator-led multi-agent iteration**. Explicit single-agent work with no subagents routes directly to available **superpowers** execution skills; do not activate SuperVibe iteration mode or create/change its state. Preserve the no-subagents constraint in that handoff. If superpowers is unavailable, report the missing capability; do not initialize an iteration as a fallback.

The pure helper `node "<plugin base dir>/scripts/iteration-route.mjs"` reads `{ "execution": "solo" }` or `{ "execution": "iteration" }` on stdin (omitted execution defaults to iteration). It only reports routing intent; it neither invokes skills nor probes harness capabilities. In iteration mode, use exactly native/harness or external/orca, inspect actual capabilities, and stop when the selected route is unavailable — never silently execute solo. `maxWorkers: 1` means **one worker plus the coordinating main agent**, not solo. The remaining instructions apply only after the iteration route is selected.

The coordinator is **the current main agent**, never an extra spawned coordinator. At overall Roadmap kickoff, explicitly ask whether to use an independent acceptance worker and save the confirmed boolean `independentAcceptance` with the existing iteration policy (no silent default). `false` assigns acceptance to the main agent; `true` requires a distinct acceptance worker. Acceptance workers share `maxWorkers`; at cap 1, finish/release development before admitting a distinct acceptance worker. See the mandatory wake/preflight and identity rules in [collaboration modes](../../docs/collaboration-modes.md).

## Shared runtime authority

Read `<plugin base dir>/docs/shared-ledger.md`. From the host repository root run
`node "<plugin base dir>/scripts/shared-ledger.mjs" status` and reconcile the
requested sprint with its shared entry. The common-dir store, not Markdown,
owns runtime state and WIP; frontmatter checks below are projection checks.
No store → stop for explicit init/import. Use `doctor` to diagnose carrier or
projection drift; never silently recover authority from a branch copy. Every
mutation below requires `--id <sprint-id> --revision <current-revision>
--operation <unique-operation-id>`; reread status for each new action and keep
the same operation ID for an exact uncertain retry. Do not hand-edit the store.


## Read host config

From the host root run `node "<plugin base dir>/scripts/host-config.mjs" --require-dir roadmaps_dir --require-dir sprints_dir --require-dir notes`. Use its returned paths, WIP, ordered verbatim gates and mappings; nonzero stops with the error, never implicit directory creation. Only explicit scaffold may handle missing config/directories; roadmap non-scaffold actions add `--require-dir <touched-directory-key>`. Resolve templates from the plugin directory. See [mechanical preflight](../../docs/mechanical-preflight.md) for grammar/defaults; do not reimplement parsing. Mappings also bind artifacts this skill writes.

## Overall iteration collaboration confirmation

Before the first sprint of an epic starts, ask the user once for mode, concurrent worker cap, and (Orca only) worker harness IDs and explicit mixed-harness permission. Native workers inherit the current harness. No default worker count; sprint WIP is separate. Read [kickoff/config rules](../../docs/collaboration-modes.md) and `templates/iteration-collaboration.json`. Persist only the actual confirmed choice via `collaboration-contract.mjs confirm-config`, including user-message provenance, current ledgerRevision and per-epic config revision. Never fabricate consent. The common-dir ledger's `iterationConfigs[epic]` is execution authority; AGENTS supplies proposals only. On resume/later sprints, reuse it without asking again. Missing/draft config blocks delegation; changed choices need fresh confirmation, a new revision, and old workers/results drained first.

Before every dispatch/retry, reconcile real backend occupied slots across the epic (starting/running/uncertain, including nested workers; excluding coordinator). Unknown occupancy or insufficient capacity blocks dispatch. One coordinator serializes admission; this is not an implemented backend semaphore. Bind every task to config revision/fingerprint and allowed workerHarness; verify actual chosen harness availability without installing/falling back. See the linked rules for read/save commands and Orca terminal-reuse constraints.

## Resource planning and admission

At overall iteration kickoff, before recommending worker concurrency or starting a
resource-consuming environment, follow `<plugin base dir>/docs/resources.md`.
Run the read-only `node "<plugin base dir>/scripts/resource-policy.mjs" probe-local`
on the actual local execution machine; assess workload footprints and system/Docker
reserves, then obtain user confirmation of host budgets and intended resource groups.
Agent slots and environment instances are separate limits. Unknown footprint or stale
capacity evidence is a blocker to claiming safe environment concurrency, not a default.

Before using a shared container, port, database, browser profile or test account,
acquire the entire declared resource group atomically and check its current ownership.
Declare required acceptance groups in the upfront scenario `resourceGroups`; freeze
the tested candidate and pass current proofs to acceptance. Conflicts/unknown hosts
block use; do not restart, reset, rotate credentials, steal or expire someone else's
resources. Release only after explicit quiescence evidence. Groups that are not needed
may be omitted with a documented reason; do not invent resource demand for pure analysis.

An authorized SSH host may supply build/test environment capacity while the worker
and shared ledger stay local. Register non-secret aliases and separately verified
remote budgets; never treat local probe data as remote capacity or registration as a
successful connection. This does not authorize installing, pairing, changing credentials
or provisioning. The protocol coordinates cooperating workers, not OS-level isolation.

## Locate the stub

- Run `node "<plugin base dir>/scripts/artifact-inventory.mjs" --epic "<epic-id>" --sprint "<sprint-id>"`; use its unique `selection`. Nonzero blocks on the returned `issues`; never manually guess identities or repair authority.
- The stub must be in `ready` state:
  - `planned` → reject and route to `supervibe:roadmap ready` — the go decision is strategic and is not made here.
  - `started` → reject: already materialized; name the existing sprint doc (frontmatter `sprint` match in `sprints_dir`).
- Read the stub note before adjudicating: `supervibe:roadmap ready` recorded the strategic go rationale there — it is an input to the rulings below, not a verdict.

## Readiness adjudication

Four rulings before any file is written — each either blocks the start or shapes the doc being created. Every ruling outcome lands in the new doc's frontmatter flags and the opening note's decisions section:

1. **Dependencies** — read the stub note and the epic doc (Deliverables, Cross-cutting) for dependencies naming other sprints.
   - Dependency already merged → satisfied: verify the target sprint doc's shared entry reads `state: merged` or `state: closed`, with its landing commit recorded; confirm the Markdown projection agrees, then move on.
   - Dependency on an unmerged sprint → not a stopper; route to ruling 4.
2. **WIP limit** — read shared `reserved`, `active`, and `acceptance` entries. All consume WIP; only `merged` and `closed` are landed. Markdown copies do not decide admission. The atomic `reserve` call below enforces the stored limit.
   - Count at or above `wip_limit` → stop, naming the in-flight sprints; one of them must complete or close before this start can proceed.
   - An early-started sprint is `active` and counts toward the limit like any other.
3. **Early start** — applies whenever any sprint is still in flight (shared state is `reserved`, `active`, or `acceptance`) — not only ones this sprint depends on.
   - Estimate the file intersection: the number of files both this sprint (epic Deliverables + stub note) and each in-flight sprint (its sprint doc) are expected to touch.
   - That number ≈ zero → safe: set `early-start: true` in the new doc's frontmatter and record the estimate in the opening note.
   - Material overlap → not safe as an early start: wait, or route the overlap through ruling 4.
4. **Deferred dependency** — implement now on the current baseline as if the depended-on sprint were already merged, and bind the future review with a handover clause.
   - Register the clause per `templates/handover-clause.md` in this sprint doc's Handover Clauses section — the issuing side is the single source of truth for clause text; every other artifact holds references only.
   - **Decide the obligation here; allocate its HC ID only after the sprint reservation below succeeds.** Use `clause-ids.mjs reserve`, never a Markdown max+1 scan. One-time legacy bootstrap must follow `docs/clause-id-allocation.md` with old writers quiescent; missing/unreadable state blocks allocation.
   - Target reference per the migration rule: target sprint doc exists → append the HC# to its frontmatter `clauses` list; future sprint with no doc yet → record `target: <epic> breakdown S#` inside the clause itself.
   - Two write moments: the clause body goes into the doc being created now; the target-side frontmatter append happens immediately when the target doc exists — a future target's reference migrates at its own materialization.

## Atomic WIP reservation

Read shared status and perform all readiness judgments before reserving. Then,
before creating a worktree or document, run from the host repository root:

```sh
node "<plugin base dir>/scripts/shared-ledger.mjs" reserve --id "<sprint-id>" --epic "<epic-id>" --document "<repo-relative-sprint-doc>" --branch "<branch>" --worktree "<absolute-planned-worktree>" --revision "<current-revision>" --operation "<unique-id>"
```

Nonzero means stop. Reservation counts reserved+active+acceptance and writes
under one lock/CAS operation; never substitute the read-only `wip` diagnostic.
An uncertain result requires status reconciliation and the same operation ID,
not a second reservation. Failed starts retain their slot; no expiry or lock
stealing is allowed. An unused reservation may be explicitly cancelled with
`cancel-reservation` plus ID/revision/operation only when planned path, local
branch and registered worktree are all absent. Otherwise resume or report the
blocker; never cancel active work. Cancelled IDs remain reserved against reuse. State is shared across linked worktrees, not independent
clones. A missing store requires explicit init/import, never a directory scan.

After the sprint is reserved, allocate each previously decided handover obligation:

```sh
node "<plugin base dir>/scripts/clause-ids.mjs" reserve --issuer "<sprint-id>" --revision "<current-revision>" --operation "<stable-clause-operation>"
```

Use the returned ID in the issuing document and target references. Read the new revision
before the next allocation; exact retries keep the same operation and issuer. If the
namespace is absent, stop for explicit quiescent bootstrap, not an implicit scan/reset.
Do not allocate a clause before the issuer exists in shared reserved/active state.

## Read history first

Notes are a cross-sprint knowledge asset, not a diary — read them before writing a line of plan:

- Search the notes dir for prior entries matching this epic's domain and stack: grep by keywords drawn from the epic doc's Deliverables section (component names, stack nouns, failure modes).
- Prioritize entries whose lessons sections name environment pitfalls, process corrections, or rework root causes — those are the reusable classes.
- Extract relevant lessons into the new doc's Decisions (D-x) context and cite the source entries (file + section); an uncited lesson is opinion, a cited one is evidence.
- An empty notes dir is not an error — a first sprint has no history. Say so and proceed.

## Materialize the sprint doc

Immediately before creation, rerun the inventory command above; duplicate documents, ready-but-materialized or started-without-document issues block. Never overwrite or silently rematerialize.

1. After successful shared reservation, create the named carrier and `<sprints_dir>/YYYY-MM-DD-<sprint>-plan.md` from `templates/sprint.md`. The file date is the materialization date (today), not the stub's planning date. Frontmatter `{sprint, epic, state: active, worktree, early-start, deferred-dependency, clauses, acceptance-record: null, accepted-at: null, merged-commit: null}`:
   - `worktree` — the worktree/branch that will carry this sprint (one canonical integration worktree/branch per sprint; registered development child worktrees are allowed).
   - `early-start` — the ruling above; `false` when it did not apply.
   - `deferred-dependency` — the HC# refs registered in ruling 4; empty when none.
   - `clauses` — seed with migrated HC# refs: scan every sprint doc's Handover Clauses section for clauses recording `target: <this epic> breakdown S#` matching this stub and pull their ids in — the clause text stays with the issuer, and the reference lands where sync will scan for it. Empty when nothing targets this stub.
2. Fill the five body sections per the template — Decisions (D-x) / Stories & Tasks / Definition of Done / Acceptance Scenarios (S1–Sn) / Handover Clauses. **DoD is copied verbatim from the epic doc's Definition of Done — never edited in place; a DoD change goes back to the epic doc by amendment and is re-copied from there.**
3. Flip the stub row state → `started`, keeping the sprint id pointer; append date + evidence link (the new doc path) to the stub note.
4. Write the opening note `<notes>/YYYY-MM-DD-<sprint>-open.md` per the four-section protocol: background (why this line opened, rulings made) / decisions (with rationale, including rejected options) / lessons (the history extracted above, with citations) / handover (clauses registered here, obligations owed).

After the carrier, sprint doc and opening note exist, call `shared-ledger.mjs activate` with ID/revision/operation flags, then confirm its shared `active` state. A failed/interrupted activation retains `reserved` and its WIP slot; inspect/resume rather than creating another sprint.

Before implementation or worker dispatch, fill the sprint's acceptance plan from its stub goals: stable scenario IDs, goal, required modality/environment, ordered user actions and expected observations in the `supervibe-acceptance-plan` block. Link its scope to the Roadmap's independent overall scenarios without copying the entire overall delivery requirement into this sprint. A missing or empty scenario plan blocks implementation. UI scenarios require browser interaction in the real running environment; CI/API/static screenshots alone cannot satisfy them. Scope changes require a recorded user-authorized amendment and a fresh run, never relabeling old failed/substituted results as passed.

## Dispatch execution

Agent collaboration has exactly two routes, confirmed per epic (host `## supervibe` supplies proposals): `collaboration_mode: native` + `collaboration_provider: harness`, or `external` + `orca`. Missing, unsupported, mismatched or unavailable selection blocks delegation; ask for a choice or report the missing capability, never silently switch modes. SuperVibe owns the contract, not a scheduler. See [collaboration modes](../../docs/collaboration-modes.md).

1. Before delegation, inspect actual capabilities. **Native:** use the current harness's documented available worker creation and result tools (plus messaging if interaction is required) (for example Claude Code subagents); do not invent tool names or assume cross-session support. **External:** locate the Orca CLI and read `orca skills get orchestration` plus relevant current references; missing CLI/skill blocks this route, not an installation request.
2. After explicit safe registry migration, reserve the exact worker/task/workspace binding via `worker-lifecycle.mjs reserve` before dispatch (see lifecycle below). Then validate the task JSON with `node <plugin-root>/scripts/collaboration-contract.mjs task` on stdin: explicit mode/provider, sprint/task identity, objective, worktree, allowed paths and acceptance. Pass this same scope to the worker. Do not broaden permissions, install dependencies, provision credentials, or authorize commits/pushes implicitly.
3. Native delegates using inspected tools and retains actual worker/session receipts. Orca follows the official `worker-start` / `send` / `check` / `inbox` lifecycle: launch from the validated registered workspace, normally `--worktree current`, and require the worker to verify common-dir/carrier before its first write; retain `runId`, `taskId`, `dispatchId`, actual workspace and any terminal receipt. A Run is a work grouping, not a harness session. End the turn after dispatch and await event wakes; never loop on consuming `check`. `inbox` is history, not proof of success. Inspect an unknown/failed start before retrying; an authorized retry stays on the same task with its dispatch linkage.
4. Verify the actual returned workspace is the canonical sprint carrier or an explicitly registered development child worktree under that Sprint, in the same Git common-dir. Do not assume Orca's new workspace belongs to this ledger. No new worktree without requested isolation or a demonstrated conflict; an incompatible workspace blocks delegation/results rather than expanding scope. Reserve WIP once per sprint, never per worker task.
5. Collect an explicit `succeeded|failed|blocked` result with execution identities, evidence and blockers. Validate `{task, result}` on stdin with helper `result`; persist request/result and receipts in a sprint-linked task handoff note before acceptance fingerprinting. Evidence is required for success; completion events, process exits and worker claims alone do not accept a sprint. Failed/blocked results go to the owner; `supervibe:accept` still owns acceptance. Runtime state remains in the existing local common-dir ledger.

### Execution methods (not collaboration providers)

- Detect whether `superpowers:brainstorming` and `superpowers:writing-plans` are available as invocable skills. If available, invoke them in that order to fill the materialized doc path, within either selected collaboration route.
- **The five-section structure and verbatim DoD remain immutable.** The execution-method layer extends the scaffold; it never replaces it.
- Without superpowers, print manual instructions: decompose epic Deliverables into Stories & Tasks, preserve DoD verbatim, specify Acceptance Scenarios (S1–Sn) before review. This method fallback does not permit changing the configured collaboration mode.
- Support status: contract and fixture coverage only; neither live native-harness nor Orca end-to-end integration is certified by these checks.

## Invariants

- This skill owns shared `reserve` and `reserved → active` activation, plus a `ready` stub → `started` and active Markdown projection. Never planned→ready (roadmap), never acceptance/merged/closed (accept/complete/roadmap), never clause discharge (sync).
- Never materialize a sprint doc by any other path — `sprints/` docs come only from `ready` stubs.
- DoD verbatim, always — the epic doc is its only home.
- HC# IDs come only from atomic `clause-ids.mjs reserve` receipts; interrupted/abandoned reservations are never reused. Clause bodies remain in issuing Markdown.
- Clause text lives only in the issuing sprint doc; every other artifact holds references.
- The sprint doc and its opening note are written in the same act — a materialized sprint without its opening note is incomplete.
- Every mutation — stub flip, doc creation, clause registration, migrated reference — carries date + evidence link.

## Worker admission and release

Follow [worker lifecycle](../../docs/worker-lifecycle.md): explicitly migrate only after legacy quiescence, reserve a worker execution before dispatch, bind the actual start receipt, and settle every completed/failed/blocked execution with outcome plus quiescence. Pending/running/unknown count against the epic cap; settled does not. Register development child worktrees under the parent Sprint, never create another Sprint reservation merely for worker isolation. On completion/error wakes, the current main agent calls deterministic settlement then safe cleanup without waiting for a new user request. Physical cleanup, execution quota and resource-group release are separate; retain dirty/borrowed/provider-owned storage safely. No installed backend hook, TTL or force-release is implied. Independent Roadmap acceptance is also registered against the same epic cap, borrowing canonical main without a Sprint reservation.
