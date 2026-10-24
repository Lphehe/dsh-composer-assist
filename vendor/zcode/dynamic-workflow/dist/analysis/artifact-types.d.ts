import type { WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";
/**
 * Producer-side artifact types for data edges. Every data edge's `from` is a producer
 * site (ask / world-read / join / fan-out) with a statically known artifact type; this
 * module computes that type as a human-readable string, plus per-port types for joins
 * over a static array literal. Semantics is PROVENANCE: an edge means "a value computed
 * from A's output feeds B", so the label is A's artifact type — not a claim about the
 * concrete wire value.
 *
 * The type names come from the live checker's {@link ts.TypeChecker.typeToString} today;
 * schema synthesis will later upgrade these to synthesized-schema names.
 * Uninformative labels (`any`/`unknown`/`never`/`void`) are omitted so a meaningless
 * string is never drawn.
 */
/** Per-site artifact types and per-port join element types. */
export interface ArtifactTypes {
    /**
     * Whole-value artifact type per site, keyed by site id. Ask/world-read/join sites use
     * their final ids (`ask#1`); fan-out candidates are keyed by their PROVISIONAL id
     * (`fan-out@order`, see {@link provisionalFanoutId}) — the same key the taint pass
     * stamps into occurrences, so graph assembly looks them up before the `fan-out#N`
     * rename.
     */
    siteType: Map<string, string>;
    /**
     * Per-element awaited types of a join over a static array literal, keyed by join id.
     * Index i is the type of array element i (the join input at port i), or `undefined`
     * when that element's type is unknowable/uninformative. Absent for joins whose
     * argument is not a static array literal (no ports exist).
     */
    joinPortTypes: Map<string, (string | undefined)[]>;
}
/**
 * Compute artifact types for every producer site in the table. Pure over the checker and
 * the AST refs the site table already resolved.
 */
export declare function computeArtifactTypes(workflow: WorkflowProgram, table: SiteTable): ArtifactTypes;
//# sourceMappingURL=artifact-types.d.ts.map