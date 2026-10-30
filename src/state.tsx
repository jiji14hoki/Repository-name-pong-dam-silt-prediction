import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_PARAMS } from './data/defaults'
import { SAMPLE_EVENTS } from './data/events'
import { buildDemoRainfall } from './data/rainfall'
import { DEFAULT_PROV, PARAM_META, type ParamKey, type ProvEntry } from './data/provenance'
import type { ReferenceItem } from './data/references'
import { runAll } from './engine/model'
import type { AllScenarios } from './engine/model'
import { annualRainfall } from './engine/rainfall'
import type { AnnualRainSummary } from './engine/rainfall'
import type {
  CapacityObservation, DesiltingEvent, ModelInput, ModelParams, RainfallRecord, ScenarioKey, SedimentObservation,
} from './engine/types'
import { KIND_LABEL, type Kind, type ParamUpdate, type Parsed } from './utils/ingest'

const KEY = 'pongsilt.v1'

function load<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${KEY}.${name}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}
function save(name: string, v: unknown) {
  try { localStorage.setItem(`${KEY}.${name}`, JSON.stringify(v)) } catch { /* storage unavailable */ }
}
function usePersist<T>(name: string, initial: () => T) {
  const [v, setV] = useState<T>(() => load(name, initial()))
  useEffect(() => save(name, v), [name, v])
  return [v, setV] as const
}

function mergeParams(stored: ModelParams): ModelParams {
  return {
    ...DEFAULT_PARAMS, ...stored,
    yields: { ...DEFAULT_PARAMS.yields, ...stored.yields },
    rain: { ...DEFAULT_PARAMS.rain, ...stored.rain },
    trap: { ...DEFAULT_PARAMS.trap, ...stored.trap },
    compaction: { ...DEFAULT_PARAMS.compaction, ...stored.compaction },
    allocation: { ...DEFAULT_PARAMS.allocation, ...stored.allocation },
    regression: { ...DEFAULT_PARAMS.regression, ...stored.regression },
    calibration: { ...DEFAULT_PARAMS.calibration, ...stored.calibration },
  }
}

export interface SyncStatus {
  state: 'idle' | 'ok' | 'none' | 'error'
  at: string | null
  counts: { rainfall: number; events: number; capObs: number; sedObs: number; params: number; refs: number }
  files: { name: string; kind: string; rows: number }[]
  warnings: string[]
  errors: string[]
}
const EMPTY_SYNC: SyncStatus = { state: 'idle', at: null, counts: { rainfall: 0, events: 0, capObs: 0, sedObs: 0, params: 0, refs: 0 }, files: [], warnings: [], errors: [] }

interface Snapshot { rainfall: RainfallRecord[]; events: DesiltingEvent[]; capObs: CapacityObservation[]; sedObs: SedimentObservation[]; params: ModelParams; provOv: ProvOverrides; userRefs: ReferenceItem[] }
type ProvOverrides = Partial<Record<ParamKey, ProvEntry>>
export interface UploadLog { id: string; at: string; files: { name: string; kind: Kind | null; rows: number }[]; summary: string; snapshot?: Snapshot }

interface Ctx {
  sync: SyncStatus; syncNow: () => void
  params: ModelParams; setParams: (p: ModelParams | ((p: ModelParams) => ModelParams)) => void
  events: DesiltingEvent[]; setEvents: (e: DesiltingEvent[]) => void
  rainfall: RainfallRecord[]; setRainfall: (r: RainfallRecord[]) => void
  capObs: CapacityObservation[]; setCapObs: (c: CapacityObservation[]) => void
  sedObs: SedimentObservation[]; setSedObs: (c: SedimentObservation[]) => void
  scenario: ScenarioKey; setScenario: (s: ScenarioKey) => void
  year: number; setYear: (y: number) => void
  dark: boolean; setDark: (d: boolean) => void
  rainSummary: AnnualRainSummary
  input: ModelInput
  all: AllScenarios
  prov: Record<ParamKey, ProvEntry>
  userRefs: ReferenceItem[]; addRef: (r: ReferenceItem) => void; removeRef: (id: string) => void
  uploads: UploadLog[]
  applyUpload: (list: Parsed[]) => string
  undoLastUpload: () => void
  resetAll: () => void
}
const C = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(C)
  if (!c) throw new Error('AppProvider missing')
  return c
}

const rkey = (r: RainfallRecord) => `${r.station_name}|${r.year}|${r.month}`

export function AppProvider({ children }: { children: ReactNode }) {
  // 'params2': defaults changed in dataset demo-0.2.0 (sourced yields), so old saved parameters are not reused
  const [params, setParamsRaw] = usePersist<ModelParams>('params2', () => DEFAULT_PARAMS)
  const [events, setEvents] = usePersist<DesiltingEvent[]>('events', () => SAMPLE_EVENTS)
  const [rainfall, setRainfall] = usePersist<RainfallRecord[]>('rainfall', buildDemoRainfall)
  const [capObs, setCapObs] = usePersist<CapacityObservation[]>('cap', () => [])
  const [sedObs, setSedObs] = usePersist<SedimentObservation[]>('sed', () => [])
  const [scenario, setScenario] = usePersist<ScenarioKey>('scenario', () => 'realistic')
  const [year, setYear] = usePersist<number>('year', () => 2040)
  const [dark, setDark] = usePersist<boolean>('dark', () => { try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false } })
  const [provOv, setProvOv] = usePersist<ProvOverrides>('prov', () => ({}))
  const [userRefs, setUserRefs] = usePersist<ReferenceItem[]>('userrefs', () => [])
  const [uploads, setUploads] = usePersist<UploadLog[]>('uploads', () => [])

  const p = useMemo(() => mergeParams(params), [params])
  const setParams: Ctx['setParams'] = (u) => setParamsRaw((prev) => (typeof u === 'function' ? u(mergeParams(prev)) : u))
  const prov = useMemo(() => ({ ...DEFAULT_PROV, ...provOv }) as Record<ParamKey, ProvEntry>, [provOv])

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const rainSummary = useMemo(() => annualRainfall(rainfall, { station: p.rain.station }), [rainfall, p.rain.station])
  const input = useMemo<ModelInput>(() => ({ params: p, events, annualRain: rainSummary.values, sedimentObs: sedObs }), [p, events, rainSummary, sedObs])
  const all = useMemo(() => runAll(input), [input])

  const addRef = (r: ReferenceItem) => setUserRefs((x) => [...x, r])
  const removeRef = (id: string) => setUserRefs((x) => x.filter((r) => r.id !== id))

  /** Apply parameter updates: change the value AND attach the supplied source/status as provenance. */
  const applyParamUpdates = (base: ModelParams, ov: ProvOverrides, ups: ParamUpdate[]) => {
    let np = base
    const nov = { ...ov }
    for (const u of ups) {
      np = PARAM_META[u.key].set(np, u.value)
      nov[u.key] = { key: u.key, status: u.status, evidence: u.evidence, source: u.source, url: u.url, note: u.note, sourceValue: u.status === 'Assumed' ? null : u.value }
    }
    return { np, nov }
  }

  /** Upload automation: merge every parsed file into the live dataset in one step, with a one-level undo. */
  const applyUpload = (list: Parsed[]): string => {
    const usable = list.filter((x) => x.kind && x.rows > 0)
    if (!usable.length) return 'Nothing was applied — no valid rows found.'
    const batch = `UP${Date.now().toString(36)}`
    const snapshot: Snapshot = { rainfall, events, capObs, sedObs, params: p, provOv, userRefs }
    let nR = rainfall, nE = events, nC = capObs, nS = sedObs, np = p, nov = provOv, nRefs = userRefs
    const parts: string[] = []
    usable.forEach((x, fi) => {
      const tag = `${batch}-${fi}`
      if (x.kind === 'rainfall') {
        const fresh = x.rainfall.map((r, i) => ({ ...r, id: `${tag}-R-${i}` }))
        const keys = new Set(fresh.map(rkey))
        nR = nR.filter((r) => !keys.has(rkey(r)))
        if (fresh.some((r) => r.data_status !== 'Simulated')) nR = nR.filter((r) => !r.id.startsWith('DEMO-'))
        nR = [...nR, ...fresh]; parts.push(`${fresh.length} rainfall`)
      } else if (x.kind === 'events') {
        const fresh = x.events.map((e, i) => ({ ...e, id: `${tag}-${e.id.startsWith('EV-') ? i + 1 : e.id}` }))
        nE = [...nE.filter((e) => !e.id.startsWith('SAMPLE-')), ...fresh]; parts.push(`${fresh.length} event(s)`)
      } else if (x.kind === 'survey') { nC = [...nC, ...x.capObs.map((o, i) => ({ ...o, id: `${tag}-C-${i}` }))]; parts.push(`${x.capObs.length} survey`) }
      else if (x.kind === 'sediment') { nS = [...nS, ...x.sedObs.map((o, i) => ({ ...o, id: `${tag}-S-${i}` }))]; parts.push(`${x.sedObs.length} sediment`) }
      else if (x.kind === 'parameters') { const r = applyParamUpdates(np, nov, x.params); np = r.np; nov = r.nov; parts.push(`${x.params.length} parameter(s)`) }
      else if (x.kind === 'references') { nRefs = [...nRefs, ...x.refs]; parts.push(`${x.refs.length} reference(s)`) }
    })
    setRainfall(nR); setEvents(nE); setCapObs(nC); setSedObs(nS); setParamsRaw(np); setProvOv(nov); setUserRefs(nRefs)
    const summary = `Applied ${parts.join(', ')}.`
    setUploads((prev) => [{ id: batch, at: new Date().toISOString(), files: usable.map((x) => ({ name: x.fileName, kind: x.kind, rows: x.rows })), summary, snapshot }, ...prev.map((u) => ({ ...u, snapshot: undefined }))].slice(0, 20))
    return summary
  }
  const undoLastUpload = () => {
    const last = uploads[0]
    if (!last?.snapshot) return
    const s = last.snapshot
    setRainfall(s.rainfall); setEvents(s.events); setCapObs(s.capObs); setSedObs(s.sedObs); setParamsRaw(s.params); setProvOv(s.provOv); setUserRefs(s.userRefs)
    setUploads((prev) => prev.slice(1))
  }

  // ---- Auto-sync from data-inbox (public/data/inbox.json) ----
  const [sync, setSync] = useState<SyncStatus>(EMPTY_SYNC)
  const stamp = useRef<string | null>(null)
  const pull = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/inbox.json?t=${Date.now()}`, { cache: 'no-store' })
      const data = res.ok ? await res.json() : null
      if (!data || !Array.isArray(data.rainfall)) { setSync((s) => (s.state === 'ok' ? s : { ...EMPTY_SYNC, state: 'none' })); return }
      if (data.generatedAt === stamp.current) return
      stamp.current = data.generatedAt
      const strip = <T extends { id: string }>(a: T[]) => a.filter((x) => !x.id.startsWith('INBOX-'))
      setRainfall((prev) => { const keep = strip(prev); return data.rainfall.length ? [...keep.filter((r) => !r.id.startsWith('DEMO-')), ...data.rainfall] : keep })
      setEvents((prev) => { const keep = strip(prev); return data.events.length ? [...keep.filter((e) => !e.id.startsWith('SAMPLE-')), ...data.events] : keep })
      setCapObs((prev) => [...strip(prev), ...data.capObs])
      setSedObs((prev) => [...strip(prev), ...data.sedObs])
      setUserRefs((prev) => [...strip(prev), ...(data.refs ?? [])])
      if ((data.params ?? []).length) {
        const ups = data.params as ParamUpdate[]
        setParamsRaw((prev) => ups.reduce((acc, u) => PARAM_META[u.key].set(acc, u.value), mergeParams(prev)))
        setProvOv((prev) => { const n = { ...prev }; for (const u of ups) n[u.key] = { key: u.key, status: u.status, evidence: u.evidence, source: u.source, url: u.url, note: u.note, sourceValue: u.status === 'Assumed' ? null : u.value }; return n })
      }
      setSync({ state: 'ok', at: data.generatedAt, counts: { rainfall: data.rainfall.length, events: data.events.length, capObs: data.capObs.length, sedObs: data.sedObs.length, params: (data.params ?? []).length, refs: (data.refs ?? []).length }, files: data.report.files, warnings: data.report.warnings, errors: data.report.errors })
    } catch { setSync((s) => ({ ...s, state: s.state === 'ok' ? 'ok' : 'none' })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void pull(); const t = setInterval(() => void pull(), 10000); return () => clearInterval(t) }, [pull])
  const syncNow = () => { stamp.current = null; void pull() }

  const resetAll = () => {
    setParamsRaw(DEFAULT_PARAMS); setEvents(SAMPLE_EVENTS); setRainfall(buildDemoRainfall()); setCapObs([]); setSedObs([])
    setProvOv({}); setUserRefs([]); setUploads([]); stamp.current = null; setTimeout(() => void pull(), 0)
  }
  const value: Ctx = { sync, syncNow, params: p, setParams, events, setEvents, rainfall, setRainfall, capObs, setCapObs, sedObs, setSedObs, scenario, setScenario, year, setYear, dark, setDark, rainSummary, input, all, prov, userRefs, addRef, removeRef, uploads, applyUpload, undoLastUpload, resetAll }
  return <C.Provider value={value}>{children}</C.Provider>
}
export { KIND_LABEL }
