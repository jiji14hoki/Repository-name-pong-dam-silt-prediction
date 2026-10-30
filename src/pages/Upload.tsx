import { CheckCircle2, Download, FileUp, Undo2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert, Badge, Card, Empty } from '../components/ui'
import { useApp } from '../state'
import { download } from '../utils/csv'
import { KIND_LABEL, PARAM_NAMES, parseCsvText, parseUpload, type Kind, type Parsed } from '../utils/ingest'

interface Item { name: string; text: string; parsed: Parsed[]; applied: boolean }

const TEMPLATES: Record<string, string> = {
  'rainfall_TEMPLATE.csv': 'year,month,rainfall_mm,station_name,latitude,longitude,source,data_status\n',
  'events_TEMPLATE.csv': 'id,startYear,startMonth,endYear,endMonth,operationDate,volumeMm3,rate,method,source,verification,notes,includeInModel\n',
  'survey_TEMPLATE.csv': 'id,year,liveStorageMm3,cumulativeSiltMm3,source,status,note\n',
  'sediment_TEMPLATE.csv': 'id,year,annualSedimentInflowMm3,source,status,note\n',
  'references_TEMPLATE.csv': 'title,url,type,publisher,year,note\n',
  'parameters_TEMPLATE.csv': 'parameter,value,unit,source,source_url,status,evidence,note\noriginal_live_mm3,,Mm3,,,Published Estimate,primary,\n',
}
const EXAMPLE_PARAMS = `parameter,value,unit,source,source_url,status,evidence,note
original_live_bcm,7.29,BCM,"Example only - replace with the BBMB document you hold",,Published Estimate,secondary,"Delete this row if you cannot cite a document"
`

export default function Upload() {
  const { applyUpload, undoLastUpload, uploads } = useApp()
  const [items, setItems] = useState<Item[]>([])
  const [auto, setAuto] = useState(true)
  const [msg, setMsg] = useState('')
  const [over, setOver] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  const ingest = async (files: FileList | File[]) => {
    const fresh: Item[] = []
    for (const f of Array.from(files)) {
      if (!/\.(csv|json)$/i.test(f.name)) { fresh.push({ name: f.name, text: '', applied: false, parsed: [{ kind: null, fileName: f.name, rainfall: [], events: [], capObs: [], sedObs: [], params: [], refs: [], rows: 0, warnings: [], errors: ['Only .csv and .json files are supported. In Excel use File → Save As → CSV.'] }] }); continue }
      const text = await f.text()
      fresh.push({ name: f.name, text, parsed: parseUpload(f.name, text), applied: false })
    }
    if (auto) {
      const all = fresh.flatMap((x) => x.parsed)
      if (all.some((x) => x.kind && x.rows > 0)) {
        setMsg(applyUpload(all))
        fresh.forEach((x) => { x.applied = x.parsed.some((p) => p.kind && p.rows > 0) })
      } else setMsg('Nothing was applied — see the problems listed below.')
    } else setMsg('Files checked. Review them, then click “Apply”.')
    setItems((prev) => [...fresh, ...prev].slice(0, 12))
  }
  const retype = (idx: number, kind: Kind) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, parsed: [parseCsvText(it.name, it.text, kind)], applied: false } : it)))
  const applyOne = (idx: number) => { setMsg(applyUpload(items[idx].parsed)); setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, applied: true } : it))) }

  return (
    <div className="space-y-4">
      <Alert kind="info"><strong>Upload automation.</strong> Drop CSV or JSON files here. The type is detected from the column names, each row is validated, and the data is merged into the site immediately — charts, KPIs, forecasts and the PDF all recalculate. Files that include a <em>source</em> upgrade the status of the values they set; files without one stay “Assumed”. The last upload can be undone.</Alert>

      <Card title="Upload data" subtitle="Rainfall · desilting events · survey results · sediment inflow · model parameters · reference links"
        right={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Apply automatically</label>}>
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void ingest(e.dataTransfer.files) }}
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center ${over ? 'bg-sky-50 dark:bg-sky-950' : ''}`} style={{ borderColor: 'var(--line)' }}>
          <UploadCloud size={32} className="muted" aria-hidden />
          <p className="text-sm font-medium">Drag files here</p>
          <button className="btn btn-primary" onClick={() => pick.current?.click()}><FileUp size={15} aria-hidden /> Choose files</button>
          <input ref={pick} type="file" multiple accept=".csv,.json,text/csv,application/json" className="hidden" aria-label="Choose data files" onChange={(e) => { if (e.target.files) void ingest(e.target.files); e.target.value = '' }} />
        </div>
        {msg && <p role="status" className="mt-3 flex items-center gap-1.5 text-sm"><CheckCircle2 size={15} aria-hidden /> {msg}</p>}
      </Card>

      {items.length > 0 && (
        <Card title="Files checked" subtitle="Detected type, rows accepted, and any problems">
          <ul className="space-y-3">
            {items.map((it, idx) => it.parsed.map((p, j) => (
              <li key={`${idx}-${j}`} className="rounded-md border p-3 text-sm" style={{ borderColor: 'var(--line)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{p.fileName}</strong>
                  <div className="flex flex-wrap items-center gap-2">
                    {it.applied ? <Badge kind="Verified">Applied</Badge> : p.rows > 0 ? <Badge kind="Assumed">Not applied</Badge> : <Badge kind="Missing">Nothing to apply</Badge>}
                    <label className="flex items-center gap-1 text-xs"><span className="muted">Type</span>
                      <select className="input !w-auto !py-0.5" value={p.kind ?? ''} onChange={(e) => e.target.value && retype(idx, e.target.value as Kind)} disabled={!it.text}>
                        {p.kind == null && <option value="">Unrecognised</option>}
                        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </select></label>
                    {!it.applied && p.rows > 0 && <button className="btn btn-primary !py-0.5" onClick={() => applyOne(idx)}>Apply</button>}
                  </div>
                </div>
                <p className="muted mt-1 text-xs">{p.rows} valid row(s){p.kind === 'parameters' && p.params.length ? ': ' + p.params.map((u) => `${u.key} = ${u.value} (${u.status})`).join('; ') : ''}</p>
                {p.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-red-700 dark:text-red-300">{p.errors.slice(0, 6).map((e, k) => <li key={k}>{e}</li>)}{p.errors.length > 6 && <li>…and {p.errors.length - 6} more</li>}</ul>}
                {p.warnings.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{p.warnings.slice(0, 6).map((e, k) => <li key={k}>{e}</li>)}</ul>}
              </li>
            )))}
          </ul>
        </Card>
      )}

      <Card title="Upload history" right={<button className="btn" disabled={!uploads[0]?.snapshot} onClick={() => { undoLastUpload(); setMsg('Last upload undone.') }}><Undo2 size={15} aria-hidden /> Undo last upload</button>}>
        {uploads.length === 0 ? <Empty title="No uploads yet" hint="Applied uploads are listed here." /> : (
          <ul className="space-y-1.5 text-sm">{uploads.map((u) => <li key={u.id}><span className="muted text-xs">{new Date(u.at).toLocaleString()}</span> — {u.files.map((f) => f.name).join(', ')}: {u.summary}</li>)}</ul>
        )}
      </Card>

      <Card title="File formats and templates" subtitle="Detection is by column names; the first row must be a header">
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>File type</th><th>Required columns</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Rainfall</td><td className="text-xs">year, month, rainfall_mm, station_name, source, data_status</td><td className="text-xs">month 1–12 (0 = annual). Replaces rows with the same station/year/month. Real rainfall removes the simulated demo rainfall.</td></tr>
            <tr><td>Desilting events</td><td className="text-xs">startYear, startMonth, volumeMm3, method, source, verification</td><td className="text-xs">Leave volume blank if unknown. includeInModel=true only with a volume.</td></tr>
            <tr><td>Survey results</td><td className="text-xs">year, liveStorageMm3 and/or cumulativeSiltMm3, source</td><td className="text-xs">Shown as solid points on the charts.</td></tr>
            <tr><td>Sediment inflow</td><td className="text-xs">year, annualSedimentInflowMm3, source</td><td className="text-xs">Needed for the regression method.</td></tr>
            <tr><td>Model parameters</td><td className="text-xs">parameter, value, source, source_url, status, evidence</td><td className="text-xs">Names: {PARAM_NAMES.join(', ')}. With a source the value is labelled by the status you give; without one it is “Assumed”.</td></tr>
            <tr><td>References</td><td className="text-xs">title, url</td><td className="text-xs">Adds links to the Reference Library.</td></tr>
          </tbody></table></div>
        <p className="mt-3 text-xs muted">JSON is also accepted: <code>{'{"parameters":[{"parameter":"original_live_mm3","value":7290,"source":"…"}], "rainfall":[…]}'}</code>. For Excel files use Save As → CSV.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(TEMPLATES).map(([n, c]) => <button key={n} className="btn !py-1 text-xs" onClick={() => download(n, c)}><Download size={13} aria-hidden /> {n}</button>)}
          <button className="btn !py-1 text-xs" onClick={() => download('parameters_EXAMPLE.csv', EXAMPLE_PARAMS)}><Download size={13} aria-hidden /> parameters_EXAMPLE.csv</button>
        </div>
        <p className="muted mt-3 text-xs">Running <code>npm run dev</code> also watches the <code>data-inbox</code> folder: files saved there are loaded automatically without using this page.</p>
      </Card>
    </div>
  )
}
