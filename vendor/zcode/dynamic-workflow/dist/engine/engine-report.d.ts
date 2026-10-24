/**
 * engine.ts 顶到 oxlint max-lines 上限（400 行），把 `report()` 的发布路径（序列化探针、
 * replay 去重、标签校验、两个上限、一次写）拆到本文件；公开面仍从 engine.ts 导出。
 *
 * 自由函数经 {@link EngineState} 接缝读写引擎状态；WorkflowEngine.report 只是薄委托。
 */
import type { EngineState } from "./engine-state.js";
/**
 * 发布一条中间结果（Boundary A 的 `report`）。同步、无返回值、无 driver 往返：
 * 落一行 journal + 发一个事件就结束。
 *
 * 四件事，顺序是有讲究的：
 *
 * 1. **序列化探针先行**。用 `JSON.stringify` 一次拿到两样东西：item 到底能不能被 JSON
 *    表示，以及它的字节数（上限的度量）。必须在 canonicalJson 之前——带环的 item 会让
 *    canonicalJson 递归爆栈，那是一次崩溃而不是一次可读的失败。
 * 2. **replay 命中即跳过**：不发事件、不重写记录。跳过之前先比对 inputHash，不一致按
 *    纯度违约让 run 大声失败。这条比对是**防御性的**（一条报告派生自 journal 已经钉住的
 *    值），但它是免费的，而这里的偏移意味着整个 replay 不可靠——Results 面板的读者绝不
 *    应该在不知情的情况下看到那种东西。
 * 3. **上限先于落库**：单条字节数、条数、run 级字节总数任一超出即 `ReportCapExceeded`
 *    失败整个 run。
 *    run 级而非 node 级，因为 `report` 返回 `void`，没有可拒绝进去的地方。
 * 4. **一次写**：`completed`、无 actor 字段。
 */
export declare function publishReport(state: EngineState, siteId: string, item: unknown, artifactId?: string): void;
//# sourceMappingURL=engine-report.d.ts.map