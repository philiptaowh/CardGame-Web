// 封面页 - 人机对战 / 局域网联机 / 录制测试 三入口
//
// v2.2.1.2 网页版说明：
//   - web 模式（isWebMode() === true）下：只显示「录制测试」入口（共享服务端进度）
//   - 桌面模式：保留全部三入口（人机 / 局域网 / 录制测试）
//   - web 模式无"退出游戏"按钮（无法关闭云端后端）
//   - 退出按钮在桌面模式下显示

import { useState } from 'react';
import { LogOut, Power, Swords, Wifi, ClipboardList, HelpCircle } from 'lucide-react';
import { isWebMode } from '../config/buildMode';
import { useTutorialStore } from '../stores/tutorialStore';

interface CoverPageProps {
  onAI: () => void;
  onLAN: () => void;
  onTest: () => void;
}

export function CoverPage({ onAI, onLAN, onTest }: CoverPageProps) {
  const [isQuitting, setIsQuitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const webMode = isWebMode();

  const handleQuit = async () => {
    setIsQuitting(true);
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
      return;
    }
    try {
      await fetch('/api/quit');
    } catch {
      // ignore
    } finally {
      setShowExitModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      {/* 标题 */}
      <div className="relative mb-12 text-center">
        <h1 className="text-7xl font-bold text-white mb-3 tracking-tight">
          卡牌游戏
        </h1>
        <p className="text-indigo-300/60 text-lg">
          回合制策略对战
          {webMode && <span className="ml-3 text-xs text-amber-400/70 align-middle">· 网页版</span>}
        </p>
      </div>

      {/* 模式选择 */}
      <div className="relative flex gap-6">
        {/* v2.2.1.2: web 模式只显示"录制测试"入口 (共享服务端进度) */}
        {webMode ? (
          <button
            data-testid="cover-test"
            onClick={onTest}
            className="group w-60 h-68 bg-slate-800/60 border-2 border-slate-700/60 rounded-3xl flex flex-col items-center justify-center gap-5 hover:bg-amber-900/40 hover:border-amber-500/60 transition-all duration-300 shadow-xl hover:shadow-amber-500/10"
          >
            <div className="w-20 h-20 rounded-2xl bg-amber-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <ClipboardList className="w-10 h-10 text-amber-400" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">录制测试</div>
              <div className="text-sm text-slate-500">81 种 matchup 共用进度</div>
            </div>
          </button>
        ) : (
          <>
            {/* 桌面模式：3 个入口 */}
            <button
              data-testid="cover-ai"
              onClick={onAI}
              className="group w-60 h-68 bg-slate-800/60 border-2 border-slate-700/60 rounded-3xl flex flex-col items-center justify-center gap-5 hover:bg-indigo-900/40 hover:border-indigo-500/60 transition-all duration-300 shadow-xl hover:shadow-indigo-500/10"
            >
              <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Swords className="w-10 h-10 text-indigo-400" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">人机对战</div>
                <div className="text-sm text-slate-500">与 AI 进行 1v1 ~ 1v3 战斗</div>
              </div>
            </button>

            <button
              data-testid="cover-lan"
              onClick={onLAN}
              className="group w-60 h-68 bg-slate-800/60 border-2 border-slate-700/60 rounded-3xl flex flex-col items-center justify-center gap-5 hover:bg-emerald-900/40 hover:border-emerald-500/60 transition-all duration-300 shadow-xl hover:shadow-emerald-500/10"
            >
              <div className="w-20 h-20 rounded-2xl bg-emerald-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Wifi className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">局域网联机</div>
                <div className="text-sm text-slate-500">创建或加入房间与朋友对战</div>
              </div>
            </button>

            <button
              data-testid="cover-test"
              onClick={onTest}
              className="group w-60 h-68 bg-slate-800/60 border-2 border-slate-700/60 rounded-3xl flex flex-col items-center justify-center gap-5 hover:bg-amber-900/40 hover:border-amber-500/60 transition-all duration-300 shadow-xl hover:shadow-amber-500/10"
            >
              <div className="w-20 h-20 rounded-2xl bg-amber-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <ClipboardList className="w-10 h-10 text-amber-400" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">录制测试</div>
                <div className="text-sm text-slate-500">按清单自动跑 matchup</div>
              </div>
            </button>
          </>
        )}
      </div>

      {/* 退出按钮（web 模式隐藏：无法关闭云端后端） */}
      {!webMode && (
        <div className="fixed bottom-8 right-8">
          <button
            onClick={handleQuit}
            disabled={isQuitting}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
              isQuitting
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 shadow-lg'
            }`}
          >
            <LogOut className={`w-5 h-5 ${isQuitting ? '' : 'group-hover:scale-110'}`} />
            <span className="font-medium">退出游戏</span>
          </button>
        </div>
      )}

      {/* v2.2.1.5: 教学入口按钮（左下角，"?"图标；手动唤起教学，前向兼容） */}
      <div className="fixed bottom-8 left-8">
        <button
          data-testid="cover-tutorial-button"
          onClick={() => useTutorialStore.getState().startTutorial()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500 shadow-lg transition-all duration-300"
          aria-label="打开游戏教学"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="font-medium">游戏教学</span>
        </button>
      </div>

      {/* 退出确认弹窗（web 模式不会触发） */}
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
