# SuperVibe v0 — 设计 Spec

- 日期：2026-10-01
- 状态：brainstorming 对话中已批准；spec 评审环两轮通过（Approved）
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
- **DoD 挂在 epic 层**，自 roadmap 逐字复制进 sprint plan，不得就地改写。

Scrum 没有对应物、必须保留的四个新名词（supervibe 的增量能力）：

- **sprint ledger**（sprint 台账）— roadmap 内每个 sprint 的权威状态行
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

### 2.1 Roadmap（战略真源）

每项目一份 `roadmap.md`。六个必备元素：

1. **Epic 表** — id、窗口、核心交付、**DoD**（无 DoD 的 epic 无效）、状态。
1b. **Sprint 台账（sprint ledger）** — 每个 sprint 的权威记录：
   `{sprint id、epic 引用、状态、worktree/分支、early-start 标记、
   deferred-dependency 引用、在途 handover-clause id、合并 commit hash}`。
   epic 是战略单位（一个 epic 可拆出多个 sprint，如并行波次）；台账追踪
   每个 sprint 的战术状态。下文所有「roadmap 行」均指台账行。
2. **ADR 表** — 编号决策 + 理由 + 修订行。纪律：*先改文档再动代码*
   （doc-before-code）。
3. **资产处置** — 继承资产的去向：复用 / 退役 / 重排 / 观察。防止计划
   与实际复用之间的静默漂移。
4. **开放问题** — 生命周期管理（open → closed/deferred，各带决策记录
   链接）。不编号的问题会腐烂；被追踪的才会关闭。
5. **横切关注（cross-cutting）** — 随 epic 推进的事项（品牌、监控、安全
   复测），点名归属 epic。

### 2.2 Sprint（迭代单元，战术层）

状态机（权威存放处：`roadmap.md` 的 sprint 台账；plan 文档头部只带
人类可读副本，绝不反向）：

```
planned → ready（候指令）→ active（允许并行，受 WIP 上限约束）
        → acceptance → merged → closed
```

Scrum 对照：planned/ready ≈ backlog 已排期；active ≈ sprint in progress；
acceptance ≈ sprint review；merged/closed ≈ done。

状态转换归属：`supervibe:roadmap` 拥有 planned→ready（go 决策是战略性的）
并在该 sprint 的交接条款全部兑现（或从未登记）时关闭（→closed）；
`supervibe:start` 写 ready→active；`supervibe:accept` 写 →acceptance
（+ 裁决）；`supervibe:merge` 写 →merged（+ commit hash）。交接条款的
**兑现（discharge）**归 `supervibe:sync`：目标 sprint 的 sync/merge 验证
义务履行后，由 sync 记录证据并将条款置为 discharged。

特殊流（全部在真实迭代中出现过）：

- **提前启动（early start）** — 前一 sprint 未收口时，裁决安全（文件
  交集 ≈ 零）即可提前开线。记入 roadmap 行。
- **候补依赖（deferred dependency）** — 先在当前基线上实现，同时向被
  依赖 sprint 的未来合并登记**交接条款（handover clause）**（真实案例：
  「T4 视同 W2 已合入直接实施；W2 合入时复核顺序耦合」）。
- **交接条款（handover clause）** — 跨 sprint 复核义务：
  `{id、签发 sprint、目标 sprint、触发器、义务、状态、证据}`。开线或
  合并时登记；**只以记录在案的证据兑现**，时机在目标 sprint 的 sync/merge。

### 2.3 Sprint 工件

| 工件 | 契约 |
|---|---|
| Sprint plan | 头部（sprint id、roadmap 引用、状态副本）+ 五节：D-x 决策 / 波次 story-task 复选框 / DoD（**自 roadmap 逐字复制，不得就地改写**）/ S1–Sn 验收场景 / 交接条款 |
| 验收记录（acceptance record）| 场景结果表 + **障碍逐字留痕**（禁止美化：每个阻塞、绕行、替代证据都按实际发生记录）|
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
- 冲突复核清单：生成物 → 重新生成后比对；手写文件 → 技能逐项列出复核单。
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
- 技能：`skills/<name>/SKILL.md`，`---` frontmatter 必须在第一行；
  `description` 是匹配面（控制在 ~200 字符内、关键用例在前；与
  `when_to_use` 合计硬上限 1,536 字符）。描述刻意使用 Scrum 词汇
  （sprint/epic/DoD/review），提高「用熟悉词汇下指令」时的触发率。
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

| # | 技能 | 契约（输入 → 输出与副作用） |
|---|---|---|
| 1 | `supervibe:roadmap` | 战略真源全套。子命令：**scaffold**（原 init：scaffold `roadmap.md` + AGENTS.md supervibe 节 + `.agents/notes/`，幂等——检测到已有节绝不覆盖，输出 diff 提案）/ 加 epic（缺 DoD 即拒绝）/ 记决策（ADR 行 + 修订；强制 doc-before-code 叙述）/ 开闭问题 / 资产处置 / **debt**（加条目、清偿以证据 commit hash、观察项路由到归属 epic）/ planned→ready 与 →closed 两转换（§2.2）。每次变更注记日期 + 证据链接。 |
| 2 | `supervibe:start` | 输入：epic id。就绪裁决：依赖检查、WIP 计数对上限、early-start 裁决（与在途 sprint 文件交集估算）、deferred-dependency 裁决（→ 交接条款登记进 plan + roadmap 行）。**先读史**：按 §2.4 协议检索 notes 历史教训，摘入决策上下文。输出：按模板生成 sprint plan 骨架（五节，DoD 逐字复制）至 `plans` 配置目录（默认 `docs/plans/`）下 `YYYY-MM-DD-<sprint>-plan.md` + 开线条目入 notes。然后调度：superpowers 在 → `superpowers:brainstorming` 再 `superpowers:writing-plans`，**指示其填充脚手架路径——五节结构与逐字 DoD 是对产出 plan 的不可变约束**；不在 → 打印手动指令。 |
| 3 | `supervibe:accept` | 输入：sprint/plan。把 S1–Sn 作为真验证执行（浏览器、CLI、栈命令按各场景指定——绝不未运行就宣称通过；遇障碍先查 notes 史上同类绕行，命中复用并注明来源）。填 DoD 清单。障碍逐字留痕。**doc-sync 周期审计**：按映射表出漂移报告。输出验收记录至 `acceptance` 配置目录（默认 `docs/acceptance/`）下 `YYYY-MM-DD-<sprint>-acceptance.md` + 裁决（pass/blocked）。替代证据必须如此标注。 |
| 4 | `supervibe:merge` | 有序序列，遇红即停：门禁（含 **doc-sync 欠账终检**）→ 验收裁决在案 → 合 main（冲突按 §2.5 清单）→ 拆 worktree/分支 → roadmap 行以 commit hash 定稿 → 交接条款发射（即刻生效）→ notes 收口条目（证据 commit hash，与验收记录互引）。 |
| 5 | `supervibe:sync` | 节拍入口：把 `origin/main` merge 进指定（或全部在途）sprint；冲突分类（生成物 → 重生成；手写 → 复核单）；对照在途交接条款检查入站 diff（路径/特性命中 → 呈现义务）；条款义务验证后记录证据并置 discharged（§2.2）。报告。 |

## 5. 配置面（宿主 AGENTS.md）

技能 grep 读取的一个节：

```markdown
## supervibe
- roadmap: docs/roadmap.md          # 默认；本自举仓用根目录 roadmap.md
- notes: .agents/notes/
- plans: docs/plans/                # sprint plan 默认目录
- acceptance: docs/acceptance/      # 验收记录默认目录
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

- `roadmap.md` — §2.1 六元素（epic 表、sprint 台账、ADR 表、资产处置、
  开放问题、横切关注）各带一行示例
- `plan.md` — 握手工件（§2.3），含不变量注释：DoD 自 roadmap 复制，
  改动回 roadmap 改，不在 plan 里改
- `acceptance-record.md` — 结果表 + 逐字障碍日志
- `handover-clause.md` — 条款记录格式
- `debt-entry.md` — 追踪行格式
- `agents-sections.md` — §5 待拼接块

## 7. 自举与校验

- 本仓带自己的 `roadmap.md`（v0 = 一个 epic：「plugin v0.1.0 发布」），
  以 superpowers 开发，specs/plans 在 `docs/superpowers/` 下。
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
templates/{roadmap,plan,acceptance-record,handover-clause,debt-entry,agents-sections}.md
tests/check-artifacts.mjs
roadmap.md                          # 自举
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
