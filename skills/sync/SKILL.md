---
name: sync
description: Use when the user says sync, pull main, update branches, or integrate upstream changes.
argument-hint: [sprint-id|all]
---

# supervibe:sync — cadence + clause discharge

The cadence entry point: on a rhythm, not only on events, merge `origin/main` into in-flight sprints (spec §2.5 — parallel sprints drift apart silently, and the fixed sync beat is what bounds the drift). "Pull main" and "update branches" route here and meet the same bar. Around the integration sit the two cross-sprint duties no other skill owns: checking handover clauses against the incoming changes, and discharging the ones the target side has now verified.

This skill owns exactly one mutation besides its merges: setting a clause `status: discharged` in the issuing doc's clause record. No sprint state transitions — every `state` flip belongs to roadmap/accept/merge — and no doc creation. The merge performed here is plain integration into a sprint branch, never the close-out merge of `supervibe:merge`. Zero stack assumptions: every path comes from host config; merge mechanics belong to the host.

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
- States in play: `active` / `acceptance` → proceed. `merged` / `closed` → skip, named in the report — there is no carrier left to integrate into. `state` missing or unrecognized → surface the malformed doc in the report and skip it; never guess a state.
- `all` means exactly the active+acceptance set, nothing wider — never merged, never closed. That set empty → nothing is in flight: report that and stop — an empty `all` is a no-op, not an error.
- Each target runs the full sequence — merge, conflict checklist, clause check, discharge — and gets its own report. A red ends that sprint's integration, never the run: remaining targets still sync, each on its own report.

## Cadence merge

Per target sprint, in that sprint's own carrier:

- Operate in the sprint's own worktree — the one the doc's `worktree` frontmatter names; one sprint = one worktree/branch, and the branch is the merge target. Never integrate from a stale checkout elsewhere.
- A `worktree` naming a branch that no longer exists → surface the staleness and confirm with the user before trusting the field — never proceed silently on it.
- A worktree carrying uncommitted changes → surface them and have the user commit or stash first: integration must not ride mixed with in-flight edits, and a conflict landing in dirt entangles the two beyond review.
- Refresh `origin/main` first, then capture the incoming range **before merging**: merge-base(sprint branch, origin/main)..origin/main tip. The clause check below diffs exactly this range — after the merge the base moves and the range would read empty.
- Merge `origin/main` into the sprint branch the way this host merges, and name the resulting merge commit in the report. Nothing new on main → the merge is a no-op; record up-to-date and still run the clause check — an empty incoming diff simply fires no triggers.
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

- Scan every doc in `sprints_dir` for frontmatter `clauses` reference lists; the target sprint's own list names the clauses owed **by** it — it is the target.
- Resolve each HC# through the reference chain, per id:
  1. Scan every sprint doc's `## Handover Clauses` section for the record carrying that id — the doc whose section holds it is the issuing doc.
  2. Read `{target, trigger, obligation, status, evidence}` from that record and nowhere else — `{id HC#, target, trigger, obligation, status: open|discharged, evidence}` lives only there.
  3. A reference resolving to no record → surface it as dangling; never guess, never mint a record to match. Id allocation (max+1; an empty scan starts at 1) belongs to `supervibe:start` — this skill only reads existing ids.
- A record already `discharged` → the obligation is met; list it as discharged in the report and move on.
- Diff the captured incoming range against each open clause's trigger: a path trigger matches paths changed in the range; a feature trigger matches the incoming commits' scope — subjects and bodies naming the feature. A hit → surface the obligation **verbatim** — the issuing doc's obligation text, unedited — even when discharge is not possible this round: the text reaches the user when the trigger fires, not only when it can be closed.
- Match the trigger against the incoming range only — never against the target's own work or its earlier integrations: an obligation fires when the issuing side's change arrives from main, and nothing else fires it.
- Binding: a clause binds its target from the issuing sprint's merge on (merge fires them at its stage 6). Issuing doc frontmatter reading `merged` or beyond → binding; an unmerged issuer's clause is surfaced as not yet binding — information, not obligation — and is never discharged against.
- No hit → the clause stays open; nothing is owed this round. Open-after-sync is a normal state, not a failure.

## Discharge

The write side — the one mutation this skill owns:

- Discharge requires both: the trigger fired this round, **and** the obligation was verified on the target side with evidence in hand — a commit hash in the sprint branch or a verification transcript (command + observed output). Expectation is not evidence; the bar is accept's.
- Verified → set `status: discharged` in the **issuing doc's clause record** — the single authority — and append date + evidence link to that same record. The issuing doc may belong to another epic or wave — cross-sprint by construction; the write goes there, wherever it lives. Never edit the target's reference list to fake closure: the reference outlives the obligation it pointed at, and closure is read from the issuing record, nowhere else.
- The discharge write touches `status`, date, and the evidence link only — never the trigger or obligation text: an obligation is closed as written or stays open.
- Not yet verifiable → partial: leave the clause open and report why — what was checked, what evidence is missing. It discharges at a later sync; a verification that happened at the target's merge (merge fires and verifies, but never writes clause status) is recorded by the next sync, on that evidence.
- Report per sprint: integration result (merge commit / up-to-date / aborted), the conflict checklist with its review list, and the clause table — open, discharged this round (with evidence links), already discharged, dangling.

## Invariants

- This skill owns exactly clause discharge — no sprint state transitions, no doc creation, no gate runs.
- The issuing doc's clause record is the only clause write surface; the target's reference list is never edited, by anyone, for any reason.
- Discharge only on evidence — trigger fired AND obligation verified — never on expectation, never against a not-yet-binding clause.
- HC# ids are only ever read here, never allocated, renumbered, or invented.
- Every mutation — a discharge — carries date + evidence link.
- Every run reports, per sprint, what integrated and what remains open — a sync without its report is incomplete.
- A sync never leaves a sprint branch half-merged: the merge is complete or aborted clean.
- The sprint doc's ledger is never touched: sync integrates, it does not adjudicate.
