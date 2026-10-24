export const WORKFLOW_VIEW_ID = 'composer-assist-workflow'

export function workflowSelection(current, runs = []) {
  // A selected older run may be outside the server's recent-run list.
  return current ?? { runId: runs[0]?.id ?? null, view: 'overview' }
}

export function workflowEditorState(cached, runId, saved) {
  const key = JSON.stringify([runId ?? null, saved?.scope ?? null, saved?.name ?? null])
  return { key, draft: cached?.key === key ? cached.draft : null }
}
