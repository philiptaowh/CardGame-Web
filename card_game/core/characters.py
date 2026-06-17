"""9个角色卡的数据定义"""

from card_game.core.card import CharacterCard, Skill


# 角色卡1: 平衡
CHARACTER_BALANCE = CharacterCard(
    card_id="char_1",
    name="平衡",
    hp=100,
    skills=[
        Skill("攻击", 1, "指定一位其他玩家，使其受到3点伤害"),
        Skill("回复", 2, "回复自己4点血量"),
        Skill("强化", 3, "为自己附加\"无垢\"和\"灵感\"印记2回合"),
        Skill("抽牌攻击", 4, "指定一位其他玩家，使其受到8点伤害和4点穿透，然后自己从卡组中抽1张卡"),
    ]
)

# 角色卡2: 防御
CHARACTER_DEFENSE = CharacterCard(
    card_id="char_2",
    name="防御",
    hp=135,
    skills=[
        Skill("护盾", 1, "指定一位其他玩家，使其受到1点伤害，然后自己获得2点护盾"),
        Skill("铁壁", 2, "自己获得6点护盾"),
        Skill("庇佑", 2, "为自己附加\"庇佑\"印记3回合"),
        Skill("猛攻", 6, "指定一位其他玩家，使其受到12点伤害，然后自己回复当前护盾数值一半（向下取整）的血量，若指定的玩家没有手牌，则使其受到12点穿透"),
    ]
)

# 角色卡3: 进攻
CHARACTER_OFFENSE = CharacterCard(
    card_id="char_3",
    name="进攻",
    hp=80,
    skills=[
        Skill("斩击", 1, "指定一位其他玩家，使其受到3点伤害"),
        Skill("穿刺", 2, "指定一位其他玩家，使其受到4点伤害和2点穿透"),
        Skill("猛砍", 3, "指定一位其他玩家，使其受到6点伤害，然后自己从卡组中抽1张卡"),
        Skill("毁灭", 6, "指定一位其他玩家，使其受到12点伤害和6点穿透，然后若指定的玩家当前血量大于自己当前血量，则再使其受到18点穿透"),
    ]
)

# 角色卡4: 强化
CHARACTER_BUFFER = CharacterCard(
    card_id="char_4",
    name="强化",
    hp=110,
    skills=[
        Skill("增伤", 1, "指定一位其他玩家，使其受到1点伤害，然后自己下一回合所有伤害增加3"),
        Skill("治疗加成", 1, "指定一位其他玩家，使其受到0点伤害，回复自己0点血量，然后自己下一回合所有回复增加2"),
        Skill("双重强化", 3, "指定一位其他玩家，使其受到3点伤害，回复自己3点血量，然后自己下一回合所有伤害增加3，所有回复增加3"),
        Skill("终极强化", 6, "指定一位其他玩家，使其受到0点伤害，然后自己下一回合所有伤害增加6，并从卡组中抽1张卡"),
    ]
)

# 角色卡5: 先手
CHARACTER_FIRST = CharacterCard(
    card_id="char_5",
    name="先手",
    hp=90,
    skills=[
        Skill("先攻", 1, "指定一位其他玩家，使其受到2点伤害，然后若该玩家还未行动则使其再受到2点伤害"),
        Skill("抢先", 2, "指定一位其他玩家，使其受到2点伤害，然后若该玩家还未行动，则自己从卡组中抽1张卡，同一回合内此技能最多使用3次", max_uses_per_turn=3),
        Skill("突袭", 3, "指定一位其他玩家，使其受到3点伤害和3点穿透，然后若该玩家还未行动，则为自己附加\"鼓舞\"印记1回合"),
        Skill("致盲", 6, "指定一位其他玩家，附加\"失明\"印记1回合，然后若该玩家已经行动，则额外附加\"睡眠\"印记1回合，且自己下一回合所有伤害增加2"),
    ]
)

# 角色���6: 持久
CHARACTER_SUSTAIN = CharacterCard(
    card_id="char_6",
    name="持久",
    hp=115,
    skills=[
        Skill("毒刃", 1, "指定一位其他玩家，使其受到1点穿透，然后回复自己2点血量"),
        Skill("剧毒", 2, "指定一位其他玩家，附加\"中毒\"印记1回合，然后回复自己2点血量，若该玩家已拥有\"中毒\"印记，则使其受到3点穿透"),
        Skill("诅咒", 3, "指定一位其他玩家，附加\"诅咒\"印记3回合，然后为自己附加\"治疗\"印记3回合"),
        Skill("衰败", 6, "指定一位其他玩家，附加\"弱化\"印记1回合，然后当回合数大于12时，使指定的玩家受到当前回合数一半加6的穿透，并回复自己8点血量"),
    ]
)

# 角色卡7: 弱化
CHARACTER_DEBUFFER = CharacterCard(
    card_id="char_7",
    name="弱化",
    hp=80,
    skills=[
        Skill("中毒", 1, "指定一位其他玩家，使其受到1点伤害并附加\"中毒\"印记1回合"),
        Skill("流血", 3, "指定一位其他玩家，使其受到当前拥有的印记总数点伤害并附加\"流血\"印记1回合"),
        Skill("全伤", 4, "对除了自己外的全场玩家，使其受到当前全场拥有的印记总数点穿透"),
        Skill("混乱", 6, "指定一位其他玩家，附加\"混乱\"和\"失神\"印记1回合，然后为自己附加\"庇佑\"印记2回合"),
    ]
)

# 角色卡8: 反击
CHARACTER_COUNTER = CharacterCard(
    card_id="char_8",
    name="反击",
    hp=105,
    skills=[
        Skill("反伤", 1, "指定一位其他玩家，使其受到2点伤害，然后若本回合自己受到过伤害，则使其再受到2点伤害"),
        Skill("反击", 2, "指定一位其他玩家，使其受到4点伤害，然后若本回合自己受到过伤害，则回复自己4点血量"),
        Skill("反咒", 3, "指定一位其他玩家，使其受到6点伤害，然后若本回合自己受到过伤害，则令指定的玩家附加\"诅咒\"印记1回合"),
        Skill("反叛", 6, "指定一位其他玩家，使其受到6点伤害和6点穿透，然后若本回合自己受到过伤害，则令指定的玩家附加\"失神\"印记1回合"),
    ]
)

# 角色卡9: 连击
CHARACTER_COMBO = CharacterCard(
    card_id="char_9",
    name="连击",
    hp=90,
    skills=[
        Skill("连斩", 1, "指定一位其他玩家，使其受到2点伤害和1点穿透"),
        Skill("Combo", 2, "自己下一回合所有伤害增加2，所有穿透增加2，所有回复增加1"),
        Skill("抽牌", 2, "指定一位其他玩家，使其受到0点伤害，然后回复自己0点血量并从卡组中抽1张卡"),
        Skill("狂怒", 6, "指定一位其他玩家，使其受到本回合自己已经使用技能的次数2倍的穿透，然后若本回合自己使用技能的次数小于等于3，则为自己附加\"无垢\"和\"灵感\"印记1回合"),
    ]
)


# 所有角色卡字典
CHARACTERS = {
    "char_1": CHARACTER_BALANCE,
    "char_2": CHARACTER_DEFENSE,
    "char_3": CHARACTER_OFFENSE,
    "char_4": CHARACTER_BUFFER,
    "char_5": CHARACTER_FIRST,
    "char_6": CHARACTER_SUSTAIN,
    "char_7": CHARACTER_DEBUFFER,
    "char_8": CHARACTER_COUNTER,
    "char_9": CHARACTER_COMBO,
}


def get_all_characters():
    """获取所有角色卡列表"""
    return list(CHARACTERS.values())


def get_character_by_id(char_id: str):
    """根据ID获取角色卡"""
    return CHARACTERS.get(char_id)