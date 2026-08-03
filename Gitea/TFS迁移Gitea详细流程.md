## TFS 代码管理迁移至 Gitea 详细流程

### 一、迁移概述

本流程将 TFS（Team Foundation Server）中基于物理文件夹路径管理的代码仓库，迁移至 Gitea（Git 自托管平台），同时完整保留提交历史和分支关联关系，确保迁移后分支间的合并操作可正常执行。

**迁移目标**：TFS 物理分支 → Git 逻辑分支 → Gitea 远程仓库

**核心原则**：保留分支间的共同祖先（common ancestor），使 Git 三路合并算法能正确工作。

---

### 二、迁移前准备

#### 2.1 环境检查

在迁移机上确认以下环境就绪：

```bash
# 确认 git 版本（建议 2.30+）
git --version

# 确认 .NET Framework 4.7+ 已安装（git-tfs 依赖）
reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release

# 确认能访问 TFS 服务器
ping your-tfs-server
```

#### 2.2 安装 git-tfs

```bash
# 方式一：通过 Chocolatey 安装（推荐）
choco install gittfs

# 方式二：手动下载安装
# 从 https://github.com/git-tfs/git-tfs/releases 下载最新 release
# 解压后将路径加入系统 PATH
```

#### 2.3 梳理 TFS 仓库结构

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

#### 2.4 评估仓库规模

```bash
# 通过 TFS Web 或 API 查看 Main 分支的总 changeset 数量
# 如果超过 5000 条，建议考虑截断早期历史以加快迁移速度
```

---

### 三、核心迁移流程

#### 3.1 克隆 TFS 主分支（含全部关联分支）

这是整个迁移中最关键的一步。`--with-branches` 参数会让 git-tfs 自动扫描 TFS 中与 Main 有分支关系的所有子分支，并在 Git 中重建完整的分支拓扑。

```bash
# 创建工作目录
mkdir tfs-migration
cd tfs-migration

# 执行克隆（首次运行会下载所有 changeset，耗时较长,注意 网络路径 需要加引号）
git tfs clone http://your-tfs-server:8080/tfs/DefaultCollection ^
    "$/Project/Main" ^     
    --with-branches ^
    --username=DOMAIN\username ^
    --authors=authors.txt
```

**参数说明**：

| 参数 | 作用 |
|------|------|
| `--with-branches` | 自动发现并克隆所有关联的 TFS 子分支，保留分支创建和合并的历史关系 |
| `--username` | TFS 认证账号，格式为 `DOMAIN\username` 或 `username@domain` |
| `--authors` | 可选，指定作者映射文件，将 TFS 账号映射为 Git 的 `Name <email>` 格式 |

**`--with-branches` 的工作原理**：

git-tfs 会遍历 TFS 的分支对象（Branch Object），追溯每个子分支的创建来源（parent branch + changeset），在 Git 中创建对应的远程分支（`remotes/tfs/branch-name`），并在 commit 历史中正确设置 parent commit 关系。这意味着 Git 能识别出各分支的分叉点，后续 merge 操作可正常进行。

#### 3.2 作者映射（可选但推荐）

如果 TFS 中的提交者账号格式不统一（如 `DOMAIN\zhangsan`），可以创建 `authors.txt` 文件进行映射：

```
DOMAIN\zhangsan = 张三 <zhangsan@company.com>
DOMAIN\lisi = 李四 <lisi@company.com>
DOMAIN\wangwu = 王五 <wangwu@company.com>
```

在 clone 时通过 `--authors=authors.txt` 指定，git-tfs 会将 TFS 的 committer 信息转换为标准的 Git 作者格式。

#### 3.3 历史截断（可选）

如果 Main 分支历史非常长（数千条 changeset），且早期历史对团队价值不大，可以截断以加速迁移：

```bash
# 先查看 changeset 列表，找到合适的截断点
git tfs log --all

# 从指定 changeset 开始克隆（丢弃此 changeset 之前的历史）
git tfs clone http://your-tfs-server:8080/tfs/DefaultCollection ^
    $/Project/Main ^
    --with-branches ^
    --from=C12345
```

> 注意：截断后，被截断的 changeset 之前的提交将不存在于 Git 历史中。如果子分支的分叉点在截断范围之后，分支关系仍然能正确保留。

#### 3.4 验证克隆结果

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

### 四、分支转换与本地化

#### 4.1 将远程分支转为本地分支

```bash
# 将 TFS 远程分支映射为 Git 本地分支
git branch main remotes/tfs/default
git branch branch1 remotes/tfs/branch1
git branch branch2 remotes/tfs/branch2

# 切换到主分支
git checkout main
```

#### 4.2 清理 git-tfs 远程引用

```bash
# 删除 git-tfs 的远程引用（迁移完成后不再需要）
git remote remove tfs

# 验证本地分支列表
git branch -a
```

#### 4.3 创建 `.gitignore`

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

---

### 五、迁移至 Gitea

#### 5.1 在 Gitea 创建仓库

通过 Gitea Web 界面或 API 创建目标仓库：

- 仓库名称：建议与 TFS 项目名一致
- 可见性：根据团队需求选择
- 初始化选项：**不要**勾选"初始化仓库"（README、.gitignore 等），避免产生初始 commit 导致推送冲突

#### 5.2 添加 Gitea 远程仓库并推送

```bash
# 添加 Gitea 远程仓库
git remote add origin http://testmachine:3000/sinounion/PET-CT.git

# 推送所有本地分支
git push origin --all

# 推送所有标签
git push origin --tags

# 设置上游跟踪
git push -u origin main
```

#### 5.3 验证 Gitea 上的仓库

登录 Gitea Web 界面检查：

- 所有分支是否都已推送成功
- 提交历史是否完整
- 分支拓扑图（Gitea 的 Network 页面）是否显示正确的分叉关系

---

### 六、迁移后验证

#### 6.1 历史完整性验证

```bash
# 对比 TFS 和 Git 的提交数量
# TFS 端：查看 changeset 总数
# Git 端：
git rev-list --count main
git rev-list --count branch1
git rev-list --count branch2
```

#### 6.2 分支关系验证

```bash
# 验证 Main 和 Branch1 是否有共同祖先
git merge-base main branch1

# 如果输出了一个 commit hash，说明共同祖先存在，合并可以正常进行
# 如果报错 "fatal: No common commit"，说明分支关系未正确迁移

# 可视化分支拓扑
git log --oneline --graph main branch1 branch2
```

#### 6.3 模拟合并验证

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

---

### 七、迁移后团队工作流切换

#### 7.1 团队成员克隆仓库

```bash
# 团队成员从 Gitea 克隆（标准 Git 操作）
git clone http://your-gitea-server:3000/org/repo-name.git
```

#### 7.2 分支操作对照表

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

#### 7.3 Gitea 上的分支保护

在 Gitea 仓库设置中配置分支保护规则：

- **Main 分支**：禁止直接 push，必须通过 Pull Request 合并
- **合并策略**：建议启用"Fast-forward only"或"Squash and merge"
- **审查要求**：至少 1 人 Code Review 后方可合并

---

### 八、常见问题与处理

**Q: `git tfs clone` 过程中断怎么办？**
git-tfs 支持断点续传。重新运行相同的 clone 命令，它会自动从上次中断的位置继续。

**Q: 子分支在 TFS 中是从 Branch1 拉出来的（嵌套分支），能正确迁移吗？**
可以。`--with-branches` 会递归追溯分支关系，嵌套分支也能正确映射。但建议迁移后在 Git 中扁平化分支结构（将嵌套分支直接基于 Main），避免 Git 中出现过深的分支层级。

**Q: 迁移后 `git merge-base` 找不到共同祖先？**
说明分支关系未被正确识别。检查 TFS 中是否确实存在 branch 关系（而非只是手动复制文件夹）。如果只是文件夹复制，TFS 中没有 branch 对象，git-tfs 无法追溯。这种情况需要用 `--allow-unrelated-histories` 强制合并，或手动 rebase 建立关联。

**Q: 迁移后需要继续从 TFS 拉取增量更新吗？**
如果迁移期间 TFS 仍有新提交，可以在 Git 仓库中执行 `git tfs fetch` 拉取增量。确认两边完全同步后再执行 `git remote remove tfs` 断开连接。

---

### 九、迁移时间线参考

| 阶段 | 预计耗时 | 说明 |
|------|----------|------|
| 环境准备与梳理 | 0.5 天 | 安装工具、确认分支结构 |
| git-tfs 克隆 | 1-2 天 | 取决于 changeset 数量和网络速度 |
| 分支转换与清理 | 0.5 天 | 本地分支映射、.gitignore |
| 推送至 Gitea | 0.5 天 | 推送验证 |
| 合并验证与冲突评估 | 1 天 | 模拟合并、记录冲突 |
| 团队培训与切换 | 1 天 | 工作流切换、Gitea 使用 |
| **合计** | **约 4-5 天** | 含缓冲时间 |
