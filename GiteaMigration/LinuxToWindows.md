# Gitea 跨服务器完整迁移操作文档
## 一、整体迁移说明
将 Linux 宿主机 Docker 运行的 Gitea 全量迁移至 Windows Docker Desktop，包含**代码仓库文件完整迁移+MySQL数据库全量备份恢复**，保证账号、权限、仓库、工单、配置100%对齐。
### 核心矛盾复盘
1. Linux 环境 Gitea 数据库地址写 `HOST=mysql`，MySQL容器名为`gitea-mysql`、同自定义Docker网络可域名互通；Windows端MySQL容器名改为`gitea-mysql`，域名不匹配导致DNS解析失败。
2. Linux MySQL运行在Docker自定义网络，宿主机无法直连，需要通过容器内网IP备份数据库。
3. Alpine Gitea容器内置MariaDB客户端加密插件缺失，无法直接备份MySQL，改为Linux宿主机带内网IP导出。

---

## 二、Linux 源服务器操作（数据库备份+仓库文件拷贝）
### 2.1 确认Linux网络与MySQL内网IP
1. 查看Docker网络
```bash
docker network ls
```
确认Gitea、MySQL均在 `docker-gitea_default` 网络。
2. 查看网络详情获取MySQL容器IP
```bash
docker network inspect docker-gitea_default
```
查到MySQL内网地址：`172.18.0.3`

### 2.2 Linux宿主机导出MySQL全量备份
规避权限报错，增加`--no-tablespaces`参数，完整命令：
```bash
mysqldump -h 172.18.0.3 -u gitea -p gitea --single-transaction --default-character-set=utf8mb4 --no-tablespaces > ~/gitea_all_backup.sql
```
输入数据库密码：`Gitea@2026`
3. 校验文件
```bash
ls ~/gitea_all_backup.sql
```

### 2.3 拷贝两类文件到Windows
1. 数据库文件：`/home/tengfei.ma/gitea_all_backup.sql`
2. Gitea全部业务目录：Linux路径`/data/gitea/gitea`，完整打包，拷贝至Windows路径 `D:\gitea-local`
> 目录要求：D:\gitea-local 下直接存在gitea、git等文件夹，禁止多层嵌套。

---

## 三、Windows Docker 环境准备
### 3.1 拉取私有仓库MySQL镜像
```powershell
docker pull 10.10.11.194:1000/mysql:8.0
```

### 3.2 创建专属Docker网桥（Gitea与MySQL互通必备）
仅执行一次：
```powershell
docker network create gitea-bridge
```

### 3.3 启动Windows端MySQL容器（接入网桥）
```powershell
# 清理旧容器、旧数据卷（异常启动时执行）
docker rm -f gitea-mysql
docker volume rm mysql-data

# 全新启动MySQL
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

### 3.4 Windows导入MySQL备份
1. 将E盘备份文件传入MySQL容器
```powershell
docker cp E:\Gitea_backup\gitea_all_backup.sql gitea-mysql:/tmp/
```
2. 校验文件
```powershell
docker exec gitea-mysql ls /tmp
```
3. 进入MySQL执行恢复
```powershell
docker exec -it gitea-mysql mysql -u gitea -pGitea@2026 gitea
```
```sql
SET NAMES utf8mb4;
SOURCE /tmp/gitea_all_backup.sql;
exit;
```
4. 简单校验用户数据
```powershell
docker exec gitea-mysql mysql -u gitea -pGitea@2026 gitea -e "SELECT COUNT(id) FROM user;"
```
返回行数＞0代表导入正常。

---

## 四、Windows 修改Gitea核心配置文件
文件路径：`D:\gitea-local\gitea\conf\app.ini`
### 4.1 数据库配置（解决DNS域名报错核心）
原Linux配置HOST=mysql，Windows修改为容器真实名称`gitea-mysql`
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

### 4.2 服务域名适配Windows本地访问
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
LFS_JWT_SECRET = 保持和Linux完全一致
OFFLINE_MODE = true
```

### 4.3 关闭邮件（避免日志报错）
```ini
ENABLE_NOTIFY_MAIL = false
# 整段 [mailer] 全部注释
```
> 重要：SECRET_KEY、INTERNAL_TOKEN、LFS_JWT_SECRET必须和Linux原样保留，不可改动，否则登录、LFS全部异常。

---

## 五、Windows启动Gitea容器（绑定同一网桥）
```powershell
# 删除旧异常Gitea容器
docker rm -f gitea

# 正式启动
docker run -d `
--name gitea `
--network gitea-bridge `
-p 3000:3000 -p 2222:22 `
-v D:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

---

## 六、全量验收步骤
1. 网页访问：`http://localhost:3000`，使用Linux原有账号密码正常登录。
2. 代码仓库全部可见，Git HTTP/SSH可正常拉取、推送。
3. 工单、附件、头像、权限、团队全部和Linux一致。
4. 执行仓库自检无报错：
```powershell
docker exec -u git gitea gitea admin repo check --all
```
5. 查看Gitea运行日志无数据库DNS、连接报错：
```powershell
docker logs gitea
```

---

## 七、常见故障排查清单
1. **dial tcp: lookup xxx no such host**
   原因：Gitea与MySQL不在同一个网桥 / HOST名称和容器名不匹配。
   修复：双容器加入`gitea-bridge`，HOST固定填写`gitea-mysql`。

2. MySQL容器反复启动失败
   原因：旧数据卷残留账号密码冲突、3306端口被Windows本地MySQL占用。
   修复：`docker volume rm mysql-data`重建；或修改端口映射`-p 3307:3306`。

3. Linux mysqldump报PROCESS权限不足
   修复：备份命令增加 `--no-tablespaces`。

4. Linux Gitea容器内mysqldump报caching_sha2_password插件缺失
   修复：放弃容器内备份，改用Linux宿主机通过MySQL内网IP导出。

5. 登录成功但仓库空白
   原因：Windows本地目录层级错误。
   修复：确保挂载目录`D:\gitea-local`直接包含gitea、git目录，不能嵌套/data层级。

---

## 八、固定环境参数对照表
|项目|参数值|
| ---- | ---- |
|Windows MySQL容器名|gitea-mysql|
|Gitea数据库HOST|gitea-mysql|
|数据库名|gitea|
|数据库账号|gitea|
|数据库密码|Gitea@2026|
|MySQL root密码|Root@2026|
|互通Docker网络|gitea-bridge|
|Gitea网页端口|3000|
|Gitea SSH端口|2222|
|挂载本地目录|D:/gitea-local:/data|