/**
 * Site-id vocabulary: is this label an actor site? (Actor labels never make data edges.)
 *
 * 修复原因：留白函数体里的站点带留白 id 的前缀（`hole#21b40fca/actor#1`，docs/analysis.md「Sites」），
 * 原先的 `startsWith("actor#")` 认不出它们，于是补全体内的 ask 全部解析不到 receiver、落到
 * `unknown` 车道。按**最后一段**判种类。
 */
export function isActorSite(site) {
    return /(^|\/)actor#/.test(site);
}
/** Quote a string field: embedded `"` escaped as `\"` (same rule as serialize.ts). */
function quote(text) {
    return `"${text.replace(/"/g, '\\"')}"`;
}
function renderPattern(pattern) {
    if (pattern === undefined)
        return "";
    let out = "";
    if (pattern.head !== undefined)
        out += ` head=${quote(pattern.head)}`;
    if (pattern.tail !== undefined)
        out += ` tail=${quote(pattern.tail)}`;
    return out;
}
function at(loc) {
    return `@${loc.line}:${loc.column}`;
}
/**
 * Canonical, deterministic text form of the core — its golden and debugging surface,
 * fourth sibling of the three graph serializers. Grammar, by fixed section order:
 *
 *   ask ask#1 "scanner" @3:24 order=1 within=fan-out#1 type="Flaky"
 *   world-read world-read#1 "glob src" @1:20 order=0
 *   join join#1 "join" @4:9 order=3 ports="A",-,"B"
 *   actor actor#1 "planner" @2:17 order=2
 *   fan-out fan-out#1 "fan-out" @5:11 order=4 type="Review[]"
 *   hole hole#1 "决定分组" @7:14 order=5 type="Plan" tail
 *   fact ask-data ask#2 <- ask#1 exact
 *   fact ask-actor ask#2 <- actor#1 exact
 *   fact world-read-data world-read#2 <- ask#1 inexact
 *   fact join-in join#1 <- ask#1 exact port=0
 *   fact fan-out-in fan-out#1 <- ask#1 exact
 *   fact hole-data hole#1 <- ask#1 exact
 *   fact return <- ask#2 exact
 *   region seq#1 seq entered
 *   region loop#1 loop parent=seq#1 @3:1 bound=3 label="helper"
 *   region choice#1 choice parent=loop#1 @5:3 entered exhaustive
 *   region choice#2 choice parent=seq#1 @9:1 entered fallthrough
 *   region branch#1 branch parent=choice#1 @5:12
 *   region branch#4 branch parent=seq#1 @20:1 label="onDone" detached
 *   region call#1 call parent=seq#1 @7:15 entered label="helper"
 *   region fanout#1 fanout parent=seq#1 @9:15 label="map" strand
 *   region try#1 try parent=seq#1 @12:1 entered
 *   region attempt#1 attempt parent=try#1 @12:5 entered
 *   region catch#1 catch parent=try#1 @15:3
 *   region finally#1 finally parent=try#1 @18:3 entered
 *   issue ask#1 in=seq#1>loop#1 phase=unphased
 *   settle ask#1,ask#2 in=seq#1
 *   settle ask#4 in=seq#1 joins=fanout#1
 *   settle in=seq#1 joins=call#1
 *   settle maybe ask#3 in=seq#1
 *   spawn actor#1 in=seq#1
 *   mark phase#1 in=seq#1
 *   jump continue loop#1 in=seq#1>loop#1>choice#1>branch#1 phase=phase#1
 *   jump return call#1 in=seq#1>call#1 phase=unphased
 *   jump throw attempt#1 in=seq#1>try#1>attempt#1 phase=unphased
 *   control branch#1 by=ask#1 maybe=ask#2
 *   phase phase#1 "gate" @2:1
 *   phase hole#21b40fca "决定分组" @7:14
 *
 * A `hole` line is an OPEN hole (a filled one is not a step; `tail` marks the tail form and
 * `type=` is the author's spelling of the type argument); `fill=` on a phase names the filled
 * hole whose body wrote it (docs/analysis.md「Sites」).
 *
 * Sites come first in source (`order`) order, kinds interleaved; `type=` carries the
 * materialized artifact type and `ports=` a join's per-port types (`-` = unknown).
 * Fact lines are grouped by kind in the order above; within a kind, by the sink
 * site's source order, occurrences in stored (emission) order. Trace events are NOT
 * sorted — their sequence IS the temporal content; regions/controls/phases follow in
 * creation order. `issue` always carries its phase (`unphased` outside every marker's
 * extent), and a `settle` line carries `maybe` only when the barrier was a may-claim and
 * `joins=` only when it waited for strands (`strand` on the region line marks those). A
 * settle that ONLY joined strands names no step and prints without the step token.
 *
 * The structural regions (`choice` / `call` / `try` / `attempt` / `catch` / `finally`) and
 * the `mark` / `jump` leaves are the control-flow projection's input; the causality projection looks through
 * them. A `jump` names its resolved target region; `throw` targeting the root is uncaught.
 */
export function serializeCore(core) {
    return `${[
        ...renderSites(core),
        ...renderFacts(core.facts),
        ...core.trace.regions.map((region) => `region ${region.id} ${region.kind}` +
            (region.parent === undefined ? "" : ` parent=${region.parent}`) +
            (region.loc === undefined ? "" : ` ${at(region.loc)}`) +
            (region.entered ? " entered" : "") +
            (region.exhaustive ? " exhaustive" : "") +
            (region.fallthrough ? " fallthrough" : "") +
            (region.recursive ? " recursive" : "") +
            (region.detached ? " detached" : "") +
            (region.bound === undefined ? "" : ` bound=${region.bound}`) +
            (region.label === undefined ? "" : ` label=${quote(region.label)}`) +
            (region.strand ? " strand" : "")),
        ...core.trace.events.map(renderEvent),
        ...core.trace.controls.map((control) => `control ${control.region}` +
            (control.controllers.length > 0 ? ` by=${control.controllers.join(",")}` : "") +
            (control.maybeControllers.length > 0 ? ` maybe=${control.maybeControllers.join(",")}` : "")),
        ...core.trace.phases.map((phase) => `phase ${phase.id} ${quote(phase.name)} ${at(phase.loc)}` +
            (phase.fill === undefined ? "" : ` fill=${phase.fill}`)),
    ].join("\n")}\n`;
}
function renderSites(core) {
    const typeOf = (id) => {
        const type = core.types.siteType.get(id);
        return type === undefined ? "" : ` type=${quote(type)}`;
    };
    const withinOf = (within) => within === undefined ? "" : ` within=${within}`;
    const lines = [
        ...core.sites.asks.map((site) => ({
            line: `ask ${site.id} ${quote(site.label)}${renderPattern(site.labelPattern)} ${at(site.loc)}` +
                ` order=${site.order}${withinOf(site.within)}${typeOf(site.id)}`,
            order: site.order,
        })),
        ...core.sites.worldReads.map((site) => ({
            line: `world-read ${site.id} ${quote(site.label)} ${at(site.loc)}` +
                ` order=${site.order}${withinOf(site.within)}${typeOf(site.id)}`,
            order: site.order,
        })),
        ...core.sites.joins.map((site) => {
            const ports = core.types.joinPortTypes.get(site.id);
            const portsText = ports === undefined
                ? ""
                : ` ports=${ports.map((port) => (port === undefined ? "-" : quote(port))).join(",")}`;
            return {
                line: `join ${site.id} ${quote(site.label)} ${at(site.loc)}` +
                    ` order=${site.order}${withinOf(site.within)}${typeOf(site.id)}${portsText}`,
                order: site.order,
            };
        }),
        ...core.sites.actors.map((site) => ({
            line: `actor ${site.id}${site.name === undefined ? "" : ` ${quote(site.name)}`}` +
                `${renderPattern(site.namePattern)} ${at(site.loc)} order=${site.order}${withinOf(site.within)}`,
            order: site.order,
        })),
        ...core.sites.fanouts.map((site) => ({
            line: `fan-out ${site.id} ${quote(site.label)} ${at(site.loc)}` +
                ` order=${site.order}${withinOf(site.within)}` +
                `${site.cardinality === undefined ? "" : ` count=${site.cardinality}`}${typeOf(site.id)}`,
            order: site.order,
        })),
        ...core.sites.holes.map((site) => ({
            line: `hole ${site.id} ${quote(site.name)} ${at(site.loc)} order=${site.order}` +
                `${withinOf(site.within)} type=${quote(site.type)}${site.tail ? " tail" : ""}`,
            order: site.order,
        })),
    ];
    return lines.sort((a, b) => a.order - b.order).map((entry) => entry.line);
}
function renderFacts(facts) {
    const occText = (occ) => `${occ.site} ${occ.exact ? "exact" : "inexact"}${occ.port === undefined ? "" : ` port=${occ.port}`}`;
    const group = (kind, map) => {
        // Emission (state.ts) fills these maps in deterministic evaluation order; sorting
        // by sink id keeps the section readable and independent of that order.
        const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
        const lines = [];
        for (const [sink, occs] of entries) {
            for (const occ of occs)
                lines.push(`fact ${kind} ${sink} <- ${occText(occ)}`);
        }
        return lines;
    };
    return [
        ...group("ask-data", facts.askData),
        ...group("ask-actor", facts.askActor),
        ...group("world-read-data", facts.worldReadData),
        ...group("join-in", facts.joinIn),
        ...group("fan-out-in", facts.fanoutIn),
        ...group("hole-data", facts.holeData),
        ...facts.returnData.map((occ) => `fact return <- ${occText(occ)}`),
    ];
}
function renderEvent(event) {
    const chain = (regions) => regions.length === 0 ? "" : ` in=${regions.join(">")}`;
    if (event.at === "issue") {
        return `issue ${event.step}${chain(event.regions)} phase=${event.phase}`;
    }
    if (event.at === "settle") {
        // A join-only barrier carries no steps; the token is omitted rather than written as an
        // empty string, so the line keeps single spaces throughout.
        return ("settle" +
            (event.maybe ? " maybe" : "") +
            (event.steps.length === 0 ? "" : ` ${event.steps.join(",")}`) +
            chain(event.regions) +
            (event.joins === undefined || event.joins.length === 0
                ? ""
                : ` joins=${event.joins.join(",")}`));
    }
    if (event.at === "mark")
        return `mark ${event.phase}${chain(event.regions)}`;
    if (event.at === "jump") {
        return `jump ${event.kind} ${event.target}${chain(event.regions)} phase=${event.phase}`;
    }
    return `spawn ${event.actor}${chain(event.regions)}`;
}
