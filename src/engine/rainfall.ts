import type { RainfallRecord } from './types'

export interface RainFilter {
  year?: number | null
  month?: number | null
  station?: string
  source?: string
}

export function filterRainfall(records: RainfallRecord[], f: RainFilter): RainfallRecord[] {
  return records.filter(
    (r) =>
      (f.year == null || r.year === f.year) &&
      (f.month == null || r.month === f.month) &&
      (!f.station || f.station === 'all' || r.station_name === f.station) &&
      (!f.source || f.source === 'all' || r.source === f.source),
  )
}

export interface MissingEntry {
  station: string
  year: number
  missingMonths: number[]
}

export interface AnnualRainSummary {
  values: Record<number, number>
  basis: Record<number, 'annual-row' | 'monthly-sum'>
  stationCount: Record<number, number>
  missing: MissingEntry[]
  missingYears: number[]
  firstYear: number | null
  lastYear: number | null
}

/**
 * Aggregate to annual totals per year.
 * For each station-year: use the annual row (month 0) if present, otherwise the
 * sum of the 12 monthly values ONLY if all 12 months exist (an incomplete year is
 * never silently summed). The year value is the mean over stations with a valid total.
 * NOTE: this is a mean of POINT rainfall values, not a true spatially averaged
 * catchment rainfall (which needs gridded data or area weighting such as Thiessen polygons).
 */
export function annualRainfall(records: RainfallRecord[], f: RainFilter = {}): AnnualRainSummary {
  const recs = filterRainfall(records, { station: f.station, source: f.source })
  const key = (st: string, y: number) => `${st}||${y}`
  const groups = new Map<string, RainfallRecord[]>()
  for (const r of recs) {
    const k = key(r.station_name, r.year)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }
  const byYear = new Map<number, number[]>()
  const basis: Record<number, 'annual-row' | 'monthly-sum'> = {}
  const missing: MissingEntry[] = []
  for (const [k, list] of groups) {
    const [station, ys] = k.split('||')
    const year = Number(ys)
    const annual = list.find((r) => r.month === 0 && r.rainfall_mm != null)
    let total: number | null = null
    if (annual) {
      total = annual.rainfall_mm
      basis[year] = 'annual-row'
    } else {
      const months = new Map<number, number>()
      for (const r of list) if (r.month >= 1 && r.month <= 12 && r.rainfall_mm != null) months.set(r.month, r.rainfall_mm)
      if (months.size === 12) {
        total = [...months.values()].reduce((a, b) => a + b, 0)
        basis[year] = basis[year] ?? 'monthly-sum'
      } else {
        const miss: number[] = []
        for (let m = 1; m <= 12; m++) if (!months.has(m)) miss.push(m)
        missing.push({ station, year, missingMonths: miss })
      }
    }
    if (total != null) {
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(total)
    }
  }
  const values: Record<number, number> = {}
  const stationCount: Record<number, number> = {}
  for (const [y, arr] of byYear) {
    values[y] = arr.reduce((a, b) => a + b, 0) / arr.length
    stationCount[y] = arr.length
  }
  const allYears = recs.map((r) => r.year)
  const firstYear = allYears.length ? Math.min(...allYears) : null
  const lastYear = allYears.length ? Math.max(...allYears) : null
  const present = new Set(allYears)
  const missingYears: number[] = []
  if (firstYear != null && lastYear != null)
    for (let y = firstYear; y <= lastYear; y++) if (!present.has(y)) missingYears.push(y)
  missing.sort((a, b) => a.year - b.year)
  return { values, basis, stationCount, missing, missingYears, firstYear, lastYear }
}

export interface MonthStat {
  month: number
  mean: number | null
  min: number | null
  max: number | null
  count: number
}

/** Monthly climatology over the filtered records (mean of station-means per year-month). */
export function monthlyStats(records: RainfallRecord[], f: RainFilter = {}): MonthStat[] {
  const recs = filterRainfall(records, f).filter((r) => r.month >= 1 && r.month <= 12 && r.rainfall_mm != null)
  const out: MonthStat[] = []
  for (let m = 1; m <= 12; m++) {
    const byYear = new Map<number, number[]>()
    for (const r of recs) {
      if (r.month !== m) continue
      if (!byYear.has(r.year)) byYear.set(r.year, [])
      byYear.get(r.year)!.push(r.rainfall_mm as number)
    }
    const vals = [...byYear.values()].map((a) => a.reduce((x, y) => x + y, 0) / a.length)
    out.push({
      month: m,
      mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null,
      count: vals.length,
    })
  }
  return out
}

export function stationsOf(records: RainfallRecord[]): string[] {
  return [...new Set(records.map((r) => r.station_name))].sort()
}
export function sourcesOf(records: RainfallRecord[]): string[] {
  return [...new Set(records.map((r) => r.source))].sort()
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
