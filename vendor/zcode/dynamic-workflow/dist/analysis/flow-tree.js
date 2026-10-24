/** Rebuild the tree from the leaf stream, and index every region by id. */
export function buildTree(trace) {
    const byId = new Map();
    for (const region of trace.regions) {
        byId.set(region.id, { children: [], first: Number.POSITIVE_INFINITY, region, type: "region" });
    }
    for (const region of trace.regions) {
        if (region.parent === undefined)
            continue;
        byId.get(region.parent)?.children.push(byId.get(region.id));
    }
    trace.events.forEach((event, index) => {
        const home = event.regions[event.regions.length - 1] ?? trace.root;
        byId.get(home)?.children.push({ event, index, type: "leaf" });
    });
    // Bottom-up: each child is ordered (and its `first` cached) BEFORE the parent sorts, so
    // the comparator reads a number instead of re-walking the subtree. A comparator that
    // called `order(child)` itself would re-sort and re-walk the whole subtree on every
    // comparison — exponential in nesting depth (a 2,500-region trace of inlined helpers
    // took 45 s before the projection had produced a single edge).
    const firstOf = (node) => (node.type === "leaf" ? node.index : node.first);
    const order = (node) => {
        if (node.type === "leaf")
            return node.index;
        for (const child of node.children)
            node.first = Math.min(node.first, order(child));
        node.children.sort((a, b) => firstOf(a) - firstOf(b));
        return node.first;
    };
    const root = byId.get(trace.root);
    order(root);
    return { byId, root };
}
