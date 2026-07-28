# 审计日志方案设计

> **版本**: v1.0  
> **日期**: 2026-06-30  
> **状态**: 待评审  
> **作者**: —

---

## 1. 背景与目标

### 1.1 现状

当前系统的用户操作日志采用 **纯文件日志** 方案：

- 通过 `PetLogger.OperationLog()` 写入本地文件
- 存储路径：`C:\PoleStar\Sinogram.Log\Operation\{UserName}\LOG.yyyy-MM-dd.txt`
- 日志格式：`%date##Level##Detail`
- 查看界面通过 `OperationLogViewModel` 遍历文件目录、逐行解析

系统虽然已预留数据库日志写入能力（`tbl_log` 表 + `DBAppender`），但当前 **未启用**（`Log.Service/Program.cs` 中 `DBAppender` 被注释）。

### 1.2 问题

| 问题 | 说明 |
|------|------|
| 合规风险 | 文件可被手动删除/篡改，不满足医疗行业审计追溯要求 |
| 查询效率低 | 需遍历文件目录、逐行解析，无法利用索引 |
| 无法跨用户聚合 | 日志按用户分目录，无法统一查询"某段时间所有用户操作" |
| 无报表能力 | 无法基于日志做统计分析（如操作频次、异常操作统计） |
| 缺乏结构化 | 日志内容自由文本，缺少操作类型、关联患者/检查等结构化字段 |

### 1.3 目标

- 新增 **审计日志（Audit Log）** 机制，满足医疗合规要求
- 审计日志写入数据库，支持结构化查询与防篡改
- 保留现有文件操作日志，保持向后兼容
- 提供统一的日志门面，降低业务代码接入成本

---

## 2. 法规与标准依据

| 法规/标准 | 关键要求 |
|-----------|---------|
| **FDA 21 CFR Part 11** | 电子记录需具备审计追踪（Audit Trail），记录谁在何时做了什么修改 |
| **HIPAA** | 对受保护健康信息（PHI）的访问需有审计日志 |
| **NMPA 医疗器械软件指导原则** | 需具备操作追溯能力，关键操作可审计 |
| **DICOM / IHE ATNA** | 定义了医疗系统中审计事件的标准化格式 |

---

## 3. 方案设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      业务层 (ViewModel / BizLogic)           │
│                                                             │
│   PetLogger.OperationLog()  ← 原有操作日志（文件）           │
│   PetLogger.AuditLog()      ← 新增审计日志（文件 + DB）      │
└────────────┬─────────────────────────┬──────────────────────┘
             │                         │
             ▼                         ▼
┌────────────────────┐    ┌──────────────────────────────────┐
│   文件日志通道       │    │         数据库审计通道              │
│   (log4net)         │    │                                  │
│                     │    │  AuditLogService → IRepository   │
│  Operation/ 目录     │    │         ↓                        │
│  按用户/日期分文件    │    │      tbl_audit_log               │
│                     │    │                                  │
│  用途：运维排障      │    │  用途：合规审计、操作追溯、报表     │
└────────────────────┘    └──────────────────────────────────┘
```

### 3.2 设计原则

| 原则 | 说明 |
|------|------|
| **双通道写入** | 审计日志同时写入文件和数据库，文件日志用于运维兜底 |
| **失败不阻断** | 数据库写入失败不影响业务流程，降级到仅文件日志 |
| **职责分离** | 系统日志（`tbl_log`）与审计日志（`tbl_audit_log`）分开，避免耦合 |
| **向后兼容** | 原有 `OperationLog()` 保持不变，新增 `AuditLog()` 方法 |
| **防篡改** | 审计日志表数据库用户仅授予 INSERT 权限，禁止 UPDATE/DELETE |

---

## 4. 数据库设计

### 4.1 新建审计日志表

```sql
CREATE TABLE tbl_audit_log
(
  id              bigserial NOT NULL,
  user_name       varchar(50)  NOT NULL,              -- 操作人
  operation_time  timestamp    NOT NULL DEFAULT now(), -- 操作时间
  operation_type  varchar(50)  NOT NULL,              -- 操作类型（见枚举定义）
  module          varchar(50),                        -- 所属模块
  detail          text,                               -- 操作详情
  patient_id      varchar(50),                        -- 关联患者ID（可选）
  study_id        varchar(50),                        -- 关联检查ID（可选）
  ip_address      varchar(50),                        -- 操作终端IP
  result          varchar(20)  DEFAULT 'Success',     -- 操作结果: Success / Failed
  CONSTRAINT pk_audit_log PRIMARY KEY (id)
)
WITH (OIDS=FALSE);

-- 查询索引
CREATE INDEX idx_audit_log_time ON tbl_audit_log(operation_time DESC);
CREATE INDEX idx_audit_log_user ON tbl_audit_log(user_name);
CREATE INDEX idx_audit_log_type ON tbl_audit_log(operation_type);
CREATE INDEX idx_audit_log_patient ON tbl_audit_log(patient_id) WHERE patient_id IS NOT NULL;

ALTER TABLE tbl_audit_log OWNER TO sinouser;

COMMENT ON TABLE tbl_audit_log IS '审计日志表 - 记录用户关键操作，满足合规审计要求';
```

### 4.2 操作类型枚举定义

| 枚举值 | 说明 | 触发场景 |
|--------|------|---------|
| `LOGIN` | 用户登录 | 用户登录系统 |
| `LOGOUT` | 用户登出 | 用户退出系统 |
| `PROTOCOL_CREATE` | 新建协议 | 协议编辑模块 |
| `PROTOCOL_EDIT` | 修改协议 | 协议编辑模块保存 |
| `PROTOCOL_DELETE` | 删除协议 | 协议管理 |
| `SCAN_START` | 开始扫描 | 扫描流程 |
| `SCAN_ABORT` | 终止扫描 | 扫描流程 |
| `SCAN_COMPLETE` | 扫描完成 | 扫描流程 |
| `RECON_START` | 开始重建 | 重建任务 |
| `RECON_COMPLETE` | 重建完成 | 重建任务 |
| `WARMUP_START` | 开始预热 | CT球管预热 |
| `WARMUP_COMPLETE` | 预热完成 | CT球管预热 |
| `CALIBRATION_START` | 开始校正 | 快速校正 |
| `CALIBRATION_COMPLETE` | 校正完成 | 快速校正 |
| `QAQC_START` | 开始质控 | 无源质控 |
| `QAQC_COMPLETE` | 质控完成 | 无源质控 |
| `BED_MOVE` | 移床操作 | 床控制 |
| `LOG_EXPORT` | 日志导出 | 日志管理 |
| `USER_CONFIG_CHANGE` | 用户配置变更 | 系统管理 |
| `SYSTEM_CONFIG_CHANGE` | 系统配置变更 | 系统管理 |

> 枚举值可根据业务需求扩展，建议后续接入时按需补充。

### 4.3 与现有表的关系

```
tbl_log (现有系统日志)
  └── 用途：系统运行日志、异常记录
  └── 来源：Log Service 自动写入
  └── 当前状态：DBAppender 已禁用

tbl_audit_log (新增审计日志)
  └── 用途：用户操作审计追踪
  └── 来源：业务代码主动调用 AuditLog()
  └── 特点：结构化、可查询、防篡改

tbl_history_sql (现有)
  └── 用途：数据库变更脚本执行记录
  └── 与审计日志无关
```

---

## 5. 代码架构设计

### 5.1 涉及项目与文件

```
Sinogram.Pet.Model/
  └── AuditLog.cs                    ← 新增：审计日志实体类

Sinogram.Pet.DataAccess/
  └── EntityFramework/ModelMappings/
      └── AuditLogMapping.cs         ← 新增：EF 映射

Sinogram.Pet.ModelService/
  └── AuditLogService.cs             ← 新增：审计日志服务（CRUD）

Sinogram.Pet.BizCommon/
  └── PetLogger.cs                   ← 修改：新增 AuditLog() 方法

Sinogram.Pet.Console.ViewModel/
  └── ViewModels/Service/
      └── AuditLogViewModel.cs       ← 新增：审计日志查询界面 ViewModel

SQL/
  └── 20260630_创建AuditLog表.sql     ← 新增：建表脚本
```

### 5.2 实体类

```csharp
// Sinogram.Pet.Model/AuditLog.cs
namespace Sinogram.Pet.Model
{
    public enum AuditOperationType
    {
        LOGIN, LOGOUT,
        PROTOCOL_CREATE, PROTOCOL_EDIT, PROTOCOL_DELETE,
        SCAN_START, SCAN_ABORT, SCAN_COMPLETE,
        RECON_START, RECON_COMPLETE,
        WARMUP_START, WARMUP_COMPLETE,
        CALIBRATION_START, CALIBRATION_COMPLETE,
        QAQC_START, QAQC_COMPLETE,
        BED_MOVE,
        LOG_EXPORT,
        USER_CONFIG_CHANGE, SYSTEM_CONFIG_CHANGE
    }

    public enum AuditResult
    {
        Success,
        Failed
    }

    public class AuditLog : IEntity<long>, ILastModifiedDateTime
    {
        public long ID { get; set; }
        public string UserName { get; set; }
        public DateTime OperationTime { get; set; }
        public AuditOperationType OperationType { get; set; }
        public string Module { get; set; }
        public string Detail { get; set; }
        public string PatientID { get; set; }
        public string StudyID { get; set; }
        public string IPAddress { get; set; }
        public AuditResult Result { get; set; }
        public DateTime LastModifiedDateTime { get; set; }
    }
}
```

### 5.3 服务层

```csharp
// Sinogram.Pet.ModelService/AuditLogService.cs
public interface IAuditLogService : IService
{
    void Add(AuditLog log);
    IQueryable<AuditLog> Query(DateTime start, DateTime end,
        string userName = null,
        AuditOperationType? operationType = null,
        string patientId = null);
}

public class AuditLogService : ServiceBase, IAuditLogService
{
    protected IRepository<AuditLog> AuditLogRepository { get; set; }

    public void Add(AuditLog log)
    {
        if (log == null) throw new ArgumentNullException(nameof(log));
        using (var tx = new TransactionScope())
        {
            AuditLogRepository.Add(log);
            tx.Complete();
        }
    }

    public IQueryable<AuditLog> Query(DateTime start, DateTime end,
        string userName = null,
        AuditOperationType? operationType = null,
        string patientId = null)
    {
        var query = AuditLogRepository.FindAll()
            .Where(l => l.OperationTime >= start && l.OperationTime <= end);

        if (!string.IsNullOrEmpty(userName))
            query = query.Where(l => l.UserName == userName);
        if (operationType.HasValue)
            query = query.Where(l => l.OperationType == operationType.Value);
        if (!string.IsNullOrEmpty(patientId))
            query = query.Where(l => l.PatientID == patientId);

        return query.OrderByDescending(l => l.OperationTime);
    }
}
```

### 5.4 PetLogger 门面扩展

```csharp
// Sinogram.Pet.BizCommon/PetLogger.cs 新增方法
/// <summary>
/// 记录审计日志（同时写入文件和数据库）
/// </summary>
public static void AuditLog(AuditOperationType operationType, string detail,
    string module = "", string patientId = "", string studyId = "",
    AuditResult result = AuditResult.Success)
{
    // 1. 写入文件日志（保持向后兼容）
    OperationLog($"[AUDIT] [{operationType}] {detail}");

    // 2. 写入数据库审计表
    try
    {
        var auditService = ObjectContainerManager.Container.Get<IAuditLogService>();
        var auditLog = new AuditLog
        {
            UserName = CurrentUserName,  // 从全局上下文获取当前用户
            OperationTime = DateTime.Now,
            OperationType = operationType,
            Module = module,
            Detail = detail,
            PatientID = patientId,
            StudyID = studyId,
            IPAddress = GetCurrentIPAddress(),
            Result = result
        };
        auditService.Add(auditLog);
    }
    catch (Exception ex)
    {
        // 审计日志写入失败不阻断业务，仅记录到系统日志
        GeneralCommonLogger.Error(SystemErrors.OperationFailedError,
            "AuditLog DB write failed: " + ex.Message);
    }
}
```

### 5.5 业务层调用示例

```csharp
// 协议保存时
PetLogger.AuditLog(
    operationType: AuditOperationType.PROTOCOL_EDIT,
    detail: $"Save Protocol, ProtocolName:{Protocol.Name}",
    module: "ProtocolEdit"
);

// 扫描开始时
PetLogger.AuditLog(
    operationType: AuditOperationType.SCAN_START,
    detail: $"PET扫描开始, 床位:{bedNumber}",
    module: "Scan",
    patientId: currentPatient?.PatientID,
    studyId: currentStudy?.StudyID
);

// 登录时
PetLogger.AuditLog(
    operationType: AuditOperationType.LOGIN,
    detail: $"用户登录成功",
    module: "Auth"
);
```

---

## 6. 审计日志查询界面

### 6.1 功能需求

- 按日期范围查询
- 按操作人筛选
- 按操作类型筛选
- 按患者ID关联查询
- 结果分页展示
- 支持导出为 CSV/PDF

### 6.2 界面原型

```
┌──────────────────────────────────────────────────────────────┐
│  审计日志查询                                                  │
├──────────────────────────────────────────────────────────────┤
│  开始日期: [2026-06-23]  结束日期: [2026-06-30]              │
│  操作人:   [全部 ▼]      操作类型: [全部 ▼]                   │
│  患者ID:   [__________]                                      │
│                                                              │
│  [查询]  [导出CSV]  [导出PDF]                                 │
├──────────────────────────────────────────────────────────────┤
│  时间              │ 操作人 │ 操作类型      │ 模块    │ 详情    │
│  ─────────────────┼────────┼──────────────┼────────┼──────── │
│  06-30 10:23:15   │ 张三   │ LOGIN        │ Auth   │ 登录成功 │
│  06-30 10:25:03   │ 张三   │ PROTOCOL_EDIT│ Proto  │ 保存协议 │
│  06-30 10:30:00   │ 张三   │ SCAN_START   │ Scan   │ PET扫描  │
│  06-30 11:00:45   │ 李四   │ WARMUP_START │ Warmup │ 球管预热 │
│  ...              │        │              │        │         │
│                                                              │
│  共 128 条  [< 1 2 3 4 5 ... >]                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. 安全与合规

### 7.1 数据库权限控制

```sql
-- 创建专用角色，仅授予 INSERT 和 SELECT 权限
CREATE ROLE audit_writer;
GRANT INSERT ON tbl_audit_log TO audit_writer;
GRANT SELECT ON tbl_audit_log TO audit_writer;
-- 不授予 UPDATE 和 DELETE 权限

-- 应用使用 audit_writer 角色写入审计日志
-- 查询界面使用普通 sinouser 角色读取
```

### 7.2 日志保留策略

| 策略 | 说明 |
|------|------|
| 在线保留期 | 建议 ≥ 2 年（满足 FDA 要求） |
| 归档策略 | 超过在线保留期的数据归档到独立存储 |
| 清理方式 | 仅允许 DBA 通过存储过程清理过期数据，记录清理操作本身 |

### 7.3 防篡改措施

- 数据库层面：应用账号无 UPDATE/DELETE 权限
- 应用层面：`AuditLogService` 不暴露修改/删除接口
- 运维层面：数据库操作审计，DBA 操作需审批

---

## 8. 实施计划

| 阶段 | 任务 | 预计工时 | 优先级 |
|------|------|---------|--------|
| **P1** | 数据库建表 + EF 映射 | 0.5 天 | 高 |
| **P1** | AuditLog 实体 + AuditLogService | 1 天 | 高 |
| **P1** | PetLogger.AuditLog() 门面方法 | 0.5 天 | 高 |
| **P2** | 现有业务接入点梳理与改造 | 2 天 | 中 |
| **P2** | 审计日志查询界面 | 2 天 | 中 |
| **P3** | 导出功能（CSV/PDF） | 1 天 | 低 |
| **P3** | 数据库权限配置与测试 | 0.5 天 | 低 |
| **P4** | 日志保留/归档策略实施 | 1 天 | 低 |

### 阶段说明

- **P1**：基础设施，所有后续工作的前提
- **P2**：核心功能，接入现有业务调用点 + 查询界面
- **P3**：增强功能，提升可用性
- **P4**：运维完善，长期合规保障

---

## 9. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 数据库写入性能瓶颈 | 审计日志量大时影响系统性能 | 异步写入 + 内存队列批量入库 |
| 数据库不可用 | 审计日志丢失 | 降级到文件日志，数据库恢复后可考虑补写 |
| 现有业务改造遗漏 | 部分操作未被审计 | 梳理完整接入清单，Code Review 覆盖 |
| 数据量增长过快 | 存储空间和查询性能下降 | 制定保留策略，定期归档 |

---

## 10. 待讨论事项

1. **审计日志表的数据库用户权限隔离**：是否需要创建独立的数据库角色？
2. **异步写入策略**：是否引入内存队列批量写入？需评估数据丢失风险。
3. **审计日志查看界面的入口位置**：放在"系统管理"下还是独立菜单？
4. **现有 `tbl_log` 表**：是否考虑同步启用 DBAppender？还是保持现状？
5. **操作类型枚举**：是否需要补充更多类型？是否需要支持自定义扩展？

---

## 附录 A：现有日志体系概览

| 日志类型 | 存储方式 | 存储位置 | 当前状态 |
|---------|---------|---------|---------|
| 系统运行日志 | 文件 | `C:\PoleStar\Sinogram.Log\` | 启用 |
| 用户操作日志 | 文件 | `C:\PoleStar\Sinogram.Log\Operation\{User}\` | 启用 |
| 系统消息日志 | 文件 | `C:\PoleStar\Sinogram.Log\SystemMessage\` | 启用 |
| 数据库系统日志 | DB (`tbl_log`) | PostgreSQL | DBAppender 已禁用 |
| SQL变更历史 | DB (`tbl_history_sql`) | PostgreSQL | 启用 |
| **审计日志（新增）** | **文件 + DB** | **文件 + `tbl_audit_log`** | **待实施** |

## 附录 B：关键文件索引

| 文件 | 作用 |
|------|------|
| `Sinogram.Pet.BizCommon/PetLogger.cs` | 日志门面，所有日志写入入口 |
| `Sinogram.Pet.Model/Log.cs` | 系统日志实体 |
| `Sinogram.Pet.ModelService/LogService.cs` | 系统日志 DB 服务 |
| `Sinogram.Pet.Log.Service/DBAppender.cs` | 数据库写入器（已禁用） |
| `Sinogram.Pet.Log.Service/Program.cs` | 日志服务启动配置 |
| `Sinogram.Pet.Console.ViewModel/.../OperationLogViewModel.cs` | 操作日志查看界面 |
| `Sinogram.Pet.Console.View/App_Data/Log/SinogramLog.config` | log4net 配置 |
