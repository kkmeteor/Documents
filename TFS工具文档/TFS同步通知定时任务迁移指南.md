## TFS Flight / Flight Plus → Nova 未合并变更集周通知 — 迁移指南

本文档用于将两个 QoderWork 定时任务及其依赖迁移到新机器上执行。

---

### 一、前置条件

目标机器需要安装并配置以下环境：

| 依赖项 | 说明 |
|--------|------|
| QoderWork (CN) | 定时任务运行平台，需登录同一账号或新账号 |
| MCP tfs-tool | TFS 变更集查询工具，需能访问 TFS 代理 (localhost:9000) |
| TfsTool 全套 | api-service(:9000) + TfsService(:9001) + Blazor(:5000) + 前端(:5001)，TFS 地址 `http://10.10.10.63:8080/tfs/DefaultCollection` |
| dws 连接器 (钉钉) | 用于查询企业通讯录获取邮箱，需已连接钉钉 |
| Python 3 | 运行 send_notify.py 发信脚本 |
| 网络 | 能访问 SMTP 服务器 `smtp.sinounion.com:587`，内网 TFS `10.10.10.63` |

---

### 二、部署发信脚本

在目标机器上创建以下目录和文件（注意替换用户名）：

**目录：** `C:\Users\<用户名>\.qoderwork\skills\tfs-sync-notify\`

> 如果目标机器使用 QoderWork CN，路径为 `C:\Users\<用户名>\.qoderworkcn\skills\tfs-sync-notify\`，
> 则需同步修改下方定时任务 message 中的脚本路径。

#### 2.1 config.json — SMTP 配置

```json
{
  "smtp_server": "smtp.sinounion.com",
  "smtp_port": 587,
  "sender_email": "tfs_notify@sinounion.com",
  "sender_name": "TFS同步通知",
  "password": "MeFBpnXmZCtbdX7B",
  "cc": ["guanwei.li@sinounion.com", "tengfei.ma@sinounion.com"]
}
```

#### 2.2 send_notify.py — 发信脚本

从当前机器复制文件：

```
C:\Users\tengfei.ma\.qoderwork\skills\tfs-sync-notify\send_notify.py
```

到目标机器同路径位置。该脚本功能：读取 config.json 的 SMTP 配置，通过 STARTTLS(587) 发送 HTML 格式邮件，支持多抄送人（逗号分隔或 JSON 数组），自动去重。

调用方式：

```bash
python "C:\Users\<用户名>\.qoderwork\skills\tfs-sync-notify\send_notify.py" \
  --to "收件人邮箱" \
  --subject "邮件主题" \
  --body "HTML正文（单行）"
```

---

### 三、定时任务配置

#### 任务 1：TFS Flight → Nova 未合并变更集周通知

| 属性 | 值 |
|------|-----|
| 名称 | TFS Flight→Nova 未合并变更集周通知 |
| 调度 | `30 9 * * 1`（每周一 09:30，Asia/Shanghai） |
| 模型 | qmodel_latest |

**任务 Prompt（完整 message）：**

```
请执行以下 TFS 变更集同步通知任务，严格按步骤操作：

**第一步：查询未合并变更集**
调用 MCP 工具 mcp__tfs-tool__compare_with_status，参数如下：
- sourceProjectPath: "$/PET-CT Software Project/PET-CT flight"
- sourceProjectName: "flight"
- targetProjectPath: "$/PET-CT Software Project/S2 main"
- targetProjectName: "nova"
- startDate: 从当天往前推1年的日期（格式 YYYY-MM-DD）
- endDate: 当天日期（格式 YYYY-MM-DD）
先用 bash date 命令获取当天日期。

**第二步：按提交人分组**
将返回的 data 数组按 Submitter 字段分组。

**第三步：查询每位提交人的企业邮箱**
对每个不同的 Submitter，执行：
1. dws contact user search --query "<Submitter姓名>" --format json
2. 用返回的 userId 执行 dws contact user get --ids <userId> --format json
3. 从 orgEmployeeModel.orgAuthEmail 获取邮箱地址
如果查不到，跳过该提交人。

**第四步：发送邮件**
对每位提交人，使用发信脚本发送一封邮件：
python "C:\Users\<用户名>\.qoderwork\skills\tfs-sync-notify\send_notify.py" --to "<提交人邮箱>" --subject "[tfs同步]您有{N}条未同步的changeset需要处理" --body "<HTML正文>"

邮件正文模板（HTML格式，用 <br> 换行，整个 --body 为单行双引号字符串）：
开头：您好，经tfs智能查询机器人查询，以下代码提交到【flight】版本，但尚未同步到【nova】，请确认内容是否需要同步：<br><br>变更集列表（共{N}条）：
然后逐条列出：<br><br>【第{i}条】<br>  - 变更集ID：{Id}<br>  - 提交日期：{Date}<br>  - 描述：{Description}<br>  - 审核人：{Reviewer}<br>  - Story/Bug：{StoryOrBugId}<br>  - 状态：{MergeStatusName}
结尾：<br><br>如果有疑问请使用 http://10.10.11.194:5001/ 进行查询确认。<br><br>此邮件涉及的提交者：{Submitter}

send_notify.py 会自动从 config.json 读取 SMTP 配置（发件人 tfs_notify@sinounion.com）并自动抄送 guanwei.li@sinounion.com和tengfei.ma@sinounion.com。

如果查询结果为空（没有未合并的变更集），则不发送任何邮件，直接报告"当前没有需要同步的变更集"。
```

---

#### 任务 2：TFS Flight Plus → Nova 未合并变更集周通知

| 属性 | 值 |
|------|-----|
| 名称 | TFS Flight Plus→Nova 未合并变更集周通知 |
| 调度 | `30 8 * * 1`（每周一 08:30，Asia/Shanghai） |
| 模型 | qmodel_latest |

**任务 Prompt（完整 message）：**

```
请执行以下 TFS 变更集同步通知任务，严格按步骤操作：

**第一步：查询未合并变更集**
先用 bash date 命令获取当天日期，然后调用 MCP 工具 mcp__tfs-tool__compare_with_status，参数如下：
- sourceProjectPath: "$/PET-CT Software Project/PET-CT flight plus"
- sourceProjectName: "flight plus"
- targetProjectPath: "$/PET-CT Software Project/S2 main"
- targetProjectName: "nova"
- startDate: 从当天往前推1年的日期（格式 YYYY-MM-DD）
- endDate: 当天日期（格式 YYYY-MM-DD）

**第二步：按提交人分组**
将返回的 data 数组按 Submitter 字段分组。

**第三步：查询每位提交人的企业邮箱**
对每个不同的 Submitter，执行：
1. dws contact user search --query "<Submitter姓名>" --format json
2. 用返回的 userId 执行 dws contact user get --ids <userId> --format json
3. 从 orgEmployeeModel.orgAuthEmail 获取邮箱地址
如果查不到，跳过该提交人。

**第四步：发送邮件**
对每位提交人，使用发信脚本发送一封邮件：
python "C:\Users\<用户名>\.qoderwork\skills\tfs-sync-notify\send_notify.py" --to "<提交人邮箱>" --subject "[tfs同步]您有{N}条未同步的changeset需要处理" --body "<HTML正文>"

邮件正文模板（HTML格式，用 <br> 换行，整个 --body 为单行双引号字符串）：
开头：您好，经tfs智能查询机器人查询，以下代码提交到【flight plus】版本，但尚未同步到【nova】，请确认内容是否需要同步：<br><br>变更集列表（共{N}条）：
然后逐条列出：<br><br>【第{i}条】<br>  - 变更集ID：{Id}<br>  - 提交日期：{Date}<br>  - 描述：{Description}<br>  - 审核人：{Reviewer}<br>  - Story/Bug：{StoryOrBugId}<br>  - 状态：{MergeStatusName}
结尾：<br><br>如果有疑问请使用 http://10.10.11.194:5001/ 进行查询确认。<br><br>此邮件涉及的提交者：{Submitter}

send_notify.py 会自动从 config.json 读取 SMTP 配置（发件人 tfs_notify@sinounion.com）并自动抄送 guanwei.li@sinounion.com和tengfei.ma@sinounion.com。

如果查询结果为空（没有未合并的变更集），则不发送任何邮件，直接报告"当前没有需要同步的变更集"。
```

---

### 四、两个任务的差异对照

| 差异点 | Flight → Nova | Flight Plus → Nova |
|--------|---------------|-------------------|
| 执行时间 | 每周一 09:30 | 每周一 08:30 |
| TFS 源路径 | `$/PET-CT Software Project/PET-CT flight` | `$/PET-CT Software Project/PET-CT flight plus` |
| 源名称 | flight | flight plus |
| 邮件中版本名 | 【flight】 | 【flight plus】 |

其余部分（目标路径、邮件模板结构、SMTP 配置、抄送人）完全一致。

---

### 五、在新机器上创建任务

在目标机器的 QoderWork 中，通过定时任务功能创建两个 cron 任务，将上方 Prompt 全文粘贴到 message 字段中。

**注意事项：**

1. 将 Prompt 中所有 `C:\Users\<用户名>\` 替换为目标机器的实际用户名
2. 如果目标机器使用 QoderWork CN（而非国际版），路径中的 `.qoderwork` 需改为 `.qoderworkcn`
3. 确保目标机器已安装 MCP tfs-tool 连接器且 TFS 代理可访问
4. 确保目标机器已连接钉钉 dws 连接器（用于通讯录查询）
5. 首次运行建议手动触发一次，验证邮件能正常发出

---

### 六、快速复制文件清单

从当前机器复制以下文件到目标机器对应位置：

```
C:\Users\tengfei.ma\.qoderwork\skills\tfs-sync-notify\send_notify.py
C:\Users\tengfei.ma\.qoderwork\skills\tfs-sync-notify\config.json
```

目标机器路径（按用户名调整）：

```
C:\Users\<目标用户名>\.qoderwork\skills\tfs-sync-notify\send_notify.py
C:\Users\<目标用户名>\.qoderwork\skills\tfs-sync-notify\config.json
```
