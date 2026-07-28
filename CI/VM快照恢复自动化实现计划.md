# VM 快照恢复自动化实现计划

> 适用项目：.NET 4.5 CS 架构 Windows 绑定产品  
> 目标：CI/CD Pipeline 中自动恢复 VM 快照、部署安装包、执行测试、收集结果

---

## 一、整体架构

```
CI Server (Jenkins / Azure DevOps)
    │
    ├── 1. Build 编译 ──→ 产出安装包 (.msi / .exe)
    │
    ├── 2. 代码扫描 ──→ SonarQube 分析
    │
    └── 3. VM 自动化部署测试
         │
         ├── 3.1 恢复 VM 快照（Hyper-V PowerShell）
         ├── 3.2 等待 VM 启动就绪
         ├── 3.3 复制安装包到 VM（WinRM / 共享文件夹）
         ├── 3.4 远程执行静默安装
         ├── 3.5 远程执行自动化测试
         ├── 3.6 收集测试结果和日志
         └── 3.7 还原快照（可选，确保下次干净）
```

---

## 二、前置条件

### 2.1 硬件与软件要求

| 组件 | 要求 |
|------|------|
| **宿主机 OS** | Windows Server 2016+ 或 Windows 10/11 Pro/Enterprise |
| **Hyper-V** | 已启用 Hyper-V 角色 |
| **VM 操作系统** | Windows 7/10/11 或 Windows Server 2012R2+（匹配目标运行环境） |
| **PowerShell** | 5.1+（Windows 自带） |
| **WinRM** | VM 内已启用并配置（用于远程命令执行） |
| **磁盘空间** | 每个 VM 快照约占 10-30GB，预留足够空间 |

### 2.2 VM 初始准备

在创建快照前，VM 需要完成以下配置：

- [x] 安装目标操作系统并完成 Windows Update
- [x] 安装 .NET Framework 4.5 及所需依赖
- [x] 启用 WinRM 远程管理
- [x] 配置 PowerShell ExecutionPolicy 为 RemoteSigned
- [x] 关闭 Windows 防火墙对 WinRM 的阻止（或放行 5985/5986 端口）
- [x] 安装自动化测试运行时（如 FlaUI、NUnit Console Runner）
- [x] 创建 CI 专用本地管理员账户（如 `ciagent`）
- [x] 关闭 UAC 远程限制（LocalAccountTokenFilterPolicy = 1）

### 2.3 创建基础快照

```powershell
# 在 Hyper-V 宿主机上执行
$vmName = "CI-Test-Win10"
Checkpoint-VM -VMName $vmName -SnapshotName "Base-Clean"
```

---

## 三、脚本模块详细设计

### 3.1 模块总览

```
C:\CI\Scripts\
├── Config.ps1                    # 全局配置（VM名称、IP、凭据等）
├── VM-SnapshotRestore.ps1        # 快照恢复
├── VM-WaitForReady.ps1           # 等待 VM 启动就绪
├── VM-CopyArtifact.ps1           # 复制安装包到 VM
├── VM-RemoteInstall.ps1          # 远程静默安装
├── VM-RemoteTest.ps1             # 远程执行测试
├── VM-CollectResults.ps1         # 收集测试结果
├── VM-Cleanup.ps1                # 清理/还原快照
└── Pipeline-Runner.ps1           # 主管线编排脚本
```

---

### 3.2 Config.ps1 — 全局配置

```powershell
# ============================================================
# CI/CD VM Automation - 全局配置
# ============================================================

# VM 配置
$script:VM_NAME = "CI-Test-Win10"
$script:VM_SNAPSHOT_NAME = "Base-Clean"
$script:VM_IP = "192.168.1.100"

# 远程凭据（CI Agent 账户）
$script:VM_USERNAME = "ciagent"
$script:VM_PASSWORD = "P@ssw0rd!"  # 生产环境请使用 Windows Credential Store

# 构建产物路径
$script:ARTIFACT_PATH = "C:\Build\Output\Setup.msi"

# VM 内目标路径
$script:VM_INSTALLER_DIR = "C:\CI\Installers"
$script:VM_INSTALL_LOG_DIR = "C:\CI\Logs"
$script:VM_TEST_RESULT_DIR = "C:\CI\TestResults"

# 超时设置（秒）
$script:VM_BOOT_TIMEOUT = 120
$script:INSTALL_TIMEOUT = 300
$script:TEST_TIMEOUT = 1800

# 日志
$script:LOG_DIR = "C:\CI\Logs\Pipeline"
```

---

### 3.3 VM-SnapshotRestore.ps1 — 快照恢复

**功能**：将 VM 恢复到指定快照，确保每次测试从干净环境开始。

```powershell
# ============================================================
# 模块：VM 快照恢复
# 输入：VM名称、快照名称
# 输出：恢复成功/失败
# ============================================================

function Restore-VMSnapshot {
    param(
        [string]$VMName = $script:VM_NAME,
        [string]$SnapshotName = $script:VM_SNAPSHOT_NAME
    )

    # 1. 检查 VM 是否存在
    $vm = Get-VM -Name $VMName -ErrorAction SilentlyContinue
    if (-not $vm) {
        throw "VM '$VMName' 不存在"
    }

    # 2. 检查快照是否存在
    $snapshot = Get-VMSnapshot -VMName $VMName -Name $SnapshotName -ErrorAction SilentlyContinue
    if (-not $snapshot) {
        throw "快照 '$SnapshotName' 不存在于 VM '$VMName'"
    }

    # 3. 如果 VM 正在运行，先关闭
    if ($vm.State -eq 'Running') {
        Write-Host "正在关闭 VM '$VMName'..."
        Stop-VM -Name $VMName -Force
        $timeout = 60
        while ((Get-VM -Name $VMName).State -ne 'Off' -and $timeout -gt 0) {
            Start-Sleep -Seconds 1
            $timeout--
        }
        if ((Get-VM -Name $VMName).State -ne 'Off') {
            Stop-VM -Name $VMName -TurnOff -Force
            Start-Sleep -Seconds 2
        }
    }

    # 4. 恢复快照
    Write-Host "正在恢复快照 '$SnapshotName'..."
    Restore-VMSnapshot -VMName $VMName -Name $SnapshotName -Confirm:$false

    # 5. 启动 VM
    Write-Host "正在启动 VM '$VMName'..."
    Start-VM -Name $VMName

    Write-Host "快照恢复完成，VM 已启动"
    return $true
}
```

**关键点**：
- 必须先关闭 VM 才能恢复快照（`Restore-VMSnapshot` 要求 VM 处于 Off 状态）
- 使用 `-Force` 关闭，超时则用 `-TurnOff` 强制断电
- 恢复后自动启动 VM

---

### 3.4 VM-WaitForReady.ps1 — 等待 VM 就绪

**功能**：VM 启动后，等待操作系统和 WinRM 服务完全就绪。

```powershell
# ============================================================
# 模块：等待 VM 启动就绪
# 检测项：Ping 通 → WinRM 可连接 → PowerShell 远程会话可用
# ============================================================

function Wait-VMReady {
    param(
        [string]$VMIP = $script:VM_IP,
        [string]$Username = $script:VM_USERNAME,
        [string]$Password = $script:VM_PASSWORD,
        [int]$TimeoutSeconds = $script:VM_BOOT_TIMEOUT
    )

    $startTime = Get-Date
    $cred = New-Object System.Management.Automation.PSCredential(
        $Username,
        (ConvertTo-SecureString $Password -AsPlainText -Force)
    )

    Write-Host "等待 VM ($VMIP) 启动就绪（超时 ${TimeoutSeconds}s）..."

    # 阶段1：等待 Ping 通
    Write-Host "  [1/3] 等待网络可达..."
    while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSeconds) {
        if (Test-Connection -ComputerName $VMIP -Count 1 -Quiet) {
            Write-Host "  [1/3] 网络可达 ✓"
            break
        }
        Start-Sleep -Seconds 3
    }

    # 阶段2：等待 WinRM 端口开放
    Write-Host "  [2/3] 等待 WinRM 服务..."
    while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSeconds) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect($VMIP, 5985)
            $tcp.Close()
            Write-Host "  [2/3] WinRM 端口可达 ✓"
            break
        } catch {
            Start-Sleep -Seconds 3
        }
    }

    # 阶段3：验证 PowerShell 远程会话
    Write-Host "  [3/3] 验证远程会话..."
    while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSeconds) {
        try {
            $session = New-PSSession -ComputerName $VMIP -Credential $cred -ErrorAction Stop
            Remove-PSSession $session
            Write-Host "  [3/3] 远程会话可用 ✓"
            Write-Host "VM 就绪！耗时 $([math]::Round(((Get-Date) - $startTime).TotalSeconds, 1))s"
            return $true
        } catch {
            Start-Sleep -Seconds 5
        }
    }

    throw "VM 启动超时（${TimeoutSeconds}s）"
}
```

**关键点**：
- 三阶段检测：Ping → WinRM 端口 → PowerShell 会话
- 每阶段独立等待，避免误判
- 总超时统一计算

---

### 3.5 VM-CopyArtifact.ps1 — 复制安装包

**功能**：将构建产物复制到 VM 内指定目录。

```powershell
# ============================================================
# 模块：复制安装包到 VM
# 支持：WinRM 远程会话 + 共享文件夹两种方式
# ============================================================

function Copy-ArtifactToVM {
    param(
        [string]$VMIP = $script:VM_IP,
        [string]$Username = $script:VM_USERNAME,
        [string]$Password = $script:VM_PASSWORD,
        [string]$LocalPath = $script:ARTIFACT_PATH,
        [string]$RemoteDir = $script:VM_INSTALLER_DIR
    )

    $cred = New-Object System.Management.Automation.PSCredential(
        $Username,
        (ConvertTo-SecureString $Password -AsPlainText -Force)
    )

    # 确保 VM 上目标目录存在
    $session = New-PSSession -ComputerName $VMIP -Credential $cred
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
        }
    } -ArgumentList $RemoteDir

    # 复制文件
    Write-Host "复制安装包: $LocalPath → \\$VMIP\$RemoteDir"
    Copy-Item -Path $LocalPath -Destination $RemoteDir -ToSession $session -Force

    # 验证
    $remoteFile = Invoke-Command -Session $session -ScriptBlock {
        param($dir, $filename)
        $path = Join-Path $dir $filename
        if (Test-Path $path) {
            $file = Get-Item $path
            @{ Exists = $true; Size = $file.Length; LastWrite = $file.LastWriteTime }
        } else {
            @{ Exists = $false }
        }
    } -ArgumentList $RemoteDir, (Split-Path $LocalPath -Leaf)

    Remove-PSSession $session

    if ($remoteFile.Exists) {
        Write-Host "安装包复制成功（大小: $([math]::Round($remoteFile.Size / 1MB, 2)) MB）"
        return $true
    } else {
        throw "安装包复制失败"
    }
}
```

**关键点**：
- 使用 `Copy-Item -ToSession` 通过 WinRM 传输，无需额外配置共享文件夹
- 传输后验证文件完整性和大小
- 自动创建远程目标目录

---

### 3.6 VM-RemoteInstall.ps1 — 远程静默安装

**功能**：在 VM 内远程执行安装包的静默安装。

```powershell
# ============================================================
# 模块：远程静默安装
# 支持：MSI 和 EXE 两种安装包格式
# ============================================================

function Install-ProductOnVM {
    param(
        [string]$VMIP = $script:VM_IP,
        [string]$Username = $script:VM_USERNAME,
        [string]$Password = $script:VM_PASSWORD,
        [string]$InstallerDir = $script:VM_INSTALLER_DIR,
        [string]$LogDir = $script:VM_INSTALL_LOG_DIR,
        [int]$TimeoutSeconds = $script:INSTALL_TIMEOUT
    )

    $cred = New-Object System.Management.Automation.PSCredential(
        $Username,
        (ConvertTo-SecureString $Password -AsPlainText -Force)
    )
    $session = New-PSSession -ComputerName $VMIP -Credential $cred

    $result = Invoke-Command -Session $session -ScriptBlock {
        param($installerDir, $logDir, $timeoutSec)

        # 确保日志目录存在
        if (-not (Test-Path $logDir)) {
            New-Item -Path $logDir -ItemType Directory -Force | Out-Null
        }

        # 查找安装包
        $msi = Get-ChildItem -Path $installerDir -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
        $exe = Get-ChildItem -Path $installerDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $installLog = Join-Path $logDir "Install_$timestamp.log"

        if ($msi) {
            # MSI 静默安装
            Write-Host "检测到 MSI 安装包: $($msi.Name)"
            $args = "/i `"$($msi.FullName)`" /quiet /norestart /l*v `"$installLog`""
            $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $args -Wait -PassThru
            @{ Success = ($process.ExitCode -eq 0); ExitCode = $process.ExitCode; LogFile = $installLog; Type = "MSI" }
        }
        elseif ($exe) {
            # EXE 静默安装（需根据实际安装包调整参数）
            Write-Host "检测到 EXE 安装包: $($exe.Name)"
            $args = "/S /quiet /norestart"  # 常见静默参数，需根据实际调整
            $process = Start-Process -FilePath $exe.FullName -ArgumentList $args -Wait -PassThru -NoNewWindow
            @{ Success = ($process.ExitCode -eq 0); ExitCode = $process.ExitCode; LogFile = $installLog; Type = "EXE" }
        }
        else {
            @{ Success = $false; ExitCode = -1; LogFile = ""; Type = "None"; Error = "未找到安装包" }
        }
    } -ArgumentList $InstallerDir, $LogDir, $TimeoutSeconds

    Remove-PSSession $session

    if ($result.Success) {
        Write-Host "安装成功（类型: $($result.Type), 退出码: $($result.ExitCode)）"
        return $true
    } else {
        throw "安装失败（类型: $($result.Type), 退出码: $($result.ExitCode), 错误: $($result.Error)）"
    }
}
```

**关键点**：
- 自动识别 MSI / EXE 安装包格式
- MSI 使用 `msiexec /i /quiet /l*v` 标准静默安装并生成日志
- EXE 静默参数需根据实际安装包调整（如 Inno Setup 用 `/S`，NSIS 用 `/S`，InstallShield 用 `/s`）
- 安装日志写入 VM 指定目录，便于事后排查

---

### 3.7 VM-RemoteTest.ps1 — 远程执行测试

**功能**：在 VM 内远程执行自动化测试。

```powershell
# ============================================================
# 模块：远程执行自动化测试
# 支持：NUnit / MSTest / FlaUI UI 测试
# ============================================================

function Invoke-TestOnVM {
    param(
        [string]$VMIP = $script:VM_IP,
        [string]$Username = $script:VM_USERNAME,
        [string]$Password = $script:VM_PASSWORD,
        [string]$TestResultDir = $script:VM_TEST_RESULT_DIR,
        [int]$TimeoutSeconds = $script:TEST_TIMEOUT
    )

    $cred = New-Object System.Management.Automation.PSCredential(
        $Username,
        (ConvertTo-SecureString $Password -AsPlainText -Force)
    )
    $session = New-PSSession -ComputerName $VMIP -Credential $cred

    $result = Invoke-Command -Session $session -ScriptBlock {
        param($testResultDir)

        # 确保结果目录存在
        if (-not (Test-Path $testResultDir)) {
            New-Item -Path $testResultDir -ItemType Directory -Force | Out-Null
        }

        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $outputFile = Join-Path $testResultDir "TestResult_$timestamp.xml"

        # --- 方式1：NUnit Console Runner ---
        $nconsole = "C:\Tools\NUnit\nunit3-console.exe"
        $testDll = "C:\Program Files\YourProduct\Tests\YourProduct.Tests.dll"
        if (Test-Path $nconsole) {
            Write-Host "使用 NUnit 执行测试..."
            $args = "`"$testDll`" --result=`"$outputFile`" --timeout=60000"
            $process = Start-Process -FilePath $nconsole -ArgumentList $args -Wait -PassThru -NoNewWindow
            return @{
                Success = ($process.ExitCode -eq 0)
                ExitCode = $process.ExitCode
                ResultFile = $outputFile
                Runner = "NUnit"
            }
        }

        # --- 方式2：MSTest ---
        $mstest = "C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise\Common7\IDE\MSTest.exe"
        if (Test-Path $mstest) {
            Write-Host "使用 MSTest 执行测试..."
            $args = "/testcontainer:`"$testDll`" /resultsfile:`"$outputFile`""
            $process = Start-Process -FilePath $mstest -ArgumentList $args -Wait -PassThru -NoNewWindow
            return @{
                Success = ($process.ExitCode -eq 0)
                ExitCode = $process.ExitCode
                ResultFile = $outputFile
                Runner = "MSTest"
            }
        }

        return @{ Success = $false; Error = "未找到测试运行器" }
    } -ArgumentList $TestResultDir

    Remove-PSSession $session

    if ($result.Success) {
        Write-Host "测试执行完成（运行器: $($result.Runner), 退出码: $($result.ExitCode)）"
    } else {
        Write-Warning "测试执行失败（退出码: $($result.ExitCode), 错误: $($result.Error)）"
    }

    return $result
}
```

**关键点**：
- UI 自动化测试需要 **交互式桌面会话**，VM 需要以控制台方式登录（非 RDP 断开后会话丢失）
- 建议配置 VM 自动登录（`netplwiz` 取消密码保护 + 注册表 AutoLogon）
- FlaUI 测试需要在活跃桌面会话中运行

---

### 3.8 VM-CollectResults.ps1 — 收集测试结果

**功能**：从 VM 拉取测试结果、安装日志等到 CI 服务器。

```powershell
# ============================================================
# 模块：收集测试结果
# ============================================================

function Get-TestResultsFromVM {
    param(
        [string]$VMIP = $script:VM_IP,
        [string]$Username = $script:VM_USERNAME,
        [string]$Password = $script:VM_PASSWORD,
        [string]$RemoteResultDir = $script:VM_TEST_RESULT_DIR,
        [string]$RemoteLogDir = $script:VM_INSTALL_LOG_DIR,
        [string]$LocalResultDir = "C:\CI\Results"
    )

    $cred = New-Object System.Management.Automation.PSCredential(
        $Username,
        (ConvertTo-SecureString $Password -AsPlainText -Force)
    )
    $session = New-PSSession -ComputerName $VMIP -Credential $cred

    # 创建本地结果目录
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $localDir = Join-Path $LocalResultDir $timestamp
    New-Item -Path $localDir -ItemType Directory -Force | Out-Null

    # 收集测试结果
    Write-Host "收集测试结果..."
    Copy-Item -Path "$RemoteResultDir\*" -Destination $localDir -FromSession $session -Recurse -Force

    # 收集安装日志
    Write-Host "收集安装日志..."
    $logDir = Join-Path $localDir "InstallLogs"
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
    Copy-Item -Path "$RemoteLogDir\*" -Destination $logDir -FromSession $session -Recurse -Force -ErrorAction SilentlyContinue

    # 收集应用日志（如存在）
    Write-Host "收集应用日志..."
    $appLogDir = Join-Path $localDir "AppLogs"
    New-Item -Path $appLogDir -ItemType Directory -Force | Out-Null
    Invoke-Command -Session $session -ScriptBlock {
        param($dest)
        $appLogs = "C:\ProgramData\YourProduct\Logs\*"
        if (Test-Path "C:\ProgramData\YourProduct\Logs") {
            Copy-Item -Path $appLogs -Destination $dest -Recurse -Force -ErrorAction SilentlyContinue
        }
    } -ArgumentList $appLogDir

    Remove-PSSession $session

    Write-Host "结果已收集到: $localDir"
    return $localDir
}
```

---

### 3.9 Pipeline-Runner.ps1 — 主管线编排

**功能**：编排所有模块，按顺序执行完整的 CI/CD 流程。

```powershell
# ============================================================
# CI/CD Pipeline 主编排脚本
# 用法: .\Pipeline-Runner.ps1 [-InstallerPath "C:\Build\Setup.msi"]
# ============================================================

param(
    [string]$InstallerPath = "C:\Build\Output\Setup.msi"
)

# 加载配置和模块
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "Config.ps1")

. (Join-Path $scriptDir "VM-SnapshotRestore.ps1")
. (Join-Path $scriptDir "VM-WaitForReady.ps1")
. (Join-Path $scriptDir "VM-CopyArtifact.ps1")
. (Join-Path $scriptDir "VM-RemoteInstall.ps1")
. (Join-Path $scriptDir "VM-RemoteTest.ps1")
. (Join-Path $scriptDir "VM-CollectResults.ps1")

# 覆盖安装包路径
if ($InstallerPath) {
    $script:ARTIFACT_PATH = $InstallerPath
}

# 日志函数
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "OK"    { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp][$Level] $Message" -ForegroundColor $color
}

# ====== Pipeline 执行 ======
$pipelineStart = Get-Date
$steps = @(
    @{ Name = "恢复快照";   Action = { Restore-VMSnapshot } },
    @{ Name = "等待VM就绪"; Action = { Wait-VMReady } },
    @{ Name = "复制安装包"; Action = { Copy-ArtifactToVM } },
    @{ Name = "静默安装";   Action = { Install-ProductOnVM } },
    @{ Name = "执行测试";   Action = { Invoke-TestOnVM } },
    @{ Name = "收集结果";   Action = { Get-TestResultsFromVM } }
)

foreach ($step in $steps) {
    Write-Log "====== 开始: $($step.Name) ======"
    try {
        & $step.Action
        Write-Log "====== 完成: $($step.Name) ======" -Level "OK"
    } catch {
        Write-Log "====== 失败: $($step.Name) - $_ ======" -Level "ERROR"
        Write-Log "Pipeline 中断，执行清理..." -Level "WARN"
        # 即使失败也尝试收集已有结果
        try { Get-TestResultsFromVM } catch {}
        exit 1
    }
}

$duration = ((Get-Date) - $pipelineStart).ToString("mm\:ss")
Write-Log "Pipeline 全部完成！总耗时: $duration" -Level "OK"
exit 0
```

---

## 四、VM 交互式桌面会话配置（UI 测试必需）

UI 自动化测试（FlaUI / WinAppDriver）**必须**在交互式桌面会话中运行。VM 需要以下额外配置：

### 4.1 配置自动登录

```powershell
# 在 VM 内执行：配置 Windows 自动登录
$username = "ciagent"
$password = "P@ssw0rd!"

Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name "AutoAdminLogon" -Value "1"
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name "DefaultUserName" -Value $username
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name "DefaultPassword" -Value $password
```

### 4.2 确保桌面会话不丢失

关键问题：RDP 断开后桌面会话可能被回收。解决方案：

| 方案 | 说明 | 推荐度 |
|------|------|--------|
| **控制台会话 (console)** | 使用 `mstsc /console` 或 `mstsc /admin` 连接 | ⭐⭐⭐⭐⭐ |
| **tscon 锁定会话** | `tscon 1 /dest:console` 将会话切回控制台 | ⭐⭐⭐⭐ |
| **自动登录 + 重启** | VM 启动后自动登录到桌面 | ⭐⭐⭐⭐⭐ |
| **屏保/休眠禁用** | 关闭屏保、休眠、锁屏 | ⭐⭐⭐⭐⭐ |

### 4.3 推荐的 VM 快照前最终配置

```powershell
# 在创建 "Base-Clean" 快照前执行：

# 1. 禁用屏保和锁屏
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0"
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "0"

# 2. 禁用休眠
powercfg -h off

# 3. 设置电源方案为"高性能"，永不休眠
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0

# 4. 配置自动登录（见 4.1）

# 5. 重启确认自动登录生效
Restart-Computer -Force
```

---

## 五、与 CI/CD 平台集成

### 5.1 Jenkins Pipeline 集成

```groovy
// Jenkinsfile
pipeline {
    agent { label 'windows-build' }  // Windows 构建节点

    stages {
        stage('Build') {
            steps {
                bat '"C:\\Program Files (x86)\\MSBuild\\MSBuild.exe" YourSolution.sln /p:Configuration=Release'
            }
        }

        stage('Code Scan') {
            steps {
                bat 'SonarScanner.MSBuild.exe begin /k:"your-project"'
                bat '"C:\\Program Files (x86)\\MSBuild\\MSBuild.exe" YourSolution.sln /p:Configuration=Release'
                bat 'SonarScanner.MSBuild.exe end'
            }
        }

        stage('VM Deploy & Test') {
            steps {
                // 调用 Pipeline 编排脚本
                bat 'powershell -ExecutionPolicy Bypass -File C:\\CI\\Scripts\\Pipeline-Runner.ps1 -InstallerPath "%WORKSPACE%\\Output\\Setup.msi"'
            }
        }

        stage('Publish Test Results') {
            steps {
                // 发布测试结果到 Jenkins
                step([$class: 'MSTestPublisher',
                      testResultsFile: 'C:\\CI\\Results\\**\\*.trx'])
                // 或 NUnit
                nunit testResultsPattern: 'C:\\CI\\Results\\**\\TestResult*.xml'
            }
        }

        stage('Publish to Staging') {
            when {
                branch 'release/*'
            }
            steps {
                bat 'powershell -ExecutionPolicy Bypass -File C:\\CI\\Scripts\\Deploy-Staging.ps1'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'C:\\CI\\Results\\**\\*', allowEmptyArchive: true
        }
    }
}
```

### 5.2 Azure DevOps Pipeline 集成

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [ main, release/* ]

pool:
  name: 'Windows-Build-Agents'

stages:
- stage: Build
  jobs:
  - job: BuildAndScan
    steps:
    - task: VSBuild@1
      inputs:
        solution: 'YourSolution.sln'
        configuration: 'Release'

    - task: SonarQubePrepare@5
      inputs:
        SonarQube: 'SonarQube-Server'
        projectKey: 'your-project'

    - task: VSBuild@1
      inputs:
        solution: 'YourSolution.sln'
        configuration: 'Release'

    - task: SonarQubeAnalyze@5

    - task: PublishBuildArtifacts@1
      inputs:
        PathtoPublish: 'Output'
        ArtifactName: 'installer'

- stage: VMDeployAndTest
  dependsOn: Build
  jobs:
  - job: DeployAndTest
    steps:
    - task: DownloadBuildArtifacts@1
      inputs:
        artifactName: 'installer'

    - task: PowerShell@2
      displayName: 'VM Snapshot Restore & Deploy & Test'
      inputs:
        targetType: 'filePath'
        filePath: 'C:\CI\Scripts\Pipeline-Runner.ps1'
        arguments: '-InstallerPath "$(Build.ArtifactStagingDirectory)\installer\Setup.msi"'

    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'NUnit'
        testResultsFiles: 'C:\CI\Results\**\TestResult*.xml'

- stage: PublishStaging
  dependsOn: VMDeployAndTest
  condition: and(succeeded(), startsWith(variables['Build.SourceBranch'], 'refs/heads/release/'))
  jobs:
  - job: Publish
    steps:
    - task: PowerShell@2
      inputs:
        targetType: 'filePath'
        filePath: 'C:\CI\Scripts\Deploy-Staging.ps1'
```

---

## 六、安全与凭据管理

**不要在脚本中硬编码密码！** 生产环境推荐方案：

| 方案 | 适用场景 | 安全等级 |
|------|----------|----------|
| **Windows Credential Manager** | 单机部署 | ⭐⭐⭐⭐ |
| **Jenkins Credentials Store** | Jenkins 环境 | ⭐⭐⭐⭐⭐ |
| **Azure Key Vault** | Azure DevOps / 云环境 | ⭐⭐⭐⭐⭐ |
| **Thycotic / CyberArk** | 企业级密钥管理 | ⭐⭐⭐⭐⭐ |
| **环境变量** | 简单场景（不推荐生产） | ⭐⭐ |

### Config.ps1 安全改造示例

```powershell
# 从 Windows Credential Manager 读取密码
# 需安装: Install-Module -Name CredentialManager
Import-Module CredentialManager
$cred = Get-StoredCredential -Target "CI-VM-Agent"
if ($cred) {
    $script:VM_USERNAME = $cred.UserName
    $script:VM_PASSWORD = $cred.GetNetworkCredential().Password
} else {
    throw "未找到存储的凭据 'CI-VM-Agent'，请先配置"
}
```

---

## 七、实施步骤与里程碑

### Phase 1：基础环境搭建（1-2 天）

| 步骤 | 内容 | 验证标准 |
|------|------|----------|
| 1.1 | Hyper-V 宿主机准备，创建 VM | VM 可正常启动 |
| 1.2 | VM 内安装 OS、.NET 4.5、依赖项 | 应用可手动安装运行 |
| 1.3 | 启用 WinRM，配置远程管理 | 从宿主机可 `Enter-PSSession` |
| 1.4 | 创建基础快照 "Base-Clean" | `Get-VMSnapshot` 可查到快照 |
| 1.5 | 配置自动登录 + 禁用屏保休眠 | 重启后自动登录到桌面 |

### Phase 2：脚本开发与调试（2-3 天）

| 步骤 | 内容 | 验证标准 |
|------|------|----------|
| 2.1 | 创建 Config.ps1，配置参数 | 参数可正确加载 |
| 2.2 | 开发 VM-SnapshotRestore.ps1 | 可自动恢复快照并启动 VM |
| 2.3 | 开发 VM-WaitForReady.ps1 | 可正确检测 VM 就绪状态 |
| 2.4 | 开发 VM-CopyArtifact.ps1 | 安装包可自动复制到 VM |
| 2.5 | 开发 VM-RemoteInstall.ps1 | 可远程静默安装产品 |
| 2.6 | 开发 VM-RemoteTest.ps1 | 可远程触发并执行测试 |
| 2.7 | 开发 VM-CollectResults.ps1 | 测试结果可自动拉取 |
| 2.8 | 集成 Pipeline-Runner.ps1 | 完整流程端到端跑通 |

### Phase 3：CI/CD 平台集成（1-2 天）

| 步骤 | 内容 | 验证标准 |
|------|------|----------|
| 3.1 | 配置 Jenkins / Azure DevOps Pipeline | 代码提交自动触发构建 |
| 3.2 | 集成 Build → Code Scan → VM Test | 全流程自动化 |
| 3.3 | 测试结果发布到 CI 平台 | 可在 CI 平台查看测试报告 |
| 3.4 | 配置构建失败通知 | 失败时发送邮件/钉钉通知 |

### Phase 4：优化与加固（1-2 天）

| 步骤 | 内容 | 验证标准 |
|------|------|----------|
| 4.1 | 凭据安全化（移除硬编码密码） | 密码从 Credential Store 读取 |
| 4.2 | 并行测试（多 VM 同时执行） | 2+ VM 并行，测试时间减半 |
| 4.3 | 快照管理策略（定期更新基础快照） | 自动化快照更新脚本 |
| 4.4 | 添加重试机制（VM 启动失败时） | 网络波动场景可自动恢复 |

---

## 八、常见问题与排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| WinRM 连接被拒绝 | WinRM 未启动或防火墙阻止 | `winrm quickconfig` + 放行 5985 端口 |
| 远程会话空闲断开 | WinRM 空闲超时 | 增大 `MaxIdleTimeOutMs` |
| UI 测试无法找到窗口 | 桌面会话丢失 | 确保控制台会话活跃，禁用屏保 |
| 安装包静默安装失败 | 安装包不支持静默参数 | 检查安装包文档，制作响应文件 |
| 快照恢复后 IP 变化 | DHCP 动态分配 | VM 使用静态 IP |
| Copy-Item 传输慢 | WinRM 传输带宽限制 | 大文件改用 SMB 共享文件夹 |
| `Restore-VMSnapshot` 报错 | VM 状态不是 Off | 先 `Stop-VM` 再恢复 |
