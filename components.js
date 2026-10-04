// components.js — 可复用 UI 组件（Day 8 创建，Day 11 加入交互反馈）
// 把"卡片长什么样""列表怎么渲染"从业务逻辑里拆出来：
//   以后换数据来源（mock → 文件 → 数据库）只改 app.js，组件本身不用动
// 复用方法：只要传入一篇字段符合 PRD 第 4 节的笔记对象即可

// ---- 组件 1：单张笔记卡片 ----
// 入参 note：{ date, title, tags, summary, body }
// 返回：一个 <article> 元素（已绑定点击展开/收起 + 键盘操作 + 反馈）
function createNoteCard(note) {
  const card = document.createElement("article");
  card.className = "note-card";

  // Day 11 无障碍/键盘：卡片本身可聚焦（Tab 能走到）、可被读屏识别为可展开的按钮
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-expanded", "false");
  card.setAttribute("aria-label", "展开或收起笔记：" + note.title);

  // 卡片四要素：日期、标题、标签、摘要（PRD AC-2）
  const tagsHtml = (note.tags || [])
    .map((t) => `<span class="note-tag">${t}</span>`)
    .join("");

  card.innerHTML = `
    <div class="note-meta"><span class="note-date">${note.date}</span>${tagsHtml}</div>
    <h3>${note.title}</h3>
    <p class="note-summary">${note.summary}</p>
    <div class="note-body"><div class="note-body-inner">${marked.parse(note.body || "")}</div></div>
    <div class="note-toggle-hint"></div>
  `;

  card.addEventListener("click", () => toggleCard(card, note));
  // 键盘操作（余力加练）：回车 / 空格 与鼠标点击等价
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();          // 空格默认会滚动页面，要拦掉
      toggleCard(card, note);
    }
  });

  return card;
}

/**
 * 展开 / 收起一张卡片，并发出四路反馈（Day 11 核心函数）
 *
 * 反馈通道：
 *   ① 动效 —— CSS 里 .note-card.open 触发正文滑出（见 style.css transition）
 *   ② 视觉 —— 箭头文字从"展开全文"变成"收起"，卡片左侧出现高亮竖条
 *   ③ 文字 —— 顶部通知条直接说"已展开《标题》"
 *   ④ 无障碍 —— aria-expanded 更新 + 读屏播报
 *
 * 连续操作安全：整个函数是"读当前状态 → 取反 → 写回"，不依赖任何累积变量，
 * 所以连点 20 次的结果和点 1 次完全一致（状态永远不会卡在中间值）。
 */
function toggleCard(card, note) {
  const willOpen = !card.classList.contains("open");

  // 一次性写完状态：class 和 aria 同时更新，不会出现"视觉已展开但读屏说收起"的不一致
  card.classList.toggle("open", willOpen);
  card.setAttribute("aria-expanded", String(willOpen));

  // 通知条文案用「完成态」，不用「正在…」——用户要的是确认，不是过程
  const title = note && note.title ? "《" + note.title + "》" : "这篇笔记";
  const message = (willOpen ? "已展开 " : "已收起 ") + title;

  showToast(message, willOpen ? "success" : "info");
  announce(message);
}

// ---- 组件 2：笔记列表 ----
// 入参 container：容器元素；notes：笔记数组
// 副作用：清空容器并批量插入卡片
function renderNoteList(container, notes) {
  container.innerHTML = "";
  notes.forEach((note) => container.appendChild(createNoteCard(note)));
}

// ---- 组件 3：页面状态提示（Day 8 新增：加载 / 空 / 出错三种非正常态）----
// 入参 type：loading | empty | error；message：可选自定义文案
function createStateBox(type, message) {
  const box = document.createElement("div");
  box.className = "state-box state-" + type;

  const icons = { loading: "…", empty: "○", error: "!" };
  const titles = {
    loading: "笔记加载中",
    empty: "这里还没有内容",
    error: "笔记加载失败",
  };

  box.innerHTML = `
    <div class="state-icon">${icons[type] || "…"}</div>
    <p class="state-title">${titles[type] || "提示"}</p>
    ${message ? `<p class="state-detail">${message}</p>` : ""}
  `;
  return box;
}
