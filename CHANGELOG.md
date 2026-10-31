# Changelog

## Unreleased

- Separate Sprint WIP, worker execution slots and physical worktree cleanup. Add
  explicit-migration, fenced CAS worker lifecycle commands; register development
  child worktrees under their parent Sprint without another WIP reservation.
  Outcome plus quiescence settles successful/failed/blocked executions; safe child
  cleanup preserves branches and retains dirty content without holding worker quota.
  Unknown executions still count; no TTL, forced removal or installed backend hooks.
  Independent Roadmap acceptance shares the epic cap on borrowed canonical main
  without a Sprint reservation; this is not a backend scheduler.

- Add user-only `/supervibe:doctor` with a deterministic read-only compatibility
  report. Never auto-invoke, repair, run gates or claim live harness/browser
  readiness; preserve explicit unknowns and redact raw configuration/state.

- Move mechanical host configuration, artifact inventory and per-commit document
  obligations into shared scripts with fail-closed JSON reports. Reserve handover
  clause IDs atomically in the local ledger after explicit legacy bootstrap.
- Add a public static documentation site and a verified-test-gated GitHub Pages
  workflow that uploads only `site/`, never the repository or local runtime state.

- Require an explicit Roadmap independent-acceptance choice; keep coordination in
  the current main agent. Add CAS-registered Sprint/Roadmap acceptance wakes, candidate-
  bound scenario-derived preflight and durable executor independence checks;
  final Sprint and Roadmap verification enforce the configured execution receipt.
  Contracts only: no resource scheduler, backend attestation or live E2E coverage.

- Add read-only local capacity snapshots and environment-budget estimates,
  atomic exclusive resource groups, generation-bound ownership, explicit
  quiescent release and candidate freezing for acceptance. SSH hosts are optional
  resource-environment metadata, not an automatic remote worker/provisioning adapter.
- Preserve eight combined Sprint/Roadmap, native/Orca and independent/main-agent
  acceptance simulations as portable regressions with synthetic provider receipts.

- Define exactly two collaboration routes: native harness and external Orca,
  with explicit configuration, read-only task/result contract validation,
  bounded worktree placement and bilingual routing guidance. Contract/static
  tests only; live harness/Orca execution is not yet integration-verified.

- Add an authoritative Git common-dir shared runtime ledger with atomic WIP
  reservations, revision checks, idempotent operations, explicit migration and
  guarded review/landing transitions; Markdown becomes a readable projection.

- Bind acceptance to a deterministic reviewed-file fingerprint and permit full
  reacceptance, revoking the old pass before a new review.
- Block stale acceptance before gates and again before merge; sync reports
  stale evidence without rewriting the ledger.
- Diagnose/import linked-worktree ledgers explicitly, preserve empty scaffold directories,
  and resume an already-landed merge even when its carrier still exists.
- Count active and acceptance sprints toward WIP; treat merged and closed as
  landed dependencies.
- Add zero-dependency workflow validation and regression coverage; synchronize
  English/Chinese skills, evidence templates, and lifecycle documentation.

## 0.1.0 (2026-10-01)

Initial release: 5 skills (roadmap / start / accept / merge / sync), 6 artifact
templates, self-marketplace manifest, bilingual skill bodies, artifact
validation script.

### Multi-agent iteration routing and layered acceptance

- Default SuperVibe iteration uses a coordinator and workers; explicit solo routes to superpowers before iteration side effects. A worker cap of one is not solo.
- Upfront per-Sprint and independent overall Roadmap scenarios now carry required execution evidence. Required browser/real-environment checks cannot pass with substituted or missing evidence.
- Final Roadmap close requires a fresh integrated-content-bound record plus every planned sprint landed; old Sprint acceptance records without the new scenario/result contract require reacceptance.
- Added metadata/coverage/provenance and no-mutation fixtures, not a browser engine or live native/Orca certification.
