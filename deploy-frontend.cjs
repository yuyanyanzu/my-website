// deploy-frontend.cjs — Day 15：把前端运行需要的文件收集到 dist/，再交给 CloudBase CLI 上传
//
// 【为什么不直接 `tcb hosting deploy .`】
// 项目根目录里除了站点文件，还有自测脚本（day*.cjs）、课程文档（PRD/AGENTS/TECH_DESIGN…）、
// 截图（screenshots/）——这些是开发过程的产物，不该出现在公网站点上：
//   ① 白占静态托管的存储和流量额度
//   ② 把开发过程（含测试用例、内部文档）暴露给任何访客
// 所以用**白名单**把"要上线的"一个个挑出来。
// 为什么用白名单而不是黑名单（排除法）：排除法一旦漏写一项，那个文件就会被悄悄传上去，
// 而且事后很难发现；白名单漏写了会立刻因为"文件不存在"报错。
//
// 用法：
//   node deploy-frontend.cjs          # 收集 → 生成 dist/
//   tcb hosting deploy ./dist        # 上传（见 DEPLOY.md 第 5 节）

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");

// 站点运行必需的文件（缺一不可）
const FILES = [
  "index.html",
  "style.css",
  "app.js",         // 交互逻辑
  "components.js",  // UI 组件
  "feedback.js",    // 反馈层（通知条 / 读屏播报）
  "mock-data.js",   // 当前用的示例数据（USE_MOCK = true）
  "router.js",      // hash 路由
];

// notes/ 是笔记内容本身。现在用 mock 数据（USE_MOCK=true）暂不读取，
// 但它是这个站点的"内容"，而且 app.js 里保留了直接读它的实现（Day 7），所以一并传。
const DIRS = ["notes"];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

// ---- 主流程 ----
// 每次重新生成，避免上一次的残留文件混进这次的上传
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
const missing = [];

for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { missing.push(f); continue; }
  fs.copyFileSync(src, path.join(OUT, f));
  console.log("  ✓ " + f);
  count++;
}

for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) { missing.push(d + "/"); continue; }
  copyDir(src, path.join(OUT, d));
  const n = fs.readdirSync(src).length;
  console.log("  ✓ " + d + "/（" + n + " 个文件）");
  count++;
}

// 白名单里有、磁盘上却没有 → 立刻报错，不静默跳过
if (missing.length) {
  console.error("");
  console.error("✗ 这些文件在项目里找不到：" + missing.join("、"));
  console.error("  说明白名单写错了，或者文件被改名/删除——修好再传，别把缺文件的版本发上线。");
  process.exit(1);
}

const kb = (dirSize(OUT) / 1024).toFixed(1);
console.log("");
console.log("已生成 dist/：" + count + " 项，共 " + kb + " KB");
console.log("下一步：tcb hosting deploy ./dist");
