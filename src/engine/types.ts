/**
 * Shared types for the PongSilt Predict engine.
 * UNIT CONVENTION: all volumes inside the engine are in million cubic metres (Mm³).
 * 1 BCM (billion m³) = 1,000 Mm³. Rainfall is in mm. Years are calendar years.
 */

export type DataStatus =
  | 'Observed'
  | 'Published Estimate'
  | 'Modelled'
  | 'Assumed'
  | 'Simulated'
  | 'Missing'

export type ScenarioKey = 'optimistic' | 'realistic' | 'pessimistic'
export type YieldMethod = 'fixed' | 'rainfall' | 'regression'
export type BruneCurveKey = 'median' | 'upper' | 'lower' | 'fixed'
export type CompactionMode = 'none' | 'factor' | 'density'

export interface RainfallRecord {
  id: string
  year: number
  /** 1–12 for monthly totals, 0 for an annual total row. */
  month: number
  rainfall_mm: number | null
  station_name: string
  latitude: number | null
  longitude: number | null
  source: string
  data_status: DataStatus
}

export type EventMethod = 'Dredging' | 'Desilting' | 'Hydraulic flushing' | 'Other'
export type EventVerification = 'Verified' | 'Unverified' | 'Sample' | 'Hypothetical'

export interface DesiltingEvent {
  id: string
  startYear: number
  startMonth: number
  endYear: number | null
  endMonth: number | null
  /** Free text or ISO date of the operation. */
  operationDate: string
  /** Measured volume removed (Mm³). null = date known, volume NOT recorded (never invented). */
  volumeMm3: number | null
  /** Removal rate or duration, free text. */
  rate: string
  method: EventMethod
  source: string
  verification: EventVerification
  notes: string
  /** If false the event is shown on charts but not subtracted in the model. */
  includeInModel: boolean
}

/** User-entered or published reservoir-survey observations. Empty by default (no invented data). */
export interface CapacityObservation {
  id: string
  year: number
  liveStorageMm3: number | null
  cumulativeSiltMm3: number | null
  source: string
  status: DataStatus
  note: string
}

/** Annual sediment inflow estimates (Mm³/yr) used only for the optional regression method. */
export interface SedimentObservation {
  id: string
  year: number
  annualSedimentInflowMm3: number | null
  source: string
  status: DataStatus
  note: string
}

export interface ModelParams {
  startYear: number
  endYear: number
  /** Years >= this are labelled "forecast" in charts. */
  forecastStartYear: number

  originalLiveMm3: number
  originalDeadMm3: number
  /** Mean annual water inflow Q (Mm³/yr). Assumed placeholder. */
  annualInflowMm3: number

  yieldMethod: YieldMethod
  /** Gross annual sediment inflow S_ref per scenario (Mm³/yr). */
  yields: Record<ScenarioKey, number>

  rain: {
    /** R_ref (mm/yr). null = auto (mean of available annual rainfall). */
    refRainfallMm: number | null
    beta: number
    /** Rainfall change applied to forecast years that have no observation (%). */
    futureChangePct: number
    /** 'all' or a station name. */
    station: string
  }
  regression: { minPoints: number }

  trap: { curve: BruneCurveKey; fixedEta: number }
  compaction: {
    mode: CompactionMode
    /** Volume multiplier (compacted volume / deposited volume), 0<f<=1. */
    factor: number
    /** Bulk density at deposition (t/m³) and after compaction (t/m³). */
    initialDensity: number
    compactedDensity: number
  }
  allocation: { dead: number; live: number }

  /** Reference storage-loss assumption used only for optional calibration. */
  calibration: { targetLossPct: number; referenceYear: number }
}

export interface RegressionFit {
  a: number
  b: number
  r2: number
  n: number
  periodStart: number
  periodEnd: number
}

export interface YearRow {
  year: number
  kind: 'modelled-historical' | 'forecast'
  rainfallMm: number | null
  rainfallSource: 'observed' | 'forecast-assumption' | 'missing'
  yieldMethodUsed: YieldMethod | 'fixed-fallback'
  /** Gross sediment inflow to the reservoir, S_i (Mm³/yr). */
  grossInflowMm3: number
  capacityInflowRatio: number
  trapEfficiency: number
  /** Sediment retained, S_trapped (Mm³/yr). */
  trappedMm3: number
  trappedMassMt: number
  /** Retained sediment after compaction (Mm³/yr). */
  compactedMm3: number
  removalRequestedMm3: number
  removedMm3: number
  /** Net annual storage loss S_net (Mm³/yr). */
  netMm3: number
  cumGrossInflowMm3: number
  cumTrappedMm3: number
  cumCompactedMm3: number
  cumRemovedMm3: number
  cumNetLossMm3: number
  liveMm3: number
  deadMm3: number
  liveLostPct: number
  flags: string[]
}

export interface ThresholdResult {
  pct: number
  year: number | null
}

export interface ScenarioResult {
  scenario: ScenarioKey
  rows: YearRow[]
  thresholds: ThresholdResult[]
  deadDepletionYear: number | null
  liveExhaustedYear: number | null
  stoppedYear: number | null
  warnings: string[]
  regression: RegressionFit | null
  refRainfallMm: number | null
  compactionFactorUsed: number
}

export interface ModelInput {
  params: ModelParams
  events: DesiltingEvent[]
  /** Annual rainfall by year (mm), already aggregated. */
  annualRain: Record<number, number>
  sedimentObs: SedimentObservation[]
}
