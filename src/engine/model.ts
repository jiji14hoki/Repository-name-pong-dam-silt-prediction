import { trapEfficiency } from './brune'
import type {
  DesiltingEvent,
  ModelInput,
  ModelParams,
  RegressionFit,
  ScenarioKey,
  ScenarioResult,
  SedimentObservation,
  ThresholdResult,
  YearRow,
} from './types'

export const THRESHOLDS_PCT = [80, 70, 60]
export const SCENARIOS: ScenarioKey[] = ['optimistic', 'realistic', 'pessimistic']

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Compaction volume multiplier f (compacted volume / deposited volume). */
export function compactionFactor(p: ModelParams): number {
  const c = p.compaction
  if (c.mode === 'none') return 1
  if (c.mode === 'factor') return c.factor > 0 && c.factor <= 1 ? c.factor : 1
  // density mode: same sediment MASS, volume scales with 1/density
  if (c.compactedDensity > 0 && c.initialDensity > 0) {
    return Math.min(1, c.initialDensity / c.compactedDensity)
  }
  return 1
}

/** Spread each included event's measured volume evenly over its months and bin by calendar year. */
export function removalSchedule(events: DesiltingEvent[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const e of events) {
    if (!e.includeInModel || e.volumeMm3 == null || !(e.volumeMm3 > 0)) continue
    const sm = e.startMonth >= 1 && e.startMonth <= 12 ? e.startMonth : 1
    const startIdx = e.startYear * 12 + (sm - 1)
    let endIdx = startIdx
    if (e.endYear != null) {
      const em = e.endMonth != null && e.endMonth >= 1 && e.endMonth <= 12 ? e.endMonth : 12
      endIdx = Math.max(startIdx, e.endYear * 12 + (em - 1))
    }
    const n = endIdx - startIdx + 1
    const perMonth = e.volumeMm3 / n
    for (let i = startIdx; i <= endIdx; i++) {
      const y = Math.floor(i / 12)
      out[y] = (out[y] ?? 0) + perMonth
    }
  }
  return out
}

/** Log-log OLS: ln(S) = a + b ln(R). Returns null when data are insufficient. */
export function fitRegression(
  annualRain: Record<number, number>,
  obs: SedimentObservation[],
  minPoints: number,
): RegressionFit | null {
  const pairs: { y: number; x: number; s: number }[] = []
  for (const o of obs) {
    const r = annualRain[o.year]
    if (r != null && r > 0 && o.annualSedimentInflowMm3 != null && o.annualSedimentInflowMm3 > 0)
      pairs.push({ y: o.year, x: Math.log(r), s: Math.log(o.annualSedimentInflowMm3) })
  }
  if (pairs.length < Math.max(3, minPoints)) return null
  const n = pairs.length
  const mx = pairs.reduce((a, p) => a + p.x, 0) / n
  const my = pairs.reduce((a, p) => a + p.s, 0) / n
  let sxx = 0, sxy = 0, syy = 0
  for (const p of pairs) {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.s - my)
    syy += (p.s - my) ** 2
  }
  if (sxx <= 0) return null
  const b = sxy / sxx
  const a = my - b * mx
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0
  return {
    a, b, r2, n,
    periodStart: Math.min(...pairs.map((p) => p.y)),
    periodEnd: Math.max(...pairs.map((p) => p.y)),
  }
}

export function meanAnnualRain(annualRain: Record<number, number>): number | null {
  const v = Object.values(annualRain)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/* ------------------------------------------------------------------ */
/* Core annual time-step simulation                                    */
/* ------------------------------------------------------------------ */

export function runScenario(input: ModelInput, scenario: ScenarioKey): ScenarioResult {
  const { params: p, events, annualRain, sedimentObs } = input
  const warnings: string[] = []

  // Allocation validation
  let aDead = p.allocation.dead
  let aLive = p.allocation.live
  const sum = aDead + aLive
  if (!(sum > 0) || aDead < 0 || aLive < 0) {
    warnings.push('Invalid sediment allocation; reverted to 70% dead / 30% live.')
    aDead = 0.7
    aLive = 0.3
  } else if (Math.abs(sum - 1) > 1e-9) {
    warnings.push(`Allocation fractions summed to ${sum.toFixed(3)}; normalised to 1.`)
    aDead /= sum
    aLive /= sum
  }
  if (!(p.originalLiveMm3 > 0) || p.originalDeadMm3 < 0 || !(p.annualInflowMm3 > 0)) {
    warnings.push('Original live storage and annual inflow must be positive; check parameters.')
  }

  const f = compactionFactor(p)
  const removal = removalSchedule(events)
  const regFit = p.yieldMethod === 'regression' ? fitRegression(annualRain, sedimentObs, p.regression.minPoints) : null
  if (p.yieldMethod === 'regression' && !regFit)
    warnings.push(
      `Regression unavailable: fewer than ${Math.max(3, p.regression.minPoints)} paired annual rainfall/sediment observations. Fixed yield used instead.`,
    )
  const autoRef = meanAnnualRain(annualRain)
  const refRain = p.rain.refRainfallMm ?? autoRef
  if (p.yieldMethod === 'rainfall' && !(refRain != null && refRain > 0))
    warnings.push('Rainfall-adjusted yield needs a valid positive reference rainfall (R_ref). Fixed yield used instead.')

  let live = p.originalLiveMm3
  let dead = p.originalDeadMm3
  let cumNet = 0, cumGross = 0, cumTrap = 0, cumComp = 0, cumRem = 0
  let deadDepletionYear: number | null = null
  let liveExhaustedYear: number | null = null
  let stoppedYear: number | null = null
  const rows: YearRow[] = []
  const thresholds: ThresholdResult[] = THRESHOLDS_PCT.map((pct) => ({ pct, year: null }))

  for (let y = p.startYear; y <= p.endYear; y++) {
    const flags: string[] = []
    const forecast = y >= p.forecastStartYear
    const base = p.yields[scenario]

    // ---- Step 1: annual sediment inflow S_i(t) ----
    let R: number | null = annualRain[y] ?? null
    let rainSource: YearRow['rainfallSource'] = R != null ? 'observed' : 'missing'
    if (R == null && forecast && refRain != null && refRain > 0) {
      R = refRain * (1 + p.rain.futureChangePct / 100)
      rainSource = 'forecast-assumption'
    }
    let Si = base
    let methodUsed: YearRow['yieldMethodUsed'] = 'fixed'
    if (p.yieldMethod === 'rainfall') {
      if (!(refRain != null && refRain > 0)) {
        methodUsed = 'fixed-fallback'
      } else if (R == null || !(R > 0)) {
        methodUsed = 'fixed-fallback'
        flags.push('Rainfall missing: fixed yield used for this year')
      } else {
        Si = base * Math.pow(R / refRain, p.rain.beta)
        methodUsed = 'rainfall'
      }
    } else if (p.yieldMethod === 'regression') {
      if (!regFit) {
        methodUsed = 'fixed-fallback'
      } else if (R == null || !(R > 0)) {
        methodUsed = 'fixed-fallback'
        flags.push('Rainfall missing: fixed yield used for this year')
      } else {
        const scale = p.yields.realistic > 0 ? base / p.yields.realistic : 1
        Si = scale * Math.exp(regFit.a) * Math.pow(R, regFit.b)
        methodUsed = 'regression'
      }
    }
    if (!(Si >= 0) || !isFinite(Si)) {
      Si = 0
      flags.push('Invalid sediment inflow; set to 0')
    }

    // ---- Step 2: capacity-to-inflow ratio (both in m³) ----
    const C_m3 = (live + dead) * 1e6
    const Q_m3 = p.annualInflowMm3 * 1e6
    const ci = Q_m3 > 0 ? C_m3 / Q_m3 : 0

    // ---- Step 3 & 4: trap efficiency and trapped sediment ----
    const eta = trapEfficiency(ci, p.trap)
    const trapped = Si * eta
    const trappedMass = trapped * p.compaction.initialDensity // Mm³ × t/m³ = Mt

    // ---- Step 5: compaction ----
    const compacted = trapped * f

    // ---- Step 6: net accumulation with removal ----
    const requested = removal[y] ?? 0
    const maxRemovable = Math.max(0, cumNet + compacted)
    const removed = Math.min(requested, maxRemovable)
    if (requested > removed + 1e-12)
      flags.push(`Removal capped: requested ${requested.toFixed(2)} Mm³ exceeds removable deposit (${removed.toFixed(2)} Mm³)`)
    const net = compacted - removed

    // ---- Step 7: update live and dead storage ----
    if (net >= 0) {
      const deadShare = aDead * net
      let liveShare = aLive * net
      const deadLoss = Math.min(deadShare, dead)
      const overflow = deadShare - deadLoss
      dead -= deadLoss
      if (overflow > 1e-12) {
        liveShare += overflow
        flags.push('Dead storage exhausted: overflow sediment allocated to live storage')
      }
      live -= liveShare
    } else {
      const g = -net
      const deadGain = Math.min(aDead * g, p.originalDeadMm3 - dead)
      const liveGain = Math.min(g - deadGain, p.originalLiveMm3 - live)
      dead += deadGain
      live += liveGain
    }
    if (dead <= 1e-9 && deadDepletionYear == null) {
      deadDepletionYear = y
      dead = Math.max(0, dead)
      flags.push('Dead storage depleted (modelled)')
    }
    let exhausted = false
    if (live <= 0) {
      live = 0
      exhausted = true
      liveExhaustedYear = y
      flags.push('Live storage exhausted: simulation stopped')
    }

    cumGross += Si
    cumTrap += trapped
    cumComp += compacted
    cumRem += removed
    cumNet += net

    const lostPct = p.originalLiveMm3 > 0 ? ((p.originalLiveMm3 - live) / p.originalLiveMm3) * 100 : 0
    rows.push({
      year: y,
      kind: forecast ? 'forecast' : 'modelled-historical',
      rainfallMm: R,
      rainfallSource: rainSource,
      yieldMethodUsed: methodUsed,
      grossInflowMm3: Si,
      capacityInflowRatio: ci,
      trapEfficiency: eta,
      trappedMm3: trapped,
      trappedMassMt: trappedMass,
      compactedMm3: compacted,
      removalRequestedMm3: requested,
      removedMm3: removed,
      netMm3: net,
      cumGrossInflowMm3: cumGross,
      cumTrappedMm3: cumTrap,
      cumCompactedMm3: cumComp,
      cumRemovedMm3: cumRem,
      cumNetLossMm3: cumNet,
      liveMm3: live,
      deadMm3: dead,
      liveLostPct: lostPct,
      flags,
    })

    // Thresholds: first year at or below pct of ORIGINAL live storage
    for (const t of thresholds) {
      if (t.year == null && live <= (t.pct / 100) * p.originalLiveMm3) t.year = y
    }
    if (exhausted) {
      stoppedYear = y
      break
    }
  }

  return {
    scenario,
    rows,
    thresholds,
    deadDepletionYear,
    liveExhaustedYear,
    stoppedYear,
    warnings,
    regression: regFit,
    refRainfallMm: refRain,
    compactionFactorUsed: f,
  }
}

export type AllScenarios = Record<ScenarioKey, ScenarioResult>

export function runAll(input: ModelInput): AllScenarios {
  return {
    optimistic: runScenario(input, 'optimistic'),
    realistic: runScenario(input, 'realistic'),
    pessimistic: runScenario(input, 'pessimistic'),
  }
}

export function rowAt(res: ScenarioResult, year: number): YearRow | null {
  return res.rows.find((r) => r.year === year) ?? null
}

/**
 * Calibrate the realistic scenario's S_ref so that the live-storage loss at
 * `referenceYear` equals `targetLossPct`. Bisection (loss is monotonic in yield).
 * Returns null if the target cannot be bracketed. This is a curve-matching aid,
 * not a validation: the target must come from a dated, verified survey.
 */
export function calibrateYield(input: ModelInput, targetLossPct: number, referenceYear: number): number | null {
  const lossFor = (y: number) => {
    const inp: ModelInput = {
      ...input,
      params: { ...input.params, yieldMethod: 'fixed', yields: { ...input.params.yields, realistic: y } },
    }
    const row = rowAt(runScenario(inp, 'realistic'), referenceYear)
    // If live storage was exhausted before the reference year the loss is effectively 100%.
    return row ? row.liveLostPct : 100
  }
  let lo = 0
  let hi = 2000
  if (!(lossFor(hi) >= targetLossPct)) return null
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (lossFor(mid) < targetLossPct) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function formatThreshold(year: number | null): string {
  return year == null ? 'Not reached within forecast horizon' : String(year)
}
