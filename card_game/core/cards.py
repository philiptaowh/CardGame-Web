"""能量卡和特殊卡数据定义"""

from card_game.core.card import EnergyCard, SpecialCard


# ============ 能量卡定义 ============

# 1能量卡 x58
ENERGY_1_CARDS = [
    EnergyCard(card_id=f"energy_1_{i}", name="1能量", energy=1, is_wild=False)
    for i in range(1, 59)
]

# 2能量卡 x43
ENERGY_2_CARDS = [
    EnergyCard(card_id=f"energy_2_{i}", name="2能量", energy=2, is_wild=False)
    for i in range(1, 44)
]

# 3能量卡 x22
ENERGY_3_CARDS = [
    EnergyCard(card_id=f"energy_3_{i}", name="3能量", energy=3, is_wild=False)
    for i in range(1, 23)
]

# 万能能量卡 x7
WILD_ENERGY_CARDS = [
    EnergyCard(card_id=f"wild_energy_{i}", name="万能能量", energy=1, is_wild=True)
    for i in range(1, 8)
]


# ============ 特殊卡定义 ============

SPECIAL_CARDS = [
    # 特殊卡1: 平分血量
    SpecialCard(
        card_id="special_1",
        name="平分",
        effect_id=1,
        description="指定一位其他玩家，平分双方的当前血量"
    ),
    # 特殊卡2: 危急回复
    SpecialCard(
        card_id="special_2",
        name="危急",
        effect_id=2,
        description="当血量低于一半时，使用此卡，回复自己四分之一最大血量；当血量低于一半时，使用此卡，自己再从卡组抽2张卡"
    ),
    # 特殊卡3: 盗取手牌
    SpecialCard(
        card_id="special_3",
        name="盗取",
        effect_id=3,
        description="指定一位其他玩家，获得ta的1张手卡"
    ),
    # 特殊卡4: 弃置手牌
    SpecialCard(
        card_id="special_4",
        name="破坏",
        effect_id=4,
        description="指定一位其他玩家，令ta弃置2张手牌"
    ),
    # 特殊卡5: 换先手
    SpecialCard(
        card_id="special_5",
        name="先手",
        effect_id=5,
        description="自己弃置1张手卡，使用此卡，下一回合自己第一个行动"
    ),
    # 特殊卡6: 抽牌
    SpecialCard(
        card_id="special_6",
        name="抽牌",
        effect_id=6,
        description="自己从卡组抽2张卡"
    ),
    # 特殊卡7: 大抽牌
    SpecialCard(
        card_id="special_7",
        name="大抽",
        effect_id=7,
        description="自己弃置2张手卡，使用此卡，自己从卡组中抽4张卡"
    ),
    # 特殊卡8: 治疗印记
    SpecialCard(
        card_id="special_8",
        name="治疗",
        effect_id=8,
        description="为自己附加\"治疗\"印记4回合"
    ),
    # 特殊卡9: 无垢印记
    SpecialCard(
        card_id="special_9",
        name="无垢",
        effect_id=9,
        description="为自己附加\"无垢\"印记2回合"
    ),
    # 特殊卡10: 庇佑印记
    SpecialCard(
        card_id="special_10",
        name="庇佑",
        effect_id=10,
        description="为自己附加\"庇佑\"印记4回合"
    ),
    # 特殊卡11: 鼓舞印记
    SpecialCard(
        card_id="special_11",
        name="鼓舞",
        effect_id=11,
        description="为自己附加\"鼓舞\"印记3回合"
    ),
    # 特殊卡12: 灵感印记
    SpecialCard(
        card_id="special_12",
        name="灵感",
        effect_id=12,
        description="为自己附加\"灵感\"印记2回合"
    ),
    # 特殊卡13: 流血印记
    SpecialCard(
        card_id="special_13",
        name="流血",
        effect_id=13,
        description="对除了自己外的全场玩家附加\"流血\"印记2回合"
    ),
    # 特殊卡14: 中毒
    SpecialCard(
        card_id="special_14",
        name="剧毒",
        effect_id=14,
        description="回复自己3点血量，指定一位其他玩家，附加\"中毒\"印记3回合"
    ),
    # 特殊卡15: 诅咒
    SpecialCard(
        card_id="special_15",
        name="诅咒",
        effect_id=15,
        description="指定一位其他玩家，附加\"诅咒\"印记1回合"
    ),
    # 特殊卡16: 回合伤害
    SpecialCard(
        card_id="special_16",
        name="终局",
        effect_id=16,
        description="指定一位其他玩家，使其受到当前回合数点伤害和穿透"
    ),
]


def get_all_energy_cards():
    """获取所有能量卡列表"""
    return ENERGY_1_CARDS + ENERGY_2_CARDS + ENERGY_3_CARDS + WILD_ENERGY_CARDS


def get_all_special_cards():
    """获取所有特殊卡列表"""
    return SPECIAL_CARDS


def create_deck():
    """创建完整卡组（160张）"""
    return get_all_energy_cards() + get_all_special_cards()