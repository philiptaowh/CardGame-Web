// 房间大厅 - 创建房间 / 加入房间 / 房间等待（WebSocket 联机版）

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Wifi, WifiOff, Users, Play, Copy, Check, LogOut, Power, Loader2,
} from 'lucide-react';
import { useWSConnection } from '../hooks/useWSConnection';
import { wsService } from '../services/websocketService';
import { useNetworkStore } from '../stores/networkStore';
import type { ServerMessage, RoomState, RoomPlayer } from '../types/network';

interface LobbyProps {
  onGameStart: () => void;
  onBack: () => void;
}

type LobbyView = 'select' | 'create' | 'join' | 'room';

export function Lobby({ onGameStart, onBack }: LobbyProps) {
  const [view, setView] = useState<LobbyView>('select');
  const [nickname, setNickname] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [isQuitting, setIsQuitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [ready, setReady] = useState(false);

  // ============ WebSocket 消息处理 ============

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        setPlayerId(msg.playerId);
        setRoomState(msg.roomState);
        setPlayers(msg.roomState.players);
        setIsHost(msg.roomState.hostId === msg.playerId);
        break;
      case 'room_update':
        setRoomState(msg.roomState);
        setPlayers(msg.roomState.players);
        break;
      case 'player_joined':
        setPlayers(prev => {
          if (prev.some(p => p.id === msg.player.id)) return prev;
          return [...prev, msg.player];
        });
        break;
      case 'player_left':
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId));
        break;
      case 'player_ready':
        setPlayers(prev => prev.map(p =>
          p.id === msg.playerId ? { ...p, ready: msg.ready } : p
        ));
        break;
      case 'game_start':
        // Store connection info for LANGame component
        useNetworkStore.getState().setLAN({
          wsUrl,
          playerId: playerId || '',
          nickname,
          isHost,
          players: players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost })),
        });
        onGameStart();
        break;
      case 'error':
        setErrorMsg(msg.message);
        break;
      case 'kicked':
        setErrorMsg(msg.reason);
        break;
    }
  }, [onGameStart, wsUrl, playerId, nickname, isHost, players]);

  const { send, isConnected, disconnect } = useWSConnection(handleServerMessage);

  // Auto-connect when wsUrl is set
  useEffect(() => {
    if (wsUrl) {
      wsService.connect(wsUrl, { autoReconnect: true });
    }
  }, [wsUrl]);

  // Send join when connected
  const joinedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !joinedRef.current && nickname) {
      joinedRef.current = true;
      send({ type: 'join', nickname });
    }
  }, [isConnected, nickname, send]);

  // Reset joined flag on disconnect
  useEffect(() => {
    if (!isConnected) {
      joinedRef.current = false;
    }
  }, [isConnected]);

  // ============ 创建房间 ============

  const handleCreateRoom = async () => {
    if (!nickname.trim()) return;
    setIsStartingServer(true);
    setServerError(null);

    try {
      let info: ServerInfo;

      const DEV_PORT = 9222;

      if (window.electronAPI?.startServer) {
        info = await window.electronAPI.startServer();
      } else {
        // Dev mode: 连接独立启动的 dev-server (npm run dev:server)
        info = { port: DEV_PORT, ip: '127.0.0.1' };
      }

      setServerInfo(info);

      const url = `ws://127.0.0.1:${info.port}`;
      setWsUrl(url);
      setView('room');
    } catch (err: any) {
      setServerError(err.message || '服务器启动失败');
    } finally {
      setIsStartingServer(false);
    }
  };

  // ============ 加入房间 ============

  const handleJoinRoom = () => {
    if (!nickname.trim() || !hostIp.trim()) return;

    // Validate IP format: ip:port
    const parts = hostIp.trim().split(':');
    if (parts.length < 2) {
      setErrorMsg('请输入正确的地址格式 (IP:端口)');
      return;
    }

    const url = `ws://${hostIp.trim()}`;
    setWsUrl(url);
    setView('room');
  };

  // ============ 房间操作 ============

  const handleReadyToggle = () => {
    const newReady = !ready;
    setReady(newReady);
    send({ type: 'ready', ready: newReady });
  };

  const handleStartGame = () => {
    send({ type: 'start_game' });
  };

  const handleLeaveRoom = () => {
    send({ type: 'leave' });
    disconnect();
    setWsUrl('');
    setRoomState(null);
    setPlayers([]);
    setPlayerId(null);
    setServerInfo(null);
    setReady(false);
    setIsHost(false);

    if (serverInfo && window.electronAPI?.stopServer) {
      window.electronAPI.stopServer();
    }

    setView('select');
  };

  const handleBack = () => {
    if (view === 'create' || view === 'join') {
      setView('select');
    } else if (view === 'select') {
      onBack();
    }
  };

  // ============ 退出 ============

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

  const copyIp = () => {
    if (serverInfo) {
      const addr = `${serverInfo.ip}:${serverInfo.port}`;
      navigator.clipboard.writeText(addr).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Clear errors after 5s
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // ============ 选择页 ============

  if (view === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col items-center justify-center p-8 relative">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-2">局域网联机</h1>
            <p className="text-emerald-300/60">创建房间或加入朋友已创建的房间</p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setView('create')}
              className="h-48 bg-slate-800/60 border-2 border-slate-700/60 rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-emerald-900/40 hover:border-emerald-500/60 transition-all duration-300"
            >
              {isStartingServer ? (
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center">
                    <Wifi className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">创建房间</div>
                    <div className="text-sm text-slate-500 mt-1">成为房主，等待朋友加入</div>
                  </div>
                </>
              )}
            </button>

            <button
              onClick={() => setView('join')}
              className="h-48 bg-slate-800/60 border-2 border-slate-700/60 rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-indigo-900/40 hover:border-indigo-500/60 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">加入房间</div>
                <div className="text-sm text-slate-500 mt-1">输入房主 IP 地址加入</div>
              </div>
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-700/30 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回主菜单</span>
            </button>
          </div>
        </div>

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
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出游戏</span>
          </button>
        </div>

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

  // ============ 创建房间页 ============

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col items-center justify-center p-8 relative">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={handleBack} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">创建房间</h2>
              <p className="text-sm text-slate-500">输入你的昵称</p>
            </div>
          </div>

          <input
            type="text"
            placeholder="输入昵称"
            maxLength={12}
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
            className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all mb-6"
          />

          <button
            onClick={handleCreateRoom}
            disabled={!nickname.trim() || isStartingServer}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isStartingServer && <Loader2 className="w-5 h-5 animate-spin" />}
            {isStartingServer ? '启动服务器中...' : '创建房间并等待'}
          </button>
        </div>
      </div>
    );
  }

  // ============ 加入房间页 ============

  if (view === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={handleBack} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">加入房间</h2>
              <p className="text-sm text-slate-500">输入房主的 IP 地址和你的昵称</p>
            </div>
          </div>

          <input
            type="text"
            placeholder="房主 IP 地址 (如 192.168.1.100:12345)"
            maxLength={30}
            value={hostIp}
            onChange={e => setHostIp(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all mb-3"
          />

          <input
            type="text"
            placeholder="输入你的昵称"
            maxLength={12}
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
            className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all mb-6"
          />

          <button
            onClick={handleJoinRoom}
            disabled={!nickname.trim() || !hostIp.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            加入房间
          </button>
        </div>

        {/* Error toast */}
        {errorMsg && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-500/30 rounded-xl px-6 py-3 text-red-200 text-sm shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-300">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  // ============ 房间等待界面 ============

  const allReady = players.length >= 2 && players.filter(p => !p.isHost).every(p => p.ready);
  const currentPlayer = players.find(p => p.id === playerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8 relative">
      <div className="max-w-lg w-full">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">房间</h2>
              <p className="text-sm text-slate-500">
                {isConnected ? (
                  <span className="text-emerald-400">已连接</span>
                ) : (
                  <span className="text-yellow-400">连接中...</span>
                )}
                {' · '}
                玩家 {players.length}/4
              </p>
            </div>
          </div>

          {/* 服务器地址（房主） */}
          {isHost && serverInfo && (
            <div className="mb-6 p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <div className="text-xs text-slate-500 mb-2">分享此地址给朋友：</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-emerald-400 text-sm font-mono">
                  {serverInfo.ip}:{serverInfo.port}
                </code>
                <button
                  onClick={copyIp}
                  className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                  title="复制地址"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* 玩家列表 */}
          <div className="space-y-2 mb-6">
            {players.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>等待玩家加入...</p>
              </div>
            ) : (
              players.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    p.id === playerId
                      ? 'bg-indigo-600/10 border-indigo-500/30'
                      : 'bg-slate-700/30 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      p.isHost
                        ? 'bg-amber-600/20 text-amber-400'
                        : 'bg-slate-600/30 text-slate-300'
                    }`}>
                      {p.isHost ? 'H' : i + 1}
                    </div>
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        {p.nickname}
                        {p.id === playerId && (
                          <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded">你</span>
                        )}
                        {p.isHost && (
                          <span className="text-[10px] bg-amber-600/30 text-amber-300 px-1.5 py-0.5 rounded">房主</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.ready ? (
                      <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full border border-green-600/30">
                        已准备
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-600/20 text-slate-500 px-2 py-1 rounded-full border border-slate-600/30">
                        未准备
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            {isHost ? (
              <>
                <button
                  onClick={handleLeaveRoom}
                  className="flex-1 py-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
                >
                  离开房间
                </button>
                <button
                  onClick={handleStartGame}
                  disabled={!allReady || !isConnected}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  开始游戏
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLeaveRoom}
                  className="flex-1 py-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-600/30"
                >
                  离开房间
                </button>
                <button
                  onClick={handleReadyToggle}
                  disabled={!isConnected}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    ready
                      ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {ready ? '取消准备' : '准备'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 退出按钮 */}
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
          <LogOut className="w-5 h-5" />
          <span className="font-medium">退出游戏</span>
        </button>
      </div>

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-500/30 rounded-xl px-6 py-3 text-red-200 text-sm shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
