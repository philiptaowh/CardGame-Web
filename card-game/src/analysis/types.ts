// 分析结果类型定义
// V2.1.0 分析平台 — TypeScript 侧

export interface AnalysisOptions {
  /** JSON Lines 数据文件路径 */
  jsonlFile: string;
  /** 启用 GPU 加速 */
  gpu?: boolean;
  /** 输出 HTML 报告路径 */
  output?: string;
  /** 最大加载对局数 */
  maxGames?: number;
  /** 不生成 HTML 报告 */
  noReport?: boolean;
}

export interface AnalysisResult {
  /** 输出 HTML 文件路径 */
  reportPath: string | null;
  /** 总对局数 */
  totalGames: number;
  /** 总耗时 (秒) */
  duration: number;
  /** 使用的 Python 环境 */
  pythonEnv: string;
  /** 退出码 */
  exitCode: number;
}
