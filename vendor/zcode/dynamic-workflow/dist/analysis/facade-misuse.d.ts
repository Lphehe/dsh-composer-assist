import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import { type SiteTable } from "./sites.js";
/**
 * The facade-siting diagnostic. Kept in its own module,
 * a sibling of the site-table substrate: this is an
 * analysis diagnostic, not part of the shared table, and it walks the body in a
 * different shape (every reference / conversion, not just call sites).
 */
/**
 * Package-local diagnostic code for the facade-siting rule. Not a TS diagnostic code
 * (those come from the checker); this marks an analysis diagnostic produced by
 * {@link collectFacadeMisuse}. Kept out of the TS code space to stay unambiguous.
 */
export declare const FACADE_SITING_CODE = 9001;
/**
 * The facade-siting diagnostic: facade callables are second-class — `agent`, `Agent.ask`,
 * `files.glob`/`files.read`, `artifact.file`/`artifact.chart`, and `log` may appear only as the
 * callee of a direct call. Any other reference (aliasing `const spawn = agent`, method
 * extraction `const f = planner.ask`, `.bind`/`.call`/`.apply` receivers, passing a
 * facade function as an argument) destroys site identity: journal keys, replay, and
 * the GUI all key off static site ids, and a facade call reachable only through an
 * escaped function value has no site. Widening cannot represent it and silently
 * dropping it would be unsound, so it is rejected at compile time.
 *
 * Three passes over the workflow body:
 *
 *   1. Reference scan — every identifier / property-access whose checker-resolved
 *      symbol is a facade callable, in any position other than the callee of a direct
 *      call; PLUS every destructuring binding/assignment that extracts a facade
 *      callable off its containing object (see {@link flagExtractedMember}).
 *   2. Defense in depth — any direct CallExpression whose callee resolves to a
 *      site-producing facade callable but that never registered as a site (catches
 *      escape forms the reference scan misses).
 *   3. Retyping boundary — any conversion of a value that carries a site-producing
 *      facade member (`Agent.ask`, `files.glob`/`read`) to a type that does NOT (a
 *      structurally-compatible local interface, `any`, `unknown`). TypeScript resolves
 *      members by *declared type*, so `const d = planner as Askable; d.ask(...)` or
 *      `function run(a: Askable) { a.ask(...) }; run(planner)` makes `.ask` resolve to
 *      the local declaration — pass 1 sees a non-facade symbol, pass 2's resolved
 *      signature points at the local interface: no site, no diagnostic, and the real
 *      facade call runs unsited. Enforced at the conversion boundary
 *      (`as`/`satisfies`, argument→parameter, return, annotated binding) rather than by
 *      tracking value provenance through the cast (see {@link facadeSiteMember}).
 *
 * Destructuring extraction: `const { ask } = planner`, `const { read }
 * = files`, renamed `{ ask: f }`, nested `{ p: { ask } }`, parameter `function f({ ask }:
 * Agent)`, and assignment `({ ask } = planner)` are all method extraction — the destructured
 * twin of the already-rejected `const f = planner.ask`. A shorthand binding identifier
 * resolves to the freshly-declared LOCAL (not the facade method), so the identifier scan is
 * blind; and routing the value through a script-locally-typed helper hides the eventual call
 * from Pass 2's signature check too. Both holes close by flagging at the EXTRACTION site
 * (see {@link scanRefs}): resolve the source property on the destructured value's type and
 * reject a facade callable.
 */
export declare function collectFacadeMisuse(workflow: WorkflowProgram, table: SiteTable): CompileDiagnostic[];
//# sourceMappingURL=facade-misuse.d.ts.map