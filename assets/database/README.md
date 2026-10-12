# Rental Ads Database: guide for the assistant building the Jekyll site

You are helping the user build a **Jekyll site on GitHub Pages** that uses this
folder as its data source. This file explains what the data is, what every
field means, what is missing or unreliable, how to build filters from it, and
how to use it in Jekyll. The user does not want to explain the data again;
treat this file as the source of truth. If something here contradicts the
files, trust the files and tell the user.

**Talk to the user in Turkish.** The data is mostly Turkish (labels, place
names, descriptions), and the site UI should be Turkish unless told otherwise.

---

## 1. Background and goal

- The user is looking for a **2+1 flat to rent in Ankara**, Türkiye.
- They will work at **ODTÜ Teknokent** (Üniversiteler Mah., Çankaya; lat
  39.8966714, lon 32.7736614). On weekdays they must **arrive by 08:50** and
  they **leave work at 18:00**. **Commute time is the most important
  criterion**, then price, then the flat and building features.
- Two commute modes are modelled:
  - **Car:** driven door to door, including onto the campus.
  - **Public transit:** EGO bus/metro to **ODTÜ A2 Metro Kapısı** (the campus
    gate by Bilkent metro station), then the **METU campus ring** to
    Teknokent. The ring is counted as a fixed **15 minutes** (wait + ride),
    which is an assumption.

  Walking was dropped: no ad is within walking distance.
- The site is a **personal comparison tool**. The user will use it on an
  unlisted URL and share it with a few friends. It needs strong **filtering**
  (sliders and checkboxes), **sorting**, **side-by-side comparison**, a
  **map**, and the user's **personal notes** per ad.
- The data comes from **91 rental ads on sahibinden.com**. The user saved
  each page as HTML, and a Python script (`extract_ads.py`, one folder up, not
  part of the site) converted them into the JSON/CSV in this folder. Listing
  dates run from mid-September to mid-October 2026, and the data was
  extracted on 2026-10-11/12. It is a **snapshot**: real prices and
  availability may have changed.
- All 91 ads are 2+1 flats in Ankara: Etimesgut (58), Yenimahalle (22),
  Çankaya (11). Rent is 28,000–47,500 TRY/month.

---

## 2. Folder layout

```
database/
├── README.md              this file
├── index.json             ★ one row per ad + field metadata: build lists, filters, map from this
├── index.csv              same rows as CSV (UTF-8 with BOM; list fields joined with "; ")
├── notes_template.json    empty personal-notes template, see section 5
├── commute_cache.json     internal cache of Google API results: do not use or publish
└── <AD_ID>/               one folder per ad, e.g. 1337845394/
    ├── ad.json            full record of the ad
    └── photos/
        ├── x5_<code>.jpg           one large photo per ad (528×396)
        └── thumbs/thmb_<code>.jpg  all photos as thumbnails (100×75)
```

- `AD_ID` is the sahibinden.com ad number: a **string** of 10 digits. Always
  handle it as a string.
- **Every path inside `ad.json` is relative to that ad's folder.** For example,
  `photos/thumbs/thmb_1337845394o7k.jpg` lives at
  `database/1337845394/photos/thumbs/thmb_1337845394o7k.jpg`.
- `index.json` → `ads[].ad_json` is relative to `database/`, e.g.
  `"1333099884/ad.json"`.
- Total size is about 21 MB (91 folders, about 2,400 small JPEGs).
  `index.json` alone is about 420 KB (much less gzipped), so it is fine to load
once on page load.

---

## 3. `index.json` (everything the list, filter and map UI needs)

```json
{
  "generated_at": "2026-10-11T21:30:00+00:00",
  "count": 91,
  "fields": ["id", "title", "price_value", ...],          // column order (117 fields)
  "field_info": { "price_value": {...}, ... },             // UI metadata, see 3.1
  "feature_catalog": { "İç Özellikler": [...], ... },      // all ~150 checklist options, see 3.4
  "ads": [ { ...one flat row per ad... } ]                 // sorted by price, cheapest first
}
```

Every row has **all 117 fields**; unknown values are `null`. You do **not**
need to load the 91 `ad.json` files to filter or sort. Load them only for the
detail view (description, photos, route steps, contact).

### 3.1 `field_info`: build the filter UI from this, don't hard-code it

```json
"price_value":     {"label": "Kira", "group": "Fiyat", "filter": "range", "unit": "TL",
                    "min": 28000, "max": 47500, "missing": 0},
"daily_transit_min": {"label": "Günlük toplu taşıma (sabah + akşam)", "group": "Yolculuk",
                    "filter": "range", "unit": "dk", "min": 81, "max": 161, "missing": 0},
"has_pool":        {"label": "Havuz", "group": "Bina & Site", "filter": "boolean", "unit": null,
                    "true_count": 12, "unknown": 30},
"district":        {"label": "İlçe", "group": "Konum", "filter": "multi", "unit": null,
                    "options": ["Etimesgut", "Yenimahalle", "Çankaya"]}
```

| `filter` | UI control | Extra keys |
|---|---|---|
| `range` | slider (min–max, or "max X" for times and prices) | `min`, `max`, `missing` (number of ads with `null`) |
| `boolean` | tri-state: Farketmez / Olsun / Olmasın | `true_count` (ads with true), `unknown` (ads with `null` = no information). Hide options with `true_count` 0. |
| `multi` | multi-select / chips | `options` (most frequent first). `facing` values are lists: match if any selected value is in the list. |
| `text` | free-text search | |
| `time` | display only (`"HH:MM"` strings); could also be a "leave home no earlier than" slider | |
| `date` | display / sort (`YYYY-MM-DD`) | |
| `list` | display (e.g. `auto_pros`, `auto_cons`) | |
| `features` | `features_all`: every trusted ticked feature. Build one filter per option from `feature_catalog` (3.4). | |
| `none` | not a filter (ids, coordinates, raw text) | |

`group` values (Turkish, use them as filter panel sections): `Fiyat`,
`Yolculuk`, `Konum`, `Daire`, `Bina & Site`, `Çevre (ilan beyanı)`, `Satıcı`,
`Artı / Eksi`, `Diğer`.

**Nulls in range filters.** `dues` is missing for 35 ads and `deposit` for 17.
When a slider is moved off its extreme, decide whether ads with `null` pass.
Recommended: they pass, with an "unknown" badge, plus a checkbox "hide ads
with unknown values". Every other range field has `missing: 0`.

### 3.2 The filters the user explicitly asked for

| User wants | Field(s) | Notes |
|---|---|---|
| Max rent slider | `price_value` (or `monthly_cost` = rent + dues) | `monthly_cost` treats unknown dues as 0; show a hint when `dues_known` is false. |
| Max morning commute slider | `am_transit_min`, `am_drive_min` | Morning = home → work, arriving by 08:50. |
| Max evening commute slider | `pm_transit_min`, `pm_drive_min` | Evening = work → home, leaving at 18:00. |
| Max total daily commute slider | `daily_transit_min`, `daily_drive_min` | Morning + evening. **Best single ranking metric.** |
| Has pool | `has_pool` (12 ads true, 30 unknown); `has_indoor_pool` (11) | |
| Has gym / fitness | `has_gym` (26): sports area **inside the complex**; `near_gym` (44): gym **in the neighbourhood** | Two different things; label them clearly. |
| In a gated complex | `in_complex` (83) | |
| From owner (no agency fee) | `is_owner` (9) | "Sahibinden" = posted by the owner, so usually no agency commission. |

Make the commute sliders switchable between **transit** and **car** (a toggle
"Toplu taşıma / Araç" that swaps which fields the sliders use). The user may
have a car or not; default to transit and keep the toggle visible.

**Additional filters recommended (the user asked you to include these too).**
The `field_info` labels are already Turkish.

| Kind | Fields |
|---|---|
| Sliders, price | `monthly_cost`, `price_per_m2_net`, `deposit_months` (deposit as months of rent, 0.8–2.1), `move_in_cost` (first rent + deposit) |
| Sliders, commute | `am_transit_transfers` (max transfers), `am_transit_first_walk_min` (max walk to the first stop), `pm_transit_wait_min` (max evening wait), `am_drive_traffic_min` |
| Sliders, flat | `area_net_m2` (min), `building_age_min` (max), `floor` (range), `bathrooms` |
| "Leave home no earlier than" | `am_leave_transit` / `am_leave_drive` (`"HH:MM"`; compare as strings) |
| Multi-select | `district`, `neighborhood`, `heating`, `facing`, `energy_class` |
| Quick toggles (top of panel) | `is_owner`, `in_complex`, `has_pool`, `has_gym`, `furnished`, `separate_kitchen`, `has_closed_parking`, `elevator`, `transit_uses_rail` |
| Everything else boolean | grouped collapsible checkboxes by `group` |

**Booleans should be tri-state** (Farketmez / Olsun / Olmasın), not just
"must have". Some fields are things to *avoid*: `has_squat_toilet`
(alaturka tuvalet), `tenant_inside` (currently rented, so the move-in date
is unclear), `is_ground_floor`.

Also add a free-text search over `title`, `neighborhood`, `complex_name` and
`features_all`.

### 3.3 All index fields by group

Labels and units are in `field_info`; this is what they mean.

**Fiyat (price):**
- `price_value` (monthly rent, int), `price_currency` (`"TRY"`), `price_raw`
  (`"28.000 TL"`; Turkish uses `.` as the thousands separator).
- `monthly_cost`: rent + dues.
- `dues`: "aidat", the monthly building fee; null = not stated.
  `dues_known` is a bool.
- `deposit`: "depozito"; null = not stated.
- `price_per_m2_net`: rent / net m².
- `deposit_months`: deposit / rent, e.g. 1.0 or 2.0.
- `move_in_cost`: rent + deposit. null when the deposit is unknown. Agency
  commission is not included.

**Yolculuk (commute; from Google Maps, see 4.1):**
- `am_*`: morning (arrive by 08:50). `pm_*`: evening (leave work at 18:00).
- `*_drive_min`: car, door to door, with predicted traffic.
- `*_transit_min`: pure travel time, home ↔ A2 gate by EGO plus the 15-min
  ring, **excluding** any wait for the first vehicle.
- `daily_transit_min`, `daily_drive_min`: am + pm. **The main ranking
  metric.** Ranges: transit 81–161, car 38–86.
- `pm_transit_wait_min`: minutes from leaving work (18:00) until the first
  vehicle actually departs (1–28, median 6). The real arrival home already
  includes it.
- `am_transit_transfers`, `pm_transit_transfers`: EGO transfers (0–1). The
  ring is not counted.
- `am_transit_walk_min`, `pm_transit_walk_min`: walking inside the transit
  trip (to the first stop, between vehicles, last stop to the gate).
- `am_transit_first_walk_min`: walk from home to the first stop (0–15).
- `am_transit_lines`, `pm_transit_lines`: e.g. `"563 → 641-1 → Ring"`. These
  are EGO bus / metro / Ankaray line numbers in order, with the campus ring
  shown as "Ring".
- `transit_uses_rail`: true if the trip uses metro, Ankaray or Başkentray.
- `am_leave_transit`, `am_leave_drive`: when to leave home (`"HH:MM"`). For
  transit this comes from the real bus timetable, so it can be earlier than
  08:50 minus the travel time.
- `pm_arrive_transit`, `pm_arrive_drive`: real arrival home after leaving
  work at 18:00.
- `am_drive_traffic_min`: minutes the morning traffic adds (1–15).
- `distance_to_work_km`: straight line ("kuş uçuşu"), **not** road distance.
- `drive_km`, `transit_km`: route lengths (morning).

**Konum (location):** `city` (always Ankara), `district`, `neighborhood`,
`latitude`, `longitude`. The coordinates are the advertiser's map pin, so they
are approximate.

**Daire (flat):**
- `area_net_m2`, `area_gross_m2`, `rooms` (always 2), `living_rooms`
  (always 1), `bathrooms`.
- `floor`: 0 = entrance or garden floor, negative = basement.
- `floor_count`: floors in the building; "30 ve üzeri" (30 or more) is
  stored as 30.
- `is_ground_floor`, `is_top_floor` (0 ads).
- `building_age_min`, `building_age_max`: from ranges like "6-10 arası";
  `max` is null for "31 ve üzeri" (31 or more). Use `building_age_min` for
  sliders.
- `heating`: "Kombi (Doğalgaz)" = own gas boiler, "Merkezi" = central,
  "Merkezi (Pay Ölçer)" = central with per-flat meters, "Yerden Isıtma" =
  underfloor.
- `furnished` ("eşyalı").
- `separate_kitchen`: closed kitchen, as opposed to an open "Amerikan" one.
- `balcony`, `has_closed_balcony` (glass-enclosed balcony), `has_ensuite`
  (en-suite bathroom, "ebeveyn banyosu").
- `has_white_goods`: at least one of fridge, washing machine or dishwasher
  is included. Also `has_dishwasher`, `has_washing_machine`.
- `has_built_in_kitchen`, `has_ac`, `has_built_in_wardrobe`,
  `has_dressing_room`, `has_fiber` (fiber internet), `has_smart_home`.
- `has_double_glazing` (Isıcam / PVC windows, i.e. warmer),
  `has_steel_door`, `has_video_intercom`.
- `has_squat_toilet`: there is an "alaturka" (squat) toilet, usually a
  negative.
- `south_facing`, `facing` (list: Doğu = east, Batı = west, Kuzey = north,
  Güney = south).
- `energy_class`, `tenant_inside`: a tenant currently lives there, so the
  move-in date is uncertain.

**Bina & Site (building and complex):**
- `in_complex`, `complex_name`, `elevator`, `has_parking`,
  `has_closed_parking`.
- `has_pool`, `has_indoor_pool`, `has_gym`, `has_sauna` (sauna, hamam or
  steam room), `has_security` (24 h security), `has_camera`,
  `has_concierge` ("kapıcı"), `has_generator`, `has_playground`,
  `has_ev_charger`, `has_tennis`, `has_insulation`.
- `has_sound_insulation`.
- `has_water_tank`: water tank or booster pump; useful because Ankara has
  occasional water cuts.

**Çevre (surroundings), as declared by the advertiser:** `metro_nearby`,
`train_nearby`, `bus_stop_nearby`, `near_market`, `near_mall`, `near_bazaar`
(weekly street market), `near_gym`, `near_park`, `near_hospital`,
`near_school`, `view_city`, `view_nature`. These are ticked by the advertiser and not
verified. For real accessibility, trust the commute fields instead.

**Satıcı (seller):**
- `is_owner`.
- `seller_type`: `"corporate"` = agency (82), `"individual"` = owner (9).
- `seller_name`.

**Artı / Eksi (automatic pros/cons, see 3.4):**
- `auto_pros`, `auto_cons`: lists of Turkish strings.
- `pros_count`, `cons_count`.
- `checklist_quality`: `"filled"` (64 ads), `"empty"` (26: the advertiser
  ticked nothing in İç/Dış Özellikler) or `"all_ticked"` (1: everything
  ticked, unreliable). Show the empty and all-ticked cases as a warning badge
  ("Özellik listesi boş" / "Her şey işaretli").

**Diğer (other):** `id`, `title`, `listing_date`, `photo_count`,
`features_all` (every ticked feature in Turkish, excluding unreliable
all-ticked groups), `ad_json`.

**How the boolean flags are derived.** Each comes from the ticked features in
the ad (`ad.json → classified_detail.features`) or from its info table. For
example, `has_pool` is true if "Yüzme Havuzu (Kapalı)", "Yüzme Havuzu (Açık)"
or "Müstakil Havuzlu" is ticked.
- **`true`** = ticked.
- **`false`** = the advertiser filled in that checklist group but didn't
  tick it. That probably means "doesn't have it", but it isn't certain.
- **`null`** = unknown: that checklist group was empty or all-ticked for
  this ad.

Tri-state filters: "Olsun" keeps `true`; "Olmasın" keeps `false`. Ads with
`null` should be **kept with an "unknown" badge** by default, plus an option
"bilinmeyenleri gizle" (hide unknown ones). Otherwise the 26 ads with empty
checklists silently vanish from every feature filter.

### 3.4 All checklist features as filters + automatic pros/cons

**`feature_catalog`** lists every option of sahibinden's checklist, per group,
in the site's order. It is identical for all ads: Cephe 4, İç Özellikler 53,
Dış Özellikler 25, Muhit 24, Ulaşım 18, Manzara 8, Konut Tipi 8, Engelliye
ve Yaşlıya Uygun 13.

```json
"feature_catalog": {"Ulaşım": [
  {"name": "Metro", "count": 46, "important": true, "negative": false, "relevant": true},
  {"name": "Marmaray", "count": 0, "important": false, "negative": false, "relevant": false}, ...]}
```

- `count` = ads that ticked it (from trusted lists).
- `important`: used for the automatic cons (below). Always false in Dış
  Özellikler.
- `negative`: a drawback when ticked (e.g. Alaturka Tuvalet).
- `relevant: false`: Istanbul or seaside options that mean nothing in
  Ankara (Marmaray, Boğaz Köprüleri, Denize Sıfır…). **Hide these.**

**The user wants every feature to be filterable.** Build an "Özellikler"
filter section:
- One collapsible block per group, one tri-state chip per relevant option,
  with `count` shown.
- Match against the row's `features_all` (exact Turkish names; names are
  unique across groups).
- Ads whose `checklist_quality` isn't `"filled"` count as unknown, as above.
- Sort chips by `count` descending, or put `important` ones first.
- Hide options with `count` 0, or show them disabled.

The curated booleans (`has_pool`, `metro_nearby`, …) are shortcuts for the
most important ones. Keep them as quick toggles at the top.

**Automatic pros/cons** (`auto_pros` / `auto_cons` in the index, and
`ad.json → auto_review` with `checklist`, `pros`, `cons`, and `unticked` =
all unticked options per group). They come from **three groups: İç
Özellikler, Muhit and Ulaşım**. **Dış Özellikler is deliberately excluded**
(the user's decision). Its features (pool, gym, security, generator…) are
still available as filters, just not as pros/cons.
- **Pros** = every ticked feature, with the important ones first. Neutral
  civic/religious items (Cami, Belediye…) and irrelevant ones are skipped.
  Median 24 items, up to 52: show the first 8–10 with "+N daha" (N more).
- **Cons** = for each important item (12 curated groups such as "Isıcam /
  PVC doğrama", "Çelik kapı", "İnternet altyapısı", "Raylı sistem (metro /
  tren)", "Market"),
  `"<label> işaretli değil"` (not ticked) when none of its features is
  ticked, plus ticked negatives ("Alaturka tuvalet var", "Şofbenli…",
  "Marley zemin", "Ahşap doğrama…").
  - The wording "işaretli değil" deliberately avoids claiming the feature is
    absent.
  - A group whose list is empty or all-ticked yields a single con instead,
    e.g. "İç Özellikler listesi doldurulmamış (bilinmiyor)".
- Typical: 0–11 cons, median 3.
- The curated lists (`IMPORTANT_FEATURES`, `NEGATIVE_FEATURES`,
  `NEUTRAL_FEATURES`, `IRRELEVANT_FEATURES`) are at the top of
  `extract_ads.py`. The user can edit them and re-run.
- Show pros as green chips and cons as red/amber chips on the detail page,
  and the first 3 of each on cards and in the compare table.

---

## 4. `<AD_ID>/ad.json` (full record, for the detail view)

All 91 files have **the same top-level keys**; missing data is `null`.

```text
schema_version      1
id, title           as in the index
source_url          original sahibinden.com URL (may no longer exist); link it as "İlanı aç"
source_file         path on the user's PC; ignore
extracted_at        ISO timestamp of the extraction run
price               {value, currency, raw}
location            {city, district, neighborhood, parts[], raw, latitude, longitude}
distance_to_work    {to, to_latitude, to_longitude, straight_line_km, method}
commute             see 4.1
details             original Turkish label → value pairs, see 4.2
details_normalized  typed English-key version of details, see 4.2
flags               the same derived booleans and numbers as in the index (section 3.3)
contact             see 4.3 (personal data!)
classified_detail   {description, features, certification, other_sections}, see 4.4
location_tab        {map_details, region_info, demographics}, see 4.5
photos              see 4.6
photo_count         int
```

### 4.1 `commute`

From the Google Maps Routes API, computed **once** for Monday 2026-10-12 and
cached. Driving uses Google's traffic prediction for that time; transit uses
EGO timetables. Real values of ad 1312885836:

```json
"commute": {
  "to": "ODTÜ Teknokent", "to_latitude": 39.8966714, "to_longitude": 32.7736614,
  "source": "Google Maps Routes API",
  "ring": {"stop": "ODTÜ A2 Metro Kapısı (Bilkent metro)", "latitude": 39.9073794,
           "longitude": 32.7650499, "minutes": 15,
           "applies_to": "transit (EGO to the ring stop, then campus ring)"},
  "morning": {
    "description": "home -> work, arrive by 08:50",
    "drive":   {"route_found": true, "distance_km": 25.18, "duration_min": 35,
                "duration_without_traffic_min": 26, "leave_at": "08:10", "arrive_at": "08:44", ...},
    "transit": {"route_found": true, "distance_km": 17.09, "duration_min": 55,
                "to_ring_stop_min": 40, "ring_min": 15,
                "leave_at": "07:40", "arrive_at": "08:35", ...},
    "transit_route": {                                  // step-by-step plan
      "route_found": true, "computed_for": "2026-10-12",
      "duration_min": 55, "to_ring_stop_min": 40, "ring_min": 15,
      "transfers": 1, "walk_min": 13, "lines": "563 → 641-1 → Ring",
      "vehicles": ["Otobüs"], "uses_rail": false,
      "first_stop": "İstanbul Yolu Metro İstasyonu",
      "leave_at": "07:40", "arrive_at": "08:35",
      "segments": [
        {"mode": "walk", "minutes": 9, "distance_m": 661},
        {"mode": "ride", "vehicle": "BUS", "vehicle_tr": "Otobüs", "line": "563",
         "line_name": "Kahramankazan - Sihhiye", "headsign": "Adliye",
         "from_stop": "İstanbul Yolu Metro İstasyonu", "to_stop": "Hava Kuvvetleri Müzesi",
         "departure_time": "07:50", "arrival_time": "07:58", "stop_count": 10,
         "minutes": 8, "distance_m": 5827},
        {"mode": "ride", "line": "641-1", "from_stop": "Hava Kuvvetleri Müzesi",
         "to_stop": "Diyanet İşleri Başkanlığı", "departure_time": "08:03",
         "arrival_time": "08:17", ...},
        {"mode": "walk", "minutes": 4, ...},
        {"mode": "ring", "minutes": 15, "from_stop": "ODTÜ A2 Metro Kapısı (Bilkent metro)",
         "to_stop": "ODTÜ Teknokent"}
      ]
    }
  },
  "evening": {
    "description": "work -> home, leave work at 18:00",
    "drive":   {"duration_min": 33, "leave_at": "18:00", "arrive_at": "18:33", ...},
    "transit": {"duration_min": 52, "wait_min": 23, "leave_at": "18:00", "arrive_at": "19:16", ...},
    "transit_route": {"lines": "Ring → 641-1 → 502", "wait_min": 23,
                      "leave_ring_stop_at": "18:38", "leave_at": "18:00", "arrive_at": "19:16",
                      "segments": [{"mode": "ring", ...}, {"mode": "walk", ...},
                                   {"mode": "ride", ...}, ...], ...}
  },
  "daily_total_min": {"drive": 68, "transit": 107}
}
```

How to read it:
- **`duration_min` is pure travel time**: EGO time + 15-min ring for transit,
  door to door for driving. It is the comparable number used in the index and
  in `daily_total_min`.
- **Clock times are real.**
  - Morning `transit.leave_at` comes from the actual bus departures. Leaving
    then gets you to work by `arrive_at` (≤ 08:50). Buses don't run exactly
    when you'd like, so this can be earlier than 08:50 minus the duration.
  - Evening: you leave work at 18:00, take the ring (15 min), then may wait
    `wait_min` for the first EGO vehicle (it departs at
    `leave_ring_stop_at`). `arrive_at` is the real arrival home.
- `duration_min - duration_without_traffic_min` (driving only) = minutes lost
  to traffic.
- `to_ring_stop_min` is the EGO part only; `ring_min` is the assumed ring
  time (15).
- Times are Turkey local time (UTC+3), `HH:MM`.
- Render `transit_route.segments` as a timeline, e.g.
  🚶 9 dk → 🚌 563 (07:50 İstanbul Yolu Metro → 07:58 Hava Kuvvetleri
  Müzesi) → 🚌 641-1 (08:03 → 08:17 Diyanet İşleri) → 🚶 4 dk → 🚐 Ring
  15 dk.
  - Segment `mode` is `walk`, `ride` or `ring`.
  - Ride icons by `vehicle`: BUS / SHARE_TAXI → bus; SUBWAY / METRO_RAIL /
    LIGHT_RAIL / TRAM → metro; HEAVY_RAIL / COMMUTER_TRAIN → train.
  - `vehicle_tr` is the Turkish name. Lines like "A1" are Ankaray and
    "M1-2-3" is the metro.
- **Assumptions to show in the UI** (small info note near commute numbers):
  - The ring is a fixed 15 min. METU ring timetables change by semester, and
    Google's data has no campus rings.
  - Times are for one specific weekday.
  - Transit trips end at the Diyanet İşleri Başkanlığı (47 ads) or Bilkent
    (43) stop, then a 1–5 min walk to the A2 gate.
- All 91 ads have `route_found: true` for car and transit, morning and
  evening.
- Script options (for the user, not the site): `--ring-min 10`, a different
  gate with `--ring-lat/--ring-lon/--ring-name`, or `--no-ring` (walk from
  the last stop instead). Changing them re-fetches only what's needed.

### 4.2 `details` and `details_normalized`

`details` keeps the ad's info table **exactly as shown on the site**: Turkish
labels as keys, string values. 24 labels (one ad lacks "Asansör"):

| Label | Meaning | Label | Meaning |
|---|---|---|---|
| İlan No | ad number | Banyo Sayısı | bathrooms |
| İlan Tarihi | listing date ("02 Ekim 2026") | Mutfak | kitchen: "Açık (Amerikan)" open / "Kapalı" closed |
| Emlak Tipi | property type ("Kiralık Daire", "Kiralık Rezidans") | Balkon | balcony: Var / Yok |
| m² (Brüt) | gross m² | Asansör | elevator: Var / Yok |
| m² (Net) | net m² | Otopark | parking: Açık / Kapalı / Açık & Kapalı / Yok |
| Oda Sayısı | rooms ("2+1") | Eşyalı | furnished: Evet / Hayır |
| Bina Yaşı | building age | Kullanım Durumu | occupancy: "Boş" empty / "Kiracılı" tenant inside |
| Kat Sayısı | floors in building | Site İçerisinde | in complex: Evet / Hayır |
| Bulunduğu Kat | the flat's floor | Site Adı | complex name |
| Isıtma | heating | Aidat (TL) | monthly building fee |
| Depozito (TL) | deposit | Enerji Kimlik Belgesi | energy class |
| Tapu Durumu | deed type | Kimden | listed by: "Emlak Ofisinden" agency / "Sahibinden" owner |

Words: "Var" = present, "Yok" = absent, "Evet" = yes, "Hayır" = no,
"Belirtilmemiş" = not specified.

`details_normalized` holds the same data with English keys and typed values
("Belirtilmemiş" becomes `null`). It is useful for a details table in the
detail view; the index already contains these values for filtering. In
Liquid, keys with spaces or `²` need bracket access:
`ad.details["m² (Net)"]`.

### 4.3 `contact`: personal data, see section 7

```json
{"seller_type": "corporate" | "individual", "name": "Başak B.",
 "office_name": "BAŞAK EMLAK", "office_url": "...", "license_no": "0602074",
 "member_since": "Eylül 2014",
 "phones": [{"label": "İş", "number": "0 (312) 283 02 05"},     // İş = work, Cep = mobile
            {"label": "Cep", "number": "0 (532) 224 52 84"}],
 "all_ads_url": "...", "message_url": "https://www.sahibinden.com/ilan-sahibine-soru-sor/<id>"}
```

### 4.4 `classified_detail`

- `description`: the advertiser's free text, plain text with `\n`. Often ALL
  CAPS. Render with `white-space: pre-line` and **escape it**.
- `feature_options`: `{group: [every option offered]}`, the same for every
  ad. Unticked = `feature_options` minus `features`.
- `features`: `{group: [ticked features]}` with 8 groups: `Cephe` (facing),
  `İç Özellikler` (interior), `Dış Özellikler` (building/exterior), `Muhit`
  (neighbourhood), `Ulaşım` (transport), `Manzara` (view), `Konut Tipi`
  (housing type), `Engelliye ve Yaşlıya Uygun` (accessibility). Show them as
  chips grouped by heading in the detail view.
- `certification`: licence box (low value). `other_sections`: always `null`.

### 4.5 `location_tab`

- `map_details`: `latitude`, `longitude`, `town_name`, `quarter_name`,
  `directions_url` (Google Maps directions; useful as a button),
  `street_view_url`.
- `region_info`, `demographics`: **`null` for all ads** (they were not loaded
  when the pages were saved). Don't build UI for them.

### 4.6 `photos`

```json
"photos": [
  {"index": 1, "large": "photos/x5_1127501350k8o.jpg",
   "thumbnail": "photos/thumbs/thmb_1127501350k8o.jpg", "remote_url": null},
  {"index": 2, "large": null, "thumbnail": "photos/thumbs/thmb_1127501350p15.jpg",
   "remote_url": "https://i0.shbdn.com/photos/50/13/50/x5_1127501350p15.jpg"}
]
```

- **Every ad has exactly one local large photo** (`photos[0].large`,
  528×396); use it for cards. The others are local **100×75 thumbnails**
  only. Don't upscale them; show them as a small strip.
- `remote_url` is the large version on sahibinden's CDN. It may break when
  the ad is removed, or be blocked as hot-linking. Use it only with a
  thumbnail fallback (`onerror`).

---

## 5. Personal notes (`notes_template.json`)

The user wants to track their own progress per ad. **Keep notes outside this
folder**, because `database/` is regenerated.

```json
{"_statuses": ["new", "interested", "contacted", "visit_planned", "visited",
               "rejected", "no_longer_listed"],
 "ads": {"1312885836": {"status": "new", "favorite": false, "rating": null,
                        "visited_on": null,
                        "pros": ["Isıcam", "PVC Doğrama", "Çelik Kapı", ...],
                        "cons": ["Alaturka tuvalet var"], "note": ""}, ...}}
```

**`pros` / `cons` are lists, pre-filled with the automatic `auto_pros` /
`auto_cons`.** The user then edits them: deletes the irrelevant ones and adds
their own impressions after a visit ("güneş almıyor", "komşular gürültülü").

- Copy it **once** to the site as `assets/notes.json` (outside
  `assets/database/`). The user then edits that file, for example in
  GitHub's web editor. Friends see the same notes.
- The site merges the notes into the ads by `id`. An id with no entry
  (e.g. a newly added ad) gets the defaults: status "new", and pros/cons
  taken from that ad's `auto_pros` / `auto_cons` in the index.
- Show the user's pros/cons (from notes) on the detail page. Indicate when
  they're still identical to the automatic ones ("otomatik").
- Suggested UI: a status badge and favourite star on cards; filters
  "only favourites" and "hide rejected"; `rating` 1–5; and on the detail
  view, pros/cons lists plus the note.
- Status labels in Turkish: new = Yeni, interested = İlgileniyorum,
  contacted = Arandı, visit_planned = Gezme planlandı, visited = Gezildi,
  rejected = Elendi, no_longer_listed = İlan kalktı.
- Optional: let the user edit notes in the browser and keep them in
  `localStorage`, with an "export JSON" button they can paste into
  `assets/notes.json`. The site is static, so it can't write to the repo
  itself.

---

## 6. Using it in Jekyll on GitHub Pages

### 6.1 Where to put it

Copy this folder to **`assets/database/`** in the site repo. Jekyll copies
JSON and JPEG files without front matter unchanged. Don't use a folder name
starting with `_`.

```yaml
# _config.yml
exclude:
  - assets/database/README.md          # GitHub Pages plugins would render it as a page
  - assets/database/commute_cache.json
  - assets/database/notes_template.json
```

### 6.2 Reading the data (client-side JS recommended)

Sorting, filtering, sliders and the map need JS anyway, and new ads then need
no Jekyll changes.

```html
<script>
  const DB = "{{ '/assets/database' | relative_url }}";     // handles baseurl on project sites
  const NOTES = "{{ '/assets/notes.json' | relative_url }}";
  async function loadAll() {
    const [index, notes] = await Promise.all([
      fetch(`${DB}/index.json`).then(r => r.json()),
      fetch(NOTES).then(r => r.ok ? r.json() : {ads: {}}).catch(() => ({ads: {}})),
    ]);
    const defaults = {status: "new", favorite: false, rating: null, visited_on: null,
                      pros: "", cons: "", note: ""};
    for (const ad of index.ads) ad.notes = {...defaults, ...(notes.ads?.[ad.id] || {})};
    return index;                       // index.field_info drives the filter panel
  }
  const loadAd = id => fetch(`${DB}/${encodeURIComponent(id)}/ad.json`).then(r => r.json());
  const photoUrl = (id, rel) => `${DB}/${id}/${rel}`;   // rel = photos[i].large / .thumbnail
</script>
```

Detail page: `ad/index.html?id=<id>`. Validate the id with `/^\d+$/`, then
`loadAd(id)`. GitHub Pages can't run custom plugins, so this is simpler than
generating one page per ad. Alternative only if the user wants pages that
work without JS: copy JSON into `_data/` and generate stub pages per ad with
a small script; photos must still be served from `assets/database/`.

### 6.3 Recommended pages and features

1. **Main list + filter panel.**
   - Build the filter panel from `field_info`, grouped by `group`, with the
     section 3.2 filters at the top: max rent, max morning, max evening, max
     daily commute, pool, gym, complex, owner.
   - Show the result count live.
   - Sort options: daily transit, daily car, rent, monthly cost, rent/m²,
     net m², building age, listing date.
   - Ask the user for the default sort (probably daily transit).
   - Persist filter state in the URL query string so filtered views can be
     shared with friends.
2. **Map** (Leaflet + OpenStreetMap tiles from a CDN with a pinned version).
   - One marker per ad, coloured by `daily_transit_min` (green to red), plus
     a distinct marker for ODTÜ Teknokent.
   - Show only the currently filtered ads.
   - Popup: photo, rent, commute, link to detail.
3. **Detail view.**
   - Hero photo and thumbnail strip, rent and monthly cost.
   - Commute block: morning and evening for transit and car, the transit
     timeline from `transit_route.segments`, the traffic delay, the evening
     wait, and "leave home at … / home at …".
   - Details table, feature chips, description.
   - Buttons: `source_url` (İlanı aç), `directions_url`.
   - The notes.
4. **Compare view.** Pick 2–4 ads (checkboxes on cards, kept in
   `localStorage`) and show a table with ads as columns and fields as rows.
   Highlight the best value per row (lowest commute, lowest rent, largest
   m²) and show booleans as ✓ / –.
5. Optional **score**: weighted sum of normalized `daily_transit_min`,
   `monthly_cost` and `area_net_m2`, with weight sliders. Ask the user before
   making it the default.

Formatting:
- Money: `28.000 ₺` (`Intl.NumberFormat('tr-TR')`).
- Dates: `toLocaleDateString('tr-TR')`.
- Minutes: "1 sa 8 dk" when ≥ 60.
- Use the Turkish labels from `field_info`.

---

## 7. How the data is updated

- Never edit the JSON by hand. `python extract_ads.py` (in the parent folder,
  not in the site) regenerates everything. Re-runs are idempotent, and
  `--clean` rebuilds from scratch but keeps this README.
- New ads: the user saves more sahibinden pages into `ads/` and re-runs the
  script. Commute times and transit routes for new ads are fetched from
  Google automatically (the API key is in `google_maps_api_key.txt` next to
  the script). Existing results come from `commute_cache.json` and are not
  fetched again.
- Then the user copies `database/` over `assets/database/` in the site repo.
  `assets/notes.json` is not touched by this.
- **This is automated by `guncelle.bat` / `guncelle.ps1`** in the data
  project. It runs `extract_ads.py`, then copies to `<site>/assets/database/`:
  - by default **only ad folders not yet on the site**, plus `index.json`,
    `index.csv`, `notes_template.json` and `README.md`;
  - it deletes site ad folders that are no longer in the database;
  - existing ad folders are left untouched, so an older ad's `ad.json` may
    lack a field added later. Code defensively (`?.`, defaults);
  - with `-Full` it mirrors everything (robocopy /MIR, without
    `commute_cache.json`).

  It creates `assets/notes.json` only if it doesn't exist. It then runs
  **the site's `bin/strip_contacts.py`** on that copy (falling back to its
  own `strip_contact.py` if the site has none). With `-Push` it commits only
  `assets/database` and `assets/notes.json`, then pushes.
  - Keep `bin/strip_contacts.py` at that path and runnable as
    `python bin/strip_contacts.py <database-dir>`.
  - Design the site so that data refreshes need no code changes.
- `extracted_at` and `generated_at` change on every run, so git diffs will
  show them changing even when nothing else did.
- If you add post-processing for the site (e.g. stripping contact data,
  section 8), make it a small script the user re-runs after each copy, not a
  manual edit.

---

## 8. Privacy and safety

- The user plans an unlisted URL shared only with friends. But on the
  **GitHub Free plan, Pages can only be published from a public
  repository**, so anyone could browse the repo and its data. With GitHub
  Pro the repo can be private, but the site is still readable by anyone who
  has the URL.
- `contact` holds **real names and phone numbers** of estate agents and of
  **9 private individuals**. Recommend stripping `contact` (at least `name`
  and `phones`) from the published copy with a small script, and linking to
  `source_url` instead.
- Add `<meta name="robots" content="noindex, nofollow">` to every page and a
  `robots.txt` that disallows everything. If real access control is needed,
  suggest Cloudflare Pages + Cloudflare Access (free, email login) instead
  of GitHub Pages.
- Descriptions and photos are sahibinden.com / advertiser content. Keep the
  site non-public in spirit: no links to it, no indexing.
- **Never commit `google_maps_api_key.txt`.** It sits next to the script,
  outside `database/`; make sure it stays out of the site repo.
- Treat all strings (`title`, `description`, notes) as untrusted: insert them
  with `textContent` or escape them; never use `innerHTML` with raw data.
