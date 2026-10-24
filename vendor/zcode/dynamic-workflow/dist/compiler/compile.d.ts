import ts from "typescript";
/** One diagnostic, positioned in the author's script (1-based line/column). */
export interface CompileDiagnostic {
    code: number;
    column: number;
    line: number;
    message: string;
}
export interface CompileResult {
    diagnostics: CompileDiagnostic[];
    ok: boolean;
}
export declare const SCRIPT_FILE_NAME = "workflow-script.ts";
export declare const WORKFLOW_FUNCTION_NAME = "__workflowScript__";
/**
 * 包装前缀的长度：wrapped 源码里的位置减去它就是作者原文里的偏移。留白补全的拼接
 * （analysis/hole-splice.ts）要按站点表里的节点位置在原文上插入文本，走的正是这条换算。
 */
export declare const SCRIPT_PRELUDE_LENGTH: number;
/** A prelude-adjusted, 1-based location in the author's script coordinates. */
export interface ScriptLoc {
    line: number;
    column: number;
}
/**
 * The typed program plus the two things every downstream analysis needs: the
 * wrapped script's source file (to walk) and a mapper from raw scanner positions
 * back into the author's 1-based, prelude-stripped coordinates.
 */
export interface WorkflowProgram {
    program: ts.Program;
    scriptFile: ts.SourceFile;
    toScriptLoc(pos: number): ScriptLoc;
}
/**
 * {@link createWorkflowProgram} 的选项。`facadeDts` 允许注入一份**替代的 facade 文本**
 * （snippet eval 的 scratch facade）；它永远以
 * {@link FACADE_FILE_NAME} 为文件名进虚拟 host——facade 身份在 registry / sites /
 * facade-misuse / lowering 五处按声明文件名判定，换名字会让站点收集静默变空。
 */
export interface CreateWorkflowProgramOptions {
    facadeDts?: string;
}
/**
 * Build the typed program for a workflow script: the wrapped script + facade
 * `.d.ts` + embedded stdlib, compiled in the virtual host. This is the shared
 * substrate — diagnostics, schema synthesis and site-graph extraction all hang
 * off the one Program and checker built here.
 */
export declare function createWorkflowProgram(scriptText: string, options?: CreateWorkflowProgramOptions): WorkflowProgram;
/** Collect and script-position the program's syntactic + semantic diagnostics. */
export declare function collectDiagnostics(program: ts.Program): CompileDiagnostic[];
/**
 * Typecheck a workflow script against the facade in a fully virtual compiler host.
 * Scaffold scope: diagnostics only. Schema synthesis, site-graph extraction and
 * dependency inference build on the same Program in later steps.
 */
export declare function compileWorkflowScript(scriptText: string): CompileResult;
//# sourceMappingURL=compile.d.ts.map