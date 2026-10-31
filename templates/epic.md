---
epic: E1            <!-- placeholder: next epic id, scan roadmaps/ for max+1 -->
status: open        <!-- placeholder: open|closed -->
final-acceptance-record: null  <!-- placeholder: latest final integration attempt -->
final-accepted-at: null        <!-- placeholder: ISO date/time -->
date: 2026-10-01    <!-- placeholder: creation date -->
---

# <!-- placeholder: epic title, one line naming the deliverable -->

<!-- Template note: epic doc = strategic truth source for one epic. Pre-start
sprint states (planned / ready) live ONLY in the Sprint Breakdown stub rows;
from reservation on, runtime state lives in the shared common-dir ledger;
sprint frontmatter is only its readable projection. Every mutation
appends date + evidence link. Fill every placeholder fill-in, replace the
example-marked rows with real content, keep the section headings
verbatim, then delete template notes. -->

<!-- Overall kickoff must explicitly confirm independentAcceptance (true/false)
with maxWorkers and harness choices through the shared iteration policy.
Current main agent coordinates. No default; independent workers share the cap. -->

## Deliverables

<!-- One row per committed deliverable: concrete and verifiable, never "improve X". -->

| deliverable | note |
|---|---|
| CSV billing export endpoint | replaces the ad-hoc quarter-end SQL script <!-- example --> |
| <!-- placeholder: deliverable --> | <!-- placeholder: note --> |

## Definition of Done

<!-- INVARIANT: an epic without a Definition of Done is invalid. DoD lives at
epic level only — sprint docs copy it VERBATIM into their own Definition of
Done section, and any later change is an amendment in THIS doc, never an
in-place edit inside a sprint doc. -->

- [ ] Applicable quality gates pass on the reviewed build <!-- example: universal quality bar, not the entire roadmap outcome -->
- [ ] <!-- placeholder: DoD item, checkable with evidence -->

## Overall Acceptance Scenarios

<!-- Define BEFORE implementation: independent integrated end-user outcomes,
not a copy of universal DoD or a checklist of sprint passes. Browser UI paths
require modality browser and environment real. Each required scenario needs
actual actions and observed results; CI/API/static screenshots alone cannot
substitute. Keep this machine plan aligned with the human scenario wording. -->

<!-- Declare actual shared environment resourceGroups IDs upfront per scenario
(containers, ports, databases, accounts/credentials). Empty only when none are
needed; do not omit known shared resources to bypass admission. -->

```supervibe-acceptance-plan
{"schema":1,"scope":"roadmap","scenarios":[{"id":"R1","goal":"Export invoices through the complete report UI","required":true,"modality":"browser","environment":"real","resourceGroups":[],"steps":["Open the integrated report URL as an authorized user","Select a quarter and click Export","Open the downloaded CSV and compare totals with the displayed invoices"],"expected":"The browser flow succeeds and downloaded totals reconcile to the cent"}]}
```

<!-- Replace the example above with the actual overall plan. Every Sprint stub
must also name its own goal and acceptance requirements before it is ready;
materialize these into the sprint plan, not retrospectively at acceptance. -->

## Final Acceptance

<!-- All Sprint Breakdown IDs must be merged/closed in the shared ledger,
including formerly unstarted stubs. That is necessary, NOT sufficient.
Run overall scenarios freshly against the current integrated main build.
Use templates/roadmap-acceptance-record.md and validate-workflow.mjs
roadmap-snapshot / roadmap-verify. Fill final-acceptance-record and
final-accepted-at; missing, blocked or stale evidence prevents closure.
A prior pass remains history, never a substitute for current integration. -->

## Sprint Breakdown

<!-- Stub rows are the ONLY home for pre-start states. Columns: sprint, state,
note. State values: planned, ready, started (started = materialized into a
sprint doc, id pointer kept). Sprint id = max+1 across all sprints/ docs AND
every epic doc's stub rows — scan both sources, every time. -->

| sprint | state | note |
|---|---|---|
| S1 | started | first wave: export API (doc: sprints/2026-10-03-S1-plan.md) <!-- example --> |
| S2 | planned | second wave: report UI, consumes the S1 export <!-- example --> |
| <!-- placeholder: next sprint id --> | planned | <!-- placeholder: scope note --> |

## Decisions (ADR)

<!-- ADR numbering is global across every epic doc: scan all ADR sections for
max+1. Doc-before-code: decision text lands here BEFORE implementation begins;
a retroactive ADR must flag the discipline breach. Amendments append rows;
history is never rewritten. -->

| id | decision | rationale | date | evidence |
|---|---|---|---|---|
| D1 | Ship CSV before XLSX | CSV covers every current request; XLSX adds a dependency for formatting niceties | 2026-10-01 | spec §4 <!-- example --> |
| <!-- placeholder: next ADR id, global max+1 --> | <!-- placeholder: decision --> | <!-- placeholder: rationale, incl. rejected alternatives --> | <!-- placeholder: date --> | <!-- placeholder: link --> |

## Asset Disposition

<!-- Inherited assets only. Dispositions: reuse, retire, re-order, watch. An
asset with no owning epic is a smell — route it to one or open a question. -->

| asset | disposition | note | date | evidence |
|---|---|---|---|---|
| legacy reporting module | retire | superseded by the export service; remove after S2 merges | 2026-10-01 | ADR D1 <!-- example --> |
| <!-- placeholder: asset --> | <!-- placeholder: reuse, retire, re-order, or watch --> | <!-- placeholder: note --> | <!-- placeholder: date --> | <!-- placeholder: link --> |

## Open Questions

<!-- Everything gets a row — unnumbered questions rot. Lifecycle: open, then
closed or deferred, only with a decision-record link (ADR id, note entry, or
evidence commit). Reopen by appending a row that references the old one. -->

| id | question | status | resolution |
|---|---|---|---|
| Q1 | Must the export stream, or are bounded files fine? | closed | D1 — bounded files; largest current export is 40k rows <!-- example --> |
| <!-- placeholder: Q# --> | <!-- placeholder: question --> | open | <!-- placeholder: decision-record link when closed or deferred --> |

## Cross-cutting

<!-- Concerns that span epics. Each row names the owning epic — an unowned
cross-cutting concern rots. -->

| concern | owning epic | note |
|---|---|---|
| Export permissions must match the existing authZ model | E2 | E2 DoD carries the check <!-- example --> |
| <!-- placeholder: concern --> | <!-- placeholder: owning epic --> | <!-- placeholder: note --> |
