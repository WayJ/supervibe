---
name: merge
description: 当用户说 merge、close out、ship、finish 或 wrap up 一个 sprint 时使用。
argument-hint: <sprint-id>
---

# supervibe:merge — sprint 收口（sprint close-out）

sprint 收口——一个 sprint 的最后一幕：跑门禁、核实验收裁决在案、合入 main、拆除 worktree、定稿 sprint 台账、发射交接条款、写收口条目。「ship」「finish」「wrap up」全都路由到这里，也全都面对同一道标准——其中没有任何一个词构成降标准的理由。

本技能只拥有一个状态转换——sprint 文档 frontmatter `acceptance → merged`，并在同一动作里写入合并 commit hash——除此之外一无所有。上游，`supervibe:accept` 的 pass 正是解锁本门禁的东西；下游，只剩 `supervibe:roadmap close`（→closed，roadmap 的动作）与条款兑现（`supervibe:sync` 的）。途中任何停下都是报告，绝不是修复。

纪律是**遇红即停**：七个阶段固定顺序，阶段之间是硬停。sprint 是价值盒——它因 DoD 在 accept 处被证明、门禁此刻跑绿而收口，绝不因「该发布了」而收口。本技能绝不重新证明验收：裁决是 `supervibe:accept` 的，已在案；在这里它只被核对，不被重跑。零栈假设——gate 命令取自宿主 `### gates` 清单，一切路径取自宿主配置，合并机制归宿主。一个 sprint = 一 worktree/分支，自实体化至拆除。

本技能定稿的台账即 sprint 文档 frontmatter：`state` 与 `merged-commit`（自实体化起为 null）。这次翻转设定一个字段、填入另一个——两次写入，一次收口，绝不跨会话拆分。

## 读取宿主配置（Read host config）

任何动作之前，先在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 本技能读取的配置键：`sprints_dir`、`notes`；子节 `### gates` 与 `### doc_sync_map`。
- 键缺失时的默认值：`sprints_dir: docs/superpowers/sprints/`、`notes: .agents/notes/`。
- 该节整体缺失 → STOP：唯一合法的下一步是 `supervibe:roadmap scaffold`——指引过去，其余一律拒绝。
- 该节确认存在后，解析本技能涉及的已配置目录（`sprints_dir`、`notes`）并核实其存在。缺失 → STOP：指引用户运行 scaffold 或修正配置路径；绝不隐式创建工件——配置路径笔误绝不能静默分叉真源。
- `### gates` 在这里是必跑清单本身——与 accept 把它当命令来源不同：清单内每条命令都按配置原样运行。清单缺失或为空不是错误——记录「未配置任何门禁」后继续；绝不发明门禁填补沉默。
- `### doc_sync_map` 支撑下文阶段 1 的欠账终检。
- 本技能不消费任何模板——frontmatter 翻转遵循台账契约；收口条目遵循 notes 协议。

然后解析受收口的 sprint：

- 参数是 sprint id，绝非路径——参数给了路径 → 询问它所承载 sprint 的 id。
- 参数缺失 → 询问，列出 `sprints_dir` 中 frontmatter `state` 为 `acceptance` 的文档备选；绝不猜测。
- 扫 `sprints_dir` 内全部文档找 frontmatter `sprint` 匹配。没有匹配 → 拒绝，言明未知的 sprint id。
- 状态前置：`merged` → 拒绝：已收口——点名 frontmatter 携带的 `merged-commit`。`closed` → 拒绝：已退役；`supervibe:roadmap close` 已经来过。`active` / `acceptance` → 继续；裁决归阶段 2。`state` 缺失或无法识别 → 以畸形 sprint 文档拒绝并点名——封闭枚举绝不在未知取值上继续。
- 文档的 `worktree` frontmatter 记载承载本 sprint 的 worktree/分支——阶段 1、3、4 都在那里操作。`worktree` 空缺 → 文档畸形；点名拒绝：没有可跑门禁、可合入、可拆除的载体。
- `worktree` 指向一条已不存在的分支 → 揭穿这处过期、与用户确认之后才信任该字段——绝不静默继续。
- 每次运行只收口一个 sprint：并行 sprint 逐个收口，各自走完整序列。

## 有序序列，遇红即停（Ordered sequence, stop on red）

七个阶段严格排序。每个编号阶段都是硬停：绿 → 下一阶段；其余任何情况 → 运行当场结束——用户看到失败输出，sprint 原地不动，下游一概不跑。顺序把一切检查放在一切不可逆动作之前：门禁与裁决先于合并，合并先于拆除，拆除先于记录它的写入。红的意思是：gate 命令非零退出或输出与预期相悖；欠账存在；裁决不在案；冲突缺复核单。清红归执行层（gate 输出、doc-sync 欠账）或 `supervibe:accept`（裁决）；之后 merge 从阶段 1 重跑——跑了一半的绿什么也证明不了。

1. **门禁 + doc-sync 欠账终检。**
   - 按宿主 `### gates` 清单**逐条**运行命令，原样执行——整张清单，不做挑选。
   - 在 sprint 自己的环境里跑：即 frontmatter 记载的 worktree/分支、其栈存活——而不是别处的陈旧构建。对着昨天的工件跑绿的 gate 在合并时刻证明不了任何东西。
   - 任一红 → 停，展示失败命令的完整输出并点名该 gate。门禁红着 sprint 就不合并——没有部分分，没有替代：配置的命令要么运行，要么这个 gate 不算绿。
   - 然后做**欠账终检**——doc-sync 纪律两个检查点核验中的第二个（accept 周期审计漂移；merge 跑欠账终检）。
   - 枚举本 sprint 的变更路径：worktree 分支对其与 main 线 merge-base 的 diff，加上 sprint 文档 Stories & Tasks 点名的路径——与 accept 漂移审计同一套枚举；两个检查点必须看到同一个 sprint。
   - 对 `### doc_sync_map` 中 change 模式命中任一变更路径的行，按操作化方式核验：**分支范围**（merge-base..tip）内存在**同时**触碰该变更路径与被映射文档的 commit——文档的更新搭载在欠下该变更的同一 commit 里。在更晚的分支 commit 里更新的文档仍算欠账，直到两者被压合在一起。
   - 不存在这样的 commit → 欠账 → 停，点名该行、被映射文档与所欠内容。
   - 未命中的行不欠什么。映射缺失或为空即干净——记录之；绝不发明行。
   - 受认可的修复是在分支上 amend/rebase：合并**之前**允许改写分支历史——尚未有任何东西落地——让所欠文档与欠下它的变更落在同一 commit；然后本阶段重跑。merge 绝不自己动手写所欠文档，给自己的门禁刷绿。

2. **验收裁决在案。**
   - 绿的定义恰好是：sprint 文档 frontmatter 读作 `state: acceptance`，**且** frontmatter 证据链接点名的验收记录裁决为 `pass`。绝不只看状态翻转就读出裁决——打开被链接的记录并确认。
   - `active` → 从未验收：路由到 `supervibe:accept`。
   - 被链接记录 `blocked`、缺失或链接悬空 → 未完成。以证据链接引用的**最新**记录为准，没有后续 pass 的 blocked 记录保持 blocked：按记录点名的阻断项路由回执行层，之后重新验收。
   - 记录只增不改，同日重跑带区分性后缀——哪份记录作准由证据链接决定，绝不靠文件日期或新旧猜测：链接点名记录；记录说了算。

3. **合入 main。** 把本 sprint 的分支按此宿主合并的方式合入 main 线——fast-forward、merge commit 或 PR。遇冲突按 §2.5 清单解决，双路径：
   - **生成物（generated artifacts）** → 绝不手工合并：拿合并结果重新生成后比对。生成文件里的手改是要揭穿的坏味道，不是解决方案。
   - **手写文件（handwritten files）** → **解决任何冲突之前**先逐项列出复核单：逐冲突文件、逐 hunk——两侧意图与拟议解法。然后解决，并把复核单带进收口条目的 decisions 节——它存在的意义是让解决方案事后可审计。
   - 在合并重塑任何东西之前，先捕获 sprint 分支顶端——pre-merge hash：无论宿主的合并机制随后把 main 变成什么样，这个 hash 就是 `merged-commit`。它是下游一切环节读取的证据锚点（start 的依赖检查、sync 的条款兑现、roadmap 的 epic 收口）。
   - 无法解决的冲突 → 中止合并（`git merge --abort`）、停下、报告——绝不留下 MERGE_HEAD 或冲突标记：半合并的 main 线比未合并的 sprint 更糟。

4. **拆除 worktree/分支。** 仅在合并已落地之后——绝不提前：抢在合并前拆除等于遗弃 sprint 的载体。
   - 按宿主工具移除 worktree 及其分支。sprint 文档存续于 `sprints_dir`——台账比 worktree 活得久。
   - 拆除失败如实上报、照常修复，但什么也不回滚：合并已落地，阶段 5–7 无论如何都要记录这个事实。

5. **sprint 文档 frontmatter 定稿。**
   - 这些写入发生在 main 线检出上——worktree 此时已不在，阶段 4 已拆除——并以合并后 main 上的后续 commit 落地：`state: merged` 加 `merged-commit: <阶段 3 捕获的分支顶端 hash>`。
   - `merged-commit` 始终指向 sprint 分支顶端，即 pre-merge hash，即使拆除已移除该分支。PR 式宿主里分支随 PR 消失也不两样：趁它还在时捕获顶端；写入照样以同一方式落到 main 检出。
   - 追加日期 + 证据链接——链接即刚写入的 merge commit hash。整个阶段与合并本身属同一个收口动作。
   - 合并已落地而台账仍读 `acceptance` 是不完整的收口；翻了状态却没 hash 则是另一个方向的不完整。

6. **交接条款发射（fired）。**
   - 本 sprint 文档 Handover Clauses 节记录的每条条款自此对其目标 sprint **生效（binding）**。条款生命周期语义——登记、引用就位、迁移、触发、兑现——规范真源在 spec §2.2；本阶段只发射，没有任何东西要搬。
   - 在收口总结与收口条目的 handover 节言明生效效果——已发射的 HC# 及其目标。
   - **兑现（discharge）归 `supervibe:sync`，绝不在此**：本技能发射义务；绝不改写条款的 `status`。

7. **收口条目（closing note）。** 按四节 notes 协议写 `<notes>/YYYY-MM-DD-<sprint>-close.md`；文件名日期是今天，即收口日。
   - 四节：背景（本 sprint 交付了什么、如何收口）/ 决策（收口裁决：欠账、冲突解法、拆除）/ 教训（可复用的收口经验——gate 失败模式、冲突模式）/ 交接（已发射条款及其生效效果、本 sprint 进出的义务）。
   - 条目携带合并 commit hash 作为证据，并与验收记录互引——记录与收口条目互相引用。没有收口条目的 merged sprint 是不完整的。

七项全绿：sprint 已合并、台账已定稿、条款已生效、历史已落笔。剩下的环节都在本技能记录的东西上行动——→closed 与 epic 收口是 roadmap 的；条款兑现是 sync 的。

## Never（绝不做）

- 绝不在 gate 红着时合并，绝不带 doc-sync 欠账合并——任何红都停下运行；没有覆盖，没有豁免。
- 绝不在裁决缺失或不匹配时合并：状态 ≠ `acceptance`，或被链接记录 ≠ `pass`，即停。绝不改写验收记录或其裁决来给本门禁刷绿——记录只增不改，且只归 `supervibe:accept`。
- 绝不在此兑现交接条款——发射生效是本技能的动作；在签发方文档的条款记录里记证据并置 `discharged` 归 `supervibe:sync`。
- 绝不触碰 epic 文档的 Sprint Breakdown 桩行——roadmap 的领域；桩行自实体化起就是 `started`，不在 merge 时翻转。
- 绝不重排编号——sprint id 与 HC# 永远唯一。
- 绝不在合并落地前拆除 worktree 或分支。
- 绝不跳过或重排阶段——序列本身就是门禁。
