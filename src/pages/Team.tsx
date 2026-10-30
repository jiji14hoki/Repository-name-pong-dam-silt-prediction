import { Check, Copy, Download, ImagePlus, Pencil, Plus, RotateCcw, Trash2, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Card } from '../components/ui'
import { projectMembers as FILE_MEMBERS, type ProjectMember } from '../data/members'
import { dataUrlToBlob, download } from '../utils/csv'

const KEY = 'pongsilt.v1.members'

function loadMembers(): ProjectMember[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as ProjectMember[]) : null
    return Array.isArray(v) ? v : FILE_MEMBERS
  } catch { return FILE_MEMBERS }
}

/** Resize to max 480 px wide JPEG so the photo fits comfortably in browser storage. */
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 480 / img.width)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image. Use a JPG or PNG file.')) }
    img.src = url
  })
}

function Photo({ m }: { m: ProjectMember }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [m.image])
  return (
    <div className="aspect-[4/5] w-full overflow-hidden rounded-md bg-slate-200 dark:bg-slate-700">
      {bad || !m.image ? <div className="flex h-full items-center justify-center text-slate-500" role="img" aria-label={`Placeholder photo for ${m.name}`}><User size={56} aria-hidden /></div>
        : <img src={m.image} alt={`Portrait of ${m.name}, ${m.role}`} className="h-full w-full object-cover" onError={() => setBad(true)} />}
    </div>
  )
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')
function toSource(ms: ProjectMember[]): string {
  const rows = ms.map((m, i) => `  { id: ${i + 1}, name: '${esc(m.name)}', role: '${esc(m.role)}', bio: '${esc(m.bio)}', image: '${m.image.startsWith('data:') ? `/images/members/member-${i + 1}.jpg` : esc(m.image)}', post: '${esc(m.post)}' },`).join('\n')
  return `export interface ProjectMember {\n  id: number\n  name: string\n  role: string\n  bio: string\n  /** Path under /public, e.g. "/images/members/member-1.jpg" */\n  image: string\n  post: string\n}\n\nexport const projectMembers: ProjectMember[] = [\n${rows}\n]\n`
}

export default function Team() {
  const [members, setMembers] = useState<ProjectMember[]>(loadMembers)
  const [edit, setEdit] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pick = useRef<HTMLInputElement>(null)
  const target = useRef<number | null>(null)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(members)) } catch { setMsg('Browser storage is full or blocked — edits will not persist. Use "Copy code" to keep them.') }
  }, [members])

  const patch = (id: number, p: Partial<ProjectMember>) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))
  const add = () => setMembers((ms) => [...ms, { id: Math.max(0, ...ms.map((m) => m.id)) + 1, name: 'New Member', role: 'Role', bio: 'Short biography.', image: '', post: 'Designation / department' }])
  const remove = (m: ProjectMember) => { if (window.confirm(`Remove ${m.name || 'this member'} from the team?`)) setMembers((ms) => ms.filter((x) => x.id !== m.id)) }
  const reset = () => { if (window.confirm('Discard all edits made in this browser and go back to src/data/members.ts?')) { setMembers(FILE_MEMBERS); setMsg('Reset to the members in src/data/members.ts.') } }
  const onFile = async (f?: File) => {
    const id = target.current
    if (!f || id == null) return
    try { patch(id, { image: await resizeToDataUrl(f) }); setMsg('Photo updated.') } catch (e) { setMsg((e as Error).message) }
    if (pick.current) pick.current.value = ''
  }
  const copy = async () => {
    const code = toSource(members)
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); setMsg('Copied. Paste it over the whole content of src/data/members.ts and save.') }
    catch { void download('members-code.txt', code, 'text/plain;charset=utf-8'); setMsg('Clipboard blocked — saved members-code.txt instead. Copy its content over src/data/members.ts.') }
  }
  const photoDownload = (m: ProjectMember, i: number) => { void download(`member-${i + 1}.jpg`, dataUrlToBlob(m.image)) }

  return (
    <div className="space-y-4">
      <Card title="Project team" subtitle={edit ? 'Editing — changes save automatically in this browser.' : 'Use “Edit team” to change names, posts, bios and photos.'}
        right={<div className="flex flex-wrap gap-2">
          <button className="btn" aria-pressed={edit} onClick={() => setEdit(!edit)}>{edit ? <><Check size={15} aria-hidden /> Done editing</> : <><Pencil size={15} aria-hidden /> Edit team</>}</button>
          {edit && <>
            <button className="btn" onClick={add}><Plus size={15} aria-hidden /> Add member</button>
            <button className="btn" onClick={copy}><Copy size={15} aria-hidden /> {copied ? 'Copied' : 'Copy code'}</button>
            <button className="btn btn-danger" onClick={reset}><RotateCcw size={15} aria-hidden /> Reset</button>
          </>}
        </div>}>
        {edit && <Alert kind="info">Edits are stored <strong>in this browser only</strong>. To make them permanent for everyone: click <em>Copy code</em>, paste it over <code>src/data/members.ts</code>, and put each photo (use <em>Download photo</em>) in <code>public/images/members/</code> with the name shown.</Alert>}
        {msg && <p role="status" className="muted mt-2 text-xs">{msg}</p>}
        <input ref={pick} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Choose member photo" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {members.map((m, i) => (
            <article key={m.id} className="card overflow-hidden p-3">
              <Photo m={m} />
              {!edit ? (
                <>
                  <h3 className="mt-3 font-semibold">{m.name}</h3>
                  <p className="text-sm text-reservoir-500">{m.role}</p>
                  <p className="muted text-xs">{m.post}</p>
                  <p className="mt-2 text-sm">{m.bio}</p>
                </>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn !py-1 text-xs" onClick={() => { target.current = m.id; pick.current?.click() }}><ImagePlus size={13} aria-hidden /> {m.image ? 'Change photo' : 'Upload photo'}</button>
                    {m.image && <button className="btn !py-1 text-xs" onClick={() => patch(m.id, { image: '' })}>Remove photo</button>}
                    {m.image.startsWith('data:') && <button className="btn !py-1 text-xs" onClick={() => photoDownload(m, i)}><Download size={13} aria-hidden /> Download photo</button>}
                  </div>
                  <label className="block"><span className="label">Name</span><input className="input" value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} /></label>
                  <label className="block"><span className="label">Project role</span><input className="input" value={m.role} onChange={(e) => patch(m.id, { role: e.target.value })} /></label>
                  <label className="block"><span className="label">Post / department</span><input className="input" value={m.post} onChange={(e) => patch(m.id, { post: e.target.value })} /></label>
                  <label className="block"><span className="label">Short biography</span><textarea className="input min-h-[4.5rem]" value={m.bio} onChange={(e) => patch(m.id, { bio: e.target.value })} /></label>
                  <button className="btn btn-danger !py-1 text-xs" onClick={() => remove(m)}><Trash2 size={13} aria-hidden /> Remove member</button>
                </div>
              )}
            </article>
          ))}
        </div>
        {members.length === 0 && <p className="muted text-sm">No members. Use “Edit team” → “Add member”.</p>}
      </Card>
    </div>
  )
}
