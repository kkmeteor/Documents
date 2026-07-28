# Qoder 团队项目级约束方案调研报告

## 一、背景

团队在使用 Qoder AI 编码助手时，需要建立统一的项目级/团队级约束机制，包括代码规范、架构规范、安全规范等，确保 AI 生成的代码符合团队标准。本报告调研了 Qoder 提供的多种约束方案及其配置方法。

---

## 二、核心方案：Rules（项目级规则）

### 2.1 概述

Rules 是 Qoder 最直接的声明式约束机制，存放在项目目录 `.qoder/rules/` 下，每个 `.md` 文件即一条独立规则。通过 Git 提交实现团队共享。

### 2.2 四种触发类型

| 触发类型 | frontmatter 配置 | 行为 | 典型场景 |
|---------|-----------------|------|---------|
| **Always Apply** | `trigger: always_apply` | 每次AI请求自动注入 | 编码风格、命名规范 |
| **Specific Files** | `trigger: specific_files` + `globs: ...` | 仅操作匹配文件时注入 | API目录规范、前端组件规范 |
| **Model Decision** | `trigger: model_decision` + `description: ...` | AI根据描述判断是否应用 | 单元测试规范、代码审查规范 |
| **Manual** | `trigger: manual` | 对话中用 `@规则名` 手动引用 | 按需工作流、特定场景 |

### 2.3 文件格式示例

```markdown
---
trigger: always_apply
---

# 编码规范

- 变量名使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 每行不超过 120 字符
```

```markdown
---
trigger: specific_files
globs: "src/api/**", "**/Controllers/**"
---

# API 开发规范

- Controller 类必须以 Controller 结尾
- 业务逻辑放在 Service 层
```

```markdown
---
trigger: model_decision
description: 当用户要求编写单元测试时应用此规则
---

# 测试规范

- 使用 xUnit/Jest 框架
- 遵循 AAA 模式
```

### 2.4 关键特性

- **优先级**：Rules 优先级高于 Memory
- **字符上限**：所有活动规则总计最多 100,000 字符
- **内容类型**：仅支持自然语言文本
- **共享方式**：通过 Git 提交到项目仓库，团队成员 pull 后自动生效

---

## 三、AGENTS.md（跨工具兼容方案）

### 3.1 概述

在项目根目录放置 `AGENTS.md` 文件，Qoder 自动兼容识别。该格式是开放标准（agents.md），被 60,000+ 开源项目使用，支持 Claude Code、Codex 等多种 AI 工具。

### 3.2 优势

- 一份规范，多种 AI 工具通用
- 配置极简，无需 frontmatter
- 团队迁移成本低

### 3.3 局限

- 没有 trigger 分类，相当于全部 always_apply
- 不支持 specific_files 等细粒度控制
- 不支持 glob 匹配

---

## 四、其他辅助方案

### 4.1 Skills（过程式知识注入）

| 维度 | 说明 |
|------|------|
| 路径 | `.qoder/skills/{name}/SKILL.md` |
| 触发方式 | 自动触发（模型匹配 description）+ 手动 `/技能名` |
| 适合场景 | 开发流程、审查工作流、特定领域最佳实践 |

### 4.2 Commands（快捷指令）

| 维度 | 说明 |
|------|------|
| 路径 | `.qoder/r/c/commands/*.md` |
| 触发方式 | `/命令名` 手动调用 |
| 适合场景 | 团队常用操作指令、固定格式提示词模板 |

### 4.3 Subagents（子代理）

| 维度 | 说明 |
|------|------|
| 路径 | `.qoder/r/a/agents/*.md` |
| 触发方式 | 自动派发 + 手动调用 |
| 适合场景 | 大型复杂任务分域执行 |

### 4.4 Memory（智能记忆）

- **不可团队共享**（纯个人记忆，存储在 `~/.qoder/`）
- 优先级低于 Rules
- 不适合作为团队规范推广手段

---

## 五、方案对比与推荐

### 5.1 综合对比

| 方案 | 约束力度 | 共享能力 | 配置复杂度 | 细粒度控制 | 跨工具兼容 |
|------|---------|---------|-----------|-----------|-----------|
| **Rules (always_apply)** | 强 | Git共享 | 低 | - | 否 |
| **Rules (specific_files)** | 强 | Git共享 | 中 | glob匹配 | 否 |
| **Rules (model_decision)** | 中 | Git共享 | 中 | AI判断 | 否 |
| **Rules (manual)** | 弱 | Git共享 | 低 | 手动触发 | 否 |
| **AGENTS.md** | 中 | Git共享 | 最低 | - | 是 |
| **Skills** | 中 | Git共享 | 高 | description | 否 |
| **Commands** | 弱 | Git共享 | 最低 | 手动触发 | 否 |
| **Subagents** | 中 | Git共享 | 高 | 自动/手动 | 否 |
| **Memory** | 弱 | 不可共享 | 无需配置 | 自动 | 否 |

### 5.2 推荐组合策略

| 层级 | 推荐方案 | 配置路径 | 理由 |
|------|---------|---------|------|
| 强制规范 | Rules (always_apply) | `.qoder/rules/coding-standard.md` | 编码风格每次必须遵守 |
| 强制规范 | Rules (always_apply) | `.qoder/rules/architecture-constraint.md` | 架构约束每次必须遵守 |
| 领域规范 | Rules (specific_files) | `.qoder/rules/api-spec.md` | 仅操作特定目录时生效 |
| 场景规范 | Rules (model_decision) | `.qoder/rules/testing-standard.md` | AI判断场景自动应用 |
| 跨工具兼容 | AGENTS.md | 项目根目录 | 其他AI工具也能识别核心规范 |
| 流程指导 | Skills | `.qoder/skills/` | 开发流程、审查流程 |
| 快捷操作 | Commands | `.qoder/r/c/commands/` | 团队常用操作指令 |

---

## 六、当前项目已创建的文件

```
项目根目录/
├── AGENTS.md                                      # 跨工具通用规范
├── .qoder/
│   ├── rules/
│   │   ├── coding-standard.md                     # always_apply - 编码规范
│   │   ├── api-spec.md                            # specific_files - API开发规范
│   │   ├── testing-standard.md                    # model_decision - 测试规范
│   │   └── architecture-constraint.md             # always_apply - 架构约束
│   └── skills/
│       └── tfs-changeset-query/SKILL.md           # 已有 - TFS变更集查询
```

---

## 七、团队推广建议

1. **第一步**：将 `.qoder/rules/` 和 `AGENTS.md` 提交到 Git 仓库
2. **第二步**：在团队会议中介绍规则文件的作用和修改方式
3. **第三步**：根据实际使用反馈迭代规则内容（规则也走版本控制）
4. **第四步**：对于特定领域的复杂流程，补充 Skills 和 Commands
5. **注意**：个人偏好规则不应提交到 Git，放在用户级目录 `~/.qoder/rules/`

---

## 八、参考文档

- Qoder Rules 官方文档：https://docs.qoder.com/user-guide/rules
- Qoder Skills 文档：https://docs.qoder.com/extensions/skills
- AGENTS.md 开放标准：https://agents.md/
- Qoder-Rules 社区模板：https://github.com/lvzhaobo/qoder-rules
