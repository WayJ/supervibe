---
name: roadmap
description: 当用户提到 roadmap、epic、ADR 决策、开放问题、资产处置、技术债，或要把项目接入 supervibe 时使用。
argument-hint: [scaffold|epic|breakdown|adr|question|asset|debt|ready|close]
---

# supervibe:roadmap — 战略真源

掌管日期化工件树的 supervibe 侧——`roadmaps/`（每 epic 一档 `YYYY-MM-DD-<epic>.md`）、`sprints/`（每 sprint 一档 `YYYY-MM-DD-<sprint>-plan.md`）、`acceptances/`（默认根 `docs/superpowers/`，与 superpowers 执行域的 `specs/`、`plans/` 同根为邻），外加宿主 AGENTS.md 的 `## supervibe` 节。**没有中心索引文件**：状态存于各文档 frontmatter，id 由目录扫描产生，聚合即对树扫描——零静默分叉面。术语刻意对齐 Scrum：epic / sprint / DoD（Definition of Done）/ story；sprint 是价值盒——由 DoD 收口，绝非时间盒。sprint 状态分两段存放：pre-start（`planned` / `ready`）只活在 epic 文档的 Sprint Breakdown 桩行里；`active` 起存于 sprint 文档 frontmatter。零栈假设：路径、gate 命令与 doc-sync 映射都在宿主 AGENTS.md——绝不硬编码任何一条。

按子命令参数（`scaffold|epic|breakdown|adr|question|asset|debt|ready|close`）分派。参数缺失或无法识别时，列出子命令并询问。下文所有路径均取自宿主配置，而非对宿主仓库布局的臆测。

## 先读宿主配置（Read host config first）

任何子命令之前，先在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 配置键：`roadmaps_dir`、`sprints_dir`、`acceptances_dir`、`notes`、`debt_tracker`、`wip_limit`；子节 `### gates` 与 `### doc_sync_map`。
- 键缺失时的默认值：`roadmaps_dir: docs/superpowers/roadmaps/`、`sprints_dir: docs/superpowers/sprints/`、`acceptances_dir: docs/superpowers/acceptances/`、`notes: .agents/notes/`、`debt_tracker: docs/tech-debt-tracker.md`、`wip_limit: 3`。
- 若该节整体缺失，唯一合法的下一步是 `scaffold`——其余一律拒绝，并向用户言明。
- 该节确认存在后，解析本子命令涉及的已配置目录并核实其存在。缺失 → STOP：指引用户运行 `scaffold` 或修正配置路径；绝不在 `scaffold` 之外隐式创建工件——配置路径笔误绝不能静默分叉真源。
- 模板按 `<plugin base dir>/templates/<file>` 解析；绝不假设它们在宿主仓库里。
- gate 命令从 `### gates` 读取；绝不发明命令、runner 或栈细节。
- 任何触碰映射路径的编辑之前先查 `### doc_sync_map`。若映射表覆盖了本技能写的工件路径（epic 文档、sprint 文档、债务追踪器），以映射表为准——「本技能写出的工件本身即文档、不欠进一步 doc-sync」的豁免仅适用于映射表未覆盖的路径。

## scaffold

为仓库接入 supervibe：

1. 按配置路径创建三个工件目录：`roadmaps_dir`、`sprints_dir`、`acceptances_dir`。
2. 把 `templates/agents-sections.md` 拼接进 AGENTS.md，作为 `## supervibe` 节。若 AGENTS.md 尚不存在，则创建它，内容仅为拼接进来的这一节。
3. 创建 notes 目录（默认 `.agents/notes/`）。

**绝不写 `plans/`——那是 superpowers 执行域。** `specs/` 与 `plans/` 归执行层所有，scaffold 一概不碰。

**幂等，按工件分别判定：已存在的目录/节保持不动并产出 diff 提案；缺失的正常创建。** 已存在的 AGENTS.md `## supervibe` 节，打印 scaffold 将要新增内容的 diff 请用户手动应用；已存在的目录保持原样。债务追踪器不在此创建——`debt` 子命令在首笔条目时创建。

## epic

以 `templates/epic.md` 创建 `<roadmaps_dir>/YYYY-MM-DD-<epic>.md`：

- frontmatter：`{epic: E#, status: open, date}`——epic id 扫 `roadmaps/` 内全部文档取 max+1。
- 正文七节，按模板：核心交付（Deliverables）/ Definition of Done / Sprint Breakdown / 决策（Decisions (ADR)）/ 资产处置（Asset Disposition）/ 开放问题（Open Questions）/ 横切关注（Cross-cutting）。
- **缺 DoD 即拒绝**——没有 Definition of Done 的 epic 无效；停下并向用户索要。DoD 挂在 epic 层；sprint 文档逐字复制，后续改动在此处以修订方式进行，绝不在 sprint 文档内改。

`breakdown` 子命令——向 epic 文档的 Sprint Breakdown 节追加桩行：`{sprint id、state: planned、备注}`：

- sprint id 扫 `sprints/` 文档**与**全部 epic 文档桩行取 max+1——两个来源每次都扫：pre-start 桩行还没有文档，漏扫任一侧都会撞号。
- 桩行表是 pre-start 状态的唯一载体。`supervibe:start` 把 `ready` 桩行实体化为 sprint 文档并把桩行置 `started`（保留 id 指针）——绝不在本技能里创建或实体化 sprint 文档。

## adr

向 epic 文档的决策（ADR）节追加编号行：id、决策、理由；决策后续变化时追加修订行。

- 编号全局唯一、跨全部 epic：扫每个 epic 文档的 ADR 节取 max+1；绝不在单个 epic 内独立编号。
- **强制 doc-before-code：决策文本必须在实现开始之前写入 epic 文档。** 若实现已经启动，现在补记 ADR，标注 retroactive，并点破纪律违例。
- 关联该决策了结的开放问题或债务条目。
- 每次 ADR 变更：追加日期 + 证据链接。

## question

管理 epic 文档开放问题（Open Questions）的生命周期：open → closed / deferred。

- 以 id 与一行陈述开启。不编号的问题会腐烂；被追踪的才会关闭——一切皆入行。
- close 或 defer 必须带决策记录链接：ADR id、notes 条目或证据 commit。
- 重开 = 追加引用旧行的新行；绝不改写历史。

## asset

更新 epic 文档中继承资产的处置（Asset Disposition）。处置取值：reuse / retire / re-order / watch。

- 记录改了什么、为什么——这一节的存在就是为了阻断「计划复用」与「实际复用」之间的静默漂移。
- 每次变更：追加日期 + 证据链接。
- 没有归属 epic 的资产是坏味道——点破它，然后把资产路由到一个归属 epic，或开一个开放问题。悬浮的资产会腐烂。

## debt

- 按 `templates/debt-entry.md` 向已配置的债务追踪器追加条目：severity、owner、清偿标准（repayment criteria）。缺清偿标准的条目无效。
- 若追踪器文件不存在，按 `templates/debt-entry.md` 的行格式表头创建它——`scaffold` 不创建此文件。
- 清偿（repay）：引用证据 commit hash 关闭条目——无 hash，不关闭。
- 观察项（尚无修复决策的症状）路由到归属 epic；它们挂在那个 epic 的 DoD 上，不进追踪器的积压。

## ready / close

本技能只拥有两个状态转换；其余一律拒绝（`ready→active` 桩行实体化归 supervibe:start，`→acceptance` 归 supervibe:accept，`→merged` 归 supervibe:merge，条款兑现归 supervibe:sync）。

- **ready —— planned → ready**：在 epic 文档 Sprint Breakdown 节翻转桩行状态。go 决策是战略性的：核实该 epic 的 DoD 覆盖此 sprint 将交付的内容，再把决策记入桩行备注。细粒度就绪裁决（依赖、WIP 计数、early start、deferred dependency）发生在实体化时，归 supervibe:start。没有匹配给定 sprint id 的桩行 → 拒绝，并言明哪个 id 未知。
- **close —— → closed**：向 sprint 文档 frontmatter 写 `state: closed`。**前置：当前状态为 `merged`，且仅为 merged——closed 不卡交接条款。** 条款生命周期独立于 closed：open 条款由目标方 sync 在其时机兑现，签发方可先收口（实证：R3.6 已收口而其条款等待目标合入）。没有匹配给定 id 的 sprint 文档 → 拒绝，言明未知 id。
- **epic 收口**：当该 epic 的全部 sprint 已 closed 且文档内无开放问题阻塞时，把 epic 文档 frontmatter `status: open → closed`；言明核实了什么。

## Invariants（不变量）

- 本技能的每次变更——epic 文档、分解桩行、ADR 行、question、asset、债务条目、状态翻转——都在受影响行或 frontmatter 追加日期 + 证据链接。
- id 绝不复用：epic id、sprint id、ADR 编号均取自 max+1 扫描（空集扫描从 1 起），全树永远唯一。
- 任何子命令引用不存在的 epic 或 sprint id → 拒绝并言明未知 id——此模式适用于全部子命令，不限于 ready/close。
- 绝不编辑归属其他技能的状态：closed 之前的 sprint 文档状态、桩行 `started` 翻转、交接条款记录、验收记录。
- 绝不创建中心索引文件——目录扫描即聚合。
