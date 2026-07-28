# TFS MCP 服务使用指南

## 概述

这是一个本地MCP服务，提供TFS健康检查和变更集历史查询功能，支持通过Skill直接使用自然语言查询。

## 核心文件

```
MD/
├── tfs_health_mcp.js                    # MCP服务主文件
├── package.json                         # Node.js项目配置
├── node_modules/                        # 依赖包
├── .qoder/skills/tfs-changeset-query/  # Skill定义
│   ├── SKILL.md                        # Skill主指令
│   ├── examples.md                     # 使用示例
│   └── README.md                       # Skill说明
└── MCP使用说明.md                       # 本文档
```

## 快速开始

### 1. 安装依赖（已完成）

```bash
npm install fastmcp zod
```

### 2. 配置MCP Server

在Qoder的MCP配置文件中添加：

```json
{
  "mcpServers": {
    "tfs-tool": {
      "command": "node",
      "args": ["C:\\Users\\tengfei.ma\\Documents\\MD\\tfs_health_mcp.js"],
      "disabled": false
    }
  }
}
```

### 3. 重启Qoder

配置完成后重启Qoder即可使用。

## 功能说明

### 功能1：检查TFS服务健康状态

**工具名称：** `check_tfs_health`

**使用方式：**
- "检查TFS服务健康状态"
- "TFS服务是否正常"

**返回示例：**
```json
{
  "Status": "Healthy",
  "Time": "2026-05-26T09:07:07.018546+08:00"
}
```

### 功能2：查询TFS变更集历史

**工具名称：** `query_changeset_history`

**参数：**
- `startDate` (必需): 开始日期，格式 YYYY-MM-DD
- `endDate` (必需): 结束日期，格式 YYYY-MM-DD
- `submitter` (可选): 提交人姓名
- `sourcePath` (可选): 源码路径或代号
  - `flight` → `$/PET-CT Software Project/PET-CT flight`（默认）
  - `flight plus` → `$/PET-CT Software Project/PET-CT flight plus`
  - `nova` → `$/PET-CT Software Project/S2 main`
- `tfsUrl` (可选): TFS服务器URL

**使用示例：**

1. **查询特定人员的提交**
   ```
   "我要查询今年1月1号到5月26号，所有peng yang的提交结果"
   ```

2. **使用项目代号查询**
   ```
   "查询nova项目guanwei li 5月份的提交"
   ```

3. **查询所有提交**
   ```
   "查看2026年3月到5月的所有变更集"
   ```

## Skill使用

配置Skill后，直接用自然语言提问即可，无需手动创建脚本。

**Skill会自动处理：**
1. 解析日期（支持"今年1月1号"、"最近一个月"等自然语言）
2. 解析sourcePath代号（flight、nova等）
3. 调用MCP工具
4. 格式化返回结果

## 技术细节

### MCP工具实现

- **框架**: FastMCP (Node.js)
- **参数验证**: Zod
- **传输协议**: stdio
- **API端点**: 
  - 健康检查: `GET http://localhost:9000/api/tfs/health`
  - 变更集查询: `POST http://localhost:9000/api/changesethistory/query`

### 依赖包

```json
{
  "fastmcp": "^x.x.x",
  "zod": "^x.x.x"
}
```

## 常见问题

**Q: 如何添加新的sourcePath代号？**
A: 在 `tfs_health_mcp.js` 的 `SOURCE_PATH_ALIAS` 对象中添加映射。

**Q: 提交人姓名区分大小写吗？**
A: 不区分，系统会自动转换为小写进行匹配。

**Q: 可以使用完整路径吗？**
A: 可以，sourcePath支持代号和完整路径两种格式。

## 更新日志

- 2026-05-26: 
  - 初始版本发布
  - 添加健康检查功能
  - 添加变更集历史查询功能
  - 支持sourcePath代号映射
  - 创建tfs-changeset-query Skill
