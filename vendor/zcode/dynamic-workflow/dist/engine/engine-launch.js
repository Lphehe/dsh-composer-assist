// ============================================================
// run-launched：发起 run 那一轮的宿主元数据 → 事件
// ============================================================
// 引擎不读这些元数据（锚点、阶段表、并行表、子代理选型），只在建 run 那一世紧跟首条
// `run-started` 逐字转录一次（engine.ts）。构造独立成模块，engine.ts 与 types.ts 才都留在
// 400 行的 lint 上限之内——它们是两侧同时增长的文件。
/**
 * 把 launch 元数据转录成 `run-launched`。未设的键**缺席**而不是落成 undefined 值：读侧
 * （AmendWorkflow 的三态、投影）把「没设」与「设了个空」当两件事。
 */
export function runLaunchedEvent(launch, origin) {
    const { inputId, phaseNames, subagentModel, subagentPermissionMode, modelBindings, scriptPath, phaseAlongside, holes, } = launch;
    return {
        type: "run-launched",
        inputId,
        ...(origin.toolCallId === undefined ? {} : { toolCallId: origin.toolCallId }),
        ...(origin.parentSessionId === undefined ? {} : { parentSessionId: origin.parentSessionId }),
        ...(phaseNames === undefined ? {} : { phaseNames }),
        ...(subagentModel === undefined ? {} : { subagentModel }),
        ...(subagentPermissionMode === undefined ? {} : { subagentPermissionMode }),
        ...(modelBindings === undefined ? {} : { modelBindings }),
        ...(scriptPath === undefined ? {} : { scriptPath }),
        ...(phaseAlongside === undefined ? {} : { phaseAlongside }),
        ...(holes === undefined ? {} : { holes }),
    };
}
