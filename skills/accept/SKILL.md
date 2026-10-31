---
name: accept
description: Use when the user asks to accept, review, or verify a sprint or roadmap, or asks whether an iteration is done.
argument-hint: <sprint-id or plan path> | roadmap <epic-id or path>
---

# supervibe:accept — sprint review gate

The sprint review gate: run every acceptance scenario for real, check every DoD item against evidence, record obstacles verbatim, audit doc drift — then write the acceptance record and rule the verdict. A verdict is a claim about observed behavior, and the discipline of this skill is **evidence before claims**: nothing passes on expectation, memory, or an earlier run. "Is this sprint done?" gets the same treatment — the answer is the verdict, backed by fresh evidence, never an opinion.

This is the checkpoint where the execution layer's claims meet the strategic layer's standards: a pass here is what unblocks `supervibe:complete`. Zero stack assumptions: proving commands come from the scenario text and the host's `### gates` config — never invented; every path comes from host config, never hardcoded.

## Acceptance owner and every-wake readiness

Before either Sprint or Roadmap acceptance, read the epic's confirmed `independentAcceptance` policy. Missing/unconfirmed policy blocks acceptance until the user confirms it through the existing config revision/CAS flow. The coordinator is the current main agent, not another spawned agent. `false`: main agent executes acceptance, without inventing a worker ID. `true`: admit a separate acceptance worker under the same `maxWorkers` cap; at cap 1, verify development has ended/released its slot before sequential acceptance. Main agent still owns final evidence review and the gate. Same harness is allowed; choose the worker harness with the user within the existing allowed set (native inherits).

Independent acceptance must have an actual executor identity different from all developers of this candidate: native worker ID or durable Orca worker/session identity backed by real receipts. A new dispatch into the same terminal/session is not independence. Missing identity/developer provenance blocks and escalates rather than inventing IDs or reusing a developer success.

On **every wake/resume**, before scenarios, require the acceptance executor to self-check and record current candidate/build/context, target environment running/ownership/availability/no conflicting mutation where stability is needed, scenario-required browser/CLI/API capabilities, authorized test accounts, test data, and evidence capture. Derive requirements from the upfront scenarios; CLI-only acceptance need not have a browser. Not-applicable requires a scenario-grounded reason. Missing/unknown required conditions produce blocked and exact blockers. Code/build/environment/context changes invalidate readiness and require rechecking; never carry a previous wake's assumptions forward. Main-agent acceptance follows the same self-check without a fabricated worker ID.

For independent Sprint or Roadmap workers, register the fresh `acceptanceContext` using `collaboration-contract.mjs acceptance-wake` with ledger CAS before execution, then validate the role-bound result and its structured `preflight`; exact fields are in the linked contract. Both worker scopes have wake/preflight contract validation; main-agent readiness remains a skill obligation without a worker identity.

Retain readiness and identity evidence with the acceptance result, bound to this wake and candidate; never promote development evidence into independent acceptance. No automatic installation/login/credential refresh/container or test-data mutation, and no claimed resource locks: these require actual capabilities and authorization. No resource manager is implemented. Required real operations cannot be replaced by static/CI/API substitutes. See [collaboration contract](../../docs/collaboration-modes.md); its validation is contract-only, not a live backend/environment proof.

For Sprint acceptance with `independentAcceptance: true`, embed exactly one `supervibe-acceptance-execution` fenced JSON block `{task, result}` in the acceptance record. The `verify`/`verify-clean` gate binds the actual Sprint ID, shared epic/document, current candidate, policy, latest wake, independent identity and readiness. A successful developer result or another Sprint receipt cannot substitute. Missing policy blocks both main and independent paths.


For required scenarios declaring `resourceGroups`, acquire and check the actual resource claims before any operation, verify host/environment readiness and exclusive ownership, then freeze the current candidate before acceptance. Follow `docs/resources.md` and the resource-policy helper contract; record real claim proofs in exactly one fenced `supervibe-resource-execution` block. Both Sprint and Roadmap gates enforce these declarations for main-agent and independent-worker paths. Main-agent ownership uses role main without a fake worker ID. Missing/unknown/conflicting claims block; never reset shared containers, ports, data or credentials to bypass admission. This cooperative helper is not an OS sandbox and does not prove process liveness.


## Roadmap final integration route

For Roadmap doc-sync, use the explicitly recorded iteration-start commit as `--base` and the integrated main HEAD as `--tip`; never present main diffed against itself as a whole-roadmap audit. If the baseline is unknown, clarify and record it rather than guessing the range.

For `accept roadmap <epic-id or path>`, review the epic's upfront Overall
Acceptance Scenarios, not an individual sprint. Resolve host roadmaps_dir and
acceptances_dir; read shared status for the configured mainRef and confirm all
Breakdown sprint IDs have same-epic merged/closed entries. Do not call sprint
review-begin/review-pass, mutate sprint state, or reuse old sprint verdicts.

Before every final review or re-review, revoke any old usable final pass: set
`status: open`, `final-acceptance-record: null` and `final-accepted-at: null`
before any scenarios. Preserve the old record as history, never restore its
pointer after failure/interruption. Commit this revocation with the prepared
inputs within existing authorization; without authorization stop before review.

Prepare all notes and plan amendments before review; commit integrated inputs
and the upfront plan under existing authorization. Use a fresh record from
`templates/roadmap-acceptance-record.md`. On the current integrated main candidate,
run `validate-workflow.mjs roadmap-snapshot --epic "<epic-doc>" --record
"<new-record>" --main-ref "<stored-mainRef>"` before and after all actual scenario,
DoD and drift checks; require identical output. Apply the scenario execution,
required-evidence, no-substitution and obstacle rules below at scope `roadmap`.
Store the before JSON in `supervibe-evidence`, and `supervibe-acceptance-results`
with scope roadmap and candidate fingerprint. This is separate integrated testing,
never a summary of sprint records. Missing capability/evidence means blocked.

If `independentAcceptance` is true, use an acceptance task with `scope: "roadmap"`, `epic`, `epicDocument`, no `sprint`, and the actual configured main-branch worktree. Bind `acceptanceContext.candidate` to the integrated `roadmap-snapshot`; register each wake/resume through `acceptance-wake`. No active Sprint or new Sprint WIP reservation is needed. Embed exactly one fenced `supervibe-acceptance-execution` JSON block `{task, result}` in the final record. `roadmap-verify` enforces current policy, candidate, latest wake, distinct executor and readiness. If false, main-agent acceptance needs neither a worker ID nor this worker execution block. Contract checks cannot prove live execution.

Write the append-only pass/blocked record and set only epic
`final-acceptance-record` and `final-accepted-at` for the attempt (do not append
body text after snapshot). On pass run `roadmap-verify` with the same arguments;
failure blocks closure. On blocked retain open epic and never restore an old
pass. `roadmap` owns the subsequent closed status. The Sprint-only routing,
shared transitions and frontmatter instructions below do not apply to this route.

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


## Inputs

From the host root run `node "<plugin base dir>/scripts/host-config.mjs" --require-dir sprints_dir --require-dir acceptances_dir --require-dir notes`. Use its returned paths, WIP, ordered verbatim gates and mappings; nonzero stops with the error, never implicit directory creation. Only explicit scaffold may handle missing config/directories; roadmap non-scaffold actions add `--require-dir <touched-directory-key>`. Resolve templates from the plugin directory. See [mechanical preflight](../../docs/mechanical-preflight.md) for grammar/defaults; do not reimplement parsing. Mappings also bind artifacts this skill writes. Run only scenario-named gates here; the helper executes none.

Then resolve the sprint under review:

- Argument: a sprint id or a direct sprint-doc path (resolve the exact document in the inventory output, then use its unique ID). Absent → ask, listing the docs in `sprints_dir` whose frontmatter `state` is `active` or `acceptance`; never guess.
- Resolve identity through the unique `selection` from `artifact-inventory.mjs --sprint "<sprint-id>"`; nonzero reports `issues`, not another manual scan.
- State precondition: `active` or `acceptance` → proceed with a **full fresh review**, never reuse the old scenario verdict. `merged` / `closed` → reject: past the gate. Unknown or missing state → reject.
- Before **every** review, call `shared-ledger.mjs review-begin` with ID/revision/operation flags, clearing shared evidence and setting shared active. Then project `state: active` and append a dated re-review note; preserve the previous record as history. This revokes the old pass before any command runs, so an interrupted review cannot leave it usable. Never rewrite the previous record.

## Bind evidence to the reviewed tree

Before the initial snapshot, ensure source and owed-document changes are committed together on this branch under the applicable authorization. If committing is not authorized, pause and explain; do not commit/rewrite history merely to green a check. Acceptance records/metadata may be committed afterward; uncommitted source cannot satisfy doc-sync.

From the host repository root, choose the new, not-yet-existing acceptance record path (including a suffix on re-runs), then run:

```sh
node "<plugin base dir>/scripts/validate-workflow.mjs" snapshot --sprint "<sprint-doc>" --record "<new-acceptance-record>"
```

Both paths are repository-relative. Keep concurrent writers out of the verification window; before/after equality is not an atomic lock. Unrelated repository edits also invalidate this deliberately conservative fingerprint. Only the shipped single-line frontmatter key/value form is supported; multiline values fail closed. Keep the emitted JSON in memory or outside the host repository (for example `/tmp`), never in a new nonignored host file; this is the **before-review snapshot**. After all scenarios, DoD checks and drift checks, run the same command again and require byte-identical JSON before issuing pass. A changed fingerprint means the reviewed inputs moved: stop, keep a blocked record, and review the new tree from the beginning. Do not capture a new snapshot after the fact and attach it to old results.

The snapshot includes tracked and nonignored untracked files, paths, modes and contents. It excludes **only this exact new record path** and normalizes only this sprint's `state`, `acceptance-record`, and `accepted-at` frontmatter fields. DoD, scenarios, source, configuration, other records and notes remain covered. Write notes/workarounds before the final review or restart the review after writing them. The exact record exclusion prevents self-reference; committing the evidence/ledger alone does not stale the fingerprint. Ignored build output, databases, deployed services and external environment state are not covered: fresh real-environment verification remains mandatory. An unresolved Git index or submodule is unsupported and fails closed. This is a provenance check, not proof that tests ran.

## Execute scenarios

Read the sprint doc's `## Acceptance Scenarios (S1–Sn)` section and validate its unique `supervibe-acceptance-plan` block before execution; missing/malformed plans block the run, not just the final verdict. Each scenario runs for real, exactly as its text specifies — browser, CLI, stack commands. A scenario is an observation to make, not a box to tick.

Reject the malformed doc before anything runs: the Acceptance Scenarios section missing or empty → reject, naming the malformed sprint doc — zero scenarios must never yield a vacuous pass. A `## Definition of Done` section missing or empty → reject the same way; the DoD lives verbatim in the epic doc — direct the fix there, never patch it into the sprint doc.

Run against the sprint's own environment — the worktree/branch the sprint doc's `worktree` frontmatter names, with its stack live — not a stale build elsewhere: a proving run against yesterday's artifact is not evidence.

**Evidence before claims — never claim pass without a fresh run** (explicit discipline pattern, adapted from superpowers' verification-before-completion — no completion claims without fresh verification evidence):

1. Identify the proving command — the one whose full output demonstrates the scenario's expected observation.
2. Run it — for real, now, in the sprint's own environment.
3. Read the full output — not the exit code alone, not the first line.
4. Only then claim — and cite: per scenario, the record's result table carries the proving command, the outcome, and the evidence (output excerpt or artifact path).

"Should pass", a previous run, a partial check, and the author's confidence are not evidence. A scenario that cannot run at all is recorded as not-run with the reason — never silently skipped, never counted as pass.

When a scenario's text admits two readings, run the stricter one — the review gate never benefits from the charitable interpretation.

On an obstacle — a command fails, the environment blocks, the output contradicts expectation — search the notes dir for prior workarounds first: grep by the obstacle's keywords (error strings, tool names, failure mode). A hit → reuse the workaround and cite the source entry (file + section) in the record. No hit → improvise the narrowest workaround and record it verbatim in the obstacles log. An empty notes dir is not an error — a first sprint has no history; say so and proceed.

## Required scenario contract and real user operations

At Sprint planning, each scenario must already exist in the unique fenced
`supervibe-acceptance-plan` block in the sprint doc (see template). Keep its IDs,
goals, steps and expected observations aligned with the human scenario table.
The universal epic DoD is a quality baseline, not the overall Roadmap outcome;
passing this sprint never certifies the final integrated Roadmap.

For a UI scenario, operate the current build in a real browser: open the entry
URL, enter data, click/navigate/submit and verify visible/persisted outcomes as
specified. Capture actual steps, expected versus observed behavior, environment,
deployed build/revision, test role/data, run time, artifact references and blockers.
A CI green run, API-only probe, static screenshot, or worker success claim is not
a substitute for required browser actions. Inspect evidence, not just its filename.
Unavailable browser, credentials or environment means blocked/not-run, not pass;
do not install tools or acquire permissions implicitly.

Write exactly one `supervibe-acceptance-results` block in the acceptance record:
schema 1, scope sprint, candidate equal to the before fingerprint, actual environment
description, and results for every plan ID. Required results must be passed with
matching modality/environment, actual steps, expected/observed, artifacts and no
blockers. `validate-workflow.mjs verify` enforces structure/coverage/provenance,
not whether a real interaction happened; the reviewer must verify authenticity.
Old records lacking this contract require a new review, never fabricated backfill.

A labeled substitution remains useful diagnostic evidence but cannot satisfy a
mandatory requirement, especially browser/real-environment requirements. Changing
scope requires an explicit user-authorized acceptance-plan amendment recorded with
source/date/reason in the planning artifacts, then a new snapshot and full fresh
review against the revised plan. Preserve the blocked attempt; never retrospectively
reinterpret it as passing. Acceptance itself must not weaken the plan.

## DoD checklist

Read the sprint doc's `## Definition of Done` section. Check every item against evidence — scenario results where they cover it, a fresh proving command where they do not.

- This skill CHECKS the DoD, never edits it: the DoD is copied verbatim from the epic doc, and a DoD change goes back to the epic doc by amendment, never inside a sprint doc. An item that fails or lacks evidence blocks the verdict — it is never resolved by editing the checklist.
- An item a failed scenario covered stays failed — re-proving it from a friendlier angle is a substitution, and is labeled as one.
- Substituted evidence — a proof different from what the item or scenario specified (CLI output where a browser check was specified, a fixture where live data was specified) — must be labeled as substituted, with the reason, in both the checklist and the result table. An unlabeled substitution is greenwashing.
- Substitution has hard bounds: it never applies to inventing a gate command — a scenario naming a gate with no configured command under `### gates` is recorded as not-run and the user directed to fix the config — nor to picking your own runner for a scenario that specified none; that scenario is not-run, its text underspecified.

## Obstacles log

Every blocker, workaround, and substitution is recorded verbatim, as it happened — appended to the record's obstacles section during the run, not reconstructed afterward. No greenwashing: no softened wording ("essentially works"), no dropped failures, no obstacle left in memory only.

Each entry carries the exact command line and its observed output — a workaround that cannot be replayed is not reusable.

- A workaround reused from notes history cites its source entry.
- A workaround improvised here, with no history hit, becomes a notes entry per the four-section protocol (obstacle workarounds are key moments — recorded when they happen), citing the acceptance record back: the next sprint's obstacle search starts there.

## Doc-drift audit

In the sprint carrier run `node "<plugin base dir>/scripts/doc-sync.mjs" --base "<stored-mainRef>" --tip HEAD --epic-document "<epic-doc>" --task-path "<explicit-task-path>"` (repeat `--task-path` for each explicit Stories & Tasks path; omit when none). Use the returned matches/arrears; nonzero cannot authorize pass. Never infer paths from prose. Open every triggered document and judge whether its content reflects the change; record current/drifted with evidence. The helper proves only paths/commit co-occurrence, not semantic correctness; drift blocks pass.

## Verdict + record

Write `<acceptances_dir>/YYYY-MM-DD-<sprint>-acceptance.md` from `templates/acceptance-record.md`; the date is today, the acceptance-run date. The record carries at minimum: the scenario result table, the DoD checklist with evidence, the verbatim obstacles log, the drift report, the verdict, and the **gate-evidence block** — the branch tip hash at run time, the gates list as run (each configured gate command that ran, verbatim), and its green outputs. That block is the mechanical key complete's stage 1 short-circuits on, exactly when tip and list are unchanged; without it, complete re-runs everything. Records are append-only — a same-day re-run never overwrites an earlier record; it takes a distinguishing suffix (`-2`, `-3`, …); the `acceptance-record` pointer names the latest completed attempt; only a pass in acceptance state can authorize close-out.

- **pass** requires all of: every required scenario passed with fresh evidence in the prescribed modality and environment (not substituted or not-run); every DoD item checked with evidence; no unpaid drift on triggered rows. Anything less → **blocked**, naming the blocking items.
- Every completed record contains exactly one fenced `supervibe-evidence` block holding the before-review JSON (schema, sprint, record, fingerprint). Only an unchanged after-review snapshot may support pass.
- pass → write the record, then provisionally set sprint frontmatter `state: acceptance`, `acceptance-record: <record-path>`, and `accepted-at: <ISO date/time>`, using these fields as the dated evidence link (do not append body text after the snapshot). The record must exist before the state flip. Run `verify --sprint "<sprint-doc>" --record "<record-path>"` through the same validator before reporting a usable pass; failure blocks close-out. Commit all reviewed payload plus the provisional projection and new record, then call `shared-ledger.mjs review-pass` with ID/revision/operation flags; it requires verify-clean in the carrier and stores the accepted commit/tree before granting shared acceptance. Until this succeeds, Markdown acceptance is only a provisional projection and does not authorize merge.
- blocked → keep the new record and set `state: active`, `acceptance-record: <new-blocked-record>`, and `accepted-at: <ISO date/time>` for the dated attempt. The pointer identifies the latest attempt, not necessarily a pass. Call `shared-ledger.mjs review-blocked` with ID/revision/operation flags to record the attempt; shared state stays active. The old pass is never restored. Return to execution and then re-review; each run writes its own record.

The record is the evidence anchor for what follows: complete's closing note cites it back — records and closing notes reference each other. And the cheapest close-out is the same session: run `supervibe:complete` immediately after a pass — the drift window is smaller and the gate evidence is freshest, but fingerprint verification remains mandatory.

## Invariants

- This skill owns shared review transitions (Markdown fields project them): `acceptance → active` before re-review, then `active → acceptance` on a fresh, tree-bound pass only. Never `merged`/`closed` (complete/roadmap), never clause discharge (sync), never stub states (roadmap/start).
- Only review state, `acceptance-record`, `accepted-at`, and the dated audit note are mutated in the sprint doc — scenarios, DoD, stories, and clauses are inputs to review, never targets to edit toward a pass.
- Evidence before claims, every scenario, every DoD item, every run — a pass without a fresh run is not a pass.
- Acceptance records are append-only; history is never rewritten or greenwashed.
- Any reference to an unknown sprint id → reject, naming it.
- Every mutation — the state flip — carries date + evidence link.
