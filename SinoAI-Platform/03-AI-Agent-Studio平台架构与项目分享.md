---
title: "AI Agent Studio（SinoAI Platform）平台架构与项目分享"
usage_scenario:
    - "了解 SinoAI Platform 平台的定位、当前功能与技术架构"
    - "了解 AiStudio + Dify + MinIO 的整体协作架构"
    - "新成员上手项目、参与开发"
keywords: ["SinoAI", "AI Agent Studio", "Dify", "MinIO", "React", "FastAPI", "Skills"]
source: "synthesized (合并自 SinoAI Platform 项目分享.md、Infra.html)"
---

# AI Agent Studio（SinoAI Platform）平台架构与项目分享

## 一、项目定位

**赛诺联合内部的一个 AI 能力集成平台**。内部很多 AI 相关的东西散落在各处——Dify 上有聊天机器人、知识库，Qoder 开发工具有 MCP 工具，还有各种 Skill 插件。这个项目把这些统一到一个界面，让大家在一个地方管理和使用。

**一句话总结：AI 能力的"控制台 + 组件市场 + 全局监控/追溯"。**

### 核心叙事

我们要做的不是"部署一个工具"，而是给公司一个**可复用、可管控、可持续演进的 AI 能力平台**。两个关键定位：

- **SinoAI Platform**：统一入口 + 身份管理 + Skills 市场（公司业务强相关的差异化层）
- **Dify**：AI 引擎 + Agent 编排（AI 重活，通用能力层）

---

## 二、整体架构

### 2.1 平台分层定位

```
┌─────────────────────────────────────────────────────┐
│                  SinoAI Platform                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │ 身份管理  │  │Skills 市场│  │  统一前端入口     │  │
│   │(SSO/RBAC)│  │(能力发现) │  │  (用户交互层)     │  │
│   └─────┬────┘  └────┬─────┘  └────────┬─────────┘  │
│         └────────────┼──────────────────┘             │
│                      │ API                            │
├──────────────────────┼───────────────────────────────┤
│                      ▼                               │
│                    Dify                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │Agent 编排 │  │ 工作流引擎│  │   RAG 知识库     │  │
│   └──────────┘  └──────────┘  └──────────────────┘  │
│                      │                               │
│              模型路由层（本地模型 / 外部 API）          │
└─────────────────────────────────────────────────────┘
```

**为什么分两层？**
- Dify 负责"AI 重活"：模型调用、Agent 编排、知识库检索、工作流执行——通用能力，不重复造轮子
- SinoAI 负责"公司特色"：身份认证（谁是谁）、权限管控（谁能用什么）、Skills 市场（能力发现和复用）
- 好处：Dify 社区持续更新可跟着升级，SinoAI 聚焦业务层，不被底层 AI 细节拖累

### 2.2 系统级架构（AiStudio + Dify + MinIO）

自研前端 AiStudio 作为用户入口，Dify 承担 Agent 编排、知识库管理、文档解析、向量化、RAG 检索核心能力；MinIO 统一存储企业原始文档，实现文件与向量解耦、可扩容企业级私有化部署。

```
前端层 自研AiStudio（对话交互/文档上传/检索查询/结果展示）
   │
   ▼
API网关 & 鉴权层（身份校验、路由转发、限流、日志）
   │
   ▼
Dify 核心平台（Web服务 / Worker异步任务 / Agent编排引擎）
   │
   ▼
存储分层：
  MinIO（原始文档：PDF/Word/MD/Excel + Dify附件 + Agent生成文件）
  向量数据库（Chroma/PgVector/Qdrant，文档向量分片）
  业务数据库 PostgreSQL（对话记录、知识库元数据、文档映射）
```

**核心链路**：
1. 用户在 AiStudio 提问/上传文档 → 网关转发至 Dify
2. Dify 上传原始文件存入 MinIO，文档自动切片向量化存入向量库
3. 问答时 Agent 执行 RAG 检索，召回相关文档片段生成回答返回前端
4. 配套同步程序实现 MinIO 文件变动自动同步进 Dify 知识库

### 2.3 平台级架构（SinoAI 当前实现）

```
┌────────────────────────────────────────────┐
│              用户浏览器 (React SPA)          │
│    localhost:5173（开发）/ 9090（生产）      │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│            Nginx 反向代理（生产环境）         │
│    /api/* → backend:8000                    │
│    /chatbot/* → Dify 服务器                  │
│    /_next/* /console/* → Dify 服务器         │
└──────────────────┬─────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                     ▼
┌───────────────┐   ┌──────────────────┐
│  Backend       │   │  Dify 服务器      │
│  FastAPI       │   │  (10.10.9.65)    │
│  SQLite        │   │  聊天/知识库/Agent │
│  端口 8000     │   │  端口 80          │
└───────┬───────┘   └──────────────────┘
        │
        ▼
┌───────────────┐
│  skills.db     │
│  (SQLite 文件)  │
└───────────────┘
```

**关键设计**：
1. **前后端分离**：前端 React + Vite，后端 FastAPI（Python），各跑各的容器；开发时 Vite proxy 调后端，生产时 Nginx 统一反向代理
2. **Dify 打通**：后端 `DifySession` 类自动登录 Dify 控制台、维护 cookie、401 自动重登；前端 iframe 嵌入 Dify chatbot（Vite dev 用透明代理插件绕开 `X-Frame-Options` 限制）；生产环境 Nginx 配置完整 Dify 反向代理（`/chatbot/`、`/console/`、`/api/` 等路径）
3. **配置驱动**：Dify 地址、登录凭据写在 `config/config.json`，容器运行时挂载，改配置不用重编镜像；支持环境变量覆盖（优先级：环境变量 > config.json > 代码默认值）

---

## 三、当前已实现的功能

系统初步搭建完成，侧边栏切换功能页签：

```
Agent Studio 区：
  ─ Agents（🤖） → 显示 Dify 上发布的 AI 助手列表
  ─ Skills（⚡）  → Skill 插件市场，上传/下载/管理
  ─ Tools（🔧）  → 内置工具展示（占位未实现）
  ─ MCPs（🔗）   → MCP 协议工具（tfs-tool、jenkins-tool）
  ─ RAGs（📚）   → 知识库列表（已对接 Dify 知识库）
  ─ 统计（📊）   → AI token 用量、调用记录、健康状态（占位未实现）

Agent Control 区：
  ─ 会话（💬）   → Dify chatbot 聊天会话入口
  ─ 通道（📡）   → 消息通道展示（占位未实现）
  ─ 记忆（🧠）   → 记忆管理（占位未实现）
```

### 重点模块状态

| 模块 | 状态 | 说明 |
|------|------|------|
| Skills 市场 | ✅ 已上线 | 支持上传 .zip 插件、搜索、下载、删除、置顶（admin 权限） |
| Dify 集成 | ✅ 已上线 | 后端代理 Dify API、前端嵌入 Dify chatbot iframe |
| MCP 展示 | ✅ 已上线 | 展示 tfs-tool、jenkins-tool 等 MCP 服务信息 |
| RAG 知识库 | ✅ 已对接 | 展示 Dify 知识库链接，点击跳转 Dify 管理页 |
| Agent 列表 | ✅ 已上线 | 从 Dify 拉取 app 列表，筛选 online 标签的 Agent |
| 会话入口 | ✅ 已上线 | 通过 iframe 嵌入 Dify chatbot |

---

## 四、技术栈一览

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | React 19 + TypeScript | Hooks 函数组件 |
| UI 组件库 | Ant Design 6 | 界面统一 |
| 构建工具 | Vite 8 | 开发热更新快 |
| 后端框架 | Python FastAPI | 异步高性能 |
| 数据库 | SQLite | 轻量，开发/小规模够用 |
| ORM | SQLAlchemy 2 | Python 最流行 ORM |
| HTTP 客户端 | httpx | 异步，用于代理 Dify API |
| 部署 | Docker Compose | 容器化一键部署 |
| 外部依赖 | Dify | 底层 AI 引擎和知识库 |

## 五、代码结构

```
├── backend/                       # Python 后端
│   └── app/
│       ├── main.py                # FastAPI 入口，挂载路由
│       ├── config.py              # 配置中心（json + 环境变量）
│       ├── database.py            # SQLite + SQLAlchemy
│       ├── models.py              # 数据模型（Skill 表）
│       ├── schemas.py             # Pydantic 校验模型
│       └── routers/
│           ├── skills.py          # Skills CRUD 接口
│           └── dify.py            # Dify API 代理
├── frontend/                      # React 前端
│   ├── src/
│   │   ├── App.tsx                # 主应用，路由+布局
│   │   ├── components/            # Sidebar/SkillCard/SkillDetailModal/UploadModal 等
│   │   ├── pages/MarketPlace.tsx  # Skills 市场页
│   │   └── services/api.ts        # API 调用封装
│   └── nginx.conf                 # 生产 Nginx 配置
├── config/config.json             # 运行时配置（Dify 地址等）
├── MD/                            # 设计文档（Agent/RAG/FlowChart）
├── docker-compose.yml             # 容器编排
└── _start_all_local.bat           # 一键启动（前后端）
```

## 六、怎么跑起来

### 开发模式（本地）

```bash
# 终端 1：启动后端
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 终端 2：启动前端
cd frontend
npm install
npm run dev
```
浏览器打开 `http://localhost:5173`。

### 生产模式（Docker）

```bash
docker-compose up -d --build
```
访问 `http://localhost:9090`。

### 配置文件

`config/config.json` 修改 Dify 服务器地址和登录凭据：
```json
{
  "difyUrl": "http://你的Dify地址:80",
  "difyConsole": { "email": "你的账号", "password": "你的密码" }
}
```

---

## 七、未来规划

**代码仓库**：`http://10.10.11.194:3000/sinounion/ai-studio`（建分支、改代码、提交 PR）

### 开发侧
- **权限管理**：目前未集成公司单点登录，后期考虑集成域账户 + OAuth2 单点登录；Dify 权限控制较粗放，需精细化管理（部门、身份、个人权限）；打通公司域账户和 Dify 账户绑定
- **Agent 功能模块**：声明式 Agent 配置（YAML/JSON 定义身份、模型、绑定的 Skills/MCPs/RAGs，权限映射到 Dify）；运行时引擎（ReAct / Function Calling 循环，LLM Planner + Tool Executor）；会话管理（登录身份绑定、多轮持久化、滑动窗口、上下文压缩）；权限模型（RBAC + 能力级权限 + tool_confirm 确认机制）；审计日志（全链路 trace_id）

### 测试/管理/产品侧
- **RAG 知识库（"单一源、双消费"）**：文档连接器（钉钉、Confluence、GitLab 同步）；智能分块；混合检索（向量+全文双索引）；权限过滤（AI 检索严格遵守文档权限）；溯源机制；更多知识库系统集成（Obsidian 自生长知识图谱等）

### 分阶段路线
| 阶段 | 内容 |
|------|------|
| Phase 1 | Agent 核心 Runtime（配置 CRUD + 对话 + 内置工具） |
| Phase 2 | 能力生态打通（Skills/MCPs/RAGs 鉴权 + 沙盒） |
| Phase 3 | 多通道接入（钉钉/飞书）+ 可观测性 |
| Phase 4 | 多 Agent 协作 + 长任务 + 画布编排 UI |

### 关键设计备忘
- **配置分离**：config.json 挂载到容器，改配置不用重新构建镜像
- **MCP 协议兼容**：预留 Anthropic MCP 协议支持，后续对接更多 MCP 工具

---

## 八、常见问题

**Q：Dify 页面打不开？** A：检查 `config.json` 的 `difyUrl` 是否正确，Dify 服务是否可用。

**Q：上传 Skill 失败？** A：只支持 .zip 文件，大小不超过 Nginx 限制（默认 100M）。

**Q：Dify iframe 白屏？** A：通常是 Dify 响应头带 `X-Frame-Options: DENY`，开发环境用 Vite 透明代理解决，生产环境靠 Nginx `proxy_hide_header` 处理。

---

## 来源

- SinoAI Platform 项目分享.md —— 项目定位、当前功能、技术栈、代码结构、运行方式、规划
- Infra.html —— AiStudio + Dify + MinIO 整体架构
