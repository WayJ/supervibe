---
epic: E1            <!-- placeholder: next epic id, scan roadmaps/ for max+1 -->
status: open        <!-- placeholder: open|closed -->
date: 2026-10-01    <!-- placeholder: creation date -->
---

# <!-- placeholder: epic title, one line naming the deliverable -->

<!-- Template note: epic doc = strategic truth source for one epic. Pre-start
sprint states (planned / ready) live ONLY in the Sprint Breakdown stub rows;
from started on, state lives in the sprint doc's frontmatter. Every mutation
appends date + evidence link. Fill every placeholder fill-in, replace the
example-marked rows with real content, keep the seven section headings
verbatim, then delete template notes. -->

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

- [ ] Export totals reconcile with invoiced totals to the cent <!-- example -->
- [ ] <!-- placeholder: DoD item, checkable with evidence -->

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
