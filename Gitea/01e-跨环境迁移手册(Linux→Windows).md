# Gitea 跨环境迁移手册（Linux → Windows Docker Desktop）

> 适用范围：将 Linux 宿主机 Docker 运行的 Gitea 全量迁移至 Windows Docker Desktop。完整迁移代码仓库、数据库、账号、权限、工单、配置，保证数据 100% 对齐。
>
> 覆盖 **SQLite** 与 **MySQL** 两种数据库变体。
>
> 版本：1.0

---

## 一、前置硬性约束

1. **版本一致**：Windows 端必须使用与 Linux 严格相同的 Gitea 镜像版本（如 `gitea/gitea:1.22.3`）。
2. **数据库**：SQLite 或 MySQL，按实际环境选择对应恢复方式（见第四、五部分）。
3. **Windows 路径要求**：全程无中文、无空格，示例使用 `D:\gitea-local`。
4. **Docker Desktop** 必须完整启动，右下角托盘为绿色运行状态。
5. **网络**：能访问目标 Docker 环境，能够拉取镜像。

### 验证 Docker 环境

```bash
docker --version
docker compose version
```

---

## 二、迁移总览与核心矛盾

迁移的核心是把 Linux 上 Gitea 的**业务文件目录** + **数据库**完整搬到 Windows，并修正两个环境差异点：

1. **数据库连接**：Linux 端 `app.ini` 中 `HOST=mysql`（Linux 容器名），Windows 端 MySQL 容器名改为 `gitea-mysql`，需同步修改 `HOST=gitea-mysql`，否则 DNS 解析失败（`dial tcp: lookup no such host`）。
2. **网络互通**：Windows 端 Gitea 与 MySQL 必须加入**同一个 Docker 网桥**（`gitea-bridge`），才能按容器名互相访问。

**目录层级要求**：Windows 挂载目录 `D:\gitea-local` 下必须直接存在 `gitea`、`git` 等文件夹，禁止嵌套 `/data` 层级，否则登录成功但仓库空白。

---

## 三、Linux 源服务器备份

### 3.1 确认 Linux 网络与 MySQL 内网 IP（MySQL 变体）

```bash
docker network ls
docker network inspect docker-gitea_default   # 查到 MySQL 内网地址，例如 172.18.0.3
```

### 3.2 备份数据库

**MySQL 变体**——用 Linux 宿主机带内网 IP 导出（规避 Alpine 容器内 MariaDB 加密插件缺失问题）：

```bash
mysqldump -h 172.18.0.3 -u gitea -p gitea --single-transaction --default-character-set=utf8mb4 --no-tablespaces > ~/gitea_all_backup.sql
```

- 输入数据库密码（示例 `Gitea@2026`）。
- 参数说明：`--single-transaction` 为 InnoDB 热备份不锁表；`--default-character-set=utf8mb4` 适配中文/emoji 防乱码；`--no-tablespaces` 规避 PROCESS 权限不足报错。
- 校验文件：`ls ~/gitea_all_backup.sql`

**SQLite 变体**——无需导出 SQL，SQLite 数据库文件在 `data` 目录内，随业务目录一起打包即可。

### 3.3 备份 Gitea 业务文件目录

Gitea 容器挂载路径（Linux）：`/data/gitea/gitea`（含 `app.ini`、所有 git 仓库、issues、附件、LFS、密钥等）。整体打包并拷贝到 Windows：

```bash
sudo docker exec -u git gitea gitea dump -c /data/gitea/gitea/conf/app.ini --output /data/gitea/gitea-dump.zip
sudo docker cp gitea:/data/gitea/gitea-dump.zip ~/
sudo docker exec gitea rm /data/gitea/gitea-dump.zip
```

> 若使用完整业务目录方式：`tar -zcvf gitea_data_full.tar.gz /data/gitea`，然后在 Windows 端解压铺平到 `D:\gitea-local`。

### 3.4 将两类文件拷贝到 Windows

1. 数据库文件：`gitea_all_backup.sql`（MySQL 变体）
2. Gitea 业务目录：`gitea-dump.zip` 或 `gitea_data_full.tar.gz`

通过 SFTP / WinSCP / 网盘下载到 Windows 本地。

> 若 dump 文件默认所有者为 root，且通过域账户 SSH 登陆了 Linux，需先转移所有权：
> ```bash
> sudo chown yourdomainname@sinogram.cn:domain\ users@sinogram.cn ~/gitea-dump.zip
> ```

---

## 四、Windows 端环境准备

### 4.1 拉取固定版本镜像并校验

```powershell
docker pull gitea/gitea:1.22.3
docker run --rm gitea/gitea:1.22.3 gitea --version   # 输出必须包含 Gitea version 1.22.3
```

### 4.2 创建专属 Docker 网桥（仅执行一次，MySQL 变体必需）

```powershell
docker network create gitea-bridge
```

### 4.3 启动 Windows 端 MySQL 容器（MySQL 变体）

```powershell
# 清理旧容器、旧数据卷（异常启动时执行）
docker rm -f gitea-mysql
docker volume rm mysql-data

# 全新启动 MySQL，接入网桥
docker run -d `
--name gitea-mysql `
--network gitea-bridge `
-p 3306:3306 `
-e MYSQL_ROOT_PASSWORD=Root@2026 `
-e MYSQL_DATABASE=gitea `
-e MYSQL_USER=gitea `
-e MYSQL_PASSWORD=Gitea@2026 `
-v mysql-data:/var/lib/mysql `
--restart always `
10.10.11.194:1000/mysql:8.0
```

> 私有仓库镜像地址按实际填写，官方镜像则为 `mysql:8.0`。

---

## 五、放置业务文件并恢复

### 5.1 生成目录结构（两种变体通用）

1. 手动新建文件夹 `D:\gitea-local`，将 `gitea-dump.zip` 解压到临时文件夹，解压后典型内容：`app.ini`、`data`、`repos`、`custom`、`gitea-db.sql`（SQLite 变体无 `gitea-db.sql` 亦可）。
2. 临时启动空容器生成目录结构：

```powershell
docker run -d `
--name gitea `
-p 3000:3000 -p 2222:22 `
-v D:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

3. 等待 10 秒，停止并删除容器（只删容器，保留 D 盘文件夹）：

```powershell
docker stop gitea
docker rm gitea
```

### 5.2 覆盖备份文件（手动复制粘贴）

| 解压文件路径 | Windows 目标路径 | 说明 |
| ---- | ---- | ---- |
| 解压包/app.ini | D:\gitea-local\gitea\conf\app.ini | 主配置文件 |
| 解压包/repos/* | D:\gitea-local\git\repositories\ | Git 裸仓库数据 |
| 解压包/data/* | D:\gitea-local\gitea\ | 运行时数据（avatars/lfs/sessions 等，直接覆盖合并） |
| 解压包/custom/*（如有） | D:\gitea-local\custom\ | 自定义模板/配置，无则跳过 |

> 若从 `gitea_data_full.tar.gz` 解压，需将文件铺平为 `D:\gitea-local` 直接包含 `gitea`、`git` 等目录，禁止嵌套 `/data/gitea` 层级。

### 5.3 恢复数据库（按变体二选一）

**SQLite 变体**：`data` 目录中已包含 `gitea.db` 数据库文件，复制到 `D:\gitea-local\gitea\` 即可，**无需**导入 `gitea-db.sql`。

**MySQL 变体**：`data` 目录仅含 avatars/lfs/sessions 等运行时文件，不含数据库。`gitea-db.sql` 必须导入目标 MySQL：

```powershell
# 1. 先把 SQL 文件复制到 MySQL 容器内
docker cp D:\gitea\gitea_all_backup.sql gitea-mysql:/tmp/gitea_all_backup.sql
# 校验
docker exec -it gitea-mysql ls /tmp

# 2. 进入 MySQL 执行恢复
docker exec -it gitea-mysql mysql -u gitea -pGitea@2026 gitea
```
```sql
SET NAMES utf8mb4;
SOURCE /tmp/gitea_all_backup.sql;
exit;
```

```powershell
# 3. 校验用户数据（行数 > 0 代表导入正常）
docker exec gitea-mysql mysql -u gitea -pGitea@2026 gitea -e "SELECT COUNT(id) FROM user;"
```

---

## 六、修改 app.ini 关键配置

打开 `D:\gitea-local\gitea\conf\app.ini`。

### 6.1 数据库配置（MySQL 变体，解决 DNS 报错核心）

原 Linux 配置 `HOST=mysql`，Windows 修改为容器真实名称 `gitea-mysql`：

```ini
[database]
DB_TYPE = mysql
HOST = gitea-mysql
NAME = gitea
USER = gitea
PASSWD = Gitea@2026
LOG_SQL = false
SCHEMA =
SSL_MODE = disable
```

### 6.2 服务域名适配 Windows 本地访问

```ini
[server]
APP_DATA_PATH = /data/gitea
DOMAIN = localhost
SSH_DOMAIN = localhost
HTTP_PORT = 3000
ROOT_URL = http://localhost:3000/
DISABLE_SSH = false
SSH_PORT = 22
SSH_LISTEN_PORT = 22
SSH_BASE_URL = localhost:2222
LFS_START_SERVER = true
LFS_JWT_SECRET = 保持和 Linux 完全一致
OFFLINE_MODE = true
```

### 6.3 仓库与 LFS 路径（保持原样）

```ini
[repository]
ROOT = /data/git/repositories

[lfs]
PATH = /data/git/lfs
```

### 6.4 关闭邮件（可选，避免日志报错）

```ini
ENABLE_NOTIFY_MAIL = false
; 整段 [mailer] 全部注释
```

> **重要**：`SECRET_KEY`、`INTERNAL_TOKEN`、`LFS_JWT_SECRET` 必须和 Linux 原样保留，不可改动，否则登录、LFS 全部异常。删除 Linux 服务器独有配置：邮箱、LDAP、Webhook、外部存储等。

---

## 七、Windows 启动 Gitea 容器

### 7.1 MySQL 变体（绑定同一网桥）

```powershell
# 删除旧异常容器
docker rm -f gitea

docker run -d `
--name gitea `
--network gitea-bridge `
-p 3000:3000 -p 2222:22 `
-v D:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

### 7.2 SQLite 变体（无需网桥）

```powershell
docker run -d `
--name gitea `
-p 3000:3000 -p 2222:22 `
-v D:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

### 7.3 重启加载新配置

```powershell
docker restart gitea
docker logs gitea        # 日志无数据库连接报错，代表连通正常
```

---

## 八、全量验收步骤

1. 网页访问 `http://localhost:3000`，使用 Linux 原有账号密码正常登录。
2. 代码仓库全部可见，Git HTTP/SSH 可正常拉取、推送（SSH 地址 `git@localhost:2222`）。
3. 工单、附件、头像、权限、团队全部和 Linux 一致。
4. 执行仓库自检无报错：

```powershell
docker exec -u git gitea gitea admin repo check --all
```

5. 查看 Gitea 运行日志无数据库 DNS、连接报错：

```powershell
docker logs gitea
```

6. 仓库自检命令：

```powershell
docker exec -u git gitea gitea admin repo check --all
```

---

## 九、常见故障排查清单

| 现象 | 原因 / 修复 |
| ---- | ---- |
| `dial tcp: lookup xxx no such host` | Gitea 与 MySQL 不在同一个网桥 / HOST 名称和容器名不匹配。修复：双容器加入 `gitea-bridge`，HOST 固定填写 `gitea-mysql`。 |
| MySQL 容器反复启动失败 | 旧数据卷残留账号密码冲突、3306 端口被 Windows 本地 MySQL 占用。修复：`docker volume rm mysql-data` 重建；或修改端口映射 `-p 3307:3306`。 |
| 登录成功但仓库空白 | Windows 本地目录层级错误。修复：确保挂载目录 `D:\gitea-local` 直接包含 gitea、git 目录，不能嵌套 `/data` 层级。 |
| 仓库 404 | repos 文件夹未完整拷贝到 git/repositories。 |
| 网页依旧跳转旧地址 | 修改 ROOT_URL，清空浏览器缓存后重启容器。 |
| SSH 拉取失败 | 确认 SSH_BASE_URL=localhost:2222 / SSH_DOMAIN 配置正确。 |
| 账号密码登录失败 / LFS 拉取失败 | SQL 导入不全，或改动 `SECRET_KEY`、`INTERNAL_TOKEN`、`LFS_JWT_SECRET`。重新导出+导入，密钥保持与 Linux 一致。 |
| Linux mysqldump 报 PROCESS 权限不足 | 备份命令增加 `--no-tablespaces`。 |
| Linux Gitea 容器内 mysqldump 报 caching_sha2_password 插件缺失 | 放弃容器内备份，改用 Linux 宿主机通过 MySQL 内网 IP 导出。 |
| Docker 管道报错 | 重启 Docker Desktop，等待绿色就绪再执行 docker 命令。 |
| Windows 路径报错 | 禁止使用中文/桌面路径，统一使用盘符英文目录。 |

---

## 十、固定环境参数对照表

| 项目 | 参数值 |
| ---- | ---- |
| Windows MySQL 容器名 | gitea-mysql |
| Gitea 数据库 HOST | gitea-mysql |
| 数据库名 | gitea |
| 数据库账号 | gitea |
| 数据库密码 | Gitea@2026 |
| MySQL root 密码 | Root@2026 |
| 互通 Docker 网络 | gitea-bridge |
| Gitea 网页端口 | 3000 |
| Gitea SSH 端口 | 2222 |
| 挂载本地目录 | D:/gitea-local:/data |


