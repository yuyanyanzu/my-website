// app.js — 学习笔记站交互逻辑（Day 8：mock 数据版主视图）
// 职责：拉数据 → 处理四种页面状态 → 渲染标签栏与列表 → 标签筛选
// 数据来源由 USE_MOCK 开关控制：true = 本地假数据（Day 8），false = notes/ 目录的 Markdown 文件（Day 7）
// 组件（卡片/列表/状态提示）在 components.js，数据流见 TECH_DESIGN.md 第 1、4 节

// ============ 开关区 ============
const USE_MOCK = true;          // Day 23 接数据库时，这里改成 false 或换成接口地址即可

// 假数据的模拟延迟（毫秒）：故意留出来，好观察"加载中"状态
const MOCK_DELAY = 600;

// 演示用：在网址后加 ?state=empty / ?state=error / ?delay=3000 可预览不同状态（方便截图与自测）
const DEMO_STATE = new URLSearchParams(location.search).get("state");
const DEMO_DELAY = Number(new URLSearchParams(location.search).get("delay")) || MOCK_DELAY;

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

// ============ 状态 ============
let notes = [];              // 全部笔记（已按日期倒序）
let activeTag = "全部";

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

  tagBar.innerHTML = "";
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn" + (tag === activeTag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      // 再点同一个标签 = 取消筛选，回到全部
      activeTag = tag === activeTag ? "全部" : tag;
      buildTagBar();
      renderNotes();
    });
    tagBar.appendChild(btn);
  });
}

// ============ 4. 渲染：列表 + 筛选 + 空状态（F1 / F2 / AC-1、AC-2、AC-3、AC-4、AC-7）============
function renderNotes() {
  const visible = activeTag === "全部"
    ? notes
    : notes.filter((n) => n.tags.includes(activeTag));

  renderNoteList(noteList, visible);   // 组件来自 components.js

  if (visible.length === 0) {
    showState("empty", activeTag === "全部"
      ? "还没有任何笔记，写下第一篇就会出现在这里。"
      : "标签「" + activeTag + "」下还没有笔记，点「全部」返回完整列表。");
  } else {
    clearState();
  }
}

// ============ 5. 启动流程 ============
async function init() {
  showState("loading", USE_MOCK ? "正在读取本地示例数据……" : "正在读取笔记文件……");
  try {
    notes = await fetchNotes();
    notes.sort((a, b) => (a.date < b.date ? 1 : -1));   // 日期倒序（AC-1）
    buildTagBar();
    renderNotes();
  } catch (err) {
    // 出错状态：说清"哪里错了 + 怎么补救"，绝不静默失败
    showState("error", err.message +
      "<br>可以这样排查：① 加上 ?delay=3000 看是否为超时；② 确认用本地服务器打开而不是双击 index.html；③ 查看浏览器控制台的具体报错。");
  }
}

init();
