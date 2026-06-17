# report.py — HTML 离线报告生成器
# V2.1.0 分析平台
#
# 生成自包含 HTML 报告，包含：
# - matplotlib 图表（热力图/柱状图/直方图 → base64 PNG）
# - D3.js 力导向克制关系图（内嵌）
# - CSS Tier 排名卡片 + 可折叠数据表

import io
import base64
import os
import time
from typing import List, Dict, Tuple, Optional

import numpy as np

# ============ matplotlib 中文支持 ============

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# 尝试设置中文字体
_CN_FONT = None
for _font_name in ['Microsoft YaHei', 'SimHei', 'WenQuanYi Micro Hei', 'Noto Sans CJK SC']:
    try:
        plt.rcParams['font.sans-serif'] = [_font_name]
        plt.rcParams['axes.unicode_minus'] = False
        # 验证字体是否可用
        fig_test, ax_test = plt.subplots(figsize=(1, 1))
        ax_test.set_title('测试')
        plt.close(fig_test)
        _CN_FONT = _font_name
        break
    except Exception:
        continue

# ============ 辅助: 图表 → base64 ============

def _fig_to_base64(fig: plt.Figure) -> str:
    """matplotlib Figure → base64 PNG 字符串"""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', pad_inches=0.3)
    buf.seek(0)
    data = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close(fig)
    return data


# ============ 1. 胜率热力图 ============

def plot_heatmap(
    win_matrix: np.ndarray,
    total_matrix: np.ndarray,
    char_names: List[str],
    significance_matrix: np.ndarray,  # (9,9) bool — True = BH显著
) -> str:
    """生成胜率热力图 (matplotlib)"""
    n = len(char_names)
    fig, ax = plt.subplots(figsize=(10, 8.5))
    fig.patch.set_facecolor('#1e293b')
    ax.set_facecolor('#1e293b')

    # 数据准备（对角填 50% 中性色）
    data = np.copy(win_matrix)
    for i in range(n):
        data[i][i] = 50.0

    cmap = plt.cm.RdYlBu_r  # 红=高胜率，蓝=低胜率
    im = ax.imshow(data, cmap=cmap, vmin=20, vmax=80, aspect='equal')

    # 坐标轴
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    ax.set_xticklabels(char_names, fontsize=11, color='#cbd5e1')
    ax.set_yticklabels(char_names, fontsize=11, color='#cbd5e1')
    ax.tick_params(colors='#64748b')

    # 格内文字
    for i in range(n):
        for j in range(n):
            if i == j:
                text = '--'
                color = '#64748b'
            else:
                val = win_matrix[i][j]
                text = f'{val:.1f}%'
                color = 'white' if abs(val - 50) > 15 else '#1e293b'

            ax.text(j, i, text, ha='center', va='center', fontsize=9,
                    fontweight='bold', color=color)

            # 显著性绿色边框
            if i != j and significance_matrix[i][j]:
                rect = plt.Rectangle((j - 0.5, i - 0.5), 1, 1,
                                     fill=False, edgecolor='#22c55e',
                                     linewidth=2.5, linestyle='-')
                ax.add_patch(rect)

    # 颜色条
    cbar = plt.colorbar(im, ax=ax, shrink=0.7, pad=0.02)
    cbar.set_label('胜率 (%)', color='#cbd5e1', fontsize=10)
    cbar.ax.yaxis.set_tick_params(color='#cbd5e1')
    plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color='#cbd5e1')

    ax.set_title('角色胜率热力图', fontsize=15, color='#f1f5f9', fontweight='bold', pad=15)
    ax.set_xlabel('对手', fontsize=11, color='#94a3b8', labelpad=8)
    ax.set_ylabel('角色', fontsize=11, color='#94a3b8', labelpad=8)

    plt.tight_layout()
    return _fig_to_base64(fig)


# ============ 2. 策略对比柱状图 ============

def plot_strategy_chart(
    strategy_names: List[str],
    win_rates: List[float],
    ci_lowers: List[float],
    ci_uppers: List[float],
) -> str:
    """生成策略对比柱状图"""
    n = len(strategy_names)
    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor('#1e293b')
    ax.set_facecolor('#1e293b')

    x = np.arange(n)
    colors = ['#22c55e' if r >= 50 else '#ef4444' for r in win_rates]

    bars = ax.bar(x, win_rates, width=0.6, color=colors, alpha=0.85, edgecolor='white', linewidth=0.5)

    # 误差线
    yerr_lower = [r - l for r, l in zip(win_rates, ci_lowers)]
    yerr_upper = [u - r for r, u in zip(win_rates, ci_uppers)]
    ax.errorbar(x, win_rates, yerr=[yerr_lower, yerr_upper],
                fmt='none', capsize=4, capthick=1.5, color='white', alpha=0.7)

    ax.set_xticks(x)
    ax.set_xticklabels(strategy_names, fontsize=10, color='#cbd5e1', rotation=25, ha='right')
    ax.tick_params(colors='#64748b')
    ax.set_ylabel('胜率 (%)', fontsize=11, color='#94a3b8')
    ax.set_title('策略胜率对比 (含 Bootstrap 95% CI)', fontsize=14, color='#f1f5f9', fontweight='bold')

    # 50% 基准线
    ax.axhline(y=50, color='#fbbf24', linestyle='--', linewidth=1, alpha=0.6, label='50% 基准')
    ax.legend(loc='lower right', facecolor='#334155', edgecolor='#475569', labelcolor='#cbd5e1', fontsize=9)

    ax.set_ylim(0, max(ci_uppers) * 1.15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#475569')
    ax.spines['bottom'].set_color('#475569')

    # 柱顶数值
    for bar, rate in zip(bars, win_rates):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1.5,
                f'{rate:.1f}%', ha='center', va='bottom', fontsize=8,
                color='#cbd5e1', fontweight='bold')

    plt.tight_layout()
    return _fig_to_base64(fig)


# ============ 3. 回合分布直方图 ============

def plot_turn_histogram(turns: np.ndarray, max_turn: int = 30) -> str:
    """生成回合分布直方图"""
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor('#1e293b')
    ax.set_facecolor('#1e293b')

    bins = np.arange(0, max_turn + 2, 1)
    ax.hist(turns, bins=bins, color='#6366f1', alpha=0.8, edgecolor='#1e293b', linewidth=0.5)
    ax.set_xlabel('回合数', fontsize=11, color='#94a3b8')
    ax.set_ylabel('对局数', fontsize=11, color='#94a3b8')
    ax.set_title('对局回合分布', fontsize=14, color='#f1f5f9', fontweight='bold')
    ax.tick_params(colors='#64748b')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#475569')
    ax.spines['bottom'].set_color('#475569')

    # 均值线
    mean_t = float(np.mean(turns))
    ax.axvline(mean_t, color='#fbbf24', linestyle='--', linewidth=1.5,
               label=f'平均 {mean_t:.1f} 回合')
    ax.legend(loc='upper right', facecolor='#334155', edgecolor='#475569',
              labelcolor='#cbd5e1', fontsize=10)

    plt.tight_layout()
    return _fig_to_base64(fig)


# ============ 4. D3.js 力导向图数据生成 ============

def build_counter_graph_data(
    win_matrix: np.ndarray,
    total_matrix: np.ndarray,
    ci_lower: np.ndarray,
    ci_upper: np.ndarray,
    elo_ratings: List[float],
    elo_ci_lower: List[float],
    elo_ci_upper: List[float],
    tier_labels: List[str],
    char_ids: List[str],
    char_names: List[str],
    significance_bh: np.ndarray,  # (9,9) bool
) -> Dict:
    """构建 D3.js 力导向图数据

    Nodes: 9 角色
    Links: 显著的克制关系 (Bootstrap CI 不包含 0)
    """
    n = len(char_names)

    # 节点
    nodes = []
    for i in range(n):
        nodes.append({
            'id': char_ids[i],
            'name': char_names[i],
            'elo': round(elo_ratings[i], 1),
            'eloLower': round(elo_ci_lower[i], 1),
            'eloUpper': round(elo_ci_upper[i], 1),
            'tier': tier_labels[i] if i < len(tier_labels) else 'B',
            'winRate': round(win_matrix[i].sum() / total_matrix[i].sum() * 100, 1) if total_matrix[i].sum() > 0 else 0,
        })

    # 边（仅显著克制关系）
    links = []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if not significance_bh[i][j]:
                continue
            # K_ij = p_ij - 0.5
            p_ij = win_matrix[i][j]
            if total_matrix[i][j] == 0:
                continue
            k_ij = p_ij / 100 - 0.5
            if abs(k_ij) < 0.02:  # 忽略微小克制
                continue
            links.append({
                'source': char_ids[i],
                'target': char_ids[j],
                'strength': round(k_ij, 3),
                'winRate': round(p_ij, 1),
                'ciLower': round(ci_lower[i][j], 1),
                'ciUpper': round(ci_upper[i][j], 1),
                'nGames': int(total_matrix[i][j]),
            })

    return {'nodes': nodes, 'links': links}


# ============ 5. HTML 模板 ============

def _generate_html(
    metrics: Dict,
    tier_items: List[Tuple[str, str, float, float, float]],  # [(tier, name, elo, win_rate, bar_pct)]
    heatmap_b64: str,
    strategy_b64: str,
    turn_b64: str,
    counter_data: Dict,
    pair_tests: List,
    char_details: List[Dict],
    config_info: Dict,
    glicko_items: List[Tuple[str, str, float, float]],
    d3js_content: str,
) -> str:
    """生成完整自包含 HTML 报告"""
    # 构建 Tier 卡片
    tier_html = ''
    for tier, name, elo, wr, bar_pct in tier_items:
        tier_colors = {'S': '#fbbf24', 'A': '#22c55e', 'B': '#64748b'}
        tc = tier_colors.get(tier, '#64748b')
        bar_w = min(bar_pct, 100)
        tier_html += f'''
        <div style="display:flex;align-items:center;padding:12px 16px;margin:6px 0;
                    background:#1e293b;border-radius:10px;border-left:5px solid {tc};">
            <span style="font-size:24px;font-weight:bold;color:{tc};width:40px;">{tier}</span>
            <span style="flex:1;font-size:16px;font-weight:bold;color:#f1f5f9;">{name}</span>
            <span style="width:100px;color:#94a3b8;font-size:14px;">Elo {elo:.0f}</span>
            <span style="width:80px;color:#cbd5e1;font-size:14px;font-weight:bold;">{wr:.1f}%</span>
            <div style="width:200px;height:20px;background:#334155;border-radius:10px;overflow:hidden;">
                <div style="height:100%;width:{bar_w}%;background:{tc};border-radius:10px;
                            transition:width 0.5s;"></div>
            </div>
        </div>'''

    # 构建 Glicko 行（带说明）
    glicko_html = ''
    for tier, name, rating, rd in glicko_items:
        tier_colors = {'S': '#fbbf24', 'A': '#22c55e', 'B': '#64748b'}
        tc = tier_colors.get(tier, '#64748b')
        glicko_html += f'''
        <div style="display:flex;align-items:center;padding:8px 16px;margin:4px 0;
                    background:#1e293b;border-radius:8px;border-left:3px solid {tc};">
            <span style="font-size:16px;font-weight:bold;color:{tc};width:30px;">{tier}</span>
            <span style="flex:1;font-size:14px;color:#f1f5f9;">{name}</span>
            <span style="color:#94a3b8;font-size:13px;">{rating:.0f} &plusmn; {rd:.0f}</span>
        </div>'''

    # 构建统计检验表
    tests_html = ''
    for t in pair_tests[:50]:  # 最多显示 50 行
        sig = '✅' if t.get('significant_bh', False) else ' '
        tests_html += f'''
        <tr style="border-bottom:1px solid #334155;">
            <td style="padding:6px 10px;color:#cbd5e1;">{sig}</td>
            <td style="padding:6px 10px;color:#f1f5f9;">{t['char_a_name']}</td>
            <td style="padding:6px 10px;color:#f1f5f9;">{t['char_b_name']}</td>
            <td style="padding:6px 10px;color:#cbd5e1;">{t['win_rate_a']}%</td>
            <td style="padding:6px 10px;color:#94a3b8;">[{t['wilson_lower']}, {t['wilson_upper']}]</td>
            <td style="padding:6px 10px;color:#94a3b8;">{t.get('p_value', 1):.4f}</td>
            <td style="padding:6px 10px;color:#94a3b8;">{t.get('p_adjusted', 1):.4f}</td>
            <td style="padding:6px 10px;color:#94a3b8;">{t.get('cohens_h', 0):.3f}</td>
        </tr>'''

    # 构建角色详情卡
    detail_html = ''
    for d in char_details:
        best = d.get('best_matchup', '')
        worst = d.get('worst_matchup', '')
        matchups_html = ''
        for m in d.get('matchups', []):
            matchups_html += f'''
            <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;">
                <span style="color:#94a3b8;">vs {m['name']}</span>
                <span style="color:#cbd5e1;font-weight:bold;">{m['win_rate']}%</span>
                <span style="color:#64748b;">[{m['ci_lower']}, {m['ci_upper']}]</span>
                <span style="color:#64748b;">n={m['n_games']}</span>
            </div>'''
        detail_html += f'''
        <details style="margin:8px 0;background:#1e293b;border-radius:8px;padding:12px 16px;">
            <summary style="font-size:15px;font-weight:bold;color:#f1f5f9;cursor:pointer;padding:4px 0;">
                {d['name']} — {d['tier']}级 — Elo {d['elo']:.0f} — 胜率 {d['win_rate']}%
            </summary>
            <div style="padding:10px 0;border-top:1px solid #334155;margin-top:10px;">
                <div style="display:flex;gap:20px;margin-bottom:10px;">
                    <div style="background:#334155;border-radius:6px;padding:8px 14px;text-align:center;">
                        <div style="color:#94a3b8;font-size:12px;">最佳对局</div>
                        <div style="color:#22c55e;font-size:14px;font-weight:bold;">{best}</div>
                    </div>
                    <div style="background:#334155;border-radius:6px;padding:8px 14px;text-align:center;">
                        <div style="color:#94a3b8;font-size:12px;">最差对局</div>
                        <div style="color:#ef4444;font-size:14px;font-weight:bold;">{worst}</div>
                    </div>
                </div>
                {matchups_html}
            </div>
        </details>'''

    # D3.js 力导向图的 JS 数据
    import json
    counter_json = json.dumps(counter_data, ensure_ascii=False)

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>卡牌游戏 角色强度分析报告</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ background:#0f172a; color:#e2e8f0; font-family:-apple-system,'Microsoft YaHei',sans-serif; padding:30px 20px; }}
.container {{ max-width:1100px; margin:0 auto; }}
h1 {{ font-size:26px; color:#f1f5f9; text-align:center; margin-bottom:6px; }}
.subtitle {{ text-align:center; color:#64748b; font-size:14px; margin-bottom:30px; }}
.section {{ background:#1e293b; border-radius:12px; padding:24px; margin:20px 0; }}
.section h2 {{ font-size:18px; color:#f1f5f9; margin-bottom:16px; padding-bottom:8px; border-bottom:2px solid #334155; }}
.metrics {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:20px; }}
.metric-card {{ background:#1e293b; border-radius:10px; padding:16px; text-align:center; border:1px solid #334155; }}
.metric-value {{ font-size:28px; font-weight:bold; color:#f1f5f9; }}
.metric-label {{ font-size:13px; color:#64748b; margin-top:4px; }}
.chart-img {{ width:100%; max-width:1000px; height:auto; display:block; margin:0 auto; border-radius:8px; }}
.legend {{ display:flex; gap:20px; justify-content:center; margin:12px 0; flex-wrap:wrap; }}
.legend-item {{ display:flex; align-items:center; gap:6px; font-size:13px; color:#94a3b8; }}
.legend-dot {{ width:12px; height:12px; border-radius:3px; }}
table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th {{ padding:8px 10px; text-align:left; color:#94a3b8; border-bottom:2px solid #475569; font-weight:bold; }}
td {{ padding:6px 10px; }}
#counter-graph {{ width:100%; height:600px; background:#0f172a; border-radius:8px; }}
#counter-graph svg {{ display:block; margin:0 auto; }}
.node circle {{ stroke:#fff; stroke-width:2px; cursor:pointer; }}
.node text {{ font-size:12px; fill:#cbd5e1; pointer-events:none; }}
.link {{ stroke-opacity:0.6; }}
.link-label {{ font-size:10px; fill:#94a3b8; }}
.tooltip {{ position:absolute; background:#1e293b; border:1px solid #475569; border-radius:8px;
            padding:12px 16px; pointer-events:none; font-size:13px; color:#cbd5e1;
            box-shadow:0 4px 12px rgba(0,0,0,0.4); z-index:100; }}
.detail-panel {{ position:fixed; right:20px; top:50%; transform:translateY(-50%);
                width:320px; max-height:80vh; overflow-y:auto; background:#1e293b;
                border:1px solid #475569; border-radius:12px; padding:20px;
                display:none; z-index:200;
                box-shadow:0 8px 32px rgba(0,0,0,0.5); }}
.detail-panel h3 {{ color:#f1f5f9; font-size:16px; margin-bottom:12px; }}
.detail-row {{ display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155; font-size:13px; }}
.detail-label {{ color:#94a3b8; }}
.detail-value {{ color:#cbd5e1; font-weight:bold; }}
.close-btn {{ float:right; cursor:pointer; color:#64748b; font-size:18px; }}
.close-btn:hover {{ color:#ef4444; }}
aside {{ font-size:13px; color:#64748b; background:#1e293b; border-radius:8px; padding:12px 16px; margin:10px 0;
         border-left:3px solid #fbbf24; }}
@media (max-width:768px) {{ .detail-panel {{ width:280px; right:10px; }} }}
</style>
</head>
<body>
<div class="container">
    <h1>🎮 卡牌游戏 角色强度分析报告</h1>
    <p class="subtitle">数据: {config_info['source_file']} | {metrics['total_games']} 局 | {config_info.get('date', '')}</p>

    <!-- [1] 关键指标 -->
    <div class="metrics">
        <div class="metric-card"><div class="metric-value">{metrics['total_games']}</div><div class="metric-label">总对局</div></div>
        <div class="metric-card"><div class="metric-value">{metrics['avg_turns']}</div><div class="metric-label">平均回合</div></div>
        <div class="metric-card"><div class="metric-value">{metrics['median_turns']}</div><div class="metric-label">中位回合</div></div>
        <div class="metric-card"><div class="metric-value">{metrics['p95_duration']}ms</div><div class="metric-label">P95 耗时</div></div>
        <div class="metric-card"><div class="metric-value">{metrics['throughput']}</div><div class="metric-label">生成吞吐</div></div>
    </div>

    <!-- [2] Tier 排名 -->
    <div class="section">
        <h2>🏆 Tier 排名 — Elo 评级 (主评级)</h2>
        {tier_html}
    </div>

    <!-- Glicko 参考 -->
    <div class="section">
        <h2>📊 Glicko 评级 (参考) <span style="font-size:12px;color:#fbbf24;font-weight:normal;">⚠ 独立仿真对局中 Glicko 排序可能不稳定，以 Elo 为主</span></h2>
        {glicko_html}
    </div>

    <!-- [3] 胜率热力图 -->
    <div class="section">
        <h2>🔴🔵 胜率热力图</h2>
        <div class="legend">
            <span class="legend-item"><span class="legend-dot" style="background:#d73027;"></span> 高胜率 (>55%)</span>
            <span class="legend-item"><span class="legend-dot" style="background:#fee090;"></span> 均衡 (45-55%)</span>
            <span class="legend-item"><span class="legend-dot" style="background:#4575b4;"></span> 低胜率 (<45%)</span>
            <span class="legend-item"><span class="legend-dot" style="background:transparent;border:2px solid #22c55e;"></span> BH-FDR 显著</span>
        </div>
        <img class="chart-img" src="data:image/png;base64,{heatmap_b64}" alt="胜率热力图">
    </div>

    <!-- [4] 策略对比 -->
    <div class="section">
        <h2>📈 策略胜率对比</h2>
        <img class="chart-img" src="data:image/png;base64,{strategy_b64}" alt="策略对比图">
    </div>

    <!-- [5] 克制关系图 -->
    <div class="section">
        <h2>🕸️ 克制关系图</h2>
        <aside>💡 悬停节点查看详细对战数据 · 点击节点展开右侧详情面板 · 拖拽节点调整布局</aside>
        <div id="counter-graph"></div>
    </div>

    <!-- [6] 对局统计 -->
    <div class="section">
        <h2>📊 对局回合分布</h2>
        <img class="chart-img" src="data:image/png;base64,{turn_b64}" alt="回合分布">
    </div>

    <!-- [7] 统计检验表 -->
    <div class="section">
        <details>
            <summary style="font-size:18px;color:#f1f5f9;font-weight:bold;cursor:pointer;">
                📋 统计检验详情 (36 角色对)
            </summary>
            <div style="overflow-x:auto;margin-top:12px;">
            <table>
                <thead>
                    <tr><th></th><th>角色 A</th><th>角色 B</th><th>胜率</th><th>Wilson 95% CI</th><th>p 值</th><th>BH-q</th><th>Cohen\'s h</th></tr>
                </thead>
                <tbody>
                    {tests_html}
                </tbody>
            </table>
            </div>
        </details>
    </div>

    <!-- [8] 角色详情 -->
    <div class="section">
        <details>
            <summary style="font-size:18px;color:#f1f5f9;font-weight:bold;cursor:pointer;">
                👤 角色详细数据
            </summary>
            <div style="margin-top:12px;">
                {detail_html}
            </div>
        </details>
    </div>

    <!-- [9] 配置信息 -->
    <div class="section">
        <details>
            <summary style="font-size:14px;color:#64748b;cursor:pointer;font-weight:bold;">
                ⚙ 数据配置信息
            </summary>
            <div style="margin-top:12px;font-size:13px;color:#94a3b8;line-height:1.8;">
                <div>数据文件: {config_info['source_file']}</div>
                <div>策略: {config_info.get('policies', 'N/A')}</div>
                <div>角色组合: {config_info.get('matchups', 'N/A')}</div>
                <div>种子: {config_info.get('seed', 'N/A')}</div>
                <div>生成时间: {config_info.get('date', 'N/A')}</div>
                <div>GPU 加速: {config_info.get('gpu', 'N/A')}</div>
            </div>
        </details>
    </div>

    <!-- 详情面板 (D3.js 点击弹出) -->
    <div id="detail-panel" class="detail-panel">
        <span class="close-btn" onclick="closeDetail()">&times;</span>
        <h3 id="detail-name">选择角色查看详情</h3>
        <div id="detail-content"></div>
    </div>
</div>

<!-- D3.js Library (内嵌) -->
<script>{d3js_content}</script>

<!-- D3.js 力导向图初始化 -->
<script>
var counterData = {counter_json};

var width = document.getElementById('counter-graph').clientWidth || 900;
var height = 560;

var svg = d3.select('#counter-graph').append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', '#0f172a');

var g = svg.append('g');

var zoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => g.attr('transform', event.transform));

svg.call(zoom);

var tierColors = {{ 'S': '#fbbf24', 'A': '#22c55e', 'B': '#64748b' }};

var nodes = counterData.nodes.map(d => ({{ ...d }}));
var links = counterData.links.map(d => ({{ ...d }}));

var simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(160).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(50));

var link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('stroke', d => d.strength > 0 ? '#ef4444' : '#3b82f6')
    .attr('stroke-width', d => Math.abs(d.strength) * 20 + 1);

link.append('title')
    .text(d => d.source.name + ' → ' + d.target.name + ': ' + d.winRate + '% [' + d.ciLower + ', ' + d.ciUpper + '] n=' + d.nGames);

var node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(d3.drag()
        .on('start', (event, d) => {{ if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }})
        .on('drag', (event, d) => {{ d.fx = event.x; d.fy = event.y; }})
        .on('end', (event, d) => {{ if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }})
    );

node.append('circle')
    .attr('r', d => d.elo / 100)
    .attr('fill', d => tierColors[d.tier] || '#64748b')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

node.append('text')
    .attr('dy', d => d.elo / 100 + 16)
    .attr('text-anchor', 'middle')
    .text(d => d.name)
    .style('fill', '#cbd5e1')
    .style('font-size', '12px');

// 悬停 tooltip
var tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');

node.on('mouseover', function(event, d) {{
    var wins = counterData.links.filter(l => l.source === d.id || l.target === d.id);
    var lines = ['<b>' + d.name + '</b> (Tier ' + d.tier + ')'];
    lines.push('Elo: ' + d.elo + ' [' + d.eloLower + ', ' + d.eloUpper + ']');
    lines.push('胜率: ' + d.winRate + '%');
    lines.push('');
    wins.slice(0, 6).forEach(function(w) {{
        var opp = w.source === d.id ? w.target : w.source;
        var oppData = counterData.nodes.find(n => n.id === opp);
        lines.push((w.source === d.id ? '→ ' : '← ') + (oppData ? oppData.name : opp) + ': ' + w.winRate + '%');
    }});
    tooltip.style('display', 'block')
        .html(lines.join('<br>'))
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
}}).on('mouseout', function() {{
    tooltip.style('display', 'none');
}});

// 点击展开详情
node.on('click', function(event, d) {{
    showDetail(d);
}});

simulation.on('tick', () => {{
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
}});

function showDetail(d) {{
    var panel = document.getElementById('detail-panel');
    panel.style.display = 'block';
    document.getElementById('detail-name').textContent = d.name + ' — ' + d.tier + '级';

    var html = '<div class="detail-row"><span class="detail-label">Elo 评分</span><span class="detail-value">' + d.elo + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">总体胜率</span><span class="detail-value">' + d.winRate + '%</span></div>';

    var relatedLinks = counterData.links.filter(l => l.source === d.id || l.target === d.id);
    html += '<div style="margin-top:12px;font-weight:bold;color:#94a3b8;font-size:13px;border-bottom:1px solid #334155;padding-bottom:6px;">对战详情</div>';

    relatedLinks.forEach(function(l) {{
        var isSource = l.source === d.id;
        var oppId = isSource ? l.target : l.source;
        var oppData = counterData.nodes.find(n => n.id === oppId);
        var oppName = oppData ? oppData.name : oppId;
        html += '<div class="detail-row"><span class="detail-label">vs ' + oppName + '</span>' +
                '<span class="detail-value" style="color:' + (isSource ? '#22c55e' : '#ef4444') + ';">' +
                l.winRate + '% [' + l.ciLower + ', ' + l.ciUpper + '] n=' + l.nGames + '</span></div>';
    }});

    document.getElementById('detail-content').innerHTML = html;
}}

function closeDetail() {{
    document.getElementById('detail-panel').style.display = 'none';
}}
</script>
</body>
</html>'''
    return html


# ============ 6. D3.js 内嵌 ============

_D3JS_CACHE: Optional[str] = None

def _get_d3js() -> str:
    """获取 D3.js 库源代码（缓存 + 回退 CDN 内嵌）"""
    global _D3JS_CACHE
    if _D3JS_CACHE:
        return _D3JS_CACHE

    # 尝试从已下载的本地文件加载
    local_path = os.path.join(os.path.dirname(__file__), 'd3.v7.min.js')
    if os.path.exists(local_path):
        with open(local_path, 'r', encoding='utf-8') as f:
            _D3JS_CACHE = f.read()
            return _D3JS_CACHE

    # 从 CDN 下载
    d3_url = 'https://d3js.org/d3.v7.min.js'
    try:
        import requests
        print('  下载 D3.js...')
        resp = requests.get(d3_url, timeout=10)
        resp.raise_for_status()
        _D3JS_CACHE = resp.text
        # 缓存到本地
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(_D3JS_CACHE)
        print(f'  D3.js 已缓存 ({len(_D3JS_CACHE)} bytes)')
        return _D3JS_CACHE
    except Exception as e:
        print(f'  D3.js 下载失败: {e}，使用 CDN 链接')
        # 回退：返回从 CDN 加载的 <script> 标签
        _D3JS_CACHE = f'document.write(\'<script src="{d3_url}"><\\/script>\');'
        return _D3JS_CACHE


# ============ 7. 报告生成主函数 ============

def generate_report(
    loader,
    wins: np.ndarray,
    totals: np.ndarray,
    win_rate_matrix: np.ndarray,
    wi_lower: np.ndarray,
    wi_upper: np.ndarray,
    ci_lower_boot: np.ndarray,
    ci_upper_boot: np.ndarray,
    significance_matrix: np.ndarray,
    pair_tests: list,
    elo_ratings: list,
    glicko_ratings: list,
    tier_items: list,
    glicko_tier_items: list,
    strategy_names: list,
    strategy_wr: list,
    strategy_ci_lower: list,
    strategy_ci_upper: list,
    turns_array: np.ndarray,
    duration_array: np.ndarray,
    char_ids: list,
    char_names_list: list,
    source_file: str,
    output_path: str,
    gpu_mode: str = 'cpu',
):
    """生成完整 HTML 报告

    Args:
        loader: MatchLoader 实例
        wins, totals: 胜场/总数矩阵
        win_rate_matrix: 胜率矩阵 (%)
        wi_lower, wi_upper: Wilson CI
        ci_lower_boot, ci_upper_boot: Bootstrap CI (%)
        significance_matrix: BH-FDR 显著性矩阵
        pair_tests: 统计检验结果列表
        elo_ratings: EloRating 列表
        glicko_ratings: GlickoRating 列表
        tier_items: [(tier, name, elo, win_rate, bar_pct)]
        glicko_tier_items: [(tier, name, rating, rd)]
        strategy_names/strategy_wr/strategy_ci_*: 策略统计
        turns_array, duration_array: 原始数据
        char_ids, char_names_list: 角色信息
        source_file: 数据来源文件名
        output_path: 输出 HTML 路径
        gpu_mode: 'gpu (X.Xs)' 或 'cpu (X.Xs)'
    """
    t0 = time.time()

    from analysis.loader import CHARACTER_NAMES, CHARACTER_IDS

    # 构建指标
    metrics = {
        'total_games': loader.n_games,
        'avg_turns': round(float(np.mean(turns_array)), 1),
        'median_turns': int(np.median(turns_array)),
        'p95_duration': int(np.percentile(duration_array, 95)),
        'throughput': f'{gpu_mode}',
    }

    # 构建克制关系图数据
    elo_ratings_arr = [e.rating for e in elo_ratings]
    elo_ci_lower = [e.rating - 1.96 * 50 for e in elo_ratings]  # 近似 CI
    elo_ci_upper = [e.rating + 1.96 * 50 for e in elo_ratings]
    tier_labels = [t for t, *rest in tier_items]

    counter_data = build_counter_graph_data(
        win_rate_matrix, totals,
        ci_lower_boot, ci_upper_boot,
        elo_ratings_arr, elo_ci_lower, elo_ci_upper,
        tier_labels, char_ids, char_names_list,
        significance_matrix,
    )

    # 构建角色详情
    char_details = []
    for i, cid in enumerate(char_ids):
        matchups = []
        best_wr, best_name = -1, ''
        worst_wr, worst_name = 101, ''
        for j, cid2 in enumerate(char_ids):
            if i == j:
                continue
            if totals[i][j] == 0:
                continue
            m = {
                'name': CHARACTER_NAMES[cid2],
                'win_rate': round(win_rate_matrix[i][j], 1),
                'ci_lower': round(ci_lower_boot[i][j], 1),
                'ci_upper': round(ci_upper_boot[i][j], 1),
                'n_games': int(totals[i][j]),
            }
            matchups.append(m)
            if m['win_rate'] > best_wr:
                best_wr = m['win_rate']
                best_name = f'{m["name"]} ({m["win_rate"]}%)'
            if m['win_rate'] < worst_wr:
                worst_wr = m['win_rate']
                worst_name = f'{m["name"]} ({m["win_rate"]}%)'

        elo_item = next((e for e in elo_ratings if e.char_id == cid), None)
        tier = next((t for t, n, *rest in tier_items if n == CHARACTER_NAMES[cid]), 'B')
        char_details.append({
            'name': CHARACTER_NAMES[cid],
            'tier': tier,
            'elo': elo_item.rating if elo_item else 0,
            'win_rate': round(win_rate_matrix[i].sum() / totals[i].sum() * 100, 1) if totals[i].sum() > 0 else 0,
            'best_matchup': best_name,
            'worst_matchup': worst_name,
            'matchups': matchups,
        })

    # 配对统计
    pair_tests_dicts = []
    for t in pair_tests:
        pair_tests_dicts.append({
            'char_a_name': t.char_a_name,
            'char_b_name': t.char_b_name,
            'win_rate_a': t.win_rate_a,
            'wilson_lower': t.wilson_lower,
            'wilson_upper': t.wilson_upper,
            'p_value': t.p_value,
            'p_adjusted': t.p_adjusted,
            'cohens_h': t.cohens_h,
            'significant_bh': t.significant_bh,
        })

    # 配置信息
    config_info = {
        'source_file': os.path.basename(source_file),
        'policies': f'{len(strategy_names)} 个',
        'matchups': f'{9 * 8 // 2} 组角色组合',
        'seed': 'N/A',
        'date': time.strftime('%Y-%m-%d %H:%M'),
        'gpu': 'GPU' if 'gpu' in gpu_mode else 'CPU',
    }

    # 生成图表
    print('  生成热力图...')
    heatmap_b64 = plot_heatmap(win_rate_matrix, totals, char_names_list, significance_matrix)
    print('  生成策略对比图...')
    strategy_b64 = plot_strategy_chart(strategy_names, strategy_wr, strategy_ci_lower, strategy_ci_upper)
    print('  生成回合分布图...')
    turn_b64 = plot_turn_histogram(turns_array)

    # 获取 D3.js
    print('  获取 D3.js...')
    d3js = _get_d3js()

    # 生成 HTML
    print('  渲染 HTML...')
    html = _generate_html(
        metrics=metrics,
        tier_items=tier_items,
        heatmap_b64=heatmap_b64,
        strategy_b64=strategy_b64,
        turn_b64=turn_b64,
        counter_data=counter_data,
        pair_tests=pair_tests_dicts,
        char_details=char_details,
        config_info=config_info,
        glicko_items=glicko_tier_items,
        d3js_content=d3js,
    )

    # 写入文件
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    elapsed = time.time() - t0
    file_size_kb = os.path.getsize(output_path) / 1024
    print(f'  报告已生成: {output_path}')
    print(f'  文件大小: {file_size_kb:.0f} KB')
    print(f'  报告生成耗时: {elapsed:.1f}s')
