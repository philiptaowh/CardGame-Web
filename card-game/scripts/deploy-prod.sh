#!/bin/bash
# ============================================================
# card-game 后续更新部署脚本 (v2.2.1.4)
# ============================================================
# 适用：本机 → 服务器的代码同步
# 执行：bash deploy-prod.sh (在 card-game 根目录)
# 前提：服务器已用 setup-server.sh 初始化, 本机能 ssh 到 deploy@ECS
# ============================================================

set -e

# ---------- 配置 (可被环境变量覆盖) ----------
ECS_USER="${ECS_USER:-deploy}"
ECS_HOST="${ECS_HOST:-}"  # 必填: 你的 ECS 公网 IP 或域名
REMOTE_DIR="${REMOTE_DIR:-/home/deploy/New_Card_Game}"
GIT_BRANCH="${GIT_BRANCH:-v2.2.0-alpha-web-edition}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------- 前置检查 ----------
if [ -z "$ECS_HOST" ]; then
  log_error "请设置 ECS_HOST: ECS_HOST=card.example.com bash $0"
  exit 1
fi

if ! command -v ssh &>/dev/null; then
  log_error "ssh 命令未找到 (本机需安装 ssh client)"
  exit 1
fi

# 测连通性
log_info "测试 SSH 连通性 $ECS_USER@$ECS_HOST..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$ECS_USER@$ECS_HOST" "echo ok" &>/dev/null; then
  log_error "SSH 无法连接 $ECS_USER@$ECS_HOST"
  log_error "请检查: ECS 安全组 22 端口 / 本机 ssh key 配置 / ECS_HOST 拼写"
  exit 1
fi
log_info "✅ SSH 可达"

# ---------- 1. 拉取最新代码 ----------
log_info "[1/5] 拉取最新代码 (分支: $GIT_BRANCH)..."
ssh -o ConnectTimeout=30 "$ECS_USER@$ECS_HOST" << EOF
  set -e
  cd $REMOTE_DIR
  git fetch origin $GIT_BRANCH
  git reset --hard origin/$GIT_BRANCH
  git status -sb
EOF

# ---------- 2. 前端构建 ----------
log_info "[2/5] 重新构建前端 (npm run build:web)..."
ssh -o ConnectTimeout=180 "$ECS_USER@$ECS_HOST" << EOF
  set -e
  cd $REMOTE_DIR/card-game
  npm install --no-audit --no-fund
  npm run build:web
EOF

# ---------- 3. 覆盖 nginx 静态目录 ----------
log_info "[3/5] 覆盖 /var/www/card-game/..."
ssh -o ConnectTimeout=30 "$ECS_USER@$ECS_HOST" << EOF
  set -e
  sudo rm -rf /var/www/card-game
  sudo mkdir -p /var/www/card-game
  sudo cp -r $REMOTE_DIR/card-game/dist/* /var/www/card-game/
  sudo chown -R nginx:nginx /var/www/card-game
  sudo systemctl reload nginx
EOF
log_info "✅ 前端已部署 (nginx reload 立即生效)"

# ---------- 4. 后端构建 + 重启 ----------
log_info "[4/5] 重新构建后端 + restart systemd..."
ssh -o ConnectTimeout=180 "$ECS_USER@$ECS_HOST" << EOF
  set -e
  cd $REMOTE_DIR/card-game/server
  npm install --production --no-audit --no-fund
  npm run build
  sudo systemctl restart card-game-server
  sleep 2
  sudo systemctl status card-game-server --no-pager | head -5
EOF

# ---------- 5. 端到端验证 ----------
log_info "[5/5] 端到端验证..."
API_URL="https://$ECS_HOST/api/health"
HTTP_URL="https://$ECS_HOST/"

# 等待服务完全启动
sleep 3

# Health check
if ssh -o ConnectTimeout=10 "$ECS_USER@$ECS_HOST" "curl -s http://127.0.0.1:3000/api/health" | grep -q '"ok":true'; then
  log_info "✅ 后端健康检查通过"
else
  log_error "❌ 后端健康检查失败, 查看: ssh $ECS_USER@$ECS_HOST 'sudo journalctl -u card-game-server -n 20'"
  exit 1
fi

# HTTPS check (如果 SSL 已配)
if curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL" | grep -q "200\|301\|302"; then
  log_info "✅ 站点可访问: $HTTP_URL"
else
  log_warn "⚠️  HTTPS 站点未响应 (可能 SSL 未配)"
fi

echo
log_info "=========================================="
log_info "✅ 部署完成!"
log_info "=========================================="
echo "分支: $GIT_BRANCH"
echo "服务器: $ECS_USER@$ECS_HOST"
echo "前端: $HTTP_URL"
echo "API: https://$ECS_HOST/api/health"
echo
echo "录像下载 (本机):"
echo "  ADMIN_TOKEN=\$(ssh $ECS_USER@$ECS_HOST 'cat $REMOTE_DIR/card-game/server/.env | grep ADMIN_TOKEN | cut -d= -f2') node tools/pull_replays.cjs 2026-06-01 2099-12-31 ./downloads/latest.jsonl"
