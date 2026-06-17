#!/usr/bin/env bash
# replay-match.sh — 对局回放脚本
#
# 用途：包装 dist-engine/simulator/cli.js 的 replay 子命令
#       把 JSONL 文件中的某一局以人类可读文本形式输出
#
# 用法：
#   ./scripts/replay-match.sh <jsonl-file>                   # 回放第 0 局（默认）
#   ./scripts/replay-match.sh <jsonl-file> --index N         # 回放第 N 局（从 0 开始）
#   ./scripts/replay-match.sh <jsonl-file> --last            # 回放最后一局
#   ./scripts/replay-match.sh <jsonl-file> --index N | less  # 配合分页器
#
# 依赖：dist-engine/simulator/cli.js（已编译）

set -euo pipefail

# 切到 card-game 根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARD_GAME_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${CARD_GAME_ROOT}"

# 参数校验
if [ $# -lt 1 ]; then
  echo "用法: $0 <jsonl-file> [--index N | --last]"
  echo ""
  echo "示例:"
  echo "  $0 data/raw/manual-review/2026-06-08_sample-10.jsonl --index 0"
  echo "  $0 data/raw/manual-review/2026-06-08_sample-10.jsonl --last"
  echo "  $0 data/raw/manual-review/2026-06-08_sample-10.jsonl | less"
  exit 1
fi

# 校验文件存在
if [ ! -f "$1" ]; then
  echo "错误: 文件不存在: $1" >&2
  exit 1
fi

# 透传所有参数给 CLI
node dist-engine/simulator/cli.js replay "$@"
