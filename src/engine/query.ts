import { formatThreshold, rowAt, runScenario, SCENARIOS } from './model'
import type { DesiltingEvent, ModelInput, ScenarioKey } from './types'

export const SUGGESTED_QUESTIONS = [
  'What is the estimated silt accumulation in 2040?',
  'When will live storage fall below 70%?',
  'What happens under the pessimistic scenario?',
  'How does increased rainfall affect the forecast?',
  'What is the effect of desilting 2 Mm³ in 2035?',
]

export interface QueryAnswer {
  ok: boolean
  text: string
}

const f1 = (n: number) => n.toFixed(1)
const f2 = (n: number) => n.toFixed(2)

function scenarioFrom(text: string, fallback: ScenarioKey): ScenarioKey {
  const t = text.toLowerCase()
  for (const s of SCENARIOS) if (t.includes(s)) return s
  return fallback
}

/**
 * Deterministic rule-based query handler. It calls the SAME runScenario() engine
 * as the dashboard; no language model is involved. Unrecognised input returns suggestions.
 */
export function answerQuery(raw: string, input: ModelInput, selected: ScenarioKey): QueryAnswer {
  const text = raw.trim()
  const t = text.toLowerCase()
  const p = input.params
  const label = '(Model estimate under demonstration assumptions — not an official BBMB forecast.)'
  if (!t) return { ok: false, text: 'Type a question or pick a suggestion below.' }
  const year = (t.match(/\b(19[89]\d|20[0-6]\d|2070)\b/) ?? [])[1]
  const yr = year ? Number(year) : null
  const scen = scenarioFrom(t, selected)
  const res = runScenario(input, scen)

  // 1) Effect of desilting X Mm3 in YEAR
  const desilt = t.match(/(?:desilt|dredg|remov)\w*\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:mm3|mm³|million)/)
  if (desilt && yr) {
    const vol = Number(desilt[1])
    const ev: DesiltingEvent = {
      id: 'QUERY-HYP', startYear: yr, startMonth: 6, endYear: null, endMonth: null, operationDate: String(yr),
      volumeMm3: vol, rate: '', method: 'Desilting', source: 'Ask the Model hypothetical', verification: 'Hypothetical',
      notes: '', includeInModel: true,
    }
    const alt = runScenario({ ...input, events: [...input.events, ev] }, scen)
    const endY = Math.min(p.endYear, 2070)
    const a = rowAt(res, endY)
    const b = rowAt(alt, endY)
    if (!a || !b) return { ok: false, text: 'The simulation did not reach the end year, so the comparison is unavailable.' }
    const gain = b.liveMm3 - a.liveMm3
    const deltaPct = (gain / p.originalLiveMm3) * 100
    return {
      ok: true,
      text: `Hypothetical: removing ${f1(vol)} Mm³ in ${yr} (${scen} scenario). Because only ${(p.allocation.live * 100).toFixed(0)}% of removed sediment is allocated back to live storage (assumed split), live storage in ${endY} would be ${f1(gain)} Mm³ higher (+${f2(deltaPct)} percentage points of original live storage): ${f1(a.liveMm3)} → ${f1(b.liveMm3)} Mm³. Removal is capped at the deposit available. ${label}`,
    }
  }

  // 2) Rainfall effect
  if (t.includes('rain')) {
    const pct = Number((t.match(/(\d+)\s*%/) ?? [])[1] ?? 20)
    const baseIn: ModelInput = { ...input, params: { ...p, yieldMethod: 'rainfall', rain: { ...p.rain, futureChangePct: 0 } } }
    const upIn: ModelInput = { ...input, params: { ...p, yieldMethod: 'rainfall', rain: { ...p.rain, futureChangePct: pct } } }
    const a = runScenario(baseIn, scen)
    const b = runScenario(upIn, scen)
    const y = yr ?? 2050
    const ra = rowAt(a, y)
    const rb = rowAt(b, y)
    if (!ra || !rb || a.warnings.some((w) => w.includes('R_ref')))
      return { ok: false, text: 'A valid reference rainfall (from rainfall data or a manual R_ref) is needed to test rainfall sensitivity.' }
    return {
      ok: true,
      text: `Rainfall sensitivity (${scen}, rainfall-adjusted yield with β = ${p.rain.beta}, R_ref = ${f1(a.refRainfallMm ?? 0)} mm): a ${pct}% increase in forecast-year rainfall raises annual gross sediment inflow from ${f1(ra.grossInflowMm3)} to ${f1(rb.grossInflowMm3)} Mm³/yr, and cumulative net storage loss by ${y} from ${f1(ra.cumNetLossMm3)} to ${f1(rb.cumNetLossMm3)} Mm³. This uses the configurable power-law relationship, not a calibrated one. ${label}`,
    }
  }

  // 3) Threshold crossing
  const th = t.match(/(?:below|under|fall to|reach|drop(?:s)? to)\s*(\d{2})\s*%/)
  if (th || t.includes('when')) {
    const pct = th ? Number(th[1]) : 70
    const crossing = res.thresholds.find((x) => x.pct === pct)
    if (crossing) {
      return {
        ok: true,
        text: `Under the ${scen} scenario, live storage falls to ${pct}% of the original (${f1((p.originalLiveMm3 * pct) / 100)} Mm³): ${formatThreshold(crossing.year)}. ${label}`,
      }
    }
    // arbitrary pct: compute directly
    if (pct > 0 && pct < 100) {
      const hit = res.rows.find((r) => r.liveMm3 <= (pct / 100) * p.originalLiveMm3)
      return {
        ok: true,
        text: `Under the ${scen} scenario, live storage falls to ${pct}% of the original: ${formatThreshold(hit ? hit.year : null)}. ${label}`,
      }
    }
  }

  // 4) Accumulation in a year
  if (yr && (t.includes('silt') || t.includes('sediment') || t.includes('accumul') || t.includes('storage'))) {
    const r = rowAt(res, yr)
    if (!r) return { ok: false, text: `The model does not cover ${yr}.` }
    return {
      ok: true,
      text: `${scen[0].toUpperCase() + scen.slice(1)} scenario, ${yr} (${r.kind === 'forecast' ? 'forecast' : 'modelled historical estimate'}): cumulative trapped silt ${f1(r.cumTrappedMm3)} Mm³; cumulative net storage loss ${f1(r.cumNetLossMm3)} Mm³; remaining live storage ${f1(r.liveMm3)} Mm³ (${f2(r.liveMm3 / 1000)} BCM), i.e. ${f1(r.liveLostPct)}% of original live storage lost. ${label}`,
    }
  }

  // 5) Scenario summary
  if (t.includes('scenario') || SCENARIOS.some((s) => t.includes(s))) {
    const r = rowAt(res, 2070) ?? res.rows[res.rows.length - 1]
    const firstT = res.thresholds.map((x) => `${x.pct}%: ${formatThreshold(x.year)}`).join('; ')
    return {
      ok: true,
      text: `${scen[0].toUpperCase() + scen.slice(1)} scenario (gross inflow ${f1(p.yields[scen])} Mm³/yr before rainfall adjustment): by ${r.year}, cumulative net storage loss ${f1(r.cumNetLossMm3)} Mm³ and live storage ${f1(r.liveMm3)} Mm³ (${f1(r.liveLostPct)}% lost). Threshold years — ${firstT}. Dead storage depletion: ${formatThreshold(res.deadDepletionYear)}. ${label}`,
    }
  }

  return {
    ok: false,
    text: 'I could not interpret that question, so I will not guess. Try one of the suggested questions below.',
  }
}
