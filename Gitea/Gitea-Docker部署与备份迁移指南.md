# Gitea Docker Desktop 部署与备份迁移指南

> 适用于小型团队（10–15 人）的自托管 Git 服务器  
> 版本：1.0 | 日期：2026-06-18

---

## 1  为什么选择 Gitea + Docker Desktop

Gitea 是一款用 Go 编写的开源自托管 Git 平台，单二进制部署，内存占用低于 100MB，非常适合在本地 Docker Desktop 上运行。相比 GitLab CE（需要 4GB+ 内存），Gitea 在十几人团队场景下性价比最高，同时提供完整的权限管理、代码审查、CI/CD（Gitea Actions）等企业级功能。

---

## 2  环境准备

### 2.1  前置条件

- Windows 10/11 或 macOS，已安装 Docker Desktop
- 确保 Docker Desktop 正在运行（系统托盘图标为绿色）
- 建议分配给 Docker 至少 2GB 内存（Settings → Resources）

### 2.2  验证 Docker 环境

```bash
docker --version
docker compose version
```

如果命令正常返回版本号，说明环境就绪。

---

## 3  快速部署（SQLite 版）

如果只是想快速体验，一个命令即可启动：

```bash
docker run -d \
  --name gitea \
  -p 3000:3000 \
  -p 222:22 \
  -v ./gitea-data:/data \
  -v /etc/timezone:/etc/timezone:ro \
  -v /etc/localtime:/etc/localtime:ro \
  --restart always \
  gitea/gitea:latest
```

启动后访问 `http://localhost:3000` 进入初始化页面。

> **注意：** SQLite 版本适合 1–3 人的个人使用，十几人团队建议升级到 MySQL 方案（见第 4 节）。

---

## 4  生产部署（MySQL + Docker Compose，推荐）

### 4.1  创建项目目录

```bash
mkdir gitea-server && cd gitea-server
```

### 4.2  编写 docker-compose.yml

在项目目录下创建 `docker-compose.yml`，内容如下：

```yaml
version: "3"

services:
  gitea:
    image: gitea/gitea:latest
    container_name: gitea
    restart: always
    ports:
      - "3000:3000"   # Web 界面
      - "222:22"      # SSH 访问
    volumes:
      - ./gitea-data:/data
    depends_on:
      - db
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__database__DB_TYPE=mysql
      - GITEA__database__HOST=db:3306
      - GITEA__database__NAME=gitea
      - GITEA__database__USER=gitea
      - GITEA__database__PASSWD=gitea_secret

  db:
    image: mysql:8.0
    container_name: gitea-mysql
    restart: always
    volumes:
      - ./mysql-data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=root_secret
      - MYSQL_DATABASE=gitea
      - MYSQL_USER=gitea
      - MYSQL_PASSWORD=gitea_secret
```

### 4.3  启动服务

```bash
docker compose up -d
```

等待约 30 秒让 MySQL 初始化完成，然后访问 `http://localhost:3000`。

### 4.4  初始化配置

在浏览器中打开 `http://localhost:3000`，完成以下设置：

1. **数据库设置**：已自动填入，确认即可
2. **站点名称**：如 "公司代码仓库"
3. **服务器域名**：填写服务器的 IP 地址（局域网访问时填写内网 IP）
4. **SSH 端口**：222
5. **管理员账号**：在页面底部展开"管理员账号设置"创建

### 4.5  数据存储结构

部署完成后，项目目录会生成如下结构：

```
gitea-server/
├── docker-compose.yml
├── gitea-data/
│   ├── git/
│   │   └── repositories/     ← 所有 Git 仓库的裸仓库文件
│   ├── gitea/
│   │   ├── conf/app.ini      ← Gitea 主配置文件
│   │   └── data/             ← SQLite 文件、附件、头像、LFS 对象
│   └── ssh/                  ← SSH 密钥
└── mysql-data/
    ├── gitea/                ← MySQL 的 gitea 数据库文件
    ├── ibdata1               ← InnoDB 共享表空间
    └── ...
```

**关键理解：** Git 仓库的代码文件存在 `gitea-data/git/repositories/`，用户、权限、Issue 等业务元数据存在 `mysql-data/` 中。两者都需要保护。

---

## 5  网络访问配置

### 5.1  局域网访问

其他同事通过你的内网 IP 访问 Gitea：

```bash
# 查看本机 IP
ipconfig    # Windows
ifconfig    # macOS/Linux
```

假设 IP 为 `192.168.1.100`，同事访问地址为：

- Web 界面：`http://192.168.1.100:3000`
- Git clone（HTTP）：`git clone http://192.168.1.100:3000/组织名/仓库名.git`
- Git clone（SSH）：`git clone ssh://git@192.168.1.100:222/组织名/仓库名.git`

### 5.2  防火墙放行

Windows 需要放行 3000 和 222 端口：

```powershell
# Windows 防火墙放行（以管理员身份运行 PowerShell）
New-NetFirewallRule -DisplayName "Gitea Web" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Gitea SSH" -Direction Inbound -Port 222 -Protocol TCP -Action Allow
```

### 5.3  固定 IP（推荐）

为了避免路由器重新分配 IP 导致地址变化，建议：

- 在路由器中为本机绑定固定 IP（MAC 地址绑定）
- 或者将 Gitea 部署到公司内网的固定服务器上

---

## 6  常用运维命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f gitea

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 升级 Gitea（拉取最新镜像后重建容器）
docker compose pull
docker compose up -d

# 进入 Gitea 容器执行命令
docker exec -it gitea sh

# 进入 MySQL 容器
docker exec -it gitea-mysql mysql -u gitea -p gitea
```

---

## 7  备份策略

### 7.1  需要备份的数据清单

| 数据类型 | 存储位置 | 包含内容 |
|---------|---------|---------|
| Git 仓库文件 | `gitea-data/git/repositories/` | 所有代码、提交历史、分支 |
| 配置文件 | `gitea-data/gitea/conf/app.ini` | Gitea 全局配置 |
| 附件与头像 | `gitea-data/gitea/data/` | 上传文件、用户头像、LFS 对象 |
| 数据库 | `mysql-data/` 容器目录 | 用户、权限、Issue、PR、日志 |
| SSH 密钥 | `gitea-data/ssh/` | 服务器 SSH 密钥对 |

### 7.2  方案一：使用 Gitea 内置 dump 命令（推荐）

Gitea 提供了一键备份命令，自动将所有数据打包成一个 ZIP 文件：

```bash
docker exec -it gitea gitea dump -c /data/gitea/conf/app.ini
```

生成的 ZIP 包含：`app.ini`、`custom/` 自定义文件、`data/` 数据目录、`repos/` 完整仓库副本、`gitea-db.sql` 数据库转储文件。

可以将输出文件复制到备份目录：

```bash
docker cp gitea:/app/gitea-dump-*.zip /path/to/backup/
```

> **注意：** 执行 dump 时建议停止用户访问，以避免备份数据不一致。

### 7.3  方案二：分别备份静态文件和数据库

#### 7.3.1  备份 Git 仓库静态文件

```bash
# Linux / macOS
tar -czf gitea-repos-$(date +%Y%m%d).tar.gz ./gitea-data/git/repositories/

# Windows PowerShell
Compress-Archive -Path .\gitea-data\git\repositories -DestinationPath "gitea-repos-$(Get-Date -Format yyyyMMdd).zip"
```

#### 7.3.2  备份 MySQL 数据库

```bash
docker exec -it gitea-mysql mysqldump -u gitea -p gitea > gitea-db-$(date +%Y%m%d).sql
```

> 密码会在命令行中提示输入，也可以使用 `-p密码` 格式直接指定（不推荐在脚本中明文存储）。

#### 7.3.3  备份配置文件

```bash
cp ./gitea-data/gitea/conf/app.ini ./backup/app.ini.$(date +%Y%m%d)
cp -r ./gitea-data/gitea/data/ ./backup/gitea-data/
cp -r ./gitea-data/ssh/ ./backup/ssh/
```

---

## 8  定时备份脚本

### 8.1  Linux / macOS 定时脚本

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

### 8.2  Windows 定时脚本（PowerShell）

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

---

## 9  恢复流程

### 9.1  从 dump 备份恢复

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

### 9.2  从分项备份恢复

逻辑相同：

1. 停止容器
2. 解压并覆盖仓库文件、配置文件
3. 导入 SQL 文件到 MySQL
4. 启动容器并重新生成 Hooks

---

## 10  迁移到新服务器

### 10.1  迁移步骤

```bash
# === 在旧服务器上 ===

# 1. 停止服务
docker compose down

# 2. 打包所有数据
tar -czf gitea-full-backup-$(date +%Y%m%d).tar.gz \
  gitea-data/ mysql-data/ docker-compose.yml

# 3. 传输到新服务器
scp gitea-full-backup-*.tar.gz user@new-server:/path/to/gitea-server/


# === 在新服务器上 ===

# 4. 解压
tar -xzf gitea-full-backup-*.tar.gz

# 5. 启动服务
docker compose up -d

# 6. 重新生成 Hooks
docker exec -it gitea gitea admin regenerate hooks
```

### 10.2  迁移后检查

- 访问 Web 界面，确认仓库列表正常显示
- 测试 `git clone` 和 `git push` 是否正常
- 检查用户列表和权限是否正确
- 确认 SSH 密钥是否需要重新配置（通常不需要，因为 `gitea-data/ssh/` 一并迁移了）

### 10.3  迁移注意事项

- 新旧服务器的 Docker 版本建议一致
- 如果新服务器的 IP 发生变化，需要更新 `app.ini` 中的 `ROOT_URL` 和 `SSH_DOMAIN` 配置
- 迁移后通知团队成员更新 Git remote 地址（如果 IP 变了的话）：

```bash
git remote set-url origin http://新IP:3000/组织名/仓库名.git
```

---

## 11  常见问题

### Q: 容器重启后数据会丢失吗？

不会。所有数据都通过 `volumes` 挂载到了宿主机目录（`./gitea-data` 和 `./mysql-data`），容器重启不影响数据。只有 `docker compose down -v` 或手动删除这些目录才会丢数据。

### Q: 如何升级 Gitea 版本？

```bash
docker compose pull      # 拉取最新镜像
docker compose up -d     # 重建容器（数据不受影响）
```

### Q: 大文件 push 失败怎么办？

编辑 `gitea-data/gitea/conf/app.ini`，调整以下配置后重启：

```ini
[server]
MAX_UPLOAD_SIZE = 512     ; 单位 MB

[repository.upload]
FILE_MAX_SIZE = 100       ; 单个文件最大 MB
MAX_FILES = 10            ; 单次上传最大文件数
```

### Q: 如何修改监听端口？

修改 `docker-compose.yml` 中的 ports 映射即可，例如改为 8080：

```yaml
ports:
  - "8080:3000"
```

然后 `docker compose up -d` 重建容器。
