"""
bo_runner.py — 贝叶斯优化主循环

调用 evaluate_theta() 评估 θ，调用 SkoptOptimizer 选取下一个点。
支持收敛检测（连续 N 轮最优点不变 → 提前停止）。
所有评估点持久化到 JSONL。

CPU 阶段：串行评估
GPU 阶段：可换 bo_runner_gpu.py 用 ProcessPoolExecutor 并行
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import asdict
from pathlib import Path

# 确保能 import 同目录模块
sys.path.insert(0, str(Path(__file__).parent))

from optimizer_interface import (
    BaseOptimizer,
    DEFAULT_SEARCH_SPACE,
    DEFAULT_SEARCH_SPACE_8D,
    SearchSpace,
    negate_winrate,
)
from evaluate_theta import evaluate_theta, ThetaResult


def make_optimizer(
    library: str,
    search_space: list[SearchSpace],
    n_initial: int,
    random_state: int,
) -> BaseOptimizer:
    """工厂方法：选择 BO 库"""
    if library == "skopt":
        from optimizer_skopt import SkoptOptimizer
        return SkoptOptimizer(search_space, n_initial=n_initial, random_state=random_state)
    elif library == "botorch":
        from optimizer_botorch import BoTorchOptimizer
        return BoTorchOptimizer(
            search_space=search_space,
            n_initial=n_initial,
            random_state=random_state,
        )
    else:
        raise ValueError(f"未知 BO 库: {library}（支持 'skopt' / 'botorch'）")


def optimize_character(
    char_id: str,
    budget: int = 50,
    n_initial: int = 20,
    seed: int = 42,
    opponents: list[str] | None = None,
    policies: list[str] | None = None,
    output_file: str | None = None,
    early_stop_patience: int = 15,
    early_stop_tol: float = 0.005,
    library: str = "skopt",
    search_space_8d: bool = False,
) -> dict:
    """优化单角色

    Args:
        char_id: 角色 ID（e.g. "char_9"）
        budget: 总评估次数（含初始）
        n_initial: 初始随机采样数
        seed: 随机种子
        opponents: 对手角色列表（默认 9 个）
        policies: 对手策略池（默认 6 个）
        output_file: 评估历史 JSONL 路径
        early_stop_patience: 连续 N 轮最优点未改善则停止
        early_stop_tol: 改善幅度容差
        library: BO 库名

    Returns:
        dict: {best_params, best_winrate, history, total_evals, early_stopped}
    """
    opponents = opponents or [f"char_{i}" for i in range(1, 10)]
    policies = policies or ["balanced", "aggressive", "conservative",
                            "controller", "burst", "endurance"]
    search_space = DEFAULT_SEARCH_SPACE_8D if search_space_8d else DEFAULT_SEARCH_SPACE

    opt = make_optimizer(library, search_space, n_initial, seed)
    out_path = Path(output_file) if output_file else None
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # 清空旧文件
        if out_path.exists():
            out_path.unlink()

    history: list[dict] = []
    best_y = float("inf")
    best_params: dict | None = None
    no_improve = 0
    early_stopped = False
    start = time.time()

    print(f"[BO] {char_id} | budget={budget} | init={n_initial} | library={library}")
    print(f"[BO] opponents={opponents}")
    print(f"[BO] policies={policies}")
    print(f"[BO] dims={[s.name for s in search_space]}")
    print("")

    for i in range(budget):
        t0 = time.time()
        # 1) 提议下一个 θ
        cand_list = opt.suggest(n_suggestions=1)
        theta = cand_list[0]

        # 2) 评估
        result = evaluate_theta(
            char_id=char_id,
            params=theta,
            opponents=opponents,
            policies=policies,
            seed=seed * 1000 + i,  # 每评估唯一 seed
        )
        y = negate_winrate(result.winrate)
        t1 = time.time()

        # 3) 喂回优化器
        opt.update([(theta, y)])

        # 4) 记录历史
        rec = {
            "iter": i,
            "theta": theta,
            "y": y,
            "winrate": result.winrate,
            "wins": result.wins,
            "draws": result.draws,
            "losses": result.losses,
            "total_matches": result.total_matches,
            "eval_duration_ms": result.duration_ms,
            "wallclock_s": round(t1 - t0, 2),
        }
        history.append(rec)
        if out_path:
            with out_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

        # 5) 更新最优
        if y < best_y - early_stop_tol:
            best_y = y
            best_params = theta
            no_improve = 0
            mark = "★"
        else:
            no_improve += 1
            mark = " "

        if i % 5 == 0 or i == budget - 1 or mark == "★":
            print(f"  [{i:3d}/{budget}] {mark} winrate={result.winrate:.4f}  "
                  f"best={-best_y:.4f}  no_improve={no_improve}/{early_stop_patience}  "
                  f"({rec['wallclock_s']}s)")

        # 6) 早停
        if no_improve >= early_stop_patience and i >= n_initial:
            print(f"  [early stop] 连续 {no_improve} 轮无改善")
            early_stopped = True
            break

    total_wallclock = time.time() - start
    print("")
    print(f"[BO] 完成: {char_id} | best_winrate={-best_y:.4f} | "
          f"early_stopped={early_stopped} | total={total_wallclock:.1f}s")
    print(f"[BO] best_params={best_params}")

    return {
        "char": char_id,
        "best_params": best_params,
        "best_winrate": -best_y,
        "history": history,
        "total_evals": len(history),
        "early_stopped": early_stopped,
        "total_wallclock_s": total_wallclock,
        "library": library,
        "budget": budget,
        "n_initial": n_initial,
    }


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--char", required=True, help="角色 ID（如 char_9）")
    p.add_argument("--budget", type=int, default=50)
    p.add_argument("--n-initial", type=int, default=20)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--opponents", default=None, help="逗号分隔的 9 角色 ID")
    p.add_argument("--policies", default=None, help="逗号分隔的策略池")
    p.add_argument("--output", required=True, help="评估历史 JSONL 路径")
    p.add_argument("--early-stop-patience", type=int, default=15)
    p.add_argument("--early-stop-tol", type=float, default=0.005)
    p.add_argument("--library", default="skopt", choices=["skopt", "botorch"])
    p.add_argument("--dim-8", action="store_true", dest="dim_8", help="使用 8 维搜索空间（GPU 阶段）")
    args = p.parse_args()

    opponents = args.opponents.split(",") if args.opponents else None
    policies = args.policies.split(",") if args.policies else None

    result = optimize_character(
        char_id=args.char,
        budget=args.budget,
        n_initial=args.n_initial,
        seed=args.seed,
        opponents=opponents,
        policies=policies,
        output_file=args.output,
        library=args.library,
        search_space_8d=args.dim_8,
        early_stop_patience=args.early_stop_patience,
        early_stop_tol=args.early_stop_tol,
    )
    # 写 summary JSON
    summary_path = Path(args.output).with_suffix(".summary.json")
    with summary_path.open("w", encoding="utf-8") as f:
        # history 中含 numpy 字段？确保可序列化
        json.dump({
            "char": result["char"],
            "best_params": result["best_params"],
            "best_winrate": result["best_winrate"],
            "total_evals": result["total_evals"],
            "early_stopped": result["early_stopped"],
            "total_wallclock_s": result["total_wallclock_s"],
            "library": result["library"],
            "budget": result["budget"],
        }, f, ensure_ascii=False, indent=2)
    print(f"Summary 写入: {summary_path}")


if __name__ == "__main__":
    main()
