/** The single lane every `files.*` read runs in. */
export const WORKSPACE_LANE = "workspace";
/** The main agent's lane: where every open hole waits (docs/analysis.md「Sites」). */
export const MAIN_LANE = "main";
/** Lane of an ask whose receiver the analysis could not resolve to any actor site. */
export const UNKNOWN_LANE = "unknown";
/** The terminal marker: the artifact the script returns. */
export const SINK_ID = "sink";
