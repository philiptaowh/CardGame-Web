"""卡牌游戏图形化UI - 简化交互版"""

import PySimpleGUI as sg
import random
from typing import List, Optional

from card_game.core.game import CardGame, GamePhase, PlacedCard
from card_game.core.card import Card, EnergyCard, SpecialCard
from card_game.core.player import Player
from card_game.core.characters import get_all_characters


# ============ 配色方案 ============
THEME = {
    'background': '#1a1a2e',
    'card_bg': '#16213e',
    'player_bg': '#1f4068',
    'accent': '#e94560',
    'text': '#ffffff',
    'text_secondary': '#a0a0a0',
    'energy': '#f39c12',
    'special': '#9b59b6',
    'damage': '#e74c3c',
    'heal': '#27ae60',
    'shield': '#3498db',
}


def get_card_info(card: Card) -> tuple:
    """获取卡牌信息 (名称, 类型文本, 颜色)"""
    if isinstance(card, EnergyCard):
        type_text = "万能" if card.is_wild else f"{card.energy}能量"
        color = THEME['energy']
    elif isinstance(card, SpecialCard):
        type_text = "特殊"
        color = THEME['special']
    else:
        type_text = "角色"
        color = THEME['accent']
    return card.name, type_text, color


# ============ 玩家状态面板 ============

def create_player_panel(player: Player, is_opponent: bool = False) -> sg.Column:
    """创建玩家状态面板"""
    hp_percent = player.current_hp / player.max_hp
    hp_color = THEME['damage'] if hp_percent < 0.3 else THEME['heal']

    marks = player.marks.get_all_mark_names()
    marks_text = ", ".join(marks) if marks else "无"

    justify = 'r' if is_opponent else 'l'
    side = 'right' if is_opponent else 'left'

    layout = [
        [sg.Text(f"{player.name}", font=('Arial', 14, 'bold'), text_color=THEME['text'])],
        [sg.Text(f"【{player.character.name}】", font=('Arial', 11), text_color=THEME['text_secondary'])],
        [sg.Text(f"HP: {player.current_hp}/{player.max_hp}", font=('Arial', 14), text_color=hp_color)],
        [sg.ProgressBar(100, orientation='h', size=(25, 15), key=f'-HP_{side}-', pad=(0, 0))],
        [sg.Text(f"护盾: {player.shield}", font=('Arial', 10), text_color=THEME['shield'])],
        [sg.Text(f"印记: {marks_text}", font=('Arial', 9), text_color=THEME['text_secondary'], size=(30, 1))],
    ]

    return sg.Column(layout, element_justification=justify, pad=(15, 10),
                  background_color=THEME['player_bg'], key=f'-PLAYER_{side}-')


# ============ 主窗口类 ============

class CardGameUI:
    """卡牌游戏UI"""

    def __init__(self):
        self.game: Optional[CardGame] = None
        self.window: Optional[sg.Window] = None
        self.phase1_shown = False  # 标记阶段1弹窗是否已显示
        self.game_over = False  # 标记游戏是否已结束

    def create_main_window(self):
        """创建主窗口"""
        layout = [
            # 顶部：标题
            [
                sg.Text("卡牌游戏", font=('Arial', 20, 'bold'), text_color=THEME['accent']),
                sg.Text("", key='-TURN-', font=('Arial', 12), text_color=THEME['text_secondary']),
                sg.Text("", key='-PHASE-', font=('Arial', 12), text_color=THEME['text_secondary']),
            ],

            # 对手状态（简化显示）
            [sg.Frame("对手", [
                [sg.Text("", key='-OPP_STATUS-', font=('Arial', 12), text_color=THEME['text'])]
            ], background_color=THEME['player_bg'], title_color=THEME['text_secondary'], size=(700, 60))],

            # 桌面区
            [sg.Frame("桌面区", [
                [sg.Text("等待放置能量卡", key='-TABLE-', text_color=THEME['text_secondary'], font=('Arial', 12))]
            ], background_color=THEME['card_bg'], title_color=THEME['text_secondary'], size=(700, 60))],

            # 玩家手牌区（显示文本列表）
            [sg.Frame("我的手牌", [
                [sg.Text("", key='-HAND-', text_color=THEME['text'], font=('Arial', 11), size=(70, 3))]
            ], background_color=THEME['card_bg'], title_color=THEME['text_secondary'], size=(700, 80))],

            # 玩家状态（简化显示）
            [sg.Frame("你", [
                [sg.Text("", key='-PLAYER_STATUS-', font=('Arial', 12), text_color=THEME['text'])]
            ], background_color=THEME['player_bg'], title_color=THEME['text_secondary'], size=(700, 60))],

            # 操作按钮
            [
                sg.Button("使用技能", key='-BTN_SKILL-', size=(12, 2), button_color=(THEME['accent'], THEME['card_bg'])),
                sg.Button("使用特殊卡", key='-BTN_SPECIAL-', size=(12, 2), button_color=(THEME['special'], THEME['card_bg'])),
                sg.Button("结束行动", key='-BTN_END-', size=(12, 2), button_color=(THEME['text_secondary'], THEME['card_bg'])),
                sg.Button("帮助", key='-BTN_HELP-', size=(10, 2), button_color=(THEME['shield'], THEME['card_bg'])),
            ],

            # 日志区
            [sg.Frame("战斗日志", [
                [sg.Multiline('', key='-LOG-', size=(75, 12), disabled=True, autoscroll=True,
                        text_color=THEME['text'], background_color=THEME['background'],
                        font=('Consolas', 9))]
            ], background_color=THEME['card_bg'], title_color=THEME['text_secondary'], size=(700, 250))],
        ]

        self.window = sg.Window('卡牌游戏', layout, finalize=True,
                          background_color=THEME['background'], size=(800, 700))

    def update_all(self):
        """更新所有UI"""
        if not self.game or not self.window or self.game_over:
            return

        # 阶段名称
        phase_names = {
            GamePhase.START: "开局", GamePhase.PHASE1: "能量放置",
            GamePhase.PHASE2: "行动", GamePhase.PHASE3: "印记结算", GamePhase.END: "结束"
        }

        self.window['-TURN-'].update(f"回合: {self.game.turn_number}")
        self.window['-PHASE-'].update(f"阶段: {phase_names.get(self.game.phase, '?')}")

        # 对手状态 - 使用Text显示
        opponent = self.game.players.players[1]
        opp_hp_color = THEME['damage'] if opponent.current_hp / opponent.max_hp < 0.3 else THEME['heal']
        opp_marks = ", ".join(opponent.marks.get_all_mark_names()) if opponent.marks.active_marks else "无"
        opp_status = f"{opponent.name} 【{opponent.character.name}】 HP:{opponent.current_hp}/{opponent.max_hp} | 护盾:{opponent.shield} | 印记:{opp_marks}"
        self.window['-OPP_STATUS-'].update(opp_status, text_color=opp_hp_color)

        # 玩家状态 - 使用Text显示
        player = self.game.players.players[0]
        player_hp_color = THEME['damage'] if player.current_hp / player.max_hp < 0.3 else THEME['heal']
        player_marks = ", ".join(player.marks.get_all_mark_names()) if player.marks.active_marks else "无"
        player_status = f"{player.name} 【{player.character.name}】 HP:{player.current_hp}/{player.max_hp} | 护盾:{player.shield} | 印记:{player_marks}"
        self.window['-PLAYER_STATUS-'].update(player_status, text_color=player_hp_color)

        # 手牌显示
        self.update_hand()

        # 桌面显示
        self.update_table()

        # 按钮状态
        game_over = self.game.phase == GamePhase.END
        in_phase1 = self.game.phase == GamePhase.PHASE1
        in_phase2 = self.game.phase == GamePhase.PHASE2

        self.window['-BTN_SKILL-'].update(disabled=game_over or in_phase1)
        self.window['-BTN_SPECIAL-'].update(disabled=game_over or in_phase1)
        self.window['-BTN_END-'].update(disabled=game_over or in_phase1)

    def update_hand(self):
        """更新手牌显示"""
        player = self.game.players.players[0]

        if not player.hand:
            hand_text = "无手牌"
        else:
            cards = []
            for i, card in enumerate(player.hand):
                name, type_text, color = get_card_info(card)
                cards.append(f"{i+1}.{name}[{type_text}]")
            hand_text = " | ".join(cards)

        self.window['-HAND-'].update(hand_text)

    def update_table(self):
        """更新桌面显示"""
        if not self.game.placed_cards:
            table_text = "等待放置能量卡"
        else:
            cards = []
            for pc in self.game.placed_cards:
                cards.append(f"{pc.card.name}({pc.energy_value})")
            table_text = " | ".join(cards)

        self.window['-TABLE-'].update(table_text)

    def log(self, msg: str):
        """添加日志"""
        if self.window:
            current = self.window['-LOG-'].get() or ""
            self.window['-LOG-'].update(current + msg + "\n")

    def show_char_select(self) -> str:
        """角色选择"""
        chars = get_all_characters()

        layout = [
            [sg.Text("选择你的角色", font=('Arial', 16, 'bold'), text_color=THEME['accent'])],
        ]

        for i, char in enumerate(chars):
            skills = ", ".join([s.name for s in char.skills[:2]])
            layout.append([
                sg.Button(
                    f"{char.name} HP:{char.hp}\n{skills}",
                    key=f'-CHAR_{i}', size=(30, 2),
                    button_color=(THEME['text'], THEME['player_bg'])
                )
            ])

        window = sg.Window("选择角色", layout, finalize=True,
                        background_color=THEME['background'])
        event, _ = window.read()
        window.close()

        if event and event.startswith('-CHAR_'):
            return chars[int(event.split('_')[1])].card_id
        return 'char_1'

    def show_swap_select(self, player: Player, swap_count: int) -> int:
        """换卡选择"""
        if swap_count <= 0 or not player.hand:
            return -1

        layout = [
            [sg.Text(f"换卡阶段 ({swap_count}次)", font=('Arial', 14, 'bold'), text_color=THEME['accent'])],
            [sg.Text("选择要换出的卡牌:", text_color=THEME['text_secondary'])],
        ]

        for i, card in enumerate(player.hand):
            name, type_text, color = get_card_info(card)
            layout.append([
                sg.Button(
                    f"{i+1}. {name} [{type_text}]",
                    key=f'-SWAP_{i}', size=(25, 1),
                    button_color=(THEME['text'], THEME['card_bg'])
                )
            ])

        layout.append([sg.Button("跳过换卡", key='-SKIP-', button_color=(THEME['text_secondary'], THEME['card_bg']))])

        window = sg.Window("换卡", layout, finalize=True,
                        background_color=THEME['background'])
        event, _ = window.read()
        window.close()

        if event and event.startswith('-SWAP_'):
            return int(event.split('_')[1])
        return -1  # 跳过

    def show_skill_select(self) -> int:
        """技能选择"""
        player = self.game.players.players[0]
        skills = player.character.skills
        energy_cards = player.get_energy_cards()
        total_energy = sum(c.energy if not c.is_wild else 1 for c in energy_cards)

        layout = [
            [sg.Text("选择技能", font=('Arial', 14, 'bold'), text_color=THEME['accent'])],
        ]

        for i, skill in enumerate(skills):
            can_use = skill.energy_cost <= total_energy
            layout.append([
                sg.Button(
                    f"{skill.name} ({skill.energy_cost}能量)\n{skill.description}",
                    key=f'-SKILL_{i}', size=(35, 2),
                    button_color=(THEME['text'], THEME['player_bg']) if can_use
                              else (THEME['text_secondary'], THEME['card_bg']),
                    disabled=not can_use
                )
            ])

        layout.append([sg.Button("取消", key='-CANCEL-')])

        window = sg.Window("选择技能", layout, finalize=True,
                        background_color=THEME['background'])
        event, _ = window.read()
        window.close()

        if event and event.startswith('-SKILL_'):
            return int(event.split('_')[1])
        return -1

    def show_special_select(self) -> int:
        """特殊卡选择"""
        player = self.game.players.players[0]
        special_cards = player.get_special_cards()

        if not special_cards:
            sg.popup("没有特殊卡", background_color=THEME['background'])
            return -1

        layout = [
            [sg.Text("选择特殊卡", font=('Arial', 14, 'bold'), text_color=THEME['special'])],
        ]

        for i, card in enumerate(special_cards):
            layout.append([
                sg.Button(
                    f"{card.name}\n{card.description}",
                    key=f'-SPECIAL_{i}', size=(35, 2),
                    button_color=(THEME['text'], THEME['special'])
                )
            ])

        layout.append([sg.Button("取消", key='-CANCEL-')])

        window = sg.Window("选择特殊卡", layout, finalize=True,
                        background_color=THEME['background'])
        event, _ = window.read()
        window.close()

        if event and event.startswith('-SPECIAL_'):
            idx = int(event.split('_')[1])
            # 找到对应的手牌索引
            for i, card in enumerate(player.hand):
                if isinstance(card, SpecialCard) and card.effect_id == special_cards[idx].effect_id:
                    return i
        return -1

    def show_wild_select(self) -> int:
        """万能能量选择"""
        layout = [
            [sg.Text("选择能量值", font=('Arial', 14, 'bold'), text_color=THEME['energy'])],
        ]
        for i in range(1, 7):
            layout.append([sg.Button(f"{i}", key=f'-WILD_{i}', size=(8, 2),
                    button_color=(THEME['text'], THEME['energy']))])

        window = sg.Window("万能能量", layout, finalize=True,
                        background_color=THEME['background'])
        event, _ = window.read()
        window.close()

        if event and event.startswith('-WILD_'):
            return int(event.split('_')[1])
        return 1

    def show_energy_select(self) -> List[int]:
        """阶段1选择要放置的能量卡（多选）"""
        player = self.game.players.players[0]
        energy_cards = player.get_energy_cards()
        special_cards = player.get_special_cards()
        available = energy_cards + special_cards

        if not available:
            sg.popup("没有可放置的卡牌", background_color=THEME['background'])
            return []

        # 创建带Checkboxes的多选窗口
        layout = [
            [sg.Text("阶段1: 放置能量卡", font=('Arial', 14, 'bold'), text_color=THEME['accent'])],
            [sg.Text("选择要放置的卡牌（可多选）:", text_color=THEME['text_secondary'])],
        ]

        for i, card in enumerate(available):
            name, type_text, color = get_card_info(card)
            if isinstance(card, EnergyCard) and card.is_wild:
                type_text = "万能(1-6)"
            elif isinstance(card, EnergyCard):
                type_text = f"{card.energy}"
            else:
                type_text = "特殊(1)"

            # Checkbox用于多选
            layout.append([
                sg.Checkbox(f"{name} [{type_text}]", key=f'-SEL_{i}',
                        text_color=color, font=('Arial', 10))
            ])

        layout.append([
            sg.Button("确认提交", key='-SUBMIT-', button_color=(THEME['accent'], THEME['card_bg'])),
            sg.Button("跳过放置", key='-SKIP-', button_color=(THEME['text_secondary'], THEME['card_bg']))
        ])

        window = sg.Window("放置能量", layout, finalize=True,
                        background_color=THEME['background'])

        selected_indices = []
        while True:
            event, values = window.read()

            if event in (sg.WIN_CLOSED, '-SKIP-'):
                break
            elif event == '-SUBMIT-':
                # 收集选中的卡牌
                selected_indices = []
                for key, value in values.items():
                    if key.startswith('-SEL_') and value:
                        idx = int(key.split('_')[1])
                        selected_indices.append(idx)

                if selected_indices:
                    # 检查是否有万能能量需要选择能量值
                    for idx in selected_indices:
                        card = available[idx]
                        if isinstance(card, EnergyCard) and card.is_wild:
                            window.close()
                            wild_value = self.show_wild_select()
                            # 需要处理万能能量的能量值
                            # 这里简化处理，默认万能能量为1
                    break
                else:
                    # 没有选中任何卡，直接跳过
                    sg.popup("请先选择要放置的卡牌，或点击跳过", background_color=THEME['background'])
                    continue

        window.close()
        return selected_indices
        event, _ = window.read()
        window.close()

        if event and event.startswith('-ENERGY_'):
            # 需要找到这张卡在hand中的索引
            card_idx = int(event.split('_')[1])
            card = available[card_idx]
            # 找到hand中的实际索引
            for i, c in enumerate(player.hand):
                if c.card_id == card.card_id:
                    return i
        return -1  # 跳过

    def run_game_loop(self):
        """游戏主循环"""
        while True:
            event, _ = self.window.read(timeout=200)

            if event == sg.WIN_CLOSED:
                break

            # 按钮事件
            if event == '-BTN_SKILL-':
                result = self.handle_use_skill()
            elif event == '-BTN_SPECIAL-':
                result = self.handle_use_special()
            elif event == '-BTN_END-':
                self.handle_end_action()
            elif event == '-BTN_HELP-':
                self.show_help()

            # 检测阶段变化 - 进入阶段1时自动弹出窗口
            if self.game.phase == GamePhase.PHASE1 and not self.phase1_shown:
                self.phase1_shown = True
                self.handle_confirm()

            # 更新
            self.update_all()

            # AI行动
            if self.game.phase != GamePhase.END:
                self.run_ai_turn()

            # 游戏结束
            if self.game.is_game_over():
                self.show_game_over()
                break

        self.window.close()

    def handle_use_skill(self):
        """使用技能"""
        player = self.game.players.players[0]
        opponent = self.game.players.players[1]

        skill_idx = self.show_skill_select()
        if skill_idx < 0:
            return

        skill = player.character.skills[skill_idx]
        self.game._execute_skill(skill, player, opponent)
        self.log(f"[你] 使用了 {skill.name}")

        # 即时检查胜负
        if self.game.check_win_instant():
            self.game_over = True
            self.log(f"=== 游戏结束 ===")
            self.show_game_over()
            self.window.close()
            return True
        return False

    def handle_use_special(self):
        """使用特殊卡"""
        player = self.game.players.players[0]
        opponent = self.game.players.players[1]

        card_idx = self.show_special_select()
        if card_idx < 0:
            return

        card = player.hand[card_idx]
        self.game._execute_special_card(card, player, opponent)
        player.discard_card(card_idx)
        self.log(f"[你] 使用了 {card.name}")

        # 即时检查胜负
        if self.game.check_win_instant():
            self.game_over = True
            self.log(f"=== 游戏结束 ===")
            self.show_game_over()
            self.window.close()
            return True
        return False

    def handle_end_action(self):
        """结束行动"""
        player = self.game.players.players[0]
        player.has_acted = True
        self.log(f"[你] 结束行动")

        # 进入下一玩家
        self.game.current_action_index += 1

        # 如果所有玩家都行动完了，进入阶段3并自动进入下一回合
        if self.game.current_action_index >= len(self.game.action_order):
            self.game.phase = GamePhase.PHASE3
            # 印记结算
            self.game.phase3_mark_resolution()
            self.log(f"=== 第 {self.game.turn_number} 回合结束 ===")

            # 检查游戏结束
            if self.game.is_game_over():
                return

            # 重置并进入下一回合（回合数在最后才增加）
            self.game.phase = GamePhase.PHASE1
            self.game.current_action_index = 0
            self.game.placed_cards = []

            # 重置玩家状态
            for p in self.game.players.players:
                p.reset_turn_state()
                p.apply_buffs()

            self.log(f"=== 第 {self.game.turn_number} 回合 - 阶段1 ===")

    def handle_confirm(self):
        """确认放置 - 阶段1能量放置"""
        # 清理上一回合的放置卡（每个回合都是新的放置）
        self.game.placed_cards = []

        # 步骤1: 检查玩家是否已放置能量卡
        player = self.game.players.players[0]
        opponent = self.game.players.players[1]

        # 多选窗口返回索引列表
        selected_indices = self.show_energy_select()

        if selected_indices:
            # 获取available列表
            energy_cards = player.get_energy_cards()
            special_cards = player.get_special_cards()
            available = energy_cards + special_cards

            total_energy = 0
            for idx in selected_indices:
                card = player.hand[idx]

                # 万能能量需要选择能量值
                energy_value = 1
                if isinstance(card, EnergyCard) and card.is_wild:
                    energy_value = self.show_wild_select()

                # 移除并放置
                player.remove_card_from_hand(idx)
                self.game.placed_cards.append(PlacedCard(player, card, energy_value))
                total_energy += energy_value
                self.log(f"[你] 放置了 {card.name} ({energy_value}能量)")

            self.log(f"[你] 共放置 {len(selected_indices)} 张牌，总能量 {total_energy}")
        else:
            self.log(f"[你] 跳过放置")

        # 步骤2: AI放置能量卡
        self.game._ai_place_energy(opponent)

        # 步骤3: 揭示并计算行动顺序
        if self.game.placed_cards:
            self.game._resolve_action_order()
            self.log(f"=== 行动顺序: {[p.name for p in self.game.action_order]} ===")

        # 步骤4: 进入阶段2（给所有行动玩家抽卡）
        self.game.phase = GamePhase.PHASE2
        self.phase1_shown = False  # 重置标记，下次进入阶段1时弹窗

        # 所有行动玩家抽卡（非第一回合）
        if self.game.turn_number > 1:
            for p in self.game.players.players:
                if not p.marks.has_mark("失明"):
                    p.draw_cards(2)
                    self.log(f"[{p.name}] 抽2张牌")

        self.log(f"=== 阶段2: 行动（双方） ===")

    def run_ai_turn(self):
        """AI行动"""
        if not self.game:
            return

        # 等玩家先行动
        if self.game.phase == GamePhase.PHASE1:
            return

        if self.game.phase == GamePhase.PHASE2:
            idx = self.game.current_action_index
            if idx >= len(self.game.action_order):
                return

            current = self.game.action_order[idx]
            if current.player_id != 2:  # 不是AI
                return

            opponent = self.game.players.players[0]
            self.game._ai_action(current, opponent)
            self.log(f"[AI] 行动完毕")

            # AI行动后即时检查胜负
            if self.game.check_win_instant():
                self.log(f"=== 游戏结束 ===")
                self.show_game_over()
                self.window.close()
                return

            current.has_acted = True
            self.game.current_action_index += 1

            if self.game.current_action_index >= len(self.game.action_order):
                self.game.phase = GamePhase.PHASE3
                # 自动进入阶段3
                self.game.phase3_mark_resolution()
                self.log(f"=== 第 {self.game.turn_number} 回合结束 ===")

                # 检查游戏结束
                if self.game.is_game_over():
                    return

                # 重置并进入下一回合（回合数在最后才增加）
                self.game.turn_number += 1  # 阶段3结束后才增加回合数
                self.game.phase = GamePhase.PHASE1
                self.game.current_action_index = 0
                self.game.placed_cards = []

                # 重置玩家状态
                for player in self.game.players.players:
                    player.reset_turn_state()
                    player.apply_buffs()

                self.log(f"=== 第 {self.game.turn_number} 回合 - 阶段1 ===")

        if self.game.phase == GamePhase.PHASE3:
            # 阶段3也已经自动处理
            pass

    def show_help(self):
        """显示帮助弹窗"""
        from card_game.core.characters import CHARACTERS

        # 游戏规则（详细完整版）
        rules_text = """【回合阶段】
• 阶段1-能量放置：玩家从手牌中选择能量卡/特殊卡背面朝下放置，决定行动顺序
• 阶段2-行动：按顺序使用技能或特殊卡，非第一回合每人抽2张卡
• 阶段3-印记结算：结算所有印记效果

【卡牌类型】
■ 能量卡(抽卡概率)：
  1能量卡(40%)：提供1点能量
  2能量卡(30%)：提供2点能量
  3能量卡(15%)：提供3点能量
  万能能量(5%)：提供1-6点能量(作为技能条件时可为任意能量)
  特殊卡(10%)：16种特殊效果卡

■ 特殊卡效果(16种)：
  特殊卡1：平分双方血量
  特殊卡2：血量低于一半时回复1/4血量+抽2张卡
  特殊卡3：获得对方1张手牌
  特殊卡4：令对方弃置2张手牌
  特殊卡5：弃1张手牌，下回合先手
  特殊卡6：自己从卡组抽2张卡
  特殊卡7：弃2张手牌，从卡组抽4张卡
  特殊卡8：给自己附加"治疗"印记4回合
  特殊卡9：给自己附加"无垢"印记2回合
  特殊卡10：给自己附加"庇佑"印记4回合
  特殊卡11：给自己附加"鼓舞"印记3回合
  特殊卡12：给自己附加"灵感"印记2回合
  特殊卡13：对场上的所有其他玩家附加"流血"印记2回合
  特殊卡14：回复自己3点血量，令对方附加"中毒"印记3回合
  特殊卡15：令对方附加"诅咒"印记1回合
  特殊卡16：令对方受到当前回合数点伤害+穿透

【专有名词定义】
• 血量(HP)：归0即死亡，上限为初始血量
• 伤害：令目标扣血，最小为0
• 回复：令目标加血，不超过初始血量
• 护盾：抵消伤害，护盾归零失效，不阻挡穿透
• 穿透：无视护盾直接扣血

【印记效果】
■ 正面印记：
  治疗：每回合回复4点血量
  无垢：使所有负面印记失效
  庇佑：每回合获得4点护盾
  鼓舞：下回合所有伤害+2
  灵感：下回合从卡组抽1张卡

■ 负面印记：
  失明：下回合行动开始时无法抽卡
  睡眠：回复2点血量，下回合无法行动
  混乱：下回合选择目标时序号+1(循环)
  失神：下回合每次使用技能需弃1张手牌
  弱化：下回合所有伤害-2
  流血：每回合受到4点伤害
  中毒：每回合受到2点伤害
  诅咒：每回合受到4点穿透

【血战模式】
当回合数>20时进入血战期：
• 所有玩家在阶段3印记结算完后
• 额外受到20点穿透伤害
• 血战将大幅加快游戏节奏

【胜利条件】
• 玩家血量归0判负
• 最后存活者获胜
• 同时死亡判平局"""

        # 界面操作
        ui_guide = """【界面操作】
• 点击"帮助"按钮查看本规则说明
• 阶段1：勾选手牌中的能量卡/特殊卡放置
• 阶段2：使用技能消耗能量，或使用特殊卡
• 点击"结束行动"切换到下一玩家"""

        # 角色技能 - 完整详细版
        chars_layout = []
        for char in CHARACTERS.values():
            skills_lines = []
            for s in char.skills:
                skills_lines.append(f"  {s.energy_cost}能量 {s.name}: {s.description}")

            chars_layout.append([
                sg.Text(f"【{char.name}】 HP:{char.hp}", font=('Arial', 10, 'bold'), text_color=THEME['accent'])
            ])
            for line in skills_lines:
                chars_layout.append([
                    sg.Text(line, font=('Arial', 8), text_color=THEME['text'])
                ])
            chars_layout.append([sg.Text("")])  # 间距

        # 布局 - 游戏规则使用滚动区域
        rules_layout = [[sg.Text(rules_text, font=('Arial', 8), text_color=THEME['text'])]]

        layout = [
            [sg.Text("游戏帮助", font=('Arial', 16, 'bold'), text_color=THEME['accent'])],

            [sg.Text("游戏规则", font=('Arial', 12, 'bold'), text_color=THEME['energy'])],
            [sg.Frame("游戏规则", [
                [sg.Column(rules_layout, scrollable=True, vertical_scroll_only=True, size=(400, 280))]
            ], background_color=THEME['card_bg'], title_color=THEME['text_secondary'])],

            [sg.Text("界面操作", font=('Arial', 12, 'bold'), text_color=THEME['energy'])],
            [sg.Text(ui_guide, font=('Arial', 9), text_color=THEME['text'], size=(40, 3))],

            [sg.Text("角色技能", font=('Arial', 12, 'bold'), text_color=THEME['energy'])],
            [sg.Frame("角色技能", [
                [sg.Column(chars_layout, scrollable=True, vertical_scroll_only=True, size=(400, 250))]
            ], background_color=THEME['card_bg'], title_color=THEME['text_secondary'])],

            [sg.Button("关闭", key='-CLOSE-', button_color=(THEME['text_secondary'], THEME['card_bg']))]
        ]

        window = sg.Window("帮助", layout, finalize=True,
                        background_color=THEME['background'], size=(450, 700))
        event, _ = window.read()
        window.close()

    def start(self):
        """启动游戏"""
        # 角色选择
        player_char = self.show_char_select()
        ai_char = f"char_{random.randint(1, 9)}"

        # 初始化游戏
        self.game = CardGame()
        self.game.start_game(player_char, ai_char)

        # 换卡阶段（玩家手动换卡）
        player = self.game.players.players[0]
        swap_count = min(player.position - 1, 4)

        if swap_count > 0:
            self.log(f"换卡阶段 ({swap_count}次)")
            for _ in range(swap_count):
                if not player.hand:
                    break
                idx = self.show_swap_select(player, swap_count)
                if idx < 0:
                    break
                card = player.remove_card_from_hand(idx)
                player.deck.put_on_bottom(card)
                drawn = player.draw_cards(1)
                self.log(f"换出 {card.name}，抽到 {drawn[0].name}")
                swap_count -= 1

        # 创建窗口
        self.create_main_window()

        # 游戏信息
        self.log(f"你选择了 {player.character.name}")
        self.log(f"AI选择了 {self.game.players.players[1].character.name}")
        self.log(f"=== 第 {self.game.turn_number} 回合 ===")

        # 运行
        self.run_game_loop()

    def show_game_over(self):
        """游戏结束"""
        if self.game.winner:
            if self.game.winner.player_id == 1:
                sg.popup("恭喜！你赢了！", background_color=THEME['background'],
                      title="游戏结束")
            else:
                sg.popup("AI获胜！", background_color=THEME['background'],
                      title="游戏结束")
        else:
            sg.popup("平局！", background_color=THEME['background'],
                  title="游戏结束")


def main():
    """主函数"""
    ui = CardGameUI()
    ui.start()


if __name__ == "__main__":
    main()