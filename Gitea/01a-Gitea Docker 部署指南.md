# Gitea Docker 部署指南

> 适用范围：使用 Docker 自托管 Gitea，面向 10–15 人小型团队。
>
> 版本：1.0 | 适用：Gitea 1.21+ / Docker Compose

---

## 一、为什么选择 Gitea + Docker

Gitea 是一款用 Go 编写的开源自托管 Git 平台，单二进制部署，内存占用低于 100MB，非常适合本地 Docker 环境运行。相比 GitLab CE（需要 4GB+ 内存），Gitea 在十几人团队场景下性价比最高，同时提供完整的权限管理、代码审查、CI/CD（Gitea Actions）等企业级功能。

---

## 二、前置硬性约束

1. **版本一致**：跨环境迁移时，源与目标必须使用严格相同的 Gitea 镜像版本（如 `gitea/gitea:1.22.3`），避免数据格式不兼容。
2. **数据库**：SQLite 或 MySQL（按实际环境选择对应方案）。
3. **Windows 路径要求**：全程无中文、无空格，示例使用 `D:\gitea-local`。
4. **Docker Desktop** 必须完整启动，右下角托盘为绿色运行状态。
5. 建议分配给 Docker 至少 2GB 内存（Settings → Resources）。
6. 网络可访问性：能访问目标 Docker 环境，能够拉取镜像。

### 验证 Docker 环境

```bash
docker --version
docker compose version
```

如果命令正常返回版本号，说明环境就绪。

---

## 三、Gitea Docker 部署

### 3.1 快速部署（SQLite 版）

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

> **注意：** SQLite 版本适合 1–3 人的个人使用，十几人团队建议升级到 MySQL 方案（见 3.2）。

### 3.2 生产部署（MySQL + Docker Compose，推荐）

创建项目目录并编写 `docker-compose.yml`：

```bash
mkdir gitea-server && cd gitea-server
```

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

启动服务：

```bash
docker compose up -d
```

等待约 30 秒让 MySQL 初始化完成，然后访问 `http://localhost:3000`。

### 3.3 拉取/校验固定版本镜像（跨环境迁移时使用）

```powershell
docker pull gitea/gitea:1.22.3
docker run --rm gitea/gitea:1.22.3 gitea --version   # 输出必须包含 Gitea version 1.22.3
```

### 3.4 初始化配置

在浏览器中打开 `http://localhost:3000`，完成以下设置：

1. **数据库设置**：已自动填入，确认即可。
2. **站点名称**：如"公司代码仓库"。
3. **服务器域名**：填写服务器的 IP 地址（局域网访问时填写内网 IP）。
4. **SSH 端口**：222。
5. **管理员账号**：在页面底部展开"管理员账号设置"创建。

### 3.5 数据存储结构

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

**关键理解：** Git 仓库的代码文件存在 `gitea-data/git/repositories/`，用户、权限、Issue 等业务元数据存在 `mysql-data/` 中。**两者都需要保护。**

---

## 四、网络访问配置

### 4.1 局域网访问

其他同事通过你的内网 IP 访问 Gitea：

```bash
ipconfig    # Windows
ifconfig    # macOS/Linux
```

假设 IP 为 `192.168.1.100`，同事访问地址为：

- Web 界面：`http://192.168.1.100:3000`
- Git clone（HTTP）：`git clone http://192.168.1.100:3000/组织名/仓库名.git`
- Git clone（SSH）：`git clone ssh://git@192.168.1.100:222/组织名/仓库名.git`

### 4.2 防火墙放行

Windows 需要放行 3000 和 222 端口：

```powershell
# Windows 防火墙放行（以管理员身份运行 PowerShell）
New-NetFirewallRule -DisplayName "Gitea Web" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Gitea SSH" -Direction Inbound -Port 222 -Protocol TCP -Action Allow
```

### 4.3 固定 IP（推荐）

为了避免路由器重新分配 IP 导致地址变化，建议：

- 在路由器中为本机绑定固定 IP（MAC 地址绑定）。
- 或者将 Gitea 部署到公司内网的固定服务器上。

---

## 五、常用运维命令

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

## 六、常见故障与问题

| 现象 | 处理 |
| ---- | ---- |
| 网页依旧跳转旧地址 | 修改 ROOT_URL，清空浏览器缓存后重启容器 |
| 仓库 404 | repos 文件夹未完整拷贝到 gitea-repositories |
| SSH 拉取失败 | 确认 SSH_BASE_URL=localhost:2222 / SSH_DOMAIN 配置正确 |
| Docker 管道报错 | 重启 Docker Desktop，等待绿色就绪再执行 docker 命令 |
| Windows 路径报错 | 禁止使用中文/桌面路径，统一使用 E 盘英文目录 |

**Q: 容器重启后数据会丢失吗？**
不会。所有数据都通过 `volumes` 挂载到了宿主机目录（`./gitea-data` 和 `./mysql-data`），容器重启不影响数据。只有 `docker compose down -v` 或手动删除这些目录才会丢数据。

**Q: 如何升级 Gitea 版本？**

```bash
docker compose pull      # 拉取最新镜像
docker compose up -d     # 重建容器（数据不受影响）
```

**Q: 大文件 push 失败怎么办？**

编辑 `gitea-data/gitea/conf/app.ini`，调整以下配置后重启：

```ini
[server]
MAX_UPLOAD_SIZE = 512     ; 单位 MB

[repository.upload]
FILE_MAX_SIZE = 100       ; 单个文件最大 MB
MAX_FILES = 10            ; 单次上传最大文件数
```

**Q: 如何修改监听端口？**

修改 `docker-compose.yml` 中的 ports 映射即可，例如改为 8080：

```yaml
ports:
  - "8080:3000"
```

然后 `docker compose up -d` 重建容器。

