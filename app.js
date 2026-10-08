// app.js — 学习笔记站交互逻辑（Day 8：mock 数据版主视图；Day 13：三个视图 + 四种状态）
// 职责：拉数据 → 处理四种页面状态 → 渲染标签栏与列表 → 标签筛选 → 视图切换
// 数据来源由 USE_MOCK 开关控制：true = 本地假数据（Day 8），false = notes/ 目录的 Markdown 文件（Day 7）
// 组件（卡片/列表/状态提示/面包屑/详情）在 components.js，路由在 router.js，数据流见 TECH_DESIGN.md 第 1、4 节

// ============ 开关区 ============
const USE_MOCK = true;          // Day 23 接数据库时，这里改成 false 或换成接口地址即可

// 假数据的模拟延迟（毫秒）：故意留出来，好观察"加载中"状态
const MOCK_DELAY = 600;

// 演示用：在网址后加 ?state=empty / ?state=error / ?delay=3000 可预览不同状态（方便截图与自测）
const DEMO_STATE = new URLSearchParams(location.search).get("state");
const DEMO_DELAY = Number(new URLSearchParams(location.search).get("delay")) || MOCK_DELAY;

// Day 12：?tag=某标签 可直接以某个筛选状态打开页面。
// 为什么需要它：标签栏只列数据里存在的标签，"筛不到结果"这一路点不出来，
// 加这个参数才能触发并验证 AC-7 的空状态（filter-check Skill 依赖它）。
const DEMO_TAG = new URLSearchParams(location.search).get("tag");

// Day 13：?view=四种状态各一屏 的截图辅助。
// 它的作用是让"加载中"这一态能被稳定截到——正常加载只有 600ms，截图脚本很难卡准，
// 加长延迟后就能拍到。注意它不改变任何业务逻辑，只是把 MOCK_DELAY 拉长。
// （?delay= 已能起到同样作用，这里保留说明以免后人重复造轮子。）

// 真实文件清单（USE_MOCK = false 时生效）：新增一篇笔记 = 建一个 .md 文件 + 在这里加一行
const NOTE_FILES = [
  "2026-09-27-给AI定规矩.md",
  "2026-09-26-技术选型.md",
  "2026-09-25-写PRD.md",
  "2026-09-22-Git三连.md",
];

// ============ DOM ============
const noteList = document.getElementById("note-list");
const tagBar = document.getElementById("tag-bar");
const stateArea = document.getElementById("state-area");   // 加载 / 空 / 出错 三种状态都放这里

// Day 13：三个视图容器 + 导航
const views = {
  list: document.getElementById("view-list"),
  note: document.getElementById("view-note"),
  about: document.getElementById("view-about"),
};
const navLinks = Array.from(document.querySelectorAll("[data-nav]"));

// ============ 状态 ============
let notes = [];              // 全部笔记（已按日期倒序）
let activeTag = "全部";
let loadError = null;        // 记录加载失败的原因（切回列表视图时要复原错误状态）
let dataLoaded = false;      // 数据是否已成功取回（取回后为空数组也是一种"已加载"）

// ============ 1. 数据源层 ============
// 统一出口 fetchNotes()：不管数据来自假数据、文件还是将来的数据库接口，都返回同样结构的数组
async function fetchNotes() {
  if (DEMO_STATE === "error") {
    // 演示出错状态：模拟接口失败
    throw new Error("示例错误：数据源暂时不可用（这是 Day 8 的演示状态）");
  }

  if (USE_MOCK) {
    // 模拟网络延迟，让"加载中"状态可见
    await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY));
    if (DEMO_STATE === "empty") return [];   // 演示空状态
    return MOCK_NOTES.slice();               // 用假数据（见 mock-data.js）
  }

  // 备选路径：读取 notes/ 下的真实 Markdown 文件（Day 7 的实现，保留不删）
  const textList = await Promise.all(
    NOTE_FILES.map(async (file) => {
      const res = await fetch("notes/" + file);
      if (!res.ok) throw new Error("读取 " + file + " 失败（HTTP " + res.status + "）");
      return res.text();
    })
  );
  return textList.map(parseNote);
}

// 解析 Markdown：头部（两个 --- 之间）是 date / title / tags / summary 四个字段（PRD 第 4 节）
function parseNote(text) {
  const parts = text.split(/^---\s*$/m);
  const head = parts[1] || "";
  const body = (parts.slice(2).join("---") || "").trim();

  const note = { tags: [] };
  head.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key === "tags") {
      note.tags = value.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
    } else {
      note[key] = value;
    }
  });
  note.body = body;
  return note;
}

// ============ 2. 四种页面状态 ============
// 只保留一个显示中的状态，避免"加载中"和"空状态"同时出现
function showState(type, message) {
  stateArea.innerHTML = "";
  stateArea.appendChild(createStateBox(type, message));  // 组件来自 components.js
  stateArea.hidden = false;
}

function clearState() {
  stateArea.innerHTML = "";
  stateArea.hidden = true;
}

// ============ 3. 渲染：标签栏（F3 / AC-4）============
function buildTagBar() {
  const tags = ["全部"];
  notes.forEach((n) => n.tags.forEach((t) => { if (!tags.includes(t)) tags.push(t); }));

  // Day 12：当前筛选的标签即使没有笔记，也要出现在栏里并高亮。
  // 否则用户从 ?tag= 进来会看到"没有任何按钮是选中的"，不知道自己在看什么筛选。
  if (activeTag !== "全部" && !tags.includes(activeTag)) tags.push(activeTag);

  tagBar.innerHTML = "";
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn" + (tag === activeTag ? " active" : "");
    btn.textContent = tag;
    // Day 11 无障碍：让读屏软件知道这个标签当前是否处于选中状态
    btn.setAttribute("aria-pressed", String(tag === activeTag));
    // Day 12：该标签下没有笔记时给个视觉提示，别让用户点了才发现是空的
    const count = tag === "全部"
      ? notes.length
      : notes.filter((n) => n.tags.includes(tag)).length;
    btn.title = tag + "：" + count + " 篇笔记";
    if (count === 0) btn.classList.add("tag-btn-empty");
    btn.addEventListener("click", () => {
      // 再点同一个标签 = 取消筛选，回到全部
      activeTag = tag === activeTag ? "全部" : tag;
      buildTagBar();
      renderNotes();
      // Day 11 反馈：筛选结果也要说一声，否则用户只看到"卡片突然变少了"
      announceFilterResult();
    });
    tagBar.appendChild(btn);
  });
}

// Day 11 反馈：把"筛了什么、还剩几条"说出来（文字通道）
// 这是标签筛选最容易漏掉的一环——内容变了，但用户不知道为什么变少
function announceFilterResult() {
  const count = activeTag === "全部"
    ? notes.length
    : notes.filter((n) => n.tags.includes(activeTag)).length;

  const message = activeTag === "全部"
    ? "已显示全部 " + count + " 篇笔记"
    : "已筛选标签「" + activeTag + "」，共 " + count + " 篇";

  showToast(message, count > 0 ? "info" : "error");
  announce(message);
}

// ============ 4. 渲染：列表 + 筛选 + 空状态（F1 / F2 / AC-1、AC-2、AC-3、AC-4、AC-7）============
function renderNotes() {
  const visible = activeTag === "全部"
    ? notes
    : notes.filter((n) => n.tags.includes(activeTag));

  renderNoteList(noteList, visible);   // 组件来自 components.js

  if (visible.length === 0) {
    // Day 12：空状态分两种，文案不能混用——
    //   ① 全站确实没有笔记（首次使用）→ 引导"写下第一篇"
    //   ② 有笔记但当前标签筛不出结果（AC-7）→ 引导"点全部返回"
    // 注意：标签栏只列出数据里存在的标签，所以情况②在正常点击下走不到，
    // 需要靠 ?tag=不存在的标签 或数据变化触发。filter-check Skill 会盯这一点。
    const filteredEmpty = activeTag !== "全部";
    showState("empty", filteredEmpty
      ? "标签「" + activeTag + "」下还没有笔记，点「全部」返回完整列表。"
      : "还没有任何笔记，写下第一篇就会出现在这里。");
  } else {
    clearState();
  }
}

// ============ 5. 视图切换（Day 13）============
//
// 今天要回答的问题：页面之间怎么切换，我选了哪种方式？为什么？
// 选的是 **hash 路由**（router.js），不引入路由库。三个原因：
//   ① 地址栏可见可分享：#/note/2026-09-22 能收藏、能刷新、能发给别人
//   ② 前进/后退自动生效：不用自己维护历史栈
//   ③ 零依赖、静态站原生可用：GitHub Pages 不需要任何服务器配置
// 为什么不用 history API：要处理仓库子路径和刷新 404，今天就三个视图，够用即可
// （今天的「不做」里写了：路由库的进阶用法不碰）

// 切换视图：显示一个、隐藏其余，并同步导航高亮
function showView(name) {
  Object.keys(views).forEach((key) => {
    if (views[key]) views[key].hidden = key !== name;
  });

  // 导航高亮：单篇笔记在语义上属于「笔记」这一组，所以列表项保持选中
  navLinks.forEach((link) => {
    const target = link.dataset.nav;
    const active = target === "list"
      ? (name === "list" || name === "note")
      : target === name;
    link.classList.toggle("active", active);
    // 无障碍：让读屏软件也知道当前在哪一页
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

// 渲染单篇笔记视图
function renderNoteView(params) {
  const container = views.note;
  container.innerHTML = "";

  // 面包屑（余力加练）：笔记 → 当前这篇，让用户知道怎么退回去
  const note = notes.find((n) => n.date === params.date);
  const crumb = createBreadcrumb([
    { label: "全部笔记", href: "#/" },
    { label: note ? note.title : (params.date || "未知") },
  ]);
  container.appendChild(crumb);

  if (note) {
    container.appendChild(createNoteView(note));
  } else {
    // 找不到笔记不是"出错"，是"这个地址没有内容"——用空态文案，不用错误态
    container.appendChild(createNotFoundBox(params.date));
  }

  // 返回上一页（余力加练）：优先用浏览器历史，没有历史（比如直接输地址进来）就回列表
  const back = document.createElement("p");
  back.className = "back-line";
  back.innerHTML = '<a href="#/" class="back-link">← 返回上一页</a>';
  back.querySelector("a").addEventListener("click", (e) => {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
  container.appendChild(back);
}

// 渲染关于视图：复用底部关于区的同一份文案，避免两处不一致
function renderAboutView() {
  const container = views.about;
  container.innerHTML = "";

  const source = document.getElementById("about-source");
  const card = document.createElement("div");
  card.className = "about-card";
  card.innerHTML = "<h2>关于这个站</h2>";
  // 直接搬运节点内容（不是 innerHTML 复制字符串），保证与底部永远一致
  if (source) card.innerHTML += source.innerHTML;
  container.appendChild(card);
}

// 视图变化的总入口：router 只报"现在该看哪个视图"，具体渲染在这里
function onViewChange(name, params) {
  showView(name);

  if (name === "note") {
    renderNoteView(params);
  } else if (name === "about") {
    renderAboutView();
  } else {
    // 回到列表视图：把当前该显示的状态复原
    // 注意这里**不能**写成 `if (notes.length || activeTag !== "全部")`——
    // 那样"全站没有任何笔记"（notes 为空）时反而不渲染，页面会永远停在加载态。
    // 空状态也是一种要渲染的结果，不是"没什么可做"。
    if (loadError) {
      showState("error", loadError);
    } else if (dataLoaded) {
      buildTagBar();
      renderNotes();
    }
  }

  // 切视图后回到顶部，否则从长列表点进详情会停在页面中间
  window.scrollTo({ top: 0, behavior: "auto" });
}

// ============ 6. 启动流程 ============
async function init() {
  // 先按地址渲染一次骨架：这样即使数据还在加载，用户看到的也是"正确视图的加载态"，
  // 而不是先闪一下别的视图再跳过去
  router.on(onViewChange);
  router.start();

  // 单篇笔记视图依赖数据，所以数据没到之前先在这里显示加载态
  showState("loading", USE_MOCK ? "正在读取本地示例数据……" : "正在读取笔记文件……");
  views.note.innerHTML = '<div class="state-box state-loading"><div class="state-icon">…</div><p class="state-title">笔记加载中</p></div>';

  try {
    notes = await fetchNotes();
    notes.sort((a, b) => (a.date < b.date ? 1 : -1));   // 日期倒序（AC-1）

    // Day 12：若网址带了 ?tag=，直接以该筛选状态开局（用于验证空状态与截图）
    if (DEMO_TAG) activeTag = DEMO_TAG;

    loadError = null;
    dataLoaded = true;

    // 数据到位后，重新渲染当前视图（可能用户已经切到详情页了）
    onViewChange(router.view, router.params);
  } catch (err) {
    // 出错状态：说清"哪里错了 + 怎么补救"，绝不静默失败
    loadError = err.message +
      "<br>可以这样排查：① 加上 ?delay=3000 看是否为超时；② 确认用本地服务器打开而不是双击 index.html；③ 查看浏览器控制台的具体报错。";

    // 错误只在列表视图里显示——用户在详情页时不该突然被错误卡片顶掉
    if (router.view === "list") showState("error", loadError);
  }
}

init();

