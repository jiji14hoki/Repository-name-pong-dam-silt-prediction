import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { ChartB } from '../components/charts'
import { Alert, Badge, Card, Empty, NumField, Select } from '../components/ui'
import type { DesiltingEvent, EventMethod, EventVerification } from '../engine/types'
import { useApp } from '../state'
import { download } from '../utils/csv'
import { eventsFromCSV, eventsToCSV } from '../utils/exporters'

const METHODS: EventMethod[] = ['Dredging', 'Desilting', 'Hydraulic flushing', 'Other']
const VERS: EventVerification[] = ['Verified', 'Unverified', 'Sample', 'Hypothetical']
const blank = (): DesiltingEvent => ({ id: '', startYear: 2035, startMonth: 6, endYear: null, endMonth: null, operationDate: '', volumeMm3: null, rate: '', method: 'Desilting', source: '', verification: 'Hypothetical', notes: '', includeInModel: false })

export default function Desilting() {
  const { events, setEvents, params } = useApp()
  const [d, setD] = useState<DesiltingEvent>(blank())
  const [editId, setEditId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const save = () => {
    if (!d.source.trim()) return setMsg('Source / reference is required (write "hypothetical" for what-if tests).')
    if (d.startMonth < 1 || d.startMonth > 12) return setMsg('Start month must be 1–12.')
    if (d.volumeMm3 != null && d.volumeMm3 < 0) return setMsg('Volume cannot be negative.')
    if (d.endYear != null && d.endYear * 12 + (d.endMonth ?? 12) < d.startYear * 12 + d.startMonth) return setMsg('End date is before start date.')
    const rec: DesiltingEvent = { ...d, includeInModel: d.includeInModel && d.volumeMm3 != null, operationDate: d.operationDate || `${d.startYear}-${String(d.startMonth).padStart(2, '0')}` }
    if (editId) setEvents(events.map((e) => (e.id === editId ? { ...rec, id: editId } : e)))
    else setEvents([...events, { ...rec, id: rec.id.trim() || `EV-${Date.now().toString(36)}` }])
    setMsg(editId ? 'Event updated.' : 'Event added.'); setEditId(null); setD(blank())
  }
  const onImport = async (f?: File) => {
    if (!f) return
    const { events: ev, errors } = eventsFromCSV(await f.text())
    if (ev.length) setEvents([...events, ...ev])
    setMsg(`Imported ${ev.length} event(s).${errors.length ? ' Skipped: ' + errors.slice(0, 3).join('; ') : ''}`)
    if (file.current) file.current.value = ''
  }
  const sorted = [...events].sort((a, b) => a.startYear * 12 + a.startMonth - (b.startYear * 12 + b.startMonth))
  const yrs = [params.startYear, params.endYear]

  return (
    <div className="space-y-4">
      <Alert><strong>No dredging or desilting is assumed to have occurred at Pong Dam.</strong> The bundled entry is a SAMPLE and is not applied. An event with no measured volume is recorded by date only and removes nothing. <em>Dredging</em> = removal with dredging equipment; <em>Desilting</em> = any documented removal method.</Alert>

      <Card title="Event timeline" subtitle="Red = applied in model; grey = recorded only">
        {sorted.length === 0 ? <Empty title="No events recorded" hint="Add an event below or import a CSV." /> : (
          <div className="relative h-20 overflow-hidden" role="img" aria-label="Timeline of desilting events">
            <div className="absolute left-0 right-0 top-10 h-0.5 bg-slate-400" />
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f} className="muted absolute top-12 text-[10px]" style={{ left: `${f * 96}%` }}>{Math.round(yrs[0] + f * (yrs[1] - yrs[0]))}</span>)}
            {sorted.map((e) => { const left = Math.min(96, Math.max(0, ((e.startYear + (e.startMonth - 1) / 12 - yrs[0]) / (yrs[1] - yrs[0])) * 96)); return (
              <button key={e.id} title={`${e.id}: ${e.operationDate}`} className="absolute top-6 h-8 w-3 rounded-sm focus-visible:ring-2 ring-reservoir-400 outline-none" style={{ left: `${left}%`, background: e.includeInModel ? '#b4493f' : '#9aa7b5' }}
                onClick={() => document.getElementById(`ev-${e.id}`)?.scrollIntoView({ block: 'center' })} aria-label={`${e.id} ${e.operationDate}`} />) })}
          </div>
        )}
      </Card>

      <Card title="Desilting & dredging register" subtitle={`${events.length} event(s)`} right={<div className="flex gap-2">
        <button className="btn" onClick={() => download('pongsilt_desilting_events.csv', eventsToCSV(events))}><Download size={15} aria-hidden /> Export CSV</button>
        <button className="btn" onClick={() => file.current?.click()}><Upload size={15} aria-hidden /> Import CSV</button>
        <input ref={file} type="file" accept=".csv,text/csv" className="hidden" aria-label="Import events CSV" onChange={(e) => onImport(e.target.files?.[0])} /></div>}>
        <form className="mb-3 grid gap-2 rounded-md border p-3 sm:grid-cols-4" style={{ borderColor: 'var(--line)' }} onSubmit={(e) => { e.preventDefault(); save() }}>
          <NumField label="Start year" step="1" value={d.startYear} onChange={(v) => setD({ ...d, startYear: Math.round(v) })} />
          <NumField label="Start month (1–12)" step="1" min={1} max={12} value={d.startMonth} onChange={(v) => setD({ ...d, startMonth: Math.round(v) })} />
          <NumField label="End year (optional)" step="1" value={d.endYear} onChange={(v) => setD({ ...d, endYear: Math.round(v) })} />
          <NumField label="End month (optional)" step="1" min={1} max={12} value={d.endMonth} onChange={(v) => setD({ ...d, endMonth: Math.round(v) })} />
          <NumField label="Volume removed (Mm³) — blank if unknown" min={0} value={d.volumeMm3} onChange={(v) => setD({ ...d, volumeMm3: v })} tip="Measured volume only. Leave blank rather than estimating a historical value." />
          <label><span className="label">Rate / duration</span><input className="input" value={d.rate} onChange={(e) => setD({ ...d, rate: e.target.value })} /></label>
          <Select label="Method" value={d.method} onChange={(v) => setD({ ...d, method: v })} options={METHODS.map((m) => ({ value: m, label: m }))} />
          <Select label="Verification" value={d.verification} onChange={(v) => setD({ ...d, verification: v })} options={VERS.map((m) => ({ value: m, label: m }))} />
          <label className="sm:col-span-2"><span className="label">Source / reference *</span><input className="input" value={d.source} onChange={(e) => setD({ ...d, source: e.target.value })} /></label>
          <label className="sm:col-span-2"><span className="label">Notes</span><input className="input" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={d.includeInModel} disabled={d.volumeMm3 == null} onChange={(e) => setD({ ...d, includeInModel: e.target.checked })} /> Apply in model {d.volumeMm3 == null && <span className="muted text-xs">(needs a volume)</span>}</label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <button type="submit" className="btn btn-primary"><Plus size={15} aria-hidden /> {editId ? 'Save changes' : 'Add event'}</button>
            {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setD(blank()) }}>Cancel edit</button>}
          </div>
          {msg && <p role="status" className="muted text-xs sm:col-span-4">{msg}</p>}
        </form>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Start</th><th>End</th><th>Volume (Mm³)</th><th>Method</th><th>Verification</th><th>Applied</th><th>Source</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id} id={`ev-${e.id}`}>
                  <td>{e.id}</td><td>{e.startYear}-{String(e.startMonth).padStart(2, '0')}</td><td>{e.endYear ? `${e.endYear}-${String(e.endMonth ?? 12).padStart(2, '0')}` : '—'}</td>
                  <td className="tabular-nums">{e.volumeMm3 ?? 'not recorded'}</td><td>{e.method}</td><td><Badge kind={e.verification === 'Verified' ? 'Verified' : 'Assumed'}>{e.verification}</Badge></td>
                  <td>{e.includeInModel ? 'Yes' : 'No'}</td><td className="max-w-[16rem] text-xs">{e.source}{e.notes && <span className="muted"> · {e.notes}</span>}</td>
                  <td className="whitespace-nowrap">
                    <button className="btn !py-0.5 text-xs" onClick={() => { setD(e); setEditId(e.id) }}>Edit</button>{' '}
                    <button className="btn btn-danger !py-0.5" aria-label={`Delete event ${e.id}`} onClick={() => { if (window.confirm(`Delete event ${e.id}?`)) setEvents(events.filter((x) => x.id !== e.id)) }}><Trash2 size={13} aria-hidden /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-2 text-xs">Volumes over multi-month operations are spread evenly by month and applied in the calendar year they fall in. Removal is capped at the sediment deposited so far.</p>
      </Card>
      <ChartB defaultFrom={Math.max(params.startYear, 2000)} defaultTo={params.endYear} />
    </div>
  )
}
