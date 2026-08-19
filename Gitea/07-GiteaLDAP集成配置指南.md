# Gitea 与企业 LDAP 集成配置指南

> 文档版本：v1.0 | 编制日期：2026-06-18 | 适用版本：Gitea 1.21+

---

## 1. 概述

Gitea 支持与企业内部的 LDAP 目录服务（如 Active Directory、OpenLDAP、FreeIPA 等）进行集成，实现统一身份认证。集成后，员工可以使用域账号直接登录 Gitea，无需单独注册和维护另一套账号密码。

集成后可实现的核心能力包括：域账号统一登录 Gitea、用户自动注册（首次登录自动创建 Gitea 账号）、定期同步用户信息（姓名、邮箱等）、管理员权限自动映射（基于 LDAP 组）。

---

## 2. 前置条件

- Gitea 已通过 Docker Compose 部署并正常运行（建议版本 1.21 及以上）。
- 企业内部已部署 LDAP 服务（Active Directory、OpenLDAP、FreeIPA 等）。
- Gitea 服务器能够通过网络访问 LDAP 服务器（端口 389 或 636）。
- LDAP 管理员提供的连接参数（服务器地址、Base DN、Bind DN 等）。

---

## 3. 认证模式选择

Gitea 提供两种 LDAP 认证模式，需要根据企业 LDAP 环境选择合适的方式。

### 3.1 LDAP (via BindDN) — 推荐方式

使用专用的服务账号（Bind DN）连接 LDAP 服务器，先搜索用户条目，再用用户提供的密码进行验证。这种方式更灵活，支持用户自动同步和自动注册，适合大多数企业场景。

优点：

- 支持用户自动注册（首次登录自动创建 Gitea 账号）。
- 支持定期用户同步（默认每 24 小时）。
- 支持管理员权限自动映射。

### 3.2 LDAP (Simple Auth)

直接使用用户输入的凭据尝试绑定 LDAP 服务器，无需专用服务账号。配置更简单，但不支持用户自动同步和自动注册。

适用场景：LDAP 环境简单且用户数量少、不需要自动同步用户、没有权限创建专用 Bind DN 账号。

---

## 4. 配置步骤（BindDN 模式）

### 4.1 准备 LDAP 连接参数

在开始配置前，需要从 LDAP 管理员处获取以下信息：

| 参数 | 说明 / 示例 |
|------|------------|
| LDAP 服务器地址 | ldap.company.com 或 10.10.11.100 |
| 端口 | 389 (LDAP) / 636 (LDAPS) |
| Bind DN | cn=gitea_svc,ou=ServiceAccounts,dc=company,dc=com |
| Bind 密码 | Bind DN 账号对应的密码 |
| Base DN（用户搜索） | ou=People,dc=company,dc=com |
| 用户过滤规则 | (&(objectClass=person)(sAMAccountName=%s)) |

### 4.2 在 Gitea 管理面板添加认证源

1. 使用管理员账号登录 Gitea，点击右上角用户图标 → **Site Administration**。
2. 在左侧菜单选择 **Authentication Sources**（认证源）。
3. 点击 **Add Authentication Source**（添加认证源）。
4. Authentication Type 选择 **LDAP (via BindDN)**。
5. 填写配置参数（见下表）。
6. 点击 **Add Authentication Source** 保存。

### 4.3 配置参数详解

#### 4.3.1 基础设置

| 字段 | 示例值 | 说明 |
|------|--------|------|
| Authentication Name | Company LDAP | 认证源显示名称，任意取名 |
| Authorization Type | LDAP (via BindDN) | 选择认证模式 |
| Host | ldap.company.com | LDAP 服务器地址或 IP |
| Port | 389 | 389 (LDAP) / 636 (LDAPS) |
| Security Protocol | Unencrypted / TLS / LDAPS | 建议生产环境使用 TLS 或 LDAPS |

#### 4.3.2 Bind DN 配置

| 字段 | 示例值 | 说明 |
|------|--------|------|
| Bind DN | cn=gitea_svc,ou=ServiceAccounts,dc=company,dc=com | 用于连接 LDAP 的服务账号 DN |
| Bind Password | ******** | Bind DN 账号的密码 |
| User Search Base | ou=People,dc=company,dc=com | 搜索用户的 LDAP 基础路径 |
| User Filter | (&(objectClass=person)(sAMAccountName=%s)) | 用户查找过滤规则，`%s` 代表用户输入的登录名 |

#### 4.3.3 属性映射

属性映射决定了如何将 LDAP 目录中的用户信息填充到 Gitea 账号中：

| 字段 | AD 示例 | 说明 |
|------|---------|------|
| Username Attribute | sAMAccountName | 用户登录名对应的 LDAP 属性 |
| First Name Attribute | givenName | 名字（名） |
| Surname Attribute | sn | 姓氏（姓） |
| Email Attribute | mail | 邮箱地址，用于通知和账号关联 |
| Public SSH Key | （可留空） | 自动导入 SSH 公钥，一般不配置 |

---

## 5. 用户自动注册与同步

### 5.1 启用自动注册

在添加 LDAP 认证源时，勾选 **Allow an automatic registration** 选项。开启后，LDAP 用户首次登录 Gitea 时会自动创建对应的 Gitea 账号，无需管理员手动添加。

### 5.2 启用定期同步

勾选 **Enable User Synchronization** 选项，系统会启动周期性任务，定期将 LDAP 目录中的用户同步到 Gitea。默认同步周期为 24 小时，可通过 `docker-compose.yml` 环境变量调整：

```yaml
# docker-compose.yml 环境变量
- GITEA__cron.sync_external_users__SCHEDULE=@every 12h
```

同步任务会根据 User Filter 和 User Search Base 搜索 LDAP 目录，自动创建新用户、更新已有用户的姓名和邮箱等信息。如果 LDAP 中的用户被删除或禁用，可配置自动停用对应的 Gitea 账号。

---

## 6. 管理员权限映射

通过 **Admin Filter** 字段，可以将 LDAP 中特定组的成员自动赋予 Gitea 管理员权限。

### 6.1 Active Directory 示例

假设 AD 中有一个名为 GiteaAdmins 的安全组，Admin Filter 可配置为：

```
(memberOf=cn=GiteaAdmins,ou=Groups,dc=company,dc=com)
```

属于该组的用户登录 Gitea 后会自动获得管理员权限。

### 6.2 OpenLDAP 示例

```
(&(objectClass=posixAccount)(memberOf=cn=gitea-admins,ou=groups,dc=company,dc=com))
```

### 6.3 Restricted Filter（限制登录）

如果只希望特定组的用户能登录 Gitea，可以在 User Filter 中添加组限制：

```
(&(objectClass=person)(sAMAccountName=%s)(memberOf=cn=DevTeam,ou=Groups,dc=company,dc=com))
```

这样只有 DevTeam 组的成员才能登录 Gitea，其他域用户将被拒绝。

---

## 7. Docker Compose 完整配置参考

以下是结合了 LDAP 集成和邮件通知的完整 `docker-compose.yml` 配置示例：

```yaml
version: "3"

services:
  gitea:
    image: gitea/gitea:latest
    container_name: gitea
    environment:
      - USER_UID=1000
      - USER_GID=1000

      # 服务器配置
      - GITEA__server__ROOT_URL=http://10.10.11.194:3000/
      - GITEA__server__DOMAIN=10.10.11.194
      - GITEA__server__HTTP_PORT=3000

      # 邮件通知 (SMTP)
      - GITEA__mailer__ENABLED=true
      - GITEA__mailer__HOST=smtp.qiye.aliyun.com:465
      - GITEA__mailer__FROM=tfs_notify@sinounion.com
      - GITEA__mailer__USER=tfs_notify@sinounion.com
      - GITEA__mailer__PASSWD=<SMTP_PASSWORD>
      - GITEA__mailer__IS_TLS_ENABLED=true
      - GITEA__service__ENABLE_NOTIFY_MAIL=true

      # 用户同步周期
      - GITEA__cron.sync_external_users__SCHEDULE=@every 12h

    volumes:
      - ./gitea-data:/data
    ports:
      - "3000:3000"
      - "222:22"
    restart: unless-stopped
```

> **注意：** LDAP 认证源的配置需要在 Gitea 管理面板的 Web UI 中添加，不能通过环境变量直接配置。上述 `docker-compose.yml` 仅配置了环境参数（服务器、邮件、同步周期），LDAP 认证源在第 4 章的 Web UI 步骤中完成。

---

## 8. 常见 LDAP 服务的过滤规则参考

### 8.1 Active Directory

| 用途 | 过滤规则 |
|------|---------|
| 用户搜索 | `(&(objectClass=person)(sAMAccountName=%s))` |
| 仅开发团队 | `(&(objectClass=person)(sAMAccountName=%s)(memberOf=cn=DevTeam,ou=Groups,dc=company,dc=com))` |
| 管理员映射 | `(memberOf=cn=GiteaAdmins,ou=Groups,dc=company,dc=com)` |

### 8.2 OpenLDAP

| 用途 | 过滤规则 |
|------|---------|
| 用户搜索 | `(&(objectClass=inetOrgPerson)(uid=%s))` |
| 仅特定部门 | `(&(objectClass=inetOrgPerson)(uid=%s)(ou=Engineering))` |
| 管理员映射 | `(&(objectClass=posixAccount)(memberOf=cn=gitea-admins,ou=groups,dc=company,dc=com))` |

---

## 9. 常见问题排查

### 9.1 LDAP 连接失败

**现象：** 添加认证源后测试连接报错。

- 检查 Gitea 容器是否能访问 LDAP 服务器：`docker exec -it gitea sh -c 'nc -zv ldap.company.com 389'`。
- 检查 Bind DN 和密码是否正确。
- 如果使用 LDAPS/TLS，检查证书信任问题，可尝试勾选 **Skip TLS Verify**（仅测试环境）。

### 9.2 用户登录失败但连接测试成功

**现象：** 认证源测试通过，但用户无法登录。

- 检查 User Filter 是否正确，确保 `%s` 占位符存在。
- 检查 User Search Base 是否指向正确的 OU。
- 检查 Username Attribute 是否与用户登录名匹配（AD 用 `sAMAccountName`，OpenLDAP 用 `uid`）。

### 9.3 用户自动注册失败

**现象：** LDAP 认证成功但没有自动创建账号。

- 确认已勾选 **Allow automatic registration**。
- 检查 Email Attribute 是否配置，Gitea 要求用户必须有邮箱。
- 检查 LDAP 用户的邮箱是否已被其他 Gitea 账号占用。

### 9.4 查看 Gitea 日志

当以上检查都无法定位问题时，可查看 Gitea 容器日志：

```bash
docker logs gitea --tail 200
# 或实时查看
docker logs -f gitea
```

---

## 10. 最佳实践建议

1. **使用专用服务账号作为 Bind DN**，不要使用管理员个人账号。
2. **生产环境必须使用 LDAPS 或 StartTLS** 加密连接。
3. **通过 Restricted Filter 限制只允许开发团队成员登录**，避免全员自动注册。
4. **利用 Admin Filter 集中管理管理员权限**，避免在 Gitea 中手动设置。
5. **定期检查用户同步日志**，确保离职人员账号被正确停用。
6. **保留一个本地管理员账号作为应急访问**，以防 LDAP 服务不可用。
