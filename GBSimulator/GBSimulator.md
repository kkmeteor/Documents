## StartScan 方法实现分析

根据代码分析，`ScanProcessConsoleViewModel` 中的 `StartScan` 方法是一个调度器，它根据当前扫描任务的类型（Scout、CT、PET）来启动相应的扫描流程。以下是详细的执行流程：

### 1. 入口方法 - StartScan

[ScanProcessConsoleViewModel.cs:L378-L420](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Console.ViewModel/ViewModels/Exam/ScanProcessConsoleViewModel.cs#L378-L420)

```csharp
public void StartScan()
{
    if (!CanStartScan()) return;
    
    StatusMessageManager.Current.PatientName = ExamPatientViewModel.PatientName;
    var workingScanJob = GetCurrentWorkingScanJob();

    if (workingScanJob != null)
    {
        if (workingScanJob.CurrentState == ProcedureState.NotStarted)
        {
            // 订阅扫描任务状态变更事件
            workingScanJob.UpdateMessageForScanProcess += UpdateMessageForScanProcess;
            
            // 记录日志
            PetLogger.PetScanInfo("开始扫描");
            
            // 根据任务类型记录不同的操作日志
            if (workingScanJob is ScoutScanJobViewModel) { ... }
            else if (workingScanJob is CTScanJobViewModel) { ... }
            else if (workingScanJob is PetScanJobViewModel) 
            {
                PetLogger.OperationLog("PET " + ...);
                ECBCTXRAYManager.SendToGB_XRAY_OFF();  // 关闭X射线
            }
            
            // 关键调用：加载并开始扫描
            workingScanJob.Load();
        }
        else if (workingScanJob.CurrentState == ProcedureState.ScanDelaying)
        {
            // 处理延迟扫描的情况
            petJob.SkipDelay();
        }

        workingScanJob.StateChanged += workingScanJob_StateChanged;
    }
}
```

### 2. 扫描任务基类 Load 方法

[ScanJobViewModelBase.cs:L430-L450](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.Console.ViewModel/ViewModels/Exam/ScanJobViewModelBase.cs#L430-L450)

```csharp
public virtual void Load()
{
    if (scanProcedure == null || ExamPatientViewModel.CurrentStudy == null)
        return;

    if (!CheckBedHeight()) return;

    this.EnableLoad = false;
    RaiseBeforeLoad();
    
    Start();  // 调用Start方法
    
    HadScan = true;
}

public virtual void Start()
{
    Scan = CreateScan();
    ScanProcedure.InitByScan(Scan);  // 初始化扫描过程
    ScanProcedure.Start();           // 开始扫描过程
}
```

### 3. PET 扫描过程实现 (PetScanProcedure)

[PetScanProcedure.cs:L115-L145](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.BizLogic/Scan/PetScanProcedure.cs#L115-L145)

```csharp
public void Start()
{
    IsCancelScanNoMoveBed = true;
    UpdateDescription("Loading");
    SubscribeEvent();  // 订阅各种事件
    
    // 在新线程中启动扫描流程
    StartFirstBedPositionScanAsync();
}
```

### 4. 异步扫描流程

[PetScanProcedure.cs:L220-L280](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.BizLogic/Scan/PetScanProcedure.cs#L220-L280)

```csharp
private void StartFirstBedPositionScanAsync()
{
    var thread = new Thread(() =>
    {
        // 1. 切换到PET显示模式
        SwitchPanelToPetMode();
        
        // 2. 移动到起始位置
        MoveToStartPosition();
        
        // 3. 等待用户按下开始扫描按钮
        EnablePetStartScanAndWaitForPress();
        
        // 4. 等待延迟（如果有）
        WaitForDelay();
        
        // 5. 开始第一个床位扫描
        StartFirstScan();
    });
    thread.Start();
    NotifyChanged(ProcedureState.Loading);
}
```

### 5. 硬件通信 - 实际启动扫描

[PetScanProcedure.cs:L305-L315](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.BizLogic/Scan/PetScanProcedure.cs#L305-L315)

```csharp
private void StartFirstScan()
{
    var petScan = CurrentScan as PetScan;
    NotifyChanged(ProcedureState.Scaning);
    
    // 调用 PetScanManager 启动扫描
    PetScanManager.Instance.StartScan(petScan.ID);
    isScanAcqStarted = true;
}
```

### 6. PetScanManager - 硬件通信层

[PetScanManager.cs:L75-L90](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.BizLogic/Scan/PetScanManager.cs#L75-L90)

```csharp
public void StartScan(long seriesId)
{
    var commandData = new StartScanCommandData()
    {
        SeriesId = seriesId,
        Description = "Start scan."                
    };

    // 通过WCF向PDC服务发送启动扫描命令
    var response = PdcClient.PdcConnector.Instance.ControlClient.StartScan(commandData);
    UpdateDescription(response.Data.Description);
    UpdateStatus(ProcedureState.Scaning);
}
```

### 7. WCF 通信代理

[PdcControlServiceProxy.cs:L45-L55](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.BizLogic.PdcClient/PdcControlServiceProxy.cs#L45-L55)

```csharp
private static PdcControlServiceClient CreateClient()
{
    string name = "PdcControlService";
    // PDC服务地址，通过IP配置连接
    string address = string.Format("http://{0}:8080/Sinogram.Pet.Pdc.Service/PdcControlService/", 
        ConfigManager.Runtime.IPConfig.PdcIP_PdcToOc);
    PdcControlServiceClient client = new PdcControlServiceClient(name, address);
    client.Open();
    return client;
}
```

### 8. 数据接收流程

扫描过程中，PDC服务通过消息回调返回数据：

[PetScanManager.cs:L165-L200](file:///d:/CODE/S2%20main/Console/Sinogram.Pet.BizLogic/Scan/PetScanManager.cs#L165-L200)

```csharp
// 在构造函数中注册消息处理器
private PetScanManager()
{
    PdcClient.PdcConnector.Instance.NotificationHandler.AttachMessageHandler(
        MessageType.CurrentProgress, SetProgress);
    PdcClient.PdcConnector.Instance.NotificationHandler.AttachMessageHandler(
        MessageType.ScanStatistics, UpdateStatistics);
    PdcClient.PdcConnector.Instance.NotificationHandler.AttachMessageHandler(
        MessageType.BedPosition, UpdateBedPosition);
}

// 处理进度消息
private void SetProgress(object sender, EventArgs args)
{
    var pdcArgs = args as PdcMessageEventArgs;
    var data = pdcArgs.message.Data as CurrentProgressMessageData;
    
    UpdateProgress(new ScanProgress()
    {
        PecentageProgress = data.PecentageProgress,
        ProgressRemaningTimeInMilliSeconds = data.RemainingTimeInMilliSeconds,
        TotalRemaningTimeInMilliSeconds = data.RemainingTotalBedPositionTimeInMilliSeconds
    });
}
```

---

## 总结流程图

```
StartScan() [ViewModel层]
    ↓
workingScanJob.Load()
    ↓
ScanProcedure.Start() [BizLogic层]
    ↓
PetScanManager.Instance.StartScan(seriesId)
    ↓
PdcConnector.Instance.ControlClient.StartScan(commandData) [通信层]
    ↓
WCF调用 → PDC服务 (http://PDC_IP:8080/...)
    ↓
硬件控制器 → 实际PET设备
    ↓
数据返回 ← 消息回调机制
    ↓
UpdateProgress/UpdateStatistics/UpdateBedPosition...
```

整个架构采用分层设计：
- **ViewModel层**: 处理用户交互和状态管理
- **BizLogic层**: 处理扫描业务逻辑和流程控制  
- **通信层**: 通过WCF与PDC服务通信，采用双工模式（命令发送+消息回调）