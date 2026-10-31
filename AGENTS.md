# AGENTS.md — supervibe repo

supervibe is a Claude Code plugin that manages iteration (roadmaps, sprints,
acceptance gates, merge close-out, cross-sprint sync). superpowers remains the
execution layer — this repo's own development follows both: superpowers skills
for the code, supervibe artifacts for the iteration.

## supervibe

- roadmaps_dir: docs/superpowers/roadmaps/
- sprints_dir: docs/superpowers/sprints/
- acceptances_dir: docs/superpowers/acceptances/
- notes: .agents/notes/
- debt_tracker: docs/tech-debt-tracker.md
- wip_limit: 1
- collaboration_mode: native
- collaboration_provider: harness

### gates

- validate: claude plugin validate . --strict
- artifacts: node tests/check-artifacts.mjs
- workflow: node --test tests/workflow-guard.test.mjs tests/shared-ledger.test.mjs
- collaboration: node --test tests/collaboration-contract.test.mjs
- board: node --test tests/board-parser.test.mjs

### doc_sync_map

| change | owes |
|---|---|
| `skills/**` | the matching `SKILL.zh.md` in the same commit |
| `templates/**` | `tests/check-artifacts.mjs` assertions in the same commit |
| `docs/superpowers/specs/**` or `docs/superpowers/plans/**` | the epic doc's Open Questions / ADR rows in the same commit |
