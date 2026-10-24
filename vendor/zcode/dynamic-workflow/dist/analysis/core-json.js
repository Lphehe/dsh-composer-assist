const VERSION = 1;
/** 把 core 变成可直接 `JSON.stringify` 的纯对象；`sites` 与 `trace` 共享原引用。 */
export function encodeAnalysisCore(core) {
    return {
        facts: {
            askActor: [...core.facts.askActor],
            askData: [...core.facts.askData],
            fanoutIn: [...core.facts.fanoutIn],
            holeData: [...core.facts.holeData],
            joinIn: [...core.facts.joinIn],
            returnData: core.facts.returnData,
            worldReadData: [...core.facts.worldReadData],
        },
        sites: core.sites,
        trace: core.trace,
        types: {
            joinPortTypes: [...core.types.joinPortTypes].map(([id, ports]) => [
                id,
                ports.map((port) => (port === undefined ? null : port)),
            ]),
            siteType: [...core.types.siteType],
        },
        version: VERSION,
    };
}
/** 从 JSON 形态重建 core（Map 保持原插入序）。未知版本抛普通 `Error`。 */
export function decodeAnalysisCore(json) {
    if (json.version !== VERSION) {
        throw new Error(`unsupported AnalysisCoreJson version ${String(json.version)} (expected ${VERSION})`);
    }
    return {
        facts: {
            askActor: new Map(json.facts.askActor),
            askData: new Map(json.facts.askData),
            fanoutIn: new Map(json.facts.fanoutIn),
            holeData: new Map(json.facts.holeData ?? []),
            joinIn: new Map(json.facts.joinIn),
            returnData: json.facts.returnData,
            worldReadData: new Map(json.facts.worldReadData),
        },
        // 留白站点表同样是后加的键：老样例包按「没有留白」解码。
        sites: { ...json.sites, holes: json.sites.holes ?? [] },
        trace: json.trace,
        types: {
            joinPortTypes: new Map(json.types.joinPortTypes.map(([id, ports]) => [id, ports.map((port) => (port === null ? undefined : port))])),
            siteType: new Map(json.types.siteType),
        },
    };
}
