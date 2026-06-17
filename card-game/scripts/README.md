# scripts/ — 启动与回放脚本

V2 仿真对局的"启动单局"和"回放"两个工具脚本。

## 文件清单

| 用途 | Node.js（推荐，跨平台） | Bash / Git Bash（备用） |
|------|------------------------|--------------------------|
| 启动平衡自打单局 | [`run-balance-mirror.cjs`](./run-balance-mirror.cjs) | [`run-balance-mirror.sh`](./run-balance-mirror.sh) |
| 回放对局 | [`replay-match.cjs`](./replay-match.cjs) | [`replay-match.sh`](./replay-match.sh) |

## 为什么首选 `.cjs`？

- **跨平台**：在 Windows PowerShell、Git Bash、WSL、Linux、macOS 上**行为一致**
- **零编码坑**：纯 Node.js 进程，无 shell 与 node 之间的字符串/编码边界问题
- **无依赖**：只需要 `node` 在 PATH 里
- **历史教训**：2026-06-08 曾尝试 `.ps1` 方案，3 次连续失败（PS 5.x 向 node 传字符串时的引号/编码处理），按 `docs/5_AGENT_RULES.md §3 重试熔断原则` 中止，回归 Node.js

`.sh` 版本保留给习惯 Git Bash / WSL 的用户，**输出与 .cjs 完全一致**。

## 启动单局

跑 1 局 `char_1 vs char_1`（平衡自打，策略=balanced，recordMoves=true）。

```bash
# Node.js（推荐，跨平台）
node scripts/run-balance-mirror.cjs                          # 随机种子
node scripts/run-balance-mirror.cjs 42                       # 指定种子（可复现）
node scripts/run-balance-mirror.cjs 42 data/raw/test.jsonl   # 自定义输出路径

# Bash（Git Bash / WSL 备用）
./scripts/run-balance-mirror.sh
./scripts/run-balance-mirror.sh 42
./scripts/run-balance-mirror.sh 42 ./data/raw/test.jsonl
```

输出文件默认路径：`data/raw/manual-review/balance-mirror_<时间戳>_seed<seed>.jsonl`

## 回放对局

```bash
# Node.js（推荐，跨平台）
node scripts/replay-match.cjs <file>                  # 回放第 0 局
node scripts/replay-match.cjs <file> --index N        # 回放第 N 局（0 开始）
node scripts/replay-match.cjs <file> --last           # 回放最后一局

# Bash（Git Bash / WSL 备用）
./scripts/replay-match.sh <file>
./scripts/replay-match.sh <file> --index N
./scripts/replay-match.sh <file> --last
```

输出格式遵循 `docs/卡牌游戏2.0原型.md §3.4` 规范（回合标题 / 换牌 / 能量放置 / 行动 / 印记结算 / 游戏结束）。

## 依赖

- Node.js（已配置在 PATH）
- `card-game/dist-engine/simulator/`（已编译）。如改过 `src/`，先跑：
  ```bash
  cd card-game
  npx tsc -p tsconfig.simulator.json
  ```

## 已知问题（详见 `docs/0_TASKLIST.md` §遗留问题）

- **P0**：RuleBasedAI 死循环倾向（`use_special_card_c0` 占比异常）
- **P1**：连击互打 23 回合可能判平局（双方 HP=0）
- **P2**：Replayer 自对自渲染异常
