import { ExternalLink } from 'lucide-react'
import { Card } from './ui'

/** Abstract illustration — NOT a satellite image or live imagery. */
export function ReservoirPanel() {
  return (
    <Card title="Reservoir location" subtitle="Pong Dam (Maharana Pratap Sagar), Beas river, Himachal Pradesh — managed by BBMB">
      <svg viewBox="0 0 400 170" role="img" aria-label="Abstract illustration of a reservoir between mountains. Not a satellite image." className="w-full rounded-md" style={{ background: 'linear-gradient(#cfe0f1,#eaf1f8)' }}>
        <polygon points="0,110 60,50 110,85 170,30 240,90 300,45 400,105 400,170 0,170" fill="#5e7f9c" />
        <polygon points="0,130 80,80 140,110 210,70 280,115 350,80 400,125 400,170 0,170" fill="#41627f" />
        <path d="M0,140 C80,128 120,150 200,140 C280,130 330,150 400,138 L400,170 L0,170Z" fill="#1f6fb2" />
        <path d="M20,152 C100,144 170,158 250,150 C310,144 360,154 400,150" stroke="#7fb4de" fill="none" strokeWidth="1.5" />
        <rect x="318" y="118" width="14" height="30" fill="#c8d1db" />
        <text x="12" y="20" fontSize="10" fill="#33485e">Illustration only — not satellite imagery</text>
      </svg>
      <p className="muted mt-2 text-xs">Approximate location: 32.0° N, 76.0° E (indicative; verify). No live imagery is shown or implied.</p>
      <a className="btn mt-2" href="https://bhuvan-wbis.nrsc.gov.in" target="_blank" rel="noreferrer noopener"><ExternalLink size={14} aria-hidden /> Open Bhuvan WBIS portal</a>
    </Card>
  )
}
