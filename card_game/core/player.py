"""玩家状态类"""

from dataclasses import dataclass, field
from typing import List, Optional
from copy import deepcopy

from card_game.core.card import Card, CharacterCard, EnergyCard, SpecialCard
from card_game.core.deck import Deck
from card_game.core.marks import MarkManager, ActiveMark


@dataclass
class Player:
    """玩家状态"""
    player_id: int  # 玩家编号（1或2）
    name: str = ""
    character: Optional[CharacterCard] = None  # 角色卡
    deck: Optional[Deck] = None  # 个人卡组
    hand: List[Card] = field(default_factory=list)  # 手牌
    marks: MarkManager = field(default_factory=MarkManager)  # 印记
    shield: int = 0  # 护盾值
    max_hp: int = 100  # 最大血量
    current_hp: int = 100  # 当前血量
    position: int = 0  # 位置编号
    is_ai: bool = False  # 是否为AI
    has_acted: bool = False  # 本回合是否已行动
    took_damage_this_turn: bool = False  # 本回合是否受过伤害
    extra_damage_next_turn: int = 0  # 下一回合额外伤害加成
    extra_penetration_next_turn: int = 0  # 下一回合额外穿透加成
    extra_heal_next_turn: int = 0  # 下一回合额外回复加成
    extra_card_draw: int = 0  # 额外抽卡

    def initialize(self, character: CharacterCard, deck: Deck, position: int):
        """初始化玩家"""
        self.character = character
        self.deck = deck
        self.position = position
        self.max_hp = character.hp
        self.current_hp = character.hp
        self.name = f"Player{self.player_id}" if not self.name else self.name

    def draw_cards(self, count: int = 1) -> List[Card]:
        """抽卡"""
        if self.deck is None:
            return []
        drawn = self.deck.draw(count)
        self.hand.extend(drawn)
        return drawn

    def add_card_to_hand(self, card: Card):
        """添加卡牌到的手牌"""
        self.hand.append(card)

    def remove_card_from_hand(self, index: int) -> Card:
        """从手牌中移除卡牌"""
        if 0 <= index < len(self.hand):
            return self.hand.pop(index)
        return None

    def discard_card(self, index: int):
        """弃置手牌"""
        card = self.remove_card_from_hand(index)
        if card and self.deck:
            self.deck.add_to_discard([card])

    def get_energy_cards(self) -> List[EnergyCard]:
        """获取手牌中的能量卡"""
        return [c for c in self.hand if isinstance(c, EnergyCard)]

    def get_special_cards(self) -> List[SpecialCard]:
        """获取手牌中的特殊卡"""
        return [c for c in self.hand if isinstance(c, SpecialCard)]

    def get_card_by_index(self, index: int) -> Optional[Card]:
        """根据索引获取手牌"""
        if 0 <= index < len(self.hand):
            return self.hand[index]
        return None

    def has_no_hand(self) -> bool:
        """是否无手牌"""
        return len(self.hand) == 0

    def take_damage(self, damage: int):
        """受到伤害"""
        if damage <= 0:
            return
        self.took_damage_this_turn = True
        if self.shield > 0:
            if self.shield >= damage:
                self.shield -= damage
                damage = 0
            else:
                damage -= self.shield
                self.shield = 0
        self.current_hp = max(0, self.current_hp - damage)

    def take_penetration(self, penetration: int):
        """受到穿透伤害"""
        if penetration <= 0:
            return
        self.took_damage_this_turn = True
        self.current_hp = max(0, self.current_hp - penetration)

    def heal(self, amount: int):
        """回复血量"""
        if amount <= 0:
            return
        self.current_hp = min(self.max_hp, self.current_hp + amount)

    def add_shield(self, amount: int):
        """添加护盾"""
        if amount > 0:
            self.shield += amount

    def apply_buffs(self):
        """应用下一回合的增益（回合开始时调用）"""
        # 应用额外伤害/穿透/回复加成
        self.extra_damage_next_turn = 0
        self.extra_penetration_next_turn = 0
        self.extra_heal_next_turn = 0
        self.extra_card_draw = 0

    def reset_turn_state(self):
        """重置回合状态"""
        self.has_acted = False
        self.took_damage_this_turn = False

    def __str__(self):
        return f"{self.name}({self.character.name}) HP:{self.current_hp}/{self.max_hp} 护盾:{self.shield}"


class PlayerManager:
    """玩家管理器"""

    def __init__(self):
        self.players: List[Player] = []
        self.current_player_index: int = 0  # 当前行动玩家索引

    def add_player(self, player: Player):
        """添加玩家"""
        player.player_id = len(self.players) + 1
        self.players.append(player)

    def get_current_player(self) -> Optional[Player]:
        """获取当前行动玩家"""
        if 0 <= self.current_player_index < len(self.players):
            return self.players[self.current_player_index]
        return None

    def get_opponent(self, player: Player) -> Optional[Player]:
        """获取对手"""
        for p in self.players:
            if p.player_id != player.player_id:
                return p
        return None

    def next_player(self):
        """切换到下一玩家"""
        self.current_player_index = (self.current_player_index + 1) % len(self.players)

    def all_finished(self) -> bool:
        """是否所有玩家都已行动"""
        return all(p.has_acted for p in self.players)

    def set_action_order(self, order: List[Player]):
        """设置行动顺序"""
        self.current_player_index = 0  # 重置为第一个
        # 标记已行动的
        for i, p in enumerate(self.players):
            p.has_acted = i >= len(order)

    def get_player_by_position(self, position: int) -> Optional[Player]:
        """根据位置获取玩家"""
        for p in self.players:
            if p.position == position:
                return p
        return None

    def sort_by_position(self):
        """按位置排序"""
        self.players.sort(key=lambda p: p.position)
        self.current_player_index = 0