"""卡组管理：洗牌、抽卡、弃牌区、重洗"""

import random
from typing import List, Optional
from copy import deepcopy

from card_game.core.card import Card, EnergyCard, SpecialCard


class Deck:
    """卡组管理"""

    def __init__(self, cards: List[Card]):
        self.cards = list(cards)  # 原始卡组副本
        self.draw_pile = list(cards)  # 抽牌堆
        self.discard_pile: List[Card] = []  # 弃牌堆
        self.shuffle()

    def shuffle(self):
        """洗牌"""
        random.shuffle(self.draw_pile)

    def draw(self, count: int = 1) -> List[Card]:
        """抽卡"""
        drawn = []
        for _ in range(count):
            if not self.draw_pile:
                if self.discard_pile:
                    # 重洗弃牌区
                    self.draw_pile = self.discard_pile
                    self.discard_pile = []
                    self.shuffle()
                    print(f"⚠️ 卡组已打乱，重新洗牌！")
                else:
                    break  # 没牌了
            card = self.draw_pile.pop(0)
            drawn.append(card)
        return drawn

    def add_to_discard(self, cards: List[Card]):
        """将卡牌加入弃牌堆"""
        self.discard_pile.extend(cards)

    def put_on_bottom(self, card: Card):
        """将卡牌放到卡组底部"""
        self.draw_pile.append(card)

    def remaining(self) -> int:
        """剩余卡牌数"""
        return len(self.draw_pile)

    def is_empty(self) -> bool:
        """卡组是否为空"""
        return len(self.draw_pile) == 0 and len(self.discard_pile) == 0


def create_game_deck() -> Deck:
    """创建游戏卡组"""
    from card_game.core.cards import create_deck
    cards = create_deck()
    return Deck(cards)


def copy_deck(deck: Deck) -> Deck:
    """复制卡组（用于新玩家独立卡组）"""
    new_deck = Deck(list(deck.cards))  # 复制原始卡组
    new_deck.draw_pile = list(deck.draw_pile)
    new_deck.discard_pile = list(deck.discard_pile)
    return new_deck