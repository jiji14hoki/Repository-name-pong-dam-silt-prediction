import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { syncInbox } from './scripts/sync'

/** Syncs /data-inbox → public/data/inbox.json at dev start and whenever a CSV there changes. */
function inboxPlugin(): Plugin {
  return {
    name: 'pongsilt-inbox',
    configureServer(server) {
      const root = server.config.root
      const run = () => {
        try {
          const r = syncInbox(root)
          server.config.logger.info(`[inbox] synced ${r.report.files.length} file(s): ${r.rainfall.length} rainfall, ${r.events.length} events, ${r.capObs.length} survey, ${r.sedObs.length} sediment, ${r.params.length} parameters, ${r.refs.length} references` + (r.report.errors.length ? ` — ${r.report.errors.length} row error(s)` : ''))
        } catch (e) { server.config.logger.error(`[inbox] sync failed: ${(e as Error).message}`) }
      }
      // Vite only serves public/ files that existed at startup, so serve the freshly generated file directly.
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/data/inbox.json') return next()
        const file = path.join(root, 'public', 'data', 'inbox.json')
        if (!fs.existsSync(file)) { res.statusCode = 404; res.end(); return }
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store')
        res.end(fs.readFileSync(file))
      })
      run()
      let t: ReturnType<typeof setTimeout> | undefined
      fs.mkdirSync(path.join(root, 'data-inbox'), { recursive: true })
      fs.watch(path.join(root, 'data-inbox'), () => { clearTimeout(t); t = setTimeout(run, 500) })
    },
  }
}
export default defineConfig({ plugins: [react(), inboxPlugin()] })
