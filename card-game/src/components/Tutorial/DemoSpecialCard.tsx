// DemoSpecialCard — 演示用的红色特殊卡（可点击）

import { Swords } from 'lucide-react';

interface DemoSpecialCardProps {
  name: string;
  onClick: () => void;
  disabled?: boolean;
  highlighted?: boolean;
}

export function DemoSpecialCard({ name, onClick, disabled, highlighted }: DemoSpecialCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all min-w-[120px] ${
        highlighted
          ? 'bg-red-900/40 border-red-500 hover:bg-red-900/60 text-white animate-pulse'
          : 'bg-red-900/20 border-red-700/50 text-red-300 hover:bg-red-900/30'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      data-testid="demo-special-card"
    >
      <Swords className="w-4 h-4" />
      <span className="text-sm font-medium">{name}</span>
    </button>
  );
}