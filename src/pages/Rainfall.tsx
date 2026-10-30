import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartD } from '../components/charts'
import { Alert, Badge, Card, Empty, NumField, Select } from '../components/ui'
import { annualRainfall, filterRainfall, MONTH_NAMES, monthlyStats, sourcesOf, stationsOf } from '../engine/rainfall'
import type { DataStatus, RainfallRecord } from '../engine/types'
import { useApp } from '../state'
import { download } from '../utils/csv'
import { rainfallFromCSV, rainfallToCSV } from '../utils/exporters'

const STAT: DataStatus[] = ['Observed', 'Published Estimate', 'Modelled', 'Assumed', 'Simulated', 'Missing']
const blank = (): RainfallRecord => ({ id: '', year: new Date().getFullYear() - 1, month: 1, rainfall_mm: null, station_name: '', latitude: null, longitude: null, source: '', data_status: 'Observed' })

export default function Rainfall() {
  const { rainfall, setRainfall, params, setParams, all, scenario, rainSummary } = useApp()
  const [fy, setFy] = useState(''), [fm, setFm] = useState('all'), [fs, setFs] = useState('all'), [fsrc, setFsrc] = useState('all')
  const [draft, setDraft] = useState<RainfallRecord>(blank())
  const [msg, setMsg] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const stations = stationsOf(rainfall), sources = sourcesOf(rainfall)
  const filtered = useMemo(() => filterRainfall(rainfall, { year: fy ? Number(fy) : null, month: fm === 'all' ? null : Number(fm), station: fs, source: fsrc }).sort((a, b) => b.year - a.year || a.month - b.month), [rainfall, fy, fm, fs, fsrc])
  const annual = useMemo(() => annualRainfall(rainfall, { station: fs, source: fsrc }), [rainfall, fs, fsrc])
  const stats = useMemo(() => monthlyStats(rainfall, { station: fs, source: fsrc, year: fy ? Number(fy) : null }), [rainfall, fs, fsrc, fy])
  const annualData = Object.entries(annual.values).map(([y, v]) => ({ year: Number(y), rain: v })).sort((a, b) => a.year - b.year)
  const res = all[scenario]
  const forecastRain = res.rows.filter((r) => r.rainfallSource === 'forecast-assumption').map((r) => ({ year: r.year, forecast: r.rainfallMm }))
  const combined = [...annualData.map((d) => ({ ...d, forecast: null as number | null })), ...forecastRain.map((d) => ({ year: d.year, rain: null as number | null, forecast: d.forecast }))]
  const monthData = stats.map((s) => ({ month: MONTH_NAMES[s.month - 1], mean: s.mean, min: s.min, max: s.max }))
  const total = stats.reduce((a, s) => a + (s.mean ?? 0), 0)
  const monsoon = stats.filter((s) => s.month >= 6 && s.month <= 9).reduce((a, s) => a + (s.mean ?? 0), 0)

  const save = () => {
    if (!draft.station_name.trim() || !draft.source.trim()) { setMsg('Station name and source are required so every value stays traceable.'); return }
    if (draft.rainfall_mm != null && draft.rainfall_mm < 0) { setMsg('Rainfall cannot be negative.'); return }
    if (draft.month < 0 || draft.month > 12) { setMsg('Month must be 1–12 (0 = annual total).'); return }
    if (editId) setRainfall(rainfall.map((r) => (r.id === editId ? { ...draft, id: editId } : r)))
    else setRainfall([...rainfall, { ...draft, id: `R-${Date.now().toString(36)}` }])
    setMsg(editId ? 'Record updated.' : 'Record added.'); setEditId(null); setDraft(blank())
  }
  const onImport = async (f: File | undefined) => {
    if (!f) return
    const { records, errors } = rainfallFromCSV(await f.text())
    if (records.length) setRainfall([...rainfall, ...records])
    setMsg(`Imported ${records.length} record(s).${errors.length ? ` ${errors.length} row(s) skipped: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}` : ''}`)
    if (file.current) file.current.value = ''
  }

  return (
    <div className="space-y-4">
      <Alert kind="info">
        <strong>Rainfall type matters.</strong> <em>Point rainfall</em> is a single gauge and may not represent the upstream catchment. <em>Spatially averaged catchment rainfall</em> combines gauges (e.g., Thiessen weighting) or gridded products over the basin area. <em>Satellite-derived precipitation</em> (e.g., IMERG, CHIRPS) is an estimate with its own bias. This app averages the stations it holds; it does not compute true catchment averages. Bundled data is <strong>SIMULATED</strong>.
      </Alert>

      <Card title="Yield–rainfall relationship" subtitle="Rainfall influences sediment only through the method selected below">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Yield method" value={params.yieldMethod} onChange={(v) => setParams((p) => ({ ...p, yieldMethod: v }))} options={[
            { value: 'fixed', label: '1 · Fixed annual sediment yield' }, { value: 'rainfall', label: '2 · Rainfall-adjusted (empirical power law)' }, { value: 'regression', label: '3 · Historical regression (needs data)' }]} />
          <Select label="Rainfall station used by model" value={params.rain.station} onChange={(v) => setParams((p) => ({ ...p, rain: { ...p.rain, station: v } }))} options={[{ value: 'all', label: 'All stations (mean)' }, ...stations.map((s) => ({ value: s, label: s }))]} />
        </div>
        <div className="mt-3 rounded-md border p-3 text-sm" style={{ borderColor: 'var(--line)' }}>
          {params.yieldMethod === 'fixed' && <p><strong>Equation:</strong> S_i(t) = S_ref (scenario value). Rainfall has no effect. <br /><span className="muted text-xs">Calibration: none. Coverage: n/a. Limitation: ignores wet/dry-year variability.</span></p>}
          {params.yieldMethod === 'rainfall' && <p><strong>Equation:</strong> S_i(t) = S_ref · (R(t)/R_ref)<sup>β</sup>, with R_ref = {res.refRainfallMm ? `${res.refRainfallMm.toFixed(0)} mm` : 'unavailable'}, β = {params.rain.beta}. <br /><span className="muted text-xs">Calibration period: none — β and R_ref are user-set, not fitted. Coverage: {Object.keys(rainSummary.values).length} annual values ({rainSummary.firstYear ?? '–'}–{rainSummary.lastYear ?? '–'}). Limitation: ignores intensity, land cover, snowmelt and sediment supply limits; years without rainfall fall back to fixed yield.</span></p>}
          {params.yieldMethod === 'regression' && (res.regression
            ? <p><strong>Equation:</strong> ln S = {res.regression.a.toFixed(3)} + {res.regression.b.toFixed(3)} · ln R (scaled per scenario). <br /><span className="muted text-xs">Calibration {res.regression.periodStart}–{res.regression.periodEnd}; n = {res.regression.n}; R² = {res.regression.r2.toFixed(3)}. Limitation: association only; extrapolation beyond observed rainfall is uncertain.</span></p>
            : <p>Regression unavailable: it needs ≥ {Math.max(3, params.regression.minPoints)} years with both rainfall and a sediment-inflow observation (add them in Historical Trends). The model uses fixed yield meanwhile.</p>)}
        </div>
      </Card>

      <ChartD />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monthly rainfall distribution" subtitle={`Mean monthly totals (mm/month)${fy ? ` · ${fy}` : ' · all years'}`}>
          <div className="h-64" role="img" aria-label="Bar chart of monthly rainfall">
            <ResponsiveContainer><ComposedChart data={monthData}>
              <CartesianGrid stroke="#8a9bb033" /><XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#7d8da0" /><YAxis tick={{ fontSize: 11 }} stroke="#7d8da0" label={{ value: 'mm/month', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#7d8da0' }} />
              <Tooltip formatter={(v: number) => `${v?.toFixed(1)} mm`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="mean" name="Mean" fill="#3b8ccb" /><Line dataKey="max" name="Max" stroke="#c27a14" dot={false} strokeDasharray="4 3" /><Line dataKey="min" name="Min" stroke="#2b8a8a" dot={false} strokeDasharray="4 3" />
            </ComposedChart></ResponsiveContainer>
          </div>
          <p className="muted mt-2 text-xs">Seasonal pattern: Jun–Sep (monsoon) ≈ {total > 0 ? ((monsoon / total) * 100).toFixed(0) : '–'} % of the filtered mean annual total ({total.toFixed(0)} mm). Source: loaded records.</p>
        </Card>
        <Card title="Annual rainfall vs forecast scenario" subtitle="Annual totals (solid) vs forecast-assumption rainfall (dashed)">
          <div className="h-64" role="img" aria-label="Line chart of annual rainfall">
            {combined.length ? <ResponsiveContainer><ComposedChart data={combined}>
              <CartesianGrid stroke="#8a9bb033" /><XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#7d8da0" /><YAxis tick={{ fontSize: 11 }} stroke="#7d8da0" domain={['auto', 'auto']} label={{ value: 'mm/yr', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#7d8da0' }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="rain" name="Annual rainfall (loaded data)" stroke="#1f6fb2" strokeWidth={2} connectNulls /><Line dataKey="forecast" name="Forecast assumption" stroke="#3b8ccb" strokeDasharray="7 4" dot={false} />
            </ComposedChart></ResponsiveContainer> : <Empty title="No annual totals" hint="A year needs a month-0 annual row or all 12 monthly values." />}
          </div>
          <div className="mt-2 w-48"><NumField label="Future rainfall change (%)" value={params.rain.futureChangePct} onChange={(v) => setParams((p) => ({ ...p, rain: { ...p.rain, futureChangePct: v } }))} tip="Changes the forecast-year rainfall assumption (requires a non-fixed yield method to affect sediment)." /></div>
        </Card>
      </div>

      <Card title="Missing observations" subtitle="Incomplete years are never silently summed">
        {annual.missingYears.length === 0 && annual.missing.length === 0 ? <p className="text-sm">No gaps detected in the filtered data.</p> : (
          <div className="space-y-1 text-sm">
            {annual.missingYears.length > 0 && <p>Years with no records: <strong>{annual.missingYears.join(', ')}</strong></p>}
            {annual.missing.slice(0, 20).map((m) => <p key={m.station + m.year}>{m.station}, {m.year}: missing {m.missingMonths.map((x) => MONTH_NAMES[x - 1]).join(', ')} — annual total excluded</p>)}
          </div>
        )}
      </Card>

      <Card title="Rainfall records" subtitle={`${filtered.length} of ${rainfall.length} records`}
        right={<div className="flex gap-2">
          <button className="btn" onClick={() => download('pongsilt_rainfall.csv', rainfallToCSV(rainfall))}><Download size={15} aria-hidden /> Export CSV</button>
          <button className="btn" onClick={() => file.current?.click()}><Upload size={15} aria-hidden /> Import CSV</button>
          <input ref={file} type="file" accept=".csv,text/csv" className="hidden" aria-label="Import rainfall CSV" onChange={(e) => onImport(e.target.files?.[0])} />
        </div>}>
        <p className="muted mb-2 text-xs">CSV columns: year, month (1–12, 0 = annual), rainfall_mm, station_name, latitude, longitude, source, data_status.</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-4">
          <label><span className="label">Year</span><input className="input" inputMode="numeric" value={fy} onChange={(e) => setFy(e.target.value)} placeholder="all" /></label>
          <Select label="Month" value={fm} onChange={setFm} options={[{ value: 'all', label: 'All' }, { value: '0', label: 'Annual total' }, ...MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))]} />
          <Select label="Station" value={fs} onChange={setFs} options={[{ value: 'all', label: 'All' }, ...stations.map((s) => ({ value: s, label: s }))]} />
          <Select label="Source" value={fsrc} onChange={setFsrc} options={[{ value: 'all', label: 'All' }, ...sources.map((s) => ({ value: s, label: s }))]} />
        </div>

        <form className="mb-3 grid gap-2 rounded-md border p-3 sm:grid-cols-4" style={{ borderColor: 'var(--line)' }} onSubmit={(e) => { e.preventDefault(); save() }}>
          <NumField label="Year" step="1" value={draft.year} onChange={(v) => setDraft({ ...draft, year: Math.round(v) })} />
          <NumField label="Month (0 = annual)" step="1" min={0} max={12} value={draft.month} onChange={(v) => setDraft({ ...draft, month: Math.round(v) })} />
          <NumField label="Rainfall (mm)" min={0} value={draft.rainfall_mm} onChange={(v) => setDraft({ ...draft, rainfall_mm: v })} />
          <Select label="Status" value={draft.data_status} onChange={(v) => setDraft({ ...draft, data_status: v })} options={STAT.map((s) => ({ value: s, label: s }))} />
          <label><span className="label">Station name *</span><input className="input" value={draft.station_name} onChange={(e) => setDraft({ ...draft, station_name: e.target.value })} /></label>
          <label><span className="label">Source *</span><input className="input" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></label>
          <NumField label="Latitude" value={draft.latitude} onChange={(v) => setDraft({ ...draft, latitude: v })} />
          <NumField label="Longitude" value={draft.longitude} onChange={(v) => setDraft({ ...draft, longitude: v })} />
          <div className="flex items-end gap-2 sm:col-span-4">
            <button type="submit" className="btn btn-primary"><Plus size={15} aria-hidden /> {editId ? 'Save changes' : 'Add record'}</button>
            {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setDraft(blank()) }}>Cancel edit</button>}
            {msg && <span role="status" className="muted text-xs">{msg}</span>}
          </div>
        </form>

        <div className="max-h-96 overflow-auto">
          <table className="tbl">
            <thead className="sticky top-0" style={{ background: 'var(--card)' }}><tr><th>Year</th><th>Month</th><th>mm</th><th>Station</th><th>Source</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filtered.slice(0, 300).map((r) => (
                <tr key={r.id}>
                  <td>{r.year}</td><td>{r.month === 0 ? 'Annual' : MONTH_NAMES[r.month - 1]}</td><td className="tabular-nums">{r.rainfall_mm ?? '—'}</td><td>{r.station_name}</td><td className="text-xs">{r.source}</td><td><Badge kind={r.data_status}>{r.data_status}</Badge></td>
                  <td className="whitespace-nowrap">
                    <button className="btn !py-0.5 text-xs" onClick={() => { setDraft(r); setEditId(r.id) }}>Edit</button>{' '}
                    <button className="btn btn-danger !py-0.5" aria-label={`Delete ${r.station_name} ${r.year} month ${r.month}`} onClick={() => setRainfall(rainfall.filter((x) => x.id !== r.id))}><Trash2 size={13} aria-hidden /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <Empty title="No records match" hint="Clear the filters or add a record above." />}
          {filtered.length > 300 && <p className="muted p-2 text-xs">Showing first 300 rows — narrow the filters to see others.</p>}
        </div>
      </Card>
    </div>
  )
}
