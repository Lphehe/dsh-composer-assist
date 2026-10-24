import ts from "typescript";
/**
 * fan-out 的**字面量基数**：
 * 被迭代的表达式是无展开元素的数组字面量，或一个只初始化一次、从未被写入的 `const`
 * 绑定到这样的字面量时，基数 = 字面量长度；其余一律 `undefined`。
 *
 * 这是**铸造期**（interpret.ts）的工作——它要看 AST 与 checker，而投影不许再看代码。
 * 原则是宁缺毋滥：任何不确定都给缺席，交接图随之画一张 `many` 卡，绝不猜一个数。
 */
export declare function literalCardinality(iterated: ts.Expression, checker: ts.TypeChecker): number | undefined;
//# sourceMappingURL=fanout-cardinality.d.ts.map