"""
run_all_bo.py — 全 9 角色贝叶斯优化

串行运行 9 角色 × 100 评估 × 54 局 = 48600 局。
输出：data/optimization/all_chars_gpu_{timestamp}.jsonl 和 .summary.json

用法：
  python analysis/run_all_bo.py [--library botorch] [--budget 100] [--dim-8]
  python analysis/run_all_bo.py --library botorch --dim-8 --budget 100
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# 确保能 import 同目录模块
sys.path.insert(0, str(Path(__file__).parent))

from bo_runner import optimize_character


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--library", default="botorch", choices=["skopt", "botorch"])
    p.add_argument("--dim-8", action="store_true", dest="dim_8", default=True,
                   help="使用 8 维搜索空间（默认开启）")
    p.add_argument("--budget", type=int, default=100, help="每角色评估次数")
    p.add_argument("--n-initial", type=int, default=25, help="初始随机采样数")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--early-stop-patience", type=int, default=20,
                   help="连续 N 轮无改善早停")
    p.add_argument("--early-stop-tol", type=float, default=0.005)
    p.add_argument("--output-dir", default="data/optimization",
                   help="输出目录")
    args = p.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    all_summaries = []
    start = time.time()

    for i in range(1, 10):
        char_id = f"char_{i}"
        print(f"\n{'═' * 60}")
        print(f"  [{i}/9] 优化 {char_id}")
        print(f"{'═' * 60}")

        t0 = time.time()
        # 先跑 char_1-8 默认 8D 搜索空间，char_5/7/9 保留更多轮
        result = optimize_character(
            char_id=char_id,
            budget=args.budget,
            n_initial=args.n_initial,
            seed=args.seed + i,
            output_file=str(out_dir / f"bo_{char_id}_{ts}.jsonl"),
            early_stop_patience=args.early_stop_patience,
            early_stop_tol=args.early_stop_tol,
            library=args.library,
            search_space_8d=args.dim_8,
        )
        t1 = time.time()
        print(f"  {char_id} 完成: best_winrate={result['best_winrate']:.4f}  "
              f"evals={result['total_evals']} 早停={result['early_stopped']}  "
              f"耗时={t1 - t0:.1f}s")

        all_summaries.append({
            "char": char_id,
            "best_params": result["best_params"],
            "best_winrate": result["best_winrate"],
            "total_evals": result["total_evals"],
            "early_stopped": result["early_stopped"],
            "total_wallclock_s": result["total_wallclock_s"],
        })

    total_wallclock = time.time() - start

    # 写汇总
    summary_file = out_dir / f"all_chars_{ts}.summary.json"
    with summary_file.open("w", encoding="utf-8") as f:
        json.dump({
            "config": {
                "library": args.library,
                "dim_8": args.dim_8,
                "budget": args.budget,
                "n_initial": args.n_initial,
            },
            "summaries": all_summaries,
            "total_wallclock_s": total_wallclock,
        }, f, ensure_ascii=False, indent=2)

    # 打印汇总表
    print(f"\n{'═' * 60}")
    print("  全 9 角色 BO 汇总")
    print(f"{'═' * 60}")
    print(f"  {'角色':<10} {'最优胜率':>10} {'评估数':>7} {'早停':>5} {'耗时(s)':>8}")
    print(f"  {'─' * 40}")
    for s in all_summaries:
        print(f"  {s['char']:<10} {s['best_winrate']:>10.4f} {s['total_evals']:>7d} "
              f"{'是' if s['early_stopped'] else '否':>5} {s['total_wallclock_s']:>8.1f}")
    print(f"\n  Total: {total_wallclock:.0f}s")
    print(f"  Summary: {summary_file}")

    # 用 report_bo.py 输出文本报告
    try:
        from report_bo import ascii_text_report
        print(ascii_text_report(all_summaries))
    except ImportError:
        pass


if __name__ == "__main__":
    main()
