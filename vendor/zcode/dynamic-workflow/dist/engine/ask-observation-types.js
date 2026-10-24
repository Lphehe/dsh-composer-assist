/**
 * driver 对一条 ask 的**观察**词汇表：用量（{@link AskStats}）与进度（{@link AskProgress}）——
 * 同一次 turn 解析上报的两半，一半是账，一半是「还在动吗」。
 *
 * 从 types.ts 拆出的原因与 imported-cache-types.ts 同一条：那份契约已到 oxlint 的 max-lines
 * 上限。公开面不变——types.ts 原地再导出这里的每一个名字，导入路径仍是 `./types.js`。
 */
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
