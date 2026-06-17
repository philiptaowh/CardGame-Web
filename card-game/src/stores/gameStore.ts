// 游戏状态管理 (Zustand) — 薄封装层，实际逻辑委托给 GameEngine
//
// AI 集成说明：
//   - V2 RuleBasedAI（带 BO 最优参数）为默认 AI
//   - 内置 engine.aiTurn()（简单随机）保留作为降级/低难度选项
//   - 后续可通过 AiLevel 枚举扩展多档难度选择

import { create } from 'zustand';
import type { Player, GameState, CharacterId, PlayerId, GameMode } from '../types';
import { GameEngine } from '../game/gameEngine';
import { getCharacterById } from '../game/characters';
import { RuleBasedAI } from '../ai/ruleBasedAI';
import { getOptimalParams, getPresetParams } from '../ai/interfaces';
import type { IPlayerPolicy, Action, PolicyParams } from '../ai/interfaces';
import { mulberry32, deriveSeed } from '../types/replay';
import { useReplayStore } from './replayStore';
import type { V1Replay } from './replayStore';
import { useSettingsStore } from './settingsStore';
import { isWebMode } from '../config/buildMode';

// ============ AI 难度级别（预留扩展） ============

export type AiLevel = 'optimal' | 'simple';

// ============ 游戏状态Store ============

interface GameStore {
  gameState: GameState;
  /** 当前 AI 难度级别（默认 optimal，后续可加 UI 选择） */
  aiLevel: AiLevel;
  /** P1.7: 是否从 TestPage 启动的（用于决定是否自动标记录制进度） */
  isTestMode: boolean;

  initGame: (humanCharId: CharacterId, aiCharIds: CharacterId[], gameMode?: GameMode) => void;
  setAiLevel: (level: AiLevel) => void;
  setTestMode: (isTest: boolean) => void;
  chooseCharacter: (playerId: PlayerId, charId: CharacterId) => void;
  drawCard: (playerId: PlayerId, count?: number) => void;
  discardCard: (playerId: PlayerId, cardIndex: number) => void;
  exchangeCard: (playerId: PlayerId, cardIndex: number) => void;
  advanceExchange: () => void;
  placeEnergyCard: (playerId: PlayerId, cardIndex: number) => void;
  useSkill: (playerId: PlayerId, skillIndex: number, targetId: PlayerId, paymentCardIndices: number[]) => void;
  aiTurn: () => void;
  useSpecialCard: (playerId: PlayerId, cardIndex: number, targetId?: PlayerId) => void;
  resolveMarks: (playerId: PlayerId) => void;
  advancePhase: () => void;
  endTurn: () => void;
  addLog: (message: string) => void;
  getCurrentPlayer: () => Player | undefined;
  checkGameOver: () => Player | null;
  handleDeckDepletion: () => void;
  initLANGame: (lanPlayers: { id: string; nickname: string; characterId: CharacterId }[], gameMode?: GameMode) => void;
  loadGameState: (state: GameState) => void;
  /** 构建当前对局的 Replay 录制元数据（仅 1v1 模式返回有效值） */
  getRecordingMeta: () => {
    seed: number;
    humanCharId: CharacterId;
    aiCharId: CharacterId;
    policies: V1Replay['config']['policies'];
  } | null;
}

let engine = new GameEngine();
/** 每个 AI 玩家对应的 V2 策略实例 */
let aiPolicies: Map<PlayerId, IPlayerPolicy> = new Map();

/** 将引擎状态同步到 Zustand */
function syncToStore(): GameState {
  return engine.getState();
}

/** 将 Zustand 状态同步到引擎（调用引擎方法前必须先调用此函数） */
function syncToEngine(): void {
  const { gameState } = useGameStore.getState();
  engine.loadState(gameState);
}

// ============ AI 策略工厂 ============

/** 根据角色 ID 和难度创建策略实例 */
function createAiPolicy(charId: CharacterId, level: AiLevel, seed: number): IPlayerPolicy | null {
  if (level === 'optimal') {
    const params = getOptimalParams(charId);
    if (params) {
      const policy = new RuleBasedAI(`optimal_${charId}`, params);
      policy.setPRNG(mulberry32(seed));
      return policy;
    }
    // 最优参数不存在时降级为 balanced
    const fallback = getPresetParams('balanced');
    if (fallback) {
      const policy = new RuleBasedAI(`preset_balanced_${charId}`, fallback);
      policy.setPRNG(mulberry32(seed));
      return policy;
    }
    return null;
  }
  // level === 'simple' → 返回 null，走 engine.aiTurn() 降级
  return null;
}

/** 为当前游戏状态中的所有 AI 玩家重建策略实例 */
function rebuildAiPolicies(level: AiLevel): void {
  aiPolicies = new Map();
  const state = engine.getState();
  if (!state) return;
  state.players.forEach((player, idx) => {
    if (player.type === 'ai' && player.character_id) {
      const policy = createAiPolicy(player.character_id as CharacterId, level, 42 + idx * 100);
      if (policy) {
        aiPolicies.set(player.id, policy);
      }
    }
  });
}

// ============ AI 动作执行器 ============

/** 执行 V2 策略决策的动作，与 GameRunner.executeAction 逻辑一致 */
function executeAiAction(playerId: PlayerId, action: Action): void {
  // ===== 录制前置：捕获执行前状态 =====
  const stateBefore = engine.getState();
  const gameMode = stateBefore.gameMode;
  const turn = stateBefore.turn;
  const phase = stateBefore.phase;
  // 仅记录非 pass 的玩家动作（pass 是系统行为，不属于决策）
  const shouldRecord = gameMode === '1v1' && action.type !== 'pass';

  switch (action.type) {
    case 'place_energy':
      engine.placeEnergyCard(playerId, action.cardIndex);
      break;
    case 'use_skill':
      engine.useSkill(playerId, action.skillIndex, action.targetId, action.paymentCardIndices);
      break;
    case 'use_special_card':
      engine.useSpecialCard(playerId, action.cardIndex, action.targetId);
      break;
    case 'pass':
      // pass → 推进阶段（由引擎处理阶段切换/回合结束）
      engine.advancePhase();
      break;
    default:
      break;
  }

  // ===== 录制 hook（仅 1v1，且非 pass）=====
  if (shouldRecord) {
    const replayState = useReplayStore.getState();
    if (replayState.isRecording) {
      replayState.recordMove({
        turn,
        phase,
        playerId,
        action,
        isHuman: false,
      });
    }
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: engine.getState(),
  aiLevel: 'optimal',
  isTestMode: false,

  initGame: (humanCharId, aiCharIds, gameMode) => {
    // v2.2.0-alpha 网页版：强制 1v1 + 强制录像（无视 settingsStore.autoRecord）
    const effectiveMode: GameMode = isWebMode() ? '1v1' : (gameMode ?? '1v1');
    engine = new GameEngine();
    engine.initGame(humanCharId, aiCharIds, effectiveMode);
    const level = get().aiLevel;
    rebuildAiPolicies(level);
    set({ gameState: engine.getState() });

    // P1.5: 若 settingsStore.autoRecord 为 true 且为 1v1 模式，初始化游戏时自动开始录制
    // v2.2.0-alpha 网页版：强制开录制（无论 settingsStore.autoRecord）
    const settings = useSettingsStore.getState();
    const shouldRecord = isWebMode() || settings.autoRecord;
    if (shouldRecord && effectiveMode === '1v1') {
      const meta = get().getRecordingMeta();
      if (meta) {
        useReplayStore.getState().startRecording(meta);
      }
    }
  },

  setAiLevel: (level) => {
    set({ aiLevel: level });
    // 如果游戏已在进行，重建 AI 策略
    const state = get().gameState;
    if (state && state.players.some(p => p.type === 'ai')) {
      rebuildAiPolicies(level);
    }
  },

  setTestMode: (isTest) => set({ isTestMode: isTest }),

  initLANGame: (lanPlayers, gameMode) => {
    engine = new GameEngine();
    engine.initLANGame(lanPlayers, gameMode);
    aiPolicies = new Map(); // LAN 模式无 AI
    set({ gameState: engine.getState() });
  },

  loadGameState: (state) => {
    engine = new GameEngine(state);
    const level = get().aiLevel;
    rebuildAiPolicies(level);
    set({ gameState: engine.getState() });
  },

  chooseCharacter: (playerId, charId) => {
    const gs = get().gameState;
    const player = gs.players.find(p => p.id === playerId);
    if (player) {
      const char = getCharacterById(charId);
      if (char) {
        player.character_id = charId;
        player.max_hp = char.hp;
        player.current_hp = char.hp;
      }
    }
    set({ gameState: { ...gs } });
  },

  drawCard: (playerId, count) => {
    syncToEngine();
    engine.drawCard(playerId, count);
    set({ gameState: syncToStore() });
  },

  discardCard: (playerId, cardIndex) => {
    syncToEngine();
    engine.discardCard(playerId, cardIndex);
    set({ gameState: syncToStore() });
  },

  exchangeCard: (playerId, cardIndex) => {
    const gs = get().gameState;
    syncToEngine();
    engine.exchangeCard(playerId, cardIndex);
    set({ gameState: syncToStore() });

    // ===== 录制 hook（仅 1v1）=====
    if (gs.gameMode === '1v1') {
      const replayState = useReplayStore.getState();
      if (replayState.isRecording) {
        replayState.recordMove({
          turn: gs.turn,
          phase: gs.phase,
          playerId,
          action: { type: 'exchange', cardIndex },
          isHuman: gs.players.find(p => p.id === playerId)?.type === 'human',
        });
      }
    }
  },

  advanceExchange: () => {
    syncToEngine();
    engine.advanceExchange();
    set({ gameState: syncToStore() });
  },

  placeEnergyCard: (playerId, cardIndex) => {
    const gs = get().gameState;
    syncToEngine();
    engine.placeEnergyCard(playerId, cardIndex);
    set({ gameState: syncToStore() });

    // ===== 录制 hook（仅 1v1）=====
    if (gs.gameMode === '1v1') {
      const replayState = useReplayStore.getState();
      if (replayState.isRecording) {
        replayState.recordMove({
          turn: gs.turn,
          phase: gs.phase,
          playerId,
          action: { type: 'place_energy', cardIndex },
          isHuman: gs.players.find(p => p.id === playerId)?.type === 'human',
        });
      }
    }
  },

  useSkill: (playerId, skillIndex, targetId, paymentCardIndices) => {
    const gs = get().gameState;
    syncToEngine();
    engine.useSkill(playerId, skillIndex, targetId, paymentCardIndices);
    set({ gameState: syncToStore() });

    // ===== 录制 hook（仅 1v1）=====
    if (gs.gameMode === '1v1') {
      const replayState = useReplayStore.getState();
      if (replayState.isRecording) {
        replayState.recordMove({
          turn: gs.turn,
          phase: gs.phase,
          playerId,
          action: { type: 'use_skill', skillIndex, targetId, paymentCardIndices },
          isHuman: gs.players.find(p => p.id === playerId)?.type === 'human',
        });
      }
    }
  },

  aiTurn: () => {
    syncToEngine();
    const state = engine.getState();
    const aiPlayer = state.players[state.current_player_index];
    if (!aiPlayer || aiPlayer.type !== 'ai') return;

    const policy = aiPolicies.get(aiPlayer.id);
    if (!policy) {
      // 无 V2 策略 → 降级到引擎内置简单随机 AI（原版 engine.aiTurn 自身含循环）
      engine.aiTurn();
      set({ gameState: syncToStore() });
      return;
    }

    // V2 RuleBasedAI 持续决策 → 循环执行直到 pass
    // 原因：policy.decide() 返回单步动作（place_energy / use_skill / pass），
    // 而 AIController 只调一次 aiTurn()，必须在此循环内完成整个回合的决策。
    // 参考 V2 GameRunner 的 while 循环模式。
    let safety = 0;
    let hasPlacedEnergy = false; // phase1 是否已放置能量（每回合最多放1张，保留手牌给技能）
    const MAX_ACTIONS = 50;
    const startTurn = engine.getState().turn;
    const startPhase = engine.getState().phase;
    console.log(`[aiTurn] 开始 turn=${startTurn} phase=${startPhase} player=${aiPlayer.name}`);
    while (safety < MAX_ACTIONS) {
      safety++;
      const curState = engine.getState();
      // 只处理 action phase（phase1 放能、phase2 行动）
      if (curState.phase !== 'phase1' && curState.phase !== 'phase2') {
        console.log(`[aiTurn] 非 action phase(${curState.phase})，退出循环`);
        break;
      }
      // 检查是否还是该 AI 的回合（轮到人类或 AI 回合结束）
      if (curState.players[curState.current_player_index]?.id !== aiPlayer.id) {
        console.log(`[aiTurn] 当前玩家已切换，退出循环`);
        break;
      }
      const curPlayer = curState.players.find(p => p.id === aiPlayer.id);
      if (!curPlayer) break;
      // phase1 已放置过能量 → 强制 pass（每回合最多放1张，保留手牌能量给 phase2 技能释放）
      if (curState.phase === 'phase1' && hasPlacedEnergy) {
        console.log(`[aiTurn] phase1 已放置能量，强制 pass`);
        engine.advancePhase();
        continue;
      }
      // phase2 已行动过则跳过
      if (curState.phase === 'phase2' && curPlayer.has_acted_this_turn) {
        console.log(`[aiTurn] 已行动过，退出循环`);
        break;
      }

      let action: Action;
      try {
        action = policy.decide(curState, aiPlayer.id);
      } catch (err) {
        console.error(`[aiTurn] policy.decide 异常，降级为 pass:`, err);
        action = { type: 'pass' };
      }
      console.log(`[aiTurn] 决策: ${JSON.stringify(action)} (手牌: ${curPlayer.hand.length}张)`);
      executeAiAction(aiPlayer.id, action);
      if (action.type === 'place_energy') hasPlacedEnergy = true;
      // ===== 关键修复：匹配 V1 engine.aiTurn() 行为 =====
      // V1 原版在 phase2 的每次行动后都会调用 advancePhase() 来推进至下一玩家。
      // 只有 action 为 'pass' 时 advancePhase 已在 executeAiAction 内调用。
      if (action.type !== 'pass') {
        const postState = engine.getState();
        if (postState.phase === 'phase2') {
          engine.advancePhase();
        }
      }
      if (action.type === 'pass') {
        // pass → engine.advancePhase() 已触发阶段推进，继续循环处理下一阶段
        continue;
      }
    }
    if (safety >= MAX_ACTIONS) {
      console.warn(`[aiTurn] 安全上限 ${MAX_ACTIONS} 触发，强制结束 AI 回合`);
    }
    const endState = engine.getState();
    console.log(`[aiTurn] 结束 turn=${endState.turn} phase=${endState.phase} 总动作=${safety}`);
    set({ gameState: syncToStore() });
  },

  useSpecialCard: (playerId, cardIndex, targetId) => {
    const gs = get().gameState;
    syncToEngine();
    engine.useSpecialCard(playerId, cardIndex, targetId);
    set({ gameState: syncToStore() });

    // ===== 录制 hook（仅 1v1）=====
    if (gs.gameMode === '1v1') {
      const replayState = useReplayStore.getState();
      if (replayState.isRecording) {
        replayState.recordMove({
          turn: gs.turn,
          phase: gs.phase,
          playerId,
          action: { type: 'use_special_card', cardIndex, targetId },
          isHuman: gs.players.find(p => p.id === playerId)?.type === 'human',
        });
      }
    }
  },

  resolveMarks: (playerId) => {
    syncToEngine();
    engine.resolveMarks(playerId);
    set({ gameState: syncToStore() });
  },

  advancePhase: () => {
    syncToEngine();
    engine.advancePhase();
    set({ gameState: syncToStore() });
  },

  endTurn: () => {
    syncToEngine();
    engine.endTurn();
    set({ gameState: syncToStore() });
  },

  addLog: (message) => {
    syncToEngine();
    engine.addLog(message);
    set({ gameState: syncToStore() });
  },

  getCurrentPlayer: () => {
    return get().gameState.players[get().gameState.current_player_index];
  },

  checkGameOver: () => {
    syncToEngine();
    engine.checkGameOver();
    set({ gameState: syncToStore() });
    const winnerPlayer = get().gameState.winner;

    // ===== 录制 finalize hook：游戏结束时自动归档当前 Replay =====
    const state = get().gameState;
    if (state.gameMode === '1v1') {
      const replayState = useReplayStore.getState();
      if (replayState.isRecording && replayState.currentReplay) {
        const finalState: V1Replay['finalState'] = {
          turn: state.turn,
          players: state.players.map(p => ({
            id: p.id,
            characterId: p.character_id,
            finalHP: p.current_hp,
            maxHP: p.max_hp,
            finalShield: p.shield,
            marks: p.marks.map(m => ({ name: m.name, remaining_turns: m.remaining_turns })),
          })),
        };
        replayState.finalizeReplay(winnerPlayer?.id ?? null, finalState);
      }
    }

    return winnerPlayer;
  },

  handleDeckDepletion: () => {
    syncToEngine();
    engine.handleDeckDepletion();
    set({ gameState: syncToStore() });
  },

  getRecordingMeta: () => {
    const state = get().gameState;
    if (!state || state.gameMode !== '1v1') return null;
    const aiLevel = get().aiLevel;
    const humanPlayer = state.players.find(p => p.type === 'human');
    const aiPlayer = state.players.find(p => p.type === 'ai');
    if (!humanPlayer || !aiPlayer) return null;
    const policies: V1Replay['config']['policies'] = state.players.map(p => {
      if (p.type === 'human') {
        return {
          playerId: p.id,
          characterId: p.character_id,
          policyName: 'human',
          policyParams: null,
        };
      }
      // AI：根据当前 aiLevel 选 optimal 或 balanced
      const params: PolicyParams | null = aiLevel === 'optimal'
        ? (getOptimalParams(p.character_id) ?? getPresetParams('balanced') ?? null)
        : (getPresetParams('balanced') ?? null);
      const policyName = aiLevel === 'optimal'
        ? `optimal_${p.character_id}`
        : `preset_balanced_${p.character_id}`;
      return {
        playerId: p.id,
        characterId: p.character_id,
        policyName,
        policyParams: params,
      };
    });
    return {
      seed: Date.now(),
      humanCharId: humanPlayer.character_id,
      aiCharId: aiPlayer.character_id,
      policies,
    };
  },
}));
