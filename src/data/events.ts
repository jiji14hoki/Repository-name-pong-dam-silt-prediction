import type { DesiltingEvent } from '../engine/types'

/**
 * No dredging or desilting is assumed to have occurred at Pong Dam.
 * The single entry below is a clearly marked SAMPLE (not applied to the model by default).
 * Replace with verified BBMB records; set includeInModel = true only for verified volumes.
 */
export const SAMPLE_EVENTS: DesiltingEvent[] = [
  {
    id: 'SAMPLE-1',
    startYear: 2035,
    startMonth: 5,
    endYear: 2035,
    endMonth: 9,
    operationDate: '2035-05 to 2035-09 (hypothetical)',
    volumeMm3: 2,
    rate: 'n/a',
    method: 'Desilting',
    source: 'SAMPLE — illustrative placeholder, not a BBMB record',
    verification: 'Sample',
    notes: 'Excluded from the model by default. Tick "Apply in model" to test the effect.',
    includeInModel: false,
  },
]
