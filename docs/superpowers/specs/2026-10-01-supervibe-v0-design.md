# SuperVibe v0 — 设计 Spec

- 日期：2026-10-01
- 状态：brainstorming 对话中已批准；spec 评审环两轮通过（Approved）；
  **2026-10-01 架构修订**（工件树日期化目录 + 去中心化台账 + SDO 铁律 +
  Sprint 分解桩行 + 条款单一真源，依据 superpowers 6.4.2 / gstack 源码
  学习与用户指令，评审环见后续轮次）
- 仓库：`supervibe`（本仓，自举自第一笔 commit 起）

## 1. 定位

**SuperVibe 是 Claude Code 的迭代管理层。** 回答「做什么、何时做、什么顺序、
一个 sprint 何时算完」。与执行层配对——推荐
[superpowers](https://github.com/obra/superpowers)——执行层回答「怎么把代码写好」。

职责划分：

| | supervibe（战略层） | superpowers（战术层） |
|---|---|---|
| 关心 | roadmap、sprint 排期、DoD、验收、合并收口、跨线同步 | brainstorm、spec、plan、TDD、subagent 开发、评审环 |
| 输入 | roadmap + 在途 sprint | 一份 sprint plan 文档 |
| 输出 | 裁决：「这个 sprint 可以开工 / 可以合入」 | 可用代码 + 文档 |

**硬规则：**

1. **工件契约耦合，非代码耦合。** 两层只通过 sprint plan 文档与验收记录
   通信。supervibe 绝不 fork 或重写任何 superpowers 技能。
2. **优雅降级。** 技能检测 superpowers 存在则调度（`superpowers:brainstorming`、
   `superpowers:writing-plans`…）；不存在则同一工件契约手动产出。
   manifest 不声明硬依赖。
3. **零栈假设。** 全部项目 specifics（门禁命令、doc-sync 映射、WIP 上限、
   路径）留在宿主项目 `AGENTS.md` 的 supervibe 节。plugin 交付的是流程，
   不是配置。

### 术语策略（刻意对齐 Scrum）

核心名词直接采用 Scrum 词汇，避免重复学习：**epic**（大交付块）、
**sprint**（一次迭代交付单元）、**Definition of Done / DoD**（完成的定义）、
**story/task**（plan 内任务条目）、**acceptance scenarios**（验收场景）。

与标准 Scrum 的两处显式差异，spec 一处声明：

- **sprint = 价值盒，非时间盒。** 收口判据是 DoD 达成而非到期切刀。
  WIP 上限控制并行数（默认 3），无固定时长、无 velocity 度量。
- **DoD 挂在 epic 层**，自 epic 文档逐字复制进 sprint 文档，不得就地改写。

Scrum 没有对应物、必须保留的四个新名词（supervibe 的增量能力）：

- **sprint ledger**（sprint 台账）— 各 sprint 文档头部 frontmatter 的
  权威状态字段（去中心化，目录扫描聚合）
- **handover clause**（交接条款）— 跨 sprint 复核义务
- **early start**（提前启动）— 前一 sprint 未收口时安全开新线
- **deferred dependency**（候补依赖）— 视同目标已合入先行实现 + 条款兜底

### 非目标（v0）

- 无 hooks、无 agents、无 MCP server、无 `commands/`（官方已把 commands
  并入 skills；纯 skills/ 是官方对新插件的建议）。
- 除 skill 指令 + plugin 自身 CI 校验外，无任何强制机器。门禁以技能指示
  Claude 执行命令的方式运行。
- 无多 plugin marketplace、无版本化模板引擎。纯 markdown 模板 + 占位注释。
- 无时间盒、无 standup、无 velocity。价值盒（DoD 驱动）+ WIP 上限。

## 2. 领域模型（自真实 R0→R4 迭代史萃取）

模型泛化自承载一个真实产品走完八条连续迭代的实践（其中一度三线并行）：

### 2.1 工件树（战略真源 = 日期化目录，非单文件）

沿用 superpowers 的日期化目录模式，supervibe 域三个子目录与执行域
（specs/plans）同根：

```
docs/superpowers/
├── specs/        执行域：brainstorming 产出设计文档（superpowers 既有）
├── plans/        执行域：writing-plans 产出实施计划（superpowers 既有）
├── roadmaps/     supervibe：YYYY-MM-DD-<epic>.md —— 每 epic 一档
├── sprints/      supervibe：YYYY-MM-DD-<sprint>-plan.md —— 每 sprint 一档
└── acceptances/  supervibe：YYYY-MM-DD-<sprint>-acceptance.md
```

**去中心化台账**（gstack 实证模式：工件仓库本地化 + 目录扫描聚合，
无中心索引文件——零静默分叉面）：

- **Epic 文档**（`roadmaps/YYYY-MM-DD-<epic>.md`）：frontmatter
  `{epic id、状态（open|closed，由 roadmap 技能关闭）、日期}` + 七节：
  核心交付 / **DoD**（无 DoD 的 epic 无效）/ **Sprint 分解**（桩行表：
  `{sprint id、状态 planned|ready|started（已实体化，保留 id 指针）、
  备注}`——pre-start 状态的唯一载体，start 时实体化）/ ADR 增量
  （编号全局唯一：扫全部 epic 文档取 max+1；
  纪律：*先改文档再动代码* doc-before-code）/ 资产处置（复用/退役/重排/
  观察）/ 开放问题（open → closed/deferred，带决策链接；不编号的问题
  会腐烂）/ 横切关注（点名归属 epic）。
- **Sprint 文档**（`sprints/YYYY-MM-DD-<sprint>-plan.md`）：frontmatter
  即 sprint 台账——`{sprint id、epic 引用、状态、worktree/分支、
  early-start 标记、deferred-dependency 引用、clauses（在途交接条款
  id 引用列表）、合并 commit hash}`；正文五节见 §2.3。sprint id 编号
  扫 sprints/ 文档**与全部 epic 分解节桩行**取 max+1（防撞号）。

epic 是战略单位（一个 epic 可拆出多个 sprint，如并行波次）；sprint
状态存放分两段：pre-start（planned/ready）在 epic 分解节桩行，
active 起在 sprint 文档 frontmatter。文件量小，扫描成本忽略不计。

### 2.2 Sprint（迭代单元，战术层）

状态机（权威存放处：active 起为 sprint 文档 frontmatter 的 `state`
字段，pre-start 为 epic 分解节桩行状态——见 §2.1）：

```
planned → ready（候指令）→ active（允许并行，受 WIP 上限约束）
        → acceptance → merged → closed
```

Scrum 对照：planned/ready ≈ backlog 已排期；active ≈ sprint in progress；
acceptance ≈ sprint review；merged/closed ≈ done。

状态转换归属：`supervibe:roadmap` 拥有 planned→ready（改 epic 文档
Sprint 分解节桩行状态；go 决策是战略性的）与 →closed（改 sprint 文档
frontmatter；**前置仅为 state: merged——closed 不卡交接条款**：条款生命
周期独立于 closed，open 条款由目标方 sync 在其时机兑现，签发方可先收口
——实证：R3.6 签发条款后合入收口，条款等 R3.5-W2 合入时兑现）；
`supervibe:start` 把 epic 分解节 ready 桩行**实体化**为
`sprints/YYYY-MM-DD-<sprint>-plan.md`（frontmatter 初始 `state: active`，
分解节桩行状态置 started 保留 id 指针）；`supervibe:accept` 写 sprint
文档 frontmatter →acceptance（+ 裁决）；`supervibe:merge` 写 →merged
（+ commit hash）。交接条款的**兑现（discharge）**归 `supervibe:sync`：
目标 sprint 的 sync/merge 验证义务履行后，由 sync 在**签发方 sprint 文档**
的条款记录处记证据并置 discharged（单一权威，见下）。

特殊流（全部在真实迭代中出现过）：

- **提前启动（early start）** — 前一 sprint 未收口时，裁决安全（文件
  交集 ≈ 零）即可提前开线。记入该 sprint 文档 frontmatter 的
  early-start 标记。
- **候补依赖（deferred dependency）** — 先在当前基线上实现，同时向被
  依赖 sprint 的未来合并登记**交接条款（handover clause）**（真实案例：
  「T4 视同 W2 已合入直接实施；W2 合入时复核顺序耦合」）。
- **交接条款（handover clause）** — 跨 sprint 复核义务。**本条为条款生命
  周期的唯一规范真源（TD-1 收敛，2026-10-01）：merge/sync 技能只承载操作
  指令并以锚点引用本条，修订只发生在本条。**正文唯一真源 =
  签发方 sprint 文档的 Handover Clauses 节**：`{id HC#、目标 sprint、
  触发器、义务、状态 open|discharged、证据}`；id 扫全部 sprint 文档的
  Handover Clauses 节取 max+1（空扫描自 1 起）。目标方只存引用：目标
  sprint 文档已存在 → 其 frontmatter `clauses` 字段加 id；尚未存在（未来
  sprint）→ 签发方条款记录内写 `target: <epic> 分解节 S# 桩行`，start
  实体化该桩行时迁移引用。**生效（binding）**：条款自签发方 sprint 合并
  起（merge 阶段 6 发射）对其目标生效；签发方未合入的条款是信息不是义务。
  **触发 = 抵达（arrival）**：签发方 `merged-commit` 已可从目标载体到达
  （在途目标对其分支做祖先检查；已 merged 目标按 main 可达性判定）即触发
  ——无论抵达多久以前；入站区间只作报告层（fresh/standing 之分），绝不作
  检测门。**只以记录在案的证据兑现**（discharge 写回签发方文档条款记录：
  目标方分支内 commit hash、merged 目标在 main 上的 hash、或验证
  transcript；预期不是证据），时机在目标 sprint 的 sync；merge 发射但绝不
  写条款状态。

### 2.3 Sprint 工件

| 工件 | 契约 |
|---|---|
| Sprint plan（`sprints/YYYY-MM-DD-<sprint>-plan.md`）| frontmatter 台账字段（§2.1）+ 五节：D-x 决策 / 波次 story-task 复选框 / DoD（**自 epic 文档逐字复制，不得就地改写**）/ S1–Sn 验收场景 / 交接条款（Handover Clauses，正文唯一真源） |
| 验收记录（`acceptances/YYYY-MM-DD-<sprint>-acceptance.md`）| 场景结果表 + **障碍逐字留痕**（禁止美化：每个阻塞、绕行、替代证据都按实际发生记录）|
| 开发日志 | 见 §2.4 notes 协议——跨 sprint 资产，非一次性工作日志 |
| 债务追踪 | 条目含严重度、归属、清偿标准；观察项路由到归属 epic |

### 2.4 开发日志协议（notes，跨 sprint 资产管理）

`.agents/notes/` 是**知识资产库**而非流水账——教训沉淀防重蹈覆辙，
交接条款证据链在此留痕。

- **文件名**：`YYYY-MM-DD-<sprint>-<topic>.md`
- **结构四节**：背景（为什么开这条线/这个话题）/ 决策与理由（含否决项）/
  教训（可复用经验：环境坑、流程修正、回炉根因）/ 交接（条款引用与
  复核记录）
- **写入时机**：`start` 产出开线条目；关键节点（任务回炉、障碍绕行、
  裁决变更）即时补记；`merge` 产出收口条目（证据 commit hash）
- **读取时机**：`start` 开工**先读史**——按 epic 域 + 技术栈 + 教训类型
  检索历史条目，相关教训摘入 plan 的 D-x 决策上下文；`accept` 遇障碍
  先查史上有无同类绕行，命中则复用并注明来源条目
- **不变量**：条目只增不改（历史诚实）；收口条目与验收记录互相引用

### 2.5 并行纪律

- 一个 sprint = 一 worktree/分支。WIP 上限来自项目配置（默认 3）。
- 固定同步节拍：按节奏（而非仅事件驱动）把 `origin/main` merge 进在途
  sprint。
- 冲突复核清单（**规范真源，TD-1 收敛**——merge/sync 以锚点引用本行，
  修订只发生在本行）：生成物 → 重新生成后比对；手写文件 → 技能逐项列出
  复核单。
- 交接条款在目标 sprint 的 sync/merge 时触发。

### 2.6 门禁（gates）

项目参数化的命令清单（见 §5）。典型：契约/生成物一致性、doc-sync
欠账核验、验收场景、测试套件。门禁红或验收裁决缺失，sprint 不得合并。
**doc-sync 纪律的两级落地**：逐变更纪律（执行层每任务收尾按映射表自查，
属宿主 AGENTS.md 节内容，不设独立技能）+ 检查点核验（accept 做周期
漂移审计、merge 做欠账终检）。

## 3. Plugin 格式（已对照官方文档核实，2026-09-30 版）

来源：plugin manifest reference、marketplace reference、skills 页
（code.claude.com/docs）。塑造本设计的硬规则：

- 只有 `plugin.json` 允许放 `.claude-plugin/`；组件放别处不加载。
- plugin `name`：kebab-case，禁空格/`@`/`:`/路径分隔符。作为全部技能的
  前缀：`/supervibe:<skill>`。
- `homepage`：必须可解析为 URL，否则 plugin **加载失败**。v0 用可解析
  占位符，发布时替换；本地开发走 `claude --plugin-dir`。
- 技能：`skills/<name>/SKILL.md`，`---` frontmatter 必须在第一行。
  **SDO 铁律**（superpowers 6.x `writing-skills` 实测教训）：`description`
  只写**触发条件**（"Use when..."开头，含具体触发词/症状），**绝不总结
  workflow**——agent 会照 description 抄近路跳过读技能全文。触发词刻意
  使用 Scrum 词汇（sprint/epic/DoD/review），提高「用熟悉词汇下指令」的
  触发率。长度以 agentskills.io 规范 1,024 字符为自律上限。
- 自兼 marketplace：`.claude-plugin/marketplace.json` 把 plugin 列在
  `"source": "./"` 是官方支持的单仓形态。**条目 `name` 必须等于 manifest
  的 `name`。** 版本以 `plugin.json` 为准。
- 校验：`claude plugin validate --strict`（CI 门禁），行为测试用
  `claude plugin eval`。

## 4. 技能集（5 个）

全部技能可被模型触发（`disable-model-invocation: false`），适用处加
`argument-hint`。正文双语双文件：`SKILL.md` 英文（**唯一被加载器注册
与执行的版本，即真源**），同目录 `SKILL.zh.md` 中文（人类阅读参考，
不被加载器注册——技能目录内非 SKILL.md 文件仅作随插件分发的辅助资产）。
两版内容镜像；冲突时以英文版为准。正文祈使句、精炼；各自以相对路径
引用模板并按 §5 读宿主配置。心智模型五个动词：**战略（roadmap）→
开（start）→ 验（accept）→ 合（merge）→ 同步（sync）**。

| # | 技能 | description（触发条件式，SDO 铁律） | 契约（输入 → 输出与副作用） |
|---|---|---|---|
| 1 | `supervibe:roadmap` | Use when the user mentions the roadmap, an epic, ADR decisions, open questions, asset disposition, tech debt, or wiring a project to supervibe. | 战略真源全套。子命令：**scaffold**（按 §5 配置路径建 `roadmaps/`、`sprints/`、`acceptances/` 目录树 + AGENTS.md supervibe 节 + `.agents/notes/`，幂等——已存在的目录/节不动，输出 diff 提案；**不写 `plans/`——那是 superpowers 执行域**）/ 加 epic 文档（缺 DoD 即拒绝；可带 Sprint 分解桩行）/ 记决策（ADR 增量节 + 修订；强制 doc-before-code）/ 开闭问题 / 资产处置 / **debt**（加条目、清偿以证据 commit hash、观察项路由到归属 epic）/ planned→ready（改 epic 文档分解节桩行）与 →closed（改 sprint 文档 frontmatter，前置仅为 merged，不卡条款，§2.2）两转换。每次变更注记日期 + 证据链接。 |
| 2 | `supervibe:start` | Use when the user says start, begin, kick off, or pull a sprint, epic, or iteration. | 输入：epic id + sprint id（定位 `roadmaps/` 内对应文档及其分解节 ready 桩行；一个 epic 多 ready 桩即并行波次，桩 id 必填）。就绪裁决：依赖检查、WIP 计数（扫 sprints/ frontmatter 聚合 active 数）对上限、early-start 裁决（与在途 sprint 文件交集估算）、deferred-dependency 裁决（→ 按条款机制在签发方 sprint 文档 Handover Clauses 节登记，目标引用按 §2.2 迁移规则）。**先读史**：按 §2.4 协议检索 notes 历史教训，摘入决策上下文。输出：把分解节 ready 桩行实体化为 `sprints/YYYY-MM-DD-<sprint>-plan.md`（frontmatter 台账字段齐全、初始 `state: active`，五节，DoD 逐字复制自 epic 文档）+ 开线条目入 notes。然后调度：superpowers 在 → `superpowers:brainstorming` 再 `superpowers:writing-plans`，**指示其填充脚手架路径——五节结构与逐字 DoD 是对产出 plan 的不可变约束**；不在 → 打印手动指令。 |
| 3 | `supervibe:accept` | Use when the user asks to accept, review, or verify a sprint, or asks whether a sprint is done. | 输入：sprint/plan 文档。把 S1–Sn 作为真验证执行（浏览器、CLI、栈命令按各场景指定——**证据先于断言，绝不未运行就宣称通过**；遇障碍先查 notes 史上同类绕行，命中复用并注明来源）。填 DoD 清单。障碍逐字留痕。**doc-sync 周期审计**：按映射表出漂移报告。输出 `acceptances/YYYY-MM-DD-<sprint>-acceptance.md` + 裁决（pass/blocked）+ **sprint 文档 frontmatter** 状态 →acceptance。替代证据必须如此标注。 |
| 4 | `supervibe:merge` | Use when the user says merge, close out, ship, finish, or wrap up a sprint. | 有序序列，遇红即停：门禁（含 **doc-sync 欠账终检**）→ 验收裁决在案 → 合 main（冲突按 §2.5 清单）→ 拆 worktree/分支 → sprint 文档 frontmatter 以 commit hash 定稿 + 状态 →merged → 交接条款发射（即刻生效）→ notes 收口条目（证据 commit hash，与验收记录互引）。 |
| 5 | `supervibe:sync` | Use when the user says sync, pull main, update branches, or integrate upstream changes. | 节拍入口：把 `origin/main` merge 进指定（或全部在途）sprint；冲突分类（生成物 → 重生成；手写 → 复核单）；扫描 sprints/ frontmatter `clauses` 引用，按 HC# 解析到各签发方文档 Handover Clauses 节取义务正文，对照入站 diff（路径/特性命中 → 呈现义务）；条款义务验证后记录证据并在签发方文档置 discharged（§2.2）。报告。 |

## 5. 配置面（宿主 AGENTS.md）

技能 grep 读取的一个节：

```markdown
## supervibe
- roadmaps_dir: docs/superpowers/roadmaps/    # epic 文档目录
- sprints_dir: docs/superpowers/sprints/      # sprint 文档目录
- acceptances_dir: docs/superpowers/acceptances/
- notes: .agents/notes/
- debt_tracker: docs/tech-debt-tracker.md
- wip_limit: 3
### gates
- contracts: <command>
- tests: <command>
### doc_sync_map
| change | owes |
|---|---|
| <path pattern> | <doc> |
```

技能 grep 这些标题；节缺失 → 技能指示先跑 `supervibe:roadmap` 的
scaffold 子命令。plugin 绝不
写入栈 specifics。

## 6. 模板（`templates/`）

纯 markdown、`<!-- -->` 占位注释、无引擎：

- `epic.md` — epic 文档（§2.1）：frontmatter（epic id/状态/日期）+
  七节（核心交付 / DoD / **Sprint 分解**（桩行含 planned|ready|started
  状态）/ ADR 增量 / 资产处置 / 开放问题 / 横切关注），各带一行示例
- `sprint.md` — sprint 文档（§2.3）：frontmatter 台账字段全套
  （含 `clauses` 引用列表）+ 五节正文（第五节标题 `Handover Clauses`，
  即条款正文的唯一真源所在），含不变量注释：DoD 自 epic 文档复制，
  改动回 epic 文档改，不在 sprint 文档里改
- `acceptance-record.md` — 结果表 + 逐字障碍日志
- `handover-clause.md` — 条款记录格式
- `debt-entry.md` — 追踪行格式
- `agents-sections.md` — §5 待拼接块

## 7. 自举与校验

- 本仓自吃狗粮：`docs/superpowers/roadmaps/2026-10-01-v0.md`（epic：
  「plugin v0.1.0 发布」，含 DoD/Sprint 分解（S1 桩行 started 示范新
  机制）/ADR D1/开放问题三件——含 CI 工作流延后留痕）；开发走
  superpowers 流程，specs/plans 同树。
- CI（两项检查，零 npm 依赖，Node ≥ 20，预装 `claude` CLI）：
  1. `claude plugin validate . --strict`
  2. `tests/check-artifacts.mjs` — 逐模板：必备节标题在；每个
     `SKILL.md` 有对应 `SKILL.zh.md`（双语成对断言）；再做**装配干跑**：
     把 `agents-sections.md` 拼进 fixture AGENTS.md、在临时目录展开模板
     占位注释，断言装配产物含全部必备标题且无必备占位符残留未展开。
     这验证的是 `supervibe:roadmap` 的 scaffold 子命令将产出的工件——
     **不交付平行 scaffold
     实现，skill 指令是唯一 scaffold 逻辑**。

## 8. v0 文件清单

```
.claude-plugin/plugin.json          # name supervibe, version 0.1.0, MIT
.claude-plugin/marketplace.json     # 自兼 marketplace, source "./"
skills/{roadmap,start,accept,merge,sync}/SKILL.md      # 英文（真源）
skills/{roadmap,start,accept,merge,sync}/SKILL.zh.md   # 中文镜像
templates/{epic,sprint,acceptance-record,handover-clause,debt-entry,agents-sections}.md
tests/check-artifacts.mjs
docs/superpowers/roadmaps/2026-10-01-v0.md    # 自举 epic 文档
AGENTS.md                            # 自举仓自身的 supervibe 配置节（狗粮前提）
README.md  README.zh-CN.md  LICENSE  CHANGELOG.md  .gitignore
docs/superpowers/specs/2026-10-01-supervibe-v0-design.md   # 本文件
```

## 9. 发布

- 版本 0.1.0（semver 字符串；加载器不校验，我们自律遵守）。
- 发布：push 到公开 git 托管 → 替换占位 `homepage`/`repository`（v0 出厂
  用可解析占位 `https://example.com/supervibe`；加载器对不可解析 URL
  硬失败，故本地 `--plugin-dir` 开发期也不接受 "TBD" 字样）→ 用户经
  `/plugin marketplace add <owner>/supervibe` →
  `/plugin install supervibe@supervibe` 安装。
- README 讲清与 superpowers 的配对（推荐而非必需）与降级路径；术语表
  （Scrum 对照 + 四个新名词）放 README 首屏，进一步压学习成本。

## 10. 开放问题

1. 托管 owner/URL — 发布时解决（只阻塞 `homepage`，不阻塞本地开发）。
2. v0.2 是否加 `acceptance-verifier` subagent（延后；YAGNI）。
