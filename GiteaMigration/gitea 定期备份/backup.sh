#!/bin/bash
# Gitea全自动灾备备份脚本 定稿版
DATE=$(date +%Y%m%d)
BACKUP_NAME="gitea-daily-backup-${DATE}.zip"

# 容器内备份路径、宿主机本地备份路径
IN_CONTAINER_PATH="/data/gitea/${BACKUP_NAME}"
LOCAL_BACKUP_FILE="/data/gitea/gitea/${BACKUP_NAME}"

# 独立机械硬盘归档备份目录
ARCHIVE_DIR="/mnt/archive_hdd/gitea_backup"
mkdir -p "${ARCHIVE_DIR}"

echo "====================================="
echo "开始执行 Gitea dump 备份：${BACKUP_NAME}"
echo "====================================="

# 1.容器内执行Gitea全量备份
/usr/bin/docker exec -u git gitea gitea dump -c /data/gitea/conf/app.ini --skip-repository=false -f "${IN_CONTAINER_PATH}"

# 2.校验备份文件是否生成成功，失败则退出
if [ ! -f "${LOCAL_BACKUP_FILE}" ];then
    echo "❌ ERROR：备份文件生成失败，文件不存在：${LOCAL_BACKUP_FILE}"
    exit 1
fi

echo "✅ 本地备份文件生成完成，准备复制至归档硬盘"

# 3.同步备份文件至独立机械硬盘（灾备副本）
cp "${LOCAL_BACKUP_FILE}" "${ARCHIVE_DIR}/"

# 4.自动过期清理策略
# 本地系统盘：保留最近1天备份
find /data/gitea/gitea -maxdepth 1 -name "gitea-daily-backup-*.zip" -mtime +1 -delete
# 机械硬盘归档盘：保留最近10天备份
find "${ARCHIVE_DIR}" -name "gitea-daily-backup-*.zip" -mtime +10 -delete

echo "✅ 全部任务完成！"
echo "本地热备路径：${LOCAL_BACKUP_FILE}"
echo "归档灾备路径：${ARCHIVE_DIR}/${BACKUP_NAME}"
echo "====================================="