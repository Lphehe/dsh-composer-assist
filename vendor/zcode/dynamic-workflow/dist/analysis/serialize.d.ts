import type { ActorGraph } from "./actor-graph.js";
import type { CausalityGraph, Lane } from "./causality-graph.js";
import type { ControlFlowGraph } from "./flow-graph.js";
import type { HandoffGraph } from "./handoff-graph.js";
import type { SiteGraph } from "./types.js";
/**
 * Canonical, deterministic text form of a site graph — the snapshot and debugging
 * surface. Grammar:
 *
 *   node source
 *   node ask#1 "scanner" @3:24 actors=actor#1 type="Flaky"
 *   node ask#2 "judge" @8:20 within=fan-out#1
 *   node sink
 *   actor actor#1 "planner" @5:17
 *   actor actor#2 "judge" @8:14 within=fan-out#1
 *   edge ask#1 -> ask#2 data exact type="Flaky"
 *   edge join#1 -> sink data inexact port=2 type="Review"
 *
 * Nodes come first (virtual `source` first, `sink` last, sites between in source
 * order); then actors in source order; then edges. `source`/`sink` carry no label
 * or location. `ask` nodes carry a trailing `actors=...` lane membership when
 * non-empty; any node or actor lexically inside a promoted fan-out carries a
 * trailing `within=fan-out#N` (after `actors=` when both are present); a producer
 * node/edge carries a trailing `type="<artifactType>"` last, when known (the type
 * string is quoted with embedded `"` escaped as `\"`, since a string-literal-union
 * artifact type can contain quotes, e.g. `ask<"yes" | "no">`). Edges are sorted by
 * (from position, to position, kind, port).
 */
export declare function serializeGraph(graph: SiteGraph): string;
/**
 * Canonical text form of the derived {@link ActorGraph} (its own snapshot surface,
 * a sibling of {@link serializeGraph}). Grammar:
 *
 *   actor-node main
 *   actor-node workspace
 *   actor-node actor#1 "planner" @17:17
 *   actor-node actor#2 "judge" @29:32 family=fan-out#1
 *   actor-edge main -> actor#1 exact count=1
 *   actor-edge actor#1 -> actor#2 inexact count=2 types="Plan","Review"
 *
 * Nodes come first in node order (already `main`, then `workspace` when present,
 * then actors in site order); edges follow, sorted by (from position, to position).
 * `main`/`workspace` carry no name or location; actor nodes carry a `"name"` when
 * known, always a location, and a trailing `family=fan-out#N` when they are a lane
 * family (their site sits inside a promoted fan-out). An actor edge carries a trailing
 * `types="A","B"` (each type individually quoted, embedded `"` escaped as `\"` — type
 * strings can contain quotes, e.g. `ask<"yes" | "no">`) when it carries message types.
 */
export declare function serializeActorGraph(graph: ActorGraph): string;
/**
 * Canonical text form of the {@link CausalityGraph} — its snapshot and debugging
 * surface, third sibling of {@link serializeGraph} / {@link serializeActorGraph}.
 * Grammar:
 *
 *   phase unphased
 *   phase phase#1 "preflight" @3:1
 *   lane workspace
 *   lane actor#2 "planner" @17:17
 *   lane actor#4 "judge" @29:32 families=fanout#1
 *   lane actor#1 name-head="研究员" @53:5 families=fanout#1
 *   region seq#1 seq
 *   region loop#1 loop parent=seq#1 @21:1 bound=5
 *   step ask#1 ask "scanner" @14:41 lane=actor#1 region=seq#1 always
 *   step ask#4 ask "judge" @29:47 lane=actor#4 region=fanout#1 maybe stack
 *   step ask#2~actor#1 ask "move" @12:40 lane=actor#1 lanes=actor#1,actor#2 source=ask#2 \
 *     phase=phase#2 region=loop#1 maybe serial
 *   edge ask#1 -> ask#2 seq always
 *   edge ask#3 -> ask#2 carry always
 *   phase-edge phase#1 -> phase#2 seq always
 *   sink ask#2,ask#4
 *
 * Sections are fixed: phases (when the script declares any marker at all — see below),
 * lanes (workspace first, then actors in creation order, `unknown`
 * last), regions in creation order, steps in source order, edges in the graph's
 * canonical order, the phase quotient's edges, then the sink line when the script returns
 * an artifact. `lanes=`
 * appears on a step whose receiver is a may-set and `source=` only on a may-set COPY (so
 * a step that did not expand serializes exactly as it did pre-expansion); `exact`/`inexact`
 * only on `data` edges, where the bit means something.
 *
 * The phase vocabulary — `phase` lines, the step's `phase=` field, `phase-edge` lines —
 * appears only when the script declares at least one `phase("…")` marker, and then all
 * three appear. A script with no markers serializes byte-for-byte as it did before phase
 * annotations existed; that is the regression nail the whole fixture corpus stands on.
 *
 * `name-head=`/`name-tail=` (lane) and `label-head=`/`label-tail=` (step) carry a
 * {@link NamePattern} — the static shape of a name the script interpolates. They sit in
 * the same slot as the quoted name they stand in for, and they carry the affixes as
 * **data**: the ellipsis that turns them into `研究员…` is a render-time decision, not
 * part of this form.
 */
export declare function serializeCausalityGraph(graph: CausalityGraph): string;
/**
 * Canonical text form of the control-flow graph,
 * fifth sibling of the serializers above:
 *
 *   phase phase#1 "preflight"
 *   phase phase#2 "review" alongside=phase#1
 *   phase hole#21b40fca "决定分组"
 *   hole hole#cd7e8315 "评判" type="Verdict" phase=phase#2 tail
 *   node ask#1@1 issue site=ask#1 phase=phase#2
 *   node phase#6@1 mark phase=phase#6 alongside=phase#1,phase#2
 *   node ask#9@1 issue site=ask#9 phase=unphased detached
 *   edge entry -> world-read#2@1 next
 *   edge world-read#4@1 -> ask#1@1 loop via=continue
 *   edge ask#3@1 -> abort throw
 *   phase-edge phase#3 -> phase#2 loop via=continue
 *
 * Nodes in leaf-stream order, edges in the graph's canonical order (`entry` first, the
 * terminals last). `phase` and `phase-edge` lines appear only when the script declares a
 * marker — the same all-or-nothing contract as the causality serializer's phase vocabulary.
 * `alongside` (a mark's, and its phase's union) names the phases whose strands were still
 * running when the marker was entered; it is a node fact, never an edge. `fill=` on a phase
 * names the filled hole whose body wrote it; a `hole` line is an OPEN hole with the phase it
 * stands in and `tail` when it is the script's open end (docs/analysis.md「Sites」).
 */
export declare function serializeControlFlow(flow: ControlFlowGraph): string;
/**
 * Canonical text form of the hand-off graph,
 * snapshotted as `<fixture>.handoff.txt`. Participants in the analyzer's order (which IS
 * the stack order), grouped under their phase; the lane's literal name is echoed for
 * readability only — `lanes` carries it in the payload.
 */
export declare function serializeHandoffGraph(graph: HandoffGraph, lanes: readonly Lane[]): string;
//# sourceMappingURL=serialize.d.ts.map