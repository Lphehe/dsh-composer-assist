/**
 * 沙箱入口文件的落盘。
 *
 * 为什么有这个文件：Windows 的命令行上限是 32,767 字符，payload 不能再过 argv。harness 把
 * {@link import("./child-source.js").renderChildEntry} 渲染出的 ESM 写到
 * `<cwd>/.zcode/workflow-runs/<runId>.mjs`，spawn 时命令行只剩这条路径。
 *
 * 裁决：
 *   - 位置 `.zcode/workflow-runs/`，与项目级 saved workflow 的 `.zcode/workflows/` 同级不混放；
 *   - 文件**保留**不删（同一 runId 原位覆写），目录兼作每次 run 实际执行体的存档；
 *   - 目录里由本模块写一份 `.gitignore`（`*`），只在缺席时写一次，绝不碰项目自己的 `.gitignore`；
 *   - 项目目录写不进（只读 checkout、cwd 不存在、`.zcode` 是个普通文件…）→ 回落到
 *     `os.tmpdir()/zcode-workflow-runs/` 并经 `onWarning` 报一声，run 照常启动。回落也失败就抛，
 *     由 harness 归一成 failed 结算。
 */
/** harness 向调用方报告的非致命状况；bootstrap 落成 warn 日志。 */
export interface HarnessWarning {
    kind: "entry_file_fallback";
    /** 本想写入的项目目录（`<cwd>/.zcode/workflow-runs`）。 */
    projectDir: string;
    /** 实际回落到的目录。 */
    fallbackDir: string;
    /** 项目目录写入失败的错误文本。 */
    error: string;
}
export interface WriteChildEntryFileInput {
    cwd: string;
    runId: string;
    /** 渲染好的入口文件源码。 */
    source: string;
    onWarning?: (warning: HarnessWarning) => void;
}
export interface ChildEntryFile {
    path: string;
    location: "project" | "tmpdir";
}
/** 项目内的入口文件目录。 */
export declare function workflowRunsDir(cwd: string): string;
/** 回落目录（OS 临时目录下，跨项目共用）。 */
export declare function fallbackWorkflowRunsDir(): string;
/** runId 安全字符集之外一律换成 `_`，杜绝路径分隔符之类混进文件名。 */
export declare function childEntryFileName(runId: string): string;
export declare function writeChildEntryFile(input: WriteChildEntryFileInput): ChildEntryFile;
//# sourceMappingURL=child-entry-file.d.ts.map