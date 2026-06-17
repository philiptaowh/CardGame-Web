"""印记系统：效果定义与结算"""

from dataclasses import dataclass, field
from typing import Dict, List
from enum import Enum


class MarkType(Enum):
    POSITIVE = "positive"  # 正面效果
    NEGATIVE = "negative"  # 负面效果


@dataclass
class Mark:
    """印记定义"""
    name: str
    mark_type: MarkType
    duration: int  # 持续回合数
    description: str


# ============ 印记定义 ============

MARKS = {
    # 正面印记
    "治疗": Mark("治疗", MarkType.POSITIVE, 1, "回复自己4点血量"),
    "无垢": Mark("无垢", MarkType.POSITIVE, 1, "使自己的所有负面效果的印记失效"),
    "庇佑": Mark("庇佑", MarkType.POSITIVE, 1, "自己获得4点护盾"),
    "鼓舞": Mark("鼓舞", MarkType.POSITIVE, 1, "下一个回合中自己的所有攻击，若有伤害则增加2"),
    "灵感": Mark("灵感", MarkType.POSITIVE, 1, "从卡组中抽1张卡"),
    # 负面印记
    "失明": Mark("失明", MarkType.NEGATIVE, 1, "下一个回合中自己行动开始时无法从卡组中抽卡"),
    "睡眠": Mark("睡眠", MarkType.NEGATIVE, 1, "回复自己2点血量，下一个回合自己无法行动"),
    "混乱": Mark("混乱", MarkType.NEGATIVE, 1, "下一个回合中，自己选定攻击目标和特殊卡的目标时，实际的目标为选中目标的序号+1"),
    "失神": Mark("失神", MarkType.NEGATIVE, 1, "下一个回合自己每次使用技能都需要额外将1张手卡放入弃牌区"),
    "弱化": Mark("弱化", MarkType.NEGATIVE, 1, "下一个回合中自己的所有攻击，若有伤害则减少2"),
    "流血": Mark("流血", MarkType.NEGATIVE, 1, "自己受到4点伤害"),
    "中毒": Mark("中毒", MarkType.NEGATIVE, 1, "自己受到2点伤害"),
    "诅咒": Mark("诅咒", MarkType.NEGATIVE, 1, "自己受到4点穿透"),
}


@dataclass
class ActiveMark:
    """活跃印记（实例）"""
    name: str
    remaining_turns: int  # 剩余回合数

    @property
    def definition(self) -> Mark:
        return MARKS[self.name]


@dataclass
class MarkManager:
    """印记管理器"""
    active_marks: List[ActiveMark] = field(default_factory=list)

    def add_mark(self, name: str, duration: int):
        """添加印记（同名时刷新持续时间）"""
        # 检查是否已存在同名印记
        existing = self.get_mark(name)
        if existing:
            # 刷新持续时间
            existing.remaining_turns = duration
        else:
            self.active_marks.append(ActiveMark(name, duration))

    def get_mark(self, name: str) -> ActiveMark:
        """获取印记"""
        for mark in self.active_marks:
            if mark.name == name:
                return mark
        return None

    def has_mark(self, name: str) -> bool:
        """是否有指定印记"""
        return self.get_mark(name) is not None

    def has_positive_marks(self) -> bool:
        """是否有正面印记"""
        for mark in self.active_marks:
            if MARKS[mark.name].mark_type == MarkType.POSITIVE:
                return True
        return False

    def tick(self):
        """回合结束时减少持续时间"""
        marks_to_remove = []
        for mark in self.active_marks:
            mark.remaining_turns -= 1
            if mark.remaining_turns <= 0:
                marks_to_remove.append(mark.name)
        for name in marks_to_remove:
            self.active_marks = [m for m in self.active_marks if m.name != name]

    def get_all_mark_names(self) -> List[str]:
        """获取所有活跃印记名称"""
        return [m.name for m in self.active_marks]

    def count(self) -> int:
        """印记总数"""
        return len(self.active_marks)

    def clear(self):
        """清除所有印记"""
        self.active_marks = []


def get_mark_definition(name: str) -> Mark:
    """获取印记定义"""
    return MARKS.get(name)