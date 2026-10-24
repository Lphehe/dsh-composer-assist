/**
 * 内存版 {@link JournalStorePort}：阶段一用于 fake-driver 测试与 replay/resume。
 * 纯内存、同步；深拷贝进出以杜绝调用方持有的引用被后续写入意外改动（模拟存储边界）。
 * 生产实现落在 zcode session store 的 node:sqlite（DatabaseSync，同步）之上，共用 JournalStorePort；
 * 事务性不在端口面上，由 driver 组合 journal+session 写入。
 */
import type { ActorRecord, Caps, GetNodeOptions, JournalStorePort, ListActorsOptions, ListEventsOptions, ListNodesOptions, NodeKind, NodeRecord, RunEvent, RunRecord, RunSettlementRecord, RunStatus, StoredEvent } from "./types.js";
export declare class InMemoryJournalStore implements JournalStorePort {
    private readonly runs;
    private readonly actors;
    private readonly nodes;
    private readonly events;
    createRun(record: RunRecord): void;
    getRun(runId: string): RunRecord | undefined;
    updateRunStatus(runId: string, status: RunStatus, settlement?: RunSettlementRecord): void;
    updateRunUsage(runId: string, spentTokens: number): void;
    updateRunCaps(runId: string, caps: Caps): void;
    updateRunScript(runId: string, scriptText: string, scriptHash: string): void;
    putActor(record: ActorRecord): void;
    getActor(runId: string, siteId: string, ordinal: number): ActorRecord | undefined;
    listActors(runId: string, opts: ListActorsOptions): ActorRecord[];
    putNode(record: NodeRecord): void;
    getNode(runId: string, siteId: string, ordinal: number, opts?: GetNodeOptions): NodeRecord | undefined;
    listNodes(runId: string, opts: ListNodesOptions): NodeRecord[];
    countNodes(runId: string, kind: NodeKind): number;
    sumResultBytes(runId: string, kind: NodeKind): number;
    appendEvent(runId: string, event: RunEvent): StoredEvent;
    listEvents(runId: string, opts: ListEventsOptions): StoredEvent[];
    private requireActorBucket;
    private requireNodeBucket;
}
//# sourceMappingURL=journal-memory.d.ts.map