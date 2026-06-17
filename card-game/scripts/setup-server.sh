#!/bin/bash
# ============================================================
# card-game-server 首次部署脚本 (v2.2.1.4)
# ============================================================
# 适用：Alibaba Cloud Linux 3.2104 LTS 64位
# 执行：root 用户, bash setup-server.sh
# 作用：完成 §3-7 所有初始化, 部署完后浏览器即可访问域名
# ============================================================

set -e  # 任一命令失败立即退出

# ---------- 颜色输出 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------- 0. 前置检查 ----------
if [ "$(id -u)" != "0" ]; then
  log_error "请用 root 用户运行此脚本: sudo bash $0"
  exit 1
fi

if [ ! -f /etc/alinux-release ]; then
  log_warn "未检测到 Alibaba Cloud Linux, 脚本可能不兼容"
  read -p "继续? (y/N) " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

log_info "=========================================="
log_info "card-game 首次部署脚本 (v2.2.1.4)"
log_info "目标系统: $(cat /etc/alinux-release 2>/dev/null || echo 'Unknown')"
log_info "=========================================="
echo

# ---------- 1. 收集配置 ----------
read -p "请输入域名 (e.g. card.example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then log_error "域名不能为空"; exit 1; fi

read -p "请输入 MySQL root 密码 (首次设置, 强密码): " -s MYSQL_ROOT_PASSWORD
echo
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then log_error "密码不能为空"; exit 1; fi

read -p "请输入 MySQL 应用密码 (cardgame 用户, 强密码): " -s MYSQL_APP_PASSWORD
echo
if [ -z "$MYSQL_APP_PASSWORD" ]; then log_error "密码不能为空"; exit 1; fi

read -p "请输入 GitHub 仓库地址 [https://github.com/philiptaowh/CardGame-Web.git]: " GIT_REPO
GIT_REPO=${GIT_REPO:-https://github.com/philiptaowh/CardGame-Web.git}

read -p "请输入部署分支 [v2.2.0-alpha-web-edition]: " GIT_BRANCH
GIT_BRANCH=${GIT_BRANCH:-v2.2.0-alpha-web-edition}

# admin token 自动生成
ADMIN_TOKEN=$(openssl rand -hex 32)
log_info "已自动生成 ADMIN_TOKEN (将写入 .env, 部署后请妥善保存)"

# ---------- 2. 更新系统 + 安装基础工具 ----------
log_info "[1/8] 更新系统 + 安装基础工具..."
dnf update -y -q
dnf install -y -q git curl wget vim tar gzip openssl firewalld policycoreutils-python-utils

# ---------- 3. 创建 deploy 用户 ----------
log_info "[2/8] 创建 deploy 用户..."
if ! id deploy &>/dev/null; then
  adduser deploy
  log_info "deploy 用户已创建 (请用 passwd deploy 设密码)"
  read -p "按 Enter 继续 (确保已设密码)..." -r
fi
usermod -aG wheel deploy

# ---------- 4. 禁用 SELinux ----------
log_info "[3/8] 禁用 SELinux (避免 nginx → node 反代被阻止)..."
setenforce 0
if [ -f /etc/selinux/config ]; then
  sed -i 's/^SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config
  sed -i 's/^SELINUX=permissive/SELINUX=disabled/' /etc/selinux/config
fi
log_info "SELinux 当前: $(getenforce) (下次重启后永久 disabled)"

# ---------- 5. 配置 firewalld ----------
log_info "[4/8] 配置 firewalld..."
systemctl enable firewalld
systemctl start firewalld
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
log_info "firewalld 已开放: 22 (ssh), 80 (http), 443 (https)"

# ---------- 6. 安装 MySQL 8.0 (加 MySQL 官方源) ----------
log_info "[5/8] 安装 MySQL 8.0 (加官方源)..."
dnf install -y -q https://dev.mysql.com/get/mysql80-community-release-el8-9.noarch.rpm
dnf config-manager --disable mysql-8.4-latest 2>/dev/null || true
dnf config-manager --enable mysql-8.0-latest 2>/dev/null || true
dnf install -y -q mysql-server
systemctl enable mysqld
systemctl start mysqld
sleep 5  # 等待 mysqld 完全启动

# 检查临时密码
TEMP_PW=$(grep 'temporary password' /var/log/mysqld.log 2>/dev/null | tail -1 | awk '{print $NF}')
if [ -n "$TEMP_PW" ]; then
  log_info "使用临时密码登录并改密..."
  # 这里需要先用临时密码登录再改
  mysql --connect-timeout=10 -u root -p"$TEMP_PW" --connect-expired-password -e \
    "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASSWORD';" 2>/dev/null || \
    log_warn "自动改 root 密码失败, 请手动跑 mysql_secure_installation"
fi

# 创建数据库 + 用户
log_info "创建 card_game 数据库和 cardgame 用户..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "
CREATE DATABASE IF NOT EXISTS card_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cardgame'@'localhost' IDENTIFIED BY '$MYSQL_APP_PASSWORD';
GRANT ALL PRIVILEGES ON card_game.* TO 'cardgame'@'localhost';
FLUSH PRIVILEGES;
" 2>/dev/null || log_warn "数据库初始化失败, 请手动检查"
log_info "✅ MySQL 初始化完成 (DB: card_game, User: cardgame)"

# ---------- 7. 安装 Node.js (nvm) ----------
log_info "[6/8] 安装 Node.js 20 (via nvm)..."
if [ ! -d /home/deploy/.nvm ]; then
  sudo -u deploy bash -c '
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source ~/.bashrc
    nvm install 20
    nvm use 20
    nvm alias default 20
  '
fi
log_info "Node.js 安装完成: $(sudo -u deploy bash -c 'source ~/.bashrc && node -v')"

# ---------- 8. 安装 nginx ----------
log_info "[7/8] 安装 nginx..."
dnf install -y -q nginx
systemctl enable nginx
log_info "nginx 已安装: $(nginx -v 2>&1)"

# ---------- 9. 克隆项目 + 构建 ----------
log_info "[8/8] 克隆项目 + 构建..."
sudo -u deploy bash -c "
  set -e
  cd ~
  if [ ! -d New_Card_Game ]; then
    git clone $GIT_REPO
  fi
  cd New_Card_Game
  git checkout $GIT_BRANCH
  git pull origin $GIT_BRANCH

  # 前端构建
  cd card-game
  npm install --no-audit --no-fund
  npm run build:web

  # 后端构建
  cd server
  npm install --production --no-audit --no-fund
  npm run build
"

# 移动前端到 nginx 目录
rm -rf /var/www/card-game
mkdir -p /var/www/card-game
cp -r /home/deploy/New_Card_Game/card-game/dist/* /var/www/card-game/
chown -R nginx:nginx /var/www/card-game

# ---------- 10. 创建 .env + systemd + nginx 配置 ----------
log_info "写入 .env (含 ADMIN_TOKEN)..."
cat > /home/deploy/New_Card_Game/card-game/server/.env <<EOF
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cardgame
DB_PASSWORD=$MYSQL_APP_PASSWORD
DB_NAME=card_game
CORS_ORIGIN=https://$DOMAIN
ADMIN_TOKEN=$ADMIN_TOKEN
EOF
chown deploy:deploy /home/deploy/New_Card_Game/card-game/server/.env
chmod 600 /home/deploy/New_Card_Game/card-game/server/.env

log_info "创建 systemd 服务..."
cat > /etc/systemd/system/card-game-server.service <<EOF
[Unit]
Description=Card Game v2.2.0-alpha Server
After=network.target mysqld.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/New_Card_Game/card-game/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/home/deploy/New_Card_Game/card-game/server/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable card-game-server
systemctl start card-game-server

log_info "配置 nginx (HTTP only, 待 SSL 上传后启用 HTTPS)..."
cat > /etc/nginx/conf.d/card-game.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # 前端静态资源
    root /var/www/card-game;
    index index.html;

    # SPA 路由 fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 后端 API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
EOF

nginx -t
systemctl reload nginx

# ---------- 11. 完成 ----------
echo
log_info "=========================================="
log_info "✅ 部署完成!"
log_info "=========================================="
echo
echo "后续步骤:"
echo "  1. 上传 SSL 证书到 /etc/nginx/ssl/:"
echo "     scp $DOMAIN.pem $DOMAIN.key root@<ECS-IP>:/etc/nginx/ssl/"
echo
echo "  2. 编辑 /etc/nginx/conf.d/card-game.conf, 把 listen 80 改 443 + ssl 配置"
echo "     (参考 DEPLOY.md §7.3)"
echo
echo "  3. nginx -t && systemctl reload nginx"
echo
echo "  4. 在阿里云域名控制台, 域名 A 记录 → ECS 公网 IP"
echo
echo "  5. 验证: curl http://<ECS-IP>/api/health"
echo "     期望: {\"status\":\"ok\",\"db\":\"connected\",\"count\":0,...}"
echo
echo "重要信息 (请保存):"
echo "  - DOMAIN: $DOMAIN"
echo "  - ADMIN_TOKEN: $ADMIN_TOKEN"
echo "  - 服务端: ssh deploy@<ECS-IP>"
echo "  - 后端代码: /home/deploy/New_Card_Game/card-game/server/"
echo "  - 前端代码: /home/deploy/New_Card_Game/card-game/dist/ → /var/www/card-game/"
echo "  - 网站底部需添加备案号 (从阿里云备案管理获取)"
echo
log_warn "ADMIN_TOKEN 仅显示一次, 请立即保存到密码管理器!"
echo
