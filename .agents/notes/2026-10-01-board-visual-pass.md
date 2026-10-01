# 2026-10-01 · board 手工目检（Task 8）

分支 `2026-10-01-board`（worktree .claude/worktrees/board）。Playwright 加载
`web/board.html`（经 localhost 静态服务绕过 file:// 封锁；目录选择流程本身
须真浏览器手动验，注入等价于 picker 之后的 load() 调用）。

## dsh-enterprise docs/superpowers（1 epic + 7 sprint docs）

- E1 渲染：DoD 5/6、open Q 3 ——与真源一致（plan 预期 4/6 过时：S5 已于本日
  由另一会话收口 merged `f3f9cca5`，epic DoD 随之勾至 5；board 正确反映真源）
- 卡片归列：S1–S7 merged（doc），S8/S9 merged stub ⚠ smell，S10/S11 planned
- S5 卡 sub：`f3f9cca5（末波 W3；前波 W1a 3980891 / W2 ad57f9f / W1b 5ccdc53） · （已拆除） · HC ref×1`
  ——多波次 merged-commit 备注整串显示，frontmatter `clauses: [HC1]` 计入 ref 徽章
- S6 卡 sub：`88313f9 · （已拆除） · early-start · HC×1`
- S6 抽屉：HC1 字段/值竖表解析为条款表（1 行）；plan 链接 2 条
  （r36-w1-ux / r36-w2-ux），点击走复制路径兜底
- 警告条恰好两条 stub-no-doc（S8/S9）；无孤儿、无坏 frontmatter
- 截图：.playwright-mcp/board-dsh-e1.png（会话产物，不入库）

## supervibe worktree docs/superpowers（自举语料，无 sprints/ 目录）

- E1：DoD 5/5、open Q 6（Q2–Q7）
- S1 merged stub ⚠ smell（迷你收口无 sprint doc——spec 语义正确）、S2 planned stub
- 警告：missing-dir（sprints/ 为空）+ stub-no-doc（S1）——均按设计可见

## 结论

零渲染缺陷。发现的偏差全部是语料演进（S5 收口）导致的 plan 预期过时，
board 输出与真源一致。目录选择器/记住文件夹（Chromium handle）为
交互流程，留待用户日常使用时自然验证。
