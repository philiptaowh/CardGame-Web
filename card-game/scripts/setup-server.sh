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

read -p "请输入部署分支 [New_Card_Game]: " GIT_BRANCH
GIT_BRANCH=${GIT_BRANCH:-New_Card_Game}

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
# 注意：ACL3 默认 SELinux 已 disabled, 此时 setenforce 0 会返回非 0 退出码
# (因为无 SELinux 可切换), 触发 set -e 立即退出
# 修复: 先检测, 如已 disabled 则跳过; 任何 setenforce 失败都用 || true 兜底
log_info "[3/8] 禁用 SELinux (避免 nginx → node 反代被阻止)..."
CURRENT_SESTATUS=$(getenforce 2>/dev/null || echo "Disabled")
log_info "  当前 SELinux 状态: $CURRENT_SESTATUS"
if [ "$CURRENT_SESTATUS" != "Disabled" ]; then
  setenforce 0 2>/dev/null || log_warn "  setenforce 0 失败 (但继续)"
else
  log_info "  SELinux 已是 Disabled, 跳过 setenforce"
fi
if [ -f /etc/selinux/config ]; then
  sed -i 's/^SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config
  sed -i 's/^SELINUX=permissive/SELINUX=disabled/' /etc/selinux/config
fi
log_info "  SELinux 当前: $(getenforce 2>/dev/null || echo 'Unknown') (下次重启后永久 disabled)"

# ---------- 5. 配置 firewalld ----------
log_info "[4/8] 配置 firewalld..."
systemctl enable firewalld 2>/dev/null || log_warn "  firewalld enable 失败 (但继续)"
systemctl start firewalld 2>/dev/null || {
  log_warn "  firewalld start 失败, 尝试重装"
  dnf install -y -q firewalld
  systemctl start firewalld
}
firewall-cmd --permanent --add-service=ssh 2>/dev/null || log_warn "  firewall ssh 规则失败"
firewall-cmd --permanent --add-service=http 2>/dev/null || log_warn "  firewall http 规则失败"
firewall-cmd --permanent --add-service=https 2>/dev/null || log_warn "  firewall https 规则失败"
firewall-cmd --reload
log_info "firewalld 已开放: 22 (ssh), 80 (http), 443 (https)"

# ---------- 6. 安装 MySQL 8.0 (加 MySQL 官方源) ----------
log_info "[5/8] 安装 MySQL 8.0 (加官方源)..."
dnf install -y -q https://dev.mysql.com/get/mysql80-community-release-el8-9.noarch.rpm
dnf config-manager --disable mysql-8.4-latest 2>/dev/null || true
dnf config-manager --enable mysql-8.0-latest 2>/dev/null || true
dnf install -y -q mysql-server
systemctl enable mysqld 2>/dev/null || log_warn "  mysqld enable 失败 (但继续)"
systemctl start mysqld 2>/dev/null || log_warn "  mysqld start 失败 (但稍后会重试)"

# 等待 mysqld 完全启动 (轮询直到 ready, 最多 30s)
log_info "等待 mysqld 就绪..."
for i in $(seq 1 30); do
  if mysqladmin ping --silent 2>/dev/null; then
    log_info "  mysqld 已就绪 (用时 ${i}s)"
    break
  fi
  sleep 1
done

# 检测 root 认证方式 (ACL3 + MySQL 8.0 可能用 auth_socket 也可能用临时密码)
log_info "检测 MySQL root 认证方式..."
USE_SUDO_MYSQL=false
if sudo mysql -u root -e "SELECT 1" &>/dev/null; then
  USE_SUDO_MYSQL=true
  log_info "  MySQL root 使用 auth_socket (无密码), 将用 sudo mysql 改密"
else
  # 尝试用临时密码
  TEMP_PW=$(grep 'temporary password' /var/log/mysqld.log 2>/dev/null | tail -1 | awk '{print $NF}')
  if [ -z "$TEMP_PW" ]; then
    log_error "MySQL root 不可访问 (无 auth_socket 也找不到临时密码)"
    log_error "请手动跑: sudo mysql -u root 然后 ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';"
    exit 1
  fi
  log_info "  MySQL root 需要临时密码 (日志: /var/log/mysqld.log)"
fi

# 改 root 密码
if [ "$USE_SUDO_MYSQL" = true ]; then
  sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASSWORD';" || {
    log_error "改 root 密码失败 (auth_socket 模式)"
    exit 1
  }
else
  mysql --connect-timeout=10 -u root -p"$TEMP_PW" --connect-expired-password \
    -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASSWORD';" || {
    log_error "改 root 密码失败 (临时密码模式)"
    log_error "临时密码是: $TEMP_PW"
    exit 1
  }
fi
log_info "  ✅ root 密码已设置"

# 创建数据库 + 应用用户
log_info "创建 card_game 数据库和 cardgame 用户..."
# 关键修复: 两种模式都要传 -u root -p 密码, 不然 ALTER USER 后连不上
# 加 -h 127.0.0.1 强制 TCP (避免 socket 路径在 root 切换后失效)
if [ "$USE_SUDO_MYSQL" = true ]; then
  # sudo 模式: sudo 跳过密码, 但 -p 仍然需要传 (auth_socket 在 ALTER USER 后可能失效)
  MYSQL_CMD="sudo mysql -u root -h 127.0.0.1 -p\"$MYSQL_ROOT_PASSWORD\""
else
  MYSQL_CMD="mysql -u root -h 127.0.0.1 -p\"$MYSQL_ROOT_PASSWORD\""
fi

# 临时进一步降级策略, 避免应用密码也被拒
if [ "$USE_SUDO_MYSQL" = true ]; then
  sudo mysql -u root -e "SET GLOBAL validate_password_policy = LOW;" 2>/dev/null || true
else
  mysql -u root -h 127.0.0.1 -p"$MYSQL_ROOT_PASSWORD" \
    -e "SET GLOBAL validate_password_policy = LOW;" 2>/dev/null || true
fi

$MYSQL_CMD -e "
CREATE DATABASE IF NOT EXISTS card_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cardgame'@'localhost' IDENTIFIED BY '$MYSQL_APP_PASSWORD';
GRANT ALL PRIVILEGES ON card_game.* TO 'cardgame'@'localhost';
FLUSH PRIVILEGES;
" || {
  log_error "数据库初始化失败"
  log_error "调试: 手动跑: mysql -u root -h 127.0.0.1 -p'$MYSQL_ROOT_PASSWORD' -e 'SELECT 1'"
  exit 1
}
log_info "✅ MySQL 初始化完成 (DB: card_game, User: cardgame, Auth: 密码)"

# ---------- 7. 安装 Node.js 20 (多层 fallback) ----------
log_info "[6/8] 安装 Node.js 20 (多层 fallback)..."
NODE_INSTALLED=false

# 方案 1: nvm (需要 raw.githubusercontent.com 可达)
if [ ! -d /home/deploy/.nvm ] && [ "$NODE_INSTALLED" = false ]; then
  log_info "  尝试方案 1: nvm (raw.githubusercontent.com)..."
  if sudo -u deploy bash -c 'curl -fsSL --max-time 30 https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash' 2>/dev/null; then
    if sudo -u deploy bash -c 'source ~/.nvm/nvm.sh && nvm install 20 && nvm use 20 && nvm alias default 20' 2>/dev/null; then
      NODE_INSTALLED=true
      log_info "  ✅ nvm 安装成功"
    fi
  else
    log_warn "  nvm 安装失败 (网络受限?), 尝试方案 2"
  fi
fi

# 方案 2: NodeSource 仓库 (需要 rpm.nodesource.com 可达)
if [ "$NODE_INSTALLED" = false ]; then
  log_info "  尝试方案 2: NodeSource 仓库..."
  if curl -fsSL --max-time 30 https://rpm.nodesource.com/setup_20.x -o /tmp/nodesource-setup.sh 2>/dev/null; then
    if bash /tmp/nodesource-setup.sh 2>/dev/null && dnf install -y -q nodejs 2>/dev/null; then
      NODE_INSTALLED=true
      log_info "  ✅ NodeSource 安装成功"
    fi
  else
    log_warn "  NodeSource 不可达, 尝试方案 3"
  fi
fi

# 方案 3: Aliyun npmmirror 直下二进制 (无需任何外部源)
if [ "$NODE_INSTALLED" = false ]; then
  log_info "  尝试方案 3: Aliyun npmmirror 直下 Node 20..."
  NODE_VER="v20.18.0"
  NODE_TARBALL="node-${NODE_VER}-linux-x64.tar.xz"
  NODE_URL="https://registry.npmmirror.com/-/binary/node/${NODE_VER}/${NODE_TARBALL}"
  if curl -fsSL --max-time 120 -o /tmp/${NODE_TARBALL} ${NODE_URL} 2>/dev/null; then
    mkdir -p /opt/node
    tar -xJf /tmp/${NODE_TARBALL} -C /opt/node --strip-components=1
    ln -sf /opt/node/bin/node /usr/local/bin/node
    ln -sf /opt/node/bin/npm /usr/local/bin/npm
    ln -sf /opt/node/bin/npx /usr/local/bin/npx
    # 写到 deploy 用户的 PATH
    echo 'export PATH=/opt/node/bin:$PATH' > /etc/profile.d/node.sh
    chmod +x /etc/profile.d/node.sh
    NODE_INSTALLED=true
    log_info "  ✅ Aliyun npmmirror 安装成功"
  else
    log_error "  ❌ 3 个方案都失败, 需手动排查网络"
    exit 1
  fi
fi

# 验证
NODE_VER=$(sudo -u deploy bash -c 'source ~/.bashrc 2>/dev/null; which node && node -v' 2>/dev/null || node -v 2>/dev/null)
log_info "Node.js 安装完成: $NODE_VER"

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
  # 先测 npm registry 可达性, 不通则切 Aliyun 镜像
  if ! curl -fsSL --max-time 10 https://registry.npmjs.org/-/ping 2>/dev/null; then
    log_warn "  npmjs.org 不可达, 切到 Aliyun 镜像"
    npm config set registry https://registry.npmmirror.com
  fi
  npm install --no-audit --no-fund
  npm run build:web

  # 后端构建
  cd server
  npm install --production --no-audit --no-fund
  npm run build
"

# 移动前端到 nginx 目录
# 先检测 dist 是否存在 (可能构建阶段失败, 此时跳过)
if [ -d /home/deploy/New_Card_Game/card-game/dist ]; then
  rm -rf /var/www/card-game
  mkdir -p /var/www/card-game
  cp -r /home/deploy/New_Card_Game/card-game/dist/* /var/www/card-game/
  chown -R nginx:nginx /var/www/card-game
  log_info "✅ 前端已部署到 /var/www/card-game/"
else
  log_error "❌ dist/ 不存在, 前端构建可能失败"
  exit 1
fi

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
