# SuperVibe v0 — Design Spec

- Date: 2026-10-01
- Status: Approved in brainstorming dialogue; pending spec review
- Repo: `supervibe` (this repo, self-hosting from commit one)

## 1. Positioning

**SuperVibe is the iteration-management layer for Claude Code.** It answers
*what to build, when, in what order, and when a line of work is done.*
It pairs with an execution layer — [superpowers](https://github.com/obra/superpowers)
recommmended — which answers *how to write the code well.*

Division of responsibility:

| | supervibe (strategy) | superpowers (tactics) |
|---|---|---|
| Cares about | roadmap, line scheduling, exit criteria, acceptance, merge/close-out, cross-line sync | brainstorm, spec, plan, TDD, subagent dev, review loops |
| Input | roadmap + open lines | one plan document |
| Output | rulings: "this line may start / may merge" | working code + docs |

**Hard rules:**

1. **Artifact contract coupling, not code coupling.** The two layers
   communicate only through plan documents and acceptance records. SuperVibe
   never forks or reimplements a superpowers skill.
2. **Graceful degradation.** Skills detect superpowers and dispatch to it
   (`superpowers:brainstorming`, `superpowers:writing-plans`, …). When absent,
   the same artifact contract is produced/filled manually. No hard dependency
   is declared in the manifest.
3. **Zero stack assumptions.** All project specifics (gate commands, doc-sync
   mapping, WIP limit, paths) live in the host project's `AGENTS.md`
   supervibe section. The plugin ships process, not configuration.

### Non-goals (v0)

- No hooks, no agents, no MCP servers, no `commands/` (merged into skills by
  Claude Code; skills-only is the official recommendation).
- No enforcement machinery beyond skill instructions + CI validation of the
  plugin itself. Gates run as commands the skill instructs Claude to execute.
- No multi-plugin marketplace, no versioned template engine. Plain markdown
  templates with placeholder comments.
- No sprint/time-box ideology. Value-boxed lines with exit criteria
  (roadmap-driven), WIP-limited.

## 2. Domain model (distilled from a real R0→R4 iteration history)

The model generalizes the practices that carried a real product through eight
consecutive iteration lines (including three running in parallel at one point):

### 2.1 Roadmap (strategic truth source)

One `roadmap.md` per project. Six required elements:

1. **Stage table** — id, window, core deliverables, **exit criteria**
   (a stage without exit criteria is invalid), status.
1b. **Line ledger** — the authoritative per-iteration-line record:
   `{line id, stage ref, state, worktree/branch, early-start flag,
   deferred-dependency refs, open handover-clause ids, merged commit hash}`.
   Stages are strategic (one stage may spawn several lines, e.g. parallel
   waves); the ledger tracks each line's tactical state. All skill
   references to "roadmap row" below mean a ledger row.
2. **ADR table** — numbered decisions with rationale and amendment rows.
   Discipline: *change the document first, then the code* (doc-before-code).
3. **Asset disposition** — reuse / retire / re-order / watch, for inherited
   assets. Prevents silent drift between planned and actual reuse.
4. **Open questions** — lifecycle-managed (open → closed/deferred, each with
   a decision record link). Unnumbered questions rot; tracked ones close.
5. **Cross-cutting concerns** — items that advance with stages (branding,
  monitoring, security re-tests) with their owning stage named.

### 2.2 Iteration line (tactical unit)

State machine (authority: the line ledger in `roadmap.md`; the plan-doc
header carries a human-readable copy, never the reverse):

```
planned → ready (awaiting go) → active (parallel allowed, WIP-capped)
        → acceptance → merged → closed
```

Transition owners: `supervibe:roadmap` owns planned→ready (the go decision
is strategic) and closes (→closed) once the line's handover clauses are
discharged or none were registered; `supervibe:start` writes ready→active;
`supervibe:accept` writes →acceptance (+ verdict); `supervibe:merge`
writes →merged (+ commit hash). Handover-clause **discharge** belongs to
`supervibe:sync`: when the target line's sync/merge verifies the obligation,
sync records the evidence and sets the clause discharged.

Special flows, all observed in real use:

- **Early start** — a line may start while another is still open when
  adjudicated safe (≈ zero file intersection). Recorded in the roadmap row.
- **Deferred dependency** — implement on the current baseline now, register a
  **handover clause** against the depended-on line's future merge
  (real case: "T4 lands as if W2 were already merged; re-verify ordering
  when W2 merges in").
- **Handover clause** — cross-line review obligation: `{id, issuer, target,
  trigger, obligation, status, evidence}`. Registered at line start or merge;
  **discharged only with recorded evidence** at the target line's sync/merge.

### 2.3 Line artifacts

| Artifact | Contract |
|---|---|
| Plan doc | header (line id, roadmap ref, state copy) + five sections: D-x decisions / wave-task checkboxes / exit criteria **copied verbatim from roadmap, not editable in place** / S1–Sn acceptance scenarios / handover clauses |
| Acceptance record | scenario results table + **obstacles logged verbatim** (no greenwashing: every blocker, workaround, or substituted evidence is recorded as it happened) |
| Dev notes | dated entries under `.agents/notes/` |
| Debt tracker | entries with severity, owner, repayment criteria; observation items routed to an owning roadmap line |

### 2.4 Parallel discipline

- One line = one worktree/branch. WIP limit from project config (default 3).
- Fixed sync cadence: merge `origin/main` into active lines on a schedule,
  not only on events.
- Conflict re-verify checklist: generated aggregates → regenerate and compare;
  handwritten files → item-by-item review list emitted by the skill.
- Handover clauses fire on sync/merge of their target line.

### 2.5 Gates

Project-parameterized command list (see §5). Typical: contract/generated-
artifact consistency, doc-sync, acceptance scenarios, test suite. A line may
not merge with a red gate or a missing acceptance verdict.

## 3. Plugin format (verified against official docs 2026-09-30)

Sources: plugin manifest reference, marketplace reference, skills page
(code.claude.com/docs). Hard rules that shape this design:

- Only `plugin.json` belongs in `.claude-plugin/`; components elsewhere are
  not loaded.
- Plugin `name`: kebab-case, no spaces/`@`/`:`/path separators. Prefixes all
  skills: `/supervibe:<skill>`.
- `homepage`: must parse as a URL or the plugin **fails to load**. v0 uses a
  placeholder resolved at publish time; local dev runs `claude --plugin-dir`.
- Skills: `skills/<name>/SKILL.md`, `---` frontmatter must start at line 1;
  `description` is the matching surface (kept ≤ ~200 chars, critical use
  cases first; hard cap 1,536 chars shared with `when_to_use`).
- Self-marketplace: `.claude-plugin/marketplace.json` with the plugin listed
  at `"source": "./"` is an officially supported single-repo shape.
  **Entry `name` must equal manifest `name`.** Version is taken from
  `plugin.json`.
- Validation: `claude plugin validate --strict` (CI gate), behavior testing
  via `claude plugin eval`.

## 4. Skill set (8)

All skills are model-invocable (`disable-model-invocation: false`) with
`argument-hint` where applicable. English bodies, imperative, terse; each
references templates by relative path and reads host config per §5.

| # | Skill | Contract (input → output & side effects) |
|---|---|---|
| 1 | `supervibe:init` | No preconditions beyond a git repo. Scaffold `roadmap.md` (template), AGENTS.md supervibe section (gates empty, WIP 3, doc-sync map stub), `.agents/notes/`. Idempotent: existing sections detected, never overwritten — emits a diff proposal instead. |
| 2 | `supervibe:roadmap` | Subcommands: add-stage (rejects missing exit criteria), record-decision (ADR row + amendment; enforces doc-before-code narrative), open/close question, asset disposition update, advance stage status. Every mutation notes date + evidence link. |
| 3 | `supervibe:start` | Input: stage id. Readiness adjudication: dependency check, WIP count vs limit, early-start ruling (file-intersection estimate vs open lines), deferred-dependency ruling (→ handover clause registered in plan + roadmap row). Output: plan doc scaffold from template (five sections, exit criteria copied verbatim) at `docs/plans/YYYY-MM-DD-<line>-plan.md`. Then dispatch: superpowers present → `superpowers:brainstorming` then `superpowers:writing-plans`, **directed to fill the scaffolded path — the five-section structure and the verbatim exit criteria are immutable constraints on the produced plan**; else print manual instructions. |
| 4 | `supervibe:accept` | Input: line/plan. Execute S1–Sn as real verifications (browser, CLI, stack commands as each scenario dictates — never claim pass without running). Fill exit-criteria checklist. Log obstacles verbatim. Output acceptance record at `docs/acceptance/YYYY-MM-DD-<line>-acceptance.md` + verdict (pass/blocked). Substituted evidence must be marked as such. |
| 5 | `supervibe:merge` | Ordered sequence, stop on red: gates → acceptance verdict present → merge to main (conflicts per §2.4 checklist) → worktree/branch teardown → roadmap row finalized with commit hash → handover clauses emitted (now-binding) → dev-note closing entry. |
| 6 | `supervibe:sync` | Cadence entry: merge `origin/main` into named (or all active) lines; classify conflicts (generated → regenerate; handwritten → review list); check incoming diff against open handover clauses (path/feature match → surface obligation); report. |
| 7 | `supervibe:debt` | Add entry (severity/owner/repayment criteria), repay (close with evidence commit hash), route observation item to owning stage. |
| 8 | `supervibe:doc-sync` | Generalized two-mode discipline: per-change (staged diff → mapping table → owed-docs list, same-commit enforcement narrative) and periodic audit (drift report). Mapping table lives in host AGENTS.md — never copied into the plugin. |

## 5. Configuration surface (host AGENTS.md)

One greppable section the skills read:

```markdown
## supervibe
- roadmap: docs/roadmap.md          # default; this self-hosting repo uses roadmap.md at root
- notes: .agents/notes/
- plans: docs/plans/                # default plan-doc directory
- acceptance: docs/acceptance/      # default acceptance-record directory
- debt_tracker: docs/tech-debt-tracker.md
- wip_limit: 3
### gates
- contracts: <command>
- tests: <command>
### doc_sync_map
| change | owes |
|---|---|
| <path pattern> | <doc> |
```

Skills grep these headings; absent section → skill instructs `supervibe:init`
first. Plugin never writes stack specifics.

## 6. Templates (`templates/`)

Plain markdown, `<!-- -->` placeholder comments, no engine:

- `roadmap.md` — six elements of §2.1 (stage table, line ledger, ADR table,
  asset disposition, open questions, cross-cutting) with one worked example
  row each
- `plan.md` — the handshake artifact (§2.3), including the invariant comment:
  exit criteria are copied from roadmap and changes go back to the roadmap,
  not edited in the plan
- `acceptance-record.md` — results table + verbatim obstacles log
- `handover-clause.md` — the clause record format
- `debt-entry.md` — tracker row format
- `agents-sections.md` — §5 block to splice

## 7. Self-hosting & validation

- This repo carries its own `roadmap.md` (v0 = one stage: "plugin v0.1.0
  published"), developed via superpowers, specs/plans under
  `docs/superpowers/`.
- CI (two checks, zero npm dependencies, Node ≥ 20, `claude` CLI
  preinstalled):
  1. `claude plugin validate . --strict`
  2. `tests/check-artifacts.mjs` — per template: required section headings
     present; then an **assembly dry-run**: splice `agents-sections.md` into
     a fixture AGENTS.md and expand template placeholder comments in a temp
     dir, asserting every required heading lands in the assembled output and
     no required placeholder remains unexpanded. This validates the
     artifacts `supervibe:init` will produce — no parallel scaffold
     implementation is shipped, the skill instructions remain the only
     scaffold logic.

## 8. v0 file manifest

```
.claude-plugin/plugin.json          # name supervibe, version 0.1.0, MIT
.claude-plugin/marketplace.json     # self-marketplace, source "./"
skills/{init,roadmap,start,accept,merge,sync,debt,doc-sync}/SKILL.md
templates/{roadmap,plan,acceptance-record,handover-clause,debt-entry,agents-sections}.md
tests/check-artifacts.mjs
roadmap.md                          # self-hosting
README.md  README.zh-CN.md  LICENSE  CHANGELOG.md  .gitignore
docs/superpowers/specs/2026-10-01-supervibe-v0-design.md   # this file
```

## 9. Release

- Version 0.1.0 (semver string; not enforced by the loader, honored by us).
- Publish: push to public git host → replace the placeholder
  `homepage`/`repository` (v0 ships the parsable placeholder
  `https://example.com/supervibe`; the loader hard-fails on unparsable
  URLs, so "TBD" strings are not acceptable even during local
  `--plugin-dir` development) → users install via
  `/plugin marketplace add <owner>/supervibe` → `/plugin install supervibe@supervibe`.
- README covers pairing with superpowers (recommended, not required) and the
  degradation story.

## 10. Open questions

1. Hosting owner/URL — resolved at publish time (blocks only `homepage`, not
   local development).
2. Whether v0.2 adds an `acceptance-verifier` subagent (deferred; YAGNI).
