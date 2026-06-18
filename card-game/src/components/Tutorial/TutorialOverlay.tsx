// 游戏教学 Overlay（全屏模态）
//
// 设计原则（v2.2.1.5）：
// - 全局唯一挂载（在 App.tsx 根挂载）
// - 全屏遮罩 + 卡片化步骤
// - 步骤点导航 + 上下步 + 跳过 + ESC 关闭
// - 内容来自 tutorialSteps.ts 数据（改文案不动组件）
// - z-index: z-50（参考 ConsentGate 层级）

import { useEffect } from 'react';
import { useTutorialStore } from '../../stores/tutorialStore';
import { TUTORIAL_STEPS } from './tutorialSteps';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function TutorialOverlay() {
  const isActive = useTutorialStore((s) => s.isActive);
  const currentStep = useTutorialStore((s) => s.currentStep);
  const totalSteps = useTutorialStore((s) => s.totalSteps);
  const nextStep = useTutorialStore((s) => s.nextStep);
  const prevStep = useTutorialStore((s) => s.prevStep);
  const skipTutorial = useTutorialStore((s) => s.skipTutorial);

  // ESC 键关闭 / 方向键导航
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipTutorial();
      } else if (e.key === 'ArrowRight') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTutorial]);

  if (!isActive) return null;

  const step = TUTORIAL_STEPS[currentStep];
  if (!step) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      data-testid="tutorial-overlay"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* 头部：步骤计数 + 关闭按钮 */}
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>教学</span>
            <span className="text-slate-700">·</span>
            <span>{currentStep + 1} / {totalSteps}</span>
          </div>
          <button
            onClick={skipTutorial}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="关闭教学"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 中部：步骤内容 */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
            {step.title}
          </h2>
          <div className="text-slate-300 text-base leading-relaxed whitespace-pre-line">
            {step.content}
          </div>
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
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <span className="text-sm">
                {currentStep === totalSteps - 1 ? '完成' : '下一步'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}