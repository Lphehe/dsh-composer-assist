export function graphModel(analysis, kind = 'graph', availableWidth = Infinity) {
  const graph = analysis?.[kind]
  if (!graph) return { nodes: [], edges: [], groups: [], width: 600, height: 320 }
  const source = graph.nodes ?? graph.steps ?? graph.participants ?? graph.phases ?? []
  const rows = Array.isArray(source) ? source : Object.values(source)
  const phases = new Map((analysis.causality?.phases ?? analysis.flow?.phases ?? []).map(phase => [phase.id, phase.name ?? phase.id]))
  const lanes = new Map((analysis.causality?.lanes ?? []).map(lane => [lane.id, lane.name ?? lane.id]))
  const taskLanes = new Map((analysis.causality?.steps ?? []).map(step => [step.source ?? step.id, step.lanes ?? [step.lane]]))
  const actorTitle = node => node.kind === 'ask' ? (node.lanes ?? (node.lane ? [node.lane] : taskLanes.get(node.source ?? node.site ?? node.id) ?? node.actors ?? [])).map(id => lanes.get(id)).filter(Boolean).join(' · ') || undefined : undefined
  const sites = new Map((analysis.graph?.nodes ?? []).map(node => [node.id, actorTitle(node) ?? node.label]))
  const nodes = rows.map((node, index) => ({ ...node, id: String(node.id ?? node.siteId ?? index),
    sites: node.steps ?? [node.source ?? node.site ?? node.id],
    label: actorTitle(node) ?? node.label ?? node.name ?? node.title ?? (kind === 'handoff' ? `${phases.get(node.phase) ?? node.phase} · ${lanes.get(node.lane) ?? node.lane}` : node.kind === 'mark' ? phases.get(node.phase) : sites.get(node.site)) ?? node.id ?? String(index) }))
  const rawEdges = graph.edges ?? graph.handoffs ?? graph.order ?? []
  if (kind === 'flow') for (const id of ['entry', 'sink', 'abort']) {
    if (rawEdges.some(edge => edge.from === id || edge.to === id)) nodes.push({ id, label: id, sites: [] })
  }
  const ids = new Set(nodes.map(node => node.id))
  const edges = rawEdges.map(edge => ({ ...edge, from: String(edge.from ?? edge.source), to: String(edge.to ?? edge.target) })).filter(edge => ids.has(edge.from) && ids.has(edge.to))
  const incoming = new Map(nodes.map(node => [node.id, 0]))
  for (const edge of edges) if (edge.from !== edge.to) incoming.set(edge.to, incoming.get(edge.to) + 1)
  const depth = new Map(nodes.map(node => [node.id, 0]))
  const queue = nodes.filter(node => incoming.get(node.id) === 0).map(node => node.id)
  const visited = new Set()
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (visited.has(id)) continue
    visited.add(id)
    for (const edge of edges.filter(edge => edge.from === id && edge.to !== id)) {
      depth.set(edge.to, Math.max(depth.get(edge.to), depth.get(id) + 1))
      incoming.set(edge.to, incoming.get(edge.to) - 1)
      if (incoming.get(edge.to) === 0) queue.push(edge.to)
    }
  }
  // Cycles remain visible in one trailing column; their arrows retain direction.
  const tail = Math.max(0, ...depth.values()) + 1
  for (const node of nodes) if (!visited.has(node.id)) depth.set(node.id, tail)
  const steps = new Map((analysis.causality?.steps ?? []).map(step => [step.source ?? step.id, step]))
  const structuralKinds = new Set(['source','sink','join','fan-out','mark','entry','abort','test'])
  const phaseOrder = new Map([...phases.keys()].map((id, index) => [id, index]))
  for (const node of nodes) {
    const site = node.source ?? node.site ?? node.sites[0] ?? node.id
    node.phase ??= steps.get(site)?.phase
    node.layoutPhase = phases.has(node.phase) ? node.phase : undefined
    node.actorIds = (node.lanes ?? (node.lane ? [node.lane] : taskLanes.get(site) ?? node.actors ?? [])).filter(id => typeof id === 'string')
    node.structural = structuralKinds.has(node.kind ?? node.id)
    node.width = node.structural ? 88 : 248
    node.height = node.structural ? 32 : 112
  }
  const grouped = (kind === 'graph' || kind === 'causality') && phases.size > 0
  if (grouped) {
    const byId = new Map(nodes.map(node => [node.id, node]))
    const adjacent = new Map(nodes.map(node => [node.id, { before: [], after: [] }]))
    for (const edge of edges) { adjacent.get(edge.from).after.push(edge.to); adjacent.get(edge.to).before.push(edge.from) }
    // Structural vertices inherit only a spatial band, never an execution phase.
    for (let pass = 0; pass < nodes.length; pass++) {
      let changed = false
      for (const node of nodes) {
        if (!node.structural || phases.has(node.phase)) continue
        const { before, after } = adjacent.get(node.id)
        const known = ids => ids.map(id => byId.get(id).layoutPhase).filter(id => phases.has(id))
        const incomingPhases = known(before), outgoingPhases = known(after)
        const source = node.kind === 'source' || node.id === 'entry'
        const candidates = source ? outgoingPhases : incomingPhases.length ? incomingPhases : outgoingPhases
        if (!candidates.length) continue
        const next = candidates.reduce((best, id) => (source ? phaseOrder.get(id) < phaseOrder.get(best) : phaseOrder.get(id) > phaseOrder.get(best)) ? id : best)
        if (next !== node.layoutPhase) { node.layoutPhase = next; changed = true }
      }
      if (!changed) break
    }
  }
  const bands = grouped
    ? [undefined, ...phases.keys()].map(id => ({ id, nodes: nodes.filter(node => node.layoutPhase === id) })).filter(band => band.nodes.length)
    : [{ nodes }]
  const groups = []
  const limit = Math.max(296, availableWidth)
  let top = 16, bandLeft = 8, rowHeight = 0
  for (const band of bands) {
    if (!band.nodes.length) continue
    const columns = new Map()
    for (const node of band.nodes) {
      const column = depth.get(node.id)
      if (!columns.has(column)) columns.set(column, [])
      columns.get(column).push(node)
    }
    const lines = []
    let line = [], lineWidth = 0
    for (const [, members] of [...columns].sort(([a], [b]) => a - b)) {
      const width = Math.max(...members.map(node => node.width))
      if (line.length && lineWidth + 32 + width + 48 > limit) { lines.push(line); line = []; lineWidth = 0 }
      lineWidth += (line.length ? 32 : 0) + width
      line.push({ members, width })
    }
    if (line.length) lines.push(line)
    const bandWidth = Math.max(...lines.map(line => line.reduce((sum, column) => sum + column.width, 0) + (line.length - 1) * 32)) + 32
    if (bandLeft > 8 && bandLeft + bandWidth + 8 > limit) { bandLeft = 8; top += rowHeight + 24; rowHeight = 0 }
    let offset = 0
    for (const line of lines) {
      const height = Math.max(...line.map(column => column.members.length)) * 136
      let left = bandLeft + 16
      for (const column of line) {
        column.members.forEach((node, row) => {
          node.x = left + (column.width - node.width) / 2
          node.y = top + 44 + offset + (height - column.members.length * 136) / 2 + row * 136 + (136 - node.height) / 2
        })
        left += column.width + 32
      }
      offset += height + 24
    }
    const height = 44 + offset - 24 + 20
    if (band.id !== undefined) groups.push({ id: band.id, label: phases.get(band.id), index: phaseOrder.get(band.id), x: bandLeft, y: top, width: bandWidth, height, taskCount: band.nodes.filter(node => !node.structural).length, sites: [...new Set(band.nodes.flatMap(node => node.sites).filter(site => typeof site === 'string'))] })
    bandLeft += bandWidth + 24
    rowHeight = Math.max(rowHeight, height)
  }
  const width = Math.max(296, ...nodes.map(node => node.x + node.width + 24))
  return { nodes, edges, groups, width, height: Math.max(320, top + rowHeight + 16) }
}

export function graphEdgePoints(model, edge) {
  const byId = new Map(model.nodes.map(node => [node.id, node]))
  const sides = item => {
    const from = byId.get(item.from), to = byId.get(item.to)
    if (from === to) return ['right', 'bottom']
    if (from.x + from.width <= to.x) return ['right', 'left']
    if (to.x + to.width <= from.x) return ['left', 'right']
    return from.y + from.height <= to.y ? ['bottom', 'top'] : ['top', 'bottom']
  }
  const port = (node, side, outgoing) => {
    const vertical = side === 'left' || side === 'right'
    const peers = model.edges.flatMap((item, index) => {
      const pair = sides(item), entries = []
      if (item.from === node.id && pair[0] === side) entries.push({ item, index, outgoing: true, other: byId.get(item.to) })
      if (item.to === node.id && pair[1] === side) entries.push({ item, index, outgoing: false, other: byId.get(item.from) })
      return entries
    }).sort((a, b) => (Number.isFinite(a.item.port) ? a.item.port : Infinity) - (Number.isFinite(b.item.port) ? b.item.port : Infinity) || (vertical ? a.other.y + a.other.height / 2 - b.other.y - b.other.height / 2 : a.other.x + a.other.width / 2 - b.other.x - b.other.width / 2) || a.index - b.index)
    const index = Math.max(0, peers.findIndex(peer => peer.item === edge && peer.outgoing === outgoing))
    const offset = 8 + (index + 1) * ((vertical ? node.height : node.width) - 16) / (peers.length + 1)
    if (side === 'right') return [node.x + node.width, node.y + offset]
    if (side === 'left') return [node.x, node.y + offset]
    if (side === 'bottom') return [node.x + offset, node.y + node.height]
    return [node.x + offset, node.y]
  }
  const from = byId.get(edge.from), to = byId.get(edge.to)
  if (!from || !to) throw new Error('Graph edge has no endpoint')
  const pair = sides(edge)
  const start = port(from, pair[0], true), end = port(to, pair[1], false)
  const stub = (point, side) => [point[0] + (side === 'right' ? 12 : side === 'left' ? -12 : 0), point[1] + (side === 'bottom' ? 12 : side === 'top' ? -12 : 0)]
  const first = stub(start, pair[0]), last = stub(end, pair[1])
  const boxes = model.nodes.map(node => ({ left: node.x - 6, right: node.x + node.width + 6, top: node.y - 6, bottom: node.y + node.height + 6 }))
  const clear = (a, b) => !boxes.some(box => a[0] === b[0]
    ? a[0] > box.left && a[0] < box.right && Math.max(a[1], b[1]) > box.top && Math.min(a[1], b[1]) < box.bottom
    : a[1] > box.top && a[1] < box.bottom && Math.max(a[0], b[0]) > box.left && Math.min(a[0], b[0]) < box.right)
  let route = [[first, [last[0], first[1]], last], [first, [first[0], last[1]], last]].find(points => points.slice(1).every((point, i) => clear(points[i], point)))
  if (!route) {
    // shortcut: the card-boundary grid has quadratic size, cache routes if hundreds of cards are displayed.
    const xs = [...new Set([8, model.width - 8, first[0], last[0], ...boxes.flatMap(box => [box.left - 2, box.right + 2])])].sort((a, b) => a - b)
    const ys = [...new Set([8, model.height - 8, first[1], last[1], ...boxes.flatMap(box => [box.top - 2, box.bottom + 2]), ...(model.groups ?? []).flatMap(group => [group.y - 8, group.y + group.height + 8])])].sort((a, b) => a - b)
    const key = point => ys.indexOf(point[1]) * xs.length + xs.indexOf(point[0])
    const point = id => [xs[id % xs.length], ys[Math.floor(id / xs.length)]]
    const source = key(first), target = key(last), costs = new Map([[source, 0]]), parents = new Map()
    const open = [{ id: source, cost: 0, rank: 0 }]
    while (open.length) {
      const current = open.shift()
      if (current.cost !== costs.get(current.id)) continue
      if (current.id === target) break
      const x = current.id % xs.length, y = Math.floor(current.id / xs.length), a = point(current.id)
      const neighbors = [x > 0 ? current.id - 1 : -1, x + 1 < xs.length ? current.id + 1 : -1, y > 0 ? current.id - xs.length : -1, y + 1 < ys.length ? current.id + xs.length : -1]
      for (const id of neighbors) {
        if (id < 0) continue
        const b = point(id)
        if (!clear(a, b)) continue
        const previous = parents.has(current.id) ? point(parents.get(current.id)) : null
        const bend = previous && ((previous[0] === a[0]) !== (a[0] === b[0])) ? 12 : 0
        const cost = current.cost + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + bend
        if (cost >= (costs.get(id) ?? Infinity)) continue
        costs.set(id, cost); parents.set(id, current.id)
        const rank = cost + Math.abs(b[0] - last[0]) + Math.abs(b[1] - last[1])
        let index = 0
        while (index < open.length && open[index].rank <= rank) index++
        open.splice(index, 0, { id, cost, rank })
      }
    }
    if (!costs.has(target)) throw new Error('Graph edge has no clear orthogonal route')
    route = [last]
    for (let id = target; id !== source;) { id = parents.get(id); route.unshift(point(id)) }
  }
  const points = []
  for (const point of [start, ...route, end]) {
    const b = points.at(-1), a = points.at(-2)
    if (b && b[0] === point[0] && b[1] === point[1]) continue
    if (a && ((a[0] === b[0] && b[0] === point[0]) || (a[1] === b[1] && b[1] === point[1]))) points.pop()
    points.push(point)
  }
  return points
}

export function nodeState(instances, siteId) {
  const matches = (instances ?? []).filter(node => node.siteId === siteId || node.site_id === siteId || node.id === siteId)
  const states = matches.map(node => node.status)
  if (states.some(state => ['running', 'in-flight', 'inflight', 'started'].includes(state))) return 'running'
  if (states.some(state => ['failed', 'errored', 'held', 'blocked'].includes(state))) return 'failed'
  if (states.includes('cancelled')) return 'cancelled'
  if (states.includes('stopped')) return 'stopped'
  if (states.length && states.every(state => ['completed', 'succeeded', 'cached', 'done'].includes(state))) return 'completed'
  return 'pending'
}

export function siteProgress(rows = []) {
  return rows.reduce((sum, row) => {
    const count = Number.isSafeInteger(row.count) && row.count >= 0 ? row.count : 1
    sum.total += count
    if (nodeState([row], row.siteId) === 'completed') sum.completed += count
    return sum
  }, { completed: 0, total: 0 })
}

export function actorBadge(actor) {
  const id = actor.siteId ?? actor.name ?? '?'
  const number = /^actor#(\d+)$/.exec(id)?.[1]
  return { initial: number ? `A${number}` : Array.from(actor.name ?? id).slice(0, 2).join(''), color: Array.from(id).reduce((sum, char) => sum + char.codePointAt(0), 0) % 3 }
}

export function phaseModel(run) {
  const graph = run?.analysis?.causality
  const actorNames = new Map((graph?.lanes ?? []).map(lane => [lane.id, lane.name ?? lane.id]))
  const instructions = new Map()
  // A site may run repeatedly; show its latest retained instruction, never invent one.
  for (const { event } of run?.events ?? []) if (typeof event?.instructionsHead === 'string' && event.instance?.siteId) instructions.set(event.instance.siteId, event.instructionsHead)
  const steps = graph?.steps ?? []
  const phases = [...(graph?.phases ?? [])]
  const known = new Set(phases.map(phase => phase.id))
  const owners = new Map()
  for (const step of steps) {
    const site = step.source ?? step.id
    if (!owners.has(site)) owners.set(site, new Set())
    owners.get(site).add(known.has(step.phase) ? step.phase : 'unphased')
  }
  const other = steps.filter(step => !known.has(step.phase))
  const observed = new Set()
  for (const row of run?.siteStates ?? []) if ((!owners.has(row.siteId) || owners.get(row.siteId).size > 1) && !observed.has(row.siteId)) {
    observed.add(row.siteId)
    other.push({ id: `observed:${row.siteId}`, source: row.siteId, label: row.siteId })
  }
  if (other.length && !known.has('unphased')) phases.push({ id: 'unphased' })
  return phases.map(phase => {
    const tasks = phase.id === 'unphased' ? [...new Map([...steps.filter(step => step.phase === phase.id), ...other].map(step => [step.id, step])).values()] : steps.filter(step => step.phase === phase.id)
    const ids = new Set(tasks.map(step => step.source ?? step.id))
    const rows = (run?.siteStates ?? []).filter(row => ids.has(row.siteId) && (phase.id === 'unphased' || owners.get(row.siteId)?.size === 1))
    const states = rows.map(row => nodeState([row], row.siteId))
    const progress = siteProgress(rows)
    const entered = phase.name && phases.filter(item => item.name === phase.name).length === 1 && (run?.events ?? []).some(row => row.event?.type === 'phase-entered' && row.event.name === phase.name)
    const observed = tasks.length ? tasks.every(step => nodeState(rows, step.source ?? step.id) === 'completed') : entered
    // Loops may create more instances; settled observed work is not phase completion until the run completes.
    const status = states.includes('failed') ? 'failed' : states.includes('running') ? 'running' : states.includes('cancelled') ? 'cancelled' : states.includes('stopped') ? 'stopped' : observed ? (run?.status === 'completed' ? 'completed' : 'waiting') : 'pending'
    return { ...phase, tasks: tasks.map(task => ({ ...task,
      label: (task.lanes ?? [task.lane]).map(id => actorNames.get(id)).filter(Boolean).join(' · ') || task.label || task.id,
      instruction: instructions.get(task.source ?? task.id) ?? '',
    })), ...progress, status }
  })
}

export function workflowIdentity(contentId, ownerSessionId) {
  try {
    const url = new URL(contentId)
    const parts = url.pathname.slice(1).split('/').map(decodeURIComponent)
    if (url.protocol !== 'dsh-resource:' || url.hostname !== 'composer-workflow' || url.username || url.password || url.port || url.search || url.hash || parts.length !== 2 || parts.some(part => !part || part.includes('/')) || parts[0] !== ownerSessionId) return null
    return { sessionId: parts[0], runId: parts[1] === 'new' ? null : parts[1] }
  } catch { return null }
}

export function workflowView(view) {
  return ['timeline', 'overview', 'details', 'results'].includes(view) ? view : 'timeline'
}
