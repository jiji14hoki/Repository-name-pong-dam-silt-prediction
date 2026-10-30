/* Engine self-test. Run with: npm test  (uses tsx, no UI involved) */
import { DEFAULT_PARAMS } from '../data/defaults'
import { interpolateCurve, BRUNE_CURVES } from './brune'
import { calibrateYield, fitRegression, removalSchedule, runAll, runScenario } from './model'
import { answerQuery } from './query'
import { annualRainfall } from './rainfall'
import { BENCHMARKS, DEFAULT_PROV, effectiveProv, PARAM_META } from '../data/provenance'
import { detectKind, parseUpload } from '../utils/ingest'
import type { DesiltingEvent, ModelInput, RainfallRecord, SedimentObservation } from './types'

let failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const base: ModelInput = { params: DEFAULT_PARAMS, events: [], annualRain: {}, sedimentObs: [] }

// 1. Brune interpolation monotonic and bounded
const pts = BRUNE_CURVES.median.points
let mono = true
let prev = 0
for (let ci = 0.0005; ci < 20; ci *= 1.2) {
  const e = interpolateCurve(pts, ci)
  if (e < prev - 1e-12 || e < 0 || e > 1) mono = false
  prev = e
}
check('Brune median curve is monotonic and within [0,1]', mono)
check('Brune hits tabulated point (C/I=0.1 → 90%)', near(interpolateCurve(pts, 0.1), 0.9))

// 2. Mass balance: live + dead = original − cumulative net loss
const all = runAll(base)
for (const s of ['optimistic', 'realistic', 'pessimistic'] as const) {
  const rows = all[s].rows
  const ok = rows.every((r) => near(r.liveMm3 + r.deadMm3, DEFAULT_PARAMS.originalLiveMm3 + DEFAULT_PARAMS.originalDeadMm3 - r.cumNetLossMm3, 1e-6))
  check(`${s}: storage identity holds every year`, ok)
  const ok2 = rows.every((r) => near(r.cumCompactedMm3 - r.cumRemovedMm3, r.cumNetLossMm3, 1e-6))
  check(`${s}: cumulative compacted − removed = net loss`, ok2)
}
check('scenario ordering: pessimistic loses more than optimistic by 2070',
  all.pessimistic.rows.at(-1)!.liveLostPct > all.optimistic.rows.at(-1)!.liveLostPct)

// 3. Allocation 70/30 applies to net loss while dead storage remains
const r0 = all.realistic.rows[0]
check('first-year live loss = 30% of net', near(DEFAULT_PARAMS.originalLiveMm3 - r0.liveMm3, 0.3 * r0.netMm3, 1e-9))

// 4. Removal schedule + cap
const ev: DesiltingEvent = {
  id: 'T1', startYear: 2030, startMonth: 11, endYear: 2031, endMonth: 2, operationDate: '', volumeMm3: 4,
  rate: '', method: 'Dredging', source: 'test', verification: 'Hypothetical', notes: '', includeInModel: true,
}
const sched = removalSchedule([ev])
check('removal split across years by month (2 months each)', near(sched[2030], 2) && near(sched[2031], 2))
const huge: DesiltingEvent = { ...ev, id: 'T2', startYear: 1975, endYear: null, endMonth: null, volumeMm3: 1e6 }
const capped = runScenario({ ...base, events: [huge] }, 'realistic')
check('removal is capped; cumulative net loss never negative', capped.rows.every((r) => r.cumNetLossMm3 >= -1e-9))
check('cap condition is flagged', capped.rows.some((r) => r.flags.some((f) => f.includes('Removal capped'))))
const noVol: DesiltingEvent = { ...ev, id: 'T3', volumeMm3: null }
check('event without volume removes nothing', Object.keys(removalSchedule([noVol])).length === 0)
const excluded: DesiltingEvent = { ...ev, includeInModel: false }
check('excluded events are not applied', Object.keys(removalSchedule([excluded])).length === 0)

// 5. Desilting improves storage
const withEv = runScenario({ ...base, events: [{ ...ev, endYear: null, endMonth: null, volumeMm3: 50 }] }, 'realistic')
check('desilting raises later live storage', withEv.rows.at(-1)!.liveMm3 > all.realistic.rows.at(-1)!.liveMm3)

// 6. Thresholds are computed, and "not reached" is null
const stress: ModelInput = { ...base, params: { ...DEFAULT_PARAMS, allocation: { dead: 0, live: 1 }, yields: { optimistic: 50, realistic: 100, pessimistic: 150 } } }
const st = runScenario(stress, 'pessimistic')
check('thresholds found under stress and ordered 80 ≤ 70 ≤ 60', st.thresholds.every((t) => t.year != null) &&
  st.thresholds[0].year! <= st.thresholds[1].year! && st.thresholds[1].year! <= st.thresholds[2].year!)
check('default scenario reports null (not reached) rather than extrapolating',
  all.optimistic.thresholds.some((t) => t.year === null))

// 7. Dead storage depletion reported without terminating earlier thresholds
const deadHeavy: ModelInput = { ...base, params: { ...DEFAULT_PARAMS, originalDeadMm3: 100, yields: { optimistic: 30, realistic: 40, pessimistic: 60 } } }
const dh = runScenario(deadHeavy, 'pessimistic')
check('dead-storage depletion year reported', dh.deadDepletionYear != null, String(dh.deadDepletionYear))
check('simulation continues after dead storage depleted', dh.rows.at(-1)!.year > (dh.deadDepletionYear ?? 0))
check('storage identity still holds after dead depletion',
  dh.rows.every((r) => near(r.liveMm3 + r.deadMm3, 7290 + 100 - r.cumNetLossMm3, 1e-6) || r.liveMm3 === 0))

// 8. Rainfall adjustment
const rain: Record<number, number> = {}
for (let y = 1980; y <= 2025; y++) rain[y] = 1500
rain[2000] = 3000
const rIn: ModelInput = { ...base, annualRain: rain, params: { ...DEFAULT_PARAMS, yieldMethod: 'rainfall', rain: { ...DEFAULT_PARAMS.rain, refRainfallMm: 1500, beta: 1 } } }
const rr = runScenario(rIn, 'realistic')
check('S_i = S_ref (R/R_ref)^β (R doubled → inflow doubled)', near(rr.rows.find((r) => r.year === 2000)!.grossInflowMm3, 2 * DEFAULT_PARAMS.yields.realistic, 1e-9))
const missingRain = rr.rows.find((r) => r.year === 1976)!
check('missing historical rainfall falls back to fixed yield and is flagged',
  near(missingRain.grossInflowMm3, DEFAULT_PARAMS.yields.realistic) && missingRain.flags.some((f) => f.includes('Rainfall missing')))
const badRef: ModelInput = { ...rIn, params: { ...rIn.params, rain: { ...rIn.params.rain, refRainfallMm: -5 } } }
check('invalid R_ref handled explicitly', runScenario(badRef, 'realistic').rows.every((r) => near(r.grossInflowMm3, DEFAULT_PARAMS.yields.realistic)))
const fut: ModelInput = { ...rIn, params: { ...rIn.params, rain: { ...rIn.params.rain, futureChangePct: 20 } } }
check('future rainfall change raises forecast inflow', runScenario(fut, 'realistic').rows.find((r) => r.year === 2040)!.grossInflowMm3 > DEFAULT_PARAMS.yields.realistic)

// 9. Regression requires enough data
const obs: SedimentObservation[] = []
for (let y = 1990; y < 2000; y++) obs.push({ id: String(y), year: y, annualSedimentInflowMm3: 10 * Math.pow((1000 + 50 * (y - 1990)) / 1000, 1.5), source: 't', status: 'Observed', note: '' })
const rainObs: Record<number, number> = {}
for (let y = 1990; y < 2000; y++) rainObs[y] = 1000 + 50 * (y - 1990)
const fit = fitRegression(rainObs, obs, 8)
check('log-log regression recovers exponent 1.5', !!fit && near(fit.b, 1.5, 1e-6) && near(fit.r2, 1, 1e-9))
check('regression refuses insufficient data', fitRegression(rainObs, obs.slice(0, 3), 8) === null)

// 10. Rainfall aggregation never sums incomplete years
const recs: RainfallRecord[] = []
for (let m = 1; m <= 12; m++) recs.push({ id: 'a' + m, year: 2001, month: m, rainfall_mm: 100, station_name: 'S', latitude: null, longitude: null, source: 'x', data_status: 'Simulated' })
for (let m = 1; m <= 11; m++) recs.push({ id: 'b' + m, year: 2002, month: m, rainfall_mm: 100, station_name: 'S', latitude: null, longitude: null, source: 'x', data_status: 'Simulated' })
const ar = annualRainfall(recs)
check('complete year summed (1200 mm)', near(ar.values[2001], 1200))
check('incomplete year excluded and reported missing', ar.values[2002] === undefined && ar.missing.some((m) => m.year === 2002 && m.missingMonths.includes(12)))

// 11. Calibration
const cal = calibrateYield(base, 13, 2020)
if (cal != null) {
  const chk = runScenario({ ...base, params: { ...DEFAULT_PARAMS, yields: { ...DEFAULT_PARAMS.yields, realistic: cal } } }, 'realistic')
  check('calibration reproduces target loss at reference year', near(chk.rows.find((r) => r.year === 2020)!.liveLostPct, 13, 1e-3), `S_ref=${cal.toFixed(1)}`)
} else check('calibration returned a value', false)

// 12. Query engine
const q1 = answerQuery('What is the estimated silt accumulation in 2040?', base, 'realistic')
check('query: accumulation answer', q1.ok && q1.text.includes('2040'))
const q2 = answerQuery('When will live storage fall below 70%?', base, 'realistic')
check('query: threshold answer', q2.ok && q2.text.includes('70%'))
const q3 = answerQuery('What is the effect of desilting 2 Mm³ in 2035?', base, 'realistic')
check('query: desilting answer', q3.ok && q3.text.includes('2035'), q3.text.slice(0, 80))
const q4 = answerQuery('How does increased rainfall affect the forecast?', { ...base, annualRain: rain }, 'realistic')
check('query: rainfall answer', q4.ok)
const q5 = answerQuery('What happens under the pessimistic scenario?', base, 'realistic')
check('query: scenario answer', q5.ok && q5.text.includes('Pessimistic'))
check('query: gibberish is not answered', !answerQuery('banana smoothie recipe', base, 'realistic').ok)

// 13. Provenance: status never upgrades without a source; edits downgrade
check('assumed inputs stay Assumed (annual inflow has no source)', effectiveProv(DEFAULT_PROV.annual_inflow_mm3, 10000).status === 'Assumed')
check('cited value keeps Published Estimate', effectiveProv(DEFAULT_PROV.original_live_mm3, 7290).status === 'Published Estimate')
check('editing a cited value downgrades it to Assumed', effectiveProv(DEFAULT_PROV.original_live_mm3, 7000).status === 'Assumed' && effectiveProv(DEFAULT_PROV.original_live_mm3, 7000).modified)
check('default yields equal the cited values', near(DEFAULT_PARAMS.yields.optimistic, 18.08) && near(DEFAULT_PARAMS.yields.pessimistic, 24.4))

// 14. Benchmark: published live loss 1974-2009 is reproduced only when yields are treated as live-storage loss
const b = BENCHMARKS[0]
const loss = (dead: number) => { const r = runScenario({ ...base, params: { ...DEFAULT_PARAMS, allocation: { dead, live: 1 - dead } } }, 'optimistic'); return DEFAULT_PARAMS.originalLiveMm3 - r.rows.find((x) => x.year === b.endYear)!.liveMm3 }
check('100% live allocation reproduces Shukla 2017 within 5%', Math.abs(loss(0) - b.liveLossMm3) / b.liveLossMm3 < 0.05, `${loss(0).toFixed(0)} vs ${b.liveLossMm3}`)
check('70/30 allocation does NOT reproduce it (documented mismatch)', Math.abs(loss(0.7) - b.liveLossMm3) / b.liveLossMm3 > 0.5, `${loss(0.7).toFixed(0)} vs ${b.liveLossMm3}`)

// 15. Upload parser
check('detects rainfall file', detectKind(['year', 'month', 'rainfall_mm']) === 'rainfall')
check('detects parameters file', detectKind(['parameter', 'value', 'source']) === 'parameters')
const pu = parseUpload('parameters_x.csv', 'parameter,value,unit,source,source_url,status,evidence,note\noriginal_live_bcm,7.29,BCM,Doc A,https://x.y,Published Estimate,primary,\nannual_inflow_mm3,9000,Mm3,,,Observed,primary,\nbogus,1,,,,,,\nallocation_dead,1.5,,Doc,,,,')[0]
check('BCM converted to Mm3', pu.params.find((u) => u.key === 'original_live_mm3')?.value === 7290)
check('parameter without source is forced to Assumed', pu.params.find((u) => u.key === 'annual_inflow_mm3')?.status === 'Assumed' && pu.warnings.some((w) => w.includes('no source')))
check('unknown parameter skipped with warning, invalid range rejected', pu.warnings.some((w) => w.includes('bogus')) && pu.errors.some((e) => e.includes('allocation_dead')))
const pj = parseUpload('d.json', JSON.stringify({ rainfall: [{ year: 2001, month: 0, rainfall_mm: 1500, station_name: 'S', source: 'Doc', data_status: 'Observed' }], parameters: [{ parameter: 'start_year', value: 1974, source: 'Doc' }] }))
check('JSON upload parsed into two kinds', pj.length === 2 && pj.some((x) => x.kind === 'rainfall' && x.rows === 1) && pj.some((x) => x.kind === 'parameters' && x.rows === 1))
const nr = parseUpload('rainfall_z.csv', 'year,month,rainfall_mm,station_name\n2001,0,1500,S')[0]
check('rainfall without data_status is labelled Assumed', nr.rainfall[0]?.data_status === 'Assumed')
check('PARAM_META setters apply', PARAM_META.allocation_dead.set(DEFAULT_PARAMS, 0.2).allocation.live === 0.8)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
