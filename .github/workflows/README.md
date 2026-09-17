# Supabase 保活方案（Keep Alive）

> **⚠️ 不要删除本目录下的 `keepalive.yml`。**
> 它决定网站能不能登录。删掉它，Supabase 免费项目约 7 天后会被自动暂停，
> 网站与登录随即全部失效。曾经就是这样断过一次（见下方"历史事故"）。

---

## 一、为什么需要保活

| 事实 | 说明 |
|---|---|
| Supabase 免费版政策 | 项目约 **7 天无 API 活动**即被自动暂停（Pause） |
| 暂停后的表现 | 项目专属域名 `xxxx.supabase.co` 的 **DNS 记录被移除**（NXDOMAIN），任何网络环境都连不上，网站登录报"网络异常" |
| 恢复方式 | 只能到 Supabase 控制台手动 **Restore / Resume**，无 API 自动化时无法自愈 |
| 本项目的项目 ref | `xnxmzgmgmfesrathfnnl` |

**关键点：暂停与你的本地网络无关。** 表现为"网络异常"，但实际是域名在全球 DNS 中消失了。

---

## 二、历史事故（务必了解）

| 时间 | 事件 |
|---|---|
| 2026-07-31 / 08-01 | `keepalive.yml` 每 5 天 ping 一次，运行正常 |
| 2026-08-06 / 08-11 | 该工作流连续运行失败 |
| 2026-08-08 前后 | 项目因 7 天无活动被暂停 |
| **2026-08-12** | 提交 `5769d8f`「chore: remove one-off export workflow and data-export dir」在清理**一次性导出** workflow 时，**把 `keepalive.yml` 一并删除**（提交信息里完全没提）→ 保活彻底消失 |
| 2026-09-17 | 用户登录网站失败，排查后定位到根因（DNS NXDOMAIN），恢复项目并重建保活 |

**两条教训：**
1. **删除 workflow 前必须逐个文件确认**，不要按目录批量删。本次即为连带误删。
2. **原方案无任何告警**，8/6、8/11 两次失败无人知晓，直到一个月后用户登录失败才发现。

---

## 三、当前方案：双通道冗余

"更稳"的核心 = **不再依赖单一平台**。两个通道独立生效，任一存活即可保活。

```
                 ┌──────────────────────────────┐
   通道 A ──────▶│  GitHub Actions（已配置）      │──┐
 （本仓库）      │  每周一/三/五 03:07 UTC       │  │
                 └──────────────────────────────┘  │
                                                   ├──▶  Supabase
                 ┌──────────────────────────────┐  │     xnxmzgmgmfesrathfnnl
   通道 B ──────▶│  外部免费定时服务（建议配置）  │──┘
 （独立于 GitHub）│  cron-job.org / UptimeRobot  │
                 └──────────────────────────────┘
```

### 通道 A：GitHub Actions（已在本仓库配置）

`keepalive.yml` 相比原版的改进：

| 改进项 | 原版 | 现版 |
|---|---|---|
| 触发频率 | 每 5 天 1 次（余量仅 2 天） | **每周 3 次**（周一/三/五），任一次失败都有后续兜底 |
| 失败重试 | 无 | **3 次重试**，间隔 15 秒，避免偶发网络抖动误判 |
| 失败可见性 | 静默 | **显式报错 + 错误提示**（含控制台直链），触发 GitHub 邮件通知 |
| 心跳留痕 | 无 | 每次运行提交 `.keepalive/status.txt`，可随时查看最后保活时间 |
| 防误删 | 无 | 文件头显著警示 + 本说明文档 |
| 手动触发 | 有 | 保留（Actions 页 → Run workflow） |

**查看保活状态：** 打开 <https://github.com/shenhaiyu235/lindalinye-src/blob/main/.keepalive/status.txt>，
最后一行即最近一次保活的时间与结果。

> **确保你能收到失败告警：** GitHub 右上角头像 → Settings → Notifications →
> 勾选 **Actions**（至少保留 "Send notifications for failed workflows only"）。
> 默认是开启的，但如果你曾关闭过邮件通知，请重新打开。

### 通道 B：外部免费定时服务（**建议补上**）

通道 A 依赖 GitHub；通道 B 的目的就是**在 GitHub 出问题（或仓库被误操作）时兜底**。

**推荐 cron-job.org（免费、支持自定义请求头、自带失败邮件告警）：**

1. 注册并登录 <https://cron-job.org>（免费）
2. Create cronjob，按下表填写：

   | 项 | 值 |
   |---|---|
   | Title | `Supabase keepalive (kdst)` |
   | URL | `https://xnxmzgmgmfesrathfnnl.supabase.co/rest/v1/projects?select=id&limit=1` |
   | Schedule | Every 2 days（每 2 天，或每天） |
   | Request method | GET |
   | Headers | `apikey` → `<anon key>`<br>`Authorization` → `Bearer <anon key>` |

   > anon key 见 `keepalive.yml` 中的 `SUPABASE_ANON_KEY`，或 `app/src/lib/supabase.ts`。
   > 该 key 本就打包在前端公开代码中，非敏感信息。

3. 在 **Advanced → Notifications** 中开启 **失败时邮件通知**。

**替代方案 UptimeRobot**（顺带监控可用性）：<https://uptimerobot.com> → Add New Monitor →
类型 HTTP(s) → URL 同上 → 间隔 5 分钟 → 添加自定义 Header。免费版 50 个监控。

> 两个通道同时存在**没有副作用**：多几次 GET 请求不会造成任何影响。

---

## 四、故障处置手册（网站又登录不了时）

**第 1 步 · 判断是不是"项目被暂停"**

在能上网的机器上执行（Windows PowerShell）：

```powershell
Resolve-DnsName xnxmzgmgmfesrathfnnl.supabase.co
```

- **报错 / 无结果** → 项目已被暂停（或删除）→ 走第 2 步
- **返回 IP 地址** → 项目正常，问题在别处（多半是本地网络需开代理才能访问 supabase.co）

**第 2 步 · 恢复项目**

1. 打开 <https://supabase.com/dashboard/project/xnxmzgmgmfesrathfnnl>
   （国内需代理才能打开 supabase.com）
2. 若显示 **Paused** → 点 **Restore project** / **Resume**，等待几分钟
3. 若**控制台里找不到该项目**（不是 Paused，而是不存在）→ 说明已被删除，需重建数据库并重新导入数据（数据源见本文末）

**第 3 步 · 确认保活通道已恢复运行**

- 通道 A：Actions 页 <https://github.com/shenhaiyu235/lindalinye-src/actions> 手动点一次
  「Keep Supabase awake」→ Run workflow，确认变绿
- 通道 B：到 cron-job.org 看最近执行记录

**第 4 步 · 检查保活是否又被误删**

```bash
git -C app log --oneline -- .github/workflows/keepalive.yml
```

若发现某次提交删除了它，立即恢复：

```bash
git -C app checkout <删除前的commit>~1 -- .github/workflows/keepalive.yml
```

---

## 五、可选增强：自动自愈（需 Supabase PAT）

当前方案的告警是**被动**的——项目暂停后仍需人工 Restore。若希望**自动恢复**：

1. 到 <https://supabase.com/dashboard/account/tokens> 生成 Personal Access Token（PAT）
2. 在本仓库 Settings → Secrets and variables → Actions 中新建 secret：`SUPABASE_PAT`
3. 在 `keepalive.yml` 的 ping 失败分支中调用 Management API：

   ```bash
   curl -X POST "https://api.supabase.com/v1/projects/xnxmzgmgmfesrathfnnl/restore" \
     -H "Authorization: Bearer $SUPABASE_PAT"
   ```

**权衡：** PAT 具备管理该账号下所有项目的能力，放入 GitHub Secrets（加密存储、仅
Actions 可读）风险可控，但属长期凭证。如无频繁暂停的困扰，可不配置。

---

## 六、其他命令

```bash
# 本地手动跑一次保活（需能访问 supabase.co；国内一般要开代理）
KEEPALIVE_PROXY=http://127.0.0.1:7890 python keepalive_supabase.py
```

> 仓库根目录的 `keepalive_supabase.py` 是本地验证用脚本，与云端保活相互独立。

---

## 七、更根本的备选思路（待定，未实施）

保活只解决"项目不被暂停"，**不解决"国内访问 supabase.co 必须开代理"**这个痛点。
若希望彻底摆脱该依赖，可考虑：

- **静态化**：把数据定期导出为 JSON 一并提交到部署仓库，网站改为读取静态文件。
  纯 GitHub Pages 托管，**永不暂停、无需代理、无需保活**（代价：网站变为只读）。
- **以飞书为准**：数据维护已迁至飞书多维表格（国内直连、不会暂停），
  网站仅作历史备份，逐步停维护。

数据源参考：Supabase 各表（`projects` / `downstreams` / `contracts` /
`downstream_contracts` / `memos` / `todos` / `change_log`）。
