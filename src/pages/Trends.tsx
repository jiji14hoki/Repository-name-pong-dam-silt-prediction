import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { ChartA, ChartB, ChartC } from '../components/charts'
import { Alert, Badge, Card, Empty, NumField, Select } from '../components/ui'
import type { DataStatus } from '../engine/types'
import { useApp } from '../state'
import { download } from '../utils/csv'
import { capFromCSV, capToCSV, sedFromCSV, sedToCSV } from '../utils/exporters'

const STAT: DataStatus[] = ['Observed', 'Published Estimate', 'Modelled', 'Assumed']

export default function Trends() {
  const { capObs, setCapObs, sedObs, setSedObs } = useApp()
  const [c, setC] = useState({ year: 2000, live: null as number | null, silt: null as number | null, source: '', status: 'Observed' as DataStatus, note: '' })
  const [s, setS] = useState({ year: 2000, v: null as number | null, source: '', status: 'Observed' as DataStatus, note: '' })
  const [msg, setMsg] = useState('')
  const f1 = useRef<HTMLInputElement>(null), f2 = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-4">
      <Alert kind="info">Historical lines here are <strong>modelled estimates</strong> unless survey observations are entered below. No BBMB or survey measurements are bundled; the registers start empty on purpose.</Alert>
      <ChartA /><ChartB /><ChartC />

      <Card title="Survey observations (capacity / cumulative silt)" subtitle="Enter dated, sourced values from hydrographic or bathymetric surveys — they appear as solid points on Charts A and B"
        right={<div className="flex gap-2"><button className="btn" onClick={() => download('pongsilt_survey_observations.csv', capToCSV(capObs))}><Download size={15} aria-hidden /> Export</button>
          <button className="btn" onClick={() => f1.current?.click()}><Upload size={15} aria-hidden /> Import</button>
          <input ref={f1} type="file" accept=".csv" className="hidden" aria-label="Import survey CSV" onChange={async (e) => { const r = capFromCSV(await (e.target.files?.[0]?.text() ?? Promise.resolve(''))); setCapObs([...capObs, ...r]); setMsg(`Imported ${r.length} survey row(s).`); e.target.value = '' }} /></div>}>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault()
          if (!c.source.trim()) return setMsg('Source is required.')
          if (c.live == null && c.silt == null) return setMsg('Enter live storage or cumulative silt.')
          setCapObs([...capObs, { id: `C-${Date.now().toString(36)}`, year: c.year, liveStorageMm3: c.live, cumulativeSiltMm3: c.silt, source: c.source, status: c.status, note: c.note }]); setMsg('Observation added.') }}>
          <NumField label="Survey year" step="1" value={c.year} onChange={(v) => setC({ ...c, year: Math.round(v) })} />
          <NumField label="Live storage (Mm³)" value={c.live} onChange={(v) => setC({ ...c, live: v })} />
          <NumField label="Cumulative silt (Mm³)" value={c.silt} onChange={(v) => setC({ ...c, silt: v })} />
          <Select label="Status" value={c.status} onChange={(v) => setC({ ...c, status: v })} options={STAT.map((x) => ({ value: x, label: x }))} />
          <label className="sm:col-span-2"><span className="label">Source / document *</span><input className="input" value={c.source} onChange={(e) => setC({ ...c, source: e.target.value })} /></label>
          <label><span className="label">Quality note</span><input className="input" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} /></label>
          <div className="flex items-end"><button className="btn btn-primary" type="submit"><Plus size={15} aria-hidden /> Add</button></div>
        </form>
        {capObs.length === 0 ? <div className="mt-3"><Empty title="No survey observations" hint="Add a dated survey result to compare the model against measurements." /></div> : (
          <table className="tbl mt-3"><thead><tr><th>Year</th><th>Live (Mm³)</th><th>Cum. silt (Mm³)</th><th>Status</th><th>Source</th><th /></tr></thead><tbody>
            {capObs.map((o) => <tr key={o.id}><td>{o.year}</td><td>{o.liveStorageMm3 ?? '—'}</td><td>{o.cumulativeSiltMm3 ?? '—'}</td><td><Badge kind={o.status}>{o.status}</Badge></td><td className="text-xs">{o.source}</td>
              <td><button className="btn btn-danger !py-0.5" aria-label={`Delete survey ${o.year}`} onClick={() => setCapObs(capObs.filter((x) => x.id !== o.id))}><Trash2 size={13} aria-hidden /></button></td></tr>)}
          </tbody></table>)}
      </Card>

      <Card title="Annual sediment-inflow observations" subtitle="Needed for the regression yield method and observed rainfall–sediment scatter"
        right={<div className="flex gap-2"><button className="btn" onClick={() => download('pongsilt_sediment_observations.csv', sedToCSV(sedObs))}><Download size={15} aria-hidden /> Export</button>
          <button className="btn" onClick={() => f2.current?.click()}><Upload size={15} aria-hidden /> Import</button>
          <input ref={f2} type="file" accept=".csv" className="hidden" aria-label="Import sediment CSV" onChange={async (e) => { const r = sedFromCSV(await (e.target.files?.[0]?.text() ?? Promise.resolve(''))); setSedObs([...sedObs, ...r]); setMsg(`Imported ${r.length} sediment row(s).`); e.target.value = '' }} /></div>}>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault()
          if (!s.source.trim() || s.v == null || s.v <= 0) return setMsg('A positive value and a source are required.')
          setSedObs([...sedObs, { id: `SO-${Date.now().toString(36)}`, year: s.year, annualSedimentInflowMm3: s.v, source: s.source, status: s.status, note: s.note }]); setMsg('Observation added.') }}>
          <NumField label="Year" step="1" value={s.year} onChange={(v) => setS({ ...s, year: Math.round(v) })} />
          <NumField label="Sediment inflow (Mm³/yr)" min={0} value={s.v} onChange={(v) => setS({ ...s, v })} />
          <Select label="Status" value={s.status} onChange={(v) => setS({ ...s, status: v })} options={STAT.map((x) => ({ value: x, label: x }))} />
          <label><span className="label">Source *</span><input className="input" value={s.source} onChange={(e) => setS({ ...s, source: e.target.value })} /></label>
          <div className="flex items-end"><button className="btn btn-primary" type="submit"><Plus size={15} aria-hidden /> Add</button></div>
        </form>
        {sedObs.length > 0 && <table className="tbl mt-3"><thead><tr><th>Year</th><th>Mm³/yr</th><th>Status</th><th>Source</th><th /></tr></thead><tbody>
          {sedObs.map((o) => <tr key={o.id}><td>{o.year}</td><td>{o.annualSedimentInflowMm3}</td><td><Badge kind={o.status}>{o.status}</Badge></td><td className="text-xs">{o.source}</td>
            <td><button className="btn btn-danger !py-0.5" aria-label={`Delete sediment ${o.year}`} onClick={() => setSedObs(sedObs.filter((x) => x.id !== o.id))}><Trash2 size={13} aria-hidden /></button></td></tr>)}
        </tbody></table>}
        {msg && <p role="status" className="muted mt-2 text-xs">{msg}</p>}
      </Card>
    </div>
  )
}
