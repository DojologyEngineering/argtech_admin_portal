# ARG TECH Admin Portal: Gap Report

Audit date: 2026-10-18. Read-only: no code, data or styling was changed. This file is the only thing created.

**What was compared**

| App | Path | Found |
|---|---|---|
| Admin Portal | `d:\ARG TECH\argtech_admin_portal` | Yes |
| Buyer App | `d:\ARG TECH\argtech_buyer_miniapp` | Yes |
| Agent App | `d:\ARG TECH\argtech_agent_miniapp` | Yes |

**How it was checked.** I read the source and seed files of all three apps, and I ran `tsc --noEmit` and `eslint .` on the portal (both clean, no errors or warnings). I could not open a browser in this session. So every figure below is worked out by hand from the seed code with today = 2026-10-18, and Section C items about layout, contrast and responsive behaviour are judged from the code, not seen on screen. Nothing was observed in a browser console. Items that need an eyeball check are marked *(verify in browser)*.

---

## 1. Summary

### Counts for Section A (12 items)

| Status | Count | Items |
|---|---|---|
| PRESENT | 3 | A10 (no consent flag), A11 (Settings), A12 (no fee figures) |
| PARTIAL | 2 | A5 (Crop Management), A9 (Certificates) |
| MISSING | 6 | A1 Buyers, A2 Requests, A3 Other-crop requests, A6 Requirements check, A7 Quality panel, A8 Pickup |
| WRONG | 1 | A4 (Purchase Orders exist but use the old status model) |

The portal is still the original "farm records + simple purchase orders" product. Almost everything added to the Buyer and Agent Apps since then (requests, pickup, quality, specs, tiers, certificate sharing) has no counterpart here.

### Section B in one line
None of the 10 shared orders exists in the portal. The 5 seeded orders use different codes, buyers, crops, kg, prices and statuses. The portal's farmers, plots, crops and cycles are also a different dataset from the Agent App's. The portal's pilot area is not Kampong Cham. Kang Meas and Srey Santhor do not exist in its address picker.

### Five most important gaps for a pitch demo
1. **Requests flow is missing** (A2, A3, A6). There is no Requests page, no REQ codes, no way to decline a request with a reason, and no "match to farmers and confirm". This is the staff half of what the Buyer App just created.
2. **Purchase Orders use the wrong model** (A4, B1, B3). Statuses are Pending / Confirmed / Delivered with a second "Delivery status". The six shared statuses, the Order-now / Request type and the Delivery / Pickup method are all missing. Cancel and decline have no reason. Delete has no confirmation.
3. **Seed data tells a different story** (B1, B2). A demo that shows the Buyer App's PO-0009 and then opens the portal will not find it. The shared orders, the buyer "Fresh Market Ltd.", the Kampong Cham farmers and the 7 catalog crops (the portal has an extra 8th, Chinese Kale) need to line up.
4. **Pickup, handover quality and certificate sharing have no staff side** (A7, A8, A9). Buyers see pickup arrangements, handover results and certificate images that staff cannot create or review anywhere. Settings has no pickup points list.
5. **Crop specs and tier prices cannot be edited** (A5). The Buyer App's crop specification and under-200 / 200–999 / 1,000+ kg prices are "editable later in the Admin Portal", but the portal has only one flat reference price per crop. Its order screen also defaults line prices to that reference price, not the buyer tier.

Also pitch-visible: the sidebar says **DOJOLOGY**, and the Harvest Overview chart shows one bar and five empty months.

---

## 2. Section A: Pages and features the portal should have

| # | Item | Status | Where checked | Detail |
|---|---|---|---|---|
| A1 | Buyers page (list, detail, their orders and requests) | **MISSING** | `lib/nav.ts`, `app/(portal)/` (no `buyers` route), `lib/types.ts:193` | No nav entry or route. A buyer is only `{id, name, contactPerson, phone}`. Buyers are created on the fly by typing a name in the order form (`findOrCreateBuyer`, `lib/services/orders.ts`). No email, addresses or registered status, and no per-buyer order history. |
| A2 | Requests page (REQ-xxxx; Requested / Declined; match to farmers and confirm; decline asks a reason) | **MISSING** | `lib/nav.ts`, `lib/types.ts`, `components/orders/supply-matcher.tsx` | No request entity, no REQ codes, no Requested or Declined status, no decline reason. The nearest thing is the "New Order → Supply Matching" screen, which builds a PO from farmer cycles. It could be reused for confirming a request, but nothing connects it to a buyer request. |
| A3 | "Other crop" requests (Not in catalog tag, Decline, Add to catalog) | **MISSING** | `lib/types.ts`, `app/(portal)/crops/page.tsx` | Nothing on orders carries a crop name outside the catalog. "Add to catalog" would be a shortcut to the existing Add Crop dialog, which exists but is not linked. |
| A4 | Purchase Orders (list and detail; statuses Requested / Confirmed / Delivered-or-Picked up / Completed / Declined / Cancelled; type and method visible; staff can move status; cancel and decline ask a reason) | **WRONG** | `app/(portal)/orders/page.tsx`, `orders/[id]/page.tsx`, `lib/types.ts:200-230` | List and detail exist, with a clickable list and an eye action. But `ORDER_STATUSES = Pending / Confirmed / Delivered` plus a separate `DELIVERY_STATUSES = Pending / In Transit / Delivered`. **Missing:** Requested, Completed, Declined, Cancelled, the "Picked up" label, the Order-now / Request type and reason capture. **Method** is free text from a lookup (Truck / Pickup / Buyer Collects / Motorbike), not Delivery or Pickup. **Status move** is a "Confirm / Mark delivered" button plus two selects that allow any jump, including backwards. **Delete** (`orders/[id]/page.tsx:93,125`) removes the order with no confirmation. |
| A5 | Crop Management: spec editor (ripeness, size, condition, best used within days, chips) and tier prices (<200, 200–999, 1,000+ kg) | **PARTIAL** | `app/(portal)/crops/page.tsx`, `components/crops/crop-dialogs.tsx:117-203`, `lib/types.ts:124` | The page and crop CRUD exist (name, variety, season, seed source, one "Price ($/kg)", days to harvest, agronomy note). **Neither required part exists:** no spec fields or chips, no tiers. The single price is described as "reference pricing for break-even" and is also what the order screen uses as the default line price (`supply-matcher.tsx:142`). |
| A6 | Request details show buyer requirements (ripeness, size) and a "Farmer can meet this" check | **MISSING** | `components/orders/supply-matcher.tsx`, `lib/types.ts` | Orders have no requirements field. Supply matching shows available kg, last harvest and status per cycle, but no spec comparison. |
| A7 | Order detail Quality panel: handover per farmer line (received, accepted, rejected kg, reason, photos, note), buyer feedback, quality log | **MISSING** | `app/(portal)/orders/[id]/page.tsx`, `lib/types.ts:211` | Line items have only `cropCycleId, quantityKg, pricePerKg`. Nothing is shown from the Agent App's `HandoverCheck` (received, accepted, rejected, reason, 2 photos, note, buyer rep present) or from the Buyer App's feedback. No quality log. |
| A8 | Pickup: pickup points list in Settings (name, district, landmark, Maps link) and a Pickup arrangement panel on pickup orders (point, date, window, collector name and phone, instructions, "Save and share with buyer"). A pickup point must be a meeting point, never a farm. | **MISSING** | `app/(portal)/settings/page.tsx`, `orders/[id]/page.tsx` | Settings has only generic reference lists (including "Delivery methods"), a session card and Reset demo data. No pickup point model, no arrangement panel, no meeting-point rule. The Buyer App comment says its sample points "come from the Admin Portal's pickup point list", which does not exist yet. |
| A9 | Certificates: view each farmer's certificate, set sharing (hidden / details / details and image), upload or approve a buyer-safe redacted image | **PARTIAL** | `components/farmers/farmer-detail-dialog.tsx:131-225`, `lib/types.ts:46` | Staff can see, add and remove a farmer's certificates in the Farmer Profile dialog (name, issuer, issued, expiry, note). **Missing:** sharing setting, any image upload or approval, buyer-safe copy, type (GAP / Organic / Other) and scope (e.g. "Tomato production"). Certificates also never link to lots or cycles, so the Buyer App's lot-level certificates cannot be driven from here. |
| A10 | No per-farmer consent flag or "not shared" warning | **PRESENT** | whole repo (`grep consent`), `lib/types.ts:55`, `components/farmers/*` | No consent field, flag or warning exists in the portal. The other two apps have none either. |
| A11 | Settings page exists and is reachable from the sidebar | **PRESENT** | `lib/nav.ts:35` (`FOOTER_NAV_ITEMS`), `app/(portal)/settings/page.tsx`, `components/app-shell.tsx:107` | Reachable from the sidebar footer and the account menu. Content is dev-oriented (see C). It does not hold the pickup points required by A8. |
| A12 | Fees: note any fee figures shown | **PRESENT** | `lib/derive.ts`, dashboard, orders, cycle detail | No platform fee, commission or service charge appears anywhere, matching the other apps. Money figures shown: order and line totals, price per kg, crop reference price, and on Crop Cycle detail the cost, revenue, profit, margin and break-even per cycle. The cycle figures are farmer-economics, not fees, but a pitch audience may read "profit / margin" as ARG TECH's own. |

---

## 3. Section B: Data consistency

"Today" = 2026-10-18. The portal's seed (`lib/mock/seed.ts`) is written relative to today via `d(offset)`. The Buyer and Agent Apps use `daysFromToday(n)`. Dates therefore line up in principle and the differences below are about content.

### B1. Shared orders

The Admin Portal has 5 orders, all with different buyers. The expected shared orders are listed first. Buyer App and Agent App values come from their seeds (`lib/mock/seed.ts` in each).

| Code | Admin Portal value | Buyer App value | Agent App value | Difference |
|---|---|---|---|---|
| REQ-0011 | Not present | Pumpkin 150 kg, Requested, Other crop, **Delivery** (Warehouse), needed +21 d, "Medium, firm, no cracks" | Pumpkin 150 kg, Requested, Other crop, **Pickup**, +21 d, same text | Missing in Admin. **Buyer says Delivery, Agent says Pickup**, and the brief expects Pickup. Fix in Buyer App. |
| REQ-0010 | Not present | Chili 200 kg, Requested, Delivery (Main store), +14 d, note "Prefer a mix of red and green…" | Same | Missing in Admin. Buyer and Agent agree. |
| PO-0009 | Not present | Tomato 1,000 kg, $0.55, Confirmed, delivery **+3 d**, 3 lots (A-014 400, A-022 350, A-031 250) | Tomato 1,000 kg, $0.55, Confirmed, delivery **+2 d**, 2 farmer lines (500 + 500) | Missing in Admin. Buyer and Agent differ on delivery date (+3 vs +2) and on how it splits (3 lots vs 2 farmer lines). |
| PO-0008 | Not present | Cucumber 400 of 500 kg, $0.48, Picked up, handover 400 / 380 / 20 "Cracks or damage". Pickup at "Kang Meas sample meeting point", 8:00 to 10:00, collector Vannak Sok | Same quantities, price and handover (plus 2 photos, note, buyer rep present). Pickup at **"Kang Meas district market, main gate", 07:00 – 09:00**, no collector | Missing in Admin. Pickup point, time window and collector differ between the two apps. |
| PO-0007 | Not present | Cabbage 300 kg, $0.42, Completed | Same | Missing in Admin. Apps agree. |
| REQ-0006 | Not present | Morning glory 150 kg, Declined, **Pickup**, reason "Not enough supply for your date" | Same, but **Delivery** | Missing in Admin. Buyer and Agent differ on method. |
| PO-0006 | Not present | **Not in the Buyer seed.** Number 6 is used by the declined REQ-0006 | Tomato 300 kg, $0.60, Confirmed, Delivery today, requirements "Partly ripe / Medium" | Missing in Admin **and in the Buyer App**. The two apps cannot both hold REQ-0006 and PO-0006, because a request keeps its number when confirmed. Decide which number is the declined one. |
| PO-0005 | Different order: Chip Mong Retail, Cucumber 250 kg, $0.55, Pending, delivery +5 d, Truck | Eggplant 250 kg, $0.55, Cancelled, "Farmer could not deliver. Please reorder." | Eggplant 250 kg, $0.55, Cancelled, "Farmer could not deliver" | Code clash with a different crop, buyer and status. Cancel reason wording differs slightly between the apps. |
| PO-0004 | Different order: Sen Sok Wholesale, Eggplant 400 kg, $0.55, Pending, delivery +4 d, Pickup | Long bean 120 kg, $0.75, Confirmed, pickup arranged: "Kang Meas sample meeting point", 8:00 to 10:00, collector **Dara Kim (sample)** +855 96 555 019 | Long bean 120 kg, $0.75, Confirmed. Pickup at **"Angkor Ban commune office, Kang Meas"**, 08:00 – 10:00, collector **Sophea Chan (sample)** +855 12 888 456 | Code clash in Admin. Buyer and Agent disagree on pickup point name and collector. Time format also differs ("8:00 to 10:00" vs "08:00 – 10:00"). |
| PO-0003 | Different order: Battambang Veg Traders, Chili 300 kg, **$2.10**, Delivered, Buyer Collects | Cucumber 150 kg, $0.50, Confirmed, pickup not arranged, wished date +5 d | Same | Code clash with a different crop, price and status. Apps agree. |
| PO-0002 | Phnom Penh Fresh Mart, Long Bean 250 kg, $0.68, Delivered | Not used | Not used | Admin-only. Remove or re-code when re-seeding. |
| PO-0001 | Angkor Green Distributors, Cucumber 750 kg across 2 farmers ($0.52 + $0.50), $383, Confirmed, Delivery Pending | Not used | Not used | Admin-only. |

Order details in the Admin Portal that differ from the shared rules:
- **Buyer names:** none of Angkor Green Distributors, Phnom Penh Fresh Mart, Battambang Veg Traders, Sen Sok Wholesale or Chip Mong Retail is "Fresh Market Ltd." (the seeded buyer in both apps).
- **Prices:** line prices are free numbers (0.52, 0.50, 0.68, 2.10, 0.55, 0.55). The buyer tiers are not applied. 2.10 for chili is well above any chili tier (1.30 / 1.20 / 1.10), and the 750 kg cucumber order should be $0.48, not $0.52 / $0.50.
- **Order codes:** four digits ✓ (`PO-0001`). `nextCode("PO", …)` always produces PO-, never REQ-. It cannot produce a request code.
- **Shared sequence:** codes are not a shared sequence with the Buyer App (where the next number is 12).

### B2. Farmers, plots, crops, cycles

| Item | Admin Portal value | Buyer App value | Agent App value | Difference |
|---|---|---|---|---|
| Pilot area | Farmers in Siem Reap (2), Battambang (1), Kampong Cham (1), Phnom Penh (1), Kampot (1), Takeo (1) | Pilot province constant `PILOT_PROVINCE = "Kampong Cham"`; lots in Kang Meas, Srey Santhor, Kampong Siem | All 8 farmers and 10 plots in Kampong Cham (Kang Meas, Srey Santhor, Kampong Siem) | **WRONG.** Only 1 of 7 portal farmers is in the pilot province. Plot coordinates sit near Siem Reap (13.3°N, 103.9°E), not Kampong Cham (~12.0°N, 105.4°E). |
| Address picker | Kampong Cham offers only Kampong Siem and Batheay (`lib/address.ts:75-93`) | n/a | Uses Kang Meas, Srey Santhor, Kampong Siem | **Kang Meas and Srey Santhor are not selectable** in the portal's farmer and plot forms. Agent farmers could not be entered or edited here. |
| Farmers | 7: Sokha Meas, Chantrea Sok, Virak Phan, Sophea Noun, Kosal Heng, Davi Chea, Rithy Sam | Anonymous (lot codes only) | 8: Sokha Meas, Kimly Lay, Chantrea Sok, Virak Phan, Sereypheap Ly, Dara Heng, Srey Mom Chea, Vannak Keo | Three names appear in both but with different details. Sokha Meas: same birth date, Siem Reap/Wat Bo vs Kang Meas/Angkor Ban, different phones. Chantrea Sok: Battambang, born 1990 vs Srey Santhor, born 1978. Virak Phan: Kampong Siem, 1978 vs Kang Meas, 1988. |
| Field formats | Gender `Male`, education `Uneducated / Primary / Bachelor / Master`, phone `012345678` | n/a | Gender `male`, education `No formal schooling / Primary school / University / Vocational training`, phone `098 765 432` | Different labels and phone format. Education list does not match. |
| Plots | 9, names like "Prek Toal Vegetable Field", soil `Clay`, ownership `Own` / `Rent`, with commune, irrigation, infrastructure | n/a | 10, names "Vegetable Plot A…G", land type `Clay Soil`, `Alluvial Soil`, property `own` / `rent` | Different names, soil vocabulary (portal lacks "Alluvial") and counts. |
| Crops | 8 incl. **Chinese Kale** | 7: tomato, cucumber, long-bean, morning-glory, chili, cabbage, eggplant | 7 (same as Buyer) | Portal has an extra crop that the buyer cannot order. Name case differs: "Long Bean" / "Morning Glory" (Admin, Agent) vs "Long bean" / "Morning glory" (Buyer). |
| Crop varieties and seasons | Variety "Green Long", "Roma VF", "Kampot Red"…; seasons `Rainy / Dry / Hot / All` | Lot varieties e.g. "Local red tomato" | "Local Hybrid F1", "Local Round", "Bird's Eye (Marech Kdao)"…; seasons `Wet Season / Dry Season` | Different varieties and seasons. Seed source differs for 5 crops (e.g. cabbage China vs Korea, chili Certified Local Nursery vs Thailand, eggplant Thailand vs Vietnam). |
| Reference price per kg | Cucumber 0.45, Tomato 0.80, Long Bean 0.60, Morning Glory 0.35, Chili 1.80, Cabbage 0.40, Eggplant 0.50 | Tiers instead (see next row) | 0.35, 0.60, 0.50, 0.25, 1.50, 0.30, 0.40 | Portal and Agent reference prices differ for every crop. |
| Buyer price tiers | None | Tomato .65/.60/.55, Cucumber .50/.48/.45, Long bean .75/.70/.65, Morning glory .38/.35/.32, Chili 1.30/1.20/1.10, Cabbage .45/.42/.40, Eggplant .60/.55/.50 | Identical tiers (`BUYER_PRICE_TIERS`) | Buyer and Agent agree. Portal has no tiers. |
| Days to harvest | Cucumber 40, Tomato 75, Long Bean 50, Morning Glory 25, Chili 90, Cabbage 70, Eggplant 80 | n/a | 40, 60, 45, 25, 75, 65, 70 | Differs for 6 of 7 crops. |
| Crop specs | None | Full spec per crop (ripeness, size, condition, best used within, chips, options) | Same wording in `CROP_SPECS` (ripeness, size, condition, best used within) | Portal has none. |
| Crop cycles | 10 (`CC-0001`…`CC-0010`), no production details | n/a (lots) | 25 (`cycle_1`…`cycle_26`; `cycle_11` does not exist) with method, fertilizer, pesticide, delivery frequency | Different counts and no shared codes. Portal cycles have no production method, fertilizer or pesticide, which is exactly what the Buyer App shows on lot traceability. |
| Certificates | 2 (Cambodia GAP for Chantrea, Organic Certification for Davi), no scope or image | Lot certificates with `sharing` setting and sample image | 6 (type, issuer, scope, expiry, optional placeholder photo) | Different data and shape (see A9). |
| "Sample" labelling | None. Real-sounding issuers such as "GDA / MAFF" and "COrAA" | Pickup points, issuers and collectors marked "(sample)" | Some marked "(sample)" | The portal's data is not labelled as sample data. |

### B3. Status words

| Where | Value | Issue |
|---|---|---|
| `lib/types.ts:200` | `Pending / Confirmed / Delivered` | "Pending" should be **Requested**. Missing Completed, Declined, Cancelled. No "Picked up" for pickup orders. |
| `lib/types.ts:203` | `Pending / In Transit / Delivered` (delivery status) | Extra status vocabulary that the other apps do not have. |
| `lib/types.ts:139` | `Growing / Ready to Harvest / Harvesting / Completed` (cycles) | Cycle statuses are fine in the Agent App (snake_case ids). Spelling is **Completed** ✓. |
| Dashboard and Orders cards | "2 pending", "Pending" stat card | Uses the wrong word. |
| Orders table "Delivery" column | A status badge (Pending / In Transit / Delivered) | On the dashboard the same header "Delivery" is a **date**. |

### B4. Dates

- Seeds are relative to today, so nothing is hard-coded in the past ✓. The only fixed dates are farmers' dates of birth.
- **Persisted store freezes the seed.** `lib/mock/store.ts` saves to localStorage under `argtech.portal.db`, `SCHEMA_VERSION = 1`. A browser that opened the portal on, say, 5 October keeps those dates forever. By 18 October its "upcoming" and "harvest" data is 13 days old. Changing the seed does not reach existing browsers unless `SCHEMA_VERSION` is bumped. Settings → Reset demo data fixes it by hand. *(Process risk for demo day.)*
- **Overdue cycle:** CC-0006 (Morning Glory) is "Ready to Harvest", 5 days overdue. It is excluded from Upcoming Harvests (which requires `expectedHarvestDate >= today`), so nothing on the dashboard surfaces it.
- **All harvest history sits in the last 14 days** (d-14 … d-1), so it lands in a single calendar month (see B5).

### B5. Dashboard numbers (computed for 2026-10-18)

| Card / widget | Shows | Check against other pages |
|---|---|---|
| Total Farmers | 7 | Matches Farm Management (7). Agent App has 8. |
| Farm Plots | 9, "X ha mapped" | Matches Farm Plots page (sum of polygon and manual areas). |
| Active Crops | **7** | This counts distinct crop types among unfinished cycles (cucumber, tomato, long bean, morning glory, cabbage, eggplant, kale). Crop Cycles page shows **9** open cycles (4 Growing, 1 Ready, 4 Harvesting) and 1 Completed. The label "Active Crops" can read as 9. |
| Purchase Orders | 5, "**2 pending**" | Matches Orders page counts (Pending 2). Wrong word (B3). Does not match the shared orders (10 shared records). |
| Harvest Overview | Last 6 months May–Oct; **October = 3,350 kg**, the other five months = 0 | Totals match the harvest logs (1,200 + 640 + 500 + 520 + 490). The chart looks empty. |
| "vs last month" badge | **Hidden today** (September = 0, so the trend is `null`) | Becomes misleading on other days. On 1 Nov the 14-day window falls in October, so November = 0 and October = 3,350 and the badge reads a red **"100.0% vs last month"**. During days 1–14 of any month the current month is partial and the badge understates. |
| Upcoming Harvests | 4: CC-0004 Tomato (+5 d), CC-0003 Cucumber (+20 d), CC-0008 Cabbage (+30 d), CC-0010 Kale (+30 d) | Consistent with cycles. Overdue CC-0006 is not shown (B4). |
| Recent Purchase Orders | PO-0005, 0004, 0003, 0002, 0001 | Consistent with Orders page. Totals are rounded to whole dollars: PO-0005 is **$137.50 but shows "$138"**. The other apps show 2 decimals (`formatCurrency`, 2 digits). |

---

## 4. Section C: UI polish review

Impact is for a pitch demo: **High** = visible in the first minute or contradicts the story, **Medium** = noticeable when clicked through, **Low** = polish. Items marked *(verify in browser)* are inferred from code.

### Global / app shell

- **High: Branding says DOJOLOGY.** Where it is set:
  - Sidebar wordmark: `components/app-shell.tsx:145` (plain text link, no logo image, in both the desktop sidebar and the mobile drawer).
  - Login panel: `app/login/page.tsx:43`, "AGRI x DOJOLOGY".
  - Browser tab title: `app/layout.tsx:20-23` is already "ARG TECH Admin Portal" with template "%s · ARG TECH". But every page is a client component and none exports `metadata`, so the template is never used and the tab always reads the default.
  - Top-bar fallback title: `app-shell.tsx` falls back to "ARG TECH" when no nav item matches.
  - Logo and icon: there is no logo file. `public/` holds only the five create-next-app SVGs (file, globe, next, vercel, window), all unused. `app/favicon.ico` is probably the Next.js scaffold default (not opened). Theme colour `#0b4a25` is set in `app/layout.tsx`.
- **Medium: Dead notification bell.** `app-shell.tsx:80-89` renders a Bell button with a permanent red dot but no handler and nothing behind it.
- **Medium: Sidebar has no entries for the new modules** (Buyers, Requests). `lib/nav.ts` is the single place to add them. Current order mirrors an old product (User Management first).
- **Low: Dark mode is dead code.** `.dark` tokens and `dark:` classes exist throughout, but no ThemeProvider or toggle is mounted (`next-themes` is only used by the toast component).
- **Low: Tiny text.** 23 uses of `text-[10px]` / `text-[11px]` for table headers, stat hints, province tags and chart ticks, in the muted grey (`--muted-foreground` oklch 0.55). That is close to the 4.5:1 limit at those sizes. Contrast was not measured. *(verify in browser)*
- **Low: Heading structure.** `PageHeader` hides the page `<h1>` visually (`sr-only`) when it repeats the top-bar title, and the top bar uses an `<h2>`. Screen readers get an h1, but the visible heading is an h2.
- **Low: Header height is consistent** (`h-16` for both sidebar logo row and top bar) ✓.

### Login

- **Low:** The "Demo build — sign in with any seeded username…" box is useful for you but reads as unfinished to an audience. Consider hiding it for the pitch. Brand panel text needs the ARG TECH change above.

### Dashboard

- **High: Harvest Overview looks empty.** One bar (October, 3,350 kg) and five empty months. Seed harvests need to span several months (`lib/mock/seed.ts`, harvest logs). The "no harvest in the last six months" message does not appear because October has data, so the chart gives no hint that it is sparse.
- **High: "vs last month" can show "100.0%" decline** on the first days of a month (B5). It is hidden today only by luck. Compare like-for-like periods, or hide it when the current month is under, say, 15 days old.
- **Medium: "Active Crops: 7"** counts crop types, not cycles (B5). Rename ("Crops in production") or show cycles.
- **Medium: Pending wording** in the Purchase Orders card hint ("2 pending"). There is no card for **Requests waiting** (the metric staff care about most).
- **Medium: Overdue harvests are not surfaced** (CC-0006).
- **Medium: Whole-dollar totals** (`money()` has 0 decimals) while per-kg prices show cents; PO-0005 shows $138 for $137.50.
- **Low: Table rows are clickable `<tr onClick>` with no keyboard access** on the dashboard (`dashboard/page.tsx`). It has no eye button either. The "View All Orders" button is the only keyboard route.
- **Low: Subtitle** "Latest transactions from the marketplace". There is no marketplace in the product.
- **Low:** Column header "Delivery" on the dashboard is a date; on the Orders page "Delivery" is a status.

### User Management

- **Low: Rows are not clickable** (no `onRowClick`), unlike every other list. The three action buttons have proper `aria-label`s ✓.
- **Low:** Role badges have no status dot while status badges do (intentional but looks uneven next to each other).

### Farm Management

- **Medium: Seeds do not look like the pilot** (Siem Reap, Battambang, Kampot…; B2). With a one-province pilot, the "Province" column would repeat "Kampong Cham" on every row. A **District** column is more useful.
- **Medium: Phone, gender and education formats differ** from the Agent App (B2).
- **Low: "Certs" header abbreviation** and a count bubble with no way to see sharing state.
- **Medium (feature): Certificates have no image or sharing** (A9).

### Farm Plots

- **Medium:** Plot names and coordinates are Siem Reap / Battambang based (B2). The satellite map will show the wrong region for the Kampong Cham story.
- **Low:** Row click opens a dialog ✓, with eye and pencil icon buttons labelled ✓.

### Crop Management

- **High (feature):** Single "Price ($/kg)" column and a subtitle "reference pricing for break-even calculations". It conflicts with tiered buyer prices (A5).
- **Medium:** The extra Chinese Kale crop and different varieties (B2).
- **Low:** Season badges use `Rainy / Dry / Hot / All`, while the other apps use `Wet Season / Dry Season`.

### Crop Cycles

- **Medium: Status badge colours reuse the same palette for different meanings.** `STATUS_TONE` in `components/status-badge.tsx` is one flat map for every vocabulary: Growing = green, Ready to Harvest = amber, Harvesting = blue, Completed = slate, Confirmed = blue, Delivered = green, Pending = amber. So "Harvesting" and "Confirmed" are both blue, and "Delivered" and "Growing" are both green.
- **Low:** Four stat cards all use the same Leaf icon (`cycles/page.tsx`). The Orders page uses one Package icon three times.
- **Low:** Cycle detail shows profit, margin and break-even (A12 note).

### Calendar

- **Medium: No delivery or pickup events.** Event types are only Planting, Harvest, Irrigation, Fertilization (`CALENDAR_EVENT_TYPES`), so confirmed orders, pickups and "handover due today" do not appear. The Agent App's calendar shows deliveries.
- **Low:** Month grid has `min-w-[640px]` and scrolls sideways on narrow tablets. It shows at most 3 events per day with "+n". *(verify in browser)*

### Purchase Orders

- **High: Delete with no confirmation and no reason** (`orders/[id]/page.tsx:93,125`). One click destroys an order and releases its allocations.
- **High: Status controls** (A4). Three overlapping controls (flow button, "Order status" select, "Delivery status" select) allow any jump, including Delivered → Pending, with no reason.
- **High: Status colours for new statuses.** Requested, Declined, Cancelled, Picked up and Completed are not in `STATUS_TONE`. Unknown values fall back to **slate**, so Declined and Cancelled would look grey, not red. The `rose` tone exists but no status uses it. The Buyer App uses amber / blue / green / solid dark green / red / neutral.
- **Medium: List density.** 9 data columns plus Actions at xl (1,280 px and up). At 1366 px with the 240 px sidebar, the content area is roughly 1,080 px. The row would wrap or squeeze. *(verify in browser)*
- **Medium: Row click plus eye icon do the same thing** (redundant action column). Row hover highlight is present ✓. `<tr onClick>` rows have no keyboard focus; only the card view (below `md`) sets `role="button"` and `tabIndex`.
- **Medium: Supply Matching defaults price to the crop reference price** (`supply-matcher.tsx:142`), not the buyer tier. The price field is a free number.
- **Medium: No visible Type or Method.** "Delivery method" is free text on the detail page only.
- **Low: Stat card "Multi-farmer orders"** is a good idea. Keep it, but add Requested / Declined / Cancelled once they exist.

### Settings

- **Medium:** Contains only reference lists, a session card and Reset demo data. No pickup points (A8).
- **Low: Developer notes shown to users**, such as "Authentication is mocked in this phase…" and the footer "Phase 1 · frontend only. Every screen reads through `lib/services`…". The latter reads as unfinished in a demo.

### Tables, charts and responsive (cross-page)

- **Tables:** numeric columns right-align with `tabular-nums` ✓. Currency is whole-dollar for totals and cents for per-kg ✓ but inconsistent with the other apps. Kg is formatted `1,000 kg` ✓. Long text is not truncated in table cells (only on card view) *(verify in browser)*.
- **Charts:** The Harvest chart has a table toggle ✓, a peak-only label, three y-ticks and no year on month labels. With the current seed it works but shows one bar. Bars are capped at 24 px wide (`max-w-6`). The Supply Forecast and calendar grid were not compared against the new demo data.
- **Responsive:** sidebar is fixed 240 px from `lg` (1,024 px) and a slide-over drawer below; tables turn into stacked cards below `md` (768 px) ✓; dialogs go full screen on phones ✓. At 1366 px the persistent sidebar is shown. Tablet portrait (768–1,023 px) gets the drawer with the full table view. *(verify in browser)*
- **Accessibility:** icon-only buttons in lists have `aria-label`s ✓. Focus rings exist on buttons and inputs (`focus-visible:ring-3`) ✓. The bell button has a label but no function (above). Chart bars are focusable buttons with labels ✓.
- **Unfinished markers:** no lorem ipsum or TODO strings found. Dead bell button (above). Developer footnotes (Settings). Create-next-app SVGs left in `public/`. `tsc` and `eslint` report nothing, but no runtime console was available.

---

## 5. Suggested order of work

**Data and missing features first**

1. **Decide the shared order codes** (the PO-0006 / REQ-0006 clash, REQ-0011 delivery vs pickup, the PO-0009 date and the PO-0004 / PO-0008 pickup details). Fix the two mini apps so they agree. The portal can then copy one source of truth.
2. **Re-model orders**: one status field with the six shared values, `kind` (Order now / Request), `deliveryMethod` (Delivery / Pickup), `confirmedKg`, `declineReason` / `cancelReason`, requirements, pickup and handover. Add "Picked up" labelling and a distinct tone for each status in `status-badge.tsx`.
3. **Re-seed the portal** from the Buyer and Agent data: buyer "Fresh Market Ltd.", the 10 shared orders, the Kampong Cham farmers and plots, 7 catalog crops, buyer tiers, 25 cycles or a trimmed subset, cycles with production details. Add Kang Meas and Srey Santhor to `lib/address.ts`. Label sample data as sample. Bump `SCHEMA_VERSION` so existing browsers pick it up.
4. **Requests page** with REQ codes, Decline (reason), Confirm (reuse Supply Matching with the tier price) and "Other crop" with Not in catalog / Add to catalog. Include the "Farmer can meet this" check.
5. **Crop Management**: spec editor and the three tier prices, replacing the single reference price on orders.
6. **Pickup**: pickup points list in Settings (meeting points only), Pickup arrangement panel on pickup orders with "Save and share with buyer".
7. **Quality panel** on order detail (handover per farmer line, buyer feedback, quality log).
8. **Buyers page** (list, detail, orders and requests).
9. **Certificates**: sharing setting, image upload, approve buyer-safe copy.
10. **Order safety**: confirmation for Delete, reasons for Cancel and Decline, and a controlled status flow that replaces the free selects.

**Polish last**

11. Branding: replace DOJOLOGY (sidebar, login), add the ARG TECH logo and favicon, set per-page tab titles, remove unused scaffold SVGs.
12. Dashboard: seed harvest history across months, fix the "vs last month" logic for partial months, rename Active Crops, add a "Requests waiting" card and an overdue-harvest list, show cents on totals.
13. Remove or wire up the notification bell. Add Buyers and Requests to the sidebar.
14. Add delivery and pickup events to the Calendar.
15. Table polish at 1366 px (trim Orders columns, keyboard access on clickable rows), Settings developer notes, and the remaining small items above.
16. Open the portal in a browser at 1366 px and tablet widths and check the *(verify in browser)* items, including contrast and console messages.
