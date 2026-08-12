# Linux Docker Gitea 1.22.3 迁移 Windows Docker Desktop 完整操作手册
## 前置硬性约束
1. Linux Gitea 版本：1.22.3，Windows 必须严格同版本 `gitea/gitea:1.22.3`
2. 数据库：SQLite 或 MySQL（按实际环境选择对应恢复方式）
3. Windows 路径要求：全程无中文、无空格，示例使用 `E:\gitea-local`
4. Docker Desktop 必须完整启动，右下角托盘为绿色运行状态

---

# 第一部分：Linux 服务器打包备份（可直接逐条复制）
## 1. 执行备份（解决根目录权限报错）
```bash
sudo docker exec -u git gitea gitea dump -c /data/gitea/gitea/conf/app.ini --output /data/gitea/gitea-dump.zip
```

## 2. 将备份文件从容器复制到 Linux 宿主机家目录
```bash
sudo docker cp gitea:/data/gitea/gitea-dump.zip ~/
```

## 3. 清理容器内多余备份文件（释放磁盘）
```bash
sudo docker exec gitea rm /data/gitea/gitea-dump.zip
```

## 4. 操作说明
将 Linux 家目录下的 `gitea-dump.zip` 通过 SFTP/网盘 下载到 Windows 本地。

---

# 第二部分：Windows 端准备（PowerShell 逐条执行）
## 1. Windows 拉取固定1.22.3镜像
```powershell
docker pull gitea/gitea:1.22.3
```

## 2. 校验镜像版本
```powershell
docker run --rm gitea/gitea:1.22.3 gitea --version
```
输出必须包含：`Gitea version 1.22.3`

## 3. Windows 创建本地空目录
手动新建文件夹：`E:\gitea-local`
将下载的 `gitea-dump.zip` 解压到 Windows 临时文件夹，解压后典型内容：
`app.ini`、`data`、`repos`、`gitea-db.sql`（可能还有 `custom`，视原始配置而定）

## 4. 临时启动空容器生成目录结构
```powershell
docker run -d `
--name gitea `
-p 3000:3000 -p 2222:22 `
-v E:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

## 5. 等待10秒，停止并删除容器（只删容器，保留E盘文件夹）
```powershell
docker stop gitea
docker rm gitea
```

---

# 第三部分：覆盖备份文件 + 修改配置
## 1. 文件覆盖对照表（手动复制粘贴）
| 解压文件路径 | Windows 目标路径 | 说明 |
| ---- | ---- | ---- |
| 解压包/app.ini | E:\gitea-local\gitea\conf\app.ini | 主配置文件 |
| 解压包/repos/* | E:\gitea-local\gitea-repositories\ | Git 裸仓库数据 |
| 解压包/data/* | E:\gitea-local\gitea\ | 运行时数据（avatars/lfs/sessions等，直接覆盖合并） |
| 解压包/custom/*（如有） | E:\gitea-local\custom\ | 自定义模板/配置，无则跳过 |

### 数据库恢复（按类型二选一）

**SQLite 用户**：data 目录中包含 `gitea.db` 数据库文件，复制到 `E:\gitea-local\gitea\` 即可，无需导入 `gitea-db.sql`。

**MySQL 用户**：data 目录仅含 avatars/lfs/sessions 等运行时文件，不含数据库。`gitea-db.sql` 必须导入到目标 MySQL 数据库：
```powershell
# 1. 确保 MySQL 已创建目标数据库（如 gitea）
# 2. 将 SQL 文件导入 MySQL（假设 MySQL 容器名为 mysql）
docker cp gitea-db.sql mysql:/tmp/gitea-db.sql
docker exec -i mysql mysql -u root -p<密码> gitea < gitea-db.sql
```
> 导入完成后，确认 app.ini 中 `[database]` 段的 DB_TYPE、HOST、NAME、USER、PASSWORD 指向正确的 MySQL 实例。

## 2. 修改 E:\gitea-local\gitea\conf\app.ini 关键配置
打开文件，找到并替换以下内容：
```ini
ROOT_URL = http://localhost:3000/
SSH_LISTEN_PORT = 22
SSH_BASE_URL = localhost:2222
```
删除Linux服务器独有配置：邮箱、LDAP、Webhook、外部存储等。

---

# 第四部分：Windows 最终启动Gitea
## PowerShell执行启动命令
```powershell
docker run -d `
--name gitea `
-p 3000:3000 -p 2222:22 `
-v E:/gitea-local:/data `
-e TZ=Asia/Shanghai `
gitea/gitea:1.22.3
```

---

# 第五部分：全套校验命令（必执行）
## 1. 查看容器运行状态
```powershell
docker ps | findstr gitea
```

## 2. 全仓库完整性自检
```powershell
docker exec -u git gitea gitea admin repo check --all
```
无报错=仓库底层文件完好。

## 3. 人工页面校验清单
1. 浏览器访问：`http://localhost:3000`，Linux账号密码可正常登录
2. 用户、组织、团队、仓库数量和Linux完全一致
3. Commit、分支、Tag、Issue、评论、附件、Wiki全部正常
4. Git HTTP/SSH可正常克隆、拉取、推送代码

---

# 第六部分：常见故障快速修复
1. 网页依旧跳转旧Linux地址：修改ROOT_URL，清空浏览器缓存重启容器
2. 仓库404：repos文件夹未完整拷贝到gitea-repositories
3. SSH拉取失败：确认SSH_BASE_URL=localhost:2222
4. Docker管道报错：重启Docker Desktop，等待绿色就绪再执行docker命令
5. Windows路径报错：禁止使用中文/桌面路径，统一使用E盘英文目录