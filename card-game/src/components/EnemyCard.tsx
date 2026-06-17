// 敌方卡片组件 - 精简卡片式显示AI对手信息

import { useState } from 'react';
import type { Player } from '../types';
import { getCharacterById } from '../game/characters';
import { getMarkDefinition } from '../game/marks';
import { Heart, Shield, Hand, Eye } from 'lucide-react';
import { EnemyDetailModal } from './EnemyDetailModal';

interface EnemyCardProps {
  player: Player;
  seatLabel?: string;
}

export function EnemyCard({ player, seatLabel }: EnemyCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const char = getCharacterById(player.character_id);
  const hpPercent = player.max_hp > 0 ? (player.current_hp / player.max_hp) * 100 : 0;
  const shieldPercent = player.max_hp > 0 ? (player.shield / player.max_hp) * 100 : 0;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 hover:bg-slate-700/60 hover:border-indigo-500/40 transition-all cursor-pointer group relative"
      >
        {/* 座位标识 */}
        {seatLabel && (
          <div className="absolute -top-2.5 -left-2.5 w-8 h-8 rounded-full bg-indigo-600/80 border border-indigo-400 flex items-center justify-center">
            <span className="text-sm font-bold text-white">{seatLabel}</span>
          </div>
        )}

        {/* 第一行：名称 + 角色 */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {char && (
              <span className="text-indigo-300 text-sm font-medium truncate">
                {char.name}
              </span>
            )}
          </div>
          <span className="text-white/80 text-lg font-bold truncate ml-1">
            {player.name}
          </span>
        </div>

        {/* HP 条 */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <Heart className="w-5 h-5 text-red-500" />
              <span className="text-red-400 text-lg font-bold">{player.current_hp}</span>
            </div>
            <span className="text-red-400/50 text-sm">{player.max_hp}</span>
          </div>
          <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* 护盾条 */}
        {player.shield > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="text-blue-400 text-lg font-bold">{player.shield}</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${shieldPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* 底部信息：手牌 + 印记 */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-1.5">
            <Hand className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400 text-xs">{player.hand.length}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {player.marks.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-end">
                {player.marks.slice(0, 4).map((mark, i) => {
                  const def = getMarkDefinition(mark.name);
                  const isPositive = def?.mark_type === 'positive';
                  return (
                    <span
                      key={i}
                      className={`px-2 py-0.5 text-xs leading-tight rounded-full border font-medium ${
                        isPositive
                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/30'
                          : 'bg-purple-600/30 text-purple-200 border-purple-500/30'
                      }`}
                    >
                      {mark.name}({mark.remaining_turns})
                    </span>
                  );
                })}
                {player.marks.length > 4 && (
                  <span className="text-xs text-slate-400">+{player.marks.length - 4}</span>
                )}
              </div>
            )}
            <Eye className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
          </div>
        </div>
      </div>

      {/* 详情弹窗 */}
      {showDetail && (
        <EnemyDetailModal player={player} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
