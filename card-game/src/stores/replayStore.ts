// V1 录制状态管理
//
// 与 V2 simulator Replay schema 兼容（types/replay.ts）
// 当前仅支持 1v1 模式（1vN / LAN 模式录制为未来扩展）
//
// 设计原则：
//   1. 录制状态独立于 gameStore，避免录制副作用污染游戏逻辑
//   2. recordMove 通过订阅模式注入（gameStore 调用 replayStore.getState()）
//   3. V1Move 复用 V2 的 Action 判别联合，无需为 V1 单独定义 Action 副本
//   4. savedReplays 写入 localStorage（关闭浏览器后仍可恢复）
//   5. v2.2.0-alpha: pendingUploads 持久化未上传 replay 队列（网络异常时入队，启动时补传）
//
// P1.5 业务逻辑重构：
//   - 移除"武装"状态，改为由 settingsStore.autoRecord 触发自动录制
//   - 新增 discardCurrentReplay / saveCurrentReplay / downloadCurrentReplay
//   - 新增 isLocked（保存时锁定胜利弹窗）
//
// v2.2.0-alpha 网页版新增：
//   - pendingUploads 字段持久化到 localStorage（升级 version=3）
//   - enqueuePending: 把已 finalReplay 但上传失败的 replay 入队
//   - popPending / markUploaded: 上传成功时移除队首失败时保留
//   - pendingCount: 给 UI 显示待上传数量

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PlayerId, CharacterId, GamePhase } from '../types';
import type { Action, PolicyParams } from '../ai/interfaces';

// ============ V1 录制数据结构 ============

/** V1 单步动作记录 */
export interface V1Move {
  turn: number;
  phase: GamePhase;
  playerId: PlayerId;
  /** V2 兼容的 Action 判别联合 */
  action: Action;
  /** 是否为人类玩家的动作（BC 训练仅用这些） */
  isHuman: boolean;
}

/** V1 完整对局 Replay */
export interface V1Replay {
  /** 数据格式版本标识 */
  version: '2.1.1-v1-replay';
  /** 对局开始 Unix ms */
  timestamp: number;
  /** 对局时长（毫秒） */
  duration: number;
  /** 引擎随机种子 */
  seed: number;
  /** 对局模式：当前仅 1v1 */
  gameMode: '1v1';
  /** 对局配置 */
  config: {
    humanCharId: CharacterId;
    aiCharId: CharacterId;
    policies: Array<{
      playerId: PlayerId;
      characterId: CharacterId;
      /** 'human' 或 'optimal_char_X' / 'preset_balanced_char_X' */
      policyName: string;
      /** 人类玩家为 null */
      policyParams: PolicyParams | null;
    }>;
  };
  /** 有序决策序列 */
  moves: V1Move[];
  /** 胜利者 ID（null = 平局） */
  winner: PlayerId | null;
  /** 终局状态摘要 */
  finalState: {
    turn: number;
    players: Array<{
      id: PlayerId;
      characterId: CharacterId;
      finalHP: number;
      maxHP: number;
      finalShield: number;
      marks: Array<{ name: string; remaining_turns: number }>;
    }>;
  };
}

// ============ Store 接口 ============

interface ReplayStore {
  /** 是否正在录制中（在游戏中） */
  isRecording: boolean;
  /** P1.5: 当前录制是否被锁定（保存过程中 true，避免胜利弹窗关闭） */
  isLocked: boolean;
  /** 当前正在录制的 Replay（停止或游戏结束后清空） */
  currentReplay: V1Replay | null;
  /** 已完成的回放队列（最近 N 局，FIFO 淘汰） */
  savedReplays: V1Replay[];
  /** 当前录制开始的 Unix ms（用于 UI 显示耗时） */
  recordingStartTime: number | null;
  /** v2.2.0-alpha: 未成功上传到远端的 replay 队列（持久化，跨会话保留） */
  pendingUploads: V1Replay[];

  // --- Actions ---

  /** 开始录制：创建 currentReplay 空壳，等 recordMove 填充 */
  startRecording: (meta: {
    seed: number;
    humanCharId: CharacterId;
    aiCharId: CharacterId;
    policies: V1Replay['config']['policies'];
  }) => void;

  /** 手动停止录制：把 currentReplay 推入 savedReplays（不推荐使用，胜利时用 finalizeReplay） */
  stopRecording: () => void;

  /** 记录一个动作（gameStore 的 action 方法末尾调用） */
  recordMove: (move: V1Move) => void;

  /** 游戏结束时调用：填入 winner + finalState 后归档。返回归档后的 replay。 */
  finalizeReplay: (winner: PlayerId | null, finalState: V1Replay['finalState']) => V1Replay | null;

  /** P1.5: 保存当前录制（写入 savedReplays），返回归档后的 replay。
   *
   * P1.6 修复：接受 winner + finalState 参数（可选），由调用方从 gameState 计算并传入。
   * 如果不传，winner=null / finalState=初始空（保持向后兼容但不推荐）。
   */
  saveCurrentReplay: (overrides?: {
    winner?: PlayerId | null;
    finalState?: V1Replay['finalState'];
  }) => V1Replay | null;

  /** P1.5: 丢弃当前录制（不清入 savedReplays） */
  discardCurrentReplay: () => void;

  /** P1.5: 设置锁定状态（保存/下载过程中置 true） */
  setLocked: (locked: boolean) => void;

  /** 清空已保存的回放列表 */
  clearSavedReplays: () => void;

  /** 删除已保存的某条回放 */
  removeSavedReplay: (index: number) => void;

  /** v2.2.0-alpha: 把已 final 的 replay 加入待上传队列（仅在网页版上传失败时调用） */
  enqueuePending: (replay: V1Replay) => void;
  /** v2.2.0-alpha: 取出队首待上传 replay（上传中用），返回原对象（不出队） */
  peekPending: () => V1Replay | null;
  /** v2.2.0-alpha: 上传成功时调用，从队列移除第一个匹配的 replay（按 timestamp + seed 匹配） */
  markUploaded: (replay: V1Replay) => void;
  /** v2.2.0-alpha: 清空待上传队列（仅供调试/重置用） */
  clearPendingUploads: () => void;
}

const MAX_SAVED_REPLAYS = 10;
const MAX_PENDING_UPLOADS = 50; // 待上传队列上限，避免 localStorage 无限增长

export const useReplayStore = create<ReplayStore>()(
  persist(
    (set, get) => ({
      isRecording: false,
      isLocked: false,
      currentReplay: null,
      savedReplays: [],
      recordingStartTime: null,
      pendingUploads: [],

      startRecording: (meta) => {
        const now = Date.now();
        set({
          isRecording: true,
          isLocked: false,
          recordingStartTime: now,
          currentReplay: {
            version: '2.1.1-v1-replay',
            timestamp: now,
            duration: 0,
            seed: meta.seed,
            gameMode: '1v1',
            config: {
              humanCharId: meta.humanCharId,
              aiCharId: meta.aiCharId,
              policies: meta.policies,
            },
            moves: [],
            winner: null,
            finalState: { turn: 0, players: [] },
          },
        });
      },

      stopRecording: () => {
        const { currentReplay, savedReplays } = get();
        if (currentReplay) {
          const finalized: V1Replay = {
            ...currentReplay,
            duration: Date.now() - currentReplay.timestamp,
          };
          set({
            isRecording: false,
            currentReplay: null,
            recordingStartTime: null,
            savedReplays: [finalized, ...savedReplays].slice(0, MAX_SAVED_REPLAYS),
          });
        } else {
          set({ isRecording: false, recordingStartTime: null });
        }
      },

      recordMove: (move) => {
        const { isRecording, currentReplay } = get();
        if (!isRecording || !currentReplay) return;
        set({
          currentReplay: {
            ...currentReplay,
            moves: [...currentReplay.moves, move],
          },
        });
      },

      finalizeReplay: (winner, finalState) => {
        const { currentReplay, savedReplays } = get();
        if (!currentReplay) return null;
        const finalized: V1Replay = {
          ...currentReplay,
          winner,
          finalState,
          duration: Date.now() - currentReplay.timestamp,
        };
        set({
          isRecording: false,
          currentReplay: null,
          recordingStartTime: null,
          savedReplays: [finalized, ...savedReplays].slice(0, MAX_SAVED_REPLAYS),
        });
        return finalized;
      },

      saveCurrentReplay: (overrides) => {
        const { currentReplay, savedReplays } = get();
        if (!currentReplay) return null;
        const finalized: V1Replay = {
          ...currentReplay,
          winner: overrides?.winner !== undefined ? overrides.winner : currentReplay.winner,
          finalState: overrides?.finalState ?? currentReplay.finalState,
          duration: Date.now() - currentReplay.timestamp,
        };
        set({
          isRecording: false,
          currentReplay: null,
          recordingStartTime: null,
          savedReplays: [finalized, ...savedReplays].slice(0, MAX_SAVED_REPLAYS),
        });
        return finalized;
      },

      discardCurrentReplay: () => {
        set({
          isRecording: false,
          currentReplay: null,
          recordingStartTime: null,
        });
      },

      setLocked: (locked) => set({ isLocked: locked }),

      clearSavedReplays: () => {
        set({ savedReplays: [] });
      },

      removeSavedReplay: (index) => {
        const { savedReplays } = get();
        set({ savedReplays: savedReplays.filter((_, i) => i !== index) });
      },

      // v2.2.0-alpha: 待上传队列管理
      enqueuePending: (replay) => {
        const { pendingUploads } = get();
        // 去重：同一 timestamp + seed 不重复入队
        if (pendingUploads.some(r => r.timestamp === replay.timestamp && r.seed === replay.seed)) {
          return;
        }
        const next = [...pendingUploads, replay];
        // 上限保护：超出时丢弃最旧的
        const trimmed = next.length > MAX_PENDING_UPLOADS ? next.slice(-MAX_PENDING_UPLOADS) : next;
        set({ pendingUploads: trimmed });
      },

      peekPending: () => {
        const { pendingUploads } = get();
        return pendingUploads.length > 0 ? pendingUploads[0] : null;
      },

      markUploaded: (replay) => {
        const { pendingUploads } = get();
        set({
          pendingUploads: pendingUploads.filter(
            r => !(r.timestamp === replay.timestamp && r.seed === replay.seed),
          ),
        });
      },

      clearPendingUploads: () => {
        set({ pendingUploads: [] });
      },
    }),
    {
      name: 'card-game-replays',
      storage: createJSONStorage(() => localStorage),
      // 持久化：已完成的回放 + 待上传队列（v2.2.0-alpha 升级）
      partialize: (state) => ({
        savedReplays: state.savedReplays,
        pendingUploads: state.pendingUploads,
      }),
      version: 3, // v2.2.0-alpha: 升级 v2→v3，新增 pendingUploads 字段（默认空数组）
    },
  ),
);
