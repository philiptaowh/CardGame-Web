# 0_TASKLIST.md: 开发任务与进度追踪

## 🎯 当前迭代目标

开发 2.0.0 仿真引擎与规则 AI 基线，完成从引擎重构到数据采集管线的全链路闭环

## ⚠️ AI 工作流要求 (Workflow Rules) - 核心准则

1. **执行入口**：阅读本文件，从第一个 `[ ]` 开始
2. **状态更新**：完成子任务后将 `[ ]` 改为 `[x]`，并记录**技术决策**
3. **验收标准 (AC)**：【新增】所有涉及 UI 或业务流的任务，必须在任务下方补充 **AC (Acceptance Criteria)**
4. **阻塞即停 (Blocked)**：遇到模糊、冲突或无法解决的环境问题，记录 `[Blocked]` 并附带日志，停止工作
5. **自测闭环 (Validation)**：标记完成前，必须运行 `npm run build` 验证
6. **文档索引**：查阅 `1_PRD.md` 到 `5_AGENT_RULES.md` 确保不违背红线

---

## 📝 任务池

### v1.0.0 Foundation — ✅ 已完成

- 技术栈初始化（React + Vite + TypeScript + Tailwind + Zustand）
- 游戏逻辑层 + UI 组件 + 交互流程（角色选择/三阶段/胜利界面）
- 版本发布 v1.0.0

### v1.0.1 Bug Fixes & 测试体系 — ✅ 已完成

- 印记系统修复 + 技能逻辑修复（卡牌克隆/混乱/睡眠等）
- Vitest 测试体系（角色技能 × 9、跨回合 modifier 测试）
- 行动状态框架裁定（extra_rule.md）+ Per-skill 计数器
- 特殊卡前置校验 + 弱化负伤害保护
- Electron 桌面壳打包

### v1.1.0 多AI对战 — ✅ 已完成

- 基础设施：类型扩展 + Store 改造 + 牌组耗尽规则
- 开局换牌系统（CardExchange + AI 换牌）
- 弹窗系统 1v1/1vN 统一
- UI 重构（敌方信息卡片式 + 详情弹窗 + 胜利适配）
- 多 AI 目标选择逻辑
- Bug Fix: AI 自动行动失效 / AI角色可配置 / AIController card_exchange 遗漏 / 自目标技能目标选择
- UI 优化：字号提升、印记正负面颜色、座位随机顺位修复、无垢印记阻挡修正
- EXE 打包（release/ 84MB）+ Git 打标签

### v1.2.0 局域网联机模式 — ✅ 已完成

- 封面页双入口 + 创建/加入房间 + 房间等待界面
- WebSocket 通信层（服务端 server.cjs + 客户端 useWebSocket + 通信协议定义）
- 同步阶段逻辑（角色选择/换牌/能量放置 + 游戏状态同步）
- 阶段2 时间银行（270s+30s/轮，睡眠不增长，归零死亡）
- 游戏逻辑服务端适配（GameEngine 无头类 + GameHost 仲裁 + 动作转发）
- 房间生命周期管理（状态机/锁房/断线30s重连/保留清空）
- 系统托盘后台运行 + 观战模式
- AI 模式纯客户端兼容
- Bug Fix: useCallback 闭包陈旧 + 模块级 WebSocket 单例

### v2.0.0 — 仿真引擎 + 规则AI基线（✅ 已完成）

- [X] **Engine 重构** — GameEngine 可注入 PRNG（mulberry32）、确定性执行（所有 shuffle/random 通过 this.prng）、时间戳可配置、种子追踪
- [X] **策略族实现** — IPlayerPolicy 接口 + RuleBasedAI（10 组预设：激进/保守/均衡/控场/爆发/消耗/贪婪/自保/赌徒/先手大师）+ RandomAI 基线
- [X] **并发调度** — ConcurrentRunner 带并发池控制（Promise-based），36 组合 × n 局
- [X] **数据采集管线** — JSON Lines 写入 + 完整性校验（数量/格式/逻辑/种子复现）
- [X] **文本回放器** — CLI 回放工具（含 test 自测命令）
- [X] **验收：** build + 可复现性测试（✅ PASS）+ 9 角色可独立配置出场

### v2.1.0 — Meta分析 + 角色梯度（✅ 已完成）

#### Phase 1 — Python 分析核心（✅ 已完成）

- [X] **loader.py** — JSONL 加载，构建 9×9 胜率矩阵与对战记录数组
- [X] **win_matrix.py** — Wilson 置信区间、Bootstrap CI（CPU）、Power Analysis
- [X] **stats_tests.py** — 双比例 Z 检验、BH-FDR / Bonferroni 修正、Cohen's h 效应量
- [X] **ratings.py** — Elo 评级（迭代收敛）、Glicko 评级（含 RD 更新）、Tier 划分（基于 CI 重叠+WinRate回退）

#### Phase 2 — GPU 加速（✅ 已完成）

- [X] **gpu_accel.py** — Numba CUDA Bootstrap 重采样 kernel（10000 线程并行），`--gpu` 开关自动选择 GPU/CPU，43560 局 × 10000 次重采样仅 1.2s

#### Phase 3 — HTML 报告（✅ 已完成）

- [X] **report.py** — 自包含 HTML 报告（785KB）：Tier 排名(CSS) + 热力图/柱状图/直方图(matplotlib base64) + 克制关系图(D3.js 力导向图内嵌) + 统计检验表 + 角色详情卡 + D3.js 缓存

#### Phase 4 — CLI 集成（✅ 已完成）

- [X] **main.py** — Python CLI 入口，参数解析，管线编排
- [X] **src/analysis/cli.ts** — TypeScript `analyze` 命令桥接 Python 子进程（pytorch_gpu），支持 `--gpu / --no-report / --max-games / --output`

#### Phase 5 — GPU 超参数优化（🔄 内容已移至 v2.1.5，见下）

> 2026-06-09 决策：贝叶斯优化不再单独立项，并入"AI 智能水平强化"三阶段路径（v2.1.1 Phase 2）

### v2.1.1 — AI 智能水平强化（✅ Phase 2 BO 全角色已完成）

承接原 2.1.0 Phase 5「GPU 超参数优化」（已挂起），结合 2026-06-08 人工审查暴露的 P0 死循环问题，按三阶段递进强化 AI 水平。
**目标**：让 char_9 等"需要规划"角色的胜率从被低估状态反映到真实强度；让所有角色强度统计脱离 c0 死循环污染。

#### Phase 1 — V1 录制基础设施（✅ 2026-06-11 完成）

为 Phase 2 BC 拟合准备数据采集管线。在 V1 客户端录制人 vs AI 对局，导出 JSONL。

- [X] **replayStore.ts** — Zustand 独立 store + persist 中间件（localStorage 持久化）
- [X] **settingsStore.ts** — 设置弹窗 UI 状态 + autoRecord 业务开关
- [X] **replayExporter.ts** — Blob + a.click 浏览器下载
- [X] **gameStore 录制 hooks** — 在 4 个 action（exchangeCard/placeEnergyCard/useSkill/useSpecialCard）+ executeAiAction + checkGameOver 注入 recordMove（仅 1v1 模式）
- [X] **SettingsButton + SettingsModal** — 齿轮按钮 + 弹窗容器（ESC/外点/× 关闭）
- [X] **3 个 Tab 组件** — RecordingTab（autoRecord 开关 + 录制状态）/ AiLevelTab（占位）/ AboutTab
- [X] **GameBoard 胜利弹窗** — 加"保存录像"+"丢弃"按钮，保存时锁定弹窗+spinner+下载+Toast
- [X] **Toast 通知系统** — toastStore + ToastContainer
- [X] **P1.6 修复** — saveCurrentReplay 接受 winner/finalState overrides，UI 层从 gameState 计算填充
- [X] **tsconfig.app.json 排除 simulator** — 修复 V2 pre-existing 类型错误，架构上 V1 不应检查 V2
- [X] **tools/validate_replays.py** — Python 批量校验工具（CRITICAL = P1.6 修复前症状）
- [X] **验收** — 录制 1 局 char_1 vs char_3，26 动作 7 回合，winner=player_1，finalState 完整

**2026-06-11 关键决策**：

- 录制状态独立 store：避免污染 gameStore，避免触发游戏重渲染
- localStorage 持久化：savedReplays 跨会话保留
- autoRecord 替代 armed 状态：业务开关（用户偏好）vs 单次临时意图
- 胜利弹窗显式保存：避免自动归档的歧义（用户没点保存=未保存）
- V1 单人模式不调 checkGameOver：UI 层（GameBoard）需从 gameState 自己推算 winner

**AC（验收标准）**：

- 录制的 JSONL 文件能被 tools/validate_replays.py 0 errors 通过
- winner 非 null，finalState.players 包含所有终局状态
- 关闭浏览器后 savedReplays 仍可恢复

#### Phase 2 — 贝叶斯超参优化（✅ BO 管线 + GPU 全 9 角色已全部完成）

- [X] **optimizer_interface.py** — 抽象 BaseOptimizer，支持 skopt/Optuna/BoTorch 切换
- [X] **optimizer_skopt.py** — skopt.gp_minimize 包装（5 维搜索空间：priority/hp_danger/aggro/mark_weight/special_threshold）
- [X] **optimizer_botorch.py** — BoTorch 8 维 GPU 优化（cpu→cuda 自动切换），新增 wild/skill_pref/noise 维度
- [X] **evaluate_theta.py** — Python spawn Node 跑 54 局/评估
- [X] **evaluate-theta.cjs** — Node 单 θ 评估（spawn 6 策略 × 9 角色 = 54 局）
- [X] **bo_runner.py** — 主循环 + 收敛检测（连续 20 轮无改善早停）
- [X] **optimization/cli.ts** — TS CLI 入口（optimize/optimize-all）
- [X] **report_bo.py** — 报告生成器（ASCII 文本 + matplotlib 可选）
- [X] **end-to-end 验证** — char_9 budget=50 跑通：21 评估后早停，best_winrate=0.2778
- [X] **char_9 8D 验证** — BoTorch 30 评估早停，best_winrate=0.3333（+5.5% 优于 5D 的 0.2778）
- [X] **全 9 角色 BO 优化** — `run_all_bo.py` 串行 9 角色 × budget 100 × BoTorch 8D，503s 全部完成（2026-06-10 10:57→11:05）
- [X] **verify_fix 验证** — char_7 (0.2593) 和 char_9 (0.3333) 全 budget 100 验证通过（`data/optimization/verify_fix/`）
- [X] **干净 batch 收集** — 20160 局（45 pairs × 8 policies × 4 seeds）P0 修复后基线（`data/raw/2026-06-10_clean-batch.jsonl`）

- **2026-06-10 关键发现**：
  - 全角色 BO 最优胜率汇总：char_1=62.0% / char_2=54.6% / char_3=82.4% / char_4=84.3% / char_5=55.6% / char_6=94.4% / char_7=25.9% / char_8=57.4% / char_9=33.3%
  - char_9 BO best 0.3333（balanced 默认 ~0.25）→ +8.3% 提升
  - char_7 (弱化) 25.9% 最低 — 角色本身可能弱于设计预期
  - 强化(84%) / 持久(94%) / 进攻(79%) / 防御(62%) — 强势角色胜率稳定
  - char_9 与 char_7 属于弱势角色，BO 优化提升有限，需 DL/RL 验证是否 AI 策略瓶颈还是角色设计问题

#### Phase 1 — 修 RuleBasedAI 死循环（🔴 阻塞性前置）

- [X] **ruleBasedAI.ts 死循环修复** — c0 占比 41-82% 的根因消除；新增"无进展检测"和"重复动作检测"；保持接口与 PRD 行为不变
  - **2026-06-09 修复方案（v2.1.1 方案 B：不限速 + 情景式评分）**：
    - 收紧 `scoreSpecialCard`（case 1/5/6/8-12/13/16 评分下调）
    - `decidePhase2` 加 `bestScore > 0` 早退门槛
    - 新增 `lastActionThisTurn` 字段 + 重复 cardIndex 检测（防 c0 类死循环兜底）
- [X] **10 局审查样本回归** — 重跑 M0+M1-M9，**修订 AC**：原 "c0 占比 < 15%" 是症状不是根因；新 AC = 特殊卡 < 30 + 总动作 < 250 + 回合均动 < 15。**全 10/10 通过**（special 4-14, total 94-219, m/t 7-10）
- [X] **144 局统计稳定性测试** — 36 unordered matchup × 4 policy 组合。**全部指标达标**（special max=29, total max=237, 无死循环），144 局 3.33s。**详见 `data/raw/manual-review/2026-06-09_batch-144.jsonl`**
- [X] **20160 局干净 batch 收集** — P0 修复后首次大批次基线（详见 §Phase 2 描述）
- [X] **沉淀到 0_TASKLIST.md 自我进化循环沉淀** — 未来铁律15 写入

#### Phase 2 — 后续验证（BO 实施已完成，待大规模验收）

> 注：以下 3 项已在实施阶段完成：`optimizer_botorch.py`（8D GPU）+ `bo_runner.py`（目标函数 + 早停收敛判据）

- [X] **optimizer.py（已实现为 optimizer_botorch.py）** — BoTorch 8 维 GPU 优化，支持 wild/skill_pref/noise 维度
- [X] **目标函数设计（已实现于 bo_runner.py）** — 混合对手池 {balanced, gambler, conservative, aggressive, saver, all-round} 上平均胜率
- [X] **收敛判据（已实现于 bo_runner.py）** — GP 后验方差稳定 + 连续 N 轮无改善早停（默认 patience=20, tol=0.005）
- [ ] **大规模验收** — 使用 BO 优化后的 θ* 重跑 batch-579（43560 局），验证 char_7/char_9 胜率改善是否统计显著；生成含对比的新 HTML 报告

#### Phase 3 — DL/RL 策略基线（与 Phase 2 对比）

- [ ] **环境封装** — GameEngine → PettingZoo 多智能体环境
- [ ] **PPO 基线** — Stable-Baselines3 / RLlib 训练 9 角色独立策略
- [ ] **消融实验** — 卡牌游戏2.0原型.md §5.5 框架
- [ ] **与 BO 对比报告** — 哪种方法在 9 角色上效果更优

#### 技术债务 — Glicko 改进

- [ ] **Glicko 收敛加速** — 当前 Glicko 在独立仿真对局（非时间序列）中排序不稳定。改进方向：（1）随机打乱对局顺序多次运行取平均；（2）引入 mini-batch 更新减少方差；（3）对比分析使用 Elo 作为主评级，Glicko 仅作参考

### v2.2.0 — 混合强度分析（🔭 远期，依赖 v2.1.1 大规模验收完成）

> 注：全角色 θ 优化已在 v2.1.1 Phase 2 完成（9 角色 × BoTorch 8D × budget 100），θ* 矩阵已构建

- [X] **全角色 θ 优化** — 9 角色独立超参数优化已全部完成（`data/optimization/all_chars_20260610_105706.summary.json`）
- [ ] **双强度管线** — 分别跑方案A（通用强度)和方案C（有效强度），输出对比报告
- [ ] **操作天花板分析** — 自动计算 Δ(c_i) = R_effective - R_base 及其 Bootstrap 置信区间

### v2.2.0-alpha — 网页版 + 录像采集（🛠 进行中，技术探索）

> **定位**：v2.x 期内并行实验分支，不阻塞 V2 主体推进。
> 目标：（1）解决安装包过大触达门槛（v2 走网页+云端录像）；（2）采集真人玩家 vs AI 的对局数据，反哺 v2.1.1 BO 优化与 v2.2.0 混合强度分析。
> 部署目标：阿里云个人域名（待注册）+ ECS + MySQL。
> **决策**：仅 V2 BO 屏蔽 char_7，网页版不限制（玩家可自由选 9 角色）。

#### Phase 1 — V1 网页模式开关（🛠 进行中）

- [ ] **P1.1 buildMode 配置模块** — `src/config/buildMode.ts` 提供 `isWebMode()` / `API_BASE`
- [ ] **P1.2 vite.config.ts + build:web 脚本** — 加 web 模式 build/dev 脚本
- [ ] **P1.3 CoverPage 隐藏 LAN/Test 入口** — web 模式仅保留人机对战
- [ ] **P1.4 gameStore 强制 1v1 + autoRecord** — web 模式无视 settingsStore.autoRecord 强制录制
- [ ] **P1.5 replayStore 上传队列 + 补传** — `pendingUploads` 持久化字段
- [ ] **P1.6 replayExporter 上传函数** — `uploadReplayToServer()` fetch POST /api/replays
- [ ] **P1.7 GameBoard 自动上传 + Toast** — 胜利弹窗 web 模式自动上传，失败入队列
- [ ] **P1.8 build 验证** — `npm run build` + `npm run build:web` 双模式零错误

**AC（验收）**：

- `npm run build:web` 产物可静态部署到 Nginx/OSS
- web 模式运行时，CoverPage 看不到「局域网联机」「录制测试」入口
- 玩 1 局 1v1，胜利时录像自动 POST `/api/replays`，无需用户手动操作
- 关闭网络（offline）玩 1 局，胜利后录像入 `pendingUploads`，恢复网络后启动时自动补传

#### Phase 2 — 后端服务（📅 待启动）

- [ ] **P2.1 server 目录初始化** — `card-game/server/` 新建 package.json / tsconfig / .env.example / README
- [ ] **P2.2 schema.sql + db.ts** — MySQL 8.0 replays 表 DDL + 连接池 + 启动自动初始化
- [ ] **P2.3 路由实现** — POST /api/replays / GET /api/replays/stats / GET /api/health
- [ ] **P2.4 Express 入口** — index.ts，cors/json 中间件，路由挂载，端口 3000
- [ ] **P2.5 本地自测** — `curl POST /api/replays` + `GET /api/health` 全链路验证
- [ ] **P2.6 V1+server 联调** — Vite web 模式 dev + 本地 Node server，跑 1 局验证上传

**AC**：

- `cd server && npm run dev` 启动后 `curl http://localhost:3000/api/health` 返回 `{status:'ok',db:'connected',count:N}`
- V1 web 模式一局结束后，replay 自动出现在 MySQL `replays` 表，`payload` 字段含完整 V1Replay JSON
- `GET /api/replays/stats` 返回按 `char_ai × winner` 聚合的胜率

#### Phase 3 — char_7 屏蔽 + 8 角色大规模验收（📅 下一轮）

- [ ] **P3.1 BO 跳过 char_7** — `data/optimization/run_all_bo.py` / `bo_runner.py` 排除 char_7
- [ ] **P3.2 simulator/cli.ts / analysis/cli.ts** — 加 `--exclude-chars` 参数
- [ ] **P3.3 大规模验收改 8 角色对照** — 重跑 batch（char_7 留待角色修改后补做）
- [ ] **P3.4 0_TASKLIST.md 大规模验收 AC 改写** — "8 角色对照实验"

#### Phase 4 — 部署准备（✅ 2026-06-15 完成）

- [X] **P4.1 隐私政策页 / 用户协议页** — V1 加路由 + 强制勾选（国内合规最低要求）
- [X] **P4.2 阿里云部署文档** — DEPLOY.md：域名注册、ICP 备案、ECS、Nginx、SSL、MySQL
- [X] **P4.3 域名/备案/SSL 流程清单** — 时间线 + 卡点提示（备案 7-20 工作日）

### v2.2.1 — 角色平衡调整（🛠 进行中，2026-06-15）

> **背景**：`docs/卡牌游戏原型.md` 更新，防御/持久/反击三角色微调 + 弱化完全重做。
> 原型变更原因：V2.1.1 BO 数据显示 char_7 1v1 胜率仅 25.9% 过弱，char_2/6/8 也需小幅修正。
> 本版本专注 V1 代码同步；V2 BO 屏蔽 char_7 计划**等 V1 验证通过后解除**。

- [X] **P1 characters.ts 同步** — 4 角色描述文本 + 弱化 4 技能命名（削弱/衰弱/虚弱/朽灭）
- [X] **P2 gameEngine 防御 技能4** — 触发条件 `hand===0` → `hand<=2`
- [X] **P3 gameEngine 持久 技能4** — 弱化 1 回合 → 流血 3 回合；回复 8 → turn/2
- [X] **P4 gameEngine 反击 技能4** — 条件翻转（已受伤→未受伤）+ 自损 4 + 目标 4
- [X] **P5 gameEngine 弱化 4 技能重写** — 全 4 技能按新原型重做
- [X] **P6 4 套技能测试更新** — char_2/6/7/8 测试套件
- [X] **P7 3 个协同/集成测试新增** — char_7 stacking 协同 / char_8 自损影响技能1-3 / char_5 完整 action order + 敌方睡眠
- [X] **P8 build + 70+ tests PASS**

**AC（验收）**：

- `npm run build` 零类型错误
- `npm run test:run` ≥ 72/72 tests passed（原 69 + 新 3）
- char_7 4 技能按新原型实现（削弱/衰弱/虚弱/朽灭）
- char_8 技能 4 条件翻转生效（未受伤触发自损+目标伤害）
- char_5 睡眠场景已通过既有 3 个 sleep 测试

**依赖关系**：

- ✅ V1 验证通过后 → 下一轮解除 V2 BO 对 char_7 的屏蔽（V2.2.1 → V2.1.1 phase 2 大规模验收）

### v2.2.1.5 — 游戏教学引导（🆕 待启动，2026-06-18）

> **背景**：体验玩家反馈游戏缺乏基本引导，新玩家进入测试版后不知三阶段机制、印记/护盾/穿透区别、血战规则等。
> **设计原则**：
> - **触发器与内容解耦**（未来触发位置可换：TestPage → CoverPage / GameBoard / 其他）
> - **每次进入 TestPage 都触发，可跳过**（无 localStorage 持久化；版本号保留作未来内容热替换占位）
> - **步骤数据化**（`tutorialSteps.ts`，改文案不动组件逻辑）
> - **UI 描述用功能性名词 + 相对位置**，避免绑死按钮 className（未来 UI 重构后文案不失效）

- [ ] **P1 tutorialStore.ts** — Zustand store（无 persist 中间件）：
  - 字段：`isActive` / `currentStep` / `totalSteps` / `version` / `steps`
  - actions：`startTutorial` / `nextStep` / `prevStep` / `skipTutorial`
  - `version` 字段保留作未来内容热替换占位，**不参与触发判断**
- [ ] **P2 tutorialSteps.ts** — 8 步教学内容（v2 文案，含 UI 区域描述）
- [ ] **P3 TutorialOverlay.tsx** — 全屏遮罩 + 卡片化步骤 + 点导航 + 上下步 + 跳过按钮 + ESC 关闭
- [ ] **P4 App.tsx 挂载** — App 根挂载 `<TutorialOverlay />`，全局唯一
- [ ] **P5 TestPage 触发** — useEffect mount 时无脑 `startTutorial()`（无 localStorage 判断）；延迟 200ms 让页面 settle
- [ ] **P6 CoverPage "?" 按钮** — 顶栏加 "?" 按钮，点击 `startTutorial()`，作手动唤起入口（前向兼容）
- [ ] **P7 build 验证** — `npm run build` 零错误；TestPage 每次 mount 都触发；跳过立即关闭
- [ ] **P8 同步 New_Card_Game_Web + 双端 push** — commit + push GitHub + push Gitee

**AC（验收）**：
- 每次进入 TestPage 自动弹出 8 步教学
- 关闭/跳过后立即消失；下次进入仍触发
- CoverPage "?" 按钮可主动唤起
- 改 `tutorialSteps.ts` 文案不动组件逻辑
- `npm run build` 零错误
- 双端 push 后 GitHub/Gitee HEAD 一致
- 关键文案已应用玩家修正：能量放置在弹窗、特殊卡无 inline 说明、Step 8 指向局内 Help 按钮位置

**关键决策记录**：
- 不持久化"已读"状态：每次进入都弹是教学而非广告，玩家主动点选 matchup 才离开教学态
- UI 描述双锚定（功能名 + 相对位置）：即使 UI 重构到侧边栏，依然成立
- GameBoard 已有 Help Modal（4 Tab：基础规则/角色百科/特殊卡牌/印记说明），Tutorial 走独立 Overlay 路线，两者并存不重复

### v2.2.1.2 — Web 测试页 + 共享进度（🛠 进行中，2026-06-15）

> **背景**：v2.2.1.1 V1 角色修复 + 隐私弹窗 z-index 修复后，启动 V2 char_7 解锁并改造测试页。
> **设计**：
>
> - Web 模式 CoverPage 只保留 1 个按钮（"录制测试"），无其他入口
> - TestPage 列出 81 种 matchup（9 人类 × 9 AI）+ 当前进度
> - 每种 matchup 目标 10 局；收集满后**自动锁定**，无法被选（含随机）
> - 进度**服务端共享**：所有登录此网站的玩家共用一套测试进度（替代 localStorage 各自独立）
> - 同步机制：HTTP 轮询 5s + 玩完立即推送
> - Race condition：9/10 时两用户同时+1，第二个返回 409 Conflict
> - 数据迁移：旧 localStorage 首次访问弹窗"合并到服务器（取 max）"

- [X] **P1 0_TASKLIST 任务块**
- [X] **P2 BE.1 schema.sql 加 test_progress 表**
- [X] **P3 BE.2 test-progress 路由 (含锁定校验)**
- [X] **P4 BE.3 server smoke 测试**
- [X] **P5 FE.1 testProgressStore 改造 (server 同步 + 5s 轮询)**
- [X] **P6 FE.2 CoverPage web 模式改单按钮**
- [X] **P7 FE.3 TestPage 重构 (10 格进度 + 锁定 + 随机)**
- [X] **P8 FE.4 1 局玩完后 increment 路径**
- [X] **P9 FE.5 5s 轮询 + 同步指示器**
- [X] **P10 FE.6 localStorage 迁移弹窗**
- [X] **P11 验证 (server + client + 76+ tests) PASS**

**AC（验收）**：

- Web 模式 CoverPage 1 个按钮
- TestPage 列表 81 项，每项 10 格进度方块
- 10/10 matchup 锁定（灰显 + 不可点 + 随机跳过）
- 服务端 race condition 防护（9/10 时+1 返回 409）
- 5s 同步延迟可观察（"上次同步 X 秒前"）
- 旧 localStorage 一次性迁移
- server smoke + client tsc + 76 tests 全过

### v2.2.1.3 — Cloudflare 互联网部署 + 录像下载（🚫 已取消）

> **2026-06-15 决策撤销**：老师推荐的 Cloudflare 方案经分析存在架构冲突（Workers 重写 Express 整盘代码、域名延迟、D1 vs MySQL 迁移等），**改回阿里云路径**。
> 详见 `docs/DEPLOY.md`（v2.2.0-alpha Phase 4 写好的完整 12 章节阿里云部署文档，原方案保留并生效）。

---

## 🔄 自我进化循环沉淀 (Learning & Best Practices)

- **记录内容：**记录已经解决的重大问题和以后必须遵守的命令
- **记录格式：** [“日期”] | “问题描述” | “底层原因” | “未来铁律”

[2026-05-26] | 测试代码编译报错导致 Build 失败 | 修改核心类型(Player)后未同步更新测试辅助代码(types)和新文件的导入路径 | **未来铁律1**: 新增核心类型字段时，必须同步更新 `src/test/helpers.ts` 的 `createTestPlayer` 选项类型；**未来铁律2**: 测试文件的导入必须使用 `../types` 而非 `./types`，使用 `../stores/` 而非 `./stores/`
[2026-05-27] | 卡牌克隆漏洞：手牌中出现多张相同特殊卡 | `useSkill`/`useSpecialCard` 中调用 `drawCard` 后，最终 `set()` 使用了函数开头捕获的陈旧 `gameState` 引用，导致 `deck` 回滚到抽牌前状态，抽到的卡同时存在于手牌和牌堆 | **未来铁律3**: 任何调用 `get().drawCard()` 或其它会触发 `set()` 的 store 方法后，最终 `set()` 必须使用 `get().gameState` 重新读取最新状态，禁止使用提前捕获的陈旧引用
[2026-05-27] | 角色6技能2无法刷新已存在的中毒印记 | `if/else` 结构导致已中毒时仅触发3点穿透，跳过了 `addMarkWithReplacement` 调用 | **未来铁律4**: 技能效果实现时，印记附加应始终执行（无论目标是否已有该印记），条件穿透/伤害作为额外效果叠加，不得使用 `if/else` 二选一
[2026-05-27] | endTurn 中灵感印记的处理导致 HP/盾回滚 | `Object.assign(updatedPlayer, latestPlayer)` 覆盖了之前印记已修改的 HP/盾 | **未来铁律5**: 多步状态累积场景中，禁止使用 `Object.assign` 全量同步，应只同步需要的字段（如 `hand`）
[2026-05-28] | 混乱偏移不生效：日志显示偏移但伤害仍在原目标 | useSkill 中 `const target` 在混乱检查前创建，混乱后的 `actualTargetIndex` 未用于重建 target | **未来铁律6**: 状态效果检查（如混乱）若需要变更目标，必须在检查后立即重建目标对象，仅存值的副本或索引的修改不足以影响后续逻辑
[2026-05-28] | 睡眠状态触发漏洞：检查只在 useSkill 内，玩家跳过出牌则永不触发 | 睡眠的回复和跳过逻辑放错位置，应放在 advancePhase 阶段2入口处自动执行 | **未来铁律7**: 回合级状态效果（睡眠/混乱/失神等）的触发点应置于阶段入口（advancePhase 或对应的 turn 开始处），而不是仅在技能使用函数中，确保逻辑对所有玩家（含 AI 无能量时）一致触发
[2026-05-28] | AI 自动行动失效 | EnemyCard 替换 PlayerArea 后移除了 AI 自动行动 useEffect，导致能量放置后流程卡住 | **未来铁律8**: 任何 AI 自动行动/控制的逻辑必须放在独立的控制器组件或全局作用域中，禁止绑定在视觉渲染组件内。UI 组件可能被替换或条件渲染，但 AI 控制逻辑必须稳定挂载。
[2026-05-28] | AIController 不处理 card_exchange 阶段 | AIController 的 isActionPhase 只含 phase1/phase2，忽略 card_exchange，导致 players[0] 为 AI 时换牌卡死 | **未来铁律9**: AIController 的 phase 检查必须覆盖所有需要 AI 自动处理的阶段（含 card_exchange）。新增阶段需同步更新 AIController。
[2026-05-28] | 自目标技能指向错误目标 | 自目标技能(回复/铁壁/Combo等)无 target 标识，PlayerArea 的通用逻辑将其指向对手 | **未来铁律10**: 所有技能的 target 语义（self/other）必须在数据结构层面显式声明，禁止通过描述文字隐含。UI 和 AI 逻辑统一根据 target 字段分发。
[2026-05-28] | 开局座位随机顺位失效 | shuffle() 纯函数返回值被丢弃，allSeats 始终有序排列 | **未来铁律11**: 调用纯函数（无副作用）时必须接收其返回值。shuffle/map/filter 等不修改原数组的函数禁止"假装调用"。
[2026-05-28] | 无垢印记未阻挡状态类负面印记 | endTurn 中 has_blind/has_confusion/has_sleep/has_madness 在无垢检查之前设置，导致无垢只阻挡HP/盾效果但未阻挡失明/混乱/睡眠/失神 | **未来铁律12**: 负面印记的"效果"包括 HP 伤害和状态标志两部分。无垢必须同时阻挡两者。所有"免疫"类效果必须在状态标志设置前检查。
[2026-05-29] | 局域网联机 game_start 后玩家无法进入角色选择 | Lobby 的 handleServerMessage useCallback 依赖数组只声明了 `[onGameStart]`，但函数体使用了 `wsUrl`/`playerId`/`nickname`/`isHost`/`players` 等状态变量。React 不重新创建回调，闭包始终捕获首次挂载时的初始值，导致 `setLAN` 写入空 `wsUrl`。 | **未来铁律13**: useCallback 的依赖数组**必须完整声明**函数体内所有使用的外部变量。ESLint 的 `react-hooks/exhaustive-deps` 规则不可忽略。访问 Zustand store 的变量应通过 `getState()` 在函数体内读取（避免捕获 React state），或安全地加入依赖数组。
[2026-05-29] | Lobby → LANGame 过渡页面卡死 | Lobby 和 LANGame 各自创建独立 WebSocket 实例，过渡时旧连接断开、新连接建立，触发服务端断线广播和计时器风暴，所有客户端同时处理大量连接事件导致渲染阻塞 | **未来铁律14**: 应用级的连接管理（WebSocket/SSE）必须使用模块级单例，禁止在组件内独立创建。组件间切换时应通过 handler 替换而非连接重建实现无缝过渡。
[2026-06-09] | RuleBasedAI 死循环：c0 占比 41-82% 导致每局 700+ 动作 | `src/ai/ruleBasedAI.ts` 的 `scoreSpecialCard` 对 case 1/5/6/8-12/13/16 在多数场景下返回正分（即使该卡无实际进展，如"已有同名印记"、"手牌已满"等），加上 `decidePhase2` 没有"重复 cardIndex 检测"和"评分 ≤ 0 时 pass"的早退门槛，导致 AI 反复用 `hand[0]` 抽卡-用卡-抽卡，引擎不结束 phase2 直至内存耗尽 | **未来铁律15**: 任何"评分 ≥ 0 即采用"的决策函数都必须**同时**具备 (a) 状态感知的负分门槛（无进展场景返回负分）和 (b) 重复动作检测（至少跨 turn 跟踪最近一次 cardIndex）。**c0 占比 < 15% 是症状不是根因**——真正的 AC 应当是"每局特殊卡使用次数 < 30"和"每回合平均动作数 < 15" |
[2026-06-10] | 不要在 Windows PowerShell 写跨语言 wrapper（node -e 调中文字符串）| 尝试用 PS 5.x 写 `node -e "中文字符串"` 触发 3 个独立 bug：(1) heredoc 中文按系统代码页（GBK）乱码；(2) 字符串按空格切分成多个 token；(3) 内嵌 `"` 被 PS 当作双引号字符串边界。3 次连续修复均失败，按"重试熔断原则"中止，回归 Node.js `.cjs` | **未来铁律16**: 跨语言/进程边界 wrapper 一律用 Node.js `.cjs`（POSIX 兼容 + UTF-8 原生 + 无引号转义陷阱）。PowerShell 5.x 只用于"启动 + 调 `.cjs/.exe`"，绝不写 wrapper 逻辑 |
[2026-06-10] | AC 选指标必须区分"症状"与"根因"，错指标导致 100% 假阴性 | P0 修复时把 "c0 占比 < 15%" 当 AC，但修复前 c0=特殊卡=100% 是因为死循环（不是 c0 本身有问题）；修复后 c0=57% 但 special_uses 从 617→4（根因指标已降 99%）| **未来铁律17**: 验收标准（AC）必须**直接测根因**，症状只能作观察指标。问"这个指标在 bug 修复前后变化方向是否一致"——如不一致则说明选错了指标。例：P0 bug 的根因是"特殊卡反复用"（特殊卡次数），不是"c0 占比"（症状）|
[2026-06-10] | nohup 后台任务用相对路径 + 目标目录未 pre-create 静默失败 | `nohup node scripts/clean-batch.cjs > data/optimization/clean-batch.log` 因 `data/optimization/` 不存在而失败，但 background task 只报 exit=0 不报错 | **未来铁律19**: 任何 `nohup` / `run_in_background` 任务必须 (a) 目标目录 `mkdir -p` pre-create；(b) 输出路径用 `$(pwd)/...` 绝对路径；(c) 启动后用 `tail` 验证日志首行存在再继续 |
[2026-06-11] | 录制型 action 重构时丢失 winner/finalState 填充逻辑 | P1.5 把 `finalizeReplay(winner, finalState)` 拆出独立 `saveCurrentReplay()`，忘了把 winner/finalState 计算带过来，导致 2 个录制文件 `winner=null`、`finalState.players=[]` | **未来铁律18-20**: (铁律18) 录制状态独立于 gameStore；(铁律19) 保存 action 必须接受 overrides 参数，UI 层从 gameState 填充；(铁律20) V1 单人模式不自动调 checkGameOver，UI 层自行推算 winner |

- **记录内容：**经过多次自动尝试修复但无法解决的BUG，或者在接收到多次相同的修复指令依然没有成功的任务
- **记录格式：** [“日期”] | “来自的任务” | “问题描述” | “临时处理方式”

[2026-05-29] | 特殊卡悬停提示 | PlayerArea 手卡区特殊卡 hover tooltip 经 CSS group-hover 和 React onMouseEnter 两次尝试均不生效，疑为 flex overflow-x-auto 容器内 absolute 定位的层叠/事件穿透问题 | 暂时标记为遗留问题，后续通过 Portal 或全局 tooltip 方案解决

[2026-06-08] | **[P0] RuleBasedAI 死循环倾向** | 人工审查 10 局样本（`data/raw/manual-review/2026-06-08_sample-10.jsonl`，M0 平衡自打 + M1~M9 连击 vs 9 角色，策略=balanced）中 9/10 局 `use_special_card_c0` 占比 41.2%–82.3%（最高 M0=82.3% / M2=81.3% / M7=77.3% / M1=77.1% / M6=65.8% / M8=62.8% / M3=58.9% / M9=47.6%），AI 反复使用手牌第 1 张且不结束行动；M0 17 回合 750 moves = 22 moves/回合/玩家，远超合理值。疑似 `src/ai/ruleBasedAI.ts` 缺乏"刚打过不再打"的循环检测 | **暂不修**。在新批次（>100 局）采集前**必须修复**，否则 c0 死循环会污染所有角色强度统计（"策略偏差"和"角色偏差"无法分离）。详见 `data/raw/manual-review/2026-06-08_sample-10.jsonl`

[2026-06-08] | **[P1] M9 连击互打判平局疑点** | 10 局样本 M9（连击 vs 连击，23 回合）双方 HP=0，但 P2 护盾=2、P1 护盾=0，`winner=null`（平局）。已过回合 20 进入血战期，疑为同回合双方同时受穿透归 0。PRD §1.5「坚持到最后的玩家为胜利者」未明文规定同时归 0 处理 | **暂不修**。需源码确认是 V2 引擎的防御性回退（设计）还是死亡顺序判定 bug；如是 bug，需在 PRD 增补"同时归 0"规则

[2026-06-08] | **[P2] Replayer 自对自渲染异常** | 文本回放器（`src/simulator/cli.ts`）在同名角色互打（M0 平衡自打 / M9 连击互打）时，特殊卡目标显示字面量"自身"或"目标"，未渲染对方角色名 | **暂不修**。美观问题，不影响数据正确性

---

## 🛠️ 验证命令

### V1 产品

```bash
cd card-game && npm run dev
```

### V2 仿真平台

```bash
cd card-game
npx tsc -p tsconfig.simulator.json     # 编译仿真模块
node dist-engine/simulator/concurrentRunner.js  # 运行批量仿真
node dist-engine/simulator/cli.js               # 命令行单局对局
```

---

## 📌 技术决策记录

| 版本  | 决策                      | 原因                                                                                                                          |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0 | React + Vite SPA 方案     | 轻量、开发快、便于未来扩展联机                                                                                                |
| 1.0.0 | TypeScript 重写游戏逻辑   | 前端需实时响应游戏状态                                                                                                        |
| 1.0.0 | Tailwind CSS              | 简约现代风 + 桌游沉浸感                                                                                                       |
| 1.0.0 | Zustand 状态管理          | 轻量、支持 2-4 玩家扩展                                                                                                       |
| 1.0.1 | 卡牌克隆漏洞修复          | stale gameState 引用导致 deck 回滚、特殊卡被复制。铁律：最终 set() 必须用 get() 重新读取最新 state                            |
| 1.0.1 | 技能效果与印记操作规范    | if/else 结构致印记刷新失败 + Object.assign 全量同步覆盖 HP/盾。铁律：印记始终调用 addMarkWithReplacement；多步累积只同步 hand |
| 1.0.1 | 状态效果触发点设计        | 混乱检查后未重建 target + 睡眠仅在 useSkill 检查。铁律：状态效果在阶段入口处理，混乱后立即重建目标                            |
| 1.0.1 | 行动状态框架裁定          | 多人模式"先手"边界裁定。advancePhase 退出阶段2标记 has_acted_this_turn，睡眠跳过例外。详见 extra_rule.md                      |
| 1.0.1 | Per-skill 使用次数追踪    | 全局 skills_used_this_turn 致技能间互相拦截。新增 skill_usage_counts[] 独立计数每个技能                                       |
| 1.1.0 | AIController + 动态AI架构 | AI 行动逻辑从 UI 渲染解耦为独立控制器，支持 1-3 AI 灵活配置。铁律8/9/11                                                       |
| 1.2.0 | 服务端权威架构            | 无头 GameEngine 抽取 + GameHost 仲裁 + 同步计时器/时间银行由服务端统一驱动。铁律13                                            |
| 1.2.0 | 模块级 WebSocket 单例     | 组件间独立连接导致断线风暴，改为模块级单例 + handler 替换。铁律14                                                             |
| 1.2.0 | 房间生命周期管理          | 五态状态机(IDLE→LOBBY→PLAYING→ENDED→CLEAR) + 30s断线重连/房主转移                                                         |
| 2.0.0 | GameEngine PRNG 注入      | 所有随机操作通过可注入 PRNG（mulberry32），V1 默认 Math.random 零影响。铁律：新随机操作必须通过 this.prng                     |
| 2.0.0 | V1/V2 引擎同源策略        | V2 不 fork 引擎，通过构造参数 `GameEngineConfig` 切换模式，确保仿真结果反映实际游戏行为                                     |
| 2.0.0 | IPlayerPolicy 策略体系    | 策略与引擎分离，通过 Action 协议通信。策略必须实现 setPRNG 确保决策可复现。铁律：policy.decide 不直接调用引擎                 |

---

## 📚 文档索引

- 1_PRD.md - 产品需求文档
- 2_ARCHITECTURE.md - 架构红线与技术栈
- 3_UI_RULES.md - UI与设计规范
- 4_BACKEND_DB.md - 数据与后端规范（WebSocket 服务器 + v2.x 数据存储架构）
- 5_AGENT_RULES.md - AI编码与行为准则
