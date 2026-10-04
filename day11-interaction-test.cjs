// day11-interaction-test.cjs — Day 11 交互反馈与连续操作测试
// 做法：手写一个最小的 DOM 桩（classList / setAttribute / addEventListener / innerHTML）
// 把 components.js + feedback.js 的真实源码读进来执行，然后疯狂连点，看状态会不会乱。
// 注意：这里跑的是**真代码**，不是重新写一遍逻辑，所以测出来的结论对页面有效。

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = __dirname;

// ---------- 1. 最小 DOM 桩 ----------
function makeEl(tag) {
  const el = {
    tagName: tag,
    _classes: new Set(),
    _attrs: {},
    _listeners: {},
    children: [],
    innerHTML: "",
    textContent: "",
    tabIndex: 0,
    className: "",
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      contains: (c) => el._classes.has(c),
      toggle: (c, force) => {
        const want = force === undefined ? !el._classes.has(c) : force;
        if (want) el._classes.add(c); else el._classes.delete(c);
        return want;
      },
    },
    setAttribute: (k, v) => { el._attrs[k] = String(v); },
    getAttribute: (k) => (k in el._attrs ? el._attrs[k] : null),
    addEventListener: (type, fn) => {
      (el._listeners[type] = el._listeners[type] || []).push(fn);
    },
    appendChild: (child) => { el.children.push(child); return child; },
    // 测试里直接手动触发，模拟真实点击
    click: () => (el._listeners.click || []).forEach((fn) => fn({ type: "click" })),
    keydown: (key) => (el._listeners.keydown || []).forEach((fn) => fn({
      key, preventDefault: () => { el._prevented = true; },
    })),
  };
  // className 与 classList 保持同步（组件里两种写法都用了）
  Object.defineProperty(el, "className", {
    get: () => [...el._classes].join(" "),
    set: (v) => {
      el._classes.clear();
      String(v).split(/\s+/).filter(Boolean).forEach((c) => el._classes.add(c));
    },
  });
  return el;
}

// ---------- 2. 准备运行环境 ----------
const toastEl = makeEl("div");
const liveRegion = makeEl("div");

const sandbox = {
  console,
  document: {
    getElementById: (id) => {
      if (id === "toast") return toastEl;
      if (id === "live-region") return liveRegion;
      return makeEl("div");
    },
    createElement: makeEl,
  },
  // marked 只用来把正文变 HTML，测试里不需要真渲染
  marked: { parse: (md) => "<p>" + String(md).replace(/\n/g, " ") + "</p>" },
  setTimeout,
  clearTimeout,
};
sandbox.window = sandbox;

const ctx = vm.createContext(sandbox);
for (const f of ["feedback.js", "components.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
}

// ---------- 3. 断点 ----------
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  [通过] " + name); }
  else { fail++; console.log("  [失败] " + name + (extra ? " -> " + extra : "")); }
}

const NOTE = (i) => ({
  date: "2026-09-2" + i,
  title: "测试笔记" + i,
  tags: ["前端"],
  summary: "摘要" + i,
  body: "## 正文标题\n\n内容段落 " + i,
});

console.log("\n=== Day 11 交互反馈测试 ===\n");

// ---------- 测试 1：反馈是否发出 ----------
console.log("【1】单次点击的反馈");
{
  const card = ctx.createNoteCard(NOTE(1));
  check("初始 aria-expanded = false", card.getAttribute("aria-expanded") === "false");

  card.click();
  check("点击后卡片有 open 类", card.classList.contains("open"));
  check("点击后 aria-expanded = true", card.getAttribute("aria-expanded") === "true");
  check("通知条内容为「已展开《测试笔记1》」", toastEl.textContent === "已展开 《测试笔记1》", toastEl.textContent);
  check("通知条显示状态类已加", toastEl.classList.contains("toast-show"));
  check("通知条用了成功色", toastEl.classList.contains("toast-success"));
  check("读屏播报区内容一致", liveRegion.textContent === "已展开 《测试笔记1》", liveRegion.textContent);
}

// ---------- 测试 2：再次点击能正确收起 ----------
console.log("\n【2】再点一次 = 收起");
{
  const card = ctx.createNoteCard(NOTE(2));
  card.click();
  card.click();
  check("两次点击后回到收起", !card.classList.contains("open"));
  check("aria-expanded 回到 false", card.getAttribute("aria-expanded") === "false");
  check("通知条文案切到「已收起」", toastEl.textContent.startsWith("已收起"), toastEl.textContent);
  check("收起时用提示色而非成功色", !toastEl.classList.contains("toast-success"));
}

// ---------- 测试 3：连续操作（核心）----------
console.log("\n【3】连续操作压力测试");
{
  const card = ctx.createNoteCard(NOTE(3));

  // 3-1 同一张卡片连点 21 次（奇数次 → 应该是展开）
  for (let i = 0; i < 21; i++) card.click();
  check("连点 21 次后为展开态（奇数次）", card.classList.contains("open"));
  check("连点后 aria 与视觉一致(open)", card.getAttribute("aria-expanded") === "true");
  check("连点后通知条说的是「已展开」", toastEl.textContent.startsWith("已展开"), toastEl.textContent);

  // 3-2 再点 1 次，偶数次 → 应回到收起
  card.click();
  check("连点 22 次后为收起态", !card.classList.contains("open"));
  check("连点后 aria 与视觉一致(closed)", card.getAttribute("aria-expanded") === "false");

  // 3-3 极端连点 100 次，检查有没有出现中间态残留
  for (let i = 0; i < 100; i++) card.click();
  const isOpen = card.classList.contains("open");
  check("连点 100 次后视觉与 aria 仍然一致",
    isOpen === (card.getAttribute("aria-expanded") === "true"),
    "open=" + isOpen + " aria=" + card.getAttribute("aria-expanded"));
  check("连点 100 次后通知条非空且文案合法",
    /^(已展开|已收起) /.test(toastEl.textContent), toastEl.textContent);
}

// ---------- 测试 4：多张卡片互不干扰 ----------
console.log("\n【4】多张卡片交替连点");
{
  const cards = [1, 2, 3, 4].map((i) => ctx.createNoteCard(NOTE(i)));

  // 交替快速点：A→B→C→D→A→B→C→D
  for (let round = 0; round < 3; round++) {
    cards.forEach((c) => c.click());
  }
  // 每张被点了 3 次（奇数次）→ 全部应为展开
  check("4 张卡片各点 3 次后全部展开", cards.every((c) => c.classList.contains("open")));
  check("4 张卡片 aria 全部为 true",
    cards.every((c) => c.getAttribute("aria-expanded") === "true"));

  // 只收起第 2 张，其他不受影响
  cards[1].click();
  check("单独收起第 2 张生效", !cards[1].classList.contains("open"));
  check("其他 3 张保持展开（状态没有被连带改掉）",
    cards[0].classList.contains("open") && cards[2].classList.contains("open") && cards[3].classList.contains("open"));

  // 通知条只反映最后一次操作，不排队堆积
  check("通知条只显示最后一次操作的结果",
    toastEl.textContent === "已收起 《测试笔记2》", toastEl.textContent);
}

// ---------- 测试 5：键盘操作（余力加练）----------
console.log("\n【5】键盘操作与焦点");
{
  const card = ctx.createNoteCard(NOTE(5));
  check("卡片可被 Tab 聚焦（tabIndex = 0）", card.tabIndex === 0);
  check("卡片角色为 button", card.getAttribute("role") === "button");
  check("有 aria-label 供读屏识别", /展开或收起笔记/.test(card.getAttribute("aria-label") || ""));

  card.keydown("Enter");
  check("回车能展开", card.classList.contains("open"));

  card.keydown(" ");
  check("空格能收起", !card.classList.contains("open"));
  check("空格被拦掉了默认滚动行为", card._prevented === true);
}

// ---------- 测试 6：反馈不依赖后端 ----------
console.log("\n【6】反馈链路是否纯前端");
{
  const src = fs.readFileSync(path.join(dir, "feedback.js"), "utf8")
    + fs.readFileSync(path.join(dir, "components.js"), "utf8");
  const all = src;
  check("反馈代码里没有 fetch/XMLHttpRequest（不依赖后端）",
    !/fetch\(|XMLHttpRequest/.test(all));
  check("有 prefers-reduced-motion 处理（在 CSS 里）",
    /prefers-reduced-motion/.test(fs.readFileSync(path.join(dir, "style.css"), "utf8")));
}

console.log("\n=== 结果：" + pass + " 项通过，" + fail + " 项失败 ===\n");
process.exit(fail === 0 ? 0 : 1);
