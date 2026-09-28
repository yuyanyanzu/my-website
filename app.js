// app.js — 学习笔记站交互逻辑（Day 7）
// 职责：加载 notes/ 下的 Markdown 笔记 → 解析头部字段 → 渲染卡片 → 标签筛选 → 点击展开正文
// 数据流见 TECH_DESIGN.md 第 1、4 节

// 笔记文件清单：新增一篇笔记 = 在 notes/ 目录建一个 .md 文件，然后在这里加一行文件名
// （静态站没法自动列目录，Day 23 接数据库后这一步会消失）
const NOTE_FILES = [
  "2026-09-27-给AI定规矩.md",
  "2026-09-26-技术选型.md",
  "2026-09-25-写PRD.md",
  "2026-09-22-Git三连.md",
];

const noteList = document.getElementById("note-list");
const tagBar = document.getElementById("tag-bar");
const emptyState = document.getElementById("empty-state");
const loading = document.getElementById("loading");

let notes = [];      // 全部笔记（已按日期倒序）
let activeTag = "全部";

// ---- 1. 拉取并解析所有笔记 ----
async function loadNotes() {
  // Promise.all：几篇笔记同时拉取，谁也不等谁
  const results = await Promise.all(
    NOTE_FILES.map(async (file) => {
      const res = await fetch("notes/" + file);
      const text = await res.text();
      return parseNote(text);
    })
  );

  // 按日期倒序：最新的排最上面（AC-1）
  notes = results.sort((a, b) => (a.date < b.date ? 1 : -1));
  loading.hidden = true;
  buildTagBar();
  renderNotes();
}

// 解析一篇 Markdown：
// 头部（两个 --- 之间）是 date / title / tags / summary 四个字段（PRD 第 4 节）
// 分隔线以下是正文 body
function parseNote(text) {
  const parts = text.split(/^---\s*$/m); // 按单独一行的 --- 切开
  const head = parts[1] || "";
  const body = (parts.slice(2).join("---") || "").trim();

  const note = { tags: [] };
  head.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key === "tags") {
      // 标签用顿号或逗号分隔，存成数组
      note.tags = value.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
    } else {
      note[key] = value;
    }
  });
  note.body = body;
  return note;
}

// ---- 2. 渲染标签栏（F3 / AC-4）----
function buildTagBar() {
  // 收集所有笔记里出现过的标签，去重
  const tags = ["全部"];
  notes.forEach((n) => {
    n.tags.forEach((t) => {
      if (!tags.includes(t)) tags.push(t);
    });
  });

  tagBar.innerHTML = "";
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn" + (tag === activeTag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      // 再点同一个标签 = 取消筛选，回到全部（PRD F3 的规则）
      activeTag = tag === activeTag ? "全部" : tag;
      buildTagBar();
      renderNotes();
    });
    tagBar.appendChild(btn);
  });
}

// ---- 3. 渲染笔记列表（F1 / AC-1、AC-2；筛选 AC-4；空状态 AC-7）----
function renderNotes() {
  const visible = activeTag === "全部"
    ? notes
    : notes.filter((n) => n.tags.includes(activeTag));

  noteList.innerHTML = "";
  emptyState.hidden = visible.length > 0; // 没有结果就显示空状态提示

  visible.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";

    // 卡片四要素：日期、标题、标签、摘要（AC-2）
    const tagsHtml = note.tags.map((t) => `<span class="note-tag">${t}</span>`).join("");
    card.innerHTML = `
      <div class="note-meta"><span>${note.date}</span>${tagsHtml}</div>
      <h3>${note.title}</h3>
      <p class="note-summary">${note.summary}</p>
      <div class="note-body">${marked.parse(note.body)}</div>
      <div class="note-toggle-hint"></div>
    `;

    // 点击卡片原位展开 / 收起正文（F2 / AC-3）
    card.addEventListener("click", () => {
      card.classList.toggle("open");
    });

    noteList.appendChild(card);
  });
}

// ---- 启动 ----
loadNotes().catch((err) => {
  loading.innerHTML = "<p>笔记加载失败：" + err.message +
    "<br>请确认是用本地服务器打开的（见 README.md），而不是直接双击 index.html。</p>";
});
