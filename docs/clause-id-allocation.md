# Atomic handover-clause IDs

`clause-ids.mjs` reserves HC identifiers across the linked worktrees of **one
local Git repository**. It uses the existing Git-common-directory ledger,
write lock, revision CAS and atomic write; it does not introduce a Git-tracked
index, daemon, external service or cross-clone coordination.

## One-time initialization / legacy migration

1. Stop **all** legacy clause creators and direct Markdown edits in every linked
   worktree. Check out or restore all relevant existing sprint documents. Reconcile
   historical clauses that exist only on unregistered branches or other clones
   into the visible sprint documents first. The scanner does not inspect Git
   history, remote clones or unregistered directories.
2. Initialize/import the shared ledger using the existing ledger tooling if needed.
   Read its current revision with `shared-ledger.mjs status`.
3. From a host-repository worktree run (replace the plugin path, revision and
   operation name):

   ```sh
   node /path/to/supervibe/scripts/clause-ids.mjs bootstrap \
     --revision 7 --operation hc-bootstrap-v1 --confirm-quiescent
   ```

Bootstrap scans every registered linked worktree's configured sprint directory,
including nested Markdown files, for **all** `HC<number>` references (not just
open clause bodies). The maximum becomes the permanent migration floor; no
references means zero. Discharged IDs, references and example numbers are
conservatively counted too. Missing/prunable worktrees, missing sprint directories,
unreadable documents, symlinks, malformed sprint frontmatter or unsafe numeric IDs
stop initialization without writing the namespace. Worktree inspection also checks
conflicting copies of sprint identities. This is not a semantic duplicate-clause
repair tool: reconcile preexisting duplicate IDs yourself before migration.

The lock serializes new ledger clients, **not legacy Markdown writers**. The
`--confirm-quiescent` flag is an explicit operator assertion, not proof that those
writers stopped. Switch all writers to reservation-based allocation before
resuming. Never bootstrap over an existing namespace or reset its counter.

## Reserve before writing a clause body

```sh
node /path/to/supervibe/scripts/clause-ids.mjs status
node /path/to/supervibe/scripts/clause-ids.mjs reserve \
  --issuer S3 --revision 8 --operation s3-export-handover
```

The issuer must already be `reserved` or `active` in the shared ledger. The result
contains `id` (for example `HC39`), `issuer`, `operation`, `revision` and `replayed`.
Write that ID and the clause body into the issuing sprint's Handover Clauses
section, then use references in other artifacts. **The issuing Markdown remains
the single authority for body, status and discharge evidence.** This script does
not create, edit, discharge or verify clause bodies.

Use a stable unique operation name per logical clause. Retrying the same operation
and issuer returns the same ID, even after interruption, issuer cancellation, or
expiry of the ledger's general bounded operation history. Changing the issuer
with the same operation fails. Permanent receipts are intentionally retained.
An abandoned reservation is a harmless gap and is never recycled. The script does
not implement cancellation/reset/garbage-collection commands.

A stale revision means reread `status`, reconcile the current state, and retry the
same operation with the new revision. A lock conflict means inspect/wait for its
owner; never steal the lock. Routine allocation never scans Markdown for max+1.
Do not invent unreserved IDs or continue using older allocator instructions.

State lives under `<git-common-dir>/supervibe/state.json` in optional `clauseIds`
(schema 1, migration `floor`, monotonic `highWater`, bootstrap operation and permanent
reservation list). It is local runtime state and is not committed with sprint docs.
All own reads/mutations fail closed on malformed clause state. Existing ledger
commands do not themselves validate this optional namespace. Back up and restore
runtime state with the repository; losing or rolling back it requires an explicit,
quiescent recovery audit rather than blind allocation. Independent clones need
separate coordination before their histories are combined; that is outside this
repository-local scope.

## Verification

```sh
node --test tests/clause-ids.test.mjs
```

Tests use actual temporary Git repositories and linked worktrees, including
concurrent CLI processes, stale-revision reread, long-lived replay, legacy high-water,
issuer lifecycle, abandoned IDs, malformed namespace, and unavailable migration
inputs. No network or credentials are used.
