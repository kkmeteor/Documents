---
title: "HTTP NuGet源连接需在NuGet.config中启用allowInsecureConnections"
usage_scenario:
    - "配置私有NuGet源使用HTTP协议时确保连接成功"
    - "新成员初始化开发环境解决restore失败问题"
keywords:
    - "NuGet"
    - "HTTP源"
    - "allowInsecureConnections"
    - "NuGet.config"
source: "auto"
---

项目使用HTTP协议的私有NuGet源（http://10.10.11.194:1001/v3/index.json）时，必须在NuGet.Config文件中将`allowInsecureConnections`设置为true，以允许不安全连接。该配置项必须位于`<config>`节点下，而非`<packageSources>`节点内。
