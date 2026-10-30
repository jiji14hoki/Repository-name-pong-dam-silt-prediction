# PongSilt Predict — Pong Dam Desiltation Forecast System (MVP)

A transparent, client-only decision-support MVP for reservoir sedimentation at Pong Dam (Maharana Pratap Sagar), Himachal Pradesh.
**Model Estimate — Not an Official BBMB Forecast.** All default inputs are provisional or assumed; bundled rainfall is **simulated**.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine self-test (no UI involved)
npm run build    # type-check + production build
```
`npm run build:single` makes `dist-single/index.html` — the whole site in ONE file you can e-mail, open by double-click, or upload to any static host (e.g. Netlify Drop).
No backend, database or API key is needed. Edits are kept in browser localStorage ("Reset all to demo defaults" on Silt Forecast).

## Automatic data updates (data-inbox)
While `npm run dev` runs, any CSV saved in `data-inbox/` is validated and loaded into the site within ~10 s (header shows "Auto-sync · time").
- File names must start with `rainfall`, `events`/`desilting`, `survey` or `sediment`; copy a header from `data-inbox/templates/`. Details: `data-inbox/README.md`.
- Edit or delete a file and the site follows. Inbox rainfall replaces the simulated demo rainfall; inbox events replace the SAMPLE event.
- `npm run sync` regenerates the inbox once (also runs before `npm run build`).
- `npm run fetch:rainfall` (optional) downloads monthly gridded rainfall (Open-Meteo ERA5 reanalysis, no key, needs internet) for the points in `data-inbox/fetch-config.json` into the inbox; `npm run update` does fetch + sync. These are **Modelled grid-point values, not gauge observations or catchment averages**.

## Where the numbers come from (provenance)
Every model input carries a status, an evidence level (primary source read / secondary citation / no source) and a source link — see **Methodology & Data** and `src/data/provenance.ts`. A status is never upgraded without a citation, and editing a cited value automatically downgrades it to "Assumed (edited)". The **Reference Library** page lists official websites, PDFs and papers and states honestly which ones were opened and read and which are link-only. Add your own links there.

**Benchmark check (Silt Forecast):** the only published Pong survey result found (Shukla et al. 2017: 632.84 Mm³ live-storage loss 1974–2009) is compared with the model. With the brief's 70/30 dead/live split the model reproduces about a third of it; with 100 % live allocation (treating the published 18.08 Mm³/yr as a live-storage loss rate) it matches within 1 %.

## Data Upload page (automation)
Drop CSV/JSON files on **Data Upload**: the type is detected from the columns, rows are validated, and the data is merged immediately (undo available for the last upload). A `parameters` file with a `source` column updates model inputs *and* their provenance (e.g. `original_live_bcm,6.157,BCM,"Document name",https://…,Published Estimate,primary`). Without a source the value is labelled Assumed. The same files also work in `data-inbox/` (including `parameters*.csv` and `references*.csv`).

## Structure
```
src/engine/   types.ts · brune.ts · model.ts · rainfall.ts · query.ts · selftest.ts   (UI-independent)
src/data/     defaults.ts · provenance.ts · references.ts · rainfall.ts (SIMULATED) · events.ts (SAMPLE) · members.ts
src/utils/    csv.ts · exporters.ts · pdf.ts
src/components, src/pages, src/state.tsx
```

## Formulas (all volumes in Mm³ internally; 1 BCM = 1000 Mm³)
1. Inflow: fixed `S_i = S_ref`; rainfall-adjusted `S_i = S_ref (R/R_ref)^β`; regression `ln S_i = a + b ln R` (needs ≥ 8 paired years). Missing rainfall or invalid `R_ref` → fixed yield, flagged.
2. `C/I = (V_live+V_dead)·10⁶ / (Q·10⁶)`.
3. Trap efficiency `η` = Brune (1953) curve, log-linear interpolation (`src/engine/brune.ts`; points are an approximate digitisation — verify) or a manual fixed value.
4. `S_trapped = S_i · η`.
5. `S_compacted = S_trapped · f`; `f` = 1 (default), a user factor, or `ρ_initial/ρ_compacted`.
6. `S_net = S_compacted − D`; `D` is capped at the sediment deposited so far and flagged.
7. `V_dead -= α_d S_net`, `V_live -= α_l S_net` (assumed 70/30). Dead-storage exhaustion is recorded and overflow goes to live; the run continues.
8. Threshold year = first year `V_live ≤ p · V_live,original` for p = 80/70/60 %; otherwise "Not reached within forecast horizon".

## Replacing sample data with verified records
- **Parameters:** `src/data/defaults.ts` (or edit live on Silt Forecast). Verify original live/dead storage, inflow, start year.
- **Rainfall:** Rainfall page → Import CSV (`year,month,rainfall_mm,station_name,latitude,longitude,source,data_status`; month 0 = annual). Remove the simulated rows (filter source "SIMULATED demo generator") or replace `buildDemoRainfall` in `src/state.tsx` with an empty array.
- **Desilting:** Desilting History → add/import events with measured volume and source; tick "Apply in model" only for verified volumes. Remove SAMPLE-1.
- **Surveys / sediment inflow:** Historical Trends registers (feed solid markers and the regression method).
- **Brune points:** `src/engine/brune.ts`.
- **Sources:** `src/data/sources.ts`.

## Editing project members
**Easiest:** Project Team page → *Edit team* — change name/role/post/bio, upload photos, add or remove members. Edits are saved in that browser only; click *Copy code* and paste it over `src/data/members.ts` (and save photos via *Download photo* into `public/images/members/`) to make them permanent.

**By hand:** Edit **`src/data/members.ts`** (`name`, `role`, `post`, `bio`, `image`). Put photos in **`public/images/members/`** (e.g. `member-1.jpg`). A neutral placeholder shows if a file is missing.

## Known limitations
The published 18–25 Mm³/yr rates are live-storage loss rates; the brief's 70/30 split contradicts them (see Silt Forecast → Benchmark check). The 7,290 Mm³ (secondary sources) and 6,157 Mm³ (CWC listing, 2016) capacities are not reconciled — confirm original capacity with BBMB. No uncertainty bounds are computed. Averaging point rainfall is not true catchment rainfall. No machine learning or sensor fusion is implemented.
