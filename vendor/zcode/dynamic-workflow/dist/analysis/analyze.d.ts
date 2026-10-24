import type { CompileDiagnostic } from "../compiler/compile.js";
import { type DeclaredArtifact } from "./artifacts.js";
import { type ModelReference } from "./actor-models.js";
import { type CausalityGraph } from "./causality-graph.js";
import { type ControlFlowGraph } from "./flow-graph.js";
import { type HandoffGraph } from "./handoff-graph.js";
import type { AnalysisCore } from "./core.js";
import type { SiteGraph } from "./types.js";
/**
 * Result of analyzing a workflow script: the same diagnostics `compileWorkflowScript`
 * produces, plus the analysis core and its two projected views.
 *
 * `ok` means "submittable": any diagnostic clears it. The core and the graphs are present
 * whenever the script was analyzable at all, which is *almost* the same thing — the one
 * diagnostic that leaves them in place is {@link FANOUT_ACTOR_NAME_CODE} (a static actor
 * name inside a fan-out). That clause describes a **run-time** failure, not something that
 * stops the analysis: the shape is perfectly analyzable, and withholding the graph would
 * hide the picture exactly when the author needs it to see which fan-out to fix. So:
 * graphs present ⟸ ok, but not the converse.
 */
export interface AnalyzeResult {
    diagnostics: CompileDiagnostic[];
    ok: boolean;
    /**
     * The all-in-one analysis artifact: taint
     * facts + temporal trace, position-free. `graph` and `causality` are pure projections
     * of it — deriving them again later needs the core only, never the script.
     */
    core?: AnalysisCore;
    graph?: SiteGraph;
    /** The presentation-level happens-before view. */
    causality?: CausalityGraph;
    /** Where execution can go next, per occurrence and per phase. */
    flow?: ControlFlowGraph;
    /** Who takes part in each phase and who hands off to whom. */
    handoff?: HandoffGraph;
    /**
     * 脚本声明的**用户面产物**：`[{id, kind}]`，去重、按 id
     * 排序。与 world.run 的命令集同族的编译产物——运行前就能说出这个工作流会产出什么。
     * 与图不同，它在诊断非空时**照常给出**（它是从站点表直接读的事实，不依赖解释）。
     */
    declaredArtifacts: DeclaredArtifact[];
    /**
     * 脚本能交给子代理的每个模型名，每处出现一条（docs/dynamic-workflow/authoring.md「Choosing a
     * model per subagent」）。launch 工具在确认窗之前把它们对着宿主的模型目录解析
     * （docs/dynamic-workflow/launch.md「Models the script names」）。与 `declaredArtifacts` 同规：
     * 编译不过时是空数组，authoring 诊断在场时照常给出。
     */
    modelReferences: ModelReference[];
}
/**
 * Typecheck a workflow script and, when clean, interpret it. The pipeline is
 * createWorkflowProgram -> collectSites (the site-table substrate) -> interpret (the
 * fused taint-fixpoint + temporal walk, minting the {@link AnalysisCore}) ->
 * projectSiteGraph / projectCausalityGraph (pure projections of the core).
 *
 * Between the site table and the interpretation runs the facade-siting check
 * ({@link collectFacadeMisuse}): a facade callable that escapes into value space has
 * no site, so the graph cannot represent it. Its diagnostics are surfaced exactly like
 * typechecker diagnostics — `ok: false`, graphs withheld.
 */
export declare function analyzeWorkflowScript(scriptText: string): AnalyzeResult;
//# sourceMappingURL=analyze.d.ts.map