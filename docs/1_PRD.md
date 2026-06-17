# 1_PRD.md: 产品需求文档

## 1. 愿景与目标 (Vision & Goal)
用一个游戏实例，探索角色不对称设计下的游戏平衡，即"主观能动性驱动下的无限可能性"：

- 不存在绝对的最优策略和克制关系
- 没有绝对性压倒一切的通解
- 也不存在"无环境作用"的角色（任何条件下都无法替代相近定位的角色）
- 允许小范围"环境锚点"存在（对大多数角色劣势但克制压倒性强角色）

**目标层级**：

| 模式&开发阶段 | 目标 | 状态 |
| ---------- | ------------------------------------ | ---- |
| 玩家与AI 1v1对战 - 1.0.x版本 | 方便玩家入门学习 + 开发调试工具 | ✅ 已完成 |
| 玩家与AI 1vn对战 - 1.1.x版本 | 增强游戏趣味 + 为局域网对战技术积累 | ✅ 已完成 |
| 局域网多人对战 - 1.2.x版本 | 玩家对战交流心得，收集平衡性反馈 | ✅ 已完成 |
| 仿真引擎 + 规则AI基线 - 2.0.x | 构建可靠的批量对局仿真能力：无状态 GameEngine、参数化规则AI策略族、数据采集管线、文本回放器 | 🛠 进行中 |
| Meta分析 + 角色梯度 - 2.1.x | 统计学驱动的角色强度评估体系：胜率矩阵、假设检验、Elo/Glicko评级、超参数自动优化 | 📅 规划中 |
| 混合强度分析 - 2.2.x | 策略-角色解耦分析、双强度对比报告、操作天花板量化 | 🔭 远期 |

## 2. 核心用户路径 (User Flow)
1. 用户进入游戏 → 选择角色 → AI选择角色
2. 阶段1：放置能量卡决定行动顺序
3. 阶段2：使用技能/特殊卡攻击或回复（可多次）
4. 阶段3：印记效果结算
5. 重复步骤2-4直到一方血量归零
6. 显示胜利/失败结果

## 3. MVP 功能范围 (MVP Scope)

### 3.1 V1.x 产品 MVP

- **P0 (必须有)**: 
  - 9个角色可选，各有4个技能
  - 能量卡系统（1/2/3/万能能量）
  - 16种特殊卡
  - 3阶段回合制
  - AI对手
  - 印记系统（含正负面效果）
  - 血战机制（回合>20）
  - 胜负判定

### 3.2 V2.x 仿真分析平台 MVP

- **P0 (必须有)**:
  - 无状态 GameEngine（可注入 PRNG、确定性执行）
  - IPlayerPolicy 策略接口 + 规则AI策略族（≥8 个参数变体）
  - 并发对局调度（9×9 全组合，100+ 局/秒）
  - JSON Lines 数据采集与完整性校验
  - 文本回放器（人类可读的对局重现）
  - CLI 自包含运行（独立于 V1 游戏 UI 进程）

- **P1 (最好有)**:
  - SQLite 聚合存储与查询
  - 统计分析模块（胜率矩阵、Wilson 置信区间、双比例 Z 检验）
  - Elo/Glicko 评级引擎
  - 多重比较修正（Benjamini-Hochberg FDR）
  - 自动生成 Tier 报告与克制关系图数据
  - 超参数优化器（贝叶斯优化：GP + EI 采集函数）

- **P2 (远期)**:
  - 方案C 全量实施（角色特化策略优化 → 双强度对比报告）
  - Web 可视化回放器
  - DL/RL 策略接入与消融实验框架

## 4. 🚫 明确不做的事 (Out of Scope)
- [ ] 多人在线联机（互联网联机，非当前 1.2.x 局域网范围，后续版本考虑）
- [ ] 玩家自定义卡组
- [ ] 排行榜系统
- [ ] 社交功能
- [ ] 音效/背景音乐
- [ ] 复杂动画效果

## 5. 核心实体模型 (Core Entities)

### V1.x 产品

- **Player**: id, name, type(human/ai), character_id, hp, shield, hand, marks, seat_index, has_acted_this_turn, skill_usage_counts[]
- **Card**: card_id, name, type(energy/special), energy, is_wild, effect_id
- **Character**: card_id, name, hp, skills[]
- **Skill**: name, cost, description, max_uses_per_turn, target(self|other)
- **Mark**: name, remaining_turns, mark_type(positive|negative)
- **GameState**: turn, phase, players[], action_order, deck, discard_pile, logs[]

### V2.x 仿真分析平台

- **IPlayerPolicy**: name, decide(state, playerId) → Action（策略接口）
- **Action**: type(place_energy \| use_skill \| use_special_card \| exchange \| pass), cardIndex?, skillIndex?, targetId?, paymentCardIndices?
- **θ (策略超参数)**: θ_priority, θ_wild, θ_hp_danger, θ_aggro, θ_mark_weight, θ_skill_pref[4], θ_special_threshold, θ_noise
- **Replay**: version, timestamp, duration, seed, config(policies[]), moves[], winner, finalState, stats
- **Move**: turn, phase, playerId, actionType(place_energy\|use_skill\|...), actionDetail
- **MatchResult**: replay, winnerId, winnerCharacter, loserCharacter, duration, turnCount
- **BatchStats**: totalGames, winRateMatrix, durationStats, turnStats, skillUsage, characterAppearances