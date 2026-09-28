# 胡政的学习笔记

一个公开的学习笔记站：每天学什么，按时间线看全。纯 HTML/CSS/原生 JS，笔记用 Markdown 写、Git 提交即发布。

> 需求依据见 `PRD.md`，技术路线见 `TECH_DESIGN.md`。

## 本地运行（Day 7 版）

**重要：不能直接双击 `index.html` 打开**——页面用 JS 拉取 `notes/` 目录下的 Markdown 文件，双击打开（`file://` 协议）会被浏览器安全策略拦住，页面会一直显示"笔记加载中"。必须先起一个本地服务器。

方式一（推荐，电脑装过 Python 即可用）：

```bash
# 1. 进入项目目录（my-website 文件夹）
# 2. 启动本地服务器
python -m http.server 8000
# 3. 浏览器打开
#    http://localhost:8000
# 4. 停止服务器：在终端按 Ctrl + C
```

方式二（装过 Node.js 的话）：

```bash
npx serve .
# 按提示打开它给出的 http://localhost:xxxx 地址
```

## 怎么算跑起来了（对照验收标准）

| 检查点 | 对应标准 |
|---|---|
| 打开就能看到 4 篇笔记卡片，最新日期在最上 | AC-1 |
| 每张卡片有日期、标题、标签、摘要 | AC-2 |
| 点击卡片展开正文，列表/代码块渲染正常，再点收起 | AC-3 |
| 点标签栏「Git」「产品」等，列表只剩该标签笔记；点「全部」恢复 | AC-4 |
| 页面底部有自我介绍、学习目标、GitHub 链接 | AC-5 |
| 手机宽度（开发者工具切 375px）无横向滚动 | AC-6 |
| 点一个没有笔记的标签（暂无，加新标签可试）显示空状态提示 | AC-7 |

## 如何发布一篇新笔记

1. 在 `notes/` 目录新建一个 `.md` 文件，头部按固定格式写四行字段：

   ```markdown
   ---
   date: 2026-09-28
   title: 笔记标题（≤30字）
   tags: 标签1、标签2
   summary: 一句话摘要（≤50字）
   ---
   正文用 Markdown 写。
   ```

2. 打开 `app.js`，在顶部 `NOTE_FILES` 清单里加一行新文件名。
3. `git add` + `commit` + `push`，GitHub Pages 上线后即自动出现（Day 7 本地版刷新页面即可看到）。

## 目录结构

```text
my-website/
├── index.html      页面骨架
├── style.css       样式（含手机适配）
├── app.js          数据加载 / 筛选 / 展开交互
├── notes/          笔记（Markdown 文件，头部含字段）
├── PRD.md          需求文档（Day 4）
├── TECH_DESIGN.md  技术设计（Day 5）
├── research.md     需求研究（Day 3）
└── AGENTS.md       AI 协作规则（Day 6）
```
