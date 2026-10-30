import type { DataStatus, ModelParams } from '../engine/types'

/**
 * PROVENANCE REGISTRY — every model input carries its status, evidence level and source.
 * Status is NEVER upgraded without a citation. If a user edits a value so it no longer matches the
 * cited value, it is shown as "Assumed (edited)" automatically.
 *
 * Evidence levels:  primary   = the developer opened the original document / abstract and read the figure
 *                   secondary = quoted by a secondary source (encyclopedia, a later paper) — verify the primary
 *                   none      = no source found
 */
export type Evidence = 'primary' | 'secondary' | 'none'
export type ParamKey =
  | 'original_live_mm3' | 'original_dead_mm3' | 'annual_inflow_mm3' | 'start_year'
  | 'yield_optimistic' | 'yield_realistic' | 'yield_pessimistic' | 'allocation_dead'

export interface ProvEntry {
  key: ParamKey
  status: DataStatus
  evidence: Evidence
  source: string
  url: string
  note: string
  /** The value the citation actually supports; null when there is no citation. */
  sourceValue: number | null
}

export interface ParamMeta {
  label: string
  unit: string
  digits: number
  get: (p: ModelParams) => number
  set: (p: ModelParams, v: number) => ModelParams
}

export const PARAM_META: Record<ParamKey, ParamMeta> = {
  original_live_mm3: { label: 'Original live storage', unit: 'Mm³', digits: 0, get: (p) => p.originalLiveMm3, set: (p, v) => ({ ...p, originalLiveMm3: v }) },
  original_dead_mm3: { label: 'Original dead storage', unit: 'Mm³', digits: 0, get: (p) => p.originalDeadMm3, set: (p, v) => ({ ...p, originalDeadMm3: v }) },
  annual_inflow_mm3: { label: 'Mean annual water inflow Q', unit: 'Mm³/yr', digits: 0, get: (p) => p.annualInflowMm3, set: (p, v) => ({ ...p, annualInflowMm3: v }) },
  start_year: { label: 'Model start year (commissioning)', unit: 'year', digits: 0, get: (p) => p.startYear, set: (p, v) => ({ ...p, startYear: Math.round(v) }) },
  yield_optimistic: { label: 'Sediment yield — optimistic', unit: 'Mm³/yr', digits: 2, get: (p) => p.yields.optimistic, set: (p, v) => ({ ...p, yields: { ...p.yields, optimistic: v } }) },
  yield_realistic: { label: 'Sediment yield — realistic', unit: 'Mm³/yr', digits: 2, get: (p) => p.yields.realistic, set: (p, v) => ({ ...p, yields: { ...p.yields, realistic: v } }) },
  yield_pessimistic: { label: 'Sediment yield — pessimistic', unit: 'Mm³/yr', digits: 2, get: (p) => p.yields.pessimistic, set: (p, v) => ({ ...p, yields: { ...p.yields, pessimistic: v } }) },
  allocation_dead: { label: 'Dead-storage share of sediment', unit: 'fraction', digits: 2, get: (p) => p.allocation.dead, set: (p, v) => ({ ...p, allocation: { dead: v, live: Math.round((1 - v) * 1000) / 1000 } }) },
}

const WIKI = 'https://en.wikipedia.org/wiki/Pong_Dam'
const NGT = 'https://www.greentribunal.gov.in/sites/default/files/news_updates/Reply%20by%20R-%202%20to%205%20and%207%20to%2010%20in%20OA%20No%20648%20of%202024%20%28Milkhi%20Ram%20Sharma%20Vs%20UOI%20%26%20Ors.%29.pdf'
const SHUKLA = 'https://www.sciencedirect.com/science/article/abs/pii/S235293851730112X'
const SARDA = 'https://www.frontiersin.org/journals/remote-sensing/articles/10.3389/frsen.2025.1682140/full'

export const DEFAULT_PROV: Record<ParamKey, ProvEntry> = {
  original_live_mm3: {
    key: 'original_live_mm3', status: 'Published Estimate', evidence: 'secondary', sourceValue: 7290,
    source: 'Wikipedia “Pong Dam” (7,290,000,000 m³ live; cites CWC National Register of Large Dams 2009 — primary not opened); Sarda & Kumar 2025, Front. Remote Sens. (“storage capacity of about 7,290,000,000 m³”)',
    url: WIKI,
    note: 'OPEN ISSUE: a Lok Sabha answer (24.11.2016, Annexure I) lists CWC “total capacity” 6.157 BCM at FRL 423.67 m — a different reference level/definition. No document read reconciles the two; confirm with BBMB.',
  },
  original_dead_mm3: {
    key: 'original_dead_mm3', status: 'Published Estimate', evidence: 'secondary', sourceValue: 1280,
    source: 'Derived: gross 8,570 Mm³ − live 7,290 Mm³ (both from Wikipedia “Pong Dam”, citing CWC NRLD 2009)',
    url: WIKI, note: 'Arithmetic from two published figures, not a directly published dead-storage value. Verify with BBMB.',
  },
  annual_inflow_mm3: {
    key: 'annual_inflow_mm3', status: 'Assumed', evidence: 'none', sourceValue: null,
    source: 'No published mean annual inflow found in the documents read', url: '',
    note: 'Used only for the capacity/inflow ratio and trap efficiency (low sensitivity at high C/I). Obtain from BBMB inflow records.',
  },
  start_year: {
    key: 'start_year', status: 'Published Estimate', evidence: 'primary', sourceValue: 1974,
    source: 'NGT O.A. 648/2024, reply filed 25.01.2025 (dam commissioned 1974); also Wikipedia',
    url: NGT, note: 'Commissioning year; the actual start of impoundment may differ by a year or two.',
  },
  yield_optimistic: {
    key: 'yield_optimistic', status: 'Published Estimate', evidence: 'primary', sourceValue: 18.08,
    source: 'Shukla, Jain, Kansal & Chandniha (2017), Remote Sens. Appl.: Soc. Environ. 8:148–156 — 18.08 Mm³/yr (1974–2009, IRS-P6 LISS-III, NDWI)',
    url: SHUKLA, note: 'This is a LIVE-STORAGE capacity-loss rate (632.84 Mm³ over 35 years), not total sediment inflow. See the benchmark check on Silt Forecast.',
  },
  yield_realistic: {
    key: 'yield_realistic', status: 'Assumed', evidence: 'none', sourceValue: null,
    source: 'Midpoint of the published range 18.08–24.40 Mm³/yr (modeller’s choice)', url: '',
    note: 'The midpoint is an assumption, not a published value.',
  },
  yield_pessimistic: {
    key: 'yield_pessimistic', status: 'Published Estimate', evidence: 'secondary', sourceValue: 24.4,
    source: 'Upper end of “18.08 to 24.40 Mm³/yr” quoted by Sarda & Kumar (2025) from Shukla et al. (2017) and Malik & Rai (2019) — Malik & Rai not opened',
    url: SARDA, note: 'Verify against Malik & Rai (2019).',
  },
  allocation_dead: {
    key: 'allocation_dead', status: 'Assumed', evidence: 'none', sourceValue: null,
    source: 'Demonstration split from the project brief (70 % dead / 30 % live)', url: '',
    note: 'Contradicted by the published survey benchmark if the 18–25 Mm³/yr rates are live-storage loss rates (see Silt Forecast → Benchmark check).',
  },
}

export interface EffectiveProv extends ProvEntry { modified: boolean }
export function effectiveProv(e: ProvEntry, current: number): EffectiveProv {
  if (e.sourceValue != null && Math.abs(current - e.sourceValue) > Math.max(1e-6, Math.abs(e.sourceValue) * 1e-6)) {
    return { ...e, status: 'Assumed', evidence: 'none', modified: true,
      note: `Edited: current value differs from the cited value (${e.sourceValue}). Previous source: ${e.source}` }
  }
  return { ...e, modified: false }
}

/** Published survey results the model can be checked against. */
export interface Benchmark { id: string; label: string; startYear: number; endYear: number; liveLossMm3: number; source: string; url: string; evidence: Evidence }
export const BENCHMARKS: Benchmark[] = [
  { id: 'shukla2017', label: 'Live-storage capacity loss 1974–2009 (remote sensing)', startYear: 1974, endYear: 2009, liveLossMm3: 632.84,
    source: 'Shukla et al. (2017), Remote Sens. Appl.: Soc. Environ. 8:148–156 (abstract read)', url: SHUKLA, evidence: 'primary' },
]
