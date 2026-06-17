#!/bin/bash
# ============================================================
# card-game MySQL 每日备份脚本 (v2.2.1.4)
# ============================================================
# 适用：crontab -e 添加 "0 3 * * * /path/to/backup-mysql.sh"
# 行为：mysqldump 整库 → gzip → 保留最近 7 天 → 删旧的
# 输出：/backup/card-game-YYYYMMDD.sql.gz
# 日志：/var/log/card-game-backup.log
# ============================================================

set -e

# ---------- 配置 ----------
BACKUP_DIR="${BACKUP_DIR:-/backup}"
KEEP_DAYS="${KEEP_DAYS:-7}"
LOG_FILE="${LOG_FILE:-/var/log/card-game-backup.log}"
MYSQL_USER="${MYSQL_USER:-cardgame}"
MYSQL_DB="${MYSQL_DB:-card_game}"

# ---------- 工具函数 ----------
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG_FILE" >&2
}

# ---------- 前置检查 ----------
mkdir -p "$BACKUP_DIR" 2>/dev/null || {
  log "ERROR: 无法创建备份目录 $BACKUP_DIR (权限不足?)"
  exit 1
}

# 检查 mysqldump
if ! command -v mysqldump &>/dev/null; then
  log "ERROR: mysqldump 命令未找到 (MySQL 未安装?)"
  exit 1
fi

# ---------- 1. 备份 ----------
DATE=$(date +%Y%m%d)
BACKUP_FILE="$BACKUP_DIR/card-game-${DATE}.sql.gz"

log "开始备份 MySQL 数据库 '$MYSQL_DB' → $BACKUP_FILE"

# 用 .my.cnf 避免密码在命令行 (推荐在 /root/.my.cnf 配 [client] user=xxx password=xxx)
# 或从 .env 读: source /home/deploy/New_Card_Game/card-game/server/.env
if [ -f /home/deploy/New_Card_Game/card-game/server/.env ]; then
  set +e
  source /home/deploy/New_Card_Game/card-game/server/.env
  set -e
fi

if mysqldump -u "$MYSQL_USER" -p"${DB_PASSWORD:-}" \
     --single-transaction --quick --lock-tables=false \
     "$MYSQL_DB" 2>"$LOG_FILE.err" | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "✅ 备份成功: $BACKUP_FILE ($SIZE)"
  rm -f "$LOG_FILE.err"
else
  log "❌ 备份失败, 查看: $LOG_FILE.err"
  cat "$LOG_FILE.err" >> "$LOG_FILE"
  rm -f "$LOG_FILE.err"
  exit 1
fi

# ---------- 2. 清理旧备份 ----------
DELETED=$(find "$BACKUP_DIR" -name "card-game-*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  log "🗑️  清理了 $DELETED 个 $KEEP_DAYS 天前的旧备份"
fi

# ---------- 3. 统计 ----------
REMAIN=$(find "$BACKUP_DIR" -name "card-game-*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "📊 当前保留: $REMAIN 个备份, 总大小: $TOTAL_SIZE"

# ---------- 4. 可选: 同步到本机 (需要本机有 SSH key 配到服务器) ----------
SYNC_TO_LOCAL="${SYNC_TO_LOCAL:-}"  # 设置为 "user@host:/path/" 启用
if [ -n "$SYNC_TO_LOCAL" ]; then
  log "🔄 同步到本机: $SYNC_TO_LOCAL"
  if rsync -avz --remove-source-files "$BACKUP_FILE" "$SYNC_TO_LOCAL" 2>>"$LOG_FILE"; then
    log "✅ 同步成功"
  else
    log "❌ 同步失败, 不影响本地备份"
  fi
fi

exit 0
