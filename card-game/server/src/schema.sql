-- v2.2.0-alpha 网页版录像采集后端 - replays 表 DDL
--
-- 表用途：存储 V1 网页客户端上传的 V1Replay（每行一条完整录像）
-- 摘要字段提取便于统计查询；完整 payload 用 JSON 列保留

CREATE TABLE IF NOT EXISTS replays (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

  -- 摘要字段（从 V1Replay 提取，便于索引/聚合）
  client_ip       VARCHAR(45)    NOT NULL DEFAULT '' COMMENT '客户端 IP (IPv4/IPv6)',
  user_agent      VARCHAR(255)   NOT NULL DEFAULT '' COMMENT '客户端 User-Agent',
  char_player     VARCHAR(16)    NOT NULL DEFAULT '' COMMENT '玩家角色 (char_1 ~ char_9)',
  char_ai         VARCHAR(16)    NOT NULL DEFAULT '' COMMENT 'AI 角色 (char_1 ~ char_9)',
  winner          VARCHAR(16)    NOT NULL DEFAULT '' COMMENT '胜者: player/ai/draw (空=未解析)',
  turn_count      INT UNSIGNED   NOT NULL DEFAULT 0  COMMENT '对局总回合数',
  duration_ms     INT UNSIGNED   NOT NULL DEFAULT 0  COMMENT '对局时长 ms',
  moves_count     INT UNSIGNED   NOT NULL DEFAULT 0  COMMENT '总动作数',

  -- 完整 Replay JSON
  payload         JSON           NOT NULL COMMENT '完整 V1Replay 对象',

  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '服务端入库时间',

  INDEX idx_created_at   (created_at),
  INDEX idx_char_ai      (char_ai, char_player),
  INDEX idx_char_player  (char_player, char_ai),
  INDEX idx_winner       (winner, char_ai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='v2.2.0-alpha 网页版录像采集表';

-- ============================================================
-- v2.2.1.2 — 共享测试进度 (test_progress 表)
-- ============================================================
-- 表用途：所有登录此网站的玩家共用的"测试对局"采集进度
-- 设计要点：
--   1. 单表存储 81 个 matchup（9 人类 × 9 AI），每行一个 matchup
--   2. 启动时若表为空，自动插入 81 行（target=10, completed=0）
--   3. 10/10 后 status=locked，前端灰显 + 后端拒绝 +1
--   4. last_player_ip + last_player_ua 调试用（不展示给用户）
-- ============================================================

CREATE TABLE IF NOT EXISTS test_progress (
  matchup_key     VARCHAR(32)    NOT NULL PRIMARY KEY COMMENT 'humanChar|aiChar',
  human_char      VARCHAR(16)    NOT NULL COMMENT '人类玩家角色 (char_1 ~ char_9)',
  ai_char         VARCHAR(16)    NOT NULL COMMENT 'AI 角色 (char_1 ~ char_9)',

  target          INT UNSIGNED   NOT NULL DEFAULT 10 COMMENT '配额（10 局）',
  completed       INT UNSIGNED   NOT NULL DEFAULT 0  COMMENT '已完成局数',

  -- 完成时间戳列表（JSON 数组，毫秒时间戳）
  completed_at    JSON           NOT NULL COMMENT '[ts1, ts2, ...]',

  -- 最后一次完成的人（仅调试用，不展示）
  last_player_ip  VARCHAR(45)    NOT NULL DEFAULT '' COMMENT '最近完成者 IP',
  last_player_ua  VARCHAR(255)   NOT NULL DEFAULT '' COMMENT '最近完成者 User-Agent',

  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_human_char (human_char),
  INDEX idx_ai_char    (ai_char),
  INDEX idx_completed  (completed, human_char, ai_char)  -- 用于找 available matchup
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='v2.2.1.2 共享测试进度表 (81 matchup × 10 局)';

