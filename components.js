// components.js — 可复用 UI 组件（Day 8 创建，Day 11 加入交互反馈，Day 13 加入面包屑/详情/找不到）
// 把"卡片长什么样""列表怎么渲染"从业务逻辑里拆出来：
//   以后换数据来源（mock → 文件 → 数据库）只改 app.js，组件本身不用动
// 复用方法：只要传入一篇字段符合 PRD 第 4 节的笔记对象即可

// ---- 小工具：一篇笔记对应的详情页地址 ----
// 单独放这里而不是直接用 router.hrefFor，是为了让组件不依赖 router.js 的加载顺序。
// 规则必须和 router.js 的 hrefFor('note') 保持一致（#/note/<日期>）。
function hrefForNote(note) {
  return "#/note/" + encodeURIComponent((note && note.date) || "");
}

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

  // Day 13：卡片里加一个"打开独立页面"的入口。
  // 为什么不让整张卡片直接跳转：Day 11 已经把"点击卡片 = 原位展开"做成了主要交互
  // （AC-3 要求），直接改成跳转会把那天的成果推翻。
  // 所以这里做的是"两个动作分开"：点卡片 = 展开预览，点这个链接 = 进入独立视图。
  // 详情视图的价值在于地址可分享、可刷新、可前进后退——展开做不到这三件事。
  const openLink = document.createElement("a");
  openLink.className = "note-open-link";
  openLink.href = hrefForNote(note);
  openLink.textContent = "打开独立页面 →";
  // 链接在卡片内部，点击时不能顺带触发卡片的展开/收起
  openLink.addEventListener("click", (e) => e.stopPropagation());
  card.appendChild(openLink);

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

// ---- 组件 4：面包屑（Day 13 新增，余力加练的一部分）----
// 入参 crumb 数组：[{ label, href }]，最后一项是当前位置（不给 href，也不可点）
// 为什么需要它：单篇笔记是"从列表进来的深层页面"，
// 面包屑告诉用户"我在哪、怎么退回去"，比只留一个返回按钮更清楚层级
function createBreadcrumb(crumbs) {
  const nav = document.createElement("nav");
  nav.className = "breadcrumb";
  nav.setAttribute("aria-label", "面包屑导航");

  const parts = crumbs.map((c, i) => {
    const isLast = i === crumbs.length - 1;
    if (isLast) {
      // 当前位置：用 aria-current 告诉读屏软件"你正在这里"，视觉上用加粗区分
      return `<span class="crumb-current" aria-current="page">${c.label}</span>`;
    }
    return `<a class="crumb-link" href="${c.href}">${c.label}</a>`;
  });

  // 分隔符用 CSS 的 ::after 画，读屏软件不会去读它（避免念出"斜杠"）
  nav.innerHTML = parts.join('<span class="crumb-sep" aria-hidden="true"></span>');
  return nav;
}

// ---- 组件 5：单篇笔记视图（Day 13 新增）----
// 入参 note：一篇笔记对象；返回一个已填好内容的容器
// 注意：正文渲染逻辑与卡片里的完全一致，但这里是"独立视图"——
// 卡片是列表里的原位展开，本视图是地址可分享的独立页面（可刷新、可收藏）
function createNoteView(note) {
  const box = document.createElement("article");
  box.className = "note-detail";

  const tagsHtml = (note.tags || [])
    .map((t) => `<span class="note-tag">${t}</span>`)
    .join("");

  box.innerHTML = `
    <div class="note-meta">
      <span class="note-date">${note.date}</span>${tagsHtml}
    </div>
    <h2 class="note-detail-title">${note.title}</h2>
    <p class="note-detail-summary">${note.summary}</p>
    <div class="note-detail-body">${marked.parse(note.body || "")}</div>
  `;
  return box;
}

// ---- 组件 6：找不到笔记时的提示（Day 13 新增）----
// 场景：用户手改了地址栏的日期、或分享了一个已删除笔记的链接
// 这不是"出错"，是"这个地址没有内容"——所以文案要和错误状态区分开
function createNotFoundBox(date) {
  const box = document.createElement("div");
  box.className = "state-box state-empty";
  box.innerHTML = `
    <div class="state-icon">○</div>
    <p class="state-title">没有找到这篇笔记</p>
    <p class="state-detail">地址里的「${date || "(空)"}」对不上任何一篇笔记，可能链接过期或日期写错了。</p>
    <p class="state-detail"><a href="#/">← 回到笔记列表</a></p>
  `;
  return box;
}

// ---- 组件 7：页面状态提示（Day 8 新增：加载 / 空 / 出错三种非正常态）----
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
