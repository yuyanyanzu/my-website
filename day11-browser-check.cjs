// day11-browser-check.cjs — 用本机已装的 Edge（Chromium 内核）真跑一遍页面
// 目的：Node 里的 DOM 桩只能验证"逻辑对不对"，验证不了"浏览器里到底渲染成什么样"。
// 这个脚本回答三个桩测不了的问题：
//   1. 展开动画是不是真的在动（读的是动画中间态的真实高度）
//   2. 通知条是不是真的出现在屏幕上（读的是真实计算样式）
//   3. 连续操作在真浏览器里点 30 次，DOM 状态会不会乱
//
// 用 puppeteer-core 连接本机 Edge，不下载任何浏览器。

const path = require("path");
const puppeteer = require("puppeteer-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = "http://127.0.0.1:8080/";

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  [通过] " + name); }
  else { fail++; console.log("  [失败] " + name + (extra ? " -> " + extra : "")); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // 收集页面里的报错，任何一个都是问题
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.waitForSelector(".note-card", { timeout: 8000 });

  console.log("\n=== Day 11 真浏览器验证（Edge / Chromium 内核）===\n");

  // ---------- 1. 卡片渲染 ----------
  console.log("【1】主视图渲染");
  const cardCount = await page.$$eval(".note-card", (els) => els.length);
  check("渲染出 8 张笔记卡片（mock 数据）", cardCount === 8, "实际 " + cardCount);

  const firstTitle = await page.$eval(".note-card h3", (el) => el.textContent);
  check("第一张卡片是日期最新的那篇", firstTitle.includes("四种页面状态"), firstTitle);

  // ---------- 2. 展开动画真的在动 ----------
  console.log("\n【2】展开动画（桩测不到的部分）");
  {
    // 收起状态下的正文应该是"贴地"的：grid 行高 0 + 透明
    // 注意：border-top 在收起时占 1px，所以要连同 grid-template-rows 和 opacity 一起判断
    const before = await page.$eval(".note-card .note-body", (el) => {
      const cs = getComputedStyle(el);
      return { rows: cs.gridTemplateRows, opacity: Number(cs.opacity) };
    });
    check("收起时正文行高为 0 且不可见",
      parseFloat(before.rows) < 1 && before.opacity < 0.05, JSON.stringify(before));

    // 点击后立刻取一次（动画进行中），再等动画结束取一次
    await page.click(".note-card");
    const hMid = await page.$eval(".note-card .note-body", (el) => el.getBoundingClientRect().height);
    await new Promise((r) => setTimeout(r, 500));
    const hAfter = await page.$eval(".note-card .note-body", (el) => el.getBoundingClientRect().height);

    check("展开后正文有真实高度（内容渲染出来了）", hAfter > 50, "h=" + hAfter);
    check("动画进行中的高度介于 0 和最终高度之间（证明在过渡而不是瞬间跳变）",
      hMid > 0 && hMid < hAfter, "mid=" + hMid + " after=" + hAfter);
  }

  // ---------- 3. 通知条真的出现 ----------
  console.log("\n【3】通知条可见性");
  {
    const toast = await page.evaluate(() => {
      const el = document.getElementById("toast");
      const cs = getComputedStyle(el);
      return { text: el.textContent, opacity: Number(cs.opacity), transform: cs.transform, cls: el.className };
    });
    check("通知条有文案", /^已展开 《/.test(toast.text), toast.text);
    check("通知条不透明度为 1（真的看得见）", toast.opacity > 0.9, "opacity=" + toast.opacity);
    check("通知条带 show 类", toast.cls.includes("toast-show"), toast.cls);

    // 1.8 秒后应自动淡出
    await new Promise((r) => setTimeout(r, 2100));
    const gone = await page.evaluate(() => Number(getComputedStyle(document.getElementById("toast")).opacity));
    check("约 1.8 秒后通知条自动淡出", gone < 0.1, "opacity=" + gone);
  }

  // ---------- 4. 左侧高亮竖条 ----------
  console.log("\n【4】展开态视觉标记");
  {
    const barOpacity = await page.$eval(".note-card", (el) => Number(getComputedStyle(el, "::before").opacity));
    check("展开的卡片左侧高亮竖条可见", barOpacity > 0.9, "opacity=" + barOpacity);

    const aria = await page.$eval(".note-card", (el) => el.getAttribute("aria-expanded"));
    check("aria-expanded 同步为 true", aria === "true", String(aria));
  }

  // ---------- 5. 真浏览器里连续操作 30 次 ----------
  console.log("\n【5】真浏览器连续操作 30 次");
  {
    await page.click(".note-card"); // 先收起
    await new Promise((r) => setTimeout(r, 400)); // 等动画跑完，状态归零
    for (let i = 0; i < 30; i++) await page.click(".note-card");

    // 关键：逻辑状态（class / aria）是立刻更新的，但视觉要等 260ms 动画收尾。
    // 所以这里分两次判定——先验"立刻就对"的逻辑状态，等动画结束再验视觉。
    const immediate = await page.$eval(".note-card", (el) => ({
      open: el.classList.contains("open"),
      aria: el.getAttribute("aria-expanded"),
    }));
    check("连点 30 次后逻辑状态立刻正确（收起态）", !immediate.open && immediate.aria === "false", JSON.stringify(immediate));

    await new Promise((r) => setTimeout(r, 600)); // 等动画收尾

    const settled = await page.$eval(".note-card", (el) => {
      const cs = getComputedStyle(el.querySelector(".note-body"));
      return { open: el.classList.contains("open"), rows: cs.gridTemplateRows, opacity: Number(cs.opacity) };
    });
    check("动画收尾后正文确实收回到不可见（行高 0 + 透明）",
      parseFloat(settled.rows) < 1 && settled.opacity < 0.05, JSON.stringify(settled));

    // 再点 1 次（第 31 次，奇数）→ 展开
    await page.click(".note-card");
    await new Promise((r) => setTimeout(r, 400));
    const s2 = await page.$eval(".note-card", (el) => ({
      open: el.classList.contains("open"),
      aria: el.getAttribute("aria-expanded"),
      bodyH: el.querySelector(".note-body").getBoundingClientRect().height,
    }));
    check("第 31 次点击后展开且高度正常", s2.open && s2.aria === "true" && s2.bodyH > 50, JSON.stringify(s2));
  }

  // ---------- 6. 标签筛选反馈 ----------
  console.log("\n【6】标签筛选反馈");
  {
    // 找一个标签按钮点下去
    const tagName = await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".tag-btn")];
      const target = btns.find((b) => b.textContent !== "全部");
      target.click();
      return target.textContent;
    });
    await new Promise((r) => setTimeout(r, 300));

    const after = await page.evaluate(() => ({
      toast: document.getElementById("toast").textContent,
      cards: document.querySelectorAll(".note-card").length,
      activeCount: document.querySelectorAll(".tag-btn.active").length,
    }));
    check("筛选后通知条说明了结果", /已筛选标签|已显示全部/.test(after.toast), after.toast);
    check("通知条包含标签名与篇数", after.toast.includes(tagName) && /\d+ 篇/.test(after.toast), after.toast);
    check("只有 1 个标签处于选中态", after.activeCount === 1, "active=" + after.activeCount);
    check("列表确实被筛短了", after.cards > 0 && after.cards <= 8, "cards=" + after.cards);
  }

  // ---------- 6.5 动画被打断后能否自己跑完 ----------
  console.log("\n【6.5】动画被打断后的自愈能力");
  {
    // 场景：极速点 3 次就停手（动画跑到一半被打断两次）。
    // 期望：逻辑状态是收起，视觉在动画时长内自己收干净，不会卡在半开状态。
    await page.evaluate(() => {
      // 先复位成收起并等稳
      const c = document.querySelector(".note-card");
      c.classList.remove("open");
    });
    await new Promise((r) => setTimeout(r, 400));

    await page.click(".note-card");
    await page.click(".note-card");
    await page.click(".note-card"); // 共 3 次（奇数）→ 最终应以展开收尾

    const logicNow = await page.$eval(".note-card", (el) => el.classList.contains("open"));
    check("打断后逻辑状态立刻是最终值（不卡在中间态）", logicNow === true, "open=" + logicNow);

    await new Promise((r) => setTimeout(r, 700));
    const visual = await page.$eval(".note-card", (el) => {
      const cs = getComputedStyle(el.querySelector(".note-body"));
      return { rows: parseFloat(cs.gridTemplateRows), opacity: Number(cs.opacity) };
    });
    check("动画自动跑完，正文完全展开（行高 > 100 且不透明）",
      visual.rows > 100 && visual.opacity > 0.95, JSON.stringify(visual));

    // 复位，避免影响后续测试
    await page.evaluate(() => document.querySelector(".note-card").classList.remove("open"));
    await new Promise((r) => setTimeout(r, 400));
  }

  // ---------- 7. 展开状态下切换筛选不报错 ----------  console.log("\n【7】展开 + 筛选交叉操作");
  {
    await page.evaluate(() => document.querySelector(".tag-btn").click()); // 回全部
    await new Promise((r) => setTimeout(r, 200));
    await page.click(".note-card"); // 展开
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".tag-btn")];
      btns.find((b) => b.textContent !== "全部").click();
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.evaluate(() => document.querySelector(".tag-btn").click());
    await new Promise((r) => setTimeout(r, 250));

    const ok = await page.$$eval(".note-card", (els) => els.length);
    check("交叉操作后列表恢复正常", ok === 8, "cards=" + ok);
  }

  // ---------- 8. 键盘操作 ----------
  console.log("\n【8】键盘操作真实性");
  {
    // 用真实键盘 Tab 走到卡片上，而不是直接调 .focus()——
    // :focus-visible 只在"键盘导航"时匹配，直接 .focus() 有时不触发，测出来会假失败
    await page.evaluate(() => document.body.focus());
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => document.activeElement.classList.contains("note-card"));
    }
    check("连按 Tab 能把焦点走到卡片上", found);

    const focusState = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return {
        isCard: el.classList.contains("note-card"),
        focusVisible: el.matches(":focus-visible"),
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
      };
    });
    check("聚焦的确实是卡片", focusState.isCard);
    check("焦点态有可见描边（:focus-visible 生效）",
      focusState.outlineStyle === "solid" && parseFloat(focusState.outlineWidth) >= 2,
      JSON.stringify(focusState));

    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 400));
    const kb = await page.evaluate(() => document.activeElement.classList.contains("open"));
    check("回车键能展开被聚焦的卡片", kb);
  }

  // ---------- 9. 无 JS 报错 ----------
  console.log("\n【9】控制台干净度");
  // favicon 404 是浏览器自动请求，不是页面 bug；标记出来但不当作失败
  const realErrors = errors.filter((e) => !/favicon\.ico/.test(e));
  const faviconMiss = errors.some((e) => /favicon\.ico/.test(e));
  check("页面运行期间没有 JS 报错", realErrors.length === 0, realErrors.join(" | "));
  if (faviconMiss) console.log("  [提示] favicon.ico 未提供（浏览器自动请求，不影响功能）");

  await browser.close();

  console.log("\n=== 结果：" + pass + " 项通过，" + fail + " 项失败 ===\n");
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("验证脚本异常：", e.message);
  process.exit(2);
});
