// 设置弹窗 UI 状态管理
//
// 与 gameStore / replayStore 完全独立：
//   - 弹窗开关 / Tab 切换是纯 UI 状态，不应触发游戏重渲染
//   - autoRecord 业务开关持久化到 localStorage
//
// 设计原则：只放 UI 状态与少量业务开关，不放业务数据（业务数据归 gameStore / replayStore）

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** 设置弹窗 Tab 标识 */
export type SettingsTab = 'recording' | 'aiLevel' | 'about';

/** AI 难度选项（Phase 1 仅 'optimal'，Phase 5 启用 'bc'） */
export type AiLevelUi = 'simple' | 'optimal' | 'bc';

interface SettingsStore {
  /** 弹窗是否打开 */
  isOpen: boolean;
  /** 当前激活的 Tab */
  activeTab: SettingsTab;
  /** AI 难度（UI 展示用，实际生效在 gameStore.aiLevel） */
  aiLevel: AiLevelUi;
  /** P1.5: 自动录制开关。开启后每局 1v1 自动开始录制（默认 false） */
  autoRecord: boolean;

  // --- Actions ---
  open: (tab?: SettingsTab) => void;
  close: () => void;
  setActiveTab: (tab: SettingsTab) => void;
  setAiLevel: (level: AiLevelUi) => void;
  setAutoRecord: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      isOpen: false,
      activeTab: 'recording',
      aiLevel: 'optimal',
      autoRecord: false, // 默认关闭

      open: (tab) => set({ isOpen: true, activeTab: tab ?? 'recording' }),
      close: () => set({ isOpen: false }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setAiLevel: (level) => set({ aiLevel: level }),
      setAutoRecord: (on) => set({ autoRecord: on }),
    }),
    {
      name: 'card-game-settings',
      storage: createJSONStorage(() => localStorage),
      // 仅持久化业务开关，不持久化弹窗状态
      partialize: (state) => ({
        autoRecord: state.autoRecord,
        aiLevel: state.aiLevel,
      }),
      version: 1,
    },
  ),
);
