"""
optimizer_skopt.py — scikit-optimize (skopt) 的 BO 实现

CPU 阶段默认实现。GPU 阶段可换 BoTorch / Optuna-TPESampler。

接口约定见 optimizer_interface.py。
"""

from __future__ import annotations

import numpy as np
from skopt import gp_minimize
from skopt.space import Real
from skopt.utils import use_named_args
from typing import Any

from optimizer_interface import (
    BaseOptimizer,
    SearchSpace,
    params_to_array,
    array_to_params,
    negate_winrate,
)


class SkoptOptimizer(BaseOptimizer):
    """skopt.gp_minimize 的薄包装"""

    def __init__(
        self,
        search_space: list[SearchSpace],
        n_initial: int = 20,
        acq_func: str = "EI",      # Expected Improvement
        acq_xi: float = 0.01,      # EI 的 exploration 参数
        noise: float = 0.0,        # 观测噪声（设为 0 表示精确观测）
        random_state: int = 42,
    ):
        super().__init__(search_space, n_initial)
        self.acq_func = acq_func
        self.acq_xi = acq_xi
        self.noise = noise
        self.random_state = random_state

        # 转换 search_space 为 skopt 格式
        self._skopt_space = [
            Real(ss.lower, ss.upper, name=ss.name)
            for ss in search_space
        ]

        # 内部存储
        self._X: list[list[float]] = []   # 已评估 θ 向量
        self._y: list[float] = []        # 已评估目标值（-winrate）
        self._init_phase: bool = True    # 初始采样阶段
        self._n_init_sampled: int = 0    # 已采样的初始点
        self._skopt_result: Any = None   # 内部 skopt 结果

    def suggest(self, n_suggestions: int = 1) -> list[dict[str, float]]:
        """返回 n_suggestions 个候选 θ"""
        if n_suggestions != 1:
            raise NotImplementedError("SkoptOptimizer 当前只支持 n_suggestions=1")

        # 初始阶段：随机采样
        if self._init_phase and self._n_init_sampled < self.n_initial:
            self._n_init_sampled += 1
            x = self._random_sample()
            return [array_to_params(x, self.search_space)]

        # BO 阶段：调用 skopt
        self._init_phase = False
        if not self._X:
            # 没有历史，强制随机
            x = self._random_sample()
            return [array_to_params(x, self.search_space)]

        # 用已有数据构造 gp_minimize 调用并取下一个点
        # 注意：skopt 的 gp_minimize 是 batch 接口，需要重建 optimizer
        n_calls = len(self._X)  # 当前已评估数
        self._skopt_result = gp_minimize(
            func=lambda x: 0.0,    # dummy，不会被调用
            dimensions=self._skopt_space,
            n_calls=n_calls,
            n_initial_points=0,    # 我们手动管理初始点
            x0=self._X,            # 已有评估点
            y0=self._y,
            acq_func=self.acq_func,
            xi=self.acq_xi,
            noise=self.noise,
            random_state=self.random_state,
            verbose=False,
        )
        # 下一个建议点
        next_x = list(self._skopt_result.x_iters[-1]) if self._skopt_result.x_iters else self._random_sample()
        return [array_to_params(next_x, self.search_space)]

    def update(self, evaluations: list[tuple[dict[str, float], float]]) -> None:
        """更新观测"""
        for params, y in evaluations:
            self._X.append(params_to_array(params, self.search_space))
            self._y.append(float(y))
            self.evaluations.append({"params": params, "y": float(y)})

    def _random_sample(self) -> list[float]:
        """随机初始采样（LHS 风格）"""
        rng = np.random.RandomState(self.random_state + self._n_init_sampled)
        return [rng.uniform(ss.lower, ss.upper) for ss in self.search_space]

    def state_dict(self) -> dict[str, Any]:
        return {
            "X": self._X,
            "y": self._y,
            "n_initial": self.n_initial,
            "n_init_sampled": self._n_init_sampled,
            "init_phase": self._init_phase,
            "acq_func": self.acq_func,
            "acq_xi": self.acq_xi,
            "noise": self.noise,
            "random_state": self.random_state,
            "evaluations": self.evaluations,
        }

    def load_state_dict(self, state: dict[str, Any]) -> None:
        self._X = state["X"]
        self._y = state["y"]
        self.n_initial = state["n_initial"]
        self._n_init_sampled = state["n_init_sampled"]
        self._init_phase = state["init_phase"]
        self.acq_func = state["acq_func"]
        self.acq_xi = state["acq_xi"]
        self.noise = state["noise"]
        self.random_state = state["random_state"]
        self.evaluations = state["evaluations"]
