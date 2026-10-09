// day14-fix-compare.cjs — 把 Day 14 最小修复的「前 / 后」两张卡片特写拼成一张对比图
//
// 为什么要单独的脚本：走查脚本（day14-walkthrough.cjs）每次跑都会**覆盖**取证图，
// 修复做完之后就再也拍不到"修复前"的样子了。所以修复前先备份一张，
// 这里负责把两张并排拼起来，作为测试记录里「那次修复」的证据。
//
// 前置：screenshots/day14-card-bottom-before.png（修复前备份）
//       screenshots/day14-card-bottom.png（修复后，由走查脚本生成）
// 运行：NODE_PATH="C:/Users/胡政/.workbuddy/binaries/node/workspace/node_modules" node day14-fix-compare.cjs

const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const dir = path.join(__dirname, "screenshots");
const toUrl = (f) => "file:///" + path.join(dir, f).replace(/\\/g, "/");

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; padding:26px 26px 20px; background:#fff; color:#202124;
         font-family:"Microsoft YaHei","Segoe UI",sans-serif; }
  h1 { font-size:19px; margin:0 0 5px; }
  .sub { font-size:12.5px; color:#5f6b76; margin:0 0 18px; }
  .row { display:flex; gap:18px; }
  .col { flex:1; border:1px solid #dadce0; border-radius:10px; overflow:hidden; }
  .col h2 { font-size:14px; margin:0; padding:8px 12px; border-bottom:1px solid #dadce0; }
  .bad h2 { background:#fdecea; color:#a50e0e; }
  .good h2 { background:#e6f4ea; color:#137333; }
  .shot { padding:9px 11px 4px; }
  .shot img { width:100%; display:block; border:1px solid #eceff1; border-radius:6px; }
  ul { margin:8px 0 12px; padding-left:24px; font-size:12px; line-height:1.7; color:#3c4043; }
  .k { font-weight:700; }
  .bad .k { color:#a50e0e; }
  .good .k { color:#137333; }
</style></head><body>
  <h1>Day 14 最小修复：「打开独立页面 →」入口</h1>
  <p class="sub">同一张卡片底部的特写 · 依据走查实测 + WCAG 1.4.1（不能只靠颜色传达信息）</p>
  <div class="row">
    <div class="col bad">
      <h2>修复前</h2>
      <div class="shot"><img src="${toUrl("day14-card-bottom-before.png")}"></div>
      <ul>
        <li>下划线：<span class="k">无</span>，只靠蓝色区分，认不出能点</li>
        <li>与上方「▼ 展开全文」同为 13px，只隔 <span class="k">6px</span></li>
        <li>点击区 <span class="k">95 × 22px</span>，远低于手机建议的 44px</li>
      </ul>
    </div>
    <div class="col good">
      <h2>修复后</h2>
      <div class="shot"><img src="${toUrl("day14-card-bottom.png")}"></div>
      <ul>
        <li>下划线：<span class="k">有</span>，另加悬停底色，不看颜色也能认</li>
        <li>与上方提示的文字间距拉开到 <span class="k">17px</span></li>
        <li>点击区 <span class="k">115 × 44px</span>，达标</li>
      </ul>
    </div>
  </div>
</body></html>`;

(async () => {
  for (const f of ["day14-card-bottom-before.png", "day14-card-bottom.png"]) {
    if (!fs.existsSync(path.join(dir, f))) {
      console.error("缺少取证图：" + f + "（先跑一次 day14-walkthrough.cjs）");
      process.exit(1);
    }
  }

  // 写成临时文件再 goto —— 直接 setContent 的话页面源是 about:blank，
  // 加载 file:// 图片会被安全策略拦掉（Day 13 踩过这个坑）。
  const tmp = path.join(dir, "_tmp-compare.html");
  fs.writeFileSync(tmp, html, "utf8");

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 470, deviceScaleFactor: 2 });
  await page.goto("file:///" + tmp.replace(/\\/g, "/"), { waitUntil: "networkidle0" });

  // 必须等图片真正解码完再截，否则拍到的可能是空框（Day 13 的坑）
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    { timeout: 10000 }
  );

  const out = path.join(dir, "day14-fix-before-after.png");
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  fs.unlinkSync(tmp);

  console.log("已生成 screenshots/day14-fix-before-after.png");
})().catch((e) => { console.error("对比图脚本出错：", e.message); process.exit(1); });
