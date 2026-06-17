// 可展开的游戏日志组件 - 右侧向左展开

import { useState } from 'react';
import type { GameLog } from '../types';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

interface GameLogProps {
  logs: GameLog[];
}

export function GameLog({ logs }: GameLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const recentLogs = logs.slice(-20).reverse();

  return (
    <div
      className={`fixed right-0 top-1/2 -translate-y-1/2 transition-all duration-300 z-40 ${
        isExpanded ? 'translate-x-0' : 'translate-x-[85%]'
      }`}
      style={{ right: isExpanded ? 0 : 0 }}
    >
      {/* 展开/收起按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pl-2 flex items-center"
      >
        <div className="px-2 py-2 rounded-l-lg bg-slate-700 hover:bg-slate-600 text-white">
          {isExpanded ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* 日志内容 - 向左展开 */}
      <div
        className={`w-72 h-80 bg-black/60 backdrop-blur-sm rounded-l-xl p-4 overflow-hidden transition-all duration-300 ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-white/70" />
          <h3 className="text-white/70 text-base font-medium">游戏日志</h3>
        </div>
        <div className="h-full overflow-y-auto space-y-1">
          {recentLogs.map((log, i) => (
            <div key={i} className="text-white/60 text-sm">
              <span className="text-white/30">[{log.turn}]</span> {log.message}
            </div>
          ))}
          {recentLogs.length === 0 && (
            <span className="text-white/30 text-sm">等待游戏开始...</span>
          )}
        </div>
      </div>
    </div>
  );
}