// WebSocket 游戏服务器 — 房间管理 + 同步阶段计时 + 消息中继

const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const os = require('os');
const { GameHost } = require('./gameHost.cjs');

// ============ 常量 ============

const CHARACTER_IDS = [
  'char_1', 'char_2', 'char_3', 'char_4', 'char_5',
  'char_6', 'char_7', 'char_8', 'char_9',
];

const PHASE_TIMERS = {
  char_select: 60,
  card_exchange: 30,
  phase1: 30,
};

// ============ 状态 ============

let wss = null;
let roomState = null;
let phaseState = null;
const clients = new Map();
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 70000;
const DISCONNECT_TIMEOUT = 30000; // 断线等待重连窗口
let heartbeatTimer = null;
let gameTimers = null;
let disconnectTimers = new Map(); // playerId -> timeoutId

// ============ 时间银行 ============

let timeBank = new Map(); // playerId -> remaining seconds
let timeBankOrder = [];   // playerIds in action order
let timeBankIndex = 0;    // current index in order
let timeBankTimer = null;
let timeBankActionsInCycle = 0; // end_actions processed in current cycle
let gameHost = new GameHost(); // 服务端游戏主机（权威状态）

// ============ 工具 ============

function generateId() { return crypto.randomUUID().slice(0, 8); }

function lanLog(...args) {
  console.log('[LAN]', ...args);
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net && net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function getRoomStateForBroadcast() {
  if (!roomState) return null;
  return {
    roomId: roomState.roomId,
    hostId: roomState.hostId,
    phase: roomState.phase,
    players: roomState.players.map(p => ({
      id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready, connected: true,
    })),
    settings: { maxPlayers: 4 },
  };
}

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const [ws, info] of clients) {
    if (info.alive && ws.readyState === 1) {
      try { ws.send(data); } catch {}
    }
  }
}

function sendTo(ws, message) {
  if (ws.readyState === 1) {
    try { ws.send(JSON.stringify(message)); } catch {}
  }
}

// ============ 心跳 ============

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [ws, info] of clients) {
      if (!info.alive) continue;
      if (now - info.lastPong > HEARTBEAT_TIMEOUT) {
        handleDisconnect(ws);
        continue;
      }
      try { ws.ping(); } catch {}
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// ============ 连接管理 ============

function handleConnection(ws, req) {
  const clientId = generateId();
  const info = { id: clientId, playerId: null, nickname: null, alive: true, lastPong: Date.now() };
  clients.set(ws, info);

  ws.on('message', (data) => handleMessage(ws, data));
  ws.on('pong', () => { if (clients.has(ws)) clients.get(ws).lastPong = Date.now(); });
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => clients.delete(ws));

  try { ws.ping(); } catch {}
}

function handleDisconnect(ws) {
  if (!clients.has(ws)) return;
  const info = clients.get(ws);
  info.alive = false;
  lanLog('handleDisconnect:', info.playerId || 'no-player');

  if (info.playerId && roomState) {
    const idx = roomState.players.findIndex(p => p.id === info.playerId);
    if (idx !== -1) {
      if (roomState.phase === 'lobby' || roomState.phase === 'ended') {
        roomState.players.splice(idx, 1);
        broadcast({ type: 'player_left', playerId: info.playerId });
        if (roomState.hostId === info.playerId && roomState.players.length > 0) {
          roomState.hostId = roomState.players[0].id;
          roomState.players[0].isHost = true;
          roomState.players[0].ready = false;
        }
      } else {
        roomState.players[idx].connected = false;
        broadcast({ type: 'player_disconnected', playerId: info.playerId });
        // 启动断线计时器
        if (disconnectTimers.has(info.playerId)) {
          clearTimeout(disconnectTimers.get(info.playerId));
        }
        disconnectTimers.set(info.playerId, setTimeout(() => {
          handleDisconnectTimeout(info.playerId);
        }, DISCONNECT_TIMEOUT));
      }
      const rs = getRoomStateForBroadcast();
      if (rs) broadcast({ type: 'room_update', roomState: rs });
    }
  }
  clients.delete(ws);
}

function handleDisconnectTimeout(playerId) {
  if (!roomState) return;
  const idx = roomState.players.findIndex(p => p.id === playerId);
  if (idx === -1) return;

  // 通过游戏主机处理玩家死亡（非大厅阶段）
  if (roomState.phase !== 'lobby' && gameHost.initialized) {
    const newState = gameHost.removePlayer(playerId);
    if (newState) {
      broadcast({ type: 'sync_game_state', state: newState });
      if (newState.winner) checkAndHandleGameOver(newState.winner);
    }
  }

  const wasHost = roomState.hostId === playerId;
  roomState.players.splice(idx, 1);
  broadcast({ type: 'player_left', playerId, reason: 'timeout' });

  if (wasHost && roomState.players.length > 0) {
    roomState.hostId = roomState.players[0].id;
    roomState.players[0].isHost = true;
    roomState.players[0].ready = false;
  }

  const rs = getRoomStateForBroadcast();
  if (rs) broadcast({ type: 'room_update', roomState: rs });
  disconnectTimers.delete(playerId);
}

// ============ 阶段管理 ============

function initPhaseState() {
  phaseState = {
    phase: 'char_select',
    charSelect: {
      selections: new Map(),
      confirmed: new Set(),
    },
    exchange: { done: new Set() },
    energy: { done: new Set() },
  };
}

function clearPhaseTracking() {
  if (!phaseState) return;
  phaseState.exchange.done.clear();
  phaseState.energy.done.clear();
}

function allPlayersConfirmed() {
  const result = phaseState && phaseState.charSelect.confirmed.size === roomState.players.length;
  lanLog('allPlayersConfirmed:', result, 'confirmed:', phaseState?.charSelect.confirmed.size, 'total:', roomState?.players.length);
  return result;
}

function allExchangeDone() {
  const result = phaseState && phaseState.exchange.done.size === roomState.players.length;
  lanLog('allExchangeDone:', result, 'done:', phaseState?.exchange.done.size, 'total:', roomState?.players.length);
  return result;
}

function allEnergyDone() {
  const result = phaseState && phaseState.energy.done.size === roomState.players.length;
  lanLog('allEnergyDone:', result, 'done:', phaseState?.energy.done.size, 'total:', roomState?.players.length);
  return result;
}

function finalizeCharSelect() {
  if (!phaseState) return;

  const CHARACTERS = [...CHARACTER_IDS];
  for (const player of roomState.players) {
    if (!phaseState.charSelect.confirmed.has(player.id)) {
      const assigned = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      phaseState.charSelect.selections.set(player.id, assigned);
      phaseState.charSelect.confirmed.add(player.id);
    }
  }

  // Broadcast final selections
  const selections = roomState.players.map(p => ({
    playerId: p.id,
    characterId: phaseState.charSelect.selections.get(p.id) || null,
    confirmed: true,
  }));
  broadcast({ type: 'char_update', selections });
}

function advanceToPhase(newPhase) {
  if (!roomState) return;
  lanLog('advanceToPhase:', newPhase, '(from:', roomState.phase + ')');
  roomState.phase = newPhase;
  clearPhaseTracking();
  broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });

  const duration = PHASE_TIMERS[newPhase];
  if (duration) startGameTimer(newPhase, duration);
}

// ============ 计时器 ============

function startGameTimer(phase, duration) {
  lanLog('startGameTimer:', phase, duration + 's');
  if (gameTimers) clearTimeout(gameTimers.timeoutId);
  broadcast({ type: 'timer', phase, remaining: duration });

  gameTimers = {
    phase,
    endTime: Date.now() + duration * 1000,
    timeoutId: setTimeout(() => {
      broadcast({ type: 'timer', phase, remaining: 0 });
      handlePhaseTimeout(phase);
      gameTimers = null;
    }, duration * 1000),
  };
}

function handlePhaseTimeout(phase) {
  if (!roomState) return;
  if (phase === 'char_select') {
    finalizeCharSelect();
    // Server waits for host to send sync_game_state — do NOT advance yet
  } else if (phase === 'card_exchange' || phase === 'phase1') {
    // Find the next phase to transition to
    const nextPhase = phase === 'card_exchange' ? 'phase1' : 'phase2';
    advanceToPhase(nextPhase);
  }
}

// ============ 消息处理 ============

function handleMessage(ws, data) {
  let msg;
  try { msg = JSON.parse(data.toString()); }
  catch { sendTo(ws, { type: 'error', message: '无效消息格式' }); return; }

  const info = clients.get(ws);
  if (!info) return;

  lanLog('← msg:', msg.type, 'from:', info.playerId || (info.nickname || 'unknown'), 'phase:', roomState?.phase);

  switch (msg.type) {
    case 'join':           handleJoin(ws, info, msg); break;
    case 'ready':          handleReady(ws, info, msg); break;
    case 'leave':          handleLeave(ws, info); break;
    case 'start_game':     handleStartGame(ws, info); break;
    case 'char_select':    handleCharSelect(ws, info, msg); break;
    case 'char_confirm':   handleCharConfirm(ws, info); break;
    case 'exchange_done':  handleExchangeDone(ws, info); break;
    case 'energy_done':    handleEnergyDone(ws, info); break;
    case 'sync_game_state': handleSyncGameState(msg); break;
    case 'init_time_bank': handleInitTimeBank(info, msg); break;
    case 'end_action': handleEndAction(ws, info, msg); break;
    case 'use_skill': handleUseSkill(ws, info, msg); break;
    case 'use_special_card': handleUseSpecialCard(ws, info, msg); break;
    case 'spectate': /* client-side only, no server action needed */ break;
    case 'reset_phase':
      if (info.playerId && roomState && roomState.hostId === info.playerId) {
        lanLog('reset_phase by host:', info.playerId);
        roomState.phase = 'phase1';
        clearPhaseTracking();
        if (timeBankTimer) { clearInterval(timeBankTimer); timeBankTimer = null; }
        broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
        startGameTimer('phase1', PHASE_TIMERS.phase1);
      }
      break;
    case 'client_log': lanLog('[Client]', msg.message); break;
    default:
      // Relay all other game messages with playerId attached
      // Note: exchange_card, place_energy etc. still relay only (no auth processing)
      broadcast({ ...msg, fromPlayerId: info.playerId });
  }
}

function handleJoin(ws, info, msg) {
  if (!msg.nickname || !msg.nickname.trim()) {
    sendTo(ws, { type: 'error', message: '昵称不能为空' }); return;
  }
  if (!roomState) { sendTo(ws, { type: 'error', message: '房间不可用' }); return; }

  // Check for reconnection (same nickname)
  const existingPlayer = roomState.players.find(p => p.nickname === msg.nickname.trim());
  if (existingPlayer) {
    lanLog('handleJoin RECONNECT:', msg.nickname.trim(), 'as', existingPlayer.id);
    // Reconnection: update WS mapping
    for (const [oldWs, oldInfo] of clients) {
      if (oldInfo.playerId === existingPlayer.id && oldWs !== ws) {
        clients.delete(oldWs);
        break;
      }
    }
    info.playerId = existingPlayer.id;
    info.nickname = existingPlayer.nickname;
    existingPlayer.connected = true;
    // 取消断线计时器
    if (disconnectTimers.has(existingPlayer.id)) {
      clearTimeout(disconnectTimers.get(existingPlayer.id));
      disconnectTimers.delete(existingPlayer.id);
    }
    sendTo(ws, { type: 'welcome', playerId: existingPlayer.id, roomState: getRoomStateForBroadcast() });
    broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
    return;
  }

  if (roomState.players.length >= 4) { sendTo(ws, { type: 'error', message: '房间已满' }); return; }
  if (roomState.phase !== 'lobby') { sendTo(ws, { type: 'error', message: '游戏已经开始' }); return; }

  const playerId = generateId();
  const isHost = roomState.players.length === 0;
  const player = { id: playerId, nickname: msg.nickname.trim(), isHost, ready: false, connected: true };
  roomState.players.push(player);
  info.playerId = playerId;
  info.nickname = player.nickname;
  if (isHost) roomState.hostId = playerId;

  sendTo(ws, { type: 'welcome', playerId, roomState: getRoomStateForBroadcast() });
  broadcast({ type: 'player_joined', player });
  broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
}

function handleReady(ws, info, msg) {
  if (!info.playerId || !roomState) return;
  const player = roomState.players.find(p => p.id === info.playerId);
  if (!player) return;
  player.ready = !!msg.ready;
  broadcast({ type: 'player_ready', playerId: info.playerId, ready: player.ready });
  broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
}

function handleLeave(ws, info) {
  if (!info.playerId || !roomState) return;

  // 游戏进行中（非大厅/结束）→ 先处理角色死亡 + 胜负判定
  if (roomState.phase !== 'lobby' && roomState.phase !== 'ended' && gameHost.initialized) {
    const newState = gameHost.removePlayer(info.playerId);
    if (newState) {
      broadcast({ type: 'sync_game_state', state: newState });
      if (newState.winner) checkAndHandleGameOver(newState.winner);
    }
  }

  roomState.players = roomState.players.filter(p => p.id !== info.playerId);
  broadcast({ type: 'player_left', playerId: info.playerId });
  if (roomState.hostId === info.playerId && roomState.players.length > 0) {
    roomState.hostId = roomState.players[0].id;
    roomState.players[0].isHost = true;
    roomState.players[0].ready = false;
  }
  broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
  info.playerId = null;
}

function handleStartGame(ws, info) {
  if (!info.playerId || !roomState) return;
  lanLog('handleStartGame by:', info.playerId);
  if (roomState.hostId !== info.playerId) {
    sendTo(ws, { type: 'error', message: '只有房主可以开始游戏' }); return;
  }
  const nonHost = roomState.players.filter(p => !p.isHost);
  if (roomState.players.length < 2) { sendTo(ws, { type: 'error', message: '至少需要2名玩家' }); return; }
  if (!nonHost.every(p => p.ready)) { sendTo(ws, { type: 'error', message: '所有玩家必须准备' }); return; }
  lanLog('handleStartGame: conditions met, players:', roomState.players.length, '→ char_select');

  roomState.phase = 'char_select';
  initPhaseState();

  const charSelections = roomState.players.map(p => ({
    playerId: p.id, characterId: null, confirmed: false,
  }));

  broadcast({ type: 'game_start', charSelections });
  broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
  startGameTimer('char_select', 60);
}

// ============ 阶段消息处理 ============

function handleCharSelect(ws, info, msg) {
  if (!info.playerId || !phaseState || roomState.phase !== 'char_select') return;
  phaseState.charSelect.selections.set(info.playerId, msg.characterId);

  const selections = roomState.players.map(p => ({
    playerId: p.id,
    characterId: phaseState.charSelect.selections.get(p.id) || null,
    confirmed: phaseState.charSelect.confirmed.has(p.id),
  }));
  broadcast({ type: 'char_update', selections });
}

function handleCharConfirm(ws, info) {
  if (!info.playerId || !phaseState || roomState.phase !== 'char_select') return;
  phaseState.charSelect.confirmed.add(info.playerId);

  const selections = roomState.players.map(p => ({
    playerId: p.id,
    characterId: phaseState.charSelect.selections.get(p.id) || null,
    confirmed: phaseState.charSelect.confirmed.has(p.id),
  }));
  broadcast({ type: 'char_update', selections });

  if (allPlayersConfirmed()) {
    if (gameTimers) { clearTimeout(gameTimers.timeoutId); gameTimers = null; }
    finalizeCharSelect();
  }
}

function handleExchangeDone(ws, info) {
  if (!info.playerId || !phaseState || roomState.phase !== 'card_exchange') {
    lanLog('handleExchangeDone REJECTED by:', info?.playerId, 'phase:', roomState?.phase);
    return;
  }
  lanLog('handleExchangeDone by:', info.playerId);
  phaseState.exchange.done.add(info.playerId);
  if (allExchangeDone()) {
    if (gameTimers) { clearTimeout(gameTimers.timeoutId); gameTimers = null; }
    advanceToPhase('phase1');
  }
}

function handleEnergyDone(ws, info) {
  if (!info.playerId || !phaseState) {
    lanLog('handleEnergyDone REJECTED: no playerId or phaseState', info?.playerId);
    return;
  }
  lanLog('handleEnergyDone by:', info.playerId, 'roomPhase:', roomState?.phase);
  // 支持跨回合 phase 回退：服务端 roomState.phase 是 phase2/phase3 时，自动重置到 phase1
  if (roomState.phase !== 'phase1') {
    lanLog('handleEnergyDone: phase reset', roomState.phase, '→ phase1');
    roomState.phase = 'phase1';
    clearPhaseTracking();
    startGameTimer('phase1', PHASE_TIMERS.phase1);
  }
  phaseState.energy.done.add(info.playerId);
  if (allEnergyDone()) {
    if (gameTimers) { clearTimeout(gameTimers.timeoutId); gameTimers = null; }
    advanceToPhase('phase2');
  }
}

function handleSyncGameState(msg) {
  lanLog('handleSyncGameState: phase=' + msg.state?.phase + ' turn=' + msg.state?.turn + ' players=' + msg.state?.players?.length);
  gameHost.init(msg.state);
  broadcast({ type: 'sync_game_state', state: msg.state });
  advanceToPhase('card_exchange');
}

// ============ 时间银行 ============

function handleInitTimeBank(info, msg) {
  if (!info.playerId || !roomState) return;
  lanLog('handleInitTimeBank by:', info.playerId, 'order:', msg.playerIds?.length, 'players');
  // Only host can initialize
  if (roomState.hostId !== info.playerId) { lanLog('handleInitTimeBank REJECTED: not host'); return; }

  // Clear existing timer
  if (timeBankTimer) { clearInterval(timeBankTimer); timeBankTimer = null; }

  timeBank = new Map();
  timeBankOrder = msg.playerIds || [];
  let startIdx = timeBankOrder.indexOf(msg.currentPlayerId);
  if (startIdx === -1) startIdx = 0;

  // Skip dead players at init
  const state = gameHost.getState();
  if (state) {
    let attempts = 0;
    while (attempts < timeBankOrder.length) {
      const p = state.players.find(p => p.id === timeBankOrder[startIdx]);
      if (p && p.current_hp > 0) break;
      startIdx = (startIdx + 1) % timeBankOrder.length;
      attempts++;
    }
    if (attempts >= timeBankOrder.length) {
      // All players dead — game should be over
      broadcast({ type: 'time_bank', playerId: '', remaining: 0 });
      return;
    }
  }

  timeBankIndex = startIdx;
  timeBankActionsInCycle = 0;

  // Initialize 270s for each player
  for (const pid of timeBankOrder) {
    timeBank.set(pid, 270);
  }

  // +30s for first player (skip if sleeping)
  const currentPid = timeBankOrder[timeBankIndex];
  if (currentPid) {
    const firstPlayerSleep = state?.players.find(p => p.id === currentPid)?.has_sleep;
    if (!firstPlayerSleep) {
      timeBank.set(currentPid, (timeBank.get(currentPid) || 270) + 30);
    }
  }
  broadcast({ type: 'turn_change', playerId: currentPid });
  if (currentPid) broadcast({ type: 'time_bank', playerId: currentPid, remaining: timeBank.get(currentPid) || 300 });

  startTimeBankCountdown(currentPid);
}

function startTimeBankCountdown(playerId) {
  lanLog('startTimeBankCountdown:', playerId);
  if (timeBankTimer) { clearInterval(timeBankTimer); timeBankTimer = null; }

  timeBankTimer = setInterval(() => {
    if (!roomState || roomState.phase !== 'phase2') {
      clearInterval(timeBankTimer);
      timeBankTimer = null;
      return;
    }

    const current = timeBank.get(playerId) || 0;
    if (current <= 0) {
      clearInterval(timeBankTimer);
      timeBankTimer = null;
      broadcast({ type: 'time_bank', playerId, remaining: 0 });
      // 通过游戏主机处理玩家死亡
      if (gameHost.initialized) {
        const newState = gameHost.expirePlayer(playerId);
        if (newState) {
          broadcast({ type: 'sync_game_state', state: newState });
          if (newState.winner) checkAndHandleGameOver(newState.winner);
        }
      }
      broadcast({ type: 'time_expired', playerId });
      return;
    }

    const newValue = current - 1;
    timeBank.set(playerId, newValue);
    broadcast({ type: 'time_bank', playerId, remaining: newValue });
  }, 1000);
}

function handleEndAction(ws, info, msg) {
  if (!info.playerId || !roomState || roomState.phase !== 'phase2') {
    lanLog('handleEndAction REJECTED:', info?.playerId, 'phase:', roomState?.phase);
    return;
  }
  lanLog('handleEndAction by:', info.playerId, 'actionsInCycle:', timeBankActionsInCycle, '/ orderLen:', timeBankOrder.length);
  if (timeBankTimer) { clearInterval(timeBankTimer); timeBankTimer = null; }

  timeBankActionsInCycle++;

  // All players acted → stop time bank, relay end_action for clients to advance to phase3
  if (timeBankActionsInCycle >= timeBankOrder.length) {
    broadcast({ type: 'time_bank', playerId: info.playerId, remaining: 0 });
    broadcast({ ...msg, fromPlayerId: info.playerId });
    return;
  }

  // Advance to next alive player (skip dead/spectating players)
  const state = gameHost.initialized ? gameHost.getState() : null;
  let nextPid = null;
  let attempts = 0;

  do {
    const nextIdx = (timeBankIndex + 1) % timeBankOrder.length;
    timeBankIndex = nextIdx;
    nextPid = timeBankOrder[nextIdx];
    attempts++;

    if (attempts >= timeBankOrder.length) {
      // All players either acted or are eliminated
      broadcast({ type: 'time_bank', playerId: info.playerId, remaining: 0 });
      broadcast({ ...msg, fromPlayerId: info.playerId });
      return;
    }

    if (!state) break;

    const player = state.players.find(p => p.id === nextPid);
    if (player && player.current_hp <= 0) {
      timeBankActionsInCycle++;
      continue; // Skip dead player
    }
    break; // Found alive player
  } while (true);

  // +30s for next player (skip if sleeping)
  const nextPlayerSleep = state?.players.find(p => p.id === nextPid)?.has_sleep;
  timeBank.set(nextPid, nextPlayerSleep ? (timeBank.get(nextPid) || 270) : (timeBank.get(nextPid) || 270) + 30);
  broadcast({ type: 'turn_change', playerId: nextPid });
  broadcast({ type: 'time_bank', playerId: nextPid, remaining: timeBank.get(nextPid) || 300 });
  startTimeBankCountdown(nextPid);

  // Relay end_action for clients to process
  broadcast({ ...msg, fromPlayerId: info.playerId });
}

// ============ 房间状态机 ============

function checkAndHandleGameOver(winner) {
  if (!roomState || roomState.phase === 'ended') return;

  // 停止所有计时器
  if (gameTimers) { clearTimeout(gameTimers.timeoutId); gameTimers = null; }
  if (timeBankTimer) { clearInterval(timeBankTimer); timeBankTimer = null; }

  roomState.phase = 'ended';

  broadcast({ type: 'game_over', winner: { id: winner.id, name: winner.name } });
  broadcast({ type: 'room_update', roomState: getRoomStateForBroadcast() });
}

// ============ 服务端权威处理 ============

function handleUseSkill(ws, info, msg) {
  lanLog('use_skill by:', info.playerId, 'skillIdx:', msg.skillIndex);
  // 中继模式：服务端不自行执行技能逻辑，广播给所有客户端自行处理
  broadcast({ ...msg, fromPlayerId: info.playerId });
}

function handleUseSpecialCard(ws, info, msg) {
  lanLog('use_special_card by:', info.playerId);
  // 中继模式：服务端不自行执行特殊卡逻辑
  broadcast({ ...msg, fromPlayerId: info.playerId });
}

// ============ 生命周期 ============

module.exports = {
  start(port = 0) {
    return new Promise((resolve, reject) => {
      try {
        wss = new WebSocketServer({ port }, () => {
          const addr = wss.address();
          roomState = {
            roomId: generateId(),
            hostId: null,
            phase: 'lobby',
            players: [],
            settings: { maxPlayers: 4 },
          };
          startHeartbeat();
          resolve({ port: addr.port, ip: getLocalIP() });
        });
        wss.on('connection', handleConnection);
        wss.on('error', reject);
      } catch (err) { reject(err); }
    });
  },

  stop() {
    stopHeartbeat();
    if (gameTimers) { clearTimeout(gameTimers.timeoutId); gameTimers = null; }
    for (const [pid, tid] of disconnectTimers) { clearTimeout(tid); }
    disconnectTimers.clear();
    if (wss) {
      for (const [ws] of clients) { try { ws.close(1001, 'Server shutdown'); } catch {} }
      clients.clear();
      wss.close(() => {});
      wss = null;
    }
    roomState = null;
    phaseState = null;
    gameHost.reset();
  },

  isRunning() { return wss !== null; },

  getPlayerCount() {
    if (!roomState) return 0;
    return roomState.players.filter(p => p.connected).length;
  },
};
