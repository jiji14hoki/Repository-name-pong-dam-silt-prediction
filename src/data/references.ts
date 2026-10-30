/**
 * REFERENCE LIBRARY. "checked" tells the truth about what the developer actually did:
 *   read      = the document/page was opened and the quoted facts were read
 *   abstract  = only the abstract/landing page was read
 *   link-only = URL provided as a place to obtain data; NOT opened — verify before relying on it
 * Never write anything in `contains` that was not read.
 */
export type RefChecked = 'read' | 'abstract' | 'link-only' | 'user'
export type RefCategory = 'Official records' | 'Surveys & studies' | 'Data portals' | 'Rainfall & climate' | 'Remote sensing' | 'Secondary sources' | 'User added'
export interface ReferenceItem {
  id: string
  title: string
  publisher: string
  year: string
  kind: 'Website' | 'PDF' | 'Paper' | 'Data portal' | 'Dataset'
  category: RefCategory
  url: string
  contains: string
  checked: RefChecked
  usedFor: string
}

export const REFERENCES: ReferenceItem[] = [
  { id: 'R01', title: 'Lok Sabha Unstarred Question No. 1504 — reservoir monitoring, Annexure I (Himachal Pradesh)', publisher: 'Ministry of Water Resources, Govt. of India (Parliament)', year: '2016', kind: 'PDF', category: 'Official records',
    url: 'https://eparlib.nic.in/bitstream/123456789/689885/1/42027.pdf', checked: 'read', usedFor: 'Cross-check of capacity',
    contains: 'Pong row: FRL 423.67 m; “total capacity” 6.157 BCM; live storage held (water in the reservoir) 3.698 BCM on 10 Nov 2016, 4.570 BCM (2015), 3.41 BCM (2014), 4.777 BCM (2013). No siltation or desilting text for Pong.' },
  { id: 'R02', title: 'NGT O.A. No. 648/2024 (Milkhi Ram Sharma vs UOI) — reply by Respondents 2–5 & 7–10', publisher: 'National Green Tribunal, Principal Bench (filing for State of H.P.)', year: '2025', kind: 'PDF', category: 'Official records',
    url: 'https://www.greentribunal.gov.in/sites/default/files/news_updates/Reply%20by%20R-%202%20to%205%20and%207%20to%2010%20in%20OA%20No%20648%20of%202024%20%28Milkhi%20Ram%20Sharma%20Vs%20UOI%20%26%20Ors.%29.pdf', checked: 'read', usedFor: 'Start year, geometry',
    contains: 'Catchment 12,562 km²; surface area 24,529 ha at FSL and 6,312 ha at DSL; dam crest 435.86 m; mean depth 35.7 m; length 41.8 km; commissioned 1974. No gross/live storage, sedimentation or survey data in this filing.' },
  { id: 'R03', title: 'Assessment of sedimentation in Pong and Bhakra reservoirs in Himachal Pradesh, India, using geospatial technique', publisher: 'Shukla, Jain, Kansal & Chandniha — Remote Sensing Applications: Society and Environment 8:148–156', year: '2017', kind: 'Paper', category: 'Surveys & studies',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S235293851730112X', checked: 'abstract', usedFor: 'Sediment yield, benchmark',
    contains: 'Pong 1974–2009: live-storage capacity loss 632.84 Mm³ (18.08 Mm³/yr). Method: seven IRS-P6 LISS-III scenes, NDWI water spread, trapezoidal capacity. DOI 10.1016/j.rsase.2017.08.008.' },
  { id: 'R04', title: 'Monitoring the dual-season hydrological dynamics of the Pong reservoir in Himachal Pradesh, India', publisher: 'Sarda & Kumar — Frontiers in Remote Sensing 6', year: '2025', kind: 'Paper', category: 'Surveys & studies',
    url: 'https://www.frontiersin.org/journals/remote-sensing/articles/10.3389/frsen.2025.1682140/full', checked: 'read', usedFor: 'Storage, yield range, India-WRIS trends',
    contains: 'States storage capacity ≈7,290,000,000 m³ (not specified as original/current); quotes sedimentation 18.08–24.40 Mm³/yr (Shukla 2017; Malik & Rai 2019); India-WRIS gross-storage and siltation trends 1994–2018; Landsat MNDWI 1994–2024 (a proxy, not a capacity measurement). DOI 10.3389/frsen.2025.1682140.' },
  { id: 'R05', title: 'CWC — Compendium on Silting of Reservoirs in India (Vol. I, 2024 edition)', publisher: 'Central Water Commission, Ministry of Jal Shakti', year: '2024', kind: 'PDF', category: 'Official records',
    url: 'https://cwc.gov.in/sites/default/files/vol-i-compendium-2024.pdf', checked: 'link-only', usedFor: 'Official sedimentation surveys',
    contains: 'NOT OPENED (download failed from the developer’s environment). Expected to tabulate reservoir sedimentation surveys; look up the Pong / Maharana Pratap Sagar row and cite year, method and capacity loss.' },
  { id: 'R06', title: 'Bhakra Beas Management Board (BBMB) — official website', publisher: 'BBMB', year: '—', kind: 'Website', category: 'Official records',
    url: 'https://bbmb.gov.in', checked: 'link-only', usedFor: 'Original capacity, levels, inflow, desilting records',
    contains: 'NOT OPENED (blocked in the developer’s environment). The primary owner of Pong storage, inflow, hydrographic survey and any desilting/dredging records — request these in writing if not published.' },
  { id: 'R07', title: 'India-WRIS (Water Resources Information System)', publisher: 'Ministry of Jal Shakti / ISRO', year: '—', kind: 'Data portal', category: 'Data portals',
    url: 'https://indiawris.gov.in', checked: 'link-only', usedFor: 'Reservoir storage & siltation time series',
    contains: 'NOT OPENED. Sarda & Kumar (2025) report using India-WRIS gross storage and siltation series for 1994–2018.' },
  { id: 'R08', title: 'Bhuvan Water Bodies Information System (WBIS)', publisher: 'NRSC / ISRO', year: '—', kind: 'Data portal', category: 'Data portals',
    url: 'https://bhuvan-wbis.nrsc.gov.in', checked: 'link-only', usedFor: 'Water-spread (indirect indicator)',
    contains: 'NOT OPENED. Water-spread products are an indirect indicator of surface-water extent; they do not measure sediment volume.' },
  { id: 'R09', title: 'Central Water Commission — reservoir bulletins and National Register of Large Dams', publisher: 'Central Water Commission', year: '—', kind: 'Website', category: 'Official records',
    url: 'https://cwc.gov.in', checked: 'link-only', usedFor: 'Capacity at FRL, weekly storage',
    contains: 'NOT OPENED. Source of the “total capacity 6.157 BCM” style figures and of NRLD 2009 (cited by Wikipedia for 8,570 / 7,290 Mm³).' },
  { id: 'R10', title: 'IMD gridded rainfall and station data (Pune data supply portal)', publisher: 'India Meteorological Department', year: '—', kind: 'Data portal', category: 'Rainfall & climate',
    url: 'https://imdpune.gov.in', checked: 'link-only', usedFor: 'Observed rainfall (gauge / gridded)',
    contains: 'NOT OPENED. Obtain monthly/annual station or gridded rainfall for the Beas catchment and import as CSV.' },
  { id: 'R11', title: 'CHIRPS — Climate Hazards Group InfraRed Precipitation with Station data', publisher: 'UC Santa Barbara Climate Hazards Center', year: '—', kind: 'Dataset', category: 'Remote sensing',
    url: 'https://www.chc.ucsb.edu/data/chirps', checked: 'link-only', usedFor: 'Satellite rainfall (catchment mean)', contains: 'NOT OPENED. Extract catchment-mean monthly rainfall and import as CSV.' },
  { id: 'R12', title: 'GPM IMERG precipitation', publisher: 'NASA', year: '—', kind: 'Dataset', category: 'Remote sensing',
    url: 'https://gpm.nasa.gov/data/imerg', checked: 'link-only', usedFor: 'Satellite rainfall', contains: 'NOT OPENED. Satellite-derived precipitation carries its own bias.' },
  { id: 'R13', title: 'Open-Meteo Historical Weather API (ERA5 reanalysis)', publisher: 'Open-Meteo.com (CC BY 4.0)', year: '—', kind: 'Data portal', category: 'Rainfall & climate',
    url: 'https://open-meteo.com/en/docs/historical-weather-api', checked: 'link-only', usedFor: 'npm run fetch:rainfall', contains: 'NOT OPENED by the developer. Used by the optional rainfall fetcher; modelled grid-point values, not gauge observations.' },
  { id: 'R14', title: 'Reservoir Sedimentation Assessment Through Remote Sensing and Hydrological Modelling', publisher: 'Journal of the Indian Society of Remote Sensing', year: '2018', kind: 'Paper', category: 'Surveys & studies',
    url: 'https://link.springer.com/article/10.1007/s12524-018-0843-6', checked: 'link-only', usedFor: 'Possible additional study',
    contains: 'Appeared in a search for Pong sedimentation; NOT OPENED — confirm it covers Pong before citing any figure.' },
  { id: 'R15', title: 'Pong Dam (encyclopedia article)', publisher: 'Wikipedia', year: '—', kind: 'Website', category: 'Secondary sources',
    url: 'https://en.wikipedia.org/wiki/Pong_Dam', checked: 'read', usedFor: 'Gross/live storage (secondary)',
    contains: 'Gross 8,570,000,000 m³; live 7,290,000,000 m³; catchment 12,560 km²; crest 435.86 m; completed 1974. Cites CWC National Register of Large Dams 2009 (primary not opened). Use as a pointer, not as the authority.' },
]

export const REFERENCE_FACTS: { label: string; value: string; source: string; url: string; evidence: 'primary' | 'secondary' }[] = [
  { label: 'Catchment area', value: '12,562 km²', source: 'NGT O.A. 648/2024 reply (R02); Wikipedia gives 12,560 km²', url: REFERENCES[1].url, evidence: 'primary' },
  { label: 'Reservoir surface area at FSL / DSL', value: '24,529 ha / 6,312 ha', source: 'NGT O.A. 648/2024 reply (R02)', url: REFERENCES[1].url, evidence: 'primary' },
  { label: 'Dam crest elevation', value: '435.86 m', source: 'NGT O.A. 648/2024 reply (R02); Wikipedia', url: REFERENCES[1].url, evidence: 'primary' },
  { label: 'Full reservoir level (CWC listing)', value: '423.67 m', source: 'Lok Sabha Q.1504, 2016 (R01)', url: REFERENCES[0].url, evidence: 'primary' },
  { label: 'Gross storage', value: '8,570 Mm³', source: 'Wikipedia (R15) citing CWC NRLD 2009', url: 'https://en.wikipedia.org/wiki/Pong_Dam', evidence: 'secondary' },
  { label: 'Live storage (original)', value: '7,290 Mm³', source: 'Wikipedia (R15); Sarda & Kumar 2025 (R04)', url: 'https://en.wikipedia.org/wiki/Pong_Dam', evidence: 'secondary' },
  { label: 'CWC “total capacity” at FRL', value: '6,157 Mm³', source: 'Lok Sabha Q.1504, 2016 (R01) — differs from 7,290; unresolved', url: REFERENCES[0].url, evidence: 'primary' },
  { label: 'Live-storage loss 1974–2009', value: '632.84 Mm³ (18.08 Mm³/yr)', source: 'Shukla et al. 2017 (R03)', url: REFERENCES[2].url, evidence: 'primary' },
]
