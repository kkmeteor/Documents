---
title: "BaGet私有NuGet服务器配置"
usage_scenario:
    - "上传或删除NuGet包时选择正确的源地址和认证方式"
    - "排查包无法下载或页面显示异常时检查服务器存储路径"
    - "需要清理无效包时确定安全的删除方法"
keywords:
    - "BaGet"
    - "私有NuGet源"
    - "包管理"
source: "auto"
---

项目使用BaGet作为私有NuGet服务器，部署在http://10.10.11.194:1001，包存储于本地文件系统，元数据存储于SQLite数据库；删除包需调用REST API或直接清理文件与数据库记录。
