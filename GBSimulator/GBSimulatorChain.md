## Sinogram.Pet.Acquisition.GBSimulator 项目分析

### 1. 项目功能概述

**GBSimulator** 是一个 **WPF桌面应用程序**（不是WCF服务），用于**模拟PET采集系统的GB（GigaByte/采集板）硬件设备**。它主要用于开发和测试环境，提供以下功能：

- **模拟硬件控制通道**：通过TCP Socket监听控制命令（端口12423）
- **模拟数据通道**：发送模拟的ListMode数据包
- **模拟事件通道**：发送扫描事件通知
- **模拟监控通道**：提供系统状态监控

### 2. 核心组件架构

```
GBSimulator (WPF应用程序)
├── SimulatorControlChannel  (控制通道 - TCP Server, 端口12423)
├── SimulatorDataChannel     (数据通道 - TCP Socket发送ListMode数据)
├── SimulatorEventChannel    (事件通道 - 发送扫描事件)
├── SimulatorMonitorChannel  (监控通道 - 系统状态)
└── GBSimulatorViewModel     (UI逻辑和配置)
```

### 3. 通信协议 - DACP

GBSimulator 使用 **DACP（Data Acquisition Control Protocol）** 协议与采集服务通信，这是一种基于TCP的自定义二进制协议：

[SimulatorControlChannel.cs:L30-L60](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Acquisition.GBSimulator/SimulatorControlChannel.cs#L30-L60)

```csharp
public class SimulatorControlChannel : AsyncServerChannel
{
    public const int LocalPort = 12423;  // 控制通道端口
    
    // 命令处理字典
    private readonly Dictionary<DacpCode, Tuple<Delegate, Type, Type>> handlerDic;
    
    // 示例命令处理
    {
        DacpCode.SetListModeOutputCmd,  // 开始/停止扫描命令
        new Tuple<Delegate, Type, Type>(
            new Func<SetListModeOutputCommand, SimpleAcknowledge>(ProcessScanStartStopCommand),
            typeof(SetListModeOutputCommand), typeof(SimpleAcknowledge))
    }
}
```

### 4. 与 StartScan 的交互关系

**重要澄清**：GBSimulator **不直接**与 `StartScan` 方法交互。它们之间的调用链如下：

```
StartScan() [Console.ViewModel层]
    ↓
PetScanManager.Instance.StartScan(seriesId) [BizLogic层]
    ↓
PdcConnector.Instance.ControlClient.StartScan(commandData) [PdcClient层]
    ↓
WCF调用 → PdcControlService (在PDC机器上运行)
    ↓
Acquisition.Service (采集服务，与PDC可能在同一机器)
    ↓
DACP TCP Socket → GBSimulator (如果是模拟模式)
    ↓
或 → 真实GB硬件 (如果是生产模式)
```

### 5. 完整的调用流程

#### 5.1 采集服务端的WCF服务

[IAcqService.cs:L12-L20](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Acquisition.Service/IAcqService.cs#L12-L20)

```csharp
[ServiceContract(SessionMode = SessionMode.Required, CallbackContract = typeof(IAcqCallbackService))]
public interface IAcqService
{
    [OperationContract]
    void StartAcquisition(int bedPosition, int duration, bool enableWave);
    
    [OperationContract]
    bool ConnectGb();  // 连接GB硬件/模拟器
}
```

[AcqService.cs:L25-L35](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Acquisition.Service/AcqService.cs#L25-L35)

```csharp
public void StartAcquisition(int bedPosition, int duration, bool enableWave)
{
    acqServiceProxy.Call(() =>
    {
        WorkflowManager.Current.StartAcquisition(bedPosition, duration, enableWave);
    });
}
```

#### 5.2 采集服务端启动

[Program.cs:L18-L30](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Acquisition.Service/Program.cs#L18-L30)

```csharp
static void Main(string[] args)
{
    var serviceHost = new ServiceHost(typeof(AcqService));
    serviceHost.Open();  // 启动WCF服务
    // ...
}
```

### 6. GBSimulator 的工作流程

当GBSimulator作为模拟器运行时：

1. **启动监听**：在端口12423监听控制命令
2. **接收连接**：Acquisition.Service通过TCP连接
3. **处理命令**：解析DACP协议命令（如开始扫描、停止扫描）
4. **发送数据**：从预设的ListMode数据文件读取并发送模拟数据包

[GBSimulatorViewModel.cs:L50-L80](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Acquisition.GBSimulator/ViewModel/GBSimulatorViewModel.cs#L50-L80)

```csharp
class GBSimulatorViewModel : ViewModelBase
{
    private const int PacketDataLength = 1024 * 1024 * 16;  // 16MB数据包
    private const int ScanEventSentInterval = 1000;  // 1秒发送间隔
    
    // 从文件加载模拟数据
    private ObservableCollection<string> ListModeDataFilePath { get; set; }
    
    // 发送数据控制
    private static uint PreTransferPackageNumber;
    private static uint AlreadySendPackageNumber;
}
```

### 7. 架构图总结

```
┌─────────────────────────────────────────────────────────────────┐
│                     Console Application                         │
│  ┌───────────────── ┐   ┌─────────────────┐                     │
│  │ScanProcessConsole│   │  PetScanManager │                     │
│  │   ViewModel      │──→│   (BizLogic)    │                     │
│  │   .StartScan()   │   │  .StartScan()   │                     │
│  └──────────────── ─┘   └────────┬────────┘                     │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                                   ↓ WCF (HTTP)
┌─────────────────────────────────────────────────────────────────┐
│                     PDC Machine                                 │
│  ┌─────────────────┐    ┌────────────────────┐                  │
│  │PdcControlService│    │ Acquisition.Service│                  │
│  │  (WCF Service)  │───→│   (WCF Service)    │                  │
│  └─────────────────┘    └────────┬───────────┘                  │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                                   ↓ TCP Socket (DACP协议)
┌─────────────────────────────────────────────────────────────────┐
│                     GB Hardware / Simulator                     │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Real GB Device │    │  GBSimulator    │                     │
│  │  (Production)   │    │  (Development)  │                     │
│  │                 │    │  - Port 12423   │                     │
│  │                 │    │  - ListMode Data│                     │
│  └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### 8. 关键结论

1. **GBSimulator不是WCF服务**，它是一个WPF桌面应用程序，模拟硬件设备
2. **WCF服务是Acquisition.Service**，它运行在PDC机器上
3. **StartScan通过多层调用**最终到达GBSimulator（仅在开发/测试模式）
4. **生产环境**中，Acquisition.Service直接连接真实的GB硬件设备
5. **通信协议**使用自定义的DACP协议通过TCP Socket传输