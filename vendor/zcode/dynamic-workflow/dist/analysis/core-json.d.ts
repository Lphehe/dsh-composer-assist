import type { OrderTrace } from "./causality-order.js";
import type { AnalysisCore, CoreSites } from "./core.js";
import type { TaintOcc } from "./domain.js";
/**
 * `AnalysisCore` 的 JSON 编解码。
 *
 * core 本身已是无位置依赖的纯数据，唯一挡住 `JSON.stringify` 的是 `facts.*` 与 `types.*`
 * 里的 `Map`——它们会被序列化成 `{}`。这里把每个 Map 换成**有序** `[key, value][]`：
 * 数组保住插入序，解码用 `new Map(entries)` 原样还回去，于是 `serializeCore(decode(encode(c)))`
 * 与 `serializeCore(c)` 逐字节相同，投影在冻结工件上算出的图与导出当刻一致。
 *
 * `sites` 与 `trace` 只含普通对象、数组与可选字段，原样穿过：`JSON.stringify` 丢掉值为
 * `undefined` 的属性，解码器**不**把它们补回来——投影全部按「字段缺席」而非「字段为
 * undefined」判定，两种形状等价。唯一的例外是 `joinPortTypes` 的值：`(string | undefined)[]`
 * 里的 `undefined` 落进数组会被 JSON 写成 `null`，所以编码时显式写 `null`，解码时换回
 * `undefined`，让「该端口类型不可知」的洞在往返后仍是 `undefined` 而不是 `null`。
 */
/** 有序的 Map 条目：数组序即 Map 的插入序。 */
export type MapEntries<V> = [string, V][];
export interface AnalysisCoreJson {
    /** 格式版本；解码器只认识它认得的版本，其余抛错而不是猜。 */
    version: 1;
    sites: CoreSites;
    facts: {
        askData: MapEntries<TaintOcc[]>;
        askActor: MapEntries<TaintOcc[]>;
        worldReadData: MapEntries<TaintOcc[]>;
        joinIn: MapEntries<TaintOcc[]>;
        fanoutIn: MapEntries<TaintOcc[]>;
        /** 留白提示的 sink（2026-09-28 加入）；早于它冻结的样例包没有这个键，解码按空表补。 */
        holeData?: MapEntries<TaintOcc[]>;
        returnData: TaintOcc[];
    };
    trace: OrderTrace;
    types: {
        siteType: MapEntries<string>;
        /** 端口类型的洞（`undefined`）在这里是 `null`——JSON 数组里没有 `undefined`。 */
        joinPortTypes: MapEntries<(string | null)[]>;
    };
}
/** 把 core 变成可直接 `JSON.stringify` 的纯对象；`sites` 与 `trace` 共享原引用。 */
export declare function encodeAnalysisCore(core: AnalysisCore): AnalysisCoreJson;
/** 从 JSON 形态重建 core（Map 保持原插入序）。未知版本抛普通 `Error`。 */
export declare function decodeAnalysisCore(json: AnalysisCoreJson): AnalysisCore;
//# sourceMappingURL=core-json.d.ts.map