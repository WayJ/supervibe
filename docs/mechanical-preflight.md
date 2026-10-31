# Mechanical preflight / 机械预检

Run these read-only helpers from the host repository root (Node >= 20, no dependencies).
They report facts and stop on ambiguity; they never create artifacts, restore ledger authority,
confirm policy, execute gates, launch workers, or prove business/browser acceptance.
在宿主根目录运行；只读、歧义即停，不创建工件、不恢复权威、不替用户确认，也不替代真实验收。

## Host configuration

`node "<plugin base dir>/scripts/host-config.mjs" --require-dir sprints_dir --require-dir notes`

Exactly one `## supervibe` section; only the eight keys shown in
`templates/agents-sections.md`, and `### gates` / `### doc_sync_map` are accepted.
Duplicates, unknown keys/subsections, empty gates, unsupported maps and unsafe paths fail.
Optional trailing HTML comments on scalar fields are ignored. Gates return ordered
`{name, command}` entries; command text after the list prefix is retained verbatim,
including trailing spaces. The helper does not run commands. Comments inside commands
are command bytes, not configuration comments.

Missing path/WIP keys use: `docs/superpowers/roadmaps/`, `docs/superpowers/sprints/`,
`docs/superpowers/acceptances/`, `.agents/notes/`, `docs/tech-debt-tracker.md`, WIP `3`.
Paths must be repository-relative, without traversal, Git metadata, whitespace or symlinks.
Only `--require-dir` keys are required to exist; unknown requirement keys fail.
Missing section requires explicit scaffold. Scaffold template placeholders must be replaced
or removed before validation. No collaboration mode/provider/worker count/harness/acceptance
policy defaults are inferred. Host collaboration fields remain proposals; the existing
confirmed common-dir iteration config remains execution authority.
配置解析、默认值、目录存在性由脚本处理；协作确认不在此脚本权限内。

## Artifact inventory

`node "<plugin base dir>/scripts/artifact-inventory.mjs" --epic E1 --sprint S1`

Use the unique `selection` and structured `issues`, not another manual directory scan.
Omit selectors to inventory all artifacts. Nonzero means resolve the reported ambiguity,
missing artifact, stub mismatch, ledger/projection or carrier issue explicitly before proceeding.
Missing runtime needs explicit init/import, not reconstruction from branch Markdown.
Carrier-loss recovery still follows complete's evidenced-landing protocol; inventory is
not permission to recreate a carrier or merge. HC duplicate detection is diagnostic only:
HC allocation is **not yet atomic across worktrees**; serialize clause creation through the
current coordinator until a migrated shared allocator exists.
使用唯一解析结果，报错不自动修复；HC 重号检测不是并发安全分配器。

## Doc-sync

`node "<plugin base dir>/scripts/doc-sync.mjs" --base "<stored-mainRef>" --tip HEAD --epic-document "<epic-doc>" --task-path "<explicit-task-path>"`

Repeat `--task-path` for paths explicitly listed in Stories & Tasks; omit when none.
The script never infers paths from task prose. It enumerates merge-base..tip diff paths plus
these paths and checks source/document co-occurrence in commits. Each source-touching
commit must carry its owed document; a later doc-only commit does not repay earlier arrears.
Nonzero blocks completion. At accept also inspect document **meaning**, reporting current/drifted
and evidence; a green precheck says nothing about correctness. Run both checkpoints in the same
carrier with the same base, tip and explicit path inputs. Roadmap integration uses an explicitly
recorded iteration-start commit as base and integrated main HEAD as tip; main against itself
is an empty range, not a Roadmap audit. Unknown baseline blocks that claim. Pending working-tree edits are not
commit evidence. No history is rewritten by this helper.
同提交检查自动化；语义漂移仍由 Agent 判断，真实浏览器/业务验收不能被脚本替代。

Map grammar is a Markdown table with headers `change | owes`, a separator, and both cells
backtick-quoted. One rule per row. Relative POSIX literals or `*`, `**`, `?` globs only;
`*`/`?` do not cross `/`, `**` does. No natural-language OR, regex, shell or brace expansion.
`owes` also supports `{dir}/SKILL.zh.md` (source sibling) or exact `{epic}` (explicit
`--epic-document` required). Unsupported syntax fails closed; empty/absent map owes nothing.
All matching obligations apply. This repo's mappings mean:

- `skills/**/SKILL.md` → `{dir}/SKILL.zh.md`: paired translation in the same commit.
- `templates/**` → `tests/check-artifacts.mjs`: assertions co-change; Agent reviews adequacy.
- specs/plans → `{epic}`: explicit epic co-change; Agent reviews Open Questions / ADR content.

Maps also apply to artifact paths when matched. Pattern grammar deliberately excludes spaces,
non-ASCII names and unsupported expansions rather than guessing their meaning.
