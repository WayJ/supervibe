---
name: board
description: 当用户想把 roadmap 与 sprint 拆解作为可视化看板在浏览器中查看时使用。
---

# supervibe:board — 只读 roadmap 看板

在用户浏览器中打开插件自带的静态看板。

1. 定位 HTML：`<本技能基目录>/../../web/board.html`（插件随包分发
   `web/board.html` + `web/parser.js`）。
2. 用默认浏览器打开 —— Windows：`start "" "<路径>"`，macOS：`open "<路径>"`，
   Linux：`xdg-open "<路径>"`。
3. 告知用户：在页面中选择宿主配置的 `roadmaps_dir` 上级目录——通常是
   `docs/superpowers`（见宿主 AGENTS.md 的 `## supervibe` 节）。Chromium 下
   「记住此文件夹」可免于重复选择。

只读：本技能不写工件、不翻状态、不碰台账。看板渲染问题（缺列、表格未解析）
是页面警告条里呈现的数据异味（data smell）——报告它们，不要改文件去消音。
