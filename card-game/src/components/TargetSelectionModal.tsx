// 目标选择弹窗 - 在1vn模式下选择技能/特殊卡的目标

import { User, Zap, Shield, Heart, Swords } from 'lucide-react';
import type { Player } from '../types';

interface TargetSelectionModalProps {
  title: string;
  description: string;
  targets: Player[];
  onSelect: (targetId: string) => void;
  onCancel: () => void;
}

export function TargetSelectionModal({
  title,
  description,
  targets,
  onSelect,
  onCancel,
}: TargetSelectionModalProps) {
  // 过滤存活的玩家
  const aliveTargets = targets.filter(t => t.current_hp > 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110]">
      <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* 头部 */}
        <div className="mb-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Swords className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>

        {/* 目标列表 */}
        <div className="space-y-2 mb-6">
          {aliveTargets.map(target => (
            <button
              key={target.id}
              onClick={() => onSelect(target.id)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-indigo-900/30 hover:border-indigo-500/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
                  <User className="w-5 h-5 text-slate-400 group-hover:text-indigo-300" />
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block group-hover:text-indigo-200 transition-colors">
                    {target.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {target.character_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-400 text-base font-medium">{target.current_hp}</span>
                </div>
                {target.shield > 0 && (
                  <div className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-blue-400 text-base">{target.shield}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-yellow-500 text-base">{target.hand.length}</span>
                </div>
              </div>
            </button>
          ))}
          {aliveTargets.length === 0 && (
            <div className="py-8 text-center text-slate-500 text-sm">
              没有可用的目标
            </div>
          )}
        </div>

        {/* 取消按钮 */}
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors border border-slate-700/50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
