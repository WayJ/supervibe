---
name: board
description: 当用户想把 roadmap 与 sprint 拆解作为可视化看板在浏览器中查看时使用。
---

# supervibe:board — 只读 roadmap 看板

生成零选择看板：用户打开页面内容已在——永远不需要选文件夹。

1. 定位插件 `web/` 目录：`<本技能基目录>/../../web`（随包分发
   `board.html`、`parser.js`、`build-data.mjs`）。
2. 宿主目标目录：`.agents/board/`（不存在则创建）。
3. 把 `web/board.html` 与 `web/parser.js` 拷入 `.agents/board/`。
4. 烘焙数据（roadmaps_dir 的上级，通常为 `docs/superpowers`，见宿主
   AGENTS.md 的 `## supervibe` 节）：
   `node <插件 web>/build-data.mjs <docs/superpowers> <宿主>/.agents/board/board-data.js`
5. 用默认浏览器打开 `<宿主>/.agents/board/board.html` —— Windows：
   `start "" "<路径>"`，macOS：`open`，Linux：`xdg-open`。烘焙数据自动
   加载；文件夹选择器仅作兜底。

刷新：重跑第 3–4 步（用户再说一次 看板/board）。烘焙副本是生成时快照——
页面的文件夹标签会注明。

边界：对工件只读；`.agents/board/` 是派生产物——建议宿主 gitignore，
严禁把宿主数据拷回插件仓。看板渲染问题（缺列、表格未解析）是页面警告条
里呈现的数据异味（data smell）——报告它们，不要改文件去消音。
