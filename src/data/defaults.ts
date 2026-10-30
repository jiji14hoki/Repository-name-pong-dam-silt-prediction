import type { ModelParams } from '../engine/types'

export const DATASET_VERSION = 'demo-0.2.0'

/**
 * DEFAULT MODEL PARAMETERS — ALL PROVISIONAL.
 * Every value below is an input requiring verification; none is a verified Pong Dam measurement.
 */
export const DEFAULT_PARAMS: ModelParams = {
  startYear: 1974, // PLACEHOLDER: assumed start of reservoir operation (verify with BBMB)
  endYear: 2070,
  forecastStartYear: 2026,

  originalLiveMm3: 7290, // 7.29 BCM — provisional, pending verification
  originalDeadMm3: 1280, // ASSUMED placeholder (gross − live ≈ 8.57 − 7.29 BCM); verify
  annualInflowMm3: 10000, // ASSUMED placeholder mean annual inflow (10 BCM/yr); verify

  yieldMethod: 'fixed',
  yields: {
    optimistic: 18.08, // Shukla et al. 2017 (live-storage loss rate, 1974–2009) — see src/data/provenance.ts
    realistic: 21.24, // ASSUMED midpoint of the published range
    pessimistic: 24.4, // upper end quoted by Sarda & Kumar 2025 (from Malik & Rai 2019)
  },

  rain: { refRainfallMm: null, beta: 1.0, futureChangePct: 0, station: 'all' },
  regression: { minPoints: 8 },

  trap: { curve: 'median', fixedEta: 0.95 },
  compaction: { mode: 'none', factor: 0.9, initialDensity: 1.0, compactedDensity: 1.3 },
  allocation: { dead: 0.7, live: 0.3 }, // ASSUMED demonstration split, not a Pong Dam characteristic

  calibration: { targetLossPct: 13, referenceYear: 2020 }, // 12–14% loss assumption, undated & unverified
}
