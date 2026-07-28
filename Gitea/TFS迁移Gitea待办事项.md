## TFS 迁移 Gitea — 待办事项清单

基于当前项目 `$/PET-CT Software Project/PET-CT main` 的实际情况整理。

---

### 一、迁移前决策（需人工确认）

#### 1.1 分支保留决策

当前 git-tfs clone 产出的分支如下，需要逐一确认是否保留到 Gitea：

**本地分支（已有）**：

| 分支名 | 对应 TFS 路径（推测） | 保留？ | 备注 |
|--------|----------------------|--------|------|
| main | $/PET-CT Software Project/PET-CT main | ☐ 是 / ☐ 否 | 主干，通常必须保留 |
| master | 同上（git-tfs 默认创建） | ☐ 是 / ☐ 否 | 与 main 可能重复，建议确认差异后决定 |
| release/flight | 某个 release 分支 | ☐ 是 / ☐ 否 | 是否仍在使用？ |
| release/flightplus | 某个 release 分支 | ☐ 是 / ☐ 否 | 是否仍在使用？ |
| release/nova | 某个 release 分支 | ☐ 是 / ☐ 否 | 是否仍在使用？ |

**远程跟踪分支（remotes/tfs/*，待清理）**：

| 分支名 | 保留？ | 备注 |
|--------|--------|------|
| PET-CT1.2.0patch/Consolepatch | ☐ 是 / ☐ 否 | 1.2.0 补丁分支，是否已合并或废弃？ |
| PET-CT1.2.1(PHtemp)/Console | ☐ 是 / ☐ 否 | 看起来是临时分支（PHtemp），大概率可丢弃 |
| PET-CT1.2.1(iAC2temp)/Console | ☐ 是 / ☐ 否 | 同上，临时分支（iAC2temp），大概率可丢弃 |
| PET-CT1.5.0SP1/Console | ☐ 是 / ☐ 否 | SP1 补丁分支，是否仍需要？ |

**待确认问题**：

- [ ] main 和 master 是否指向同一个 commit？如果是，只保留 main，删除 master
- [ ] release/flight、release/flightplus、release/nova 这三个分支当前是否还有人基于它们开发？
- [ ] PET-CT1.2.x 系列分支是否已经完全合并回主干或已废弃？
- [ ] PET-CT1.5.0SP1 是否还需要继续维护？

#### 1.2 Changeset 历史截断决策

当前使用 `--from=10953` 开始迁移，需要确认：

- [ ] Changeset 10953 对应的大致日期是什么？（在 TFS 中查看）
- [ ] 这个日期之前的历史是否确认不需要保留？
- [ ] 各子分支的分叉点是否在 C10953 之后？（如果分叉点在截断之前，分支关系可能丢失）

**验证方法**：

```powershell
# 在 TFS 中查看 C10953 的日期
# 通过 TFS Web 访问：http://10.10.10.63:8080/tfs/DefaultCollection/_changeset/10953
# 或通过 VS Team Explorer 查看

# 在 Git 中验证分支关系是否完整
git log --oneline --graph --all
# 确认各分支的分叉点是否可见
```

#### 1.3 作者映射决策

- [ ] 确认 TFS 中有多少个不同的提交者账号
- [ ] 是否需要创建 authors.txt 将 TFS 账号映射为 Git 格式（姓名 <邮箱>）

**如需映射，准备 authors.txt**：

```
DOMAIN\zhangsan = 张三 <zhangsan@company.com>
DOMAIN\lisi = 李四 <lisi@company.com>
...
```

> 如果不做映射，Git 历史中的作者会显示为 `DOMAIN\username` 格式，不影响功能但不美观。

---

### 二、迁移执行（技术操作）

#### 2.1 清理当前 clone 结果

- [ ] 删除 `.git/index.lock`（已确认存在）
- [ ] 清理 `remotes/tfs/*` 残留引用
- [ ] 确认 main 和 master 的关系，决定是否删除其中一个

```powershell
# 删除锁文件
Remove-Item ".git\index.lock" -ErrorAction SilentlyContinue

# 查看 main 和 master 是否指向同一 commit
git rev-parse main
git rev-parse master

# 如果相同，删除 master
git branch -D master

# 清理 remotes/tfs 引用
Remove-Item -Recurse -Force ".git\refs\remotes\tfs" -ErrorAction SilentlyContinue
git gc --prune=now
```

#### 2.2 分支整理

根据第一节的决策结果：

- [ ] 将需要保留的 `remotes/tfs/*` 分支转为本地分支
- [ ] 删除不需要的本地分支

```powershell
# 示例：将需要的远程分支转为本地分支
git branch pet-ct-1.5.0sp1 remotes/tfs/PET-CT1.5.0SP1/Console

# 删除不需要的本地分支
git branch -D <branch-name>
```

#### 2.3 创建 .gitignore

- [ ] 确认项目中需要忽略的文件类型（构建产物、VS 临时文件、NuGet 包等）
- [ ] 创建 .gitignore 并提交

#### 2.4 创建 Gitea 仓库

- [ ] 在 Gitea 上创建目标仓库（不勾选初始化选项）
- [ ] 确认仓库名称（建议：`PET-CT` 或 `pet-ct-software`）
- [ ] 确认仓库可见性（私有/内部）
- [ ] 确认所属组织或用户

#### 2.5 推送至 Gitea

- [ ] 添加 Gitea 远程仓库
- [ ] 推送所有本地分支
- [ ] 推送所有标签（如有）

```powershell
git remote add origin http://your-gitea-server:3000/org/repo-name.git
git push origin --all
git push origin --tags
```

---

### 三、迁移后验证

#### 3.1 历史完整性

- [ ] 对比 TFS 和 Git 各分支的提交数量
- [ ] 确认 changeset 数量一致（或在截断范围内的预期数量）

```powershell
git rev-list --count main
git rev-list --count release/flight
# ... 对每个保留分支执行
```

#### 3.2 分支关系验证

- [ ] 对每个需要合并的分支对执行 `git merge-base` 验证共同祖先
- [ ] 在 Gitea Network 页面确认分支拓扑图正确

```powershell
git merge-base main release/flight
git merge-base main release/flightplus
git merge-base main release/nova
# 每个都应输出一个 commit hash
```

#### 3.3 合并模拟

- [ ] 模拟各子分支合并到 main，记录冲突情况
- [ ] 评估冲突量是否在可接受范围内

```powershell
git checkout main
git merge release/flight --no-commit --no-ff
git diff --name-only --diff-filter=U    # 查看冲突文件
git merge --abort                        # 放弃模拟
```

#### 3.4 代码完整性抽查

- [ ] 随机抽取 3-5 个文件，对比 TFS 和 Git 中的内容是否一致
- [ ] 确认没有文件丢失或编码异常

---

### 四、团队切换准备

#### 4.1 团队通知与培训

- [ ] 确定正式切换日期
- [ ] 通知团队成员切换计划和新仓库地址
- [ ] 准备简要的 Git 操作指南（TFS → Git 命令对照）
- [ ] 安排一次团队演示或培训

#### 4.2 Gitea 配置

- [ ] 配置 main 分支保护规则（禁止直接 push）
- [ ] 配置 Pull Request 合并策略
- [ ] 配置 Code Review 审查要求
- [ ] 添加团队成员账号和权限

#### 4.3 过渡期安排

- [ ] 确定 TFS 只读截止日期（之后 TFS 不再接受新提交）
- [ ] 过渡期内是否需要双向同步（git tfs fetch 增量拉取）
- [ ] 确认所有成员已成功克隆新仓库

---

### 五、回滚预案

- [ ] 保留 TFS 仓库不动（至少 1 个月内不删除），作为回滚备份
- [ ] 记录迁移使用的 git-tfs 命令和参数，以便重新执行
- [ ] 如迁移失败，团队可立即切回 TFS 继续工作

---

### 待办汇总

| 序号 | 事项 | 类型 | 状态 |
|------|------|------|------|
| 1 | 确认 main vs master 关系，决定保留哪个 | 决策 | ☐ |
| 2 | 确认 release/flight、flightplus、nova 是否保留 | 决策 | ☐ |
| 3 | 确认 PET-CT1.2.x / 1.5.0SP1 分支是否保留 | 决策 | ☐ |
| 4 | 确认 C10953 的日期，评估历史截断是否合理 | 决策 | ☐ |
| 5 | 确认是否需要 authors.txt 作者映射 | 决策 | ☐ |
| 6 | 删除 index.lock，清理 remotes/tfs 引用 | 操作 | ☐ |
| 7 | 根据决策结果整理本地分支 | 操作 | ☐ |
| 8 | 创建 .gitignore | 操作 | ☐ |
| 9 | 在 Gitea 创建目标仓库 | 操作 | ☐ |
| 10 | 推送至 Gitea | 操作 | ☐ |
| 11 | 验证历史完整性 | 验证 | ☐ |
| 12 | 验证分支关系（merge-base） | 验证 | ☐ |
| 13 | 模拟合并，评估冲突 | 验证 | ☐ |
| 14 | 代码完整性抽查 | 验证 | ☐ |
| 15 | 确定切换日期，通知团队 | 团队 | ☐ |
| 16 | Gitea 分支保护与权限配置 | 团队 | ☐ |
| 17 | 团队培训 / Git 操作指南 | 团队 | ☐ |
| 18 | TFS 设为只读，正式切换 | 切换 | ☐ |
