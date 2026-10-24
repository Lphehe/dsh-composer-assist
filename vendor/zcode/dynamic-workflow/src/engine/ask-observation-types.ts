/**
 * driver 对一条 ask 的**观察**词汇表：用量（{@link AskStats}）与进度（{@link AskProgress}）——
 * 同一次 turn 解析上报的两半，一半是账，一半是「还在动吗」。
 *
 * 从 types.ts 拆出的原因与 imported-cache-types.ts 同一条：那份契约已到 oxlint 的 max-lines
 * 上限。公开面不变——types.ts 原地再导出这里的每一个名字，导入路径仍是 `./types.js`。
 */

/** driver 每完成一次 ask 上报的用量统计。 */
export interface AskStats {
  tokens: number;
  toolCalls: number;
  turns: number;
  /**
   * 其中**看或动了外部世界**的调用数：读文件、跑命令、访问网络。
   * 不含只把结果或问题交回引擎的协议工具（`submit_result`、`escalate`），所以一条只作答的 typed ask
   * 这里是 0——那样的 ask 是**纯**的，只依赖指令与转录前缀，导入缓存关闭之后仍可从缓存结算。
   * 老 journal 行没有这个键，一律按「碰过」处理（保守）。
   */
  worldToolCalls?: number;
}

/**
 * `node-queued` 上 `instructionsHead` 的字符上限（240）。够一两句把这次 ask 交代清楚，
 * 又不至于让事件表长出一份指令副本——完整指令在 `dwf_node.input_json` 那一侧。
 */
export const INSTRUCTIONS_HEAD_MAX_CHARS = 240;

/** `node-progress` 上 `lastTool.name` 的字符上限（64）：工具名，不是描述。 */
export const LAST_TOOL_NAME_MAX_CHARS = 64;

/**
 * `node-progress` 上 `lastTool.target` 的字符上限（120）：一条给人看的线索（文件路径 /
 * 命令头），不是入参本身——入参可以装下任何东西，而这条事件会被主代理读、被 GUI 画。
 */
export const LAST_TOOL_TARGET_MAX_CHARS = 120;

/**
 * 最近一次被观察到的工具调用（{@link AskProgress} 的 `lastTool`）。
 * `target` 是给人看的**线索**，不是入参：文件类工具给路径，Bash 给命令头，认不出就缺席。
 */
export interface AskLastTool {
  /** 工具名，≤ {@link LAST_TOOL_NAME_MAX_CHARS}。 */
  name: string;
  /** 简短目标，≤ {@link LAST_TOOL_TARGET_MAX_CHARS}；无从判断时缺席（不合成占位串）。 */
  target?: string;
}

/**
 * 一条 ask 在**turn 解析那一刻**的进度。
 * 与 {@link AskStats} 是同一次 driver 回报的两半：stats 是账（token），progress 是「还在动吗」。
 */
export interface AskProgress {
  /** 本 ask 内已解析的 turn 数，从 1 起（nudge 轮计数；repair 轮不计——它们不结束 turn）。 */
  turn: number;
  /** 本 ask 内累计的工具调用数，与 {@link AskStats.toolCalls} 同一个计数器。 */
  toolCalls: number;
  lastTool?: AskLastTool;
}
