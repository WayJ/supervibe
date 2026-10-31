---
name: complete
description: Use when the user says complete, close out, ship, finish, or wrap up a sprint.
argument-hint: <sprint-id>
---

# supervibe:complete — sprint close-out

The sprint close-out — the last act of a sprint: run the gates, confirm the acceptance verdict is in place, merge to main, finalize the sprint ledger, tear down the worktree, fire the handover clauses, write the closing note. "Ship", "finish", "wrap up" all route here and all meet the same bar — none of them is a reason to lower it.

This skill owns exactly one state transition — shared ledger `acceptance → merged`, with the merge commit hash written in the same act — and nothing else. Upstream, a pass at `supervibe:accept` is what unblocks this gate — and the cheapest window is the same session: run complete right after a passing accept, which reduces the drift window but does not waive the fingerprint check. Downstream, only `supervibe:roadmap close` remains (→closed, roadmap's act) and clause discharge (`supervibe:sync`'s). A stop along the way is a report, never a repair.

The discipline is **stop on red**: seven stages in a fixed order, hard stops between them. A sprint is value-boxed — it closes because its DoD was proven at accept and its gates run green now, never because it is time to ship. This skill never re-proves acceptance: the verdict is `supervibe:accept`'s, on record; here it is checked, not re-run. Zero stack assumptions — gate commands come from the host's `### gates` list, every path from host config, merge mechanics belong to the host. One sprint = one worktree/branch, from materialization to teardown.

This skill records the actual landing in the shared ledger first, then projects `state` and `merged-commit` into Markdown. A projection lag is a recoverable mismatch, never permission to overwrite shared authority from a branch copy.

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

From the host root run `node "<plugin base dir>/scripts/host-config.mjs" --require-dir sprints_dir --require-dir notes`. Use its returned paths, WIP, ordered verbatim gates and mappings; nonzero stops with the error, never implicit directory creation. Only explicit scaffold may handle missing config/directories; roadmap non-scaffold actions add `--require-dir <touched-directory-key>`. Resolve templates from the plugin directory. See [mechanical preflight](../../docs/mechanical-preflight.md) for grammar/defaults; do not reimplement parsing. Mappings also bind artifacts this skill writes. Stage 1 consumes every returned gate in order, only after its provenance preflight; record an empty list as such.

Then resolve the sprint being closed out. **Before ordinary state/gate checks, inspect §Interruption and resume for an already-landed merge, regardless of whether its carrier still exists.** Recovery records an evidenced landing; it does not authorize a new merge:

- Argument: a sprint id, never a path — a path argument → ask for the id of the sprint it carries.
- Absent → ask, listing the docs in `sprints_dir` whose frontmatter `state` is `acceptance`; never guess.
- Resolve identity through the unique `selection` from `artifact-inventory.mjs --sprint "<sprint-id>"`; nonzero reports `issues`, not another manual scan. For already-landed complete recovery, use its dedicated protocol first; never recreate a missing carrier.
- State precondition: `merged` → reject: already closed out — name the `merged-commit` the frontmatter carries. `closed` → reject: retired; `supervibe:roadmap close` has already been there. `active` / `acceptance` → proceed; stage 2 rules the verdict. `state` missing or unrecognized → reject as a malformed sprint doc, naming it — the closed enumeration never continues on an unknown value.
- The doc's `worktree` frontmatter names the worktree/branch carrying this sprint — stages 1, 3 and 5 operate there. A `worktree` that names nothing → the doc is malformed; reject naming it: there is nothing to gate, merge, or tear down.
- A `worktree` naming a branch that no longer exists → surface the staleness and confirm with the user before trusting the field — never proceed silently on it.
- One sprint per run: parallel sprints close one at a time, each through its own full sequence.

## Ordered sequence, stop on red

Seven stages, strictly ordered. Each numbered stage is a hard stop: green → the next stage; anything else → the run ends right there — the user sees the failing output, the sprint stays exactly where it was, nothing downstream runs. The order puts every check before every irreversible act: gates and verdict precede the merge, the merge precedes the ledger that records it, and the ledger precedes teardown — the carrier is destroyed only after the record of the landing exists. Red means: a gate command exits non-zero or its output contradicts expectation; arrears exist; the verdict is not in place; a conflict lacks its review list. Clearing a red belongs to execution (gate output, doc-sync arrears) or to `supervibe:accept` (the verdict); then complete runs again from stage 1 — a half-green run proves nothing.

1. **Provenance preflight, gates + doc-sync arrears final check.**
   - Before any gate cache or gate run, from the sprint's repository root run `node "<plugin base dir>/scripts/validate-workflow.mjs" verify-clean --sprint "<sprint-doc>" --record "<acceptance-record>"`, taking the record path from the sprint frontmatter `acceptance-record`. Nonzero → stop and route to a full `supervibe:accept`; re-running gates alone cannot refresh the scenario verdict. Missing legacy evidence requires reacceptance, not a hand-written fingerprint.
   - Commit all reviewed payload, the acceptance record and review metadata before complete; the sprint doc and acceptance record must be Git-tracked (an ignored record cannot authorize merge); committing unchanged content does not alter the fingerprint. `verify-clean` rejects staged, unstaged, and nonignored untracked changes, so the verified working files cannot differ from the branch being merged. The verifier requires `state: acceptance`, a matching explicit record pointer, verdict `pass`, and a matching `supervibe-evidence` snapshot. The exact acceptance record is excluded from its own fingerprint; all other tracked/nonignored inputs are covered except the three review metadata fields. The check is read-only: it does not repair state or prove that scenarios ran.
   - Run **every** command in the host's `### gates` list, verbatim — the whole list, no selection.
   - Run it in the sprint's own environment: the worktree/branch the frontmatter names, its stack live — not a stale build elsewhere. A gate green against yesterday's artifact proves nothing at merge time.
   - **Gate-evidence short-circuit**: the acceptance record's gate-evidence block — branch tip hash at run time, the gates list as run, the green outputs — satisfies this stage **iff** the branch tip now equals the recorded hash and the host's gates list is byte-identical to the recorded one: a tip that has not moved means the green was earned against exactly this tree. Any mismatch — new commits, a changed list, no block at all — is a full verbatim re-run. The short-circuit is mechanical equivalence, never judgment.
   - Any red → stop, showing the failing command's full output and naming the gate. A sprint does not merge while any gate is red — no partial credit, no substitution: the configured command runs, or the gate is not green.
   - Final arrears check: run `doc-sync.mjs` with the same arguments as accept (see [mechanical preflight](../../docs/mechanical-preflight.md)); nonzero stops and exposes per-commit/path arrears. Record an empty map. Do not manually reimplement glob, merge-base or same-commit checks.
   - The sanctioned repair is amend/rebase on the branch: rewriting branch history is permitted **before** merge — nothing has landed yet — so the owed doc lands in the same commit as the change that owes it; then this stage re-runs. Complete never writes the owed doc itself to green its own gate.

2. **Acceptance verdict in place.**
   - Green is exactly: the sprint doc frontmatter reads `state: acceptance`, **and** the acceptance record named by the frontmatter evidence link carries verdict `pass`. Never read the verdict off the state flip alone — open the linked record and confirm.
   - `active` → not currently accepted (including revoked/reworked reviews): route to `supervibe:accept`.
   - Re-run the provenance verifier after all gates and immediately before merge, then run `node "<plugin base dir>/scripts/shared-ledger.mjs" check --id "<sprint-id>"`. This requires shared acceptance and the exact stored accepted HEAD, not merely a Markdown pass. Any changed input, including a gate-generated tracked file, requires full reacceptance. A pass for another tree is stale even if the gates are now green.
   - Linked record `blocked`, missing, or a dangling link → not done. The **latest** record referenced by the evidence link governs, and a blocked record without a later pass stands blocked: route back to execution on the record's named blockers, then accept again.
   - Records are append-only and same-day re-runs take distinguishing suffixes — which record governs is decided by the evidence link, never by file dates or recency guesses: the link names the record; the record rules.

3. **Merge to main.** Refresh the actual target main first and require it to be an ancestor of the verified sprint candidate. Otherwise stop: integrate through `supervibe:sync`, reaccept if the fingerprint changes, and restart complete. Pin both target and candidate commits for the landing; if either moves, stop and repeat the checks. Use the host's protected/conditional merge mechanism where available; the read-only verifier cannot make a remote merge race atomic. Never claim that it does.
   - Land the already-verified result using the host's merge style (fast-forward, merge commit, or PR). No unverified code conflict resolution is allowed at landing. Any conflict or altered candidate returns to sync/execution, full accept, and complete from stage 1; abort a local conflicted merge. The §2.5 dual-path review list belongs to that integration, not an exemption from re-verification:
   - **Generated artifacts** → never hand-merge: take the merged result, regenerate, and compare. A hand-edit inside a generated file is a smell to surface, not a resolution.
   - **Handwritten files** → emit the item-by-item review list **before resolving anything**: per conflicted file, per hunk — both sides' intent and the proposed resolution. Then resolve, and carry the list into the closing note's decisions section — it exists so the resolution stays auditable after the fact.
   - After the merge lands, capture the **main-side landing commit** — the commit main actually received: the new main tip on fast-forward, the merge commit itself, or the squash/rebase commit on hosts that land one. That commit is the `merged-commit` and the evidence anchor everything downstream reads (dependency checks at start, clause discharge at sync, epic closure at roadmap). Reachability is what downstream checks — and a squash or rebase host never makes the branch tip an ancestor of main, so anchoring anywhere but the landing point silently breaks the clause trigger.
   - A conflict that cannot be resolved → abort the merge (`git merge --abort`), stop, and report — never leave a MERGE_HEAD or conflict markers behind: a half-merged main line is worse than an unmerged sprint.

4. **Shared landing recorded, then sprint projection finalized.**
   - From the shared Git repository (carrier need not survive recovery), call `shared-ledger.mjs land --landing "<actual-landing-SHA>" --main "<main-ref>"` with ID/revision/operation flags. `--main` must equal stored mainRef; it resolves the local main-branch ref and verifies candidate/evidence and landing reachability/tree equivalence before shared acceptance → merged. Only after success project the Markdown fields below. Shared merged plus stale Markdown → resume projection, never merge again.
   - These writes happen on the main-line checkout and land as a follow-up commit on merged main: `state: merged` plus `merged-commit: <the landing commit captured in stage 3>`.
   - The ledger records the landing **before** the carrier is torn down (stage 5): an interruption between the merge and the teardown must never leave a landed sprint with neither record nor carrier — record first, destroy second.
   - Append date + evidence link — the link is the recorded `merged-commit` hash. The whole stage is the same close-out act as the merge itself.
   - A landed merge whose ledger still reads `acceptance` is an incomplete close-out; a flipped state without its hash is incomplete the other way.

5. **Worktree/branch teardown.** Only after the ledger is finalized — never before: tearing down ahead of the record orphans the sprint's carrier and closes the resume path.
   - Remove the worktree and its branch per the host's tooling. The sprint doc survives in `sprints_dir` — the ledger outlives the worktree.
   - A teardown failure is reported and repaired but rolls nothing back: the merge has landed and the ledger (stage 4) already records that fact.

6. **Handover clauses fired.**
   - Every clause recorded in this sprint doc's Handover Clauses section is now **binding** on its target sprint. Clause lifecycle semantics — registration, reference placement, migration, trigger, discharge — are normative in spec §2.2; this stage only fires them and nothing moves here.
   - State the binding effect — fired HC#s with their targets — in the close-out summary and the closing note's handover section.
   - **Discharge belongs to `supervibe:sync`, never here**: this skill fires obligations; it never edits a clause's `status`.

7. **Closing note.** Write `<notes>/YYYY-MM-DD-<sprint>-close.md` per the four-section notes protocol; the filename date is today, the close-out date.
   - Four sections: background (what this sprint delivered, how it closed) / decisions (close-out rulings: arrears, conflict resolutions, teardown) / lessons (reusable close-out experience — gate failure modes, conflict patterns) / handover (the fired clauses and their binding effect, obligations owed to and from this sprint).
   - The note carries the recorded `merged-commit` hash as its evidence and cross-references the acceptance record — records and closing notes reference each other. A merged sprint without its closing note is incomplete.

All seven green: the sprint is merged, its ledger final, its clauses binding, its history written. Everything that remains acts on what this skill recorded — →closed and epic closure are roadmap's; clause discharge is sync's.

## Interruption and resume

A close-out that stops partway resumes by re-running, and the run routes on what already exists — never by redoing an irreversible act:

- **First classify the landing, before stage 1 or the target-main ancestry precondition**, whether the sprint carrier exists or not. A `--no-ff` merge can land while the ledger still reads `acceptance` and the worktree remains intact; main then advances past the candidate, so treating this as a new close-out would incorrectly demand sync/reacceptance.
- **Merge not landed** → nothing irreversible happened; the re-run starts over at stage 1.
- **State still `acceptance`, merge already landed, carrier present or absent** → verify the actual main-side landing using the original candidate and acceptance evidence plus Git/PR records. For a merge commit, inspect its parents and candidate reachability; for fast-forward, identify the actual landed candidate. Reachability alone without identifying this close-out's landing is insufficient. Squash/rebase or an ambiguous main log → identify the PR/landing mapping and confirm with the user; never guess. Verified → capture the landing and resume directly at stage 4 (`land` if shared acceptance, projection only if already shared merged), then teardown and remaining records. Do not repeat the merge, force sync, or require a new acceptance solely because the already-landed merge commit is ahead of the candidate. Unverifiable → stop and report; a suspected landing never becomes `merged` by assumption.
- **PR-style host, stage 3 ends at "PR opened"** → report and stop; the re-run reads the PR's state: still open → report and wait; merged → capture the landing commit, resume from stage 4; closed unmerged → the close-out is off — back to stage 1.
- **Shared ledger written, projection/teardown or later stages not** → the state precondition rejects a re-run (`merged` = already closed out): surface that only teardown, clause firing, or the closing note may remain, and finish those directly — they are records, not re-decisions.

## Never

- Never merge on a red gate, and never past doc-sync arrears — any red stops the run; there is no override and no exemption.
- Never merge on stale/missing provenance or after unverified conflict resolution.
- Never merge on a missing or mismatched verdict: state ≠ `acceptance`, or the linked record ≠ `pass`, is a stop. Never edit an acceptance record or its verdict to green this gate — records are append-only and `supervibe:accept`'s alone.
- Never discharge handover clauses here — firing them binding is this skill's act; recording evidence and setting `discharged` in the issuing doc's clause record belongs to `supervibe:sync`.
- Never touch the epic doc's Sprint Breakdown stub rows — roadmap's domain; the stub has read `started` since materialization and does not flip at merge.
- Never renumber ids — sprint ids and HC#s stay unique forever.
- Never tear down the worktree or branch before the merge has landed and the ledger is finalized.
- Never skip or reorder stages — the sequence itself is the gate.

## Worker release is independent of carrier teardown

Before landing, reconcile and settle all Sprint worker executions (including failed/blocked) with exact outcome and quiescence using [worker lifecycle](../../docs/worker-lifecycle.md). Do not let a retained dirty child worktree hold an execution slot. The coordinator handles completion/error events and runs authorized managed child cleanup, preserving branches; no new user request is needed for already-authorized safe cleanup. This script does not remove the canonical Sprint carrier. Stage 5 remains host-tooling cleanup after stage 4: require stopped writers, clean content and preserved/integrated results, never force removal. Record blocked cleanup for repair; shared `merged` already releases Sprint WIP. Resource groups require their own release proofs.
