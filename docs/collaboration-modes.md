# Agent collaboration modes / Agent 协作模式

SuperVibe owns sprint contracts and evidence, not an agent scheduler. Two modes are supported at the **contract/skill-routing and fixture-test level**; neither is yet certified by a live native-harness or Orca E2E run.

SuperVibe 管 sprint 契约与证据，不自建 agent 调度器。两种模式目前支持到**契约、技能路由及 fixture 测试层**；均未通过真实原生 harness 或 Orca 端到端认证。

| Mode / 模式 | Provider | Boundary / 边界 |
|---|---|---|
| `native` | `harness` | Actual current harness worker tools, e.g. Claude Code subagents / 当前 harness 的真实 worker 工具，如 Claude Code subagent |
| `external` | `orca` | Orca CLI supplies cross-session/cross-harness orchestration / Orca CLI 提供跨会话、跨 harness 编排 |

Superpowers is an optional **execution-method layer** (brainstorming, planning, TDD), not a provider or third mode. Its absence allows manual methods, never an implicit collaboration-mode switch.

Superpowers 是可选的**执行方法层**（brainstorming、规划、TDD），不是 provider 或第三模式。缺失时可手动完成方法步骤，但不能隐式切换协作模式。

## Explicit configuration / 显式配置

Add one pair under the host `AGENTS.md` `## supervibe` section:

在宿主 `AGENTS.md` 的 `## supervibe` 节中选择一对：

```markdown
- collaboration_mode: native
- collaboration_provider: harness
```

Or / 或：

```markdown
- collaboration_mode: external
- collaboration_provider: orca
```

Unconfigured is not a third mode. Ask for a selection before delegation; missing, unsupported, mismatched or unavailable choices fail closed, without auto-installation, credential setup or fallback. Read config from the actual host, not this plugin's own development config.

未配置不是第三种模式。委派前先请用户选择；配置缺失、不支持、不匹配或能力不可用时拒绝委派，不自动安装、配置凭证或降级。读取实际宿主配置，不拿插件开发仓库的配置代替。

## Common contract / 统一契约

The helper validates JSON on stdin from the host worktree; it does **not** probe tools, dispatch workers, schedule tasks or write runtime state:

在宿主 worktree 中运行 helper，以 stdin 校验 JSON；它**不**探测工具、派发 worker、调度任务或写入运行状态：

```sh
node <plugin-root>/scripts/collaboration-contract.mjs task < task.json
node <plugin-root>/scripts/collaboration-contract.mjs result < result-envelope.json
```

- Task / 任务：`schema: 1`, `mode`, `provider`, `sprint`, `taskId`, `objective`, `worktree`, `allowedPaths` (array / 数组), `acceptance` (array / 数组).
- Result / 结果：`schema: 1`, `mode`, `provider`, `sprint`, `taskId`, `status` (`succeeded|failed|blocked`), `execution`, `worktree`, `evidence` (array / 数组), `blockers` (array / 数组).
- Result input envelope / 结果输入封装：`{"task": <original request>, "result": <worker result>}`. Identities and configured route must match / 身份与配置路由必须一致。
- Native execution / 原生执行身份：actual `workerId`, optional `sessionId` when exposed by the harness / 真实 `workerId`，harness 提供时可附 `sessionId`；Orca execution：`runId`, `taskId`, `dispatchId`. Orca Run groups work; it is not a harness conversation/session / Orca Run 是工作分组，不等于 harness 对话/会话。

New tasks require the ledger's active sprint; result receipts may be collected in active/acceptance. Canonical worktree must match the sprint carrier and local common-dir, and its current branch must equal the registered sprint branch (detached HEAD is rejected). Successful results require evidence; failed/blocked results cannot imply acceptance. These are shape/identity/boundary checks, not proof that commands ran or evidence is true. The coordinator still checks artifacts and runs acceptance.

新任务要求台账中 sprint 为 active；active/acceptance 可收集结果回执。规范化 worktree 必须匹配 sprint 载体与本地 common-dir，当前分支必须匹配登记的 sprint 分支（拒绝 detached HEAD）。成功需证据；失败/阻塞不代表验收通过。helper 检查结构、身份与边界，不证明命令执行过或证据真实；负责人仍要核实工件并完成验收。

Persist task/result, execution references and actual workspace/terminal receipts (terminal when present) in a sprint-linked handoff note, before acceptance fingerprinting. Keep secrets and raw sensitive logs out. This versioned handoff is separate from the untracked common-dir runtime ledger; do not claim that the helper writes either automatically.

验收指纹生成前，把任务/结果、执行引用、实际工作区/terminal 回执（存在 terminal 时）写入关联 sprint 的交接笔记。不记录秘密或敏感原始日志。这份可版本化交接记录独立于不入 Git 的 common-dir 运行台账；helper 不自动写入二者。

## Native route / 原生路由

Inspect the current harness's actual available worker creation and result capabilities (plus messaging when the task needs interaction) and its documented lifecycle. Pass objective, allowed paths, acceptance and permission limits through those tools; retain actual worker/session identities and collect an explicit outcome. No universal invented spawn API, assumed cross-session support or success inferred from a worker stopping. Missing required capability blocks the route.

检查当前 harness 实际可用的 worker 创建与结果能力（任务需要交互时还需通信能力）及其文档生命周期。通过这些工具传递目标、允许路径、验收条件与权限边界；保留真实 worker/session 身份并收集明确结果。不发明通用 spawn API，不假设跨会话能力，不把 worker 停止当成功。缺少所需能力就阻止此路由。

## Orca route / Orca 路由

1. Locate the installed CLI and read `orca skills get orchestration` plus relevant current references before use. The shipped guide, not remembered flags, owns CLI syntax.
2. Follow `worker-start`, `send`, `check`, `inbox` and the documented task/run lifecycle. Launch from the validated sprint carrier, usually with `--worktree current`; the worker must verify common-dir/carrier as its first action before writes. Retain run/task/dispatch and workspace receipts; verify the actual workspace before any write.
3. End the turn after dispatch and await event-driven wakes. Use the wake's `check` as documented: it consumes pending mail, so never poll it. `check --peek` is a non-consuming diagnostic, not a polling scheduler; `inbox` is history. Questions and completion events require explicit handling; `worker_done` is not proof of successful acceptance.
4. An unknown start outcome requires receipt/state inspection before any repeat. A failed start requires its recovery guidance, not blind respawn. Authorized retries preserve the same Task and `--retry-of` dispatch linkage. Retry placement is not inherited: validate it again. Follow `failedStage`/`next`; three failed starts in a chain require explicit user authorization to retry the same Task. Silence/timeouts do not prove termination; do not clean up or duplicate work on that assumption.

1. 定位已安装 CLI，先读 `orca skills get orchestration` 与相关当前参考。CLI 语法以随附指南为准，不凭记忆拼参数。
2. 遵循 `worker-start`、`send`、`check`、`inbox` 及官方 task/run 生命周期。从已校验 sprint 载体启动，通常用 `--worktree current`；worker 首个动作须在写入前核实 common-dir/载体。保留 run/task/dispatch 与工作区回执；写入前核实实际工作区。
3. 派发后结束回合，等待事件唤醒。按唤醒指示使用 `check`：它会消费待收消息，绝不轮询。`check --peek` 是不消费的诊断，不是轮询调度器；`inbox` 是历史。明确处理提问与完成事件；`worker_done` 不证明验收成功。
4. 启动结果不确定时，重复前先查回执/状态。启动失败按其恢复指导处理，不盲目重建。获准重试保留同一 Task，并通过 `--retry-of` 关联 dispatch。重试不继承放置位置，必须重新校验。遵循 `failedStage`/`next`；同链三次启动失败后，重试同一 Task 必须获得用户明确授权。静默/超时不证明终止，不据此清理或重复工作。

## Scope and safety / 范围与安全

One Git common-dir, including its existing worktrees, remains the sharing boundary. No remote ledger or independent-clone federation. Orca's ability to create another workspace does not authorize expanding it: verify placement, and reject incompatible workspaces. Do not create a worktree unless isolation was requested or a conflict requires it. Reserve WIP once per sprint, not per delegated task. Restrict workers to the agreed paths and permission scope; never implicitly authorize installation, credentials, commits, push or destructive cleanup. SuperVibe acceptance/complete gates remain authoritative.

共享范围仍是一个 Git common-dir 及其已有 worktree，不做远程账本或独立 clone 联邦。Orca 能新建工作区不等于获准扩大范围：核实位置，拒绝不兼容工作区。仅在用户要求隔离或存在冲突需要时新建 worktree。WIP 按 sprint 预留，不按子任务预留。worker 限于约定路径与权限；不隐式授权安装、凭证、提交、推送或破坏性清理。SuperVibe accept/complete 门禁仍为权威。

## Source baseline / 来源基线

Orca semantics were checked against [the official orchestration guide](https://github.com/stablyai/orca/blob/85d96f008a4e4955293f35bd3004c00b8b7ad4c9/skill-guides/orchestration.md), with its coordinator-loop, messaging-and-gates and recovery-and-cleanup references. Re-read the installed CLI guide at execution time; this pinned baseline is not a compatibility promise for every version.

Orca 语义核对自上述官方 orchestration 指南及其 coordinator-loop、messaging-and-gates、recovery-and-cleanup 参考。执行时重读已安装 CLI 指南；固定版本基线不是对所有版本的兼容承诺。
