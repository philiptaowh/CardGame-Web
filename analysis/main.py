# main.py — Python 分析引擎 CLI 入口
# V2.1.0 分析平台
#
# 调用方式:
#   python analysis/main.py <jsonl-file> [--gpu] [--output <path>] [--max-games N]

import argparse
import os
import sys
import time
import numpy as np

from analysis.loader import MatchLoader, CHARACTER_IDS, CHARACTER_NAMES
from analysis.win_matrix import wilson_ci_matrix, overall_win_rates
from analysis.stats_tests import compute_all_tests
from analysis.ratings import compute_elo, compute_glicko, assign_tiers
from analysis.gpu_accel import bootstrap_ci, is_gpu_available
from analysis.report import generate_report


def main():
    parser = argparse.ArgumentParser(description='卡牌游戏 角色强度分析平台 v2.1.0')
    parser.add_argument('jsonl', nargs='?', help='JSON Lines 数据文件路径')
    parser.add_argument('--gpu', action='store_true', help='启用 GPU 加速 Bootstrap')
    parser.add_argument('--output', '-o', default=None, help='输出 HTML 报告路径')
    parser.add_argument('--max-games', type=int, default=None, help='最大加载对局数（调试用）')
    parser.add_argument('--no-report', action='store_true', help='不生成 HTML 报告，仅输出统计数据')

    args = parser.parse_args()

    if not args.jsonl:
        parser.print_help()
        print('\n示例:')
        print('  python analysis/main.py data/raw/batch-935.jsonl --gpu')
        print('  python analysis/main.py data/raw/batch-935.jsonl --no-report')
        sys.exit(1)

    # 确保路径正确（支持相对路径和绝对路径）
    jsonl_path = args.jsonl
    if not os.path.exists(jsonl_path):
        # 尝试相对 card-game/data/raw/
        alt_path = os.path.join('card-game', jsonl_path)
        if os.path.exists(alt_path):
            jsonl_path = alt_path
        elif os.path.exists(os.path.join('card-game', 'data', 'raw', os.path.basename(jsonl_path))):
            jsonl_path = os.path.join('card-game', 'data', 'raw', os.path.basename(jsonl_path))
        else:
            print(f'错误: 文件不存在: {jsonl_path}')
            sys.exit(1)

    print(f'[数据] 加载数据: {jsonl_path}')
    t_start = time.time()

    loader = MatchLoader(jsonl_path)
    loader.load(max_games=args.max_games)
    print(f'   已加载 {loader.n_games} 局, 解析错误: {loader.parse_errors}')

    # ============ 1. 胜率矩阵 & Wilson CI ============
    print('\n[矩阵] 计算胜率矩阵...')
    wins, totals = loader.build_win_matrix()
    win_rates, wi_lower, wi_upper = wilson_ci_matrix(wins, totals)

    overall = overall_win_rates(wins, totals)
    print(f'   角色胜率排名:')
    for item in overall:
        print(f'     {item["name"]}: {item["win_rate"]}% [{item["ci_lower"]}, {item["ci_upper"]}]')

    # ============ 2. Bootstrap CI ============
    print('\n[Boot] 计算 Bootstrap 置信区间...')
    char_pairs = loader.build_char_pair_array()
    match_winners = loader.build_wins_array()

    if args.gpu:
        print(f'   使用 GPU 加速 (RTX 4070 Ti SUPER)')
    else:
        print(f'   使用 CPU (加 --gpu 可启用 GPU 加速)')

    ci_lower_boot, ci_upper_boot, gpu_mode = bootstrap_ci(
        char_pairs, match_winners,
        n_bootstrap=10000,
        alpha=0.05,
        use_gpu=args.gpu,
    )
    # 转换为百分比
    ci_lower_boot_pct = ci_lower_boot * 100
    ci_upper_boot_pct = ci_upper_boot * 100
    print(f'   模式: {gpu_mode}')

    # ============ 3. 统计检验 ============
    print('\n[检验] 执行统计检验...')
    tests = compute_all_tests(wins, totals, wi_lower, wi_upper)
    print(f'   角色对总数: {tests["n_pairs"]}')
    print(f'   BH-FDR 显著: {tests["n_significant_bh"]} / {tests["n_pairs"]}')
    print(f'   Bonferroni 显著: {tests["n_significant_bonf"]} / {tests["n_pairs"]}')

    # ============ 4. 评级引擎 ============
    print('\n[评级] 计算 Elo / Glicko 评级...')
    elo = compute_elo(loader)
    glicko = compute_glicko(loader)
    tier_items = assign_tiers(elo, n_tiers=3)
    glicko_tier_items = assign_tiers(glicko, n_tiers=3)

    print(f'   Elo Tier 划分:')
    for r, t in tier_items:
        print(f'     [{t}] {r.name}: {r.rating}')

    # ============ 5. 策略统计 ============
    policy_matrix = loader.build_policy_matrix()
    strategy_names = []
    strategy_wr = []
    strategy_ci_l = []
    strategy_ci_u = []

    for pname in sorted(policy_matrix.keys()):
        total_wins = 0
        total_games = 0
        for opp, (w, t) in policy_matrix[pname].items():
            total_wins += w
            total_games += t
        if total_games > 0:
            from analysis.win_matrix import wilson_ci
            rate, lo, hi = wilson_ci(total_wins, total_games)
            strategy_names.append(pname)
            strategy_wr.append(round(rate * 100, 1))
            strategy_ci_l.append(round(lo * 100, 1))
            strategy_ci_u.append(round(hi * 100, 1))

    # ============ 6. 生成报告 ============
    if args.no_report:
        print('\n[完成] 统计分析完成 (--no-report, 未生成 HTML)')
        return

    # 确定输出路径
    if args.output:
        output_path = args.output
    else:
        base_name = os.path.splitext(os.path.basename(jsonl_path))[0]
        input_dir = os.path.dirname(os.path.abspath(jsonl_path))
        output_dir = os.path.join(input_dir, '..', 'reports')
        output_dir = os.path.normpath(output_dir)
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f'{base_name}_analysis.html')

    print(f'\n[报告] 生成 HTML 报告...')
    turns_array = loader.build_turns_array()
    duration_array = loader.build_duration_array()

    # 构建显著性矩阵
    n_chars = len(CHARACTER_IDS)
    significance_matrix = np.zeros((n_chars, n_chars), dtype=bool)
    for t in tests['pair_tests']:
        i, j = t.char_a_idx, t.char_b_idx
        significance_matrix[i][j] = t.significant_bh
        significance_matrix[j][i] = t.significant_bh

    generate_report(
        loader=loader,
        wins=wins,
        totals=totals,
        win_rate_matrix=win_rates * 100,  # 转为百分比
        wi_lower=wi_lower * 100,
        wi_upper=wi_upper * 100,
        ci_lower_boot=ci_lower_boot_pct,
        ci_upper_boot=ci_upper_boot_pct,
        significance_matrix=significance_matrix,
        pair_tests=tests['pair_tests'],
        elo_ratings=elo,
        glicko_ratings=glicko,
        tier_items=[(t, r.name, r.rating, r.win_rate, r.win_rate) for r, t in tier_items],
        glicko_tier_items=[(t, r.name, r.rating, r.rd) for r, t in glicko_tier_items],
        strategy_names=strategy_names,
        strategy_wr=strategy_wr,
        strategy_ci_lower=strategy_ci_l,
        strategy_ci_upper=strategy_ci_u,
        turns_array=turns_array,
        duration_array=duration_array,
        char_ids=CHARACTER_IDS,
        char_names_list=[CHARACTER_NAMES[cid] for cid in CHARACTER_IDS],
        source_file=jsonl_path,
        output_path=output_path,
        gpu_mode=gpu_mode,
    )

    total_elapsed = time.time() - t_start
    print(f'\n[完成] 全部分析完成! 总耗时: {total_elapsed:.1f}s')
    print(f'   HTML 报告: {output_path}')


if __name__ == '__main__':
    main()
