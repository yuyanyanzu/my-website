// components.js — 可复用 UI 组件（Day 8 余力加练产出）
// 把"卡片长什么样""列表怎么渲染"从业务逻辑里拆出来：
//   以后换数据来源（mock → 文件 → 数据库）只改 app.js，组件本身不用动
// 复用方法：只要传入一篇字段符合 PRD 第 4 节的笔记对象即可

// ---- 组件 1：单张笔记卡片 ----
// 入参 note：{ date, title, tags, summary, body }
// 返回：一个 <article> 元素（已绑定点击展开/收起）
function createNoteCard(note) {
  const card = document.createElement("article");
  card.className = "note-card";

  // 卡片四要素：日期、标题、标签、摘要（PRD AC-2）
  const tagsHtml = (note.tags || [])
    .map((t) => `<span class="note-tag">${t}</span>`)
    .join("");

  card.innerHTML = `
    <div class="note-meta"><span class="note-date">${note.date}</span>${tagsHtml}</div>
    <h3>${note.title}</h3>
    <p class="note-summary">${note.summary}</p>
    <div class="note-body">${marked.parse(note.body || "")}</div>
    <div class="note-toggle-hint"></div>
  `;

  // 点击卡片原位展开 / 收起正文（PRD AC-3）
  card.addEventListener("click", () => card.classList.toggle("open"));

  return card;
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
