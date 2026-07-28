GBSimulator 实现原理详解
1. 项目概述
GBSimulator是一个PET采集系统的模拟器，用于模拟GB (Gantry Backend) 设备的行为。它通过DACP协议与上层软件通信，模拟真实的扫描数据发送过程。

2. 核心架构
三大通信通道：

ControlChannel (SimulatorControlChannel.cs) - 控制命令通道，端口12423，处理扫描控制、配置等命令
EventChannel (SimulatorEventChannel.cs) - 事件通道，发送扫描统计信息
DataChannel (SimulatorDataChannel.cs) - 数据通道，发送ListMode扫描数据
MonitorChannel (SimulatorMonitorChannel.cs) - 监控通道，端口61024，处理系统状态查询
入口参数处理：

GBSimulatorEntryParameters.cs 支持命令行参数传入
3. 数据流

ListMode文件 → 读取 → DacpDataPacket → DataChannel发送 → 接收端
                ↓
         RealtimeStatsCollector
                ↓
         统计信息 → EventChannel发送
4. 当前床位数据处理逻辑
在 GBSimulatorViewModel.cs 中：

支持最多6个床位位置 (ListModeDataFilePath 集合)
当前通过UI或命令行参数 BedPositionFiles 指定文件路径
扫描时按顺序发送各床位的数据 (第1014-1113行)
新增需求实现计划
基于你的需求，我建议以下实现方案：

需求拆解
动态加载床位信息 - 根据传入参数决定加载哪些床位
动态加载listmode数据 - 支持按规则选择不同的预置数据文件
预置数据规则系统 - 根据特定条件（如扫描类型、床位数量等）加载对应的数据
建议的实现方案
方案A：配置文件驱动（推荐）
新增一个 DataProfileConfig.json 配置文件：


{
  "profiles": {
    "brain_scan": {
      "description": "脑部扫描",
      "bedCount": 1,
      "files": ["brain_15min.lm"],
      "expectedSpeed": "10"
    },
    "whole_body_6bed": {
      "description": "全身扫描6床位",
      "bedCount": 6,
      "files": ["head.lm", "chest.lm", "abdomen.lm", "pelvis.lm", "thigh.lm", "feet.lm"],
      "expectedSpeed": "15"
    },
    "cardiac_1bed": {
      "description": "心脏扫描",
      "bedCount": 1,
      "files": ["cardiac_30min.lm"],
      "expectedSpeed": "20"
    }
  }
}
新增命令行参数：

Profile=brain_scan - 按预置配置加载
BedCount=3 - 指定床位数量
DataPattern=sequential|random|cyclic - 数据加载模式
方案B：目录扫描模式
指定一个数据目录，自动扫描并按命名规则加载：


/DataFolder/
  /1bed/
    scan1.lm
    scan2.lm
  /6bed/
    set1/
      bed1.lm
      bed2.lm
      ...
    set2/
      ...
需要修改的文件
文件	修改内容
GBSimulatorEntryParameters.cs	新增参数解析：Profile、BedCount、DataPattern、DataFolder
新增 DataProfileLoader.cs	配置文件加载和解析逻辑
GBSimulatorViewModel.cs	修改 ApplyEntryParam 方法，支持动态加载逻辑
新增 BedDataSelector.cs	根据规则选择数据文件的逻辑
关键代码修改点
1. 入口参数扩展 (GBSimulatorEntryParameters.cs)：


// 新增参数
case "Profile":
    parameters.Profile = values[1];
    break;
case "BedCount":
    parameters.BedCount = int.Parse(values[1]);
    break;
case "DataPattern":
    parameters.DataPattern = values[1]; // "sequential", "random", "cyclic"
    break;
case "DataFolder":
    parameters.DataFolder = values[1];
    break;
2. 动态加载逻辑 (GBSimulatorViewModel.cs)：


private void ApplyEntryParam()
{
    var parameters = Application.Current.TryFindResource("EntryParam") as GBSimulatorEntryParameters;
    if (parameters == null) return;

    // 如果指定了Profile，从配置加载
    if (!string.IsNullOrEmpty(parameters.Profile))
    {
        LoadFromProfile(parameters.Profile);
    }
    // 如果指定了DataFolder，按规则扫描加载
    else if (!string.IsNullOrEmpty(parameters.DataFolder))
    {
        LoadFromDataFolder(parameters.DataFolder, parameters.DataPattern, parameters.BedCount);
    }
    // 否则使用原有的BedPositionFiles逻辑
    else
    {
        // 原有逻辑...
    }
}