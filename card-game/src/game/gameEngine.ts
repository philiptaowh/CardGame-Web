// 纯游戏逻辑引擎 — 无 Zustand/DOM 依赖，可在浏览器和 Node.js 环境运行

import type {
  Player, GameState, GamePhase, Card, CharacterId, PlayerId,
  EnergyCard, GameMode, PRNG, GameEngineConfig, TimestampProvider,
} from '../types';
import { getCharacterById } from './characters';
import { createDeck } from './cards';
import { getMarkDefinition } from './marks';

// ============ 工具函数 ============

function shuffle<T>(array: T[], rand: PRNG = Math.random): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

function addMarkWithReplacement(
  player: Player,
  newMarkName: string,
  newMarkTurns: number
): void {
  const markDef = getMarkDefinition(newMarkName);
  if (!markDef) return;

  const existingMarkIndex = player.marks.findIndex(m => m.name === newMarkName);

  if (existingMarkIndex !== -1) {
    const existingMark = player.marks[existingMarkIndex];

    if (markDef.mark_type === 'positive') {
      player.shield += existingMark.remaining_turns * 2;
    } else {
      player.current_hp = Math.max(0, player.current_hp - existingMark.remaining_turns * 2);
    }

    player.marks[existingMarkIndex] = { name: newMarkName, remaining_turns: newMarkTurns };
  } else {
    player.marks.push({ name: newMarkName, remaining_turns: newMarkTurns });
  }
}

function createInitialState(): GameState {
  return {
    turn: 0,
    phase: 'setup',
    gameMode: '1v1',
    players: [],
    current_player_index: 0,
    action_order: [],
    phase1_results: null,
    deck: [],
    discard_pile: [],
    logs: [],
    winner: null,
  };
}

function createPlayer(id: PlayerId, name: string, characterId: CharacterId, seatIndex?: number): Player {
  const char = getCharacterById(characterId);
  if (!char) throw new Error(`Character ${characterId} not found`);

  return {
    id,
    name,
    type: 'human',
    seat_index: seatIndex ?? 0,
    character_id: characterId,
    max_hp: char.hp,
    current_hp: char.hp,
    shield: 0,
    hand: [],
    marks: [],
    action_order_modifier: 0,
    damage_modifier: 0,
    heal_modifier: 0,
    penetration_modifier: 0,
    next_turn_damage_modifier: 0,
    next_turn_heal_modifier: 0,
    next_turn_penetration_modifier: 0,
    took_damage_this_turn: false,
    has_acted_this_turn: false,
    skills_used_this_turn: 0,
    skill_usage_counts: [],
    remaining_exchanges: 0,
    phase1_cards: [],
    phase1_energy: 0,
    has_blind: false,
    has_confusion: false,
    has_sleep: false,
    has_madness: false,
  };
}

// ============ GameEngine 类 ============

export class GameEngine {
  private state: GameState;
  private prng: PRNG;
  private seed?: number;
  private timestampProvider: TimestampProvider;

  constructor();
  constructor(state: GameState);
  constructor(config: GameEngineConfig);
  constructor(arg?: GameState | GameEngineConfig) {
    if (!arg) {
      this.state = createInitialState();
    } else if ('turn' in arg) {
      // V1 兼容：传入 GameState
      this.state = cloneState(arg as GameState);
    } else {
      // V2 模式：传入 GameEngineConfig
      this.state = createInitialState();
      this.prng = (arg as GameEngineConfig).prng ?? Math.random;
      this.seed = (arg as GameEngineConfig).seed;
      this.timestampProvider = (arg as GameEngineConfig).timestampProvider ?? (Date.now as TimestampProvider);
      return;
    }
    this.prng = Math.random;
    this.timestampProvider = Date.now as TimestampProvider;
  }

  /** 获取当前状态的深拷贝（外部只读） */
  getState(): GameState {
    return cloneState(this.state);
  }

  /** 加载外部状态 */
  loadState(state: GameState): void {
    this.state = cloneState(state);
  }

  /** 获取当前种子（V2 复现用） */
  getSeed(): number | undefined { return this.seed; }

  /** 获取 PRNG（V2 策略使用） */
  getPRNG(): PRNG { return this.prng; }

  /** 直接获取内部状态引用（仅供内部使用） */
  private get s(): GameState { return this.state; }

  // ============ 初始化 ============

  initGame(humanCharId: CharacterId, aiCharIds: CharacterId[], gameMode: GameMode = '1v1'): void {
    const deck = shuffle(createDeck(), this.prng);
    const players: Player[] = [];

    players.push(createPlayer('player_1', '玩家', humanCharId, 1));

    const aiNames = ['对手A', '对手B', '对手C'];
    aiCharIds.forEach((charId, i) => {
      const p = createPlayer(`player_${i + 2}` as PlayerId, aiNames[i] || `AI_${i + 1}`, charId, i + 2);
      p.type = 'ai';
      players.push(p);
    });

    const allSeats = players.map((_, i) => i + 1);
    const shuffledSeats = shuffle(allSeats, this.prng);
    players.forEach((p, i) => { p.seat_index = shuffledSeats[i]; });
    players.sort((a, b) => a.seat_index - b.seat_index);
    players.forEach(p => { p.remaining_exchanges = Math.min(p.seat_index - 1, 4); });

    const newDeck = [...deck];
    for (const player of players) {
      const drawn = newDeck.splice(0, 4);
      player.hand = drawn as Card[];
    }

    const needExchange = players.some(p => p.seat_index > 1);

    this.state = {
      turn: 1,
      phase: needExchange ? 'card_exchange' : 'phase1',
      gameMode,
      phase1_results: null,
      players,
      current_player_index: 0,
      action_order: players.map(p => p.id),
      deck: newDeck,
      discard_pile: [],
      logs: [{
        turn: 1,
        phase: needExchange ? 'card_exchange' : 'phase1',
        message: needExchange ? '游戏开始！进入换牌阶段' : '游戏开始！请放置倡议能量卡',
        timestamp: this.timestampProvider(),
      }],
      winner: null,
    };
  }

  initLANGame(lanPlayers: { id: string; nickname: string; characterId: CharacterId }[], gameMode: GameMode = '1v1'): void {
    const deck = shuffle(createDeck(), this.prng);
    const players: Player[] = lanPlayers.map((p, i) => createPlayer(p.id as PlayerId, p.nickname, p.characterId, i + 1));

    const allSeats = players.map((_, i) => i + 1);
    const shuffledSeats = shuffle(allSeats, this.prng);
    players.forEach((p, i) => { p.seat_index = shuffledSeats[i]; });
    players.sort((a, b) => a.seat_index - b.seat_index);
    players.forEach(p => { p.remaining_exchanges = Math.min(p.seat_index - 1, 4); });

    const newDeck = [...deck];
    for (const player of players) {
      const drawn = newDeck.splice(0, 4);
      player.hand = drawn as Card[];
    }

    const needExchange = players.some(p => p.seat_index > 1);

    this.state = {
      turn: 1,
      phase: needExchange ? 'card_exchange' : 'phase1',
      gameMode,
      phase1_results: null,
      players,
      current_player_index: 0,
      action_order: players.map(p => p.id),
      deck: newDeck,
      discard_pile: [],
      logs: [{
        turn: 1,
        phase: needExchange ? 'card_exchange' : 'phase1',
        message: '游戏开始！进入换牌阶段',
        timestamp: this.timestampProvider(),
      }],
      winner: null,
    };
  }

  // ============ 日志 ============

  addLog(message: string): void {
    this.s.logs.push({
      turn: this.s.turn,
      phase: this.s.phase,
      message,
      timestamp: this.timestampProvider(),
    });
    if (this.s.logs.length > 100) {
      this.s.logs = this.s.logs.slice(-100);
    }
  }

  // ============ 抽卡 ============

  /** 返回是否成功抽卡（false 表示触发了 deck depletion） */
  drawCard(playerId: PlayerId, count: number = 1): boolean {
    const playerIndex = this.s.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return true;

    const player = this.s.players[playerIndex];

    if (player.has_blind) {
      this.addLog(`${player.name} 被失明印记影响，无法抽卡`);
      return true;
    }

    let drawnCards: Card[] = [];
    let newDeck = [...this.s.deck];
    let newDiscardPile = [...this.s.discard_pile];

    for (let i = 0; i < count; i++) {
      if (newDeck.length === 0) {
        if (newDiscardPile.length === 0) {
          this.addLog('牌组和弃牌堆均为空，触发紧急回收流程！');
          this.handleDeckDepletion();
          return false; // deck depletion triggered new turn
        }
        newDeck = shuffle(newDiscardPile, this.prng);
        newDiscardPile = [];
      }
      const card = newDeck.shift();
      if (card) drawnCards.push(card);
    }

    if (drawnCards.length === 0) return true;

    player.hand.push(...drawnCards);
    this.s.deck = newDeck;
    this.s.discard_pile = newDiscardPile;
    this.addLog(`${player.name} 抽了 ${drawnCards.length} 张卡`);
    return true;
  }

  // ============ 丢弃 ============

  discardCard(playerId: PlayerId, cardIndex: number): void {
    const player = this.s.players.find(p => p.id === playerId);
    if (!player || cardIndex < 0 || cardIndex >= player.hand.length) return;

    const card = player.hand.splice(cardIndex, 1)[0];
    this.s.discard_pile.push(card);
    this.addLog(`${player.name} 丢弃了${card.name}`);
  }

  // ============ 换牌 ============

  exchangeCard(playerId: PlayerId, cardIndex: number): void {
    const playerIndex = this.s.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = this.s.players[playerIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) return;
    if (player.remaining_exchanges <= 0) return;

    const card = player.hand[cardIndex];
    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);
    const newDeck = [...this.s.deck, card];

    let drawnCard: Card | undefined;
    if (newDeck.length > 0) {
      drawnCard = newDeck.shift();
    } else if (this.s.discard_pile.length > 0) {
      const reshuffled = shuffle([...this.s.discard_pile], this.prng);
      newDeck.push(...reshuffled);
      drawnCard = newDeck.shift();
    }
    if (drawnCard) newHand.push(drawnCard);

    player.hand = newHand;
    player.remaining_exchanges--;
    this.s.deck = newDeck;
    this.addLog(`${player.name} 换牌：将${card.name}放回牌组并抽了1张新卡`);
  }

  advanceExchange(): void {
    const startIdx = this.s.current_player_index;
    const totalPlayers = this.s.players.length;

    for (let offset = 1; offset <= totalPlayers; offset++) {
      const nextIdx = (startIdx + offset) % totalPlayers;
      if (nextIdx === startIdx) break; // 已遍历所有其他玩家，未找到有换牌次数的玩家
      const nextPlayer = this.s.players[nextIdx];
      if (nextPlayer.remaining_exchanges > 0) {
        if (nextPlayer.type === 'ai') {
          for (let i = 0; i < nextPlayer.remaining_exchanges; i++) {
            const currentHand = this.s.players[nextIdx].hand;
            if (currentHand.length === 0) break;
            const randomIdx = Math.floor(this.prng() * currentHand.length);
            this.exchangeCard(nextPlayer.id, randomIdx);
          }
          this.advanceExchange();
        } else {
          this.s.current_player_index = nextIdx;
        }
        return;
      }
    }

    this.addLog('换牌阶段结束，进入阶段1！');
    this.s.phase = 'phase1';
    this.s.phase1_results = null;
    this.s.current_player_index = 0;
    this.s.players.forEach(p => { p.remaining_exchanges = 0; });
  }

  // ============ 能量放置 ============

  placeEnergyCard(playerId: PlayerId, cardIndex: number): void {
    const playerIndex = this.s.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = this.s.players[playerIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) return;

    const card = player.hand[cardIndex];
    let energyVal = 0;

    if (card.type === 'energy') {
      const energyCard = card as EnergyCard;
      energyVal = energyCard.is_wild ? 1 : energyCard.energy;
    } else {
      energyVal = 1;
    }

    player.hand.splice(cardIndex, 1);
    player.phase1_cards.push(card);
    player.phase1_energy = (player.phase1_energy || 0) + energyVal;

    this.addLog(`${player.name} 放置了一张卡作为倡议能量`);
  }

  // ============ 技能效果 ============

  useSkill(playerId: PlayerId, skillIndex: number, targetId: PlayerId, paymentCardIndices: number[]): void {
    const playerIndex = this.s.players.findIndex(p => p.id === playerId);
    let targetIndex = this.s.players.findIndex(p => p.id === targetId);

    if (playerIndex === -1 || targetIndex === -1) return;

    const player = { ...this.s.players[playerIndex] };
    let target = { ...this.s.players[targetIndex] };

    // ====== 检查睡眠 ======
    // 睡眠跳过的玩家从未获得行动机会，按 extra_rule.md 裁定不标记 has_acted_this_turn
    // 这样"先手"角色的技能在目标是睡眠状态时仍能触发"若该玩家还未行动"加成
    if (player.has_sleep) {
      player.current_hp = Math.min(player.max_hp, player.current_hp + 2);
      this.addLog(`${player.name} 处于睡眠状态，回复2点血量并结束行动`);
      this.s.players = this.s.players.map(p => p.id === playerId ? player : p);
      this.advancePhase();
      return;
    }

    // ====== 检查混乱 ======
    if (player.has_confusion) {
      targetIndex = (targetIndex + 1) % this.s.players.length;
      target = { ...this.s.players[targetIndex] };
      this.addLog(`${player.name} 处于混乱状态，目标偏移至 ${this.s.players[targetIndex].name}`);
    }

    const char = getCharacterById(player.character_id);
    if (!char || skillIndex >= char.skills.length) return;

    const skill = char.skills[skillIndex];

    if (skill.max_uses_per_turn !== undefined) {
      const currentSkillUses = player.skill_usage_counts[skillIndex] || 0;
      if (currentSkillUses >= skill.max_uses_per_turn) {
        this.addLog(`${player.name} 的 ${skill.name} 已达到本回合使用上限！`);
        return;
      }
    }

    // 计算支付
    let totalPaidEnergy = 0;
    const cardsToDiscard: Card[] = [];
    const newHand = [...player.hand];
    const sortedIndices = [...paymentCardIndices].sort((a, b) => b - a);

    for (const idx of sortedIndices) {
      const card = newHand[idx];
      if (!card) continue;

      if (card.type === 'energy') {
        const ec = card as EnergyCard;
        if (ec.is_wild) {
          const gap = skill.cost - totalPaidEnergy;
          totalPaidEnergy += Math.min(6, Math.max(1, gap));
        } else {
          totalPaidEnergy += ec.energy;
        }
      }
      cardsToDiscard.push(card);
    }

    if (totalPaidEnergy < skill.cost) {
      this.addLog(`${player.name} 支付能量不足！`);
      return;
    }

    for (const idx of sortedIndices) {
      newHand.splice(idx, 1);
    }
    player.hand = newHand;

    // 检查失神
    let madnessCard: Card | undefined;
    if (player.has_madness && player.hand.length > 0) {
      madnessCard = player.hand.pop();
      if (madnessCard) {
        this.addLog(`${player.name} 处于失神状态，额外弃置1张手牌`);
      }
    }

    // 应用技能
    let damage = 0;
    let penetration = 0;
    let heal = 0;
    let shield = 0;

    if (player.character_id === 'char_1') {
      if (skillIndex === 0) damage = 3;
      else if (skillIndex === 1) heal = 4;
      else if (skillIndex === 2) {
        addMarkWithReplacement(player, '无垢', 2);
        addMarkWithReplacement(player, '灵感', 2);
      } else if (skillIndex === 3) {
        damage = 8;
        penetration = 4;
        this.drawCard(playerId, 1);
        if (this.s.phase === 'phase1') return;
        player.hand = this.s.players[playerIndex].hand.filter(c => !cardsToDiscard.includes(c));
      }
    } else if (player.character_id === 'char_2') {
      if (skillIndex === 0) { damage = 1; shield = 2; }
      else if (skillIndex === 1) shield = 6;
      else if (skillIndex === 2) addMarkWithReplacement(player, '庇佑', 3);
      else if (skillIndex === 3) {
        damage = 12;
        heal = Math.floor(player.shield / 2);
        // v2.2.1: 触发条件从「无手牌」放宽到「手牌 ≤ 2 张」
        if (target.hand.length <= 2) penetration = 12;
      }
    } else if (player.character_id === 'char_3') {
      if (skillIndex === 0) damage = 3;
      else if (skillIndex === 1) { damage = 4; penetration = 2; }
      else if (skillIndex === 2) {
        damage = 6;
        this.drawCard(playerId, 1);
        if (this.s.phase === 'phase1') return;
        player.hand = this.s.players[playerIndex].hand.filter(c => !cardsToDiscard.includes(c));
      } else if (skillIndex === 3) {
        damage = 12;
        penetration = 6;
        if (target.current_hp > player.current_hp) penetration += 18;
      }
    } else if (player.character_id === 'char_4') {
      if (skillIndex === 0) { damage = 1; player.next_turn_damage_modifier += 3; }
      else if (skillIndex === 1) { player.next_turn_heal_modifier += 2; }
      else if (skillIndex === 2) {
        damage = 3;
        heal = 3;
        player.next_turn_damage_modifier += 3;
        player.next_turn_heal_modifier += 3;
      } else if (skillIndex === 3) {
        player.next_turn_damage_modifier += 6;
        this.drawCard(playerId, 1);
        if (this.s.phase === 'phase1') return;
        player.hand = this.s.players[playerIndex].hand.filter(c => !cardsToDiscard.includes(c));
      }
    } else if (player.character_id === 'char_5') {
      if (skillIndex === 0) {
        damage = 2;
        if (!target.has_acted_this_turn) damage += 2;
      } else if (skillIndex === 1) {
        damage = 2;
        if (!target.has_acted_this_turn) {
          this.drawCard(playerId, 1);
          if (this.s.phase === 'phase1') return;
          player.hand = this.s.players[playerIndex].hand.filter(c => !cardsToDiscard.includes(c));
        }
      } else if (skillIndex === 2) {
        damage = 3;
        penetration = 3;
        if (!target.has_acted_this_turn) addMarkWithReplacement(player, '鼓舞', 1);
      } else if (skillIndex === 3) {
        addMarkWithReplacement(target, '失明', 1);
        if (target.has_acted_this_turn) addMarkWithReplacement(target, '睡眠', 1);
        player.next_turn_damage_modifier += 2;
      }
    } else if (player.character_id === 'char_6') {
      if (skillIndex === 0) { penetration = 1; heal = 2; }
      else if (skillIndex === 1) {
        if (target.marks.some(m => m.name === '中毒')) penetration = 3;
        addMarkWithReplacement(target, '中毒', 1);
        heal = 2;
      } else if (skillIndex === 2) {
        addMarkWithReplacement(target, '诅咒', 3);
        addMarkWithReplacement(player, '治疗', 3);
      } else if (skillIndex === 3) {
        // v2.2.1: 附加印记从「弱化 1 回合」改为「流血 3 回合」
        addMarkWithReplacement(target, '流血', 3);
        if (this.s.turn > 12) {
          penetration = Math.floor(this.s.turn / 2) + 6;
        }
        // v2.2.1: 自回复从固定 8 改为「当前回合数一半」（向下取整）
        heal = Math.floor(this.s.turn / 2);
      }
    } else if (player.character_id === 'char_7') {
      // v2.2.1: 完全重做 — 弱化 stacking 流
      // 设计意图：4 技能全部挂「弱化」印记，靠二次挂印记触发自我增益
      if (skillIndex === 0) {
        // 削弱 (cost 1): 2 dmg + 弱化 1 回合
        damage = 2;
        addMarkWithReplacement(target, '弱化', 1);
      } else if (skillIndex === 1) {
        // 衰弱 (cost 2): v2.2.1.6 修复判定顺序
        // 修正前：先 addMarkWithReplacement 再 some(...) 判断，导致条件永远 true
        // 修正后：先判定 → 已有弱化则不加重复挂、改为自我治疗；没有则加弱化 2 回合
        if (target.marks.some(m => m.name === '弱化')) {
          addMarkWithReplacement(player, '治疗', 2);
        } else {
          addMarkWithReplacement(target, '弱化', 2);
        }
      } else if (skillIndex === 2) {
        // 虚弱 (cost 3): v2.2.1.6 修复判定顺序
        // 修正前：同上，导致条件永远 true
        // 修正后：已有弱化则不加重复挂、改为挂失明 + 失神；没有则加弱化 2 回合
        if (target.marks.some(m => m.name === '弱化')) {
          addMarkWithReplacement(target, '失明', 1);
          addMarkWithReplacement(target, '失神', 1);
        } else {
          addMarkWithReplacement(target, '弱化', 2);
        }
      } else if (skillIndex === 3) {
        // 朽灭 (cost 6): 6 dmg；若 turn > 8 → 目标受 Math.floor(player.current_hp/10) dmg + pen
        // v2.2.1.1: 1/8 → 1/10（向下取整），与原型文档同步
        damage = 6;
        if (this.s.turn > 8) {
          const selfHpTenth = Math.floor(player.current_hp / 10);
          if (selfHpTenth > 0) {
            damage += selfHpTenth;
            penetration = (penetration ?? 0) + selfHpTenth;
          }
        }
      }
    } else if (player.character_id === 'char_8') {
      const tookDamage = player.took_damage_this_turn;
      if (skillIndex === 0) {
        damage = 2;
        if (tookDamage) damage += 2;
      } else if (skillIndex === 1) {
        damage = 4;
        if (tookDamage) heal = 4;
      } else if (skillIndex === 2) {
        damage = 6;
        if (tookDamage) addMarkWithReplacement(target, '诅咒', 1);
      } else if (skillIndex === 3) {
        damage = 6;
        penetration = 6;
        // v2.2.1: 条件翻转 + 效果改自损
        // 旧: 若本回合自己受到过伤害 → target 失神
        // 新: 若本回合自己未受到过伤害 → 自损 4 + target 4
        if (!tookDamage) {
          damage += 4;          // 目标额外受 4
          player.current_hp = Math.max(0, player.current_hp - 4);  // 自损 4
          player.took_damage_this_turn = true;  // 标记（影响本回合后续其他技能判定）
        }
      }
    } else if (player.character_id === 'char_9') {
      if (skillIndex === 0) { damage = 2; penetration = 1; }
      else if (skillIndex === 1) {
        player.next_turn_damage_modifier += 2;
        player.next_turn_penetration_modifier += 2;
        player.next_turn_heal_modifier += 1;
      } else if (skillIndex === 2) {
        this.drawCard(playerId, 1);
        if (this.s.phase === 'phase1') return;
        player.hand = this.s.players[playerIndex].hand.filter(c => !cardsToDiscard.includes(c));
      } else if (skillIndex === 3) {
        penetration = player.skills_used_this_turn * 2;
        if (player.skills_used_this_turn <= 3) {
          addMarkWithReplacement(player, '无垢', 1);
          addMarkWithReplacement(player, '灵感', 1);
        }
      }
    }

    damage += player.damage_modifier;
    damage = Math.max(0, damage);
    penetration += player.penetration_modifier;
    heal += player.heal_modifier;

    if (damage > 0 && target.shield > 0) {
      const blocked = Math.min(damage, target.shield);
      target.shield -= blocked;
      damage -= blocked;
    }

    target.current_hp = Math.max(0, target.current_hp - damage);
    target.current_hp = Math.max(0, target.current_hp - penetration);
    if (damage > 0 || penetration > 0) {
      target.took_damage_this_turn = true;
    }
    if (heal > 0) player.current_hp = Math.min(player.max_hp, player.current_hp + heal);
    if (shield > 0) player.shield += shield;

    player.skills_used_this_turn++;
    player.skill_usage_counts[skillIndex] = (player.skill_usage_counts[skillIndex] || 0) + 1;
    player.has_acted_this_turn = true;

    const finalDiscardPile = [...this.s.discard_pile, ...cardsToDiscard];
    if (madnessCard) finalDiscardPile.push(madnessCard);

    this.s.players = this.s.players.map(p => {
      if (p.id === player.id) return player;
      if (p.id === target.id) return target;
      return p;
    });
    this.s.discard_pile = finalDiscardPile;

    const paymentDesc = cardsToDiscard.map(c =>
      c.type === 'energy'
        ? ((c as EnergyCard).is_wild ? '万能能量' : `${(c as EnergyCard).energy}能量`)
        : c.name
    ).join(', ');
    this.addLog(`${player.name} 使用了 [${paymentDesc}] 释放了技能: ${skill.name}`);

    this.checkGameOver();
  }

  // ============ 特殊卡 ============

  useSpecialCard(playerId: PlayerId, cardIndex: number, targetId?: PlayerId): void {
    const playerIndex = this.s.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = { ...this.s.players[playerIndex] };
    if (cardIndex < 0 || cardIndex >= player.hand.length) return;

    const card = player.hand[cardIndex];
    if (card.type !== 'special') return;

    let actualTargetIndex = targetId ? this.s.players.findIndex(p => p.id === targetId) : -1;

    if (player.has_confusion && actualTargetIndex !== -1) {
      actualTargetIndex = (actualTargetIndex + 1) % this.s.players.length;
      this.addLog(`${player.name} 处于混乱状态，目标偏移至 ${this.s.players[actualTargetIndex].name}`);
    }

    const target = actualTargetIndex !== -1 ? { ...this.s.players[actualTargetIndex] } : undefined;

    switch (card.effect_id) {
      case 1:
        if (target) {
          const avgHp = Math.floor((player.current_hp + target.current_hp) / 2);
          player.current_hp = avgHp;
          target.current_hp = avgHp;
        }
        break;
      case 2:
        if (player.current_hp < player.max_hp / 2) {
          player.current_hp = Math.min(player.max_hp, player.current_hp + Math.floor(player.max_hp / 4));
          this.drawCard(playerId, 2);
          if (this.s.phase === 'phase1') return;
          Object.assign(player, this.s.players[playerIndex]);
        }
        break;
      case 3:
        if (target && target.hand.length > 0) {
          const stolenCard = target.hand.pop();
          if (stolenCard) player.hand.push(stolenCard);
        }
        break;
      case 4:
        if (target) {
          for (let i = 0; i < 2 && target.hand.length > 0; i++) {
            target.hand.pop();
          }
        }
        break;
      case 5:
        if (player.hand.length < 2) {
          this.addLog(`${player.name} 手牌不足，无法使用此卡（需要弃置1张手卡）！`);
          return;
        }
        player.hand.pop();
        player.action_order_modifier -= 100;
        break;
      case 6:
        this.drawCard(playerId, 2);
        if (this.s.phase === 'phase1') return;
        Object.assign(player, this.s.players[playerIndex]);
        break;
      case 7:
        if (player.hand.length < 3) {
          this.addLog(`${player.name} 手牌不足，无法使用此卡（需要弃置2张手卡）！`);
          return;
        }
        player.hand.pop();
        player.hand.pop();
        this.drawCard(playerId, 4);
        if (this.s.phase === 'phase1') return;
        Object.assign(player, this.s.players[playerIndex]);
        break;
      case 8: addMarkWithReplacement(player, '治疗', 4); break;
      case 9: addMarkWithReplacement(player, '无垢', 2); break;
      case 10: addMarkWithReplacement(player, '庇佑', 4); break;
      case 11: addMarkWithReplacement(player, '鼓舞', 3); break;
      case 12: addMarkWithReplacement(player, '灵感', 2); break;
      case 13:
        for (const p of this.s.players) {
           if (p.id !== playerId) addMarkWithReplacement(p, '流血', 2);
        }
        break;
      case 14:
        player.current_hp = Math.min(player.max_hp, player.current_hp + 3);
        if (target) addMarkWithReplacement(target, '中毒', 3);
        break;
      case 15:
        if (target) addMarkWithReplacement(target, '诅咒', 1);
        break;
      case 16:
        if (target) {
          target.current_hp = Math.max(0, target.current_hp - this.s.turn);
          target.current_hp = Math.max(0, target.current_hp - this.s.turn);
        }
        break;
    }

    const usedCardIndex = player.hand.findIndex(c => c.card_id === card.card_id);
    if (usedCardIndex !== -1) player.hand.splice(usedCardIndex, 1);

    this.s.players = this.s.players.map(p => {
      if (p.id === player.id) return player;
      if (target && p.id === target.id) return target;
      return p;
    });
    this.s.discard_pile.push(card);

    this.addLog(`${player.name} 使用了特殊卡: ${card.name}`);
    this.checkGameOver();
  }

  // ============ 印记结算（阶段3） ============

  resolveMarks(playerId: PlayerId): void {
    const playerIndex = this.s.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = { ...this.s.players[playerIndex] };
    const hasWuGou = player.marks.some(m => m.name === '无垢');

    for (const mark of player.marks) {
      const def = getMarkDefinition(mark.name);
      if (!def) continue;
      if (hasWuGou && def.mark_type === 'negative') continue;

      if (def.mark_type === 'positive') {
        if (mark.name === '治疗') player.current_hp = Math.min(player.max_hp, player.current_hp + 4);
        else if (mark.name === '庇佑') player.shield += 4;
        else if (mark.name === '灵感') {
          this.drawCard(playerId, 1);
          const latestPlayer = this.s.players.find(p => p.id === player.id);
          if (latestPlayer) player.hand = latestPlayer.hand;
        }
        else if (mark.name === '鼓舞') player.next_turn_damage_modifier += 2;
      } else {
        if (mark.name === '流血') player.current_hp = Math.max(0, player.current_hp - 4);
        else if (mark.name === '中毒') player.current_hp = Math.max(0, player.current_hp - 2);
        else if (mark.name === '诅咒') player.current_hp = Math.max(0, player.current_hp - 4);
        else if (mark.name === '弱化') player.next_turn_damage_modifier -= 2;
      }
    }

    player.marks = player.marks
      .map(m => ({ ...m, remaining_turns: m.remaining_turns - 1 }))
      .filter(m => m.remaining_turns > 0);

    player.damage_modifier = 0;
    player.heal_modifier = 0;
    player.penetration_modifier = 0;
    player.next_turn_damage_modifier = 0;
    player.next_turn_heal_modifier = 0;
    player.next_turn_penetration_modifier = 0;
    player.action_order_modifier = 0;
    player.took_damage_this_turn = false;
    player.has_acted_this_turn = false;
    player.skills_used_this_turn = 0;
    player.skill_usage_counts = [];
    player.phase1_energy = 0;
    player.phase1_cards = [];

    this.s.players = this.s.players.map(p => p.id === playerId ? player : p);
  }

  // ============ 阶段推进 ============

  advancePhase(): void {
    if (this.s.phase === 'phase1') {
      const isLastPlayer = this.s.current_player_index === this.s.players.length - 1;
      if (isLastPlayer) {
        const playerInitiatives = this.s.players.map((p, originalIndex) => ({
          id: p.id, name: p.name, energy: p.phase1_energy, originalIndex,
        }));
        playerInitiatives.sort((a, b) =>
          b.energy !== a.energy ? b.energy - a.energy : a.originalIndex - b.originalIndex
        );
        const newActionOrder = playerInitiatives.map(pi => pi.id);

        const phase1Results = playerInitiatives.map(pi => ({
          playerId: pi.id,
          name: pi.name,
          energy: pi.energy,
          cardCount: this.s.players.find(p => p.id === pi.id)?.phase1_cards.length ?? 0,
        }));
        let newDiscardPile = [...this.s.discard_pile];
        const newPlayers = this.s.players.map(p => {
          newDiscardPile = [...newDiscardPile, ...p.phase1_cards];
          return { ...p, phase1_cards: [], phase1_energy: 0 };
        });

        const firstPlayerId = newActionOrder[0];
        const firstPlayerIndex = newPlayers.findIndex(p => p.id === firstPlayerId);

        this.s.phase = 'phase2';
        this.s.phase1_results = phase1Results;
        this.s.players = newPlayers;
        this.s.discard_pile = newDiscardPile;
        this.s.action_order = newActionOrder;
        this.s.current_player_index = firstPlayerIndex;
        this.s.logs.push({
          turn: this.s.turn, phase: 'phase2',
          message: `行动顺序已确定`, timestamp: this.timestampProvider(),
        });

        // 检查首位玩家睡眠
        const sleepFirst = this.s.players[firstPlayerIndex];
        if (sleepFirst.has_sleep) {
          this.addLog(`${sleepFirst.name} 处于睡眠状态，回复2点血量并结束行动`);
          this.s.players = this.s.players.map((p, i) =>
            i === firstPlayerIndex
              ? { ...p, current_hp: Math.min(p.max_hp, p.current_hp + 2) }
              : p
          );
          this.advancePhase();
          return;
        }

        if (this.s.turn > 1) this.drawCard(firstPlayerId, 2);
      } else {
        this.s.current_player_index++;
      }
      return;
    }

    if (this.s.phase === 'phase2') {
      const currentId = this.s.players[this.s.current_player_index].id;
      const currentActionIndexInOrder = this.s.action_order.findIndex(id => id === currentId);

      if (currentActionIndexInOrder < this.s.action_order.length - 1) {
        const currentPlayerId = this.s.action_order[currentActionIndexInOrder];
        const nextPlayerId = this.s.action_order[currentActionIndexInOrder + 1];
        const nextPlayerIndex = this.s.players.findIndex(p => p.id === nextPlayerId);

        // 检查下一位玩家是否处于睡眠
        // 睡眠跳过的玩家从未获得行动机会，按 extra_rule.md 裁定不标记 has_acted_this_turn
        // 这样"先手"角色的技能在目标是睡眠状态时仍能触发"若该玩家还未行动"加成
        const sleepNext = this.s.players[nextPlayerIndex];
        if (sleepNext.has_sleep) {
          this.addLog(`${sleepNext.name} 处于睡眠状态，回复2点血量并结束行动`);
          this.s.players = this.s.players.map((p, i) =>
            i === nextPlayerIndex
              ? { ...p, current_hp: Math.min(p.max_hp, p.current_hp + 2) }
              : p
          );
          this.s.current_player_index = nextPlayerIndex;
          this.advancePhase();
          return;
        }

        // 正常情况：标记当前玩家已行动，切换到下一位
        this.s.players = this.s.players.map(p =>
          p.id === currentPlayerId ? { ...p, has_acted_this_turn: true } : p
        );
        this.s.current_player_index = nextPlayerIndex;

        if (this.s.turn > 1) this.drawCard(nextPlayerId, 2);
      } else {
        // 全部行动完毕 → phase3
        this.s.phase = 'phase3';
        this.s.current_player_index = 0;
        this.endTurn();
      }
    }
  }

  // ============ AI 行动 ============

  aiTurn(): void {
    const aiPlayer = this.s.players[this.s.current_player_index];
    if (!aiPlayer || aiPlayer.type !== 'ai') return;

    if (this.s.phase === 'phase1') {
      const energyCards = aiPlayer.hand.map((c, i) => ({ c, i })).filter(item => item.c.type === 'energy');
      const count = Math.min(energyCards.length, Math.floor(this.prng() * 3));
      for (let i = 0; i < count; i++) {
        this.placeEnergyCard(aiPlayer.id, energyCards[i].i - i);
      }
      this.advancePhase();
      return;
    }

    if (this.s.phase === 'phase2') {
      const char = getCharacterById(aiPlayer.character_id);
      if (!char) return;

      const shuffledSkillIndices = shuffle([0, 1, 2, 3], this.prng);
      let skillUsed = false;

      for (const skillIndex of shuffledSkillIndices) {
        const skill = char.skills[skillIndex];
        let currentPaid = 0;
        const paymentIndices: number[] = [];

        for (let i = 0; i < aiPlayer.hand.length; i++) {
          const card = aiPlayer.hand[i];
          if (card.type === 'energy' && !(card as EnergyCard).is_wild) {
            currentPaid += (card as EnergyCard).energy;
            paymentIndices.push(i);
            if (currentPaid >= skill.cost) break;
          }
        }
        if (currentPaid < skill.cost) {
          for (let i = 0; i < aiPlayer.hand.length; i++) {
            const card = aiPlayer.hand[i];
            if (card.type === 'energy' && (card as EnergyCard).is_wild && !paymentIndices.includes(i)) {
              currentPaid += Math.min(6, skill.cost - currentPaid);
              paymentIndices.push(i);
              if (currentPaid >= skill.cost) break;
            }
          }
        }

        if (currentPaid >= skill.cost) {
          if (skill.target === 'self') {
            this.useSkill(aiPlayer.id, skillIndex, aiPlayer.id, paymentIndices);
          } else {
            const otherPlayers = this.s.players.filter(p => p.id !== aiPlayer.id);
            const randomTarget = otherPlayers[Math.floor(this.prng() * otherPlayers.length)];
            this.useSkill(aiPlayer.id, skillIndex, randomTarget.id, paymentIndices);
          }
          skillUsed = true;
          break;
        }
      }

      this.advancePhase();
    }
  }

  // ============ 回合结束 ============

  endTurn(): void {
    let newPlayers = [...this.s.players];

    newPlayers = newPlayers.map(player => {
      const updatedPlayer = { ...player };

      const hasWuGou = updatedPlayer.marks.some(m => m.name === '无垢');
      const hasBlind = !hasWuGou && updatedPlayer.marks.some(m => m.name === '失明' && m.remaining_turns > 0);
      const hasConfusion = !hasWuGou && updatedPlayer.marks.some(m => m.name === '混乱' && m.remaining_turns > 0);
      const hasSleep = !hasWuGou && updatedPlayer.marks.some(m => m.name === '睡眠' && m.remaining_turns > 0);
      const hasMadness = !hasWuGou && updatedPlayer.marks.some(m => m.name === '失神' && m.remaining_turns > 0);
      updatedPlayer.has_blind = hasBlind;
      updatedPlayer.has_confusion = hasConfusion;
      updatedPlayer.has_sleep = hasSleep;
      updatedPlayer.has_madness = hasMadness;

      for (const mark of updatedPlayer.marks) {
        const def = getMarkDefinition(mark.name);
        if (!def) continue;
        if (hasWuGou && def.mark_type === 'negative') continue;

        if (def.mark_type === 'positive') {
          if (mark.name === '治疗') updatedPlayer.current_hp = Math.min(updatedPlayer.max_hp, updatedPlayer.current_hp + 4);
          else if (mark.name === '庇佑') updatedPlayer.shield += 4;
          else if (mark.name === '灵感') {
            this.drawCard(updatedPlayer.id, 1);
            const latestPlayer = this.s.players.find(p => p.id === updatedPlayer.id);
            if (latestPlayer) updatedPlayer.hand = latestPlayer.hand;
          }
          else if (mark.name === '鼓舞') updatedPlayer.next_turn_damage_modifier += 2;
        } else {
          if (mark.name === '流血') updatedPlayer.current_hp = Math.max(0, updatedPlayer.current_hp - 4);
          else if (mark.name === '中毒') updatedPlayer.current_hp = Math.max(0, updatedPlayer.current_hp - 2);
          else if (mark.name === '诅咒') updatedPlayer.current_hp = Math.max(0, updatedPlayer.current_hp - 4);
          else if (mark.name === '弱化') updatedPlayer.next_turn_damage_modifier -= 2;
        }
      }

      updatedPlayer.marks = updatedPlayer.marks
        .map(m => ({ ...m, remaining_turns: m.remaining_turns - 1 }))
        .filter(m => m.remaining_turns > 0);

      updatedPlayer.damage_modifier = updatedPlayer.next_turn_damage_modifier;
      updatedPlayer.heal_modifier = updatedPlayer.next_turn_heal_modifier;
      updatedPlayer.penetration_modifier = updatedPlayer.next_turn_penetration_modifier;
      updatedPlayer.next_turn_damage_modifier = 0;
      updatedPlayer.next_turn_heal_modifier = 0;
      updatedPlayer.next_turn_penetration_modifier = 0;
      updatedPlayer.action_order_modifier = 0;
      updatedPlayer.took_damage_this_turn = false;
      updatedPlayer.has_acted_this_turn = false;
      updatedPlayer.skills_used_this_turn = 0;
      updatedPlayer.skill_usage_counts = [];
      updatedPlayer.phase1_energy = 0;
      updatedPlayer.phase1_cards = [];

      return updatedPlayer;
    });

    let currentTurn = this.s.turn;
    if (currentTurn > 20) {
      this.addLog(`[血战] 第 ${currentTurn} 回合结束，所有玩家受到 20 点穿透伤害！`);
      newPlayers = newPlayers.map(p => ({
        ...p,
        current_hp: Math.max(0, p.current_hp - 20),
      }));
    }

    if (this.s.phase === 'phase1') return;
    const nextTurn = currentTurn + 1;
    this.s.turn = nextTurn;
    this.s.phase = 'phase1';
    this.s.phase1_results = null;
    this.s.current_player_index = 0;
    this.s.players = newPlayers;

    this.addLog(`回合 ${nextTurn} 开始`);
    this.checkGameOver();
  }

  // ============ 胜负判定 ============

  checkGameOver(): void {
    const deadPlayers = this.s.players.filter(p => p.current_hp <= 0 && p.hand.length > 0);
    if (deadPlayers.length > 0) {
      deadPlayers.forEach(p => {
        this.s.discard_pile = [...this.s.discard_pile, ...p.hand];
        p.hand = [];
      });
      this.addLog(`[淘汰] ${deadPlayers.map(p => p.name).join('、')} 的手牌已进入弃牌堆`);
    }

    const alivePlayers = this.s.players.filter(p => p.current_hp > 0);

    if (this.s.gameMode === '1vn') {
      const humanPlayer = this.s.players.find(p => p.type === 'human');
      if (humanPlayer && humanPlayer.current_hp <= 0) {
        this.s.phase = 'game_over';
        const aiWinner = alivePlayers.find(p => p.type === 'ai');
        if (aiWinner) {
          this.s.winner = aiWinner;
          this.addLog(`游戏结束！${aiWinner.name} 获胜！`);
        } else {
          this.addLog('游戏结束！平局！');
        }
        return;
      }
    }

    if (alivePlayers.length <= 1) {
      this.s.phase = 'game_over';
      if (alivePlayers.length === 1) {
        this.s.winner = alivePlayers[0];
        this.addLog(`游戏结束！${alivePlayers[0].name} 获胜！`);
      } else {
        this.addLog('游戏结束！平局！');
      }
    }
  }

  // ============ 牌组耗尽 ============

  handleDeckDepletion(): void {
    const handSizes: Array<{ id: PlayerId; size: number }> = [];
    const recycledCards: Card[] = [];

    const depletedPlayers = this.s.players.map(p => {
      const size = p.hand.length;
      handSizes.push({ id: p.id, size });
      recycledCards.push(...p.hand);
      return { ...p, hand: [] as Card[] };
    });

    const newDeck = shuffle(recycledCards, this.prng);

    const seatSorted = [...depletedPlayers].sort((a, b) => a.seat_index - b.seat_index);
    const dealtCounts = new Map<PlayerId, number>();

    for (const sp of seatSorted) {
      const prevSize = handSizes.find(h => h.id === sp.id)?.size || 0;
      const dealCount = Math.floor(prevSize / 10);
      dealtCounts.set(sp.id, dealCount);

      const dealt: Card[] = [];
      for (let i = 0; i < dealCount; i++) {
        const card = newDeck.shift();
        if (card) dealt.push(card);
      }
      sp.hand = dealt;

      sp.current_hp = Math.max(0, sp.current_hp - dealCount);
    }

    const nextTurn = this.s.turn + 1;
    this.s.turn = nextTurn;
    this.s.phase = 'phase1';
    this.s.phase1_results = null;
    this.s.current_player_index = 0;
    this.s.players = depletedPlayers;
    this.s.deck = newDeck;
    this.s.discard_pile = [];

    const detailStr = handSizes
      .map(h => `${this.s.players.find(p => p.id === h.id)?.name}: ${h.size}张→${dealtCounts.get(h.id) || 0}张`)
      .join(', ');
    this.addLog(`[牌组紧急回收] ${detailStr}`);
    this.checkGameOver();
  }
}
