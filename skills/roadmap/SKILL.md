---
name: roadmap
description: Manage the strategic roadmap — scaffold a repo for supervibe, add epics with Definition of Done, record ADR decisions, manage open questions, asset disposition, and tech-debt entries. Use when the user mentions roadmap, epic, ADR, tech debt, or wiring a project to supervibe.
argument-hint: [scaffold|epic|adr|question|asset|debt|ready|close]
---

# supervibe:roadmap — strategic truth source

Own everything in `roadmap.md` plus the `## supervibe` section of the host's AGENTS.md. `roadmap.md` carries six elements: Epics table, Sprint Ledger, ADR table, Asset Disposition, Open Questions, Cross-cutting. Terminology is Scrum-aligned: epic / sprint / DoD (Definition of Done) / story; a sprint is value-boxed — closed by DoD, never time-boxed. The Sprint Ledger inside `roadmap.md` is the authoritative state store: each row is `{sprint id, epic ref, state, worktree/branch, early-start flag, deferred-dependency refs, open handover-clause ids, merged commit hash}` with states `planned → ready → active → acceptance → merged → closed`; plan headers carry human-readable copies only, never the reverse. Zero stack assumptions: gate commands and doc-sync mappings live in the host AGENTS.md — never hardcode any.

Dispatch on the subcommand argument (`scaffold|epic|adr|question|asset|debt|ready|close`). If it is absent or unrecognized, list the subcommands and ask. Every file path below comes from host config, not from assumptions about the host repo layout.

## Read host config first

Before any subcommand, grep the host AGENTS.md for the `## supervibe` section:

- Config keys: `roadmap`, `notes`, `plans`, `acceptance`, `debt_tracker`, `wip_limit`; subsections `### gates` and `### doc_sync_map`.
- Defaults when a key is absent: `roadmap: docs/roadmap.md`, `notes: .agents/notes/`, `plans: docs/plans/`, `acceptance: docs/acceptance/`, `debt_tracker: docs/tech-debt-tracker.md`, `wip_limit: 3`.
- If the section is absent entirely, the only legal next action is the `scaffold` subcommand — refuse everything else and say so.
- Once the section exists, resolve the configured `roadmap` path and verify the file exists. Missing → STOP: direct the user to run `scaffold` or fix the config path; never implicitly create roadmap.md outside `scaffold` — a config path typo must not silently fork the truth source.
- Resolve templates as `<plugin base dir>/templates/<file>`; never assume they live in the host repo.
- Read gate commands from `### gates`; never invent commands, runners, or stack specifics.
- Consult `### doc_sync_map` before any edit that touches a mapped path. If the map lists `roadmap.md` itself, the map takes precedence — the "artifacts this skill writes are documentation and owe no further doc-sync" exemption applies only to paths the map does not cover.

## scaffold

Wire a repo to supervibe:

1. Create `roadmap.md` (configured path, default `docs/roadmap.md`) from `templates/roadmap.md` — six elements, each keeping its one-line example.
2. Splice `templates/agents-sections.md` into AGENTS.md as the `## supervibe` section.
3. Create the notes dir (default `.agents/notes/`).

**Idempotent, per artifact: existing files/sections stay untouched and produce a diff proposal; missing ones are created normally.** An existing `roadmap.md` or AGENTS.md `## supervibe` section gets a printed diff of what scaffold would add, for the user to apply manually; an existing notes dir is left as is.

If AGENTS.md does not exist yet, create it containing just the spliced section.

## epic

Append a row to the Epics table: id, window, core deliverable, DoD, status.

- **Reject if DoD missing** — an epic without a Definition of Done is invalid; stop and ask for one.
- Copy the DoD verbatim into the row. That row is the source sprint plans copy from verbatim; later changes happen here by amendment, never inside a plan.
- When an epic breaks into sprints (e.g. parallel waves), append one Sprint Ledger row per sprint in state `planned` — do not inflate the epic row.

## adr

Append a numbered row to the ADR table: id, decision, rationale; append amendment rows when a decision later changes.

- **Enforce doc-before-code: the decision text must be written into `roadmap.md` before implementation begins.** If implementation already started, record the ADR now, mark it retroactive, and name the discipline breach.
- Link open questions or debt entries the decision settles.
- Every ADR mutation: append date + evidence link.

## question

Manage Open Questions through their lifecycle: open → closed / deferred.

- Open with an id and a one-line statement. Unnumbered questions rot; tracked ones close — everything gets a row.
- Close or defer only with a decision-record link: ADR id, note entry, or evidence commit.
- Reopen by appending a new row that references the old one; never rewrite history.

## asset

Update Asset Disposition for inherited assets. Dispositions: reuse / retire / re-order / watch.

- Record what changed and why — this table exists to stop silent drift between planned and actual reuse.
- Every change: append date + evidence link.
- A `watch` asset with no owning epic is a smell — route it to one or open a question.

## debt

- Add an entry to the debt tracker via `templates/debt-entry.md`: severity, owner, repayment criteria. An entry without repayment criteria is invalid.
- If the debt tracker file does not exist, create it with the row-format header per `templates/debt-entry.md` — `scaffold` does not create it.
- Repay: close the entry citing the evidence commit hash — no hash, no closure.
- Route observation items (symptoms without a fix decision) to an owning epic; they ride that epic's DoD, not the tracker's backlog.

## ready / close

This skill owns exactly two Sprint Ledger transitions; refuse all others (`ready→active` belongs to supervibe:start, `→acceptance` to supervibe:accept, `→merged` to supervibe:merge). No ledger row matches the given sprint id → reject and state which sprint id is unknown.

- **planned → ready** — the go decision is strategic. Verify the epic ref resolves to an epic with DoD, then record the decision in the ledger row. Detailed readiness adjudication (dependencies, WIP count, early start, deferred dependencies) happens at ready→active under supervibe:start.
- **→ closed** — only when the sprint's handover clauses are all discharged or none were registered. Discharging clauses belongs to supervibe:sync; here, verify the ledger row shows no open handover-clause ids and the merged commit hash is recorded. Either check fails → refuse and state what is missing.

## Invariants

Every mutation in this skill — epic, ADR, question, asset, debt, ledger — appends date + evidence link to the affected row. No silent edits, no deletions: `roadmap.md` is append-history.
