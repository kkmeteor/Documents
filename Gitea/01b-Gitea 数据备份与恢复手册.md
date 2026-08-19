# Gitea 数据备份与恢复手册

> 适用范围：Docker 自托管 Gitea（SQLite 或 MySQL 均可）。备份、恢复、完整性校验的通用流程。
>
> 版本：1.0

---

## 一、备份概述

Gitea 的数据分为两大部分：**静态文件**（Git 仓库、配置、附件）和**数据库**（用户、权限、Issue 等元数据）。二者都需要保护。

### 1.1 需要备份的数据清单

| 数据类型 | 存储位置 | 包含内容 |
|---------|---------|---------|
| Git 仓库文件 | `gitea-data/git/repositories/` | 所有代码、提交历史、分支 |
| 配置文件 | `gitea-data/gitea/conf/app.ini` | Gitea 全局配置 |
| 附件与头像 | `gitea-data/gitea/data/` | 上传文件、用户头像、LFS 对象 |
| 数据库 | `mysql-data/` 容器目录 或 SQLite 文件 | 用户、权限、Issue、PR、日志 |
| SSH 密钥 | `gitea-data/ssh/` | 服务器 SSH 密钥对 |

---

## 二、方案一：使用 Gitea 内置 dump 命令（推荐）

Gitea 提供了一键备份命令，自动将所有数据打包成一个 ZIP 文件：

```bash
docker exec -it gitea gitea dump -c /data/gitea/conf/app.ini
```

生成的 ZIP 包含：`app.ini`、`custom/` 自定义文件、`data/` 数据目录、`repos/` 完整仓库副本、`gitea-db.sql` 数据库转储文件。

将输出文件复制到备份目录：

```bash
docker cp gitea:/app/gitea-dump-*.zip /path/to/backup/
```

> **注意：** 执行 dump 时建议停止用户访问，以避免备份数据不一致。
> 若在根目录下执行遇到权限报错，使用 `sudo docker exec -u git gitea gitea dump ...`。

---

## 三、方案二：分别备份静态文件和数据库

**备份 Git 仓库静态文件：**

```bash
# Linux / macOS
tar -czf gitea-repos-$(date +%Y%m%d).tar.gz ./gitea-data/git/repositories/

# Windows PowerShell
Compress-Archive -Path .\gitea-data\git\repositories -DestinationPath "gitea-repos-$(Get-Date -Format yyyyMMdd).zip"
```

**备份 MySQL 数据库：**

```bash
docker exec -it gitea-mysql mysqldump -u gitea -p gitea > gitea-db-$(date +%Y%m%d).sql
```

> 密码会在命令行中提示输入，也可以使用 `-p密码` 格式直接指定（不推荐在脚本中明文存储）。

**备份配置文件：**

```bash
cp ./gitea-data/gitea/conf/app.ini ./backup/app.ini.$(date +%Y%m%d)
cp -r ./gitea-data/gitea/data/ ./backup/gitea-data/
cp -r ./gitea-data/ssh/ ./backup/ssh/
```

---

## 四、定时备份脚本

### 4.1 Linux / macOS 定时脚本

```bash
#!/bin/bash
# Gitea 完整备份脚本
# 用法: 添加到 crontab，每天凌晨 2 点执行
# 0 2 * * * /path/to/backup-gitea.sh

BACKUP_DIR="/backup/gitea"
DATE=$(date +%Y%m%d_%H%M%S)
GITEA_CONTAINER="gitea"
MYSQL_CONTAINER="gitea-mysql"
RETAIN_DAYS=30

mkdir -p $BACKUP_DIR

# 1. 备份数据库
docker exec $MYSQL_CONTAINER mysqldump -u gitea -p$DB_PASS gitea \
  > $BACKUP_DIR/gitea-db-$DATE.sql

# 2. 备份 Git 仓库文件
tar -czf $BACKUP_DIR/gitea-repos-$DATE.tar.gz \
  -C /path/to/gitea-data/git repositories

# 3. 备份配置和附件
tar -czf $BACKUP_DIR/gitea-config-$DATE.tar.gz \
  -C /path/to/gitea-data gitea/conf gitea/data ssh

# 4. 清理过期备份（保留最近 30 天）
find $BACKUP_DIR -type f -mtime +$RETAIN_DAYS -delete

echo "[$DATE] Backup completed successfully."
```

配置 crontab：

```bash
crontab -e
# 添加以下行
0 2 * * * /path/to/backup-gitea.sh >> /var/log/gitea-backup.log 2>&1
```

### 4.2 Windows 定时脚本（PowerShell）

```powershell
# backup-gitea.ps1
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "C:\backup\gitea"
New-Item -ItemType Directory -Force -Path $backupDir

# 备份数据库
docker exec gitea-mysql mysqldump -u gitea -pgitea_secret gitea |
  Out-File "$backupDir\gitea-db-$date.sql" -Encoding utf8

# 备份仓库文件
Compress-Archive -Path .\gitea-data\git\repositories `
  -DestinationPath "$backupDir\gitea-repos-$date.zip"

# 备份配置
Compress-Archive -Path .\gitea-data\gitea\conf, .\gitea-data\gitea\data `
  -DestinationPath "$backupDir\gitea-config-$date.zip"

Write-Host "[$date] Backup completed."
```

配置定时任务：打开「任务计划程序」→ 创建基本任务 → 触发器设为每天凌晨 2:00 → 操作设为启动程序 `powershell.exe -File C:\scripts\backup-gitea.ps1`。

> 更完善的「多级灾备（系统盘 + 机械硬盘 + SMB 网络共享）」自动化体系见《03-自动化备份与多级灾备体系》。

---

## 五、恢复流程

### 5.1 从 dump 备份恢复

```bash
# 1. 停止 Gitea 容器
docker stop gitea

# 2. 解压备份 ZIP 到临时目录
unzip gitea-dump-*.zip -d /tmp/gitea-restore

# 3. 恢复仓库文件
cp -r /tmp/gitea-restore/repos/* ./gitea-data/git/repositories/

# 4. 恢复数据目录
cp -r /tmp/gitea-restore/data/* ./gitea-data/gitea/data/

# 5. 恢复配置文件
cp /tmp/gitea-restore/app.ini ./gitea-data/gitea/conf/

# 6. 导入数据库
docker exec -i gitea-mysql mysql -u gitea -p gitea < /tmp/gitea-restore/gitea-db.sql

# 7. 启动容器
docker start gitea

# 8. 重新生成 Git Hooks（必须执行，否则 push 操作会失败）
docker exec -it gitea gitea admin regenerate hooks
```

> **重要：** 第 8 步必须执行，否则 push 操作会失败。

### 5.2 从分项备份恢复

逻辑相同：

1. 停止容器。
2. 解压并覆盖仓库文件、配置文件。
3. 导入 SQL 文件到 MySQL。
4. 启动容器并重新生成 Hooks。

---

## 六、恢复/迁移后校验（必执行）

### 6.1 查看容器运行状态

```powershell
docker ps | findstr gitea
```

### 6.2 全仓库完整性自检

```powershell
docker exec -u git gitea gitea admin repo check --all
```

无报错 = 仓库底层文件完好。

### 6.3 人工页面校验清单

1. 浏览器访问 `http://localhost:3000`，原账号密码可正常登录。
2. 用户、组织、团队、仓库数量与源一致。
3. Commit、分支、Tag、Issue、评论、附件、Wiki 全部正常。
4. Git HTTP/SSH 可正常克隆、拉取、推送代码。

---

## 七、备份要点总结

- **备份**：`gitea dump` 一键打包配置文件、数据库、仓库与运行时数据；或分项备份（仓库文件 + MySQL + 配置）。
- **恢复/迁移**：解压 → 生成目录结构 → 覆盖文件 → 恢复数据库（按 SQLite/MySQL 选择）→ 修改配置 → 启动 → **重新生成 Hooks** → 校验。
- **版本严格一致**：跨环境迁移源与目标必须使用相同的 Gitea 镜像版本。
- **路径规范**：Windows 全程使用无中文、无空格的英文路径。
- **备份纪律**：每天自动备份，保留至少 30 天；异地备份；每季度在测试环境演练一次完整恢复。

