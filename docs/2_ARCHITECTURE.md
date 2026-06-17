# 2_ARCHITECTURE.md: 架构红线与技术栈

## 1. 技术栈 (Tech Stack)
- 前端：React 19 + Vite 8
- 语言：TypeScript
- 样式：Tailwind CSS 4
- 状态管理：Zustand 5
- 图标库：Lucide React
- 构建工具：Vite
- WebSocket (v1.2.0+)：`ws` 库（服务端），浏览器原生 `WebSocket`（客户端）

## 2. 架构红线 (Architectural Redlines)
- **单向数据流**：所有游戏状态通过 Zustand store 管理，组件只能读取和触发 action
- **不可变更新**：状态更新必须使用不可变（immutable）方式，禁止直接 mutation
- **类型安全**：所有接口必须有 TypeScript 类型定义，禁止使用 `any` 除非必要时的类型断言
- **组件职责**：UI 组件只负责渲染，业务逻辑必须放在 store 中
- **V1 与 V2 系统隔离**：2.x 仿真分析平台是独立于 V1 游戏产品的开发工具，不得对 V1 产生任何运行时影响：
  - **代码隔离**：`src/ai/`、`src/simulator/`、`src/analysis/` 与 `src/components/`、`src/stores/` 无导入依赖关系
  - **运行时隔离**：仿真引擎独立运行（CLI / Worker 模式），不嵌入游戏 UI 进程
  - **数据隔离**：V2 的数据采集与分析管线不修改 V1 的 Zustand store 或游戏逻辑
  - **共享核心**：两者共享 `src/game/`（游戏规则定义）和 `src/types/`（类型定义），不共享 `src/stores/`（UI 状态）

## 3. 目录结构规范 (Folder Structure)
```
card-game/
├── src/
│   ├── components/     # React 组件
│   │   ├── *.tsx      # UI 组件文件
│   ├── stores/        # Zustand 状态管理（V1 游戏 UI 状态）
│   │   └── gameStore.ts
│   ├── game/          # 游戏数据定义（V1 与 V2 共享核心）
│   │   ├── gameEngine.ts  # 无头游戏逻辑引擎
│   │   ├── characters.ts  # 9个角色数据
│   │   ├── cards.ts       # 能量卡/特殊卡数据
│   │   └── marks.ts       # 印记定义
│   ├── types/         # 类型定义（V1 与 V2 共享核心）
│   │   ├── index.ts
│   │   └── network.ts     # 通信协议类型
│   ├── ai/            # (V2) AI 策略体系，与 V1 stores 无依赖
│   │   ├── interfaces.ts  # AI策略接口定义
│   │   ├── ruleBasedAI.ts # 规则AI实现
│   │   └── randomAI.ts    # 随机AI基准
│   ├── simulator/     # (V2) 对局仿真器，独立 CLI/Worker 运行
│   │   ├── gameRunner.ts      # 单局运行器
│   │   ├── concurrentRunner.ts# 并发运行器
│   │   └── cli.ts            # 命令行入口
│   ├── analysis/      # (V2) 数据统计与分析，规划中
│   ├── App.tsx        # 主应用组件
│   ├── main.tsx       # 入口文件
│   └── index.css      # 全局样式
├── electron/          # Electron 桌面壳 + WebSocket 服务器
│   ├── main.cjs
│   ├── preload.cjs
│   ├── server.cjs     # WebSocket 游戏服务器
│   ├── gameHost.cjs   # 服务端游戏仲裁
│   └── dev-server.cjs
├── index.html        # HTML 入口
└── package.json      # 依赖配置
```

## 4. 🛠️ 自测与验证命令 (Verification Hub)
> **AI 必读：** 在打勾任务前，必须根据任务类型运行以下命令进行自测。

**前端 (Front-end):**
- 类型检查：`npx tsc --noEmit`
- 编译检查：`npm run build`
- 开发服务器：`npm run dev`

**注意事项：**
- 每次代码修改后必须运行 `npm run build` 验证无编译错误
- 禁止提交有 TypeScript 错误的代码

## 5. 状态管理规范 (State Management)
- 使用 Zustand 的 `create<StoreInterface>` 创建类型安全的 store
- 所有状态更新通过 `set()` 回调函数进行
- 异步操作直接在 store 方法中处理，不使用 middleware
- 日志通过 `addLog()` 方法记录到 `gameState.logs[]`

## 6. 模块边界 (Module Boundaries)
- **components/** → 只负责 UI 渲染和事件绑定
- **stores/** → 管理所有游戏业务逻辑和数据
- **game/** → 存放只读数据定义，无业务逻辑
- **types/** → 集中管理所有类型定义

## 7. 局域网联机架构 (v1.2.0+)

v1.2.0 引入 **Electron 内置 WebSocket 服务器** 架构，在单进程 SPA 基础上增加网络层。

### 7.1 进程模型

```
Electron Main Process
├── WebSocket Server (端口动态分配)
│   ├── 游戏逻辑仲裁者（无头模块）
│   ├── 房间状态管理
│   ├── 同步计时器（角色选择/换牌/能量放置）
│   └── 阶段2 时间银行
│
├── System Tray（服务器后台运行）
│   ├── 房主关闭窗口 → 转入托盘
│   ├── 托盘菜单：[显示窗口] [关闭服务器]
│   └── 关闭时二次确认（提示在线玩家数）
│
└── Renderer Process（房主自己的游戏客户端）
    └── 通过 localhost WebSocket 连接自身服务器
        └── 可独立关闭，不影响服务器

Other Players
└── Browser / 另一份 EXE
    └── 通过局域网 IP:端口 WebSocket 连接房主服务器
```

### 7.2 服务器与客户端解耦

| 场景 | 服务器行为 | 客户端行为 |
|------|-----------|-----------|
| 房主游戏中死亡 | 继续运行 | 切换观战/退出 |
| 房主关闭游戏窗口 | **转入系统托盘继续运行** | 窗口关闭 |
| 房主从托盘恢复 | 继续运行 | 重新打开窗口 |
| 房主明确"关闭服务器" | 二次确认 → 关闭 | 全体玩家断开 |
| 普通玩家断线 | 等待重连 → 超时判定死亡 | 连接断开 |
| 游戏结束 | 统计连接数 → 保留/清空房间 | 显示结果 |

### 7.3 房间状态机

```
IDLE ──创建房间──→ LOBBY ──开始游戏──→ PLAYING ──游戏结束──→ ENDED
                     ↑                      │                  │
                     │                      │ (连接数≥2)        │ (连接数≤1)
                     └── 重新开始 ──────────┘                  │
                                                               ↓
                                                            CLEAR
```

### 7.4 同步阶段与计时器

所有等待阶段由**服务端统一驱动计时**，客户端仅显示剩余时间：

| 阶段 | 时限 | 提前结束条件 | 超时处理 |
|------|------|-------------|---------|
| 角色选择 | 60s | 全员确认 | 未确认者随机分配角色 |
| 换牌 | 30s | 全员完成 | 废弃剩余换牌次数 |
| 阶段1(能量) | 30s | 全员放置完毕 | 视为未放卡 |

### 7.5 阶段2 行动时间银行

- 每人初始 **270s** 总行动时间
- 轮到行动时 **+30s** → 开始倒计时
- 点击结束行动 → **停止**倒计时
- 总时间归 **0** → 判定死亡
- 睡眠状态 → **不增加**时间

### 7.6 关键原则

- **服务端权威 (Server Authority)**：游戏逻辑在服务端执行，客户端仅发送操作指令并接收渲染所需状态
- **AI 模式兼容**：单人 AI 模式保持纯客户端运行，不走 WebSocket 路径
- **通信协议**：JSON 消息经 WebSocket 传输
- **单人实例**：一个 Electron 进程 = 一个房间，通过 `app.requestSingleInstanceLock()` 防止多开

## 8. 仿真与分析架构 (v2.x)

2.x 仿真分析平台是**独立于 V1 游戏产品的开发工具**，用于角色强度量化与平衡性分析。遵循 V1/V2 隔离原则（见第 2 节），与 V1 仅共享游戏规则和类型定义。

### 8.1 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                2.x 仿真与分析平台                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐   ┌──────────────────┐             │
│  │   AI 策略体系     │   │   对局仿真层      │             │
│  │  ┌────────────┐  │   │  ┌────────────┐  │             │
│  │  │ RandomAI   │  │   │  │GameRunner  │  │             │
│  │  │ (随机基线)  │  │   │  │(单局运行器) │  │             │
│  │  ├────────────┤  │   │  ├────────────┤  │             │
│  │  │RuleBasedAI │──┼───┼─▶│Concurrent  │  │             │
│  │  │(参数化策略) │  │   │  │Runner     │  │             │
│  │  ├────────────┤  │   │  │(并发调度)  │  │             │
│  │  │[RL Agent]  │  │   │  └──────┬─────┘  │             │
│  │  └────────────┘  │   │         │        │             │
│  └──────────────────┘   └─────────│────────┘             │
│                                   │                      │
│  ┌────────────────────────────────▼──────────┐           │
│  │           数据采集与存储                     │           │
│  │  原始对局日志 (JSON Lines) → SQLite 聚合    │           │
│  │  完整性校验 → 实验清单管理                   │           │
│  └───────────────────────────────────────────-┘           │
│                                   │                      │
│  ┌────────────────────────────────▼──────────┐           │
│  │           Meta 分析引擎                     │           │
│  │  胜率矩阵 │ 假设检验 │ Elo/Glicko 评级     │           │
│  │  多重比较修正 │ Tier 划分 │ 克制关系图      │           │
│  │  → 自动生成角色强度报告                      │           │
│  └────────────────────────────────────────────┘           │
│                                                          │
│  ┌────────────────────────────────────────────┐           │
│  │           超参数优化 (2.1+)                 │           │
│  │  贝叶斯优化 / 网格搜索 → θ*_i 每角色独立优化│           │
│  └────────────────────────────────────────────┘           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 8.2 模块说明

| 模块 | 位置 | 职责 | 运行方式 |
|------|------|------|---------|
| AI 策略接口 | `src/ai/interfaces.ts` | 定义 `IPlayerPolicy.decide()` 协议 | 被仿真器调用 |
| 规则AI | `src/ai/ruleBasedAI.ts` | 参数化策略族 $\mathcal{P} = \{P(\theta) \mid \theta \in \Theta\}$ | 被仿真器调用 |
| 随机AI | `src/ai/randomAI.ts` | 纯随机决策，作为胜率基线 | 被仿真器调用 |
| 单局运行器 | `src/simulator/gameRunner.ts` | GameEngine + 2 × Policy → Replay | CLI / 被调度器调用 |
| 并发调度器 | `src/simulator/concurrentRunner.ts` | 多 Worker 并行，36 组合 × n 局 | CLI |
| 数据存储 | `data/` | JSON Lines 原始日志 → SQLite 聚合 | 写入：仿真器；读取：分析引擎 |
| Meta 分析 | `src/analysis/`（规划中） | 统计计算 + 报告生成 | CLI / 定时任务 |

### 8.3 与 V1 游戏产品的关系

| 层次 | V1 产品（游戏对战） | V2 平台（仿真分析） | 共享？ |
|------|-------------------|------------------|:-----:|
| 游戏规则 | GameEngine（含 DOM 逻辑的 store） | GameEngine（无头纯逻辑） | 共享接口设计，各自实例 |
| 类型定义 | `src/types/index.ts` | `src/types/index.ts` | ✅ 完全共享 |
| AI 策略 | AIController（UI 内嵌） | AI 策略族（独立调用） | ❌ 隔离 |
| 数据 | Zustand store | JSON Lines + SQLite | ❌ 隔离 |
| 运行环境 | 浏览器 / Electron | Node.js CLI | ❌ 隔离 |