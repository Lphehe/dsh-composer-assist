/**
 * scheduler.ts 顶到 oxlint max-lines 上限（400 行），把 Boundary B 的两条向上回报
 * （submit_result 到达、turn 结束）及其 repair / nudge 预算与 submit 归一化拆到本文件；
 * 公开面仍从 scheduler.ts 导出。
 *
 * 自由函数经 {@link SubmitSeam} 拿到调度器的 live 节点表与两条结算入口；AskScheduler 上的
 * submitAttempted / turnEnded 只是薄委托。
 */
import type { AskNode, SchedulerHost } from "./scheduler-types.js";
import type { InstanceRef } from "./types.js";
import { WorkflowError } from "./types.js";
/** 调度器暴露给回报处理的最小接缝：查 live 节点、按结果结算。 */
export interface SubmitSeam {
    readonly host: SchedulerHost;
    /** 按实例查 live 节点（已离开 liveNodes 的返回 undefined）。 */
    liveNode(instance: InstanceRef): AskNode | undefined;
    settleOk(node: AskNode, artifact: unknown): void;
    settleFailed(node: AskNode, error: WorkflowError): void;
}
export declare function handleSubmitAttempted(seam: SubmitSeam, instance: InstanceRef, payload: unknown): void;
export declare function handleTurnEnded(seam: SubmitSeam, instance: InstanceRef, finalText: string): void;
//# sourceMappingURL=scheduler-submit.d.ts.map