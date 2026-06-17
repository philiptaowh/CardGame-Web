"""游戏核心逻辑"""

import random
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass, field
from enum import Enum

from card_game.core.card import Card, CharacterCard, EnergyCard, SpecialCard
from card_game.core.deck import Deck, create_game_deck
from card_game.core.characters import CHARACTERS, get_all_characters
from card_game.core.marks import MarkManager, MARKS, MarkType, get_mark_definition
from card_game.core.player import Player, PlayerManager


class GamePhase(Enum):
    """游戏阶段"""
    START = "start"         # 开局
    PHASE1 = "phase1"       # 能量放置
    PHASE2 = "phase2"       # 行动阶段
    PHASE3 = "phase3"       # 印记结算
    END = "end"           # 游戏结束


@dataclass
class PlacedCard:
    """放置的卡牌"""
    player: Player
    card: Card
    energy_value: int = 1  # 能量值（万能能量卡为1-6可调）


class CardGame:
    """卡牌游戏"""

    def __init__(self):
        self.players = PlayerManager()
        self.turn_number: int = 0
        self.phase: GamePhase = GamePhase.START
        self.placed_cards: List[PlacedCard] = []  # 阶段1放置的卡牌
        self.action_order: List[Player] = []      # 行动顺序
        self.current_action_index: int = 0
        self.winner: Optional[Player] = None
        self.is_blood_war: bool = False  # 血战模式

    def start_game(self, player_character: str, ai_character: str = None):
        """开始游戏"""
        # 创建牌组（两位玩家各一副）
        deck1 = create_game_deck()
        deck2 = create_game_deck()

        # 创建玩家
        player1 = Player(player_id=1, name="玩家", is_ai=False)
        player2 = Player(player_id=2, name="AI", is_ai=True)

        # AI随机角色
        if ai_character is None:
            ai_character = random.choice(list(CHARACTERS.keys()))

        # 选择角色
        char1 = CHARACTERS[player_character]
        char2 = CHARACTERS[ai_character]

        player1.initialize(char1, deck1, position=1)
        player2.initialize(char2, deck2, position=2)

        self.players.add_player(player1)
        self.players.add_player(player2)

        # 开局抽卡
        print("\n=== 开局阶段 ===")
        for player in self.players.players:
            drawn = player.draw_cards(4)
            print(f"{player.name} 抽到 {len(drawn)} 张牌")

        # 换卡（n-1次，n为位置号，最大4）
        self._do_card_swap()

        # 重洗卡组
        for player in self.players.players:
            if player.deck:
                player.deck.shuffle()

        self.turn_number = 1
        self.phase = GamePhase.PHASE1
        print(f"\n=== 第 {self.turn_number} 回合 - 阶段1 ===")

    def _do_card_swap(self):
        """换卡阶段"""
        for player in self.players.players:
            swap_count = min(player.position - 1, 4)  # n-1次，最多4
            if swap_count <= 0:
                continue

            print(f"\n=== {player.name} 换卡阶段 ({swap_count}次) ===")
            if player.is_ai:
                # AI自动换卡
                self._ai_swap_cards(player, swap_count)
            else:
                # 玩家手动换卡
                self._player_swap_cards(player, swap_count)

    def _player_swap_cards(self, player: Player, swap_count: int):
        """玩家换卡"""
        for _ in range(swap_count):
            if player.has_no_hand():
                break

            print(f"\n当前手牌:")
            for i, card in enumerate(player.hand):
                print(f"  {i+1}. {card.name}")

            # 选择要换出的卡
            choice = input("选择要换出的卡牌编号 (0跳过): ").strip()
            if choice == "0" or not choice:
                break
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(player.hand):
                    card = player.remove_card_from_hand(idx)
                    player.deck.put_on_bottom(card)
                    drawn = player.draw_cards(1)
                    print(f"换出 {card.name}，抽到 {drawn[0].name}")
                else:
                    print("无效选择")
            except ValueError:
                print("请输入有效编号")

    def _ai_swap_cards(self, player: Player, swap_count: int):
        """AI换卡"""
        # 简单AI：随机换1-2张
        if player.has_no_hand():
            return

        swap_actual = min(swap_count, random.randint(1, 2), len(player.hand))
        indices = random.sample(range(len(player.hand)), swap_actual)

        for idx in sorted(indices, reverse=True):
            card = player.remove_card_from_hand(idx)
            player.deck.put_on_bottom(card)

        drawn = player.draw_cards(swap_actual)
        print(f"AI 换掉 {swap_actual} 张牌")

    def _calculate_energy_value(self, card: Card) -> int:
        """计算卡牌的能量值"""
        if isinstance(card, EnergyCard):
            if card.is_wild:
                return 1  # 万能能量默认为1，使用时可在1-6之间选择
            return card.energy
        return 1  # 特殊卡也算1点能量

    # ============ 阶段1：能量放置 ============

    def phase1_energy_placement(self):
        """阶段1：能量放置"""
        self.placed_cards = []
        self.action_order = []

        print("\n=== 阶段1：放置能量卡 ===")

        for player in self.players.players:
            if player.is_ai:
                self._ai_place_energy(player)
            else:
                self._player_place_energy(player)

        # 揭示并计算行动顺序
        print("\n揭示卡牌...")
        self._resolve_action_order()

        self.phase = GamePhase.PHASE2
        print(f"\n=== 第 {self.turn_number} 回合 - 阶段2（行动） ===")

    def _player_place_energy(self, player: Player):
        """玩家放置能量卡"""
        print(f"\n{player.name} 选择要放置的能量卡:")
        energy_cards = player.get_energy_cards()
        special_cards = player.get_special_cards()
        available = energy_cards + special_cards

        if not available:
            print("没有可放置的卡牌")
            return

        # 显示可放置的卡
        for i, card in enumerate(available):
            energy = self._calculate_energy_value(card)
            card_type = "能量" if isinstance(card, EnergyCard) else "特殊"
            print(f"  {i+1}. {card.name} ({card_type}, {energy}能量)")

        choice = input("选择卡牌编号 (0跳过): ").strip()
        if choice == "0" or not choice:
            return

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(available):
                card = available[idx]
                energy_val = self._calculate_energy_value(card)

                # 如果是万能能量，选择实际能量值
                if isinstance(card, EnergyCard) and card.is_wild:
                    while True:
                        try:
                            energy_val = int(input("万能能量卡，输入实际能量值(1-6): "))
                            if 1 <= energy_val <= 6:
                                break
                            print("请输入1-6之间的数字")
                        except ValueError:
                            pass

                # 移除手牌，加入放置区
                player.remove_card_from_hand(player.hand.index(card))
                self.placed_cards.append(PlacedCard(player, card, energy_val))
                print(f"放置: {card.name} ({energy_val}能量)")
        except ValueError:
            print("无效选择")

    def _ai_place_energy(self, player: Player):
        """AI放置能量卡"""
        energy_cards = player.get_energy_cards()
        special_cards = player.get_special_cards()
        available = energy_cards + special_cards

        if not available:
            return

        # 简单AI：随机选一张能量卡，优先选能量值高的
        energy_only = [c for c in available if isinstance(c, EnergyCard)]
        if energy_only:
            card = max(energy_only, key=lambda c: c.energy if not c.is_wild else 6)
        else:
            card = random.choice(available)

        energy_val = self._calculate_energy_value(card)
        if isinstance(card, EnergyCard) and card.is_wild:
            energy_val = random.randint(1, 6)

        player.remove_card_from_hand(player.hand.index(card))
        self.placed_cards.append(PlacedCard(player, card, energy_val))
        print(f"AI 放置: {card.name} ({energy_val}能量)")

    def _resolve_action_order(self):
        """计算行动顺序"""
        # 按能量值从大到小排序
        self.placed_cards.sort(key=lambda x: x.energy_value, reverse=True)

        # 处理能量值相同的情况
        same_energy = {}
        for pc in self.placed_cards:
            key = pc.energy_value
            if key not in same_energy:
                same_energy[key] = []
            same_energy[key].append(pc)

        # 构建行动顺序（所有玩家都能行动，没放卡的能量值为0）
        self.action_order = []
        players_in_game = {p.player_id: p for p in self.players.players}

        # 已放置的玩家按能量值排序
        for energy_val in sorted(same_energy.keys(), reverse=True):
            players_in_order = sorted(same_energy[energy_val], key=lambda x: x.player.position)
            for pc in players_in_order:
                self.action_order.append(pc.player)
                del players_in_game[pc.player.player_id]
                print(f"  {pc.player.name}: {pc.card.name} ({pc.energy_value}能量)")

        # 没放置的玩家（能量值为0）按位置号排序
        for player in players_in_game.values():
            self.action_order.append(player)
            print(f"  {player.name}: 跳过放置 (0能量)")

        # 弃置放置的卡牌
        for pc in self.placed_cards:
            pc.player.deck.add_to_discard([pc.card])

    # ============ 阶段2：行动阶段 ============

    def phase2_action(self):
        """阶段2：行动阶段"""
        if not self.action_order:
            self.phase = GamePhase.PHASE3
            return

        current_player = self.action_order[self.current_action_index]
        opponent = self.players.get_opponent(current_player)

        # 除了第一回合，行动开始时抽2张卡
        if self.turn_number > 1 and not current_player.marks.has_mark("失明"):
            current_player.draw_cards(2)

        # 检查是否有失明印记（下一回合行动开始时无法抽卡）
        if current_player.marks.has_mark("失明"):
            # 失明印记在本回合抽卡阶段生效
            pass  # 暂时不处理

        # 检查是否有睡眠印记（下一回合无法行动）
        if current_player.marks.has_mark("睡眠"):
            print(f"\n{current_player.name} 处于睡眠状态，无法行动！")
            current_player.has_acted = True
            self.current_action_index += 1
            self.phase = GamePhase.PHASE3 if self.current_action_index >= len(self.action_order) else GamePhase.PHASE2
            return

        print(f"\n=== {current_player.name} 的行动 ===")
        print(f"HP: {current_player.current_hp}/{current_player.max_hp} 护盾: {current_player.shield}")

        if current_player.is_ai:
            self._ai_action(current_player, opponent)
        else:
            self._player_action(current_player, opponent)

        current_player.has_acted = True
        self.current_action_index += 1

        if self.current_action_index >= len(self.action_order):
            self.phase = GamePhase.PHASE3

    def _player_action(self, player: Player, opponent: Player):
        """玩家行动"""
        while True:
            print(f"\n当前手牌:")
            for i, card in enumerate(player.hand):
                card_type = ""
                if isinstance(card, EnergyCard):
                    card_type = f"[{card.energy}]"
                elif isinstance(card, SpecialCard):
                    card_type = f"[特殊]"
                print(f"  {i+1}. {card.name} {card_type}")

            print("\n选择行动:")
            print("  1. 使用角色技能")
            print("  2. 使用特殊卡")
            print("  3. 宣言结束行动")
            choice = input("> ").strip()

            if choice == "3":
                print("行动结束")
                break
            elif choice == "1":
                self._use_skill_choice(player, opponent)
            elif choice == "2":
                self._use_special_card_choice(player, opponent)
            else:
                print("无效选择")

    def _ai_action(self, player: Player, opponent: Player):
        """AI行动"""
        skills_used = 0

        # 简单AI：随机使用技能
        while random.random() > 0.3:  # 70%概率继续
            skills = player.character.skills
            if not skills:
                break

            # 找可用的技能
            available_energy = player.get_energy_cards()
            total_energy = sum(self._calculate_energy_value(c) for c in available_energy)

            usable_skills = [s for s in skills if s.energy_cost <= total_energy]
            if not usable_skills:
                break

            skill = random.choice(usable_skills)
            print(f"AI 使用技能: {skill.name}")

            self._execute_skill(skill, player, opponent)
            skills_used += 1

            if player.has_no_hand():
                break

        print(f"AI 宣言结束行动 (使用{skills_used}个技能)")

    def _use_skill_choice(self, player: Player, opponent: Player):
        """选择使用技能"""
        skills = player.character.skills

        # 检查是否已达使用次数上限
        skill_uses = {}  # {(skill_name): used_count}
        for skill in skills:
            if skill.max_uses_per_turn:
                if skill.name not in skill_uses:
                    skill_uses[skill.name] = 0
                skill_uses[skill.name] += 1

        print("\n可用技能:")
        player_energy = player.get_energy_cards()
        total_energy = sum(self._calculate_energy_value(c) for c in player_energy)

        for i, skill in enumerate(skills):
            # 检查次数限制
            uses_info = ""
            if skill.max_uses_per_turn:
                used = skill_uses.get(skill.name, 0)
                if used >= skill.max_uses_per_turn:
                    uses_info = " (已达上限)"
                else:
                    uses_info = f" ({used}/{skill.max_uses_per_turn})"

            cost_info = f"{skill.energy_cost}能量" if skill.energy_cost <= total_energy else f"{skill.energy_cost}能量(不足)"
            print(f"  {i+1}. {skill.name} - {cost_info}{uses_info}")
            print(f"     {skill.description}")

        choice = input("选择技能编号 (0返回): ").strip()
        if choice == "0":
            return

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(skills):
                skill = skills[idx]
                if skill.energy_cost > total_energy:
                    print("能量不足!")
                    return

                # 检查次数限制
                if skill.max_uses_per_turn:
                    used = skill_uses.get(skill.name, 0)
                    if used >= skill.max_uses_per_turn:
                        print("已达使用上限!")
                        return

                self._execute_skill(skill, player, opponent)
        except ValueError:
            pass

    def _execute_skill(self, skill, player: Player, opponent: Player):
        """执行技能效果"""
        # 消耗能量
        energy_needed = skill.energy_cost
        energy_cards = player.get_energy_cards()

        for card in energy_cards:
            if energy_needed <= 0:
                break
            actual_energy = self._calculate_energy_value(card)
            if actual_energy >= energy_needed:
                # 整张卡消耗
                player.discard_card(player.hand.index(card))
                energy_needed = 0
            else:
                # 部分消耗（简化：整张卡消耗）
                player.discard_card(player.hand.index(card))
                energy_needed -= actual_energy

        # 执行效果（简化版）
        skill_name = skill.name

        # 获取额外加成
        dmg_bonus = player.extra_damage_next_turn
        pen_bonus = player.extra_penetration_next_turn
        heal_bonus = player.extra_heal_next_turn

        # ==== 角色技能效果 ====
        if player.character.name == "平衡":
            if skill_name == "攻击":
                opponent.take_damage(3 + dmg_bonus)
                print(f"  → {opponent.name} 受到 {3 + dmg_bonus} 点伤害")
            elif skill_name == "回复":
                player.heal(4 + heal_bonus)
                print(f"  → {player.name} 回复 {4 + heal_bonus} 点血量")
            elif skill_name == "强化":
                player.marks.add_mark("无垢", 2)
                player.marks.add_mark("灵感", 2)
                print(f"  → {player.name} 附加 无垢、灵感 印记2回合")
            elif skill_name == "抽牌攻击":
                opponent.take_damage(8 + dmg_bonus)
                opponent.take_penetration(4 + pen_bonus)
                player.draw_cards(1)
                print(f"  → {opponent.name} 受到 {8 + dmg_bonus} 伤害, {4 + pen_bonus} 穿透")
                print(f"  → {player.name} 抽1张牌")

        elif player.character.name == "防御":
            if skill_name == "护盾":
                opponent.take_damage(1 + dmg_bonus)
                player.add_shield(2)
                print(f"  → {opponent.name} 受到 {1 + dmg_bonus} 点伤害")
                print(f"  → {player.name} 获得 2 护盾")
            elif skill_name == "铁壁":
                player.add_shield(6)
                print(f"  → {player.name} 获得 6 护盾")
            elif skill_name == "庇佑":
                player.marks.add_mark("庇佑", 3)
                print(f"  → {player.name} 附加 庇佑 印记3回合")
            elif skill_name == "猛攻":
                opponent.take_damage(12 + dmg_bonus)
                if opponent.has_no_hand():
                    opponent.take_penetration(12 + pen_bonus)
                    print(f"  → {opponent.name} 受到 {12 + pen_bonus} 穿透")
                else:
                    heal = player.shield // 2
                    player.heal(heal)
                    print(f"  → {player.name} 回复 {heal} 点血量")

        elif player.character.name == "进攻":
            if skill_name == "斩击":
                opponent.take_damage(3 + dmg_bonus)
                print(f"  → {opponent.name} 受到 {3 + dmg_bonus} 点伤害")
            elif skill_name == "穿刺":
                opponent.take_damage(4 + dmg_bonus)
                opponent.take_penetration(2 + pen_bonus)
                print(f"  → {opponent.name} 受到 {4 + dmg_bonus} 伤害, {2 + pen_bonus} 穿透")
            elif skill_name == "猛砍":
                opponent.take_damage(6 + dmg_bonus)
                player.draw_cards(1)
                print(f"  → {opponent.name} 受到 {6 + dmg_bonus} 点伤害")
                print(f"  → {player.name} 抽1张牌")
            elif skill_name == "毁灭":
                opponent.take_damage(12 + dmg_bonus)
                opponent.take_penetration(6 + pen_bonus)
                if opponent.current_hp > player.current_hp:
                    opponent.take_penetration(18 + pen_bonus)
                    print(f"  → {opponent.name} 额外受到 {18 + pen_bonus} 穿透")

        elif player.character.name == "强化":
            if skill_name == "增伤":
                opponent.take_damage(1 + dmg_bonus)
                player.extra_damage_next_turn += 3
                print(f"  → {opponent.name} 受到 {1 + dmg_bonus} 点伤害")
                print(f"  → 下一回合伤害+3")
            elif skill_name == "治疗加成":
                player.extra_heal_next_turn += 2
                print(f"  → 下一回合回复+2")
            elif skill_name == "双重强化":
                opponent.take_damage(3 + dmg_bonus)
                player.heal(3 + heal_bonus)
                player.extra_damage_next_turn += 3
                player.extra_heal_next_turn += 3
                print(f"  → {opponent.name} 受到 {3 + dmg_bonus} 点伤害")
                print(f"  → {player.name} 回复 {3 + heal_bonus} 点血量")
            elif skill_name == "终极强化":
                player.extra_damage_next_turn += 6
                player.draw_cards(1)
                print(f"  → 下一回合伤害+6")
                print(f"  → {player.name} 抽1张牌")

        elif player.character.name == "先手":
            if skill_name == "先攻":
                opponent.take_damage(2 + dmg_bonus)
                if not opponent.has_acted:
                    opponent.take_damage(2 + dmg_bonus)
                    print(f"  → 追加2点伤害（共{4 + 2*dmg_bonus}）")
            elif skill_name == "抢先":
                opponent.take_damage(2 + dmg_bonus)
                if not opponent.has_acted:
                    player.draw_cards(1)
                    print(f"  → 抽1张牌")
            elif skill_name == "突袭":
                opponent.take_damage(3 + dmg_bonus)
                opponent.take_penetration(3 + pen_bonus)
                if not opponent.has_acted:
                    player.marks.add_mark("鼓舞", 1)
                    print(f"  → 附加鼓舞印记")
            elif skill_name == "致盲":
                player.marks.add_mark("失明", 1)
                if opponent.has_acted:
                    player.marks.add_mark("睡眠", 1)
                player.extra_damage_next_turn += 2

        elif player.character.name == "持久":
            if skill_name == "毒刃":
                opponent.take_penetration(1 + pen_bonus)
                player.heal(2 + heal_bonus)
                print(f"  → {opponent.name} 受到 {1 + pen_bonus} 点穿透")
                print(f"  → {player.name} 回复 {2 + heal_bonus} 血量")
            elif skill_name == "剧毒":
                opponent.marks.add_mark("中毒", 1)
                player.heal(2 + heal_bonus)
                if opponent.marks.has_mark("中毒"):
                    opponent.take_penetration(3 + pen_bonus)
                    print(f"  → 追加3点穿透")
            elif skill_name == "诅咒":
                opponent.marks.add_mark("诅咒", 3)
                player.marks.add_mark("治疗", 3)
                print(f"  → {opponent.name} 附加 诅咒 印记")
                print(f"  → {player.name} 附加 治疗 印记")
            elif skill_name == "衰败":
                opponent.marks.add_mark("弱化", 1)
                if self.turn_number > 12:
                    damage = self.turn_number // 2 + 6
                    opponent.take_penetration(damage + pen_bonus)
                    print(f"  → {opponent.name} 受到 {damage + pen_bonus} 穿透")
                player.heal(8 + heal_bonus)

        elif player.character.name == "弱化":
            if skill_name == "中毒":
                opponent.take_damage(1 + dmg_bonus)
                opponent.marks.add_mark("中毒", 1)
                print(f"  → {opponent.name} 受到 {1 + dmg_bonus} 伤害，中毒")
            elif skill_name == "流血":
                mark_count = opponent.marks.count()
                damage = mark_count
                opponent.take_damage(damage + dmg_bonus)
                opponent.marks.add_mark("流血", 1)
                print(f"  → {opponent.name} 受到 {damage + dmg_bonus} 伤害")
            elif skill_name == "全伤":
                total_marks = sum(p.marks.count() for p in self.players.players)
                for p in self.players.players:
                    if p.player_id != player.player_id:
                        p.take_penetration(total_marks + pen_bonus)
                print(f"  → 全场受到 {total_marks + pen_bonus} 穿透")
            elif skill_name == "混乱":
                opponent.marks.add_mark("混乱", 1)
                opponent.marks.add_mark("失神", 1)
                player.marks.add_mark("庇佑", 2)

        elif player.character.name == "反击":
            if skill_name == "反伤":
                damage = 2 + dmg_bonus
                opponent.take_damage(damage)
                if player.took_damage_this_turn:
                    opponent.take_damage(damage)
                    print(f"  → 追加 {damage} 伤害（共{2*damage}）")
            elif skill_name == "反击":
                damage = 4 + dmg_bonus
                opponent.take_damage(damage)
                if player.took_damage_this_turn:
                    player.heal(4 + heal_bonus)
                    print(f"  → 回复 {4 + heal_bonus} 血量")
            elif skill_name == "反咒":
                damage = 6 + dmg_bonus
                opponent.take_damage(damage)
                if player.took_damage_this_turn:
                    opponent.marks.add_mark("诅咒", 1)
                    print(f"  → 附加 诅咒")
            elif skill_name == "反叛":
                damage = 6 + dmg_bonus
                opponent.take_damage(damage)
                opponent.take_penetration(6 + pen_bonus)
                if player.took_damage_this_turn:
                    opponent.marks.add_mark("失神", 1)

        elif player.character.name == "连击":
            if skill_name == "连斩":
                opponent.take_damage(2 + dmg_bonus)
                opponent.take_penetration(1 + pen_bonus)
                print(f"  → {opponent.name} 受到 {2+dmg_bonus} 伤害, {1+pen_bonus} 穿透")
            elif skill_name == "Combo":
                player.extra_damage_next_turn += 2
                player.extra_penetration_next_turn += 2
                player.extra_heal_next_turn += 1
                print(f"  → 下一回合伤害+2，穿透+2，回复+1")
            elif skill_name == "抽牌":
                player.draw_cards(1)
                print(f"  → 抽1张牌")
            elif skill_name == "狂怒":
                # TODO: 统计本回合使用技能次数
                opponent.take_penetration(0 + pen_bonus)  # 简化
                print(f"  → 抽1张牌")

    def _use_special_card_choice(self, player: Player, opponent: Player):
        """使用特殊卡"""
        special_cards = player.get_special_cards()
        if not special_cards:
            print("没有特殊卡")
            return

        print("\n特殊卡:")
        for i, card in enumerate(special_cards):
            print(f"  {i+1}. {card.name} - {card.description}")

        choice = input("选择特殊卡编号 (0返回): ").strip()
        if choice == "0":
            return

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(special_cards):
                card = special_cards[idx]
                self._execute_special_card(card, player, opponent)
                player.discard_card(player.hand.index(card))
        except ValueError:
            pass

    def _execute_special_card(self, card: SpecialCard, player: Player, opponent: Player):
        """执行特殊卡效果"""
        effect_id = card.effect_id

        if effect_id == 1:  # 平分血量
            total = player.current_hp + opponent.current_hp
            half = total // 2
            player.current_hp = half
            opponent.current_hp = half
            print(f"  → 平分血量，各{half}")

        elif effect_id == 2:  # 危急回复
            if player.current_hp < player.max_hp / 2:
                heal = player.max_hp // 4
                player.heal(heal)
                player.draw_cards(2)
                print(f"  → 回复{heal}血量，抽2张牌")
            else:
                print("  → 血量高于一半，无法使用")

        elif effect_id == 3:  # 盗取手牌
            if not opponent.has_no_hand():
                stolen = random.choice(opponent.hand)
                player.add_card_to_hand(stolen)
                opponent.remove_card_from_hand(opponent.hand.index(stolen))
                print(f"  → 获得 {stolen.name}")

        elif effect_id == 4:  # 弃置手牌
            for _ in range(2):
                if not opponent.has_no_hand():
                    opponent.discard_card(0)
            print(f"  → {opponent.name} 弃置2张手牌")

        elif effect_id == 5:  # 换先手
            # TODO: 实现先手标记
            print(f"  → 下一回合优先行动")

        elif effect_id == 6:  # 抽牌
            player.draw_cards(2)
            print(f"  → 抽2张牌")

        elif effect_id == 7:  # 大抽牌
            for _ in range(2):
                if not player.has_no_hand():
                    player.discard_card(0)
            player.draw_cards(4)
            print(f"  → 弃2张，抽4张牌")

        elif effect_id == 8:  # 治疗印记
            player.marks.add_mark("治疗", 4)
            print(f"  → 附加治疗印记4回合")

        elif effect_id == 9:  # 无垢印记
            player.marks.add_mark("无垢", 2)
            print(f"  → 附加无垢印记2回合")

        elif effect_id == 10:  # 庇佑印记
            player.marks.add_mark("庇佑", 4)
            print(f"  → 附加庇佑印记4回合")

        elif effect_id == 11:  # 鼓舞印记
            player.marks.add_mark("鼓舞", 3)
            print(f"  → 附加鼓舞印记3回合")

        elif effect_id == 12:  # 灵感印记
            player.marks.add_mark("灵感", 2)
            print(f"  → 附加灵感印记2回合")

        elif effect_id == 13:  # 流血印记
            for p in self.players.players:
                if p.player_id != player.player_id:
                    p.marks.add_mark("流血", 2)
            print(f"  → 全场附加流血印记")

        elif effect_id == 14:  # 剧毒
            player.heal(3)
            opponent.marks.add_mark("中毒", 3)
            print(f"  → 回复3血量，{opponent.name}附加中毒")

        elif effect_id == 15:  # 诅咒
            opponent.marks.add_mark("诅咒", 1)
            print(f"  → {opponent.name}附加诅咒")

        elif effect_id == 16:  # 回合伤害
            opponent.take_damage(self.turn_number)
            opponent.take_penetration(self.turn_number)
            print(f"  → {opponent.name} 受到 {self.turn_number} 伤害和穿透")

    # ============ 阶段3：印记结算 ============

    def phase3_mark_resolution(self):
        """阶段3：印记结算"""
        self.phase = GamePhase.PHASE3
        print("\n=== 阶段3：印记结算 ===")

        for player in self.players.players:
            # 检查无垢（使负面印记失效）
            if player.marks.has_mark("无垢"):
                # 清除所有负面印记
                negative_names = ["失明", "睡眠", "混乱", "失神", "弱化", "流血", "中毒", "诅咒"]
                for name in negative_names:
                    if player.marks.has_mark(name):
                        player.marks.active_marks = [m for m in player.marks.active_marks if m.name != name]
                print(f"{player.name} 的无垢印记清除了负面印记")

            # 处理灵感印记（抽卡）
            if player.marks.has_mark("灵感"):
                player.draw_cards(1)
                print(f"{player.name} 灵感触发，抽1张牌")

            # 处理鼓舞印记（下回合伤害+2）
            # 下一回合才生效，暂不结算

            # 处理弱化印记（下回合伤害-2）
            # 下一回合才生效

            # 结算负面印记
            if player.marks.has_mark("治疗"):
                player.heal(4)
                print(f"{player.name} 治疗触发，回复4血量")

            if player.marks.has_mark("庇佑"):
                player.add_shield(4)
                print(f"{player.name} 庇佑触发，获得4护盾")

            if player.marks.has_mark("流血"):
                player.take_damage(4)
                print(f"{player.name} 流血触发，受到4伤害")

            if player.marks.has_mark("��毒"):
                player.take_damage(2)
                print(f"{player.name} 中毒触发，受到2伤害")

            if player.marks.has_mark("诅咒"):
                player.take_penetration(4)
                print(f"{player.name} 诅咒触发，受到4穿透")

            # 回合结束时减少印记持续时间
            player.marks.tick()

        # 血战模式
        if self.turn_number > 20:
            self.is_blood_war = True
            print("\n⚔️ 血战模式！")
            for player in self.players.players:
                player.take_penetration(20)
                print(f"{player.name} 受到20点穿透")

        # 检查胜负
        self._check_win()

        if self.winner:
            self.phase = GamePhase.END
        else:
            # 进入下一回合
            self._next_turn()

    def _next_turn(self):
        """进入下一回合"""
        self.turn_number += 1
        self.phase = GamePhase.PHASE1
        self.current_action_index = 0

        # 玩家状态重置
        for player in self.players.players:
            player.reset_turn_state()
            player.apply_buffs()

            # 检查失明/睡眠印记（下回合行动开始时生效）
            # 检查灵感/鼓舞印记（下回合抽卡阶段生效）

        print(f"\n=== 第 {self.turn_number} 回合 - 阶段1 ===")

    def _check_win(self):
        """检查胜负"""
        alive_players = [p for p in self.players.players if p.current_hp > 0]

        if len(alive_players) == 1:
            self.winner = alive_players[0]
        elif len(alive_players) == 0:
            self.winner = None  # 平局

    def check_win_instant(self) -> bool:
        """即时检查胜负 - 每次使用技能/特殊卡后调用"""
        alive_players = [p for p in self.players.players if p.current_hp > 0]

        if len(alive_players) == 1:
            self.winner = alive_players[0]
            self.phase = GamePhase.END
            return True
        elif len(alive_players) == 0:
            self.winner = None  # 平局
            self.phase = GamePhase.END
            return True

        return False

    def is_game_over(self) -> bool:
        """游戏是否结束"""
        return self.phase == GamePhase.END

    def print_status(self):
        """打印游戏状态"""
        print("\n" + "="*40)
        for player in self.players.players:
            marks_str = ", ".join(player.marks.get_all_mark_names()) if player.marks.active_marks else "无"
            print(f"{player.name}({player.character.name}) HP:{player.current_hp}/{player.max_hp} 护盾:{player.shield} 印记:{marks_str}")
        print("="*40)


# ============ 额外导入 ============
from enum import Enum