# loader.py — JSONL 数据加载与预处理
# V2.1.0 分析平台
#
# 读取 simulator 输出的 JSON Lines 文件，解析为 NumPy 结构化数组
# 供后续 win_matrix / stats_tests / ratings 模块使用

import json
import numpy as np
from typing import List, Dict, Tuple, Optional

# ============ 角色映射 ============

CHARACTER_IDS: List[str] = [
    'char_1', 'char_2', 'char_3', 'char_4', 'char_5',
    'char_6', 'char_7', 'char_8', 'char_9',
]

CHARACTER_NAMES: Dict[str, str] = {
    'char_1': '平衡', 'char_2': '防御', 'char_3': '进攻',
    'char_4': '强化', 'char_5': '先手', 'char_6': '持久',
    'char_7': '弱化', 'char_8': '反击', 'char_9': '连击',
}

CHARACTER_HP: Dict[str, int] = {
    'char_1': 100, 'char_2': 135, 'char_3': 80,
    'char_4': 110, 'char_5': 90, 'char_6': 115,
    'char_7': 80, 'char_8': 105, 'char_9': 90,
}

def char_index(char_id: str) -> int:
    """角色 ID → 矩阵索引 (0-8)"""
    try:
        return CHARACTER_IDS.index(char_id)
    except ValueError:
        raise ValueError(f"未知角色ID: {char_id}")

def char_name(char_id: str) -> str:
    """角色 ID → 中文名"""
    return CHARACTER_NAMES.get(char_id, char_id)

# ============ 数据记录类型 ============

class MatchRecord:
    """单场对局摘要"""
    __slots__ = ('char_a_idx', 'char_b_idx', 'winner_idx',
                 'policy_a', 'policy_b', 'turns', 'duration_ms',
                 'char_a_id', 'char_b_id')

    def __init__(self, char_a_id: str, char_b_id: str,
                 winner_id: Optional[str], p1_id: str, p2_id: str,
                 policy_a: str, policy_b: str,
                 turns: int, duration_ms: int):
        self.char_a_idx = char_index(char_a_id)
        self.char_b_idx = char_index(char_b_id)
        self.char_a_id = char_a_id
        self.char_b_id = char_b_id
        self.policy_a = policy_a
        self.policy_b = policy_b
        self.turns = turns
        self.duration_ms = duration_ms

        # winner_idx: 0 = char_a 胜, 1 = char_b 胜, -1 = 平局
        if winner_id is None:
            self.winner_idx = -1
        elif winner_id == p1_id:
            self.winner_idx = 0
        elif winner_id == p2_id:
            self.winner_idx = 1
        else:
            self.winner_idx = -1  # 异常情况

# ============ 加载器 ============

class MatchLoader:
    """JSONL 数据加载器

    加载 simulator 输出的 .jsonl 文件，构建内部数据结构。
    """

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.records: List[MatchRecord] = []
        self.total_lines = 0
        self.parse_errors = 0

    def load(self, max_games: Optional[int] = None) -> 'MatchLoader':
        """加载并解析 JSONL 文件"""
        with open(self.filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                self.total_lines += 1
                if max_games and len(self.records) >= max_games:
                    break
                try:
                    record = self._parse_line(line)
                    if record:
                        self.records.append(record)
                except Exception:
                    self.parse_errors += 1
        return self

    def _parse_line(self, line: str) -> Optional[MatchRecord]:
        data = json.loads(line)

        # 跳过无效记录
        if not data.get('config') or not data['config'].get('policies'):
            return None

        policies = data['config']['policies']
        if len(policies) < 2:
            return None

        # 提取对局双方
        p1 = policies[0]
        p2 = policies[1]

        # 提取终局数据
        final = data.get('finalState', {})
        turns = final.get('turn', 0)
        duration = data.get('duration', 0)

        return MatchRecord(
            char_a_id=p1.get('characterId', ''),
            char_b_id=p2.get('characterId', ''),
            winner_id=data.get('winner'),
            p1_id=p1.get('playerId', 'p1'),
            p2_id=p2.get('playerId', 'p2'),
            policy_a=p1.get('policyName', 'unknown'),
            policy_b=p2.get('policyName', 'unknown'),
            turns=turns,
            duration_ms=duration,
        )

    # ============ 数据访问 ============

    @property
    def n_games(self) -> int:
        return len(self.records)

    @property
    def n_chars(self) -> int:
        return len(CHARACTER_IDS)

    def get_char_ids(self) -> List[str]:
        return CHARACTER_IDS

    def get_char_names(self) -> Dict[str, str]:
        return dict(CHARACTER_NAMES)

    def get_all_policy_names(self) -> List[str]:
        """获取所有出现过的策略名"""
        names: set = set()
        for r in self.records:
            names.add(r.policy_a)
            names.add(r.policy_b)
        return sorted(names)

    # ============ 矩阵构建 ============

    def build_win_matrix(self) -> Tuple[np.ndarray, np.ndarray]:
        """构建胜率矩阵和总数矩阵

        Returns:
            wins: (9, 9) ndarray, wins[i][j] = i 胜 j 的次数
            totals: (9, 9) ndarray, totals[i][j] = i vs j 的总对局数
        """
        n = self.n_chars
        wins = np.zeros((n, n), dtype=np.int64)
        totals = np.zeros((n, n), dtype=np.int64)

        for r in self.records:
            i, j = r.char_a_idx, r.char_b_idx
            totals[i][j] += 1
            totals[j][i] += 1
            if r.winner_idx == 0:
                wins[i][j] += 1
            elif r.winner_idx == 1:
                wins[j][i] += 1
            # 平局不计入任何人的胜场

        return wins, totals

    def build_policy_matrix(self) -> Dict[str, Dict[str, Tuple[int, int]]]:
        """构建策略胜率映射

        Returns:
            { policy_name: { opponent_policy: (wins, total) } }
        """
        from collections import defaultdict
        stats: Dict[str, Dict[str, List[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))

        for r in self.records:
            # policy_a vs policy_b
            stats[r.policy_a][r.policy_b][1] += 1  # total
            if r.winner_idx == 0:
                stats[r.policy_a][r.policy_b][0] += 1  # win
            # policy_b vs policy_a
            stats[r.policy_b][r.policy_a][1] += 1
            if r.winner_idx == 1:
                stats[r.policy_b][r.policy_a][0] += 1

        result: Dict[str, Dict[str, Tuple[int, int]]] = {}
        for pa in stats:
            result[pa] = {}
            for pb in stats[pa]:
                result[pa][pb] = (stats[pa][pb][0], stats[pa][pb][1])
        return result

    def build_wins_array(self) -> np.ndarray:
        """构建每局胜者数组 (用于 Bootstrap)

        Returns:
            (N,) ndarray, 0 = char_a 胜, 1 = char_b 胜, -1 = 平局
        """
        return np.array([r.winner_idx for r in self.records], dtype=np.int8)

    def build_char_pair_array(self) -> np.ndarray:
        """构建每局角色对数组 (用于 Bootstrap)

        Returns:
            (N, 2) ndarray, [char_a_idx, char_b_idx]
        """
        return np.array([[r.char_a_idx, r.char_b_idx] for r in self.records], dtype=np.int8)

    def build_turns_array(self) -> np.ndarray:
        return np.array([r.turns for r in self.records], dtype=np.int32)

    def build_duration_array(self) -> np.ndarray:
        return np.array([r.duration_ms for r in self.records], dtype=np.int32)

    # ============ 摘要 ============

    def summary(self) -> Dict:
        wins, totals = self.build_win_matrix()
        # 总体胜率（排除平局）
        overall = []
        for i in range(self.n_chars):
            total_i = totals[i].sum()
            wins_i = wins[i].sum()
            rate = wins_i / total_i * 100 if total_i > 0 else 0
            overall.append({
                'char_id': CHARACTER_IDS[i],
                'name': CHARACTER_NAMES[CHARACTER_IDS[i]],
                'wins': int(wins_i),
                'total': int(total_i),
                'win_rate': round(rate, 1),
            })
        overall.sort(key=lambda x: -x['win_rate'])

        return {
            'n_games': self.n_games,
            'n_chars': self.n_chars,
            'n_policies': len(self.get_all_policy_names()),
            'parse_errors': self.parse_errors,
            'average_turns': float(np.mean(self.build_turns_array())),
            'median_turns': float(np.median(self.build_turns_array())),
            'overall': overall,
        }
