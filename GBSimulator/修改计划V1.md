# GBSimulator 运行时配置切换修改计划

## 背景（Context）

用户反馈两个核心问题：
1. **不要使用启动参数来配置** — 目前预设切换、配置文件加载只能通过命令行参数（`Preset=`、`Config=`）实现，需要重启程序
2. **运行时切换 beds 数量，不要重启程序** — 用户需要在程序运行中自由切换床位配置

当前代码中 `DynamicBedViewModel` 已有 `ApplyPreset()`、`LoadFromJsonFile()`、`SaveToJsonFile()` 等完善的业务方法，但缺少 UI 入口来触发它们。这些方法目前仅通过 `GBSimulatorViewModel.ApplyEntryParam()` 在启动时从命令行参数调用。

## 修改方案

### 总体思路

在 `DynamicBedControl` 界面中增加预设下拉框和配置加载/保存按钮，复用已有的业务方法，实现运行时床位配置切换。**最小化改动，只涉及 3 个文件。**

---

### 修改 1: `ViewModel/DynamicBedViewModel.cs`

**新增属性：**

1. `AvailablePresets` — 静态预设列表，供 ComboBox 绑定
```csharp
public static List<string> AvailablePresets { get; } = new List<string>
{
    "Default (6 beds)",
    "AdultWholeBody (6 beds)",
    "AdultCardiac (1 bed)",
    "AdultBrain (1 bed)",
    "Head (4 beds)",
    "Phantom (1 bed)"
};
```

2. `SelectedPreset` — 当前选中的预设，setter 中触发 `ApplySelectedPreset()`
   - 切换时调用已有的 `ApplyPreset()` 或 `InitializeDefaultBeds()`
   - 加载 JSON 配置文件后清空此项（因为不再匹配任何预设）

3. `CanModifyConfiguration` — 控制是否允许修改配置（通道打开时禁止）

**新增命令（约第 92 行附近）：**
- `LoadConfigCommand` → 打开 `OpenFileDialog`，调用已有 `LoadFromJsonFile()`
- `SaveConfigCommand` → 打开 `SaveFileDialog`，调用已有 `SaveToJsonFile()`

**CanExecute 守卫：** 两个新命令和预设切换都受 `CanModifyConfiguration` 控制

### 修改 2: `Views/DynamicBedControl.xaml`

在现有标题栏区域增加第二行，包含：
- 预设选择 `ComboBox`（绑定 `AvailablePresets` 和 `SelectedPreset`）
- "Load Config" 按钮（绑定 `LoadConfigCommand`）
- "Save Config" 按钮（绑定 `SaveConfigCommand`）

现有第一行（标题 + 添加/删除/清除按钮）不变。

### 修改 3: `ViewModel/GBSimulatorViewModel.cs`

在 `UIControlEnableOrDisable` 属性的 setter 中同步 `CanModifyConfiguration`：
- 通道打开时（`UIControlEnableOrDisable = false`）→ `DynamicBedVm.CanModifyConfiguration = false`
- 通道关闭时（`UIControlEnableOrDisable = true`）→ `DynamicBedVm.CanModifyConfiguration = true`

这是此文件唯一需要修改的地方（约第 143-148 行）。

### 不修改的文件

- `App.xaml.cs` — CLI 参数解析保持不变，向后兼容
- `GBSimulatorEntryParameters.cs` — 不变
- `MainWindow.xaml` / `MainWindow.xaml.cs` — DynamicBedControl 已嵌入其中，自动生效
- `BedViewModel.cs` — 不变
- `Configuration/BedConfiguration.cs` — 不变

---

## 复用已有方法

| 方法 | 位置 | 用途 |
|------|------|------|
| `ApplyPreset(name)` | `DynamicBedViewModel.cs:227` | 预设切换 |
| `InitializeDefaultBeds()` | `DynamicBedViewModel.cs:157` | 默认 6 床位 |
| `LoadFromJsonFile(path)` | `DynamicBedViewModel.cs:255` | 加载 JSON 配置 |
| `SaveToJsonFile(path)` | `DynamicBedViewModel.cs:281` | 保存 JSON 配置 |
| `ValidateAllEnabledBedsHaveFiles()` | `DynamicBedViewModel.cs:329` | 已有验证逻辑 |

---

## 验证步骤

1. **编译通过** — 确保所有绑定和新增代码无编译错误
2. **默认启动** — 无命令行参数启动，显示默认 6 床位，ComboBox 为空
3. **预设切换** — 从 ComboBox 选择不同预设，床位数量和名称实时更新
4. **保存配置** — 点击 Save Config，选择路径保存，检查 JSON 内容正确
5. **加载配置** — 点击 Load Config，选择之前保存的文件，床位正确加载，ComboBox 清空
6. **通道保护** — 点击 Open channels 后，预设 ComboBox 和 Load/Save 按钮均灰化禁用；Close channels 后恢复
7. **CLI 兼容** — 使用 `Preset=adultcardiac` 等命令行参数启动，仍正确初始化
