import { Library as LibraryIcon, RefreshCw, UploadCloud, BarChart3, BookOpen, CloudRain, Droplets, LayoutDashboard, LineChart, Menu, Moon, Pickaxe, Sun, Users } from 'lucide-react'
import { useState } from 'react'
import { AskModel } from './components/AskModel'
import { Badge } from './components/ui'
import { AppProvider, useApp } from './state'
import Desilting from './pages/Desilting'
import Forecast from './pages/Forecast'
import Methodology from './pages/Methodology'
import Overview from './pages/Overview'
import Rainfall from './pages/Rainfall'
import Team from './pages/Team'
import Library from './pages/Library'
import Upload from './pages/Upload'
import Trends from './pages/Trends'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'forecast', label: 'Silt Forecast', icon: BarChart3 },
  { id: 'rainfall', label: 'Rainfall Analysis', icon: CloudRain },
  { id: 'desilting', label: 'Desilting History', icon: Pickaxe },
  { id: 'trends', label: 'Historical Trends', icon: LineChart },
  { id: 'method', label: 'Methodology & Data', icon: BookOpen },
  { id: 'library', label: 'Reference Library', icon: LibraryIcon },
  { id: 'upload', label: 'Data Upload', icon: UploadCloud },
  { id: 'team', label: 'Project Team', icon: Users },
]

function Shell() {
  const [page, setPage] = useState('overview')
  const [open, setOpen] = useState(false)
  const { dark, setDark, sync, syncNow } = useApp()
  const go = (p: string) => { setPage(p); setOpen(false); window.scrollTo({ top: 0 }) }
  const cur = NAV.find((n) => n.id === page)!
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
      <aside className={`${open ? 'block' : 'hidden'} fixed inset-y-0 left-0 z-30 w-64 shrink-0 bg-navy-900 p-4 lg:sticky lg:top-0 lg:block lg:h-screen`}>
        <div className="mb-6 flex items-center gap-2 text-white"><Droplets aria-hidden className="text-reservoir-300" /><div><p className="font-semibold leading-tight">PongSilt Predict</p><p className="text-[11px] text-slate-300">Pong Dam Desiltation Forecast</p></div></div>
        <nav aria-label="Main" className="space-y-1">
          {NAV.map((n) => <button key={n.id} className="nav-btn" aria-current={n.id === page ? 'page' : undefined} onClick={() => go(n.id)}><n.icon size={17} aria-hidden /> {n.label}</button>)}
        </nav>
        <p className="absolute bottom-4 left-4 right-4 text-[11px] text-slate-400">Model estimate — not an official BBMB forecast.</p>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 backdrop-blur" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2">
            <button className="btn lg:hidden !p-1.5" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={18} aria-hidden /></button>
            <h1 className="text-base font-semibold">{cur.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="chip hover:bg-slate-100 dark:hover:bg-slate-800" onClick={syncNow} title={sync.state === 'ok' ? `Loaded ${sync.files.length} inbox file(s). Click to re-sync.` : 'No data-inbox files loaded (run npm run dev and drop CSVs in /data-inbox)'}>
              <RefreshCw size={11} aria-hidden className="mr-1" />{sync.state === 'ok' ? `Auto-sync · ${new Date(sync.at ?? '').toLocaleTimeString()}${sync.errors.length ? ` · ${sync.errors.length} error(s)` : ''}` : 'Auto-sync: idle'}
            </button>
            <button className="chip border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100" onClick={() => go('method')} title="Open data transparency"><Badge kind="Assumed">Demo Data</Badge></button>
            <button className="btn !p-1.5" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)}>{dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}</button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl p-4 sm:p-6">
          {page === 'overview' && <Overview go={go} />}
          {page === 'forecast' && <Forecast />}
          {page === 'rainfall' && <Rainfall />}
          {page === 'desilting' && <Desilting />}
          {page === 'trends' && <Trends />}
          {page === 'method' && <Methodology go={go} />}
          {page === 'library' && <Library />}
          {page === 'upload' && <Upload />}
          {page === 'team' && <Team />}
        </main>
      </div>
      <AskModel />
    </div>
  )
}
export default function App() { return <AppProvider><Shell /></AppProvider> }
