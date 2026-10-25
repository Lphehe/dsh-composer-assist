# Fusion recipe (experimental, isolated workflow module)

This repository's npm package **dsh-composer-assist@0.7.5 does not ship workflow/**. This recipe is **not** available when users install the normal composer-prediction package. It is code for the separately installed/packaged ZCode workflow host, not a claim of a released DSH feature.

## What changed

The isolated `workflow/plugin.js` now accepts `zcode_workflow` with `action: "fusion_create"`. This calls `createFusionDraft` and `manager.prepare` to create an inspectable workflow draft. The **first launch still requires the existing explicit human confirmation** in the Workflow panel. No automatic push, merge, deployment or npm publish is performed.

Example *agent tool input* (only after the standalone workflow host is installed):

```json
{
  "action": "fusion_create",
  "task": "修复订单计算 Bug，添加回归测试",
  "name": "Fusion 订单修复",
  "leadModel": "provider/high-capability-model",
  "sidekickModel": "provider/implementation-model",
  "reviewModel": "provider/review-model",
  "maxRounds": 2,
  "testScript": "selfcheck",
  "timeoutMs": 180000
}
```

Remove optional model fields to inherit the parent session's chosen subagent route. Explicit model IDs **must** be allowed in the current session's DSH Subagent Model Selection. These are placeholders, not actual provider IDs.

### Execution contract

1. **Lead** plans the work and defines testable acceptance criteria.
2. **Sidekick** implements in the current workspace using the DSH session's own tools.
3. The **real** `world.run("pnpm", ["run", script], { timeoutMs })` checks the project. A nonzero exit **always blocks acceptance**.
4. **Reviewer** receives the plan, change summary, limited Git diff, real exit code and test output, returning typed review. The DSH tool guard enforces a **read-only** tool subset for this reviewer. The reviewer system prompt alone is not used as the security boundary.
5. If tests fail or review reports blocking issues, feedback returns to the same Sidekick actor (bounded 1–3 rounds). The Lead then produces the final sign-off; `success` also requires the mechanical test/review gate.
6. The ZCode journal persists steps for interrupted-run recovery. Unknown effects retain the pre-existing *human verification* gate; restarting does not mean safe automatic re-execution.

### Boundaries and limitations

- This is a **bounded multi-agent workflow**, not a reproduction of Devin's proprietary Fusion model or a full general-purpose always-running RSI daemon.
- The recipe's test runner supports **one named pnpm script**; no user-supplied shell pipelines or arbitrary command strings.
- Tests run in the inherited DSH sandbox and require the same permissions; scripts may have side effects. Inspect their content before confirming first launch.
- The reviewer sees a Git diff, which does not include untracked file contents by default. Do not treat its approval as complete coverage; test failures and Lead sign-off remain separate gates.
- Retry rounds are limited, and the tool intentionally does not auto-merge, push or deploy.
- `workflow/` is currently excluded from the package exports and npm files. Activating it requires a separately reviewed DSH workflow packaging/integration step and a real-host smoke test.
- Template selfchecks are model-free. GitHub CI also builds the ZCode compiler and requires it to accept the generated Fusion script. **Neither check proves a successful paid Agent run or DSH desktop/Host integration.**

Run unit check from repository root after installing dev dependencies:

```sh
node workflow/host/fusion-template-selfcheck.mjs
# CI additionally builds ZCode and compiles the generated recipe.
```
