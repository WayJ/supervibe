---
name: accept
description: 当用户要求 accept、review 或 verify 一个 sprint，或询问某个 sprint 是否已完成时使用。
argument-hint: <sprint-id or plan path>
---

# supervibe:accept — sprint 评审门禁（sprint review gate）

sprint 评审门禁：把每条验收场景真跑一遍，逐项以证据核对 DoD，逐字留痕障碍，审计文档漂移——然后写出验收记录并给出裁决。裁决是关于「观察到的行为」的断言，本技能的纪律是**证据先于断言**：任何东西不因预期、记忆或上一次运行而通过。「这个 sprint 做完了吗？」享受同等待遇——答案是裁决，由新鲜证据背书，绝非观点。

这里是执行层的断言与战略层的标准碰面的检查点：本技能的 pass 正是解锁 `supervibe:complete` 的东西。零栈假设：证明命令来自场景正文与宿主 `### gates` 配置——绝不发明；一切路径取自宿主配置，绝不硬编码。

## 共享运行权威（Shared runtime authority）

读取 `<plugin base dir>/docs/shared-ledger.md`。在宿主仓库根目录运行
`node "<plugin base dir>/scripts/shared-ledger.mjs" status`，将目标 sprint 与
共享条目核对。common-dir 存储而非 Markdown 拥有运行状态和 WIP；下文的
frontmatter 检查均是投影检查。无存储就停止，显式 init/import。用 doctor
诊断载体或投影漂移，不从分支副本静默恢复权威。下文每个变更均传入
`--id <sprint-id> --revision <当前版本> --operation <唯一操作 ID>`；新动作
先重读 status，不确定结果的同请求重试沿用同 ID。绝不手改存储。


## 输入（Inputs）

任何动作之前，先在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 本技能读取的配置键：`sprints_dir`、`acceptances_dir`、`notes`；子节 `### gates` 与 `### doc_sync_map`。
- 键缺失时的默认值：`sprints_dir: docs/superpowers/sprints/`、`acceptances_dir: docs/superpowers/acceptances/`、`notes: .agents/notes/`。
- 该节整体缺失 → STOP：唯一合法的下一步是 `supervibe:roadmap scaffold`——指引过去，其余一律拒绝。
- 该节确认存在后，解析本技能涉及的已配置目录（`sprints_dir`、`acceptances_dir`、`notes`）并核实其存在。缺失 → STOP：指引用户运行 scaffold 或修正配置路径；绝不隐式创建工件——配置路径笔误绝不能静默分叉真源。
- 模板按 `<plugin base dir>/templates/acceptance-record.md` 解析；绝不假设它在宿主仓库里。
- `### gates` 是命令来源，不是整张必跑清单：场景点名某个 gate 时，按配置原样运行该命令；绝不发明命令、runner 或栈细节。
- 写验收记录之前先查 `### doc_sync_map`：若映射表覆盖了本技能写的工件路径，以映射表为准——「本技能写出的工件不欠进一步 doc-sync」的豁免仅适用于未覆盖的路径。

然后解析受审的 sprint：

- 参数：sprint id 或 sprint 文档直接路径。缺失 → 询问，并列出 `sprints_dir` 中 frontmatter `state` 为 `active` 或 `acceptance` 的文档备选；绝不猜测。
- sprint id → 扫 `sprints_dir` 内全部文档找 frontmatter `sprint` 匹配。没有匹配 → 拒绝，言明未知的 sprint id。直接路径 → 文件必须存在且带 `sprint` frontmatter 字段；否则拒绝，点名该路径。
- 状态前置：`active` 或 `acceptance` → 继续，但必须**完整重新验收**，绝不复用旧场景裁决。`merged` / `closed` → 拒绝：已过此门禁。状态未知或缺失 → 拒绝。
- **每次**评审前，先用 ID/revision/operation 参数调用 `shared-ledger.mjs review-begin`，清空共享证据并置共享 active。再投影 `state: active`、追加带日期重验说明，保留旧记录作为历史。这样先撤销旧 pass，再运行任何命令；中断不能留下仍可用的旧裁决。绝不改写旧记录。

## 将证据绑定到受审树（Bind evidence to the reviewed tree）

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

本技能的周期 doc-sync 检查点——与 complete 的欠账终检相对应：

- 枚举本 sprint 的变更路径：sprint 文档 frontmatter `worktree` 记载的分支对其 base——即与 main 线的 merge-base——的 diff，加上文档 Stories & Tasks 点名的路径。
- 对宿主 `### doc_sync_map` 的每一行：该行的 change 模式是否命中任一变更路径？命中 → 打开映射文档，核对它反映了该变更。未命中 → 该行本 sprint 不欠什么。
- 映射缺失或为空即干净审计——记录「未配置任何行」；绝不发明行。
- 在记录中发出漂移报告节：逐行——命中路径、映射文档状态（current / drifted）、漂移细节。
- 被触发行上的漂移就是 doc-sync 欠账：要么当场指引修复并复审，要么裁决如实承载它——pass 不能载着本 sprint 触发行上的未偿漂移。

## 裁决与记录（Verdict + record）

以 `templates/acceptance-record.md` 写 `<acceptances_dir>/YYYY-MM-DD-<sprint>-acceptance.md`；日期是今天，即验收运行日。记录至少携带：场景结果表、带证据的 DoD 清单、逐字障碍日志、漂移报告、裁决，以及**门禁证据块（gate-evidence block）**——运行时的分支 tip hash、按原样跑过的 gates 清单（逐条已运行的配置 gate 命令）、其绿的输出。该块正是 complete 阶段 1 短路所用的机械钥匙，条件恰好是 tip 与清单未变；没有它，complete 全量重跑。记录只增不改——同日重跑绝不覆盖既有记录，改用区分性后缀（`-2`、`-3`、……）；`acceptance-record` 指针指向最新完成的尝试；只有 acceptance 状态下的 pass 才可授权收口。

- **pass** 需要全部满足：每条场景以新鲜证据或已标注的替代通过；每项 DoD 有证据核对；被触发行上无未偿漂移。任一不满足 → **blocked**，点名阻断项。
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
