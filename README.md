# ARG TECH — Admin Web Portal

Internal portal for ARG TECH staff: reviewing the farmer, plot and crop-cycle
data field agents collect, maintaining the shared crop reference catalogue,
managing team accounts, and coordinating buyer purchase orders — including
matching supply across several farmers to fill one buyer's order.

**Phase 1 is frontend only.** There is no backend or database yet; every screen
reads and writes an in-browser mock store through an async service layer that a
real API will replace without the UI changing.

## Running it

This project uses **pnpm** (pinned via `packageManager` in `package.json`, so
Corepack will select the right version automatically).

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build            # production build
pnpm exec eslint .    # lint
pnpm exec tsc --noEmit
```

`pnpm-workspace.yaml` allows one build script: `unrs-resolver`, whose native
module `eslint-config-next`'s import resolver depends on. Without it, linting
fails — pnpm blocks install scripts by default, so the allowance is explicit.

Sign in with any seeded username (`admin`, `sophal`, `dara`, `vichea`) and any
non-empty password. Authentication is mocked.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Base UI primitives) · lucide-react · Leaflet + react-leaflet +
Leaflet-Geoman + Turf.js on Esri World Imagery · date-fns.

Fully responsive: tables collapse to stacked cards below `md`, and modals become
full-screen sheets below `sm` with a pinned header, scrolling body and pinned
action bar.

## Architecture

```
lib/
  types.ts          domain model — the shapes the API will eventually return
  derive.ts         pure calculations (available-to-sell, break-even, margin, status)
  geo.ts            Turf polygon area / centroid helpers
  format.ts         money, quantity, date and name formatting
  address.ts        Cambodian province → district → commune → village data
  mock/
    seed.ts         seeded records, dated relative to today
    store.ts        in-memory store + localStorage persistence
  services/         the ONLY module allowed to touch the store
components/         UI; never imports the store directly
app/(portal)/       signed-in screens behind a client-side auth gate
```

Two rules keep the backend swap cheap:

1. **Components never touch the store.** They call async functions in
   `lib/services/*`, which return cloned plain data. Replacing a body with
   `fetch()` is the whole migration.
2. **Derived numbers are never stored.** Sold-so-far, available-to-sell,
   break-even, margin and cycle status are recomputed from the raw records on
   every read (`lib/derive.ts`), so they cannot drift out of sync.

## Modules

| Module | Notes |
|---|---|
| Login | Split-panel sign-in matching the mockup; mocked auth, client-side gate. |
| Dashboard | Stat tiles, harvest-volume chart (hover tooltips + table view), upcoming harvests, recent orders. |
| User Management | Team accounts with role, status, edit / toggle-status / reset-password. |
| Farmers | Farmer records, linked plots and certificates. Read-first, with full admin create/edit as a fallback. |
| Farm Plots | Plot records with **map-based boundary tracing** as the primary area method. |
| Crop Management | Full CRUD reference catalogue, seeded with Cambodian smallholder vegetables. |
| Crop Cycles | One record per farmer + plot + crop planting, with harvest log, field activities and economics. |
| Calendar | Read-only calendar / list of every dated event, plus a Supply Forecast. |
| Purchase Orders | Multi-farmer line items built through a Supply Matching screen. |
| Settings | Session, extensible reference lists, demo-data reset. |

## Corrections applied to the draft mockups

Three modules in the attached screens used an outdated data model and were
rebuilt rather than reproduced.

### 1. Plot area — traced polygon, not typed dimensions

Area comes from tracing the field boundary on **Esri World Imagery** satellite
tiles with **Leaflet-Geoman**, with the hectare figure calculated by **Turf.js**
from the traced shape and the GPS coordinate taken from its centroid.

A manual length × width entry remains for plots with no usable imagery, but the
two are never both live: `Plot.areaSource` is `"polygon" | "manual"`, and the
service (`lib/services/plots.ts`) recomputes `areaHectares` from whichever source
is active and nulls the other one out. A plot can never carry two competing area
figures.

### 2. "Crop Calendar" split into Crop Cycles + a read-only Calendar

Most vegetables are picked repeatedly over weeks, so a single "actual output /
actual price" pair does not describe real operations. The single field pair was
replaced with:

- **Harvest Log** — a repeatable list of picking events (date + quantity only;
  no price, because being picked is not being sold). "Harvested so far" is their
  sum.
- **Field Activities** — a separate repeatable irrigation / fertilisation log
  with its own "+ Add Activity" entry point.
- **Status** — four stages, three of them computed: Growing → Ready to Harvest
  (past the expected date, nothing picked) → Harvesting (at least one entry) →
  Completed (the one manual action).
- **Economics** — total cost from itemised costs; revenue, break-even price
  (cost ÷ sold) and margin ((revenue − cost) ÷ revenue) all derived from actual
  purchase-order line items, so they update the moment an order is recorded.

The calendar is now a separate read-only view. Each harvest-log entry gets its
own marker rather than one marker per cycle, and event badges reflect the real
event type. A **Supply Forecast** view sits alongside it, summing expected output
across Growing and Ready-to-Harvest cycles, grouped by crop and bucketed by
week or month.

### 3. Purchase Orders — multi-farmer line items with Supply Matching

One order is now a buyer plus a list of line items, each referencing a crop
cycle. Farmer, plot and crop are read through that reference and never
re-entered; order totals are summed from the line items.

**Supply Matching** (`/orders/new`) is the primary creation path: enter the crop
and target quantity, see every cycle with stock across all farmers, allocate from
as many as needed against a running "750 / 1,000 kg allocated" total, then set
the buyer, per-line prices and delivery details and save it as one order.

Availability is always recomputed as `harvested − sold across every order`, so
the same kilos can never be committed twice. Editing an order excludes its own
lines from that sum, so re-opening an order does not show its own stock as gone.

Order Status and Delivery Status remain two independent fields, as in the
original design.

## Verification

The full chain was exercised through the real service functions:

1. Logged a 500 kg picking on a Growing cycle → status moved to Harvesting and
   500 kg showed as available.
2. Supply matching listed the same crop across three farmers with correct
   remaining quantities (550 / 500 / 290 kg).
3. Created one order drawing 250 kg from one farmer's cycle and 400 kg from
   another's. Both cycles updated independently and correctly — e.g. CC-0002
   went to 600 kg sold / 40 kg available, break-even $0.25/kg, margin 53.85%;
   CC-0003 to 400 kg sold / 100 kg available, break-even $0.813/kg, margin
   −40.09% — while an unrelated cycle was left untouched.
4. Over-allocating a cycle was rejected: *"Cycle CC-0002 only has 40 kg
   available, but 1000 kg was allocated."* A later order could still draw the
   genuine remainder, after which the cycle was exhausted.

`pnpm build`, `pnpm exec tsc --noEmit` and `pnpm exec eslint .` all pass clean.

## Known limits of this phase

- Data lives in the browser (localStorage). Clearing site data or using another
  browser starts from the seed; **Settings → Reset demo data** does it on demand.
- Uploaded documents are held as data URLs on the record and capped at 2 MB,
  standing in for real file storage.
- Authentication is mocked — there is no password check and no server-side
  session.
