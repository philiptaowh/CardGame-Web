// 游戏教学内容数据（v2.2.1.5 v3）
//
// 设计原则：
// - 步骤数据化：文案修改不动组件逻辑
// - version 字段保留作未来内容热替换占位
// - UI 描述用功能性名词 + 相对位置，避免绑死按钮 className
// - 文字步骤（text）+ 演示步骤（demo，含自动播放和交互两种）
// - 交互步骤通过 expectedEndState 校验玩家动作

import type { TutorialStep } from '../../stores/tutorialStore';

export const TUTORIAL_VERSION = 'v2.2.1.5-v3';

// === 数据结构定义 ===

export interface DemoCharacterState {
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  marks: { name: string; type: 'positive' | 'negative' }[];
  energy?: number; // 仅在 phase1 显示
}

export interface DemoState {
  turn: number;
  phase: 'phase1' | 'phase2' | 'phase3' | 'game_over';
  player: DemoCharacterState;     // 「平衡」
  opponent: DemoCharacterState;   // 「进攻」
  log: string[];
  highlight?: 'player' | 'opponent' | 'player-energy' | 'opponent-energy' | 'player-skill-1' | 'player-special-attack-up' | 'log';
}

export type DemoAction =
  | { type: 'use_skill'; skillIndex: number }
  | { type: 'use_special_card'; cardIndex: number }
  | { type: 'pay_energy'; cardIndex: number }
  | { type: 'cancel_payment' };

export interface DemoContent {
  type: 'demo';
  state: DemoState;                  // 初始状态（player action 之前的快照）
  caption: string;                   // 1-2 句简短说明
  interactive?: boolean;             // 是否需要玩家交互
  prompt?: string;                   // 交互步骤的玩家提示（顶部横幅）
  expectedEndState?: Partial<DemoState>; // 校验玩家动作完成的状态
}

export interface TextContent {
  type: 'text';
  text: string;                      // 纯文字描述（多行）
  warning?: string;                 // 可选：红色加粗警示块（重要声明、免责声明等）
}

export type StepContent = TextContent | DemoContent;

export interface TutorialStepV3 {
  id: string;
  title: string;
  content: StepContent;
}

// === 9 步数据 ===

export const TUTORIAL_STEPS: TutorialStepV3[] = [
  // Step 1: 欢迎（纯文字）
  {
    id: 'welcome',
    title: '欢迎来到卡牌游戏',
    content: {
      type: 'text',
      text:
        '这是一个 9 角色 × 4 技能的回合制对战游戏。\n' +
        '你的目标是在 HP > 0 时击败 AI 对手。\n\n' +
        '接下来 9 步会带你了解：回合结构、能量放置、技能与特殊卡、印记、护盾与穿透、血战、胜利条件。\n\n' +
        '中间有 2 步（4 和 5）会请你亲自点击体验。其他步骤会自动播放演示。\n\n' +
        '任何时候点「跳过」可退出。',
    },
  },

  // Step 2: 三阶段回合（自动演示）
  {
    id: 'three-phases',
    title: '每个回合由 3 个阶段组成',
    content: {
      type: 'demo',
      caption: '回合开始：阶段 1（能量）→ 阶段 2（行动）→ 阶段 3（结算）。每回合都按此循环。',
      state: {
        turn: 1,
        phase: 'phase1',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [], energy: 3 },
        opponent: { name: '进攻', hp: 80, maxHp: 80, shield: 0, marks: [], energy: 2 },
        log: ['→ 阶段 1：能量放置', '→ 双方揭示能量卡'],
        highlight: 'log',
      },
    },
  },

  // Step 3: 能量放置（自动演示）
  {
    id: 'energy-order',
    title: '能量数值大者先手',
    content: {
      type: 'demo',
      caption: '平衡 3 > 进攻 2，本回合「平衡」先手行动。',
      state: {
        turn: 1,
        phase: 'phase1',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [], energy: 3 },
        opponent: { name: '进攻', hp: 80, maxHp: 80, shield: 0, marks: [], energy: 2 },
        log: [
          '→ 阶段 1：能量放置',
          '→ 双方揭示能量卡',
          '→ 平衡 (3) > 进攻 (2) → 平衡先手',
        ],
        highlight: 'player-energy',
      },
    },
  },

  // Step 4: 技能使用（交互演示）🆕
  {
    id: 'use-skill-interactive',
    title: '技能：阶段 2 的主要行动手段',
    content: {
      type: 'demo',
      interactive: true,
      prompt: '👆 试试点击「平衡」卡上的「技能 1: 普通攻击」',
      caption: '点击技能按钮 → 弹能量支付窗口 → 选 1 张能量卡 → 确认，技能释放。',
      state: {
        turn: 1,
        phase: 'phase2',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [] },
        opponent: { name: '进攻', hp: 80, maxHp: 80, shield: 0, marks: [] },
        log: ['→ 阶段 2：行动（平衡先手）'],
        highlight: 'player-skill-1',
      },
      expectedEndState: {
        turn: 1,
        phase: 'phase2',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [] },
        opponent: { name: '进攻', hp: 70, maxHp: 80, shield: 0, marks: [] },
        log: ['→ 阶段 2：行动（平衡先手）', '→ 平衡 对 进攻 造成 10 伤害'],
      },
    },
  },

  // Step 5: 特殊卡（交互演示）🆕
  {
    id: 'use-special-card-interactive',
    title: '特殊卡：增益 / 即时效果',
    content: {
      type: 'demo',
      interactive: true,
      prompt: '👆 试试点击手牌中的红色「攻击强化」特殊卡',
      caption: '特殊卡通常不消耗能量，点击后立即生效（获得增益印记或单次效果）。',
      state: {
        turn: 1,
        phase: 'phase2',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [] },
        opponent: { name: '进攻', hp: 70, maxHp: 80, shield: 0, marks: [] },
        log: ['→ 阶段 2：行动（平衡先手）', '→ 平衡 对 进攻 造成 10 伤害'],
        highlight: 'player-special-attack-up',
      },
      expectedEndState: {
        turn: 1,
        phase: 'phase2',
        player: {
          name: '平衡',
          hp: 100,
          maxHp: 100,
          shield: 0,
          // 注意：type 设为 'negative' 以触发红色样式（标红强化 mark，视觉强调）
          marks: [{ name: '强化', type: 'negative' }],
        },
        opponent: { name: '进攻', hp: 70, maxHp: 80, shield: 0, marks: [] },
        log: [
          '→ 阶段 2：行动（平衡先手）',
          '→ 平衡 对 进攻 造成 10 伤害',
          '→ 平衡 使用 攻击强化，下一技能伤害 +50%',
        ],
      },
    },
  },

  // Step 6: 印记系统（自动演示）
  {
    id: 'marks',
    title: '印记：正/负面状态效果',
    content: {
      type: 'demo',
      caption: '进攻获得「流血」印记（红色）→ 阶段 3 结算 -3 HP。印记图标显示在角色卡上。',
      state: {
        turn: 2,
        phase: 'phase3',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [] },
        opponent: {
          name: '进攻',
          hp: 67,
          maxHp: 80,
          shield: 0,
          marks: [{ name: '流血', type: 'negative' }],
        },
        log: [
          '→ 阶段 2：行动',
          '→ 平衡 对 进攻 造成 10 伤害',
          '→ 进攻 获得 流血 印记',
          '→ 阶段 3：结算 流血 → 进攻 -3 HP',
        ],
        highlight: 'opponent',
      },
    },
  },

  // Step 7: 护盾 vs 穿透（自动演示）
  {
    id: 'shield-vs-penetration',
    title: '两种伤害机制',
    content: {
      type: 'demo',
      caption: '进攻获得 5 护盾 → 但平衡用「穿透」技能 → 进攻 HP -20（护盾不动，穿透无视护盾）。',
      state: {
        turn: 3,
        phase: 'phase2',
        player: { name: '平衡', hp: 100, maxHp: 100, shield: 0, marks: [] },
        opponent: { name: '进攻', hp: 47, maxHp: 80, shield: 5, marks: [] },
        log: [
          '→ 阶段 2：行动',
          '→ 进攻 获得 5 护盾',
          '→ 平衡 施放 穿透技能',
          '→ 进攻 HP -20（无视护盾）',
        ],
        highlight: 'opponent',
      },
    },
  },

  // Step 8: 血战机制（自动演示）
  {
    id: 'blood-war',
    title: '回合超过 20 后进入血战期',
    content: {
      type: 'demo',
      caption: '回合 21 → 双方每回合开始受 20 点穿透伤害（无视护盾），对局自动加速。',
      state: {
        turn: 21,
        phase: 'phase1',
        player: { name: '平衡', hp: 60, maxHp: 100, shield: 5, marks: [] },
        opponent: { name: '进攻', hp: 20, maxHp: 80, shield: 0, marks: [] },
        log: [
          '→ 回合 21 进入血战期',
          '→ 平衡 受 20 点穿透伤害（无视护盾）',
          '→ 进攻 受 20 点穿透伤害',
        ],
        highlight: 'log',
      },
    },
  },

  // Step 9: 胜利条件 + 详细规则入口（纯文字）
  {
    id: 'victory',
    title: '胜利条件 + 进入对局',
    content: {
      type: 'text',
      text:
        'HP > 0 活到最后的玩家获胜。双方同时归 0 时为平局。\n\n' +
        '---\n\n' +
        '📍 局内详细规则入口：进入对局后，页面顶部区域有一个「? 帮助」按钮（圆圈问号图标），点击可查看：\n' +
        '- 基础规则：三阶段详述、血战机制\n' +
        '- 角色百科：9 角色技能详情\n' +
        '- 特殊卡牌：16 种卡效果\n' +
        '- 印记说明：正/负面印记清单\n\n' +
        '本教学只讲入门概念；具体裁定与卡牌描述以局内帮助为准。\n\n' +
        '教学结束！点「完成」进入测试页。',
      warning: '免责声明：本教程所有的技能与特殊卡效果仅供参考，详情以游戏内实际效果为准。',
    },
  },
];