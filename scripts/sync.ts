/**
 * Data-inbox sync. Reads every CSV in /data-inbox, validates it with the same parsers the app's
 * Import buttons use, and writes public/data/inbox.json. The running app polls that file and
 * merges it, so dropping or editing a CSV updates the site automatically.
 *
 * File name decides the data type (case-insensitive prefix):
 *   rainfall*.csv · events*.csv / desilting*.csv · survey*.csv · sediment*.csv · parameters*.csv · references*.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseCSV } from '../src/utils/csv'
import { capFromCSV, eventsFromCSV, rainfallFromCSV, sedFromCSV } from '../src/utils/exporters'
import { parseCsvText, type ParamUpdate } from '../src/utils/ingest'
import type { ReferenceItem } from '../src/data/references'
import type { CapacityObservation, DesiltingEvent, RainfallRecord, SedimentObservation } from '../src/engine/types'

export interface InboxData {
  generatedAt: string
  rainfall: RainfallRecord[]
  events: DesiltingEvent[]
  capObs: CapacityObservation[]
  sedObs: SedimentObservation[]
  params: ParamUpdate[]
  refs: ReferenceItem[]
  report: { files: { name: string; kind: string; rows: number }[]; warnings: string[]; errors: string[] }
}

const kindOf = (f: string) => {
  const n = f.toLowerCase()
  if (n.startsWith('rainfall')) return 'rainfall'
  if (n.startsWith('events') || n.startsWith('desilting')) return 'events'
  if (n.startsWith('survey')) return 'survey'
  if (n.startsWith('sediment')) return 'sediment'
  if (n.startsWith('param')) return 'parameters'
  if (n.startsWith('reference')) return 'references'
  return null
}

export function syncInbox(root: string): InboxData {
  const dir = path.join(root, 'data-inbox')
  fs.mkdirSync(dir, { recursive: true })
  const out: InboxData = { generatedAt: new Date().toISOString(), rainfall: [], events: [], capObs: [], sedObs: [], params: [], refs: [], report: { files: [], warnings: [], errors: [] } }
  const rain = new Map<string, RainfallRecord>()
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')).sort()
  for (const f of files) {
    const kind = kindOf(f)
    if (!kind) { out.report.warnings.push(`${f}: ignored (name must start with rainfall, events, desilting, survey or sediment)`); continue }
    const text = fs.readFileSync(path.join(dir, f), 'utf8')
    const slug = f.replace(/\.csv$/i, '').replace(/[^a-z0-9]+/gi, '-')
    let rows = 0
    if (kind === 'rainfall') {
      const { records, errors } = rainfallFromCSV(text)
      const hasStatus = (parseCSV(text)[0] ?? {}).data_status !== undefined
      if (!hasStatus && records.length) out.report.warnings.push(`${f}: no data_status column — records marked "Assumed" (add the column to label them Observed/Modelled/etc.)`)
      records.forEach((r, i) => {
        const rec = { ...r, id: `INBOX-R-${slug}-${i + 1}`, data_status: hasStatus ? r.data_status : ('Assumed' as const) }
        rain.set(`${rec.station_name}|${rec.year}|${rec.month}`, rec) // later files override earlier ones
      })
      rows = records.length
      errors.forEach((e) => out.report.errors.push(`${f}: ${e}`))
    } else if (kind === 'events') {
      const { events, errors } = eventsFromCSV(text)
      events.forEach((e, i) => out.events.push({ ...e, id: `INBOX-${e.id.startsWith('EV-') ? `${slug}-${i + 1}` : e.id}` }))
      rows = events.length
      errors.forEach((e) => out.report.errors.push(`${f}: ${e}`))
    } else if (kind === 'survey') {
      const r = capFromCSV(text); r.forEach((x, i) => out.capObs.push({ ...x, id: `INBOX-C-${slug}-${i + 1}` })); rows = r.length
    } else if (kind === 'parameters' || kind === 'references') {
      const r = parseCsvText(f, text, kind)
      out.params.push(...r.params); out.refs.push(...r.refs.map((x, i) => ({ ...x, id: `INBOX-REF-${slug}-${i + 1}` })))
      r.errors.forEach((e) => out.report.errors.push(`${f}: ${e}`)); r.warnings.forEach((w) => out.report.warnings.push(`${f}: ${w}`))
      rows = r.rows
    } else {
      const r = sedFromCSV(text); r.forEach((x, i) => out.sedObs.push({ ...x, id: `INBOX-S-${slug}-${i + 1}` })); rows = r.length
    }
    out.report.files.push({ name: f, kind, rows })
  }
  out.rainfall = [...rain.values()]
  const pub = path.join(root, 'public', 'data')
  fs.mkdirSync(pub, { recursive: true })
  fs.writeFileSync(path.join(pub, 'inbox.json'), JSON.stringify(out))
  return out
}
