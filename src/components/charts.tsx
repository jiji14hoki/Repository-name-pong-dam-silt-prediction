import { useMemo, useState } from 'react'
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine,
} from 'recharts'
import { SCENARIOS } from '../engine/model'
import { THRESHOLDS_PCT } from '../engine/model'
import type { DesiltingEvent, ScenarioKey } from '../engine/types'
import { useApp } from '../state'
import { Card, NumField, fmt } from './ui'

export const SCEN_COLOR: Record<ScenarioKey, string> = { optimistic: '#2b8a8a', realistic: '#1f6fb2', pessimistic: '#c27a14' }
const AXIS = '#7d8da0'
const FC_DASH = '7 4' // forecast: dashed
const HIST_DASH = '2 3' // modelled historical: dotted (visually distinct from solid observations)

function useHidden() {
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const toggle = (e: { dataKey?: unknown }) => {
    const k = String(e.dataKey ?? '')
    const base = k.replace(/_(hist|fc)$/, '')
    setHidden((h) => ({ ...h, [base]: !h[base] }))
  }
  return { hidden, toggle, isHidden: (k: string) => !!hidden[k.replace(/_(hist|fc)$/, '')] }
}

function RangeControls({ from, to, setFrom, setTo, min, max }: { from: number; to: number; setFrom: (n: number) => void; setTo: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-24"><NumField label="From year" value={from} min={min} max={to} step="1" onChange={(v) => setFrom(Math.max(min, Math.min(v, to - 1)))} /></div>
      <div className="w-24"><NumField label="To year" value={to} min={from} max={max} step="1" onChange={(v) => setTo(Math.min(max, Math.max(v, from + 1)))} /></div>
    </div>
  )
}

function EventDetail({ ev, onClose }: { ev: DesiltingEvent | null; onClose: () => void }) {
  if (!ev) return null
  return (
    <div className="mt-2 rounded-md border p-3 text-sm" style={{ borderColor: 'var(--line)' }} role="status">
      <div className="flex justify-between gap-2">
        <strong>{ev.id} — {ev.method}</strong>
        <button className="btn !py-0.5" onClick={onClose}>Close</button>
      </div>
      <p className="mt-1">Operation date: {ev.operationDate || `${ev.startYear}-${String(ev.startMonth).padStart(2, '0')}`}</p>
      <p>Volume removed: {ev.volumeMm3 == null ? 'not recorded (no volume applied)' : `${fmt(ev.volumeMm3, 2)} Mm³`} · {ev.verification} · {ev.includeInModel ? 'applied in model' : 'not applied in model'}</p>
      <p className="muted text-xs">Source: {ev.source}</p>
    </div>
  )
}

/** Must be CALLED (not rendered as a component): Recharts only picks up ReferenceLine as a direct child of the chart. */
function eventMarkers(events: DesiltingEvent[], onPick: (e: DesiltingEvent) => void) {
  return events.map((e) => (
        <ReferenceLine key={e.id} x={e.startYear} stroke={e.includeInModel ? '#b4493f' : '#9aa7b5'} strokeDasharray="3 3" strokeWidth={1.5}
          label={{ value: '▼', position: 'top', fill: e.includeInModel ? '#b4493f' : '#7d8da0', fontSize: 11, cursor: 'pointer', onClick: () => onPick(e) }}
          style={{ cursor: 'pointer' }} onClick={() => onPick(e)} />
  ))
}

function EventChips({ events, onPick }: { events: DesiltingEvent[]; onPick: (e: DesiltingEvent) => void }) {
  if (!events.length) return <p className="muted mt-2 text-xs">No desilting events recorded — no markers to show.</p>
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="muted">Desilting markers (click for details):</span>
      {events.map((e) => <button key={e.id} className="chip hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onPick(e)}>{e.id} · {e.startYear}</button>)}
    </div>
  )
}

function useSeries(metric: 'cumTrappedMm3' | 'cumNetLossMm3' | 'liveMm3' | 'liveLostPct' | 'cumGrossInflowMm3', from: number, to: number) {
  const { all, params } = useApp()
  return useMemo(() => {
    const years = all.realistic.rows.map((r) => r.year).filter((y) => y >= from && y <= to)
    return years.map((y) => {
      const d: Record<string, number | null> = { year: y }
      for (const s of SCENARIOS) {
        const row = all[s].rows.find((r) => r.year === y)
        const v = row ? (row[metric] as number) : null
        d[`${s}_hist`] = row && y <= params.forecastStartYear - 1 ? v : null
        // connect forecast line to last historical point
        d[`${s}_fc`] = row && y >= params.forecastStartYear - 1 ? v : null
      }
      return d
    })
  }, [all, params.forecastStartYear, metric, from, to])
}

function scenarioLines(sel: ScenarioKey, isHidden: (k: string) => boolean) {
  const out: JSX.Element[] = []
  for (const s of SCENARIOS) {
    const emph = s === sel
    out.push(<Line key={`${s}_hist`} type="monotone" dataKey={`${s}_hist`} name={`${s} (modelled historical)`} stroke={SCEN_COLOR[s]} strokeWidth={emph ? 2.5 : 1.3} strokeDasharray={HIST_DASH} dot={false} hide={isHidden(s)} connectNulls={false} isAnimationActive={false} />)
    out.push(<Line key={`${s}_fc`} type="monotone" dataKey={`${s}_fc`} name={`${s} (forecast)`} stroke={SCEN_COLOR[s]} strokeWidth={emph ? 2.5 : 1.3} strokeDasharray={FC_DASH} dot={false} hide={isHidden(s)} connectNulls={false} isAnimationActive={false} />)
  }
  return out
}

const Foot = ({ children }: { children: string }) => <p className="muted mt-2 text-[11px]">{children}</p>

export function ChartA({ defaultFrom, defaultTo }: { defaultFrom?: number; defaultTo?: number }) {
  const { params, events, capObs, scenario } = useApp()
  const [from, setFrom] = useState(defaultFrom ?? params.startYear)
  const [to, setTo] = useState(defaultTo ?? params.endYear)
  const [pick, setPick] = useState<DesiltingEvent | null>(null)
  const { toggle, isHidden } = useHidden()
  const data = useSeries('cumTrappedMm3', from, to)
  const obs = capObs.filter((c) => c.cumulativeSiltMm3 != null && c.year >= from && c.year <= to).map((c) => ({ year: c.year, obs: c.cumulativeSiltMm3 }))
  const evs = events.filter((e) => e.startYear >= from && e.startYear <= to)
  return (
    <Card title="A · Cumulative sediment accumulation" subtitle="Cumulative trapped sediment (before removal), by scenario" right={<RangeControls from={from} to={to} setFrom={setFrom} setTo={setTo} min={params.startYear} max={params.endYear} />}>
      <div className="h-80" role="img" aria-label="Line chart of cumulative sediment accumulation by scenario">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#8a9bb033" />
            <XAxis dataKey="year" type="number" domain={[from, to]} stroke={AXIS} tick={{ fontSize: 11 }} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'Mm³', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${fmt(v, 1)} Mm³`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} />
            <Legend onClick={toggle} wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} />
            {scenarioLines(scenario, isHidden)}
            <Line data={obs} dataKey="obs" name="Survey observation (solid)" stroke="#0f1f33" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
            <ReferenceLine x={params.forecastStartYear} stroke="#7d8da0" strokeDasharray="2 2" label={{ value: 'forecast →', fill: AXIS, fontSize: 10, position: 'insideTopRight' }} />
            {eventMarkers(evs, setPick)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <EventChips events={evs} onPick={setPick} />
      <EventDetail ev={pick} onClose={() => setPick(null)} />
      <Foot>Solid dark = surveyed observations (only if entered; none are bundled). Dotted = modelled historical estimate. Dashed = forecast. Source: PongSilt model, demonstration assumptions.</Foot>
    </Card>
  )
}

export function ChartB({ defaultFrom, defaultTo }: { defaultFrom?: number; defaultTo?: number }) {
  const { params, events, capObs, scenario } = useApp()
  const [from, setFrom] = useState(defaultFrom ?? params.startYear)
  const [to, setTo] = useState(defaultTo ?? params.endYear)
  const [pick, setPick] = useState<DesiltingEvent | null>(null)
  const { toggle, isHidden } = useHidden()
  const data = useSeries('liveMm3', from, to)
  const obs = capObs.filter((c) => c.liveStorageMm3 != null && c.year >= from && c.year <= to).map((c) => ({ year: c.year, obs: c.liveStorageMm3 }))
  const evs = events.filter((e) => e.startYear >= from && e.startYear <= to)
  const O = params.originalLiveMm3
  return (
    <Card title="B · Remaining live storage" subtitle="Live storage (Mm³) against original-capacity baseline and 80/70/60 % thresholds" right={<RangeControls from={from} to={to} setFrom={setFrom} setTo={setTo} min={params.startYear} max={params.endYear} />}>
      <div className="h-80" role="img" aria-label="Line chart of remaining live storage by scenario with threshold lines">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 56, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#8a9bb033" />
            <XAxis dataKey="year" type="number" domain={[from, to]} stroke={AXIS} tick={{ fontSize: 11 }} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11 }} domain={[(min: number) => Math.floor(Math.min(min, O * 0.58) / 100) * 100, Math.ceil((O * 1.02) / 100) * 100]} label={{ value: 'Mm³', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${fmt(v, 1)} Mm³`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} />
            <Legend onClick={toggle} wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} />
            <ReferenceLine y={O} stroke="#16417a" strokeWidth={1.5} label={{ value: 'Original live (assumed)', fill: AXIS, fontSize: 10, position: 'insideBottomLeft' }} />
            {THRESHOLDS_PCT.map((t) => <ReferenceLine key={t} y={(O * t) / 100} stroke="#c27a14" strokeDasharray="4 4" label={{ value: `${t}%`, fill: '#c27a14', fontSize: 10, position: 'right' }} />)}
            {scenarioLines(scenario, isHidden)}
            <Line data={obs} dataKey="obs" name="Survey observation (solid)" stroke="#0f1f33" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
            <ReferenceLine x={params.forecastStartYear} stroke="#7d8da0" strokeDasharray="2 2" />
            {eventMarkers(evs, setPick)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <EventChips events={evs} onPick={setPick} />
      <EventDetail ev={pick} onClose={() => setPick(null)} />
      <Foot>Thresholds are percentages of ORIGINAL live storage. Red markers = desilting applied in model; grey = recorded but not applied. Source: PongSilt model.</Foot>
    </Card>
  )
}

export function ChartC() {
  const { all, scenario, params, events } = useApp()
  const [from, setFrom] = useState(params.startYear)
  const [to, setTo] = useState(params.endYear)
  const [pick, setPick] = useState<DesiltingEvent | null>(null)
  const { toggle, isHidden } = useHidden()
  const data = all[scenario].rows.filter((r) => r.year >= from && r.year <= to)
  const evs = events.filter((e) => e.startYear >= from && e.startYear <= to)
  return (
    <Card title={`C · Annual sedimentation (${scenario})`} subtitle="Gross inflow, trapped, compacted, removed and net storage loss per year" right={<RangeControls from={from} to={to} setFrom={setFrom} setTo={setTo} min={params.startYear} max={params.endYear} />}>
      <div className="h-80" role="img" aria-label="Chart of annual sediment quantities">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#8a9bb033" />
            <XAxis dataKey="year" stroke={AXIS} tick={{ fontSize: 11 }} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'Mm³ / year', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${fmt(v, 2)} Mm³/yr`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} />
            <Legend onClick={(e) => toggle({ dataKey: e.dataKey })} wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} />
            <Bar dataKey="removedMm3" name="Sediment removed" fill="#b4493f" hide={isHidden('removedMm3')} />
            <Line type="monotone" dataKey="grossInflowMm3" name="Gross inflow" stroke="#7d8da0" dot={false} strokeWidth={1.8} hide={isHidden('grossInflowMm3')} />
            <Line type="monotone" dataKey="trappedMm3" name="Trapped" stroke="#1f6fb2" dot={false} strokeWidth={1.8} hide={isHidden('trappedMm3')} />
            <Line type="monotone" dataKey="compactedMm3" name="Compacted addition" stroke="#2b8a8a" dot={false} strokeWidth={1.8} strokeDasharray="5 3" hide={isHidden('compactedMm3')} />
            <Line type="monotone" dataKey="netMm3" name="Net storage loss" stroke="#0f2d56" dot={false} strokeWidth={2.6} hide={isHidden('netMm3')} />
            {eventMarkers(evs, setPick)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <EventChips events={evs} onPick={setPick} />
      <EventDetail ev={pick} onClose={() => setPick(null)} />
      <Foot>All values are model outputs (not observations). Gross inflow ≠ trapped ≠ compacted ≠ net loss — see Methodology.</Foot>
    </Card>
  )
}

export function ChartD() {
  const { all, scenario, params, rainSummary, sedObs } = useApp()
  const [from, setFrom] = useState(Math.max(params.startYear, rainSummary.firstYear ?? params.startYear))
  const [to, setTo] = useState(params.endYear)
  const { toggle, isHidden } = useHidden()
  const rows = all[scenario].rows.filter((r) => r.year >= from && r.year <= to)
  const data = rows.map((r) => ({ year: r.year, rain: r.rainfallSource === 'observed' ? r.rainfallMm : null, rainFc: r.rainfallSource === 'forecast-assumption' ? r.rainfallMm : null, gross: r.grossInflowMm3, net: r.netMm3 }))
  const hasRain = data.some((d) => d.rain != null)
  const obsScatter = sedObs.filter((o) => o.annualSedimentInflowMm3 != null && rainSummary.values[o.year] != null).map((o) => ({ rain: rainSummary.values[o.year], sed: o.annualSedimentInflowMm3 as number, year: o.year }))
  const modelScatter = rows.filter((r) => r.rainfallSource === 'observed' && r.rainfallMm != null).map((r) => ({ rain: r.rainfallMm as number, sed: r.grossInflowMm3, year: r.year }))
  const useObs = obsScatter.length >= 3
  const scatter = useObs ? obsScatter : modelScatter
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="D · Rainfall and siltation" subtitle="Dual axes: rainfall (mm/yr, left) and modelled sediment (Mm³/yr, right)" right={<RangeControls from={from} to={to} setFrom={setFrom} setTo={setTo} min={params.startYear} max={params.endYear} />}>
        <div className="h-72" role="img" aria-label="Dual-axis chart of annual rainfall and sedimentation">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#8a9bb033" />
              <XAxis dataKey="year" stroke={AXIS} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'mm/yr', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'Mm³/yr', angle: 90, position: 'insideRight', fill: AXIS, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} />
              <Legend onClick={toggle} wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} />
              <Area yAxisId="l" dataKey="rain" name="Annual rainfall (as loaded)" fill="#7fb4de55" stroke="#3b8ccb" hide={isHidden('rain')} connectNulls={false} />
              <Line yAxisId="l" dataKey="rainFc" name="Rainfall (forecast assumption)" stroke="#3b8ccb" strokeDasharray={FC_DASH} dot={false} hide={isHidden('rainFc')} />
              <Line yAxisId="r" dataKey="gross" name="Gross sediment inflow" stroke="#c27a14" dot={false} strokeWidth={2} hide={isHidden('gross')} />
              <Line yAxisId="r" dataKey="net" name="Net storage loss" stroke="#0f2d56" dot={false} strokeWidth={2} hide={isHidden('net')} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {!hasRain && <p className="muted mt-2 text-xs">No annual rainfall is available in this range — add or import rainfall data.</p>}
        <Foot>Rainfall shown is what is loaded (default: SIMULATED demo data). Sediment is a model output driven by the selected yield method.</Foot>
      </Card>
      <Card title="Rainfall vs sediment scatter" subtitle={useObs ? 'Paired observations (user-entered)' : 'Model output vs rainfall — NOT an independent observation'}>
        <div className="h-72" role="img" aria-label="Scatter plot of annual rainfall versus sediment">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 12, right: 16, left: 4, bottom: 16 }}>
              <CartesianGrid stroke="#8a9bb033" />
              <XAxis type="number" dataKey="rain" name="Rainfall" unit=" mm" stroke={AXIS} tick={{ fontSize: 11 }} domain={['auto', 'auto']} label={{ value: 'Annual rainfall (mm)', position: 'insideBottom', offset: -8, fill: AXIS, fontSize: 11 }} />
              <YAxis type="number" dataKey="sed" name="Sediment" unit=" Mm³" stroke={AXIS} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <ZAxis range={[50, 50]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', fontSize: 12 }} />
              <Scatter data={scatter} fill={useObs ? '#0f2d56' : '#c27a14'} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {scatter.length < 3 && <p className="muted mt-2 text-xs">Fewer than 3 paired points — not enough data for a meaningful scatter.</p>}
        {!useObs && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Enter at least 3 annual sediment-inflow observations (Historical Trends) to plot observed pairs. Until then this plot only reflects the model's own assumption.</p>}
      </Card>
    </div>
  )
}
