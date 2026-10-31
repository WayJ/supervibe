---
name: accept
description: 当用户要求 accept、review 或 verify 一个 sprint 或 roadmap，或询问迭代是否已完成时使用。
argument-hint: <sprint-id or plan path> | roadmap <epic-id or path>
---

# supervibe:accept — sprint 评审门禁（sprint review gate）

sprint 评审门禁：把每条验收场景真跑一遍，逐项以证据核对 DoD，逐字留痕障碍，审计文档漂移——然后写出验收记录并给出裁决。裁决是关于「观察到的行为」的断言，本技能的纪律是**证据先于断言**：任何东西不因预期、记忆或上一次运行而通过。「这个 sprint 做完了吗？」享受同等待遇——答案是裁决，由新鲜证据背书，绝非观点。

这里是执行层的断言与战略层的标准碰面的检查点：本技能的 pass 正是解锁 `supervibe:complete` 的东西。零栈假设：证明命令来自场景正文与宿主 `### gates` 配置——绝不发明；一切路径取自宿主配置，绝不硬编码。

## 验收归属与每次唤醒自检

Sprint 或 Roadmap 验收前读取 epic 已确认的 `independentAcceptance`。缺失/未确认即阻塞，先经既有配置 revision/CAS 流程取得用户确认。协调者就是当前主 Agent，不另起协调 Agent。`false` 由主 Agent 验收，不虚构 worker ID；`true` 在同一 `maxWorkers` 上限内派独立验收 worker。上限为 1 时，先核实开发结束并释放名额，再顺序验收。主 Agent 仍负责最终证据复核与门禁。可用相同 harness；派发时由用户在已有允许集合中选择（原生继承）。

独立验收必须有不同于该候选版本所有开发者的真实执行身份：原生 worker ID 或真实回执支持的 Orca 持久 worker/session 身份。同一 terminal/session 的新 dispatch 不算独立。身份或开发来源不全时阻塞并上报，不虚构 ID，不复用开发成功结果。

**每次唤醒/恢复**，验收执行者在跑场景前必须自检并记录：当前候选版本/build/上下文；目标环境运行、归属、可用性及需稳定时无冲突修改；场景所需 browser/CLI/API 能力；测试账号及授权；测试数据；证据采集。要求依据事前场景，纯 CLI 验收不强制浏览器；不适用必须写明场景依据。必需条件缺失/未知就 blocked 并列具体阻塞。代码/build/环境/上下文变化即就绪失效并重新检查，不沿用上一唤醒假设。主 Agent 验收同样自检，但不虚构 worker ID。

独立 Sprint 或 Roadmap worker 执行前，通过 `collaboration-contract.mjs acceptance-wake` 及台账 CAS 登记新的 `acceptanceContext`，再校验绑定角色的结果及结构化 `preflight`；精确字段见所链契约。两种 worker 范围均有唤醒/preflight 契约校验；主 Agent 就绪仍是技能义务，不需要 worker 身份。

自检与身份来源随验收结果留存，并绑定本次唤醒与候选版本；开发证据不能升级成独立验收。不得自动安装/登录/刷新凭证/修改容器或测试数据，也不得声称持有资源锁，须有真实能力与授权。本实现没有资源管理器。必需真实操作不能替换为静态/CI/API 检查。参见[协作契约](../../docs/collaboration-modes.md)；校验仅为 contract-only，不证明真实 backend/环境已执行。

Sprint 验收选择 `independentAcceptance: true` 时，验收记录必须包含恰好一个 `supervibe-acceptance-execution` fenced JSON 块 `{task, result}`。`verify`/`verify-clean` 门禁绑定实际 Sprint ID、共享 epic/文档、当前候选版本、策略、最新唤醒、独立身份和就绪；开发成功或另一个 Sprint 的回执不能替代。缺失策略时主 Agent 与独立验收路径均阻塞。


必需场景声明 `resourceGroups` 时，真实操作前先取得并检查实际资源声明，核实主机/环境就绪及独占归属，再冻结当前候选版本开始验收。遵循 `docs/resources.md` 与 resource-policy 契约，在恰好一个 `supervibe-resource-execution` fenced 块中记录真实声明凭据。Sprint 与 Roadmap 门禁都对主 Agent/独立 worker 强制校验；主 Agent 使用 role main，不虚构 worker ID。缺失、未知或冲突即阻塞，不能重置共享容器、端口、数据或账号凭据绕过准入。这是协作约定，不是操作系统沙箱，也不证明进程存活。


## Roadmap 最终集成验收分流

Roadmap 的 doc-sync 使用规划记录明确的迭代起点 commit 作为 `--base`，集成 main 的实际 HEAD 作为 `--tip`；不得把 main 对自身的空 diff 当整体审计。起点不明时先澄清并记录，不猜测范围。

`accept roadmap <epic-id 或路径>` 审查 epic 计划中 Overall Acceptance Scenarios，不是某个 Sprint。解析 roadmaps_dir/acceptances_dir，读取共享账本 mainRef，并核对全部 Breakdown ID 都有同 epic 的 merged/closed 条目。不调用 sprint review-begin/review-pass、不改变 Sprint 状态、不复用旧裁决。

每次最终验收或重验，在任何场景开始前先撤销旧 pass：置 status: open、final-acceptance-record: null、final-accepted-at: null。旧记录保留历史，失败或中断后绝不恢复旧指针。在既有授权下将撤销与准备输入提交；没有授权则在验收前停止。

验收前准备全部笔记与计划修订，在既有授权下提交集成输入和前置计划。基于 `templates/roadmap-acceptance-record.md` 创建新记录；在当前集成主线候选上，于实际场景、DoD、漂移核对前后分别运行 `validate-workflow.mjs roadmap-snapshot --epic "<epic-doc>" --record "<new-record>" --main-ref "<stored-mainRef>"`，要求输出一致。下述真实执行、必需证据、禁止替代、障碍规则同样适用，scope 改为 roadmap。验收前 JSON 放入 supervibe-evidence，结果放 supervibe-acceptance-results，candidate 为该指纹。必须重新做集成测试，不能汇总旧 Sprint 记录充数。能力/证据缺失即 blocked。

写只增不改的 pass/blocked 记录，只设置 epic 的 final-acceptance-record 与 final-accepted-at（快照后不追加正文）。pass 后以同样参数运行 roadmap-verify；失败禁止关闭。blocked 保留 epic open，不恢复旧 pass。后续 closed 由 roadmap 管理。下面 Sprint 专用分流、共享转换与 frontmatter 指令不适用于本分流。

若 `independentAcceptance` 为 true，Roadmap 验收任务使用 `scope: "roadmap"`、`epic`、`epicDocument`，不填 `sprint`，worktree 为配置 main 分支的真实载体。`acceptanceContext.candidate` 绑定集成 `roadmap-snapshot`；每次唤醒/恢复通过 `acceptance-wake` 登记。无需 active Sprint 或新增 Sprint WIP 预留。最终记录必须嵌入恰好一个 `supervibe-acceptance-execution` fenced JSON 块 `{task, result}`。`roadmap-verify` 校验当前策略、候选版本、最新唤醒、不同执行者与就绪。为 false 时，主 Agent 验收不要求 worker ID 或此 worker execution 块。契约校验不证明真实执行。

## 共享运行权威（Shared runtime authority）

读取 `<plugin base dir>/docs/shared-ledger.md`。在宿主仓库根目录运行
`node "<plugin base dir>/scripts/shared-ledger.mjs" status`，将目标 sprint 与
共享条目核对。common-dir 存储而非 Markdown 拥有运行状态和 WIP；下文的
frontmatter 检查均是投影检查。无存储就停止，显式 init/import。用 doctor
诊断载体或投影漂移，不从分支副本静默恢复权威。下文每个变更均传入
`--id <sprint-id> --revision <当前版本> --operation <唯一操作 ID>`；新动作
先重读 status，不确定结果的同请求重试沿用同 ID。绝不手改存储。


## 输入（Inputs）

在宿主仓库根目录运行 `node "<plugin base dir>/scripts/host-config.mjs" --require-dir sprints_dir --require-dir acceptances_dir --require-dir notes`，使用返回的路径、WIP、原序原样 gates 与映射；非零即停止并展示错误，缺配置/目录仅显式 scaffold 或修正，不自行建目录。roadmap 的 scaffold 可先处理缺配置，其他子命令用 `--require-dir <涉及的目录键>` 验证目录。模板始终从插件目录读取。规则与默认值见[机械预检](../../docs/mechanical-preflight.md)，不再手工 grep/补默认。映射同样约束本技能写出的工件。 只运行场景点名的 gate；脚本不运行命令。

然后解析受审的 sprint：

- 参数：sprint id 或 sprint 文档直接路径（先在 inventory 输出匹配精确文档，再使用唯一 ID）。缺失 → 询问，并列出 `sprints_dir` 中 frontmatter `state` 为 `active` 或 `acceptance` 的文档备选；绝不猜测。
- 通过 `artifact-inventory.mjs --sprint "<sprint-id>"` 的唯一 `selection` 解析身份；非零报告 `issues`，不重新手工扫描。
- 状态前置：`active` 或 `acceptance` → 继续，但必须**完整重新验收**，绝不复用旧场景裁决。`merged` / `closed` → 拒绝：已过此门禁。状态未知或缺失 → 拒绝。
- **每次**评审前，先用 ID/revision/operation 参数调用 `shared-ledger.mjs review-begin`，清空共享证据并置共享 active。再投影 `state: active`、追加带日期重验说明，保留旧记录作为历史。这样先撤销旧 pass，再运行任何命令；中断不能留下仍可用的旧裁决。绝不改写旧记录。

## 将证据绑定到受审树（Bind evidence to the reviewed tree）

在初始快照之前，确认源码与所欠文档已经按授权同提交落入当前分支。未获提交授权则暂停并说明；不得为过检擅自提交或改写历史。验收记录/元数据可在验收之后提交，不能用未提交源码满足 doc-sync。

在宿主仓库根目录，先选择尚不存在的新验收记录路径（重跑加后缀），再运行：

```sh
node "<plugin base dir>/scripts/validate-workflow.mjs" snapshot --sprint "<sprint-doc>" --record "<new-acceptance-record>"
```

两个路径都相对于仓库根目录。验证期间禁止并发写者；前后相等不是原子锁。无关仓库编辑也使这一刻意保守的指纹失效。frontmatter 只支持随包模板的单行键值，多行值失败关闭。输出 JSON 留在内存或宿主仓库外（如 `/tmp`），绝不写成宿主内新的未忽略文件，作为**验收前快照**。所有场景、DoD 与漂移检查完成后，用相同命令再取快照；只有 JSON 逐字节一致才可给 pass。指纹变化说明受审输入已变：停止，保留 blocked 记录，针对新树从头验收。绝不事后取一份新快照贴到旧结果上。

快照包含 Git 跟踪文件与未被忽略的未跟踪文件的路径、模式和内容；只排除**这一个新记录的精确路径**，且只归一化该 sprint 的 `state`、`acceptance-record`、`accepted-at` frontmatter 字段。DoD、场景、源码、配置、其他记录与 notes 都仍被覆盖。笔记和绕行先写好再做最终验收，若验收中写入则须重验。精确记录排除避免自引用；仅提交证据/台账不会让指纹失效。忽略的构建产物、数据库、部署服务与外部环境状态不在指纹内，仍必须在真实环境新鲜验证。未解决的 Git 索引冲突或子模块不受支持，按失败关闭处理。此检查证明来源一致性，不证明测试实际运行。

## 执行验收场景（Execute scenarios）

读 sprint 文档的 `## Acceptance Scenarios (S1–Sn)` 节。每条场景按其正文指定的方式真跑——浏览器、CLI、栈命令。场景是一个要做的观察，不是一个要打勾的框。

动跑任何东西之前先拒绝畸形文档：Acceptance Scenarios 节缺失或为空 → 拒绝，点名畸形的 sprint 文档——零场景绝不能产出空洞的 pass。`## Definition of Done` 节缺失或为空 → 同样拒绝；DoD 逐字活在 epic 文档里——指引去那里修，绝不在 sprint 文档内打补丁。

在 sprint 自己的环境里跑——即 sprint 文档 frontmatter `worktree` 记载的 worktree/分支、其栈处于存活状态——而不是别处的一套陈旧构建：对着昨天的工件跑出的证明不是证据。

**证据先于断言——绝不在没有新鲜运行的情况下宣称通过**（显式纪律模式，改编自 superpowers 的 verification-before-completion——没有新鲜验证证据就没有完成断言）：

1. 认出证明命令——其完整输出能证明场景预期观察的那一条。
2. 运行它——真跑、现在跑、在 sprint 自己的环境里跑。
3. 读完整输出——不只看退出码，不只看第一行。
4. 然后才断言——并引用：记录的结果表逐场景携带证明命令、结果与证据（输出摘录或工件路径）。

「应该会过」、上一次运行、部分检查、作者的信心——都不是证据。根本无法运行的场景记为 not-run 并附原因——绝不静默跳过，绝不计为通过。

场景正文容许两种读法时，跑更严格的那一种——评审门禁从不因宽容解读而受益。

遇障碍——命令失败、环境阻塞、输出与预期相悖——先检索 notes 目录的历史绕行：按障碍关键词（报错串、工具名、失败模式）grep。命中 → 复用该绕行并在记录中引用来源条目（文件 + 节）。未命中 → 即兴出最窄的绕行，并逐字记入障碍日志。notes 目录为空不是错误——第一个 sprint 没有历史；言明后继续。

## 必需场景合约与真实用户操作

开始执行前先校验计划块；缺失或畸形即阻断，不等到结束才发现。Sprint 计划阶段就必须在文档唯一的 `supervibe-acceptance-plan` JSON 围栏中定义场景（见模板），其 ID、目标、步骤和预期与人工可读场景表一致。epic 通用 DoD 是每个 Sprint 的质量基线，不是整体 Roadmap 结果；单个 Sprint 通过不证明最终集成达标。

UI 场景必须针对当前构建在真实浏览器操作：打开入口、输入、点击/导航/提交，并按计划核对可见与持久化结果。记录实际步骤、预期与观察、环境、部署构建/版本、测试角色/数据、时间、证据引用和阻塞。CI 绿灯、API 探测、静态截图、worker 自报成功不能替代必需的浏览器操作。核对证据内容，不只文件名。缺少浏览器、凭据或环境即 blocked/not-run，不能 pass，也不隐式授权安装工具或获取权限。

验收记录恰好一个 `supervibe-acceptance-results` 块：schema 1、scope sprint、candidate 等于验收前指纹、真实环境说明，以及覆盖全部计划 ID 的结果。必需结果必须 passed，方式/环境匹配，包含实际步骤、预期/观察、证据且无阻塞。`validate-workflow.mjs verify` 只验证结构/覆盖/来源，不证明真实操作发生；评审者仍须核实真实性。旧记录缺少合约必须重新验收，不能伪造补填。

已标注的替代只是诊断证据，不能满足必需要求，尤其浏览器/真实环境要求。改变范围必须先取得用户明确授权，在计划中记录来源/日期/理由的修订，再重新取快照并完整新鲜验收。保留旧 blocked 尝试，不能追溯改绿；验收阶段不能自行降低标准。

## DoD 清单（DoD checklist）

读 sprint 文档的 `## Definition of Done` 节。逐项以证据核对——场景结果覆盖处用场景结果，未覆盖处跑新的证明命令。

- 本技能只核对（CHECK）DoD，绝不改写它：DoD 自 epic 文档逐字复制，DoD 变更回 epic 文档以修订方式进行，绝不在 sprint 文档内改。某项失败或缺证据 → 阻断裁决——绝不经由改写清单来解决。
- 已被失败场景覆盖的条目保持失败——换个更友好的角度重新证明属于替代，须照此标注。
- 替代证据（substituted evidence）——与条目或场景指定不同的证明（指定浏览器检查却用了 CLI 输出、指定真实数据却用了 fixture）——必须在清单与结果表中标注为替代并附原因。未标注的替代就是 greenwashing。
- 替代有硬边界：绝不延伸到发明 gate 命令——场景点名的 gate 在 `### gates` 下没有配置命令时，该场景记为 not-run，并指引用户修正配置；也绝不涵盖为未指定 runner 的场景自选 runner——该场景同样记为 not-run，正文未指定运行方式。

## 障碍日志（Obstacles log）

每个阻塞、绕行、替代都按实际发生逐字记录——运行期间追加进记录的障碍节，而非事后重构。禁止美化（no greenwashing）：不用软化措辞（「基本能用」），不丢弃失败，不让障碍只活在记忆里。

每条记录携带确切的命令行与其观察到的输出——无法重放的绕行不可复用。

- 自 notes 历史复用的绕行引用其来源条目。
- 此处即兴、史上无命中的绕行，按四节协议补记 notes 条目（障碍绕行是关键节点——发生时就记），并回引验收记录：下一个 sprint 的障碍检索从此起步。

## 文档漂移审计（Doc-drift audit）

在 sprint 载体运行 `node "<plugin base dir>/scripts/doc-sync.mjs" --base "<stored-mainRef>" --tip HEAD --epic-document "<epic-doc>" --task-path "<explicit-task-path>"`（每个 Stories & Tasks 明确路径重复 `--task-path`，无路径则省略）。采用返回的匹配/欠账报告，非零不得宣称通过；禁止从自然语言猜路径。对每项被触发映射仍须人工打开文档，判断语义是否反映变更，在记录中写 current/drifted 与证据。脚本只证明路径和提交共现，不证明内容正确；漂移不能 pass。

## 裁决与记录（Verdict + record）

以 `templates/acceptance-record.md` 写 `<acceptances_dir>/YYYY-MM-DD-<sprint>-acceptance.md`；日期是今天，即验收运行日。记录至少携带：场景结果表、带证据的 DoD 清单、逐字障碍日志、漂移报告、裁决，以及**门禁证据块（gate-evidence block）**——运行时的分支 tip hash、按原样跑过的 gates 清单（逐条已运行的配置 gate 命令）、其绿的输出。该块正是 complete 阶段 1 短路所用的机械钥匙，条件恰好是 tip 与清单未变；没有它，complete 全量重跑。记录只增不改——同日重跑绝不覆盖既有记录，改用区分性后缀（`-2`、`-3`、……）；`acceptance-record` 指针指向最新完成的尝试；只有 acceptance 状态下的 pass 才可授权收口。

- **pass** 需要全部满足：每条必需场景以指定方式和环境下的新鲜证据通过（非 substituted 或 not-run）；每项 DoD 有证据核对；被触发行上无未偿漂移。任一不满足 → **blocked**，点名阻断项。
- 每份完成的记录必须包含恰好一个 `supervibe-evidence` 围栏块，内放验收前 JSON（schema、sprint、record、fingerprint）。只有验收后快照未变，才可支撑 pass。
- pass → 先写记录，再临时置 sprint frontmatter `state: acceptance`、`acceptance-record: <record-path>`、`accepted-at: <ISO 日期时间>`，以这两个字段作为带日期的证据链接（快照后不再追加正文）。记录必须先于状态翻转存在。报告可用 pass 前，用同一校验器运行 `verify --sprint "<sprint-doc>" --record "<record-path>"`；失败即阻断收口。先提交全部受审内容、临时投影与新记录，再用 ID/revision/operation 参数调用 `shared-ledger.mjs review-pass`；它要求载体 verify-clean，通过后存受验 commit/tree，才授予共享 acceptance。成功前，Markdown acceptance 只是临时投影，不授权合并。
- blocked → 保留新记录，置 `state: active`、`acceptance-record: <new-blocked-record>`、`accepted-at: <ISO 日期时间>`，记下本次尝试。指针指向最新尝试，不保证是 pass。用 ID/revision/operation 参数调用 `shared-ledger.mjs review-blocked` 记录尝试，共享状态仍 active。绝不恢复旧 pass。回执行层清理问题后再验收，每次写独立记录。

记录是后续环节的证据锚点：complete 的收口条目回引它——记录与收口条目互相引用。而最便宜的收口就是同一会话：pass 之后立即跑 `supervibe:complete`——漂移窗口更小、门禁证据更新鲜，但仍必须校验指纹。

## Invariants（不变量）

- 本技能拥有共享评审转换（Markdown 字段只是投影）：重验前 `acceptance → active`，以及新鲜、绑定受审树的 pass 之后 `active → acceptance`。绝不 `merged`/`closed`（complete/roadmap），绝不做条款兑现（sync），绝不碰桩行状态（roadmap/start）。
- 本技能只改 sprint 的评审状态、`acceptance-record`、`accepted-at` 与带日期审计说明——场景、DoD、story、条款都是受审的输入，绝不是为凑 pass 而改写的目标。
- 证据先于断言，每条场景、每项 DoD、每次运行——没有新鲜运行的 pass 不是 pass。
- 验收记录只增不改；历史绝不重写、绝不美化。
- 任何对未知 sprint id 的引用 → 拒绝并点名。
- 每次变更——状态翻转——都携带日期 + 证据链接。
