/* Shared helpers for the /house-renting/ pages. Data strings are untrusted:
 * everything is inserted with textContent / DOM nodes, never innerHTML. */
(function () {
  "use strict";
  const CFG = window.HOUSE_CFG;
  const H = (window.H = { cfg: CFG });

  // ---------- storage (may be unavailable: private mode, blocked site data) ----------
  H.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* ignore */
      }
    },
  };

  // ---------- DOM ----------
  H.el = function (tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      // aria-pressed / aria-current … need the literal strings "true" / "false"
      if (k.startsWith("aria-") && typeof v === "boolean") {
        node.setAttribute(k, String(v));
        continue;
      }
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k === "style") node.style.cssText = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  };
  H.clear = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  // ---------- formatting ----------
  const nf = new Intl.NumberFormat("tr-TR");
  const nf2 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
  H.money = (v) => (v == null ? "?" : nf.format(v) + " ₺");
  H.num = (v) => (v == null ? "?" : nf2.format(v));
  H.mins = (v) => {
    if (v == null) return "?";
    if (v < 60) return v + " dk";
    const h = Math.floor(v / 60), m = v % 60;
    return m ? `${h} sa ${m} dk` : `${h} sa`;
  };
  H.date = (iso) => {
    if (!iso) return "?";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("tr-TR");
  };
  H.hhmmToMin = (s) => {
    if (typeof s !== "string" || !/^\d{1,2}:\d{2}$/.test(s)) return null;
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  H.minToHhmm = (v) => String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0");
  H.yesNo = (v) => (v === true ? "✓" : v === false ? "–" : "?");

  /** Format a value of an index field using its field_info unit. */
  H.fmtField = function (field, value, info) {
    if (value == null || (Array.isArray(value) && !value.length)) return info && info.filter === "boolean" ? "?" : "–";
    if (typeof value === "boolean") return H.yesNo(value);
    if (Array.isArray(value)) return value.join(", ");
    const unit = info && info.unit;
    if (unit === "TL") return H.money(value);
    if (unit === "dk") return H.mins(value);
    if (unit === "TL/m²") return H.num(value) + " ₺/m²";
    if (field === "listing_date") return H.date(value);
    if (field === "seller_type") return H.SELLER_TYPE[value] || value;
    if (field === "checklist_quality") return H.CHECKLIST[value] || value;
    if (typeof value === "number") return H.num(value) + (unit ? " " + unit : "");
    return String(value);
  };

  H.STATUS = {
    new: "Yeni",
    interested: "İlgileniyorum",
    contacted: "Arandı",
    visit_planned: "Gezme planlandı",
    visited: "Gezildi",
    rejected: "Elendi",
    no_longer_listed: "İlan kalktı",
  };
  H.SELLER_TYPE = { corporate: "Emlak ofisi", individual: "Sahibinden" };
  H.CHECKLIST = { filled: "Dolu", empty: "Boş", all_ticked: "Her şey işaretli" };
  H.CHECKLIST_WARN = { empty: "Özellik listesi boş", all_ticked: "Her şey işaretli" };

  H.statusTag = (status) => H.el("span", { class: "h-tag st-" + status, text: H.STATUS[status] || status });

  // ---------- commute mode ----------
  H.MODES = {
    transit: { label: "Toplu taşıma", icon: "🚌", am: "am_transit_min", pm: "pm_transit_min", daily: "daily_transit_min", d2d: "_d2d_transit", leave: "am_leave_transit", arrive: "pm_arrive_transit" },
    drive: { label: "Araç", icon: "🚗", am: "am_drive_min", pm: "pm_drive_min", daily: "daily_drive_min", d2d: "_d2d_drive", leave: "am_leave_drive", arrive: "pm_arrive_drive" },
  };
  H.getMode = () => (H.store.get("house.mode", "transit") === "drive" ? "drive" : "transit");
  H.setMode = (m) => H.store.set("house.mode", m);

  /** Green (t=0) → yellow → red (t=1). */
  H.heat = function (t) {
    t = Math.max(0, Math.min(1, t));
    const stops = [[26, 152, 80], [254, 224, 139], [215, 48, 39]];
    const [a, b, f] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * f)).join(",")})`;
  };

  // ---------- URLs ----------
  H.validId = (id) => typeof id === "string" && /^\d+$/.test(id);
  H.adPage = (id) => `${CFG.root}ad/?id=${encodeURIComponent(id)}`;
  H.photoUrl = (id, rel) => `${CFG.db}/${encodeURIComponent(id)}/${rel}`;
  H.cardPhoto = (ad) => (ad._photo ? H.photoUrl(ad.id, ad._photo) : null);

  // ---------- data loading ----------
  let indexPromise = null;
  let railPromise = null; // rail.json: loaded with the index, reused by the map layer
  H.loadIndex = function () {
    if (!indexPromise) {
      indexPromise = Promise.all([
        fetch(`${CFG.db}/index.json`).then((r) => {
          if (!r.ok) throw new Error("index.json yüklenemedi (" + r.status + ")");
          return r.json();
        }),
        fetch(CFG.notes, { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : { ads: {} }))
          .catch(() => ({ ads: {} })),
        fetch(CFG.photos)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
        (railPromise = fetch(CFG.rail).then((r) => (r.ok ? r.json() : null)).catch(() => null)),
      ]).then(([index, notesFile, photos, rail]) => {
        for (const ad of index.ads) ad._photo = photos[ad.id] || null;
        H.rail = rail;
        H.index = index;
        H.byId = new Map(index.ads.map((a) => [a.id, a]));
        H.notesFile = notesFile && typeof notesFile === "object" ? notesFile : { ads: {} };
        if (!H.notesFile.ads || typeof H.notesFile.ads !== "object") H.notesFile.ads = {};
        H.pruneLocalNotes();
        H.enrich(index);
        H.updateFavBadge();
        // index.json only says "floor 0" for entrance, garden and basement-entrance flats;
        // read the exact label ("Giriş Altı Kot", "Bahçe Katı"…) of those few ads.
        return Promise.all(
          index.ads
            .filter((a) => a.is_ground_floor || a.floor <= 0)
            .map((a) => H.loadAd(a.id).then((d) => (a._floor_label = (d.details && d.details["Bulunduğu Kat"]) || null)).catch(() => null))
        ).then(() => index);
      });
    }
    return indexPromise;
  };
  H.loadAd = (id) =>
    fetch(`${CFG.db}/${encodeURIComponent(id)}/ad.json`).then((r) => {
      if (!r.ok) throw new Error("İlan bulunamadı (" + r.status + ")");
      return r.json();
    });

  // ---------- notes: assets/notes.json, overridden per ad by browser edits ----------
  const NOTES_KEY = "house.notes.v1";
  const toList = (v) =>
    Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

  H.notesDefaults = function (id) {
    const ad = H.byId && H.byId.get(id);
    return {
      status: "new",
      favorite: false,
      rating: null,
      visited_on: null,
      pros: ad ? [...(ad.auto_pros || [])] : [],
      cons: ad ? [...(ad.auto_cons || [])] : [],
      note: "",
      checklist: {},
      extra: {},
    };
  };
  function normalize(id, n) {
    const out = { ...H.notesDefaults(id), ...(n || {}) };
    out.pros = n && "pros" in n ? toList(n.pros) : out.pros;
    out.cons = n && "cons" in n ? toList(n.cons) : out.cons;
    if (!(out.status in H.STATUS)) out.status = "new";
    out.favorite = !!out.favorite;
    out.rating = Number.isInteger(out.rating) && out.rating >= 1 && out.rating <= 5 ? out.rating : null;
    out.note = typeof out.note === "string" ? out.note : "";
    // Visit checklist: { itemKey: true } for ticked items only, sorted for stable comparison.
    const cl = out.checklist && typeof out.checklist === "object" ? out.checklist : {};
    out.checklist = Object.fromEntries(Object.keys(cl).filter((k) => cl[k] === true && /^[a-z_]+$/.test(k)).sort().map((k) => [k, true]));
    // Facts the user learns on a visit, used by the scoring page.
    const x = out.extra && typeof out.extra === "object" ? out.extra : {};
    const int = (v, lo, hi) => (Number.isFinite(Number(v)) && v !== "" && v !== null && Number(v) >= lo && Number(v) <= hi ? Math.round(Number(v)) : undefined);
    const extra = {
      pets: x.pets === "yes" || x.pets === "no" ? x.pets : undefined,
      furnishing: ["none", "partial", "furnished", "good", "new"].includes(x.furnishing) ? x.furnishing : undefined,
      interior_age: int(x.interior_age, 0, 100),
      env: int(x.env, 1, 5),
      security: int(x.security, 1, 5),
    };
    out.extra = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined).sort());
    return out;
  }
  /** Things to check / ask during a visit; keys are stored in notes.checklist. */
  H.VISIT_CHECKLIST = [
    ["Masraflar ve sözleşme", [
      ["heating_bill", "Kışın ortalama doğalgaz / ısınma faturası soruldu"],
      ["dues_cover", "Aidata neler dahil (ısınma, su, otopark) öğrenildi"],
      ["deposit_terms", "Depozito iadesi şartları netleşti"],
      ["commission", "Emlak komisyonu (genelde 1 kira + KDV) konuşuldu"],
      ["contract", "Sözleşme süresi ve yıllık artış oranı soruldu"],
      ["move_in", "Ne zaman boşalacağı / taşınma tarihi netleşti"],
    ]],
    ["Daire", [
      ["damp", "Nem / küf yok (köşeler, dolap arkaları, banyo tavanı)"],
      ["water", "Su basıncı ve sıcak su denendi"],
      ["windows", "Pencereler kapanıyor, hava almıyor"],
      ["sunlight", "Gün ışığı yeterli (hangi saatte güneş alıyor)"],
      ["noise", "Gürültü kontrol edildi (yol, komşu, asansör)"],
      ["signal", "Telefon çekimi ve internet altyapısı (fiber?) kontrol edildi"],
      ["appliances", "Mutfak / banyo / beyaz eşyaların durumu iyi"],
    ]],
    ["Bina ve çevre", [
      ["parking", "Otopark yeri var ve kullanılabilir"],
      ["elevator", "Asansör ve ortak alanlar bakımlı"],
      ["stop_walk", "Durak / metroya yürüme süresi denendi"],
      ["shops", "Market ve günlük ihtiyaçlar yakında"],
      ["evening", "Akşam saatinde çevre ve sokak güvenliği hissi iyi"],
    ]],
  ];
  H.fileNotes = (id) => normalize(id, H.notesFile.ads[id]);
  H.localNotes = () => H.store.get(NOTES_KEY, {}) || {};
  H.notes = function (id) {
    const local = H.localNotes()[id];
    return local ? normalize(id, local) : H.fileNotes(id);
  };
  H.hasLocalNotes = (id) => id in H.localNotes();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  H.saveNotes = function (id, notes) {
    const all = H.localNotes();
    const n = normalize(id, notes);
    if (same(n, H.fileNotes(id))) delete all[id];
    else all[id] = n;
    H.store.set(NOTES_KEY, all);
    document.dispatchEvent(new CustomEvent("house:notes", { detail: { id } }));
  };
  H.patchNotes = (id, patch) => H.saveNotes(id, { ...H.notes(id), ...patch });
  H.clearLocalNotes = function (id) {
    const all = H.localNotes();
    if (id) delete all[id];
    H.store.set(NOTES_KEY, id ? all : {});
    document.dispatchEvent(new CustomEvent("house:notes", { detail: { id } }));
  };
  /** Drop browser edits that equal the file (e.g. after the export was committed). */
  H.pruneLocalNotes = function () {
    const all = H.localNotes();
    let changed = false;
    for (const id of Object.keys(all)) {
      if (!H.validId(id) || same(normalize(id, all[id]), H.fileNotes(id))) {
        delete all[id];
        changed = true;
      }
    }
    if (changed) H.store.set(NOTES_KEY, all);
  };
  H.isAutoList = (list, auto) => same(list, auto || []);
  /** Full notes object, ready to paste into assets/notes.json. */
  H.exportNotes = function () {
    const ads = {};
    const ids = new Set([...Object.keys(H.notesFile.ads), ...H.index.ads.map((a) => a.id)]);
    for (const id of ids) if (H.validId(id)) ads[id] = H.notes(id);
    return { _statuses: Object.keys(H.STATUS), ads };
  };
  /** Import a notes JSON (same shape) as browser edits. Returns number of ads. */
  H.importNotes = function (obj) {
    if (!obj || typeof obj.ads !== "object") throw new Error("Geçersiz dosya: 'ads' alanı yok");
    let n = 0;
    for (const [id, notes] of Object.entries(obj.ads)) {
      if (!H.validId(id) || typeof notes !== "object") continue;
      H.saveNotes(id, notes);
      n++;
    }
    return n;
  };

  // ---------- compare selection ----------
  const CMP_KEY = "house.compare";
  H.MAX_COMPARE = 4;
  H.getCompare = () => (H.store.get(CMP_KEY, []) || []).filter(H.validId).slice(0, H.MAX_COMPARE);
  H.setCompare = function (ids) {
    H.store.set(CMP_KEY, ids.filter(H.validId).slice(0, H.MAX_COMPARE));
    H.updateCompareBadge();
    document.dispatchEvent(new CustomEvent("house:compare"));
  };
  /** Returns false when the list is full. */
  H.toggleCompare = function (id) {
    const ids = H.getCompare();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
    else if (ids.length >= H.MAX_COMPARE) return false;
    else ids.push(id);
    H.setCompare(ids);
    return true;
  };
  H.favCount = () => (H.index ? H.index.ads.filter((a) => H.notes(a.id).favorite).length : 0);
  H.updateFavBadge = function () {
    const n = H.favCount();
    document.querySelectorAll("[data-fav-count]").forEach((b) => (b.textContent = n));
  };
  document.addEventListener("house:notes", () => H.updateFavBadge());
  H.updateCompareBadge = function () {
    const n = H.getCompare().length;
    document.querySelectorAll("[data-compare-count]").forEach((b) => (b.textContent = n));
  };
  document.addEventListener("DOMContentLoaded", H.updateCompareBadge);
  window.addEventListener("storage", (e) => {
    if (e.key === CMP_KEY) H.updateCompareBadge();
  });

  // ---------- derived data: duplicates, area price level, score ----------
  H.distanceM = function (a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dp = (b.latitude - a.latitude) * rad, dl = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const normName = (s) => lcTr(s).replace(/[^\p{L}\p{N}]/gu, "");
  function lcTr(s) {
    return String(s || "").toLocaleLowerCase("tr-TR");
  }
  /** Same building / complex and similar flat. sameFloor=true means "probably the same flat". */
  H.similarFlat = function (a, b, sameFloor) {
    if (a.id === b.id || a.latitude == null || b.latitude == null) return false;
    const ca = normName(a.complex_name), cb = normName(b.complex_name);
    if (ca && cb && ca !== cb) return false;
    if (!((ca && ca === cb) || H.distanceM(a, b) <= 350)) return false;
    if (a.floor_count !== b.floor_count || Math.abs(a.area_net_m2 - b.area_net_m2) > 5) return false;
    if (sameFloor && a.floor !== b.floor) return false;
    return Math.abs(a.price_value - b.price_value) / Math.min(a.price_value, b.price_value) <= 0.15;
  };
  const median = (xs) => {
    const s = [...xs].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  /**
   * Adds to every ad: _dup (ids of ads that are probably the same flat, incl. itself,
   * cheapest first; null if none) and _area (rent per m² vs the neighbourhood median,
   * or the district median when the neighbourhood has fewer than 3 ads).
   */
  H.enrich = function (index) {
    const ads = index.ads;
    const parent = new Map(ads.map((a) => [a.id, a.id]));
    const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
    for (let i = 0; i < ads.length; i++)
      for (let j = i + 1; j < ads.length; j++) if (H.similarFlat(ads[i], ads[j], true)) parent.set(find(ads[i].id), find(ads[j].id));
    const groups = new Map();
    for (const a of ads) {
      const r = find(a.id);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(a);
    }
    for (const g of groups.values()) {
      const ids = g.length > 1 ? g.sort((x, y) => x.price_value - y.price_value || x.id.localeCompare(y.id)).map((a) => a.id) : null;
      for (const a of g) a._dup = ids;
    }
    const by = (key) => {
      const m = new Map();
      for (const a of ads) if (a.price_per_m2_net != null) (m.get(a[key]) || m.set(a[key], []).get(a[key])).push(a.price_per_m2_net);
      return m;
    };
    const hood = by("neighborhood"), dist = by("district");
    for (const a of ads) {
      if (a.price_per_m2_net == null) {
        a._area = null;
        continue;
      }
      const useHood = (hood.get(a.neighborhood) || []).length >= 3;
      const list = useHood ? hood.get(a.neighborhood) : dist.get(a.district) || [];
      const med = median(list);
      a._area = { scope: useHood ? a.neighborhood : a.district + " (ilçe)", n: list.length, median: med, diff: (a.price_per_m2_net - med) / med };
    }
    enrichCommute(index);
  };

  /**
   * Door-to-door day: from leaving home until 08:50 (incl. waiting at work because the bus
   * that makes it arrives early) plus from 18:00 until home (incl. waiting for the first
   * vehicle). Also: nearest rail station, suspicious map pins, timetable-sensitive commutes.
   * The new fields get field_info entries so filters, sorting and compare pick them up.
   */
  const WORK_START = 8 * 60 + 50, WORK_END = 18 * 60;
  function enrichCommute(index) {
    const ads = index.ads, FI = index.field_info;
    const span = (ad, leave, arrive) => {
      const l = H.hhmmToMin(ad[leave]), r = H.hhmmToMin(ad[arrive]);
      return l == null || r == null ? null : WORK_START - l + (r - WORK_END);
    };
    for (const a of ads) {
      a._d2d_transit = span(a, "am_leave_transit", "pm_arrive_transit");
      a._d2d_drive = span(a, "am_leave_drive", "pm_arrive_drive");
      const leave = H.hhmmToMin(a.am_leave_transit);
      a._idle_am = leave == null ? null : WORK_START - leave - a.am_transit_min;
    }

    // Nearest rail station (straight line).
    const stations = (H.rail && H.rail.stations) || [];
    for (const a of ads) {
      a._station = null;
      a._station_m = null;
      if (a.latitude == null) continue;
      for (const s of stations) {
        const d = H.distanceM(a, { latitude: s.lat, longitude: s.lon });
        if (a._station_m == null || d < a._station_m) {
          a._station_m = Math.round(d / 10) * 10;
          a._station = s;
        }
      }
    }

    // Pins far from their neighbourhood / complex.
    const groupBy = (keyFn) => {
      const m = new Map();
      for (const a of ads) {
        const k = keyFn(a);
        if (k && a.latitude != null) (m.get(k) || m.set(k, []).get(k)).push(a);
      }
      return m;
    };
    for (const a of ads) a._loc_warn = null;
    for (const [hoodName, xs] of groupBy((a) => a.neighborhood)) {
      if (xs.length < 3) continue;
      const c = { latitude: median(xs.map((x) => x.latitude)), longitude: median(xs.map((x) => x.longitude)) };
      for (const x of xs) {
        const d = H.distanceM(x, c);
        if (d > 2000) x._loc_warn = `Haritadaki iğne ${hoodName} ilanlarının ortasından ${H.num(Math.round(d / 100) / 10)} km uzakta; konum (ve ulaşım süreleri) yanlış olabilir.`;
      }
    }
    for (const [, xs] of groupBy((a) => normName(a.complex_name))) {
      for (const x of xs) {
        const far = Math.max(...xs.map((y) => H.distanceM(x, y)));
        if (far > 1000 && !x._loc_warn) x._loc_warn = `Aynı sitenin (${x.complex_name}) diğer ilanlarından ${H.num(Math.round(far / 100) / 10)} km uzakta işaretlenmiş; konumu kontrol et.`;
      }
    }

    // Timetable-sensitive transit: missing one bus likely costs a lot.
    for (const a of ads) {
      const r = [];
      const near = ads.filter((b) => b !== a && b.latitude != null && a.latitude != null && H.distanceM(a, b) <= 300);
      const worst = near.reduce((m, b) => Math.max(m, Math.abs(b.daily_transit_min - a.daily_transit_min)), 0);
      if (worst >= 20) r.push(`300 m içindeki başka bir ilanla günlük süre farkı ${worst} dk (hangi otobüse yetişildiğine çok bağlı)`);
      if (a.pm_transit_wait_min >= 25) r.push(`akşam ilk araç için ${a.pm_transit_wait_min} dk bekleme`);
      if (a._idle_am >= 15 && a.pm_transit_wait_min >= 15) r.push(`sefer seyrek: sabah ${a._idle_am} dk erken varış, akşam ${a.pm_transit_wait_min} dk bekleme`);
      a._timing = r.length ? r : null;
    }

    const range = (f) => {
      const v = ads.map((a) => a[f]).filter((x) => x != null);
      return { min: Math.min(...v), max: Math.max(...v), missing: ads.length - v.length };
    };
    const add = (f, info) => (FI[f] = { unit: null, ...info });
    add("_d2d_transit", { label: "Kapıdan kapıya günlük, toplu taşıma (beklemeler dahil)", group: "Yolculuk", filter: "range", unit: "dk", ...range("_d2d_transit") });
    add("_d2d_drive", { label: "Kapıdan kapıya günlük, araç", group: "Yolculuk", filter: "range", unit: "dk", ...range("_d2d_drive") });
    add("_timing_sensitive", { label: "Sefer saatine hassas (toplu taşıma)", group: "Yolculuk", filter: "boolean", true_count: ads.filter((a) => a._timing).length, unknown: 0 });
    if (stations.length) add("_station_m", { label: "En yakın raylı sistem durağı (kuş uçuşu)", group: "Konum", filter: "range", unit: "m", ...range("_station_m") });
    add("_loc_suspect", { label: "Konumu şüpheli", group: "Konum", filter: "boolean", true_count: ads.filter((a) => a._loc_warn).length, unknown: 0 });
    for (const a of ads) {
      a._timing_sensitive = !!a._timing;
      a._loc_suspect = !!a._loc_warn;
    }
  }
  H.stationText = (ad) => (ad._station ? `${ad._station.name} (${ad._station.lines.join(", ")}) ${ad._station_m >= 1000 ? H.num(Math.round(ad._station_m / 100) / 10) + " km" : ad._station_m + " m"}` : null);

  // ---------- transport-inclusive monthly cost ----------
  // Assumptions are editable in the filter panel (prices change; check EGO / fuel prices).
  H.COST_DEFAULTS = { transitMonthly: 1320, perKm: 3.5, workDays: 22 };
  H.costSettings = () => ({ ...H.COST_DEFAULTS, ...(H.store.get("house.costSettings", {}) || {}) });
  H.setCostSettings = (s) => H.store.set("house.costSettings", s);
  H.transportCost = function (ad, mode, s) {
    s = s || H.costSettings();
    if (mode === "drive") return ad.drive_km == null ? null : Math.round(ad.drive_km * 2 * s.workDays * s.perKm);
    return Math.round(s.transitMonthly);
  };
  H.totalCost = (ad, mode, s) => {
    const t = H.transportCost(ad, mode, s);
    return ad.monthly_cost == null || t == null ? null : ad.monthly_cost + t;
  };
  H.areaText = (area) => {
    if (!area) return null;
    const pct = Math.round(Math.abs(area.diff) * 100);
    return pct < 3 ? "bölge ortalamasında" : `bölgeye göre %${pct} ${area.diff < 0 ? "ucuz" : "pahalı"}`;
  };

  // ---------- rail lines (assets/house-renting/rail.json, from OpenStreetMap) ----------
  /** Adds metro / Ankaray / Başkentray lines and stations as a toggleable overlay. */
  H.addRailLayer = function (map, opts) {
    if (!window.L) return;
    opts = opts || {};
    const group = L.layerGroup();
    if (!railPromise) railPromise = fetch(CFG.rail).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    railPromise.then((rail) => {
      if (!rail) return;
      for (const line of rail.lines) {
        L.polyline(line.paths, { color: line.color, weight: 4, opacity: 0.75, interactive: true }).bindTooltip(line.name, { sticky: true }).addTo(group);
      }
      for (const st of rail.stations) {
        L.circleMarker([st.lat, st.lon], { radius: 3.5, color: "#222", weight: 1.5, fillColor: "#fff", fillOpacity: 1 })
          .bindTooltip(`${st.name} (${st.lines.join(", ")})`)
          .addTo(group);
      }
      group.addTo(map);
      group.eachLayer((l) => l.bringToBack && l.bringToBack());
      if (opts.control !== false) L.control.layers(null, { "🚇 Raylı sistem": group }, { position: "topright", collapsed: false }).addTo(map);
    });
    return group;
  };

  // ---------- sharing ----------
  function toast(text) {
    const t = H.el("div", { class: "h-toast", role: "status", text });
    document.body.append(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }
  H.toast = toast;
  /** Native share sheet on phones, clipboard elsewhere. */
  H.share = async function (title, url, text) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link kopyalandı");
    } catch (e) {
      prompt("Linki kopyala:", url);
    }
  };

  // Friends' favourite lists, received through ?list=<name>&ids=<id,id,…> links.
  const LISTS_KEY = "house.sharedLists";
  H.myName = () => H.store.get("house.myName", "");
  /** Turkish genitive with apostrophe: Ayşe → Ayşe'nin, Mehmet → Mehmet'in, Can → Can'ın. */
  H.genitive = function (name) {
    const vowels = [...lcTr(name)].filter((ch) => "aeıioöuü".includes(ch));
    const last = vowels[vowels.length - 1] || "e";
    const v = { a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" }[last];
    const endsWithVowel = "aeıioöuü".includes(lcTr(name).slice(-1));
    return `${name}'${endsWithVowel ? "n" : ""}${v}n`;
  };
  H.sharedLists = () => H.store.get(LISTS_KEY, {}) || {};
  H.saveSharedList = function (name, ids) {
    const all = H.sharedLists();
    all[name] = ids.filter(H.validId);
    H.store.set(LISTS_KEY, all);
  };
  H.removeSharedList = function (name) {
    const all = H.sharedLists();
    delete all[name];
    H.store.set(LISTS_KEY, all);
  };
  /** Names of friends whose shared list contains this ad. */
  H.friendsFor = (id) => Object.entries(H.sharedLists()).filter(([, ids]) => ids.includes(id)).map(([n]) => n);
  /** Ask for a name once, then share a link to my favourites. */
  H.shareFavorites = function () {
    const ids = H.index.ads.filter((a) => H.notes(a.id).favorite).map((a) => a.id);
    if (!ids.length) {
      alert("Henüz favorin yok. Kartlardaki ☆ ile ekleyebilirsin.");
      return;
    }
    let name = H.myName();
    if (!name) {
      name = (prompt("Listen hangi isimle görünsün? (ör. Ayşe)") || "").trim().slice(0, 30);
      if (!name) return;
      H.store.set("house.myName", name);
    }
    const url = new URL(CFG.root, location.href);
    url.search = new URLSearchParams({ list: name, ids: ids.join(",") }).toString();
    H.share(`${H.genitive(name)} favori evleri`, url.toString(), `${H.genitive(name)} favori ${ids.length} ilanı`);
  };

  // ---------- offline ----------
  function offlineBanner() {
    let b = document.getElementById("h-offline");
    if (navigator.onLine) {
      if (b) b.remove();
      return;
    }
    if (!b) {
      b = H.el("div", { id: "h-offline", class: "h-offline", role: "status", text: "Çevrimdışısın: en son kaydedilen veriler gösteriliyor; değişikliklerin bu cihazda saklanır." });
      document.body.prepend(b);
    }
  }
  window.addEventListener("online", offlineBanner);
  window.addEventListener("offline", offlineBanner);
  document.addEventListener("DOMContentLoaded", offlineBanner);

  /** Fetch every ad's details and card photo so the service worker keeps them for offline use. */
  H.downloadForOffline = async function (onProgress) {
    const urls = [];
    for (const a of H.index.ads) {
      urls.push(`${CFG.db}/${encodeURIComponent(a.id)}/ad.json`);
      if (a._photo) urls.push(H.cardPhoto(a));
    }
    let done = 0, failed = 0;
    const worker = async () => {
      while (urls.length) {
        const u = urls.shift();
        try {
          const r = await fetch(u);
          if (!r.ok) failed++;
        } catch (e) {
          failed++;
        }
        onProgress(++done, done + urls.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return failed;
  };

  // ---------- shared widgets ----------
  H.favButton = function (id, onChange) {
    const btn = H.el("button", { type: "button", class: "h-fav-btn" });
    const sync = () => {
      const on = H.notes(id).favorite;
      btn.textContent = on ? "★" : "☆";
      btn.setAttribute("aria-pressed", on);
      btn.title = btn.ariaLabel = on ? "Favorilerden çıkar" : "Favorilere ekle";
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      H.patchNotes(id, { favorite: !H.notes(id).favorite });
      sync();
      if (onChange) onChange();
    });
    sync();
    return btn;
  };
  H.compareToggle = function (id) {
    const box = H.el("input", { type: "checkbox", dataset: { cmpId: id } });
    box.checked = H.getCompare().includes(id);
    box.addEventListener("change", () => {
      if (!H.toggleCompare(id)) {
        box.checked = false;
        alert(`En fazla ${H.MAX_COMPARE} ilan karşılaştırılabilir.`);
      }
    });
    return H.el("label", { class: "h-check" }, box, "Karşılaştır");
  };
  // One listener keeps every compare checkbox on the page in sync.
  document.addEventListener("house:compare", () => {
    const ids = H.getCompare();
    document.querySelectorAll("input[data-cmp-id]").forEach((b) => (b.checked = ids.includes(b.dataset.cmpId)));
  });
  H.tagList = function (items, cls, limit) {
    const shown = limit ? items.slice(0, limit) : items;
    return H.el(
      "div",
      { class: "h-tags" },
      shown.map((t) => H.el("span", { class: "h-tag " + cls, text: t })),
      limit && items.length > limit ? H.el("span", { class: "h-tag more", text: `+${items.length - limit}` }) : null
    );
  };
  H.fail = function (container, err) {
    H.clear(container).append(H.el("p", { class: "h-empty", text: "Hata: " + (err && err.message ? err.message : err) }));
  };
})();
