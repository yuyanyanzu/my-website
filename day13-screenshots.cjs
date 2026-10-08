// day13-screenshots.cjs — Day 13 作业截图（两张）
//
// 图1：视图切换（同一张图里并排展示三个视图 + 各自的地址）
// 图2：四种状态各一屏（加载中 / 正常 / 空 / 出错，四宫格 + 各自的地址）
//
// 关于地址栏：page.screenshot 只能截网页内容，浏览器 UI（地址栏）不在截取范围内；
// 系统级截屏在当前沙箱里被安全策略拦截。所以这里把**当前网址**画进图里——
// 网址是从 page.url() 真实读出来的，不是手写的，能证明这张图确实来自那个地址。
// 需要"真的带浏览器地址栏"的最终作业图，请自己用 Win+Shift+S 补一张。
//
// 实现备注（踩过的坑）：一开始把页面截图转成 data URI 内嵌进拼图页，
// 结果 <img> 永远不解码（naturalWidth 一直为 0），截出来是空框。
// 改成把小图写到临时目录、用 file:// 相对路径引用，就正常了。

const puppeteer = require("puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = "C:\\Users\\胡政\\WorkBuddy\\2026-09-22-00-03-11\\my-website\\screenshots";
const BASE = "http://127.0.0.1:8080/";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// ---- 自带静态服务（同 filter-check / day13-views-test 的做法）----
async function ensureServer() {
  const alive = await new Promise((resolve) => {
    const req = http.get(BASE, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
  if (alive) return { server: null, started: false };

  const root = __dirname;
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(root, urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, ""));
    if (!path.resolve(file).startsWith(path.resolve(root))) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(8080, "127.0.0.1", resolve); });
  return { server, started: true };
}

// 每个状态给一句说明，画在图上（否则看截图的人不知道这一格在演示什么）
const CAPTIONS = {
  loading: "① 加载中：数据还没到，先告诉用户「在干活了」",
  normal: "② 正常：8 篇笔记卡片，日期倒序",
  empty: "③ 空：确实没有内容，给下一步指引（不是白屏）",
  error: "④ 出错：说清哪里错了 + 怎么排查（绝不静默失败）",
};

/**
 * 把一组截图拼成一张网格图
 * items: [{ label, png: Buffer, url, caption }]
 */
async function compose(browser, items, title, outFile, cols) {
  // 1) 小图写进临时目录，拼图页用相对路径引用（data URI 太大时 <img> 不解码）
  const tmpDir = path.join(OUT, ".tmp-compose");
  fs.mkdirSync(tmpDir, { recursive: true });
  items.forEach((it, i) => fs.writeFileSync(path.join(tmpDir, "cell-" + i + ".png"), it.png));

  const cells = items.map((it, i) => `
    <div class="cell">
      <div class="cell-head">
        <span class="badge">${it.label}</span>
        <code class="url">${it.url}</code>
      </div>
      <img src="cell-${i}.png" />
      <p class="cap">${it.caption}</p>
    </div>`).join("");

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:26px; background:#eef2f7;
         font-family:"Microsoft YaHei","PingFang SC",sans-serif; color:#1f2d3d; }
  h1 { font-size:21px; margin:0 0 6px; }
  .sub { font-size:13px; color:#5f6b76; margin:0 0 20px; }
  .grid { display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:18px; }
  .cell { background:#fff; border-radius:12px; padding:14px;
          box-shadow:0 3px 12px rgba(0,0,0,.09); }
  .cell-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
  .badge { background:#1a73e8; color:#fff; font-size:12px; font-weight:700;
           padding:3px 10px; border-radius:999px; white-space:nowrap; }
  .url { font-family:Consolas,monospace; font-size:11.5px; color:#0f6e56;
         background:#eaf7f1; border:1px solid #cfe9dd; padding:2px 8px;
         border-radius:5px; word-break:break-all; }
  img { width:100%; display:block; border:1px solid #dbe3ee; border-radius:8px; }
  .cap { font-size:12.5px; color:#3d4a58; margin:9px 0 2px; line-height:1.5; }
</style></head><body>
<h1>${title}</h1>
<p class="sub">图中网址由页面实时读取（page.url()），非手工填写。日期：2026-10-08 ｜ 项目：my-website</p>
<div class="grid">${cells}</div>
</body></html>`;

  const htmlPath = path.join(tmpDir, "compose.html");
  fs.writeFileSync(htmlPath, html);

  // 2) 用 file:// 打开拼图页截图
  const shot = await browser.newPage();
  await shot.setViewport({ width: 1720, height: 1200, deviceScaleFactor: 2 });
  await shot.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  // 等所有小图真正解码完（naturalWidth > 0），再等 0.3s 让排版稳定
  await shot.waitForFunction(
    () => [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 300));
  await shot.screenshot({ path: outFile, fullPage: true });
  await shot.close();

  // 3) 清理临时目录
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

(async () => {
  const { server, started } = await ensureServer();
  if (started) console.log("（8080 无服务，已自动启动本地静态服务）");
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // ============ 图1：三个视图切换 ============
  const page = await browser.newPage();
  await page.setViewport({ width: 1040, height: 780 });

  const shots1 = [];

  // 视图 1：笔记列表
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 900));
  shots1.push({
    label: "视图 1／笔记列表",
    url: page.url(),
    png: await page.screenshot(),
    caption: "主导航默认页。点卡片原位展开；卡片底部的「打开独立页面 →」进入视图 2。",
  });

  // 视图 2：单篇笔记
  await page.goto(BASE + "#/note/2026-09-22", { waitUntil: "networkidle2" });
  await page.waitForSelector("#view-note .note-detail-title", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 700));
  shots1.push({
    label: "视图 2／单篇笔记",
    url: page.url(),
    png: await page.screenshot(),
    caption: "地址是 #/note/日期：可刷新、可收藏、可分享；顶部面包屑指明如何退回列表。",
  });

  // 视图 3：关于
  await page.goto(BASE + "#/about", { waitUntil: "networkidle2" });
  await page.waitForSelector(".about-card", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 700));
  shots1.push({
    label: "视图 3／关于",
    url: page.url(),
    png: await page.screenshot(),
    caption: "自我介绍 + 学习目标 + GitHub 链接，与页面底部关于区共用同一份文案。",
  });

  await compose(browser, shots1, "Day 13 图 1／三个视图互相切换（hash 路由）",
    path.join(OUT, "day13-01-view-switch.png"), 3);
  console.log("已保存：day13-01-view-switch.png");

  // ============ 图2：四种状态 ============
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1040, height: 620 });

  const shots2 = [];

  // ① 加载中：用 ?delay=3000 把加载态拉长才拍得到
  await p2.goto(BASE + "?delay=3000", { waitUntil: "domcontentloaded" });
  await p2.waitForSelector("#state-area .state-loading", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 250));
  shots2.push({ label: "① 加载中", url: p2.url(), png: await p2.screenshot(), caption: CAPTIONS.loading });

  // ② 正常
  await p2.goto(BASE, { waitUntil: "networkidle2" });
  await p2.waitForSelector(".note-card", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 700));
  shots2.push({ label: "② 正常", url: p2.url(), png: await p2.screenshot(), caption: CAPTIONS.normal });

  // ③ 空：等「空状态特有」的文案出现（加载态本身也是 .state-box，不能等它）
  await p2.goto(BASE + "?state=empty", { waitUntil: "networkidle2" });
  await p2.waitForFunction(
    () => /还没有任何笔记/.test(document.querySelector("#state-area")?.textContent || ""),
    { timeout: 10000 }
  );
  await new Promise((r) => setTimeout(r, 300));
  shots2.push({ label: "③ 空", url: p2.url(), png: await p2.screenshot(), caption: CAPTIONS.empty });

  // ④ 出错
  await p2.goto(BASE + "?state=error", { waitUntil: "networkidle2" });
  await p2.waitForFunction(
    () => /加载失败/.test(document.querySelector("#state-area")?.textContent || ""),
    { timeout: 10000 }
  );
  await new Promise((r) => setTimeout(r, 300));
  shots2.push({ label: "④ 出错", url: p2.url(), png: await p2.screenshot(), caption: CAPTIONS.error });

  await compose(browser, shots2, "Day 13 图 2／列表数据的四种状态",
    path.join(OUT, "day13-02-four-states.png"), 2);
  console.log("已保存：day13-02-four-states.png");

  await browser.close();
  if (server) server.close();
  console.log("完成。");
})();
