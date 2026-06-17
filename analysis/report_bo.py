"""
report_bo.py — BO 结果报告

从 JSONL 评估历史 + summary 解析，输出：
- 每个角色的最优 θ
- 收敛曲线（matplotlib，可选）
- 与默认 θ（balanced）的对比
- ASCII 文本表（无 matplotlib 也能看）

用法：
  python analysis/report_bo.py --input data/optimization/all-chars.jsonl.summary.json
  python analysis/report_bo.py --history data/optimization/char_9.jsonl --plot
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def load_summary(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_history(path: Path) -> list[dict[str, Any]]:
    records = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def ascii_text_report(summaries: list[dict]) -> str:
    out = []
    out.append("══════════════════════════════════════════════════════════════════")
    out.append("  V2.1.1 Phase 2 — 贝叶斯优化结果汇总")
    out.append("══════════════════════════════════════════════════════════════════\n")

    out.append(f"  {'角色':<8} {'最优胜率':>10} {'评估数':>6} {'早停':>5} {'耗时(s)':>8}  {'best θ 摘要'}")
    out.append("  " + "─" * 90)
    for s in summaries:
        bp = s.get("best_params", {}) or {}
        theta_summary = (
            f"prio={bp.get('priority', 0):.2f} "
            f"hp_d={bp.get('hp_danger', 0):.2f} "
            f"aggro={bp.get('aggro', 0):.2f} "
            f"mw={bp.get('mark_weight', 0):.2f} "
            f"st={bp.get('special_threshold', 0):.2f}"
        )
        out.append(
            f"  {s.get('char', '?'):<8} "
            f"{s.get('best_winrate', 0):>10.4f} "
            f"{s.get('total_evals', 0):>6d} "
            f"{'是' if s.get('early_stopped') else '否':>5} "
            f"{s.get('total_wallclock_s', 0):>8.1f}  "
            f"{theta_summary}"
        )
    out.append("")
    out.append("  字段: prio=priority, hp_d=hp_danger, aggro=aggro, mw=mark_weight, st=special_threshold")
    out.append("  默认 θ (balanced):  prio=0.5  hp_d=0.35  aggro=0.5  mw=1.0  st=0.5  → 期望胜率 ~0.5")
    out.append("")
    return "\n".join(out)


def plot_convergence(history: list[dict], output_path: Path, char: str) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("[plot] matplotlib 不可用，跳过绘图")
        return

    iters = [r["iter"] for r in history]
    winrates = [r["winrate"] for r in history]
    best_so_far = []
    cur = 0
    for wr in winrates:
        if wr > cur:
            cur = wr
        best_so_far.append(cur)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.scatter(iters, winrates, c="lightgray", s=20, label="观测点")
    ax.plot(iters, best_so_far, c="red", linewidth=2, label="best-so-far")
    ax.axhline(0.5, color="blue", linestyle="--", alpha=0.5, label="随机基线 (0.5)")
    ax.set_xlabel("BO iteration")
    ax.set_ylabel("胜率 (winrate)")
    ax.set_title(f"BO 收敛曲线 — {char}")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_path, dpi=100)
    print(f"[plot] 收敛曲线保存到 {output_path}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True,
                   help="summary.json 路径（多个用逗号分隔）")
    p.add_argument("--history", default=None,
                   help="单次评估的 history JSONL（用于绘图）")
    p.add_argument("--plot", action="store_true", help="是否生成收敛曲线图")
    p.add_argument("--plot-output", default=None, help="图片输出路径")
    args = p.parse_args()

    # 加载所有 summary
    summary_files = [Path(p) for p in args.input.split(",")]
    summaries = [load_summary(p) for p in summary_files if p.exists()]
    if not summaries:
        print(f"错误: 没找到任何 summary 文件: {args.input}")
        sys.exit(1)

    # 文本报告
    print(ascii_text_report(summaries))

    # 可选绘图
    if args.plot and args.history:
        hist_path = Path(args.history)
        if hist_path.exists():
            char = summaries[0].get("char", "unknown")
            plot_path = Path(args.plot_output) if args.plot_output else hist_path.with_suffix(".png")
            history = load_history(hist_path)
            plot_convergence(history, plot_path, char)


if __name__ == "__main__":
    main()
