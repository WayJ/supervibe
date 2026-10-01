---
name: start
description: 当用户说 start、begin、kick off，或要拉起（pull）一个 sprint、epic、迭代时使用。
argument-hint: <epic-id> <sprint-id>
---

# supervibe:start — 开一个 sprint

把 epic 文档 Sprint Breakdown 里的一条 `ready` 桩行实体化为 sprint 文档——从规划进入执行唯一的一扇门。输入是 epic id + sprint id，两者必填：一个 epic 可同时挂多条 `ready` 桩行（并行波次），sprint id 永远无法从 epic 单独推出。任一参数缺失 → 询问；绝不猜测波次。

pre-start 状态活在桩行里；自实体化起，sprint 文档 frontmatter 即台账，创建时置 `state: active`。sprint 是价值盒——由 DoD 收口，绝非时间盒；并行度受 `wip_limit` 约束，而非日历。

围绕这个动作：先做就绪裁决、先读史，再把脚手架文档交给执行层。superpowers 是推荐配对——在场则调度之；不在场则以同一工件契约手动产出。耦合仅止于工件契约：本技能绝不 fork 或改写执行层技能。零栈假设：一切路径取自宿主配置，绝不硬编码。

## 读取宿主配置（Read host config）

任何动作之前，先在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 本技能读取的配置键：`roadmaps_dir`、`sprints_dir`、`notes`、`wip_limit`；子节 `### doc_sync_map`。
- 键缺失时的默认值：`roadmaps_dir: docs/superpowers/roadmaps/`、`sprints_dir: docs/superpowers/sprints/`、`notes: .agents/notes/`、`wip_limit: 3`。
- 该节整体缺失 → STOP：唯一合法的下一步是 `supervibe:roadmap scaffold`——指引过去，其余一律拒绝。
- 该节确认存在后，解析本技能涉及的已配置目录（`roadmaps_dir`、`sprints_dir`、`notes`）并核实其存在。缺失 → STOP：指引用户运行 `supervibe:roadmap scaffold` 或修正配置路径；绝不明着隐式创建工件——配置路径笔误绝不能静默分叉真源。
- 模板按 `<plugin base dir>/templates/<file>` 解析（此处为 `sprint.md` 与 `handover-clause.md`）；绝不假设它们在宿主仓库里。
- 写 sprint 文档之前先查 `### doc_sync_map`：若映射表覆盖了本技能写的工件路径，以映射表为准——「本技能写出的工件不欠进一步 doc-sync」的豁免仅适用于未覆盖的路径。
- `### gates` 的 gate 命令与本技能无关——gate 在 accept 与 merge 处生效；start 不运行任何 gate。

## 定位桩行（Locate the stub）

- 在 `roadmaps_dir` 中找到 frontmatter `epic` id 匹配的 epic 文档。没有匹配 → 拒绝，言明未知的 epic id。
- 在其 Sprint Breakdown 节中找到携带给定 sprint id 的桩行——id 必填，因为一个 epic 可同时挂多条 `ready` 桩行（并行波次）。没有匹配行 → 拒绝，言明未知的 sprint id。
- 桩行必须处于 `ready` 状态：
  - `planned` → 拒绝并路由到 `supervibe:roadmap ready`——go 决策是战略性的，不在此处做出。
  - `started` → 拒绝：已实体化；点名既存的 sprint 文档（在 `sprints_dir` 中按 frontmatter `sprint` 匹配）。
- 裁决之前先读桩行备注：`supervibe:roadmap ready` 在那里记录了战略 go 决策理由——它是下文裁决的输入，不是裁决本身。

## 就绪裁决（Readiness adjudication）

动笔写任何文件之前的四项裁决——每一项要么阻断本次 start，要么塑造即将创建的文档。每项裁决结果落入新文档的 frontmatter 标记与开线条目的 decisions 节：

1. **依赖（Dependencies）**——读桩行备注与 epic 文档（Deliverables、Cross-cutting）中点名其他 sprint 的依赖。
   - 依赖已合入 → 已满足；核实后继续。
   - 依赖未合入 → 并非阻断项；路由到裁决 4。
2. **WIP 上限（WIP limit）**——扫 `sprints_dir` 内全部文档的 frontmatter `state: active`，计数在途 sprint。
   - 计数已达或超过 `wip_limit` → 停，点名在途 sprint；其中之一必须先 merge 或 close，本次 start 才能继续。
   - 提前启动的 sprint 就是 `active`，与其他在途 sprint 同等计入上限。
3. **提前启动（early start）**——当本 sprint 所跟随的 sprint 仍在途（未 merged）时适用。
   - 估算本 sprint 预期范围（epic Deliverables + 桩行备注）与在途 sprint 范围（其 sprint 文档）的文件交集。
   - 交集 ≈ 零 → 安全：在新文档 frontmatter 置 `early-start: true`，并把估算记入开线条目。
   - 实质重叠 → 作为 early start 不安全：等待，或把重叠部分路由到裁决 4。
4. **候补依赖（deferred dependency）**——在当前基线上视同被依赖 sprint 已合入先行实现，并以交接条款绑定未来复核。
   - 按 `templates/handover-clause.md` 在本 sprint 文档的 Handover Clauses 节登记条款——签发方是条款正文的唯一真源；其他一切工件只存引用。
   - **条款 id HC#：扫全部 sprint 文档的 Handover Clauses 节取 max+1（空集扫描从 1 起）。**
   - 目标引用按迁移规则：目标 sprint 文档已存在 → 把 HC# 追加进其 frontmatter `clauses` 列表；目标是尚无文档的未来 sprint → 在条款本身记录 `target: <epic> breakdown S#`。

## 先读史（Read history first）

notes 是跨 sprint 的知识资产，不是流水账——写一行 plan 之前先读它：

- 在 notes 目录检索与本 epic 域 + 技术栈匹配的历史条目：以 epic 文档 Deliverables 节抽取的关键词（组件名、栈名词、失败模式）grep。
- 优先看 lessons 节点了环境坑、流程修正、回炉根因的条目——这些才是可复用的类别。
- 把相关教训摘入新文档的 Decisions (D-x) 上下文，并引用来源条目（文件 + 节）；无引用的教训是观点，有引用的才是证据。
- notes 目录为空不是错误——第一个 sprint 没有历史。言明后继续。

## 实体化 sprint 文档（Materialize the sprint doc）

1. 以 `templates/sprint.md` 创建 `<sprints_dir>/YYYY-MM-DD-<sprint>-plan.md`。文件日期是实体化日期（今天），不是桩行的规划日期。frontmatter `{sprint, epic, state: active, worktree, early-start, deferred-dependency, clauses, merged-commit: null}`：
   - `worktree`——承载本 sprint 的 worktree/分支（一个 sprint = 一个 worktree/分支）。
   - `early-start`——上文的裁决结果；未适用时为 `false`。
   - `deferred-dependency`——裁决 4 登记的 HC# 引用；无则留空。
   - `clauses`——以迁移进来的 HC# 引用作种子：扫全部 sprint 文档的 Handover Clauses 节，找出记录了匹配本桩行的 `target: <此 epic> breakdown S#` 的条款，把其 id 收进来——条款正文留在签发方，引用落到 sync 将要扫描的位置。没有条款瞄准本桩行则为空。
2. 按模板填满五节正文——Decisions (D-x) / Stories & Tasks / Definition of Done / Acceptance Scenarios (S1–Sn) / Handover Clauses。**DoD 自 epic 文档的 Definition of Done 逐字复制——绝不在 sprint 文档内就地改写；DoD 变更回 epic 文档以修订方式进行，再自此重新复制。**
3. 桩行状态翻转为 `started`，保留 sprint id 指针；向桩行备注追加日期 + 证据链接（新文档路径）。
4. 按 §2.4 四节协议写开线条目 `<notes>/YYYY-MM-DD-<sprint>-open.md`：背景（为何开这条线、做了哪些裁决）/ 决策（含理由与被否决项）/ 教训（上文摘出的历史，带引用）/ 交接（在此登记的条款、所欠义务）。

## 调度执行（Dispatch execution）

执行归 superpowers 层；本技能只交出工件契约：

- 先探测：检查 `superpowers:brainstorming` 与 `superpowers:writing-plans` 是否可作为可调用技能使用。
- 在场 → 先调用 `superpowers:brainstorming`，再调用 `superpowers:writing-plans`，指示两者填充已实体化的文档路径。**五节结构与逐字 DoD 是执行层产出的不可变约束**——执行层扩展脚手架文档，绝不替换或改写它。
- 不在场 → 打印手动指令，以手工方式产出同一工件契约：把 epic Deliverables 分解进文档的 Stories & Tasks，保持 DoD 逐字，review 前写明 Acceptance Scenarios (S1–Sn)。降级的是工具，不是契约。

## Invariants（不变量）

- 本技能只拥有一个状态转换：`ready` 桩行 → `started`，外加一份以 `state: active` 创建的 sprint 文档。绝不 planned→ready（roadmap），绝不 acceptance/merged/closed（accept/merge/roadmap），绝不做条款兑现（sync）。
- 绝不经由其他路径实体化 sprint 文档——`sprints/` 文档只来自 `ready` 桩行。
- DoD 永远逐字——epic 文档是其唯一归宿。
- HC# id 绝不复用：扫全部 sprint 文档的 Handover Clauses 节取 max+1；空集扫描从 1 起。
- 条款正文只活在签发方 sprint 文档；其他一切工件只存引用。
- sprint 文档与其开线条目在同一动作里写出——没有开线条目的实体化 sprint 是不完整的。
- 每次变更——桩行翻转、文档创建、条款登记、迁移引用——都携带日期 + 证据链接。
