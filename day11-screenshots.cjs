// day11-screenshots.cjs — 生成"点击前 / 点击后"两张截图（Day 11 作业）
// 要求：图里要有本机地址栏。所以这里用「有界面」的浏览器窗口来截，
// 而不是 headless —— headless 模式没有地址栏。

const puppeteer = require("puppeteer-core");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = "http://127.0.0.1:8080/";
const OUT = "C:\\Users\\胡政\\WorkBuddy\\2026-09-22-00-03-11\\my-website\\screenshots";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: false,                 // 关键：要地址栏就必须有界面
    defaultViewport: null,           // 用窗口真实尺寸
    args: ["--no-sandbox", "--window-size=1280,900", "--window-position=40,40"],
  });

  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 1200));

  // ---- 点击前：全部收起 ----
  await page.evaluate(() => {
    document.querySelectorAll(".note-card").forEach((c) => c.classList.remove("open"));
    document.getElementById("toast").className = "toast";
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, "day11-01-click-before.png"), captureBeyondViewport: false });
  console.log("已保存：day11-01-click-before.png（点击前，全部收起）");

  // ---- 点击后：第一张展开，通知条可见 ----
  await page.click(".note-card");
  await new Promise((r) => setTimeout(r, 500));   // 等动画跑完 + 通知条完全出现
  await page.screenshot({ path: path.join(OUT, "day11-02-click-after.png"), captureBeyondViewport: false });
  console.log("已保存：day11-02-click-after.png（点击后，已展开 + 通知条）");

  // 关于地址栏：page.screenshot 只能截网页内容，浏览器的地址栏属于浏览器自身的 UI，
  // 网页截图拿不到；系统级截屏（Win+Shift+S 或 PrintScreen）在当前工具沙箱里被安全策略拦截。
  // 所以含地址栏的最终作业截图，请打开 http://127.0.0.1:8080/ 后按 Win+Shift+S 手动截取，
  // 上面两张已保存的图可以用来对照"点击前/点击后"的内容变化。

  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
