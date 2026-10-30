/** Parses an uploaded file (CSV or JSON) into typed records. No DOM or React — also used by scripts/sync.ts. */
import { PARAM_META, type Evidence, type ParamKey } from '../data/provenance'
import type { ReferenceItem } from '../data/references'
import type { CapacityObservation, DataStatus, DesiltingEvent, RainfallRecord, SedimentObservation } from '../engine/types'
import { parseCSV, toCSV } from './csv'
import { capFromCSV, eventsFromCSV, rainfallFromCSV, sedFromCSV } from './exporters'

export type Kind = 'rainfall' | 'events' | 'survey' | 'sediment' | 'parameters' | 'references'
export const KIND_LABEL: Record<Kind, string> = {
  rainfall: 'Rainfall records', events: 'Desilting / dredging events', survey: 'Reservoir survey observations',
  sediment: 'Annual sediment inflow', parameters: 'Model parameters (with sources)', references: 'Reference links',
}

export interface ParamUpdate { key: ParamKey; value: number; source: string; url: string; status: DataStatus; evidence: Evidence; note: string }

export interface Parsed {
  kind: Kind | null
  fileName: string
  rainfall: RainfallRecord[]; events: DesiltingEvent[]; capObs: CapacityObservation[]; sedObs: SedimentObservation[]
  params: ParamUpdate[]; refs: ReferenceItem[]
  errors: string[]; warnings: string[]; rows: number
}
const empty = (fileName: string, kind: Kind | null): Parsed => ({ kind, fileName, rainfall: [], events: [], capObs: [], sedObs: [], params: [], refs: [], errors: [], warnings: [], rows: 0 })

export function detectKind(headers: string[], fileName = ''): Kind | null {
  const h = new Set(headers.map((x) => x.toLowerCase()))
  if (h.has('rainfall_mm')) return 'rainfall'
  if (h.has('startyear')) return 'events'
  if (h.has('annualsedimentinflowmm3')) return 'sediment'
  if (h.has('livestoragemm3') || h.has('cumulativesiltmm3')) return 'survey'
  if (h.has('parameter') && h.has('value')) return 'parameters'
  if (h.has('title') && h.has('url')) return 'references'
  const n = fileName.toLowerCase()
  if (n.startsWith('rainfall')) return 'rainfall'
  if (n.startsWith('event') || n.startsWith('desilting')) return 'events'
  if (n.startsWith('survey')) return 'survey'
  if (n.startsWith('sediment')) return 'sediment'
  if (n.startsWith('param')) return 'parameters'
  if (n.startsWith('reference')) return 'references'
  return null
}

const STATUSES: DataStatus[] = ['Observed', 'Published Estimate', 'Modelled', 'Assumed', 'Simulated', 'Missing']
const PARAM_ALIASES: Record<string, { key: ParamKey; factor: number }> = {
  original_live_mm3: { key: 'original_live_mm3', factor: 1 }, original_live_bcm: { key: 'original_live_mm3', factor: 1000 },
  original_dead_mm3: { key: 'original_dead_mm3', factor: 1 }, original_dead_bcm: { key: 'original_dead_mm3', factor: 1000 },
  annual_inflow_mm3: { key: 'annual_inflow_mm3', factor: 1 }, annual_inflow_bcm: { key: 'annual_inflow_mm3', factor: 1000 },
  start_year: { key: 'start_year', factor: 1 },
  yield_optimistic: { key: 'yield_optimistic', factor: 1 }, yield_realistic: { key: 'yield_realistic', factor: 1 }, yield_pessimistic: { key: 'yield_pessimistic', factor: 1 },
  allocation_dead: { key: 'allocation_dead', factor: 1 },
}
export const PARAM_NAMES = Object.keys(PARAM_ALIASES)

function parseParameters(text: string, out: Parsed) {
  parseCSV(text).forEach((r, i) => {
    const row = i + 2
    const name = (r.parameter || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
    const def = PARAM_ALIASES[name]
    if (!def) { out.warnings.push(`Row ${row}: unknown parameter “${r.parameter}” skipped. Known: ${PARAM_NAMES.join(', ')}`); return }
    const raw = Number(String(r.value).replace(/,/g, ''))
    if (!Number.isFinite(raw)) { out.errors.push(`Row ${row}: value is not a number`); return }
    const v = raw * def.factor
    const bad = (def.key === 'allocation_dead' && (v < 0 || v > 1)) || (def.key === 'start_year' && (v < 1900 || v > 2100)) || (def.key !== 'allocation_dead' && def.key !== 'start_year' && !(v > 0))
    if (bad) { out.errors.push(`Row ${row}: ${name} = ${raw} is outside the valid range`); return }
    const source = (r.source || '').trim()
    let status = STATUSES.find((s) => s.toLowerCase() === (r.status || '').toLowerCase()) ?? 'Published Estimate'
    let evidence: Evidence = (['primary', 'secondary', 'none'] as const).find((e) => e === (r.evidence || '').toLowerCase()) ?? 'secondary'
    if (!source) {
      status = 'Assumed'; evidence = 'none'
      out.warnings.push(`Row ${row}: no source given for ${name} — applied but labelled “Assumed”. Add a source to mark it as published/observed.`)
    }
    out.params.push({ key: def.key, value: v, source: source || 'No source supplied', url: (r.source_url || r.url || '').trim(), status, evidence, note: r.note || '' })
  })
  out.rows = out.params.length
}

function parseReferences(text: string, out: Parsed) {
  parseCSV(text).forEach((r, i) => {
    if (!r.title || !/^https?:\/\//i.test(r.url || '')) { out.errors.push(`Row ${i + 2}: title and an http(s) url are required`); return }
    out.refs.push({ id: `UREF-${Date.now().toString(36)}-${i}`, title: r.title, publisher: r.publisher || '—', year: r.year || '—', kind: (['Website', 'PDF', 'Paper', 'Data portal', 'Dataset'] as const).find((k) => k.toLowerCase() === (r.type || '').toLowerCase()) ?? 'Website',
      category: 'User added', url: r.url, contains: r.note || r.contains || 'Added by user.', checked: 'user', usedFor: r.used_for || '' })
  })
  out.rows = out.refs.length
}

export function parseCsvText(fileName: string, text: string, forceKind?: Kind | null): Parsed {
  const rows = parseCSV(text)
  const headers = rows.length ? Object.keys(rows[0]) : (text.split(/\r?\n/)[0] || '').split(',').map((h) => h.trim().toLowerCase())
  const kind = forceKind ?? detectKind(headers, fileName)
  const out = empty(fileName, kind)
  if (!kind) { out.errors.push('Could not tell what this file contains. Use a header from data-inbox/templates (e.g. rainfall_mm, startYear, parameter,value).'); return out }
  if (!rows.length) { out.errors.push('The file has a header but no data rows.'); return out }
  if (kind === 'rainfall') {
    const r = rainfallFromCSV(text); out.rainfall = r.records; out.errors.push(...r.errors); out.rows = r.records.length
    if (rows[0].data_status === undefined && r.records.length) { out.rainfall = r.records.map((x) => ({ ...x, data_status: 'Assumed' as DataStatus })); out.warnings.push('No data_status column — records labelled “Assumed”. Add data_status (Observed / Modelled / …) to label them properly.') }
    if (r.records.some((x) => !x.source || x.source === 'Imported CSV')) out.warnings.push('Some rows have no source — every value should name its source.')
  } else if (kind === 'events') { const r = eventsFromCSV(text); out.events = r.events; out.errors.push(...r.errors); out.rows = r.events.length }
  else if (kind === 'survey') { out.capObs = capFromCSV(text); out.rows = out.capObs.length }
  else if (kind === 'sediment') { out.sedObs = sedFromCSV(text); out.rows = out.sedObs.length }
  else if (kind === 'parameters') parseParameters(text, out)
  else parseReferences(text, out)
  if (out.rows === 0 && !out.errors.length) out.errors.push('No valid rows found.')
  return out
}

/** JSON uploads: an object whose keys are kinds, each an array of row objects (same fields as the CSV columns). */
export function parseUpload(fileName: string, text: string): Parsed[] {
  if (/\.json$/i.test(fileName)) {
    try {
      const j = JSON.parse(text) as Record<string, Record<string, unknown>[]>
      const res: Parsed[] = []
      for (const k of Object.keys(j)) {
        const kind = (['rainfall', 'events', 'survey', 'sediment', 'parameters', 'references'] as const).find((x) => x === k.toLowerCase())
        if (!kind || !Array.isArray(j[k]) || !j[k].length) continue
        const cols = [...new Set(j[k].flatMap((row) => Object.keys(row)))]
        res.push(parseCsvText(`${fileName}#${kind}`, toCSV(j[k], cols), kind))
      }
      if (res.length) return res
      const e = empty(fileName, null); e.errors.push('JSON must look like {"rainfall":[{…}], "parameters":[{…}], …}'); return [e]
    } catch { const e = empty(fileName, null); e.errors.push('This is not valid JSON.'); return [e] }
  }
  return [parseCsvText(fileName, text)]
}
