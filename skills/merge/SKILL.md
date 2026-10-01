---
name: merge
description: Use when the user says merge, close out, ship, finish, or wrap up a sprint.
argument-hint: <sprint-id>
---

# supervibe:merge — sprint close-out

The sprint close-out — the last act of a sprint: run the gates, confirm the acceptance verdict is in place, merge to main, tear down the worktree, finalize the sprint ledger, fire the handover clauses, write the closing note. "Ship", "finish", "wrap up" all route here and all meet the same bar — none of them is a reason to lower it.

This skill owns exactly one state transition — sprint-doc frontmatter `acceptance → merged`, with the merge commit hash written in the same act — and nothing else. Upstream, a pass at `supervibe:accept` is what unblocks this gate. Downstream, only `supervibe:roadmap close` remains (→closed, roadmap's act) and clause discharge (`supervibe:sync`'s). A stop along the way is a report, never a repair.

The discipline is **stop on red**: seven stages in a fixed order, hard stops between them. A sprint is value-boxed — it closes because its DoD was proven at accept and its gates run green now, never because it is time to ship. This skill never re-proves acceptance: the verdict is `supervibe:accept`'s, on record; here it is checked, not re-run. Zero stack assumptions — gate commands come from the host's `### gates` list, every path from host config, merge mechanics belong to the host. One sprint = one worktree/branch, from materialization to teardown.

The ledger this skill finalizes is the sprint doc's frontmatter: `state` and `merged-commit` (null since materialization). The flip sets one field and fills the other — two writes, one close-out, never split across sessions.

## Read host config

Before anything, grep the host AGENTS.md for the `## supervibe` section:

- Config keys this skill reads: `sprints_dir`, `notes`; subsections `### gates` and `### doc_sync_map`.
- Defaults when a key is absent: `sprints_dir: docs/superpowers/sprints/`, `notes: .agents/notes/`.
- Section absent entirely → STOP: the only legal next action is `supervibe:roadmap scaffold` — direct the user there and refuse everything else.
- Once the section exists, resolve the configured dirs this skill touches (`sprints_dir`, `notes`) and verify they exist. Missing → STOP: direct the user to run scaffold or fix the config path; never implicitly create artifacts — a config path typo must not silently fork the truth source.
- `### gates` here is the checklist itself — unlike accept, where it is a command source: every command in the list runs, verbatim. An absent or empty list is not an error — record that none are configured and proceed; never invent a gate to fill the silence.
- `### doc_sync_map` powers the arrears final check in stage 1 below.
- This skill consumes no templates — the frontmatter flip follows the ledger contract; the closing note follows the notes protocol.

Then resolve the sprint being closed out:

- Argument: a sprint id, never a path — a path argument → ask for the id of the sprint it carries.
- Absent → ask, listing the docs in `sprints_dir` whose frontmatter `state` is `acceptance`; never guess.
- Scan every doc in `sprints_dir` for a frontmatter `sprint` match. No match → reject, naming the unknown sprint id.
- State precondition: `merged` → reject: already closed out — name the `merged-commit` the frontmatter carries. `closed` → reject: retired; `supervibe:roadmap close` has already been there. `active` / `acceptance` → proceed; stage 2 rules the verdict.
- The doc's `worktree` frontmatter names the worktree/branch carrying this sprint — stages 1, 3 and 4 operate there. A `worktree` that names nothing → the doc is malformed; reject naming it: there is nothing to gate, merge, or tear down.
- One sprint per run: parallel sprints close one at a time, each through its own full sequence.

## Ordered sequence, stop on red

Seven stages, strictly ordered. Each numbered stage is a hard stop: green → the next stage; anything else → the run ends right there — the user sees the failing output, the sprint stays exactly where it was, nothing downstream runs. The order puts every check before every irreversible act: gates and verdict precede the merge, the merge precedes teardown, teardown precedes the writes that record it. Red means: a gate command exits non-zero or its output contradicts expectation; arrears exist; the verdict is not in place; a conflict lacks its review list. Clearing a red belongs to execution (gate output, doc-sync arrears) or to `supervibe:accept` (the verdict); then merge runs again from stage 1 — a half-green run proves nothing.

1. **Gates + doc-sync arrears final check.**
   - Run **every** command in the host's `### gates` list, verbatim — the whole list, no selection.
   - Run it in the sprint's own environment: the worktree/branch the frontmatter names, its stack live — not a stale build elsewhere. A gate green against yesterday's artifact proves nothing at merge time.
   - Any red → stop, showing the failing command's full output and naming the gate. A sprint does not merge while any gate is red — no partial credit, no substitution: the configured command runs, or the gate is not green.
   - Then the **arrears final check** — the second of the doc-sync discipline's two checkpoint verifications (accept audits drift periodically; merge runs the final arrears check).
   - Enumerate the sprint's changed paths: the worktree branch diffed against its merge-base with the main line, plus the paths named in the sprint doc's Stories & Tasks — the same enumeration accept's drift audit uses; the two checkpoints must see the same sprint.
   - For each `### doc_sync_map` row whose change pattern matches a changed path, the mapped doc must carry its update **in the same commit as the change that owes it**. An owed doc without a same-commit change is arrears → stop, naming the row, the mapped doc, and what is owed.
   - Unmatched rows owe nothing. An absent or empty map is a clean check — record that; never invent rows.
   - Arrears are repaired in the sprint's branch — the owed doc lands in the same commit as the change that owes it — and this stage re-runs. Merge never writes the owed doc itself to green its own gate.

2. **Acceptance verdict in place.**
   - Green is exactly: the sprint doc frontmatter reads `state: acceptance`, **and** the acceptance record named by the frontmatter evidence link carries verdict `pass`. Never read the verdict off the state flip alone — open the linked record and confirm.
   - `active` → never accepted: route to `supervibe:accept`.
   - Linked record `blocked`, missing, or a dangling link → not done. The **latest** record referenced by the evidence link governs, and a blocked record without a later pass stands blocked: route back to execution on the record's named blockers, then accept again.
   - Records are append-only and same-day re-runs take distinguishing suffixes — which record governs is decided by the evidence link, never by file dates or recency guesses: the link names the record; the record rules.

3. **Merge to main.** Merge the sprint's branch into the main line the way this host merges. On conflict, resolve per the §2.5 checklist, dual path:
   - **Generated artifacts** → never hand-merge: take the merged result, regenerate, and compare. A hand-edit inside a generated file is a smell to surface, not a resolution.
   - **Handwritten files** → emit the item-by-item review list **before resolving anything**: per conflicted file, per hunk — both sides' intent and the proposed resolution. Then resolve, and carry the list into the closing note's decisions section — it exists so the resolution stays auditable after the fact.
   - However the host lands it — fast-forward, merge commit, PR — record the hash main ends up holding at this sprint's tip: that hash is the `merged-commit`, the evidence anchor everything downstream reads (dependency checks at start, clause discharge at sync, epic closure at roadmap).

4. **Worktree/branch teardown.** Only after the merge has landed — never before: tearing down ahead of the merge orphans the sprint's carrier.
   - Remove the worktree and its branch per the host's tooling. The sprint doc survives in `sprints_dir` — the ledger outlives the worktree.
   - A teardown failure is reported and repaired but rolls nothing back: the merge has landed, and stages 5–7 record that fact regardless.

5. **Sprint doc frontmatter finalized.**
   - Write `state: merged` and `merged-commit: <hash>` into the sprint doc's frontmatter, appending date + evidence link — the same close-out act as the merge itself.
   - A landed merge whose ledger still reads `acceptance` is an incomplete close-out; a flipped state without its hash is incomplete the other way.

6. **Handover clauses fired.**
   - Every clause recorded in this sprint doc's Handover Clauses section is now **binding** on its target sprint: from this merge on, the target's sync/merge must verify the obligation when it integrates.
   - Nothing moves — target references were placed at registration (the target doc's frontmatter `clauses` list where the doc existed; the in-clause `target: <epic> breakdown S#` row for a future sprint, migrated at that sprint's materialization).
   - State the binding effect — fired HC#s with their targets — in the close-out summary and the closing note's handover section.
   - **Discharge belongs to `supervibe:sync`, never here**: this skill fires obligations; it never edits a clause's `status`.

7. **Closing note.** Write `<notes>/YYYY-MM-DD-<sprint>-close.md` per the four-section notes protocol; the filename date is today, the close-out date.
   - Four sections: background (what this sprint delivered, how it closed) / decisions (close-out rulings: arrears, conflict resolutions, teardown) / lessons (reusable close-out experience — gate failure modes, conflict patterns) / handover (the fired clauses and their binding effect, obligations owed to and from this sprint).
   - The note carries the merge commit hash as its evidence and cross-references the acceptance record — records and closing notes reference each other. A merged sprint without its closing note is incomplete.

All seven green: the sprint is merged, its ledger final, its clauses binding, its history written. Everything that remains acts on what this skill recorded — →closed and epic closure are roadmap's; clause discharge is sync's.

## Never

- Never merge on a red gate, and never past doc-sync arrears — any red stops the run; there is no override and no exemption.
- Never merge on a missing or mismatched verdict: state ≠ `acceptance`, or the linked record ≠ `pass`, is a stop. Never edit an acceptance record or its verdict to green this gate — records are append-only and `supervibe:accept`'s alone.
- Never discharge handover clauses here — firing them binding is this skill's act; recording evidence and setting `discharged` in the issuing doc's clause record belongs to `supervibe:sync`.
- Never touch the epic doc's Sprint Breakdown stub rows — roadmap's domain; the stub has read `started` since materialization and does not flip at merge.
- Never renumber ids — sprint ids and HC#s stay unique forever.
- Never tear down the worktree or branch before the merge has landed.
- Never skip or reorder stages — the sequence itself is the gate.
