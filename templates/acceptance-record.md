# Acceptance record — sprint <!-- placeholder: sprint id -->, <!-- placeholder: run date -->

<!-- Template note: written by the accept step as
<acceptances_dir>/YYYY-MM-DD-<sprint>-acceptance.md — the date is the
acceptance-run date. Records are append-only: a same-day re-run never
overwrites an earlier record, it takes a distinguishing suffix (-2, -3, …);
the sprint doc's acceptance-record pointer names the latest completed attempt;
only acceptance state with pass can authorize close-out.
Fill every placeholder fill-in, replace the example-marked rows/lines with real
content, keep the section headings verbatim, then delete template
notes. -->

## Verdict

<!-- One word first — pass or blocked — then the basis. pass requires ALL of:
every scenario passed with fresh evidence or a labeled substitution; every
DoD item checked with evidence; no unpaid doc-sync drift on triggered rows.
Anything less is blocked, naming the blocking items. -->

pass — all scenarios green on fresh runs; no unpaid drift on triggered rows <!-- example -->

## Acceptance Evidence

<!-- Insert exactly one fenced supervibe-evidence block containing the JSON
emitted by scripts/validate-workflow.mjs snapshot BEFORE verification.
Run snapshot again after verification and require identical JSON for pass.
Keys: schema (1), sprint (repo-relative doc path), record (this exact
repo-relative record path), fingerprint (SHA-256). Never hand-author a hash.
Legacy records without this block cannot authorize complete: reaccept.
The block binds inputs, not external environment state or proof of execution. -->

```supervibe-evidence
{"schema":1,"sprint":"<sprint-doc>","record":"<this-record>","fingerprint":"<snapshot fingerprint>"}
```

## Gate Evidence

<!-- Optional cache: record branch tip hash at gate-run time, exact ordered
configured commands that ran, and full green outputs/evidence links. Reuse
requires unchanged tip and byte-identical gate list; otherwise rerun gates.
This cache NEVER substitutes for Acceptance Evidence verification. -->

## Scenario Results

<!-- Columns: id, command, expected, actual, pass. Each scenario ran for
real: identify the proving command, run it, read the full output, only then
claim. Substituted evidence must be labeled as such. -->

| id | command | expected | actual | pass |
|---|---|---|---|---|
| S1 | `curl -sf -u tester -o /tmp/q3.csv https://api.local/export/billing.csv?quarter=2026Q3 && wc -l /tmp/q3.csv` | 200; 4,012 lines | 200; 4,012 lines | yes <!-- example --> |
| <!-- placeholder: S# --> | <!-- placeholder: command --> | <!-- placeholder: expected --> | <!-- placeholder: actual --> | <!-- placeholder: yes or no --> |

## DoD Checklist

<!-- Every item checked with evidence. Items come from the sprint doc's DoD,
itself verbatim from the epic doc. -->

- [x] Export totals reconcile with invoiced totals to the cent — export-vs-ledger diff: 0.00 <!-- example -->
- [ ] <!-- placeholder: DoD item --> — <!-- placeholder: evidence -->

## Obstacles (verbatim)

<!-- Every blocker, workaround, and substitution, as it happened — appended
during the run, never reconstructed afterward. No greenwashing: no softened
wording, no dropped failures. Each entry carries the exact command line and
its observed output; a workaround that cannot be replayed is not reusable.
Cite the source of reused workarounds (notes history entry); an improvised
one also becomes a notes entry citing this record back. -->

- 2026-10-05 14:20 — psql auth failed for the test role (FATAL: role "tester" does not exist); worked around with the role created by `make db-seed`; source: improvised here <!-- example -->

## Doc-Drift Audit

<!-- Per doc_sync_map row: the paths this sprint changed that match the row's
pattern, the mapped doc's state (current or drifted, as found this run), drift detail. An absent
or empty map is a clean audit — record that no rows were configured; never
invent rows. Drift on a triggered row is arrears: fix and re-audit, or the
verdict carries it. -->

| map row (change, owes) | matched this sprint | doc state | detail |
|---|---|---|---|
| src/api/** → docs/api.md | yes — src/api/export.py | drifted | endpoint missing from docs/api.md; fixed this run, re-audit current <!-- example --> |
| <!-- placeholder: change pattern and owed doc --> | <!-- placeholder: matched paths, or none --> | <!-- placeholder: current, drifted, or n/a --> | <!-- placeholder: detail --> |
