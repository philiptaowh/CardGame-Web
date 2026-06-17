# 5_AGENT_RULES.md: AI编码与行为准则

## 1. 核心编码信条 (Coding Zen)
- **代码是负债**：用最少的代码解决问题
- **DRY (Don't Repeat Yourself)**：重复代码必须重构
- **类型安全**：优先使用 TypeScript 类型，禁止不必要的 `any`
- **不可变更新**：状态更新必须使用不可变方式，禁止直接 mutation
- **原子化文档同步（Shadow Update）**：当你意识到自己正在修复一个记录在案的「遗留问题」或「Known Issues」时，**必须**在输出修复代码的同时，用【Surgical Fidelity（精准替换）】将 `0_TASKLIST.md` 中对应的条目同步删除或移动。禁止将代码修复与文档更新拆分为两次对话。

## 2. 🛡️ 安全拦截与 HITL (Human-in-the-loop)
> **AI 必读：** 高危操作必须申请主人授权。
- 破坏性命令（删除文件、强制推送）
- 敏感数据输出
- 大范围代码修改

## 3. 思考与验证流 (Think & Verify)
- **伪代码先行**：大变动前，先列出实现思路
- **自我修正**：报错时优先自行搜索解决方案
- **验收驱动**：完成后必须运行 `npm run build` 验证
- **拒绝假成功**：未自测通过禁止标记完成
- **严格的遗留问题准入制**：严禁将单轮即可修复的编译、类型检查（typecheck）、语法（Lint）或简单的拼写错误写入 `0_TASKLIST.md`。
- **本地消化原则**：任何在【物理验证】阶段（Build/Test）抛出的直接报错，必须在当前任务内**原地重试修复至少 1 次**。只有当尝试修复后引发更深层次的架构冲突，或属于 P1 阶段非核心体验时，才允许记录到「遗留问题」。
- **重试熔断原则（Retry Circuit Breaker）**：对于**非确定性**的脚本/环境/集成类问题（不是单一明确的语法错误），**最多 2 次自动修复**：
  - 第 1 次失败 → 原地修复（被"本地消化原则"覆盖）
  - 第 2 次失败 → **必须**停下来，输出：已尝试的方案、失败现象、推测根因。**禁止进入第 3 次自动修复**。
  - 等待用户决定替代方案后，才可继续。
  - **适用场景**：跨 shell/编码/进程边界的集成、PowerShell/cmd/bash 行为差异、文件 IO 编码、字符集转换、WSL/Cygwin 兼容问题。
  - **不适用**：明确的语法错误、类型错误、缺失依赖（这些是"本地消化"范畴，第 1 次就该修）。
  - **反模式**：连续 3 次以上"换种方式再试试"——浪费时间且容易引入补丁式坏味道。

## 4. 错误处理与用户感知 (Error Awareness)
- 禁止默默吞掉错误，必须输出到 console.error
- UI 上提供友好的错误提示（如 Toast）
- 游戏状态异常时添加日志记录

## 5. 版本管理规范
- 使用 SemVer 版本号（如 v1.0.0）
- 发布新版本必须更新 VERSION.md
- 每次发布创建对应的 git tag
- commit message 标注版本号

## 6. 文档同步要求
- 修改代码后，相关文档同步更新
- 遵循 SKILL.md 定义的文档驱动开发流程
- 生成文档前必须阅读 SKILL.md 模板

## 7. 环境陷阱 (Quirks)
- **React 19 + Vite**：注意严格模式下的双重渲染
- **Zustand**：状态更新使用圆括号函数 `set(state => ...)`
- **Tailwind CSS 4**：使用 `@import "tailwindcss"` 而非旧版指令
- **TypeScript verbatimModuleSyntax**：类型导入必须使用 `type` 关键字
- **Zustand persist + 跨 store 数据共享**：用 `useReplayStore.getState()` 而非 `useReplayStore()` hook 在 gameStore 中调用，避免循环依赖

## 8. 🔒 录制系统铁律 (Recording System Iron Rules) — v2.1.1 P1 新增

### 8.1 录制状态必须独立于业务 store
> **铁律18**：录制型状态（replayStore）必须独立于 gameStore/business store。
> - 录制状态的更新不应触发游戏重渲染
> - 录制逻辑不污染游戏业务逻辑
> - 跨 store 调用走 `useReplayStore.getState()` 订阅模式，禁止直接 import 内部函数

**反例**：把 `currentReplay` 放进 gameStore，会导致每次 recordMove 触发整个游戏 UI 重渲染

### 8.2 保存方法必须接受外部 overrides
> **铁律19**：录制型 store 的"保存"action（`saveCurrentReplay` / `finalizeReplay`）必须接受可选的 `overrides` 参数（winner / finalState 等），由 UI 层从 gameState 实时计算并传入。
> - store 内部不应假设 winner/finalState 已知
> - 初始化时这些字段是占位值（`null` / 空对象），必须由调用方填充
> - 默认实现：未传 overrides 则保持原值（向后兼容）

**P1.6 教训**：v2.1.1 P1.5 重构时把 `finalizeReplay(winner, finalState)` 拆出独立的 `saveCurrentReplay()`，却忘了把 winner/finalState 填充逻辑带过来。导致 2 个录制文件 `winner=null`、`finalState.players=[]`。校验工具 `tools/validate_replays.py` 用 `[CRITICAL]` 标记此类错误。

### 8.3 V1 单人模式不自动调 checkGameOver
> **铁律20**：V1 单人模式（store.checkGameOver）只在 LAN 模式被显式调用，单人模式不调用。需要在 UI 层（如 GameBoard 胜利弹窗）从 `gameState` 自行推算：
> - `winner`：`gameState.winner?.id`，否则从 HP 推算（>0 的玩家为胜者，全死为平局）
> - `finalState`：映射 `gameState.players` 到 V1Replay finalState schema

**未来扩展**：如果多人模式也要录制，需要在 `executeAiAction` 或类似触发点显式调 `useGameStore.getState().checkGameOver()`。当前单人模式不调是"未触发 winner 计算"的隐性陷阱。