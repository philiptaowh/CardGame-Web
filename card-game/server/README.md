# card-game-server (v2.2.0-alpha)

V1 网页版录像采集后端服务。Node.js + Express + MySQL。

## 职责

- 接收 V1 客户端 POST 上传的 V1Replay JSON
- 解析摘要字段（角色、胜者、回合数等）存入 MySQL，完整 payload 存 JSON 列
- 提供健康检查与基础统计接口（自检用）

## 快速开始

```bash
# 1. 安装依赖
cd card-game/server
npm install

# 2. 复制环境变量模板并填写
cp .env.example .env
# 编辑 .env，填入 MySQL 连接信息

# 3. 确保 MySQL 已运行且用户有 CREATE DATABASE 权限
# 启动时会自动创建 database（如果不存在）+ 初始化表

# 4. 启动开发模式（热重载）
npm run dev

# 5. 验证
curl http://localhost:3000/api/health
# 期望返回: {"status":"ok","db":"connected","count":0}
```

## 部署到阿里云 ECS

详见仓库根 `docs/DEPLOY.md`（待 v2.2.0-alpha Phase 4 编写）。

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET`  | `/api/health` | 健康检查 + DB 连接状态 + 当前记录数 |
| `POST` | `/api/replays` | 上传 V1Replay JSON（完整 V1Replay 格式，非 JSONL 单行） |
| `GET`  | `/api/replays/stats` | 自检用：按 `char_ai × winner` 聚合胜率 |

## 数据流

```
V1 网页客户端 (浏览器)
  │
  │ POST /api/replays  (Content-Type: application/json, body = V1Replay 对象)
  ▼
Express 路由
  │
  ├─ 提取摘要字段: char_player / char_ai / winner / turn_count / duration_ms
  ├─ 完整 payload 存 JSON 列
  └─ INSERT INTO replays (...)
  ▼
MySQL `replays` 表
```

## 文件结构

```
card-game/server/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts          # Express 入口
    ├── db.ts             # MySQL 连接池 + schema 初始化
    ├── schema.sql        # replays 表 DDL
    └── routes/
        ├── replays.ts    # POST /api/replays, GET /api/replays/stats
        └── health.ts     # GET /api/health
```
