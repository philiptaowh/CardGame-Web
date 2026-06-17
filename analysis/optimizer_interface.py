"""
optimizer_interface.py — 贝叶斯优化抽象接口

定义 BaseOptimizer 抽象类，让 skopt / Optuna 实现可互换。
CPU 阶段用 skopt；GPU 阶段可换 BoTorch / Optuna with GPU sampler。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class SearchSpace:
    """BO 搜索空间定义

    dim_type:
      - continuous: 实数范围 [lower, upper]
      - integer:    整数范围 [lower, upper]
      - categorical: 离散枚举（categories 字段必填）
      - simplex:    单纯形约束（Σ=1），通过 softmax 参数化（自动处理）
    """
    name: str
    lower: float
    upper: float
    dim_type: str = "continuous"  # "continuous" | "integer" | "categorical" | "simplex"
    categories: list[str] | None = None
    n_categories: int = 0  # for categorical


# v2.1.1 CPU 阶段默认搜索空间（5 维）
DEFAULT_SEARCH_SPACE_5D: list[SearchSpace] = [
    SearchSpace("priority",          0.0, 1.0),
    SearchSpace("hp_danger",         0.2, 0.5),
    SearchSpace("aggro",             0.0, 1.0),
    SearchSpace("mark_weight",       0.0, 2.0),
    SearchSpace("special_threshold", 0.0, 1.0),
]

# v2.1.1 GPU 阶段默认搜索空间（8 维）
# wild 是 categorical，skill_pref 是 4 维独立连续（评估时归一化），noise 是 continuous
DEFAULT_SEARCH_SPACE_8D: list[SearchSpace] = [
    SearchSpace("priority",          0.0, 1.0),
    SearchSpace("hp_danger",         0.2, 0.5),
    SearchSpace("aggro",             0.0, 1.0),
    SearchSpace("mark_weight",       0.0, 2.0),
    SearchSpace("special_threshold", 0.0, 1.0),
    SearchSpace("wild",              0.0, 1.0,
                dim_type="categorical",
                categories=["keep", "place", "bal"],
                n_categories=3),
    SearchSpace("skill_pref_0",      0.0, 1.0),  # 评估时归一化
    SearchSpace("skill_pref_1",      0.0, 1.0),
    SearchSpace("skill_pref_2",      0.0, 1.0),
    SearchSpace("skill_pref_3",      0.0, 1.0),
    SearchSpace("noise",             0.0, 0.2),
]


def continuous_dims(search_space: list[SearchSpace]) -> list[int]:
    """返回连续 + 整数维度的索引（不含 categorical 和 simplex）"""
    return [i for i, ss in enumerate(search_space) if ss.dim_type in ("continuous", "integer")]


def categorical_dims(search_space: list[SearchSpace]) -> list[int]:
    """返回 categorical 维度的索引"""
    return [i for i, ss in enumerate(search_space) if ss.dim_type == "categorical"]


def simplex_dims(search_space: list[SearchSpace]) -> list[int]:
    """返回 simplex 维度的索引"""
    return [i for i, ss in enumerate(search_space) if ss.dim_type == "simplex"]


# 向后兼容旧名
DEFAULT_SEARCH_SPACE = DEFAULT_SEARCH_SPACE_5D


class BaseOptimizer(ABC):
    """贝叶斯优化器抽象基类

    约定：
    - minimize() 接口用于"胜率"因为某些 BO 实现不直接支持 maximize
      → 实际把目标转成 -winrate 调用 minimize
    - 观测值 y 越低越好（y = -winrate，所以 y 越小 winrate 越高）
    """

    def __init__(self, search_space: list[SearchSpace], n_initial: int = 20):
        self.search_space = search_space
        self.n_initial = n_initial
        self.evaluations: list[dict[str, Any]] = []  # 历史所有评估
        self._best: dict[str, Any] | None = None

    @abstractmethod
    def suggest(self, n_suggestions: int = 1) -> list[dict[str, float]]:
        """返回 n_suggestions 个候选 θ 字典

        前 n_initial 次调用应返回 LHS/随机初始点（不调用 surrogate）。
        之后调用应基于 surrogate 优化采集函数。
        """
        pass

    @abstractmethod
    def update(self, evaluations: list[tuple[dict[str, float], float]]) -> None:
        """把评估结果 (θ, y) 喂回优化器

        y 越低越好（即 y = -winrate）。
        """
        pass

    def best(self) -> tuple[dict[str, float], float]:
        """返回历史中 (θ, best_y)"""
        if not self.evaluations:
            raise ValueError("尚无评估数据")
        best_ev = min(self.evaluations, key=lambda e: e["y"])
        return best_ev["params"], best_ev["y"]

    def best_winrate(self) -> float:
        """最佳胜率（max）"""
        _, y = self.best()
        return -y

    @abstractmethod
    def state_dict(self) -> dict[str, Any]:
        """导出可序列化的状态（用于持久化）"""
        pass

    @abstractmethod
    def load_state_dict(self, state: dict[str, Any]) -> None:
        """从状态恢复"""
        pass


def params_to_array(params: dict[str, float], search_space: list[SearchSpace]) -> list[float]:
    """θ 字典 → 向量（按 search_space 顺序）"""
    return [float(params[ss.name]) for ss in search_space]


def array_to_params(arr: list[float], search_space: list[SearchSpace]) -> dict[str, float]:
    """向量 → θ 字典"""
    return {ss.name: float(v) for ss, v in zip(search_space, arr)}


def negate_winrate(winrate: float) -> float:
    """胜率 → BO 目标（minimize）"""
    return -winrate
