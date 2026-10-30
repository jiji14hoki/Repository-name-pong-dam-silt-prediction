/**
 * Optional automatic rainfall download (Open-Meteo historical archive, ERA5-based reanalysis; no API key).
 *   npm run fetch:rainfall
 * Edit data-inbox/fetch-config.json to choose points and years. Output goes to data-inbox/rainfall_openmeteo_*.csv
 * and is picked up by the sync. IMPORTANT: this is gridded reanalysis at a POINT (~9–25 km cell), labelled
 * "Modelled". It is not a gauge observation and not a catchment average — use several points across the
 * catchment and treat results accordingly. Data: Open-Meteo.com (CC BY 4.0) — keep the attribution.
 */
import fs from 'node:fs'
import path from 'node:path'
import { toCSV } from '../src/utils/csv'
import { RAIN_COLUMNS } from '../src/utils/exporters'

export interface FetchPoint { name: string; latitude: number; longitude: number; fromYear: number; toYear: number }

const CFG = path.join(process.cwd(), 'data-inbox', 'fetch-config.json')
const DEFAULT: { points: FetchPoint[] } = {
  points: [{ name: 'Pong Dam indicative grid point (EDIT: use catchment points)', latitude: 32.0, longitude: 76.0, fromYear: 2000, toYear: new Date().getFullYear() - 1 }],
}

export function monthlyFromDaily(time: string[], precip: (number | null)[]): { year: number; month: number; mm: number }[] {
  const acc = new Map<string, { n: number; sum: number; days: number }>()
  time.forEach((d, i) => {
    const [y, m] = d.split('-').map(Number)
    const k = `${y}-${m}`
    const a = acc.get(k) ?? { n: 0, sum: 0, days: new Date(y, m, 0).getDate() }
    if (precip[i] != null) { a.n++; a.sum += precip[i] as number }
    acc.set(k, a)
  })
  const out: { year: number; month: number; mm: number }[] = []
  for (const [k, a] of acc) if (a.n === a.days) { const [y, m] = k.split('-').map(Number); out.push({ year: y, month: m, mm: Math.round(a.sum * 10) / 10 }) } // complete months only
  return out.sort((x, y) => x.year - y.year || x.month - y.month)
}

export async function fetchPoint(p: FetchPoint, fetchFn: typeof fetch = fetch) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${p.latitude}&longitude=${p.longitude}&start_date=${p.fromYear}-01-01&end_date=${p.toYear}-12-31&daily=precipitation_sum&timezone=Asia%2FKolkata`
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status} for ${p.name}`)
  const j = (await res.json()) as { daily?: { time: string[]; precipitation_sum: (number | null)[] } }
  if (!j.daily) throw new Error(`Unexpected response for ${p.name}`)
  return monthlyFromDaily(j.daily.time, j.daily.precipitation_sum).map((r) => ({
    year: r.year, month: r.month, rainfall_mm: r.mm, station_name: p.name, latitude: p.latitude, longitude: p.longitude,
    source: 'Open-Meteo ERA5 reanalysis grid point (CC BY 4.0)', data_status: 'Modelled',
  }))
}

async function main() {
  fs.mkdirSync(path.dirname(CFG), { recursive: true })
  if (!fs.existsSync(CFG)) { fs.writeFileSync(CFG, JSON.stringify(DEFAULT, null, 2)); console.log('Created data-inbox/fetch-config.json — edit it, then run again.') }
  const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')) as { points: FetchPoint[] }
  for (const p of cfg.points) {
    try {
      const rows = await fetchPoint(p)
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      fs.writeFileSync(path.join(process.cwd(), 'data-inbox', `rainfall_openmeteo_${slug}.csv`), toCSV(rows as unknown as Record<string, unknown>[], RAIN_COLUMNS))
      console.log(`[fetch] ${p.name}: ${rows.length} complete monthly values written`)
    } catch (e) { console.error('[fetch] failed:', (e as Error).message) }
  }
}
if (process.argv[1] && /fetch-rainfall/.test(process.argv[1])) void main()
