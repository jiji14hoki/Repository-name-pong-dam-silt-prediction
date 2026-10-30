import type { RainfallRecord } from '../engine/types'

/**
 * DEMONSTRATION RAINFALL — SIMULATED, NOT OBSERVED.
 * Generated deterministically from a seeded pseudo-random sequence around an assumed
 * monsoon-shaped monthly climatology. It is NOT IMD, BBMB or satellite data and must be
 * replaced (Rainfall page → Import CSV) with verified records. data_status = 'Simulated'.
 */
const CLIM = [75, 80, 70, 45, 50, 130, 420, 400, 190, 40, 15, 40] // assumed mm/month shape
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function buildDemoRainfall(): RainfallRecord[] {
  const out: RainfallRecord[] = []
  const rand = rng(20240607)
  for (let year = 2000; year <= 2024; year++) {
    const wet = 0.75 + rand() * 0.55
    for (let m = 1; m <= 12; m++) {
      // deliberately leave a few months missing so gap detection is demonstrable
      if ((year === 2011 && m === 8) || (year === 2016 && (m === 3 || m === 4))) continue
      out.push({
        id: `DEMO-${year}-${m}`,
        year,
        month: m,
        rainfall_mm: Math.round(CLIM[m - 1] * wet * (0.7 + rand() * 0.6) * 10) / 10,
        station_name: 'Demo Station A (simulated)',
        latitude: 32.0,
        longitude: 76.0,
        source: 'SIMULATED demo generator',
        data_status: 'Simulated',
      })
    }
  }
  return out
}
