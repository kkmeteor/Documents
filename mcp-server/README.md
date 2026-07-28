# TFS MCP Server

## 概述

这是TFS服务的MCP Server实现，提供健康检查和变更集历史查询功能。

## 目录结构

```
mcp-server/
├── tfs_health_mcp.js          # MCP服务主文件
├── package.json               # Node.js项目配置
├── package-lock.json          # 依赖锁定文件
├── node_modules/              # 依赖包
└── MCP配置更新说明.md          # 配置更新指南
```

## 前提条件

> **MCP工具依赖本地TFS代理服务**，需要在 `localhost:9000` 运行后才能查询。

### 启动TFS代理服务

```powershell
powershell -ExecutionPolicy Bypass -File "D:\CODE\Tools\TfsTool.BlazorServer\start-api-only.ps1"
```

启动后，API健康检查地址：`http://localhost:9000/api/tfs/health`

### 停止服务

```bash
taskkill /f /im TfsTool.ApiService.exe
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

依赖包括：
- `fastmcp` - MCP框架
- `zod` - 参数验证

### 2. 配置Qoder

编辑 `C:\Users\tengfei.ma\AppData\Roaming\Qoder\SharedClientCache\mcp.json`：

```json
{
  "mcpServers": {
    "tfs-tool": {
      "command": "node",
      "args": [
        "C:\\Users\\tengfei.ma\\Documents\\MD\\mcp-server\\tfs_health_mcp.js"
      ],
      "disabled": false
    }
  }
}
```

**注意路径已更新为 `mcp-server/tfs_health_mcp.js`**

### 3. 重启Qoder

配置完成后重启Qoder使配置生效。

## 提供的工具

### 1. check_tfs_health

检查TFS服务健康状态。

**参数：** 无

**返回示例：**
```json
{
  "Status": "Healthy",
  "Time": "2026-05-26T09:07:07.018546+08:00"
}
```

### 2. query_changeset_history

查询TFS变更集历史。

**参数：**
- `startDate` (必需): 开始日期，格式 YYYY-MM-DD
- `endDate` (必需): 结束日期，格式 YYYY-MM-DD
- `submitter` (可选): 提交人姓名
- `sourcePath` (可选): 源码路径或代号
  - `nova` → `$/PET-CT Software Project/S2 main`（默认）
  - `flight` → `$/PET-CT Software Project/PET-CT flight`
  - `flight plus` → `$/PET-CT Software Project/PET-CT flight plus`
- `tfsUrl` (可选): TFS服务器URL

**使用示例：**
- "查询peng yang今年1月1号到5月26号的提交"
- "查看nova项目guanwei li 5月份的提交"
- "查询flight plus项目本月的所有变更集"

## 技术实现

### 框架

- **FastMCP** - Node.js MCP框架
- **Zod** - TypeScript-first参数验证

### 传输协议

- **stdio** - 标准输入输出

### API端点

服务通过本地代理访问TFS API：
- 健康检查: `GET http://localhost:9000/api/tfs/health`
- 变更集查询: `POST http://localhost:9000/api/changesethistory/query`

## 代号映射

`sourcePath` 参数支持以下代号：

| 代号 | 映射路径 |
|------|---------|
| flight | `$/PET-CT Software Project/PET-CT flight` |
| flight plus | `$/PET-CT Software Project/PET-CT flight plus` |
| flightplus | `$/PET-CT Software Project/PET-CT flight plus` |
| flight-plus | `$/PET-CT Software Project/PET-CT flight plus` |
| nova | `$/PET-CT Software Project/S2 main` |

也可以直接使用完整的TFS路径。

## Skill集成

此MCP服务与 `tfs-changeset-query` Skill 集成，支持自然语言查询。

Skill位置：`.qoder/skills/tfs-changeset-query/`

## 故障排查

### 问题：MCP工具不可用

**解决方案：**
1. 检查 `mcp.json` 中的路径是否正确
2. 确认 `tfs_health_mcp.js` 文件存在
3. 检查依赖是否安装：`npm install`
4. 重启Qoder

### 问题：连接TFS失败

**解决方案：**
1. 确认本地代理运行在 `localhost:9000`
2. 检查TFS服务是否可访问
3. 使用健康检查工具验证连接

## 更新日志

- **2026-05-27**: 
  - 移动到独立的 `mcp-server/` 目录
  - 更新配置文件路径
  - 添加配置更新说明

- **2026-05-26**: 
  - 初始版本
  - 添加健康检查和变更集查询功能
  - 支持sourcePath代号映射
