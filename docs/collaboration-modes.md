# Agent collaboration modes / Agent 协作模式

SuperVibe owns sprint contracts and evidence, not an agent scheduler. Two modes are supported at the **contract/skill-routing and fixture-test level**; neither is yet certified by a live native-harness or Orca E2E run.

SuperVibe 管 sprint 契约与证据，不自建 agent 调度器。两种模式目前支持到**契约、技能路由及 fixture 测试层**；均未通过真实原生 harness 或 Orca 端到端认证。

| Mode / 模式 | Provider | Boundary / 边界 |
|---|---|---|
| `native` | `harness` | Actual current harness worker tools, e.g. Claude Code subagents / 当前 harness 的真实 worker 工具，如 Claude Code subagent |
| `external` | `orca` | Orca CLI supplies cross-session/cross-harness orchestration / Orca CLI 提供跨会话、跨 harness 编排 |

Superpowers is an optional **execution-method layer** (brainstorming, planning, TDD), not a provider or third mode. Its absence allows manual methods, never an implicit collaboration-mode switch.

Superpowers 是可选的**执行方法层**（brainstorming、规划、TDD），不是 provider 或第三模式。缺失时可手动完成方法步骤，但不能隐式切换协作模式。

## Entry routing / 入口分流

Default to SuperVibe multi-agent iteration: a coordinating main agent plus workers. Explicit solo/no-subagent intent exits to available superpowers **before** shared-ledger reads/init/import, scaffold/config/reserve, epic/sprint prompts or artifact creation. Preserve no-subagents in the handoff; unavailable superpowers blocks that handoff rather than initializing iteration. `iteration-route.mjs` accepts stdin `{ "execution": "solo" }` or `{ "execution": "iteration" }` (default iteration) and returns intent only, without filesystem/runtime effects. It is not a capability probe or launcher. Selected native/Orca capability absence blocks, never silently downgrades to solo. `maxWorkers: 1` is one worker plus the coordinator, not solo. Solo is outside the two collaboration modes.

默认进入 SuperVibe 多 Agent 迭代，由协调主 Agent 加 workers 执行。明确 solo/禁用 subagent 时，直接交给可用 superpowers，必须先于 shared-ledger 读取/init/import、scaffold/config/reserve、询问 epic/sprint 或创建工件。交接保留禁用 subagent 的约束；superpowers 不可用就阻塞交接，不初始化迭代替代。`iteration-route.mjs` 从 stdin 接收 `{ "execution": "solo" }` 或 `{ "execution": "iteration" }`（默认 iteration），仅返回意图，无文件系统/运行时副作用，不是能力探针或启动器。所选 native/Orca 能力缺失即阻塞，不静默降级 solo。`maxWorkers: 1` 是协调主 Agent 加一个 worker，不是单 Agent；solo 在两种协作模式之外。

## Explicit configuration / 显式配置

Record a proposed pair under the host `AGENTS.md` `## supervibe` section:

在宿主 `AGENTS.md` 的 `## supervibe` 节中记录一对提议值：

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

## Overall iteration kickoff / 整体迭代启动

Ask once at the beginning of an overall iteration/epic, before its first sprint starts (not for every task or sprint):

1. Which route: native/harness or external/orca? Host AGENTS is a proposal, not user confirmation for this iteration.
2. Native: “What is the maximum number of concurrently occupied subagent slots?” Workers inherit the current harness; no separate worker-harness choice.
3. Orca: “How many concurrent worker sessions? Which worker harness? A single harness, or explicitly allow a mixed list? If mixed, which canonical harness IDs are allowed?” No invented cap, preferred harness or mixed-mode consent. Harness is not model; do not set a model unless separately chosen.
4. Ask explicitly: “Use an independent acceptance worker for this Roadmap?” Record the confirmed boolean `independentAcceptance`; neither missing nor null means consent.
5. Summarize the complete choice and obtain real user confirmation. Use `templates/iteration-collaboration.json` as a **draft**, not a runnable confirmed example. Missing/unconfirmed choices block delegation; planning can continue.

每个整体迭代/epic 开始、首个 sprint 启动前统一询问一次（不是每个任务或 sprint 重问）：

1. 使用 native/harness 还是 external/orca？AGENTS 只是提议值，不代表本次用户确认。
2. 原生：“同时占用的 subagent 名额上限是多少？”worker 继承当前 harness，不另选 harness。
3. Orca：“同时运行的 worker 会话上限是多少？用哪个 worker harness？统一一种，还是明确允许混用？混用允许哪些 canonical harness ID？”不得自定数量、首选 harness 或混用授权。harness 不等于模型；未另选模型就不覆盖模型。
4. 明确询问：“本 Roadmap 是否设置独立验收 worker？”记录确认后的布尔值 `independentAcceptance`；缺失或 null 不代表同意。
5. 汇总完整选择并获取真实确认。`templates/iteration-collaboration.json` 仅为**草稿**，不是已确认示例。缺失/未确认阻止委派，不阻止规划。

After confirmation only, fill the config's positive integer `maxWorkers`, explicit boolean `independentAcceptance`, `status: confirmed`, and `confirmation: {by: "user", source: <actual message/decision reference>, at: <timestamp>}`. Native uses `workerHarness: "inherit"`, `allowMixed: false`; Orca removes `workerHarness`, adds `workerHarnesses: [<chosen canonical IDs>]` and an explicit boolean `allowMixed` (multiple IDs require true). IDs are syntax-checked, not proof of installation. Never fabricate confirmation or mark a draft confirmed on the user's behalf.

仅在确认后填写正整数 `maxWorkers`、显式布尔值 `independentAcceptance`、`status: confirmed` 及 `confirmation: {by: "user", source: <真实消息/决策引用>, at: <时间戳>}`。原生用 `workerHarness: "inherit"`、`allowMixed: false`；Orca 删除 `workerHarness`，改为 `workerHarnesses: [<所选 canonical ID>]`，明确填写 `allowMixed`（多个 ID 必须 true）。名称校验不证明已安装；不得伪造确认或替用户把草稿标为确认。

```sh
# JSON envelope: {ledgerRevision, operation, config}; current shared revision + unique operation ID
node <plugin-root>/scripts/collaboration-contract.mjs confirm-config < confirmed-choice.json
# Resume: read by epic; output includes config and fingerprint for task binding
printf '{"epic":"E1"}' | node <plugin-root>/scripts/collaboration-contract.mjs iteration-config
```

The existing atomic ledger lock/CAS/idempotency protects `state.json.iterationConfigs[epic]`. This confirmed snapshot is the sole execution-policy authority for that epic; changing AGENTS does not silently override it. It lives in the same local common-dir, shared by its worktrees only, never committed/pushed. No new scope, daemon or scheduler. A new config starts at revision 1; changes increment it with a new user-confirmation source (reordered fields or a timestamp-only edit are not new confirmation). Resume reuses the confirmed snapshot without re-asking or writing. Changes are deliberate: drain/collect existing workers and results first, then confirm and save the new revision. Tasks derive epic from the shared sprint entry, and bind config revision plus content fingerprint; stale tasks/results fail closed. The helper checks provenance structure, not authenticity: the coordinator must verify the cited user message.

沿用台账原子锁/CAS/幂等机制保护 `state.json.iterationConfigs[epic]`。此确认快照是该 epic 执行策略的唯一权威；修改 AGENTS 不会静默覆盖它。仅保存在同一本地 common-dir、同组 worktree 共享，不提交/推送；不扩大范围、不新增守护进程或调度器。首次 revision 为 1，修改递增并需新的用户确认来源（字段重排或只改时间不算新确认）。恢复时直接复用，不重问、不重写。变更前先结束并收集现有 worker 结果，再确认保存新版。任务从台账 sprint 推导 epic，并绑定配置 revision 与内容指纹；过期任务/结果拒绝执行。helper 只校验来源结构，不证明真实性；负责人须核对真实用户消息。

### Capacity and harness preflight / 容量与 harness 前置检查

`maxWorkers` counts concurrently occupied worker slots across this epic's sprints/worktrees: **starting, running and uncertain** instances all count; the coordinator is excluded. It is neither lifetime task count nor sprint WIP. Nested workers count too; do not delegate unbounded spawning. Before every dispatch/retry, inspect actual backend live state and receipts, reconcile unresolved starts, and ensure occupied + proposed workers <= cap. Unknown occupancy blocks dispatch. One coordinator serializes admissions; multiple independent coordinators must not race on a stale observation. This is a coordinator contract, **not an atomic backend semaphore or implemented runtime enforcement**.

`maxWorkers` 按该 epic 各 sprint/worktree 同时占用的 worker 名额计数：**启动中、运行中、状态不确定**均占名额，不含 coordinator；不是历史任务总数，也不是 sprint WIP。嵌套 worker 同样计数，不允许无限自行派生。每次派发/重试前，从真实 backend 活跃状态与回执核对占用、未决启动，保证已有占用 + 拟启动数量 <= 上限。占用无法确定就不派发。由一个 coordinator 串行准入，多个独立 coordinator 不得基于过期观察竞争。这是负责人契约，**不是原子 backend 信号量，也不是已实现的运行时限流**。

For Orca, choose each task's `workerHarness` from the confirmed list, verify the installed CLI/current harness capabilities, then use the documented `--agent` selection. Do not invent `agent list` or `--max-workers` flags. Missing harness/credentials blocks that choice; no automatic install/fallback. If reusing an existing worker/terminal, verify its harness matches; messaging cannot switch harness. Do not combine terminal reuse with incompatible agent/model overrides. Native task `workerHarness` is always `inherit`. See current installed documentation for actual commands.

Orca 每项任务的 `workerHarness` 必须属于确认列表；先检查已安装 CLI/所选 harness 的真实能力，再按当前文档用 `--agent` 选择。不发明 `agent list` 或 `--max-workers` 参数。缺 harness/凭证时阻塞该选择，不自动安装/降级。复用现有 worker/terminal 要核实 harness 匹配；发送消息不能切换 harness，复用 terminal 不混用不兼容的 agent/model 覆盖。原生任务 `workerHarness` 始终为 `inherit`；具体命令以本机当前文档为准。

## Acceptance ownership and wake self-check / 验收归属与唤醒自检

The coordinator is **the current main agent**; do not spawn a separate coordinator. The confirmed Roadmap policy selects acceptance ownership: `independentAcceptance: false` means the main agent executes acceptance, without inventing its own worker ID; `true` requires a separate acceptance worker. In either case the main agent remains responsible for evidence review and the final acceptance gate. This choice covers Sprint and overall Roadmap acceptance and changes only through fresh user confirmation and the existing policy CAS/revision mechanism. Legacy/missing choices require confirmation, never an inferred default.

协调者就是**当前主 Agent**，不另起 coordinator。Roadmap 确认策略决定验收归属：`independentAcceptance: false` 由主 Agent 执行验收，不虚构自己的 worker ID；`true` 必须由独立验收 worker 执行。无论哪种方式，主 Agent 都负责证据复核与最终验收门禁。策略涵盖 Sprint 与 Roadmap 整体验收；变更必须有新的用户确认，并沿用策略 CAS/revision。旧配置缺此选择时先确认，不推断默认值。

Independent means a different actual executor identity from every developer of the candidate, not necessarily a different harness. Use actual native `workerId` or a durable Orca worker/session identity backed by backend receipts. Different tasks/dispatch attempts, a renamed role, or another dispatch into the same reused terminal/session do not establish independence. Unknown identity or incomplete developer provenance blocks/escalates; never fabricate identities. Choose the acceptance harness with the user at assignment from the already confirmed allowed set; native inherits the harness. No extra kickoff harness field is needed.

独立指与该候选版本每个开发者都不同的真实执行身份，不要求不同 harness。使用真实原生 `workerId`，或由 backend 回执支持的 Orca 持久 worker/session 身份。不同 task/dispatch、改角色名称、或同一复用 terminal/session 的新 dispatch，都不能证明独立。身份未知或开发者来源不完整时阻塞并上报，不伪造身份。派发时由用户在已确认允许集合中选择验收 harness；原生继承，不新增启动阶段 harness 配置项。

Acceptance workers occupy the same `maxWorkers` pool, including starting/running/uncertain and nested workers. There is no acceptance-slot exception. With cap 1, develop and accept sequentially using distinct identities after the development slot is verifiably released. These are admission instructions, not an implemented scheduler/semaphore.

验收 worker 占用同一个 `maxWorkers` 池，启动中/运行中/不确定及嵌套 worker 均计入，没有额外验收名额。上限为 1 时，核实开发名额释放后，以不同身份顺序开发与验收。这是准入指令，不是已实现的调度器/信号量。

**On every acceptance wake/resume**, before scenarios, the assigned executor must self-check and record: exact candidate/build and context; running target environment and its ownership/availability (including no conflicting worker mutation during scenarios needing stability); scenario-required browser/CLI/API capabilities; authorized test account/access; test data; and evidence capture. Derive requirements from the agreed upfront scenarios: a CLI-only project does not require a browser; mark a condition not applicable only with a scenario-grounded reason. Readiness is not a lasting worker capability: a new wake invalidates assumptions, and code/build/environment/context changes require a fresh self-check. Main-agent acceptance follows the same readiness requirements without manufacturing a worker identity.

**每次验收唤醒/恢复**，执行者都必须在运行场景前自检并记录：确切候选版本/build 与上下文；目标环境是否运行、归属与可用性（要求稳定环境的场景中不得有其他 worker 冲突修改）；场景所需 browser/CLI/API 能力；测试账号及访问授权；测试数据；证据采集能力。要求从事前约定的场景推导：纯 CLI 项目不强制浏览器；只有有场景依据的理由才能标注不适用。就绪不是 worker 的永久能力：新唤醒即失效，代码/build/环境/上下文变化也必须重新自检。主 Agent 验收同样自检，但不制造 worker 身份。

Missing or unknown required conditions mean **blocked**, with exact blockers and an authorized remediation path; do not run destructive preparation, install tools, log in, reset shared credentials, mutate shared containers/data, or claim resource reservations without separate authorization. No resource reservation manager is implemented here. Never substitute static/CI/API evidence for a required real operation, and never reuse a development success as independent acceptance. Retain preflight/identity evidence alongside the acceptance result; contract checks cannot prove backend execution or real environment readiness. Live native/Orca E2E remains unverified.

必需条件缺失或未知即 **blocked**，写清阻塞点与需授权的修复路径；不得未经另行授权做破坏性准备、安装工具、登录、刷新共享凭证、修改共享容器/数据，也不得声称持有不存在的资源预留。本实现没有资源预留管理器。静态/CI/API 证据不能替代必需真实操作，开发成功不能复用为独立验收。验收结果保留自检与身份来源；契约检查不能证明 backend 已执行或环境真实就绪。真实 native/Orca E2E 仍未验证。

## Common contract / 统一契约

The task/result helper validates JSON on stdin from the host worktree; it does **not** probe tools, dispatch workers or schedule tasks. Explicit `confirm-config` writes confirmed configuration; `acceptance-wake` registers the current acceptance wake through the same ledger CAS:

在宿主 worktree 中运行 helper，以 stdin 校验 JSON；它**不**探测工具、派发 worker 或调度任务。显式 `confirm-config` 写入已确认配置；`acceptance-wake` 经相同台账 CAS 登记当前验收唤醒：

```sh
node <plugin-root>/scripts/collaboration-contract.mjs task < task.json
node <plugin-root>/scripts/collaboration-contract.mjs result < result-envelope.json
```

- Task / 任务：`schema: 1`, `mode`, `provider`, `iterationConfigRevision`, `iterationConfigFingerprint`, `workerHarness`, `sprint`, `taskId`, `objective`, `worktree`, `allowedPaths` (array / 数组), `acceptance` (array / 数组).
- Result / 结果：`schema: 1`, `mode`, `provider`, `workerHarness`, `iterationConfigRevision`, `iterationConfigFingerprint`, `sprint`, `taskId`, `status` (`succeeded|failed|blocked`), `execution`, `worktree`, `evidence` (array / 数组), `blockers` (array / 数组).
- Result input envelope / 结果输入封装：`{"task": <original request>, "result": <worker result>}`. Identities, worker harness, config revision/fingerprint and configured route must match / 身份、worker harness、配置 revision/指纹及路由必须一致。
- Native execution / 原生执行身份：actual `workerId`, optional `sessionId` when exposed by the harness / 真实 `workerId`，harness 提供时可附 `sessionId`；Orca execution：`runId`, `taskId`, `dispatchId`. Orca Run groups work; it is not a harness conversation/session / Orca Run 是工作分组，不等于 harness 对话/会话。

New tasks require the ledger's active sprint; result receipts may be collected in active/acceptance. Without an enabled worker registry, worktree placement follows the canonical Sprint carrier. After explicit migration, development tasks may use their exact registered child worktree/branch under that Sprint in the same local common-dir; Sprint acceptance still uses the canonical integrated carrier. Detached HEAD and unregistered or mismatched placements are rejected. See [worker lifecycle](worker-lifecycle.md). Successful results require evidence; failed/blocked results cannot imply acceptance. These are shape/identity/boundary checks, not proof that commands ran or evidence is true. The coordinator still checks artifacts and runs acceptance.

新任务要求台账中 sprint 为 active；active/acceptance 可收集结果回执。未启用 worker 登记时沿用规范 Sprint 载体；显式迁移后，开发任务可使用该 Sprint 下精确登记的子 worktree/分支，仍限同一本地 common-dir；Sprint 验收仍使用规范集成载体。拒绝 detached HEAD、未登记或不匹配的工作区。见 [worker 生命周期](worker-lifecycle.md)。成功需证据；失败/阻塞不代表验收通过。helper 检查结构、身份与边界，不证明命令执行过或证据真实；负责人仍要核实工件并完成验收。

Persist task/result, execution references and actual workspace/terminal receipts (terminal when present) in a sprint-linked handoff note, before acceptance fingerprinting. Keep secrets and raw sensitive logs out. This versioned handoff is separate from the untracked common-dir runtime ledger; task/result validation does not write either automatically.

验收指纹生成前，把任务/结果、执行引用、实际工作区/terminal 回执（存在 terminal 时）写入关联 sprint 的交接笔记。不记录秘密或敏感原始日志。这份可版本化交接记录独立于不入 Git 的 common-dir 运行台账；task/result helper 不自动写入二者。

### Acceptance wake contract / 验收唤醒契约

For an independent Sprint acceptance task, set `role: "acceptance"` and `acceptanceContext: {wakeId, wakeSequence, candidate, build, environmentRevision, record, developers}`. `candidate` is the workflow snapshot fingerprint, not a guessed commit label; `record` identifies this acceptance attempt. `developers` is the complete actual candidate developer provenance list of `{mode, execution}`. Register each wake/resume using `acceptance-wake` with `{ledgerRevision, operation, task}`: increase the per-sprint/task `wakeSequence` and use a new `wakeId`. Re-register after a changed candidate/build/environment context; reuse the same operation only for an exact uncertain CAS retry. Do not treat a fresh dispatch as proof of a fresh executor.

独立 Sprint 验收任务设置 `role: "acceptance"` 和 `acceptanceContext: {wakeId, wakeSequence, candidate, build, environmentRevision, record, developers}`。`candidate` 为 workflow snapshot 指纹，不是猜测的提交标签；`record` 标识本次验收记录。`developers` 为候选版本全部真实开发者 `{mode, execution}` 来源。每次唤醒/恢复通过 `acceptance-wake` 输入 `{ledgerRevision, operation, task}` 登记：递增该 sprint/task 的 `wakeSequence` 并使用新 `wakeId`；候选版本/build/环境上下文改变后重新登记。只有原样、结果不确定的 CAS 重试才复用 operation。新 dispatch 不证明新执行者。

```sh
node <plugin-root>/scripts/collaboration-contract.mjs acceptance-wake < acceptance-wake-envelope.json
```

A successful acceptance result has `role: "acceptance"` and a `preflight` receipt with `schema: 1`, `status: "ready"`, the matching `wakeId`, `wakeSequence`, `candidate`, `build`, `environmentRevision`, plus `executor`, `evidence`, and `checks`. Required check keys are `targetBuild`, `environment`, `resourceSafety`, `authorization`, `testData`, `evidenceRecording`, and `capability:<modality>` for the required scenario modalities (for example `capability:cli`). Each has `{status: "ready", evidence: <specific observation/reference>}`. Where an account or data fixture is unnecessary, its evidence must explain why the scenario needs none; never use not-applicable to hide missing requirements. Result evidence must reference the preflight evidence. Never prefill a ready receipt without actual observations.

成功验收结果包含 `role: "acceptance"` 与 `preflight`：`schema: 1`、`status: "ready"`、匹配的 `wakeId`、`wakeSequence`、`candidate`、`build`、`environmentRevision`，以及 `executor`、`evidence`、`checks`。必需检查项为 `targetBuild`、`environment`、`resourceSafety`、`authorization`、`testData`、`evidenceRecording`，再加必需场景的 `capability:<modality>`（如 `capability:cli`）；每项为 `{status: "ready", evidence: <具体观察/引用>}`。场景不需要账号或数据时，用证据说明为何无需此依赖，不能以不适用掩盖缺失。结果证据须引用自检证据，不得未观察就预填 ready。

The executor binding is `native:<workerId>` or `orca:<kind>:<id>`. Orca execution additionally supplies `executorIdentity: {kind: "worker"|"session", id, source}` from a real durable backend receipt; run/task/dispatch or terminal names alone do not satisfy it. A repeated developer executor cannot produce independent success. Unknown readiness, stale wake/context, candidate mismatch or incomplete identity cannot authorize success. This validates declarations and references, not their authenticity or live execution.

执行者绑定为 `native:<workerId>` 或 `orca:<kind>:<id>`。Orca execution 另提供真实持久 backend 回执中的 `executorIdentity: {kind: "worker"|"session", id, source}`；只有 run/task/dispatch 或 terminal 名称不足以满足要求。重复开发者身份不能产生独立成功。就绪未知、过期唤醒/上下文、候选版本不符或身份不完整都不能授权成功。此校验只检查声明及引用，不证明其真实性或真实执行。

For an independent **Roadmap** acceptance task, use `scope: "roadmap"`, `epic: <epic ID>`, `epicDocument: <repository-relative epic document>`, and `role: "acceptance"`; omit `sprint`. Its `worktree` must be the actual configured main branch carrier, with the current integrated candidate from `roadmap-snapshot`, within the same Git common-dir. No active Sprint or new Sprint WIP reservation is required. Use the same `acceptanceContext`, `acceptance-wake` CAS and result/preflight contract, with per-epic/task wake freshness.

独立 **Roadmap** 验收任务使用 `scope: "roadmap"`、`epic: <epic ID>`、`epicDocument: <仓库相对 epic 文档路径>`、`role: "acceptance"`，不填写 `sprint`。`worktree` 必须是配置的 main 分支真实载体，候选版本来自当前集成内容的 `roadmap-snapshot`，位于相同 Git common-dir。无需 active Sprint，也不新增 Sprint WIP 预留。沿用相同 `acceptanceContext`、`acceptance-wake` CAS 与结果/preflight 契约，按 epic/task 检查唤醒新鲜度。

When the confirmed policy has `independentAcceptance: true`, the final Roadmap acceptance record must embed exactly one fenced `supervibe-acceptance-execution` JSON block containing `{task, result}`. `roadmap-verify` checks the explicit current policy, accepted harness, execution scope, latest registered wake, current candidate, distinct identity and readiness evidence. Missing/stale/mismatched execution blocks closure. With `false`, main-agent acceptance does not require a worker ID or worker execution block; its scenario readiness remains a skill obligation. Machine checks validate evidence structure and freshness, never prove real backend execution or environment truth. Live native/Orca E2E remains unverified.

已确认策略为 `independentAcceptance: true` 时，Roadmap 最终验收记录必须嵌入恰好一个 `supervibe-acceptance-execution` fenced JSON 块，内容为 `{task, result}`。`roadmap-verify` 检查当前显式策略、允许的 harness、执行范围、最新登记唤醒、当前候选版本、不同执行身份及就绪证据。缺失/过期/不匹配即阻止收口。为 `false` 时，主 Agent 验收不要求 worker ID 或 worker execution 块；场景就绪仍是技能义务。机器检查证明结构和新鲜度，不证明真实 backend 已执行或环境真实就绪；真实 native/Orca E2E 仍未验证。

## Native route / 原生路由

Inspect the current harness's actual available worker creation and result capabilities (plus messaging when the task needs interaction) and its documented lifecycle. Pass objective, allowed paths, acceptance and permission limits through those tools; retain actual worker/session identities and collect an explicit outcome. No universal invented spawn API, assumed cross-session support or success inferred from a worker stopping. Missing required capability blocks the route.

检查当前 harness 实际可用的 worker 创建与结果能力（任务需要交互时还需通信能力）及其文档生命周期。通过这些工具传递目标、允许路径、验收条件与权限边界；保留真实 worker/session 身份并收集明确结果。不发明通用 spawn API，不假设跨会话能力，不把 worker 停止当成功。缺少所需能力就阻止此路由。

## Orca route / Orca 路由

1. Locate the installed CLI and read `orca skills get orchestration` plus relevant current references before use. The shipped guide, not remembered flags, owns CLI syntax.
2. Follow `worker-start`, `send`, `check`, `inbox` and the documented task/run lifecycle. Launch from the validated registered workspace, usually with `--worktree current`; the worker must verify common-dir/carrier as its first action before writes. Retain run/task/dispatch and workspace receipts; verify the actual workspace before any write.
3. End the turn after dispatch and await event-driven wakes. Use the wake's `check` as documented: it consumes pending mail, so never poll it. `check --peek` is a non-consuming diagnostic, not a polling scheduler; `inbox` is history. Questions and completion events require explicit handling; `worker_done` is not proof of successful acceptance.
4. An unknown start outcome requires receipt/state inspection before any repeat. A failed start requires its recovery guidance, not blind respawn. Authorized retries preserve the same Task and `--retry-of` dispatch linkage. Retry placement is not inherited: validate it again. Follow `failedStage`/`next`; three failed starts in a chain require explicit user authorization to retry the same Task. Silence/timeouts do not prove termination; do not clean up or duplicate work on that assumption.

1. 定位已安装 CLI，先读 `orca skills get orchestration` 与相关当前参考。CLI 语法以随附指南为准，不凭记忆拼参数。
2. 遵循 `worker-start`、`send`、`check`、`inbox` 及官方 task/run 生命周期。从已校验并登记的工作区启动，通常用 `--worktree current`；worker 首个动作须在写入前核实 common-dir/载体。保留 run/task/dispatch 与工作区回执；写入前核实实际工作区。
3. 派发后结束回合，等待事件唤醒。按唤醒指示使用 `check`：它会消费待收消息，绝不轮询。`check --peek` 是不消费的诊断，不是轮询调度器；`inbox` 是历史。明确处理提问与完成事件；`worker_done` 不证明验收成功。
4. 启动结果不确定时，重复前先查回执/状态。启动失败按其恢复指导处理，不盲目重建。获准重试保留同一 Task，并通过 `--retry-of` 关联 dispatch。重试不继承放置位置，必须重新校验。遵循 `failedStage`/`next`；同链三次启动失败后，重试同一 Task 必须获得用户明确授权。静默/超时不证明终止，不据此清理或重复工作。

## Scope and safety / 范围与安全

One Git common-dir, including its existing worktrees, remains the sharing boundary. No remote ledger or independent-clone federation. Orca's ability to create another workspace does not authorize expanding it: verify placement, and reject incompatible workspaces. Do not create a worktree unless isolation was requested or a conflict requires it. Reserve WIP once per sprint, not per delegated task. Restrict workers to the agreed paths and permission scope; never implicitly authorize installation, credentials, commits, push or destructive cleanup. SuperVibe acceptance/complete gates remain authoritative.

共享范围仍是一个 Git common-dir 及其已有 worktree，不做远程账本或独立 clone 联邦。Orca 能新建工作区不等于获准扩大范围：核实位置，拒绝不兼容工作区。仅在用户要求隔离或存在冲突需要时新建 worktree。WIP 按 sprint 预留，不按子任务预留。worker 限于约定路径与权限；不隐式授权安装、凭证、提交、推送或破坏性清理。SuperVibe accept/complete 门禁仍为权威。

## Source baseline / 来源基线

Orca semantics were checked against [the official orchestration guide](https://github.com/stablyai/orca/blob/85d96f008a4e4955293f35bd3004c00b8b7ad4c9/skill-guides/orchestration.md), with its coordinator-loop, messaging-and-gates and recovery-and-cleanup references. Re-read the installed CLI guide at execution time; this pinned baseline is not a compatibility promise for every version.

Orca 语义核对自上述官方 orchestration 指南及其 coordinator-loop、messaging-and-gates、recovery-and-cleanup 参考。执行时重读已安装 CLI 指南；固定版本基线不是对所有版本的兼容承诺。

Sprint acceptance records under `independentAcceptance: true` also require exactly one `supervibe-acceptance-execution` block `{task, result}`. `verify` and `verify-clean` bind the actual Sprint ID/shared epic/document and enforce the same policy, candidate, wake and preflight checks; another Sprint receipt cannot substitute.

Sprint 验收在 `independentAcceptance: true` 时也必须包含恰好一个 `supervibe-acceptance-execution` 块 `{task, result}`。`verify` / `verify-clean` 绑定实际 Sprint ID、共享 epic/文档，并强制相同的策略、候选版本、唤醒、自检；不能借用其他 Sprint 回执。

## Execution settlement and workspace cleanup / 执行结算与工作区清理

[Worker lifecycle](worker-lifecycle.md) defines coordinator-driven CAS commands for explicit migration, worker reservation, start binding, unknown-state reconciliation, outcome/quiescence settlement and safe child-worktree cleanup. A development child is registered under its parent Sprint, not a new Sprint WIP reservation. `pending|running|unknown` occupy the epic worker cap; `settled` does not, even when storage remains dirty or provider-owned. Native completion/error and Orca `worker_done` must lead the current main agent to collect evidence and invoke settlement/cleanup; no backend hook is installed and completion alone proves neither quiescence nor acceptance. Independent Roadmap acceptance registers against the same epic cap on borrowed canonical main, without Sprint WIP.

[Worker 生命周期](worker-lifecycle.md) 给出协调者调用的 CAS 脚本：显式迁移、Sprint worker 预留、启动绑定、未知状态核对、结果/停止结算及安全子 worktree 清理。开发子工作区属于父 Sprint，不增加 Sprint WIP。pending/running/unknown 占用 epic worker 配额；settled 即释放，dirty 或 provider 工作区保留不重新占槽。原生完成/错误、Orca worker_done 由当前主 Agent 取证并调用结算/清理；没有安装后端事件钩子，完成本身不证明停止或验收通过。独立 Roadmap 整体验收借用规范 main 并登记，占用同一 epic worker 配额，不增加 Sprint WIP。
