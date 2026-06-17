"""卡牌基类和三种卡牌类型定义"""

from dataclasses import dataclass, field
from typing import Optional, List
from enum import Enum


class CardType(Enum):
    CHARACTER = "character"
    ENERGY = "energy"
    SPECIAL = "special"


@dataclass
class Card:
    """卡牌基类"""
    card_id: str
    name: str
    card_type: CardType = field(default=CardType.CHARACTER)

    def __str__(self):
        return f"[{self.name}]"


@dataclass
class Skill:
    """角色技能"""
    name: str
    energy_cost: int  # 能量消耗
    description: str
    max_uses_per_turn: Optional[int] = None  # 每回合使用次数限制


@dataclass
class CharacterCard(Card):
    """角色卡"""
    card_type: CardType = field(default=CardType.CHARACTER)

    hp: int = 100  # 初始血量
    skills: List[Skill] = field(default_factory=list)

    def get_skill_by_cost(self, cost: int) -> Optional[Skill]:
        for skill in self.skills:
            if skill.energy_cost == cost:
                return skill
        return None


@dataclass
class EnergyCard(Card):
    """能量卡"""
    card_type: CardType = field(default=CardType.ENERGY)

    energy: int = 1  # 能量值
    is_wild: bool = False  # 是否为万能能量

    def __post_init__(self):
        if self.is_wild:
            self.energy = 1  # 万能能量在作为能量使用时为1-6任意值


@dataclass
class SpecialCard(Card):
    """特殊卡"""
    card_type: CardType = field(default=CardType.SPECIAL)

    effect_id: int = 1  # 效果编号 1-16
    description: str = ""