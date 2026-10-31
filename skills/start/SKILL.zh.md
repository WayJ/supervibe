---
name: start
description: 当用户说 start、begin、kick off，或要拉起（pull）一个 sprint、epic、迭代时使用。
argument-hint: <epic-id> <sprint-id>
---

# supervibe:start — 开一个 sprint

把 epic 文档 Sprint Breakdown 里的一条 `ready` 桩行实体化为 sprint 文档——从规划进入执行唯一的一扇门。输入是 epic id + sprint id，两者必填：一个 epic 可同时挂多条 `ready` 桩行（并行波次），sprint id 永远无法从 epic 单独推出。任一参数缺失 → 询问；绝不猜测波次。

pre-start 规划活在桩行里；准入与运行状态活在共享台账。预留与激活之后，sprint 文档投影 active。sprint 是价值盒——由 DoD 收口，绝非时间盒；并行度受 `wip_limit` 约束，而非日历。

围绕这个动作：先做就绪裁决、先读史，再把脚手架文档交给执行层。superpowers 是推荐配对——在场则调度之；不在场则以同一工件契约手动产出。耦合仅止于工件契约：本技能绝不 fork 或改写执行层技能。零栈假设：一切路径取自宿主配置，绝不硬编码。

## 入口分流——先于迭代副作用（Entry routing）

第一步判断用户执行意图，必须先于读取/初始化共享账本、询问 epic/sprint ID、确认迭代配置、scaffold、预留 WIP 或创建任何迭代工件。默认是 **协调主 Agent 主持的多 Agent 迭代**。若用户明确只要单 Agent、不使用 subagent，直接交给可用的 **superpowers** 执行技能，不激活 SuperVibe 迭代、不创建或修改迭代状态，并把禁止 subagent 的约束传给执行层。superpowers 不可用则报告能力缺失，不以初始化迭代替代。

纯函数辅助命令 `node "<plugin base dir>/scripts/iteration-route.mjs"` 从 stdin 读取 `{ "execution": "solo" }` 或 `{ "execution": "iteration" }`（省略 execution 默认 iteration）。它只返回路由意图，不调用技能、不探测 harness。迭代内部仍只有 native/harness 与 external/orca 两种模式；检查真实能力，所选模式不可用即停止，不静默退回单 Agent。`maxWorkers: 1` 是 **协调主 Agent 加一个 worker**，不是 solo。以下指令仅在选择迭代路径后适用。

协调者就是**当前主 Agent**，不额外启动 coordinator。整体 Roadmap 启动时明确询问是否设置独立验收 worker，将确认后的布尔值 `independentAcceptance` 与既有迭代策略一起保存，不静默取默认值。`false` 由主 Agent 验收；`true` 必须另派独立验收 worker。验收 worker 同样计入 `maxWorkers`；上限为 1 时，开发结束并释放名额后再顺序派发不同身份的验收 worker。唤醒自检与身份约束见[协作模式](../../docs/collaboration-modes.md)。

## 共享运行权威（Shared runtime authority）

读取 `<plugin base dir>/docs/shared-ledger.md`。在宿主仓库根目录运行
`node "<plugin base dir>/scripts/shared-ledger.mjs" status`，将目标 sprint 与
共享条目核对。common-dir 存储而非 Markdown 拥有运行状态和 WIP；下文的
frontmatter 检查均是投影检查。无存储就停止，显式 init/import。用 doctor
诊断载体或投影漂移，不从分支副本静默恢复权威。下文每个变更均传入
`--id <sprint-id> --revision <当前版本> --operation <唯一操作 ID>`；新动作
先重读 status，不确定结果的同请求重试沿用同 ID。绝不手改存储。


## 读取宿主配置（Read host config）

入口分流选择迭代后，在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 本技能读取的配置键：`roadmaps_dir`、`sprints_dir`、`notes`、`wip_limit`；子节 `### doc_sync_map`。
- 键缺失时的默认值：`roadmaps_dir: docs/superpowers/roadmaps/`、`sprints_dir: docs/superpowers/sprints/`、`notes: .agents/notes/`、`wip_limit: 3`。
- 该节整体缺失 → STOP：唯一合法的下一步是 `supervibe:roadmap scaffold`——指引过去，其余一律拒绝。
- 该节确认存在后，解析本技能涉及的已配置目录（`roadmaps_dir`、`sprints_dir`、`notes`）并核实其存在。缺失 → STOP：指引用户运行 `supervibe:roadmap scaffold` 或修正配置路径；绝不隐式创建工件——配置路径笔误绝不能静默分叉真源。
- 模板按 `<plugin base dir>/templates/<file>` 解析（此处为 `sprint.md` 与 `handover-clause.md`）；绝不假设它们在宿主仓库里。
- 写 sprint 文档之前先查 `### doc_sync_map`：若映射表覆盖了本技能写的工件路径，以映射表为准——「本技能写出的工件不欠进一步 doc-sync」的豁免仅适用于未覆盖的路径。
- `### gates` 的 gate 命令与本技能无关——gate 在 accept 与 complete 处生效；start 不运行任何 gate。

## 整体迭代协作确认

epic 首个 sprint 启动前统一向用户询问一次：模式、并发 worker 上限，以及（仅 Orca）worker harness ID 和是否明确允许混用。原生继承当前 harness。worker 数量无默认值，与 sprint WIP 分开。读取[启动/配置规则](../../docs/collaboration-modes.md)和 `templates/iteration-collaboration.json`。仅将真实确认选择通过 `collaboration-contract.mjs confirm-config` 保存，含用户消息来源、当前 ledgerRevision 和 epic 配置 revision；不得伪造同意。common-dir 台账 `iterationConfigs[epic]` 是执行权威，AGENTS 仅提供提议。恢复/后续 sprint 直接复用，不反复询问。缺失/草稿配置阻止委派；变更需新确认、新 revision，并先结束和收集旧 worker/结果。

每次派发/重试前，跨本 epic 核实 backend 真实占用（启动中/运行中/不确定，含嵌套 worker；不含 coordinator）。占用未知或容量不足就阻止派发。由一个 coordinator 串行准入；这不是已实现的 backend 信号量。每项任务绑定配置 revision/指纹及获准 workerHarness；核实真实所选 harness 能力，不自动安装/降级。读写命令和 Orca terminal 复用限制见链接规则。

## 资源规划与准入

整体迭代启动时，在建议 worker 并发或启动消耗资源的环境之前，读取
`<plugin base dir>/docs/resources.md`。在实际本地执行机器运行只读
`node "<plugin base dir>/scripts/resource-policy.mjs" probe-local`，评估工作负载开销及
系统/Docker 预留，再由用户确认主机预算与资源组用途。Agent 槽位和环境实例数分别限制；
开销未知或容量证据过期时，不能默认宣称某个环境并发数安全。

使用共享容器、端口、数据库、浏览器 profile 或测试账号前，必须原子申请完整资源组并检查
当前所有权。把验收必需组预先写入场景 `resourceGroups`，冻结受验候选，并向验收提供
当前申领凭据。冲突或主机状态未知就停止使用，不能自行重启、清空、轮换凭据、抢占或
过期释放别人的资源。只有明确静止证据才可释放。纯分析等确实不需要资源组时可说明原因
后省略，不凭空增加资源需求。

经授权的 SSH 主机可提供构建/测试环境容量，worker 和共享账本仍留在本地。登记非秘密
别名并单独核实远端预算，不把本机探测当远端容量，也不把登记当作连接成功。这不授权
安装、配对、修改凭据或开通服务器。该协议协调遵守规则的 worker，不提供操作系统级隔离。

## 定位桩行（Locate the stub）

- 在 `roadmaps_dir` 中找到 frontmatter `epic` id 匹配的 epic 文档。没有匹配 → 拒绝，言明未知的 epic id。
- 在其 Sprint Breakdown 节中找到携带给定 sprint id 的桩行——id 必填，因为一个 epic 可同时挂多条 `ready` 桩行（并行波次）。没有匹配行 → 拒绝，言明未知的 sprint id。根本没有 Sprint Breakdown 节 → 拒绝，点名畸形的 epic 文档——而非未知 sprint id。
- 桩行必须处于 `ready` 状态：
  - `planned` → 拒绝并路由到 `supervibe:roadmap ready`——go 决策是战略性的，不在此处做出。
  - `started` → 拒绝：已实体化；点名既存的 sprint 文档（在 `sprints_dir` 中按 frontmatter `sprint` 匹配）。
- 裁决之前先读桩行备注：`supervibe:roadmap ready` 在那里记录了战略 go 决策理由——它是下文裁决的输入，不是裁决本身。

## 就绪裁决（Readiness adjudication）

动笔写任何文件之前的四项裁决——每一项要么阻断本次 start，要么塑造即将创建的文档。每项裁决结果落入新文档的 frontmatter 标记与开线条目的 decisions 节：

1. **依赖（Dependencies）**——读桩行备注与 epic 文档（Deliverables、Cross-cutting）中点名其他 sprint 的依赖。
   - 依赖已合入 → 已满足：核实目标共享条目为 `state: merged` 或 `state: closed`，且已记录落点 commit，并核对 Markdown 投影一致，然后继续。
   - 依赖未合入 → 并非阻断项；路由到裁决 4。
2. **WIP 上限（WIP limit）**——读取共享的 `reserved`、`active`、`acceptance` 条目，三者都占 WIP；只有 `merged`、`closed` 已落地。Markdown 副本不裁定准入；下文原子 reserve 强制执行存储上限。
   - 计数已达或超过 `wip_limit` → 停，点名在途 sprint；其中之一必须先 complete 或 close，本次 start 才能继续。
   - 提前启动的 sprint 就是 `active`，与其他在途 sprint 同等计入上限。
3. **提前启动（early start）**——只要还有任何 sprint 在途（共享状态为 `reserved`、`active` 或 `acceptance`）即适用——不限于本 sprint 所依赖的那些。
   - 估算文件交集：本 sprint（epic Deliverables + 桩行备注）与每个在途 sprint（其 sprint 文档）预计都会触碰的文件数量。
   - 该数量 ≈ 零 → 安全：在新文档 frontmatter 置 `early-start: true`，并把估算记入开线条目。
   - 实质重叠 → 作为 early start 不安全：等待，或把重叠部分路由到裁决 4。
4. **候补依赖（deferred dependency）**——在当前基线上视同被依赖 sprint 已合入先行实现，并以交接条款绑定未来复核。
   - 按 `templates/handover-clause.md` 在本 sprint 文档的 Handover Clauses 节登记条款——签发方是条款正文的唯一真源；其他一切工件只存引用。
   - **条款 id HC#：扫全部 sprint 文档的 Handover Clauses 节取 max+1（空集扫描从 1 起）。**
   - 目标引用按迁移规则：目标 sprint 文档已存在 → 把 HC# 追加进其 frontmatter `clauses` 列表；目标是尚无文档的未来 sprint → 在条款本身记录 `target: <epic> breakdown S#`。
   - 两个写入时机：条款正文写入现在创建的文档；目标侧 frontmatter 追加在目标文档已存在时立即发生——未来目标的引用在其自身实体化时迁移。

## 原子 WIP 预留（Atomic WIP reservation）

先读共享 status，完成全部就绪判断。创建 worktree 或文档之前，在宿主根目录运行：

```sh
node "<plugin base dir>/scripts/shared-ledger.mjs" reserve --id "<sprint-id>" --epic "<epic-id>" --document "<repo-relative-sprint-doc>" --branch "<branch>" --worktree "<absolute-planned-worktree>" --revision "<current-revision>" --operation "<unique-id>"
```

非零即停。reserve 在同一锁/CAS 动作中统计 reserved+active+acceptance 并写入，
不能用只读 wip 诊断替代。不确定结果先核对 status、沿用同一操作 ID，不二次预留。
失败启动保留槽位，不自动过期、不抢锁。仅计划路径、本地分支和登记 worktree 全部不存在时，可用 cancel-reservation 加 ID/revision/operation 显式取消未使用预留；否则恢复或报告阻碍，不取消 active。cancelled ID 保留且不复用。关联 worktree 共享状态，独立克隆不共享。
无存储必须显式 init/import，绝不回退目录扫描。

## 先读史（Read history first）

notes 是跨 sprint 的知识资产，不是流水账——写一行 plan 之前先读它：

- 在 notes 目录检索与本 epic 域 + 技术栈匹配的历史条目：以 epic 文档 Deliverables 节抽取的关键词（组件名、栈名词、失败模式）grep。
- 优先看 lessons 节点了环境坑、流程修正、回炉根因的条目——这些才是可复用的类别。
- 把相关教训摘入新文档的 Decisions (D-x) 上下文，并引用来源条目（文件 + 节）；无引用的教训是观点，有引用的才是证据。
- notes 目录为空不是错误——第一个 sprint 没有历史。言明后继续。

## 实体化 sprint 文档（Materialize the sprint doc）

动笔创建任何东西之前先预检——防重复实体化：扫 `sprints_dir`，找出 frontmatter `sprint` 等于本 id 的文档。文档存在而桩行仍是 `ready` → STOP 并点名碰撞——分叉风险（git 回滚丢了桩行翻转，或文档被带外实体化）；绝不覆盖，绝不创建第二份文档。镜像异常——桩行已是 `started` 却无文档匹配 → STOP 并揭开异常（文档丢了）；绝不静默重新实体化。

1. 共享预留成功后，创建命名载体，并以 `templates/sprint.md` 创建 `<sprints_dir>/YYYY-MM-DD-<sprint>-plan.md`。文件日期是实体化日期（今天），不是桩行的规划日期。frontmatter `{sprint, epic, state: active, worktree, early-start, deferred-dependency, clauses, acceptance-record: null, accepted-at: null, merged-commit: null}`：
   - `worktree`——承载本 sprint 的 worktree/分支（一个 sprint = 一个 worktree/分支）。
   - `early-start`——上文的裁决结果；未适用时为 `false`。
   - `deferred-dependency`——裁决 4 登记的 HC# 引用；无则留空。
   - `clauses`——以迁移进来的 HC# 引用作种子：扫全部 sprint 文档的 Handover Clauses 节，找出记录了匹配本桩行的 `target: <此 epic> breakdown S#` 的条款，把其 id 收进来——条款正文留在签发方，引用落到 sync 将要扫描的位置。没有条款瞄准本桩行则为空。
2. 按模板填满五节正文——Decisions (D-x) / Stories & Tasks / Definition of Done / Acceptance Scenarios (S1–Sn) / Handover Clauses。**DoD 自 epic 文档的 Definition of Done 逐字复制——绝不在 sprint 文档内就地改写；DoD 变更回 epic 文档以修订方式进行，再自此重新复制。**
3. 桩行状态翻转为 `started`，保留 sprint id 指针；向桩行备注追加日期 + 证据链接（新文档路径）。
4. 按四节协议写开线条目 `<notes>/YYYY-MM-DD-<sprint>-open.md`：背景（为何开这条线、做了哪些裁决）/ 决策（含理由与被否决项）/ 教训（上文摘出的历史，带引用）/ 交接（在此登记的条款、所欠义务）。

载体、sprint 文档与开线笔记存在后，用 ID/revision/operation 参数调用 `shared-ledger.mjs activate`，确认共享 active。失败/中断保留 reserved 和 WIP 槽，检查并恢复，不创建另一个 sprint。

实现或委派 worker 前，从桩行验收目标填好 sprint 的验收计划：在 `supervibe-acceptance-plan` 块记录稳定场景 ID、目标、必需操作方式/环境、顺序操作步骤与预期观察。关联 Roadmap 的独立整体场景，但不把整个 Roadmap 交付要求照搬为此 sprint 的验收范围。场景计划缺失/为空即阻塞实现。UI 场景必须操作真实运行环境中的浏览器，CI/API/静态截图不能单独满足。验收范围改变必须记录用户明确授权的修订并重新执行，不能把旧失败/替代结果改名为通过。

## 调度执行（Dispatch execution）

Agent 协作只有两条路，按 epic 确认选择（宿主 `## supervibe` 提供提议值）：`collaboration_mode: native` + `collaboration_provider: harness`，或 `external` + `orca`。缺失、不支持、不匹配或能力不可用时阻止委派；询问选择或报告缺失能力，绝不静默切换模式。SuperVibe 管契约，不自建调度器。见[协作模式](../../docs/collaboration-modes.md)。

1. 委派前检查真实能力。**原生：**使用当前 harness 已提供且有文档的 worker 创建与结果工具（需要交互时还需通信）（如 Claude Code subagent）；不发明工具名，不假设跨会话能力。**外部：**定位 Orca CLI，读取 `orca skills get orchestration` 及相关当前参考；缺 CLI/skill 就阻止此路由，不自动安装。
2. 以 stdin 向 `node <plugin-root>/scripts/collaboration-contract.mjs task` 提交任务 JSON 校验：显式模式/provider、sprint/task 身份、目标、worktree、允许路径与验收要求。将同一边界交给 worker。不隐式扩大权限、安装依赖、配置凭证或授权提交/推送。
3. 原生通过已检查工具委派，保留真实 worker/session 回执。Orca 遵循官方 `worker-start` / `send` / `check` / `inbox` 生命周期：从已校验 sprint 载体启动，通常 `--worktree current`，要求 worker 首次写入前核实 common-dir/载体；保留 `runId`、`taskId`、`dispatchId`、实际工作区及存在时的 terminal 回执。Run 是工作分组，不是 harness 会话。派发后结束回合等待事件唤醒，绝不循环调用消费式 `check`。`inbox` 是历史，不是成功证明。启动结果不确定/失败时先检查再重试；获准重试仍关联同一 task 与原 dispatch。
4. 核实实际返回工作区解析到 sprint 载体且属于同一 Git common-dir；不假设 Orca 新工作区天然属于此台账。除非用户要求隔离或存在已证实冲突，不新建 worktree；工作区不兼容则阻止委派/结果，不扩大共享范围。WIP 每 sprint 预留一次，不为每个 worker 子任务预留。
5. 收集明确的 `succeeded|failed|blocked` 结果、执行身份、证据和阻塞项。以 stdin 向 helper 的 `result` 提交 `{task, result}` 校验；验收指纹生成前，将请求/结果及回执持久化到关联 sprint 的任务交接笔记。成功必须有证据；完成事件、进程退出或 worker 自述不等于 sprint 验收通过。失败/阻塞交回负责人；验收仍由 `supervibe:accept` 拥有。运行状态仍留在已有本地 common-dir 台账。

### 执行方法（不是协作 provider）

- 探测 `superpowers:brainstorming` 与 `superpowers:writing-plans` 是否可调用；可用则依次调用，在任一选定协作路由中填充已实体化的文档。
- **五节结构与逐字 DoD 不可变。**执行方法层只扩展脚手架，不替换它。
- 没有 superpowers 时打印手动指令：把 epic Deliverables 分解进 Stories & Tasks，保持逐字 DoD，review 前写明 Acceptance Scenarios (S1–Sn)。方法降级不允许改变已配置的协作模式。
- 支持状态：仅契约与 fixture 覆盖；这些检查不代表真实原生 harness 或 Orca 端到端集成已通过。

## Invariants（不变量）

- 本技能拥有共享 reserve 与 reserved → active 激活，外加 ready 桩行 → started 和 active Markdown 投影。绝不 planned→ready（roadmap），绝不 acceptance/merged/closed（accept/complete/roadmap），绝不做条款兑现（sync）。
- 绝不经由其他路径实体化 sprint 文档——`sprints/` 文档只来自 `ready` 桩行。
- DoD 永远逐字——epic 文档是其唯一归宿。
- HC# id 绝不复用：扫全部 sprint 文档的 Handover Clauses 节取 max+1；空集扫描从 1 起。
- 条款正文只活在签发方 sprint 文档；其他一切工件只存引用。
- sprint 文档与其开线条目在同一动作里写出——没有开线条目的实体化 sprint 是不完整的。
- 每次变更——桩行翻转、文档创建、条款登记、迁移引用——都携带日期 + 证据链接。
