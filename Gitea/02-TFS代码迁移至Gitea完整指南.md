# TFS 代码迁移至 Gitea 完整指南

> 本文档整合了 TFS（Team Foundation Server）代码仓库迁移至 Gitea（Git 自托管平台）的方案汇报、详细操作流程、迁移后验证与团队切换、以及待办事项清单。核心目标是完整保留提交历史和分支关联关系，确保迁移后分支间的合并操作可正常执行。

---

## 一、背景与现状

当前团队使用 TFS 进行代码版本管理，仓库结构为典型的 TFS 分支模型：

- **Main**（主分支）：`$/Project/Main`
- **Branch1**（子分支）：`$/Project/Branch1`
- **Branch2**（子分支）：`$/Project/Branch2`

每个分支对应 TFS 中独立的物理文件夹路径，分支关系由 TFS 服务器端维护。

**迁移目标**：TFS 物理分支 → Git 逻辑分支 → Gitea 远程仓库。

**核心原则**：保留分支间的共同祖先（common ancestor），使 Git 三路合并算法能正确工作。

---

## 二、TFS 与 Git 分支模型差异

| 对比维度 | TFS | Git |
|---------|-----|-----|
| 分支本质 | 服务器端"一等公民"对象 | 指向 commit 的轻量级指针 |
| 物理存储 | 每个分支对应独立文件夹 | 所有分支共享同一仓库 |
| 分支创建成本 | 高（复制完整目录树，分钟级） | 极低（仅创建指针，毫秒级） |
| 合并机制 | 服务器端记录 merge 关系 | 基于 commit 历史的三路合并 |
| 历史追溯 | 基于 changeset 编号 | 基于 commit hash 链 |

> **核心挑战**：如何在迁移过程中将 TFS 的物理分支结构正确映射为 Git 的逻辑分支结构，并保留分支间的合并能力。

---

## 三、推荐方案：git-tfs

`git-tfs` 是目前最成熟的 TFS→Git 开源迁移工具，能够自动完成 TFS 分支到 Git 分支的映射，并保留提交历史与分支关联关系。

### 3.1 环境检查

在迁移机上确认以下环境就绪：

```bash
# 确认 git 版本（建议 2.30+）
git --version

# 确认 .NET Framework 4.7+ 已安装（git-tfs 依赖）
reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release

# 确认能访问 TFS 服务器
ping your-tfs-server
```

### 3.2 安装 git-tfs

```bash
# 方式一：通过 Chocolatey 安装（推荐）
choco install gittfs

# 方式二：手动下载安装
# 从 https://github.com/git-tfs/git-tfs/releases 下载最新 release
# 解压后将路径加入系统 PATH
```

### 3.3 梳理 TFS 仓库结构

迁移前需要明确以下信息，建议以表格形式记录：

| 项目 | TFS 路径 | 角色 | 说明 |
|------|----------|------|------|
| Main | $/Project/Main | 主干 | 生产代码基线 |
| Branch1 | $/Project/Branch1 | 子分支 | 从 Main 某 changeset 拉出 |
| Branch2 | $/Project/Branch2 | 子分支 | 从 Main 某 changeset 拉出 |

**关键确认项**：

- 每个子分支是从 Main 的哪个 changeset 拉出来的？（在 TFS Web 或 VS 中查看分支历史）
- 子分支与 Main 之间是否有过部分合并？（影响 Git 中 merge 关系的重建）
- 是否有嵌套分支（如 Branch1 下又拉了子分支）？

### 3.4 评估仓库规模

```bash
# 通过 TFS Web 或 API 查看 Main 分支的总 changeset 数量
# 如果超过 5000 条，建议考虑截断早期历史以加快迁移速度
```

---

## 四、核心迁移流程

### 4.1 克隆 TFS 主分支（含全部关联分支）

这是整个迁移中最关键的一步。`--with-branches` 参数会让 git-tfs 自动扫描 TFS 中与 Main 有分支关系的所有子分支，并在 Git 中重建完整的分支拓扑。

```bash
# 创建工作目录
mkdir tfs-migration
cd tfs-migration

# 执行克隆（首次运行会下载所有 changeset，耗时较长；网络路径需要加引号）
git tfs clone http://your-tfs-server:8080/tfs/DefaultCollection `
    "$/Project/Main" `
    --with-branches `
    --username=DOMAIN\username `
    --authors=authors.txt

# 具体示例：当 --with-branches 无法拉取所有关联分支时，
# 可使用 --branches=all 配合 --from=12755 尽可能多地关联分支
git tfs clone http://10.10.10.63:8080/tfs/DefaultCollection `
    "$/18F Dicom Viewer/SinoIVSDK-2DViewer" `
    --branches=all --from=12755 `
    --username tengfei.ma@sinogram
```

**参数说明**：

| 参数 | 作用 |
|------|------|
| `--with-branches` | 自动发现并克隆所有关联的 TFS 子分支，保留分支创建和合并的历史关系 |
| `--branches=all` | 尽可能多的自动发现并克隆所有关联的 TFS 子分支 |
| `--from=12755` | 指定从某个 changeset 开始迁移 |
| `--username` | TFS 认证账号，格式为 `DOMAIN\username` 或 `username@domain` |
| `--authors` | 可选，指定作者映射文件，将 TFS 账号映射为 Git 的 `Name <email>` 格式 |

**`--with-branches` 的工作原理**：

git-tfs 会遍历 TFS 的分支对象（Branch Object），追溯每个子分支的创建来源（parent branch + changeset），在 Git 中创建对应的远程分支（`remotes/tfs/branch-name`），并在 commit 历史中正确设置 parent commit 关系。这意味着 Git 能识别出各分支的分叉点，后续 merge 操作可正常进行。该参数会自动完成：

1. 扫描 TFS 中与 Main 有 branch 关系的所有子分支。
2. 按照 TFS 记录的 branch/merge 历史，在 Git 中重建正确的分支拓扑。
3. 保留各分支的共同祖先（common ancestor），使 Git 合并算法能正确工作。

### 4.2 作者映射（可选但推荐）

如果 TFS 中的提交者账号格式不统一（如 `DOMAIN\zhangsan`），可以创建 `authors.txt` 文件进行映射：

```
DOMAIN\zhangsan = 张三 <zhangsan@company.com>
DOMAIN\lisi = 李四 <lisi@company.com>
DOMAIN\wangwu = 王五 <wangwu@company.com>
```

在 clone 时通过 `--authors=authors.txt` 指定，git-tfs 会将 TFS 的 committer 信息转换为标准的 Git 作者格式。如果不做映射，Git 历史中的作者会显示为 `DOMAIN\username` 格式，不影响功能但不美观。

### 4.3 历史截断（可选）

如果 Main 分支历史非常长（数千条 changeset），且早期历史对团队价值不大，可以截断以加速迁移：

```bash
# 先查看 changeset 列表，找到合适的截断点
git tfs log --all

# 从指定 changeset 开始克隆（丢弃此 changeset 之前的历史）
git tfs clone http://your-tfs-server:8080/tfs/DefaultCollection `
    $/Project/Main `
    --with-branches `
    --from=C12345
```

> 注意：截断后，被截断的 changeset 之前的提交将不存在于 Git 历史中。如果子分支的分叉点在截断范围之后，分支关系仍然能正确保留。

### 4.4 验证克隆结果

```bash
# 查看所有远程分支（git-tfs 创建的）
git branch -r

# 预期输出类似：
#   remotes/tfs/default          → 对应 TFS Main
#   remotes/tfs/branch1          → 对应 TFS Branch1
#   remotes/tfs/branch2          → 对应 TFS Branch2

# 查看各分支的提交历史
git log --oneline remotes/tfs/default
git log --oneline remotes/tfs/branch1
git log --oneline remotes/tfs/branch2

# 查看分支拓扑图（确认分叉关系）
git log --oneline --graph --all
```

**重点验证**：确认 `git log --graph` 输出中能看到正确的分叉结构，即子分支从 Main 的某个 commit 分叉出去。这是后续合并能力的基础。

---

## 五、分支转换与本地化

### 5.1 将远程分支转为本地分支

```bash
# 将 TFS 远程分支映射为 Git 本地分支
git branch main remotes/tfs/default
git branch branch1 remotes/tfs/branch1
git branch branch2 remotes/tfs/branch2

# 切换到主分支
git checkout main
```

### 5.2 清理 git-tfs 远程引用

```bash
# 删除 git-tfs 的远程引用（迁移完成后不再需要）
git remote remove tfs
# 如果以上命令不好使，可以根据具体的分支命名进行尝试：
git for-each-ref --format='%(refname)' refs/remotes/tfs/ | ForEach-Object { git update-ref -d $_ }

# 验证本地分支列表
git branch -a
```

### 5.3 创建 .gitignore

TFS 通过 `.tfignore` 或工作区映射排除文件，迁移后需要创建标准的 `.gitignore`：

```gitignore
# 构建输出
bin/
obj/
build/
dist/
out/

# Visual Studio
.vs/
*.suo
*.user
*.userosscache
*.sln.docstates

# NuGet
packages/
*.nupkg

# 其他
*.log
Thumbs.db
.DS_Store
```

```bash
# 提交 .gitignore
git add .gitignore
git commit -m "chore: add .gitignore for Git workflow"
```

> **分支清理建议**：迁移是审视现有分支的好时机。已不再使用或已合并回 Main 的分支，可在迁移后直接删除对应的 Git 分支，保持仓库整洁。

---

## 六、迁移至 Gitea

### 6.1 在 Gitea 创建仓库

通过 Gitea Web 界面或 API 创建目标仓库：

- 仓库名称：建议与 TFS 项目名一致。
- 可见性：根据团队需求选择。
- 初始化选项：**不要**勾选"初始化仓库"（README、.gitignore 等），避免产生初始 commit 导致推送冲突。

### 6.2 添加 Gitea 远程仓库并推送

```bash
# 添加 Gitea 远程仓库
git remote add origin http://10.10.11.52:3000/Organization/XXX.git

# 推送所有本地分支
git push origin --all

# 推送所有标签
git push origin --tags

# 设置上游跟踪
git push -u origin main
```

### 6.3 验证 Gitea 上的仓库

登录 Gitea Web 界面检查：

- 所有分支是否都已推送成功。
- 提交历史是否完整。
- 分支拓扑图（Gitea 的 Network 页面）是否显示正确的分叉关系。

---

## 七、迁移后验证

### 7.1 历史完整性验证

```bash
# 对比 TFS 和 Git 的提交数量
# TFS 端：查看 changeset 总数
# Git 端：
git rev-list --count main
git rev-list --count branch1
git rev-list --count branch2
```

### 7.2 分支关系验证

```bash
# 验证 Main 和 Branch1 是否有共同祖先
git merge-base main branch1

# 如果输出了一个 commit hash，说明共同祖先存在，合并可以正常进行
# 如果报错 "fatal: No common commit"，说明分支关系未正确迁移

# 可视化分支拓扑
git log --oneline --graph main branch1 branch2
```

### 7.3 模拟合并验证

在不实际提交的情况下模拟合并，评估冲突情况：

```bash
# 模拟 Branch1 合并到 Main
git checkout main
git merge branch1 --no-commit --no-ff

# 查看结果：
# - 如果显示 "Automatic merge went well"，说明无冲突
# - 如果显示 "CONFLICT"，记录冲突文件列表

# 查看冲突文件
git diff --name-only --diff-filter=U

# 放弃模拟合并
git merge --abort
```

**冲突评估建议**：

| 冲突量 | 评估 | 建议 |
|--------|------|------|
| 0-5 个文件 | 正常 | 可直接合并 |
| 5-20 个文件 | 较多 | 建议分批合并，逐模块处理 |
| 20+ 个文件 | 大量 | 建议先做代码审查，制定合并策略 |

### 7.4 代码完整性抽查

- 随机抽取 3-5 个文件，对比 TFS 和 Git 中的内容是否一致。
- 确认没有文件丢失或编码异常。

---

## 八、备选方案

若因 TFS 版本兼容性或网络限制无法使用 `--with-branches`，可采用"主分支完整 + 子分支快照"方式：

| 分支 | 迁移方式 | 历史保留 | 合并能力 |
|------|---------|---------|---------|
| Main | git-tfs 完整克隆 | 完整 changeset 历史 | 基准分支 |
| Branch1/2 | 快照导入（当前状态作为单次 commit） | 仅当前状态 | 可合并，但子分支历史丢失 |

该方案适合子分支生命周期较短、历史价值不大的场景。

---

## 九、团队工作流切换

### 9.1 团队成员克隆仓库

```bash
# 团队成员从 Gitea 克隆（标准 Git 操作）
git clone http://your-gitea-server:3000/org/repo-name.git
```

### 9.2 分支操作对照表

帮助团队从 TFS 思维切换到 Git 工作流：

| 操作 | TFS 方式 | Git 方式 |
|------|----------|----------|
| 创建分支 | 在 TFS 中 branch 文件夹 | `git checkout -b new-branch` |
| 切换分支 | 切换工作区映射 | `git checkout branch-name` |
| 合并到主干 | 在 TFS 中 merge | `git checkout main && git merge feature` |
| 查看历史 | 查看 changeset 列表 | `git log --oneline` |
| 撤销变更 | 撤销签出 | `git checkout -- file` 或 `git revert` |
| 拉取最新 | Get Latest | `git pull` |
| 推送变更 | Check In | `git push` |

### 9.3 Gitea 上的分支保护

在 Gitea 仓库设置中配置分支保护规则：

- **Main 分支**：禁止直接 push，必须通过 Pull Request 合并。
- **合并策略**：建议启用"Fast-forward only"或"Squash and merge"。
- **审查要求**：至少 1 人 Code Review 后方可合并。

### 9.4 迁移后团队切换准备

**团队通知与培训**：
- [ ] 确定正式切换日期。
- [ ] 通知团队成员切换计划和新仓库地址。
- [ ] 准备简要的 Git 操作指南（TFS → Git 命令对照）。
- [ ] 安排一次团队演示或培训。

**Gitea 配置**：
- [ ] 配置 main 分支保护规则（禁止直接 push）。
- [ ] 配置 Pull Request 合并策略。
- [ ] 配置 Code Review 审查要求。
- [ ] 添加团队成员账号和权限。

**过渡期安排**：
- [ ] 确定 TFS 只读截止日期（之后 TFS 不再接受新提交）。
- [ ] 过渡期内是否需要双向同步（`git tfs fetch` 增量拉取）。
- [ ] 确认所有成员已成功克隆新仓库。

---

## 十、回滚预案

- [ ] 保留 TFS 仓库不动（至少 1 个月内不删除），作为回滚备份。
- [ ] 记录迁移使用的 git-tfs 命令和参数，以便重新执行。
- [ ] 如迁移失败，团队可立即切回 TFS 继续工作。

---

## 十一、常见问题与处理

**Q: `git tfs clone` 过程中断怎么办？**
git-tfs 支持断点续传。重新运行相同的 clone 命令，它会自动从上次中断的位置继续。

**Q: 子分支在 TFS 中是从 Branch1 拉出来的（嵌套分支），能正确迁移吗？**
可以。`--with-branches` 会递归追溯分支关系，嵌套分支也能正确映射。但建议迁移后在 Git 中扁平化分支结构（将嵌套分支直接基于 Main），避免 Git 中出现过深的分支层级。

**Q: 迁移后 `git merge-base` 找不到共同祖先？**
说明分支关系未被正确识别。检查 TFS 中是否确实存在 branch 关系（而非只是手动复制文件夹）。如果只是文件夹复制，TFS 中没有 branch 对象，git-tfs 无法追溯。这种情况需要用 `--allow-unrelated-histories` 强制合并，或手动 rebase 建立关联。

**Q: 迁移后需要继续从 TFS 拉取增量更新吗？**
如果迁移期间 TFS 仍有新提交，可以在 Git 仓库中执行 `git tfs fetch` 拉取增量。确认两边完全同步后再执行 `git remote remove tfs` 断开连接。

---

## 十二、迁移时间线参考

| 阶段 | 预计耗时 | 说明 |
|------|----------|------|
| 环境准备与梳理 | 0.5 天 | 安装工具、确认分支结构 |
| git-tfs 克隆 | 1-2 天 | 取决于 changeset 数量和网络速度 |
| 分支转换与清理 | 0.5 天 | 本地分支映射、.gitignore |
| 推送至 Gitea | 0.5 天 | 推送验证 |
| 合并验证与冲突评估 | 1 天 | 模拟合并、记录冲突 |
| 团队培训与切换 | 1 天 | 工作流切换、Gitea 使用 |
| **合计** | **约 4-5 天** | 含缓冲时间 |

> 注：方案汇报中的估算为 1-2 天（含验证），如仓库较大或分支复杂，请参考上述更完整的 4-5 天时间线。

---

## 十三、方案总结

| 项目 | 结论 |
|------|------|
| 迁移工具 | git-tfs（首选） |
| 关键参数 | `--with-branches` |
| 分支映射 | TFS 物理分支 → Git 逻辑分支，自动保留 |
| 合并能力 | 完全保留，与原生 Git 一致 |
| 目标仓库 | Gitea（Docker 自托管） |
| 迁移后合并操作 | 与原生 Git 工作流完全一致（`git checkout main && git merge branch1`） |

---

## 附录：迁移待办事项清单

以下待办基于当前项目 `$/PET-CT Software Project/PET-CT main` 的实际情况整理，可作为通用迁移检查清单参考。

### A. 迁移前决策（需人工确认）

**分支保留决策** — 当前 git-tfs clone 产出的分支，需要逐一确认是否保留到 Gitea。

本地分支（已有）：

| 分支名 | 对应 TFS 路径（推测） | 保留？ | 备注 |
|--------|----------------------|--------|------|
| main | $/PET-CT Software Project/PET-CT main | ☐ 是 / ☐ 否 | 主干，通常必须保留 |
| master | 同上（git-tfs 默认创建） | ☐ 是 / ☐ 否 | 与 main 可能重复，建议确认差异后决定 |
| release/flight | 某个 release 分支 | ☐ 是 / ☐ 否 | 是否仍在使用？ |
| release/flightplus | 某个 release 分支 | ☐ 是 / ☐ 否 | 是否仍在使用？ |
| release/nova | 某个 release 分支 | ☐ 是 / ☐ 否 | 是否仍在使用？ |

远程跟踪分支（remotes/tfs/*，待清理）：

| 分支名 | 保留？ | 备注 |
|--------|--------|------|
| PET-CT1.2.0patch/Consolepatch | ☐ 是 / ☐ 否 | 1.2.0 补丁分支，是否已合并或废弃？ |
| PET-CT1.2.1(PHtemp)/Console | ☐ 是 / ☐ 否 | 临时分支（PHtemp），大概率可丢弃 |
| PET-CT1.2.1(iAC2temp)/Console | ☐ 是 / ☐ 否 | 临时分支（iAC2temp），大概率可丢弃 |
| PET-CT1.5.0SP1/Console | ☐ 是 / ☐ 否 | SP1 补丁分支，是否仍需要？ |

**待确认问题**：

- [ ] main 和 master 是否指向同一个 commit？如果是，只保留 main，删除 master。
- [ ] release/flight、release/flightplus、release/nova 这三个分支当前是否还有人基于它们开发？
- [ ] PET-CT1.2.x 系列分支是否已经完全合并回主干或已废弃？
- [ ] PET-CT1.5.0SP1 是否还需要继续维护？

**Changeset 历史截断决策**：

- [ ] Changeset 10953 对应的大致日期是什么？（在 TFS 中查看）
- [ ] 这个日期之前的历史是否确认不需要保留？
- [ ] 各子分支的分叉点是否在 C10953 之后？（如果分叉点在截断之前，分支关系可能丢失）

```powershell
# 验证方法：在 TFS 中查看 C10953 的日期
# 通过 TFS Web 访问：http://10.10.10.63:8080/tfs/DefaultCollection/_changeset/10953
# 或通过 VS Team Explorer 查看

# 在 Git 中验证分支关系是否完整
git log --oneline --graph --all
```

**作者映射决策**：

- [ ] 确认 TFS 中有多少个不同的提交者账号。
- [ ] 是否需要创建 authors.txt 将 TFS 账号映射为 Git 格式（姓名 <邮箱>）。

### B. 迁移执行（技术操作）

- [ ] 删除 `.git/index.lock`（已确认存在）。
- [ ] 清理 `remotes/tfs/*` 残留引用。
- [ ] 确认 main 和 master 的关系，决定是否删除其中一个。

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

- [ ] 将需要保留的 `remotes/tfs/*` 分支转为本地分支；删除不需要的本地分支。

```powershell
# 示例：将需要的远程分支转为本地分支
git branch pet-ct-1.5.0sp1 remotes/tfs/PET-CT1.5.0SP1/Console

# 删除不需要的本地分支
git branch -D <branch-name>
```

- [ ] 确认项目中需要忽略的文件类型（构建产物、VS 临时文件、NuGet 包等），创建 .gitignore 并提交。
- [ ] 在 Gitea 上创建目标仓库（不勾选初始化选项）。确认仓库名称（建议：`PET-CT` 或 `pet-ct-software`）、可见性（私有/内部）、所属组织或用户。
- [ ] 添加 Gitea 远程仓库，推送所有本地分支和标签。

```powershell
git remote add origin http://your-gitea-server:3000/org/repo-name.git
git push origin --all
git push origin --tags
```

### C. 迁移后验证

- [ ] 对比 TFS 和 Git 各分支的提交数量，确认 changeset 数量一致（或在截断范围内的预期数量）。
- [ ] 对每个需要合并的分支对执行 `git merge-base` 验证共同祖先；在 Gitea Network 页面确认分支拓扑图正确。
- [ ] 模拟各子分支合并到 main，记录冲突情况；评估冲突量是否在可接受范围内。
- [ ] 代码完整性抽查：随机抽取 3-5 个文件对比内容一致，确认无丢失或编码异常。

### D. 团队切换准备

- [ ] 确定正式切换日期，通知团队成员切换计划和新仓库地址。
- [ ] 准备简要的 Git 操作指南（TFS → Git 命令对照），安排一次团队演示或培训。
- [ ] 配置 main 分支保护规则、Pull Request 合并策略、Code Review 审查要求，添加团队成员账号和权限。
- [ ] 确定 TFS 只读截止日期；过渡期内如需同步使用 `git tfs fetch`；确认所有成员已成功克隆新仓库。

### E. 回滚预案

- [ ] 保留 TFS 仓库不动（至少 1 个月内不删除），作为回滚备份。
- [ ] 记录迁移使用的 git-tfs 命令和参数，以便重新执行。
- [ ] 如迁移失败，团队可立即切回 TFS 继续工作。

### F. 待办汇总

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

> 此外需准备 Gitea 部署机器，要求 SSD、可安装 Docker Desktop。
