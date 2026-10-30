import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DataStatus } from '../engine/types'
import type { Evidence } from '../data/provenance'

export function Card({ title, subtitle, right, children, className = '' }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card card-pad ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="h-title">{title}</h2>}
            {subtitle && <p className="muted text-xs mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

const STATUS_STYLE: Record<string, string> = {
  Observed: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
  'Published Estimate': 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800',
  Modelled: 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800',
  Assumed: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  Simulated: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  Missing: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
  Forecast: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800',
  Verified: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
}
export function Badge({ children, kind }: { children: ReactNode; kind?: DataStatus | string }) {
  return <span className={`chip ${STATUS_STYLE[String(kind ?? children)] ?? ''}`}>{children}</span>
}

const EV_LABEL: Record<Evidence, string> = { primary: 'Primary source read', secondary: 'Secondary citation', none: 'No source' }
const EV_STYLE: Record<Evidence, string> = {
  primary: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
  secondary: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800',
  none: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
}
export function EvidenceBadge({ evidence }: { evidence: Evidence }) { return <span className={`chip ${EV_STYLE[evidence]}`}>{EV_LABEL[evidence]}</span> }

/** Keyboard-accessible tooltip (focus or hover). */
export function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={text} className="muted rounded focus-visible:ring-2 ring-reservoir-400 outline-none">
        <Info size={14} aria-hidden />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-md border p-2 text-xs font-normal shadow-lg group-hover:block group-focus-within:block" style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}>
        {text}
      </span>
    </span>
  )
}

export function Kpi({ label, value, unit, kind, note, tip }: { label: string; value: string; unit?: string; kind: 'Measured' | 'Model estimate' | 'Assumed input' | 'Published estimate' | 'Observed record' | 'Forecast'; note?: string; tip?: string }) {
  const style = kind === 'Model estimate' || kind === 'Forecast' ? 'Modelled' : kind === 'Assumed input' ? 'Assumed' : kind === 'Published estimate' ? 'Published Estimate' : 'Observed'
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="muted text-xs font-medium">{label} {tip && <Tip text={tip} />}</p>
        <Badge kind={style}>{kind}</Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value} {unit && <span className="muted text-sm font-normal">{unit}</span>}
      </p>
      {note && <p className="muted mt-1 text-xs">{note}</p>}
    </div>
  )
}

export function NumField({ label, value, onChange, step = 'any', min, max, tip, disabled, suffix }: { label: string; value: number | null; onChange: (v: number) => void; step?: string; min?: number; max?: number; tip?: string; disabled?: boolean; suffix?: string }) {
  return (
    <label className="block">
      <span className="label">{label} {tip && <Tip text={tip} />}</span>
      <div className="flex items-center gap-1.5">
        <input className="input" type="number" step={step} min={min} max={max} disabled={disabled} value={value ?? ''} onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n) }} />
        {suffix && <span className="muted text-xs whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  )
}

export function Select<T extends string>({ label, value, onChange, options, tip }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; tip?: string }) {
  return (
    <label className="block">
      <span className="label">{label} {tip && <Tip text={tip} />}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function Alert({ kind = 'warn', children }: { kind?: 'warn' | 'info'; children: ReactNode }) {
  const cls = kind === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800' : 'border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800'
  return <div role="note" className={`rounded-md border px-3 py-2 text-xs ${cls}`}>{children}</div>
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center" style={{ borderColor: 'var(--line)' }}>
      <p className="text-sm font-medium">{title}</p>
      <p className="muted mt-1 text-xs">{hint}</p>
    </div>
  )
}

export const fmt = (n: number | null | undefined, d = 1) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }))
