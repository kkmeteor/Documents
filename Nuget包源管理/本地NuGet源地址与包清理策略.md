---
title: "本地NuGet源地址与包清理策略"
usage_scenario:
    - "上传或引用私有nuget包时配置正确的源地址"
    - "清理过时nuget包时选择安全的隐藏方式"
    - "排查nuget包无法找到的问题时检查源配置"
keywords:
    - "本地NuGet源"
    - "Unlist"
    - "包清理"
source: "auto"
---

项目使用本地NuGet源 http://10.10.11.194:1001/v3/index.json；清理废弃包时优先使用Unlist（取消列出）使其不再出现在搜索结果，但已安装项目仍可使用；若需彻底移除则使用Delete或直接删除服务器上的.nupkg文件
