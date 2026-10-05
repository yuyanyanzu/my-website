// check-filter.cjs — filter-check Skill 的执行脚本（Day 12）
// 用法：node skill/filter-check/check-filter.cjs [--browser]
//   不带参数：只做静态检查（读源码，确认三种情况的分支都在）
//   加 --browser：额外用本机 Edge 真跑页面，实测三种情况 + 可访问性
//
// 这个脚本是 SKILL.md 第 2~4 步的实现。它只检查筛选交互，不碰别的功能。

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const withBrowser = process.argv.includes("--browser");

let pass = 0, fail = 0, warn = 0;
const results = [];

function record(level, name, detail) {
  if (level === "pass") pass++;
  else if (level === "fail") fail++;
  else warn++;
  results.push({ level, name, detail });
  const tag = level === "pass" ? "通过" : level === "fail" ? "失败" : "提示";
  console.log("  [" + tag + "] " + name + (detail ? " -> " + detail : ""));
}

console.log("\n=== filter-check：标签筛选三态检查 ===\n");
console.log("项目根目录：" + ROOT + "\n");

// ============ 第 1 步：静态检查 ============
console.log("【1】静态检查——三种情况的分支是否都在代码里");

const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const componentsJs = fs.readFileSync(path.join(ROOT, "components.js"), "utf8");
const mockJs = fs.readFileSync(path.join(ROOT, "mock-data.js"), "utf8");

// 1-1 有无结果分支
record(/visible\.length\s*>\s*0|visible\.length\s*===\s*0/.test(appJs) ? "pass" : "fail",
  "renderNotes 里存在按结果数量分支的逻辑");

// 1-2 有结果时清状态区
record(/clearState\s*\(/.test(appJs) ? "pass" : "fail",
  "有结果时会清掉状态区（避免状态和列表同时显示）");

// 1-3 无结果时显示空状态
record(/showState\s*\(\s*["']empty["']/.test(appJs) ? "pass" : "fail",
  "无结果时调用 showState(\"empty\") 显示空状态");

// 1-4 清空恢复：再点同一标签回到全部
record(/tag\s*===\s*activeTag\s*\?\s*["']全部["']/.test(appJs) ? "pass" : "fail",
  "再点同一标签会回到「全部」（清空恢复）");

// 1-5 筛选后播报
record(/announceFilterResult\s*\(/.test(appJs) ? "pass" : "fail",
  "筛选后调用 announceFilterResult() 播报结果");

// 1-6 筛选后播报必须在 renderNotes 之后
{
  const idx = appJs.indexOf("announceFilterResult();");
  const renderIdx = appJs.lastIndexOf("renderNotes();", idx);
  record(idx > 0 && renderIdx > 0 && renderIdx < idx ? "pass" : "fail",
    "announceFilterResult 在 renderNotes 之后调用（否则播报的是旧状态）");
}

// 1-7 aria-pressed 同步（Day 11 加的可访问性）
record(/aria-pressed/.test(appJs) ? "pass" : "fail",
  "标签按钮设置了 aria-pressed（读屏能知道哪个被选中）");

// ============ 关键：无结果在页面上点得到吗 ============
console.log("\n【2】「无结果」这一路是否可在页面上触达");

// 从 mock-data.js 里抽出所有标签，统计每篇笔记的标签
const tagMatches = [...mockJs.matchAll(/tags:\s*\[([^\]]*)\]/g)];
const allTags = [];
tagMatches.forEach((m) => {
  m[1].split(",").forEach((t) => {
    const clean = t.trim().replace(/["']/g, "");
    if (clean) allTags.push(clean);
  });
});
const noteCount = tagMatches.length;

const tagCount = {};
allTags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1));

console.log("  数据里共 " + noteCount + " 篇笔记，" + Object.keys(tagCount).length + " 个标签：");
Object.entries(tagCount).forEach(([t, c]) => console.log("    " + t + " -> " + c + " 篇"));

// 标签栏只列"数据里存在的标签"，所以点标签永远筛出 >=1 篇。
// Day 12 加了 ?tag= 入口，让"无结果"这一路可以触达并验证。
const hasTagParam = /URLSearchParams\(location\.search\)\.get\(\s*["']tag["']\s*\)/.test(appJs);
record(hasTagParam ? "pass" : "fail",
  "存在 ?tag= 入口，可触达「无结果」状态（否则 AC-7 无法用点击验证）");

// 空状态两种文案要分开
record(/filteredEmpty|activeTag\s*!==\s*["']全部["']/.test(appJs) ? "pass" : "fail",
  "空状态区分「全站无笔记」与「筛选无结果」两种文案");

// 该筛选的标签即使没笔记也要显示在栏里
record(/!tags\.includes\(activeTag\)/.test(appJs) ? "pass" : "fail",
  "当前筛选标签即使无笔记也会出现在标签栏并高亮");

// ============ 第 3-4 步：浏览器实测 ============
// 用 main() 包一层：浏览器检查是异步的，必须 await 完再打总结，
// 否则结论会在检查跑完之前就打印出来（Day 12 踩过的坑）。
async function main() {
  if (!withBrowser) {
    console.log("\n【3】浏览器实测：已跳过（加 --browser 参数启用）");
  } else {
    await runBrowserChecks();
  }

  // ============ 汇总 ============
  console.log("\n=== 结论：通过 " + pass + " 项，失败 " + fail + " 项，提示 " + warn + " 项 ===\n");

  // 有 --browser 时输出结论块，方便直接贴进日记/提交说明
  if (withBrowser) {
    console.log("筛选三态检查 — " + new Date().toISOString().slice(0, 10));
    results.forEach((r) => {
      const tag = r.level === "pass" ? "[通过]" : r.level === "fail" ? "[失败]" : "[提示]";
      console.log(tag + " " + r.name + (r.detail ? "：" + r.detail : ""));
    });
    console.log("");
  }

  process.exit(fail === 0 ? 0 : 1);
}

// 确保 8080 上有静态服务；没有就自己起一个，跑完再关掉。
// 这样重跑检查不会因为「忘了先开服务」而卡在 8s 超时上。
async function ensureServer(root) {
  const http = require("http");
  const fs = require("fs");
  const path = require("path");

  const alive = await new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8080/", (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
  if (alive) return { server: null, started: false };

  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
  };

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const file = path.join(root, rel);
    // 防目录穿越：解析后必须仍在项目根目录内
    if (!path.resolve(file).startsWith(path.resolve(root))) {
      res.writeHead(403); res.end("forbidden"); return;
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(8080, "127.0.0.1", resolve);
  });
  return { server, started: true };
}

async function runBrowserChecks() {
  console.log("\n【3】浏览器实测（本机 Edge）");

  let puppeteer;
  try {
    puppeteer = require("puppeteer-core");
  } catch (e) {
    record("fail", "加载 puppeteer-core", "未找到，检查 NODE_PATH 环境变量");
    return;
  }

  const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const URL = "http://127.0.0.1:8080/";

  const { server, started } = await ensureServer(ROOT);
  if (started) console.log("  （8080 无服务，已自动启动本地静态服务）");

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EDGE,
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (e) {
    record("fail", "启动 Edge", e.message.slice(0, 80));
    if (server) server.close();
    return;
  }

  const page = await browser.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));

  try {
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.waitForSelector(".note-card", { timeout: 8000 });

    const total = await page.$$eval(".note-card", (els) => els.length);
    record(total > 0 ? "pass" : "fail", "初始列表渲染", total + " 篇");

    // ---------- 情况 1：有结果 ----------
    const firstTag = await page.evaluate(() => {
      const btn = [...document.querySelectorAll(".tag-btn")].find((b) => b.textContent !== "全部");
      btn.click();
      return btn.textContent;
    });
    await new Promise((r) => setTimeout(r, 300));

    const afterFilter = await page.evaluate(() => ({
      cards: document.querySelectorAll(".note-card").length,
      allHaveTag: [...document.querySelectorAll(".note-card")].every((c) =>
        [...c.querySelectorAll(".note-tag")].some((t) => t.textContent ===
          [...document.querySelectorAll(".tag-btn")].find((b) => b.classList.contains("active")).textContent)),
      activeTag: [...document.querySelectorAll(".tag-btn")].find((b) => b.classList.contains("active"))?.textContent,
      pressed: [...document.querySelectorAll(".tag-btn")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
    }));
    record(afterFilter.cards > 0 && afterFilter.cards < total ? "pass" : "fail",
      "情况1 有结果：点「" + afterFilter.activeTag + "」后卡片数减少",
      afterFilter.cards + " / " + total);
    record(afterFilter.allHaveTag ? "pass" : "fail",
      "情况1 剩下的卡片都含该标签");
    record(afterFilter.pressed === 1 ? "pass" : "fail",
      "可访问性：只有 1 个标签 aria-pressed=true", "实际 " + afterFilter.pressed);

    // 筛选结果播报
    const toastText = await page.$eval("#toast", (el) => el.textContent);
    record(/已筛选标签.*\d+\s*篇/.test(toastText) ? "pass" : "fail",
      "筛选后通知条播报结果", toastText);

    // ---------- 情况 2：无结果 ----------
    // 用 ?tag= 一个不存在的标签，走真实的"筛选后无结果"路径（Day 12 新增的入口）。
    // 注意不要用 ?state=empty——那是"全站没笔记"，文案不同，验的不是 AC-7 这一路。
    const GHOST_TAG = "不存在的标签";
    await page.goto(URL + "?tag=" + encodeURIComponent(GHOST_TAG), { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1400));
    const emptyState = await page.evaluate((ghost) => {
      const area = document.getElementById("state-area");
      const cards = document.querySelectorAll(".note-card").length;
      const active = [...document.querySelectorAll(".tag-btn")].filter((b) => b.classList.contains("active"));
      return {
        visible: !area.hidden,
        text: area.innerText.replace(/\n+/g, " ").trim(),
        cards,
        bodyText: document.body.innerText.trim().length,
        activeLabels: active.map((b) => b.textContent),
        toast: document.getElementById("toast").textContent,
      };
    }, GHOST_TAG);

    record(emptyState.visible && /还没有笔记/.test(emptyState.text) ? "pass" : "fail",
      "情况2 无结果：显示筛选空状态文案", emptyState.text.slice(0, 45));
    record(emptyState.cards === 0 ? "pass" : "fail",
      "情况2 空状态时没有残留卡片", emptyState.cards + " 张");
    record(emptyState.bodyText > 50 ? "pass" : "fail",
      "情况2 不是白屏（页面仍有可读内容）", emptyState.bodyText + " 字符");
    record(emptyState.activeLabels.includes(GHOST_TAG) ? "pass" : "fail",
      "情况2 被筛选的标签在栏里显示为选中态（用户知道自己在看什么）",
      JSON.stringify(emptyState.activeLabels));

    // 顺便验 ?state=empty 的"全站无笔记"文案，确认两种空状态没混用
    await page.goto(URL + "?state=empty", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1200));
    const siteEmpty = await page.$eval("#state-area", (el) => el.innerText.replace(/\n+/g, " ").trim());
    record(/还没有任何笔记/.test(siteEmpty) && !/标签「/.test(siteEmpty) ? "pass" : "fail",
      "全站空与筛选空用了不同文案（没混用）", siteEmpty.slice(0, 40));

    // ---------- 情况 3：清空恢复 ----------
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.waitForSelector(".note-card", { timeout: 8000 });
    // 先筛选
    await page.evaluate(() => {
      [...document.querySelectorAll(".tag-btn")].find((b) => b.textContent !== "全部").click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const filteredCount = await page.$$eval(".note-card", (els) => els.length);
    // 再点「全部」
    await page.evaluate(() => {
      document.querySelector(".tag-btn").click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const restored = await page.evaluate(() => ({
      cards: document.querySelectorAll(".note-card").length,
      activeIsAll: document.querySelector(".tag-btn").classList.contains("active"),
      toast: document.getElementById("toast").textContent,
    }));
    record(filteredCount < total && restored.cards === total ? "pass" : "fail",
      "情况3 清空恢复：点「全部」回到完整列表",
      filteredCount + " -> " + restored.cards + " / " + total);
    record(restored.activeIsAll ? "pass" : "fail",
      "情况3 「全部」重新变为选中态");

    // 再点同一标签也能解除筛选
    await page.evaluate(() => {
      [...document.querySelectorAll(".tag-btn")].find((b) => b.textContent !== "全部").click();
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.evaluate(() => {
      const t = [...document.querySelectorAll(".tag-btn")].find((b) => b.classList.contains("active"));
      t.click();
    });
    await new Promise((r) => setTimeout(r, 250));
    const toggleBack = await page.$$eval(".note-card", (els) => els.length);
    record(toggleBack === total ? "pass" : "fail",
      "情况3 再点同一标签也能解除筛选", toggleBack + " / " + total);

    // ---------- 可访问性（余力加练）----------
    const a11y = await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".tag-btn")];
      const first = btns[0];
      first.focus();
      const cs = getComputedStyle(first);
      return {
        isRealButton: btns.every((b) => b.tagName === "BUTTON"),
        focusVisible: first.matches(":focus-visible"),
        outlineWidth: cs.outlineWidth,
        outlineStyle: cs.outlineStyle,
        hasLiveRegion: !!document.getElementById("live-region"),
        liveIsPolite: document.getElementById("live-region")?.getAttribute("aria-live") === "polite",
      };
    });
    record(a11y.isRealButton ? "pass" : "fail", "可访问性：标签用的是原生 <button>（天然可键盘操作）");
    record(a11y.focusVisible && a11y.outlineStyle === "solid" && parseFloat(a11y.outlineWidth) >= 2 ? "pass" : "fail",
      "可访问性：聚焦标签有可见描边", a11y.outlineWidth + " " + a11y.outlineStyle);
    record(a11y.hasLiveRegion && a11y.liveIsPolite ? "pass" : "fail",
      "可访问性：存在 aria-live=polite 的播报区");

    // Day 12：标签带篇数提示，点之前就知道会不会是空的
    const tips = await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".tag-btn")];
      return {
        total: btns.length,
        withCount: btns.filter((b) => /\d+\s*篇笔记/.test(b.title)).length,
        allTitled: btns.every((b) => b.title && b.title.length > 0),
      };
    });
    record(tips.allTitled && tips.withCount === tips.total ? "pass" : "fail",
      "可访问性：每个标签都有篇数提示（title）",
      tips.withCount + "/" + tips.total);

    // 键盘实测：Tab 到标签并用 Enter 触发筛选
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.waitForSelector(".note-card", { timeout: 8000 });
    const kb = await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".tag-btn")];
      const target = btns.find((b) => b.textContent === "Git") || btns[1];
      target.focus();
      return document.activeElement === target;
    });
    record(kb ? "pass" : "fail", "可访问性：标签按钮可被键盘聚焦");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 350));
    const kbFiltered = await page.$$eval(".note-card", (els) => els.length);
    record(kbFiltered < total ? "pass" : "fail",
      "可访问性：回车键能触发筛选", kbFiltered + " / " + total);

    record(jsErrors.length === 0 ? "pass" : "fail", "全程无 JS 报错", jsErrors.join(" | "));
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

// ============ 汇总（已移入 main()，见上方）============

main().catch((e) => {
  console.error("检查脚本异常：" + e.message);
  process.exit(2);
});
