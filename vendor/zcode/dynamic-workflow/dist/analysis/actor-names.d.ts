/**
 * 具名 actor 重名的编译期 courtesy 诊断。
 *
 * 规则本身是**运行期**的：引擎在 createActor 查非空有效名的重复，撞上即 run 级失败
 * （`DuplicateActorName`）。理由是具名 actor 是修订续跑（amend-resume）缓存导入的身份键，
 * 而任何 run 都是未来修订的潜在前驱——前驱里重名会让导入匹配歧义。
 *
 * 这里做**字面量能看穿的那一半**，两条子句：
 *
 * 1. **两处同名**：两个 `agent(...)` 站点的有效名是同一个字符串字面量时，在后一处报一条可
 *    定位的诊断，让作者在便宜的那一侧改名，而不是跑到一半失败。任何动态成分
 *    （`` `worker-${i}` ``、标识符、展开、shorthand 属性）一律跳过——那些只有运行期能查。
 * 2. **fan-out 里的静态名**：一个 `agent("x")` 站点跑在 fan-out 体内时，每个元素都建一个新
 *    actor 而它们共用同一个名字——一个站点，N 次重名，运行期必然大声失败。
 *
 * 子句 1 **只会漏报、不会误报**：跳过一个可能重名的站点没有代价（引擎兜底），而误伤一个
 * 合法脚本会挡住提交。
 *
 * `.map` 的集合可能只有 ≤1 个
 * 元素，那样的脚本在运行期其实合法，所以这条子句理论上会误报。接受它的理由是代价不对称——
 * 修复是免费的（改成逐元素名 `` `x-${item}` `` 或匿名），而不报的代价是模型烧掉一整个 run
 * 才学到这条规则。`paths.map((p) => agent("reviewer").ask(…))` 正是 fan-out 的教科书写法，
 * 沉默地留给运行期是最坏的一档。
 *
 * fan-out 的判定**复用站点表的分类**（`analysis/sites.ts` 的 `IterationCandidate`：带内联
 * 回调的数组方法 + `for...of`），不自己再造一套循环识别。代价是普通 `for` / `while` /
 * `do` 循环不在那张分类里，因而不被本子句覆盖——它们回落到子句 1 的老姿态（看不见，归运行期）。
 * 那正是漏报方向，与本模块的保守取向一致。
 *
 * `CreateWorkflow` 与
 * `SaveWorkflow` 两个 handler 都先走 `analyzeScript`（本诊断在 `analyzeWorkflowScript` 的
 * authoring 批次里），`!ok` 即带诊断早返回、**不 submit / 不落盘**，所以一条 9005/9006 确实
 * 挡住提交与保存。但 run service 的 `compileOnce`（submit 与 resume 的重编译）只复验
 * typecheck / schema / world.run 字面量三项，**不含**本诊断——所以它不是 submit 路径上的
 * 强制门，别把它当承重结构：具名唯一性的权威始终是引擎 createActor 的运行期查重。
 */
import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";
/** 两处字面量同名（子句 1）。9001 = facade-siting、9002 = schema、9003 = world-run、9004 = phase。 */
export declare const DUPLICATE_ACTOR_NAME_CODE = 9005;
/**
 * fan-out 体内的静态名（子句 2），单独一个码而不是复用 9005。
 *
 * 两条子句是同一条规则，但**确定性不同**：9005 只在静态确定重名时出现，9006 是上面那条刻意
 * 接受误报的子句。读端因此需要能区分它们——特别是分析侧的 fixture 语料：
 * 那些脚本从不执行，只用来钉图形状，其中静态名 + fan-out 的组合恰恰是**分析器必须正确处理**
 * 的形状（`ActorNode.family`、actor 标签），所以语料要豁免 9006 而对 9005 保持严格。
 * 共用一个码就只能靠匹配 message 文本来区分，而按错误文本分流正是本仓库处处禁止的。
 */
export declare const FANOUT_ACTOR_NAME_CODE = 9006;
/**
 * 收集字面量重名诊断。非空即脚本不可提交（`analyzeWorkflowScript` 与 world.run / phase
 * 的编译期规则同席）。
 */
export declare function collectDuplicateActorNames(workflow: WorkflowProgram, table: SiteTable): CompileDiagnostic[];
//# sourceMappingURL=actor-names.d.ts.map