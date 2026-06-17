# gpu_accel.py — GPU 加速计算模块
# V2.1.0 分析平台
#
# 使用 Numba CUDA 对 Bootstrap 重采样进行 GPU 加速。
# 包含 CPU/GPU 混合模式：自动检测 GPU，GPU 不可用时回退 CPU。

import numpy as np
import time
from typing import Tuple, Optional, Callable
from numba import cuda
from numba.cuda.random import create_xoroshiro128p_states, xoroshiro128p_uniform_float32

# ============ CUDA Kernel ============

# Bootstrap 结果 flatten 后的索引计算
def _mat_flat(i: int, j: int, n_chars: int = 9) -> int:
    return i * n_chars + j


@cuda.jit
def _bootstrap_kernel(
    rng_states,
    char_pairs,       # (N, 2) int8
    match_winners,    # (N,) int8
    n_games: int,
    n_chars: int,
    n_bootstrap: int,
    results,          # (n_bootstrap, n_chars * n_chars) float64
):
    """CUDA Kernel: 每个线程完成一次 Bootstrap 重采样

    每个线程：
    1. 初始化本地 9×9 计数数组
    2. 有放回重采样 n_games 次（使用 XOROSHIRO128+ PRNG）
    3. 计算胜率并存入结果
    """
    tid = cuda.grid(1)
    if tid >= n_bootstrap:
        return

    flat_size = n_chars * n_chars

    # 本地计数数组（9×9 = 81 个 int64 ≈ 648 bytes，适合 local memory）
    wins = cuda.local.array(81, dtype=np.int64)
    totals = cuda.local.array(81, dtype=np.int64)

    # 初始化归零
    for idx in range(flat_size):
        wins[idx] = 0
        totals[idx] = 0

    # 有放回重采样 n_games 次
    for k in range(n_games):
        rand = xoroshiro128p_uniform_float32(rng_states, tid)
        idx = int(rand * n_games)
        if idx >= n_games:
            idx = n_games - 1

        i = int(char_pairs[idx, 0])
        j = int(char_pairs[idx, 1])
        w = int(match_winners[idx])

        pos_ij = i * n_chars + j
        pos_ji = j * n_chars + i

        totals[pos_ij] += 1
        totals[pos_ji] += 1

        if w == 0:
            wins[pos_ij] += 1
        elif w == 1:
            wins[pos_ji] += 1
        # 平局 (-1): 不增加任何人的胜场

    # 计算胜率并存入结果
    for idx in range(flat_size):
        if totals[idx] > 0:
            results[tid, idx] = wins[idx] / totals[idx]
        else:
            results[tid, idx] = -1.0  # 标记无数据


# ============ GPU Bootstrap ============

def bootstrap_ci_gpu(
    char_pairs: np.ndarray,
    match_winners: np.ndarray,
    n_bootstrap: int = 10000,
    alpha: float = 0.05,
    block_size: int = 256,
    progress_callback: Optional[Callable] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """GPU 加速 Bootstrap 重采样（Numba CUDA）

    启动 n_bootstrap 个 CUDA 线程，每个线程独立完成一次重采样
    和胜率计算，最终汇聚结果计算百分位置信区间。

    Args:
        char_pairs: (N, 2) int8 — 每局的角色对索引
        match_winners: (N,) int8 — 每局的胜者 (0/1/-1)
        n_bootstrap: 重采样次数
        alpha: 显著性水平
        block_size: CUDA block 大小
        progress_callback: 进度回调 (GPU 版本中仅在完成后调用一次)

    Returns:
        (ci_lower, ci_upper) — 每个形状 (9, 9) 的置信区间矩阵
    """
    n_games = len(match_winners)
    n_chars = 9
    flat_size = n_chars * n_chars

    # 确保数据在 GPU 上
    d_char_pairs = cuda.to_device(np.ascontiguousarray(char_pairs))
    d_match_winners = cuda.to_device(np.ascontiguousarray(match_winners))

    # 准备 RNG 状态
    rng_states = create_xoroshiro128p_states(n_bootstrap, seed=int(time.time() * 1000) & 0xFFFFFFFF)

    # 分配结果内存
    d_results = cuda.device_array((n_bootstrap, flat_size), dtype=np.float64)

    # 启动 Kernel
    grid_size = (n_bootstrap + block_size - 1) // block_size

    _bootstrap_kernel[grid_size, block_size](
        rng_states,
        d_char_pairs,
        d_match_winners,
        n_games,
        n_chars,
        n_bootstrap,
        d_results,
    )

    cuda.synchronize()

    # 取回结果到 CPU
    results = d_results.copy_to_host()

    if progress_callback:
        progress_callback(n_bootstrap, n_bootstrap)

    # 计算百分位置信区间
    ci_lower = np.zeros((n_chars, n_chars))
    ci_upper = np.zeros((n_chars, n_chars))

    for i in range(n_chars):
        for j in range(n_chars):
            if i == j:
                continue
            flat_idx = _mat_flat(i, j)
            values = results[:, flat_idx]
            # 过滤无数据 (-1)
            values = values[values >= 0]
            if len(values) == 0:
                continue
            ci_lower[i][j] = np.percentile(values, 100 * alpha / 2)
            ci_upper[i][j] = np.percentile(values, 100 * (1 - alpha / 2))

    return ci_lower, ci_upper


# ============ GPU 可用性检测 ============

def is_gpu_available() -> bool:
    """检测 CUDA GPU 是否可用"""
    try:
        return cuda.is_available()
    except Exception:
        return False


def get_gpu_info() -> str:
    """获取 GPU 信息"""
    if not is_gpu_available():
        return "GPU 不可用"
    try:
        dev = cuda.get_current_device()
        return f"{dev.name} (CC {dev.compute_capability[0]}.{dev.compute_capability[1]}, {dev.total_memory // (1024**3)}GB)"
    except Exception as e:
        return f"GPU 检测失败: {e}"


# ============ 自动选择模式 ============

def bootstrap_ci(
    char_pairs: np.ndarray,
    match_winners: np.ndarray,
    n_bootstrap: int = 10000,
    alpha: float = 0.05,
    use_gpu: bool = True,
    progress_callback: Optional[Callable] = None,
) -> Tuple[np.ndarray, np.ndarray, str]:
    """自动选择 GPU/CPU 的 Bootstrap 入口

    优先使用 GPU，GPU 不可用时回退 CPU。

    Returns:
        (ci_lower, ci_upper, mode) — mode 为 'gpu' 或 'cpu (fallback)'
    """
    from analysis.win_matrix import bootstrap_ci_cpu

    if use_gpu and is_gpu_available():
        try:
            t0 = time.time()
            lo, hi = bootstrap_ci_gpu(char_pairs, match_winners, n_bootstrap, alpha, progress_callback=progress_callback)
            elapsed = time.time() - t0
            return lo, hi, f'gpu ({elapsed:.1f}s)'
        except Exception as e:
            print(f'  GPU Bootstrap 失败: {e}，回退 CPU')
            use_gpu = False

    # CPU 回退
    t0 = time.time()
    n_chars = 9
    # 从 char_pairs/match_winners 重建 wins/totals
    wins = np.zeros((n_chars, n_chars), dtype=np.int64)
    totals = np.zeros((n_chars, n_chars), dtype=np.int64)
    for k in range(len(match_winners)):
        i, j = int(char_pairs[k][0]), int(char_pairs[k][1])
        w = int(match_winners[k])
        totals[i][j] += 1
        totals[j][i] += 1
        if w == 0:
            wins[i][j] += 1
        elif w == 1:
            wins[j][i] += 1

    _, lo, hi = bootstrap_ci_cpu(wins, totals, char_pairs, match_winners, n_bootstrap, alpha, progress_callback)
    elapsed = time.time() - t0
    return lo, hi, f'cpu ({elapsed:.1f}s)'
