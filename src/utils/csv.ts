export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : [])
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

/** RFC-4180-style parser (quoted fields, escaped quotes, CRLF). Returns objects keyed by lower-cased header. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQ = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { cur.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      cur.push(field); field = ''
      if (cur.some((c) => c.trim() !== '')) rows.push(cur)
      cur = []
    } else field += ch
  }
  cur.push(field)
  if (cur.some((c) => c.trim() !== '')) rows.push(cur)
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

/** Convert a data: URL (e.g. an uploaded team photo) to a Blob without using fetch (blocked in the artifact viewer). */
export function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

interface ClaudeHost { use?: (name: string) => Promise<unknown> }
/**
 * Offer a file to the user. Inside the claude.ai artifact viewer plain download links are blocked, so the
 * `downloads` capability is used there (the viewer confirms the save). Everywhere else (npm run dev,
 * a hosted copy, a local file) a normal browser download is used.
 */
export async function download(filename: string, content: string | Blob, mime = 'text/csv;charset=utf-8'): Promise<void> {
  const host = (globalThis as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    try {
      const dl = (await Promise.race([host.use('downloads'), new Promise((r) => setTimeout(() => r(null), 3000))])) as { save: (r: { filename: string; data: string | Blob }) => Promise<unknown> } | null
      if (dl) { await dl.save({ filename, data: content }); return }
    } catch (e) {
      if ((e as { code?: string })?.code === 'declined') return // the user said no — do not try again
    }
  }
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const num = (s: string | undefined): number | null => {
  if (s == null || s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
