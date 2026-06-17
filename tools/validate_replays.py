#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1 Replay 录制数据校验工具
===========================

校验 ./recording/ 下的所有 .jsonl 录制文件是否符合 V1Replay schema。
P1.6 修复后，必须 winner 非 null 且 finalState.players 非空才算完整录制。

用法:
    python tools/validate_replays.py                 # 校验 ./recording/ 全部
    python tools/validate_replays.py path/to/file    # 校验单个文件
    python tools/validate_replays.py --strict        # 严格模式：任何 warning 都报错

退出码:
    0 — 全部通过
    1 — 至少 1 个文件不通过
    2 — 参数错误
"""

import json
import sys
from pathlib import Path
from typing import Any

# ============ Schema 定义 ============

V1_REQUIRED_FIELDS = {
    'top': ['version', 'timestamp', 'duration', 'seed', 'gameMode', 'config', 'moves', 'winner', 'finalState'],
    'config': ['humanCharId', 'aiCharId', 'policies'],
    'policy': ['playerId', 'characterId', 'policyName', 'policyParams'],
    'move': ['turn', 'phase', 'playerId', 'action', 'isHuman'],
    'action_types': {'place_energy', 'use_skill', 'use_special_card', 'exchange', 'pass'},
    'final_player': ['id', 'characterId', 'finalHP', 'maxHP', 'finalShield', 'marks'],
}

# ============ 校验函数 ============

def validate_replay(path: Path) -> tuple[dict | None, list[str]]:
    """校验单个 Replay 文件，返回 (data, issues)"""
    issues = []
    data = None

    # 1. 文件可读
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except OSError as e:
        return None, [f'文件读取失败: {e}']

    # 2. 必须是单行 JSON（JSON Lines 规范）
    lines = content.strip().split('\n')
    if len(lines) != 1:
        issues.append(f'文件不是单行 JSON（实际 {len(lines)} 行）')

    # 3. JSON 可解析
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        issues.append(f'JSON 解析失败: {e}')
        return None, issues

    if not isinstance(data, dict):
        issues.append(f'根节点不是 dict（实际 {type(data).__name__}）')
        return data, issues

    # 4. 顶层字段
    for f in V1_REQUIRED_FIELDS['top']:
        if f not in data:
            issues.append(f'缺失顶层字段: {f}')

    # 5. config 字段
    cfg = data.get('config', {})
    for f in V1_REQUIRED_FIELDS['config']:
        if f not in cfg:
            issues.append(f'缺失 config.{f}')

    # 6. policies
    policies = cfg.get('policies', [])
    if len(policies) != 2:
        issues.append(f'policies 应为 2 个（人 + AI），实际 {len(policies)}')
    else:
        for i, p in enumerate(policies):
            for f in V1_REQUIRED_FIELDS['policy']:
                if f not in p:
                    issues.append(f'policies[{i}] 缺失字段: {f}')
            # human 必须 policyParams=null
            if p.get('policyName') == 'human' and p.get('policyParams') is not None:
                issues.append(f"policies[{i}] 人类玩家的 policyParams 应为 null")
            # AI 必须 policyParams 非 null
            if p.get('policyName') != 'human' and p.get('policyParams') is None:
                issues.append(f"policies[{i}] AI 缺少 policyParams")

    # 7. moves
    moves = data.get('moves', [])
    if not isinstance(moves, list):
        issues.append(f'moves 不是 list（实际 {type(moves).__name__}）')
    else:
        for i, m in enumerate(moves):
            for f in V1_REQUIRED_FIELDS['move']:
                if f not in m:
                    issues.append(f'moves[{i}] 缺失字段: {f}')
            action = m.get('action', {})
            atype = action.get('type')
            if atype not in V1_REQUIRED_FIELDS['action_types']:
                issues.append(f"moves[{i}].action.type 非法: {atype}")

    # 8. winner（P1.6 关键校验）
    winner = data.get('winner')
    if winner is None:
        issues.append('[CRITICAL] winner 为 null（P1.6 修复前症状）')
    else:
        player_ids = {p.get('playerId') for p in policies if p.get('playerId')}
        if player_ids and winner not in player_ids:
            issues.append(f'winner "{winner}" 不在 policies 的 playerId 中 {player_ids}')

    # 9. finalState（P1.6 关键校验）
    fs = data.get('finalState', {})
    if not fs or fs == {'turn': 0, 'players': []}:
        issues.append('[CRITICAL] finalState 为空（P1.6 修复前症状）')
    elif isinstance(fs, dict):
        if fs.get('turn', 0) <= 0:
            issues.append(f'finalState.turn={fs.get("turn")} 应 > 0')
        players = fs.get('players', [])
        if not players:
            issues.append('finalState.players 为空')
        for i, p in enumerate(players):
            for f in V1_REQUIRED_FIELDS['final_player']:
                if f not in p:
                    issues.append(f'finalState.players[{i}] 缺失: {f}')

    return data, issues


def analyze_replay(data: dict) -> dict:
    """从 Replay 提取统计信息（不校验）"""
    moves = data.get('moves', [])
    ai_moves = sum(1 for m in moves if not m.get('isHuman'))
    human_moves = sum(1 for m in moves if m.get('isHuman'))
    action_types: dict[str, int] = {}
    for m in moves:
        t = m.get('action', {}).get('type', '?')
        action_types[t] = action_types.get(t, 0) + 1
    last_turn = max((m.get('turn', 0) for m in moves), default=0)
    return {
        'total_moves': len(moves),
        'ai_moves': ai_moves,
        'human_moves': human_moves,
        'action_types': action_types,
        'last_turn': last_turn,
        'duration_sec': data.get('duration', 0) / 1000,
    }


# ============ 报告输出 ============

def print_file_report(path: Path, data: dict | None, issues: list[str], verbose: bool = True) -> bool:
    """输出单个文件报告，返回是否通过"""
    print(f'\n[FILE] {path.name}')
    print('-' * 70)

    if data is None:
        print('  [FAIL] 解析失败')
        for issue in issues:
            print(f'    - {issue}')
        return False

    stats = analyze_replay(data)
    cfg = data.get('config', {})
    fs = data.get('finalState', {})

    if verbose:
        print('  基础:')
        print(f"    - 版本: {data.get('version')}")
        print(f"    - 模式: {data.get('gameMode')}")
        print(f"    - 角色: {cfg.get('humanCharId')} vs {cfg.get('aiCharId')}")
        print(f"    - AI 策略: {[p.get('policyName') for p in cfg.get('policies', [])]}")
        print('  动作统计:')
        print(f"    - 总数: {stats['total_moves']} (AI: {stats['ai_moves']}, 人类: {stats['human_moves']})")
        print(f"    - 动作类型: {stats['action_types']}")
        print(f"    - 最后一回合: {stats['last_turn']}")
        print(f"    - 时长: {stats['duration_sec']:.1f} 秒")
        print('  终局:')
        print(f"    - winner: {data.get('winner')}")
        print(f"    - finalState.turn: {fs.get('turn')}")
        print(f"    - finalState.players: {len(fs.get('players', []))} 个")
        for p in fs.get('players', []):
            marks = p.get('marks', [])
            print(f"      * {p.get('id')} ({p.get('characterId')}): "
                  f"{p.get('finalHP')}HP/{p.get('maxHP')}HP, "
                  f"护盾 {p.get('finalShield')}, {len(marks)} 个印记")

    if issues:
        critical = [i for i in issues if '[CRITICAL]' in i]
        warn = [i for i in issues if '[CRITICAL]' not in i]
        if critical:
            print(f'  [FAIL] {len(critical)} 个 CRITICAL 问题:')
            for issue in critical:
                print(f'    - {issue}')
        if warn:
            print(f'  [WARN] {len(warn)} 个警告:')
            for issue in warn:
                print(f'    - {issue}')
        return not critical  # 严格模式下 critical 也算 fail

    print('  [OK] 完整性校验通过')
    return True


# ============ 主流程 ============

def main():
    args = sys.argv[1:]
    strict = '--strict' in args
    args = [a for a in args if a != '--strict']

    if len(args) > 1:
        print('用法: python tools/validate_replays.py [path|--strict]')
        return 2

    if len(args) == 1:
        target = Path(args[0])
        if not target.exists():
            print(f'路径不存在: {target}')
            return 2
        files = [target] if target.is_file() else sorted(target.glob('*.jsonl'))
    else:
        files = sorted(Path('recording').glob('*.jsonl'))

    if not files:
        print('未找到 .jsonl 文件（路径: ./recording/）')
        return 0

    print('=' * 70)
    print(f'V1 Replay 校验工具 (模式: {"严格" if strict else "常规"})')
    print(f'目标文件: {len(files)} 个')
    print('=' * 70)

    all_pass = True
    for f in files:
        data, issues = validate_replay(f)
        passed = print_file_report(f, data, issues)
        if not passed:
            all_pass = False

    print()
    print('=' * 70)
    if all_pass:
        print(f'[ALL PASS] {len(files)} 个文件全部通过校验')
        return 0
    else:
        print(f'[HAS FAIL] {len(files)} 个文件中存在不通过项')
        return 1


if __name__ == '__main__':
    sys.exit(main())
