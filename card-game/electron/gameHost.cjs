// 服务端游戏主机 — 封装 GameEngine 供 server.cjs 使用

const path = require('path');
const { GameEngine } = require(path.join(__dirname, '../dist-engine/game/gameEngine'));

class GameHost {
  constructor() {
    this.engine = null;
    this.initialized = false;
  }

  /** 初始化游戏状态 */
  init(gameState) {
    this.engine = new GameEngine(gameState);
    this.initialized = true;
  }

  /** 获取当前状态（深拷贝） */
  getState() {
    if (!this.engine) return null;
    return this.engine.getState();
  }

  /** 重置 */
  reset() {
    this.engine = null;
    this.initialized = false;
  }

  // ============ 游戏操作 ============

  useSkill(playerId, skillIndex, targetId, paymentCardIndices) {
    if (!this.engine) return null;
    this.engine.useSkill(playerId, skillIndex, targetId, paymentCardIndices);
    return this.engine.getState();
  }

  useSpecialCard(playerId, cardIndex, targetId) {
    if (!this.engine) return null;
    this.engine.useSpecialCard(playerId, cardIndex, targetId);
    return this.engine.getState();
  }

  advancePhase() {
    if (!this.engine) return null;
    this.engine.advancePhase();
    return this.engine.getState();
  }

  endTurn() {
    if (!this.engine) return null;
    this.engine.endTurn();
    return this.engine.getState();
  }

  /** 处理玩家时间耗尽死亡 */
  expirePlayer(playerId) {
    if (!this.engine) return null;
    const state = this.engine.getState();
    const player = state.players.find(p => p.id === playerId);
    if (player && player.current_hp > 0) {
      player.current_hp = 0;
      this.engine.loadState(state);
      this.engine.checkGameOver();
    }
    return this.engine.getState();
  }

  /** 处理断线玩家超时移除 */
  removePlayer(playerId) {
    if (!this.engine) return null;
    const state = this.engine.getState();
    const player = state.players.find(p => p.id === playerId);
    if (player && player.current_hp > 0) {
      player.current_hp = 0;
      this.engine.loadState(state);
      this.engine.checkGameOver();
    }
    return this.engine.getState();
  }
}

module.exports = { GameHost };
