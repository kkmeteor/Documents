# GBSimulator 使用手册

### 1.1 核心修改计划

| 功能 | 说明 |
|------|------|
| **动态床位管理** | 支持 1-10 个床位的灵活配置，满足不同扫描场景 |
| **预设场景** | 内置多种预设（成人全身、心脏、脑部...），一键配置 |
| **配置文件** | 支持 JSON 格式配置文件的保存和加载 |
| **数据发送** | 模拟 ListMode 数据包发送，支持速度控制 |
| **门控信号** | 支持 Internal/External Gating Tag 的模拟发送 |
| **向后兼容** | 保留原有命令行参数接口 |


---

## 二、快速开始

### 2.1 基本启动

```bash
# 默认启动（6床位）
GBSimulator.exe
```

### 2.2 指定床位数量

```bash
# 启动 4 个床位
GBSimulator.exe Beds=4

# 启动 8 个床位
GBSimulator.exe Beds=8
```

### 2.3 使用配置文件

```bash
# 加载 6 床位配置
GBSimulator.exe Config=SampleConfig\sample_6beds.json

# 加载 8 床位配置
GBSimulator.exe Config=SampleConfig\sample_8beds.json

# 加载 1 床位配置
GBSimulator.exe Config=SampleConfig\sample_1beds.json
```

### 2.4 使用预设场景

```bash
# 成人脑部扫描（4床位）
GBSimulator.exe Preset=head

# 成人全身扫描（6床位）
GBSimulator.exe Preset=adultwholebody

# 成人心脏扫描（1床位）
GBSimulator.exe Preset=adultcardiac
```

### 2.5 完整示例

```bash
# 8床位 + 指定速度 + 自动启动
GBSimulator.exe Beds=8 ExcpectedSpeed=150 AutoLaunch=true

# 配置文件 + 文件路径 + 自动启动
GBSimulator.exe Config=SampleConfig\sample_8beds.json AutoLaunch=true

# 预设场景 + 文件路径 + 速度
GBSimulator.exe Preset=adultwholebody BedPositionFiles=head,neck,chest ExcpectedSpeed=120
```

---

## 三、命令行参数详解

### 3.1 参数列表

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


## 四、tobe done

### 4.1 支持从preset自动mapping到床位文件，并支持自定义床位文件

- 选中preset自动mapping到床位文件，并支持自定义床位文件

### 4.2 修改采集参数设置

- 修改采集参数设置

### 4.3 了解原始数据导出的各种文件格式内容

- 了解原始数据导出的各种文件格式内容


反馈：
1. 不要使用启动参数来配置。
2. 运行时切换beds数量，不要重启程序。
3. 自动化，根据传的参数选中指定的数据。使用接口来切换数据源。接口调用最好和其他工具统一。GRPC？
4. 统计数据的计算，不要报错。不要因为模拟数据报错。
5. ***模拟数据期待更真实，1.统计信息不真实 2.床位对应，一次多个协议***
6. CT模拟在console里面，后期考虑优化。
7. console有能力通知到simulator。可以考虑后期实现。
