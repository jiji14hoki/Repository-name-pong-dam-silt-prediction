import { rowAt } from '../engine/model'
import { useApp } from '../state'
import { Badge, Card, Tip, fmt } from './ui'

export function YearSelector() {
  const { year, setYear, params } = useApp()
  const lo = 1980, hi = 2070
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Query year ({lo}–{hi})</span>
        <input className="input w-28" type="number" min={lo} max={hi} value={year} onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) setYear(Math.min(hi, Math.max(lo, n))) }} />
      </label>
      <input aria-label="Query year slider" type="range" min={lo} max={hi} value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="w-48 accent-[#1f6fb2]" />
      <Badge kind={year >= params.forecastStartYear ? 'Forecast' : 'Modelled'}>{year >= params.forecastStartYear ? 'Forecast' : 'Modelled historical estimate'}</Badge>
    </div>
  )
}

const TIPS = {
  gross: 'Gross sediment inflow: sediment delivered to the reservoir from the catchment during the year (Mm³/yr), before any is lost downstream.',
  trapped: 'Trapped sediment: the portion of inflow retained in the reservoir = gross inflow × trap efficiency (Brune, via capacity/inflow ratio). The rest passes downstream.',
  compacted: 'Compacted sediment: trapped sediment after volume reduction by consolidation (volume factor ≤ 1, or density ratio). Mass is conserved; volume shrinks. Not applied if the input is already a deposited volume.',
  removed: 'Removed sediment: documented or user-defined dredging/desilting volume subtracted in the year it occurred. Capped at the deposit available.',
  net: 'Net storage loss = compacted sediment − removed sediment. This is what is allocated to dead and live storage. It is not the same as gross inflow.',
}

export function QueryTable() {
  const { all, scenario, year, params } = useApp()
  const res = all[scenario]
  const r = rowAt(res, year)
  if (!r) return <p className="muted text-sm">Model stopped before {year} (live storage exhausted in {res.stoppedYear}).</p>
  const rows: [string, string, string, string?][] = [
    ['Cumulative gross sediment inflow', fmt(r.cumGrossInflowMm3), 'Mm³', TIPS.gross],
    ['Cumulative trapped silt (gross trapped)', fmt(r.cumTrappedMm3), 'Mm³', TIPS.trapped],
    ['Cumulative net storage loss', fmt(r.cumNetLossMm3), 'Mm³', TIPS.net],
    ['Remaining live storage', `${fmt(r.liveMm3)}  (${fmt(r.liveMm3 / 1000, 3)} BCM)`, 'Mm³'],
    ['Remaining dead storage', fmt(r.deadMm3), 'Mm³'],
    ['Original live storage lost', fmt(r.liveLostPct, 2), '%'],
    ['Gross annual sediment inflow', fmt(r.grossInflowMm3, 2), 'Mm³/yr', TIPS.gross],
    ['Annual trapped sediment', fmt(r.trappedMm3, 2), 'Mm³/yr', TIPS.trapped],
    ['Annual compacted addition', fmt(r.compactedMm3, 2), 'Mm³/yr', TIPS.compacted],
    ['Annual dredging / removal', r.removedMm3 > 0 ? fmt(r.removedMm3, 2) : '0.00 (none recorded)', 'Mm³/yr', TIPS.removed],
    ['Net annual storage loss', fmt(r.netMm3, 2), 'Mm³/yr', TIPS.net],
    ['Trap efficiency (C/I = ' + r.capacityInflowRatio.toFixed(3) + ')', fmt(r.trapEfficiency * 100, 1), '%'],
    ['Rainfall for the year', r.rainfallMm == null ? 'No observation' : `${fmt(r.rainfallMm, 0)}  (${r.rainfallSource === 'observed' ? 'as loaded' : 'forecast assumption'})`, r.rainfallMm == null ? '' : 'mm'],
  ]
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <caption className="sr-only">Query results for {year}</caption>
        <thead><tr><th>Quantity</th><th>Value</th><th>Unit</th></tr></thead>
        <tbody>
          {rows.map(([k, v, u, tip]) => (
            <tr key={k}><td>{k} {tip && <Tip text={tip} />}</td><td className="tabular-nums font-medium">{v}</td><td className="muted">{u}</td></tr>
          ))}
        </tbody>
      </table>
      {r.flags.length > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Flags: {r.flags.join('; ')}</p>}
      <p className="muted mt-2 text-xs">Original live storage {fmt(params.originalLiveMm3, 0)} Mm³ is a provisional input. All values are model estimates.</p>
    </div>
  )
}

export function QueryCard() {
  return (
    <Card title="Silt query tool" subtitle="Select any year 1980–2070 — KPIs, charts and tables update immediately">
      <YearSelector />
      <div className="mt-3"><QueryTable /></div>
    </Card>
  )
}
