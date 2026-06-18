// 游戏教学 Store
//
// 设计原则（v2.2.1.5）：
// - 触发器与内容解耦：任何组件可调 startTutorial()
// - 每次进入 TestPage 都触发：不用 persist 中间件，不读 localStorage
// - version 字段保留作未来内容热替换占位，**当前不参与触发判断**
// - 跳过即关闭：下次 mount 重新触发

import { create } from 'zustand';
import { TUTORIAL_VERSION, TUTORIAL_STEPS } from '../components/Tutorial/tutorialSteps';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
}

interface TutorialStore {
  // 状态
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  version: string;

  // actions
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
}

export const useTutorialStore = create<TutorialStore>((set) => ({
  isActive: false,
  currentStep: 0,
  totalSteps: TUTORIAL_STEPS.length,
  version: TUTORIAL_VERSION,

  startTutorial: () => {
    set({
      isActive: true,
      currentStep: 0,
      totalSteps: TUTORIAL_STEPS.length,
    });
  },

  nextStep: () => {
    set((state) => {
      const next = state.currentStep + 1;
      if (next >= state.totalSteps) {
        // 已到最后一步：关闭
        return { isActive: false, currentStep: 0 };
      }
      return { currentStep: next };
    });
  },

  prevStep: () => {
    set((state) => {
      const prev = state.currentStep - 1;
      if (prev < 0) return state;
      return { currentStep: prev };
    });
  },

  skipTutorial: () => {
    set({ isActive: false, currentStep: 0 });
  },
}));