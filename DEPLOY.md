# DEPLOY.md — 部署指引（CloudBase 云函数 + 静态托管）

> 本项目从 Day 15 起把后端放到**腾讯云开发 CloudBase**：云函数跑接口，静态托管放前端页面。
> 本文是操作手册，**按顺序做**。命令都在项目根目录执行。
>
> ⚠️ **第 1 步只能你本人做**（要注册账号、实名认证），我代不了。
> 第 2 步有**两条路线**可选：装 CLI（登录后我代跑命令），或在网页控制台点鼠标（用我打好的 `dist/health-function.zip`）。

---

## 1. 开通环境（一次性，约 10 分钟）

### 1.1 腾讯云账号
没有账号就去 <https://cloud.tencent.com/> 注册，并完成**实名认证**。
（已有账号直接跳过。）

### 1.2 创建 CloudBase 环境
1. 打开云开发控制台 <https://console.cloud.tencent.com/tcb>
2. 点「新建环境」
3. **付费方式必须选「按量计费」** —— 只有按量计费的环境才能开通静态网站托管（免费额度内不产生费用）
4. 地域就近选（比如上海、广州）
5. 环境名随意，建议英文+数字

创建后等初始化完成（几分钟）。

### 1.3 拿到环境 ID
环境概览页能看到形如 `env-xxxxxxxxxxxx` 的**环境 ID**，复制它。

### 1.4 开通静态网站托管
控制台 → 左侧「静态网站托管」→ 开通。
> 注意：这个必须**在控制台手动开通**，CLI 不会自动帮你开。没开的话部署会报 `Hosting not enabled`。

### 1.5 允许匿名访问页面
控制台 →「环境设置」→「访问方式」→ 开启「未登录用户访问」。
否则访客打开页面会被要求登录。

---

## 2. 选一条路线，把代码送上去

**两条路线选一条就行**，目标完全一样（`/api/health` 返回 JSON + 前端页面能打开）。
哪条做不动就换另一条，**不用重来**。

---

### 路线一：用 CLI（登录后由 AI 代跑）

```bash
npm i -g @cloudbase/cli
tcb login
```

`tcb login` 会打开浏览器让你扫码授权。**这一步必须你本人做**（要在浏览器里确认）。

登录成功后验证一下：

```bash
tcb env list
```

应该能看到你的环境。然后告诉我**环境 ID**，剩下的部署命令我来跑。

> AI 侧已经装好了 CLI（可执行文件在隔离目录里），**只要登录态一通，我就能直接执行第 4、5 节**。
>
> 装不上 / 命令找不到？试试 `npx @cloudbase/cli login`、`npx @cloudbase/cli env list` 代替。

---

### 路线二：不装 CLI，全在网页控制台点鼠标（**新手更推荐**）

完全不碰命令行。**要上传的包我已经打好了**：`dist/health-function.zip`。

#### A. 部署云函数 `/api/health`

1. 控制台 →「云函数」→ 新建云函数
2. **函数名**填 `health`（必须叫这个，跟项目配置对齐）
3. **运行环境**选 `Nodejs18.15`（列表里没有就选最接近的 Nodejs 版本）
4. **创建方式选「上传 ZIP 包」** → 上传 `dist/health-function.zip`
5. **入口函数**填 `index.main`（含义：跑 `index.js` 里的 `main` 方法）
6. 创建完成后，去左侧「**HTTP 访问服务**」（部分版本叫「环境 → HTTP 访问服务」）→ 新建路径：

   | 项 | 填什么 |
   |---|---|
   | 路径 | `/api/health` |
   | 指向 | 云函数 `health` |
   | 鉴权 | **无需鉴权**（选错的话访客会被拦在登录页） |
   | 状态 | 开启 |

#### B. 部署前端页面

1. 先在本地项目根目录跑一次 `node deploy-frontend.cjs`，生成 `dist/`
   （白名单机制：只挑该上线的 8 个文件，不会把文档、测试脚本、截图传上公网）
2. 控制台 →「静态网站托管」→ 文件管理 → 上传
3. 上传 `dist/` 里的**内容**（不是 dist 这个文件夹本身）：
   `index.html`、`style.css`、`app.js`、`components.js`、`router.js`、`mock-data.js`、`feedback.js`，
   外加整个 `notes` 文件夹

   > ⚠️ 两个容易踩的点：
   > - **别多套一层目录**：上传后访问域名下的 `/index.html` 必须能直接打开；
   > - `health-function.zip` 是给云函数用的，**不要**传进静态托管。

4. 传完在「静态网站托管」页面能看到**访问域名**，那就是前端公网地址。

> 路线二到这儿就结束了，**第 3–5 节是路线一（CLI）的步骤，可以跳过**，直接看第 6、7 节排查问题。

---

## 3. 填环境 ID

打开项目根目录的 `cloudbaserc.json`，把 `envId` 填成第 1.3 步拿到的环境 ID：

```json
{
  "envId": "env-xxxxxxxxxxxx",
  ...
}
```

填好之后，后面的命令都不用再带 `-e` 参数了。

---

## 4. 部署云函数（`/api/health`）

```bash
tcb fn deploy health --httpFn --path /api/health
```

参数含义：

| 参数 | 作用 |
|---|---|
| `health` | 函数名，对应 `cloudfunctions/health/` |
| `--httpFn` | 部署成 **HTTP 云函数**（能接收网页请求） |
| `--path /api/health` | 自动创建「HTTP 访问服务」路径，也就是公网访问地址里的 `/api/health` |

> 云函数默认只能在云开发内部调用，加了 `--path` 才会被映射到公网。

部署完，用这个命令看访问服务地址：

```bash
tcb service list
```

地址形如 `https://<服务ID>.service.tcloudbase.com`，拼上 `/api/health` 就是接口地址。

### 验证

```bash
curl https://<服务ID>.service.tcloudbase.com/api/health
```

期望返回：

```json
{"code":0,"message":"ok","data":{"status":"healthy","service":"my-website-api","version":"0.1.0","env":"env-xxx","time":"...","uptimeSeconds":0}}
```

浏览器直接打开这个网址也应该看到 JSON。

---

## 5. 部署前端页面

先把前端运行需要的文件收集到一个干净的目录（项目根目录还有测试脚本、文档、截图，不该传上公网）：

```bash
node deploy-frontend.cjs
```

它会生成 `dist/`，然后：

```bash
tcb hosting deploy ./dist
```

访问地址在控制台「静态网站托管」页面能看到（默认域名）。

### 验证

浏览器打开静态托管的默认域名，应该看到完整的笔记站：
三个视图能切换、标签能筛选、卡片能展开。

---

## 6. 常用命令备忘

```bash
tcb env list                       # 看有哪些环境
tcb fn list                        # 看已部署的云函数
tcb fn detail health               # 看某个函数详情
tcb fn log health                  # 看函数运行日志（排查线上问题第一步）
tcb hosting list                   # 看静态托管上有哪些文件
tcb hosting detail                 # 看静态托管服务信息（含访问域名）
```

---

## 7. 常见报错

| 报错 | 原因 | 怎么办 |
|---|---|---|
| `Hosting not enabled` | 静态托管没开通 | 回第 1.4 步，在控制台开通 |
| `静态网站服务初始化中` | 刚开通，还在初始化 | CLI 会自动等（最多约 6 分钟），或过几分钟重试 |
| `envId 未指定` / 环境相关报错 | `cloudbaserc.json` 里 `envId` 没填 | 回第 3 步填上，或命令加 `-e env-xxxx` |
| 提示 runtime 不支持 | `Nodejs18.15` 这个运行时不在此环境可选范围 | 把 `cloudbaserc.json` 里的 `runtime` 改成 `Nodejs20.19`，或删掉这一行用默认 |
| 扫码后仍然未登录 | 浏览器授权没走完 | 重新 `tcb login` |
| 接口 404 | HTTP 访问服务没建 | 重新执行第 4 步（`--path /api/health` 会创建） |
| 接口能开但前端跨域报错 | **正常现象** | 跨域配置是 Day 16–20 的任务，见 `api-contract.md` 第 6 节 |

---

## 8. 关于 GitHub Pages

项目原计划用 GitHub Pages 托管（见 `TECH_DESIGN.md`），但 Day 6–7 那个「上线」里程碑只做了本地版，Pages 一直没开。
Day 15 起改用 CloudBase 静态托管，**前端公网访问这件事由 CloudBase 负责**。
GitHub 仓库继续作为代码和笔记的版本管理，两者不冲突。

---

*本文件随部署方式变化同步更新。Day 15 初版。*
