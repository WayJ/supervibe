---
name: sync
description: Use when the user says sync, pull main, update branches, or integrate upstream changes.
argument-hint: [sprint-id|all]
---

# supervibe:sync — cadence + clause discharge

The cadence entry point: on a rhythm, not only on events, merge `origin/main` into in-flight sprints (spec §2.5 — parallel sprints drift apart silently, and the fixed sync beat is what bounds the drift). "Pull main" and "update branches" route here and meet the same bar. Around the integration sit the two cross-sprint duties no other skill owns: checking handover clauses against the incoming changes, and discharging the ones the target side has now verified.

This skill owns exactly one mutation besides its merges: setting a clause `status: discharged` in the issuing doc's clause record. No sprint state transitions — every `state` flip belongs to roadmap/accept/merge — and no doc creation. The merge performed here is plain integration into a sprint branch, never the close-out merge of `supervibe:merge`. Naming a merged or closed sprint runs the clause side alone — the clause lifecycle does not dead-end at the carrier's teardown. Zero stack assumptions: every path comes from host config; merge mechanics belong to the host.

The run's product is the report: per sprint, what integrated, what conflicted and how it was resolved, which obligations fired and which of them closed with evidence. A sync that merges silently and reports nothing has done half its job — the report is what the next accept, merge, or sync reads.

## Read host config

Before anything, grep the host AGENTS.md for the `## supervibe` section:

- Config keys this skill reads: `sprints_dir`.
- Defaults when the key is absent: `sprints_dir: docs/superpowers/sprints/`.
- Section absent entirely → STOP: the only legal next action is `supervibe:roadmap scaffold` — direct the user there and refuse everything else.
- Once the section exists, resolve the configured dir this skill touches (`sprints_dir`) and verify it exists. Missing → STOP: direct the user to run scaffold or fix the config path; never implicitly create artifacts — a config path typo must not silently fork the truth source.
- This skill consumes no templates — clause records already live in the issuing sprint docs it reads.
- Gate commands from `### gates` are not this skill's concern — gates bind at accept and merge; integration runs none.

Then resolve the targets:

- Argument: a sprint id or `all`, never a path — a path argument → ask for the id of the sprint it carries.
- Absent → ask, listing the docs in `sprints_dir` whose frontmatter `state` is `active` or `acceptance`; never guess.
- Sprint id → scan every doc in `sprints_dir` for a frontmatter `sprint` match. No match → reject, naming the unknown sprint id.
- States in play: `active` / `acceptance` → the full sequence — merge, conflict checklist, clause check, discharge. `merged` / `closed` named explicitly → a clause-check + discharge-only pass, no merge: the doc lives on in `sprints_dir` on main and may still carry open clause references, and a verification can land at or after the target's own merge — the clause lifecycle must not dead-end there. Under `all`, merged/closed are skipped — `all` means exactly the active+acceptance set, nothing wider. `state` missing or unrecognized → surface the malformed doc in the report and skip it; never guess a state.
- `all` over an empty active+acceptance set → nothing is in flight: report that and stop — an empty `all` is a no-op, not an error.
- Each target gets its own report. A red ends that sprint's integration, never the run: remaining targets still sync, each on its own report.

## Cadence merge

Per in-flight target sprint, in that sprint's own carrier:

- Operate in the sprint's own worktree — the one the doc's `worktree` frontmatter names; one sprint = one worktree/branch, and the branch is the merge target. Never integrate from a stale checkout elsewhere.
- A `worktree` naming a branch that no longer exists → surface the staleness and confirm with the user before trusting the field — never proceed silently on it.
- A worktree carrying uncommitted changes → surface them and have the user commit or stash first: integration must not ride mixed with in-flight edits, and a conflict landing in dirt entangles the two beyond review.
- Refresh `origin/main` first, then capture the incoming range **before merging**: merge-base(sprint branch, origin/main)..origin/main tip — and keep **both** artifacts of the range, the commit list (subjects + bodies) and the changed-paths list: path triggers read one, feature triggers the other. The clause check below reads this range — after the merge the base moves and the range would read empty.
- Merge `origin/main` into the sprint branch the way this host merges, and name the resulting merge commit in the report. Nothing new on main → the merge is a no-op; record up-to-date and still run the clause check — nothing is fresh this round, but standing obligations are still owed and still checked.
- Verifying the integrated result is the sprint's own accept/merge domain: this skill integrates and reports, never runs gates or scenarios.
- It writes nothing to the sprint doc's ledger — no `state`, no fields, no flips — and never rebases or rewrites the sprint branch's history: the sanctioned rewrite surface (arrears repair before close-out) is merge's stage 1, not here.

## Conflict re-verify checklist

On conflict, classify every conflicted path dual-path per spec §2.5:

- **Generated artifacts** → never hand-merge: take the merged result, regenerate, and compare. A hand-edit inside a generated file is a smell to surface, not a resolution.
- **Handwritten files** → emit the item-by-item review list **before resolving anything**: per conflicted file, per hunk — both sides' intent and the proposed resolution. Then resolve, and carry the list into the report — it exists so the resolution stays auditable after the fact.
- The checklist is per sprint: separate integrations, separate review lists — never batch two sprints' conflicts into one resolution.
- Unresolvable → abort the merge (`git merge --abort`), stop that sprint's sync, report — never leave a MERGE_HEAD or conflict markers behind: a half-merged sprint branch is worse than an unsynced one.

## Handover clause check

The read side of the clause mechanism — body text lives only in issuing docs, references everywhere else:

- Read the target sprint doc's own frontmatter `clauses` field — it names the clauses owed **by** this sprint; no other doc's list is this target's business. Empty field → nothing owed; report the clean no-op.
- Resolve each HC# through the reference chain, per id:
  1. Scan every sprint doc's `## Handover Clauses` section for the record carrying that id — the doc whose section holds it is the issuing doc.
  2. Read `{id HC#, target, trigger, obligation, status: open|discharged, evidence}` from that record and nowhere else — the clause body lives only there.
  3. A reference resolving to no record → surface it as dangling; never guess, never mint a record to match. Id allocation (max+1; an empty scan starts at 1) belongs to `supervibe:start` — this skill only reads existing ids.
- A record already `discharged` → the obligation is met; list it as discharged in the report and move on.
- **Trigger = arrival, never this round's range**: a clause is triggered for the target when the issuing sprint's `merged-commit` is already reachable from the target's carrier — an in-flight target: ancestor check against its branch; a merged target in the discharge-only pass: reachability on main (both sprints already landed there; if the issuing merge happened after the target's, the clause arrives late — still triggered, still owed). Arrival counts however long ago it happened — an obligation owed for three syncs is still owed — and it never fires off the target's own work: the issuing commit can only arrive from main.
- Every triggered open clause surfaces its obligation **verbatim** — the issuing doc's obligation text, unedited — even when discharge is not possible this round: the text reaches the user when the obligation is owed, not only when it can be closed.
- The captured incoming range is the reporting layer, never the detection gate: an obligation whose arrival falls inside the range surfaces as fresh, an earlier arrival as standing — both surface, both check. A discharge-only pass captures no range; everything it holds is standing.
- Within that reporting layer, match the trigger against the range's artifacts: a path trigger matches the changed-paths list; a feature trigger matches the commit list — subjects and bodies naming the feature. Unsure whether a feature is named → treat as hit: surfacing is cheap, a missed obligation is not. A hit or miss here only annotates the report (fresh vs standing) — detection itself is arrival-based and the verbatim surfacing above happens regardless.
- Binding: a clause binds its target from the issuing sprint's merge on (merge fires them at its stage 6). Issuing doc frontmatter reading `merged` or beyond → binding; an unmerged issuer's clause is surfaced as not yet binding — information, not obligation — and is never discharged against.
- Not arrived → nothing is owed yet; report the clause as awaiting the issuing sprint's merge or its arrival on the target's carrier.

## Discharge

The write side — the one mutation this skill owns:

- Discharge requires both: the clause is triggered (arrival, above), **and** the obligation was verified on the target side with evidence in hand — a commit hash in the sprint branch or, for a merged target, on main, or a verification transcript (command + observed output). Expectation is not evidence; the bar is accept's.
- Write location: the issuing doc lives on **main** — its sprint is merged, that is why the clause binds — so the discharge write happens on the main-line checkout as an independent follow-up commit, exactly where merge's stage 5 writes its ledger finals. It never rides the target's sprint branch and never leaves a dirty tree.
- Verified → set `status: discharged` in the **issuing doc's clause record** — the single authority — and append date + evidence link to that same record. The issuing doc may belong to another epic or wave — cross-sprint by construction; the write goes there, wherever it lives. Never edit the target's reference list to fake closure: the reference outlives the obligation it pointed at, and closure is read from the issuing record, nowhere else.
- The discharge write touches `status`, date, and the evidence link only — never the trigger or obligation text: an obligation is closed as written or stays open.
- Not yet verifiable → partial: leave the clause open and report why — what was checked, what evidence is missing. It discharges at a later sync; a verification produced at the target's merge time (merge fires them; verification is the target's to produce — and merge never writes clause status) is recorded by the next sync, on that evidence.
- Report per sprint: integration result (merge commit / up-to-date / aborted / clause-pass only), the conflict checklist with its review list, and the clause table — open, discharged this round (with evidence links), already discharged, awaiting arrival, dangling.

## Invariants

- This skill owns exactly clause discharge — no sprint state transitions, no doc creation, no gate runs.
- The issuing doc's clause record is the only clause write surface; the target's reference list is never edited, by anyone, for any reason.
- Discharge only on evidence — triggered AND verified — never on expectation, never against a not-yet-binding clause.
- Detection is arrival-based; the incoming range reports freshness only and never gates a check.
- A clause whose target doc cannot be found → surface it in the report — the reference outlived its doc — never silently drop.
- HC# ids are only ever read here, never allocated, renumbered, or invented.
- Every mutation — a discharge — carries date + evidence link.
- Every run reports, per sprint, what integrated and what remains open — a sync without its report is incomplete.
- A sync never leaves a sprint branch half-merged: the merge is complete or aborted clean.
- The sprint doc's ledger is never touched: sync integrates, it does not adjudicate.
