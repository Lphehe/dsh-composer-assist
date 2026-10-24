import { graphModel, graphEdgePoints, nodeState, phaseModel, siteProgress, workflowView, actorBadge } from './graph.js'
import { createArtifactView } from './artifact.js'
import { WORKFLOW_VIEW_ID, workflowSelection, workflowEditorState } from './navigation.js'

const SAMPLE = `interface Finding { summary: string; risks: string[] }
const reader = agent("调查员", { system: "只读检查项目，按要求返回结构化结论。" });
const reviewer = agent("复核员", { system: "独立核对调查结果，只读操作。" });
phase("调查");
const finding = await reader.ask<Finding>("查看项目结构，说明核心入口与值得关注的风险。");
report(finding);
phase("复核");
const review = await reviewer.ask("核对这份结论：" + JSON.stringify(finding));
await artifact.markdown("report", review, { title: "项目复核报告", primary: true });
return { finding, review };`
const API = '/api/composer-assist/workflow'
const NS = 'composerWorkflow'
const zh = {
  model: '执行模型', inheritModel: '按会话设置选择', clipped: '当前显示部分记录，可加载其余记录。', other: '其他', invalidPreset: '看板规格无效，请检查工作流定义', download: '下载 Markdown', loadMore: '加载更多', title: '工作流', mainEntryHint: '完整流程见上方「工作流」页签', close: '关闭工作流', create: '新建', history: '运行记录', saved: '已保存',
  empty: '还没有工作流。编写脚本，分析流程后即可运行。', name: '工作流名称', script: 'TypeScript 脚本', args: '参数（JSON 对象）', concurrency: '并发任务',
  analyze: '分析流程', run: '确认并运行', stop: '停止运行', resume: '断点恢复', amend: '修改后续跑', save: '保存流程', project: '当前项目', global: '全局',
  graph: '依赖图', causality: '执行顺序', flow: '控制流', handoff: '阶段交接', overview: '流程图', details: '节点与日志', results: '结果与产物',
  ready: '分析通过，请确认脚本和流程图后运行。', stale: '脚本已修改，先重新分析。', billing: '运行会调用真实子 Agent，并使用当前会话的工具权限与模型额度。',
  node: '节点详情', noNode: '点击流程图节点查看任务、结果和错误。', events: '执行日志', pending: '待执行', running: '运行中', completed: '已完成',
  failed: '失败', errored: '失败', stopped: '已停止', cancelled: '已停止', interrupted: '已中断', draft: '待确认', held: '等待核对', waiting: '等待处理',
  questions: '待处理问题', answer: '提交回答', holds: '中断操作待核对', holdNote: '核对原操作是否已完成。重试会重新执行该节点；已有结果请填入经确认的 JSON。', retry: '确认未完成，重试', accept: '采用已核实结果',
  noResults: '尚无结果或产物。', noEvents: '尚无运行事件。', reports: '渐进报告', output: '最终结果', refresh: '重新连接', connected: '实时连接', disconnected: '连接中断',
  loading: '处理中…', invalidArgs: '参数必须是 JSON 对象', selected: '当前实例', zoomIn: '放大流程图', zoomOut: '缩小流程图', fit: '适应窗口',
  emptyGraph: '分析脚本后显示完整执行图。', savedHint: '选择保存的流程，确认脚本和参数后再次运行。', untitled: '新工作流', inputAnswer: '填写回答', holes: '流程留白', fill: '填入代码',
  unknown: '未知', cached: '已复用', superseded: '已由新实例续接', source: '原实例', tools: 'API 说明', useSample: '载入示例', sampleHint: '示例：只读调查后复核',
}
const en = Object.fromEntries(Object.keys(zh).map(key => [key, key]))
Object.assign(en, { model: 'Execution model', inheritModel: 'Use session selection', loadMore: 'Load more', download: 'Download Markdown', fill: 'Fill with code', other: 'Other', fit: 'Fit view', invalidPreset: 'Invalid artifact preset', title: 'Workflows', mainEntryHint: 'Open the Workflows tab above for the full workflow', close: 'Close workflows', create: 'New', history: 'Runs', saved: 'Saved', analyze: 'Analyze', run: 'Confirm and run', stop: 'Stop', resume: 'Resume', amend: 'Amend and continue', save: 'Save workflow', graph: 'Dependencies', causality: 'Execution order', flow: 'Control flow', handoff: 'Phase handoffs', overview: 'Graph', details: 'Nodes and log', results: 'Results and artifacts', ready: 'Analysis passed. Review the script and graph before running.', stale: 'The script changed. Analyze it again.', billing: 'Runs use real subagents, model quota and the tools permitted in this session.', connected: 'Live', disconnected: 'Disconnected', loading: 'Working…', empty: 'Write a script and analyze it to start a workflow.', emptyGraph: 'Analyze the script to see its execution graph.', name: 'Workflow name', script: 'TypeScript script', args: 'Arguments (JSON object)', concurrency: 'Concurrent tasks', project: 'Project', global: 'Global', untitled: 'New workflow', tools: 'API reference', useSample: 'Load example' })

Object.assign(zh, { mainTitle: '工作流', timeline: '阶段进度', stages: '阶段', actors: '子代理', tasks: '任务', tokens: 'Tokens', artifacts: '产物', authoring: '编辑与运行', stepProgress: '已完成/已创建步骤', invalidResource: '工作流页签地址无效或不属于当前会话'  })
Object.assign(en, { mainTitle: 'Workflows', timeline: 'Phase timeline', stages: 'stages', actors: 'actors', tasks: 'tasks', tokens: 'tokens', artifacts: 'Artifacts', authoring: 'Edit and run', stepProgress: 'completed/created steps', invalidResource: 'Invalid workflow resource or parent session mismatch' })

Object.assign(zh, { structuralSource: '输入', structuralSink: '输出', structuralJoin: '汇合', structuralFanOut: '分发', structuralMark: '阶段', structuralEntry: '入口', structuralAbort: '中止', structuralTest: '判断', structuralNode: '结构', selectWorkflow: '选择运行或已保存流程', newWorkflow: '新建工作流', editScript: '编辑脚本', hideEditor: '收起脚本', saveScope: '保存位置', graphKind: '流程图类型', zoom: '画布缩放', zoomOutShort: '缩小', zoomInShort: '放大', actualSize: '原始大小', canvasHint: '选择节点查看详情；使用滚动条浏览画布', emptyGraphTitle: '流程将呈现在这里', noInstruction: '尚无已保留的任务指令', nodes: '节点', connections: '连接', backToGraph: '返回流程图' })
Object.assign(en, { structuralSource: 'Input', structuralSink: 'Output', structuralJoin: 'Join', structuralFanOut: 'Fan out', structuralMark: 'Phase', structuralEntry: 'Entry', structuralAbort: 'Abort', structuralTest: 'Condition', structuralNode: 'Structure', selectWorkflow: 'Select a run or saved workflow', newWorkflow: 'New workflow', editScript: 'Edit script', hideEditor: 'Hide script', saveScope: 'Save location', graphKind: 'Graph type', zoom: 'Canvas zoom', zoomOutShort: 'Zoom out', zoomInShort: 'Zoom in', actualSize: 'Actual size', canvasHint: 'Select a node to inspect; scroll to explore the canvas', emptyGraphTitle: 'Your workflow appears here', noInstruction: 'No retained task instruction yet', nodes: 'nodes', connections: 'connections', backToGraph: 'Back to graph' })

const css = `
.caw-center,.caw-dock { box-sizing:border-box;height:100%;min-width:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);container-type:inline-size }
.caw-center { padding:20px clamp(12px,2vw,24px) 24px }
.caw-panel { height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary) }
.caw-panel * { box-sizing:border-box }
.caw-sticky { position:sticky;top:0;z-index:2;flex:none;background:var(--dsw-alias-bg-base) }
.caw-top { display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:10px }
.caw-selection { display:flex;align-items:center;gap:8px;min-width:0;flex:1 }
.caw-selection select { width:100%;max-width:360px;font-weight:600 }
.caw-selection>.caw-meta { flex:none;white-space:nowrap }
.caw-header-actions { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto }
.caw-run-heading { display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0 }
.caw-run-heading h2 { margin:0;font-size:18px;line-height:1.4;font-weight:650;overflow-wrap:anywhere }
.caw-run-context { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0 0 12px }
.caw-run-id,.caw-task-site { color:var(--dsw-alias-label-secondary);font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere }
.caw-meta,.caw-note { color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-note { margin:0;max-width:75ch }
.caw-summary-metrics { display:flex;gap:16px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums }
.caw-summary-metrics strong { color:var(--dsw-alias-label-primary);font-weight:600 }
.caw-row { display:flex;align-items:center;gap:8px;flex-wrap:wrap }
.caw-row label { flex:1;min-width:140px }
.caw-btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;line-height:1.5;white-space:nowrap }
.caw-btn:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2) }
.caw-btn:active:not(:disabled) { border-color:var(--dsw-alias-brand-primary) }
.caw-btn:disabled { opacity:.45;cursor:not-allowed }
.caw-btn.primary { background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-brand-primary) }
.caw-btn.primary:hover:not(:disabled) { background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,var(--dsw-alias-label-primary)) }
.caw-panel input,.caw-panel select,.caw-panel textarea { min-width:0;max-width:100%;min-height:34px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;caret-color:var(--dsw-alias-brand-primary) }
.caw-panel select { cursor:pointer }
.caw-panel textarea { resize:vertical;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;tab-size:2 }
.caw-panel :focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px }
.caw-panel ::selection { background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent) }
.caw-panel a { color:var(--dsw-alias-brand-primary);text-underline-offset:3px }
.caw-body { display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;scrollbar-color:var(--dsw-alias-border-l2) transparent }
.caw-main { display:flex;flex-direction:column;min-width:0;min-height:300px;flex:1 }
.caw-tabs { display:flex;align-items:center;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 0 10px }
.caw-tabs .caw-btn { border-color:transparent;background:transparent;padding-inline:14px }
.caw-tabs .caw-btn[aria-pressed=true] { color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-base)) }
.caw-content { display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;padding-top:12px }
.caw-content>* { flex-shrink:0 }
.caw-graph-shell { display:flex;flex-direction:column;flex:1;min-height:280px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1) }
.caw-graph-toolbar { flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base) }
.caw-graph-kinds { display:flex;gap:3px;flex-wrap:wrap }
.caw-graph-kinds .caw-btn { background:transparent;border-color:transparent;min-height:30px;padding:4px 9px;font-size:11px }
.caw-graph-kinds .caw-btn[aria-pressed=true] { background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);font-weight:600 }
.caw-zoom { display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums }
.caw-zoom .caw-btn { padding:4px 8px;min-height:28px;font-size:11px }
.caw-zoom output { min-width:36px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:11px }
.caw-graph { display:flex;position:relative;overflow:auto;min-width:0;min-height:160px;flex:1;overscroll-behavior:contain;scrollbar-gutter:stable;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 3%,var(--dsw-alias-bg-layer-1));scrollbar-color:var(--dsw-alias-border-l2) transparent }
.caw-graph svg { display:block;flex:none;margin:auto }
.caw-phase-band { fill:color-mix(in srgb,var(--dsw-alias-bg-base) 65%,transparent);stroke:var(--dsw-alias-border-l1);stroke-width:1 }
.caw-edge { stroke:var(--dsw-alias-label-secondary);stroke-width:1.2;opacity:.55 }
.caw-edge[data-source=true] { stroke-width:1;opacity:.25 }
.caw-structural .caw-node-outline { fill:var(--dsw-alias-bg-layer-1);stroke:var(--dsw-alias-border-l1) }
.caw-structural-label { fill:var(--dsw-alias-label-secondary);font-size:11px;pointer-events:none }
.caw-svg-node { cursor:pointer;outline:none }
.caw-node-outline { fill:var(--dsw-alias-bg-base);stroke:var(--dsw-alias-border-l2);stroke-width:1 }
.caw-svg-node:hover .caw-node-outline { stroke:var(--dsw-alias-brand-primary) }
.caw-svg-node:focus-visible .caw-node-outline { stroke:var(--dsw-alias-brand-primary);stroke-width:3 }
.caw-svg-node[data-state=running] .caw-node-outline { stroke:var(--dsw-alias-brand-primary);stroke-width:1.5 }
.caw-svg-node[data-state=failed] .caw-node-outline { stroke:var(--dsw-alias-state-error-primary) }
.caw-graph-card { display:flex;flex-direction:column;gap:8px;height:100%;padding:12px 14px;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.4;pointer-events:none }
.caw-node-badge { flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;font-size:10px;font-weight:650;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,currentColor 12%,var(--dsw-alias-bg-base));border:1px solid color-mix(in srgb,currentColor 24%,transparent) }
.caw-node-badge[data-color="1"] { color:var(--dsw-alias-state-success-primary) }
.caw-node-badge[data-color="2"] { color:var(--dsw-alias-label-secondary) }
.caw-node-head { display:flex;align-items:center;gap:8px;min-width:0 }
.caw-node-label { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600 }
.caw-node-head .caw-state { flex:none;font-size:10px }
.caw-node-instruction { height:32px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;overflow-wrap:anywhere }
.caw-node-source { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font:10px/14px ui-monospace,SFMono-Regular,Consolas,monospace }
.caw-graph-footer { flex:none;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 14px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:11px }
.caw-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:300px;padding:32px;text-align:center;color:var(--dsw-alias-label-secondary) }
.caw-empty h3 { margin:0;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600 }
.caw-skeleton { width:min(420px,85%);height:14px;border-radius:4px;background:var(--dsw-alias-bg-layer-2) }
.caw-skeleton:nth-child(2) { width:min(280px,65%) }
.caw-editor { flex:none;margin:0 0 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden }
.caw-editor-title { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1) }
.caw-editor-title h3 { margin:0;font-size:15px;font-weight:600 }
.caw-editor-fields { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 20px;padding:18px }
.caw-editor-fields>label:first-child,.caw-editor-fields>.caw-script,.caw-editor-fields>details,.caw-editor-fields>.caw-row { grid-column:1 / -1 }
.caw-editor label { display:flex;flex-direction:column;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-script { min-width:0 }
.caw-script textarea { min-height:300px;flex:1;resize:vertical;background:var(--dsw-alias-bg-base) }
.caw-editor-actions { display:flex;flex-direction:column;gap:10px;padding:14px 18px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base) }
.caw-editor-actions .caw-row { justify-content:space-between }
.caw-state { font-size:11px;display:inline-flex;gap:5px;align-items:center;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums }
.caw-state[data-state=running] { color:var(--dsw-alias-brand-primary) }
.caw-state[data-state=completed] { color:var(--dsw-alias-state-success-primary) }
.caw-state[data-state=failed],.caw-state[data-state=errored],.caw-error { color:var(--dsw-alias-state-error-primary) }
.caw-error { margin:0 0 14px;padding:12px 16px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow-wrap:anywhere;display:flex;align-items:center;gap:12px;flex-wrap:wrap }
.caw-section { margin-top:24px;min-width:0 }
.caw-section:first-child { margin-top:0 }
.caw-section h3,.caw-content>h3 { margin:0 0 12px;font-size:15px;font-weight:600 }
.caw-code { margin:10px 0;background:var(--dsw-alias-bg-layer-1);padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace }
.caw-log { padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;overflow-wrap:anywhere }
.caw-log time { color:var(--dsw-alias-label-secondary);margin-right:12px;font-variant-numeric:tabular-nums }
.caw-panel summary { cursor:pointer;padding:6px 0;color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-panel table { border-collapse:collapse;width:100%;font-size:12px }
.caw-panel th,.caw-panel td { padding:9px 12px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top;overflow-wrap:anywhere }
.caw-metrics { display:flex;gap:24px;flex-wrap:wrap }
.caw-metrics strong { display:block;font-size:22px;font-variant-numeric:tabular-nums }
.caw-board { display:flex;gap:12px;overflow:auto }
.caw-board>section { flex:1;min-width:150px;background:var(--dsw-alias-bg-layer-1);padding:12px;border-radius:8px }
.caw-timeline { display:flex;flex-direction:column;gap:20px }
.caw-phase { border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden }
.caw-phase>summary { display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px;background:var(--dsw-alias-bg-layer-1);list-style:revert }
.caw-phase>summary strong { color:var(--dsw-alias-label-primary);font-size:13px }
.caw-phase>summary .caw-meta { margin-left:auto;font-variant-numeric:tabular-nums }
.caw-task { display:flex;flex-direction:column;gap:8px;width:100%;text-align:left;padding:14px 16px;border:0;border-top:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;overflow-wrap:anywhere }
.caw-task:hover { background:var(--dsw-alias-bg-layer-1) }
.caw-task-head { display:flex;align-items:center;gap:10px;flex-wrap:wrap }
.caw-task-head>.caw-state { margin-left:auto }
.caw-task-instruction { color:var(--dsw-alias-label-secondary);font-size:12px;max-width:75ch }
.caw-intervention { padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);margin-bottom:16px }
.caw-intervention textarea { width:100%;margin:10px 0 }
.caw-detail-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px }
.caw-detail-heading h3 { margin:0;font-size:15px }
@container(max-width:720px) { .caw-editor-fields { grid-template-columns:minmax(0,1fr) }.caw-header-actions { width:100%;margin-left:0;gap:6px }.caw-selection { flex-basis:100% }.caw-selection select { max-width:none }.caw-run-context { align-items:flex-start }.caw-graph-toolbar { align-items:flex-start }.caw-graph-kinds,.caw-zoom { width:100%;flex-wrap:wrap }.caw-summary-metrics { gap:6px 12px }.caw-run-heading h2 { font-size:15px }.caw-script textarea { min-height:240px } }
@media(prefers-reduced-motion:reduce) { .caw-panel * { scroll-behavior:auto;transition:none;animation:none } }
.caw-card .caw-btn,.caw-tool .caw-btn { display:inline-block;min-height:0;padding:6px 10px;border-radius:6px;font:inherit }
.caw-card .caw-error,.caw-tool .caw-error { margin:0;padding:10px 16px;border:0;border-radius:0;display:block }
.caw-card { border:1px solid var(--dsw-alias-border-l2);border-radius:10px;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);max-width:100%;margin:8px 0;font:inherit }.caw-card-summary { display:block;width:100%;padding:14px 16px;text-align:left;background:transparent;color:inherit;border:0;font:inherit }.caw-card-meta { display:block }.caw-card-summary strong { overflow-wrap:anywhere;min-width:0 }.caw-card footer .caw-btn { white-space:normal;overflow-wrap:anywhere;text-align:left }.caw-phase-progress { display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;overflow-wrap:anywhere }.caw-dot { flex:none }.caw-chip { display:inline-flex;flex-direction:column;align-items:center;gap:6px;max-width:120px;min-width:0;text-align:center }.caw-chip>span:last-child { min-width:0;overflow-wrap:anywhere }.caw-avatar { flex:none;display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:5px;background:color-mix(in srgb,currentColor 13%,var(--dsw-alias-bg-base));font-weight:650;border:1px solid color-mix(in srgb,currentColor 30%,transparent) }.caw-card .caw-meta { margin-top:7px }.caw-card footer { display:flex;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1) }.caw-card :focus-visible,.caw-tool :focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-3px }.caw-phase-dots { display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:12px 0 }.caw-dot { width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-border-l2) }.caw-dot[data-state=running] { background:var(--dsw-alias-brand-primary) }.caw-dot[data-state=completed] { background:var(--dsw-alias-state-success-primary) }.caw-dot[data-state=failed] { background:var(--dsw-alias-state-error-primary) }.caw-dot[data-state=waiting] { background:var(--dsw-alias-label-secondary) }.caw-chips { display:flex;gap:5px;flex-wrap:wrap }.caw-chip { padding:2px 7px;border-radius:5px;font-size:11px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);overflow-wrap:anywhere }.caw-chip[data-color="0"] { color:var(--dsw-alias-brand-primary) }.caw-chip[data-color="1"] { color:var(--dsw-alias-state-success-primary) }.caw-chip[data-color="2"] { color:var(--dsw-alias-label-secondary) }

`

export function installWorkflowUI(ctx, React) {
  const h = React.createElement
  const { useState, useEffect, useLayoutEffect, useRef } = React
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dynamic-workflow: dictionaries')
  const t = ctx.locale.bind(NS)
  const feeds = new Map()
  const mainSelections = new Map()
  const editorStates = new Map()
  function useFeed(sessionId, runId) {
    const [, redraw] = useState(0)
    let feed = feeds.get(sessionId)
    if (!feed) {
      feed = { collection: { runs: [], workflows: [] }, runs: new Map(), listeners: new Map(), queue: new Set(), live: false, error: '', pending: null }
      feeds.set(sessionId, feed)
    }
    const publish = () => { for (const listener of feed.listeners.keys()) listener() }
    const drain = () => {
      if (feed.pending) return feed.pending
      if (!feed.listeners.size || (!feed.collectionDirty && !feed.queue.size)) return Promise.resolve()
      const signal = feed.abort?.signal
      feed.pending = (async () => {
        try {
          while (feed.listeners.size && !signal?.aborted && (feed.collectionDirty || feed.queue.size)) {
            if (feed.collectionDirty) { feed.collectionDirty = false; feed.collection = await api(sessionId, undefined, signal); feed.collectionLoaded = true }
            const id = feed.queue.values().next().value
            if (id !== undefined) {
              feed.queue.delete(id)
              if ([...feed.listeners.values()].includes(id)) {
                const response = await fetch(`${API}/state?sessionId=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(id)}`, { credentials: 'same-origin', signal })
                const body = await response.json()
                if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
                feed.runs.set(id, body.value)
              }
            }
            feed.error = ''; publish()
          }
        } catch (err) { if (err.name !== 'AbortError') feed.error = err.message }
        finally { feed.pending = null; publish(); if (signal?.aborted && feed.listeners.size) void drain() }
      })()
      return feed.pending
    }
    const refresh = (id) => {
      feed.collectionDirty = true
      for (const watched of new Set(feed.listeners.values())) if (watched && (id === undefined || id === watched)) feed.queue.add(watched)
      return drain()
    }
    useEffect(() => {
      const update = () => redraw(value => value + 1)
      feeds.set(sessionId, feed)
      feed.listeners.set(update, runId)
      if (!feed.stream) {
        feed.abort = new AbortController()
        const stream = feed.stream = new EventSource(`${API}/events?sessionId=${encodeURIComponent(sessionId)}`, { withCredentials: true })
        stream.onopen = () => { feed.live = true; publish(); void refresh() }
        stream.onerror = () => { feed.live = false; publish() }
        stream.onmessage = message => {
          let event
          try { event = JSON.parse(message.data) } catch { return }
          if (typeof event.runId !== 'string') return
          feed.changed ??= new Set()
          feed.changed.add(event.runId)
          if (!feed.timer) feed.timer = setTimeout(() => {
            feed.timer = null; feed.collectionDirty = true
            for (const id of feed.changed) if ([...feed.listeners.values()].includes(id)) feed.queue.add(id)
            feed.changed.clear(); void drain()
          }, 120)
        }
      }
      if (!runId || !feed.runs.has(runId)) void refresh(runId)
      return () => {
        feed.listeners.delete(update)
        if (!feed.listeners.size) { clearTimeout(feed.timer); feed.timer = null; feed.stream.close(); feed.stream = null; feed.abort.abort(); feeds.delete(sessionId) }
      }
    }, [sessionId, runId])
    return { ...feed, refresh: () => refresh(runId) }
  }
  async function api(sessionId, input, signal) {
    const result = input === undefined
      ? await fetch(`${API}/state?sessionId=${encodeURIComponent(sessionId)}`, { credentials: 'same-origin', signal })
      : await fetch(`${API}/action`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, sessionId }), signal })
    const body = await result.json()
    if (!result.ok || body.ok !== true) throw new Error(body.error ?? `HTTP ${result.status}`)
    return body.value
  }
  const code = value => h('pre', { className: 'caw-code' }, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
  const button = (label, onClick, disabled = false, primary = false, extra = {}) => h('button', { type: 'button', className: `caw-btn${primary ? ' primary' : ''}`, onClick, disabled, ...extra }, label)
  const state = status => h('span', { className: 'caw-state', 'data-state': status }, t(status ?? 'unknown'))

  function FlowGraph({ analysis, kind, setKind, run, onNode }) {
    const [zoom, setZoom] = useState(1)
    const markerId = React.useId()
    const [availableWidth, setAvailableWidth] = useState(undefined)
    const model = graphModel(analysis, kind, availableWidth)
    const graphRef = useRef(null)
    const fit = () => setZoom(Math.min(1, Math.max(.25, ((graphRef.current?.clientWidth ?? model.width) - 2) / model.width)))
    useLayoutEffect(() => {
      const element = graphRef.current
      if (!element) return
      const measure = () => {
        const width = element.clientWidth
        if (width > 0) setAvailableWidth(previous => previous === width ? previous : width)
      }
      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }, [])
    useLayoutEffect(() => { setZoom(1) }, [availableWidth])
    useLayoutEffect(() => {
      setZoom(1)
      if (graphRef.current) { graphRef.current.scrollTop = 0; graphRef.current.scrollLeft = 0 }
    }, [analysis, kind])
    const sourceIds = new Set(model.nodes.filter(node => node.kind === 'source' || node.id === 'entry').map(node => node.id))
    const tasks = phaseModel(run ?? { analysis }).flatMap(phase => phase.tasks)
    const instructions = new Map(tasks.map(task => [task.source ?? task.id, task.instruction]))
    return h('section', { className: 'caw-graph-shell', 'aria-label': t('overview') },
      h('div', { className: 'caw-graph-toolbar' },
        h('div', { className: 'caw-graph-kinds', role: 'group', 'aria-label': t('graphKind') }, ['graph', 'causality', 'flow', 'handoff'].map(value => button(t(value), () => setKind(value), false, false, { 'aria-pressed': kind === value }))),
        h('div', { className: 'caw-zoom', role: 'group', 'aria-label': t('zoom') },
          button(t('zoomOutShort'), () => setZoom(value => Math.max(.25, value - .15)), zoom <= .25, false, { 'aria-label': t('zoomOut') }),
          h('output', { 'aria-label': t('zoom') }, `${Math.round(zoom * 100)}%`),
          button(t('zoomInShort'), () => setZoom(value => Math.min(2, value + .15)), zoom >= 2, false, { 'aria-label': t('zoomIn') }),
          button(t('fit'), fit), button('100%', () => setZoom(1), false, false, { 'aria-label': t('actualSize') }))),
      h('div', { className: 'caw-graph', ref: graphRef, 'data-workflow-graph': kind, tabIndex: 0, 'aria-label': t('canvasHint') },
        !model.nodes.length ? h('div', { className: 'caw-empty' }, h('h3', null, t('emptyGraphTitle')), h('p', { className: 'caw-note' }, t('emptyGraph'))) :
        h('svg', { width: model.width * zoom, height: model.height * zoom, viewBox: `0 0 ${model.width} ${model.height}`, role: 'group', 'aria-label': t(kind) },
          h('defs', null, h('marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--dsw-alias-label-secondary)' }))),
          (model.groups ?? []).map(group => h('g', { key: group.id, role: 'group', 'aria-label': group.label },
            h('rect', { className: 'caw-phase-band', x: group.x, y: group.y, width: group.width, height: group.height, rx: 12 }),
            h('text', { x: group.x + 20, y: group.y + 28, fill: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 600 }, group.label),
            h('text', { x: group.x + group.width - 20, y: group.y + 28, textAnchor: 'end', fill: 'var(--dsw-alias-label-secondary)', fontSize: 11 }, `${group.taskCount} ${t('tasks')}`))),
          model.edges.map((edge, i) => {
            const d = graphEdgePoints(model, edge).map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')
            return h('path', { key: i, className: 'caw-edge', 'data-source': sourceIds.has(edge.from), d, fill: 'none', strokeDasharray: edge.exact === false ? '4 3' : undefined, markerEnd: `url(#${markerId})` }, h('title', null, `${edge.from} → ${edge.to}`))
          }),
          model.nodes.map(node => {
            const sites = node.sites ?? [node.id]
            const source = [...new Set([node.id, ...sites])].join(' · ')
            if (node.structural) {
              const structuralKey = { source: 'structuralSource', sink: 'structuralSink', join: 'structuralJoin', 'fan-out': 'structuralFanOut', mark: 'structuralMark', entry: 'structuralEntry', abort: 'structuralAbort', test: 'structuralTest' }[node.kind ?? node.id] ?? 'structuralNode'
              const label = t(structuralKey)
              return h('g', { key: node.id, className: 'caw-svg-node caw-structural', role: 'button', tabIndex: 0, 'aria-label': `${label} · ${source}`, onClick: () => onNode(node), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNode(node) } } },
                h('title', null, `${label}\n${node.label}\n${source}`),
                h('rect', { className: 'caw-node-outline', x: node.x, y: node.y, width: node.width, height: node.height, rx: 6 }),
                h('text', { className: 'caw-structural-label', x: node.x + node.width / 2, y: node.y + node.height / 2, textAnchor: 'middle', dominantBaseline: 'central' }, label))
            }
            const states = sites.map(id => nodeState(run?.siteStates ?? run?.nodes, id))
            const status = states.includes('running') ? 'running' : states.includes('failed') ? 'failed' : states.includes('cancelled') ? 'cancelled' : states.includes('stopped') ? 'stopped' : states.length && states.every(value => value === 'completed') ? 'completed' : 'pending'
            const actors = (run?.actors ?? []).filter(actor => node.actorIds?.includes(actor.siteId))
            const label = actors.length ? [...new Set(actors.map(actor => actor.name ?? actor.siteId))].join(' · ') : node.label
            const badge = node.actorIds?.length ? actorBadge(actors[0] ?? { siteId: node.actorIds[0], name: label }) : null
            const instruction = sites.map(id => instructions.get(id)).filter(Boolean).join('\n')
            return h('g', { key: node.id, className: 'caw-svg-node', 'data-state': status, role: 'button', tabIndex: 0, 'aria-label': `${label} · ${t(status)} · ${source}${instruction ? ` · ${instruction}` : ''}`, onClick: () => onNode(node), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNode(node) } } },
              h('title', null, `${label}\n${source}\n${instruction || node.kind || ''}`),
              h('rect', { className: 'caw-node-outline', x: node.x, y: node.y, width: node.width, height: node.height, rx: 10 }),
              h('foreignObject', { x: node.x, y: node.y, width: node.width, height: node.height },
                h('div', { xmlns: 'http://www.w3.org/1999/xhtml', className: 'caw-graph-card' },
                  h('div', { className: 'caw-node-head' }, badge && h('span', { className: 'caw-node-badge', 'data-color': badge.color }, badge.initial), h('span', { className: 'caw-node-label' }, label), state(status)),
                  h('div', { className: 'caw-node-instruction' }, instruction || node.kind || t('noInstruction')),
                  h('div', { className: 'caw-node-source' }, source))))
          }))),
      h('footer', { className: 'caw-graph-footer' }, h('span', null, `${model.nodes.length} ${t('nodes')} · ${model.edges.length} ${t('connections')}`), h('span', null, t('canvasHint'))))
  }

  const Artifact = createArtifactView(React, { api, t, code, downloadUrl: (sessionId, runId, item) => `${API}/artifact?sessionId=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(runId)}&artifactId=${encodeURIComponent(item.id)}&version=${encodeURIComponent(item.version ?? 1)}` })

  function Metrics({ run }) {
    const progress = siteProgress(run.siteStates)
    return h('div', { className: 'caw-summary-metrics' }, [
      [t('actors'), run.actors?.length], [t('stepProgress'), `${progress.completed}/${progress.total}`], [t('tokens'), run.spentTokens], [t('reports'), run.counts?.reports], [t('artifacts'), run.counts?.artifacts],
    ].map(([label, value]) => h('span', { key: label }, h('strong', null, value === undefined ? '—' : value.toLocaleString()), ' ', label)))
  }
  function ActorChips({ actors, limit = actors.length }) {
    return h('span', { className: 'caw-chips' }, actors.slice(0, limit).map(actor => {
      const badge = actorBadge(actor)
      return h('span', { key: `${actor.siteId}:${actor.ordinal}`, className: 'caw-chip', 'data-color': badge.color, title: `${actor.siteId}@${actor.ordinal}` }, h('span', { className: 'caw-avatar', 'aria-hidden': true }, badge.initial), h('span', null, actor.name ?? `${actor.siteId}@${actor.ordinal}`))
    }), actors.length > limit && h('span', { className: 'caw-chip' }, `+${actors.length - limit} ${t('actors')}`))
  }
  function Timeline({ run, onNode }) {
    const phases = phaseModel(run)
    if (!phases.length) return h('p', { className: 'caw-note' }, t('emptyGraph'))
    return h('div', { className: 'caw-timeline' }, phases.map(phase => h('details', { key: phase.id, className: 'caw-phase', open: true },
      h('summary', null, state(phase.status), h('strong', null, phase.name ?? t('other')), h('span', { className: 'caw-meta' }, `${phase.completed}/${phase.total} ${t('stepProgress')}`)),
      phase.tasks.map(task => {
        const actors = (run.actors ?? []).filter(actor => (task.lanes ?? [task.lane]).includes(actor.siteId))
        return h('button', { key: task.id, className: 'caw-task', type: 'button', onClick: () => onNode({ ...task, sites: [task.source ?? task.id] }) },
          h('span', { className: 'caw-task-head' }, actors.length ? h(ActorChips, { actors }) : h('strong', null, task.label ?? task.id), h('code', { className: 'caw-task-site' }, task.source ?? task.id), state(nodeState(run.siteStates, task.source ?? task.id))),
          task.instruction && h('span', { className: 'caw-task-instruction', title: task.instruction }, task.instruction))
      }))))
  }
  function Panel({ sessionId, runId, navigation, onNavigate, main = false }) {
    const navigate = onNavigate
    const editor = useRef(workflowEditorState(editorStates.get(sessionId), runId, navigation?.params?.saved)).current
    const cached = editor.draft
    const firstRevision = useRef(navigation?.revision).current
    const [selected, setSelected] = useState(runId), [localRun, setRun] = useState(null)
    const feed = useFeed(sessionId, selected)
    const collection = feed.collection
    const run = feed.runs.get(selected) ?? localRun
    const mergeRows = (base, extra, key) => [...new Map([...(extra ?? []), ...(base ?? [])].map(row => [key(row), row])).values()]
    const [script, setScript] = useState(cached?.script ?? SAMPLE), [name, setName] = useState(cached?.name ?? t('untitled'))
    const [argsText, setArgsText] = useState(cached?.argsText ?? '{}'), [concurrency, setConcurrency] = useState(cached?.concurrency ?? 4), [scope, setScope] = useState(cached?.scope ?? 'project')
    const [analysis, setAnalysis] = useState(cached?.analysis ?? null), [analyzedScript, setAnalyzedScript] = useState(cached?.analyzedScript ?? '')
    const [tab, setTab] = useState(cached?.tab ?? workflowView(navigation?.params?.view)), [kind, setKind] = useState(cached?.kind ?? 'graph'), [picked, setPicked] = useState(cached?.picked ?? null)
    const [error, setError] = useState(''), [busy, setBusy] = useState(false)
    const [editorOpen, setEditorOpen] = useState(cached?.editorOpen ?? !runId)
    const [modelRoute, setModelRoute] = useState(cached?.modelRoute ?? '')
    const [pageMore, setPageMore] = useState({})
    const [additionalNodes, setAdditionalNodes] = useState(null), [additionalEvents, setAdditionalEvents] = useState(null), [additionalReports, setAdditionalReports] = useState(null)
    const [answers, setAnswers] = useState(cached?.answers ?? {}), [apiHelp, setApiHelp] = useState(null)
    const refresh = feed.refresh
    useEffect(() => { if (!cached || navigation?.revision !== firstRevision) setTab(workflowView(navigation?.params?.view)) }, [navigation?.revision])
    useEffect(() => {
      const saved = navigation?.params?.saved
      if (saved && (!cached || navigation?.revision !== firstRevision)) { setSelected(null); setRun(null); setScript(saved.script); setName(saved.name); setScope(saved.scope); setAnalysis(null); setPicked(null); setEditorOpen(true) }
    }, [navigation?.revision])
    const initialized = useRef(cached?.initialized ?? null)
    const editorSnapshot = useRef(null)
    editorSnapshot.current = { key: editor.key, draft: { script, name, argsText, concurrency, scope, analysis, analyzedScript, tab, kind, picked, modelRoute, answers, editorOpen, initialized: initialized.current } }
    // The native main view unmounts on tab switches; keep unsaved authoring state.
    useEffect(() => () => { editorStates.set(sessionId, editorSnapshot.current) }, [sessionId])
    useEffect(() => {
      if (!run || initialized.current === run.id) return
      initialized.current = run.id
      setScript(run.script); setName(run.name); setAnalysis(run.analysis); setAnalyzedScript(run.script)
      setArgsText(JSON.stringify(run.args ?? {}, null, 2)); setConcurrency(run.concurrency ?? 4)
      setModelRoute(run.provider ? JSON.stringify({ provider: run.provider, model: run.model }) : '')
    }, [run])
    const perform = async input => {
      setBusy(true); setError('')
      try { const result = await api(sessionId, input); await refresh(); return result }
      catch (err) { setError(err.message); return null }
      finally { setBusy(false) }
    }
    const choose = row => navigate(row.id)
    const getArgs = () => {
      const value = JSON.parse(argsText)
      if (value === null || Array.isArray(value) || typeof value !== 'object') throw new Error(t('invalidArgs'))
      return value
    }
    const launch = async () => {
      try {
        const input = { script, name, args: getArgs(), concurrency: Number(concurrency), ...(modelRoute ? JSON.parse(modelRoute) : {}) }
        const draft = selected && run?.status === 'draft' && run.script === script && run.name === name && run.concurrency === input.concurrency && JSON.stringify(run.args ?? {}) === JSON.stringify(input.args) && run.provider === input.provider && run.model === input.model ? run : await perform({ action: 'create', ...input })
        if (!draft) return
        const result = await perform({ action: 'launch', id: draft.id })
        if (result) { navigate(result.id) }
      } catch (err) { setError(err.message) }
    }
    const pageCursors = useRef({ nodes: 0, reports: 0, events: -1 })
    useEffect(() => { pageCursors.current = { nodes: 0, reports: 0, events: -1 }; setPageMore({}); setAdditionalNodes(null); setAdditionalEvents(null); setAdditionalReports(null) }, [selected])
    const loadAll = async (action, setValue) => {
      setBusy(true); setError('')
      try {
        const cursor = pageCursors.current[action]
        const page = await api(sessionId, { action, id: selected, limit: 1000, ...(action === 'events' ? { afterSequence: cursor } : { after: cursor }) })
        const rows = page[action]
        setPageMore(previous => ({ ...previous, [action]: action === 'events' ? rows.length === 1000 : page.hasMore }))
        pageCursors.current[action] = action === 'events' ? (rows.at(-1)?.sequence ?? cursor) : page.nextCursor
        setValue(previous => {
          const values = new Map((previous ?? (action === 'events' ? run?.events : action === 'nodes' ? run?.nodes : run?.reports) ?? []).map(row => [action === 'events' ? row.sequence : `${row.instance?.siteId ?? row.siteId}:${row.instance?.ordinal ?? row.ordinal}`, row]))
          for (const row of rows) values.set(action === 'events' ? row.sequence : `${row.instance?.siteId ?? row.siteId}:${row.instance?.ordinal ?? row.ordinal}`, row)
          return [...values.values()]
        })
      } catch (err) { setError(err.message) } finally { setBusy(false) }
    }
    const valid = analysis?.ok === true && analyzedScript === script
    const visibleNodes = mergeRows(run?.nodes, additionalNodes, row => `${row.siteId}:${row.ordinal}`)
    const visibleEvents = mergeRows(run?.events, additionalEvents, row => row.sequence).sort((a,b) => a.sequence-b.sequence)
    const detailNodes = visibleNodes.filter(node => picked && (picked.sites ?? [picked.id]).some(id => node.siteId === id || node.site_id === id || node.id === id))
    const questions = (run?.questions ?? []).filter(question => question.status === 'waiting' && question.live !== false)
    const holds = (run?.holds ?? []).filter(hold => hold.state !== 'pending')
    const currentAnalysis = analyzedScript === script ? analysis : null
    const running = ['running', 'starting'].includes(run?.status)
    const displayId = run?.id ?? selected
    const runRows = (collection.runs ?? []).some(row => row.id === selected) || !selected ? collection.runs ?? [] : [{ id: selected, name: run?.name ?? selected, status: run?.status }, ...(collection.runs ?? [])]
    const savedRows = mergeRows(collection.workflows, navigation?.params?.saved ? [navigation.params.saved] : [], row => JSON.stringify([row.scope, row.name]))
    const savedIndex = savedRows.findIndex(row => row.scope === navigation?.params?.saved?.scope && row.name === navigation?.params?.saved?.name)
    const selectionValue = selected ? `run:${selected}` : savedIndex >= 0 ? `saved:${savedIndex}` : 'new'
    const selectWorkflow = value => {
      if (value === 'new') { setEditorOpen(true); navigate(null); return }
      const row = runRows.find(row => `run:${row.id}` === value)
      if (row) { choose(row); return }
      const saved = savedRows.find((row, index) => `saved:${index}` === value)
      if (saved) navigate(null, { saved })
    }
    const inspectNode = node => { setPicked(node); setTab('details') }
    return h('div', { className: main ? 'caw-center' : 'caw-dock' },
      h('style', null, css),
      h('section', { className: 'caw-panel', 'aria-label': run?.name ?? t('title'), 'data-workflow-panel': '', 'aria-busy': busy || Boolean(selected && !run && !feed.error) },
        h('div', { className: 'caw-sticky' },
        h('header', { className: 'caw-top' },
          h('div', { className: 'caw-selection' },
            h('select', { 'aria-label': t('selectWorkflow'), value: selectionValue, disabled: busy, onChange: event => selectWorkflow(event.target.value) },
              h('option', { value: 'new' }, t('newWorkflow')),
              runRows.length > 0 && h('optgroup', { label: t('history') }, runRows.map(row => h('option', { key: row.id, value: `run:${row.id}` }, `${row.name} · ${row.status ? `${t(row.status)} · ` : ''}${row.id.slice(0, 8)}`))),
              savedRows.length > 0 && h('optgroup', { label: t('saved') }, savedRows.map((row, index) => h('option', { key: `${row.scope}:${row.name}`, value: `saved:${index}` }, `${row.name} · ${t(row.scope)}`)))),
            h('span', { className: 'caw-meta', role: 'status' }, t(feed.live ? 'connected' : 'disconnected'))),
          h('div', { className: 'caw-header-actions' },
            button(t('create'), () => { setEditorOpen(true); navigate(null) }, busy),
            button(t(editorOpen ? 'hideEditor' : 'editScript'), () => setEditorOpen(value => !value), busy, false, { 'aria-expanded': editorOpen }),
            button(t('save'), () => perform({ action: 'save', name, script, scope }), busy || !valid),
            running && button(t('stop'), () => perform({ action: 'stop', id: selected }), busy),
            selected && run?.status === 'stopped' && run.stopReason !== 'superseded' && button(t('resume'), () => perform({ action: 'resume', id: selected }).then(value => { if (value) setRun(value) }), busy, true),
            valid && !running && !editorOpen && button(t('run'), launch, busy, true))),
        h('div', { className: 'caw-run-context' },
          h('div', { className: 'caw-run-heading' }, h('h2', null, run?.name ?? (selected ? t('loading') : name)), run && state(run.status), displayId && h('code', { className: 'caw-run-id', title: displayId }, displayId.slice(0, 8))),
          run && h(Metrics, { run })),
            h('div', { className: 'caw-tabs', role: 'group', 'aria-label': t('title') }, ['overview','timeline','details','results'].map(value => button(t(value), () => setTab(value), false, false, { 'aria-pressed':tab===value })))),
        (error || feed.error) && h('div', { className: 'caw-error', role: 'alert' }, error || feed.error, button(t('refresh'), () => feed.refresh(), busy)),
        selected && !run && !feed.error && h('div', { className: 'caw-empty', role: 'status' }, h('span', { className: 'caw-skeleton', 'aria-hidden': true }), h('span', { className: 'caw-skeleton', 'aria-hidden': true }), h('span', null, t('loading'))),
        h('div', { className: 'caw-body' },
          editorOpen && h('section', { className: 'caw-editor', 'aria-label': t('authoring') }, h('div', { className: 'caw-editor-title' }, h('h3', null, t('authoring')), button(t('hideEditor'), () => setEditorOpen(false))), h('div', { className: 'caw-editor-fields' },
            h('label', null, t('name'), h('input', { value: name, onChange: event => setName(event.target.value), maxLength: 120 })),
            h('label', { className: 'caw-script' }, t('script'), h('textarea', { value: script, spellCheck: false, onChange: event => setScript(event.target.value) })),
            h('div', { className: 'caw-row' }, button(t('useSample'), () => { setScript(SAMPLE); setAnalysis(null) }, busy), button(t('tools'), async () => { const result = await perform({ action: 'help' }); if (result) setApiHelp(result.facade) }, busy)),
            apiHelp && h('details', null, h('summary', null, t('tools')), code(apiHelp)),
            h('label', null, t('model'), h('select', { value: modelRoute, onChange: event => setModelRoute(event.target.value) }, h('option', { value: '' }, t('inheritModel')), (collection.modelRoutes ?? []).map(route => h('option', { key: `${route.provider}/${route.model}`, value: JSON.stringify({ provider: route.provider, model: route.model }) }, `${route.provider}/${route.model}`)))),
            h('label', null, t('args'), h('textarea', { rows: 2, value: argsText, onChange: event => setArgsText(event.target.value) })),
            h('div', { className: 'caw-row' }, h('label', null, t('concurrency'), h('input', { type: 'number', min: 1, max: 64, value: concurrency, onChange: event => setConcurrency(event.target.value) })), h('label', null, t('saveScope'), h('select', { value: scope, onChange: event => setScope(event.target.value) }, ['project','global'].map(value => h('option', { key: value, value }, t(value)))))),
            ), h('div', { className: 'caw-editor-actions' }, h('div', { className: 'caw-row' }, button(busy ? t('loading') : t('analyze'), async () => { const result = await perform({ action: 'analyze', script }); if (result) { setAnalysis(result); setAnalyzedScript(script); setTab('overview'); setEditorOpen(false) } }, busy || !script.trim()), button(t('save'), () => perform({ action: 'save', name, script, scope }), busy || !valid)),
            h('p', { className: 'caw-note', role: 'status' }, valid ? t('ready') : t('stale')),
            h('div', { className: 'caw-row' }, button(t('run'), launch, busy || !valid || running, true), running && button(t('stop'), () => perform({ action:'stop',id:selected }), busy), selected && run?.status === 'stopped' && run.stopReason !== 'superseded' && button(t('resume'), () => perform({ action:'resume',id:selected }).then(value => { if (value) setRun(value) }), busy), selected && button(t('amend'), async () => { try { const result = await perform({ action:'amend',id:selected,script,name,args:getArgs(),concurrency:Number(concurrency),...(modelRoute?JSON.parse(modelRoute):{}) }); if (result) { navigate(result.id) } } catch(err) { setError(err.message) } }, busy || !valid)),
            h('p', { className: 'caw-note' }, t('billing')))),
          h('div', { className: 'caw-main' },
            h('div', { className: 'caw-content' },
              currentAnalysis?.diagnostics?.length > 0 && code(currentAnalysis.diagnostics),
              questions.length > 0 && h('section', { className:'caw-section caw-intervention' },h('h3',null,t('questions')),questions.filter(q => !q.answer && q.status !== 'resolved').map((q,i) => h('div',{key:q.id??i},h('p',null,q.question??q.prompt??q.message),h('textarea',{'aria-label':t('inputAnswer'),value:answers[q.id]??'',onChange:e=>setAnswers({...answers,[q.id]:e.target.value})}),button(t('answer'),()=>perform({action:'answer',id:selected,questionId:q.id,answer:answers[q.id]??''}),busy)))),
              (run?.holes??[]).filter(hole=>hole.status!=='filled'&&hole.value===undefined).map((hole,i)=>h('section',{key:hole.id??i,className:'caw-section caw-intervention'},h('h3',null,`${t('holes')}: ${hole.name??hole.id}`),code(hole),h('textarea',{'aria-label':t('fill'),value:answers[hole.id]??'',onChange:e=>setAnswers({...answers,[hole.id]:e.target.value})}),button(t('fill'),async()=>{try {await perform({action:'fill_hole',id:selected,holeId:hole.id,body:answers[hole.id]??''})}catch(err){setError(err.message)}},busy))),
              holds.length > 0 && h('section',{className:'caw-section caw-intervention'},h('h3',null,t('holds')),h('p',{className:'caw-note'},t('holdNote')),holds.map((hold,i)=>h('div',{key:hold.nodeId??i},code(hold),h('textarea',{'aria-label':t('accept'),value:answers[hold.nodeId]??'',onChange:e=>setAnswers({...answers,[hold.nodeId]:e.target.value})}),h('div',{className:'caw-row'},button(t('retry'),()=>perform({action:'resolve_hold',id:selected,nodeId:hold.nodeId,resolution:'retry'}),busy),button(t('accept'),async()=>{try {await perform({action:'resolve_hold',id:selected,nodeId:hold.nodeId,resolution:'accept',value:JSON.parse(answers[hold.nodeId])})}catch(err){setError(err.message)}},busy))))),
               tab==='timeline' && h(Timeline,{run:run??{analysis:currentAnalysis},onNode:inspectNode}),
               tab==='overview' && h(React.Fragment,null,h(FlowGraph,{analysis:currentAnalysis,kind,setKind,run,onNode:inspectNode}),run?.resumedFrom&&h('p',{className:'caw-note'},`${t('source')}: ${run.resumedFrom}`)),
              tab==='details' && h(React.Fragment,null,run?.nativeTeam&&h('details',null,h('summary',null,'DSH Teams / Subagents'),code({team:run.nativeTeam,members:run.actors})),h('div',{className:'caw-detail-heading'},h('h3',null,t('node')),button(t('backToGraph'),()=>setTab('overview'))),picked?code({site:picked,instances:detailNodes}):h('p',{className:'caw-note'},t('noNode')),
                h('details',null,h('summary',null,`${t('details')} (${run?.nodes?.length??0})`),h('p',{className:'caw-note'},`${visibleNodes.length} / ${run?.counts?.nodes??'—'}`),code(visibleNodes),(pageMore.nodes ?? run?.nodesPage?.hasMore)&&button(t('loadMore'),()=>loadAll('nodes',setAdditionalNodes),busy)),h('section',{className:'caw-section'},h('h3',null,t('events')),(pageMore.events ?? run?.eventsPage?.earlierOmitted)&&h('p',{className:'caw-note'},t('clipped')),visibleEvents.map((event,i)=>h('div',{className:'caw-log',key:event.sequence??i},h('time',null,event.timeCreated?new Date(event.timeCreated).toLocaleTimeString():''),event.event?.message??event.event?.type??event.message??event.type??JSON.stringify(event),h('details',null,h('summary',null,t('details')),code(event)))),(pageMore.events ?? run?.eventsPage?.earlierOmitted)&&button(t('loadMore'),()=>loadAll('events',setAdditionalEvents),busy),!run?.events?.length&&h('p',{className:'caw-note'},t('noEvents')))),
              tab==='results'&&h(React.Fragment,null,run?.result!==undefined&&h('section',null,h('h3',null,t('output')),code(run.result)),(run?.artifacts??[]).map((item,i)=>h(Artifact,{key:`${item.id}:${item.version??i}`,item,reports:run?.reports,sessionId,runId:selected,revision:run?.updatedAt})),run?.reports?.length>0&&h('section',{className:'caw-section'},h('h3',null,t('reports')),code(mergeRows(run.reports,additionalReports,row=>`${row.instance.siteId}:${row.instance.ordinal}`)),(pageMore.reports ?? run.reportsPage?.hasMore)&&button(t('loadMore'),()=>loadAll('reports',setAdditionalReports),busy)),run?.result===undefined&&!run?.artifacts?.length&&!run?.reports?.length&&h('p',{className:'caw-note'},t('noResults'))),
              run?.error&&h('p',{className:'caw-error'},typeof run.error==='string'?run.error:JSON.stringify(run.error)))))))
  }
  function MainView({ sessionId }) {
    return h(SessionView, { key: sessionId, sessionId })
  }
  function SessionView({ sessionId }) {
    const feed = useFeed(sessionId, null)
    const [selection, setSelection] = useState(() => mainSelections.get(sessionId) ?? null)
    const revision = useRef(selection?.revision ?? 0)
    const commit = value => {
      const next = { ...value, revision: ++revision.current }
      mainSelections.set(sessionId, next); setSelection(next)
    }
    useEffect(() => {
      if (selection === null && feed.collectionLoaded) commit(workflowSelection(null, feed.collection.runs))
    }, [selection, feed.collectionLoaded])
    const navigate = (runId, view) => commit({ runId: runId ?? null, view: workflowView(typeof view === 'string' ? view : 'overview'), ...(view?.saved ? { saved: view.saved } : {}) })
    if (!selection) return h('div', { className: 'caw-center' }, h('style', null, css), h('h2', null, t('mainTitle')), h('p', { role: feed.error ? 'alert' : 'status', className: 'caw-empty' }, feed.error || t('loading')), feed.error && button(t('refresh'), () => feed.refresh()))
    return h(Panel, { key: JSON.stringify([sessionId, selection.runId, selection.saved?.scope, selection.saved?.name]), sessionId, runId: selection.runId, navigation: { revision: selection.revision, params: { view: selection.view, saved: selection.saved } }, onNavigate: navigate, main: true })
  }
  function RunCard({ sessionId, runId, recorded, inspect }) {
    const feed = useFeed(sessionId, runId)
    const run = feed.runs.get(runId) ?? recorded
    const phases = phaseModel(run)
    const actors = run?.actors ?? []
    return h('section', { className: 'caw-card', 'aria-label': run?.name ?? t('title') }, h('style', null, css),
      h('div', { className: 'caw-card-summary' },
        h('span', { className: 'caw-row' }, state(run?.status), h('strong', null, run?.name ?? t('title'))),
        h('span', { className: 'caw-card-meta caw-meta' }, `${run?.analysis ? phases.length : '—'} ${t('stages')} · ${run?.actors ? actors.length : '—'} ${t('actors')}`),
        h('span', { className: 'caw-phase-dots' }, phases.map(phase => h('span', { key: phase.id, className: 'caw-phase-progress' }, h('span', { className: 'caw-dot', 'data-state': phase.status, 'aria-hidden': true }), h('span', null, `${phase.name ?? t('other')} ${phase.completed}/${phase.total}`), state(phase.status)))),
        h(ActorChips, { actors, limit: 5 }), h('span', { className: 'caw-card-meta caw-meta' }, t('mainEntryHint'))),
      h('footer', null, h('span', { className: 'caw-meta' }, `${t('artifacts')} · ${(run?.artifacts?.find(item => item.primary) ?? run?.artifacts?.[0])?.title ?? run?.artifacts?.[0]?.id ?? run?.counts?.artifacts ?? '—'}`), inspect && button(t('details'), inspect)),
      feed.error && h('p', { className: 'caw-error', role: 'alert' }, feed.error))
  }
  function ToolView(props) {
    let args = {}, recorded
    try { args = JSON.parse(props.block.call?.argsRaw ?? props.block.argsRaw ?? '{}') } catch {}
    if (props.phase === 'result' && !props.block.isError) {
      try { recorded = JSON.parse(props.block.content.filter(item => item.type === 'text').map(item => item.text).join('\n')) } catch {}
    }
    const runId = recorded?.id ?? args.id
    if (!props.block.isError && typeof runId === 'string') return h(RunCard, { sessionId: props.sessionId, runId, recorded, inspect: props.inspect })
    return h('div', { className: 'caw-tool' }, h('style', null, css), h('span', null, `${t('title')} · ${args.action ?? props.phase}`), props.inspect && button(t('details'), props.inspect), props.block.isError && h('div', { role: 'alert', className: 'caw-error' }, code(props.block.content)))
  }
  ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: WORKFLOW_VIEW_ID, order: 25, locale: NS, label: () => t('mainTitle') }, MainView))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'zcode_workflow', locale: NS }, ToolView))
  ctx.effect(() => () => { for (const feed of feeds.values()) { clearTimeout(feed.timer); feed.stream?.close(); feed.abort?.abort() }; feeds.clear(); mainSelections.clear(); editorStates.clear() }, 'dynamic-workflow: shared feeds')
}
