import { jsPDF } from 'jspdf'
import { download } from './csv'
import { DATASET_VERSION } from '../data/defaults'
import { REFERENCES } from '../data/references'
import { BRUNE_CURVES } from '../engine/brune'
import { formatThreshold, SCENARIOS } from '../engine/model'
import type { AllScenarios } from '../engine/model'
import type { DesiltingEvent, ModelParams, ScenarioKey } from '../engine/types'

const COL: Record<ScenarioKey, [number, number, number]> = {
  optimistic: [43, 138, 138], realistic: [31, 111, 178], pessimistic: [200, 120, 20],
}

export function buildReport(opts: {
  all: AllScenarios; params: ModelParams; events: DesiltingEvent[]; scenario: ScenarioKey; year: number
  rainSummary: string; refRain: number | null
  provRows: { label: string; value: string; status: string; evidence: string; source: string }[]
}) {
  const { all, params, events, scenario, year } = opts
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 15
  let y = 0
  const gen = new Date().toISOString().slice(0, 10)
  const footer = () => {
    const n = doc.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120)
      doc.text(`Model Estimate - Not an Official BBMB Forecast  |  Dataset ${DATASET_VERSION}  |  Generated ${gen}  |  Page ${i}/${n}`, M, 290)
    }
  }
  const need = (h: number) => { if (y + h > 282) { doc.addPage(); y = 20 } }
  const h2 = (t: string) => { need(12); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(15, 45, 86); doc.text(t, M, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setTextColor(30) }
  const p = (t: string, size = 9.5) => { doc.setFontSize(size); const lines = doc.splitTextToSize(t, W - 2 * M) as string[]; need(lines.length * 4.6); doc.text(lines, M, y); y += lines.length * 4.6 + 1 }

  doc.setFillColor(10, 31, 61); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('PongSilt Predict', M, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Pong Dam (Maharana Pratap Sagar) - Desiltation Forecast Report', M, 21)
  doc.setFontSize(9); doc.text('MODEL ESTIMATE - NOT AN OFFICIAL BBMB FORECAST  |  DEMONSTRATION ASSUMPTIONS', M, 27)
  y = 38; doc.setTextColor(30)
  p(`Generated: ${gen}    Dataset version: ${DATASET_VERSION}    Selected scenario: ${scenario}    Forecast year: ${year}`)

  const res = all[scenario]
  const r = res.rows.find((x) => x.year === year)
  h2(`1. Estimate for ${year} (${scenario})`)
  if (r) {
    const lines: [string, string][] = [
      ['Cumulative gross sediment inflow', `${r.cumGrossInflowMm3.toFixed(1)} Mm3`],
      ['Cumulative trapped sediment', `${r.cumTrappedMm3.toFixed(1)} Mm3`],
      ['Cumulative removed sediment', `${r.cumRemovedMm3.toFixed(1)} Mm3`],
      ['Cumulative net storage loss', `${r.cumNetLossMm3.toFixed(1)} Mm3`],
      ['Remaining live storage', `${r.liveMm3.toFixed(1)} Mm3 (${(r.liveMm3 / 1000).toFixed(3)} BCM)`],
      ['Remaining dead storage', `${r.deadMm3.toFixed(1)} Mm3`],
      ['Original live storage lost', `${r.liveLostPct.toFixed(2)} %`],
      ['Annual gross inflow / net loss', `${r.grossInflowMm3.toFixed(1)} / ${r.netMm3.toFixed(1)} Mm3 per year`],
      ['Trap efficiency (C/I)', `${(r.trapEfficiency * 100).toFixed(1)} % (C/I = ${r.capacityInflowRatio.toFixed(3)})`],
      ['Rainfall used', r.rainfallMm == null ? 'missing' : `${r.rainfallMm.toFixed(0)} mm (${r.rainfallSource})`],
      ['Value type', r.kind === 'forecast' ? 'Forecast (model estimate)' : 'Modelled historical estimate'],
    ]
    for (const [k, v] of lines) { need(5); doc.setFontSize(9.5); doc.text(k, M, y); doc.text(v, M + 75, y); y += 5 }
  }

  h2('2. Threshold crossing years (share of original live storage)')
  for (const s of SCENARIOS) {
    const t = all[s].thresholds.map((x) => `${x.pct}%: ${formatThreshold(x.year)}`).join('  |  ')
    p(`${s}: ${t}  |  dead storage depleted: ${formatThreshold(all[s].deadDepletionYear)}`)
  }

  h2('3. Scenario comparison - remaining live storage (Mm3)')
  const yrs = [2030, 2040, 2050, 2060, 2070]
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  ;['Scenario', ...yrs.map(String)].forEach((h, i) => doc.text(h, M + i * 30, y)); y += 5
  doc.setFont('helvetica', 'normal')
  for (const s of SCENARIOS) {
    doc.text(s, M, y)
    yrs.forEach((yy, i) => { const row = all[s].rows.find((x) => x.year === yy); doc.text(row ? row.liveMm3.toFixed(0) : 'n/a', M + (i + 1) * 30, y) })
    y += 5
  }

  h2('4. Remaining live storage chart')
  const cx = M + 12, cw = W - 2 * M - 14, ch = 55
  need(ch + 18)
  const top = y + 2
  const lo = Math.min(...SCENARIOS.map((s) => Math.min(...all[s].rows.map((r) => r.liveMm3))), params.originalLiveMm3 * 0.55)
  const hi = params.originalLiveMm3
  const xs = (yr: number) => cx + ((yr - params.startYear) / (params.endYear - params.startYear)) * cw
  const ys = (v: number) => top + ch - ((v - lo) / (hi - lo)) * ch
  doc.setDrawColor(190); doc.rect(cx, top, cw, ch)
  doc.setFontSize(7); doc.setTextColor(90)
  for (const pct of [100, 80, 70, 60]) {
    const v = (pct / 100) * params.originalLiveMm3
    if (v >= lo) { doc.setDrawColor(215); doc.line(cx, ys(v), cx + cw, ys(v)); doc.text(`${pct}%`, M, ys(v) + 1) }
  }
  for (const ev of events) if (ev.includeInModel && ev.volumeMm3 != null) { doc.setDrawColor(150, 60, 60); doc.line(xs(ev.startYear), top, xs(ev.startYear), top + ch) }
  for (const s of SCENARIOS) {
    doc.setDrawColor(...COL[s]); doc.setLineWidth(0.5)
    const rows = all[s].rows
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i]
      if (b.kind === 'forecast') doc.setLineDashPattern([1.2, 1], 0); else doc.setLineDashPattern([], 0)
      doc.line(xs(a.year), ys(a.liveMm3), xs(b.year), ys(b.liveMm3))
    }
  }
  doc.setLineDashPattern([], 0); doc.setLineWidth(0.2)
  doc.setTextColor(90); doc.text(`${params.startYear}`, cx, top + ch + 4); doc.text(`${params.endYear}`, cx + cw - 6, top + ch + 4)
  y = top + ch + 8
  let lx = M
  for (const s of SCENARIOS) { doc.setFillColor(...COL[s]); doc.rect(lx, y - 2.5, 4, 2.5, 'F'); doc.setTextColor(30); doc.text(s, lx + 6, y); lx += 32 }
  doc.text('dashed = forecast, solid = modelled historical; red vertical = applied desilting', lx, y)
  y += 4; doc.setTextColor(30)

  h2('5. Model assumptions')
  p(`Gross yield S_ref (Mm3/yr): optimistic ${params.yields.optimistic}, realistic ${params.yields.realistic}, pessimistic ${params.yields.pessimistic}. Yield method: ${params.yieldMethod}.`)
  p(`Original live ${params.originalLiveMm3} Mm3 (provisional), dead ${params.originalDeadMm3} Mm3 (assumed), annual inflow ${params.annualInflowMm3} Mm3/yr (assumed).`)
  p(`Trap efficiency: ${params.trap.curve === 'fixed' ? `fixed ${params.trap.fixedEta}` : BRUNE_CURVES[params.trap.curve].label}. Compaction: ${params.compaction.mode}, volume factor ${res.compactionFactorUsed.toFixed(3)}. Allocation: ${(params.allocation.dead * 100).toFixed(0)}% dead / ${(params.allocation.live * 100).toFixed(0)}% live (assumed).`)
  p(`Rainfall: ${opts.rainSummary}${opts.refRain ? ` Reference rainfall R_ref = ${opts.refRain.toFixed(0)} mm, beta = ${params.rain.beta}, future change ${params.rain.futureChangePct}%.` : ''}`)

  h2('6. Input provenance')
  for (const r of opts.provRows) p(`${r.label}: ${r.value} - ${r.status} (${r.evidence === 'primary' ? 'primary source read' : r.evidence === 'secondary' ? 'secondary citation' : 'no source'}). ${r.source}`, 8)

  h2('7. Desilting / dredging register')
  if (!events.length) p('No events recorded.')
  for (const e of events) p(`${e.id}: ${e.startYear}-${String(e.startMonth).padStart(2, '0')}${e.endYear ? ` to ${e.endYear}-${String(e.endMonth ?? 12).padStart(2, '0')}` : ''}; ${e.method}; volume ${e.volumeMm3 == null ? 'not recorded' : e.volumeMm3 + ' Mm3'}; ${e.verification}; applied in model: ${e.includeInModel ? 'yes' : 'no'}; source: ${e.source}`, 8.5)

  h2('8. References')
  for (const s of REFERENCES) p(`${s.id} ${s.title} - ${s.publisher} ${s.year} [${s.checked === 'link-only' ? 'link only, not opened' : s.checked === 'abstract' ? 'abstract read' : 'read'}] ${s.url}`, 8)

  h2('9. Limitations')
  p('This is a transparent demonstration model. Default inputs are provisional or assumed and are not verified BBMB measurements. Brune curve points are an approximate digitisation. Rainfall in the bundled dataset is simulated. Point rainfall is not catchment-average rainfall. Satellite NDWI water-spread does not measure sediment volume. Results must not be quoted as an official engineering prediction without validation against bathymetric surveys and authorised review.', 9)
  warns(res.warnings, p)
  footer()
  void download(`PongSilt_Report_${scenario}_${year}.pdf`, doc.output('blob'), 'application/pdf')
}

function warns(w: string[], p: (t: string) => void) {
  if (w.length) p('Model warnings: ' + w.join(' '))
}
