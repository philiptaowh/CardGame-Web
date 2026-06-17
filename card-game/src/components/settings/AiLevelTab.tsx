// AI 难度 Tab — 当前 AI 等级选择（占位）
//
// Phase 1：仅展示当前 aiLevel，不提供 UI 切换（避免破坏游戏）
// Phase 5 启用 BC 后：加入 "模仿人类" 选项

import { useSettingsStore, type AiLevelUi } from '../../stores/settingsStore';
import { useGameStore } from '../../stores/gameStore';

interface LevelOption {
  id: AiLevelUi;
  label: string;
  description: string;
  available: boolean;
}

const LEVELS: LevelOption[] = [
  {
    id: 'simple',
    label: '简单（随机 AI）',
    description: 'V1 内置的简单随机 AI。不推荐，体验较差。',
    available: true,
  },
  {
    id: 'optimal',
    label: '最优（BO 优化）',
    description: '当前默认。V2 RuleBasedAI + 9 角色 BO 优化后的 8 维 θ 超参数。',
    available: true,
  },
  {
    id: 'bc',
    label: '模仿人类（即将推出）',
    description: 'Phase 4 行为克隆（BC）训练后的人类模仿 AI。Phase 5 启用。',
    available: false,
  },
];

export function AiLevelTab() {
  const aiLevelUi = useSettingsStore((s) => s.aiLevel);
  const gameAiLevel = useGameStore((s) => s.aiLevel);

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">AI 难度</h3>
        <p className="text-xs text-slate-500 mb-3">
          当前生效：<span className="text-indigo-400 font-mono">{gameAiLevel}</span>
        </p>
        <div className="space-y-2">
          {LEVELS.map((lv) => (
            <label
              key={lv.id}
              className={`flex items-start gap-3 p-3 rounded border ${
                aiLevelUi === lv.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-800/30'
              } ${!lv.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="ai-level"
                value={lv.id}
                checked={aiLevelUi === lv.id}
                disabled={!lv.available}
                onChange={() => {/* Phase 5 启用 */}}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-slate-200">{lv.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{lv.description}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-500 italic">
        注：AI 等级 UI 切换功能在 Phase 5（BC 验证）启用。当前仅展示，不修改。
      </p>
    </div>
  );
}
