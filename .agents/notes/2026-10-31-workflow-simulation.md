# Workflow simulation — 2026-10-31

## Background

The requested follow-up exercised the workflow with temporary real Git repositories,
branches and linked worktrees, invoking the validator CLI and small deterministic
application checks. This was a manually driven Git/CLI simulation, not a native
Claude Code plugin end-to-end run. Claude CLI validation was unavailable.

The normal chain (scaffold, start, acceptance, complete, ledger, teardown, close)
completed after empty directories were manually restored. Clause arrival, target
verification, discharge on main and subsequent propagation were also exercised.
Those observations exposed the following gaps rather than proving every possible
agent execution correct.

## Decisions

- A sprint ledger present only in its own worktree was invisible to main's WIP
  scan. The first fix aggregated registered linked worktrees of the same Git
  common directory; the subsequent user-approved shared-ledger design supersedes
  scanning for admission. Scanning remains explicit import/diagnosis only. Matching copies count once; any active/acceptance copy keeps
  the sprint in flight. Conflicting identity/path copies and unavailable or stale
  registered worktrees block with a diagnosis. This does not coordinate independent
  clones or atomically reserve a slot; starts still require serialization.
- Empty scaffold directories disappear in a fresh worktree. Scaffold instructions
  now preserve owned empty artifact directories with tracked `.gitkeep` files.
  Existing user files are not replaced.
- A successful `--no-ff` merge followed by interruption before ledger update left
  the carrier present, but the old resume rule only handled a missing carrier.
  Recovery instructions now inspect verifiable landing evidence before normal
  preflight regardless of carrier presence, then resume ledger finalization.
  Ambiguous squash/rebase landings require confirmation rather than inference.

## Lessons

Unit tests of state counting in a single checkout were insufficient: the ordinary
multi-worktree topology exposed a serial-start bug, not merely a simultaneous
start race. Regression tests now use real linked worktrees for this case, matching
copy deduplication, conflicting copies, stale registration, scaffold persistence,
and the Git ancestry facts needed for interrupted no-ff recovery.

Run `node tests/check-artifacts.mjs` and
`node --test tests/workflow-guard.test.mjs tests/board-parser.test.mjs` for the
reproducible repository checks. The recovery/scaffold tests demonstrate the Git
mechanics; instructions are still executed by the agent, not a workflow engine.

## Handover

The conservative fingerprint still includes ordinary notes. A no-op sync that
writes its durable report, or a review that writes a workaround note, can invalidate
an existing snapshot. This was reproduced and intentionally retained rather than
excluding entire documentation directories. Finish such writes before the next
review snapshot and rerun acceptance as required. Future work may define a narrow,
explicit audit-only artifact contract, with tests proving it cannot hide changes
to requirements, configuration, scenarios or implementation.

External environment state, ignored runtime artifacts, concurrent writers and
atomic remote merge protection remain outside this read-only validator's guarantee.


## Shared-state follow-up

The user explicitly limited sharing to linked worktrees on the same computer/Git
common directory. The implementation now stores authoritative runtime entries in
`<git common-dir>/supervibe/state.json`, not branch-local Markdown. Atomic reservation
under a directory lock enforces the stored WIP limit before creating a carrier.
CAS revisions and bounded operation receipts prevent stale overwrites and provide
safe retries. Files are fsynced before atomic rename; locks and reservations do
not expire or get stolen automatically.

New integration tests exercise two actual concurrent Node processes from distinct
linked worktrees competing for WIP=1 (exactly one succeeds), persistent reservation,
shared visibility, interrupted review, pre-merge accepted-candidate checks, an
already-landed no-ff merge before projection, branch switching, corrupt/missing/locked
storage, missing carrier, explicit import conflicts, approved main target enforcement,
and safe unused-reservation cancellation. Terminal projections are checked against
the configured main branch's committed document, not the caller's stale checkout.

These tests do not exercise a native Claude Code session, real browser acceptance,
OS power loss during fsync/rename, or remote/distributed coordination. The local
ledger is not pushed with source; independent clones require explicit initialization
or import. The existing broad fingerprint remains conservative as described above.
