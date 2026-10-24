import { applyArtifactItems, parseArtifactPresetSpec } from '../../vendor/zcode/ui-presets/index.js'

export function createArtifactView(React, { api, t, code, downloadUrl }) {
  const h = React.createElement
  const { useState, useEffect, useRef } = React
  return function Artifact({ item, sessionId, runId, revision }) {
    const [entries, setEntries] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(false)
    const cursor = useRef(0)
    const kind = item.kind ?? item.type
    const preset = ['chart', 'table', 'metrics', 'board'].includes(kind)
    useEffect(() => {
      if (!preset) return
      const abort = new AbortController()
      setLoading(true)
      setError('')
      void (async () => {
        for (;;) {
          const page = await api(sessionId, { action: 'reports', id: runId, artifactId: item.id, after: cursor.current, limit: 256 }, abort.signal)
          if (abort.signal.aborted) return
          const previous = cursor.current
          cursor.current = page.nextCursor
          setEntries(values => [...values, ...page.reports])
          if (!page.hasMore) break
          if (cursor.current <= previous) throw new Error('报告分页游标没有推进')
        }
      })().catch(err => { if (!abort.signal.aborted) setError(err.message) }).finally(() => { if (!abort.signal.aborted) setLoading(false) })
      return () => abort.abort()
    }, [sessionId, runId, item.id, preset, revision])
    const spec = preset ? parseArtifactPresetSpec(kind, item.spec) : undefined
    const model = spec ? applyArtifactItems(kind, spec, entries.map((row, index) => ({ sequence: index, siteId: row.instance.siteId, ordinal: row.instance.ordinal, item: row.item }))) : undefined
    let body
    if (kind === 'markdown') body = code(item.content ?? '')
    else if (model?.kind === 'table') body = h('table', null,
      h('thead', null, h('tr', null, model.columns.map(col => h('th', { key: col.field }, col.label, col.unit ? ` (${col.unit})` : '')))),
      h('tbody', null, model.rows.map(row => h('tr', { key: row.id }, row.cells.map((cell, index) => h('td', { key: index }, cell))))))
    else if (model?.kind === 'metrics') body = h('div', { className: 'caw-metrics' }, model.metrics.map(metric => h('div', { key: metric.field },
      h('span', null, metric.label), h('strong', null, metric.value ?? '—'), metric.unit)))
    else if (model?.kind === 'board') body = h('div', { className: 'caw-board' }, model.columns.map(column => h('section', { key: column.id },
      h('h4', null, column.other ? t('other') : column.id), column.cards.map(card => h('div', { key: card.id, className: 'caw-log' },
        h('strong', null, card.title), card.details.map((detail, index) => h('p', { key: index }, `${detail.label}: ${detail.value}${detail.unit ? ` ${detail.unit}` : ''}`)))))))
    else if (model?.kind === 'chart') {
      const transform = value => model.scale === 'log' ? Math.log10(value) : value
      const low = model.domain ? (model.scale === 'log' ? model.domain.yMin : Math.min(0, model.domain.yMin, model.baseline?.value ?? 0)) : 0
      const high = Math.max(low, model.domain?.yMax ?? 1, model.baseline?.value ?? low)
      const min = transform(low), span = transform(high) - min || 1
      const xMin = model.domain?.xMin ?? 0, xSpan = (model.domain?.xMax ?? 1) - xMin || 1
      const x = point => 50 + (point.x - xMin) / xSpan * 450
      const y = value => 175 - (transform(value) - min) / span * 155
      const colors = ['--dsw-alias-brand-primary', '--dsw-alias-state-success-primary', '--dsw-alias-state-warn-primary', '--dsw-alias-state-error-primary']
      const table = h('table', null, h('thead', null, h('tr', null, h('th', null, model.x.label), model.series.map(series => h('th', { key: series.key }, series.label)))),
        h('tbody', null, model.points.map(point => h('tr', { key: point.sequence }, h('td', null, point.xLabel), model.series.map(series => h('td', { key: series.key }, String(point[series.key] ?? '')))))))
      body = h(React.Fragment, null, h('svg', { viewBox: '0 0 540 240', role: 'img', 'aria-label': item.title ?? item.id, style: { width: '100%', maxHeight: 300 } },
        h('path', { d: 'M45 10 V180 H520', fill: 'none', stroke: 'var(--dsw-alias-border-l2)' }),
        h('text', { x: 2, y: 20, fontSize: 10, fill: 'var(--dsw-alias-label-secondary)' }, String(high)),
        h('text', { x: 2, y: 178, fontSize: 10, fill: 'var(--dsw-alias-label-secondary)' }, String(low)),
        model.baseline && h('g', null, h('path', { d: `M45 ${y(model.baseline.value)} H520`, stroke: 'var(--dsw-alias-label-secondary)', strokeDasharray: '4 3' }),
          h('text', { x: 50, y: y(model.baseline.value)-4, fontSize: 10, fill: 'var(--dsw-alias-label-secondary)' }, `${model.baseline.label}: ${model.baseline.value}`)),
        model.series.map((series, index) => {
          const color = `var(${colors[index % colors.length]})`
          const points = model.points.filter(point => typeof point[series.key] === 'number')
          return h('g', { key: series.key },
            h('text', { x: 50 + index * 135, y: 225, fontSize: 11, fill: color }, series.label),
            points.map(point => model.type === 'bar'
              ? h('rect', { key: point.sequence, x: x(point)-5+index*7, y: Math.min(y(point[series.key]), y(model.scale === 'log' ? low : 0)), width: 6, height: Math.abs(y(point[series.key])-y(model.scale === 'log' ? low : 0)), fill: color }, h('title', null, `${point.xLabel}: ${point[series.key]}`))
              : h('circle', { key: point.sequence, cx: x(point), cy: y(point[series.key]), r: 3, fill: color }, h('title', null, `${point.xLabel}: ${point[series.key]}`))),
            model.type === 'line' && h('polyline', { points: points.map(point => `${x(point)},${y(point[series.key])}`).join(' '), fill: 'none', stroke: color, strokeWidth: 1.5 }),
          )
        }),
        model.points.length > 0 && h('text', { x: 50, y: 197, fontSize: 10, fill: 'var(--dsw-alias-label-secondary)' }, model.points[0].xLabel),
        model.points.length > 1 && h('text', { x: 515, y: 197, textAnchor: 'end', fontSize: 10, fill: 'var(--dsw-alias-label-secondary)' }, model.points.at(-1).xLabel)),
        h('details', null, h('summary', null, t('details')), table))
    } else if (kind === 'file') body = h('a', { href: downloadUrl(sessionId, runId, item), download: item.sourcePath?.split('/').at(-1) ?? item.id }, item.sourcePath ?? item.id)
    else body = code(item)
    return h('section', { className: 'caw-section' }, h('h3', null, item.title ?? item.label ?? spec?.title ?? item.id),
      spec?.description && h('p', { className: 'caw-note' }, spec.description),
      loading && h('p', { className: 'caw-note', role: 'status' }, `${t('loading')} (${entries.length})`),
      error && h('p', { className: 'caw-error', role: 'alert' }, error),
      preset && !spec && h('p', { className: 'caw-error', role: 'alert' }, t('invalidPreset')),
      body, kind === 'markdown' && h('a', { href: downloadUrl(sessionId, runId, item), download: `${item.id}.md` }, t('download')))
  }
}
