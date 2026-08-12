# 完整分步迁移流程：Linux MySQL → Docker MySQL + Gitea本地复原
## 一、Linux服务器导出完整MySQL备份
登录Linux机器，执行导出命令，全量导出gitea库所有表、数据、配置。
```bash
# 输入gitea账号的数据库密码Gitea@2026
mysqldump -u gitea -p gitea --single-transaction --default-character-set=utf8mb4 > ~/gitea_all_backup.sql
```
参数说明：
1. `--single-transaction`：InnoDB热备份，不用锁表
2. 强制utf8mb4，适配中文、emoji，避免乱码

导出文件路径：`/home/tengfei.ma@sinogram.cn/gitea_all_backup.sql`
用WinSCP把这个sql文件下载到Windows本地，建议放到路径 `D:\gitea\gitea_all_backup.sql`。

## 二、Windows 将SQL文件传入Docker MySQL容器
### 1. 拷贝本地sql进mysql容器内
打开Windows PowerShell执行：
```powershell
docker cp D:\gitea\gitea_all_backup.sql gitea-mysql:/tmp/
```
校验文件是否传入：
```powershell
docker exec -it gitea-mysql ls /tmp
```
能看到`gitea_all_backup.sql`代表成功。

### 2. 容器内MySQL执行导入恢复数据
```powershell
docker exec -it gitea-mysql mysql -u gitea -pGitea@2026 gitea
```
进入mysql命令行后执行：
```sql
SET NAMES utf8mb4;
SOURCE /tmp/gitea_all_backup.sql;
```
等待执行完毕，输入`exit`退出。

### 3. 校验数据导入结果
简单核对用户表是否存在数据：
```powershell
docker exec -it gitea-mysql mysql -u gitea -pGitea@2026 gitea -e "select count(*) from user;"
```
返回行数大于0，说明用户数据完整导入。

## 三、确认Docker网络互通（Gitea ↔ MySQL）
### 1. 提前创建专属网桥（只需要执行一次）
```powershell
docker network create gitea-bridge
```

### 2. MySQL容器接入网桥
```powershell
# 删除旧容器
docker rm -f gitea-mysql
# 重启mysql，绑定gitea-bridge网络
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
10.10.11.194:1000/mysql:你的mysql标签
```

### 3. Gitea容器也接入同一个网桥
先停止并删除旧Gitea容器：
```powershell
docker rm -f gitea
```
启动Gitea，挂载本地文件目录、绑定网络：
```powershell
docker run -d `
--name gitea `
--network gitea-bridge `
-p 3000:3000 -p 2222:22 `
-v D:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

## 四、最终版app.ini完整配置（适配Docker MySQL）
打开`D:\gitea-local\gitea\conf\app.ini`，替换关键内容，其余配置原样保留。
### 核心修改区块
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
LFS_JWT_SECRET = fF32QJVJJayVRxY75OZflHvHgOgJ_-Q-O9rah0H310c
OFFLINE_MODE = true

[database]
DB_TYPE = mysql
HOST = gitea-mysql
NAME = gitea
USER = gitea
PASSWD = Gitea@2026
LOG_SQL = false
SCHEMA =
SSL_MODE = disable

[repository]
ROOT = /data/git/repositories

[lfs]
PATH = /data/git/lfs
```
1. HOST写容器名`gitea-mysql`，同网桥Docker可直接域名访问
2. DOMAIN、SSH_DOMAIN改为localhost，杜绝内网IP残留
3. 仓库、LFS路径无需修改，容器内路径完全和Linux一致

### 邮件优化（可选，推荐注释）
本地不需要企业邮箱推送，注释全部mailer配置，关闭邮件通知：
```ini
ENABLE_NOTIFY_MAIL = false

;[mailer]
;PASSWD = MeFBpnXmZCtbdX7B
;ENABLED = true
;FROM = tfs_notify@sinounion.com
;USER = tfs_notify@sinounion.com
;HOST = smtp.qiye.aliyun.com:465
;TLS_TYPE = ssl
;SMTP_ADDR = smtp.qiye.aliyun.com
;SMTP_PORT = 465
```

## 五、重启Gitea加载新配置
```powershell
docker restart gitea
```
查看启动日志排查报错：
```powershell
docker logs gitea
```
日志无数据库连接报错，代表连通正常。

## 六、全量完整性校验
1. **网页登录验证**
浏览器打开 `http://localhost:3000`，使用Linux原有账号密码登录，账号、权限全部和线上一致。

2. **仓库文件校验**
所有代码仓库、LFS大文件、头像、附件、工单图片都正常加载（本地目录层级已经平铺对齐容器/data，文件完整）。

3. **仓库自检命令**
```powershell
docker exec -u git gitea gitea admin repo check --all
```
无报错=所有仓库文件、数据库关联正常。

4. **Git推拉测试**
测试HTTP/SSH克隆代码，SSH地址为 `git@localhost:2222`，可正常拉取推送。

## 七、常见故障兜底方案
1. Gitea报连不上MySQL
进入Gitea容器ping mysql容器名，确认网络：
```powershell
docker exec -it gitea ping gitea-mysql
```
ping不通：两个容器没加入同一个`gitea-bridge`网桥，重新按步骤绑定网络。

2. 仓库404
Windows目录层级错误，必须保证`D:\gitea-local`直接包含git、gitea、ssh文件夹，不能嵌套data/gitea。

3. 账号密码登录失败
SQL导入不全，重新执行Linux导出+容器内导入；不要修改app.ini里`SECRET_KEY、INTERNAL_TOKEN、LFS_JWT_SECRET`，密钥改动会鉴权失效。

4. LFS拉取失败
确认app.ini的LFS_JWT_SECRET和Linux完全一致，密钥不能改动。