---
name: Composer Workflow
description: Native DSH Operate workbench; code-led source contract, visual
  acceptance pending.
colors:
  primary: var(--dsw-alias-brand-primary)
  neutral-base: var(--dsw-alias-bg-base)
  neutral-layer-1: var(--dsw-alias-bg-layer-1)
  neutral-layer-2: var(--dsw-alias-bg-layer-2)
  ink-primary: var(--dsw-alias-label-primary)
  ink-secondary: var(--dsw-alias-label-secondary)
  border-subtle: var(--dsw-alias-border-l1)
  border-control: var(--dsw-alias-border-l2)
  success: var(--dsw-alias-state-success-primary)
  error: var(--dsw-alias-state-error-primary)
  primary-hover: color-mix(in srgb,var(--dsw-alias-brand-primary)
    88%,var(--dsw-alias-label-primary))
  selection: color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)
  nav-selected: color-mix(in srgb,var(--dsw-alias-brand-primary)
    10%,var(--dsw-alias-bg-base))
  canvas: color-mix(in srgb,var(--dsw-alias-brand-primary)
    3%,var(--dsw-alias-bg-layer-1))
  phase-band: color-mix(in srgb,var(--dsw-alias-bg-base) 65%,transparent)
  badge-tint: color-mix(in srgb,currentColor 12%,var(--dsw-alias-bg-base))
  badge-border: color-mix(in srgb,currentColor 24%,transparent)
  avatar-tint: color-mix(in srgb,currentColor 13%,var(--dsw-alias-bg-base))
  avatar-border: color-mix(in srgb,currentColor 30%,transparent)
typography:
  headline:
    fontFamily: inherit
    fontSize: 18px
    fontWeight: 650
    lineHeight: 1.4
  title:
    fontFamily: inherit
    fontSize: 15px
    fontWeight: 600
  body:
    fontFamily: inherit
    fontSize: 13px
    lineHeight: 1.5
  node-title:
    fontFamily: inherit
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  control:
    fontFamily: inherit
    fontSize: 12px
    lineHeight: 1.5
  label:
    fontFamily: inherit
    fontSize: 11px
  instruction:
    fontFamily: inherit
    fontSize: 11px
    lineHeight: 16px
  node-badge:
    fontFamily: inherit
    fontSize: 10px
    fontWeight: 650
  identifier:
    fontFamily: ui-monospace,SFMono-Regular,Consolas,monospace
    fontSize: 11px
    lineHeight: 1.5
  node-source:
    fontFamily: ui-monospace,SFMono-Regular,Consolas,monospace
    fontSize: 10px
    lineHeight: 14px
  code:
    fontFamily: ui-monospace,SFMono-Regular,Consolas,monospace
    fontSize: 12px
    lineHeight: 1.7
rounded:
  chip: 5px
  marker: 6px
  control: 8px
  task: 10px
  surface: 12px
spacing:
  gap-tight: 4px
  gap-control: 6px
  gap-inline: 8px
  gap-heading: 10px
  gap-section: 12px
  gap-metrics: 16px
  gap-phase: 20px
  gap-band: 24px
  gap-column: 32px
components:
  button-secondary:
    backgroundColor: "{colors.neutral-layer-1}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: 6px 12px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-base}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: 6px 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  input:
    backgroundColor: "{colors.neutral-layer-1}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 7px 10px
  nav-selected:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: 6px 14px
  actor-chip:
    backgroundColor: "{colors.neutral-layer-2}"
    rounded: "{rounded.chip}"
    padding: 2px 7px
    typography: "{typography.label}"
  structural-node:
    backgroundColor: "{colors.neutral-layer-1}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.marker}"
    width: 88px
    height: 32px
    typography: "{typography.label}"
  task-node:
    backgroundColor: "{colors.neutral-base}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.task}"
    width: 248px
    height: 112px
    padding: 12px 14px
    typography: "{typography.node-title}"
  graph-shell:
    backgroundColor: "{colors.neutral-layer-1}"
    rounded: "{rounded.surface}"
  code-block:
    backgroundColor: "{colors.neutral-layer-1}"
    rounded: "{rounded.control}"
    padding: 14px 16px
    typography: "{typography.code}"
  status:
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
---

# Design System: Composer Workflow

## Overview

**Creative North Star: "The native DSH workflow workbench"**

A user-pinned, code-led Operate extension of the original DSH webview. The host supplies the font family and live theme; this surface adds a compact, functional graph workspace without a separate brand, display face or replacement runtime. The named north star describes the approved contract rather than introducing a new identity.

The full graph belongs in the central main area reached through the second-row 工作流 tab. Real phase bands, inspectable structural markers and task nodes carry the hierarchy. Neutral surfaces and precise boundaries keep controls quiet; color communicates selection and observed state.

The 0.6.2 SOURCEFINAL whitespace-and-edges sync records intrinsic-width phase bands packed side by side when measured width permits, otherwise wrapped in phase order; flex auto margins center a fitting SVG on both axes while keeping overflow starts accessible. Shared graphEdgePoints routing uses sorted distinct ports, direct elbows and a card-boundary orthogonal grid with 6px obstacle clearance and 12px port stubs, preserving all valid-endpoint edges including self/back links. The dense-grid shortcut retains a card-boundary grid of quadratic size; these are source facts, not final visual acceptance.

**Key Characteristics:**
- Native DSH typography and dynamic theme colors.
- Full central graph, compact phase topology and continuously reachable run controls.
- Real identifiers, instructions, states and dependency edges; explicit unknowns.

This is a source-extracted normative design contract synced to frozen 0.6.2 SOURCEFINAL at /Users/Admin/dsh插件. Authority: PRODUCT.md, .impeccable/surfaces/workflow-client-ui-js.md, current workflow/client/ui.js and graph.js, and .impeccable/review/round-3-scope.md; prior findings: .impeccable/review/round-1-review.md. The user authorized one extra round only for whitespace and edges. The 0.6.0 verdict was **FIX**, not accepted. The user-provided inline picture is 0.6.1 evidence, not 0.6.2 visual proof. The SOURCEFINAL CLI is reported running; this documentation-only pass does not establish its outcome or build/install/runtime success. No new screenshot was inspected. Existing native contexts are 2056×1211 desktop and 840×900 narrow desktop; recorded capture pixel sizes differ and are not CSS viewport dimensions. Current desktop/narrow-desktop, mobile and dark appearance, interaction acceptance and the final visual verdict remain unverified.

Source identity at extraction:
- `workflow/client/ui.js` SHA-256: `ef0cb45caff1a0d0600bc30766cf224e7c1d9b7d68b700e413647de2f542df05`.
- `workflow/client/graph.js` SHA-256: `25edacdbef787f2e20ee67ac1379a9d6ed0e87b3d3d9083db728ca9fa9cd80bc`.

## Colors

The palette is the host's live neutral layers, selection accent and semantic success/error colors. Frontmatter values are normative CSS expressions, not sampled swatches.

### Primary

Primary is DSH's brand accent for primary actions, selected local navigation, links, focus and running state. Primary-hover, nav-selected, canvas and selection retain their exact source mixes. The three-percent canvas tint is a diagram plane, not a new brand color.

### Neutral

Neutral-base anchors the workbench and task faces; neutral-layer-1 backs controls, editor and structural markers; neutral-layer-2 supplies hover and secondary surfaces. Ink-primary carries names and content, ink-secondary carries IDs, metadata and edges. Border-subtle separates surfaces; border-control bounds controls and task nodes. Phase-band mixes the host base with transparency. Badge/avatar mixes use currentColor and therefore require the actor's assigned ink context.

### Semantic states

Success marks observed completion; error marks failed/errored text and failed task boundaries. Running uses primary; other state labels retain secondary ink. Actor badge colors cycle deterministically between primary, success and secondary ink from actor identity; that color alone is not execution status.

**The Host Theme Rule.** Keep colors bound to DSH custom properties and inherit the native font; do not freeze a guessed palette or introduce a display font.

No synthetic tonal ramps are supplied: the host does not expose a ramp here, and generating one would invent palette authority. Sidecar color metadata stays live-bound; resolved colors and contrast in either host theme are unverified.

## Typography

Native font family is inherited; no specific proportional font name is asserted. There is no display role. The compact hierarchy is 18px run heading (650, 1.4), 15px section/editor headings (600), 13px body (1.5) and task titles (600, 1.4), 12px controls/notes, and 11px status/metadata. The narrow container reduces the run heading to 15px. Task badges and in-node states use 10px. This is an observed hierarchy, not an invented modular scale.

Identifiers use the recorded 11px monospace stack; in-node source text uses 10px/14px. Editor/code uses 12px/1.7. Task instruction excerpts use 11px/16px, two lines within 32px; the full source remains inspectable. Titles and in-node IDs ellipsize; surrounding identifiers wrap anywhere. Notes and timeline instructions cap at 75ch. Metrics, states and time use tabular numerals.

**The Operational Type Rule.** Use native proportional text for controls and task names; reserve monospace for real identifiers and code.

## Layout

The main region fills the host's available height and width with min-width/min-height zero, flex columns and independent overflow. Outer padding is 20px clamp(12px,2vw,24px) 24px. The run selector declares width:100% and max-width:360px, but the later generic panel select rule has equal specificity and overrides the cap with max-width:100%; the later 720px container rule sets max-width:none. These are source-cascade facts, not measured control widths. The adjacent live-connection label uses flex:none and white-space:nowrap. The sticky header uses top:0, z-index:2 and flex:none; scrolling content sits below it. The graph toolbar/footer are flex:none siblings of the scrollable diagram, not part of the scaled SVG. This is fixed control placement within the workbench, not viewport position:fixed.

**The Reachable Controls Rule.** Keep run selection, identity, contextual actions and view navigation outside the scrolling body; keep graph controls outside the diagram scroller.

Main content has a 300px minimum height, graph shell 280px and graph scroller 160px. The scroller uses display:flex, stable scrollbar gutter and contained overscroll. Its SVG uses display:block, flex:none and margin:auto: positive free space centers it horizontally and vertically, while overflow leaves the start reachable through scrolling. This records CSS behavior, not a runtime accessibility check. Graph height grows with topology; available height is handled through flex and scrolling, not an implemented automatic height-fit algorithm.

At container max-width 720px (not a device/media breakpoint), editor fields become one column, selector/actions span the available width, graph-kind and zoom controls wrap on their own rows, metrics use 6px 12px gaps, the heading becomes 15px and script minimum height becomes 240px instead of 300px. Desktop/narrow-desktop contexts do not establish mobile support.

Graph geometry uses 248×112 task nodes and 88×32 structural markers at 100%. The model wraps depth columns to measured available width with a 296px lower bound, 32px column gap and 48px horizontal allowance. Each band has intrinsic width: its widest wrapped column line plus 32px. Bands pack side by side in phase order with 24px gaps while the next band plus the 8px right allowance fits; otherwise they wrap below the tallest band in the row. Layout begins at band x=8, y=16, with nodes inset 16px; bands reserve 44px above rows, use 136px row pitch, 24px wrapped-line/row gaps and 20px bottom allowance. Model width follows node extents with 24px right allowance and a 296px minimum; height has a 320px minimum. Packing/wrapping follows measured fit; 640px is a narrow-width case, not a hard-coded breakpoint or a verified rendered result. Only graph/causality views with actual phases receive phase bands. Structural vertices may inherit a spatial band from neighbors, never an execution phase. Cyclic vertices retain a trailing column.

ResizeObserver measures diagram width and resets zoom to 100% on width changes. Analysis/kind changes reset zoom and scroll position. Manual zoom is 25–200% in 15-point steps; Fit is explicitly width-based and clamps to 25–100%. Do not imply automatic shrink-to-fit or proven overlap-free layout.

**The Real Graph Rule.** Render every model edge with valid endpoints, including cycles, self-links and source edges; spatial placement must not invent execution phases or statuses.

The model normalizes the supplied edges and drops only those whose endpoints are absent. Flow entry/sink/abort vertices are materialized only when referenced by actual edges. Every model edge, including self/back links, is passed to shared graphEdgePoints(model, edge) and rendered as SVG M/L segments. Side selection follows relative card position; self-links use right/bottom sides. Distinct ports on each side are sorted by explicit numeric port, opposite endpoint position and original edge order, with an 8px corner inset. Routes leave/enter through 12px stubs and test direct orthogonal elbows against card bounds expanded by 6px. Blocked routes search a card-boundary orthogonal grid with outer and phase channels, Manhattan distance and a 12px bend penalty; duplicate/collinear points are removed. Missing endpoints or no clear route throw rather than silently dropping an edge. The source shortcut notes quadratic grid size and recommends route caching if hundreds of cards are displayed; dense-graph performance is unverified. All edges retain arrow direction and endpoint titles; exact:false uses 4 3 dashes. Regular strokes are 1.2px at .55 opacity, source/entry strokes 1px at .25. These routing rules are source facts, not a visual collision guarantee.

## Elevation & Depth

Depth comes from host surface layers, a lightly tinted canvas, phase planes and one-pixel outlines. No box-shadow tokens, gradients or decorative animation are defined. The sticky region's stacking order is functional. Reduced-motion preference disables transition/animation and restores auto scrolling; no additional motion language is established.

**The Boundary Depth Rule.** Use tonal planes and one-pixel boundaries for depth; no shadow or decorative animation is established in this source.

Focus uses a 2px primary outline with 3px offset for main controls; SVG node focus instead uses a 3px primary stroke. Chat summary controls use an inset -3px outline offset. Preserve these contexts in sidecar snippets.

## Shapes

Use 5px chip/avatar corners, 6px structural-marker/node-badge corners, 8px controls/code, 10px task/phase/intervention/chat surfaces and 12px graph/editor/phase-band corners. Structural markers stay visibly smaller than tasks. Node badges are 24×24; chat avatars 23×23. Progress dots are 8×8 circles. Corners indicate component scale, not a universal card treatment.

## Components

### Buttons

Compact native-family controls: 6px 12px padding, 32px minimum height, 8px corners and a one-pixel control boundary. Secondary hover uses layer-2; active changes the border to primary. Primary uses host brand with base-colored text and the recorded hover mix. Disabled opacity is .45 with not-allowed cursor. Graph-kind buttons use 4px 9px padding and 30px minimum height; zoom uses 4px 8px and 28px. Minimum heights are not fixed heights.

### Inputs / Fields

Native input/select/textarea controls use 7px 10px padding, 34px minimum height, 8px corners, layer-1 background, primary ink and brand caret. Script textarea uses the base surface, monospace and vertical resize. Preserve labels, accessible names, real validation errors and disabled operations. Do not replace native selection behavior.

### Navigation

The native second-row 工作流 tab opens the main workspace. Local flow/stages/nodes-and-logs/results controls use aria-pressed within a named group. Selected local navigation uses nav-selected and primary ink; graph-kind selection instead uses layer-2, subtle border and weight 600. Main entry defaults to graph; preserved draft/view state may restore another view. The four graph kinds are dependency, causality, control flow and phase handoff. No permanent workflow side rail belongs to this surface.

### Graph nodes and phases

Structural kinds are source, sink, join, fan-out, mark, entry, abort and test. Render their compact localized labels without an execution-status attribute or badge. Both structural and task nodes are focusable buttons activated by Enter/Space or pointer, with identity in accessible labels/titles. Inspection opens node/log details with a return-to-graph control.

Task faces use base, a one-pixel control outline, 12px 14px inner padding and 8px gaps. Running outlines become primary at 1.5px; failures use error; hover uses primary and keyboard focus 3px. Actual actor names/badges, state label, retained instruction excerpt and source IDs establish correspondence. Missing instructions use the existing kind/absence message rather than invented text. Phase labels use 13px/600 and real task counts at 11px. Empty graph and loading states remain honest messages/skeletons, never fake graphs.

### Stages, status and actor chips

Stage details use 10px corners, subtle boundaries, 14px 16px summaries and native disclosure. Task rows retain keyboard buttons and real instruction excerpts. Phase completion respects observed work and run terminal state; waiting is not completion. Status text accompanies color. Actor chips use 2px 7px padding, 5px corners and layer-2; native actor identity supplies initials and color. They are identity badges, not decorative glyph icons.

### Code, results and chat summary

Code uses pre-wrapped content, anywhere wrapping, 14px 16px padding, 8px corners and a 380px maximum scrolling height. Keep results/artifacts/reports and omitted-record/load-more behavior. Chat retains a compact progress summary leading to the main workspace; it is not another full graph or sidebar.

### Actions and gates

Preserve script analyze/save/run/stop/resume/amend, saved-run selection, model/concurrency/scope settings, questions, holes and hold resolution. Keep real missing data explicit. First launch and unknown external effects retain human control and existing authorization. This document does not validate runtime execution or change any gate/action/data contract.

The sidecar contains static extracted component markup with UI labels only, no synthetic run or business records, no scripts and no action handlers. It is design reference, not a mock workflow or interaction test. DSH variables and native font must be inherited from a host context; no standalone theme fallback is invented.

## Do's and Don'ts

### Do:
- Do extend the original DSH main workbench and preserve the second-row 工作流 entry.
- Do retain all four graph kinds, stages, node/log inspection, results/artifacts and script operations.
- Do preserve ownership, SSE lifecycle/error handling, draft state, human gates, permissions, concurrency and model-budget boundaries.
- Do keep structural markers inspectable without fabricated execution state, and keep actual task instructions and identifiers available in details.
- Do distinguish source documentation, build/install evidence, runtime evidence and visual acceptance.

### Don't:
- Don't introduce an independent brand, decorative font, fixed hex palette, guessed dark tokens or a replacement runtime.
- Don't recreate a permanent workflow sidebar, duplicate actor/history rail or form-first default view.
- Don't invent nodes, edges, phase relationships, instruction text, business data or successful execution.
- Don't describe narrow desktop as mobile or claim current screenshots, dark theme or interaction acceptance.

Not canonized or repaired: the 0.6.0 rejected overflow, structural pending states, wire-heavy spacing and inaccessible controls, and the whitespace/edge concerns behind the approved post-0.6.1 round; current source records their intended correction without proving rendered resolution. The retained height-fit/overlap uncertainty, quadratic dense-grid limit, unverified current desktop/narrow-desktop/mobile/dark appearance and pending final screenshots remain open. Native host fonts are an explicit user contract, not an invented system display face.

## 能力桥：实施方案与验收清单（待确认）

**状态：设计提案，2026-10-24；未批准实施、未实现、未验收。** 用户本轮只授权写入本节。确认前不修改代码、依赖、运行配置、安装包或历史运行记录，不自动执行模型调用或 MCP 操作。上文是已有 UI 的设计合同及历史取证快照；本节是下一阶段能力扩展，不把提案写成现有行为，也不改写上文的验收历史。确认后再同步 [产品范围](<PRODUCT.md>)，按下列阶段实施。

### 1. 目标、非目标与最小闭环

**目标：在 JavaScript 沙箱里组织多模型、多工具协作。** 脚本可以组合普通模型调用、可选 Classifier、宿主已授权的 MCP／本地工具，以及需要多轮推理的 Agent；判断结果驱动分支，并行结果可汇总为后续输入。作者继续使用当前支持的 JS／可擦除 TypeScript 工作流语法，不要求另建应用或另装 ZCode。

不是每一步都启动 Agent：明确条件由代码处理，单轮推理直接调用模型，复杂多轮任务才使用已有 actor。决策能力不等于必须购买或部署一个独立决策模型。

最小闭环：**MCP 获取数据 → 规则或显式选定的判断能力分流 → 不同模型／Agent 并行处理 → 汇总结果 → 受权限约束的后续工具操作或人工确认。** 没有模型时，规则、工具和人工分支仍可用；只有实际依赖模型的步骤暂停或失败。

本期不替换 ZCode 执行引擎、DSH 模型注册／Teams、原生工具权限链或 MCP 连接管理，不新增第二套任务数据库、通用工具发现系统、自动恢复 daemon、定时器平台或任意 npm 包执行能力。状态与恢复修补是能力桥的基础工作，不代替能力桥本身的交付。

### 2. 分层与现有能力边界

```text
JS／TypeScript 工作流：条件、循环、并行、汇总、人工分支
    ↓ 编译与站点标识
沙箱能力桥：受控模型调用｜可选 Classifier｜工具调用｜已有 actor
    ↓ 参数校验、路由与权限核验、预算准入、写前记录
Host Adapter：DSH 模型注册与调用｜原生工具执行链（含已授权 MCP）｜Teams
    ↓
现有 journal：结果、未知效果、检查点与恢复
    ↓
现有工作台：真实节点、状态、日志、用量与人工门禁
```

| 已核对事实 | 对实现的约束 |
| --- | --- |
| [manager](<workflow/host/manager.js>) 已管理运行归属、模型路由固定、SQLite journal、结果未知门禁；[driver](<workflow/host/dsh-driver.js>) 连接原生 Teams 与工具事件 | 扩展现有入口，保持父会话／cwd／原生团队归属；不能让脚本自行启动另一套编排 |
| [编译入口](<workflow/host/compile-sync.js>)、[站点收集](<vendor/zcode/dynamic-workflow/src/analysis/sites.ts>)、[降级](<vendor/zcode/dynamic-workflow/src/lowering/lower.ts>) 与 [runtime](<vendor/zcode/dynamic-workflow-runtime/src/harness.ts>) 已形成工作流链 | 新调用必须成为编译器可识别、可记录和可恢复的操作；只给子进程塞一个函数不算接入 |
| 本轮 Inspect 的 `llm` 公开合同提供模型注册、能力解析、`prepareCall` 和流式聊天调用，未给出可直接依赖的原生 Classifier 调用合同 | 聊天调用可复用宿主；原生 Classifier 仍需核对适配器／供应商能力并建立明确 Adapter，不能据此声称整台宿主没有该能力 |
| `tools.presentAs('ptc')` 与 Node PTC 注册／文档已核对；未执行实际 PTC 验收 | PTC 可用于 actor 内的单次工具组合，不等于外层持久工作流；Node PTC 与 QuickJS 的隔离语义不能画等号 |
| [journal](<workflow/host/journal.js>) 已有 FULL/WAL 与局部 transaction，[selfcheck](<workflow/host/selfcheck.mjs>) 已有 fake driver 跨进程恢复检查 | 复用现有存储与测试入口；既有自检不替代新增调用节点或完整宿主中断验收 |

这里的“原生支持”指脚本有正式、可发现、经过校验／权限／计量／恢复链的能力，不表示插件自己实现 MCP 协议客户端，也不表示脚本取得供应商凭据。

### 3. 决策能力可选：没有决策模型时怎么办

| 判断来源 | 输入与输出 | 无能力或异常时的行为 |
| --- | --- | --- |
| 代码规则 | 显式条件、阈值、已有数据；返回有限分支 | 不调用模型；缺业务事实时进入脚本定义的人工／未知分支，不猜值 |
| 结构化聊天判断 | 显式选择已授权聊天模型；输出须按 choice／bool／score 的 schema 校验 | 标识为“结构化聊天判断”，不冒充原生 Classifier；解析失败、越界选择、缺字段不得驱动执行，可报告错误或请求人工 |
| 原生 Classifier | 仅在供应商支持且已授权时调用其真实分类接口，记录具体类型与路由 | 不可用则返回可识别的能力错误，只影响依赖它的分支；不静默切换成聊天模型 |
| 人工判断 | 在已有工作台提问，得到明确选择后继续 | 超时、取消或尚未回答都不是默认同意；不伪造答案 |

无需单独再造一个“决策模型”类型：决策是由规则、结构化聊天判断或原生 Classifier 的结果驱动的工作流行为。判断只能选当前脚本登记且当前权限允许的分支；模型不能通过输出新工具名、脚本或“已批准”文本扩大权限。

没有原生 Classifier 不阻塞整个能力桥：第一版须完整支持规则分支，并可使用明确选择的聊天模型做结构化判断；原生 Classifier 接入独立验收，未接通时如实显示不可用。没有任何模型时仍能运行不依赖模型的脚本；需要语义推理的步骤应请求人工或给出清楚错误。

**先行接通供应商：OpenRouter（原生 LLM 链路已验收）。** 2026-10-24 按用户后续授权，复用宿主已有 pi-ai 路由和凭据引用，保留原 18 个模型并追加 `qwen/qwen-2.5-7b-instruct`。通过宿主 `llm.prepareCall()`／`stream()` 完成一次真实付费调用，完整返回 `OK`、正常结束及用量，耗时 1045 ms；临时探针已卸载，重试策略恢复原值。详见 [内部链路验收](<docs/openrouter-dsh-verification.md>)。这不代表编排能力桥、结构化聊天判断或原生 Classifier 已实现；这些仍按本节另行确认。凭据仅由宿主管理，不进入本文件、工作流脚本或版本库；已在聊天暴露的密钥仍建议撤销更换。

### 4. 脚本 Interface 与调用合同（拟议，非当前可用 API）

保留已有 `agent(...).ask(...)`。新增能力以小 Interface 提供：模型目录与调用、显式判断、工具目录与调用。最终名称和参数要在阶段 A 用宿主精确合同确定，再同步生成的类型声明和 help；本节不发布可复制运行的虚构 API。

- **模型调用**：路由明确为 provider＋model；单轮调用不自动继承整段聊天历史或启动 Agent。结构化输出须真正校验；记录完成原因、错误和供应商实际报告的用量。专用 Classifier 与结构化聊天判断在目录和结果中区分。
- **工具调用**：从当前运行 scope 可见的工具目录获得准确名称与 schema，包含宿主已连接、已授权的 MCP 工具。调用必须经过宿主统一执行链，保留参数校验、限制、guard、ask／deny、取消、日志及结果处理，不能直接调用工具实现函数绕过这些环节。
- **MCP 连接**：第一版只消费宿主已配置连接；服务离线、未授权或工具不存在时明确失败。脚本不能指定任意服务器地址、OAuth token、API key、baseURL 或 headers 来借用宿主身份；新增连接与凭据配置仍属于宿主界面和独立授权。
- **可发现性与输出**：目录先给名称、用途、能力类型与是否可用，详细 schema 和说明按需取；缺项有稳定的查询入口。只把显式返回的必要中间结果传给后续模型，完整结果按权限留作可检索记录，截断必须标记。日志与详情不暴露凭据或授权头。
- **准入**：复用当前父会话模型允许列表、权限与配额机制；直接模型调用不得绕过 actor 已受的限制。调用前核对预算和并发，记录真实路由；未知费用／用量显示未知，不按零计量。不得未经用户确认改模型或触发额外付费回退。
- **沙箱**：继续只向工作流脚本注入有限能力，不开放原始 Host 对象、文件句柄或任意网络／进程接口。注入 MCP 工具不代表其底层外部访问已经安全；文件、网络及进程动作仍受宿主实际策略约束。

### 5. 持久化、取消与兼容性不变量

1. **所有有外部效果的操作都是正式节点。** 编译器赋予稳定站点，运行时分配实例序号；模型调用、判断和工具调用有可追踪的 kind、输入摘要／哈希、路由或工具身份、结果与错误，不隐身为一段不可追踪的脚本。
2. **先记录意图，再派发。** 同一调用身份绑定 run、站点、实例、操作类型、输入哈希及必要的路由／schema 版本。同一身份不同载荷必须拒绝，不能拿旧结果顶替新请求。MCP 标注或工具名称不是安全重放的充分依据。
3. **结果先持久化，再交付脚本和通知 UI。** 关键节点状态、结果与结算事件使用现有存储的同一事务；事务成功后再发布。外部 API 与 SQLite 不构成跨系统事务，数据库回滚不能当作外部写入未发生。
4. **恢复复用已完成结果。** 已完成模型／分类／工具节点不得因重启再次付费或重发。已派发却未记录终局的付费调用及写入默认视为结果未知：能按原请求身份核对的先核对，否则保留人工门禁，不以“可重试错误”自动重发。
5. **取消等待与取消工作分开。** Stop 必须传播到模型流、工具、沙箱和自有子代理，并等待现有 cleanup／quiesce 收口；“结果已返回”“请求过 kill”“连接断开”都不证明外部工作已停止。`manager-settled` 只表示管理阶段结束，不单独代表成功；清理失败保留诊断。
6. **检查点与展示状态分开。** [当前 NodeRecordStatus](<vendor/zcode/dynamic-workflow/src/engine/types.ts>) 只有 running／completed／failed，[恢复分支](<vendor/zcode/dynamic-workflow/src/engine/scheduler.ts>) 依赖该含义。停止后界面须显示已停止／已中断或待核对，但不能把原始 running 随手改成 completed／failed 来掩盖状态问题。
7. **升级不盲目重放。** 新运行记录编译／执行语义兼容指纹；恢复前检查站点映射、调用合同及必要 schema 的兼容性。旧运行缺指纹时明确为兼容性未知，保留只读检查及人工处理路径，不静默重写历史。合法 amend／fillHole 按显式修订更新兼容记录，不能误用旧缓存。
8. **两个真相域明确分工。** 工作流 journal 管编排节点与检查点，DSH 原生日志管 Agent 与工具执行历史，二者以调用／会话身份对账；不宣称跨库原子提交，也不复制一套 DSH 会话状态。历史 run ID、owner、cwd 与原生团队映射不随能力桥变化。

### 6. 分阶段实施与改动面

所有阶段均在用户确认本提案后才允许修改代码；后一阶段依赖前一阶段验收，不并行发布不兼容合同。没有真实 Classifier 时，阶段 B/C 的原生 Classifier 子项可独立保持不可用，其余闭环继续验收；不得因此把整个阶段虚报为原生分类已通过。

| 阶段 | 最小交付与涉及接缝 | 退出条件 |
| --- | --- | --- |
| A：合同与离线夹具 | 核对宿主模型能力／调用、工具执行、MCP scope、PTC 的精确合同；明确脚本 Interface、结果／错误形状、站点与节点种类；设计 mock 模型、mock MCP、未知效果与旧运行夹具 | 每个拟议调用均有已确认 Adapter 或明确的不可用行为；用户确认首批模型路由、MCP 范围与真实调用预算，不用猜测合同开工 |
| B：编译与受控能力桥 | 扩展 [站点](<vendor/zcode/dynamic-workflow/src/analysis/sites.ts>)、[分析](<vendor/zcode/dynamic-workflow/src/analysis/analyze.ts>)、[降级](<vendor/zcode/dynamic-workflow/src/lowering/lower.ts>)、[引擎类型](<vendor/zcode/dynamic-workflow/src/engine/types.ts>)，经 [runtime](<vendor/zcode/dynamic-workflow-runtime/src/harness.ts>)／[child bridge](<vendor/zcode/dynamic-workflow-runtime/src/child-source.ts>) 接入 Host；同步协议、类型声明与 help | fake 模型、规则／结构化判断、fake MCP 与已有 actor 可在一个脚本里顺序和并行调用；类型错误、未知能力及越权在派发前被拒绝；不改变旧脚本行为 |
| C：Host Adapter 与恢复 | [manager](<workflow/host/manager.js>)／[driver](<workflow/host/dsh-driver.js>) 接入直接模型与 scope 工具执行；[journal](<workflow/host/journal.js>) 支持相应节点、原子结算、调用身份与兼容记录；同步内存实现、合同测试及历史夹具；原生 Classifier 仅接已确认供应商接口 | 独立 Node 进程的故障注入证明完成结果复用、未知效果停放、停止收口和跨会话隔离；原生 Classifier 与聊天判断可被区分，缺能力不伪装成功 |
| D：图与人工操作 | 扩展 [graph](<workflow/client/graph.js>)／[UI](<workflow/client/ui.js>) 的真实模型、判断、工具与 Agent 节点；补状态投影、收口状态、详情和已有人工门禁；保持四图与主区域入口 | 四图、阶段、节点／日志、统计及 compact 输出一致；动态分支仅显示实际分析或执行事实；没有把所有新节点伪装成 Agent；键盘与窄桌面可操作 |
| E：正式集成与放行 | 同步 [构建](<scripts/build-workflow.mjs>)、[导出与 selfcheck 链](<package.json>)、[插件入口](<workflow/plugin.js>)、本地化、[来源许可](<vendor/zcode/PROVENANCE.md>) 和 [验收记录](<docs/verification.md>)；若需新增依赖或宿主插件，先说明并单独确认 | 离线自检、正式构建、安装状态、真实 GUI、授权真实调用、完整宿主中断恢复各自有证据；未测项仍列未知；未改其他会话／生产数据 |

PTC 是阶段 A 评估、后续按需启用的 actor 内工具组合 Adapter，不把“已打开 PTC”当作阶段 B/C 的持久能力桥交付。第一版优先复用现有供应商与 MCP 连接，不额外引入 Pi Durable／QuickJS 依赖；若发现无法满足隔离或恢复合同，应回到本节说明取舍并重新确认，不能悄悄换底座。

### 7. 验收清单

以下全部为**未执行**，勾选须附测试／调用／截图／存储回读证据。原生 Classifier 或真实付费／外部调用未授权时保持未测，不拿 mock 结果冒充已接通。

#### 7.1 能力与决策

- [ ] 无模型、无 Classifier 时，纯规则＋mock 工具脚本可完成；需要语义判断的分支能明确请求人工或报告能力不可用，其他独立分支行为符合脚本错误处理。
- [ ] 仅有聊天模型时，显式结构化判断可产生合法 choice／bool／score；错误 JSON、缺字段、未知标签、越界评分和模型中止不能驱动后续动作；结果不标为原生 Classifier。
- [ ] 明确选择原生 Classifier 时，核验真实模型类型、provider／model 和真实接口；不支持时给能力错误，不静默降级、换路由或增加费用。
- [ ] 同一脚本可显式调用两个已授权模型并行处理，再汇总；直接模型调用没有额外启动 Agent；复杂 actor 仍由原生 Teams 承载，模型允许列表、并发和预算不被绕过。
- [ ] 模型只可选择脚本允许的分支；模型输出工具名、代码、越权指令或“同意写入”文本不能替代宿主授权。

#### 7.2 MCP、Code mode 与安全

- [ ] mock MCP 覆盖工具目录、schema、成功、业务错误、离线、超时、断连；真实 MCP 仅在另获授权后验证，不以配置存在当作连接成功。
- [ ] 隐藏／禁止／未授权工具在目录、查找与执行中保持一致；含 PTC 嵌套调用时仍经过 guard、ask／deny、参数校验及结果记录，不能直调实现绕过权限。
- [ ] 脚本拿不到供应商密钥、授权头、原始 Host 对象或任意网络／进程入口；工具／模型响应中的提示注入不能改变授予脚本的能力集合。
- [ ] 原生 MCP／本地工具结果可在脚本中筛选、聚合后传给模型；完整结果有受控检索入口，省略／截断有标记，不编造“已省 token”或“已加速”。
- [ ] PTC 如启用，额外覆盖 typed submit 只结算一次、禁止第二套编排、嵌套取消 drain、工具写入后脚本失败仍保留未知／已发生效果事实；不把内存 REPL 当作跨重启持久化。
- [ ] 超时、输出大小、输入大小、内存与并发限制沿真实执行路径生效；分别测试同步死循环、未兑现 promise、大结果和取消中的工具，测试在临时资源内运行，不接生产写接口。

#### 7.3 持久化、兼容与状态

- [ ] 在“意图提交前、提交后派发前、派发后结果未知、结果提交后交付前”注入中断；重开只读取完整提交，不重复已完成的模型／工具调用；未派发与结果未知可以区分。
- [ ] 对真正结果未知的付费或写入调用，恢复先核对原请求或进入人工门禁；用户未明确决策前不重发。人工 accept 的结果须满足原节点 schema，retry 的授权与新尝试可追踪。
- [ ] 同一调用身份相同输入复用结果，不同输入／模型路由／工具合同按兼容规则拒绝或显式修订；并行结果的记录与交付次序不会改变重放分支。
- [ ] stop 后四图、阶段、详情、计数及工具 compact 输出不再显示该运行仍有“运行中”节点；原始检查点保留；resume 后未完成节点可续跑，完成节点不重复执行，unknown 仍显示待核对。
- [ ] fake cleanup 延迟时可见收口中，不能抢先 resume／launch；真实进程／子代理退出后才宣称资源收口，清理失败保留诊断；只是停止等待不会误报已停止工作。
- [ ] 相同脚本遇到不兼容的编译／运行语义指纹时拒绝盲目恢复；旧记录缺指纹保留未知和可读性；合法 amend／fillHole 不误用旧结果或改写其他运行。
- [ ] 覆盖运行归属、会话切换、刷新、SSE 重连／卸载、旧脚本及旧节点夹具；不改变历史 run ID、owner、cwd、原生团队映射和输入预测功能。

#### 7.4 交付与真实闭环

- [ ] 按现有 test／selfcheck 入口补齐编译、协议、Host、内存／SQLite 合同、driver、Client 与迁移夹具测试；新增路径不能只靠源码关键词自检。
- [ ] 正式构建、生成产物与导出入口一致；修改 vendor 保留许可；安装返回 applied 与实际功能通过分开记录。
- [ ] 在原签名 DSH 中取得模型／判断／MCP／Agent 节点的真实 GUI 证据，桌面与窄桌面可达，状态、用量与存储逐项一致；未测主题／尺寸明确保留未知。
- [ ] 经用户确认模型、预算、MCP 范围和中断方式后，再运行一条受控真实闭环并验完整宿主重启恢复；付费与外部写入验收单独授权，未授权不执行。
- [ ] 放行记录分别列出设计确认、源码／测试、构建、安装、GUI、真实供应商／MCP、宿主重启结果及未测项；没有原生 Classifier 的环境不标原生分类通过，但可单独批准规则／结构化聊天判断闭环。

### 8. 待确认事项与实施门槛

需用户确认的是：**是否认可本节目标与分工、决策模型可选且不静默回退、首批闭环范围及上述阶段／验收门槛。** 设计确认不自动授权购买／配置模型、接入新 MCP、执行付费调用、外部写入或故障注入；阶段 A 再列出具体路由、工具、数据范围、预算与运行方式供确认。

确认前本节保持提案；确认后按阶段更新状态，不将未完成项预先勾选。API 名称、原生 Classifier Adapter、工具 scope 的具体挂载方式及兼容指纹组成仍须阶段 A 精确核验，出现实质取舍变化时先更新本节并重新确认。

### 9. 依据与证据边界

- 当前源码依据见本节各模块链接；宿主合同通过本轮 Cordis Inspect 的 `Service.llm`、`Service.tools`、`Config include:tools` 与 `Config include:ptc-runtime` 核验。合同可见不等于全部供应商或 MCP 连接已运行验收。
- [Pi Durable：执行意图与重放策略](https://github.com/earendil-works/pi/blob/136b87e8a7f5a3e5186de0289523ba327dc592fc/packages/durable/src/harness/tool.ts#L163-L210)、[父子任务收口](https://github.com/earendil-works/pi/blob/136b87e8a7f5a3e5186de0289523ba327dc592fc/packages/durable/src/harness/scheduler.ts#L1937-L1976)。借鉴提交与所有权合同，不承诺外部 API exactly-once。
- [Pi Codemode：确定性重跑](https://github.com/earendil-works/pi/blob/136b87e8a7f5a3e5186de0289523ba327dc592fc/packages/codemode/README.md#L314-L343)、[Durable 集成](https://github.com/earendil-works/pi/blob/136b87e8a7f5a3e5186de0289523ba327dc592fc/packages/durable/src/codemode/codemode.ts#L1-L35)、[原生分类调用](https://github.com/earendil-works/pi/blob/136b87e8a7f5a3e5186de0289523ba327dc592fc/packages/durable/src/codemode/models.ts#L252-L268)。它们是固定提交的研究参考，不是当前 Composer 已接通这些能力的证据。
