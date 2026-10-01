---
name: sync
description: 当用户说 sync、pull main、update branches 或 integrate upstream changes 时使用。
argument-hint: [sprint-id|all]
---

# supervibe:sync — 同步节拍 + 条款兑现（cadence + clause discharge）

节拍入口：按节奏（而非仅事件驱动）把 `origin/main` merge 进在途 sprint（spec §2.5——并行 sprint 会静默漂移，固定同步节拍正是漂移的围栏）。「pull main」「update branches」都路由到这里，也全都面对同一道标准。集成之外，是其他技能都不拥有的两项跨 sprint 职责：把交接条款对照入站变更核查，以及兑现目标方此刻已验证的那些条款。

除自身的 merge 外，本技能只拥有一个变更动作：在签发方文档的条款记录处置 `status: discharged`。没有 sprint 状态转换——每一次 `state` 翻转都归 roadmap/accept/merge——也不创建任何文档。这里执行的 merge 只是对 sprint 分支的普通集成，绝不是 `supervibe:merge` 的收口合并。零栈假设：一切路径取自宿主配置；merge 机制归宿主。

一次运行的产出就是报告：逐 sprint——集成了什么、冲突了什么及如何解决、哪些义务被触发、其中哪些凭证据收口。默默合并而什么都不报告的 sync 只做了一半工作——报告正是下一次 accept、merge 或 sync 要读的东西。

## 读取宿主配置（Read host config）

任何动作之前，先在宿主 AGENTS.md 中 grep `## supervibe` 节：

- 本技能读取的配置键：`sprints_dir`。
- 键缺失时的默认值：`sprints_dir: docs/superpowers/sprints/`。
- 该节整体缺失 → STOP：唯一合法的下一步是 `supervibe:roadmap scaffold`——指引过去，其余一律拒绝。
- 该节确认存在后，解析本技能涉及的已配置目录（`sprints_dir`）并核实其存在。缺失 → STOP：指引用户运行 scaffold 或修正配置路径；绝不隐式创建工件——配置路径笔误绝不能静默分叉真源。
- 本技能不消费任何模板——条款记录本就存放在它读取的各签发方 sprint 文档里。
- `### gates` 的 gate 命令不是本技能的事——门禁约束在 accept 与 merge；集成一条都不跑。

然后解析目标：

- 参数是 sprint id 或 `all`，绝非路径——参数给了路径 → 询问它所承载 sprint 的 id。
- 参数缺失 → 询问，列出 `sprints_dir` 中 frontmatter `state` 为 `active` 或 `acceptance` 的文档备选；绝不猜测。
- sprint id → 扫 `sprints_dir` 全部文档的 frontmatter `sprint` 字段求匹配；无匹配 → 拒绝，点名该未知 sprint id。
- 可介入的状态：`active` / `acceptance` → 继续。`merged` / `closed` → 跳过并在报告中点名——已没有可集成的载体。`state` 缺失或无法识别 → 在报告中揭穿该畸形文档并跳过；绝不猜测状态。
- `all` 的语义恰好是 active+acceptance 集合，不再更宽——绝不含 merged，绝不含 closed。该集合为空 → 没有在途线：报告后停止——空集上的 `all` 是无操作，不是错误。
- 每个目标各走完整序列——merge、冲突复核清单、条款核查、兑现——并各得一份报告。红结束的是那个 sprint 的集成，绝不是整轮运行：其余目标照样同步，各自出各自的报告。

## 节拍合并（Cadence merge）

逐目标 sprint，在它自己的载体里：

- 在 sprint 自己的 worktree 里操作——即文档 `worktree` frontmatter 记载的那个；一个 sprint = 一 worktree/分支，且分支就是 merge 目标。绝不在别处的陈旧检出上集成。
- `worktree` 指向一条已不存在的分支 → 揭穿这处过期、与用户确认之后才信任该字段——绝不静默继续。
- worktree 里有未提交变更 → 揭穿它们，让用户先 commit 或 stash：集成绝不与在途编辑混载，而落在脏工作区里的冲突会把两者纠缠到无法复核。
- 先刷新 `origin/main`，并在**合并之前**捕获入站区间：merge-base(sprint 分支, origin/main)..origin/main 顶端。下文条款核查 diff 的正是这个区间——合并之后 base 会移动，区间就读空了。
- 按此宿主合并的方式把 `origin/main` merge 进 sprint 分支，并在报告中点名产生的 merge commit。main 上没有新东西 → merge 是无操作；记录 up-to-date，条款核查照跑——空入站 diff 只是不会触发任何触发器。
- 验证集成结果是 sprint 自己的 accept/merge 领域：本技能集成并报告，绝不跑 gate 或场景。
- 它不写 sprint 文档台账的任何东西——不碰 `state`、不碰字段、不翻转——也绝不 rebase 或改写 sprint 分支历史：受认可的改写面（收口前欠账修复）是 merge 的阶段 1，不在这里。

## 冲突复核清单（Conflict re-verify checklist）

遇冲突，按 spec §2.5 对每条冲突路径双路径分类：

- **生成物（generated artifacts）** → 绝不手工合并：拿合并结果重新生成后比对。生成文件里的手改是要揭穿的坏味道，不是解决方案。
- **手写文件（handwritten files）** → **解决任何冲突之前**先逐项列出复核单：逐冲突文件、逐 hunk——两侧意图与拟议解法。然后解决，并把复核单带进报告——它存在的意义是让解决方案事后可审计。
- 复核单按 sprint 分立：分开的集成，分开的复核单——绝不把两个 sprint 的冲突并成一份解法。
- 无法解决 → 中止合并（`git merge --abort`）、停下该 sprint 的同步、报告——绝不留下 MERGE_HEAD 或冲突标记：半合并的 sprint 分支比未同步的更糟。

## 交接条款核查（Handover clause check）

条款机制的读取侧——正文只活在签发方文档，别处只有引用：

- 扫 `sprints_dir` 内全部文档的 frontmatter `clauses` 引用列表；目标 sprint 自己的列表点名的是它**所欠**的条款——它是目标方。
- 逐 HC# 沿引用链解析：
  1. 扫全部 sprint 文档的 `## Handover Clauses` 节找携带该 id 的记录——其节持有记录的那份文档即签发方文档。
  2. 从该记录读取 `{target, trigger, obligation, status, evidence}`，别处不取——`{id HC#、target、trigger、obligation、status: open|discharged、evidence}` 只活在那里。
  3. 引用解析不到任何记录 → 作为悬空引用揭穿；绝不猜测，绝不造一条记录去凑。Id 分配（max+1；空扫描从 1 起）归 `supervibe:start`——本技能只读取既有 id。
- 记录已是 `discharged` → 义务已履行；报告中列为 discharged 后继续。
- 把捕获的入站区间对照每条 open 条款的 trigger diff：路径型 trigger 匹配区间内变更的路径；特性型 trigger 匹配入站 commit 的范围——subject 与 body 点名该特性。命中 → **逐字（verbatim）**呈现义务——签发方文档的义务正文，原样不改动——即使本轮无法兑现也要呈现：义务文本在触发器命中时就到达用户，而不是等到它能收口时。
- trigger 只对照入站区间匹配——绝不对目标自己的工作或它更早的集成匹配：义务在签发方的变更自 main 抵达时触发，别的什么都不触发它。
- 生效（binding）：条款自签发方 sprint 合并起对其目标生效（merge 在其阶段 6 发射）。签发方文档 frontmatter 读作 `merged` 或更后 → 生效；签发方未合入的条款作为尚未生效呈现——是信息，不是义务——也绝不被兑现。
- 未命中 → 条款保持 open；本轮不欠什么。同步后仍 open 是正常状态，不是失败。

## 条款兑现（Discharge）

写入侧——本技能拥有的唯一变更动作：

- 兑现需要两者兼备：触发器本轮命中，**且**义务已在目标方验证、证据在手——sprint 分支内的 commit hash，或一份验证 transcript（命令 + 观察到的输出）。预期不是证据；标准就是 accept 的标准。
- 已验证 → 在**签发方文档的条款记录**处置 `status: discharged`——单一权威——并向同一记录追加日期 + 证据链接。签发方文档可以属于另一个 epic 或波次——跨 sprint 是它的构造本性；写入就落在那里，无论它在哪。绝不改写目标的引用列表来伪造收口：引用比它所指的义务活得久，收口状态只从签发方记录读取，别处不认。
- 兑现写入只触碰 `status`、日期与证据链接——绝不触碰 trigger 或义务正文：义务要么按写下的样子收口，要么保持 open。
- 尚不可验证 → 部分：条款保持 open，报告原因——查了什么、缺什么证据。它在之后的某次 sync 兑现；在目标方 merge 时已发生的验证（merge 发射并核实，但绝不写条款状态）由下一次 sync 凭那份证据记录。
- 逐 sprint 报告：集成结果（merge commit / up-to-date / aborted）、带复核单的冲突清单，以及条款表——open、本轮兑现（附证据链接）、已兑现、悬空。

## Invariants（不变量）

- 本技能只拥有条款兑现——没有 sprint 状态转换、不创建文档、不跑 gate。
- 签发方文档的条款记录是唯一的条款写入面；目标的引用列表任何人出于任何理由都不改。
- 只凭证据兑现——触发器命中且义务已验证——绝不凭预期，绝不对尚未生效的条款。
- HC# id 在这里只被读取，绝不分配、绝不重排、绝不发明。
- 每次变更——一次兑现——都携带日期 + 证据链接。
- 每次运行逐 sprint 报告集成了什么、还剩什么 open——没有报告的 sync 是不完整的。
- sync 绝不让 sprint 分支停留在半合并状态：merge 要么完成、要么干净中止。
- sprint 文档台账绝不被触碰：sync 做集成，不做裁决。
