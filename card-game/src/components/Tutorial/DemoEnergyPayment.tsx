// DemoEnergyPayment — 能量支付弹窗（教学演示用）
//
// 简化版能量支付：cost 张能量卡 + 选卡 + 确认
// 不复用真实 SkillPaymentModal（解耦 + 简化）

import { Zap, X } from 'lucide-react';

interface DemoEnergyPaymentProps {
  cost: number;
  selectedCard: number | null;
  onSelect: (cardIndex: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const DEMO_ENERGY_CARDS = [
  { name: '能量 1', value: 1 },
  { name: '能量 2', value: 2 },
  { name: '万能', value: 0 },
];

export function DemoEnergyPayment({
  cost,
  selectedCard,
  onSelect,
  onConfirm,
  onCancel,
}: DemoEnergyPaymentProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      data-testid="demo-energy-payment"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">能量支付</h3>
              <p className="text-xs text-slate-500">「普通攻击」消耗 {cost} 点能量</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 能量卡选择 */}
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">
            请选择 {cost} 张能量卡：
          </div>
          <div className="grid grid-cols-3 gap-3">
            {DEMO_ENERGY_CARDS.map((card, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(idx)}
                className={`px-3 py-4 rounded-xl border-2 transition-all ${
                  selectedCard === idx
                    ? 'bg-yellow-900/40 border-yellow-500 text-white'
                    : 'bg-yellow-900/10 border-yellow-700/50 text-yellow-300 hover:bg-yellow-900/20'
                }`}
                data-testid={`demo-energy-card-${idx}`}
              >
                <Zap className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">{card.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedCard === null}
            className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="demo-energy-confirm"
          >
            确认支付
          </button>
        </div>
      </div>
    </div>
  );
}