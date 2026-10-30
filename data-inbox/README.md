# data-inbox — drop CSV files here

While `npm run dev` is running, any CSV saved in this folder is validated and loaded into the site automatically (within ~10 s).
Copy a file from `templates/` to this folder and rename it. The name must START with:

| Prefix | Data | Columns |
|---|---|---|
| `rainfall` | rainfall | year, month (1–12; 0 = annual), rainfall_mm, station_name, latitude, longitude, source, data_status |
| `events` or `desilting` | desilting/dredging events | id, startYear, startMonth, endYear, endMonth, operationDate, volumeMm3, rate, method, source, verification, notes, includeInModel |
| `survey` | reservoir survey results | id, year, liveStorageMm3, cumulativeSiltMm3, source, status, note |
| `sediment` | annual sediment inflow | id, year, annualSedimentInflowMm3, source, status, note |
| `parameters` | model inputs with sources | parameter, value, unit, source, source_url, status, evidence, note |
| `references` | links for the Reference Library | title, url, type, publisher, year, note |

Rules: every row needs a real source; use data_status `Observed` only for genuine measurements; leave volumeMm3 blank if unknown (never guess).
When inbox rainfall exists, the simulated demo rainfall is removed automatically; likewise the SAMPLE desilting event when inbox events exist.
Removing a file from this folder removes its records from the site. Optional: `npm run fetch:rainfall` downloads gridded rainfall (see fetch-config.json).
