# SSH方式连接本地Gitea并拉取推送代码操作文档

## 一、文档说明

本文档记录**通过SSH协议连接本地部署Gitea服务**，实现代码仓库拉取、推送的完整操作流程。本次方案核心解决方式为：在本地用户的`.ssh`目录下手动创建`config`配置文件，自定义Gitea SSH连接规则，规避默认SSH连接适配问题，实现稳定的Gitea代码托管交互，适用于本地私有化部署的Gitea服务环境。

**适用场景**：本地服务器部署Gitea、客户端通过SSH协议免密/指定配置拉取、推送Gitea仓库代码

**核心方案**：本地\.ssh目录新增config配置文件，定制Gitea SSH连接参数

## 二、前置环境准备

### 2\.1 基础环境校验

- 本地客户端（Windows/Linux/Mac）已安装Git工具，可通过 `git --version` 校验安装状态

- 本地Gitea服务已正常启动，Web端可正常访问，仓库已创建完成

- 客户端与Gitea服务器网络互通，Gitea SSH端口未被防火墙拦截（默认SSH端口22，可自定义）

### 2\.2 生成本地SSH密钥对

若本地未配置SSH密钥，需先生成密钥对，用于Gitea账号免密认证：

1. 打开终端（Git Bash / 系统终端），执行密钥生成命令：
        `ssh-keygen -t ed25519 -C "你的Gitea注册邮箱"`

2. 全程默认回车，无需设置密码（如需密码认证可自行设置），密钥会自动生成在用户目录下的`.ssh`文件夹中

3. 生成完成后，`.ssh`目录下包含两个文件：`id_ed25519`（私钥，保密）、`id_ed25519.pub`（公钥，用于Gitea配置）

### 2\.3 Gitea账号绑定SSH公钥

1. 终端执行命令查看并复制公钥内容：
        `# Linux/Mac
cat ~/.ssh/id_ed25519.pub

# Windows Git Bash
cat ~/.ssh/id_ed25519.pub`

2. 登录本地Gitea Web后台，进入 **个人设置 \-\> SSH密钥**

3. 粘贴复制的公钥内容，填写自定义密钥名称，点击保存，完成Gitea账号SSH认证绑定

## 三、核心配置：\.ssh目录创建config文件

此步骤为本次解决方案核心，通过自定义config文件，指定Gitea的SSH连接地址、端口、密钥、用户名等参数，解决默认SSH连接适配异常问题。

### 3\.1 进入本地\.ssh目录

终端执行跳转命令，进入用户SSH配置根目录：

```bash
# 所有系统通用
cd ~/.ssh
```

若提示目录不存在，执行 `mkdir ~/.ssh` 创建目录后再进入

### 3\.2 创建并编辑config配置文件

在\.ssh目录下新建无后缀名的`config`文件，写入Gitea SSH连接配置，文件内容如下（根据实际环境修改参数）：

```bash
# Gitea SSH连接自定义配置
Host gitea-local                 # 自定义别名（后续git clone可直接使用）
    HostName 你的Gitea服务器IP    # 本地Gitea部署的服务器IP地址
    Port 22                       # Gitea SSH端口（默认22，自定义端口需对应修改）
    User git                      # Gitea默认SSH登录用户，固定为git
    IdentityFile ~/.ssh/id_ed25519 # 本地SSH私钥绝对路径
    StrictHostKeyChecking no      # 跳过主机密钥校验，避免首次连接弹窗报错
```

### 3\.3 配置文件权限设置（必做）

SSH对config文件权限有严格要求，权限过大会导致配置失效，执行以下命令修正权限：

```bash
# Linux/Mac 权限配置
chmod 600 ~/.ssh/config
chmod 700 ~/.ssh
```

Windows系统无需手动修改权限，保存文件即可。

## 四、SSH连通性测试

配置完成后，测试本地客户端与Gitea的SSH连接是否正常：

```bash
ssh -T gitea-local
```

**成功返回结果**：出现 `Hi [你的Gitea用户名]! You've successfully authenticated, but Gitea does not provide shell access.` 即代表连接配置生效、认证成功。

若报错，优先检查：IP地址、端口、私钥路径是否正确，Gitea公钥是否绑定成功、防火墙是否放行端口。

## 五、SSH方式拉取、推送Gitea代码

连接测试通过后，即可通过SSH协议完成Gitea仓库的代码克隆、提交、推送、拉取操作。

### 5\.1 克隆Gitea仓库代码

使用自定义别名克隆仓库（无需填写复杂IP端口，简化命令）：

```bash
# 格式：git clone 自定义别名:Gitea用户名/仓库名.git
git clone gitea-local:admin/test-project.git
```

也可使用原生SSH地址克隆：`git clone git@服务器IP:admin/test-project.git`

### 5\.2 本地代码提交与推送到Gitea

进入本地仓库目录，执行常规Git操作，推送代码至本地Gitea服务：

```bash
# 进入仓库目录
cd test-project

# 新增/修改文件后，提交缓存
git add .
git commit -m "本次更新说明"

# 推送到Gitea远程仓库
git push origin main
```

### 5\.3 拉取Gitea远程仓库最新代码

```bash
git pull origin main
```

## 六、常见问题排查

- **问题1：Permission denied \(publickey\)**
解决方案：检查Gitea后台是否正确绑定公钥、config文件私钥路径是否匹配、本地私钥文件权限是否正常

- **问题2：Connection refused**
解决方案：核对Gitea服务器IP、SSH端口是否正确，服务器防火墙、安全组是否放行对应端口

- **问题3：config配置不生效**
解决方案：确认config文件无后缀名、文件权限为600，重启终端重新测试连接

## 七、方案总结

本次通过 `.ssh/config` 自定义配置文件的方式，规避了默认SSH连接本地Gitea的适配问题，通过固定Gitea SSH连接参数、绑定密钥认证，实现了**免密、稳定、高效**的Gitea代码拉取与推送。该方案配置一次永久生效，后续所有Gitea仓库的Git操作均可直接使用，无需重复配置，适配长期本地私有化Gitea部署使用场景。

> （注：部分内容可能由 AI 生成）
