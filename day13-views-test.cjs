// day13-views-test.cjs — Day 13 自测：三个视图互相切换 + 四种状态
//
// 为什么要写脚本：视图切换最容易出的错不是"点不动"，而是
//   ① 切换后前一个视图没藏好，两个视图叠在一起
//   ② 地址栏变了但页面没变（或反过来）
//   ③ 前进/后退失灵（这是 hash 路由最经典的坑）
// 这些用肉眼点几下很难穷尽，交给脚本逐项断言。
//
// 运行前先起服务：python -m http.server 8080
// 或者直接运行本脚本 —— 它会自己检测 8080，没服务就自己起一个（跑完自动关）。
// 运行：
//   NODE_PATH="C:/Users/胡政/.workbuddy/binaries/node/workspace/node_modules" \
//     node day13-views-test.cjs

const puppeteer = require("puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://127.0.0.1:8080/";

// ---- 自带静态服务（做法同 filter-check Skill，避免"忘了开服务"导致假失败）----
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

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


let pass = 0, fail = 0;
const failures = [];

function record(ok, name, detail) {
  const tag = ok ? "通过" : "失败";
  console.log("  [" + tag + "] " + name + (detail ? " -> " + detail : ""));
  if (ok) pass++; else { fail++; failures.push(name + (detail ? "：" + detail : "")); }
}

(async () => {
  const { server, started } = await ensureServer();
  if (started) console.log("（8080 无服务，已自动启动本地静态服务）");

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));

  // 工具：读出当前"哪个视图可见"
  const visibleView = () => page.evaluate(() => {
    const ids = ["view-list", "view-note", "view-about"];
    const shown = ids.filter((id) => {
      const el = document.getElementById(id);
      return el && !el.hidden;
    });
    return { shown, count: shown.length, hash: location.hash };
  });

  console.log("\n=== Day 13：视图切换与四种状态检查 ===\n");

  // ---------- 一、列表视图（正常状态）----------
  console.log("【1】列表视图：正常状态");
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 10000 });

  let v = await visibleView();
  record(v.count === 1 && v.shown[0] === "view-list", "只显示列表视图（没有两个视图重叠）", v.shown.join(","));

  const cardCount = await page.$$eval("#note-list .note-card", (els) => els.length);
  record(cardCount === 8, "列表渲染 8 篇笔记（正常状态）", cardCount + " 篇");

  // 导航高亮
  const listActive = await page.$eval('[data-nav="list"]', (el) => el.classList.contains("active"));
  record(listActive, "导航栏「笔记」处于选中态");

  // ---------- 二、切到关于视图 ----------
  console.log("\n【2】切到「关于」视图");
  await page.click('[data-nav="about"]');
  await new Promise((r) => setTimeout(r, 400));

  v = await visibleView();
  record(v.count === 1 && v.shown[0] === "view-about", "只显示关于视图", v.shown.join(","));
  record(v.hash === "#/about", "地址栏变成 #/about", v.hash);

  const aboutText = await page.$eval("#view-about", (el) => el.textContent || "");
  record(/学习目标/.test(aboutText) && /GitHub/.test(aboutText),
    "关于视图含「学习目标」与「GitHub 链接」",
    aboutText.replace(/\s+/g, " ").slice(0, 40) + "…");

  const aboutActive = await page.$eval('[data-nav="about"]', (el) => el.classList.contains("active"));
  record(aboutActive, "导航栏「关于」处于选中态");

  // ---------- 三、切回列表 ----------
  console.log("\n【3】切回「笔记」视图");
  await page.click('[data-nav="list"]');
  await new Promise((r) => setTimeout(r, 400));

  v = await visibleView();
  record(v.count === 1 && v.shown[0] === "view-list", "只显示列表视图", v.shown.join(","));
  const cardsBack = await page.$$eval("#note-list .note-card", (els) => els.length);
  record(cardsBack === 8, "列表完整恢复", cardsBack + " 篇");

  // ---------- 四、进入单篇笔记视图 ----------
  console.log("\n【4】进入单篇笔记视图（第三个视图）");
  const detailHash = await page.$eval("#note-list .note-open-link", (el) => el.getAttribute("href"));
  await page.$eval("#note-list .note-open-link", (el) => el.click());
  await new Promise((r) => setTimeout(r, 400));

  v = await visibleView();
  record(v.count === 1 && v.shown[0] === "view-note", "只显示单篇笔记视图", v.shown.join(","));
  record(/^#\/note\//.test(v.hash), "地址栏变成 #/note/日期", v.hash);

  const detailTitle = await page.$eval("#view-note .note-detail-title", (el) => el.textContent).catch(() => "");
  record(detailTitle.length > 0, "详情视图渲染出笔记标题", detailTitle);

  const crumbText = await page.$eval("#view-note .breadcrumb", (el) => el.textContent).catch(() => "");
  record(/全部笔记/.test(crumbText), "面包屑含「全部笔记」上级入口", crumbText.replace(/\s+/g, " ").trim());

  // ---------- 五、浏览器前进/后退（hash 路由最经典的坑）----------
  console.log("\n【5】前进 / 后退按钮能不能用");
  await page.goBack();
  await new Promise((r) => setTimeout(r, 400));
  v = await visibleView();
  record(v.count === 1 && v.shown[0] === "view-list", "后退一步回到列表视图", v.shown.join(",") + " " + v.hash);

  await page.goBack();
  await new Promise((r) => setTimeout(r, 400));
  v = await visibleView();
  record(v.shown[0] === "view-about", "再后退一步回到关于视图", v.shown.join(",") + " " + v.hash);

  await page.goForward();
  await new Promise((r) => setTimeout(r, 400));
  v = await visibleView();
  record(v.shown[0] === "view-list", "前进一步回到列表视图", v.shown.join(",") + " " + v.hash);

  // ---------- 六、直接输地址进详情页（可分享、可刷新）----------
  console.log("\n【6】直接输入地址 + 刷新（分享链接的场景）");
  await page.goto(BASE + "#/note/2026-09-22", { waitUntil: "networkidle2" });
  await page.waitForSelector("#view-note .note-detail-title", { timeout: 10000 }).catch(() => {});
  const directTitle = await page.$eval("#view-note .note-detail-title", (el) => el.textContent).catch(() => "");
  record(/Git 三连/.test(directTitle), "直接输地址能打开指定笔记", directTitle);

  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#view-note .note-detail-title", { timeout: 10000 }).catch(() => {});
  const afterReload = await page.$eval("#view-note .note-detail-title", (el) => el.textContent).catch(() => "");
  record(/Git 三连/.test(afterReload), "刷新后仍停在同一条笔记", afterReload);

  // ---------- 七、找不到的笔记（地址写错）----------
  console.log("\n【7】地址写错时的表现");
  await page.goto(BASE + "#/note/1999-01-01", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));
  const notFound = await page.$eval("#view-note", (el) => el.textContent || "");
  record(/没有找到这篇笔记/.test(notFound), "给出「没有找到」提示而不是白屏", notFound.replace(/\s+/g, " ").slice(0, 40) + "…");
  record(!/加载失败/.test(notFound), "用的是「找不到」文案，不是「出错」文案（两者不能混）");

  // ---------- 八、四种状态 ----------
  console.log("\n【8】四种状态都能看到");

  // ① 加载中
  await page.goto(BASE + "?delay=3000", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 600));
  const loadingText = await page.$eval("#state-area", (el) => el.textContent || "");
  record(/加载中|正在读取/.test(loadingText), "① 加载中：文案可见", loadingText.replace(/\s+/g, " ").trim().slice(0, 30));

  // ② 正常
  await page.waitForSelector(".note-card", { timeout: 12000 });
  const normalCards = await page.$$eval(".note-card", (els) => els.length);
  record(normalCards === 8, "② 正常：8 篇卡片", normalCards + " 篇");

  // ③ 空
  // 注意：不能等 .state-box —— 加载态本身就是一个 .state-box，会立刻匹配上，
  // 于是拿到的是"加载中"的文案（这个坑第一次跑就踩了）。
  // 正确的等法是等"空状态特有"的那句话出现。
  await page.goto(BASE + "?state=empty", { waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => /还没有任何笔记/.test(document.querySelector("#state-area")?.textContent || ""),
    { timeout: 10000 }
  );
  const emptyText = await page.$eval("#state-area", (el) => el.textContent || "");
  record(/还没有任何笔记/.test(emptyText), "③ 空：全站无笔记文案", emptyText.replace(/\s+/g, " ").trim().slice(0, 30));
  const emptyCards = await page.$$eval(".note-card", (els) => els.length);
  record(emptyCards === 0, "③ 空：不残留任何卡片", emptyCards + " 张");

  // ④ 出错
  // 同理：等错误文案，不等 .state-box
  await page.goto(BASE + "?state=error", { waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => /加载失败/.test(document.querySelector("#state-area")?.textContent || ""),
    { timeout: 10000 }
  );
  const errText = await page.$eval("#state-area", (el) => el.textContent || "");
  record(/加载失败/.test(errText), "④ 出错：显示错误状态", errText.replace(/\s+/g, " ").trim().slice(0, 30));
  record(/排查/.test(errText), "④ 出错：给出排查指引（不静默失败）");

  // ---------- 九、筛选仍可用（Day 12 成果未被破坏）----------
  console.log("\n【9】回归：Day 11/12 的成果没被切坏");
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 10000 });

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".tag-btn")].find((b) => b.textContent === "Git");
    btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const filtered = await page.$$eval(".note-card", (els) => els.length);
  record(filtered === 3, "标签筛选仍正常（Git 剩 3 篇）", filtered + " 篇");

  await page.evaluate(() => document.querySelector(".note-card").click());
  await new Promise((r) => setTimeout(r, 400));
  const opened = await page.$eval(".note-card", (el) => el.classList.contains("open"));
  record(opened, "卡片原位展开仍正常（Day 11 的交互没被破坏）");

  // ---------- 十、手机宽度不出现横向滚动（AC-6，三个视图都要过）----------
  console.log("\n【10】375px 手机宽度（AC-6）");
  await page.setViewport({ width: 375, height: 720 });
  const noHScroll = async (label) => {
    const r = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    record(r.scroll <= 0, label + "：无横向滚动", "溢出 " + r.scroll + "px");
  };
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 10000 });
  await noHScroll("列表视图");
  await page.goto(BASE + "#/note/2026-09-22", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 600));
  await noHScroll("单篇笔记视图");
  await page.goto(BASE + "#/about", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 600));
  await noHScroll("关于视图");

  // ---------- 十一、运行健康度 ----------
  console.log("\n【11】运行健康度");
  record(jsErrors.length === 0, "全程无 JS 报错", jsErrors.slice(0, 2).join(" | "));

  await browser.close();
  if (server) server.close();

  console.log("\n=== 结论：通过 " + pass + " 项，失败 " + fail + " 项 ===");
  if (fail) {
    console.log("\n失败明细：");
    failures.forEach((f) => console.log("  × " + f));
  }
  process.exit(fail === 0 ? 0 : 1);
})();
