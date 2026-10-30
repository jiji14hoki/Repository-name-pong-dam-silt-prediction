import type { BruneCurveKey } from './types'

/**
 * Brune (1953) trap efficiency curves, tabulated.
 *
 * Reference: Brune, G.M. (1953). "Trap efficiency of reservoirs."
 * Transactions, American Geophysical Union, 34(3), 407–418.
 *
 * IMPORTANT: The (C/I, trap efficiency %) points below are an APPROXIMATE,
 * hand-digitised representation of the published median and envelope curves.
 * They are NOT an official data table. They are configurable: replace them with
 * values digitised from the original figure (or another documented method)
 * before relying on any result. No single curve represents every reservoir.
 *   - median: Brune median curve (normal ponded reservoirs)
 *   - upper : upper envelope (coarse sediment, high trap efficiency)
 *   - lower : lower envelope (fine/colloidal sediment, lower trap efficiency)
 */
export interface BruneCurve {
  key: BruneCurveKey
  label: string
  source: string
  /** [C/I ratio (dimensionless), trap efficiency (%)], ascending in C/I. */
  points: [number, number][]
}

export const BRUNE_CURVES: Record<Exclude<BruneCurveKey, 'fixed'>, BruneCurve> = {
  median: {
    key: 'median',
    label: 'Brune median curve (approximate digitisation)',
    source: 'Brune (1953), Trans. AGU 34(3). Points approximate; verify against original.',
    points: [
      [0.001, 10], [0.003, 30], [0.01, 55], [0.03, 77], [0.1, 90],
      [0.3, 95], [1, 97], [3, 98], [10, 99],
    ],
  },
  upper: {
    key: 'upper',
    label: 'Brune upper envelope (approximate digitisation)',
    source: 'Brune (1953). Coarse-sediment envelope. Points approximate.',
    points: [
      [0.001, 35], [0.003, 58], [0.01, 75], [0.03, 88], [0.1, 95],
      [0.3, 97.5], [1, 98.5], [3, 99], [10, 99.5],
    ],
  },
  lower: {
    key: 'lower',
    label: 'Brune lower envelope (approximate digitisation)',
    source: 'Brune (1953). Fine-sediment envelope. Points approximate.',
    points: [
      [0.001, 3], [0.003, 10], [0.01, 25], [0.03, 45], [0.1, 70],
      [0.3, 82], [1, 90], [3, 94], [10, 96],
    ],
  },
}

/** Piecewise-linear interpolation in log10(C/I); clamped at the table ends. Returns a fraction 0–1. */
export function interpolateCurve(points: [number, number][], ci: number): number {
  if (!(ci > 0) || !isFinite(ci)) return 0
  const pts = points
  if (ci <= pts[0][0]) return pts[0][1] / 100
  if (ci >= pts[pts.length - 1][0]) return pts[pts.length - 1][1] / 100
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    if (ci >= x0 && ci <= x1) {
      const t = (Math.log10(ci) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))
      return (y0 + t * (y1 - y0)) / 100
    }
  }
  return pts[pts.length - 1][1] / 100
}

export function trapEfficiency(
  ci: number,
  trap: { curve: BruneCurveKey; fixedEta: number },
): number {
  if (trap.curve === 'fixed') return Math.min(1, Math.max(0, trap.fixedEta))
  return interpolateCurve(BRUNE_CURVES[trap.curve].points, ci)
}
