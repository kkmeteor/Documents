# PdcServiceTestTool 测试工具

> 本文档整理自原始文件：GBSimulatorTestTool.md

---

## 一、项目概述

PdcServiceTestTool 是一个 WPF 桌面测试工具，用于测试和调试 PDC（Process Data Console）服务的各种功能。通过 WCF 与 PDC 服务通信，提供图形化界面执行各种测试操作。

---

## 二、项目结构

```
PdcServiceTestTool/
├── PdcServiceTestTool.csproj       # 项目文件
├── App.xaml                         # 应用程序入口
├── App.xaml.cs
├── App.config                       # 配置文件
├── MainWindow.xaml                  # 主窗口UI
├── MainWindow.xaml.cs               # 主窗口逻辑
├── PdcServiceClient.cs              # PDC服务客户端封装
├── Properties/
│   ├── AssemblyInfo.cs
│   ├── Resources.resx
│   ├── Resources.Designer.cs
│   └── Settings.Designer.cs
└── Service References/
    └── PdcControlService/
        ├── Reference.cs             # WCF服务引用
        └── Reference.svcmap
```

---

## 三、功能特性

### 3.1 连接设置

- 可配置 PDC 服务 IP 地址和端口
- 测试连接按钮验证服务可用性
- 连接状态显示（绿色=已连接，红色=未连接）

### 3.2 快速操作

| 操作 | 说明 |
|------|------|
| HeartBeat | 心跳检测 |
| Inspect PDC Process | 检查 PDC 进程状态 |
| Get PDC Version | 获取 PDC 软件版本 |
| Inspect Database | 检查数据库状态 |
| Inspect Log Service | 检查日志服务状态 |
| Get Disk Size | 获取 PDC 磁盘大小 |

### 3.3 扫描操作

| 操作 | 说明 |
|------|------|
| Start/Stop Scan | 启动/停止扫描（可指定 Series ID） |
| Is Sorting/Reconing | 检查是否正在排序/重建 |
| Inspect Acquisition/Sorting/Recon Process | 检查各进程状态 |

### 3.4 GB（Gantry Board）操作

| 操作 | 说明 |
|------|------|
| Connect/Disconnect GB | 连接/断开 GB |
| Inspect GB Communication | 检查 GB 通信状态 |
| GB Health State | 获取 GB 健康状态 |
| System State | 获取系统状态 |
| GB Firmware/Software Version | 获取版本信息 |
| GB Voltage | 获取电压信息 |
| Get Singles/Temperature | 获取探测器单计数/温度 |
| Get GB Local Time | 获取 GB 本地时间 |

---

## 四、使用方法

1. **配置连接**：在 "PDC IP" 和 "Port" 字段输入 PDC 服务的地址（默认: localhost:8080）
2. **测试连接**：点击 "Test Connection" 按钮验证服务是否可达
3. **执行操作**：点击相应的按钮执行各种测试操作
4. **查看结果**：所有操作结果会显示在底部的 "Log Output" 区域

---

## 五、技术实现

- 使用 WCF BasicHttpBinding 与 PDC Service 通信
- 实现了完整的 WCF 服务客户端代理
- 支持所有主要的 PDC 服务操作
- 异步执行操作，UI 保持响应
- 详细的日志记录
