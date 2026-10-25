/**
 * UI for the opt-in Fusion recipe in the isolated workflow extension.
 * Calls are delegated to the authenticated workflow /action route.
 */
export function createFusionView(React, { t, button }) {
  const h = React.createElement
  const { useState } = React
  const modelOptions = routes => [
    h('option', { key: 'inherit', value: '' }, t('fusionInheritModel')),
    ...routes.filter(row => typeof row?.provider === 'string' && typeof row?.model === 'string')
      .map(row => h('option', { key: row.provider + '/' + row.model, value: row.provider + '/' + row.model }, row.provider + '/' + row.model)),
  ]
  const field = (label, id, child) => h('label', { htmlFor: id, key: id }, label, child)
  const statusText = (result, key) =>
    result === undefined ? t('fusionNotYet') : result ? t(key + 'Pass') : t(key + 'Fail')

  function FusionComposer({ modelRoutes = [], busy = false, onCreate, draft, onDraftChange }) {
    const [local, setLocal] = useState({ task: '', name: '', leadModel: '', sidekickModel: '', reviewModel: '', testScript: 'selfcheck', maxRounds: '2' })
    const values = draft ?? local
    const { task, name, leadModel, sidekickModel, reviewModel, testScript, maxRounds } = values
    const update = key => value => (onDraftChange ?? setLocal)(previous => ({ ...local, ...previous, [key]: value }))
    const setTask = update('task'), setName = update('name'), setLeadModel = update('leadModel'), setSidekickModel = update('sidekickModel'), setReviewModel = update('reviewModel'), setTestScript = update('testScript'), setMaxRounds = update('maxRounds')
    const create = () => {
      if (!task.trim()) return
      const payload = {
        action: 'fusion_create',
        task: task.trim(),
        maxRounds: Number(maxRounds),
        testScript: testScript.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(leadModel ? { leadModel } : {}),
        ...(sidekickModel ? { sidekickModel } : {}),
        ...(reviewModel ? { reviewModel } : {}),
      }
      return onCreate(payload)
    }
    return h('section', { className: 'caw-fusion caw-editor', 'data-fusion-composer': '', 'aria-label': t('fusionTitle') },
      h('header', { className: 'caw-editor-title' },
        h('div', null, h('h3', null, t('fusionTitle')), h('p', { className: 'caw-note' }, t('fusionIntro')))),
      h('div', { className: 'caw-fusion-roles', 'aria-label': t('fusionRoles') },
        ['Lead', 'Sidekick', 'Reviewer'].map(role =>
          h('div', { key: role, className: 'caw-fusion-role' }, h('strong', null, role), h('span', null, t('fusionRole' + role))))),
      h('div', { className: 'caw-editor-fields caw-fusion-fields' },
        field(t('fusionTask'), 'fusion-task', h('textarea', {
          id: 'fusion-task', rows: 4, value: task, maxLength: 12000,
          placeholder: t('fusionTaskPlaceholder'), onChange: e => setTask(e.target.value),
        })),
        field(t('name'), 'fusion-name', h('input', {
          id: 'fusion-name', value: name, maxLength: 120, onChange: e => setName(e.target.value),
          placeholder: t('fusionNamePlaceholder'),
        })),
        ...[
          ['Lead', leadModel, setLeadModel],
          ['Sidekick', sidekickModel, setSidekickModel],
          ['Reviewer', reviewModel, setReviewModel],
        ].map(([role, value, setter]) =>
          field(t('fusionModel' + role), 'fusion-model-' + role.toLowerCase(),
            h('select', { id: 'fusion-model-' + role.toLowerCase(), value, onChange: e => setter(e.target.value) },
              ...modelOptions(modelRoutes)))),
        field(t('fusionTest'), 'fusion-test', h('input', {
          id: 'fusion-test', value: testScript, maxLength: 80, spellCheck: false,
          onChange: e => setTestScript(e.target.value),
        })),
        field(t('fusionRounds'), 'fusion-rounds', h('select', {
          id: 'fusion-rounds', value: maxRounds, onChange: e => setMaxRounds(e.target.value),
        }, [1, 2, 3].map(count => h('option', { value: String(count), key: count }, String(count))))),
      ),
      h('div', { className: 'caw-editor-actions' },
        h('p', { className: 'caw-note' }, t('fusionSafety')),
        h('p', { className: 'caw-note' }, t('fusionTestHint')),
        h('div', { className: 'caw-row' },
          button(busy ? t('loading') : t('fusionCreateDraft'), create,
            busy || !task.trim() || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(testScript), true)))
    )
  }

  function FusionSummary({ run, onDetails }) {
    const args = run?.args
    if (!args || args.preset !== 'fusion.v1') return null
    const evidence = (run.reports ?? []).map(row => row.item).filter(item => item?.preset === 'fusion.v1')
    const result = run.result ?? evidence.reduce((latest, item) => item.rounds === latest.rounds ? { ...latest, ...item } : item, {})
    const tests = result?.test
    const review = result?.review
    const outcome = result?.success === undefined ? undefined : result.success === true
    // A model vote is not an approval while unresolved blocking findings remain.
    const reviewApproved = review === undefined ? undefined : review.approved === true && Array.isArray(review.blockingIssues) && review.blockingIssues.length === 0
    return h('section', { className: 'caw-fusion-summary', 'data-fusion-summary': '', 'aria-label': t('fusionTitle') },
      h('div', { className: 'caw-fusion-summary-header' },
        h('div', null, h('strong', null, t('fusionTitle')), h('span', { className: 'caw-note' }, ' · ' + t('fusionRounds') + ': ' + (result?.rounds ?? '—') + ' / ' + args.maxRounds)),
        h('span', { className: 'caw-state', 'data-state': run.status }, t(run.status ?? 'unknown'))),
      h('p', { className: 'caw-fusion-summary-task' }, args.task),
      h('div', { className: 'caw-fusion-checks' },
        h('span', null, t('fusionTest'), ': ', tests === undefined ? t('fusionNotYet') : tests.exitCode === 0 ? t('fusionTestPass') : t('fusionTestFail') + ' (' + tests.exitCode + ')'),
        h('span', null, t('fusionReview'), ': ', statusText(reviewApproved, 'fusionReview')),
        h('span', null, t('fusionSignoff'), ': ', statusText(outcome, 'fusionSignoff'))),
      Array.isArray(review?.blockingIssues) && review.blockingIssues.length > 0 &&
        h('div', { className: 'caw-fusion-blockers', role: 'status' },
          h('strong', null, t('fusionBlockingIssues')),
          h('ul', null, review.blockingIssues.slice(0, 10).map((issue, i) => h('li', { key: i }, String(issue))))),
      h('div', { className: 'caw-row' }, button(t('fusionInspect'), onDetails)))
  }
  return { FusionComposer, FusionSummary }
}
