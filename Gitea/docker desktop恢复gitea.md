docker run -d `
    --name gitea-test `
    -p 3000:3000 `
    -p 2222:22 `
    -v ~/wsl-gitea-demo:/data/gitea/gitea `
    -v "E:\Gitea_backup:/backup" `
    gitea/gitea:1.22.3
Start-Sleep -Seconds 5


先将备份dump文件解压到本地磁盘：
# 1. 把 SQL 文件复制到 mysql 容器内
docker cp E:\Gitea_backup\Gitea\backup\gitea_dump_20260805\gitea-db.sql gitea-mysql:/tmp/gitea-db.sql

# 2. 使用root用户+密码执行还原
docker exec -i gitea-mysql mysql -uroot -pGitea@2026 gitea -e "source /tmp/gitea-db.sql"