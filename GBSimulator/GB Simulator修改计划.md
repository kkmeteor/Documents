# GB Simulator 修改计划

---

## 一、概述

### 1.1 核心修改计划

| 功能 | 说明 |
|------|------|
| **动态床位管理** | 支持 1-10 个床位的灵活配置，满足不同扫描场景 |
| **预设场景** | 内置多种预设（成人全身、心脏、脑部...），一键配置 |
| **配置文件** | 支持 JSON 格式配置文件的保存和加载 |
| **数据发送** | 模拟 ListMode 数据包发送，支持速度控制 |
| **门控信号** | 支持 Internal/External Gating Tag 的模拟发送 |
| **HTTP API** | 提供 RESTful 接口，支持自动化控制与外部工具集成 |
| **病人信息** | 支持病人信息的显示、编辑与外部更新 |
| **向后兼容** | 保留原有命令行参数接口 |

---

## 二、使用指南

### 2.1 快速开始

#### 基本启动

```bash
# 默认启动（6床位）
GBSimulator.exe
```

#### 指定床位数量

```bash
# 启动 4 个床位
GBSimulator.exe Beds=4

# 启动 8 个床位
GBSimulator.exe Beds=8
```

#### 使用配置文件

```bash
# 加载 6 床位配置
GBSimulator.exe Config=SampleConfig\sample_6beds.json

# 加载 8 床位配置
GBSimulator.exe Config=SampleConfig\sample_8beds.json

# 加载 1 床位配置
GBSimulator.exe Config=SampleConfig\sample_1beds.json
```

#### 使用预设场景

```bash
# 成人脑部扫描（4床位）
GBSimulator.exe Preset=head

# 成人全身扫描（6床位）
GBSimulator.exe Preset=adultwholebody

# 成人心脏扫描（1床位）
GBSimulator.exe Preset=adultcardiac
```

#### 完整示例

```bash
# 8床位 + 指定速度 + 自动启动
GBSimulator.exe Beds=8 ExcpectedSpeed=150 AutoLaunch=true

# 配置文件 + 文件路径 + 自动启动
GBSimulator.exe Config=SampleConfig\sample_8beds.json AutoLaunch=true

# 预设场景 + 文件路径 + 速度
GBSimulator.exe Preset=adultwholebody BedPositionFiles=head,neck,chest ExcpectedSpeed=120
```

### 2.2 命令行参数详解

| 参数名 | 别名 | 类型 | 说明 | 示例 |
|--------|------|------|------|------|
| `Config` | `ConfigurationFile` | string | JSON配置文件路径 | `Config=myconfig.json` |
| `Beds` | `DynamicBedCount` | int | 动态床位数量 | `Beds=8` |
| `Preset` | `PresetScenario` | string | 预设场景名称 | `Preset=head` |
| `BedPositionFiles` | - | string[] | 床位文件路径列表（逗号分隔） | `BedPositionFiles=bp1,bp2` |
| `AllSendSameFile` | - | bool | 所有床位使用同一文件 | `AllSendSameFile=true` |
| `ExcpectedSpeed` | - | string | 期望传输速度(MB/s) | `ExcpectedSpeed=150` |
| `AutoLaunch` | - | bool | 是否自动启动发送 | `AutoLaunch=true` |
| `WindowVisible` | - | bool | 窗口是否可见 | `WindowVisible=false` |
| `DataFolder` | `DefaultDataFolder` | string | 默认数据文件夹 | `DataFolder=D:\Data` |
| `PresetFolder` | `PresetDataFolder` | string | 预置数据文件夹 | `PresetFolder=D:\Presets` |

> **注意**：命令行参数仅作为向后兼容入口，首次启动生效。核心配置方式已迁移至 UI 可视化操作和 HTTP API，详见后续章节。

---

## 三、配置方式

> 不再使用启动参数来配置，核心配置方式迁移至 UI 可视化操作。

### 3.1 配置方式一览

| 配置方式 | 说明 | 优先级 |
|---------|------|--------|
| **UI 预设选择** | 下拉框选择预设场景（成人全身/心脏/脑部/头部/体模） | 最高 |
| **UI 动态增删床位** | 运行时直接添加/删除床位，无需重启 | — |
| **UI 加载配置** | 通过加载按钮从本地 JSON 文件导入配置 | — |
| **UI 保存配置** | 将当前床位配置导出为 JSON 文件 | — |
| **命令行参数** | 仅首次启动生效，保留现有使用习惯 | 向后兼容 |

---

## 四、动态床位管理

> 支持运行时切换床位数量，无需重启程序。

### 4.1 功能列表

| 功能 | 说明 | 对应命令 |
|------|------|---------|
| **添加床位** | 动态新增一个床位，自动编号 | `AddBedCommand` |
| **删除床位** | 移除最后一个床位 | `RemoveBedCommand` |
| **清空全部** | 一键清空所有床位配置 | `ClearAllBedsCommand` |
| **预设切换** | 选择预设后立即应用，覆盖当前床位列表 | 下拉框 `SelectedPreset` |
| **加载配置文件** | 从 JSON 文件导入完整床位配置 | `LoadConfigCommand` |
| **保存配置文件** | 将当前床位配置导出为 JSON | `SaveConfigCommand` |
| **单独选文件** | 每个床位独立选择数据文件 | 文件选择对话框 |
| **统一选文件** | 所有床位使用同一数据文件 | `SendSameFileCommand` |

### 4.2 预设列表

| 预设名称 | 床位数量 | 用途 |
|---------|:--------:|------|
| Default (6 beds) | 6 | 默认全身扫描 |
| AdultWholeBody (6 beds) | 6 | 成人全身扫描 |
| AdultCardiac (1 bed) | 1 | 成人心脏扫描 |
| AdultBrain (1 bed) | 1 | 成人脑部扫描 |
| Head (4 beds) | 4 | 头部扫描 |

---

## 五、HTTP API

> 使用 HTTP 接口实现自动化控制，采用 OWIN 自宿主 + ASP.NET Web API 在程序内部启动 HTTP 服务（端口 **5000**），无需外部 Web 服务器。

### 5.1 API 端点

| 方法 | 路由 | 功能 | 请求体 |
|------|------|------|--------|
| POST | `/api/load-default` | 按名称从 SampleConfig 目录加载预设配置 | `{ "ConfigName": "sample_6beds" }` |
| POST | `/api/load-by-user` | 加载用户指定路径的 JSON 配置文件 | `{ "FilePath": "D:\\config.json" }` |
| POST | `/api/load-config` | **直接通过请求体传入床位配置 JSON**，无需文件路径 | `{ "BedCount": 2, "Beds": [...], ... }` |
| POST | `/api/channels` | **统一通道控制**，支持 open/close 操作，UI 按钮联动 | `{ "operation": "open" }` / `{ "operation": "close" }` |
| POST | `/api/patient-info` | 更新病人信息（支持部分字段） | `{ "PatientName": "张三", ... }` |

### 5.2 动态床位配置 — `/api/load-config`

客户端可将完整的床位配置 JSON 直接放在请求体中传到 Simulator，无需先将配置文件存放到磁盘上再通过路径加载。适用于 Console 等外部工具动态下发灵活配置的场景。

```json
POST /api/load-config
{
  "BedCount": 2,
  "Beds": [
    { "Id": 1, "Name": "WholeBody", "FilePath": "D:\\data\\bed1", "IsEnabled": true },
    { "Id": 2, "Name": "Cardiac", "FilePath": "D:\\data\\bed2", "IsEnabled": true }
  ],
  "ExpectedSpeed": 200,
  "DefaultSendMode": "ReadOnceThenSendFromMemory"
}
```

### 5.3 通道控制 — `/api/channels`

模拟 UI 上 Open/Close channels 按钮的点击行为，触发通道生命周期管理。API 执行后 UI 状态同步联动。

| 操作 | UI 效果 |
|------|---------|
| `operation: "open"` | Open 按钮隐藏、Close 按钮显示、传输速度输入框禁用 |
| `operation: "close"` | Close 按钮隐藏、Open 按钮显示、传输速度输入框启用 |

### 5.4 设计原则

- **非侵入式旁路模式**：所有 API 均调用 ViewModel 上已有的 Command（如 `StartCommand`、`StopCommand`），与 UI 按钮点击走同一段代码逻辑，不影响 DACP 协议标准生产流程
- **API 为可选能力**：生产环境下 Console 仍通过 DACP 控制通道驱动 Simulator，HTTP API 仅用于调试、自动化测试和第三方工具集成
- **幂等安全**：通道已打开时重复 open、已关闭时重复 close 均不报错

### 5.5 接口特点

- **轻量化**：仅依赖 Owin + ASP.NET Web API，无外部容器
- **统一风格**：JSON 格式请求/响应，符合 RESTful 规范
- **调试友好**：提供 example.http 文件，VS Code REST Client 可直接调用测试
- **脚本友好/跨工具兼容**：兼容自动化测试工具，PowerShell Invoke-RestMethod、Python requests 直接调用，无需定义其他工具链
- **高扩展性**：未来可扩展更多功能（集成 CT 模拟器等）

---

## 六、统计数据

> 统计数据的计算不应报错，模拟数据期待更真实。

### 6.1 异常保护

- `SendScanStatistics` 中的 `EventChannel.SendEvent()` 包装在 `try-catch(ChannelDownException)` 中
- 两种统计模式（realtime / mock）均受保护，不会因通道断开而崩溃
- `StatsCollector` 内部使用 `lock` 保证线程安全

### 6.2 统计信息真实化

主界面新增「实时统计」复选框（`UseRealtimeStats`）：

| 状态 | 行为 |
|------|------|
| ✅ 勾选（默认） | 从实际 ListMode 数据解析真实统计 |
| ❌ 取消勾选 | 使用随机生成的模拟统计数据 |

引入 `RealtimeStatsCollector` 从实际发送的 ListMode 数据中解析统计信息：

| 统计项 | 数据来源 | 说明 |
|--------|---------|------|
| **CoinCounts (PromptCount)** | 数据包长度 / 8字节（每个事件 8 bytes） | 按周期累加 |
| **Block SinglesCount** | 从事件 Crystal ID 解析 → 映射到 Block ID | 每周期重置 |
| **DM SinglesCount** | Block 级别求和得到 Detector Module 级别 | 每周期重置 |
| **CrystalStatistics** | Block Singles 均匀分配到 256 个 Crystals | 每周期重置 |

> **待优化**：参考 SUI 工具逻辑，动态生成统计信息，并按周期发送。

### 6.3 床位对应

- 每个床位独立管理数据文件路径
- 扫描时按 `currentShouldBeSendBedPos` 定位到对应床位
- 每个床位有预设的统计范围（通过 `GetPromptRateRange` / `GetCrystalSinglesRange` / `GetHslSinglesCount` 区分）

### 6.4 数据发送模式

| 模式 | 说明 |
|------|------|
| `ContinuouslyReadFileAndSend` | 持续从文件读取 1GB 分块 → 拆分为 64 个 16MB 包发送 |
| `ReadOnceThenSendFromMemory` | 首次读取 16MB 到内存 → 循环发送同一数据 |

---

## 七、病人信息

> 支持在 UI 显示病人信息，并提供多种信息来源方式。

### 7.1 信息来源

提供两种方案：

1. **从 ListMode 关联的原始 DB 数据中解析病人信息**（需要 ListMode 数据支持）
   > 待实现：第一次加载 listmode 数据时解密 ENC 文件，将解密后数据直接存储到相应文件夹中，方便二次读取。解析病人信息，并显示在 UI 上。

2. **从 Console 调用 API 更新病人信息**（已实现）

### 7.2 默认预定义病人信息

程序启动时自动加载预定义的病人信息作为默认值，包含以下字段：

| 类别 | 字段 |
|------|------|
| **患者信息** | 姓名、ID、性别、出生日期、身高、体重、血糖 |
| **检查信息** | 检查号、检查时间、检查描述、体位 |
| **医护信息** | 开单医生、操作人员 |
| **示踪剂信息** | 核素名称、示踪剂名称、满针测量时间/剂量、空针测量时间/剂量、注射时间/剂量、注射日期 |

> 后续考虑：从原始 ListMode 数据文件中自动解析并提取病人信息和示踪剂信息，减少手动输入。

### 7.3 通过 HTTP 接口动态修改

支持通过 REST API `POST /api/patient-info` 接收外部系统（如 Console）发来的病人信息更新请求：

- **接收方**：GBSimulator 的 OWIN HTTP 服务（端口 5000）
- **请求方式**：JSON 格式，**支持部分字段更新**（仅传入需要修改的字段）
- **应用场景**：Console 在扫描开始前或检查过程中，通过 HTTP 通知 Simulator 更新当前病人信息
- **安全性**：所有更新在 UI 线程上执行，保证 WPF 绑定的线程安全

```json
POST /api/patient-info
{
  "PatientName": "张三",
  "PatientId": "P20240518001",
  "AccessionNumber": "ACC-20240518-001",
  "NuclideName": "F-18",
  "TracerName": "FDG",
  "TracerDose": 8.2
}
```

### 7.4 UI 操作

- 主界面点击「病人信息」按钮，弹出独立信息窗口
- 窗口内含完整字段列表，支持查看和直接编辑
- ViewModel 共享实例，确保 UI 与 API 修改同步

---

## 八、待办与后续规划

### 8.1 功能待办

- [ ] 支持从 preset 自动 mapping 到床位文件，并支持自定义床位文件
- [ ] 修改采集参数设置
- [ ] 了解原始数据导出的各种文件格式内容
- [ ] 优先完成真实数据统计功能
- [ ] 完善优化预置配置文件，参考测试同学使用中的建议和问题，逐步优化改进
- [ ] 支持多种协议的同时模拟（一次扫描多个协议）— 可将多个协议的床位信息合并到一个文件中，利用用户自定义床位配置文件，在程序启动时自动加载所有床位信息，并支持在 UI 中选择床位

### 8.2 后续规划

- **CT 模拟支持**：考虑增加对 CT 数据模拟的支持，将 CT 模拟从 Console 中迁移到 Simulator
- **Console 通知能力**：Console 有能力通知到 Simulator，考虑后期实现（当前已通过 HTTP API 实现旁路通信）
- **ListMode 数据解析**：实现从 ListMode 关联的原始 DB 数据中自动解析病人信息
