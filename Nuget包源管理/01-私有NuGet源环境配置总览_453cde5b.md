---
title: "私有 NuGet 源环境配置总览"
usage_scenario:
    - "上传或引用私有 NuGet 包时确定源地址与认证方式"
    - "新成员初始化开发环境，配置项目指向正确的私有源"
    - "排查包无法下载 / 安装 404 错误时检查源配置"
keywords:
    - "NuGet"
    - "私有源"
    - "BaGet"
    - "NuGet.config"
    - "ApiKey"
source: "synthesized (合并自多份文档)"
---

# 私有 NuGet 源环境配置总览

## 一、本地 NuGet 包源地址

项目使用的本地/私有 NuGet 包源统一为：

```
http://10.10.11.194:1001/v3/index.json
```

该地址同时用于**推送**（上传内部开发的 NuGet 包）和**拉取**（引用私有包）。

> 私有源的关键信息分散在多份文档中，本文件将其合并为一份总览。

---

## 二、BaGet 私有 NuGet 服务器架构

项目以 **BaGet** 作为私有 NuGet 服务器：

| 项目 | 说明 |
|------|------|
| 部署地址 | `http://10.10.11.194:1001` |
| 包存储方式 | 本地文件系统（.nupkg 文件落盘存储） |
| 元数据存储 | SQLite 数据库 |

**排查提示**：当包无法下载或页面显示异常时，应检查服务器的存储路径与 SQLite 元数据是否一致。

---

## 三、NuGet.config 配置

### 3.1 新建项目如何指向私有源

新建的 C++ 或 C# 项目若需引用私有 NuGet 包，必须在**解决方案目录下**配置 `NuGet.config`（或修改全局配置），否则会导致安装包时报 404 错误。在项目根目录创建：

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <!-- 本地内部包源 -->
    <add key="InternalNuGet" value="http://10.10.11.194:1001/v3/index.json" />
    <!-- 如需同时使用官方源，取消下行注释 -->
    <!-- <add key="nuget.org" value="https://api.nuget.org/v3/index.json" /> -->
  </packageSources>
</configuration>
```

> **注意**：若私有源使用 HTTP 协议，还需在 `<config>` 节点下开启 `allowInsecureConnections`，详见《02-HTTP源安全连接配置》。

---

## 四、认证方式（ApiKey）

向私有源推送或删除包时，需要携带 `-ApiKey` 参数进行认证：

```powershell
# 推送
nuget push 包名.nupkg `
    -Source http://10.10.11.194:1001/v3/index.json `
    -ApiKey AzureArtifacts

# 删除（认证方式同理）
nuget delete 包名 版本号 `
    -Source http://10.10.11.194:1001/v3/index.json `
    -ApiKey AzureArtifacts `
    -NonInteractive
```

> **说明**：`-ApiKey` 的值取决于本地包源的认证配置。若包源无需认证，可填任意非空字符串或省略该参数。
>
> ⚠️ **冲突提示**：不同来源文档对 `-ApiKey` 的值记录不一致（`AzureArtifacts` 与 `sinounion` 均有出现）。若认证失败，请向管理员确认实际使用的 API Key，详见《05-NuGet包清理与维护策略》中的冲突说明。

---

## 五、新成员环境初始化清单

1. 在解决方案目录创建 `NuGet.config`，配置 `InternalNuGet` 源（见第三节）。
2. 若源为 HTTP，在 `<config>` 节点下开启 `allowInsecureConnections=true`。
3. 验证源可达：`nuget list -Source http://10.10.11.194:1001/v3/index.json`。
4. 推送/删除包时按需携带 `-ApiKey`。

---

## 来源

- 本地NuGet包源地址.md —— 源地址定义
- 本地NuGet包源配置.md —— 新项目配置、404 排查
- BaGet私有NuGet服务器配置.md —— 服务器架构与存储
- BaGet私有源地址与认证配置.md —— ApiKey 认证
