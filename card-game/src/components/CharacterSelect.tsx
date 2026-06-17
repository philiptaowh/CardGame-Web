// 角色选择界面 - 支持选择AI角色

import { useState, useEffect } from 'react';
import { getAllCharacters } from '../game/characters';
import { useGameStore } from '../stores/gameStore';
import { LogOut, Power, Users, User, ChevronDown, ArrowLeft } from 'lucide-react';

interface CharacterSelectProps {
  onStart?: () => void;
  onBack?: () => void;
}

export function CharacterSelect({ onStart, onBack }: CharacterSelectProps) {
  const [humanCharId, setHumanCharId] = useState<string>('');
  const [aiCount, setAiCount] = useState<number>(1);
  const [aiCharIds, setAiCharIds] = useState<(string | null)[]>([]);
  const [expandedAiIndex, setExpandedAiIndex] = useState<number | null>(null);
  const [isQuitting, setIsQuitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const initGame = useGameStore(state => state.initGame);
  const characters = getAllCharacters();

  // AI数量变化时重置选择
  useEffect(() => {
    setAiCharIds(Array.from({ length: aiCount }).map(() => null));
    setExpandedAiIndex(null);
  }, [aiCount]);

  const getAvailableChars = (aiIndex: number) => {
    const takenIds = [humanCharId, ...aiCharIds.filter((id, i) => i !== aiIndex && id !== null)];
    return characters.filter(c => !takenIds.includes(c.card_id) || c.card_id === aiCharIds[aiIndex]);
  };

  const handleAiCharSelect = (aiIndex: number, charId: string) => {
    setAiCharIds(prev => {
      const next = [...prev];
      // 点击已选角色 → 取消选择（回到随机）
      if (next[aiIndex] === charId) {
        next[aiIndex] = null;
      } else {
        next[aiIndex] = charId;
      }
      return next;
    });
    setExpandedAiIndex(null);
  };

  const handleAiCharRandom = (aiIndex: number) => {
    setAiCharIds(prev => {
      const next = [...prev];
      next[aiIndex] = null;
      return next;
    });
    setExpandedAiIndex(null);
  };

  const handleStart = () => {
    if (!humanCharId) return;

    // null 的位置随机分配
    const finalAiChars = aiCharIds.map(id => {
      if (id !== null) return id;
      const availableChars = characters
        .filter(c => c.card_id !== humanCharId && !aiCharIds.includes(c.card_id))
        .map(c => c.card_id);
      const shuffled = [...availableChars].sort(() => Math.random() - 0.5);
      return shuffled[0] || '';
    }).filter(Boolean);

    initGame(humanCharId as any, finalAiChars as any, aiCount > 1 ? '1vn' : '1v1');
    onStart?.();
  };

  const handleBack = () => {
    onBack?.();
  };

  const handleQuit = async () => {
    setIsQuitting(true);
    try {
      await fetch('/api/quit');
    } catch (e) {
      console.log('Server is likely shutting down...');
    } finally {
      setShowExitModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8 relative">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-white text-center mb-8">卡牌游戏</h1>

        {/* AI数量选择 */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 inline-flex items-center gap-4">
            <Users className="w-5 h-5 text-slate-400" />
            <span className="text-white/70 text-sm">AI 对手数量</span>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  aiCount === n
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 玩家选择 */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-2 h-6 bg-indigo-500 rounded-full" />
              <User className="w-4 h-4 text-indigo-400" />
              选择你的角色
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {characters.map(char => (
                <button
                  key={char.card_id}
                  onClick={() => setHumanCharId(char.card_id)}
                  className={`p-4 rounded-xl transition-all duration-300 text-left border-2 ${
                    humanCharId === char.card_id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                      : 'bg-slate-700/30 border-transparent text-slate-400 hover:bg-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className={`font-bold ${humanCharId === char.card_id ? 'text-indigo-300' : ''}`}>
                    {char.name}
                  </div>
                  <div className="text-xs opacity-60 mt-1 flex items-center gap-1">
                    HP: <span className="text-red-400">{char.hp}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI对手配置 */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-2 h-6 bg-red-500 rounded-full" />
              <Users className="w-4 h-4 text-red-400" />
              AI 对手 ({aiCount}人)
            </h2>
            <div className="space-y-3">
              {Array.from({ length: aiCount }).map((_, i) => {
                const selectedCharId = aiCharIds[i];
                const selectedChar = selectedCharId ? characters.find(c => c.card_id === selectedCharId) : null;
                const isExpanded = expandedAiIndex === i;
                const availableChars = getAvailableChars(i);

                return (
                  <div key={i}>
                    <button
                      onClick={() => setExpandedAiIndex(isExpanded ? null : i)}
                      className={`w-full bg-slate-700/30 rounded-xl p-4 border transition-all text-left ${
                        isExpanded
                          ? 'border-indigo-500/50 bg-slate-700/50'
                          : selectedChar
                            ? 'border-green-700/50 hover:border-slate-600'
                            : 'border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm">
                            AI
                          </div>
                          <div>
                            <div className="text-white font-medium flex items-center gap-2">
                              对手 {i + 1}
                              {selectedChar && (
                                <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full border border-green-600/30">
                                  {selectedChar.name}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {selectedChar ? `HP ${selectedChar.hp} · 点击更换` : '点击选择角色（不选则随机）'}
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* 角色选择面板 */}
                    {isExpanded && (
                      <div className="mt-2 bg-slate-800/80 border border-slate-600/50 rounded-xl p-3 grid grid-cols-2 gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        {availableChars.map(char => {
                          const isSelected = aiCharIds[i] === char.card_id;
                          const isTaken = !isSelected && aiCharIds.includes(char.card_id);
                          return (
                            <button
                              key={char.card_id}
                              onClick={() => !isTaken && handleAiCharSelect(i, char.card_id)}
                              disabled={isTaken}
                              className={`p-2.5 rounded-lg text-left transition-all border ${
                                isSelected
                                  ? 'bg-green-600/20 border-green-500/50 text-white'
                                  : isTaken
                                    ? 'bg-slate-800/30 border-transparent text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-700/30 border-transparent text-slate-300 hover:bg-slate-700/50 hover:border-slate-500'
                              }`}
                            >
                              <div className={`text-sm font-medium ${isSelected ? 'text-green-300' : ''}`}>
                                {char.name}
                              </div>
                              <div className="text-[10px] text-slate-500">HP {char.hp}</div>
                            </button>
                          );
                        })}
                        {/* 随机选项 */}
                        <button
                          onClick={() => handleAiCharRandom(i)}
                          className="p-2.5 rounded-lg bg-slate-700/30 border border-dashed border-slate-600/50 text-slate-400 hover:bg-slate-700/50 hover:border-slate-500 transition-all col-span-2"
                        >
                          <span className="text-sm font-medium">随机分配</span>
                          <span className="text-[10px] text-slate-500 ml-2">（不指定角色）</span>
                        </button>
                        {humanCharId && (
                          <div className="col-span-2 text-[10px] text-slate-600 text-center pt-1">
                            * 已被其他玩家选择的角色不可选
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              座位将在游戏开始时随机打乱
            </p>
          </div>
        </div>

        {/* 开始按钮 */}
        <div className="mt-12 text-center">
          <button
            onClick={handleStart}
            disabled={!humanCharId}
            className="group px-12 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-indigo-500/25 active:scale-95"
          >
            开始游戏
          </button>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="fixed bottom-8 right-8 flex items-center gap-3">
        {onBack && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-600/20 hover:bg-slate-600 text-slate-400 hover:text-white border border-slate-500/30 hover:border-slate-500 shadow-lg transition-all duration-300"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">返回</span>
          </button>
        )}
        <button
          onClick={handleQuit}
          disabled={isQuitting}
          className={`group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
            isQuitting
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 shadow-lg'
          }`}
        >
          <LogOut className={`w-5 h-5 ${isQuitting ? '' : 'group-hover:scale-110 transition-transform'}`} />
          <span className="font-medium">退出游戏</span>
        </button>
      </div>

      {/* 退出确认弹窗 */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Power className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">游戏已退出</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              后端服务器已成功关闭。为了安全起见，现在您可以手动关闭此浏览器标签页。
            </p>
            <div className="p-4 bg-black/40 rounded-2xl border border-slate-700/50 text-sm text-slate-500">
              感谢参与本次卡牌原型测试
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
