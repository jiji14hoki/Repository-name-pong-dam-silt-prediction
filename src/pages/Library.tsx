import { Download, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, Badge, Card, EvidenceBadge, Empty } from '../components/ui'
import { REFERENCES, REFERENCE_FACTS, type RefCategory, type RefChecked, type ReferenceItem } from '../data/references'
import { useApp } from '../state'
import { download, toCSV } from '../utils/csv'

const CHECK: Record<RefChecked, { label: string; kind: string }> = {
  read: { label: 'Opened & read', kind: 'Verified' },
  abstract: { label: 'Abstract read', kind: 'Published Estimate' },
  'link-only': { label: 'Link only — not opened', kind: 'Missing' },
  user: { label: 'Added by user', kind: 'Assumed' },
}
const CATS: (RefCategory | 'All')[] = ['All', 'Official records', 'Surveys & studies', 'Data portals', 'Rainfall & climate', 'Remote sensing', 'Secondary sources', 'User added']

export default function Library() {
  const { userRefs, addRef, removeRef } = useApp()
  const [cat, setCat] = useState<RefCategory | 'All'>('All')
  const [q, setQ] = useState('')
  const [d, setD] = useState({ title: '', url: '', publisher: '', note: '' })
  const [msg, setMsg] = useState('')
  const all = useMemo(() => [...REFERENCES, ...userRefs], [userRefs])
  const shown = all.filter((r) => (cat === 'All' || r.category === cat) && (`${r.title} ${r.publisher} ${r.contains} ${r.usedFor}`.toLowerCase().includes(q.toLowerCase())))

  const add = () => {
    if (!d.title.trim()) return setMsg('Give the reference a title.')
    if (!/^https?:\/\//i.test(d.url.trim())) return setMsg('The link must start with http:// or https://')
    const item: ReferenceItem = { id: `UREF-${Date.now().toString(36)}`, title: d.title.trim(), publisher: d.publisher.trim() || '—', year: '—', kind: /\.pdf($|\?)/i.test(d.url) ? 'PDF' : 'Website', category: 'User added', url: d.url.trim(), contains: d.note.trim() || 'Added by user.', checked: 'user', usedFor: '' }
    addRef(item); setD({ title: '', url: '', publisher: '', note: '' }); setMsg('Reference added.')
  }
  return (
    <div className="space-y-4">
      <Alert kind="info">
        <strong>Where to read the actual data.</strong> Every entry says honestly what was checked: <em>Opened &amp; read</em> (the quoted facts come from the document itself), <em>Abstract read</em>, or <em>Link only — not opened</em> (a place to obtain data that has not been verified by the developer). Always confirm figures in the original document before using them in a report.
      </Alert>

      <Card title="Key facts and where they come from" subtitle="Only figures found in the documents listed below">
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Quantity</th><th>Published value</th><th>Evidence</th><th>Source</th></tr></thead>
          <tbody>{REFERENCE_FACTS.map((f) => (
            <tr key={f.label}><td>{f.label}</td><td className="font-medium tabular-nums">{f.value}</td><td><EvidenceBadge evidence={f.evidence} /></td>
              <td className="text-xs"><a className="underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.source}</a></td></tr>))}</tbody>
        </table></div>
        <p className="muted mt-2 text-xs">The 7,290 Mm³ and 6,157 Mm³ capacities are not reconciled by any document read here (different reference levels or definitions are likely). Treat original capacity as <strong>to be confirmed with BBMB</strong>.</p>
      </Card>

      <Card title="Reference library" subtitle={`${shown.length} of ${all.length} entries`}
        right={<button className="btn" onClick={() => download('pongsilt_references.csv', toCSV(all.map((r) => ({ title: r.title, url: r.url, type: r.kind, publisher: r.publisher, year: r.year, category: r.category, checked: r.checked, contains: r.contains })) as unknown as Record<string, unknown>[]))}><Download size={15} aria-hidden /> Export CSV</button>}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="block grow sm:max-w-xs"><span className="label">Search</span>
            <span className="relative block"><Search size={14} className="muted absolute left-2 top-2.5" aria-hidden /><input className="input !pl-7" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. sedimentation, rainfall, BBMB" /></span></label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`chip focus-visible:ring-2 ${cat === c ? 'bg-navy-800 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{c}</button>)}
          </div>
        </div>
        {shown.length === 0 ? <Empty title="No references match" hint="Clear the search or choose another category." /> : (
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id} className="rounded-md border p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <a className="font-medium underline-offset-2 hover:underline" href={r.url} target="_blank" rel="noreferrer noopener">{r.title} <ExternalLink size={12} className="inline align-baseline" aria-label="opens in a new tab" /></a>
                  <div className="flex gap-1.5"><span className="chip">{r.kind}</span><Badge kind={CHECK[r.checked].kind}>{CHECK[r.checked].label}</Badge></div>
                </div>
                <p className="muted text-xs">{r.publisher}{r.year !== '—' ? ` · ${r.year}` : ''} · {r.category}</p>
                <p className="mt-1.5 text-sm">{r.contains}</p>
                {r.usedFor && <p className="muted mt-1 text-xs">Used for: {r.usedFor}</p>}
                <p className="muted mt-1 break-all text-[11px]">{r.url}</p>
                {r.checked === 'user' && <button className="btn btn-danger mt-2 !py-0.5 text-xs" onClick={() => removeRef(r.id)}><Trash2 size={12} aria-hidden /> Remove</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add a reference" subtitle="Paste a link to a website or PDF — it is saved in this browser and included in the export">
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add() }}>
          <label><span className="label">Title *</span><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
          <label><span className="label">Link (website or PDF) *</span><input className="input" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://…" /></label>
          <label><span className="label">Publisher</span><input className="input" value={d.publisher} onChange={(e) => setD({ ...d, publisher: e.target.value })} /></label>
          <label><span className="label">What it contains</span><input className="input" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></label>
          <div className="flex items-center gap-2 sm:col-span-2"><button className="btn btn-primary" type="submit"><Plus size={15} aria-hidden /> Add reference</button>{msg && <span role="status" className="muted text-xs">{msg}</span>}</div>
        </form>
      </Card>
    </div>
  )
}
