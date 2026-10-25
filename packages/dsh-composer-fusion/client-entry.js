// Standalone browser plugin; no import into dsh-composer-assist's prediction bundle.
import { installWorkflowUI } from '../../workflow/client/ui.js'

window.__ModuleLoader__.load({
  id: 'dsh-composer-fusion',
  factory(require) {
    const React = require('react')
    return {
      name: 'dsh-composer-fusion-client',
      inject: ['slots', 'locale'],
      apply(ctx) { installWorkflowUI(ctx, React) },
    }
  },
})
