// 游戏核心类型定义

export type PlayerId = string;
export type CardId = string;
export type CharacterId = string;
export type GameMode = '1v1' | '1vn';

// ============ 卡牌类型 ============

export type CardType = 'energy' | 'special';

export interface BaseCard {
  card_id: CardId;
  name: string;
  type: CardType;
}

export interface EnergyCard extends BaseCard {
  type: 'energy';
  energy: number;
  is_wild: boolean;
}

export interface SpecialCard extends BaseCard {
  type: 'special';
  effect_id: number;
  description: string;
}

export type Card = EnergyCard | SpecialCard;

// ============ 角色技能 ============

export interface Skill {
  name: string;
  cost: number;
  description: string;
  max_uses_per_turn?: number;
  target?: 'self' | 'other'; // 目标类型：self=自己，other=其他玩家（默认）
}

// ============ 角色卡 ============

export interface CharacterCard {
  card_id: CharacterId;
  name: string;
  hp: number;
  skills: Skill[];
}

// ============ 玩家状态 ============

export type PlayerType = 'human' | 'ai';

export interface Player {
  id: PlayerId;
  name: string;
  type: PlayerType;
  seat_index: number; // 座位号（1-4），用于换牌次数和显示位次
  character_id: CharacterId;
  max_hp: number;
  current_hp: number;
  shield: number;
  hand: Card[];
  marks: ActiveMark[];
  action_order_modifier: number;
  // 本回合立即生效的 modifier
  damage_modifier: number;
  heal_modifier: number;
  penetration_modifier: number;
  // 下回合生效的 modifier
  next_turn_damage_modifier: number;
  next_turn_heal_modifier: number;
  next_turn_penetration_modifier: number;
  // 本回合是否受过伤害
  took_damage_this_turn: boolean;
  has_acted_this_turn: boolean;
  skills_used_this_turn: number;
  skill_usage_counts: number[]; // 每个技能本回合的独立使用次数
  remaining_exchanges: number; // 换牌阶段剩余可换牌次数
  phase1_cards: Card[]; // 阶段1放置的卡牌
  phase1_energy: number; // 阶段1计算出的倡议值
  // 印记状态标志
  has_blind: boolean;     // 失明 - 下一回合无法抽卡
  has_confusion: boolean; // 混乱 - 下一回合目标偏移
  has_sleep: boolean;   // 睡眠 - 下一回合无法行动
  has_madness: boolean; // 失神 - 下一回合每次使用技能需额外弃牌
}

export interface ActiveMark {
  name: string;
  remaining_turns: number;
}

// ============ 游戏阶段 ============

export type GamePhase = 'setup' | 'card_exchange' | 'phase1' | 'phase2' | 'phase3' | 'game_over';

export interface EnergyResultEntry {
  playerId: PlayerId;
  name: string;
  energy: number;
  cardCount: number;
}

export interface GameState {
  turn: number;
  phase: GamePhase;
  gameMode: GameMode;
  players: Player[];
  current_player_index: number;
  action_order: PlayerId[]; // 玩家行动顺序：ID数组
  phase1_results: EnergyResultEntry[] | null; // 阶段1能量放置结果
  deck: Card[];
  discard_pile: Card[];
  logs: GameLog[];
  winner: Player | null;
}

export interface GameLog {
  turn: number;
  phase: GamePhase;
  message: string;
  timestamp: number;
}

// ============ V2 仿真引擎类型 ============

/** 伪随机数生成器函数（0~1 浮点数） */
export type PRNG = () => number;

/** 时间戳提供者 */
export type TimestampProvider = () => number;

/** GameEngine 构造配置（V2 仿真用，V1 无需传入） */
export interface GameEngineConfig {
  prng?: PRNG;
  seed?: number;
  timestampProvider?: TimestampProvider;
}