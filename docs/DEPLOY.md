# 阿里云部署指南 (v2.2.0-alpha)

> 卡牌游戏 v2.2.0-alpha 网页版从 0 到部署上线的完整流程。
> 适用人群：项目维护者。
> 最后更新：2026-06-17（v2.2.1.4：ACL3 适配 + admin API + 录像下载）。

**适配版本**：本指南针对 **Alibaba Cloud Linux 3.2104 LTS 64位** 编写。
若使用其它发行版（Ubuntu/CentOS 7/Debian），命令大同小异，主要差异：
- `dnf install` → `apt install` (Ubuntu/Debian)
- MySQL 8.0 源配置不同
- firewalld 命令相同

---

## 0. 部署总览

```
阿里云控制台
  ├── 域名注册 (≈10 分钟)
  ├── ICP 备案 (7-20 工作日，⚠️ 最耗时)
  ├── ECS 选购 (1 小时)
  ├── 阿里云 SSL 证书 (1 小时 - 1 天)
  └── 部署运维
       ├── Nginx (反代 + 静态托管)
       ├── Node 服务 (systemd 托管)
       └── MySQL (RDS 或 ECS 自建)
```

**整体时间线**：从域名注册到全量上线，预计 **2-4 周**（主要被 ICP 备案卡死）。

---

## 1. 域名注册

### 1.1 选购

- 入口：阿里云控制台 → 域名注册 → [https://wanwang.aliyun.com](https://wanwang.aliyun.com)
- 推荐后缀：`.cn`（中国大陆）/ `.com`（国际）/ `.top`（便宜）
- 费用：`.cn` ≈ ¥35/年起 / `.com` ≈ ¥70/年起

### 1.2 实名认证

- 个人网站：需提交身份证正反面 + 人脸识别
- 审核时间：通常 1-2 小时（工作日）

### 1.3 解析到 ECS（备案通过后才能解析）

```
记录类型: A
主机记录: @ (或 www)
记录值: <ECS 公网 IP>
TTL: 10 分钟
```

---

## 2. ICP 备案（⚠️ 整个流程最耗时，不可加速）

### 2.1 备案要求

- 域名需完成实名认证
- 需有阿里云 ECS（备案时需填写 ECS IP）
- 需提供：身份证、网站负责人照片、居住证（部分省份）

### 2.2 流程

```
阿里云控制台 → 备案管理 → 填写主办者信息
       ↓
       填写网站信息（网站名称、域名、ECS IP）
       ↓
       上传资料（身份证 + 照片）
       ↓
       阿里云初审 (1-3 工作日)
       ↓
       工信部短信核验（24 小时内点链接验证）
       ↓
       管局审核 (5-15 工作日)
       ↓
       备案号下发 (例如 京ICP备12345678号)
```

### 2.3 备案通过后

- 阿里云自动解除"域名未备案无法解析"的限制
- 必须在网站底部显示备案号，并链接到 https://beian.miit.gov.cn

---

## 3. ECS 服务器选购与初始化

### 3.1 推荐配置（个人项目起步）

| 项 | 起步 | 后续可升级 |
|---|---|---|
| 实例规格 | 轻量应用服务器 2C2G | 4C4G |
| 带宽 | 5Mbps 峰值 | 10Mbps |
| 系统盘 | 40GB SSD | 80GB |
| **操作系统** | **Alibaba Cloud Linux 3.2104 LTS 64位** | - |
| 月费 | ≈ ¥60 | ≈ ¥150 |

### 3.2 初始配置（ACL3 适配版）

```bash
# SSH 登录服务器（root）
ssh root@<ECS-PUBLIC-IP>

# 1. 更新系统（ACL3 用 dnf，但 yum 是 dnf 的符号链接可继续用）
sudo dnf update -y

# 2. 安装基础工具
sudo dnf install -y git curl wget vim tar gzip

# 3. 创建非 root 用户（推荐，DEPLOY.md 默认方案）
adduser deploy
passwd deploy                                  # 交互式设密码
usermod -aG wheel deploy                       # 加入 wheel 组获得 sudo 权限
# 切换到 deploy 用户后续操作
su - deploy

# 4. 配置 firewalld（ACL3 默认有 firewalld）
sudo firewall-cmd --permanent --add-service=ssh    # 22
sudo firewall-cmd --permanent --add-service=http   # 80
sudo firewall-cmd --permanent --add-service=https  # 443
sudo firewall-cmd --reload

# 5. 禁用 SELinux（ACL3 默认 enforcing，会阻止 nginx → Node 反代）
#    详见 §10 风险点 1
sudo setenforce 0                                                  # 立即生效
sudo sed -i 's/^SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config  # 永久生效
# 验证
getenforce                                                          # 应输出 Permissive
```

### 3.3 后续推荐：一键执行 setup-server.sh

为了避免手敲命令出错，本项目提供了 `card-game/scripts/setup-server.sh`，**可一键完成本节所有初始化 + §4-7 的环境安装**。

```bash
# 仍在 root 用户下
sudo bash /tmp/card-game-frontend/setup-server.sh
# 脚本会提示输入：ECS 公网 IP、域名、MySQL 密码、admin token 等
```

详见 §11 自动化部署。

---

## 4. Node.js 与前端构建

### 4.1 安装 Node.js（nvm 方式）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v  # 应输出 v20.x.x
```

### 4.2 拉取代码 + 构建前端

```bash
# 拉取项目
git clone https://github.com/<username>/New_Card_Game.git
cd New_Card_Game/card-game

# 安装依赖
npm install

# 构建 web 版（产物在 dist/）
npm run build:web

# 验证产物
ls -la dist/
# 应有: index.html, assets/
```

### 4.3 移动产物到 Nginx 目录

```bash
sudo mkdir -p /var/www/card-game
sudo cp -r dist/* /var/www/card-game/
sudo chown -R nginx:nginx /var/www/card-game
```

---

## 5. 后端服务部署

### 5.1 安装 MySQL 8.0（自建版 — 加 MySQL 官方源）

> **重要**：ACL3 默认 repo **只有 MariaDB**，没有 MySQL Server。要装 MySQL 8.0 必须加 MySQL 官方 YUM 源。

```bash
# === 1. 下载并安装 MySQL 8.0 官方源 ===
# 注意：版本号 8.0 是 major.minor，repo 路径是 major
sudo dnf install -y https://dev.mysql.com/get/mysql80-community-release-el8-9.noarch.rpm

# === 2. 禁用默认启用的 MySQL 8.4 源（避免被自动装到 8.4）===
# ACL3 是 RHEL 8 兼容，默认会启用 mysql-8.4-latest；强制用 8.0
sudo dnf config-manager --disable mysql-8.4-latest
sudo dnf config-manager --enable mysql-8.0-latest

# 验证
dnf repolist enabled | grep mysql
# 应输出: mysql-8.0-latest, mysql-connectors-community, mysql-tools-community

# === 3. 安装 MySQL Server 8.0 ===
sudo dnf install -y mysql-server

# === 4. 启动 + 开机自启 ===
sudo systemctl start mysqld
sudo systemctl enable mysqld
sudo systemctl status mysqld    # 验证 active (running)

# === 5. 首次登录 + 改 root 密码 ===
# MySQL 8.0 安装后生成临时密码在 /var/log/mysqld.log
sudo grep 'temporary password' /var/log/mysqld.log
# 用临时密码登录
mysql -u root -p
> ALTER USER 'root'@'localhost' IDENTIFIED BY 'YourStrongPassword!';  -- 立即改密
> EXIT;

# === 6. 跑安全向导（强烈建议）===
sudo mysql_secure_installation
# 推荐回答：
#   是否改 root 密码：N (上一步已改)
#   移除匿名用户：Y
#   禁止 root 远程登录：Y
#   移除 test 数据库：Y
#   重新加载权限表：Y

# === 7. 创建应用数据库 + 用户（应用启动时会自动建表） ===
mysql -u root -p
> CREATE DATABASE IF NOT EXISTS card_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'cardgame'@'localhost' IDENTIFIED BY 'cardgame_app_password';
> GRANT ALL PRIVILEGES ON card_game.* TO 'cardgame'@'localhost';
> FLUSH PRIVILEGES;
> EXIT;
```

> **更省心方案**：用阿里云 RDS for MySQL（基础版 ¥0/月有试用），免运维。但要注意：若用 RDS，DB_HOST 应填 RDS 的内网地址，不是 127.0.0.1。

### 5.1.1 备选：用 MariaDB（默认 repo，5 分钟装好）

如果 MySQL 8.0 不是硬性要求（我们的 schema 100% 兼容 MariaDB 10.3+），可走更快的路径：

```bash
# 一行安装
sudo dnf install -y mariadb-server mariadb
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo mysql_secure_installation
# 数据库创建同上，把 'cardgame'@'localhost' 改成 'cardgame'@'localhost' 同样可
```

**MariaDB vs MySQL 8.0 兼容说明**：
- `JSON` 列类型 ✅（MariaDB 10.2+ 支持）
- `JSON_ARRAY_APPEND()` 函数 ✅（MariaDB 10.5+ 支持）
- `utf8mb4` 字符集 ✅
- `AUTO_INCREMENT` ✅
- 我们 schema 100% 兼容

### 5.2 安装后端 + systemd 托管

```bash
cd /home/deploy/New_Card_Game/card-game/server

# 安装依赖
npm install --production

# 构建
npm run build

# 创建 .env 文件
cat > .env <<EOF
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cardgame
DB_PASSWORD=your_secure_password
DB_NAME=card_game
CORS_ORIGIN=https://card.example.com

# v2.2.1.4: admin API 鉴权 token (录像下载用)
# 必须是长随机串（>= 32 字符），绝对不要提交到 Git
ADMIN_TOKEN=$(openssl rand -hex 32)
EOF
chmod 600 .env
echo "✅ ADMIN_TOKEN 已生成: $(grep ADMIN_TOKEN .env)"

# 启动测试
node dist/index.js
# 看到 "✅ listening on http://localhost:3000" 后 Ctrl+C 退出
```

### 5.3 创建 systemd service

```bash
sudo tee /etc/systemd/system/card-game-server.service <<EOF
[Unit]
Description=Card Game v2.2.0-alpha Server
After=network.target mysql.service

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

sudo systemctl daemon-reload
sudo systemctl enable card-game-server
sudo systemctl start card-game-server
sudo systemctl status card-game-server
```

### 5.4 验证

```bash
curl http://localhost:3000/api/health
# 期望: {"status":"ok","db":"connected","count":0,...}
```

---

## 6. Nginx 反代 + 静态托管

### 6.1 安装 Nginx

```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6.2 配置站点

```bash
sudo tee /etc/nginx/conf.d/card-game.conf <<'EOF'
server {
    listen 80;
    server_name card.example.com www.card.example.com;

    # 前端静态资源
    root /var/www/card-game;
    index index.html;

    # SPA 路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
EOF

sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL 证书（阿里云免费 DV）

### 7.1 申请证书

```
阿里云控制台 → SSL 证书 (应用安全) → 免费证书 → 创建证书
       ↓
       填写域名 (card.example.com)
       ↓
       DNS 验证：到域名解析添加指定 TXT 记录
       ↓
       等待签发 (1 小时 - 1 天)
       ↓
       下载 Nginx 格式证书
```

### 7.2 上传证书到服务器

```bash
sudo mkdir -p /etc/nginx/ssl
# 上传 card.example.com.pem (证书) + .key (私钥) 到 /etc/nginx/ssl/
sudo chmod 600 /etc/nginx/ssl/card.example.com.key
```

### 7.3 修改 Nginx 配置启用 HTTPS

```bash
sudo tee /etc/nginx/conf.d/card-game.conf <<'EOF'
server {
    listen 80;
    server_name card.example.com www.card.example.com;
    return 301 https://$server_name$request_uri;  # HTTP → HTTPS
}

server {
    listen 443 ssl http2;
    server_name card.example.com www.card.example.com;

    ssl_certificate     /etc/nginx/ssl/card.example.com.pem;
    ssl_certificate_key /etc/nginx/ssl/card.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root /var/www/card-game;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
EOF

sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. 端到端验证

```bash
# 1. HTTPS 站点可访问
curl -I https://card.example.com
# 期望: HTTP/2 200

# 2. 后端健康检查
curl https://card.example.com/api/health
# 期望: {"status":"ok","db":"connected","count":0,...}

# 3. 上传一个测试 Replay
curl -X POST https://card.example.com/api/replays \
  -H "Content-Type: application/json" \
  -d @test-replay.json
# 期望: {"ok":true,"id":1}
```

打开浏览器访问 `https://card.example.com`，应能：
1. 看到同意门 → 勾选两个 checkbox → 同意
2. 看到封面页（仅"人机对战"入口）
3. 选角色 → 玩 1 局 → 胜利 → 看到"已上传录像"toast
4. MySQL 中新增 1 条记录

---

## 9. 日常运维

### 9.1 查看日志

```bash
# 后端日志（stdout，systemd 自动收集）
sudo journalctl -u card-game-server -f

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.2 重启服务

```bash
# 后端
sudo systemctl restart card-game-server

# Nginx
sudo systemctl reload nginx
```

### 9.3 更新代码

```bash
cd /home/deploy/New_Card_Game
git pull origin main

# 重新构建前端
cd card-game
npm install
npm run build:web
sudo cp -r dist/* /var/www/card-game/

# 重新构建后端
cd server
npm install --production
npm run build
sudo systemctl restart card-game-server
```

### 9.4 数据备份

```bash
# 每日自动备份 MySQL（加入 crontab）
0 3 * * * mysqldump -u cardgame -p'PASSWORD' card_game | gzip > /backup/card-game-$(date +\%Y\%m\%d).sql.gz
```

---

## 10. 时间线与卡点

| 步骤 | 预计耗时 | 是否可加速 |
|---|---|---|
| 阿里云账号注册 | 10 分钟 | ❌ |
| 域名选购 | 10 分钟 | ❌ |
| 域名实名认证 | 1-2 小时（工作日） | ❌ |
| **ICP 备案** | **7-20 工作日** | ❌ **不可加速** |
| ECS 选购 + 初始化 | 1 小时 | ❌ |
| SSL 证书申请 | 1 小时 - 1 天 | ❌ |
| 代码部署 + 联调 | 0.5 天 | ✅ |
| **总计** | **2-4 周** | - |

### ⚠️ 关键卡点提示

1. **必须先备案**：未备案的域名无法解析到 ECS 公网 IP。**强烈建议立刻申请域名 + 提交备案**，期间并行做 V1 改造和后端开发。
2. **SSL 依赖备案**：阿里云免费 DV 证书签发时需验证域名所有权，但**签发后**部署到服务器需要 HTTPS 监听（443），备案通过才能让用户通过 https:// 访问。
3. **首月费用**：ECS (¥60) + 域名 (¥50) + 阿里云 SSL (¥0) + MySQL (RDS 免费试用 / 自建 ¥0) ≈ **¥110 起步**。

---

## 11. 故障排查

| 现象 | 可能原因 | 排查 |
|---|---|---|
| 域名无法访问 | 备案未通过 / 解析未配 | 检查阿里云备案状态 + 域名解析记录 |
| HTTPS 证书警告 | SSL 证书未配 / 过期 | `sudo nginx -t` + 检查证书路径 |
| 录像上传失败 | Node 服务未起 / DB 不可连 | `systemctl status card-game-server` + `curl /api/health` |
| 前端页面 404 | Nginx 路径错 | `sudo tail -f /var/log/nginx/error.log` |
| 上传一直 pending | VITE_API_BASE 错 | 前端构建时设置 `VITE_API_BASE=https://card.example.com` |

---

## 12. 附录：v2.2.0-alpha 实验边界

- 本次部署为**技术探索与数据采集**，**非产品正式发布**
- 不建议投入过多精力在 UI 打磨或性能优化
- 录像数据用于反哺 v2 仿真平台的角色平衡研究
- 后续如要正式发布（v2.2.0 / v3.0.0），需要单独的部署方案与运维策略

---

## 13. 录像数据下载到本机（v2.2.1.4 新增）

### 13.1 三种下载方式对比

| 方式 | 命令 | 优点 | 缺点 |
|---|---|---|---|
| **A. mysqldump 整库** | `mysqldump` + `scp` | 整库，含所有表 | 体积大，**包含账号密码等无关数据** |
| **B. admin API + 拉取脚本** ⭐ | `node tools/pull_replays.cjs` | 增量、可分页、**输出 V1Replay JSONL 直接喂 V2 分析** | 需写 30 行代码（已写好） |
| C. 阿里云 DMS | 图形化点选 | 可视化 | 限 1000 行/次，**手动** |

### 13.2 方式 B 推荐流程（admin API + 拉取脚本）

**前提**：服务器端已配置 `ADMIN_TOKEN`（见 §5.2）。

**步骤 1：服务器无需操作**（admin API 已在 server/src/routes/admin.ts 实现）

**步骤 2：本机执行拉取**

```bash
# 在本机项目根目录
cd /path/to/New_Card_Game

# 设置环境变量（token 在服务器 .env 文件里）
export ADMIN_TOKEN="<从服务器 .env 复制的 token>"
export API="https://card.example.com/api/admin/replays"

# 拉取指定时间范围所有录像 → 输出 V1Replay JSONL
node tools/pull_replays.cjs 2026-06-01 2026-12-31 ./downloads/2026.jsonl

# 输出类似：
# ✅ 142 局已写入 ./downloads/2026.jsonl
# ⏱️ 耗时 1.3s, 总大小 8.2MB
```

**步骤 3：直接喂 V2 分析**

```bash
# V1Replay JSONL 格式与 V2 仿真输出一致, analysis/main.py 可直接消费
python analysis/main.py --input ./downloads/2026.jsonl --gpu
# 报告会输出到 reports/2026-tier-report.html
```

**API 契约**（`GET /api/admin/replays`）：
```
Query Params:
  since:    ISO 日期 (e.g. "2026-06-01"), 默认 1970-01-01
  until:    ISO 日期, 默认 2099-12-31
  limit:    每页条数, 默认 100, 上限 10000
  offset:   偏移, 默认 0

Headers:
  X-Admin-Token: <ADMIN_TOKEN>

Response 200:
{
  "ok": true,
  "data": [{ id, char_player, char_ai, winner, turn_count, 
            duration_ms, moves_count, payload, created_at }],
  "total": 1234,        # 该时间范围内的总条数
  "limit": 100, "offset": 0
}

Response 401: {"ok": false, "error": "Unauthorized"}
Response 500: {"ok": false, "error": "<错误详情>"}
```

### 13.3 方式 A（mysqldump 整库）

```bash
# 服务器端导出
ssh deploy@<ECS-IP>
mysqldump -u cardgame -p card_game replays test_progress | gzip > /tmp/replays-$(date +%Y%m%d).sql.gz

# 下载到本机
scp deploy@<ECS-IP>:/tmp/replays-20260617.sql.gz ./downloads/
gunzip ./downloads/replays-20260617.sql.gz
# 内部是 SQL 转储，可用 mysql < 恢复 或 grep/sed 提取
```

### 13.4 数据保留策略

| 数据类型 | 保留期 | 归档方式 |
|---|---|---|
| 录像 (`replays`) | **永久**（研究用） | 定期 mysqldump → 本机 + 阿里云 OSS（可选） |
| 测试进度 (`test_progress`) | 永久 | 同上 |
| 服务端日志 | 30 天 | journalctl 自动 rotate |
| Nginx access log | 90 天 | logrotate |

---

## 14. 自动化部署（v2.2.1.4 新增）

### 14.1 首次部署：`scripts/setup-server.sh`

`card-game/scripts/setup-server.sh` 是**一次性脚本**，可一键完成 §3-7 的所有初始化：
- 创建 deploy 用户
- 禁用 SELinux
- 配置 firewalld
- 安装 nginx / MySQL 8.0 / Node 20（via nvm）
- 创建数据库 + 用户
- 克隆项目 Git 仓库
- 构建前端到 `/var/www/card-game/`
- 部署后端 systemd 服务
- 配置 Nginx + SSL（SSL 证书需手动上传）

**使用方式**：

```bash
# 1. 上传 setup-server.sh 到服务器 /tmp/
scp card-game/scripts/setup-server.sh root@<ECS-IP>:/tmp/

# 2. SSH 到服务器, 交互式运行
ssh root@<ECS-IP>
bash /tmp/setup-server.sh
# 脚本会按顺序提示输入：
#   - ECS 公网 IP（自动检测）
#   - 域名 (e.g. card.example.com)
#   - MySQL root 密码 (你设的)
#   - MySQL 应用密码 (cardgame 用户的)
#   - GitHub 仓库地址 (https://github.com/<user>/New_Card_Game.git)
#   - 部署分支 (默认 v2.2.0-alpha-web-edition)

# 3. 上传 SSL 证书
scp card.example.com.pem card.example.com.key root@<ECS-IP>:/etc/nginx/ssl/

# 4. 重启 nginx
sudo systemctl reload nginx
```

### 14.2 后续更新：`scripts/deploy-prod.sh`

服务器上 `git pull` + 重新构建 + 重启。本地一行命令：

```bash
# 在本机项目根目录
bash card-game/scripts/deploy-prod.sh

# 或指定服务器
ECS_USER=deploy ECS_HOST=card.example.com bash card-game/scripts/deploy-prod.sh
```

**脚本行为**（依次执行）：
1. `ssh deploy@<ECS-IP> "cd /home/deploy/New_Card_Game && git pull"`
2. `ssh deploy@<ECS-IP> "cd card-game && npm install && npm run build:web"`
3. `ssh deploy@<ECS-IP> "sudo cp -r dist/* /var/www/card-game/"`
4. `ssh deploy@<ECS-IP> "cd server && npm install --production && npm run build"`
5. `ssh deploy@<ECS-IP> "sudo systemctl restart card-game-server"`
6. `ssh deploy@<ECS-IP> "sudo systemctl reload nginx"`
7. 输出 "✅ 部署完成" 或失败错误

### 14.3 数据备份：`scripts/backup-mysql.sh`

```bash
# 服务器 crontab 加入（每日凌晨 3 点）
0 3 * * * /home/deploy/New_Card_Game/card-game/scripts/backup-mysql.sh

# 或手动跑
bash card-game/scripts/backup-mysql.sh
# 输出: /backup/card-game-20260617.sql.gz
```

**行为**：
- `mysqldump` 整库 → gzip 压缩 → 保留最近 7 天，删旧的
- 写日志到 `/var/log/card-game-backup.log`
- 失败时 exit code 非 0（crontab 会发邮件）

### 14.4 录像下载：`tools/pull_replays.cjs`

详见 §13.2。

### 14.5 Admin 脚本：`tools/admin-*.cjs`（v2.2.1.10 新增）

> **背景**：v2.2.1.10 移除了前端「重置全部进度」按钮（玩家无入口防误触），
> admin 通过以下脚本完成管理操作。脚本强制 `--yes` 二次确认防误操作。

#### 14.5.1 `tools/admin-reset-progress.cjs` — 重置测试进度

清空所有 81 matchup 的 `completed`（保留 `target=10`），影响所有登录此网站的玩家。

```bash
# 1. 设置环境变量
export API="https://card.example.com"
# ADMIN_TOKEN 可选（未来若后端加鉴权则启用；当前 reset 路由不要求）

# 2. 看 --help
node tools/admin-reset-progress.cjs --help

# 3. 执行重置（强制 --yes 防误触）
node tools/admin-reset-progress.cjs --yes

# 输出：
# 📊 当前状态:
#    总进度: 123/810
#    已锁定: 5 / 81
#    可用:   76 个 matchup
#
# 🚀 正在重置...
# ✅ 重置成功
```

**警告**：
- 操作不可撤销，影响所有用户
- 缺 `--yes` 标志时拒绝执行（Exit 1）
- 当前 reset 路由无鉴权（API 仍可被直接 curl），未来需加 ADMIN_TOKEN 校验

#### 14.5.2 `tools/admin-stats.cjs` — 查看 admin 统计

读取录像 + 测试进度总览。

```bash
# 1. 必填：ADMIN_TOKEN（服务器 .env 里复制）
export ADMIN_TOKEN="<从服务器 .env 复制的 token>"
export API="https://card.example.com"  # 可选，默认

# 2. 执行
node tools/admin-stats.cjs

# 输出：
# ━━━ 录像统计（admin） ━━━
#    总录像:   4
#    首条时间: 2026-06-17T13:45:12.000Z
#    末条时间: 2026-06-18T05:48:38.000Z
#
#    按 char_ai × winner 分布:
#      char_3: 玩家 1 局 (100.0%) | AI 0 局 (0.0%) | 平局 0 局
#      char_6: 玩家 3 局 (100.0%) | AI 0 局 (0.0%) | 平局 0 局
#
# ━━━ 测试进度（公开） ━━━
#    总进度: 0/810
#    已锁定: 0 / 81
```

#### 14.5.3 完整 admin 工具链

| 脚本 | 用途 | 是否需 ADMIN_TOKEN |
|---|---|---|
| `tools/pull_replays.cjs` | 拉取所有录像到 JSONL | ❌（当前） |
| `tools/admin-stats.cjs` | 查看录像 + 进度统计 | ✅ |
| `tools/admin-reset-progress.cjs` | 重置测试进度 | ❌（当前；未来加鉴权） |

未来改进方向：给 reset 路由加 ADMIN_TOKEN 校验（与 admin/stats 一致）。
