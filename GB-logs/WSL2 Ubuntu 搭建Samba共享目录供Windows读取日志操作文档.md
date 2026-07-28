# WSL2 Ubuntu 搭建Samba共享目录供Windows读取日志操作文档

## 一、文档说明

本文档适用于 **Windows \+ WSL2 Ubuntu22\.04** 环境，模拟「局域网Linux服务器共享日志文件夹，Windows客户端读取日志文件」的业务场景。

区别于Docker Desktop自带的精简BusyBox系统，本方案使用完整Ubuntu系统，支持Samba服务部署，可完全复刻真实内网Linux日志共享、读取流程，适用于开发测试、日志采集验证。

## 二、前置环境准备

### 2\.1 环境基础信息

- 宿主系统：Windows 10/11（已开启WSL2功能、安装Docker Desktop）

- 子系统：WSL2 Ubuntu 22\.04（完整Linux系统，非Docker精简BusyBox）

- 实现功能：Ubuntu新建日志目录 → 配置Samba共享 → Windows资源管理器直接访问、读取、拷贝日志文件

### 2\.2 安装WSL2完整Ubuntu系统

1\. 以**管理员身份**打开Windows终端/PowerShell

2\. 执行命令安装Ubuntu22\.04

```powershell
wsl --install -d Ubuntu-22.04
```

3\. 初始化系统：根据提示设置自定义用户名、登录密码（无特殊要求，简洁小写即可）

4\. 验证WSL版本，确认为WSL2模式

```powershell
wsl -l -v
```

输出结果中对应Ubuntu版本为2，即为环境正常。

## 三、Ubuntu端Samba服务部署配置

### 3\.1 安装Samba服务

打开Ubuntu终端，执行更新与安装命令：

```bash
sudo apt update
sudo apt install samba samba-common-bin -y
```

### 3\.2 配置Samba访问账号

Samba需独立密码（与系统登录密码可不同），使用当前Ubuntu系统用户创建密码：

```bash
sudo smbpasswd -a 你的Ubuntu用户名
```

执行后输入两次自定义密码（Windows访问共享目录时使用）。

### 3\.3 创建测试日志目录与日志文件

新建专属日志文件夹，模拟业务日志目录，并生成测试日志：

```bash
mkdir -p ~/applog
echo "test log 20260702" >> ~/applog/app.log
chmod -R 755 ~/applog
```

### 3\.4 修改Samba配置文件

1\. 打开配置文件

```bash
sudo nano /etc/samba/smb.conf
```

2\. 在文件**最末尾**添加以下共享配置（严格对应上述日志目录）

```ini
[applog]
    path = /home/你的Ubuntu用户名/applog
    browseable = yes
    read only = yes
    guest ok = no
    valid users = 你的Ubuntu用户名
    create mask = 0644
    directory mask = 0755
```

3\. 保存退出：**Ctrl\+O → 回车 → Ctrl\+X**

配置说明：read only=yes 限制Windows仅读取日志，防止误删、误改日志文件，保障数据安全。

### 3\.5 校验配置并重启服务

1\. 校验Samba配置语法是否正确

```bash
testparm
```

出现 `Loaded services file OK` 即为配置无误，按回车展示完整配置。

2\. 重启Samba服务使配置生效

```bash
sudo service smbd restart
sudo service nmbd restart
```

### 3\.6 获取Ubuntu内网IP

```bash
hostname -I
```

记录输出的172段内网IP，用于Windows访问共享目录。

## 四、Windows端访问Linux共享日志目录

### 4\.1 快速访问（临时查看日志）

1\. 按下 **Win\+R** 打开运行窗口

2\. 输入共享地址：`\\Ubuntu内网IP\applog`

3\. 弹窗输入认证信息：

- 用户名：你的Ubuntu系统用户名

- 密码：3\.2步骤设置的Samba独立密码

认证通过后，即可查看、复制、读取Linux内的所有日志文件。

### 4\.2 映射网络驱动器（永久访问）

1\. 打开Windows「此电脑」，右键选择「映射网络驱动器」

2\. 选择空闲盘符（如Z盘），文件夹填写：`\\Ubuntu内网IP\applog`

3\. 勾选「登录时重新连接」，输入Samba账号密码

4\. 完成后此电脑常驻日志磁盘，可随时访问，无需重复输入地址。

## 五、核心优缺点（日志采集场景）

### 5\.1 优点

- 部署简单、零复杂组件，适合开发测试场景

- Windows原生访问，无需SSH、定时脚本，操作直观

- 只读权限配置，保护Linux原始日志文件不被篡改

### 5\.2 缺点

- 无实时推送能力，仅支持手动/定时拷贝日志

- 内网明文传输文件内容，仅适用于内网信任测试环境，不建议生产使用

## 六、常见问题排查

### 6\.1 Windows提示「找不到网络路径」

- 确认Ubuntu IP输入正确，双方网络互通（可互相ping通）

- Windows防火墙放行「文件和打印机共享」专用网络权限

- 重启Ubuntu Samba服务：`sudo service smbd restart`

### 6\.2 访问成功但看不到日志文件/权限拒绝

- 执行目录权限修复命令：`chmod -R 755 ~/applog`

- 核对samba\.conf配置内的路径、用户名是否与实际一致

### 6\.3 WSL重启后无法访问共享

WSL2重启后Samba服务不会自启，重新执行服务重启命令即可。

## 七、场景总结

本方案完美模拟**局域网独立Linux服务器共享日志、Windows终端读取**的真实业务流程，区别于WSL原生`\\wsl$`直通访问，完全复刻了跨设备共享场景，可用于日志采集功能测试、内网文件传输验证、软件开发调试等场景。

> （注：部分内容可能由 AI 生成）
