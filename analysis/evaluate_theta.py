"""
evaluate_theta.py — Python 端 θ 评估桥

调用 Node 脚本 evaluate-theta.cjs 跑 N 局，返回胜率。
作为 BO 主循环的单点评估函数。

CPU 阶段默认串行调用；GPU 阶段可改为并行批处理（共享内存）。
"""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np


# 评估脚本路径（相对项目根）
SCRIPT_PATH = Path(__file__).resolve().parent.parent / "card-game" / "scripts" / "evaluate-theta.cjs"


@dataclass
class ThetaResult:
    """单次 θ 评估的结果"""
    char: str
    params: dict[str, Any]
    winrate: float
    wins: int
    draws: int
    losses: int
    total_matches: int
    duration_ms: int

    def to_dict(self) -> dict:
        return {
            "char": self.char,
            "params": self.params,
            "winrate": self.winrate,
            "wins": self.wins,
            "draws": self.draws,
            "losses": self.losses,
            "total_matches": self.total_matches,
            "duration_ms": self.duration_ms,
        }


def convert_bo_params_to_node(bo_params: dict[str, Any]) -> dict[str, Any]:
    """把 BO 搜索空间的 θ 字典（包含 skill_pref_0..3）转换为 Node 脚本格式（包含 skill_pref 数组）

    BO 8D 空间使用独立 skill_pref_0..3 字段（连续）。
    Node evaluate-theta.cjs 需要 skill_pref 作为 4 元数组。
    评估时把 skill_pref_i 归一化为概率分布。
    """
    node_params = dict(bo_params)
    # 收集 skill_pref_i
    sp_values = []
    for k in list(node_params.keys()):
        if k.startswith('skill_pref_'):
            sp_values.append(float(node_params.pop(k)))
    if sp_values:
        # 归一化为概率（softmax）
        arr = np.array(sp_values, dtype=np.float64)
        arr = np.exp(arr - arr.max())
        node_params['skill_pref'] = (arr / arr.sum()).tolist()
    return node_params


def evaluate_theta(
    char_id: str,
    params: dict[str, Any],
    opponents: list[str] | None = None,
    policies: list[str] | None = None,
    seed: int = 0,
    timeout: int = 60,
) -> ThetaResult:
    """调用 Node evaluate-theta.cjs 跑单次评估"""
    # 转换 BO 参数格式 → Node 脚本格式
    node_params = convert_bo_params_to_node(params)
    cmd = [
        "node",
        str(SCRIPT_PATH),
        "--char", char_id,
        "--params", json.dumps(node_params),
    ]
    if opponents:
        cmd += ["--opponents", ",".join(opponents)]
    if policies:
        cmd += ["--policies", ",".join(policies)]
    cmd += ["--seed", str(seed)]

    start = time.time()
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    elapsed = time.time() - start

    if result.returncode != 0:
        raise RuntimeError(
            f"evaluate-theta 失败 (exit={result.returncode}):\n"
            f"  stderr: {result.stderr[:500]}\n"
            f"  stdout: {result.stdout[:500]}"
        )

    # 解析 stdout 最后一行 JSON
    data = json.loads(result.stdout.strip().splitlines()[-1])
    return ThetaResult(
        char=data["char"],
        params=data["params"],
        winrate=data["winrate"],
        wins=data["wins"],
        draws=data["draws"],
        losses=data["losses"],
        total_matches=data["total_matches"],
        duration_ms=data["duration_ms"],
    )


if __name__ == "__main__":
    # 自测
    import sys
    result = evaluate_theta(
        char_id="char_9",
        params={"priority": 0.5, "hp_danger": 0.3, "aggro": 0.5,
                "mark_weight": 1.0, "special_threshold": 0.5},
        seed=42,
    )
    print(f"char={result.char} winrate={result.winrate:.4f} "
          f"({result.wins}W {result.draws}D {result.losses}L / "
          f"{result.total_matches} 局, {result.duration_ms}ms)")
