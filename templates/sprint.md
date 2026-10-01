---
sprint: S1                 <!-- placeholder: sprint id -->
epic: E1                   <!-- placeholder: owning epic id -->
state: active              <!-- placeholder: active|acceptance|merged|closed -->
worktree:                  <!-- placeholder: branch/worktree path -->
early-start: false         <!-- placeholder: true|false -->
deferred-dependency: []    <!-- placeholder: list of sprint ids -->
clauses: []                <!-- placeholder: list of HC# references -->
merged-commit: null        <!-- placeholder: branch-tip hash recorded at merge -->
---

# <!-- placeholder: sprint title, one line -->

<!-- Template note: this doc IS the sprint ledger — from materialization on,
the frontmatter state is authoritative (starts active). One sprint = one
worktree/branch. State transitions have single owners: start (active), accept
(acceptance), merge (merged), roadmap (closed); never flip a state here by
hand. Fill every placeholder fill-in, replace the example-marked rows with
real content, keep the five section headings verbatim, then delete template
notes. -->

## Decisions (D-x)

<!-- D-x numbering is local to this sprint doc. Cite lessons pulled from the
notes history (source entry + section) — a cited lesson is evidence, an
uncited one is opinion. -->

| id | decision | rationale | rejected alternatives |
|---|---|---|---|
| D1 | Use the existing CSV library rather than hand-rolling a writer | already a dependency; handles quoting and escaping edge cases | hand-rolled writer — rejected: escaping bugs are exactly what acceptance S2 catches <!-- example --> |
| <!-- placeholder: D# --> | <!-- placeholder: decision --> | <!-- placeholder: rationale --> | <!-- placeholder: rejected alternatives --> |

## Stories & Tasks

<!-- Wave/task checkbox rows: tasks grouped under wave headings. A box is
checked only with evidence (command run, scenario passed) — never pre-check. -->

### Wave 1 — <!-- placeholder: wave name -->

- [ ] Add the /export/billing.csv route returning bounded result sets <!-- example -->
- [ ] <!-- placeholder: task -->

## Definition of Done

<!-- INVARIANT: copied VERBATIM from the epic doc's Definition of Done — never
edited in place. A DoD change goes back to the epic doc as an amendment and is
re-copied from there; it is never changed inside this doc. -->

- [ ] Export totals reconcile with invoiced totals to the cent <!-- example, verbatim from the epic DoD -->
- [ ] <!-- placeholder: DoD item, verbatim from the epic doc -->

## Acceptance Scenarios (S1–Sn)

<!-- Each scenario runs for real at accept time — browser, CLI, stack commands
as specified. Evidence before claims: a pass without a fresh run is not a
pass. -->

| id | scenario | how to verify | expected |
|---|---|---|---|
| S1 | Export a bounded quarter | `curl -sf -u tester -o /tmp/q3.csv https://api.local/export/billing.csv?quarter=2026Q3 && wc -l /tmp/q3.csv` | 200; line count matches the invoiced-lines count for Q3 <!-- example --> |
| <!-- placeholder: S# --> | <!-- placeholder: scenario --> | <!-- placeholder: how to verify --> | <!-- placeholder: expected --> |

## Handover Clauses

<!-- Clause record format (the single source of truth for clause text lives
HERE, in the issuing doc; every other artifact holds references only):

id HC# | target | trigger | obligation | status open|discharged | evidence

id: HC# by max+1 across every sprint doc's Handover Clauses sections; an
empty scan starts at 1; ids are never reused. target: target sprint id, or
"<epic> breakdown S#" while the target has no doc yet. trigger: the incoming
change that fires re-verification (path or feature hit). obligation: the
review owed, verbatim. status: open at registration; set to discharged only
by the target side's sync, never at merge. evidence: commit hash or
verification transcript, written at discharge. Register per
templates/handover-clause.md. -->

| id | target | trigger | obligation | status | evidence |
|---|---|---|---|---|---|
| HC1 | S4 | billing module merged to main | re-run the S1 acceptance suite; confirm export totals still reconcile with the invoice ledger | open | — none yet; discharge writes it here <!-- example --> |
| <!-- placeholder: HC# --> | <!-- placeholder: target --> | <!-- placeholder: trigger --> | <!-- placeholder: obligation --> | open | <!-- placeholder: evidence at discharge --> |
