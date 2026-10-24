/**
 * 引擎的结构化错误（docs/execution-engine.md「Errors are first-class」）：稳定错误码、
 * 它的可序列化形态，以及跨 Boundary A 抛出的 {@link WorkflowError} 本身。
 *
 * 独立成文件的理由与 run-terminal.ts 同一条：types.ts 已抵 oxlint 的 400 行门，而这一族
 * 高度自足——它只依赖 schema 的 `Violation` 与终态明细，不依赖词汇表里的任何别的东西。
 * 消费者按惯例仍从 types.ts 取（那边原样再导出），导入路径因此一处都不必改。
 */
/**
 * 跨 Boundary A 抛出的结构化错误。带稳定 code 与可选的 violations / finalText / mismatch，
 * 使脚本侧 try/catch 与上层都能按结构处理，而不依赖字符串匹配。
 */
export class WorkflowError extends Error {
    code;
    violations;
    finalText;
    mismatch;
    providerStop;
    constructor(code, message, extra) {
        super(message);
        this.name = "WorkflowError";
        this.code = code;
        if (extra?.violations !== undefined)
            this.violations = extra.violations;
        if (extra?.finalText !== undefined)
            this.finalText = extra.finalText;
        if (extra?.mismatch !== undefined)
            this.mismatch = extra.mismatch;
        if (extra?.providerStop !== undefined)
            this.providerStop = extra.providerStop;
        if (extra?.cause !== undefined)
            this.cause = extra.cause;
    }
    /** 转为可序列化形态落 journal。 */
    toJSON() {
        const json = { code: this.code, message: this.message };
        if (this.violations !== undefined)
            json.violations = this.violations;
        if (this.finalText !== undefined)
            json.finalText = this.finalText;
        if (this.mismatch !== undefined)
            json.mismatch = this.mismatch;
        if (this.providerStop !== undefined)
            json.providerStop = this.providerStop;
        return json;
    }
    /** 从 journal 记录重建（replay 命中失败节点时用）。 */
    static fromJSON(json) {
        return new WorkflowError(json.code, json.message, {
            violations: json.violations,
            finalText: json.finalText,
            mismatch: json.mismatch,
            providerStop: json.providerStop,
        });
    }
}
