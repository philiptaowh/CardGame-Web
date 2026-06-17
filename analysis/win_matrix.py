# win_matrix.py — 胜率矩阵与置信区间
# V2.1.0 分析平台
#
# 实现 卡牌游戏2.0原型.md §4.1-§4.2:
# - Wilson 置信区间 (公式 4.1)
# - Bootstrap 置信区间 (CPU 版本, GPU 加速版在 gpu_accel.py)
# - Power Analysis 样本量确定

import numpy as np
from scipy import stats as scipy_stats
from typing import Tuple, Optional, Callable
from analysis.loader import MatchLoader, CHARACTER_IDS, CHARACTER_NAMES, char_index

# ============ Wilson 置信区间 ============

def wilson_ci(wins: int, total: int, alpha: float = 0.05) -> Tuple[float, float, float]:
    """Wilson 置信区间

    Args:
        wins: 胜场数
        total: 总对局数
        alpha: 显著性水平 (默认 0.05 → 95% CI)

    Returns:
        (rate, lower, upper) — 胜率、下界、上界
    """
    if total == 0:
        return 0.0, 0.0, 0.0

    p = wins / total
    z = scipy_stats.norm.ppf(1 - alpha / 2)

    denominator = 1 + z**2 / total
    center = (p + z**2 / (2 * total)) / denominator
    margin = z / denominator * np.sqrt(
        (p * (1 - p) / total) + (z**2 / (4 * total**2))
    )

    lower = max(0.0, center - margin)
    upper = min(1.0, center + margin)

    return p, lower, upper


def wilson_ci_matrix(wins: np.ndarray, totals: np.ndarray, alpha: float = 0.05
                     ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """批量计算胜率矩阵的 Wilson 置信区间

    Args:
        wins: (9, 9) 胜场矩阵
        totals: (9, 9) 总对局矩阵
        alpha: 显著性水平

    Returns:
        (rates, lowers, uppers) — 每个形状 (9, 9)
    """
    n = wins.shape[0]
    rates = np.zeros((n, n))
    lowers = np.zeros((n, n))
    uppers = np.zeros((n, n))

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            rates[i][j], lowers[i][j], uppers[i][j] = wilson_ci(
                int(wins[i][j]), int(totals[i][j]), alpha
            )

    return rates, lowers, uppers


# ============ Bootstrap 置信区间 (CPU) ============

def bootstrap_ci_cpu(
    wins: np.ndarray,
    totals: np.ndarray,
    char_pairs: np.ndarray,
    match_winners: np.ndarray,
    n_bootstrap: int = 10000,
    alpha: float = 0.05,
    progress_callback: Optional[Callable] = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Bootstrap 重采样计算胜率置信区间 (CPU 版本)

    对原始对局数据有放回重采样 B 次，每次计算胜率矩阵，
    从 B 个样本中取百分位区间。

    Args:
        wins: 原始胜场矩阵 (9, 9)
        totals: 原始对局矩阵 (9, 9)
        char_pairs: (N, 2) 每局的角色对
        match_winners: (N,) 每局的胜者 (0/1/-1)
        n_bootstrap: 重采样次数
        alpha: 显著性水平
        progress_callback: 进度回调

    Returns:
        (rates, ci_lower, ci_upper) — Bootstrap 估计的胜率和 CI
    """
    n = wins.shape[0]
    n_games = len(match_winners)

    # 存储 B 次重采样的胜率矩阵
    bootstrap_rates = np.zeros((n_bootstrap, n, n))

    for b in range(n_bootstrap):
        # 有放回重采样
        indices = np.random.randint(0, n_games, size=n_games)
        sample_pairs = char_pairs[indices]
        sample_winners = match_winners[indices]

        # 计算本次重采样的胜率矩阵
        b_wins = np.zeros((n, n), dtype=np.int64)
        b_totals = np.zeros((n, n), dtype=np.int64)

        for k in range(n_games):
            i, j = int(sample_pairs[k][0]), int(sample_pairs[k][1])
            w = int(sample_winners[k])
            b_totals[i][j] += 1
            b_totals[j][i] += 1
            if w == 0:
                b_wins[i][j] += 1
            elif w == 1:
                b_wins[j][i] += 1

        # 计算胜率
        for i in range(n):
            for j in range(n):
                if i == j or b_totals[i][j] == 0:
                    continue
                bootstrap_rates[b][i][j] = b_wins[i][j] / b_totals[i][j]

        if progress_callback:
            progress_callback(b + 1, n_bootstrap)

    # 计算百分位置信区间
    ci_lower = np.zeros((n, n))
    ci_upper = np.zeros((n, n))
    rates = np.zeros((n, n))

    for i in range(n):
        for j in range(n):
            if i == j or totals[i][j] == 0:
                continue
            values = bootstrap_rates[:, i, j]
            rates[i][j] = wins[i][j] / totals[i][j]
            ci_lower[i][j] = np.percentile(values, 100 * alpha / 2)
            ci_upper[i][j] = np.percentile(values, 100 * (1 - alpha / 2))

    return rates, ci_lower, ci_upper


# ============ 总体胜率 ============

def overall_win_rates(wins: np.ndarray, totals: np.ndarray, alpha: float = 0.05
                      ) -> list:
    """计算每个角色的总体胜率（排除了平局）

    Returns:
        List of {char_id, name, wins, total, win_rate, ci_lower, ci_upper}
    """
    results = []
    for i, cid in enumerate(CHARACTER_IDS):
        w = int(wins[i].sum())
        t = int(totals[i].sum())
        if t == 0:
            continue
        rate, lo, hi = wilson_ci(w, t, alpha)
        results.append({
            'char_id': cid,
            'name': CHARACTER_NAMES[cid],
            'wins': w,
            'total': t + int(wins[:, i].sum()),  # 总对局包括对手视角
            'win_rate': round(rate * 100, 1),
            'ci_lower': round(lo * 100, 1),
            'ci_upper': round(hi * 100, 1),
        })
    results.sort(key=lambda x: -x['win_rate'])
    return results


# ============ Power Analysis ============

def power_analysis(
    d: float,
    alpha: float = 0.05,
    power: float = 0.80,
) -> int:
    """计算最小所需样本量（每组对局数）

    双比例 Z 检验，给定最小可检测效应量 d

    Args:
        d: 最小可检测胜率差异 (如 0.05 = 5%)
        alpha: 显著性水平
        power: 统计功效

    Returns:
        每组所需最小对局数 n
    """
    z_alpha = scipy_stats.norm.ppf(1 - alpha / 2)
    z_beta = scipy_stats.norm.ppf(power)
    p_bar = 0.5  # 最保守假设
    n = ((z_alpha + z_beta)**2 * 2 * p_bar * (1 - p_bar)) / (d**2)
    return int(np.ceil(n))


def power_table() -> list:
    """生成 Power Analysis 常用值表"""
    results = []
    for d in [0.02, 0.05, 0.10, 0.15, 0.20, 0.30]:
        n = power_analysis(d)
        results.append({
            'effect_size': d,
            'effect_label': f'{int(d*100)}%差异',
            'example': f'{50+d*50:.1f}% vs {50-d*50:.1f}%',
            'n_required': n,
        })
    return results
