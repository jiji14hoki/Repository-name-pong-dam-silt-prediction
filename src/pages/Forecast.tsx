import { Download, FileText, RotateCcw, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { ChartA, ChartB, ChartC } from '../components/charts'
import { Alert, Card, NumField, Select, fmt } from '../components/ui'
import { QueryCard } from '../components/YearQuery'
import { BRUNE_CURVES } from '../engine/brune'
import { calibrateYield, formatThreshold, rowAt, SCENARIOS } from '../engine/model'
import { useApp } from '../state'
import { BENCHMARKS } from '../data/provenance'
import { download } from '../utils/csv'
import { forecastToCSV } from '../utils/exporters'
import { ScenarioPicker, useReport } from './Overview'

export default function Forecast() {
  const { params: p, setParams, all, scenario, input, resetAll, year } = useApp()
  const res = all[scenario]
  const report = useReport()
  const [calMsg, setCalMsg] = useState('')
  const row = rowAt(res, year)
  const upd = (fn: (q: typeof p) => typeof p) => setParams((q) => fn(structuredClone(q)))

  const calibrate = () => {
    const y = calibrateYield(input, p.calibration.targetLossPct, p.calibration.referenceYear)
    if (y == null) { setCalMsg('Target cannot be reached with any yield ≤ 2000 Mm³/yr under the current assumptions.'); return }
    upd((q) => { q.yields.realistic = Math.round(y * 100) / 100; q.yields.optimistic = Math.round(y * 0.85 * 100) / 100; q.yields.pessimistic = Math.round(y * 1.15 * 100) / 100; return q })
    setCalMsg(`Realistic S_ref set to ${y.toFixed(2)} Mm³/yr so that live-storage loss in ${p.calibration.referenceYear} = ${p.calibration.targetLossPct}% (optimistic/pessimistic = −15 % / +15 %). This is curve matching to an UNVERIFIED target, not validation.`)
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <div><span className="label">Scenario</span><ScenarioPicker /></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => download(`PongSilt_forecast_${scenario}.csv`, forecastToCSV(res))}><Download size={15} aria-hidden /> Forecast CSV</button>
          <button className="btn" onClick={report}><FileText size={15} aria-hidden /> PDF report</button>
          <button className="btn btn-danger" onClick={() => { if (window.confirm('Reset ALL parameters, events, rainfall and observations to the demo defaults?')) resetAll() }}><RotateCcw size={15} aria-hidden /> Reset all to demo defaults</button>
        </div>
      </div>

      <Card title="Model parameters" subtitle="Every change recalculates all charts, KPIs and scenarios. All defaults are provisional/assumed.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Reservoir (assumed)</legend>
            <NumField label="Original live storage (Mm³)" value={p.originalLiveMm3} onChange={(v) => upd((q) => ({ ...q, originalLiveMm3: v }))} tip="7.29 BCM = 7,290 Mm³. Provisional; verify against BBMB." />
            <NumField label="Original dead storage (Mm³)" value={p.originalDeadMm3} onChange={(v) => upd((q) => ({ ...q, originalDeadMm3: v }))} tip="Placeholder. Not verified." />
            <NumField label="Mean annual inflow Q (Mm³/yr)" value={p.annualInflowMm3} onChange={(v) => upd((q) => ({ ...q, annualInflowMm3: v }))} tip="Used only for the capacity-to-inflow ratio C/I." />
            <NumField label="Model start year" value={p.startYear} step="1" onChange={(v) => upd((q) => ({ ...q, startYear: Math.round(v) }))} />
            <NumField label="Forecast starts (year)" value={p.forecastStartYear} step="1" onChange={(v) => upd((q) => ({ ...q, forecastStartYear: Math.round(v) }))} />
            <NumField label="End year" value={p.endYear} step="1" max={2100} onChange={(v) => upd((q) => ({ ...q, endYear: Math.round(v) }))} />
          </fieldset>
          <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Sediment yield S_ref (Mm³/yr)</legend>
            {SCENARIOS.map((s) => <NumField key={s} label={`${s[0].toUpperCase() + s.slice(1)}`} value={p.yields[s]} min={0} onChange={(v) => upd((q) => { q.yields[s] = v; return q })} tip="Gross annual sediment inflow. Illustrative 18–25 Mm³/yr range, pending verification." />)}
            <Select label="Yield method" value={p.yieldMethod} onChange={(v) => upd((q) => ({ ...q, yieldMethod: v }))} options={[
              { value: 'fixed', label: '1 · Fixed annual yield' }, { value: 'rainfall', label: '2 · Rainfall-adjusted (power law)' }, { value: 'regression', label: '3 · Historical regression' }]} />
            {p.yieldMethod !== 'fixed' && <>
              <NumField label="R_ref (mm/yr) — blank = auto mean" value={p.rain.refRainfallMm} onChange={(v) => upd((q) => { q.rain.refRainfallMm = v; return q })} tip={`Auto reference currently ${res.refRainfallMm ? fmt(res.refRainfallMm, 0) + ' mm' : 'unavailable'}`} />
              <button className="btn !py-0.5 text-xs" onClick={() => upd((q) => { q.rain.refRainfallMm = null; return q })}>Use automatic R_ref</button>
              <NumField label="Exponent β" value={p.rain.beta} step="0.1" min={0} onChange={(v) => upd((q) => { q.rain.beta = v; return q })} tip="Calibration parameter; 1.0 means proportional. No default is site-validated." />
              <NumField label="Future rainfall change (%)" value={p.rain.futureChangePct} step="1" onChange={(v) => upd((q) => { q.rain.futureChangePct = v; return q })} tip="Applied to forecast years without an observation." />
            </>}
          </fieldset>
          <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Trap efficiency &amp; compaction</legend>
            <Select label="Brune curve" value={p.trap.curve} onChange={(v) => upd((q) => { q.trap.curve = v; return q })} options={[
              { value: 'median', label: 'Median' }, { value: 'upper', label: 'Upper envelope (coarse)' }, { value: 'lower', label: 'Lower envelope (fine)' }, { value: 'fixed', label: 'Fixed efficiency (manual)' }]} />
            {p.trap.curve === 'fixed' && <NumField label="Fixed η (0–1)" value={p.trap.fixedEta} step="0.01" min={0} max={1} onChange={(v) => upd((q) => { q.trap.fixedEta = Math.min(1, Math.max(0, v)); return q })} />}
            <Select label="Compaction" value={p.compaction.mode} onChange={(v) => upd((q) => { q.compaction.mode = v; return q })} options={[
              { value: 'none', label: 'None (input is deposited volume)' }, { value: 'factor', label: 'Volume factor' }, { value: 'density', label: 'Density ratio' }]} />
            {p.compaction.mode === 'factor' && <NumField label="Volume factor (0–1]" value={p.compaction.factor} step="0.01" min={0.01} max={1} onChange={(v) => upd((q) => { q.compaction.factor = v; return q })} />}
            {p.compaction.mode === 'density' && <>
              <NumField label="Initial bulk density (t/m³)" value={p.compaction.initialDensity} step="0.05" onChange={(v) => upd((q) => { q.compaction.initialDensity = v; return q })} />
              <NumField label="Compacted density (t/m³)" value={p.compaction.compactedDensity} step="0.05" onChange={(v) => upd((q) => { q.compaction.compactedDensity = v; return q })} />
            </>}
            <p className="muted text-xs">Volume multiplier in use: <strong>{res.compactionFactorUsed.toFixed(3)}</strong>. Mass is conserved; only volume changes.</p>
          </fieldset>
          <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Storage allocation (assumed)</legend>
            <NumField label="Dead-storage share" value={p.allocation.dead} step="0.05" min={0} max={1} onChange={(v) => upd((q) => ({ ...q, allocation: { dead: v, live: Math.round((1 - v) * 1000) / 1000 } }))} tip="Demonstration split (70/30). Not a verified Pong Dam characteristic. Live share = 1 − dead." />
            <NumField label="Live-storage share" value={p.allocation.live} step="0.05" min={0} max={1} onChange={(v) => upd((q) => ({ ...q, allocation: { live: v, dead: Math.round((1 - v) * 1000) / 1000 } }))} />
            <div className="mt-3 rounded-md border p-2" style={{ borderColor: 'var(--line)' }}>
              <p className="text-sm font-semibold">Calibration helper</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <NumField label="Target live loss (%)" value={p.calibration.targetLossPct} onChange={(v) => upd((q) => { q.calibration.targetLossPct = v; return q })} />
                <NumField label="Reference year" value={p.calibration.referenceYear} step="1" onChange={(v) => upd((q) => { q.calibration.referenceYear = Math.round(v); return q })} />
              </div>
              <button className="btn mt-2" onClick={calibrate}><Wand2 size={14} aria-hidden /> Fit realistic yield</button>
              {calMsg && <p className="muted mt-1 text-xs">{calMsg}</p>}
            </div>
          </fieldset>
        </div>
        {res.warnings.length > 0 && <div className="mt-3"><Alert>{res.warnings.join(' ')}</Alert></div>}
      </Card>

      <Card title="Benchmark check against a published survey" subtitle="Does the model reproduce the only published Pong capacity-loss result found?">
        {BENCHMARKS.map((b) => {
          const lossOf = (sc: (typeof SCENARIOS)[number]) => { const row = rowAt(all[sc], b.endYear); return row ? p.originalLiveMm3 - row.liveMm3 : null }
          const verdicts = SCENARIOS.map((sc) => { const l = lossOf(sc); const d = l != null ? ((l - b.liveLossMm3) / b.liveLossMm3) * 100 : null; return { sc, l, d, ok: d != null && Math.abs(d) <= 15 } })
          const anyOk = verdicts.some((v) => v.ok)
          return (
            <div key={b.id} className="space-y-2 text-sm">
              <p><strong>{b.label}:</strong> {b.liveLossMm3} Mm³ (≈ {fmt((b.liveLossMm3 / p.originalLiveMm3) * 100, 1)} % of the original live storage entered above). <a className="underline" href={b.url} target="_blank" rel="noreferrer noopener">{b.source}</a></p>
              <div className="overflow-x-auto"><table className="tbl">
                <thead><tr><th>Scenario</th><th>Yield (Mm³/yr)</th><th>Model live loss {p.startYear}–{b.endYear} (Mm³)</th><th>vs published</th><th>Verdict</th></tr></thead>
                <tbody>{verdicts.map((v) => (
                  <tr key={v.sc} className={v.sc === scenario ? 'font-semibold' : ''}><td className="capitalize">{v.sc}</td><td className="tabular-nums">{p.yields[v.sc]}</td><td className="tabular-nums">{v.l != null ? fmt(v.l, 0) : 'n/a'}</td>
                    <td className="tabular-nums">{v.d != null ? `${v.d >= 0 ? '+' : ''}${fmt(v.d, 0)} %` : '—'}</td>
                    <td className={v.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>{v.ok ? 'Consistent (±15 %)' : 'Does not match'}</td></tr>))}</tbody>
              </table></div>
              <p className="muted text-xs">The published 18.08 Mm³/yr is the <em>optimistic</em> yield; the realistic yield is an assumed midpoint, so only that row is a like-for-like test.</p>
              {p.startYear !== b.startYear && <p className="muted text-xs">Model start year ({p.startYear}) differs from the survey’s ({b.startYear}).</p>}
              {!anyOk && p.allocation.live < 1 && <p className="text-xs text-amber-700 dark:text-amber-300">No scenario reproduces the survey: the published rate is a <em>live-storage</em> loss rate, but the model sends only {(p.allocation.live * 100).toFixed(0)} % of sediment to live storage. If the yields are live-storage loss rates, set the live share to 100 %.</p>}
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => upd((q) => ({ ...q, allocation: { dead: 0, live: 1 } }))}>Treat yields as live-storage loss (100 % live)</button>
                <button className="btn" onClick={() => upd((q) => ({ ...q, allocation: { dead: 0.7, live: 0.3 } }))}>Restore 70 / 30 demonstration split</button>
              </div>
            </div>
          )
        })}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Selected trap-efficiency curve" subtitle="Input ratio and result for the query year">
          <p className="text-sm">{p.trap.curve === 'fixed' ? 'Fixed manual efficiency.' : BRUNE_CURVES[p.trap.curve].label}</p>
          <p className="muted text-xs">{p.trap.curve === 'fixed' ? 'No source: user-defined.' : BRUNE_CURVES[p.trap.curve].source}</p>
          {row && <p className="mt-2 text-sm">Year {row.year}: C/I = {(row.capacityInflowRatio).toFixed(3)} → η = <strong>{(row.trapEfficiency * 100).toFixed(1)} %</strong></p>}
          <p className="muted mt-1 text-xs">C = (live + dead) m³ ÷ Q m³/yr, both converted from Mm³ before dividing. No universal curve fits every reservoir.</p>
        </Card>
        <Card title="Threshold years" subtitle={`${scenario} scenario`}>
          <ul className="space-y-0.5 text-sm">
            {res.thresholds.map((t) => <li key={t.pct}>≤ {t.pct}% of original live storage: <strong>{formatThreshold(t.year)}</strong></li>)}
            <li>Dead storage depleted: <strong>{formatThreshold(res.deadDepletionYear)}</strong></li>
            <li>Live storage exhausted: <strong>{formatThreshold(res.liveExhaustedYear)}</strong></li>
          </ul>
        </Card>
      </div>
      <QueryCard />
      <ChartA />
      <ChartB />
      <ChartC />
    </div>
  )
}
