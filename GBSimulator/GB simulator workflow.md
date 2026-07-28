## Sinogram.Pet.Acquisition.Service 架构分析

### 1. 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PDC (控制台)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │         Sinogram.Pet.Acquisition.Logics                             │    │
│  │  ┌─────────────────────┐         ┌─────────────────────────────┐   │    │
│  │  │ AcqServiceClient    │◄───────►│  AcquisitionServiceClientProxy│   │    │
│  │  │ (WCF Client)        │  WCF    │  - AcqClient (调用服务)       │   │    │
│  │  │ net.tcp://:8733     │ 双工    │  - AcqCallback (接收回调)     │   │    │
│  │  └─────────────────────┘         └─────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼ WCF NetTcpBinding (端口 8733)
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sinogram.Pet.Acquisition.Service                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  AcqService (WCF ServiceHost)                                       │    │
│  │  - InstanceContextMode.PerSession                                   │    │
│  │  - ConcurrencyMode.Reentrant                                        │    │
│  │  - 通过 ClientManager 管理回调客户端                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  WorkflowManager (工作流管理)                                        │    │
│  │  - 管理扫描状态 (Start/Stop/CloseScan)                               │    │
│  │  - 协调数据处理器 (DataProcessors)                                   │    │
│  │  - 调用 GBManager 控制硬件连接                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GBManager (硬件连接管理)                                            │    │
│  │  - TCP Socket 连接到 GB (探测器板)                                   │    │
│  │  - 3 个 Channel: Control + Event + Data                             │    │
│  │  - 端口配置来自 ConfigManager.Runtime.IPConfig                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼ TCP Socket (3 个连接)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GB (探测器板) 或 GBSimulator                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Control Channel (命令控制)  - 默认端口 12423                        │    │
│  │  Event Channel (事件通知)                                            │    │
│  │  Data Channel (数据流传输)                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. 启动流程详解

#### Program.cs - Main 方法
```csharp
static void Main(string[] args)
{
    // 1. 监控未处理异常
    MonitorApplicationException();
    
    // 2. 创建 WCF ServiceHost (关键代码)
    var serviceHost = new ServiceHost(typeof(AcqService));
    serviceHost.Open();  // 开始监听 WCF 请求
    
    // 3. 初始化服务组件
    InitService();
    
    Console.ReadLine();  // 阻塞保持运行
    
    // 4. 关闭时清理
    serviceHost.Close();
}
```

#### InitService() - 初始化数据处理器管道
```csharp
private static void InitService()
{
    // 设置 DM (Data Manager) 数量
    DMHelper.SetDMCount(ConfigManager.System.DMNumber);
    
    // 从配置读取 GB 设备地址
    ConfigManagers.GBDeviceAddress = ConfigManager.Runtime.IPConfig.GbIP;
    
    // 创建统计数据处理器
    var statisticsProcessor = new StatisticsProcessor();
    statisticsProcessor.StatisticsUpdated += statistics => 
        ClientManager.NotifyStatistics(...);  // 通过 WCF 回调通知客户端
    
    // 配置数据处理管道 (责任链模式)
    WorkflowManager.Current.DataProcessors = new IDataProcessor[]
    {
        new DataStorageProcessor(),      // 数据存储
        new DataShareProcessor(),        // 内存共享 (给其他进程)
        statisticsProcessor,              // 统计计算
        new SinglesCountProcessor(),      // 单计数处理
        new LogStatisticsProcessor(),     // 日志记录
        new RespiratoryWaveProcessor(),   // 呼吸波处理
        new EcgDataProcessor()            // 心电数据处理
    };
}
```

### 3. WCF 服务配置 (App.config)

```xml
<system.serviceModel>
  <bindings>
    <netTcpBinding>
      <binding name="KeepAliveBinding" 
               receiveTimeout="24.00:00:00"  <!-- 24小时超时 -->
               maxBufferSize="10485760" 
               maxReceivedMessageSize="10485760">
        <security mode="None">  <!-- 无安全认证 -->
          <transport clientCredentialType="None" />
        </security>
      </binding>
    </netTcpBinding>
  </bindings>
  
  <services>
    <service name="Sinogram.Pet.Acquisition.Service.AcqService">
      <!-- 主服务端点 -->
      <endpoint address="" 
                binding="netTcpBinding" 
                bindingConfiguration="KeepAliveBinding"
                contract="Sinogram.Pet.Acquisition.Service.IAcqService" />
      
      <!-- 元数据交换端点 -->
      <endpoint address="mex" 
                binding="mexTcpBinding" 
                contract="IMetadataExchange" />
      
      <host>
        <baseAddresses>
          <!-- WCF 服务监听地址 -->
          <add baseAddress="net.tcp://localhost:8733/Design_Time_Addresses/Sinogram.Pet.Acquisition.Service/AcqService/" />
        </baseAddresses>
      </host>
    </service>
  </services>
</system.serviceModel>
```

**关键配置说明：**
- **协议**: NetTcpBinding（二进制 TCP，性能优于 HTTP）
- **端口**: 8733
- **安全**: None（内网环境）
- **超时**: 24小时（长时间采集不中断）
- **并发**: PerSession + Reentrant（支持回调）

### 4. 上下游连接创建流程

#### 上游连接 (WCF 客户端连接)
```csharp
// AcqService.cs - 当 PDC 客户端连接时
public void Connect()
{
    // 获取回调通道 (双工通信的关键)
    var callbackChannel = OperationContext.Current.GetCallbackChannel<IAcqCallbackService>();
    
    // 注册到 ClientManager
    ClientManager.RegisterClient(callbackChannel);
}

// ClientManager.cs - 管理回调客户端
public static class ClientManager
{
    private static IAcqCallbackService Client { get; set; }
    
    public static void RegisterClient(IAcqCallbackService callbackService)
    {
        Client = callbackService;  // 保存回调引用
    }
    
    // 当数据就绪时，通过回调通知 PDC
    public static void NotifyDataReady(DataSegment segment)
    {
        if (Client != null)
        {
            Client.PushData(segment);  // 服务端主动推送数据
        }
    }
}
```

#### 下游连接 (TCP Socket 到 GB)
```csharp
// GBManager.cs - 打开硬件连接
public static void OpenConnection()
{
    // 从配置读取 IP 地址
    var deviceIP = IPAddress.Parse(DeviceAddress);           // GB IP
    var localAddress = IPAddress.Parse(ControlChannelLocalAddress);  // PDC IP
    
    // 配置 3 个 Channel 的端点
    ChannelManager.DeviceAddress = deviceIP;
    ChannelManager.ControlChannelLocalEndPoint = new IPEndPoint(localAddress, 0);  // 随机端口
    ChannelManager.EventChannelLocalEndPoint = new IPEndPoint(localAddress, 0);
    ChannelManager.DataChannelLocalEndPoint = new IPEndPoint(dataLocalAddress, DataChannelLocalPort);
    
    // 打开所有通道
    ChannelManager.OpenAll();
}
```

### 5. DACP TCP Socket 通信详解

#### 3 个 Channel 的分工

| Channel | 方向 | 用途 | 协议特点 |
|---------|------|------|----------|
| **Control Channel** | PDC ↔ GB | 命令控制 (启动/停止/配置) | 请求-响应，可靠传输 |
| **Event Channel** | GB → PDC | 事件通知 (状态变更) | 单向推送 |
| **Data Channel** | GB → PDC | 原始数据流传输 | 高吞吐，大块数据传输 |

#### GBSimulator 中的实现
```csharp
// SimulatorControlChannel.cs - 控制通道模拟器
public class SimulatorControlChannel : AsyncServerChannel
{
    public const int LocalPort = 12423;  // GB 控制通道默认端口
    
    // 命令处理字典 (命令码 -> 处理函数)
    private readonly Dictionary<DacpCode, Tuple<Delegate, Type, Type>> handlerDic;
    
    public SimulatorControlChannel(IPAddress localAddress)
        : base(new IPEndPoint(localAddress, LocalPort))
    {
        // 注册各种命令处理器
        handlerDic = new Dictionary<DacpCode, Tuple<Delegate, Type, Type>>
        {
            { DacpCode.DbSet5tLtCmd, new Tuple<Delegate, Type, Type>(...) },
            { DacpCode.DbGet5tLtCmd, new Tuple<Delegate, Type, Type>(...) },
            // ... 更多命令
        };
    }
}
```

### 6. 端口配置来源

端口配置来自多个层级：

```csharp
// 1. App.config (本地覆盖)
<add key="DataChannelLocalPort" value="23068"/>

// 2. ConfigManager.Runtime.IPConfig (系统配置)
ConfigManagers.GBDeviceAddress = ConfigManager.Runtime.IPConfig.GbIP;                    // GB IP
ConfigManager.Runtime.IPConfig.PdcIP_PdcToGBControlChannel  // 控制通道本地 IP
ConfigManager.Runtime.IPConfig.PdcIP_PdcToGBDataChannel     // 数据通道本地 IP

// 3. 代码默认值
public const int LocalPort = 12423;  // GBSimulator 控制通道端口
```

### 7. 与 HTTP 的对比

| 特性 | HTTP/REST | WCF NetTcp | DACP TCP Socket |
|------|-----------|------------|-----------------|
| **协议层次** | 应用层 | 传输层+ | 传输层 |
| **序列化** | JSON/XML | 二进制 | 自定义二进制 |
| **连接** | 短连接 | 长连接 (Session) | 长连接 |
| **双向通信** | 轮询/WebSocket | 原生 Duplex | 原生双工 |
| **性能** | 一般 | 高 | 最高 |
| **适用场景** | Web API | 内网服务间通信 | 硬件通信 |

### 总结

1. **Acquisition.Service** 是一个 WCF 服务宿主，监听 TCP 8733 端口
2. **上游**: 通过 WCF 双工与 PDC 通信，支持服务端主动推送
3. **下游**: 通过 3 个 TCP Socket (DACP 协议) 与 GB 硬件通信
4. **数据流**: GB → DataChannel → DataProcessors → WCF Callback → PDC
5. **端口配置**: 主要来自 `ConfigManager.Runtime.IPConfig`，可本地覆盖