# Worker lifecycle / Worker 生命周期

Sprint WIP, worker execution slots and environment resources are **three different limits**.
Sprint WIP counts `reserved|active|acceptance` Sprints. One Sprint keeps one canonical
integration carrier, but can have several registered development child worktrees in
**the same local Git common-dir**. Children do not reserve another Sprint. Sprint
acceptance targets the canonical integrated carrier, never an isolated child result.

Sprint WIP、worker 执行槽、环境资源是三个独立限制。同一 Sprint 可以登记多个开发子
worktree，均须属于同一本地 Git common-dir，不额外预留 Sprint WIP；规范 Sprint
载体仍是集成和验收权威，子分支成果须先集成。`maxWorkers` 按 epic 统计实际并发
worker（含嵌套 worker，不含当前协调主 Agent），不是每个 Sprint 各获得一份额度。

## Deterministic CLI / 确定性 CLI

Run from a host repository checkout. Every command reads **JSON stdin**, not flags:

```sh
node "<plugin base dir>/scripts/worker-lifecycle.mjs" <command> < request.json
```

Every request uses `{"ledgerRevision": <current revision>, "operation": "<unique operation ID>", "payload": {...}}`.
Read `shared-ledger.mjs status` before each new mutation. For an uncertain exact retry,
reuse the operation ID and identical payload; never hand-edit the ledger. The returned
ledger includes `workerExecutions.entries[id]`; retain its fencing `token`.

| Command | Payload / 条件 |
| --- | --- |
| `enable` | `{quiescence:{by:"coordinator",stopped:true,evidenceRef:"..."}}`; explicitly reconcile **all legacy workers** as stopped and release legacy held worker resource claims first. Never enable merely to bypass occupied slots. |
| `reserve` | `{id,task,branch,ownership}`; full existing task contract plus `task.workerExecutionId === id`; canonical absolute `task.worktree`, matching branch and common-dir. `ownership` is `managed`, `borrowed` or `provider`. For Sprint tasks, parent Sprint must exist and be active. Canonical Sprint carrier must be `borrowed`. For Roadmap acceptance, use `scope:"roadmap",epic,epicDocument,role:"acceptance"`, omit `sprint`, and borrow the canonical main worktree with `branch` equal to stored `mainRef`. |
| `start` | `{id,token,execution}`; native execution has actual `workerId`; Orca has actual `runId,taskId,dispatchId`. Retain additional identity receipts needed by the acceptance contract. |
| `unknown` | `{id,token}`; uncertain execution still occupies a slot. Reconcile the backend; never infer expiry. |
| `settle` | `{id,token,result,quiescence:{by:"coordinator",stopped:true,evidenceRef:"...",execution}}`; full validated result, exact original task/backend binding, and proof that this execution stopped. Applies to `succeeded`, `failed` and `blocked`, not success alone. |
| `abort` | `{id,token,quiescence:{by:"coordinator",stopped:true,neverStarted:true,evidenceRef:"..."}}`; only a pending, unbound execution proven never started. An ambiguous launch is not an abort. |
| `cleanup` | `{id,token,preserveBranch:true}` for managed child cleanup, only after settlement. Provider-owned workspace instead needs `providerReceipt:{action:"workspace-cleanup",execution,evidenceRef}` after provider cleanup and observed removal. Borrowed workspace is retained. |

登记之前先准备获准的子 worktree 并核对路径/分支；登记成功后才启动 worker，启动回执
用 `start` 绑定。失败派发须区分“明确未启动”和“状态未知”。新尝试使用新 execution
ID；不复用旧 token。迁移 `enable` 是协调者基于实际后端证据作出的显式操作，不是
自动认定旧 worker 已退出。任务/结果格式见 [协作契约](collaboration-modes.md)。

## Release execution first, clean storage second / 先结算执行，再清理存储

`pending|running|unknown` occupy worker slots. `settled` does not: a failed or blocked
worker also releases its slot once its outcome and quiescence are recorded. Validation
of a result alone is **not** settlement. An unknown backend stays counted: no TTL,
no force release, and no inference from a completion message alone.

On a native completion/error or Orca `worker_done` wake, the **current main agent**
collects outcome and verifies backend quiescence, calls `settle`, then `cleanup`.
Handle failures on this same path. Do not defer normal cleanup until the user asks.
Already-authorized managed cleanup with the required proofs does not need repeated
permission. These are coordinator obligations: the script installs **no backend hook,
background listener, scheduler or polling loop** and does not attest evidence truth.

原生完成/错误或 Orca `worker_done` 唤醒时，由当前主 Agent 收集结果、核实停止证据，
调用 `settle`，再调用 `cleanup`；失败/阻塞同样结算。结果校验或收到完成通知本身
不会释放槽位。已授权且证据齐全的受管清理无需每次再请用户许可；未知状态仍占槽，
不能凭超时或 `--force` 释放。没有安装真实后端自动事件钩子。

Managed cleanup checks recorded ownership, common-dir, exact path and branch; excludes
main/coordinator/canonical Sprint carriers; retains the branch for integration/recovery.
Dirty, untracked or ignored content leaves `cleanup_pending`, **without reacquiring an
execution slot**. Clean child worktrees may be removed even before their branch is
integrated because the branch is preserved. Never delete an unpreserved result.
Borrowed workspaces stay retained; provider workspaces use the provider lifecycle,
not a Git removal behind its back. Repeated cleanup is safe; unsafe/partial removal
requires inspection, not automatic prune or forced deletion.

受管子 worktree 清理保留分支；有 dirty/untracked/ignored 内容则保留目录等待处理，
但已结算的执行配额已释放。资源组占用另按 [资源协议](resources.md) 核实和释放；
执行结束不代表容器、账号或环境已经可安全重用。

## Sprint landing and limits / Sprint 收口与当前边界

Record `shared-ledger.mjs land` before canonical Sprint carrier teardown. `merged`
releases Sprint WIP; leftover storage does not keep it occupied. Canonical carrier
teardown remains the host-tooling operational path after verified landing, not this
child cleanup command. An interrupted Sprint reservation with existing artifacts
still requires inspection/resume; `abort` here cancels a **worker**, not that Sprint.
Do not claim automatic cleanup for interrupted canonical reservations.

The registry also supports **independent overall Roadmap acceptance** on the borrowed
canonical main worktree. It consumes the same epic worker cap without any Sprint WIP
reservation, keeps the existing wake/preflight/result checks, and retains main on
cleanup. Legacy ledgers remain on the old reconciliation path until explicit safe
migration. These Git fixture and contract checks do not establish live native/Orca E2E.

登记表也支持独立 Roadmap 整体验收：借用规范 main 工作区，占用同一 epic worker
配额，不增加 Sprint WIP，沿用任务/唤醒/结果自检，清理保留 main。规范载体清理与带工件
的中断 Sprint 预留恢复仍是操作流程，不冒充自动实现。测试不代表真实后端端到端验证。
