// Scratch harness for adversarial fixture probing. Usage:
//   node scratch/run.mjs <fixture.ts>
// Prints diagnostics (exit 1) when the script does not typecheck, otherwise the
// canonical site-graph and actor-graph serializations.
import { readFileSync } from "node:fs";
import { analyzeWorkflowScript, toActorGraph } from "../dist/index.js";
import { serializeActorGraph, serializeGraph } from "../dist/analysis/serialize.js";

const path = process.argv[2];
if (path === undefined) {
  console.error("usage: node scratch/run.mjs <fixture.ts>");
  process.exit(2);
}
const result = analyzeWorkflowScript(readFileSync(path, "utf8"));
if (!result.ok) {
  console.log("DIAGNOSTICS:");
  for (const d of result.diagnostics) {
    console.log(`  ${d.line}:${d.column} ${d.message}`);
  }
  process.exit(1);
}
console.log("== site graph ==");
console.log(serializeGraph(result.graph));
console.log("== actor graph ==");
console.log(serializeActorGraph(toActorGraph(result.graph)));
