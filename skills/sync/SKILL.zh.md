---
name: sync
description: 当用户说 sync、pull main、update branches 或 integrate upstream changes 时使用。
argument-hint: [sprint-id|all]
---

# supervibe:sync — 同步节拍 + 条款兑现（cadence + clause discharge）

节拍入口：按节奏（而非仅事件驱动）把 `origin/main` merge 进在途 sprint（spec §2.5——并行 sprint 会静默漂移，固定同步节拍正是漂移的围栏）。「pull main」「update branches」都路由到这里，也全都面对同一道标准。集成之外，是其他技能都不拥有的两项跨 sprint 职责：把交接条款对照入站变更核查，以及兑现目标方此刻已验证的那些条款。

除自身的 merge 外，本技能只拥有一个变更动作：在签发方文档的条款记录处置 `status: discharged`。没有 sprint 状态转换——每一次 `state` 翻转都归 roadmap/accept/merge——也不创建任何文档。这里执行的 merge 只是对 sprint 分支的普通集成，绝不是 `supervibe:merge` 的收口合并。具名一个 merged 或 closed 的 sprint 时，只跑条款这一侧——条款生命周期不在载体拆除处死路。零栈假设：一切路径取自宿主配置；merge 机制归宿主。

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
- sprint id → 扫 `sprints_dir` 内全部文档找 frontmatter `sprint` 匹配。没有匹配 → 拒绝，言明未知的 sprint id。
- 可介入的状态：`active` / `acceptance` → 完整序列——merge、冲突复核清单、条款核查、兑现。`merged` / `closed` 被具名 → 只跑条款核查 + 兑现通道，不 merge：文档存续于 main 上的 `sprints_dir`，可能仍带 open 条款引用，且验证可能落在目标自身 merge 之时或之后——条款生命周期不能在那里死路。`all` 之下跳过 merged/closed——`all` 的语义恰好是 active+acceptance 集合，不再更宽。`state` 缺失或无法识别 → 在报告中揭穿该畸形文档并跳过；绝不猜测状态。
- `all` 在空的 active+acceptance 集合上 → 没有在途线：报告后停止——空集上的 `all` 是无操作，不是错误。
- 每个目标各得一份报告。红结束的是那个 sprint 的集成，绝不是整轮运行：其余目标照样同步，各自出各自的报告。

## 节拍合并（Cadence merge）

逐在途目标 sprint，在它自己的载体里：

- 在 sprint 自己的 worktree 里操作——即文档 `worktree` frontmatter 记载的那个；一个 sprint = 一 worktree/分支，且分支就是 merge 目标。绝不在别处的陈旧检出上集成。
- `worktree` 指向一条已不存在的分支 → 揭穿这处过期、与用户确认之后才信任该字段——绝不静默继续。
- worktree 里有未提交变更 → 揭穿它们，让用户先 commit 或 stash：集成绝不与在途编辑混载，而落在脏工作区里的冲突会把两者纠缠到无法复核。
- 先刷新 `origin/main`，并在**合并之前**捕获入站区间：merge-base(sprint 分支, origin/main)..origin/main 顶端——并保留区间的**两份**产物：commit 清单（subject + body）与变更路径清单——路径型 trigger 读一份，特性型 trigger 读另一份。下文条款核查读的正是这个区间——合并之后 base 会移动，区间就读空了。
- 按此宿主合并的方式把 `origin/main` merge 进 sprint 分支，并在报告中点名产生的 merge commit。main 上没有新东西 → merge 是无操作；记录 up-to-date，条款核查照跑——本轮没有新抵达，但在欠的义务仍在欠、仍要查。
- 验证集成结果是 sprint 自己的 accept/merge 领域：本技能集成并报告，绝不跑 gate 或场景。
- 它不写 sprint 文档台账的任何东西——不碰 `state`、不碰字段、不翻转——也绝不 rebase 或改写 sprint 分支历史：受认可的改写面（收口前欠账修复）是 merge 的阶段 1，不在这里。

## 冲突复核清单（Conflict re-verify checklist）

遇冲突，按 spec §2.5 对每条冲突路径双路径分类：

- **生成物（generated artifacts）** → 绝不手工合并：拿合并结果重新生成后比对。生成文件里的手改是要揭穿的坏味道，不是解决方案。
- **手写文件（handwritten files）** → **解决任何冲突之前**先逐项列出复核单：逐冲突文件、逐 hunk——两侧意图与拟议解法。然后解决，并把复核单带进报告——它存在的意义是让解决方案事后可审计。
- 复核单按 sprint 分立：分开的集成，分开的复核单——绝不把两个 sprint 的冲突并成一份解法。
- 无法解决 → 中止合并（`git merge --abort`）、停下该 sprint 的同步、报告——绝不留下 MERGE_HEAD 或冲突标记：半合并的 sprint 分支比未同步的更糟。

## 交接条款核查（Handover clause check）

条款机制的读取侧——正文只活在签发方文档，别处只有引用。生命周期语义的规范真源在 spec §2.2；本节是它的操作化——措辞冲突时以 spec 为准。

- 读目标 sprint 文档自己的 frontmatter `clauses` 字段——它点名本 sprint **所欠**的条款；别的文档的列表不是这个目标的事。字段为空 → 无所欠；把干净的无操作报告出来。
- 逐 HC# 沿引用链解析：
  1. 扫全部 sprint 文档的 `## Handover Clauses` 节找携带该 id 的记录——其节持有记录的那份文档即签发方文档。
  2. 从该记录读取 `{id HC#、target、trigger、obligation、status: open|discharged、evidence}`，别处不取——条款正文只活在那里。
  3. 引用解析不到任何记录 → 作为悬空引用揭穿；绝不猜测，绝不造一条记录去凑。id 在此处只读；分配归 `supervibe:start`（spec §2.2）。
- 记录已是 `discharged` → 义务已履行；报告中列为 discharged 后继续。
- **触发 = 抵达（arrival），绝非本轮区间**：当签发方 sprint 的 `merged-commit` 已可从目标的载体到达时，条款即对该目标触发——在途目标：对其分支做祖先检查；兑现通道中的 merged 目标：按 main 上的可达性判定（两个 sprint 都已落在 main；若签发方合并在目标之后，条款迟到——仍触发、仍欠着）。抵达无论多久以前都算数——欠了三轮同步的义务仍在欠——且绝不因目标自身的工作而触发：签发方 commit 只可能自 main 抵达。
- 每条已触发且 open 的条款都**逐字（verbatim）**呈现其义务——签发方文档的义务正文，原样不改动——即使本轮无法兑现也要呈现：义务文本在它被欠上时就到达用户，而不是等到它能收口时。
- 捕获的入站区间是报告层，绝不是检测门：抵达落进区间内的义务以 fresh 呈现，更早的抵达以 standing 呈现——两者都呈现、都核查。兑现通道不捕获区间；它所持有的一切都是 standing。
- 在该报告层内，把 trigger 对照区间产物匹配：路径型 trigger 匹配变更路径清单；特性型 trigger 匹配 commit 清单——subject 与 body 点名该特性。无法确定特性是否被点名 → 按命中处理：呈现很便宜，漏掉义务不便宜。此处的命中与否只标注报告（fresh 与 standing 之分）——检测本身是抵达式的，上文的逐字呈现不受影响。
- 生效（binding）：条款自签发方 sprint 合并起对其目标生效（merge 在其阶段 6 发射）。签发方文档 frontmatter 读作 `merged` 或更后 → 生效；签发方未合入的条款作为尚未生效呈现——是信息，不是义务——也绝不被兑现。
- 尚未抵达 → 还不欠什么；把条款报告为正在等待签发方 sprint 的合并或其抵达目标载体。

## 条款兑现（Discharge）

写入侧——本技能拥有的唯一变更动作：

- 兑现需要两者兼备：条款已触发（抵达，见上），**且**义务已在目标方验证、证据在手——sprint 分支内的 commit hash（merged 目标则在 main 上），或一份验证 transcript（命令 + 观察到的输出）。预期不是证据；标准就是 accept 的标准。
- 写入位置：签发方文档活在 **main** 上——它的 sprint 已 merged，条款正因此生效——所以兑现写入发生在 main 线检出上、以一笔独立的后续 commit 落地，与 merge 阶段 5 写台账定稿的位置完全一致。它绝不搭载目标的 sprint 分支，也绝不留下脏工作区。
- 已验证 → 在**签发方文档的条款记录**处置 `status: discharged`——单一权威——并向同一记录追加日期 + 证据链接。写入落在签发方文档，无论它身在哪个 epic 或波次（跨 sprint 是它的构造本性）；目标的引用列表绝不被改写来伪造收口——规范真源在 spec §2.2。
- 兑现写入只触碰 `status`、日期与证据链接——绝不触碰 trigger 或义务正文：义务要么按写下的样子收口，要么保持 open。
- 尚不可验证 → 部分：条款保持 open，报告原因——查了什么、缺什么证据。它在之后的某次 sync 兑现；在目标方 merge 之时产出的验证（merge 负责发射；验证由目标方产出——而 merge 绝不写条款状态）由下一次 sync 凭那份证据记录。
- 逐 sprint 报告：集成结果（merge commit / up-to-date / aborted / 仅条款通道）、带复核单的冲突清单，以及条款表——open、本轮兑现（附证据链接）、已兑现、等待抵达、悬空。

## Invariants（不变量）

- 本技能只拥有条款兑现——没有 sprint 状态转换、不创建文档、不跑 gate。
- 签发方文档的条款记录是唯一的条款写入面；目标的引用列表任何人出于任何理由都不改。
- 只凭证据兑现——已触发且已验证——绝不凭预期，绝不对尚未生效的条款。
- 检测基于抵达；入站区间只报告新鲜度，绝不是核查的门。
- 目标文档找不到的条款 → 在报告中揭穿——引用比它的文档活得久——绝不静默丢弃。
- HC# id 在这里只被读取，绝不分配、绝不重排、绝不发明。
- 每次变更——一次兑现——都携带日期 + 证据链接。
- 每次运行逐 sprint 报告集成了什么、还剩什么 open——没有报告的 sync 是不完整的。
- sync 绝不让 sprint 分支停留在半合并状态：merge 要么完成、要么干净中止。
- sprint 文档台账绝不被触碰：sync 做集成，不做裁决。
