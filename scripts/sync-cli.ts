import { syncInbox } from './sync'
const r = syncInbox(process.cwd())
console.log(`[inbox] ${r.report.files.length} file(s): ${r.rainfall.length} rainfall, ${r.events.length} events, ${r.capObs.length} survey, ${r.sedObs.length} sediment, ${r.params.length} parameters, ${r.refs.length} references`)
r.report.warnings.forEach((w) => console.warn('[inbox] warning:', w))
r.report.errors.forEach((e) => console.error('[inbox] error:', e))
