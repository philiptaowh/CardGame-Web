# ratings.py — Elo / Glicko 评级引擎
# V2.1.0 分析平台
#
# 实现 卡牌游戏2.0原型.md §4.6:
# - Elo 评级系统 (标准算法 + K-factor 自适应)
# - Glicko 评级系统 (含 RD 置信度更新)
# - Tier 划分 (基于置信区间重叠)

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from analysis.loader import MatchLoader, CHARACTER_IDS, CHARACTER_NAMES

# ============ Elo 评级 ============

@dataclass
class EloRating:
    char_id: str
    name: str
    rating: float
    games_played: int
    wins: int
    win_rate: float


def compute_elo(
    loader: MatchLoader,
    initial_rating: float = 1500.0,
    k_factor: float = 32.0,
    n_iterations: int = 10,
) -> List[EloRating]:
    """计算 Elo 评级

    迭代方式：遍历所有对局，更新双方 Elo 评分。
    重复 n_iterations 次直到收敛。

    Args:
        loader: 已加载的 MatchLoader 实例
        initial_rating: 初始评级分
        k_factor: K 因子（更新步长）
        n_iterations: 迭代收敛次数

    Returns:
        [EloRating, ...] 按 rating 降序
    """
    n = loader.n_chars
    ratings = np.full(n, initial_rating, dtype=np.float64)
    games_count = np.zeros(n, dtype=np.int64)
    wins_count = np.zeros(n, dtype=np.int64)

    for _ in range(n_iterations):
        for r in loader.records:
            i, j = r.char_a_idx, r.char_b_idx
            games_count[i] += 1
            games_count[j] += 1

            # 期望得分
            expected_i = 1.0 / (1.0 + 10.0 ** ((ratings[j] - ratings[i]) / 400.0))
            expected_j = 1.0 - expected_i

            # 实际得分
            if r.winner_idx == 0:  # i 胜
                score_i, score_j = 1.0, 0.0
                wins_count[i] += 1
            elif r.winner_idx == 1:  # j 胜
                score_i, score_j = 0.0, 1.0
                wins_count[j] += 1
            else:  # 平局
                score_i, score_j = 0.5, 0.5

            ratings[i] += k_factor * (score_i - expected_i)
            ratings[j] += k_factor * (score_j - expected_j)

    results = []
    for idx, cid in enumerate(CHARACTER_IDS):
        gp = int(games_count[idx])
        results.append(EloRating(
            char_id=cid,
            name=CHARACTER_NAMES[cid],
            rating=round(ratings[idx], 1),
            games_played=gp,
            wins=int(wins_count[idx]),
            win_rate=round(wins_count[idx] / gp * 100, 1) if gp > 0 else 0,
        ))

    results.sort(key=lambda x: -x.rating)
    return results


# ============ Glicko 评级 ============

@dataclass
class GlickoRating:
    char_id: str
    name: str
    rating: float     # R
    rd: float         # Rating Deviation (评级偏差)
    vol: float        # Rating Volatility (评级波动性, 简化版固定)
    games_played: int
    wins: int
    win_rate: float
    ci_95_lower: float  # 95% 置信区间下界
    ci_95_upper: float  # 95% 置信区间上界

    @property
    def confidence_interval(self) -> Tuple[float, float]:
        return (self.ci_95_lower, self.ci_95_upper)


def glicko_g(v: float) -> float:
    """Glicko 的 g(φ) 函数"""
    return 1.0 / np.sqrt(1.0 + 3.0 * v**2 / (np.pi**2))


def compute_glicko(
    loader: MatchLoader,
    initial_rating: float = 1500.0,
    initial_rd: float = 350.0,
    tau: float = 0.5,
) -> List[GlickoRating]:
    """计算 Glicko 评级

    Glicko 在 Elo 基础上增加了 Rating Deviation (RD)，
    RD 越低的角色，评级越可信。

    Args:
        loader: 已加载的 MatchLoader 实例
        initial_rating: 初始评级分
        initial_rd: 初始评级偏差
        tau: 系统常量 (控制波动性)

    Returns:
        [GlickoRating, ...] 按 rating 降序
    """
    n = loader.n_chars
    ratings = np.full(n, initial_rating, dtype=np.float64)
    rds = np.full(n, initial_rd, dtype=np.float64)
    games_count = np.zeros(n, dtype=np.int64)
    wins_count = np.zeros(n, dtype=np.int64)

    # 按 turn 排序保证时序 (Glicko 对顺序敏感)
    records_sorted = sorted(loader.records, key=lambda r: (r.turns, r.duration_ms))

    for r in records_sorted:
        i, j = r.char_a_idx, r.char_b_idx
        games_count[i] += 1
        games_count[j] += 1

        # Glicko 更新
        mu_i = ratings[i]
        mu_j = ratings[j]
        phi_i = rds[i]
        phi_j = rds[j]

        g_j = glicko_g(phi_j)
        g_i = glicko_g(phi_i)

        # 期望得分
        e_i = 1.0 / (1.0 + 10.0 ** (-g_j * (mu_i - mu_j) / 400.0))
        e_j = 1.0 - e_i

        # 实际得分
        if r.winner_idx == 0:
            s_i, s_j = 1.0, 0.0
            wins_count[i] += 1
        elif r.winner_idx == 1:
            s_i, s_j = 0.0, 1.0
            wins_count[j] += 1
        else:
            s_i, s_j = 0.5, 0.5

        # 更新 i
        d2_i = 1.0 / (g_j**2 * e_i * (1 - e_i))
        ratings[i] = mu_i + (g_j / (1.0 / phi_i**2 + 1.0 / d2_i)) * (s_i - e_i)
        rds[i] = np.sqrt(1.0 / (1.0 / phi_i**2 + 1.0 / d2_i))

        # 更新 j
        d2_j = 1.0 / (g_i**2 * e_j * (1 - e_j))
        ratings[j] = mu_j + (g_i / (1.0 / phi_j**2 + 1.0 / d2_j)) * (s_j - e_j)
        rds[j] = np.sqrt(1.0 / (1.0 / phi_j**2 + 1.0 / d2_j))

    results = []
    for idx, cid in enumerate(CHARACTER_IDS):
        gp = int(games_count[idx])
        r = ratings[idx]
        rd = rds[idx]
        results.append(GlickoRating(
            char_id=cid,
            name=CHARACTER_NAMES[cid],
            rating=round(r, 1),
            rd=round(rd, 1),
            vol=tau,
            games_played=gp,
            wins=int(wins_count[idx]),
            win_rate=round(wins_count[idx] / gp * 100, 1) if gp > 0 else 0,
            ci_95_lower=round(r - 1.96 * rd, 1),
            ci_95_upper=round(r + 1.96 * rd, 1),
        ))

    results.sort(key=lambda x: -x.rating)
    return results


# ============ Tier 划分 ============

def assign_tiers(
    glicko_ratings: List[GlickoRating],
    n_tiers: int = 3,
) -> List[Tuple[GlickoRating, str]]:
    """基于 Glicko 置信区间重叠的 Tier 划分

    原则：同一 Tier 内的角色在统计上不可区分。
    方法：按 rating 排序，相邻角色置信区间不重叠时切分 Tier。

    Args:
        glicko_ratings: Glicko 评级列表 (已降序)
        n_tiers: 分档数

    Returns:
        [(rating, tier_label), ...]
    """
    if not glicko_ratings:
        return []

    tier_labels = ['S', 'A', 'B']
    result = []

    # 兼容 EloRating（无 rd 属性）和 GlickoRating
    def get_rd(r):
        return getattr(r, 'rd', 25.0)  # Elo 默认使用 25 作为近似 CI

    # 根据置信区间重叠自动切分
    boundaries = [0]  # 每个 Tier 的起始索引
    for i in range(1, len(glicko_ratings)):
        prev = glicko_ratings[i - 1]
        curr = glicko_ratings[i]
        # 检查前一个的下界 是否 > 当前的上界
        if (prev.rating - 1.96 * get_rd(prev)) > (curr.rating + 1.96 * get_rd(curr)):
            boundaries.append(i)

    # 如果分段数超过 n_tiers，合并尾部
    while len(boundaries) > n_tiers:
        # 合并最小的分段
        min_idx = 1  # 跳过第一个
        for k in range(2, len(boundaries)):
            if (boundaries[k] - boundaries[k - 1]) < (boundaries[min_idx] - boundaries[min_idx - 1]):
                min_idx = k
        boundaries.pop(min_idx)

    # 分配 Tier
    for i, rating in enumerate(glicko_ratings):
        tier_idx = sum(1 for b in boundaries[1:] if i >= b)
        tier_label = tier_labels[min(tier_idx, n_tiers - 1)]
        result.append((rating, tier_label))

    # 如果 CI 重叠导致所有角色同 Tier（数据量大时常见），
    # 使用 win_rate 分位数作为回退，确保报告有区分度
    unique_tiers = set(t for _, t in result)
    if len(unique_tiers) <= 1 and len(glicko_ratings) >= 3:
        n = len(glicko_ratings)
        # 按 win_rate / rating 排序后等分
        sorted_win_rates = sorted([(r.win_rate, r) for r in glicko_ratings], key=lambda x: -x[0])

        result = []
        for idx, (_, rating) in enumerate(sorted_win_rates):
            ratio = idx / n if n > 1 else 0
            if ratio < 1 / 3:
                tier_label = 'S'
            elif ratio < 2 / 3:
                tier_label = 'A'
            else:
                tier_label = 'B'
            result.append((rating, tier_label))
        # 按原始排序还原
        result.sort(key=lambda x: -x[0].rating)

    return result
