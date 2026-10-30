import { Download, FileText } from 'lucide-react'
import { ChartB } from '../components/charts'
import { ReservoirPanel } from '../components/Reservoir'
import { Alert, Badge, Card, Kpi, fmt } from '../components/ui'
import { QueryCard, YearSelector } from '../components/YearQuery'
import { formatThreshold, rowAt, SCENARIOS } from '../engine/model'
import { useApp } from '../state'
import { effectiveProv, PARAM_META, type ParamKey } from '../data/provenance'
import { download } from '../utils/csv'
import { forecastToCSV } from '../utils/exporters'
import { buildReport } from '../utils/pdf'

export function useReport() {
  const { all, params, events, scenario, year, rainSummary, prov } = useApp()
  const refRain = all[scenario].refRainfallMm
  const provRows = (Object.keys(PARAM_META) as ParamKey[]).map((k) => { const e = effectiveProv(prov[k], PARAM_META[k].get(params)); return { label: PARAM_META[k].label, value: `${PARAM_META[k].get(params)} ${PARAM_META[k].unit}`, status: e.status, evidence: e.evidence, source: e.source } })
  return () => buildReport({ all, params, events, scenario, year, refRain, provRows,
    rainSummary: `${Object.keys(rainSummary.values).length} annual values loaded (${rainSummary.firstYear ?? '–'}–${rainSummary.lastYear ?? '–'}); default dataset is SIMULATED. Yield method: ${params.yieldMethod}.` })
}

export default function Overview({ go }: { go: (p: string) => void }) {
  const { all, scenario, year, params, events, rainSummary, prov } = useApp()
  const liveProv = effectiveProv(prov.original_live_mm3, params.originalLiveMm3)
  const res = all[scenario]
  const r = rowAt(res, year)
  const last = res.rows.find((x) => x.year === Math.min(params.forecastStartYear, params.endYear)) ?? res.rows[res.rows.length - 1]
  const current = r ?? last
  const evWithDate = [...events].sort((a, b) => b.startYear * 12 + b.startMonth - (a.startYear * 12 + a.startMonth))
  const lastRecorded = evWithDate.find((e) => e.verification !== 'Sample' && e.verification !== 'Hypothetical')
  const report = useReport()
  const thr = (res.thresholds.find((t) => t.pct === 70)?.year ?? null)
  const status = !r ? 'Model stopped' : r.liveLostPct >= 40 ? 'Below 60 % threshold' : r.liveLostPct >= 30 ? 'Below 70 % threshold' : r.liveLostPct >= 20 ? 'Below 80 % threshold' : 'Above 80 % of original live storage'
  return (
    <div className="space-y-4">
      <Alert>Demonstration model. Each input shows its source status (Methodology &amp; Data); rainfall is simulated. Outputs are <strong>model estimates, not an official BBMB forecast</strong>. See Methodology &amp; Data.</Alert>
      <div className="card card-pad flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="label">Scenario</span>
            <ScenarioPicker />
          </div>
          <YearSelector />
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => download(`PongSilt_forecast_${scenario}.csv`, forecastToCSV(res))}><Download size={15} aria-hidden /> Forecast CSV</button>
          <button className="btn btn-primary" onClick={report}><FileText size={15} aria-hidden /> PDF report</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Original live storage" value={fmt(params.originalLiveMm3 / 1000, 2)} unit="BCM" kind={liveProv.status === 'Published Estimate' ? 'Published estimate' : liveProv.status === 'Observed' ? 'Measured' : 'Assumed input'} note={liveProv.status === 'Assumed' ? (liveProv.modified ? 'Edited — differs from cited value' : 'No source — assumed') : `${liveProv.evidence === 'primary' ? 'Primary source' : 'Secondary citation'} — see Reference Library`} />
        <Kpi label={`Cumulative net silt loss (${year})`} value={fmt(current.cumNetLossMm3, 0)} unit="Mm³" kind="Model estimate" note={`Trapped ${fmt(current.cumTrappedMm3, 0)} Mm³ before removal`} />
        <Kpi label={`Remaining live storage (${year})`} value={fmt(current.liveMm3 / 1000, 3)} unit="BCM" kind="Model estimate" note={`${fmt(current.liveMm3, 0)} Mm³`} />
        <Kpi label="Original live storage lost" value={fmt(current.liveLostPct, 2)} unit="%" kind="Model estimate" note={`Year ${current.year}`} />
        <Kpi label="Annual net siltation rate" value={fmt(current.netMm3, 2)} unit="Mm³/yr" kind="Model estimate" note={`${scenario} scenario, ${current.year}`} tip="Net = compacted trapped sediment − removal. Gross inflow is shown separately." />
        <Kpi label="Latest rainfall observation" value={rainSummary.lastYear ? String(rainSummary.lastYear) : 'None'} kind={rainSummary.lastYear ? 'Assumed input' : 'Assumed input'} note={rainSummary.lastYear ? 'Loaded data (default is SIMULATED)' : 'No rainfall loaded'} />
        <Kpi label="Most recent desilting event" value={lastRecorded ? `${lastRecorded.startYear}-${String(lastRecorded.startMonth).padStart(2, '0')}` : 'None recorded'} kind="Observed record" note={lastRecorded ? `${lastRecorded.method}, ${lastRecorded.verification}` : evWithDate.length ? 'Only a SAMPLE event exists' : undefined} />
        <Kpi label="Year live storage < 70 %" value={formatThreshold(thr)} kind="Forecast" note={`${scenario} scenario`} />
      </div>

      <Card title="Forecast summary" subtitle={`Scenario: ${scenario} · Forecast year: ${year}`} right={<Badge kind="Forecast">Model estimate</Badge>}>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="muted text-xs">Estimated remaining storage</p>
            <p className="text-xl font-semibold tabular-nums">{r ? `${fmt(r.liveMm3, 0)} Mm³ live` : '—'}</p>
            <p className="muted text-xs">{r ? `${fmt(r.deadMm3, 0)} Mm³ dead (assumed allocation)` : ''}</p>
            <p className="mt-2 text-sm"><Badge kind="Modelled">{status}</Badge></p>
          </div>
          <div>
            <p className="muted text-xs">Threshold years (% of original live storage)</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {res.thresholds.map((t) => <li key={t.pct}>{t.pct}%: <strong>{formatThreshold(t.year)}</strong></li>)}
              <li>Dead storage depleted: <strong>{formatThreshold(res.deadDepletionYear)}</strong></li>
            </ul>
          </div>
          <div className="text-xs">
            <p className="muted">Assumptions &amp; uncertainty</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Yield {params.yields[scenario]} Mm³/yr ({params.yieldMethod}); not a measured value.</li>
              <li>Allocation {(params.allocation.dead * 100).toFixed(0)}% dead / {(params.allocation.live * 100).toFixed(0)}% live is assumed.</li>
              <li>Trap efficiency from approximate Brune curve.</li>
              <li>No uncertainty bounds are computed; scenario spread is illustrative only.</li>
            </ul>
          </div>
        </div>
        {res.warnings.length > 0 && <div className="mt-3"><Alert>{res.warnings.join(' ')}</Alert></div>}
      </Card>

      <Card title="Scenario comparison" subtitle="Remaining live storage (Mm³) — model estimates">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Scenario</th>{[2030, 2040, 2050, 2060, 2070].map((y) => <th key={y}>{y}</th>)}<th>80 %</th><th>70 %</th><th>60 %</th></tr></thead>
            <tbody>
              {SCENARIOS.map((s) => (
                <tr key={s} className={s === scenario ? 'font-semibold' : ''}>
                  <td className="capitalize">{s}</td>
                  {[2030, 2040, 2050, 2060, 2070].map((y) => <td key={y} className="tabular-nums">{fmt(rowAt(all[s], y)?.liveMm3, 0)}</td>)}
                  {all[s].thresholds.map((t) => <td key={t.pct} className="text-xs">{t.year ?? 'Not reached within forecast horizon'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><QueryCard /></div>
        <ReservoirPanel />
      </div>
      <ChartB />
      <p className="muted text-xs">More charts: <button className="underline" onClick={() => go('forecast')}>Silt Forecast</button> · <button className="underline" onClick={() => go('trends')}>Historical Trends</button></p>
    </div>
  )
}

export function ScenarioPicker() {
  const { scenario, setScenario } = useApp()
  return (
    <div role="radiogroup" aria-label="Scenario" className="inline-flex overflow-hidden rounded-md border" style={{ borderColor: 'var(--line)' }}>
      {SCENARIOS.map((s) => (
        <button key={s} role="radio" aria-checked={s === scenario} onClick={() => setScenario(s)}
          className={`px-3 py-1.5 text-sm capitalize focus-visible:ring-2 ring-reservoir-400 outline-none ${s === scenario ? 'bg-navy-800 text-white' : ''}`}>{s}</button>
      ))}
    </div>
  )
}
