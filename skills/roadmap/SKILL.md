---
name: roadmap
description: Use when the user mentions the roadmap, an epic, ADR decisions, open questions, asset disposition, tech debt, or wiring a project to supervibe.
argument-hint: [scaffold|epic|breakdown|adr|question|asset|debt|ready|close]
---

# supervibe:roadmap — strategic truth source

Own the supervibe side of the dated artifact tree — `roadmaps/` (one `YYYY-MM-DD-<epic>.md` doc per epic), `sprints/` (one `YYYY-MM-DD-<sprint>-plan.md` doc per sprint), and `acceptances/` (default root `docs/superpowers/`, siblings of the superpowers execution dirs `specs/` and `plans/`) — plus the `## supervibe` section of the host's AGENTS.md. There is **no central index file**: state lives in each doc's frontmatter, ids come from directory scans, aggregation is a scan of the tree — zero silent fork surface. Terminology is Scrum-aligned: epic / sprint / DoD (Definition of Done) / story; a sprint is value-boxed — closed by DoD, never time-boxed. Sprint state is stored in two stages: pre-start (`planned` / `ready`) lives only in the epic doc's Sprint Breakdown stub rows; `active` onward lives in the sprint doc's frontmatter. Zero stack assumptions: paths, gate commands, and doc-sync mappings live in the host AGENTS.md — never hardcode any.

Dispatch on the subcommand argument (`scaffold|epic|breakdown|adr|question|asset|debt|ready|close`). If it is absent or unrecognized, list the subcommands and ask. Every path below comes from host config, not from assumptions about the host repo layout.

## Read host config first

Before any subcommand, grep the host AGENTS.md for the `## supervibe` section:

- Config keys: `roadmaps_dir`, `sprints_dir`, `acceptances_dir`, `notes`, `debt_tracker`, `wip_limit`; subsections `### gates` and `### doc_sync_map`.
- Defaults when a key is absent: `roadmaps_dir: docs/superpowers/roadmaps/`, `sprints_dir: docs/superpowers/sprints/`, `acceptances_dir: docs/superpowers/acceptances/`, `notes: .agents/notes/`, `debt_tracker: docs/tech-debt-tracker.md`, `wip_limit: 3`.
- If the section is absent entirely, the only legal next action is `scaffold` — refuse everything else and say so.
- Once the section exists, resolve the configured dirs this subcommand touches and verify they exist. Missing → STOP: direct the user to run `scaffold` or fix the config path; never implicitly create artifacts outside `scaffold` — a config path typo must not silently fork the truth source.
- Resolve templates as `<plugin base dir>/templates/<file>`; never assume they live in the host repo.
- Read gate commands from `### gates`; never invent commands, runners, or stack specifics.
- Consult `### doc_sync_map` before any edit that touches a mapped path. If the map covers an artifact path this skill writes (epic doc, sprint doc, debt tracker), the map takes precedence — the "artifacts this skill writes are themselves documentation and owe no further doc-sync" exemption applies only to paths the map does not cover.

## scaffold

Wire a repo to supervibe:

1. Create the three artifact dirs at their configured paths: `roadmaps_dir`, `sprints_dir`, `acceptances_dir`.
2. Splice `templates/agents-sections.md` into AGENTS.md as the `## supervibe` section. If AGENTS.md does not exist yet, create it containing just the spliced section.
3. Create the notes dir (default `.agents/notes/`).

**Never write `plans/` — that is the superpowers execution domain.** `specs/` and `plans/` stay owned by the execution layer; scaffold touches neither.

**Idempotent, per artifact: existing dirs/sections stay untouched and produce a diff proposal; missing ones are created normally.** An existing AGENTS.md `## supervibe` section gets a printed diff of what scaffold would add, for the user to apply manually; existing dirs are left as is. The debt tracker is not created here — the `debt` subcommand creates it on first entry.

## epic

Create `<roadmaps_dir>/YYYY-MM-DD-<epic>.md` from `templates/epic.md`:

- Frontmatter: `{epic: E#, status: open, date}` — epic id by scanning every doc in `roadmaps/` for max+1.
- Seven body sections per the template: Deliverables / Definition of Done / Sprint Breakdown / Decisions (ADR) / Asset Disposition / Open Questions / Cross-cutting.
- **Reject if DoD missing** — an epic without a Definition of Done is invalid; stop and ask for one. DoD lives at epic level; sprint docs copy it verbatim, and later changes happen here by amendment, never inside a sprint doc.

`breakdown` subcommand — append stub rows to an epic doc's Sprint Breakdown section: `{sprint id, state: planned, note}`:

- Sprint id by scanning `sprints/` docs **and** every epic doc's stub rows for max+1 — both sources, every time: a pre-start stub has no doc yet, and skipping either side invites id collisions.
- The stub table is the only home for pre-start states. `supervibe:start` materializes a `ready` stub into a sprint doc and flips the stub to `started` (id pointer retained) — never create or materialize a sprint doc from here.

## adr

Append a numbered decision row to the epic doc's Decisions (ADR) section: id, decision, rationale; append amendment rows when a decision later changes.

- Numbering is global across all epics: scan every epic doc's ADR section for max+1; never number within a single epic.
- **Enforce doc-before-code: the decision text must be written into the epic doc before implementation begins.** If implementation already started, record the ADR now, mark it retroactive, and name the discipline breach.
- Link open questions or debt entries the decision settles.
- Every ADR mutation: append date + evidence link.

## question

Manage the epic doc's Open Questions through their lifecycle: open → closed / deferred.

- Open with an id and a one-line statement. Unnumbered questions rot; tracked ones close — everything gets a row.
- Close or defer only with a decision-record link: ADR id, note entry, or evidence commit.
- Reopen by appending a new row that references the old one; never rewrite history.

## asset

Update the epic doc's Asset Disposition for inherited assets. Dispositions: reuse / retire / re-order / watch.

- Record what changed and why — this section exists to stop silent drift between planned and actual reuse.
- Every change: append date + evidence link.
- An asset with no owning epic is a smell — name it, then route the asset to an owning epic or open a question. Floating assets rot.

## debt

- Add an entry to the configured debt tracker via `templates/debt-entry.md`: severity, owner, repayment criteria. An entry without repayment criteria is invalid.
- If the tracker file does not exist, create it with the row-format header per `templates/debt-entry.md` — `scaffold` does not create it.
- Repay: close the entry citing the evidence commit hash — no hash, no closure.
- Route observation items (symptoms without a fix decision) to an owning epic; they ride that epic's DoD, not the tracker's backlog.

## ready / close

This skill owns exactly two state transitions; refuse all others (stub materialization `ready→active` belongs to supervibe:start, `→acceptance` to supervibe:accept, `→merged` to supervibe:merge, clause discharge to supervibe:sync).

- **ready — planned → ready**: flip the stub row's state in the epic doc's Sprint Breakdown section. The go decision is strategic: verify the epic's DoD covers what this sprint will deliver, then record the decision in the stub note. Detailed readiness adjudication (dependencies, WIP count, early start, deferred dependencies) happens at materialization under supervibe:start. No stub row matches the given sprint id → reject and state which id is unknown.
- **close — → closed**: write `state: closed` into the sprint doc's frontmatter. **Precondition: current state is `merged`, and merged only — closed does not block on handover clauses.** Clause lifecycle is independent of closed: open clauses are discharged by the target side's sync at its own time, and the issuing side may close first (field-proven: R3.6 closed while its clause awaited the target's merge). No sprint doc matches the given id → reject naming the unknown id.
- **Epic closure**: flip the epic doc frontmatter `status: open → closed` when every sprint of that epic is closed and no open question in the doc blocks; state what was verified.

## Invariants

- Every mutation in this skill — epic doc, breakdown stub, ADR row, question, asset, debt entry, state flip — appends date + evidence link to the affected row or frontmatter.
- Ids are never reused: epic ids, sprint ids, and ADR numbers come from max+1 scans and stay unique across the whole tree, forever.
- Never edit state owned by another skill: sprint-doc states before `closed`, stub `started` flips, handover-clause records, acceptance records.
- Never create a central index file — the directory scan is the aggregation.
