import { DATASET_VERSION } from '../data/defaults'
import { MONTH_NAMES } from '../engine/rainfall'
import type {
  CapacityObservation, DataStatus, DesiltingEvent, EventMethod, EventVerification,
  RainfallRecord, ScenarioResult, SedimentObservation,
} from '../engine/types'
import { num, parseCSV, toCSV } from './csv'

const STATUSES: DataStatus[] = ['Observed', 'Published Estimate', 'Modelled', 'Assumed', 'Simulated', 'Missing']
const asStatus = (s: string): DataStatus => (STATUSES.find((x) => x.toLowerCase() === s.toLowerCase()) ?? 'Assumed')
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const RAIN_COLUMNS = ['year', 'month', 'rainfall_mm', 'station_name', 'latitude', 'longitude', 'source', 'data_status']
export const rainfallToCSV = (r: RainfallRecord[]) => toCSV(r as unknown as Record<string, unknown>[], RAIN_COLUMNS)

export function rainfallFromCSV(text: string): { records: RainfallRecord[]; errors: string[] } {
  const errors: string[] = []
  const records: RainfallRecord[] = []
  parseCSV(text).forEach((r, i) => {
    const year = num(r.year)
    let month = num(r.month)
    if (month == null && r.month) {
      const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === r.month.slice(0, 3).toLowerCase())
      month = idx >= 0 ? idx + 1 : null
    }
    if (year == null || month == null || month < 0 || month > 12) { errors.push(`Row ${i + 2}: invalid year or month (use month 1–12, or 0 for an annual total)`); return }
    const mm = num(r.rainfall_mm)
    if (mm != null && mm < 0) { errors.push(`Row ${i + 2}: negative rainfall`); return }
    records.push({
      id: uid('R'), year, month, rainfall_mm: mm, station_name: r.station_name || 'Unnamed station',
      latitude: num(r.latitude), longitude: num(r.longitude), source: r.source || 'Imported CSV',
      data_status: r.data_status ? asStatus(r.data_status) : 'Observed',
    })
  })
  return { records, errors }
}

export const EVENT_COLUMNS = ['id', 'startYear', 'startMonth', 'endYear', 'endMonth', 'operationDate', 'volumeMm3', 'rate', 'method', 'source', 'verification', 'notes', 'includeInModel']
export const eventsToCSV = (e: DesiltingEvent[]) => toCSV(e as unknown as Record<string, unknown>[], EVENT_COLUMNS)

export function eventsFromCSV(text: string): { events: DesiltingEvent[]; errors: string[] } {
  const errors: string[] = []
  const events: DesiltingEvent[] = []
  const methods: EventMethod[] = ['Dredging', 'Desilting', 'Hydraulic flushing', 'Other']
  const vers: EventVerification[] = ['Verified', 'Unverified', 'Sample', 'Hypothetical']
  parseCSV(text).forEach((r, i) => {
    const sy = num(r.startyear)
    if (sy == null) { errors.push(`Row ${i + 2}: startYear is required`); return }
    const vol = num(r.volumemm3)
    if (vol != null && vol < 0) { errors.push(`Row ${i + 2}: negative volume`); return }
    events.push({
      id: r.id || uid('EV'), startYear: sy, startMonth: num(r.startmonth) ?? 1,
      endYear: num(r.endyear), endMonth: num(r.endmonth), operationDate: r.operationdate || `${sy}`,
      volumeMm3: vol, rate: r.rate || '',
      method: methods.find((m) => m.toLowerCase() === (r.method || '').toLowerCase()) ?? 'Desilting',
      source: r.source || 'Imported CSV',
      verification: vers.find((v) => v.toLowerCase() === (r.verification || '').toLowerCase()) ?? 'Unverified',
      notes: r.notes || '',
      includeInModel: (r.includeinmodel || '').toLowerCase() === 'true' && vol != null,
    })
  })
  return { events, errors }
}

export const CAP_COLUMNS = ['id', 'year', 'liveStorageMm3', 'cumulativeSiltMm3', 'source', 'status', 'note']
export const capToCSV = (c: CapacityObservation[]) => toCSV(c as unknown as Record<string, unknown>[], CAP_COLUMNS)
export function capFromCSV(text: string): CapacityObservation[] {
  return parseCSV(text).flatMap((r) => {
    const y = num(r.year)
    return y == null ? [] : [{ id: uid('C'), year: y, liveStorageMm3: num(r.livestoragemm3), cumulativeSiltMm3: num(r.cumulativesiltmm3), source: r.source || 'Imported CSV', status: r.status ? asStatus(r.status) : 'Observed', note: r.note || '' }]
  })
}
export const SED_COLUMNS = ['id', 'year', 'annualSedimentInflowMm3', 'source', 'status', 'note']
export const sedToCSV = (c: SedimentObservation[]) => toCSV(c as unknown as Record<string, unknown>[], SED_COLUMNS)
export function sedFromCSV(text: string): SedimentObservation[] {
  return parseCSV(text).flatMap((r) => {
    const y = num(r.year)
    return y == null ? [] : [{ id: uid('SO'), year: y, annualSedimentInflowMm3: num(r.annualsedimentinflowmm3), source: r.source || 'Imported CSV', status: r.status ? asStatus(r.status) : 'Observed', note: r.note || '' }]
  })
}

export function forecastToCSV(res: ScenarioResult): string {
  const rows = res.rows.map((r) => ({
    scenario: res.scenario, dataset_version: DATASET_VERSION, year: r.year, kind: r.kind,
    rainfall_mm: r.rainfallMm == null ? '' : r.rainfallMm.toFixed(1), rainfall_basis: r.rainfallSource, yield_method: r.yieldMethodUsed,
    gross_inflow_Mm3: r.grossInflowMm3.toFixed(3), C_over_I: r.capacityInflowRatio.toFixed(4), trap_efficiency: r.trapEfficiency.toFixed(4),
    trapped_Mm3: r.trappedMm3.toFixed(3), compacted_Mm3: r.compactedMm3.toFixed(3), removed_Mm3: r.removedMm3.toFixed(3), net_Mm3: r.netMm3.toFixed(3),
    cum_trapped_Mm3: r.cumTrappedMm3.toFixed(2), cum_net_loss_Mm3: r.cumNetLossMm3.toFixed(2),
    live_Mm3: r.liveMm3.toFixed(2), dead_Mm3: r.deadMm3.toFixed(2), live_lost_pct: r.liveLostPct.toFixed(3), flags: r.flags.join(' | '),
  }))
  return '# Model Estimate - Not an Official BBMB Forecast\n' + toCSV(rows)
}
