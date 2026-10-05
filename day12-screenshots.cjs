// day12-screenshots.cjs — Day 12 作业截图（两张）
// 图1：筛选后的页面（有地址栏、筛选条件、筛选结果）
// 图2：项目里的 SKILL.md（要能看到 Skill 文件名）
//
// 关于地址栏：page.screenshot 只能截网页内容，地址栏属于浏览器 UI，网页截图拿不到；
// 系统级截屏在当前工具沙箱里被安全策略拦截。
// 所以这两张图是"页面内容"截图，含地址栏的最终作业图请用户按 Win+Shift+S 手动补一张。

const puppeteer = require("puppeteer-core");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = "C:\\Users\\胡政\\WorkBuddy\\2026-09-22-00-03-11\\my-website\\screenshots";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 820 });

  // ---------- 图1：筛选后的页面（有结果的情况）----------
  // 用 ?tag=Git 直接以筛选态打开，这样地址栏（用户手动截时）能体现筛选条件
  await page.goto("http://127.0.0.1:8080/?tag=Git", { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, "day12-01-filtered-page.png") });
  console.log("已保存：day12-01-filtered-page.png（筛选后的页面）");

  // ---------- 图2：SKILL.md 在项目里的位置 ----------
  // 用项目文件树页面 + SKILL.md 内容拼一张：先截文件树（用 VS Code 式的目录列表不合适），
  // 改用浏览器打开一个本地生成的"文件位置说明页"，把路径和 SKILL.md 前几行一起展示。
  const skillPath = path.join(__dirname, "skill", "filter-check", "SKILL.md");
  const fs = require("fs");
  const skillText = fs.readFileSync(skillPath, "utf8");
  const preview = skillText.split("\n").slice(0, 26).join("\n");

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  body{font-family:"Microsoft YaHei",sans-serif;background:#f5f7fa;margin:0;padding:24px;color:#222}
  .box{max-width:1000px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  h1{font-size:19px;margin:0 0 4px}
  .path{font-size:13px;color:#5f6b76;margin-bottom:16px;background:#eef2f7;padding:8px 12px;border-radius:6px}
  pre{background:#1f2d3d;color:#e8eef7;padding:18px;border-radius:8px;font-size:13px;line-height:1.65;overflow:auto;margin:0}
  .tree{font-family:Consolas,monospace;font-size:13px;line-height:1.7;background:#f7f9fc;border:1px solid #e3e9f2;border-radius:8px;padding:14px 18px;margin-bottom:16px}
  .hl{background:#fff3c4;padding:0 4px;border-radius:3px;font-weight:700}
</style></head><body>
<div class="box">
  <h1>Skill 文件在项目里的位置</h1>
  <div class="path">my-website / <span class="hl">skill / filter-check / SKILL.md</span></div>
  <div class="tree">my-website/
├── index.html
├── style.css
├── app.js          ← Day 12 改动（加了 ?tag= 入口、标签高亮）
├── components.js
├── feedback.js
├── mock-data.js
├── notes/
├── <span class="hl">skill/</span>            ← Day 12 新增目录
│   └── <span class="hl">filter-check/</span>
│       ├── <span class="hl">SKILL.md</span>            ← 本 Skill 正文
│       ├── check-filter.cjs     ← 可执行检查脚本
│       └── INVOCATION-LOG.md    ← 调用记录
├── PRD.md
└── AGENTS.md</div>
  <div class="path">文件名：<span class="hl">SKILL.md</span>（前 26 行）</div>
  <pre>${preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</div></body></html>`;

  const tmpHtml = path.join(require("os").tmpdir(), "day12-skill-preview.html");
  fs.writeFileSync(tmpHtml, html, "utf8");
  await page.goto("file:///" + tmpHtml.replace(/\\/g, "/"), { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, "day12-02-skill-md.png"), fullPage: true });
  console.log("已保存：day12-02-skill-md.png（SKILL.md 在项目里的位置）");

  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
