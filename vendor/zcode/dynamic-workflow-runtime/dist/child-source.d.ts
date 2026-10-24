/**
 * 沙箱子进程逻辑。**一份实现，一份入口文件，两种启动方式**：
 *   - {@link renderChildEntry} 把 {@link childMain} 经 `toString()` 与 payload 一起渲染成一份
 *     自包含 ESM，harness 写到 `<cwd>/.zcode/workflow-runs/<runId>.mjs`（child-entry-file.ts）；
 *   - 普通 Node：`node --max-old-space-size=N <entry>`，入口文件发现自己就是进程入口时自启；
 *   - SEA 单文件二进制：CLI 的隐藏子命令 `__zcode-dwf-child <entry>` `import()` 这份文件并调
 *     它导出的 `start(deps)`，注入 CLI 进程的 vm/readline/stdio（SEA 主程序不解释 Node CLI
 *     旗标，`--eval` 路不通）。
 *
 * Windows 的命令行上限是 32,767 字符，
 * `--eval CHILD_SOURCE -- <base64url payload>` 会把整份 lowered 脚本放在命令行上，脚本
 * 一过约 18 KB 就 `spawn ENAMETOOLONG`，Windows 上每个稍长的 run 都起不来。
 *
 * 结构：
 *   - 外层 realm（{@link childMain} 自身）是普通 Node 代码：持有 stdio、readline、vm，负责传输。
 *   - 求值单元是 `vm.createContext(...)` 建的**独立 realm**：只含 ES intrinsics + 注入的 `__host`。
 *     裸 vm context 天然没有 `process`/`require`/`Buffer`/`fetch`，也没有定时器；我们只补 `__host`
 *     与运行期禁令。channel / future 与停滞检测（docs/dynamic-workflow/authoring.md「Streams」）
 *     都在 cell 内实现：前者是纯 promise 机制，后者正是靠「cell 内没有别的唤醒源」成立。
 *
 * 跨 realm 收敛（防原型泄漏 / prototype pollution）：脚本触及的一切（Promise、JSON 解析出的
 * host 结果、Error）都在 **context 内**构造；外层与 context 间仅有两种跨界值——一个 `__send(string)`
 * 外层函数，以及入站的行字符串（字符串是原始值，无 realm 归属）。故 `Array.isArray`/`instanceof`/
 * 原型链在脚本视角下全是 context-native，绝不掺入外层 realm 的 intrinsics。
 *
 * 动态 import：runFn 经 `vm.runInContext`（Script，未提供 importModuleDynamically 回调）编译，
 * 运行期 `import()` 抛 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`。`eval`/`Function` 绑定同一套
 * context 全局。
 *
 * ⚠ 本文件是 protocol.ts 线协议的**手写镜像**：入口文件里的 childMain 以内嵌字符串运行，无法 import
 * protocol.ts。改任一处必须同步另一处。故 {@link childMain} 只允许 import **类型**（编译期擦除），
 * 绝不引入运行期 package 依赖；本模块唯一的值 import（child-cell-streams.ts 的引导字符串）只被
 * {@link renderChildEntry} 读取并内嵌进入口文件，childMain 自身通过 deps 拿到它。
 */
import type { ChildPayload } from "./protocol.js";
/** {@link childMain} 用到的 `node:vm` 全部表面（窄到只有两个函数——这就是子进程的 vm 契约）。 */
export interface ChildVmModule {
    createContext(sandbox: object, options?: {
        name?: string;
    }): object;
    runInContext(code: string, sandbox: object, options?: {
        filename?: string;
    }): unknown;
}
/** {@link childMain} 用到的 `readline.Interface` 表面。 */
export interface ChildReadlineInterface {
    on(event: "line", listener: (line: string) => void): unknown;
    close(): void;
}
/**
 * 注入给 {@link childMain} 的宿主能力。**两种启动方式各自提供真实实现**：入口文件自启时从
 * `node:vm` / `node:readline` / `process` 现取，SEA 子命令从 CLI 进程现取。
 */
export interface ChildMainDeps {
    vm: ChildVmModule;
    createInterface(options: {
        input: NodeJS.ReadableStream;
    }): ChildReadlineInterface;
    /** 入站 response 的来源（父进程 stdin 管道）。持有它也让事件循环保持存活。 */
    stdin: NodeJS.ReadableStream;
    /** 出站 NDJSON 的去处；{@link childMain} 自己补换行。 */
    stdout: {
        write(chunk: string): unknown;
    };
    /**
     * 本次 run 的 payload（{@link import("./protocol.js").ChildPayload}）。入口文件把它当 JSON
     * 字面量内嵌并原样递进来——不再经 argv、不再 base64。
     */
    payload: ChildPayload;
    /**
     * cell 的第二段引导脚本：channel / future 与停滞检测（child-cell-streams.ts 的
     * {@link import("./child-cell-streams.js").CELL_STREAMS_BOOTSTRAP}）。与 payload 同路——
     * 入口文件把它当字符串字面量内嵌、`start` 原样递进来——因为 childMain 的自包含约束不许它
     * 引用模块作用域的绑定，而把它留在本文件里会顶穿单文件行数上限。它在 BOOTSTRAP 之后、
     * lowered 体之前于同一 context 内运行，读写 BOOTSTRAP 用 `var` 建下的 context 全局。
     */
    streamsBootstrap: string;
}
/**
 * 沙箱子进程的**唯一**出口。返回的 promise 在脚本执行终结（complete 已发出、stdin 已关）后兑现。
 *
 * 为什么必须可 await：SEA 子命令跑在 CLI 进程里，而 CLI 入口在 `run()` 返回后会挂一个 1s
 * 退出 watchdog（shutdown.ts 的 `scheduleCliExitWatchdog`）。若子进程逻辑只是"装好 readline
 * 就同步返回"，watchdog 会在 run 刚起步时把整个子进程强退。入口文件自启时不需要这个 promise
 * （事件循环空了自然退出），但两条入口共用一个实现，所以由 childMain 统一给出终结信号。
 *
 * ⚠ 自包含约束（载荷性，不是风格）。{@link renderChildEntry} 靠 `childMain.toString()` 把本函数
 * 当**源码**内嵌，所以函数体必须是一段能独立成立的程序，两条规矩：
 *   1. 只引用参数、语言 intrinsics 与 `Buffer` 这类 Node 全局，**绝不引用模块作用域的任何绑定**
 *      （常量、辅助函数、import）。沙箱 bootstrap 也因此内联在函数体里，而不是模块级常量。
 *   2. **内层函数一律不许有名字**——理由和踩过的坑见函数体里那段注释（esbuild 的
 *      `minify + keepNames` 会给它们套上模块作用域的 `__name` helper）。
 * 两条约束都需要在真实打包/压缩形态下验证，光靠源码测试抓不到这类回归。
 */
export declare function childMain(deps: ChildMainDeps): Promise<void>;
/**
 * 渲染沙箱入口文件：一份自包含 ESM，harness 把它写到磁盘后以 `node <entry>` 启动。
 *
 * 内容：payload 作为 JSON 字面量（`JSON.stringify` 的输出就是合法的 JS 表达式）、经 `toString()`
 * 内嵌的 {@link childMain}、导出的 `start(deps)`，以及两段顶层逻辑：
 *   - 堆上限 best-effort：缺省路径由真旗标 `--max-old-space-size` 生效；SEA 自 re-exec 传不了
 *     旗标，`execArgv` 里没有它时才 `v8.setFlagsFromString`（效果不保证，与原子命令侧同款）；
 *   - 自启判定：`realpath(argv[1])` 与本文件同一路径时（`node <entry>`）以 process 的
 *     vm/readline/stdio 自启；被 SEA 子命令 `import()` 时判定为假，由子命令调 `start`。
 *     比较 realpath 而不是裸路径：macOS 的 tmpdir 经 `/var → /private/var` 符号链接，
 *     `import.meta.url` 是解析后的真实路径，裸比较会让子进程静默不启动。
 *
 * 唯一的插值是 childMain 的源文本与 payload JSON。childMain 自己带着模板字面量不成问题——插值是
 * **运行期的字符串拼接**，嵌进来的文本不会被再解析一次；真正的风险在 childMain 的自包含约束
 * 那一侧（见其注释）。生成的顶层代码刻意不用模板字面量，免得与外层的 `${}` 打架。
 */
export declare function renderChildEntry(payload: ChildPayload, meta: {
    runId: string;
}): string;
//# sourceMappingURL=child-source.d.ts.map