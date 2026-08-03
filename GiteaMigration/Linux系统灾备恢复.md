# Linux Gitea 整机重装灾备全方案
## 一、现状确认
Linux 环境的 MySQL、Gitea 均为 Docker 容器部署，**数据全部存在 Docker 内部卷/容器内，没有直接挂载到 Linux 宿主机目录**。重装系统后 Docker 所有容器、卷全部清空，必须提前手动导出两类数据：MySQL数据库、Gitea全部业务文件。

# 二、Linux 日常完整备份清单（每次灾备必须全量备份这2类）
## 清单1：MySQL全量SQL备份（必存）
路径：`~/gitea_all_backup.sql`
备份命令（固定可用，适配你环境）
```bash
docker network inspect docker-gitea_default
# 查到MySQL内网IP=172.18.0.3
mysqldump -h 172.18.0.3 -u gitea -p gitea --single-transaction --default-character-set=utf8mb4 --no-tablespaces > ~/gitea_all_backup.sql
```
输入密码：`Gitea@2026`

## 清单2：Gitea 完整业务目录（代码、配置、工单、附件、LFS、用户头像全在这里）
Linux宿主机Gitea容器挂载路径：`/data/gitea`
整个文件夹全量打包，包含：
- app.ini配置文件
- 所有git仓库源码
- issues、附件、图片
- LFS大文件
- 密钥（SECRET_KEY、JWT等，决定登录有效性）

打包命令：
```bash
# 压缩打包
tar -zcvf gitea_data_full.tar.gz /data/gitea
```

## 清单3：备份文件统一落地（推荐两种方式）
1. 方案A：复制到Linux本机独立磁盘分区（系统盘重装不影响数据盘）
2. 方案B：拷贝到局域网共享NAS、Windows共享文件夹、U盘
最终需要带走2个文件：
1. `gitea_all_backup.sql` 数据库文件
2. `gitea_data_full.tar.gz` 全部代码+配置文件

## 清单4：留存环境参数表（文字保存，重装必备）
| 项 | Linux原环境参数 |
|----|----------------|
| MySQL容器名 | gitea-mysql |
| Gitea容器名 | gitea |
| Docker网络 | docker-gitea_default |
| 数据库HOST（app.ini） | mysql |
| 库名 | gitea |
| DB账号 | gitea |
| DB密码 | Gitea@2026 |
| MySQL root密码 | Root@2026 |
| Gitea宿主机挂载目录 | /data/gitea |
| 网页端口 | 3000 |
| SSH端口 | 2222 |

# 三、Linux重装系统后完整恢复步骤
## 步骤1：重装Linux系统，重装Docker+Docker Compose
1. 重装操作系统，保证磁盘分区和原来一致；
2. 重装Docker、配置国内镜像加速；
3. 拉取所需镜像：
```bash
docker pull mysql:8.0
docker pull gitea/gitea:1.22.3
```

## 步骤2：把备份文件传回新Linux机器
将之前备份的2个文件上传到新Linux：
`gitea_all_backup.sql`、`gitea_data_full.tar.gz`

## 步骤3：恢复Gitea本地业务目录
1. 新建原挂载目录
```bash
mkdir -p /data/gitea
```
2. 解压备份包覆盖目录
```bash
tar -zxvf gitea_data_full.tar.gz -C /
```
解压后自动还原 `/data/gitea` 完整目录，原有配置、仓库全部复原。

## 步骤4：重建Docker专属网络（和原网络名完全一致）
```bash
docker network create docker-gitea_default
```

## 步骤5：启动Linux端MySQL容器（容器名必须叫mysql，适配原有app.ini）
> Windows容器名叫gitea-mysql，Linux必须命名为mysql，保证app.ini里HOST=mysql可以正常解析
```bash
docker rm -f mysql
docker run -d \
--name mysql \
--network docker-gitea_default \
-p 3306:3306 \
-e MYSQL_ROOT_PASSWORD=Root@2026 \
-e MYSQL_DATABASE=gitea \
-e MYSQL_USER=gitea \
-e MYSQL_PASSWORD=Gitea@2026 \
-v mysql-data:/var/lib/mysql \
--restart always \
mysql:8.0
```

## 步骤6：导入备份SQL到MySQL
1. 把sql文件放进mysql容器
```bash
docker cp gitea_all_backup.sql mysql:/tmp/
```
2. 进入MySQL执行恢复
```bash
docker exec -it mysql mysql -u gitea -pGitea@2026 gitea
```
```sql
SET NAMES utf8mb4;
SOURCE /tmp/gitea_all_backup.sql;
exit;
```

## 步骤7：启动Linux Gitea容器
```bash
docker rm -f gitea
docker run -d \
--name gitea \
--network docker-gitea_default \
-p 3000:3000 -p 2222:22 \
-v /data/gitea:/data \
-e TZ=Asia/Shanghai \
gitea/gitea:1.22.3
```

## 步骤8：校验恢复结果
1. 访问 `LinuxIP:3000`，旧账号密码直接登录；
2. 所有仓库、工单、附件、权限完全和重装前一致；
3. 校验数据库连通、Git推拉正常；
4. 自检命令：
```bash
docker exec -u git gitea gitea admin repo check --all
```

# 四、关键避坑要点（Linux和Windows最大区别）
1. Linux MySQL容器名必须是 `mysql`，不能是gitea-mysql。
   原因：Linux的app.ini写死`HOST=mysql`，容器名=域名，同网络DNS自动解析。
2. `/data/gitea` 目录权限不能乱改，解压必须完整还原；密钥（SECRET_KEY、LFS_JWT_SECRET）不能手动修改，备份原样保留即可。
3. 网络名称必须是 `docker-gitea_default`，和旧环境一模一样，否则容器互通失败。
4. 不要用Docker容器卷备份做跨系统恢复：Docker卷绑定主机ID，重装系统卷大概率损坏，**SQL+宿主机目录文件是唯一稳妥的跨重装备份方案**。

# 五、定期自动化备份建议（可写定时任务）
新增Linux定时任务每周全量备份并自动推送至共享盘：
```bash
# 1. 数据库自动备份
mysqldump -h 172.18.0.3 -u gitea -pGitea@2026 gitea --single-transaction --default-character-set=utf8mb4 --no-tablespaces > /backup/gitea_$(date +%Y%m%d).sql
# 2. 目录打包
tar -zcvf /backup/gitea_files_$(date +%Y%m%d).tar.gz /data/gitea
# 3. 自动拷贝到局域网共享盘
```