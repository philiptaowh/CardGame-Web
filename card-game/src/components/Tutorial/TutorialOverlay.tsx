// 游戏教学 Overlay（全屏模态）
//
// 设计原则（v2.2.1.5 v3）：
// - 全局唯一挂载（在 App.tsx 根挂载）
// - 内容类型分发：text → 文本卡；demo → DemoBoard
// - 交互步骤：玩家完成动作后 1.5s 自动前进
// - 自动演示：log 行逐行显示后通知完成
// - 顶部 prompt 横幅（仅交互步骤显示）
// - z-index: z-50（demo 内部 modal 用 z-60）
// - ESC 关闭；←/→ 上下步；空格下一步

import { useEffect, useState } from 'react';
import { useTutorialStore } from '../../stores/tutorialStore';
import { TUTORIAL_STEPS } from './tutorialSteps';
import type { DemoContent } from './tutorialSteps';
import { DemoBoard } from './DemoBoard';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function TutorialOverlay() {
  const isActive = useTutorialStore((s) => s.isActive);
  const currentStep = useTutorialStore((s) => s.currentStep);
  const totalSteps = useTutorialStore((s) => s.totalSteps);
  const nextStep = useTutorialStore((s) => s.nextStep);
  const prevStep = useTutorialStore((s) => s.prevStep);
  const skipTutorial = useTutorialStore((s) => s.skipTutorial);

  // 交互状态：用于禁用「下一步」按钮直到玩家完成动作
  const [interactiveCompleted, setInteractiveCompleted] = useState(false);
  // 自动演示状态：用于禁用「下一步」按钮直到 log 行显示完
  const [autoDemoCompleted, setAutoDemoCompleted] = useState(false);

  // 步骤切换时重置状态
  useEffect(() => {
    setInteractiveCompleted(false);
    setAutoDemoCompleted(false);
  }, [currentStep]);

  // ESC / 方向键
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipTutorial();
      } else if (e.key === 'ArrowRight') {
        // 允许前进（非交互完成或非交互步骤）
        if (canProceed()) nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep, interactiveCompleted, autoDemoCompleted]);

  if (!isActive) return null;

  const step = TUTORIAL_STEPS[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === totalSteps - 1;
  const isDemo = step.content.type === 'demo';
  const demoContent = isDemo ? (step.content as DemoContent) : null;
  const isInteractive = demoContent?.interactive === true;

  function canProceed(): boolean {
    if (!isDemo) return true; // text 步骤可立即前进
    if (isInteractive) return interactiveCompleted; // 交互步骤需完成
    return autoDemoCompleted; // 自动演示需 log 行显示完
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      data-testid="tutorial-overlay"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* 头部：步骤计数 + 关闭按钮 */}
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>教学</span>
            <span className="text-slate-700">·</span>
            <span>
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          <button
            onClick={skipTutorial}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="关闭教学"
            data-testid="tutorial-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 交互步骤的顶部 prompt 横幅 */}
        {isInteractive && demoContent?.prompt && (
          <div
            className={`px-8 py-4 border-b transition-colors ${
              interactiveCompleted
                ? 'bg-green-900/20 border-green-700/50'
                : 'bg-indigo-900/30 border-indigo-700/50'
            }`}
            data-testid="tutorial-prompt"
          >
            <div
              className={`text-sm font-medium text-center ${
                interactiveCompleted ? 'text-green-300' : 'text-indigo-200'
              }`}
            >
              {interactiveCompleted ? '✅ ' : 'ⓘ '}
              {interactiveCompleted
                ? '完成！即将进入下一步…'
                : demoContent.prompt}
            </div>
          </div>
        )}

        {/* 中部：步骤内容 */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
            {step.title}
          </h2>

          {step.content.type === 'text' && (
            <>
              <div className="text-slate-300 text-base leading-relaxed whitespace-pre-line">
                {step.content.text}
              </div>
              {step.content.warning && (
                <div
                  className="mt-6 p-4 bg-red-900/30 border-2 border-red-600/60 rounded-xl text-red-300 font-bold text-base flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  data-testid="tutorial-warning"
                >
                  <span className="text-xl shrink-0">⚠️</span>
                  <span>{step.content.warning}</span>
                </div>
              )}
            </>
          )}

          {step.content.type === 'demo' && demoContent && (
            <div className="space-y-4">
              {/* key={currentStep} 强制 step 切换时重新挂载 DemoBoard，让 useReducer 用新 initialState 重新初始化
                  否则 useReducer 状态（phase / highlight / log 等）会保留上一个 step 的值 */}
              <DemoBoard
                key={currentStep}
                initialState={demoContent.state}
                expectedEndState={demoContent.interactive ? demoContent.expectedEndState : undefined}
                onComplete={() => {
                  if (demoContent.interactive) {
                    setInteractiveCompleted(true);
                  } else {
                    setAutoDemoCompleted(true);
                  }
                }}
              />
              {/* caption 说明文字 */}
              <div className="text-sm text-slate-400 bg-slate-800/40 rounded-xl px-4 py-3 border-l-4 border-indigo-500">
                📍 {demoContent.caption}
              </div>
            </div>
          )}
        </div>

        {/* 底部：点导航 + 上下步 + 跳过 */}
        <div className="px-8 py-5 border-t border-slate-800 bg-slate-900/50">
          {/* 点导航 */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-8 bg-indigo-500'
                    : idx < currentStep
                    ? 'w-2 bg-indigo-700'
                    : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* 按钮组 */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">上一步</span>
            </button>

            <button
              onClick={skipTutorial}
              className="px-4 py-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
            >
              跳过
            </button>

            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="tutorial-next"
            >
              <span className="text-sm">{isLastStep ? '完成' : '下一步'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}