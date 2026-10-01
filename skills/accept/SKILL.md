---
name: accept
description: Use when the user asks to accept, review, or verify a sprint, or asks whether a sprint is done.
argument-hint: <sprint-id or plan path>
---

# supervibe:accept — sprint review gate

The sprint review gate: run every acceptance scenario for real, check every DoD item against evidence, record obstacles verbatim, audit doc drift — then write the acceptance record and rule the verdict. A verdict is a claim about observed behavior, and the discipline of this skill is **evidence before claims**: nothing passes on expectation, memory, or an earlier run. "Is this sprint done?" gets the same treatment — the answer is the verdict, backed by fresh evidence, never an opinion.

This is the checkpoint where the execution layer's claims meet the strategic layer's standards: a pass here is what unblocks `supervibe:merge`. Zero stack assumptions: proving commands come from the scenario text and the host's `### gates` config — never invented; every path comes from host config, never hardcoded.

## Inputs

Before anything, grep the host AGENTS.md for the `## supervibe` section:

- Config keys this skill reads: `sprints_dir`, `acceptances_dir`, `notes`; subsections `### gates` and `### doc_sync_map`.
- Defaults when a key is absent: `sprints_dir: docs/superpowers/sprints/`, `acceptances_dir: docs/superpowers/acceptances/`, `notes: .agents/notes/`.
- Section absent entirely → STOP: the only legal next action is `supervibe:roadmap scaffold` — direct the user there and refuse everything else.
- Once the section exists, resolve the configured dirs this skill touches (`sprints_dir`, `acceptances_dir`, `notes`) and verify they exist. Missing → STOP: direct the user to run scaffold or fix the config path; never implicitly create artifacts — a config path typo must not silently fork the truth source.
- Resolve the template as `<plugin base dir>/templates/acceptance-record.md`; never assume it lives in the host repo.
- `### gates` is a command source, not a checklist to run wholesale: when a scenario names a gate, run the configured command verbatim; never invent commands, runners, or stack specifics.
- Consult `### doc_sync_map` before writing the acceptance record: if the map covers an artifact path this skill writes, the map takes precedence — the "artifacts this skill writes owe no further doc-sync" exemption holds only for uncovered paths.

Then resolve the sprint under review:

- Argument: a sprint id or a direct sprint-doc path. Absent → ask, listing the docs in `sprints_dir` whose frontmatter `state` is `active`; never guess.
- Sprint id → scan every doc in `sprints_dir` for a frontmatter `sprint` match. No match → reject, naming the unknown sprint id. Direct path → the file must exist and carry a `sprint` frontmatter field; otherwise reject, naming the path.
- State precondition on the sprint doc's frontmatter: `active` → proceed. `acceptance` → reject: already passed its gate; name the existing acceptance record. `merged` / `closed` → reject: past the gate.

## Execute scenarios

Read the sprint doc's `## Acceptance Scenarios (S1–Sn)` section. Each scenario runs for real, exactly as its text specifies — browser, CLI, stack commands. A scenario is an observation to make, not a box to tick.

Reject the malformed doc before anything runs: the Acceptance Scenarios section missing or empty → reject, naming the malformed sprint doc — zero scenarios must never yield a vacuous pass. A missing `## Definition of Done` section → reject the same way; the DoD lives verbatim in the epic doc — direct the fix there, never patch it into the sprint doc.

Run against the sprint's own environment — the worktree/branch the sprint doc's `worktree` frontmatter names, with its stack live — not a stale build elsewhere: a proving run against yesterday's artifact is not evidence.

**Evidence before claims — never claim pass without a fresh run** (explicit discipline pattern, adapted from superpowers' verification-before-completion — no completion claims without fresh verification evidence):

1. Identify the proving command — the one whose full output demonstrates the scenario's expected observation.
2. Run it — for real, now, in the sprint's own environment.
3. Read the full output — not the exit code alone, not the first line.
4. Only then claim — and cite: per scenario, the record's result table carries the proving command, the outcome, and the evidence (output excerpt or artifact path).

"Should pass", a previous run, a partial check, and the author's confidence are not evidence. A scenario that cannot run at all is recorded as not-run with the reason — never silently skipped, never counted as pass.

When a scenario's text admits two readings, run the stricter one — the review gate never benefits from the charitable interpretation.

On an obstacle — a command fails, the environment blocks, the output contradicts expectation — search the notes dir for prior workarounds first: grep by the obstacle's keywords (error strings, tool names, failure mode). A hit → reuse the workaround and cite the source entry (file + section) in the record. No hit → improvise the narrowest workaround and record it verbatim in the obstacles log. An empty notes dir is not an error — a first sprint has no history; say so and proceed.

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

The periodic doc-sync checkpoint of this skill — the counterpart to merge's final arrears check:

- Enumerate the sprint's changed paths: the branch recorded in the sprint doc's `worktree` frontmatter diffed against its base — the merge-base with the main line — plus the paths named in the doc's Stories & Tasks.
- For each row of the host's `### doc_sync_map`: does the row's change pattern match any changed path? Match → open the mapped doc and check that it reflects the change. No match → the row owes nothing this sprint.
- An absent or empty map is a clean audit — record that no rows were configured; never invent rows.
- Emit a drift report section in the record: per row — matched paths, the mapped doc's state (current / drifted), drift detail.
- Drift on a triggered row is doc-sync arrears: direct the fix now and re-audit, or the verdict carries it — a pass cannot ride on unpaid drift on rows this sprint triggered.

## Verdict + record

Write `<acceptances_dir>/YYYY-MM-DD-<sprint>-acceptance.md` from `templates/acceptance-record.md`; the date is today, the acceptance-run date. The record carries at minimum: the scenario result table, the DoD checklist with evidence, the verbatim obstacles log, the drift report, and the verdict. Records are append-only — a same-day re-run never overwrites an earlier record; it takes a distinguishing suffix (`-2`, `-3`, …); the frontmatter evidence link points at the passing record.

- **pass** requires all of: every scenario passed with fresh evidence or a labeled substitution; every DoD item checked with evidence; no unpaid drift on triggered rows. Anything less → **blocked**, naming the blocking items.
- pass → update the sprint doc frontmatter `state: acceptance`, appending date + the record path as the evidence link. The record and the flip are written in the same act — a flipped state without its record is incomplete.
- blocked → the record is still written and kept — evidence preserves. State stays `active`: the sprint returns to execution to clear the named blockers and is accepted again afterwards; each run writes its own record.

The record is the evidence anchor for what follows: merge's closing note cites it back — records and closing notes reference each other.

## Invariants

- This skill owns exactly one state transition: sprint-doc frontmatter `active → acceptance`, on verdict pass only. Never `merged`/`closed` (merge/roadmap), never clause discharge (sync), never stub states (roadmap/start).
- The frontmatter state flip is the only mutation this skill makes to the sprint doc — scenarios, DoD, stories, and clauses are inputs to review, never targets to edit toward a pass.
- Evidence before claims, every scenario, every DoD item, every run — a pass without a fresh run is not a pass.
- Acceptance records are append-only; history is never rewritten or greenwashed.
- Any reference to an unknown sprint id → reject, naming it.
- Every mutation — the state flip — carries date + evidence link.
