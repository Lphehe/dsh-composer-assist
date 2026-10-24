import { UNPHASED_ID } from "./constants.js";
/**
 * `phases` is the trace's phase table, which orders every list this module returns:
 * {@link UNPHASED_ID} first (as in `collectFlowPhases`), then first-reach order.
 */
export function createStrandPark(phases) {
    const parked = new Map();
    const rank = new Map(phases.map((phase, index) => [phase.id, index + 1]));
    rank.set(UNPHASED_ID, 0);
    const at = (id) => rank.get(id) ?? rank.size;
    return {
        alongside: (phase, regions) => {
            // A mark inside a strand is not alongside it: the strand is where the mark IS. The
            // whole enclosing chain is excluded, not just the innermost region.
            const enclosing = new Set(regions);
            const running = new Set();
            for (const [region, strand] of parked) {
                if (enclosing.has(region))
                    continue;
                for (const id of strand.phases)
                    if (id !== phase)
                        running.add(id);
            }
            return [...running].sort((a, b) => at(a) - at(b));
        },
        discard: () => parked.clear(),
        drain: () => {
            const out = [...parked.values()].flatMap((strand) => strand.exits);
            parked.clear();
            return out;
        },
        join: (regions) => {
            const out = [];
            for (const region of regions) {
                const strand = parked.get(region);
                if (strand === undefined)
                    continue;
                parked.delete(region);
                out.push(...strand.exits);
            }
            return out;
        },
        park: (region, exits, phaseIds) => {
            parked.set(region, { exits: [...exits], phases: [...phaseIds] });
        },
    };
}
