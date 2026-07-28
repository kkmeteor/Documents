## CNB 代码迁移到本地 Gitea 指南

本文档指导你将托管在 CNB（cnb.cool）上的代码仓库迁移到本地部署的 Gitea 实例，全程使用 git 命令行操作。

---

### 一、前置准备

**1. 确认环境**

```bash
# 确认 git 版本（建议 2.x 以上）
git --version

# 确认能访问 CNB 和 Gitea
ping cnb.cool
ping <你的Gitea地址>
```

**2. 准备认证信息**

你需要同时拥有 CNB 和 Gitea 的访问凭据：

- **CNB**：个人访问令牌（Personal Access Token），在 CNB 的「设置 → 访问令牌」中生成
- **Gitea**：个人访问令牌或账号密码，在 Gitea 的「设置 → 应用 → 生成令牌」中创建

建议将令牌保存为环境变量，避免在命令中明文输入：

```bash
# Windows CMD
set CNB_TOKEN=你的CNB令牌
set GITEA_TOKEN=你的Gitea令牌

# PowerShell
$env:CNB_TOKEN = "你的CNB令牌"
$env:GITEA_TOKEN = "你的Gitea令牌"
```

**3. 确认 Gitea 上已创建好目标组织/用户**

迁移前在 Gitea Web 界面中创建好对应的组织（如 `sinounion`），并确认你的账号对该组织有仓库创建权限。

---

### 二、单个仓库迁移

这是最基础的迁移方式，适用于少量仓库。

**步骤 1：从 CNB 做裸克隆（bare clone）**

裸克隆会拉取所有分支和标签的完整历史，不包含工作目录，适合做仓库级别的迁移。

```bash
git clone --bare https://cnb.cool/<组织名>/<仓库名>.git
```

例如：

```bash
git clone --bare https://cnb.cool/sinounion/AI-Platform.git
```

如果仓库需要认证：

```bash
git clone --bare https://<用户名>:%CNB_TOKEN%@cnb.cool/<组织名>/<仓库名>.git
```

**步骤 2：进入仓库目录**

```bash
cd AI-Platform.git
```

**步骤 3：在 Gitea 上创建空仓库**

方式一：通过 Gitea Web 界面手动创建（推荐，可设置组织、权限等）。

方式二：通过 Gitea API 创建：

```bash
curl -X POST "http://<Gitea地址>/api/v1/orgs/<组织名>/repos" \
  -H "Authorization: token %GITEA_TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"AI-Platform\",\"private\":true,\"auto_init\":false}"
```

**步骤 4：推送所有分支和标签到 Gitea**

```bash
git push --mirror http://<用户名>:%GITEA_TOKEN%@<Gitea地址>/<组织名>/<仓库名>.git
```

`--mirror` 会推送所有引用（分支、标签、远程跟踪引用），确保完整迁移。

**步骤 5：验证**

```bash
# 克隆新仓库验证完整性
cd ..
git clone http://<Gitea地址>/<组织名>/<仓库名>.git AI-Platform-verify
cd AI-Platform-verify

# 检查分支
git branch -a

# 检查标签
git tag -l

# 检查提交历史
git log --oneline -5
```

确认无误后可删除验证目录。

---

### 三、批量迁移多个仓库

当需要迁移大量仓库时，手动逐个操作效率很低。下面提供一个批处理脚本。

**1. 导出 CNB 仓库列表**

方式一：手动整理，创建 `repos.txt` 文件，每行一个仓库名：

```
AI-Platform
backend-service
frontend-app
shared-lib
```

方式二：通过 CNB API 获取（如果支持）：

```bash
curl -H "Authorization: Bearer %CNB_TOKEN%" \
  "https://cnb.cool/api/v4/groups/<组织名>/projects?per_page=100" \
  -o cnb_repos.json
```

然后从 JSON 中提取仓库名。

**2. 批量迁移脚本（Windows Batch）**

创建 `migrate.bat`：

```batch
@echo off
setlocal enabledelayedexpansion

set CNB_USER=你的CNB用户名
set CNB_TOKEN=你的CNB令牌
set GITEA_USER=你的Gitea用户名
set GITEA_TOKEN=你的Gitea令牌
set GITEA_URL=http://<Gitea地址>
set GITEA_ORG=目标组织名
set CNB_ORG=CNB上的组织名

set WORK_DIR=%~dp0migration_work
mkdir "%WORK_DIR%" 2>nul

for /f "usebackq delims=" %%R in ("%~dp0repos.txt") do (
    echo ========================================
    echo 迁移仓库: %%R
    echo ========================================

    cd /d "%WORK_DIR%"

    :: 清理旧的工作目录
    if exist "%%R.git" rmdir /s /q "%%R.git"

    :: 从 CNB 裸克隆
    echo [1/3] 从 CNB 克隆 %%R ...
    git clone --bare https://%CNB_USER%:%CNB_TOKEN%@cnb.cool/%CNB_ORG%/%%R.git
    if errorlevel 1 (
        echo [错误] 克隆 %%R 失败，跳过
        goto :next
    )

    cd "%%R.git"

    :: 推送到 Gitea
    echo [2/3] 推送到 Gitea ...
    git push --mirror http://%GITEA_USER%:%GITEA_TOKEN%@%GITEA_URL%/%GITEA_ORG%/%%R.git
    if errorlevel 1 (
        echo [错误] 推送 %%R 失败
        goto :next
    )

    echo [3/3] %%R 迁移完成

    :next
    cd /d "%WORK_DIR%"
)

echo.
echo 所有仓库迁移完成！
pause
```

**3. 批量迁移脚本（PowerShell 版本）**

```powershell
# migrate.ps1 — 注意保存为 UTF-8 with BOM

$CnbUser    = "你的CNB用户名"
$CnbToken   = "你的CNB令牌"
$GiteaUser  = "你的Gitea用户名"
$GiteaToken = "你的Gitea令牌"
$GiteaUrl   = "http://<Gitea地址>"
$GiteaOrg   = "目标组织名"
$CnbOrg     = "CNB上的组织名"
$WorkDir    = "$PSScriptRoot\migration_work"

New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

$repos = Get-Content "$PSScriptRoot\repos.txt" | Where-Object { $_.Trim() -ne "" }

foreach ($repo in $repos) {
    $repo = $repo.Trim()
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "迁移仓库: $repo" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Set-Location $WorkDir

    # 清理
    if (Test-Path "$repo.git") { Remove-Item "$repo.git" -Recurse -Force }

    # 裸克隆
    Write-Host "[1/3] 从 CNB 克隆..."
    git clone --bare "https://$CnbUser`:$CnbToken@cnb.cool/$CnbOrg/$repo.git"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 克隆失败，跳过" -ForegroundColor Red
        continue
    }

    Set-Location "$repo.git"

    # 推送
    Write-Host "[2/3] 推送到 Gitea..."
    git push --mirror "http://$GiteaUser`:$GiteaToken@$GiteaUrl/$GiteaOrg/$repo.git"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 推送失败" -ForegroundColor Red
        continue
    }

    Write-Host "[3/3] $repo 迁移完成" -ForegroundColor Green
}

Write-Host "`n全部完成！" -ForegroundColor Green
```

---

### 四、迁移后：团队成员切换远程地址

仓库迁移完成后，团队中每个人都需要将本地仓库的 remote 从 CNB 切换到 Gitea。

**方式 1：修改已有本地仓库的 remote**

```bash
# 查看当前 remote
git remote -v

# 修改 remote URL
git remote set-url origin http://<Gitea地址>/<组织名>/<仓库名>.git

# 验证
git remote -v

# 拉取确认连通
git fetch origin
```

**方式 2：批量修改当前目录下所有子仓库**

在包含多个项目的工作目录下执行：

```batch
:: Windows Batch — 遍历子目录修改 remote
for /d %D in (*) do @if exist "%D\.git" (
    echo 修改 %D ...
    git -C "%D" remote set-url origin http://<Gitea地址>/<组织名>/%D.git
    git -C "%D" remote -v
)
```

```powershell
# PowerShell 版本
Get-ChildItem -Directory | Where-Object { Test-Path "$($_.FullName)\.git" } | ForEach-Object {
    Write-Host "修改 $($_.Name) ..."
    git -C $_.FullName remote set-url origin "http://<Gitea地址>/<组织名>/$($_.Name).git"
    git -C $_.FullName remote -v
}
```

**方式 3：重新克隆（适用于没有本地修改的情况）**

```bash
git clone http://<Gitea地址>/<组织名>/<仓库名>.git
```

---

### 五、迁移 CI/CD 配置

如果 CNB 上配置了 CI/CD 流水线（如 `.cnb.yml`），迁移到 Gitea 后需要适配 Gitea 的 CI 系统。

**Gitea Actions（兼容 GitHub Actions 语法）**

Gitea 1.8+ 支持 Gitea Actions，使用与 GitHub Actions 兼容的 YAML 语法。迁移步骤：

1. 在 Gitea 管理面板启用 Actions 功能
2. 将 CNB 的流水线配置转换为 `.gitea/workflows/<名称>.yml` 格式
3. 确保 Gitea 服务器上安装了 act_runner（Actions Runner）

示例 — 将 CNB 流水线转换为 Gitea Actions：

```yaml
# .gitea/workflows/build.yml
name: Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: |
          dotnet build --configuration Release
      - name: Test
        run: |
          dotnet test --no-build --configuration Release
```

**如果使用 Jenkins 等外部 CI**

不需要迁移 CI 配置文件，只需在 Jenkins 中更新 SCM 源地址指向 Gitea 即可。Jenkins Job 中的 Repository URL 改为 Gitea 地址，并配置对应的凭据。

---

### 六、迁移检查清单

迁移完成后，逐项确认：

| 检查项 | 验证命令 / 操作 |
|--------|----------------|
| 所有分支已迁移 | `git branch -a` 对比 CNB 和 Gitea |
| 所有标签已迁移 | `git tag -l` 对比 |
| 提交历史完整 | `git log --oneline \| wc -l` 对比提交数 |
| 远程地址已更新 | `git remote -v` 指向 Gitea |
| fetch/push 正常 | `git fetch && git push` 无报错 |
| CI/CD 正常运行 | 触发一次构建确认 |
| 团队成员已通知 | 所有人切换到新地址 |

---

### 七、常见问题

**Q: 克隆时报 `SSL certificate problem: self-signed certificate`**

Gitea 如果使用自签名证书，需要临时跳过 SSL 验证（仅限迁移过程）：

```bash
git -c http.sslVerify=false clone http://...
# 或全局设置（不推荐长期使用）
git config --global http.sslVerify false
```

更好的方案是将 Gitea 的 CA 证书导入系统信任链：

```bash
# 导出 Gitea 证书
openssl s_client -connect <Gitea地址>:443 -showcerts < /dev/null 2>/dev/null | openssl x509 > gitea-ca.crt

# Windows: 导入到受信任根证书
certutil -addstore "Root" gitea-ca.crt
```

**Q: 推送时报 `rejected: non-fast-forward`**

说明 Gitea 上的仓库不是空的（可能初始化时勾选了"初始化仓库"）。确认是空仓库后，使用 `--force` 覆盖：

```bash
git push --mirror --force http://...
```

**Q: 大仓库迁移很慢怎么办**

可以先用 `--mirror` 做一次完整迁移，之后在 CNB 上配置 Gitea 为镜像目标进行增量同步，最后在某个时间点做最终切换。也可以直接用 `--depth=1` 做浅克隆加速（但会丢失历史）。

**Q: 需要迁移 Issue、PR 等元数据吗？**

git 只迁移代码和历史。Issue、Pull Request、Wiki 等元数据需要额外处理。Gitea 提供了 API 可以批量创建 Issue，如果需要迁移可以编写脚本通过 API 完成。

**Q: 迁移后 CNB 上的仓库可以删除吗？**

建议保留 CNB 仓库至少 1-2 周作为备份，确认所有团队成员都已切换且没有遗漏后再删除。

---

### 八、快速参考命令

```bash
# 单仓库迁移核心三步
git clone --bare https://cnb.cool/<组织>/<仓库>.git
cd <仓库>.git
git push --mirror http://<Gitea地址>/<组织>/<仓库>.git

# 团队成员切换 remote
git remote set-url origin http://<Gitea地址>/<组织>/<仓库>.git
```
