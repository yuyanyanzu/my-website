// feedback.js — 操作反馈层（Day 11 新增）
// 解决的问题：用户点完之后，凭什么知道"我的操作生效了"？
// 这里只做一件事——把"刚刚发生了什么"用文字说出来，并保证同一次操作只播报一次，不会堆积、不会错乱。
//
// 设计要点（Day 11 交互反馈原理）：
//   1. 反馈要快：用户点完立刻出现，不等任何网络请求
//   2. 反馈要说人话：用"已展开"这种完成态，不用"正在展开"这种过程态
//   3. 连续操作只认最后一次：连点 20 次也只显示最后一次的结果，不排队、不闪烁
//   4. 听觉通道也要有：屏幕阅读器用户听不到动效，靠下面的 live-region 播报

// ---- 通道 1：视觉通知条 ----
const toastEl = document.getElementById("toast");
const liveRegion = document.getElementById("live-region");

let toastTimer = null;   // 记录当前的自动隐藏计时器，新消息来了要先清掉它

/**
 * 弹出一条通知
 * @param {string} message 给用户看的话，如"已展开《技术选型》"
 * @param {string} type    info | success | error，决定通知条的颜色
 */
function showToast(message, type = "info") {
  if (!toastEl) return;

  // 连续点击时：先清掉上一次的计时器，否则旧计时器会把新通知提前关掉
  clearTimeout(toastTimer);

  toastEl.textContent = message;
  toastEl.className = "toast toast-" + type + " toast-show";

  // 1.8 秒后自动淡出
  toastTimer = setTimeout(() => {
    toastEl.className = "toast toast-" + type;
  }, 1800);
}

// ---- 通道 2：屏幕阅读器播报 ----
// 视觉用户看通知条，读屏用户靠这里。内容一样，只是看不见。
function announce(message) {
  if (!liveRegion) return;
  // 先清空再写入：读屏软件只有在内容"变化"时才会朗读
  liveRegion.textContent = "";
  liveRegion.textContent = message;
}
