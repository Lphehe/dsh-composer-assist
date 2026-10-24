import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * Class modeling: one shared abstract instance per class, evaluated flow-insensitively.
 * Split out of the core evaluator (taint.ts) like calls.ts / literals.ts — same
 * `Evaluator` instance, free-function shape.
 * Field/static initializers and static blocks evaluate with `this` bound to the instance;
 * constructors, methods and accessors are tracked functions whose `this` resolves to it;
 * `new C(args)` applies the constructor and returns a reference to the shared instance;
 * `extends` weak-merges the base instance in. All instances of a class are conflated
 * (weak): a write through any instance, through `this`, or through the class name is
 * visible through every other.
 */
/** Evaluate every class body once per fixpoint pass (driven from Evaluator.iterate). */
export declare function evalClasses(ev: Evaluator): void;
/**
 * The class node an expression names (a class-name identifier, or a `this`/`super` that
 * resolves to one), or undefined for a non-class expression. `new C()`, `super(...)` and
 * every class-name read go through this so static and instance access conflate into the
 * one shared instance.
 */
export declare function resolveClassNode(ev: Evaluator, expr: ts.Expression): ts.Node | undefined;
/** The class node a symbol declares, following alias / field bindings to a class. */
export declare function classNodeOfSymbol(ev: Evaluator, sym: ts.Symbol, seen?: Set<ts.Symbol>): ts.Node | undefined;
/**
 * The constructor to apply for `new C(...)`: C's own constructor (with a body), else the
 * nearest inherited one up the `extends` chain (an implicit super forwards the arguments).
 * Overload signatures without a body are skipped. Cycle-guarded.
 */
export declare function classConstructor(ev: Evaluator, cls: ts.Node, seen?: Set<ts.Node>): ts.ConstructorDeclaration | undefined;
/** The shared instance of the class lexically enclosing `node`, or undefined. */
export declare function enclosingClassInstance(ev: Evaluator, node: ts.Node): AbstractValue | undefined;
/**
 * The shared instance of the BASE class of the class lexically enclosing `node` — the value
 * `super` denotes inside a derived method: `super.m()` dispatches to the base method summary
 * and `super.x` reads the base field. Only the innermost enclosing class's (resolvable) base
 * counts. Undefined outside a derived class or when the base is an unresolvable heritage.
 */
export declare function enclosingBaseInstance(ev: Evaluator, node: ts.Node): AbstractValue | undefined;
/** True iff a class has an `extends` clause whose base cannot be resolved to a class node (a
 * mixin CALL, `class D extends mix(Base)`). The inherited constructor is then unreachable, so
 * `new D(args)` must over-approximate the argument flow (see applyMixinConstructor). */
export declare function hasUnresolvedHeritage(ev: Evaluator, cls: ts.Node): boolean;
/** Apply the base-class constructor for a `super(args)` call inside a derived ctor. */
export declare function applySuperCall(ev: Evaluator, node: ts.CallExpression, ctx: EvalContext): void;
//# sourceMappingURL=classes.d.ts.map