// 敌方详情弹窗 - 点击敌方卡片后展开完整信息

import type { Player } from '../types';
import { getCharacterById } from '../game/characters';
import { getMarkDefinition } from '../game/marks';
import { Heart, Shield, Hand, X, Zap, Swords } from 'lucide-react';

interface EnemyDetailModalProps {
  player: Player;
  onClose: () => void;
}

export function EnemyDetailModal({ player, onClose }: EnemyDetailModalProps) {
  const char = getCharacterById(player.character_id);
  const hpPercent = player.max_hp > 0 ? (player.current_hp / player.max_hp) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-white">{player.name}</h3>
            {char && <span className="text-sm text-indigo-400">{char.name}</span>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* HP + 护盾 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm text-white font-medium">HP</span>
              </div>
              <span className="text-red-400 font-bold">{player.current_hp} / {player.max_hp}</span>
            </div>
            <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-white">护盾</span>
            </div>
            <span className="text-blue-400 font-bold">{player.shield}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Hand className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-white">手牌</span>
            </div>
            <span className="text-slate-300 font-bold">{player.hand.length} 张</span>
          </div>

          {/* 印记列表 */}
          {player.marks.length > 0 && (
            <div>
              <h4 className="text-sm text-white font-medium mb-2 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-purple-400" />
                印记 ({player.marks.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {player.marks.map((mark, i) => {
                  const def = getMarkDefinition(mark.name);
                  const isPositive = def?.mark_type === 'positive';
                  return (
                    <span
                      key={i}
                      className={`px-2.5 py-1 text-xs rounded-full border ${
                        isPositive
                          ? 'bg-amber-600/25 text-amber-200 border-amber-500/30'
                          : 'bg-purple-600/30 text-purple-200 border-purple-500/30'
                      }`}
                    >
                      {mark.name}({mark.remaining_turns})
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 技能列表 */}
          {char && (
            <div>
              <h4 className="text-sm text-white font-medium mb-2 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-indigo-400" />
                技能
              </h4>
              <div className="space-y-1.5">
                {char.skills.map((skill, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-indigo-300 font-medium">{skill.name}</span>
                    <span className="text-slate-500 ml-2">消耗{skill.cost}</span>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 加成状态 */}
          {(player.damage_modifier !== 0 || player.heal_modifier !== 0 || player.penetration_modifier !== 0) && (
            <div className="bg-yellow-900/10 border border-yellow-900/30 rounded-lg px-3 py-2">
              <span className="text-yellow-400 text-xs font-medium">本回合加成：</span>
              <span className="text-yellow-300 text-xs">
                {player.damage_modifier !== 0 && `伤害+${player.damage_modifier} `}
                {player.heal_modifier !== 0 && `回复+${player.heal_modifier} `}
                {player.penetration_modifier !== 0 && `穿透+${player.penetration_modifier} `}
              </span>
            </div>
          )}

          {/* 状态标志 */}
          {(player.has_blind || player.has_confusion || player.has_sleep || player.has_madness) && (
            <div className="flex flex-wrap gap-1.5">
              {player.has_blind && <span className="px-2 py-0.5 text-xs rounded-full bg-red-600/30 text-red-200 border border-red-500/30">失明</span>}
              {player.has_confusion && <span className="px-2 py-0.5 text-xs rounded-full bg-orange-600/30 text-orange-200 border border-orange-500/30">混乱</span>}
              {player.has_sleep && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-600/30 text-blue-200 border border-blue-500/30">睡眠</span>}
              {player.has_madness && <span className="px-2 py-0.5 text-xs rounded-full bg-purple-600/30 text-purple-200 border border-purple-500/30">失神</span>}
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        <div className="px-5 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
