// DemoLog — 日志行（逐行 slide-in 动画）

import { Terminal } from 'lucide-react';

interface DemoLogProps {
  lines: string[];
}

export function DemoLog({ lines }: DemoLogProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 max-h-32 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
        <Terminal className="w-3 h-3" />
        <span>日志</span>
      </div>
      <div className="space-y-1 font-mono text-xs text-slate-300">
        {lines.length === 0 ? (
          <div className="text-slate-600 italic">（暂无）</div>
        ) : (
          lines.map((line, idx) => (
            <div
              key={idx}
              className="animate-in slide-in-from-bottom-1 fade-in duration-400"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}