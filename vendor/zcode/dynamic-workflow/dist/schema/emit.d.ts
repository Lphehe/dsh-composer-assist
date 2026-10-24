import ts from "typescript";
import type { JsonSchema } from "./types.js";
/**
 * 类型 → JSON Schema 的发射器（emitter），由 checker 的结构化视图驱动（泛型/别名/
 * mapped/conditional 都已被 checker 展平）。
 *
 * 递归类型通过 `$defs`/`$ref` 表达：只有真正被自身（在合成栈上）再次引用到的类型才会
 * 被提升为 def，非递归的具名类型仍就地内联，保证快照可读。识别办法是给每个复合类型
 * 压一个栈帧，若发射其子树时再次进入同一 `ts.Type`，就把它标记为 requested 并返回
 * `$ref`；栈帧结束时若被 requested 过，则登记进 defs。
 *
 * 不可 JSON 序列化的类型以 {@link SchemaRejection} 抛出，由合成侧转成定位到 ask 站点的
 * 诊断（复用分析管线的诊断形状/UX）。
 */
/** 发射失败：携带原因与出错的 JSON 路径，供合成侧组装成定位诊断。 */
export declare class SchemaRejection extends Error {
    readonly reason: string;
    readonly path: string;
    constructor(reason: string, path: string);
}
export declare class SchemaEmitter {
    private readonly checker;
    private readonly location;
    private readonly defs;
    private readonly inProgress;
    private readonly defName;
    private readonly usedNames;
    constructor(checker: ts.TypeChecker, location: ts.Node);
    /** 发射顶层类型；若过程中产生了 def，则把 `$defs` 挂到根 schema 上。 */
    emitTop(type: ts.Type): JsonSchema;
    private emit;
    /** 复合类型的栈帧包装：发射期间若被自身再次引用则提升为 def 并返回 `$ref`。 */
    private composite;
    /** 为一个类型分配稳定且唯一的 def 名（源自别名/符号名），惰性且去重。 */
    private nameFor;
    private booleanValue;
    private emitUnion;
    /** 一组成员类型 → enum（全为字面量时）或 anyOf。也被可选属性的去 undefined 路径复用。 */
    emitMembers(members: readonly ts.Type[], path: string): JsonSchema;
    /** 若所有成员都是字面量（string/number/boolean 字面量或 null），返回其取值数组。 */
    private asLiterals;
    /** 交叉类型：合并为一个 object（checker 已把成员属性合并到交叉类型上）。含原始类型成员
     *  的品牌类型（如 `string & {__brand}`）按其原始类型发射。 */
    private emitIntersection;
    private emitObjectLike;
    private emitObject;
    /** 可选属性：从属性类型里剥掉 undefined 后再发射（可选性由 required 表达，不进类型）。 */
    private emitOptional;
    private emitArray;
    private emitTuple;
    private isArrayType;
    private isTupleType;
    private isThenable;
}
//# sourceMappingURL=emit.d.ts.map