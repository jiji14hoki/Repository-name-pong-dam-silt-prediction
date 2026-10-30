import { MessageCircle, Send, X } from 'lucide-react'
import { useState } from 'react'
import { answerQuery, SUGGESTED_QUESTIONS } from '../engine/query'
import { useApp } from '../state'

export function AskModel() {
  const { input, scenario } = useApp()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [log, setLog] = useState<{ q: string; a: string; ok: boolean }[]>([])
  const ask = (text: string) => { if (!text.trim()) return; const r = answerQuery(text, input, scenario); setLog((l) => [...l, { q: text, a: r.text, ok: r.ok }]); setQ('') }
  return (
    <>
      <button className="btn btn-primary fixed bottom-4 right-4 z-40 shadow-lg" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="ask-panel"><MessageCircle size={16} aria-hidden /> Ask the Model</button>
      {open && (
        <div id="ask-panel" role="dialog" aria-label="Ask the Model" className="card fixed bottom-16 right-4 z-40 flex max-h-[70vh] w-[min(92vw,26rem)] flex-col shadow-xl">
          <div className="flex items-center justify-between border-b p-3" style={{ borderColor: 'var(--line)' }}>
            <strong className="text-sm">Ask the Model</strong>
            <button className="btn !p-1" aria-label="Close" onClick={() => setOpen(false)}><X size={14} aria-hidden /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm" aria-live="polite">
            <p className="muted text-xs">Rule-based answers from the same forecasting engine as the dashboard. No external AI. Uses the selected scenario ({scenario}) unless you name another.</p>
            {log.map((m, i) => <div key={i}><p className="font-medium">{m.q}</p><p className={m.ok ? '' : 'text-amber-700 dark:text-amber-300'}>{m.a}</p></div>)}
            <div className="flex flex-wrap gap-1.5">{SUGGESTED_QUESTIONS.map((s) => <button key={s} className="chip hover:bg-slate-100 dark:hover:bg-slate-800 text-left" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
          <form className="flex gap-2 border-t p-3" style={{ borderColor: 'var(--line)' }} onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <label className="sr-only" htmlFor="ask-in">Question</label>
            <input id="ask-in" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. silt accumulation in 2050" />
            <button className="btn btn-primary" type="submit" aria-label="Send question"><Send size={14} aria-hidden /></button>
          </form>
        </div>
      )}
    </>
  )
}
