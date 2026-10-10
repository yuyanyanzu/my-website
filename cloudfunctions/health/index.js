/**
 * health —— 服务健康检查（Day 15，本项目的第一个云函数）
 *
 * 【为什么第一个接口选它】
 * 部署一条链路要经过：本地代码 → CLI 上传 → 云端运行 → HTTP 访问服务把路径映射到公网。
 * 中间任何一环出问题，报错都长得很像。用一个"不查数据库、不读文件、不用登录"的接口
 * 先把链路跑通，出问题时就能确定是**链路问题**，而不是业务逻辑问题。
 *
 * 【它做什么】
 * 收到 GET 请求，返回一段 JSON：服务活着、跑的是哪一版、现在几点、这个实例活了多久。
 * 前端可以拿它当"服务正常吗"的探针，你也可以随时 curl 一下确认线上是活的。
 *
 * 【怎么被公网访问到】
 * 云函数默认只能在云开发内部调用。要暴露成网址，部署时要加 `--path /api/health`，
 * 由「HTTP 访问服务」映射成：https://<服务ID>.service.tcloudbase.com/api/health
 *
 * 契约见仓库根目录 api-contract.md 第 5 节。
 */

// ---- 统一的 JSON 响应构造器 ----
// 云函数有两条返回路线：
//   ① 直接返回对象      → 平台自动转 JSON，但状态码固定 200、响应头也改不了
//   ② 返回「集成响应」  → { statusCode, headers, body }，状态码和响应头都能自定义
// 这里选 ②，因为契约要求「HTTP 状态码和业务 code 语义一致」，还要能禁掉缓存。
// ⚠️ 关键坑：集成响应里的 body 必须是**字符串**，所以要 JSON.stringify。
//    直接把对象塞进 body，平台会当成别的东西处理，返回的内容就不是你想要的 JSON。
function json(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 探针结果不能被缓存，否则浏览器刷新看到的永远是同一秒的时间戳
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

// 服务名与版本号：改接口时同步改这里，方便一眼确认"线上跑的是哪一版"
var SERVICE = "my-website-api";
var VERSION = "0.1.0";

// 进程启动时刻：用当前时间减它得到 uptime。
// 注意云函数会冷启动，实例被回收后再来请求这里会归零——
// 所以它表示"当前实例活了多久"，不是"服务上线了多久"。
var BOOT_AT = Date.now();

exports.main = async (event, context) => {
  // event 是 HTTP 访问服务转发过来的请求信息，长这样：
  //   event.httpMethod             请求方法（GET / POST / ...）
  //   event.path                   请求路径
  //   event.headers                请求头（键值对）
  //   event.queryStringParameters  网址 ? 后面的参数
  //   event.body                   请求体（GET 请求为空）
  // （用 SDK 直接调用云函数时 event 结构不同，本函数按 HTTP 访问服务来写。）
  var method = (event && event.httpMethod) || "GET";

  // 健康检查是只读的，只接受 GET。
  // 其他方法要明确回 405 告诉对方"方法不对"，而不是沉默地也返回 200——
  // 否则对方会以为自己调成功了。
  if (method !== "GET") {
    return json(405, {
      code: 40500,
      message: "只支持 GET 请求，你用的是 " + method,
      data: null,
    });
  }

  return json(200, {
    code: 0,
    message: "ok",
    data: {
      status: "healthy",
      service: SERVICE,
      version: VERSION,
      // 云开发会把当前环境 ID 注入到 TCB_ENV，用它确认"打到了哪个环境"（测试环境还是正式环境）
      env: process.env.TCB_ENV || "unknown",
      // ISO 8601 的 UTC 时间，和契约里的时间格式一致
      time: new Date().toISOString(),
      // 当前函数实例已存活的秒数
      uptimeSeconds: Math.floor((Date.now() - BOOT_AT) / 1000),
    },
  });
};
