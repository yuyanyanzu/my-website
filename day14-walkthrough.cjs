// day14-walkthrough.cjs — Day 14 走查（真人测试的自动化前站）
//
// 为什么要写它：Day 14 要回答"同伴卡在哪一步"。真人测试要等同伴，
// 但有些卡点是**机械可测的**——比如"入口在首屏之外""链接看不出可点"。
// 如果连机械检查都发现入口不显眼，真人几乎一定也会卡在那里。
//
// 它不替代真人测试。真人能发现的是"我以为这样，结果不是"（心智模型不符），
// 脚本能发现的是"这个元素根本没被看见"（可见性/样式）。两者互补。
//
// 检查方式：模拟一个**没有任何说明**的陌生人，看页面上每个"该被发现"的
// 入口，是不是真的在第一屏里、够不够醒目、够不够好点。
//
// 运行（自带服务，无需手动开启）：
//   NODE_PATH="C:/Users/胡政/.workbuddy/binaries/node/workspace/node_modules" \
//     node day14-walkthrough.cjs

const puppeteer = require("puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://127.0.0.1:8080/";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

// ---- 自带静态服务（同 Day 12/13 做法：避免"忘了开服务"导致假失败）----
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

// ---- 对比度计算（WCAG 相对亮度公式）----
function parseRgb(str) {
  const m = String(str).match(/(\d+(?:\.\d+)?)/g);
  return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const l1 = luminance(parseRgb(fg));
  const l2 = luminance(parseRgb(bg));
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

let issues = [];
function note(level, title, detail) {
  const icon = level === "BUG" ? "✗" : level === "WARN" ? "!" : "✓";
  console.log("  [" + icon + "] " + title + (detail ? " -> " + detail : ""));
  if (level !== "OK") issues.push({ level, title, detail });
}

// 在页面里量一个元素的"存在感"
const probeScript = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const after = getComputedStyle(el, "::after");
  return {
    found: true,
    text: (el.textContent || "").trim().slice(0, 24),
    pseudoText: after.content && after.content !== "none" ? after.content.replace(/"/g, "").trim() : "",
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    width: Math.round(r.width),
    height: Math.round(r.height),
    fontSize: cs.fontSize,
    color: cs.color,
    bg: cs.backgroundColor,
    decoration: cs.textDecorationLine,
    paddingTop: Math.round(parseFloat(cs.paddingTop) || 0),
    visibleInFold: r.top < window.innerHeight && r.bottom > 0,
    foldHeight: window.innerHeight,
  };
};

(async () => {
  const { server, started } = await ensureServer();
  if (started) console.log("（8080 无服务，已自动启动本地静态服务）");
  console.log("");

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));

  // ============ 场景 1：桌面 1280×800 首屏 ============
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.waitForSelector(".note-card", { timeout: 8000 });

  console.log("【场景 1】桌面首屏（1280×800，不滚动）——陌生人第一眼能发现什么？");

  const title = await page.evaluate(probeScript, ".site-header h1");
  note(title.visibleInFold ? "OK" : "BUG", "站名在第一屏内", title.text);

  const slogan = await page.evaluate(probeScript, ".site-slogan");
  note(slogan.visibleInFold ? "OK" : "BUG", "一句话说明在第一屏内", "高度 " + slogan.height + "px");

  for (const nav of ["list", "about"]) {
    const p = await page.evaluate(probeScript, '.nav-link[data-nav="' + nav + '"]');
    note(p.found && p.visibleInFold ? "OK" : "BUG",
      "主导航「" + p.text + "」在第一屏内",
      "位置 top=" + p.top + "px，点击区 " + p.width + "×" + p.height + "px");
  }

  const tagBtn = await page.evaluate(probeScript, ".tag-btn");
  note(tagBtn.visibleInFold ? "OK" : "BUG", "标签筛选按钮在第一屏内", "「" + tagBtn.text + "」top=" + tagBtn.top + "px");

  // ---- 卡片上的两个"小字"：这是最可疑的地方 ----
  const hint = await page.evaluate(probeScript, ".note-card .note-toggle-hint");
  const openLink = await page.evaluate(probeScript, ".note-card .note-open-link");

  console.log("");
  console.log("  ── 卡片底部两行小字的对比 ──");
  console.log("     ① 「" + hint.pseudoText + "」（CSS 伪元素生成，不可点）");
  console.log("        字号 " + hint.fontSize + "，颜色 " + hint.color + "，位置 top=" + hint.top + "px");
  console.log("     ② 「" + openLink.text + "」（真链接，可点）");
  console.log("        字号 " + openLink.fontSize + "，颜色 " + openLink.color + "，下划线 " + openLink.decoration);
  console.log("        点击区 " + openLink.width + "×" + openLink.height + "px，位置 top=" + openLink.top + "px");
  console.log("");

  // 判据 A：真链接和伪元素提示长得太像，且没有下划线 → 陌生人认不出哪个能点
  const sameLook = hint.fontSize === openLink.fontSize;
  const noUnderline = openLink.decoration === "none";
  note(noUnderline ? "WARN" : "OK",
    "「" + openLink.text + "」有无下划线（不看颜色也能认出是链接）",
    noUnderline ? "无下划线，只靠蓝色区分 —— 违反 WCAG 1.4.1（不能只靠颜色传达信息）" : "有下划线");
  // 注意：间距要按"文字之间的距离"算，不能按盒子间距——
  // 链接加了内边距后两个盒子几乎贴在一起，但文字其实已经隔开了。
  // （第一版这里写死了"间距 6px"，是误报，已改回实测。）
  const visualGap = Math.round((openLink.top + openLink.paddingTop) - hint.bottom);
  note(sameLook && visualGap < 12 ? "WARN" : "OK",
    "两行小字会不会被看成一类（字号相同 + 文字间距 <12px 才算挤）",
    "字号" + (sameLook ? "相同" : "已区分") + "，文字间距 " + visualGap + "px" +
      (openLink.decoration === "underline" ? "，且有下划线可区分" : ""));

  // 判据 B：移动端最小触控目标建议 44px
  note(openLink.height >= 44 ? "OK" : "WARN",
    "链接点击区高度是否够手机点（建议 ≥44px）",
    openLink.height + "px" + (openLink.height < 44 ? "，手机上容易点空" : ""));

  // 判据 C：对比度（小字需 ≥4.5:1）
  const ratio = contrast(openLink.color, "rgb(255,255,255)");
  note(ratio >= 4.5 ? "OK" : "WARN",
    "链接文字对比度（小字需 ≥4.5:1）",
    ratio.toFixed(2) + ":1");

  note(openLink.visibleInFold ? "OK" : "WARN",
    "首个「打开独立页面 →」是否在首屏内",
    "top=" + openLink.top + "px / 首屏高 " + openLink.foldHeight + "px");

  // ============ 场景 2：手机 375px（AC-6 + 真人测试多半在手机上）============
  console.log("");
  console.log("【场景 2】手机首屏（375×667，不滚动）");

  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.waitForSelector(".note-card", { timeout: 8000 });

  const mTitle = await page.evaluate(probeScript, ".site-header h1");
  note(mTitle.visibleInFold ? "OK" : "BUG", "站名在手机首屏内", mTitle.text);

  const mNav = await page.evaluate(probeScript, '.nav-link[data-nav="about"]');
  note(mNav.visibleInFold ? "OK" : "BUG", "「" + mNav.text + "」入口在手机首屏内", "top=" + mNav.top + "px");

  const mOpen = await page.evaluate(probeScript, ".note-card .note-open-link");
  note(mOpen.visibleInFold ? "OK" : "WARN",
    "「打开独立页面 →」在手机首屏内",
    "top=" + mOpen.top + "px / 首屏高 " + mOpen.foldHeight + "px，点击区 " + mOpen.width + "×" + mOpen.height + "px");

  // 手机上的横向溢出（AC-6，顺带复核）
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  note(overflow === 0 ? "OK" : "BUG", "手机端无横向滚动", "溢出 " + overflow + "px");

  // ============ 场景 3：截图取证 ============
  console.log("");
  console.log("【场景 3】取证截图");
  await page.setViewport({ width: 420, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.waitForSelector(".note-card", { timeout: 8000 });
  const card = await page.$(".note-card");
  const box = await card.boundingBox();
  // 只截卡片底部（两行小字所在处），放大呈现——这是"疑似卡点"的证据图
  const clipH = Math.min(140, box.height);
  await page.screenshot({
    path: path.join(__dirname, "screenshots", "day14-card-bottom.png"),
    clip: { x: box.x, y: box.y + box.height - clipH, width: box.width, height: clipH },
  });
  console.log("  已保存 screenshots/day14-card-bottom.png（卡片底部特写）");

  note(jsErrors.length === 0 ? "OK" : "BUG", "全程无 JS 报错",
    jsErrors.length ? jsErrors.join(" / ") : "无");

  await browser.close();
  if (server) await new Promise((r) => server.close(r));

  // ============ 汇总 ============
  const bugs = issues.filter((i) => i.level === "BUG");
  const warns = issues.filter((i) => i.level === "WARN");
  console.log("");
  console.log("=== 走查结论 ===");
  console.log("机械硬伤（必卡）：" + bugs.length + " 项");
  console.log("疑似卡点（待真人验证）：" + warns.length + " 项");
  if (warns.length) {
    console.log("");
    console.log("疑似卡点清单：");
    warns.forEach((w, i) => console.log("  " + (i + 1) + ". " + w.title + (w.detail ? " —— " + w.detail : "")));
  }
})().catch((e) => { console.error("走查脚本自身出错：", e.message); process.exit(1); });
