// day15-public-check.cjs — 校验「公网上的那份」是不是我写的那份
//
// 为什么单独写一个：Day 15 要回答「公网地址第一次打开时，第一个想确认的是什么」。
// 答案是「地址背后跑的到底是不是我刚写的那份代码」。
// 工具回执说"发布成功"只能证明**上传**成功，不能证明**打开是对的**。
// 所以这个脚本直接访问公网地址，用真浏览器把页面跑一遍。
//
// 和 day11/13/14 的区别：那些打 127.0.0.1（本地），这个打公网域名。
// 本地能跑 ≠ 公网跑的是同一个东西——差在：文件有没有传全、CDN 能不能通、
// 路径在域名根下还对不对。这三件事只有真打公网才能验。
//
// 运行：
//   NODE_PATH="C:/Users/胡政/.workbuddy/binaries/node/workspace/node_modules" \
//     node day15-public-check.cjs
// 换地址：PUBLIC_URL="https://其他域名/" node day15-public-check.cjs

const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.env.PUBLIC_URL || "https://study-notes-site-52579.app.workbuddy.host/";
const SHOT_DIR = path.join(__dirname, "screenshots");

const results = [];
let failed = 0;

function check(ok, name, detail) {
  results.push({ ok, name, detail });
  if (!ok) failed++;
  console.log("  " + (ok ? "✓" : "✗") + " " + name + (detail ? "  —— " + detail : ""));
}

(async () => {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

  console.log("公网地址：" + URL);
  console.log("—".repeat(64));

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 860, deviceScaleFactor: 2 });

  // 收集异常。注意两类要分开：
  //   errors    = 真异常（JS 报错 / 资源加载失败）——必须为 0
  //   notFounds = 404 的 URL——要分辨"本来就该 404"（白名单探针、favicon）和"不该 404"
  const errors = [];
  const notFounds = [];
  page.on("pageerror", (e) => errors.push("JS 异常: " + e.message));
  page.on("requestfailed", (r) => {
    const f = r.failure();
    errors.push("请求失败: " + r.url() + " (" + (f ? f.errorText : "?") + ")");
  });
  page.on("response", (r) => { if (r.status() === 404) notFounds.push(r.url()); });

  // ---------- 1. 首页能不能打开 ----------
  console.log("\n【1】首页可访问性");
  const resp = await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  check(!!resp && resp.status() === 200, "公网首页返回 200", resp ? "HTTP " + resp.status() : "无响应");
  const title = await page.title();
  check(/学习笔记/.test(title), "页面标题是正确的那个站", title);
  const finalUrl = page.url();
  check(/\/($|\?|#)/.test(finalUrl), "地址栏停在域名根（无意外跳转）", finalUrl);

  // ---------- 2. 数据有没有渲染出来 ----------
  console.log("\n【2】数据渲染（本地能跑，公网要能跑才是真的）");
  await page.waitForSelector(".note-card", { timeout: 25000 });
  const cardCount = await page.$$eval(".note-card", (els) => els.length);
  check(cardCount > 0, "笔记卡片渲染", cardCount + " 张");

  const markedOk = await page.evaluate(
    () => typeof window.marked !== "undefined" && typeof window.marked.parse === "function"
  );
  check(markedOk, "marked.js 从 CDN 加载成功", markedOk ? "可用" : "不可用（列表会白屏）");

  const htmlParsed = await page.$$eval(".note-body", (els) =>
    els.some((e) => e.querySelector("h1,h2,h3,p,ul,ol,strong,code"))
  );
  check(htmlParsed, "markdown 已解析成 HTML（不是原始文本）", htmlParsed ? "有真实标签" : "疑似原始 markdown");

  const tagCount = await page.$$eval(".tag-btn", (els) => els.length);
  check(tagCount > 1, "标签栏渲染", tagCount + " 个标签");

  // ---------- 3. 三视图在公网还切换得了吗 ----------
  console.log("\n【3】视图切换（Day 13 的成果在公网是否成立）");
  await page.click(".note-card .note-open-link");
  await page.waitForFunction(() => location.hash.startsWith("#/note/"), { timeout: 12000 });
  const noteHash = await page.evaluate(() => location.hash);
  check(noteHash.startsWith("#/note/"), "点「打开独立页面」切到单篇视图", noteHash);

  const hasCrumb = await page.$(".breadcrumb");
  check(!!hasCrumb, "面包屑出现", hasCrumb ? "有" : "无");
  const detailVisible = await page.evaluate(() => {
    const v = document.querySelector("#view-note");
    return !!v && !v.hasAttribute("hidden") && !!v.querySelector(".note-detail-title");
  });
  check(detailVisible, "单篇正文渲染出来", detailVisible ? "有标题" : "空");
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(SHOT_DIR, "day15-public-note.png"), fullPage: false });

  // 直接输地址（模拟"把链接发给别人"）——hash 路由的核心卖点
  await page.goto(URL + noteHash, { waitUntil: "networkidle2", timeout: 45000 });
  const deepLinkOk = await page.evaluate(() => {
    const v = document.querySelector("#view-note");
    return !!v && !v.hasAttribute("hidden");
  });
  check(deepLinkOk, "把单篇地址直接打开（分享链接可用）", deepLinkOk ? "直接进入单篇" : "回到了列表");

  // 关于视图
  await page.evaluate(() => { location.hash = "#/about"; });
  await new Promise((r) => setTimeout(r, 400));
  const aboutOk = await page.evaluate(() => {
    const v = document.querySelector("#view-about");
    return !!v && !v.hasAttribute("hidden") && !!v.querySelector(".about-card");
  });
  check(aboutOk, "关于视图可切换", aboutOk ? "有内容" : "空");

  // ---------- 4. 回列表截图 ----------
  console.log("\n【4】取证截图");
  await page.evaluate(() => { location.hash = "#/"; });
  await page.waitForSelector(".note-card", { timeout: 12000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 600));
  const listShot = path.join(SHOT_DIR, "day15-public-site.png");
  await page.screenshot({ path: listShot, fullPage: true });
  check(true, "已保存公网页面截图", path.relative(__dirname, listShot));

  // ---------- 5. 白名单有没有真的生效 ----------
  console.log("\n【5】不该上公网的东西有没有漏出去");
  const must404 = ["DEPLOY.md", "api-contract.md", "day14-test-plan.md", "cloudbaserc.json", "PRD.md", "AGENTS.md"];
  for (const f of must404) {
    const r = await page.goto(URL + f, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => null);
    const code = r ? r.status() : 0;
    check(code === 404, f + " 不可访问", "HTTP " + code + (code === 404 ? "（正确）" : " ← 泄漏了"));
  }

  // ---------- 6. 报错 ----------
  // 第 5 节故意探了 6 个"该 404"的地址——那几发 404 是预期结果，不能算异常。
  // favicon.ico 的 404 也是浏览器自发的（站点没放图标），属无害噪音，单独提示不判失败。
  console.log("\n【6】运行期异常");
  const expected404 = must404.map((f) => URL + f);
  const unexpected404 = notFounds.filter((u) => !expected404.includes(u) && !/favicon/i.test(u));
  const faviconNoise = notFounds.filter((u) => /favicon/i.test(u));
  check(errors.length === 0, "无 JS 异常 / 资源加载失败", errors.length ? errors.slice(0, 3).join(" ｜ ") : "0 条");
  check(unexpected404.length === 0, "没有「不该出现」的 404", unexpected404.length ? unexpected404.slice(0, 3).join(" ｜ ") : "0 条");
  if (faviconNoise.length) {
    console.log("  · 提示：favicon.ico 未提供（浏览器自动请求，无害），共 " + faviconNoise.length + " 次");
  }

  await browser.close();

  console.log("\n" + "═".repeat(64));
  console.log("通过 " + (results.length - failed) + " / " + results.length + (failed ? "　✗ 失败 " + failed + " 项" : "　全部通过"));
  console.log("═".repeat(64));
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("脚本异常：", e.message);
  process.exit(2);
});
