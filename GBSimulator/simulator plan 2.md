
## 一、GBSimulator 实现原理详解

### 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    GBSimulator (WPF应用)                      │
├─────────────────────────────────────────────────────────────┤
│  MainWindow.xaml          - UI界面，6个床位文件选择框          │
│  MainWindow.xaml.cs       - 窗口事件处理                     │
│  App.xaml.cs              - 应用程序入口，参数解析             │
├─────────────────────────────────────────────────────────────┤
│  GBSimulatorViewModel     - 核心ViewModel，业务逻辑          │
│  GBSimulatorEntryParameters - 命令行参数解析                  │
│  RealtimeStatsCollector   - 实时统计信息收集                  │
├─────────────────────────────────────────────────────────────┤
│  SimulatorControlChannel  - 控制通道(端口12423)              │
│  SimulatorDataChannel     - 数据通道(TCP/UDP)                │
│  SimulatorEventChannel    - 事件通道(状态上报)                │
│  SimulatorMonitorChannel  - 监控通道(端口61024)              │
│  ChannelController        - 通道管理器                       │
└─────────────────────────────────────────────────────────────┘
```

### 2. 核心数据流

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  ListMode    │────▶│  FileStream读取  │────▶│ 16MB数据包   │
│  文件(.lm)   │     │ (1GB buffer)     │     │ (PacketData) │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                                                     │
                              ┌──────────────────────┘
                              ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   客户端     │◀────│  DataChannel     │◀────│ DacpDataPacket│
│  (PDC服务)   │     │  (TCP Socket)    │     │ (ListMode格式)│
└──────────────┘     └──────────────────┘     └──────────────┘
```

### 3. 关键代码解析

#### 3.1 床位文件管理
```csharp
// GBSimulatorViewModel.cs
private ObservableCollection<string> listModeDataFilePath;
public ObservableCollection<string> ListModeDataFilePath { get; set; }

// 当前支持的床位数量（硬编码为6个）
private static int userControlBedNumber = 5;  // 0-5 共6个床位

// 选择文件对话框
private void SelectBedPosition_ListModeFilePath()
{
    System.Windows.Forms.OpenFileDialog folderBrowserDialog1 = 
        new System.Windows.Forms.OpenFileDialog();
    // ...
}
```

#### 3.2 数据发送流程
```csharp
// ReadandSendListModeDataFile - 连续读取文件并发送
private void ReadandSendListModeDataFile()
{
    // 1GB读取缓冲区
    byte[] readData = new byte[1024 * 1024 * 1024];
    // 16MB发送包
    byte[] lmData = new byte[PacketDataLength];
    
    using (fsr = new FileStream(ListModeDataFilePath[currentShouldBeSendBedPos - 1], ...))
    {
        // 每次读取1GB，分成64个16MB包发送
        for (int i = 0; i < 64; i++)
        {
            index = i * PacketDataLength;
            Array.Copy(readData, index, lmData, 0, PacketDataLength);
            
            dataPacket = new DacpDataPacket(DacpDataFormat.ListMode, 
                AlreadySendPackageNumber, lmData);
            DataChannel.SendPacket(dataPacket);
        }
    }
}
```

#### 3.3 发送模式
```csharp
public enum SendMode
{
    ContinuouslyReadFileAndSend,  // 持续读取文件发送
    ReadOnceThenSendFromMemory,   // 读取一次后从内存循环发送
}
```

#### 3.4 命令行参数
```csharp
// 当前支持的参数
BedPositionFiles=bp1.lm,bp2.lm,bp3.lm  // 床位文件路径
AllSendSameFile=true/false             // 是否所有床位发送相同文件
ExcpectedSpeed=100                     // 期望传输速度(MB/s)
AutoLaunch=true/false                  // 是否自动启动
WindowVisible=true/false               // 窗口是否可见
```

---

## 二、新需求设计方案

### 需求1：根据传入参数动态加载床位信息

**当前问题：**
- 床位数量固定为6个（硬编码）
- 文件路径通过UI选择或简单命令行参数传入

**设计方案：**

```
┌─────────────────────────────────────────────────────────────┐
│                 动态床位配置加载系统                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  方案A: JSON配置文件                                         │
│  ─────────────────                                          │
│  {                                                          │
│    "bedCount": 8,                                           │
│    "beds": [                                                │
│      {"id": 1, "name": "Head", "file": "head.lm"},          │
│      {"id": 2, "name": "Chest", "file": "chest.lm"},        │
│      ...                                                    │
│    ]                                                        │
│  }                                                          │
│                                                             │
│  方案B: 命令行参数扩展                                       │
│  ─────────────────                                          │
│  GBSimulator.exe /config:beds.json                          │
│  或                                                         │
│  GBSimulator.exe /beds:8 /bed1:head.lm /bed2:chest.lm ...   │
│                                                             │
│  方案C: 动态UI生成                                          │
│  ─────────────────                                          │
│  根据配置动态生成N个床位选择框，而非固定6个                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 需求2：根据特定规则加载不同预置数据

**设计方案：**

```
┌─────────────────────────────────────────────────────────────┐
│                  规则引擎 + 数据加载器                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 规则定义                                                │
│  ───────────                                                │
│  interface ILoadRule {                                      │
│    bool Matches(ScanContext context);                       │
│    BedConfiguration GetConfiguration();                     │
│  }                                                          │
│                                                             │
│  2. 预置规则示例                                            │
│  ───────────────                                            │
│  - PatientTypeRule: 根据患者类型(成人/儿童/小动物)加载       │
│  - ScanTypeRule: 根据扫描类型(全身/局部/心脏)加载            │
│  - EnergyRule: 根据能量设置加载不同数据                      │
│  - CustomRule: 用户自定义规则                                │
│                                                             │
│  3. 数据预置库                                              │
│  ─────────────                                              │
│  /PresetData/                                               │
│    ├── Adult/                                               │
│    │   ├── WholeBody/                                       │
│    │   ├── Cardiac/                                         │
│    │   └── Brain/                                           │
│    ├── Pediatric/                                           │
│    └── Phantom/                                             │
│                                                             │
│  4. 运行时选择                                              │
│  ─────────────                                              │
│  命令行: /rule:Cardiac /patientType:Adult                   │
│  或自动根据控制通道命令选择                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、详细实施计划
        
            
toolName: todo_write
            
status: success
          
Todos updated: 11 items
          
### Phase 1: 创建动态床位配置系统

**新增文件：**

1. **BedConfiguration.cs** - 床位配置模型
```csharp
public class BedConfiguration
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string FilePath { get; set; }
    public BedType Type { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}

public class SimulatorConfiguration
{
    public int BedCount { get; set; }
    public List<BedConfiguration> Beds { get; set; }
    public string DefaultDataFolder { get; set; }
    public SendMode DefaultSendMode { get; set; }
}
```

2. **ConfigurationLoader.cs** - 配置加载器
```csharp
public interface IConfigurationLoader
{
    SimulatorConfiguration Load(string source);
}

public class JsonConfigurationLoader : IConfigurationLoader
{
    public SimulatorConfiguration Load(string filePath)
    {
        var json = File.ReadAllText(filePath);
        return JsonConvert.DeserializeObject<SimulatorConfiguration>(json);
    }
}

public class CommandLineConfigurationLoader : IConfigurationLoader
{
    public SimulatorConfiguration Load(string args)
    {
        // 解析命令行参数
    }
}
```

### Phase 2: 重构GBSimulatorViewModel

**修改点：**

1. 移除硬编码的6个床位限制
2. 使用动态集合替代固定数组
3. 修改文件读取逻辑支持可变床位

```csharp
// 修改前
private static int userControlBedNumber = 5;
private ObservableCollection<string> listModeDataFilePath;

// 修改后
private ObservableCollection<BedViewModel> beds;
public ObservableCollection<BedViewModel> Beds 
{ 
    get { return beds; } 
    set { beds = value; RaisePropertyChanged(() => Beds); }
}

public class BedViewModel
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string FilePath { get; set; }
    public bool IsEnabled { get; set; }
    public bool IsSelected { get; set; }
}
```

### Phase 3: 创建规则引擎

**新增文件：**

1. **ILoadRule.cs** - 规则接口
```csharp
public interface ILoadRule
{
    string Name { get; }
    string Description { get; }
    int Priority { get; }
    bool Matches(ScanContext context);
    BedConfiguration[] GetBedConfigurations();
}
```

2. **RuleEngine.cs** - 规则引擎
```csharp
public class RuleEngine
{
    private List<ILoadRule> rules = new List<ILoadRule>();
    
    public void RegisterRule(ILoadRule rule) => rules.Add(rule);
    
    public ILoadRule FindMatchingRule(ScanContext context)
    {
        return rules.Where(r => r.Matches(context))
                    .OrderByDescending(r => r.Priority)
                    .FirstOrDefault();
    }
}
```

3. **内置规则实现**
```csharp
// 患者类型规则
public class PatientTypeRule : ILoadRule
{
    public string Name => "PatientType";
    public PatientType ExpectedType { get; set; }
    
    public bool Matches(ScanContext context)
    {
        return context.PatientType == ExpectedType;
    }
    
    public BedConfiguration[] GetBedConfigurations()
    {
        // 返回对应患者类型的预置配置
    }
}
```

### Phase 4: 创建预置数据管理器

**新增文件：**

1. **PresetDataManager.cs**
```csharp
public class PresetDataManager
{
    private string basePath;
    
    public PresetDataManager(string presetDataFolder)
    {
        basePath = presetDataFolder;
    }
    
    // 获取所有预置场景
    public List<PresetScenario> GetAvailableScenarios();
    
    // 根据规则加载对应数据文件路径
    public string[] GetDataFilesForRule(ILoadRule rule);
    
    // 复制预置数据到临时目录
    public string[] PrepareDataFiles(ILoadRule rule);
}

public class PresetScenario
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string[] DataFiles { get; set; }
    public ScanContext Context { get; set; }
}
```

### Phase 5: 动态UI生成

**修改 MainWindow.xaml：**

```xml
<!-- 修改前：固定6个床位 -->
<TextBox x:Name="BedPosFilePath1" .../>
<TextBox x:Name="BedPosFilePath2" .../>
...

<!-- 修改后：动态生成 -->
<ItemsControl ItemsSource="{Binding Beds}">
    <ItemsControl.ItemTemplate>
        <DataTemplate>
            <StackPanel Orientation="Horizontal">
                <TextBlock Text="{Binding Name}"/>
                <TextBox Text="{Binding FilePath}"/>
                <Button Content="Browse" Command="{Binding SelectFileCommand}"/>
            </StackPanel>
        </DataTemplate>
    </ItemsControl.ItemTemplate>
</ItemsControl>
```

### Phase 6: 命令行参数扩展

**扩展 GBSimulatorEntryParameters：**

```csharp
class GBSimulatorEntryParameters
{
    // 原有参数
    public List<string> BedPositionFiles { get; set; }
    
    // 新增参数
    public string ConfigurationFile { get; set; }      // /config:path.json
    public string RuleName { get; set; }               // /rule:Cardiac
    public string PatientType { get; set; }            // /patient:Adult
    public string ScanType { get; set; }               // /scan:WholeBody
    public string PresetScenario { get; set; }         // /preset:Adult_Cardiac
    public int? DynamicBedCount { get; set; }          // /beds:8
    
    public static GBSimulatorEntryParameters ParseFromArgs(string[] args)
    {
        // 扩展解析逻辑
    }
}
```

---

## 四、配置文件示例

### 完整配置示例 (config.json)

```json
{
  "simulator": {
    "bedCount": 8,
    "defaultSendMode": "ContinuouslyReadFileAndSend",
    "expectedSpeed": 100,
    "autoLaunch": false,
    "windowVisible": true
  },
  "beds": [
    { "id": 1, "name": "Head", "type": "Head" },
    { "id": 2, "name": "Neck", "type": "Neck" },
    { "id": 3, "name": "Chest", "type": "Chest" },
    { "id": 4, "name": "Abdomen", "type": "Abdomen" },
    { "id": 5, "name": "Pelvis", "type": "Pelvis" },
    { "id": 6, "name": "Legs", "type": "Legs" },
    { "id": 7, "name": "Feet", "type": "Feet" },
    { "id": 8, "name": "WholeBody", "type": "WholeBody" }
  ],
  "rules": [
    {
      "name": "AdultWholeBody",
      "condition": { "patientType": "Adult", "scanType": "WholeBody" },
      "dataFiles": ["adult_wb_bp1.lm", "adult_wb_bp2.lm", "adult_wb_bp3.lm"]
    },
    {
      "name": "PediatricBrain",
      "condition": { "patientType": "Pediatric", "scanType": "Brain" },
      "dataFiles": ["peds_brain.lm"]
    }
  ],
  "presets": {
    "basePath": "C:\\ProgramData\\GBSimulator\\Presets",
    "scenarios": [
      {
        "id": "adult_cardiac",
        "name": "Adult Cardiac",
        "description": "Standard adult cardiac scan",
        "bedCount": 1,
        "dataFiles": ["cardiac_adult.lm"]
      }
    ]
  }
}
```

---

## 五、使用示例

### 场景1：使用配置文件启动
```bash
GBSimulator.exe /config:C:\Configs\8beds.json
```

### 场景2：使用规则自动加载
```bash
GBSimulator.exe /rule:AdultWholeBody /patient:Adult /scan:WholeBody
```

### 场景3：动态指定床位数量
```bash
GBSimulator.exe /beds:10 /preset:Research_10bed
```

### 场景4：混合模式
```bash
GBSimulator.exe /config:base.json /rule:Custom /overrideBed1:custom1.lm
```

---

您希望我按照哪个Phase开始实施？或者您有特定的优先级要求吗？