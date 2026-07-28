# GBSimulator 项目总览

> 本文档为 GBSimulator 项目的索引文档，整理自原始 16 个分散文件，消除重复内容后按主题归类为 4 份核心文档。

---

## 项目简介

**GBSimulator** 是一个 WPF 桌面应用程序，用于模拟 PET 采集系统的 GB（Gantry Board / 采集板）硬件设备。它通过 DACP 协议与上层采集服务通信，模拟真实的扫描数据发送过程，主要用于开发和测试环境。

---

## 文档索引

| 编号 | 文档名称 | 内容概要 | 原始文件来源 |
|:----:|---------|---------|-------------|
| 01 | [系统架构与通信协议](./01-系统架构与通信协议.md) | 整体系统架构、StartScan 调用链、WCF 双工通信、DACP 协议详解、通道架构 | GBSimulator.md, GBSimulatorChain.md, AcquisitionService.md, Dacp协议.md |
| 02 | [功能设计与实现](./02-功能设计与实现.md) | 动态床位管理、预设场景、HTTP API、统计数据、病人信息、命令行参数、待办事项 | GB Simulator修改计划.md/V1/V2/合并版/演示版/实现版 |
| 03 | [架构演进与设计决策](./03-架构演进与设计决策.md) | 从企业级架构到精简版的演进过程、设计原则对比、代码精简分析、实施计划 | 修改计划演进总结.md, 精简集成方案汇报文档.md, 精简集成计划.md, 修改计划第一版.md, simulator plan 1/2.md |
| 04 | [测试工具 PdcServiceTestTool](./04-测试工具PdcServiceTestTool.md) | PDC 服务测试工具的项目结构、功能特性、使用方法 | GBSimulatorTestTool.md |

---

## 原始文件映射表

下表列出原始 16 个文件与整理后文档的对应关系，方便溯源：

| 原始文件 | 整理去向 | 备注 |
|---------|---------|------|
| GBSimulator.md | 01 | StartScan 方法分析、扫描流程 |
| GBSimulatorChain.md | 01 | GBSimulator 组件架构、与 StartScan 的交互 |
| AcquisitionService.md | 01 | WCF 双工通信、Acquisition.Service 架构 |
| Dacp协议.md | 01 | DACP 协议通信详解、通道架构 |
| GB Simulator修改计划.md | 02 | 综合修改计划 |
| GB Simulator修改计划V1.md | 02 | 使用手册版本 |
| GB Simulator修改计划V2.md | 02 | 基于反馈的实现总结 |
| GB Simulator修改计划实现.md | 02 | 运行时配置切换实现 |
| GB Simulator修改计划（合并版）.md | 02 | V1+V2 合并版 |
| GB Simulator修改计划（演示版）.md | 02 | 演示版（与合并版几乎相同） |
| GB simulator workflow.md | 01 | Acquisition.Service 工作流 |
| simulator plan 1.md | 03 | 实现原理 + 新需求方案初版 |
| simulator plan 2.md | 03 | 实现原理 + 新需求方案详细版 |
| 修改计划V1.md | 03 | 运行时配置切换计划（与"实现"重复） |
| 修改计划演进总结.md | 03 | 企业级→精简版演进分析 |
| 修改计划第一版.md | 03 | 动态床位系统项目总结 |
| 精简集成方案汇报文档.md | 03 | 精简集成汇报（含三版本对比） |
| 精简集成计划.md | 03 | 精简集成执行计划 |
| GBSimulatorTestTool.md | 04 | PDC 测试工具说明 |

---

## 核心技术栈

| 技术 | 用途 |
|------|------|
| **WPF** | GBSimulator 桌面 UI |
| **WCF (NetTcpBinding)** | Console ↔ PDC 双工通信 |
| **DACP (TCP Socket)** | PDC ↔ GB 硬件/模拟器通信 |
| **OWIN + ASP.NET Web API** | GBSimulator 内置 HTTP 服务（端口 5000） |
| **JSON (Newtonsoft.Json)** | 配置文件序列化 |
| **MVVM** | WPF 应用架构 |

---

## 关键端口一览

| 端口 | 服务 | 协议 | 说明 |
|:----:|------|------|------|
| 12423 | GBSimulator 控制通道 | TCP (DACP) | 接收控制命令 |
| 61024 | GBSimulator 监控通道 | TCP | 系统状态查询 |
| 5000 | GBSimulator HTTP API | HTTP | RESTful 自动化控制 |
| 8733 | Acquisition.Service | WCF NetTcp | PDC ↔ 采集服务通信 |
| 8080 | PdcControlService | WCF HTTP | Console ↔ PDC 控制通信 |
