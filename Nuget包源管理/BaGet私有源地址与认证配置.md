---
title: "BaGet私有源地址与认证配置"
usage_scenario:
    - "向私有源推送或删除包时确定源地址和认证方式"
    - "新成员配置本地NuGet客户端指向正确私有源"
keywords:
    - "BaGet"
    - "私有源"
    - "ApiKey"
source: "auto"
---

项目使用位于 `http://10.10.11.194:1001` 的BaGet作为私有NuGet源，删除包时需使用 `-ApiKey AzureArtifacts` 进行认证
