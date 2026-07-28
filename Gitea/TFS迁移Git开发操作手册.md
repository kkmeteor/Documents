## TFS 迁移 Git —— 开发人员操作手册

本文档帮助已熟悉 TFS 的开发人员快速上手 Git，分为三部分：常用操作对照、Git 独有亮点功能、推荐工作流。

---

### 一、常用操作对照

#### 1. 日常开发

| 操作 | TFS | Git |
|------|-----|-----|
| 获取最新代码 | 右键 → 获取最新版本 | `git pull` |
| 签出文件以编辑 | 右键 → 签出（锁定/不锁定） | **无需签出**，文件默认可编辑 |
| 签入代码 | 右键 → 签入更改 | `git add .` → `git commit -m "说明"` → `git push` |
| 撤销签出 | 右键 → 撤销签出 | `git restore <file>` |
| 撤销已签入的更改 | 回滚变更集 | `git revert <commit>` |
| 查看待签入更改 | 待检更改窗口 | `git status` |
| 查看文件差异 | 右键 → 比较 | `git diff`（未暂存）/ `git diff --staged`（已暂存） |
| 添加新文件 | 右键 → 添加 | `git add <file>` |
| 删除文件 | 右键 → 删除 | `git rm <file>` |
| 重命名/移动文件 | 右键 → 重命名 | `git mv <old> <new>` |

#### 2. 历史与追溯

| 操作 | TFS | Git |
|------|-----|-----|
| 查看提交历史 | 右键 → 查看历史记录 | `git log` / `git log --oneline`（简洁模式） |
| 查看某次变更详情 | 查看变更集 | `git show <commit>` |
| 查看谁修改了某行 | 右键 → 批注 | `git blame <file>` |
| 获取历史版本文件 | 右键 → 查看 → 获取此版本 | `git show <commit>:<file>` |
| 比较两个版本 | 选择两个版本 → 比较 | `git diff <commit1> <commit2>` |

#### 3. 分支管理

| 操作 | TFS | Git |
|------|-----|-----|
| 创建分支 | 源代码管理 → 分支 → 创建分支 | `git branch <branch-name>` 或 `git switch -c <branch-name>` |
| 切换到其他分支 | 源代码管理 → 切换到分支 | `git switch <branch-name>` |
| 合并分支到主干 | 合并 → 选择源分支和目标分支 | 先切到目标分支：`git switch main`，再 `git merge <feature-branch>` |
| 删除分支 | 源代码管理 → 删除分支 | `git branch -d <branch-name>` |
| 查看本地分支 | 分支文件夹 | `git branch` |
| 查看远端分支 | 源代码资源管理器 | `git branch -r` |

#### 4. 暂存与恢复

| 操作 | TFS | Git |
|------|-----|-----|
| 暂存当前工作 | 搁置（Shelve） | `git stash` |
| 恢复暂存的工作 | 取消搁置（Unshelve） | `git stash pop` |
| 查看暂存列表 | 搁置集 | `git stash list` |

#### 5. 标签与版本标记

| 操作 | TFS | Git |
|------|-----|-----|
| 创建标签 | 源代码管理 → 创建标签 | `git tag <tag-name>` |
| 创建带说明的标签 | — | `git tag -a v1.0 -m "版本说明"` |
| 查看所有标签 | — | `git tag` |
| 切换到某个标签 | — | `git checkout v1.0` |

---

### 二、Git 独有的亮点功能

以下功能在 TFS 中没有对应操作，是 Git 的独有优势，建议开发人员掌握。

#### 1. 交互式暂存（`git add -p`）

TFS 的签入以文件为单位，一个文件要么全部签入要么不签入。Git 支持将同一个文件的修改拆分为多个提交：

```bash
git add -p <file>
```

执行后会逐块展示你的修改，每块都可以单独选择 `y`（暂存）或 `n`（跳过）。这样可以将一个大改动拆分为多个逻辑清晰的提交，每个提交只做一件事，历史更易读。

#### 2. Cherry-pick（精确移植提交）

TFS 合并只能以分支为单位整体合并。Git 可以从一个分支中精确挑选某个或某几个提交，应用到另一个分支：

```bash
git switch main
git cherry-pick <commit-hash>
```

典型场景：hotfix 分支修了一个 bug，只需要把这个修复应用到 main，不需要合并 hotfix 分支上的其他实验性改动。

#### 3. 交互式变基（`git rebase -i`）

在推送之前，可以将多个零碎的本地提交整理为干净的提交历史：

```bash
git rebase -i HEAD~3    # 整理最近 3 个提交
```

弹出编辑器后可以执行：`pick`（保留）、`squash`（合并到上一个提交）、`reword`（修改提交说明）、`drop`（删除提交）。推送前整理历史，让团队看到的提交都是清晰、有意义的。

#### 4. 暂存区（Staging Area）

TFS 的"待检更改"窗口列出所有已修改文件，签入时全选即可。Git 多了一个"暂存区"层，可以精确控制每次提交包含哪些文件甚至哪些修改块：

```bash
git add file1.cs file2.cs    # 只暂存指定文件
git add -p file3.cs          # 只暂存 file3.cs 的部分修改
git commit -m "修复登录逻辑"  # 只提交暂存区的内容
```

这意味着你可以一边修 bug 一边做新功能，然后分成两个干净的提交分别推送。

#### 5. 工作树（`git worktree`）

TFS 中如果要同时处理两个分支，需要创建多个工作区或使用分支切换。Git 允许同时检出多个分支到不同目录，共享同一个仓库：

```bash
git worktree add ../hotfix main
git worktree add ../feature feature/login
```

每个目录是独立的工作区，可以独立编译和调试，互不干扰。完成后用 `git worktree remove ../hotfix` 清理。

#### 6. Bisect（二分查找定位 bug）

当发现一个 bug 但不确定是哪次提交引入的，Git 可以自动二分查找：

```bash
git bisect start
git bisect bad              # 当前版本有 bug
git bisect good v1.0        # v1.0 版本正常
```

Git 会自动选择一个中间的提交让你测试，你告诉它 `good` 或 `bad`，它继续缩小范围，通常 5-6 次就能从几百个提交中定位到问题提交。

#### 7. Reflog（后悔药）

TFS 中如果误操作（如错误回滚），恢复比较困难。Git 的 reflog 记录了所有 HEAD 移动的历史，即使提交被撤销或分支被删除，也能找回：

```bash
git reflog                  # 查看所有 HEAD 移动记录
git reset --hard HEAD@{5}   # 恢复到之前的某个状态
```

#### 8. 浅克隆与稀疏检出

对于大型仓库，不需要下载全部历史和所有文件：

```bash
git clone --depth 1 <repo>              # 只拉取最新快照，不下载历史
git clone --sparse <repo>               # 稀疏检出
git sparse-checkout set src/lib         # 只检出需要的目录
```

TFS 的"获取最新"必须下载整个工作区，大仓库可能需要数十分钟。Git 浅克隆可以将初始下载时间缩短到几分钟。

#### 9. 别名（Alias）

Git 支持自定义命令别名，减少重复输入：

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --oneline --graph --decorate"
```

配置后 `git st` 等同于 `git status`，`git lg` 显示简洁的图形化提交历史。

---

### 三、推荐工作流

#### 日常开发流程

```
1. 开始工作前拉取最新代码
   git switch main && git pull

2. 创建功能分支
   git switch -c feature/xxx

3. 开发过程中按需提交
   git add -p .
   git commit -m "描述本次变更"

4. 推送到远端
   git push -u origin feature/xxx

5. 发起 Pull Request，等待评审

6. 评审通过后合并到 main
```

#### 紧急修复流程

```
1. 从 main 创建 hotfix 分支
   git switch -c hotfix/xxx main

2. 修复并测试

3. 推送并发起 PR 合并到 main

4. 如果需要修复到 release 分支
   git switch release/v2.0
   git cherry-pick <hotfix-commit>
```

#### 临时切换任务

```
1. 当前工作做到一半，需要处理紧急问题
   git stash                      # 暂存当前修改

2. 切换到紧急任务
   git switch -c hotfix/urgent main
   ... 修复完成 ...

3. 回到之前的工作
   git switch feature/xxx
   git stash pop                  # 恢复暂存的工作
```

---

### 四、注意事项

**提交说明规范。** Git 的 commit message 是提交的核心标识，建议遵循团队约定的格式（如 `类型: 简要描述`），例如 `fix: 修复登录超时问题`。

**不要直接 push 到受保护分支。** main、master、release/* 分支已设置保护，必须通过 Pull Request 合并。

**推送前先拉取。** 多人协作时，推送前先 `git pull --rebase` 避免不必要的合并提交。

**大文件用 Git LFS。** 二进制文件（设计稿、安装包等）不要直接提交到 Git，使用 `git lfs track` 管理，避免仓库体积膨胀。
