## WCF 双工通信（Duplex）详解

你看到的 `AcqServiceClient` 和 `CallbackService` 是 **WCF 双工通信（Duplex Communication）** 的典型用法。这与 HTTP 请求-响应模式有很大不同。

### 1. 两个对象的作用

```csharp
public AcqServiceClient AcqClient { get; private set; }      // 客户端代理 - 用于调用服务
public CallbackService AcqCallback { get; private set; }      // 回调服务 - 用于接收服务端推送
```

| 对象 | 作用 | 通信方向 |
|------|------|----------|
| `AcqClient` | 客户端代理，调用服务端方法 | 客户端 → 服务端 |
| `AcqCallback` | 回调服务实例，接收服务端主动推送 | 服务端 → 客户端 |

### 2. 与 HTTP 的关键区别

| 特性 | HTTP/REST | WCF 双工 |
|------|-----------|----------|
| 通信模式 | 请求-响应（单向） | 双向（客户端可调用服务，服务也可回调客户端） |
| 连接 | 无状态，每次请求新建连接 | 有状态，长连接（Session） |
| 服务端推送 | 需要轮询或 WebSocket | 原生支持回调 |
| 协议 | HTTP | NetTcp（二进制，性能更好）或 HTTP |

### 3. 代码中的具体用法

#### 建立连接（带回调）
```csharp
public bool CreateConnection()
{
    // 1. 创建回调服务实例
    AcqCallback = new CallbackService();
    
    // 2. 创建双工客户端，传入回调上下文
    AcqClient = new AcqServiceClient(new InstanceContext(AcqCallback));
    
    // 3. 打开连接
    AcqClient.Open();
    AcqClient.Connect();
    
    // 4. 订阅通道错误事件
    AcqClient.InnerChannel.Faulted += InnerChannel_Faulted;
}
```

#### 调用服务端方法（客户端 → 服务端）
```csharp
public void StartAcquisition(int bedPosition, int duration, bool enableWave)
{
    AcqCall(() =>
    {
        AcqClient.StartAcquisition(bedPosition, duration, enableWave);  // 调用服务方法
    });
}
```

#### 接收服务端回调（服务端 → 客户端）
在 `CallbackService.cs` 中：
```csharp
public class CallbackService : IAcqServiceCallback
{
    public event Action<DataSegment> DataReceived;  // 数据接收事件
    
    // 服务端主动调用此方法推送数据
    public void PushData(DataSegment segment)
    {
        if (DataReceived != null)
        {
            DataReceived(segment);  // 触发事件，通知上层
        }
    }
    
    // 其他回调方法...
    public void NotifyBedPositionDataCompleted(long seriesID, int bedPosition) { ... }
    public void PushStatistics(StatisticsData statistics) { ... }
}
```

### 4. 为什么用双工通信？

在 PET-CT 采集场景中：
- **客户端**需要发送命令（开始采集、停止采集、设置参数）
- **服务端**需要实时推送数据（原始数据块、统计信息、状态变更）

如果用 HTTP：
- 客户端需要不断轮询（Polling）检查是否有新数据
- 延迟高，效率低

用 WCF 双工：
- 服务端有数据时立即通过回调推送
- 实时性好，效率高

### 5. 服务契约定义

```csharp
[ServiceContract(
    CallbackContract = typeof(IAcqServiceCallback),  // 指定回调契约
    SessionMode = SessionMode.Required               // 需要会话（长连接）
)]
public interface IAcqService 
{
    // 服务端方法...
}

public interface IAcqServiceCallback
{
    // 回调方法，由服务端调用...
    void PushData(DataSegment segment);
    void PushStatistics(StatisticsData statistics);
}
```

### 6. 心跳机制

代码中还有心跳（HeartBeat）机制，用于保持连接：
```csharp
public void StartHeartBeat()
{
    // 每 10 秒发送一次心跳
    // 如果连接断开，触发重连逻辑
}
```

### 总结

- `AcqServiceClient`：像 HTTP 客户端一样调用远程方法，但保持长连接
- `CallbackService`：让服务端能够"反向调用"客户端，实现实时推送
- 这种模式特别适合需要**实时双向通信**的场景（如医疗设备数据采集）