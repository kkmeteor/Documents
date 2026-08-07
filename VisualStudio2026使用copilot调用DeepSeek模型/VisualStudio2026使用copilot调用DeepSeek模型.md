# Visual Studio 2026 Copilot 对接局域网DeepSeek/Ollama模型完整操作手册
## 文档概述
### 适用场景
1. VS2026 内置GitHub Copilot仅支持填写`localhost:11434`本地Ollama地址，**不支持直接填写局域网IP代理地址**，无法直接调用局域网内部署的AI代理服务；
2. 本方案通过两层能力实现打通：
   - C#本地AI代理`ai-proxy-hub`：将DeepSeek官方API转换成Ollama兼容协议；
   - Windows系统`netsh interface portproxy`端口转发：把局域网代理地址映射成本机`127.0.0.1:11434`，绕过VS地址限制；
3. 支持两种后端：公网DeepSeek大模型、局域网本地Ollama私有化模型。

### 前置依赖
- Visual Studio 2026（已安装GitHub Copilot内置组件）
- Windows 10/11 专业版/企业版（家庭版portproxy功能存在兼容缺陷）
- .NET 8/9 SDK（运行C#代理服务）
- DeepSeek API Key（对接公网DeepSeek时必备）
- 管理员权限CMD/PowerShell（配置端口转发）

---
## 整体架构流程
1. 局域网AI服务端：运行`ai-proxy-hub`代理，对外提供Ollama标准API（`局域网IP:11434`）；
2. 本机开发端：使用`netsh portproxy`创建转发规则，将本机`127.0.0.1:11434`流量转发至局域网代理`192.168.X.X:11434`；
3. VS2026 Copilot：仅填写本地地址`http://localhost:11434`识别Ollama模型，流量经系统转发访问局域网DeepSeek。

---
## 第一部分：部署局域网C# AI代理 ai-proxy-hub
### 1.1 获取源码
源码仓库地址：https://github.com/iqmeta/copilot-ollama-multi-provider-ai-proxy
```bash
git clone https://github.com/iqmeta/copilot-ollama-multi-provider-ai-proxy
cd copilot-ollama-multi-provider-ai-proxy
```

### 1.2 配置DeepSeek鉴权密钥
1. 复制环境配置模板：
   ```bash
   cp .env.example .env
   ```
2. 编辑`.env`文件修改核心参数：
   ```ini
   # DeepSeek官方API密钥，前往官网开放平台创建
   PROVIDER_DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
   # 默认使用deepseek-v4-pro，可替换deepseek-v4-flash
   DEEPSEEK_MODEL=deepseek-v4-pro
   # 服务监听端口固定11434，与Ollama标准端口对齐
   LISTEN_PORT=11434
   ```
3. DeepSeek API Key获取步骤：
   1. 打开官网 https://www.deepseek.com/ 进入API开放平台；
   2. 进入`API Keys`菜单，点击创建密钥，复制保存（仅展示一次）。

### 1.3 启动局域网代理服务
```bash
dotnet run
```
启动成功后，局域网内所有机器可访问：`http://[本机局域网IP]:11434`
> 验证接口：浏览器访问 `http://局域网IP:11434/api/tags`，正常返回模型列表即部署成功。

### 1.4 放行局域网防火墙（代理服务器操作）
管理员PowerShell执行，放行11434端口入站流量：
```powershell
netsh advfirewall firewall add rule name="AIProxy_11434" dir=in action=allow protocol=TCP localport=11434 profile=any
```

---
## 第二部分：本机配置netsh端口转发（核心解决VS局域网地址限制）
### 2.1 前置检查
1. 右键开始菜单 → 打开 **管理员PowerShell/CMD**；
2. 检查IP Helper依赖服务（portproxy必须）：
   ```powershell
   sc query iphlpsvc
   ```
   状态为`RUNNING`正常，未启动则执行：
   ```powershell
   sc start iphlpsvc
   ```

### 2.2 创建端口转发规则
#### 命令模板说明
```powershell
netsh interface portproxy add v4tov4 `
listenaddress=127.0.0.1 listenport=11434 `
connectaddress=局域网代理IP connectport=11434
```
参数释义：
- `listenaddress=127.0.0.1`：仅本机环回地址监听，适配VS localhost限制；
- `listenport=11434`：VS Copilot固定Ollama端口；
- `connectaddress`：部署ai-proxy-hub服务的局域网机器IP；
- `connectport=11434`：代理服务监听端口。

#### 实操示例
局域网AI代理服务器IP：`192.168.3.105`，执行：
```powershell
netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=11434 connectaddress=192.168.3.105 connectport=11434
```

### 2.3 防火墙放行本机监听端口
本机放行11434端口，避免本地访问拦截：
```powershell
netsh advfirewall firewall add rule name="LocalOllama_11434" dir=in action=allow protocol=TCP localport=11434
```

### 2.4 转发规则管理常用命令
1. 查看所有已配置转发规则
```powershell
netsh interface portproxy show all
```
2. 删除单条转发规则（切换内网/本地模型时使用）
```powershell
netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=11434
```
3. 清空全部转发规则
```powershell
netsh interface portproxy reset
```

### 2.5 连通性验证
本机PowerShell测试转发是否生效：
```powershell
# 测试转发后的本地接口
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```
正常返回DeepSeek模型列表代表转发链路无故障。

---
## 第三部分：VS2026 GitHub Copilot 配置Ollama模型
### 3.1 进入模型管理面板

1. 打开VS2026右侧Copilot对话助手；
2. 点击对话上方**模型下拉框**；
3. 点击底部【管理模型】按钮。

### 3.2 添加Ollama自定义提供商

1. 在「自带模型」弹窗，下拉选择提供商：`Ollama`；
2. 终结点URL固定填写本地环回地址：`http://localhost:11434`；
3. 点击【添加】按钮加载远端模型列表。

### 3.3 启用DeepSeek模型

1. 加载完成后列表出现两个模型：
   - DEEPSEEK - deepseek-v4-pro:latest
   - DEEPSEEK - deepseek-v4-flash:latest
2. 勾选`.env`配置中对应的模型（默认`deepseek-v4-pro`）；
3. 保存配置，返回Copilot对话窗口。

### 3.4 切换模型使用
回到模型下拉菜单，选择`deepseek-v4-pro`，即可通过局域网代理调用DeepSeek大模型完成代码补全、对话、单元测试生成。

---
## 第四部分：本地Ollama私有化模型兼容方案
若后端不使用DeepSeek公网API，而是局域网Ollama本地私有化模型，仅需修改两步：
1. 跳过`ai-proxy-hub`代理部署，局域网机器直接启动Ollama服务：
   ```bash
   # 允许局域网访问Ollama
   $env:OLLAMA_HOST=0.0.0.0
   ollama serve
   ```
2. netsh转发命令不变，`connectaddress`填写局域网Ollama服务器IP即可，VS配置流程完全一致。

---
## 第五部分：常见故障排查
### 故障1：VS添加Ollama提示无法连接端点
1. 检查管理员PowerShell转发规则是否存在：`netsh interface portproxy show all`；
2. 本机测试`http://127.0.0.1:11434/api/tags`是否能正常访问；
3. 确认局域网AI代理服务器防火墙放行11434端口；
4. 核对代理服务是否正常运行、IP地址无输入错误。

### 故障2：netsh转发规则配置后不生效
1. Windows家庭版不完整支持portproxy，更换专业版/企业版；
2. 启用系统IP路由（管理员执行）：
   ```powershell
   reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v IPEnableRouter /t REG_DWORD /d 1 /f
   ```
   修改后重启电脑生效；
3. 检查IP Helper服务是否处于运行状态。

### 故障3：VS加载不出DeepSeek模型列表
1. 查看ai-proxy-hub服务日志，确认DeepSeek API Key未过期、余额充足；
2. 核对`.env`中`DEEPSEEK_MODEL`模型名称拼写正确；
3. 重启C#代理服务后，重新在VS中删除Ollama提供商并添加一次。

### 故障4：切换本地Ollama模型冲突
如需临时使用本机本地Ollama，先删除netsh转发规则：
```powershell
netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=11434
```
再执行`ollama serve`启动本地服务。

---
## 附录：操作流程速查表
| 操作阶段 | 核心动作 | 关键命令/配置 |
|--------|--------|-------------|
| 局域网代理部署 | 启动ai-proxy-hub | `dotnet run`，配置.env DeepSeek密钥 |
| 端口转发创建 | 映射局域网IP到本地11434 | netsh add v4tov4 转发规则 |
| 连通验证 | 测试模型接口 | Invoke-RestMethod http://127.0.0.1:11434/api/tags |
| VS配置 | 添加Ollama提供商 | 终结点：http://localhost:11434，勾选deepseek-v4-pro |
| 清理转发 | 切换本地模型 | netsh delete v4tov4 删除127.0.0.1:11434规则 |

需要我把这份手册导出成可直接保存的纯Markdown文本（去除图片引用注释，方便复制到文档）吗？