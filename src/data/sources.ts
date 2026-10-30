export interface SourceEntry {
  id: string
  name: string
  type: string
  url?: string
  status: string
  note: string
}

export const SOURCES: SourceEntry[] = [
  { id: 'S1', name: 'BBMB official publications and reservoir records', type: 'Official', status: 'To be obtained',
    note: 'Primary source for original capacity, gross/live/dead storage, inflow and operating records. No BBMB document is embedded in this MVP.' },
  { id: 'S2', name: 'Bhuvan Water Bodies Information System (NRSC/ISRO)', type: 'Official / remote sensing', url: 'https://bhuvan-wbis.nrsc.gov.in',
    status: 'Link only', note: 'Water-spread and reservoir information portal. Not queried by this app.' },
  { id: 'S3', name: 'Hydrographic / bathymetric survey reports', type: 'Survey', status: 'To be obtained',
    note: 'Required to measure capacity change directly. Enter dated results in Historical Trends → Survey observations.' },
  { id: 'S4', name: 'Published scientific studies on Pong reservoir sedimentation', type: 'Literature', status: 'To be compiled',
    note: 'Cite the exact paper, year and method for any value entered. None are embedded.' },
  { id: 'S5', name: 'Rainfall observations (e.g., IMD stations) and gridded products', type: 'Meteorological', status: 'To be imported',
    note: 'Import via CSV. The bundled rainfall is SIMULATED demonstration data.' },
  { id: 'S6', name: 'Satellite precipitation products (e.g., GPM IMERG, CHIRPS)', type: 'Remote sensing', status: 'Not integrated',
    note: 'Can be imported as CSV (catchment means) once extracted; the app performs no retrieval.' },
  { id: 'S7', name: 'Landsat, Sentinel-2, IRS LISS-III imagery', type: 'Remote sensing', status: 'Not integrated',
    note: 'NDWI water-spread is an indirect indicator of surface-water extent. It does not measure submerged sediment volume; bathymetry or a validated elevation–capacity curve is required.' },
  { id: 'S8', name: 'Brune, G.M. (1953), Trap efficiency of reservoirs, Trans. AGU 34(3)', type: 'Literature', status: 'Used (approximate digitisation)',
    note: 'Curve points in src/engine/brune.ts are approximate and configurable.' },
]

export interface ProvisionalInput {
  name: string
  value: string
  status: 'Assumed' | 'Published Estimate'
  note: string
}
export const PROVISIONAL_INPUTS: ProvisionalInput[] = [
  { name: 'Original live storage', value: '7.29 BCM (7,290 Mm³)', status: 'Assumed', note: 'Provisional value from the project brief; pending verification.' },
  { name: 'Dead storage', value: '1,280 Mm³', status: 'Assumed', note: 'Placeholder; verify against BBMB records.' },
  { name: 'Mean annual inflow Q', value: '10,000 Mm³/yr', status: 'Assumed', note: 'Placeholder used only for C/I and trap efficiency.' },
  { name: 'Annual sedimentation scenarios', value: '18 / 21.5 / 25 Mm³/yr', status: 'Assumed', note: 'Illustrative 18–25 Mm³/yr range, pending source and method verification.' },
  { name: 'Initial storage-loss assumption', value: '12–14 %', status: 'Assumed', note: 'Pending a dated and verified survey. Used only by the optional calibration helper.' },
  { name: 'Dead/live sediment allocation', value: '70 % / 30 %', status: 'Assumed', note: 'Demonstration split, not a verified Pong Dam characteristic.' },
  { name: 'Model start year', value: '1974', status: 'Assumed', note: 'Placeholder for start of impoundment; verify.' },
]
