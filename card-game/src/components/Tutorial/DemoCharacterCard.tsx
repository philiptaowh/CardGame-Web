// DemoCharacterCard — 演示用的简化角色卡
//
// 功能：
// - HP 条（动画过渡 width）
// - 护盾数字
// - 印记图标列表
// - 技能按钮（4 个，step 4 可点击，其他禁用）
// - 高亮框（当 highlight=true）

import { Heart, Shield, Zap } from 'lucide-react';
import type { DemoCharacterState } from './tutorialSteps';

interface DemoCharacterCardProps {
  character: DemoCharacterState;
  isOpponent: boolean;
  highlight?: boolean;
  highlightSkillIndex?: number;
  showSkills?: boolean;
  disabled?: boolean;
  phase?: string;
  onSkillClick?: (skillIndex: number) => void;
}

export function DemoCharacterCard({
  character,
  isOpponent,
  highlight = false,
  highlightSkillIndex,
  showSkills = false,
  disabled = false,
  phase,
  onSkillClick,
}: DemoCharacterCardProps) {
  const hpPercent = Math.max(0, (character.hp / character.maxHp) * 100);

  // 技能名（演示用：技能 1 = 普通攻击）
  const skillNames = ['普通攻击', '次要攻击', '防御姿态', '终极技能'];

  return (
    <div
      className={`bg-slate-800/60 border-2 rounded-2xl p-4 transition-all ${
        highlight
          ? 'border-indigo-400 ring-2 ring-indigo-400/50 animate-pulse'
          : 'border-slate-700'
      }`}
      data-testid={`demo-card-${isOpponent ? 'opponent' : 'player'}`}
    >
      {/* 名称 + 类型标签 */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-white">{character.name}</div>
        <div className="text-xs text-slate-500">{isOpponent ? 'AI' : '你'}</div>
      </div>

      {/* HP 条 */}
      <div className="mb-2">
        <div className="flex items-center gap-1 text-xs text-red-400 mb-1">
          <Heart className="w-3 h-3" />
          <span>
            {character.hp} / {character.maxHp}
          </span>
        </div>
        <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 护盾 */}
      <div className="flex items-center gap-1 text-xs text-blue-400 mb-2">
        <Shield className="w-3 h-3" />
        <span>{character.shield}</span>
      </div>

      {/* 能量（仅 phase1 显示） */}
      {phase === 'phase1' && character.energy !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs mb-2 ${
            highlight && character.energy !== undefined ? 'text-yellow-300 font-bold' : 'text-yellow-500'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>能量 {character.energy}</span>
        </div>
      )}

      {/* 印记图标 */}
      {character.marks.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {character.marks.map((mark, idx) => (
            <div
              key={`${mark.name}-${idx}`}
              className={`text-xs px-2 py-0.5 rounded-full animate-in fade-in zoom-in duration-500 ${
                mark.type === 'positive'
                  ? 'bg-green-900/40 text-green-300 border border-green-700/50'
                  : 'bg-red-900/40 text-red-300 border border-red-700/50'
              }`}
            >
              {mark.name}
            </div>
          ))}
        </div>
      )}

      {/* 技能按钮（仅玩家 + showSkills=true 显示） */}
      {showSkills && !isOpponent && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {skillNames.map((name, idx) => {
            const isHighlighted = highlightSkillIndex === idx;
            const isClickable = !disabled && isHighlighted;
            return (
              <button
                key={idx}
                disabled={!isClickable}
                onClick={() => isClickable && onSkillClick?.(idx)}
                className={`text-xs px-2 py-1.5 rounded-lg transition-all ${
                  isHighlighted
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
                data-testid={`demo-skill-${idx}`}
              >
                {idx + 1}. {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}