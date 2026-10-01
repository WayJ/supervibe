---
name: roadmap
description: 管理战略 roadmap —— 为仓库 scaffold 接入 supervibe、添加带 Definition of Done 的 epic、记录 ADR 决策、管理开放问题、资产处置与技术债条目。当用户提到 roadmap、epic、ADR、tech debt 或为项目接入 supervibe 时使用。
argument-hint: [scaffold|epic|adr|question|asset|debt|ready|close]
---

# supervibe:roadmap — 战略真源

掌管 `roadmap.md` 的全部内容，以及宿主 AGENTS.md 的 `## supervibe` 节。`roadmap.md` 含六个元素：Epic 表、Sprint 台账（Sprint Ledger）、ADR 表、资产处置（Asset Disposition）、开放问题（Open Questions）、横切关注（Cross-cutting）。术语刻意对齐 Scrum：epic / sprint / DoD（Definition of Done）/ story；sprint 是价值盒——由 DoD 收口，绝非时间盒。`roadmap.md` 内的 Sprint 台账是权威状态存放处：每行为 `{sprint id、epic 引用、状态、worktree/分支、early-start 标记、deferred-dependency 引用、在途 handover-clause id、合并 commit hash}`，状态 `planned → ready → active → acceptance → merged → closed`；plan 文档头部只带人类可读副本，绝不反向。零栈假设：gate 命令与 doc-sync 映射都在宿主 AGENTS.md——绝不硬编码任何一条。

按子命令参数（`scaffold|epic|adr|question|asset|debt|ready|close`）分派。参数缺失或无法识别时，列出子命令并询问。下文所有文件路径均取自宿主配置，而非对宿主仓库布局的臆测。

## 先读宿主配置（Read host config first）

任何子命令之前，先在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 配置键：`roadmap`、`notes`、`plans`、`acceptance`、`debt_tracker`、`wip_limit`；子节 `### gates` 与 `### doc_sync_map`。
- 键缺失时的默认值：`roadmap: docs/roadmap.md`、`notes: .agents/notes/`、`plans: docs/plans/`、`acceptance: docs/acceptance/`、`debt_tracker: docs/tech-debt-tracker.md`、`wip_limit: 3`。
- 若该节整体缺失，唯一合法的下一步是 `scaffold` 子命令——其余一律拒绝，并向用户言明。
- 该节确认存在后，解析配置的 `roadmap` 路径并核实文件存在。缺失 → STOP：指引用户运行 `scaffold` 或修正配置路径；绝不在 `scaffold` 之外隐式创建 roadmap.md——配置路径笔误绝不能静默分叉真源。
- 模板按 `<plugin base dir>/templates/<file>` 解析；绝不假设它们在宿主仓库里。
- gate 命令从 `### gates` 读取；绝不发明命令、runner 或栈细节。
- 任何触碰映射路径的编辑之前先查 `### doc_sync_map`。若映射表列出了 `roadmap.md` 本身，以映射表为准——「本技能写出的工件本身即文档、不欠进一步 doc-sync」的豁免仅适用于映射表未覆盖的路径。

## scaffold

为仓库接入 supervibe：

1. 以 `templates/roadmap.md` 创建 `roadmap.md`（配置路径，默认 `docs/roadmap.md`）——六元素各保留一行示例。
2. 把 `templates/agents-sections.md` 拼接进 AGENTS.md，作为 `## supervibe` 节。
3. 创建 notes 目录（默认 `.agents/notes/`）。

**幂等，按工件分别判定：已存在的文件/节保持不动并产出 diff 提案；缺失的正常创建。** 已存在的 `roadmap.md` 或 AGENTS.md `## supervibe` 节，打印 scaffold 将要新增内容的 diff 请用户手动应用；已存在的 notes 目录保持原样。

若 AGENTS.md 尚不存在，则创建它，内容仅为拼接进来的这一节。

## epic

向 Epic 表追加行：id、窗口、核心交付、DoD、状态。

- **缺 DoD 即拒绝**——没有 Definition of Done 的 epic 无效；停下并向用户索要。
- DoD 逐字复制进该行。此行是 sprint plan 逐字复制的源头；后续改动在此处以修订方式进行，绝不在 plan 内改。
- epic 拆分为多个 sprint（如并行波次）时，每个 sprint 在 Sprint 台账追加一行、状态 `planned`——不要撑大 epic 行本身。

## adr

向 ADR 表追加编号行：id、决策、理由；决策后续变化时追加修订行。

- **强制 doc-before-code：决策文本必须在实现开始之前写入 `roadmap.md`。** 若实现已经启动，现在补记 ADR，标注 retroactive，并点破纪律违例。
- 关联该决策了结的开放问题或债务条目。
- 每次 ADR 变更：追加日期 + 证据链接。

## question

管理开放问题的生命周期：open → closed / deferred。

- 以 id 与一行陈述开启。不编号的问题会腐烂；被追踪的才会关闭——一切皆入行。
- close 或 defer 必须带决策记录链接：ADR id、notes 条目或证据 commit。
- 重开 = 追加引用旧行的新行；绝不改写历史。

## asset

更新继承资产的处置（Asset Disposition）。处置取值：reuse / retire / re-order / watch。

- 记录改了什么、为什么——这张表的存在就是为了阻断「计划复用」与「实际复用」之间的静默漂移。
- 每次变更：追加日期 + 证据链接。
- 没有归属 epic 的 `watch` 资产是坏味道——路由到一个 epic，或开一个开放问题。

## debt

- 按 `templates/debt-entry.md` 向债务追踪器追加条目：severity、owner、清偿标准（repayment criteria）。缺清偿标准的条目无效。
- 若债务追踪器文件不存在，按 `templates/debt-entry.md` 的行格式表头创建它——`scaffold` 不创建此文件。
- 清偿（repay）：引用证据 commit hash 关闭条目——无 hash，不关闭。
- 观察项（尚无修复决策的症状）路由到归属 epic；它们挂在那个 epic 的 DoD 上，不进追踪器的积压。

## ready / close

本技能只拥有 Sprint 台账的两个转换；其余一律拒绝（`ready→active` 归 supervibe:start，`→acceptance` 归 supervibe:accept，`→merged` 归 supervibe:merge）。台账中没有匹配给定 sprint id 的行 → 拒绝，并言明哪个 sprint id 未知。

- **planned → ready** —— go 决策是战略性的。核实 epic 引用指向一个带 DoD 的 epic，然后把决策记入台账行。细粒度就绪裁决（依赖、WIP 计数、early start、deferred dependency）发生在 ready→active，归 supervibe:start。
- **→ closed** —— 仅当该 sprint 的 handover clause 全部兑现（discharged）或从未登记。兑现条款归 supervibe:sync；此处核实台账行不存在在途 handover-clause id、且合并 commit hash 已记录。任一核实不通过 → 拒绝并言明缺什么。

## Invariants（不变量）

本技能的每次变更——epic、ADR、question、asset、debt、台账——都在受影响行追加日期 + 证据链接。不做静默编辑，不做删除：`roadmap.md` 是追加式历史。
