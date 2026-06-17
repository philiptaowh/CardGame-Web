// LAN 联机游戏 ??同步阶段处理（角色选择/换牌/能量放置?? GameBoard for phase2+

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { useWSConnection } from '../hooks/useWSConnection';
import { wsService } from '../services/websocketService';
import { GameBoard } from './GameBoard';
import type { ServerMessage, ClientMessage } from '../types/network';
import type { CharacterId, GamePhase } from '../types';
import { getAllCharacters } from '../game/characters';
import { Check, Clock, Timer, LogOut, Power, ArrowRight, ArrowLeft, Users } from 'lucide-react';

interface LANGameProps {
  onBack?: () => void;
}

// ============ 角色选择 ============

function LANCharSelect({
  playerId,
  onSelect,
  onConfirm,
  timer,
  players,
}: {
  playerId: string;
  onSelect: (charId: CharacterId) => void;
  onConfirm: () => void;
  timer: number;
  players: { playerId: string; nickname: string; characterId: string | null; confirmed: boolean }[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const characters = getAllCharacters();
  const current = players.find(p => p.playerId === playerId);

  const allConfirmed = players.every(p => p.confirmed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center p-8">
      {/* 计时器?*/}
      <div className="mb-6 flex items-center gap-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-full border border-slate-700/50">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className={`text-lg font-mono font-bold ${timer <= 10 ? 'text-red-400' : 'text-amber-400'}`}>
            {timer}s
          </span>
        </div>
        <div className="text-slate-400 text-sm">
          {allConfirmed ? '所有玩家已确认' : `等待确认 (${players.filter(p => p.confirmed).length}/${players.length})`}
        </div>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">选择你的角色</h1>

      {/* 玩家状态?*/}
      <div className="flex gap-4 mb-8">
        {players.map(p => (
          <div key={p.playerId} className={`px-3 py-1.5 rounded-full text-xs border ${
            p.playerId === playerId
              ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
              : p.confirmed
                ? 'bg-green-600/20 border-green-600/30 text-green-300'
                : 'bg-slate-700/30 border-slate-600/30 text-slate-400'
          }`}>
            {p.nickname} {p.confirmed ? '✓' : '...'}
            {p.playerId === playerId && ' (你)'}
          </div>
        ))}
      </div>

      {/* 角色网格 */}
      <div className="grid grid-cols-3 gap-3 max-w-xl w-full mb-8">
        {characters.map(char => (
          <button
            key={char.card_id}
            onClick={() => {
              setSelected(char.card_id);
              onSelect(char.card_id as CharacterId);
            }}
            disabled={current?.confirmed}
            className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              selected === char.card_id
                ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className={`font-bold ${selected === char.card_id ? 'text-indigo-200' : ''}`}>{char.name}</div>
            <div className="text-xs text-slate-500 mt-1">HP {char.hp}</div>
          </button>
        ))}
      </div>

      {/* 确认按钮 */}
      <button
        onClick={onConfirm}
        disabled={!selected || current?.confirmed || allConfirmed}
        className="px-10 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        {current?.confirmed ? <Check className="w-5 h-5" /> : null}
        {current?.confirmed ? '已确认' : (allConfirmed ? '等待其他玩家...' : '确认选择')}
      </button>
    </div>
  );
}

// ============ 换牌 ============

function LANCardExchange({
  timer,
  onDone,
}: {
  timer: number;
  onDone: () => void;
}) {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useNetworkStore(s => s.playerId);
  const sendMessage = useNetworkStore(s => s.sendMessage);
  const exchangeCard = useGameStore(s => s.exchangeCard);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const remaining = player.remaining_exchanges;
  const canSkip = !submitted;

  const handleConfirmExchange = () => {
    if (selectedIndex === null || remaining <= 0) return;
    exchangeCard(player.id, selectedIndex);
    sendMessage?.({ type: 'exchange_card', cardIndex: selectedIndex });
    setSelectedIndex(null);
  };

  const handleSkip = () => {
    if (!canSkip) return;
    setSubmitted(true);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span className={`text-lg font-mono font-bold ${timer <= 10 ? 'text-red-400' : 'text-emerald-400'}`}>
              {timer}s
            </span>
          </div>
          <div className="text-sm text-slate-400">
            换牌阶段 (剩余 {remaining} 次)
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-1">换牌阶段</h2>
        {remaining > 0 && (
          <p className="text-xs text-slate-500 mb-3">选择一张手牌放回牌组底部，然后抽取一张新卡</p>
        )}

        <div className="grid grid-cols-4 gap-2 mb-4">
          {player.hand.map((card, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div
                key={`${card.card_id}-${idx}`}
                className="relative group"
              >
                <button
                  onClick={() => {
                    if (submitted) return;
                    setSelectedIndex(isSelected ? null : idx);
                  }}
                  disabled={submitted}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-center ${
                    isSelected
                      ? 'bg-indigo-600/40 border-indigo-500 scale-105'
                      : 'bg-slate-800/60 border-slate-700/50 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-bold text-sm">{card.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{card.type === 'energy' ? `(能量${(card as any).energy}` : '特殊'}</div>
                </button>
                {card.type === 'special' && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl max-w-[220px]">
                      <div className="text-red-300 font-bold text-xs">{card.name}</div>
                      <div className="text-slate-300 text-[11px] mt-0.5 leading-tight">{card.description}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-center">
          <button
            onClick={handleConfirmExchange}
            disabled={selectedIndex === null || remaining <= 0 || submitted}
            className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            换牌{remaining > 0 ? ` (剩余${remaining})` : ''}
          </button>
          <button
            onClick={handleSkip}
            disabled={!canSkip}
            className="px-6 py-2 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitted ? '等待其他玩家...' : '结束换牌'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 能量放置 ============

function LANEnergyPlacement({
  timer,
  onDone,
  clientLog,
}: {
  timer: number;
  onDone: () => void;
  clientLog: (message: string) => void;
}) {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useNetworkStore(s => s.playerId);
  const sendMessage = useNetworkStore(s => s.sendMessage);
  const placeEnergyCard = useGameStore(s => s.placeEnergyCard);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const toggleCard = (idx: number) => {
    if (submitted) return;
    setSelectedCards(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleConfirm = () => {
    if (submitted) return;
    const sorted = [...selectedCards].sort((a, b) => b - a);
    for (const idx of sorted) {
      const card = player.hand[idx];
      const cardEnergy = card.type === 'energy' ? (card as any).energy : 1;
      placeEnergyCard(player.id, idx);
      sendMessage?.({ type: 'place_energy', cardIndices: [idx] });
      clientLog(`place_energy: ${player.name} ${card.name}(能量${cardEnergy})`);
    }
    setSubmitted(true);
    onDone();
  };

  const handleSkip = () => {
    if (submitted) return;
    setSubmitted(true);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-purple-400" />
            <span className={`text-lg font-mono font-bold ${timer <= 10 ? 'text-red-400' : 'text-purple-400'}`}>
              {timer}s
            </span>
          </div>
          <div className="text-sm text-slate-400">
            已选 {selectedCards.length} 张
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-3">阶段1 — 放置倡议能量</h2>
        <p className="text-xs text-slate-500 mb-3">选择手牌放置以决定行动顺序（能量卡按值计，特殊卡计1点）</p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {player.hand.map((card, idx) => {
            const isSelected = selectedCards.includes(idx);
            return (
              <div key={`${card.card_id}-${idx}`} className="relative group">
                <button
                  onClick={() => toggleCard(idx)}
                  disabled={submitted}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-center ${
                    isSelected
                      ? 'bg-indigo-600/40 border-indigo-500 scale-105'
                      : 'bg-slate-800/60 border-slate-700/50 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-bold text-sm">{card.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {card.type === 'energy' ? `(能量${(card as any).energy}` : '特殊(能量1)'}
                  </div>
                </button>
                {card.type === 'special' && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl max-w-[220px]">
                      <div className="text-red-300 font-bold text-xs">{card.name}</div>
                      <div className="text-slate-300 text-[11px] mt-0.5 leading-tight">{card.description}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-center">
          <button
            onClick={handleConfirm}
            disabled={selectedCards.length === 0 || submitted}
            className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            确认放置
          </button>
          <button
            onClick={handleSkip}
            disabled={submitted}
            className="px-6 py-2 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitted ? '等待其他玩家...' : '跳过'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 主组件?============

export function LANGame({ onBack }: LANGameProps) {
  const { wsUrl, playerId, nickname, isHost, players: roomPlayers } = useNetworkStore();
  const gameState = useGameStore(s => s.gameState);
  const gamePhase = useGameStore(s => s.gameState.phase);
  const initLANGame = useGameStore(s => s.initLANGame);
  const loadGameState = useGameStore(s => s.loadGameState);
  const [phase, setPhase] = useState<string>('char_select');
  const [timer, setTimer] = useState<number>(60);
  const [charSelections, setCharSelections] = useState<
    { playerId: string; characterId: string | null; confirmed: boolean }[]
  >([]);
  const [isQuitting, setIsQuitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [phaseTransitionText, setPhaseTransitionText] = useState('');
  const [synced, setSynced] = useState(false);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<string | null>(null);
  const [gameOverWinner, setGameOverWinner] = useState<{ id: string; name: string } | null>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const joinedRef = useRef(false);
  const charInitDoneRef = useRef(false);
  const timeBankInitRef = useRef(false);
  const sockSendRef = useRef<((msg: ClientMessage) => boolean) | null>(null);
  const prevTurnRef = useRef<number>(0);
  const prevHandSizesRef = useRef<Record<string, number>>({});

  // 客户端日志???转发到服务端终端
  const clientLog = useCallback((message: string) => {
    console.log('[LAN][Client]', message);
    sockSendRef.current?.({ type: 'client_log', message });
  }, []);

  // ============ 本地倒计时?============
  // 服务端只广播 timer 初始值和结束(0)，客户端自行逐秒递减
  useEffect(() => {
    const timedPhases: string[] = ['char_select', 'card_exchange', 'phase1'];
    if (!timedPhases.includes(phase)) return;

    const id = setInterval(() => {
      setTimer(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [phase]);

  // ============ 本地 phase 同步 ============
  // 引擎内部推动阶段变化（例如 endTurn → phase1 进入下一回合）时，
  // gameState.phase 已更新但本地 phase 未同步，导致弹窗不显示。
  // room_update 驱动的变化由 handleMessage 直接设置 setPhase，此处不会冲突。
  useEffect(() => {
    const validPhases = ['char_select', 'card_exchange', 'phase1', 'phase2', 'phase3', 'ended'];
    if (validPhases.includes(gamePhase) && gamePhase !== phase) {
      // 回合变更日志
      const gs = useGameStore.getState().gameState;
      if (gs.turn !== prevTurnRef.current) {
        clientLog(`turn=${gs.turn} phase=${gamePhase} (was ${phase})`);
        prevTurnRef.current = gs.turn;
      }
      setPhase(gamePhase);
      // endTurn 检测: phase2/3 → phase1 且不是首回合初始化，房主发送 reset_phase 到服务端
      if (isHost && gamePhase === 'phase1' && (phase === 'phase2' || phase === 'phase3')) {
        sockSendRef.current?.({ type: 'reset_phase' });
      }
    }
  }, [gamePhase, clientLog]);

  // ============ 抽牌检测（通过 hand.length 变化） ============
  useEffect(() => {
    const players = gameState.players;
    for (const player of players) {
      const prevSize = prevHandSizesRef.current[player.id] ?? player.hand.length;
      const currentSize = player.hand.length;
      if (currentSize > prevSize) {
        const diff = currentSize - prevSize;
        clientLog(`draw: ${player.name} +${diff}张 手牌=${currentSize}`);
      }
      prevHandSizesRef.current[player.id] = currentSize;
    }
  }, [gameState, clientLog]);

  // ============ WebSocket ============

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        setPhase(msg.roomState.phase);
        break;

      case 'room_update':
        console.log('[LAN][Client] room_update rcvd:', msg.roomState.phase, 'localPhase:', phase);
        if (msg.roomState.phase !== phase) {
          // phase1 ??phase2: 触发引擎 advancePhase 以计算行动顺序和 phase1_results
          if (msg.roomState.phase === 'phase2') {
            let safety = 0;
            let store = useGameStore.getState();
            console.log('[LAN][Client] advancePhase loop start: phase=', store.gameState.phase, 'turn=', store.gameState.turn);
            while (store.gameState.phase === 'phase1' && safety < 10) {
              store.advancePhase();
              safety++;
              store = useGameStore.getState();
            }
            console.log('[LAN][Client] advancePhase loop done: iter=' + safety, 'phase=', store.gameState.phase, 'turn=', store.gameState.turn);
            // 行动顺序日志
            const gsAfter = useGameStore.getState().gameState;
            if (gsAfter.action_order && gsAfter.action_order.length > 0) {
              const orderParts = gsAfter.action_order.map((pid: string) => {
                const p = gsAfter.players.find(pl => pl.id === pid);
                return p ? `${p.name}(${p.phase1_energy})` : pid;
              });
              clientLog(`order: ${orderParts.join(' > ')}`);
            }
          }
          showPhaseTransitionMsg(msg.roomState.phase);
          // Sync game store phase to match LAN phase
          const gs = useGameStore.getState().gameState;
          if (gs.phase !== msg.roomState.phase) {
            useGameStore.setState({ gameState: { ...gs, phase: msg.roomState.phase as GamePhase } });
          }
        }
        setPhase(msg.roomState.phase);
        // Check if disconnected player reconnected
        if (disconnectedPlayer) {
          const reconnected = msg.roomState.players.find(p => p.id === disconnectedPlayer && p.connected);
          if (reconnected) setDisconnectedPlayer(null);
        }
        break;

      case 'char_update':
        setCharSelections(msg.selections);
        // Host: when all confirmed, init game state and sync
        if (isHost && msg.selections.every(s => s.confirmed) && !charInitDoneRef.current) {
          charInitDoneRef.current = true;
          const lanPlayers = msg.selections.map(s => ({
            id: s.playerId,
            nickname: roomPlayers.find(rp => rp.id === s.playerId)?.nickname || s.playerId,
            characterId: s.characterId || 'char_1',
          }));
          initLANGame(lanPlayers, '1v1');
          const state = useGameStore.getState().gameState;
          sockSendRef.current?.({ type: 'sync_game_state', state });
        }
        break;

      case 'sync_game_state':
        // 所有客户端加载服务端权威状态态
        console.log("[LAN][Client] sync_game_state: phase=" + msg.state?.phase + " turn=" + msg.state?.turn);
        loadGameState(msg.state);
        setSynced(true);
        break;

      case 'timer':
        setTimer(msg.remaining);
        break;

      // ============ 中继消息处理 ============

      case 'use_skill':
        if (msg.fromPlayerId && msg.fromPlayerId !== playerId) {
          useGameStore.getState().useSkill(msg.fromPlayerId, msg.skillIndex, msg.targetId, msg.paymentCardIndices);
        }
        break;

      case 'use_special_card':
        if (msg.fromPlayerId && msg.fromPlayerId !== playerId) {
          useGameStore.getState().useSpecialCard(msg.fromPlayerId, msg.cardIndex, msg.targetId);
        }
        break;

      case 'end_action':
        if (msg.fromPlayerId && msg.fromPlayerId !== playerId) {
          useGameStore.getState().advancePhase();
        }
        break;

      case 'exchange_card':
        if (msg.fromPlayerId && msg.fromPlayerId !== playerId) {
          useGameStore.getState().exchangeCard(msg.fromPlayerId, msg.cardIndex);
        }
        break;

      case 'place_energy':
        if (msg.fromPlayerId && msg.fromPlayerId !== playerId) {
          for (const idx of msg.cardIndices) {
            useGameStore.getState().placeEnergyCard(msg.fromPlayerId, idx);
          }
        }
        break;

      // ============ 时间银行 ============

      case 'time_bank':
        useNetworkStore.getState().setTimeBank(
          msg.remaining > 0 ? { playerId: msg.playerId, remaining: msg.remaining } : null
        );
        break;

      case 'turn_change':
        useNetworkStore.getState().setCurrentTurnPlayerId(msg.playerId);
        break;

      case 'time_expired':
        if (msg.playerId) {
          const gs = useGameStore.getState().gameState;
          const deadPlayer = gs.players.find(p => p.id === msg.playerId);
          if (deadPlayer && deadPlayer.current_hp > 0) {
            deadPlayer.current_hp = 0;
            useGameStore.setState({ gameState: { ...gs } });
            useGameStore.getState().checkGameOver();
          }
        }
        break;

      case 'player_disconnected':
        setDisconnectedPlayer(msg.playerId);
        break;

      case 'player_left':
        // Clear disconnect notification if this player timed out
        setDisconnectedPlayer(prev => prev === msg.playerId ? null : prev);
        if (phase !== 'lobby' && msg.playerId) {
          const gs = useGameStore.getState().gameState;
          const gonePlayer = gs.players.find(p => p.id === msg.playerId);
          if (gonePlayer && gonePlayer.current_hp > 0) {
            gonePlayer.current_hp = 0;
            useGameStore.setState({ gameState: { ...gs } });
            useGameStore.getState().checkGameOver();
          }
        }
        break;

      case 'game_over':
        setGameOverWinner(msg.winner);
        break;


      case 'error':
        console.error('[LAN] Server error:', msg.message);
        break;
    }
  }, [phase, isHost, roomPlayers, playerId, initLANGame, loadGameState]);

  const { send, isConnected } = useWSConnection(handleMessage);

  // Store send function for GameBoard and sub-components to use
  useEffect(() => {
    sockSendRef.current = send;
    useNetworkStore.getState().setSendMessage(send);
  }, [send]);

  // Send join when connected
  useEffect(() => {
    if (isConnected && !joinedRef.current) {
      joinedRef.current = true;
      send({ type: 'join', nickname });
    }
  }, [isConnected, nickname, send]);

  // Host: send init_time_bank when phase2 starts (each turn)
  useEffect(() => {
    if (isHost && gamePhase === 'phase2' && !timeBankInitRef.current) {
      timeBankInitRef.current = true;
      const gs = useGameStore.getState().gameState;
      sockSendRef.current?.({
        type: 'init_time_bank',
        playerIds: gs.action_order,
        currentPlayerId: gs.players[gs.current_player_index]?.id,
      });
    }
    if (gamePhase !== 'phase2') {
      timeBankInitRef.current = false;
    }
  }, [isHost, gamePhase]);

  // 检测玩家死????提示观战/离开
  useEffect(() => {
    const gs = useGameStore.getState().gameState;
    const myPlayer = gs.players.find(p => p.id === playerId);
    if (myPlayer && myPlayer.current_hp <= 0 && phase === 'phase2' && !isSpectating) {
      // Player is dead ??show spectate/leave modal
      // (modal is rendered in the return block)
    }
  }, [gameState, playerId, phase, isSpectating]);

  // ============ 阶段切换动画 ============

  const showPhaseTransitionMsg = (newPhase: string) => {
    const labels: Record<string, string> = {
      char_select: '角色选择阶段',
      card_exchange: '换牌阶段',
      phase1: '阶段1 — 放置倡议能量',
      phase2: '阶段2 — 行动阶段',
      phase3: '印记结算',
      game_over: '游戏结束',
    };
    setPhaseTransitionText(labels[newPhase] || newPhase);
    setShowPhaseTransition(true);
    setTimeout(() => setShowPhaseTransition(false), 2000);
  };

  // ============ 角色选择操作 ============

  const handleCharSelect = (charId: CharacterId) => {
    send({ type: 'char_select', characterId: charId });
  };

  const handleCharConfirm = () => {
    send({ type: 'char_confirm' });
  };

  // ============ 换牌操作 ============

  const handleExchangeDone = () => {
    send({ type: 'exchange_done' });
  };

  // ============ 能量操作 ============

  const handleEnergyDone = () => {
    send({ type: 'energy_done' });
  };

  // ============ 返回主界面 / 退出 ============

  const handleReturnToMenu = () => {
    sockSendRef.current?.({ type: 'leave' });
    setTimeout(() => {
      wsService.disconnect();
      useNetworkStore.getState().reset();
      onBack?.();
    }, 100);
  };

  const handleQuit = async () => {
    sockSendRef.current?.({ type: 'leave' });
    setIsQuitting(true);
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
      return;
    }
    try { await fetch('/api/quit'); } catch {}
    setShowExitModal(true);
  };

  // ============ 游戏结束后操??============

  const handleStartSpectate = () => {
    send({ type: 'spectate' });
    setIsSpectating(true);
  };

  const handleLeaveAfterGame = () => {
    send({ type: 'leave' });
    onBack?.();
  };

  // ============ 渲染 ============

  // Phase transition overlay
  if (showPhaseTransition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center animate-in fade-in zoom-in duration-500">
          <ArrowRight className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white">{phaseTransitionText}</h2>
        </div>
      </div>
    );
  }

  // Disconnect notification banner
  const discPlayerName = disconnectedPlayer
    ? (gameState.players.find(p => p.id === disconnectedPlayer)?.name || roomPlayers.find(p => p.id === disconnectedPlayer)?.nickname || disconnectedPlayer)
    : null;

  const disconnectBanner = discPlayerName ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/20 border-b border-amber-500/30 py-2 px-4 text-center">
      <span className="text-amber-300 text-sm">
        {discPlayerName} 断线了，等待重新连接...
      </span>
      <button
        onClick={() => setDisconnectedPlayer(null)}
        className="ml-3 text-amber-400/60 hover:text-amber-300 text-xs"
      >
        关闭
      </button>
    </div>
  ) : null;

  // Character selection
  if (phase === 'char_select') {
    const selections = charSelections.length > 0
      ? charSelections.map(s => ({
          playerId: s.playerId,
          nickname: roomPlayers.find(rp => rp.id === s.playerId)?.nickname || s.playerId,
          characterId: s.characterId,
          confirmed: s.confirmed,
        }))
      : roomPlayers.map(p => ({ playerId: p.id, nickname: p.nickname, characterId: null as string | null, confirmed: false }));
    return (
      <>
        {disconnectBanner}
        <LANCharSelect
          playerId={playerId || ''}
          onSelect={handleCharSelect}
          onConfirm={handleCharConfirm}
          timer={timer}
          players={selections}
        />
        <div className="fixed bottom-8 right-8">
          <button onClick={handleReturnToMenu}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-600/30 hover:bg-slate-600 text-slate-400 hover:text-white border border-slate-500/30 transition-all"
          ><ArrowLeft className="w-5 h-5" /><span>返回主界面</span></button>
        </div>
        {showExitModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-10 max-w-md w-full text-center">
              <Power className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">游戏已退出</h2>
              <p className="text-slate-400">感谢参与本次卡牌原型测试</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Game over overlay (LAN mode)
  if (phase === 'ended') {
    const winnerName = gameOverWinner?.name
      || (gameState.winner?.name)
      || null;
    const isPlayerWinner = gameState.winner?.id === playerId;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isPlayerWinner ? 'bg-yellow-500/20' : 'bg-slate-700/30'
          }`}>
            <span className="text-5xl">{isPlayerWinner ? '🏆' : '💀'}</span>
          </div>

          <h2 className={`text-3xl font-bold mb-2 ${
            isPlayerWinner ? 'text-yellow-300' : 'text-slate-300'
          }`}>
            {winnerName ? `${winnerName} 获胜！` : '平局！'}
          </h2>

          <p className="text-slate-400 text-sm mb-8">
            游戏已结束          </p>

          <div className="flex justify-center">
            <button
              onClick={handleLeaveAfterGame}
              className="px-8 py-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
            >
              离开
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Phase2+ ??GameBoard
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const isDead = myPlayer && myPlayer.current_hp <= 0 && phase === 'phase2' && !isSpectating;

  return (
    <>
      {disconnectBanner}

      {/* 阵亡提示（可切换观战或离开??*/}
      {isDead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border-2 border-red-500/30 rounded-3xl p-10 max-w-md w-full mx-4 text-center shadow-2xl">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">💀</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">你已阵亡</h2>
            <p className="text-slate-400 text-sm mb-8">你可以选择观战或离开房间</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleStartSpectate}
                className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all"
              >
                观战
              </button>
              <button
                onClick={handleLeaveAfterGame}
                className="px-8 py-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
              >
                离开房间
              </button>
            </div>
          </div>
        </div>
      )}

      <GameBoard onBack={handleReturnToMenu} />

      {/* LAN 换牌弹窗（叠加在 GameBoard 之上） */}
      {phase === 'card_exchange' && (
        <LANCardExchange timer={timer} onDone={handleExchangeDone} />
      )}

      {/* LAN 能量放置弹窗（叠加在 GameBoard 之上??*/}
      {phase === 'phase1' && (
        <LANEnergyPlacement timer={timer} onDone={handleEnergyDone} clientLog={clientLog} />
      )}
    </>
  );
}
