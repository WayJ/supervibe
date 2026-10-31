# Changelog

## Unreleased

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
