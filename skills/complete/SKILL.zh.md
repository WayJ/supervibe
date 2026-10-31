---
name: complete
description: 当用户说 complete、close out、ship、finish 或 wrap up 一个 sprint 时使用。
argument-hint: <sprint-id>
---

# supervibe:complete — sprint 收口（sprint close-out）

sprint 收口——一个 sprint 的最后一幕：跑门禁、核实验收裁决在案、合入 main、定稿 sprint 台账、拆除 worktree、发射交接条款、写收口条目。「ship」「finish」「wrap up」全都路由到这里，也全都面对同一道标准——其中没有任何一个词构成降标准的理由。

本技能只拥有一个状态转换——共享台账 `acceptance → merged`，并在同一动作里写入合并 commit hash——除此之外一无所有。上游，`supervibe:accept` 的 pass 正是解锁本门禁的东西——而最便宜的窗口就是同一会话：pass 之后立即跑 complete，可缩短漂移窗口，但不能免除指纹校验。下游，只剩 `supervibe:roadmap close`（→closed，roadmap 的动作）与条款兑现（`supervibe:sync` 的）。途中任何停下都是报告，绝不是修复。

纪律是**遇红即停**：七个阶段固定顺序，阶段之间是硬停。sprint 是价值盒——它因 DoD 在 accept 处被证明、门禁此刻跑绿而收口，绝不因「该发布了」而收口。本技能绝不重新证明验收：裁决是 `supervibe:accept` 的，已在案；在这里它只被核对，不被重跑。零栈假设——gate 命令取自宿主 `### gates` 清单，一切路径取自宿主配置，合并机制归宿主。一个 sprint = 一 worktree/分支，自实体化至拆除。

本技能先在共享台账记录实际落地，再把 state 与 merged-commit 投影到 Markdown。投影滞后是可恢复的不一致，不能用分支副本覆盖共享权威。

## 共享运行权威（Shared runtime authority）

读取 `<plugin base dir>/docs/shared-ledger.md`。在宿主仓库根目录运行
`node "<plugin base dir>/scripts/shared-ledger.mjs" status`，将目标 sprint 与
共享条目核对。common-dir 存储而非 Markdown 拥有运行状态和 WIP；下文的
frontmatter 检查均是投影检查。无存储就停止，显式 init/import。用 doctor
诊断载体或投影漂移，不从分支副本静默恢复权威。下文每个变更均传入
`--id <sprint-id> --revision <当前版本> --operation <唯一操作 ID>`；新动作
先重读 status，不确定结果的同请求重试沿用同 ID。绝不手改存储。


## 读取宿主配置（Read host config）

在宿主仓库根目录运行 `node "<plugin base dir>/scripts/host-config.mjs" --require-dir sprints_dir --require-dir notes`，使用返回的路径、WIP、原序原样 gates 与映射；非零即停止并展示错误，缺配置/目录仅显式 scaffold 或修正，不自行建目录。roadmap 的 scaffold 可先处理缺配置，其他子命令用 `--require-dir <涉及的目录键>` 验证目录。模板始终从插件目录读取。规则与默认值见[机械预检](../../docs/mechanical-preflight.md)，不再手工 grep/补默认。映射同样约束本技能写出的工件。 阶段 1 来源预检通过后才按返回顺序运行全部 gate，空列表如实记录。

然后解析受收口的 sprint。**普通状态/门禁检查之前，先按「中断与续跑」检查是否已经合并落地，不论载体是否仍存在。**恢复只记录有证据的落地，不授权新合并：

- 参数是 sprint id，绝非路径——参数给了路径 → 询问它所承载 sprint 的 id。
- 参数缺失 → 询问，列出 `sprints_dir` 中 frontmatter `state` 为 `acceptance` 的文档备选；绝不猜测。
- 通过 `artifact-inventory.mjs --sprint "<sprint-id>"` 的唯一 `selection` 解析身份；非零报告 `issues`，不重新手工扫描。complete 已落地恢复先走专用恢复协议，不因缺 carrier 另造载体。
- 状态前置：`merged` → 拒绝：已收口——点名 frontmatter 携带的 `merged-commit`。`closed` → 拒绝：已退役；`supervibe:roadmap close` 已经来过。`active` / `acceptance` → 继续；裁决归阶段 2。`state` 缺失或无法识别 → 以畸形 sprint 文档拒绝并点名——封闭枚举绝不在未知取值上继续。
- 文档的 `worktree` frontmatter 记载承载本 sprint 的 worktree/分支——阶段 1、3、5 都在那里操作。`worktree` 空缺 → 文档畸形；点名拒绝：没有可跑门禁、可合入、可拆除的载体。
- `worktree` 指向一条已不存在的分支 → 揭穿这处过期、与用户确认之后才信任该字段——绝不静默继续。
- 每次运行只收口一个 sprint：并行 sprint 逐个收口，各自走完整序列。

## 有序序列，遇红即停（Ordered sequence, stop on red）

七个阶段严格排序。每个编号阶段都是硬停：绿 → 下一阶段；其余任何情况 → 运行当场结束——用户看到失败输出，sprint 原地不动，下游一概不跑。顺序把一切检查放在一切不可逆动作之前：门禁与裁决先于合并，合并先于记录它的台账，台账先于拆除——载体只在落地记录存在之后才被销毁。红的意思是：gate 命令非零退出或输出与预期相悖；欠账存在；裁决不在案；冲突缺复核单。清红归执行层（gate 输出、doc-sync 欠账）或 `supervibe:accept`（裁决）；之后 complete 从阶段 1 重跑——跑了一半的绿什么也证明不了。

1. **来源预检、门禁 + doc-sync 欠账终检。**
   - 任何门禁缓存或运行之前，先在 sprint 仓库根目录运行 `node "<plugin base dir>/scripts/validate-workflow.mjs" verify-clean --sprint "<sprint-doc>" --record "<acceptance-record>"`，记录路径取自 sprint frontmatter 的 `acceptance-record`。非零 → 停止，路由完整 `supervibe:accept`；仅重跑 gates 不能刷新场景裁决。旧记录缺证据块必须重验，不能手写指纹补绿。
   - complete 前提交全部受审内容、验收记录与评审元数据，sprint 文档与验收记录必须被 Git 跟踪（忽略的记录不能授权合并）；提交不变内容不会改变指纹。`verify-clean` 拒绝暂存、未暂存和未忽略的未跟踪变更，防止受审工作文件与将合并的分支不同。校验器要求 `state: acceptance`、明确且匹配的记录指针、`pass` 裁决，以及匹配的 `supervibe-evidence` 快照。只排除该验收记录自身及三个评审元数据字段，其他跟踪/未忽略输入均覆盖。检查只读，不修状态，也不证明场景曾运行。
   - 按宿主 `### gates` 清单**逐条**运行命令，原样执行——整张清单，不做挑选。
   - 在 sprint 自己的环境里跑：即 frontmatter 记载的 worktree/分支、其栈存活——而不是别处的陈旧构建。对着昨天的工件跑绿的 gate 在合并时刻证明不了任何东西。
   - **门禁证据短路（gate-evidence short-circuit）**：验收记录里的门禁证据块——运行时的分支 tip hash、按原样跑过的 gates 清单、绿的输出——当且仅当分支 tip 现在仍等于记录的 hash、且宿主 gates 清单与记录的逐字节一致时，满足本阶段：tip 没动，意味着那份绿正是对着这棵树挣来的。任何不一致——新 commit、清单变了、没有证据块——都是全量原样重跑。短路是机械等价，绝不是判断。
   - 任一红 → 停，展示失败命令的完整输出并点名该 gate。门禁红着 sprint 就不合并——没有部分分，没有替代：配置的命令要么运行，要么这个 gate 不算绿。
   - 欠账终检：使用 accept 同一组参数运行 `doc-sync.mjs`（见[机械预检](../../docs/mechanical-preflight.md)），非零即停止并展示逐行提交/路径欠账。映射为空则如实记录。不得自行重做 glob、merge-base 或同提交判断。
   - 受认可的修复是在分支上 amend/rebase：合并**之前**允许改写分支历史——尚未有任何东西落地——让所欠文档与欠下它的变更落在同一 commit；然后本阶段重跑。complete 绝不自己动手写所欠文档，给自己的门禁刷绿。

2. **验收裁决在案。**
   - 绿的定义恰好是：sprint 文档 frontmatter 读作 `state: acceptance`，**且** frontmatter 证据链接点名的验收记录裁决为 `pass`。绝不只看状态翻转就读出裁决——打开被链接的记录并确认。
   - `active` → 当前未通过验收（也包括已撤销/返工的评审）：路由到 `supervibe:accept`。
   - 所有 gates 完成后、合并前立即再跑来源校验，再运行 `node "<plugin base dir>/scripts/shared-ledger.mjs" check --id "<sprint-id>"`。它要求共享 acceptance 与已存受验 HEAD 完全一致，而非只看 Markdown pass。任意输入变化（包括 gate 生成的跟踪文件）都要求完整重验。即使 gates 此刻全绿，其他树上的 pass 仍已过期。
   - 被链接记录 `blocked`、缺失或链接悬空 → 未完成。以证据链接引用的**最新**记录为准，没有后续 pass 的 blocked 记录保持 blocked：按记录点名的阻断项路由回执行层，之后重新验收。
   - 记录只增不改，同日重跑带区分性后缀——哪份记录作准由证据链接决定，绝不靠文件日期或新旧猜测：链接点名记录；记录说了算。

3. **合入 main。** 先刷新实际目标 main，要求它是已验证 sprint 候选的祖先。否则停止，经 `supervibe:sync` 集成；指纹变化则重验，再从头运行 complete。固定落地的目标与候选 commit；任一移动即停止并重复检查。宿主具备保护/条件合并机制时使用它；只读校验器不能让远端合并竞态原子化，绝不声称可以。
   - 按宿主方式（fast-forward、merge commit 或 PR）落地已经验证的结果。落地时禁止未经验证的代码冲突解决。任何冲突或候选改变都回 sync/执行、完整 accept、complete 阶段 1；本地冲突合并须 abort。§2.5 双路径复核单属于那次集成，不是免除重验的理由：
   - **生成物（generated artifacts）** → 绝不手工合并：拿合并结果重新生成后比对。生成文件里的手改是要揭穿的坏味道，不是解决方案。
   - **手写文件（handwritten files）** → **解决任何冲突之前**先逐项列出复核单：逐冲突文件、逐 hunk——两侧意图与拟议解法。然后解决，并把复核单带进收口条目的 decisions 节——它存在的意义是让解决方案事后可审计。
   - 合并落地之后，捕获 **main 侧落点 commit（landing commit）**——main 实际收到的那笔 commit：fast-forward 下的新 main 顶端、merge commit 本身、或 squash/rebase 宿主落地的那笔 squash commit。该 commit 即 `merged-commit`，也是下游一切环节读取的证据锚点（start 的依赖检查、sync 的条款兑现、roadmap 的 epic 收口）。下游检查的是可达性——而 squash/rebase 宿主永远不会让分支顶端成为 main 的祖先，锚定在落点之外的任何地方都会静默掐断条款触发。
   - 无法解决的冲突 → 中止合并（`git merge --abort`）、停下、报告——绝不留下 MERGE_HEAD 或冲突标记：半合并的 main 线比未合并的 sprint 更糟。

4. **先记录共享落地，再定稿 sprint 投影。**
   - 在共享 Git 仓库内（恢复时不要求载体仍存在）用 ID/revision/operation 参数调用 `shared-ledger.mjs land --landing "<actual-landing-SHA>" --main "<main-ref>"`。--main 必须匹配已存 mainRef，解析本地主线分支 ref，校验候选/证据、落点可达性与树等价后，才将共享 acceptance → merged。成功后才投影下文字段。共享已 merged 而 Markdown 过期 → 只补投影，绝不再次合并。
   - 这些写入发生在 main 线检出上，以合并后 main 上的后续 commit 落地：`state: merged` 加 `merged-commit: <阶段 3 捕获的落点 commit>`。
   - 台账在载体拆除（阶段 5）**之前**记录落地：合并与拆除之间的中断绝不能留下一个既无记录又无载体的已落地 sprint——先记录，后销毁。
   - 追加日期 + 证据链接——链接即刚写入的落点 commit hash。整个阶段与合并本身属同一个收口动作。
   - 合并已落地而台账仍读 `acceptance` 是不完整的收口；翻了状态却没 hash 则是另一个方向的不完整。

5. **拆除 worktree/分支。** 仅在台账定稿之后——绝不提前：抢在记录前拆除等于遗弃 sprint 的载体并关死续跑路径。
   - 按宿主工具移除 worktree 及其分支。sprint 文档存续于 `sprints_dir`——台账比 worktree 活得久。
   - 拆除失败如实上报、照常修复，但什么也不回滚：合并已落地，台账（阶段 4）已把这个事实记下。

6. **交接条款发射（fired）。**
   - 本 sprint 文档 Handover Clauses 节记录的每条条款自此对其目标 sprint **生效（binding）**。条款生命周期语义——登记、引用就位、迁移、触发、兑现——规范真源在 spec §2.2；本阶段只发射，没有任何东西要搬。
   - 在收口总结与收口条目的 handover 节言明生效效果——已发射的 HC# 及其目标。
   - **兑现（discharge）归 `supervibe:sync`，绝不在此**：本技能发射义务；绝不改写条款的 `status`。

7. **收口条目（closing note）。** 按四节 notes 协议写 `<notes>/YYYY-MM-DD-<sprint>-close.md`；文件名日期是今天，即收口日。
   - 四节：背景（本 sprint 交付了什么、如何收口）/ 决策（收口裁决：欠账、冲突解法、拆除）/ 教训（可复用的收口经验——gate 失败模式、冲突模式）/ 交接（已发射条款及其生效效果、本 sprint 进出的义务）。
   - 条目携带合并 commit hash 作为证据，并与验收记录互引——记录与收口条目互相引用。没有收口条目的 merged sprint 是不完整的。

七项全绿：sprint 已合并、台账已定稿、条款已生效、历史已落笔。剩下的环节都在本技能记录的东西上行动——→closed 与 epic 收口是 roadmap 的；条款兑现是 sync 的。

## 中断与续跑（Interruption and resume）

半途停下的收口以重跑续接，重跑按已存在的东西路由——绝不重做不可逆动作：

- **先判定落地，再进入阶段 1 或目标 main 祖先前置**，不论 sprint 载体是否仍存在。`--no-ff` 合并可能已落地，而台账仍是 `acceptance`、worktree 也完整存在；此时 main 已前进到候选之后，误当新收口会错误要求 sync/重验。
- **合并未落地** → 没有任何不可逆的事发生；重跑从阶段 1 从头开始。
- **状态仍 `acceptance`、合并已落地，载体存在或缺失均适用** → 结合原始候选、验收证据和 Git/PR 记录核实 main 侧实际落点。merge commit 检查父提交及候选可达性；fast-forward 辨认实际落地候选。仅可达、却无法辨认本次收口的落点，不足以作证。squash/rebase 或 main 日志有歧义 → 辨认 PR/落点映射并与用户确认，绝不猜。核实后捕获落点，直接从阶段 4 续跑（共享 acceptance 则 land，共享已 merged 则只修投影），再拆除并完成剩余记录。绝不重复合并，也不因已落地 merge commit 位于候选之后就强制 sync 或重新验收。无法核实 → 停下报告；疑似落地不能凭假设变成 `merged`。
- **PR 式宿主，阶段 3 停在「PR 已开」** → 报告后停止；重跑读 PR 状态：仍开 → 报告等待；已合 → 捕获落点 commit，自阶段 4 续跑；未合而关 → 收口作废——回到阶段 1。
- **共享台账已写、投影/拆除或更后未做** → 状态前置会拒绝重跑（`merged` = 已收口）：言明只剩拆除、条款发射或收口条目，直接补完——它们是记录，不是重新裁决。

## Never（绝不做）

- 绝不在 gate 红着时合并，绝不带 doc-sync 欠账合并——任何红都停下运行；没有覆盖，没有豁免。
- 绝不在来源证据过期/缺失或冲突解决未经重验时合并。
- 绝不在裁决缺失或不匹配时合并：状态 ≠ `acceptance`，或被链接记录 ≠ `pass`，即停。绝不改写验收记录或其裁决来给本门禁刷绿——记录只增不改，且只归 `supervibe:accept`。
- 绝不在此兑现交接条款——发射生效是本技能的动作；在签发方文档的条款记录里记证据并置 `discharged` 归 `supervibe:sync`。
- 绝不触碰 epic 文档的 Sprint Breakdown 桩行——roadmap 的领域；桩行自实体化起就是 `started`，不在 merge 时翻转。
- 绝不重排编号——sprint id 与 HC# 永远唯一。
- 绝不在合并落地且台账定稿之前拆除 worktree 或分支。
- 绝不跳过或重排阶段——序列本身就是门禁。
