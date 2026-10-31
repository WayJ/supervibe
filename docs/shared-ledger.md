# Shared runtime ledger / 共享运行台账

The authoritative runtime state lives at `<git common-dir>/supervibe/state.json`,
shared by all linked worktrees of **one Git repository**. Markdown remains the
versioned business contract and readable projection; its frontmatter does not
adjudicate runtime state or WIP. Independent clones do not share this state.
The board reads Markdown snapshots, not the live ledger.

权威运行状态存于 `<git common-dir>/supervibe/state.json`，由**同一 Git 仓库**
的全部关联 worktree 共享。Markdown 保留版本化业务契约与可读投影职责，
frontmatter 不再裁定运行状态或 WIP。独立克隆不共享此状态；看板读取 Markdown
快照，不是实时台账。

## Bootstrap / 初始化

First complete the authorized scaffold commit and ensure the selected main branch exists with a commit. Scaffold may run before the store exists; runtime actions may not. Run from the host repository root; `<plugin>` is the installed plugin directory:

```sh
node "<plugin>/scripts/shared-ledger.mjs" init --sprints-dir "<dir>" --limit 3
# OR explicitly migrate existing sprint documents:
node "<plugin>/scripts/shared-ledger.mjs" import --sprints-dir "<dir>" --limit 3
node "<plugin>/scripts/shared-ledger.mjs" status
node "<plugin>/scripts/shared-ledger.mjs" doctor
```

Choose init for a new ledger or import to migrate existing documents explicitly.
Both init/import accept optional `--main <branch-name>` (default `main`), stored as `mainRef`. Neither overwrites an existing store. Init rejects existing sprint documents; import rejects conflicting copies and legacy acceptance. Explicitly revoke legacy acceptance to active before migration and run a fresh shared review; never import an old pass as trusted evidence. No store means stop and initialize/import;
never silently fall back to branch-local scans. The schema carries `schema: 1`,
`revision`, `wipLimit`, `mainRef`, `sprints`, `events`, and `operations`. The store is local
Git metadata, not a file to commit or push; a fresh clone needs explicit setup.

先完成已授权的脚手架提交，确认所选主线分支已有提交。scaffold 可在存储尚不存在时运行，运行态动作不可。新仓库使用 init，已有文档须显式 import 迁移；init/import 可选 `--main <分支名>`（默认 main），存为 mainRef。两者都不覆盖已有存储。init 拒绝已有 sprint 文档；import 拒绝冲突副本与旧 acceptance。迁移前显式将旧 acceptance 撤回 active，之后重新进行共享评审，不能导入旧 pass 冒充可信证据。
无台账即停止并初始化/导入，不静默回退到分支目录扫描。schema 包含 schema:1、
revision、wipLimit、mainRef、sprints、events、operations。它是本地 Git 元数据，
不提交、不推送；新克隆须显式建立状态。

## Mutation protocol / 变更协议

Every mutation supplies `--id <sprint-id> --revision <current-revision>
--operation <unique-operation-id>`. Read status before each new logical action.
The tool serializes writes with a mkdir lock, checks the expected revision,
and durably atomically replaces JSON. The operation ID identifies one logical
request; retry the **same** request with the same ID after an uncertain outcome.
A revision conflict requires rereading status and reconciling, not blindly
retrying a stale transition. Never reuse an operation ID for different inputs.
Never edit state.json directly, steal a lock, expire a reservation, or recreate
missing state to make a gate green. A lock or ambiguous state is a blocker to
inspect and report; no automatic bypass is provided.

每次变更传入 `--id <sprint-id> --revision <当前版本> --operation <唯一操作 ID>`。
每个新逻辑动作前读取 status。工具以 mkdir 锁串行化写入、比较版本并持久原子
替换 JSON。不确定结果的重试保持同一请求与同一 ID；版本冲突先重读并协调，
不盲重试旧转换，不用同 ID 表示不同输入。不手改 state.json、不抢锁、不自动
过期预留，也不为刷绿而重建缺失状态。锁或歧义须检查报告，无自动绕过。

## Lifecycle commands / 生命周期命令

All commands below also require the ID/revision/operation flags above.

| Command | Precondition and effect / 前置与效果 |
|---|---|
| `reserve --epic E1 --document <relative-doc> --branch <branch> --worktree <absolute-path>` | Atomically counts reserved+active+acceptance against stored wipLimit, then reserves before creating carrier/docs. 原子计数并预留后才创建载体/文档。 |
| `cancel-reservation` | reserved → cancelled only if planned path, local branch and registered worktree are all absent; otherwise block. 仅计划路径、本地分支和登记 worktree 全部不存在时取消预留，否则阻断。 |
| `activate` | reserved → active after carrier and active Markdown projection exist. 载体与 active 投影存在后激活。 |
| `review-begin` | active/acceptance → active, clears evidence before any review/doc edits. 评审/文档编辑前撤销旧证据。 |
| `review-pass` | active → acceptance only after verify-clean succeeds in carrier. Commit provisional Markdown state/pointer/date, record and payload first; shared state stores the accepted commit/tree. 先提交临时投影、记录和内容，载体 verify-clean 通过后记录受验 commit/tree、置共享 acceptance。 |
| `review-blocked` | active remains active; records failed review. 记录阻断，保持 active。 |
| `land --landing <SHA> --main <main-ref>` | acceptance → merged only with verifiable landing on stored mainRef and candidate/evidence checks; --main must match mainRef and resolves its local branch ref. --main 须匹配已存 mainRef，解析其本地分支 ref，校验真实落点与候选证据后记 merged。 |
| `close` | merged → closed. 先共享转换，再更新 Markdown 投影。 |

Reserve is the WIP admission operation, not a read-then-write count. `wip` is
only a read-only diagnostic using shared state and must match stored wipLimit.
Failed or interrupted starts keep their reservation and WIP slot; inspect and
resume the same reserved operation rather than minting a second sprint. An unused reservation can be explicitly cancelled only with `cancel-reservation`
and its strict absence checks. Cancelled IDs remain recorded and cannot be reused.
No automatic expiry, active cancellation or reconfiguration command is provided;
explicit reconfiguration is not implemented in this version. Stop and report the limitation rather than editing JSON or trying import over an existing store.

reserve 才是 WIP 准入动作，不是先读后写计数。wip 只是读取共享状态的诊断，
限制必须与存储的 wipLimit 一致。失败/中断的启动保留预留与槽位；检查后恢复
同一预留，不创建第二个 sprint。未使用预留可显式 cancel-reservation，但必须通过严格的全不存在检查。cancelled ID 保留且不能复用。不自动过期、不取消 active、不提供重配置命令；本版尚未实现显式重配置；需要变更时停止并说明限制，不能手改 JSON 或用 import 覆盖既有存储。

## Pre-merge check / 合并前检查

`node "<plugin>/scripts/shared-ledger.mjs" check --id <sprint-id>` is read-only.
It requires shared acceptance, the right carrier, verify-clean, the same evidence
fingerprint and the exact stored accepted HEAD commit. Run immediately before a
new merge; a changed candidate requires a new review, not metadata repair.

check 是只读动作，要求共享 acceptance、正确载体、verify-clean、相同证据指纹
以及受验 HEAD commit 完全一致。新合并前立即运行；候选改变须重验，不能补改
元数据放行。

## Ordering and recovery / 顺序与恢复

Shared state normally changes first, then Markdown is projected and committed. Commit terminal projections on stored mainRef before doctor or another reserve.
The explicit exception is review-pass: provisional acceptance fields are needed
for fingerprint validation, but shared active remains authoritative until the
command succeeds. A crash between state and projection is detected by doctor;
repair the canonical carrier projection from the existing shared entry, never reverse authority. Doctor checks that canonical carrier and its ID/epic/worktree/state projection, not every stale branch copy. For terminal merged/closed entries, doctor and close read the committed projection from stored mainRef, never the caller's stale branch.
No command automatically proves browser/scenario execution.

通常先改共享状态，再更新并提交 Markdown 投影。终态投影须在已存 mainRef 上提交，之后才能 doctor 或再次 reserve。review-pass 是显式例外：
指纹验证需要临时 acceptance 字段，但命令成功前共享 active 仍作准。
状态与投影间崩溃由 doctor 揭示；按已有共享记录修规范载体的投影，不能倒置权威。doctor 检查规范载体及其 ID/epic/worktree/state，不扫描每个旧分支副本。对于 merged/closed，doctor 与 close 读取已存 mainRef 分支已提交的投影，不读调用方的旧分支。
命令本身不证明浏览器/场景曾实际运行。

Before a fresh merge, retain fingerprint/clean-tree checks and the verified
candidate/main preconditions. If Git already landed but shared state still says
acceptance, first identify the actual landing (even if the worktree exists),
then call land and project the result before teardown. Land validates the stored accepted tree against the actual landing and its main reachability even if the carrier is already gone. Do not merge again.
Ambiguous squash/rebase mappings need user confirmation. Remote merge races
still require host protections; the local state lock is not a remote Git lock.

新合并前仍须指纹/干净树与候选/主线检查。若 Git 已落地但共享状态仍为
acceptance，先识别真实落点（worktree 存在也适用），再调用 land、更新投影；land 即使载体已不在也会按已存受验树校验实际落点及主线可达性，
之后拆除，绝不再次合并。squash/rebase 歧义须用户确认。本地状态锁不等于
远端 Git 锁，远端合并竞态仍依赖宿主保护。
