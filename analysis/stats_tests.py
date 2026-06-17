# stats_tests.py — 统计检验模块
# V2.1.0 分析平台
#
# 实现 卡牌游戏2.0原型.md §4.3-§4.5:
# - 双比例 Z 检验 (含 Fisher 精确检验替代)
# - Benjamini-Hochberg FDR 修正
# - Bonferroni 修正
# - Cohen's h 效应量
# - 综合统计报告

import numpy as np
from scipy import stats as scipy_stats
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from analysis.loader import CHARACTER_IDS, CHARACTER_NAMES, char_index, char_name

# ============ 数据结构 ============

@dataclass
class PairTestResult:
    """一对角色的统计检验结果"""
    char_a_idx: int
    char_b_idx: int
    char_a_name: str
    char_b_name: str
    wins_a: int          # A 胜 B 的次数
    total: int            # A vs B 总对局数
    win_rate_a: float     # A 对 B 的胜率
    wilson_lower: float   # Wilson CI 下界
    wilson_upper: float   # Wilson CI 上界
    z_stat: float         # Z 统计量
    p_value: float        # 原始 p 值
    p_adjusted: float     # BH 校正后 q 值
    cohens_h: float       # Cohen's h 效应量
    significant_bonf: bool  # Bonferroni 显著
    significant_bh: bool    # BH-FDR 显著


# ============ 双比例 Z 检验 ============

def two_proportion_z_test(wins_a: int, total: int) -> Tuple[float, float]:
    """双比例 Z 检验

    检验角色 A 对 B 的胜率是否显著偏离 50%

    H0: p = 0.5
    H1: p ≠ 0.5

    Returns:
        (z_stat, p_value)
    """
    if total == 0:
        return 0.0, 1.0

    p_hat = wins_a / total
    p_null = 0.5
    se = np.sqrt(p_null * (1 - p_null) / total)
    z = (p_hat - p_null) / se
    p_value = 2 * (1 - scipy_stats.norm.cdf(abs(z)))
    return z, p_value


def fisher_exact_test(wins_a: int, total: int) -> float:
    """Fisher 精确检验（当 n < 30 或期望频数 < 5 时使用）

    Returns:
        p_value
    """
    if total == 0:
        return 1.0
    wins_b = total - wins_a
    _, p_value = scipy_stats.fisher_exact([[wins_a, wins_b], [total // 2, total // 2]])
    return p_value


# ============ Cohen's h 效应量 ============

def cohens_h(p: float, p_null: float = 0.5) -> float:
    """Cohen's h 效应量

    h = 2 * arcsin(sqrt(p)) - 2 * arcsin(sqrt(p_null))
    """
    return 2 * np.arcsin(np.sqrt(p)) - 2 * np.arcsin(np.sqrt(p_null))


def cohens_h_interpretation(h: float) -> str:
    """Cohen's h 效应量解释"""
    ah = abs(h)
    if ah < 0.2:
        return '可忽略'
    elif ah < 0.5:
        return '小效应'
    elif ah < 0.8:
        return '中效应'
    else:
        return '大效应'


# ============ 多重比较修正 ============

def benjamini_hochberg(p_values: List[float], q: float = 0.05) -> Tuple[np.ndarray, np.ndarray]:
    """Benjamini-Hochberg FDR 修正

    Args:
        p_values: 原始 p 值列表
        q: 目标 FDR (默认 0.05)

    Returns:
        (adjusted_p, rejected) — 校正后 q 值, 是否拒绝 H0
    """
    m = len(p_values)
    if m == 0:
        return np.array([]), np.array([])

    sorted_idx = np.argsort(p_values)
    sorted_p = np.array(p_values)[sorted_idx]

    adjusted = np.zeros(m)
    rejected = np.zeros(m, dtype=bool)

    # BH 过程
    max_k = -1
    for k in range(m):
        adjusted[k] = sorted_p[k] * m / (k + 1)
        if sorted_p[k] <= (k + 1) / m * q:
            max_k = k

    # 限制 q 值 ≤ 1
    adjusted = np.minimum(adjusted, 1.0)

    # 单调性修正
    for k in range(m - 2, -1, -1):
        adjusted[k] = min(adjusted[k], adjusted[k + 1])

    rejected[:max_k + 1] = True

    # 还原顺序
    orig_order = np.argsort(sorted_idx)
    return adjusted[orig_order], rejected[orig_order]


def bonferroni_correct(p_values: List[float], alpha: float = 0.05) -> Tuple[np.ndarray, np.ndarray]:
    """Bonferroni 修正"""
    m = len(p_values)
    if m == 0:
        return np.array([]), np.array([])
    adjusted = np.minimum(np.array(p_values) * m, 1.0)
    rejected = adjusted < alpha
    return adjusted, rejected


# ============ 综合统计 ============

def compute_all_tests(
    wins: np.ndarray,
    totals: np.ndarray,
    wi_lower: np.ndarray,
    wi_upper: np.ndarray,
    alpha: float = 0.05,
    q: float = 0.05,
) -> Dict:
    """对所有角色对执行完整统计检验

    Args:
        wins: (9, 9) 胜场矩阵
        totals: (9, 9) 对局矩阵
        wi_lower: (9, 9) Wilson CI 下界
        wi_upper: (9, 9) Wilson CI 上界
        alpha: 显著性水平
        q: BH FDR 目标值

    Returns:
        {
            pair_tests: [PairTestResult, ...],
            overall_significant_bh: 通过 BH 校正的对数,
            ...
        }
    """
    n = wins.shape[0]
    pair_tests: List[PairTestResult] = []
    raw_p_values: List[float] = []

    char_names_map = {CHARACTER_IDS[i]: CHARACTER_NAMES[CHARACTER_IDS[i]] for i in range(n)}

    for i in range(n):
        for j in range(i + 1, n):
            w = int(wins[i][j])
            t = int(totals[i][j])
            if t == 0:
                continue

            wr = w / t if t > 0 else 0
            z, p = two_proportion_z_test(w, t)
            h = cohens_h(wr)

            raw_p_values.append(p)

            pair_tests.append(PairTestResult(
                char_a_idx=i,
                char_b_idx=j,
                char_a_name=CHARACTER_NAMES[CHARACTER_IDS[i]],
                char_b_name=CHARACTER_NAMES[CHARACTER_IDS[j]],
                wins_a=w,
                total=t,
                win_rate_a=round(wr * 100, 1),
                wilson_lower=round(wi_lower[i][j] * 100, 1),
                wilson_upper=round(wi_upper[i][j] * 100, 1),
                z_stat=round(z, 3),
                p_value=p,
                p_adjusted=0,  # 暂填
                cohens_h=round(h, 3),
                significant_bonf=False,
                significant_bh=False,
            ))

    # 多重比较修正
    if raw_p_values:
        adj_bh, rej_bh = benjamini_hochberg(raw_p_values, q)
        adj_bonf, rej_bonf = bonferroni_correct(raw_p_values, alpha)

        for idx, test in enumerate(pair_tests):
            test.p_adjusted = round(adj_bh[idx], 4)
            test.significant_bh = bool(rej_bh[idx])
            test.significant_bonf = bool(rej_bonf[idx])

    n_significant_bh = sum(1 for t in pair_tests if t.significant_bh)
    n_significant_bonf = sum(1 for t in pair_tests if t.significant_bonf)

    return {
        'pair_tests': pair_tests,
        'n_pairs': len(pair_tests),
        'n_significant_bh': n_significant_bh,
        'n_significant_bonf': n_significant_bonf,
        'alpha': alpha,
        'q_fdr': q,
        'n_comparisons': n * (n - 1) // 2,
    }
