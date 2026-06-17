"""
optimizer_botorch.py — BoTorch (PyTorch + GPU) 的 BO 实现

GPU 阶段主实现。CPU 阶段用 optimizer_skopt.py。

支持的搜索空间（来自 optimizer_interface.py）：
  - continuous: 实数范围
  - categorical: 离散枚举（用 one-hot 编码送 GP）
  - simplex: 单纯形约束（用 softmax 参数化后送 GP）

GP: SingleTaskGP + Matern 5/2 kernel
Acquisition: qExpectedImprovement (q=1)
"""

from __future__ import annotations

import math
import warnings
import numpy as np
import torch
from typing import Any

from botorch import fit_gpytorch_mll
from botorch.acquisition import qLogExpectedImprovement
from botorch.exceptions.warnings import NumericsWarning

# 代码已使用 qLogExpectedImprovement，抑制 BoTorch 内部触发的遗留 NumericsWarning
warnings.filterwarnings("ignore", category=NumericsWarning, module="botorch")
from botorch.models import SingleTaskGP
from botorch.optim import optimize_acqf
from gpytorch.mlls import ExactMarginalLogLikelihood
from gpytorch.kernels import MaternKernel, ScaleKernel
from gpytorch.priors import GammaPrior

from optimizer_interface import (
    BaseOptimizer,
    SearchSpace,
    DEFAULT_SEARCH_SPACE_8D,
    DEFAULT_SEARCH_SPACE_5D,
    continuous_dims,
    categorical_dims,
    simplex_dims,
)


def _params_to_array(
    params: dict[str, float | str],
    search_space: list[SearchSpace],
) -> np.ndarray:
    """θ 字典 → 内部向量"""
    arr = np.zeros(len(search_space), dtype=np.float64)
    for i, ss in enumerate(search_space):
        if ss.dim_type == "categorical":
            cat = params[ss.name]
            arr[i] = float(ss.categories.index(cat))
        else:
            arr[i] = float(params[ss.name])
    return arr


def _array_to_params(
    arr: np.ndarray,
    search_space: list[SearchSpace],
) -> dict[str, Any]:
    """内部向量 → θ 字典"""
    params: dict[str, Any] = {}
    for i, ss in enumerate(search_space):
        if ss.dim_type == "categorical":
            idx = int(round(arr[i]))
            idx = max(0, min(len(ss.categories) - 1, idx))
            params[ss.name] = ss.categories[idx]
        else:
            params[ss.name] = float(arr[i])
    return params


def _build_gp_input(
    raw_X: np.ndarray,
    search_space: list[SearchSpace],
) -> torch.Tensor:
    """raw X 直接送 GP（不做 one-hot，d_raw = d_gp = 11）

    categorical 在 raw 空间用整数索引，GP 视为连续；优化后 _discretize 取整
    """
    return torch.tensor(raw_X, dtype=torch.float64)


class BoTorchOptimizer(BaseOptimizer):
    """BoTorch GP + qEI 优化器

    raw_X 维度：D_raw = Σ(continuous 1) + Σ(categorical 1) + Σ(simplex n_categories)
    GP 输入维度：D_gp = Σ(continuous 1) + Σ(categorical n_categories) + Σ(simplex n_categories)
    """

    def __init__(
        self,
        search_space: list[SearchSpace] | None = None,
        n_initial: int = 20,
        random_state: int = 42,
        device: str = "cuda" if torch.cuda.is_available() else "cpu",
    ):
        if search_space is None:
            search_space = DEFAULT_SEARCH_SPACE_8D
        super().__init__(search_space, n_initial)
        self.random_state = random_state
        self.device = device

        # 计算 D_raw（实际存储维度）
        self._d_raw = sum(
            (1 if ss.dim_type in ("continuous", "integer", "categorical") else ss.n_categories)
            for ss in search_space
        )

        self._rng = np.random.RandomState(random_state)

        # 历史数据
        self._X_raw: list[np.ndarray] = []
        self._y: list[float] = []  # minimize: y = -winrate
        self._init_phase: bool = True
        self._n_init_sampled: int = 0

    def _random_sample_raw(self) -> np.ndarray:
        """随机 LHS 风格采样"""
        x = np.zeros(self._d_raw, dtype=np.float64)
        i = 0
        for ss in self.search_space:
            if ss.dim_type == "continuous":
                x[i] = self._rng.uniform(ss.lower, ss.upper)
                i += 1
            elif ss.dim_type == "integer":
                x[i] = float(self._rng.randint(int(ss.lower), int(ss.upper) + 1))
                i += 1
            elif ss.dim_type == "categorical":
                x[i] = float(self._rng.randint(0, ss.n_categories))
                i += 1
            elif ss.dim_type == "simplex":
                # sample from Dirichlet(1,1,1,1) — 均匀 simplex
                probs = self._rng.dirichlet(np.ones(ss.n_categories))
                # 反 softmax 得 logits
                log_probs = np.log(probs + 1e-12)
                x[i : i + ss.n_categories] = log_probs
                i += ss.n_categories
        return x

    def suggest(self, n_suggestions: int = 1) -> list[dict[str, Any]]:
        if n_suggestions != 1:
            raise NotImplementedError("BoTorchOptimizer 当前只支持 n_suggestions=1")

        # 初始阶段：随机 LHS
        if self._init_phase and self._n_init_sampled < self.n_initial:
            self._n_init_sampled += 1
            x_raw = self._random_sample_raw()
            return [_array_to_params(x_raw, self.search_space)]

        # 已经有数据：用 BoTorch GP + qEI
        self._init_phase = False
        if not self._X_raw:
            return [_array_to_params(self._random_sample_raw(), self.search_space)]

        # 构造 GP
        X_raw = np.array(self._X_raw)  # (N, D_raw)
        y = np.array(self._y, dtype=np.float64)
        y_tensor = torch.tensor(y, dtype=torch.float64).unsqueeze(-1)

        # 转 GP 输入（处理 categorical/simplex）
        X_gp = _build_gp_input(X_raw, self.search_space).to(self.device)
        y_tensor = y_tensor.to(self.device)

        # 标准化 y（qEI 推荐）
        y_mean = y_tensor.mean()
        y_std = y_tensor.std() + 1e-9
        y_normalized = (y_tensor - y_mean) / y_std

        # 拟合 GP
        try:
            # 把 X 缩放到 [0, 1]（BoTorch 推荐）
            X_min = X_gp.min(dim=0, keepdim=True).values
            X_max = X_gp.max(dim=0, keepdim=True).values
            X_range = (X_max - X_min).clamp_min(1e-9)
            X_scaled = (X_gp - X_min) / X_range

            gp = SingleTaskGP(
                train_X=X_scaled,
                train_Y=y_normalized,
                outcome_transform=None,
            ).to(self.device)
            mll = ExactMarginalLogLikelihood(gp.likelihood, gp)
            fit_gpytorch_mll(mll)

            # 最佳 f（minimize 所以是 min）
            best_f = y_normalized.min().item()

            # qLogExpectedImprovement（取代有数值问题的 qEI）
            acq = qLogExpectedImprovement(
                model=gp,
                best_f=best_f,
            )

            # 优化 acq function（在缩放后的空间）
            bounds = self._get_raw_bounds()
            # bounds 是 list[[l,u], ...] 长度 D_raw；BoTorch 要 (2, D_raw)
            bounds_arr = np.array(bounds, dtype=np.float64).T  # (2, D_raw)
            # 缩放边界
            bounds_scaled = (bounds_arr - X_min.cpu().numpy()) / X_range.cpu().numpy()
            bounds_torch = torch.tensor(bounds_scaled, dtype=torch.float64).to(self.device)

            candidate, _ = optimize_acqf(
                acq_function=acq,
                bounds=bounds_torch,
                q=1,
                num_restarts=8,
                raw_samples=128,
            )
            # 缩放回原空间
            candidate_raw = candidate * X_range.detach().clone() + X_min
            x_next = candidate_raw.cpu().numpy()[0]
        except Exception as e:
            # GP 拟合失败（极端情况）— 退回到随机
            print(f"[BoTorch] GP 拟合失败: {e}，回退到随机")
            x_next = self._random_sample_raw()

        # 离散化（categorical 取整、simplex 不变）
        x_discrete = self._discretize(x_next)
        return [_array_to_params(x_discrete, self.search_space)]

    def _get_raw_bounds(self) -> list[list[float]]:
        """raw X 的连续边界"""
        bounds = []
        i = 0
        for ss in self.search_space:
            if ss.dim_type in ("continuous", "integer"):
                bounds.append([ss.lower, ss.upper])
                i += 1
            elif ss.dim_type == "categorical":
                bounds.append([0.0, max(0.0, ss.n_categories - 1.0 - 1e-6)])
                i += 1
            elif ss.dim_type == "simplex":
                # softmax 输入无界，但实际参数化后 probs ∈ (0,1)
                # 给一个较宽的搜索范围（log-prob [-5, 5]）
                bounds.extend([[-5.0, 5.0]] * ss.n_categories)
                i += ss.n_categories
        return bounds

    def _discretize(self, x: np.ndarray) -> np.ndarray:
        """把 GP 输出的连续值离散化（categorical 取整、bounded clipping）"""
        x = x.copy()
        i = 0
        for ss in self.search_space:
            if ss.dim_type == "continuous":
                x[i] = np.clip(x[i], ss.lower, ss.upper)
                i += 1
            elif ss.dim_type == "integer":
                x[i] = float(np.clip(int(round(x[i])), int(ss.lower), int(ss.upper)))
                i += 1
            elif ss.dim_type == "categorical":
                idx = int(round(x[i]))
                x[i] = float(np.clip(idx, 0, ss.n_categories - 1))
                i += 1
            elif ss.dim_type == "simplex":
                # simplex logits 无需离散化（连续）
                i += ss.n_categories
        return x

    def update(self, evaluations: list[tuple[dict[str, Any], float]]) -> None:
        for params, y in evaluations:
            x_raw = self._params_to_raw(params)
            self._X_raw.append(x_raw)
            self._y.append(float(y))
            self.evaluations.append({"params": params, "y": float(y)})

    def _params_to_raw(self, params: dict[str, Any]) -> np.ndarray:
        """θ 字典 → raw X 向量"""
        x = np.zeros(self._d_raw, dtype=np.float64)
        i = 0
        for ss in self.search_space:
            if ss.dim_type in ("continuous", "integer"):
                x[i] = float(params[ss.name])
                i += 1
            elif ss.dim_type == "categorical":
                cat = params[ss.name]
                x[i] = float(ss.categories.index(cat))
                i += 1
            elif ss.dim_type == "simplex":
                val = params[ss.name]
                if not isinstance(val, list):
                    raise ValueError(f"simplex 参数 {ss.name} 应为列表")
                # 转 log-prob
                probs = np.array(val, dtype=np.float64)
                probs = np.clip(probs, 1e-12, 1.0)
                probs = probs / probs.sum()
                x[i : i + ss.n_categories] = np.log(probs)
                i += ss.n_categories
        return x

    def state_dict(self) -> dict[str, Any]:
        return {
            "X_raw": self._X_raw,
            "y": self._y,
            "n_initial": self.n_initial,
            "n_init_sampled": self._n_init_sampled,
            "init_phase": self._init_phase,
            "random_state": self.random_state,
            "device": self.device,
            "evaluations": self.evaluations,
        }

    def load_state_dict(self, state: dict[str, Any]) -> None:
        self._X_raw = state["X_raw"]
        self._y = state["y"]
        self.n_initial = state["n_initial"]
        self._n_init_sampled = state["n_init_sampled"]
        self._init_phase = state["init_phase"]
        self.random_state = state["random_state"]
        self.device = state["device"]
        self.evaluations = state["evaluations"]
        self._rng = np.random.RandomState(self.random_state)
