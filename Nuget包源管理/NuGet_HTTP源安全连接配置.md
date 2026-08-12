---
title: "NuGet HTTP源安全连接配置"
usage_scenario:
    - "配置私有NuGet源使用HTTP协议时确保连接成功"
    - "新成员初始化开发环境解决restore失败问题"
keywords:
    - "NuGet"
    - "HTTP源"
    - "allowInsecureConnections"
source: "auto"
---

项目使用HTTP协议的NuGet源时，必须在NuGet.Config中将`allowInsecureConnections`设置为true，且该配置需位于`<config>`节点下
