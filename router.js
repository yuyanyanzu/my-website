// router.js — 视图切换（Day 13 新增）
//
// 【今天要回答的问题】页面之间怎么切换，我选了哪种方式？为什么？
// 答案：用 **hash 路由**（网址里 # 后面那段），不引入任何路由库。
//
// 为什么是 hash：
//   1. hash 变化不会让浏览器重新请求页面 —— 纯前端就能接管，静态站天然可用
//   2. 地址栏看得见（#/about），用户能收藏、能分享、能刷新后停在原地
//   3. 前进/后退按钮自动生效，不用自己写历史栈
//   4. 零依赖：官方 history API 也能做，但要在 GitHub Pages 上做子路径兼容，
//      hash 方案不需要服务器配合，够用就好（今天的"不做"里就写了不搞路由库进阶用法）
//
// 支持的地址：
//   #/            或  （空）      → 列表视图
//   #/note/<日期>                 → 单篇笔记视图
//   #/about                       → 关于视图
//
// 设计原则：router 只负责"现在是哪个视图"，**不负责渲染内容**。
// 渲染由 app.js 注册进来的回调完成，这样换视图不用动数据逻辑。

// ============ 路由表 ============
// 每条规则：path 用正则匹配 hash，name 是视图名，parse 从匹配结果里取出参数
const ROUTES = [
  { name: "list",  re: /^\/?$/,                 parse: () => ({}) },
  { name: "note",  re: /^\/note\/([^/]+)$/,     parse: (m) => ({ date: decodeURIComponent(m[1]) }) },
  { name: "about", re: /^\/about\/?$/,          parse: () => ({}) },
];

// 找不到匹配时回落到哪个视图
const FALLBACK = "list";

// ============ 内部状态 ============
let currentView = null;      // 当前视图名
let currentParams = {};      // 当前视图参数（如 { date: "2026-09-22" }）
let onChange = null;         // 视图变化时的回调（由 app.js 注册）

// ============ 解析 ============
// 把 hash 字符串解析成 { name, params }
function parseHash(hash) {
  // 去掉开头的 #，没有 hash 时按根路径处理
  const raw = (hash || "").replace(/^#/, "");
  // 去掉查询串（本项目暂不用，但保留以免 ?x=y 干扰匹配）
  const path = raw.split("?")[0];

  for (const route of ROUTES) {
    const m = path.match(route.re);
    if (m) return { name: route.name, params: route.parse(m) };
  }
  return { name: FALLBACK, params: {} };
}

// ============ 生成链接地址 ============
// 统一在这里拼 hash，避免各处手写字符串写错
function hrefFor(view, params = {}) {
  if (view === "note") return "#/note/" + encodeURIComponent(params.date || "");
  if (view === "about") return "#/about";
  return "#/";
}

// ============ 跳转 ============
// 改地址 → 浏览器触发 hashchange → 由 handleChange 统一处理
// 这样"点导航跳转"和"用户手改地址"和"按前进后退"三条路径走的是同一段代码，
// 不会出现"点击能用、后退就错"的经典 bug
function navigate(view, params = {}) {
  const target = hrefFor(view, params);
  if (location.hash === target) {
    // 地址没变就不会触发 hashchange，此时手动处理一次（例如重复点同一个导航）
    handleChange();
    return;
  }
  location.hash = target;
}

// ============ 变化处理 ============
function handleChange() {
  const { name, params } = parseHash(location.hash);
  currentView = name;
  currentParams = params;
  if (onChange) onChange(name, params);
}

// ============ 对外接口 ============
const router = {
  // app.js 注册回调：视图变化时该做什么
  on(fn) { onChange = fn; },

  // 启动：先按当前地址渲染一次，再监听后续变化
  start() { handleChange(); window.addEventListener("hashchange", handleChange); },

  // 读当前状态
  get view() { return currentView; },
  get params() { return currentParams; },

  // 判断某个导航项是否处于选中态（给导航栏高亮用）
  isActive(view) {
    // 单篇笔记视图在语义上属于"笔记列表"这一组，导航时列表项保持高亮
    if (view === "list") return currentView === "list" || currentView === "note";
    return currentView === view;
  },

  // 供 HTML 里直接写 href 用（导航栏是静态 HTML，需要这个）
  hrefFor,
  navigate,
};
