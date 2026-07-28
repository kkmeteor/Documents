## TFS 代码管理迁移至 Git 方案汇报

### 背景与现状

当前团队使用 TFS（Team Foundation Server）进行代码版本管理，仓库结构为典型的 TFS 分支模型：

- **Main**（主分支）：`$/Project/Main`
- **Branch1**（子分支）：`$/Project/Branch1`
- **Branch2**（子分支）：`$/Project/Branch2`

每个分支对应 TFS 中独立的物理文件夹路径，分支关系由 TFS 服务器端维护。

---

### TFS 与 Git 分支模型差异

| 对比维度 | TFS | Git |
|---------|-----|-----|
| 分支本质 | 服务器端"一等公民"对象 | 指向 commit 的轻量级指针 |
| 物理存储 | 每个分支对应独立文件夹 | 所有分支共享同一仓库 |
| 分支创建成本 | 高（复制完整目录树） | 极低（仅创建指针） |
| 合并机制 | 服务器端记录 merge 关系 | 基于 commit 历史的三路合并 |
| 历史追溯 | 基于 changeset 编号 | 基于 commit hash 链 |

> 核心挑战：如何在迁移过程中将 TFS 的物理分支结构正确映射为 Git 的逻辑分支结构，并保留分支间的合并能力。

---

### 推荐方案：git-tfs

`git-tfs` 是目前最成熟的 TFS→Git 开源迁移工具，能够自动完成 TFS 分支到 Git 分支的映射，并保留提交历史与分支关联关系。

#### 迁移流程

```
Step 1  安装工具
  └─ choco install gittfs

Step 2  克隆主分支（含全部关联分支）
  └─ git tfs clone <tfs-url> $/Project/Main --with-branches

Step 3  将远程分支转为本地分支
  └─ git branch main remotes/tfs/default
  └─ git branch branch1 remotes/tfs/branch1
  └─ git branch branch2 remotes/tfs/branch2

Step 4  添加 .gitignore 并清理

Step 5  推送到 Gitea 远程仓库
  └─ git remote add origin <gitea-url>
  └─ git push origin --all
  └─ git push origin --tags
```

#### `--with-branches` 参数的作用

该参数是整个迁移的关键，它会自动完成以下工作：

1. 扫描 TFS 中与 Main 有 branch 关系的所有子分支
2. 按照 TFS 记录的 branch/merge 历史，在 Git 中重建正确的分支拓扑
3. 保留各分支的共同祖先（common ancestor），使 Git 合并算法能正确工作

---

### 迁移后的合并操作

迁移完成后，分支合并与原生 Git 工作流完全一致：

```bash
git checkout main
git merge branch1    # Git 能找到共同祖先，正常执行三路合并
```

TFS 中 Branch1 从 Main 某个时间点拉出的记录，会被 git-tfs 在 Git 历史中保留为分叉点，确保合并、冲突检测等功能正常运作。

---

### 实施注意事项

**历史截断策略**：若 TFS 提交历史非常长（数千条 changeset），git-tfs 克隆会比较缓慢。可通过 `--from=<changeset-id>` 参数指定起始节点，截断早期不重要的历史，显著加快迁移速度。

**分支清理**：迁移是审视现有分支的好时机。已不再使用或已合并回 Main 的分支，可在迁移后直接删除对应的 Git 分支，保持仓库整洁。

**`.gitignore` 配置**：TFS 通过 `.tfignore` 或工作区映射排除文件，迁移后需在仓库根目录创建 `.gitignore`，建议包含：

```
bin/
obj/
packages/
*.user
*.suo
.vs/
```

**推送至 Gitea**：迁移完成并本地验证后，将仓库推送到团队自托管的 Gitea 服务器，所有成员即可通过 Git 客户端正常拉取和协作。

---

### 备选方案

若因 TFS 版本兼容性或网络限制无法使用 `--with-branches`，可采用"主分支完整 + 子分支快照"方式：

| 分支 | 迁移方式 | 历史保留 | 合并能力 |
|------|---------|---------|---------|
| Main | git-tfs 完整克隆 | 完整 changeset 历史 | 基准分支 |
| Branch1/2 | 快照导入（当前状态作为单次 commit） | 仅当前状态 | 可合并，但子分支历史丢失 |

该方案适合子分支生命周期较短、历史价值不大的场景。

---

### 总结

| 项目 | 结论 |
|------|------|
| 迁移工具 | git-tfs（首选） |
| 关键参数 | `--with-branches` |
| 分支映射 | TFS 物理分支 → Git 逻辑分支，自动保留 |
| 合并能力 | 完全保留，与原生 Git 一致 |
| 目标仓库 | Gitea（Docker 自托管） |
| 预计工作量 | 1-2 天（含验证） |


### 待办事项
1. 准备GITEA部署机器，要求SSD，能安装DockerDesktop.

2. 准备正式代码迁移：从TFS迁移到GITEA1.1 分支保留决策

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
**待确认问题**：

- [ ] main 和 master 是否指向同一个 commit？如果是，只保留 main，删除 master
- [ ] release/flight、release/flightplus、release/nova 这三个分支当前是否还有人基于它们开发？
- [ ] PET-CT1.2.x 系列分支是否已经完全合并回主干或已废弃？
- [ ] PET-CT1.5.0SP1 是否还需要继续维护？


