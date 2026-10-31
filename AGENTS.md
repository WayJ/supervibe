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
- collaboration: node --test tests/collaboration-contract.test.mjs tests/iteration-route.test.mjs
- acceptance: node --test tests/acceptance-contract.test.mjs
- resources: node --test tests/resource-policy.test.mjs
- integration: node --test tests/integration-simulation.test.mjs
- preflight: node --test tests/host-config.test.mjs tests/artifact-inventory.test.mjs tests/doc-sync.test.mjs
- clause-ids: node --test tests/clause-ids.test.mjs
- site: node --test tests/site.test.mjs
- doctor-fixtures: node --test tests/project-doctor.test.mjs
- worker-lifecycle: node --test tests/worker-lifecycle.test.mjs
- board: node --test tests/board-parser.test.mjs

### doc_sync_map

| change | owes |
|---|---|
| `skills/**/SKILL.md` | `{dir}/SKILL.zh.md` |
| `templates/**` | `tests/check-artifacts.mjs` |
| `docs/superpowers/specs/**` | `{epic}` |
| `docs/superpowers/plans/**` | `{epic}` |
