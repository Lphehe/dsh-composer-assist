import ts from "typescript";
import {
  addPlaceholder,
  cloneValue,
  emptyValue,
  liveField,
  mergeInto,
  peelPlace,
  staticIndexKey,
  type AbstractValue,
} from "./domain.js";
import { applyConstructor } from "./promise-ops.js";
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
export function evalClasses(ev: Evaluator): void {
  const ctx: EvalContext = { onReturn: () => {}, regionStack: ["top"] };
  for (const cls of ev.s.classes) evalClassBody(ev, cls as ts.ClassLikeDeclaration, ctx);
}

function evalClassBody(ev: Evaluator, cls: ts.ClassLikeDeclaration, ctx: EvalContext): void {
  const instance = ev.s.instanceOf(cls);
  // `extends`: cheap sound approximation — weak-merge the base class's shared instance
  // into the derived one each pass, so inherited fields carry taint and inherited
  // methods/accessors dispatch through the derived instance. Deliberately conflates the
  // two class instances (weak); per-instance/per-class precision is out of scope.
  for (const clause of cls.heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const type of clause.types) {
      const base = resolveClassNode(ev, type.expression);
      if (base !== undefined && mergeInto(instance, ev.s.instanceOf(base))) ev.s.changed = true;
    }
  }
  for (const member of cls.members) {
    if (ts.isPropertyDeclaration(member)) {
      const key = staticMemberKey(ev, member.name);
      if (key === undefined || member.initializer === undefined) continue;
      // Field/static initializer: `this` in the initializer resolves to the instance
      // (ThisExpression parent-walks to this class). Weak-merge its value into the field.
      mergeInstanceField(ev, instance, key, ev.evalExpr(member.initializer, ctx));
    } else if (ts.isClassStaticBlockDeclaration(member)) {
      for (const stmt of member.body.statements) ev.visit(stmt, ctx);
    } else if (ts.isMethodDeclaration(member)) {
      // A method is a function-valued field, callable through it (`inst.run(x)`). A computed
      // name that is a static string/number literal (`["run"]`) registers under that name;
      // a genuinely-dynamic name registers in the instance's top-level fns (see registerMember).
      registerMember(ev, instance, staticMemberKey(ev, member.name), member);
    } else if (ts.isGetAccessorDeclaration(member)) {
      // Getter: the field's read value IS the getter's return summary (re-read each pass;
      // the fixpoint converges), mirroring object-literal getters in literals.ts.
      const id = ev.s.fnId.get(member);
      if (id === undefined) continue;
      const key = staticMemberKey(ev, member.name);
      const summary = cloneValue(ev.s.summaryOf(id));
      // A genuinely-dynamic getter name can only be read through a dynamic-key access, which
      // collapses the instance — smear its value (inexact) into the container so a `w[k]` read
      // still surfaces it (a sound over-approximation, never a drop).
      if (key === undefined) mergeInstanceField(ev, instance, undefined, summary);
      else mergeInstanceField(ev, instance, key, summary);
    } else if (ts.isConstructorDeclaration(member)) {
      applyParameterProperties(ev, instance, member);
    }
    // SetAccessorDeclaration: writes are handled globally by settersByProp (collected in
    // TaintState). ConstructorDeclaration body: applied at `new C(...)` / `super(...)`.
  }
}

/**
 * The static field key a class member is registered / dispatched under: the member name for a
 * plain name, or the static string/number literal of a computed name (`["run"]`). Returns
 * undefined for a genuinely-dynamic computed name (`[expr]`) — such a member cannot be
 * dispatched by name, so it degrades to the sound catch-all (top-level fns / container smear).
 */
function staticMemberKey(ev: Evaluator, name: ts.PropertyName): string | undefined {
  if (ts.isComputedPropertyName(name)) return staticIndexKey(name.expression);
  return name.getText(ev.s.scriptFile);
}

/**
 * Synthesize the implicit `this.x = x` a TS parameter property performs: a constructor
 * parameter carrying an accessibility / `readonly` modifier declares AND initializes an
 * instance field from the argument. Model it by merging the ctor's param placeholder into
 * the named instance field (resolved to the `new`'s actual at emission). Parameter
 * properties are Parameters, not PropertyDeclarations; their implicit field writes are not
 * explicit statements in the constructor body and must be modeled here.
 */
function applyParameterProperties(ev: Evaluator, instance: AbstractValue, ctor: ts.ConstructorDeclaration): void {
  const id = ev.s.fnId.get(ctor);
  if (id === undefined) return;
  ctor.parameters.forEach((param, index) => {
    if (!ts.isParameterPropertyDeclaration(param, ctor) || !ts.isIdentifier(param.name)) return;
    const val = emptyValue();
    addPlaceholder(val, { fnId: id, param: index });
    mergeInstanceField(ev, instance, param.name.text, val);
  });
}

function mergeInstanceField(ev: Evaluator, instance: AbstractValue, key: string | undefined, value: AbstractValue): void {
  // A dynamic (undefined) key smears into the container itself (collapse surfaces it).
  const field = key === undefined ? instance : liveField(instance, key);
  if (field !== value && mergeInto(field, value)) ev.s.changed = true;
}

function registerMember(ev: Evaluator, instance: AbstractValue, key: string | undefined, fn: ts.Node): void {
  // A static-named method lives in a named field (`inst.run` dispatches via readField); a
  // dynamically-named one lives in the instance's TOP-LEVEL fns, reachable only through the
  // collapse a dynamic-key call (`inst[k]()`) performs — never picked up by a named field read,
  // so it adds no false static-name dispatch while keeping the callee sound (never dropped).
  const target = key === undefined ? instance : liveField(instance, key);
  if (!target.fns.has(fn)) {
    target.fns.add(fn);
    ev.s.changed = true;
  }
}

/**
 * The class node an expression names (a class-name identifier, or a `this`/`super` that
 * resolves to one), or undefined for a non-class expression. `new C()`, `super(...)` and
 * every class-name read go through this so static and instance access conflate into the
 * one shared instance.
 */
export function resolveClassNode(ev: Evaluator, expr: ts.Expression): ts.Node | undefined {
  const sym = ev.checker.getSymbolAtLocation(expr);
  return sym === undefined ? undefined : classNodeOfSymbol(ev, sym);
}

/** The class node a symbol declares, following alias / field bindings to a class. */
export function classNodeOfSymbol(ev: Evaluator, sym: ts.Symbol, seen = new Set<ts.Symbol>()): ts.Node | undefined {
  if (seen.has(sym)) return undefined;
  seen.add(sym);
  for (const decl of sym.declarations ?? []) {
    if ((ts.isClassDeclaration(decl) || ts.isClassExpression(decl)) && ev.s.classInstances.has(decl)) return decl;
    // A class bound through a variable alias (`const Alias = Cfg`) or stored in an
    // object-literal field (`{ C: class {} }`): resolve the initializer to the class node so
    // `new Alias(...)` / `new box.C()` applies the constructor and returns that class's shared
    // instance. Otherwise only the class's own symbol and a directly class-expression-initialized
    // variable would be recognized, and an alias / field binding would escape to emptyValue.
    const init = ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl) ? decl.initializer : undefined;
    if (init !== undefined) {
      const via = classNodeFromExpr(ev, init, seen);
      if (via !== undefined) return via;
    }
  }
  return undefined;
}

/** The class node an initializer expression denotes: a class expression, or an identifier /
 * property access aliasing another class binding (cycle-guarded through `seen`). */
function classNodeFromExpr(ev: Evaluator, expr: ts.Expression, seen: Set<ts.Symbol>): ts.Node | undefined {
  const e = peelPlace(expr);
  if (ts.isClassExpression(e) && ev.s.classInstances.has(e)) return e;
  if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
    const sym = ev.checker.getSymbolAtLocation(e);
    if (sym !== undefined) return classNodeOfSymbol(ev, sym, seen);
  }
  return undefined;
}

/**
 * The constructor to apply for `new C(...)`: C's own constructor (with a body), else the
 * nearest inherited one up the `extends` chain (an implicit super forwards the arguments).
 * Overload signatures without a body are skipped. Cycle-guarded.
 */
export function classConstructor(
  ev: Evaluator,
  cls: ts.Node,
  seen = new Set<ts.Node>(),
): ts.ConstructorDeclaration | undefined {
  if (seen.has(cls)) return undefined;
  seen.add(cls);
  for (const member of (cls as ts.ClassLikeDeclaration).members) {
    if (ts.isConstructorDeclaration(member) && member.body !== undefined) return member;
  }
  for (const clause of (cls as ts.ClassLikeDeclaration).heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const type of clause.types) {
      const base = resolveClassNode(ev, type.expression);
      if (base !== undefined) {
        const inherited = classConstructor(ev, base, seen);
        if (inherited !== undefined) return inherited;
      }
    }
  }
  return undefined;
}

/** The shared instance of the class lexically enclosing `node`, or undefined. */
export function enclosingClassInstance(ev: Evaluator, node: ts.Node): AbstractValue | undefined {
  for (let cur = node.parent; cur !== undefined; cur = cur.parent) {
    if (ts.isClassLike(cur)) return ev.s.instanceOf(cur);
  }
  return undefined;
}

/**
 * The shared instance of the BASE class of the class lexically enclosing `node` — the value
 * `super` denotes inside a derived method: `super.m()` dispatches to the base method summary
 * and `super.x` reads the base field. Only the innermost enclosing class's (resolvable) base
 * counts. Undefined outside a derived class or when the base is an unresolvable heritage.
 */
export function enclosingBaseInstance(ev: Evaluator, node: ts.Node): AbstractValue | undefined {
  for (let cur = node.parent; cur !== undefined; cur = cur.parent) {
    if (!ts.isClassLike(cur)) continue;
    for (const clause of cur.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      for (const type of clause.types) {
        const base = resolveClassNode(ev, type.expression);
        if (base !== undefined) return ev.s.instanceOf(base);
      }
    }
    return undefined; // innermost enclosing class only
  }
  return undefined;
}

/** True iff a class has an `extends` clause whose base cannot be resolved to a class node (a
 * mixin CALL, `class D extends mix(Base)`). The inherited constructor is then unreachable, so
 * `new D(args)` must over-approximate the argument flow (see applyMixinConstructor). */
export function hasUnresolvedHeritage(ev: Evaluator, cls: ts.Node): boolean {
  for (const clause of (cls as ts.ClassLikeDeclaration).heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const type of clause.types) {
      if (resolveClassNode(ev, type.expression) === undefined) return true;
    }
  }
  return false;
}

/** Apply the base-class constructor for a `super(args)` call inside a derived ctor. */
export function applySuperCall(ev: Evaluator, node: ts.CallExpression, ctx: EvalContext): void {
  for (let cur = node.parent; cur !== undefined; cur = cur.parent) {
    if (!ts.isClassLike(cur)) continue;
    for (const clause of cur.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      for (const type of clause.types) {
        const base = resolveClassNode(ev, type.expression);
        const ctor = base === undefined ? undefined : classConstructor(ev, base);
        const id = ctor === undefined ? undefined : ev.s.fnId.get(ctor);
        if (id !== undefined) {
          const argVals = node.arguments.map((arg) => ev.evalExpr(arg, ctx));
          const argPlaces = node.arguments.map((arg) => ev.resolvePlace(arg));
          applyConstructor(ev, id, ctx, argVals, argPlaces, node);
        }
      }
    }
    return; // only the innermost enclosing class's base is the super target
  }
}
