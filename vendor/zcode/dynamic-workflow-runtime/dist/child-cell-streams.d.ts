/**
 * cell 的第二段引导脚本：流水线原语 channel / future 与停滞检测
 * （docs/dynamic-workflow/authoring.md「Streams」、execution-engine.md「The vm cell」）。
 *
 * 为什么独立成模块：child-source.ts 的 childMain 受自包含约束（`toString()` 内嵌进入口文件，
 * 不得引用模块作用域绑定），所以这段文本不能作为它的模块级常量；留在 BOOTSTRAP 里又会顶穿单文件
 * 行数上限。于是 {@link renderChildEntry} 把它像 payload 一样以字面量内嵌进入口文件，`start`
 * 经 deps 递给 childMain，childMain 在 BOOTSTRAP 之后于**同一个 context** 内运行它。
 *
 * 契约（与 BOOTSTRAP 的接缝）：只依赖 BOOTSTRAP 用 `var`/function 建下的四个 context 全局——
 * `__pending`（在飞请求表）、`__settled`（是否已发 complete）、`__complete(ok, payload)`、
 * `globalThis.__host`；产出三样——`__host.channel`、`__host.future`、`globalThis.__checkStalled`。
 * 纯 JS、无 backtick / ${}（以便安全内嵌），与 BOOTSTRAP 同规。
 *
 * 确定性：channel 的每次投递都是 host 结算顺序（引擎回放它）的确定性后果，所以不落 journal、
 * 不过线。性能：两条队列都以「数组 + 头下标」读，send / next 均 O(1)，消耗掉的前缀长过活着的
 * 部分时压缩一次。
 */
export declare const CELL_STREAMS_BOOTSTRAP: string;
//# sourceMappingURL=child-cell-streams.d.ts.map