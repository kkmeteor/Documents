# GBSimulator 修改方案 V2

> 基于第一版设计反馈的已实现功能总结
> 对应反馈编号：设计评审中的 5 项核心意见

---

## 反馈 1：不要使用启动参数来配置

**状态：✅ 已实现**

### 实现方案

保留命令行参数作为**向后兼容**入口，核心配置方式迁移至**UI 可视化操作**：

| 配置方式 | 说明 | 优先级 |
|---------|------|--------|
| **UI 预设选择** | 下拉框选择预设场景（成人全身/心脏/脑部/头部/体模） | 最高 |
| **UI 动态增删床位** | 运行时直接添加/删除床位，无需重启 | — |
| **UI 加载配置** | 通过加载按钮从本地 JSON 文件导入配置 | — |
| **UI 保存配置** | 将当前床位配置导出为 JSON 文件 | — |
| **命令行参数** | 仅首次启动生效，保留现有使用习惯 | 向后兼容 |

---

## 反馈 2：运行时切换 beds 数量，不要重启程序

**状态：✅ 已实现**

### 实现方案

通过 `DynamicBedViewModel` 实现完整的运行时床位管理：

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

### 预设列表

| 预设名称 | 床位数量 | 用途 |
|---------|:--------:|------|
| Default (6 beds) | 6 | 默认全身扫描 |
| AdultWholeBody (6 beds) | 6 | 成人全身扫描 |
| AdultCardiac (1 bed) | 1 | 成人心脏扫描 |
| AdultBrain (1 bed) | 1 | 成人脑部扫描 |
| Head (4 beds) | 4 | 头部扫描 |
---

## 反馈 3：使用 HTTP 接口实现自动化控制

**状态：✅ 已实现**

### 实现方案

采用 **OWIN 自宿主 + ASP.NET Web API** 在程序内部启动 HTTP 服务（端口 **5000**），无需外部 Web 服务器。

### API 端点

| 方法 | 路由 | 功能 | 请求体 |
|------|------|------|--------|
| POST | `/api/load-default` | 按名称从 SampleConfig 目录加载预设配置 | `{ "ConfigName": "sample_6beds" }` |
| POST | `/api/load-by-user` | 加载用户指定路径的 JSON 配置文件 | `{ "FilePath": "D:\\config.json" }` |
| POST | `/api/load-config` | **直接通过请求体传入床位配置 JSON**，无需文件路径 | `{ "BedCount": 2, "Beds": [...], ... }` |
| POST | `/api/channels` | **统一通道控制**，支持 open/close 操作，UI 按钮联动 | `{ "operation": "open" }` / `{ "operation": "close" }` |
| POST | `/api/patient-info` | 更新病人信息（支持部分字段） | `{ "PatientName": "张三", ... }` |

### 新增 API 说明

#### `/api/load-config` — 动态床位配置

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

#### `/api/channels` — 通道控制

模拟 UI 上 Open/Close channels 按钮的点击行为，触发通道生命周期管理。API 执行后 UI 状态同步联动（Open 按钮隐藏/显示、Close 按钮显示/隐藏）。

| 操作 | UI 效果 |
|------|---------|
| `operation: "open"` | Open 按钮隐藏、Close 按钮显示、传输速度输入框禁用 |
| `operation: "close"` | Close 按钮隐藏、Open 按钮显示、传输速度输入框启用 |

### 设计原则

- **非侵入式旁路模式**：所有 API 均调用 ViewModel 上已有的 Command（如 `StartCommand`、`StopCommand`），与 UI 按钮点击走同一段代码逻辑，不影响 DACP 协议标准生产流程
- **API 为可选能力**：生产环境下 Console 仍通过 DACP 控制通道驱动 Simulator，HTTP API 仅用于调试、自动化测试和第三方工具集成
- **幂等安全**：通道已打开时重复 open、已关闭时重复 close 均不报错

### 接口特点

- **轻量化**：仅依赖 Owin + ASP.NET Web API，无外部容器
- **统一风格**：JSON 格式请求/响应，符合 RESTful 规范
- **调试友好**：提供 [example.http](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Acquisition.GBSimulator/example.http) 文件，VS Code REST Client 可直接调用测试
- **脚本友好/跨工具兼容**：兼容自动化测试工具，PowerShell Invoke-RestMethod、Python requests 直接调用，无需定义其他工具链
- **高扩展性**：针对之前考虑的与 console 通信交互，接受console的通知动态更新，未来可扩展更多功能（集成CT模拟器等）


## 反馈 4：统计数据的计算不要报错

**状态：✅ 已实现**


### 异常保护

- `SendScanStatistics` 中的 `EventChannel.SendEvent()` 包装在 `try-catch(ChannelDownException)` 中
- 两种统计模式（realtime / mock）均受保护，不会因通道断开而崩溃
- `StatsCollector` 内部使用 `lock` 保证线程安全



## 反馈 5：模拟数据期待更真实

**状态：🟡 未实现**

### 已实现内容

#### 5.1 统计信息真实化

### 使用开关

主界面新增「实时统计」复选框（`UseRealtimeStats`）：

| 状态 | 行为 |
|------|------|
| ✅ 勾选（默认） | 从实际 ListMode 数据解析真实统计 |
| ❌ 取消勾选 | 使用随机生成的模拟统计数据 |

### 实现方案
> todo:参考SUI工具逻辑，动态生成统计信息，并按周期发送
引入 `RealtimeStatsCollector` 从实际发送的 ListMode 数据中解析统计信息：

| 统计项 | 数据来源 | 说明 |
|--------|---------|------|
| **CoinCounts (PromptCount)** | 数据包长度 / 8字节（每个事件 8 bytes） | 按周期累加 |
| **Block SinglesCount** | 从事件 Crystal ID 解析 → 映射到 Block ID | 每周期重置 |
| **DM SinglesCount** | Block 级别求和得到 Detector Module 级别 | 每周期重置 |
| **CrystalStatistics** | Block Singles 均匀分配到 256 个 Crystals | 每周期重置 |

#### 5.2 床位对应

- 每个床位独立管理数据文件路径
- 扫描时按 `currentShouldBeSendBedPos` 定位到对应床位
- 每个床位有预设的统计范围（通过 `GetPromptRateRange` / `GetCrystalSinglesRange` / `GetHslSinglesCount` 区分）

#### 5.3 多种发送模式

| 模式 | 说明 |
|------|------|
| `ContinuouslyReadFileAndSend` | 持续从文件读取 1GB 分块 → 拆分为 64 个 16MB 包发送 |
| `ReadOnceThenSendFromMemory` | 首次读取 16MB 到内存 → 循环发送同一数据 |

### 待优化项

- [ ] 支持多种协议的同时模拟（一次扫描多个协议）是否可以将多个协议的床位信息合并到一个文件中？如果可以，可以利用用户自定义床位配置文件，
  在程序启动时自动加载所有床位信息，并支持在 UI 中选择床位。

---

## 反馈 6：支持在 UI 显示病人信息

**状态：✅ 已实现**

### 实现方案

提供独立的病人信息管理功能，支持显示和修改完整的 patient 检查信息。
 #### 提供2种方案：
 #### 1.从 ListMode 关联的原始DB数据中解析病人信息（需要 ListMode 数据支持）
 >todo 第一次加载listmode数据时解密ENC文件，将解密后数据直接存储到相应文件夹中，方便二次读取。解析病人信息，并显示在UI上。
 #### 2.从 console 调用API更新病人信息。

#### 6.1 默认预定义病人信息

程序启动时自动加载预定义的病人信息作为默认值，包含以下字段：

| 类别 | 字段 |
|------|------|
| **患者信息** | 姓名、ID、性别、出生日期、身高、体重、血糖 |
| **检查信息** | 检查号、检查时间、检查描述、体位 |
| **医护信息** | 开单医生、操作人员 |
| **示踪剂信息** | 核素名称、示踪剂名称、满针测量时间/剂量、空针测量时间/剂量、注射时间/剂量、注射日期 |

> 后续考虑：从原始 ListMode 数据文件中自动解析并提取病人信息和示踪剂信息，减少手动输入。

#### 6.2 通过 HTTP 接口动态修改，考虑使用旁路模式从 Console 端发送病人信息更新请求

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

#### 6.3 UI 操作

- 主界面点击「病人信息」按钮，弹出独立信息窗口
- 窗口内含完整字段列表，支持查看和直接编辑
- ViewModel 共享实例，确保 UI 与 API 修改同步



## 反馈：
> 1. 优先完成真实数据统计功能
> 2. 跟测试同学分享使用，完善优化预置配置文件，参考使用中的建议和问题，逐步优化改进。
> 3. 考虑增加对CT数据模拟的支持，将CT模拟从console中迁移到simulator。
