/**
 * The dynamic-workflow facade: the entire model-facing API surface, shipped as an
 * embedded .d.ts asset (same pattern as SCRIPT_WORKFLOW_CHILD_SOURCE) so the compiler
 * works inside the bundled/SEA CLI where no node_modules exists on disk.
 *
 * One noun (the actor), one verb
 * (the task). Runtime shims are injected by the runtime layer, never imported.
 *
 * 段式组织：facade 拆成命名段常量，`FACADE_DTS`
 * 与 `SNIPPET_FACADE_DTS` 都由段**拼接**而成——单一事实源，子集绝不手抄。拼接结果对
 * 拆分前的 `FACADE_DTS` 逐字节不变。每段以
 * 单个换行开头结尾，段间拼接自然形成原有的空行分隔。
 */
export declare const FACADE_FILE_NAME = "workflow-facade.d.ts";
export declare const FACADE_DTS: string;
/**
 * snippet（EvalWorkflowSnippet）的 scratch facade：生产 facade 减去 actor 族 / report /
 * artifact / phase（channel / future 保留：流水线的纯逻辑正是片段要排练的东西）（docs/dynamic-workflow/authoring.md「The facade」，phase 见
 * docs/dynamic-workflow/authoring.md「Phases」，artifact 见 docs/dynamic-workflow/authoring.md「Artifacts: what the user keeps」）。留下的是脚本自己
 * 能单测的那部分：世界读取 + world.run +
 * 纯计算 + log。`agent(...)` 在这份 facade 下是普通的 TS2304（Cannot find name），拒绝发生
 * 在编译期而不是运行期。
 *
 * 注入编译器时必须仍以 {@link FACADE_FILE_NAME} 为文件名：facade 身份在五处按声明文件名
 * 判定（registry / sites / facade-misuse / lowering），换名字会让站点收集静默变空——
 * snippet 编译通过却什么都不做。
 */
export declare const SNIPPET_FACADE_DTS: string;
//# sourceMappingURL=dts.d.ts.map