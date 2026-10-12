/* Scoring engine shared by every page (list sort, compare, triage, detail, the scoring page).
 *
 * Profile = weighted criteria + rules + cost settings.
 *  - Criteria give a 0–100 base score: numbers are linear between "best" and "worst",
 *    yes/no and category fields use a % per value (e.g. floor: ara kat 100, kot 0).
 *  - Rules (optionally with an extra "and" condition) add / subtract points, exclude the ad,
 *    or multiply the score (applied last), e.g. squat toilet × 0.5.
 *  Total = (base + Σ points) × Π multipliers.
 * Profiles live in localStorage ("house.scoring"); one is active. */
(function () {
  "use strict";
  const S = (H.scoring = {});
  const KEY = "house.scoring.v2";
  const DAY = 86400000;

  // ---------- effective monthly cost ----------
  S.COST_DEFAULTS = {
    commission: 1.2, // × rent, agencies only (1 month + VAT)
    furnitureNone: 200000, furniturePartial: 100000, furnitureUnknown: 100000,
    months: 24, // one-off costs spread over this many months
    heating: { "Kombi (Doğalgaz)": 2000, "Yerden Isıtma": 2000, "Merkezi (Pay Ölçer)": 1500, Merkezi: 0, other: 1500 },
    includeTransport: true,
  };
  S.costOf = (p) => {
    const c = { ...S.COST_DEFAULTS, ...(p.cost || {}) };
    c.heating = { ...S.COST_DEFAULTS.heating, ...((p.cost && p.cost.heating) || {}) };
    return c;
  };
  let duesMedian = null;
  function medianDues() {
    if (duesMedian == null) {
      const v = H.index.ads.map((a) => a.dues).filter((x) => x != null).sort((a, b) => a - b);
      duesMedian = v.length ? v[v.length >> 1] : 0;
    }
    return duesMedian;
  }
  /** Furnishing: the user's note wins, else the ad's "Eşyalı" flag. */
  function furnishing(ad) {
    const f = H.notes(ad.id).extra.furnishing;
    if (f) return f;
    return ad.furnished === true ? "furnished" : ad.furnished === false ? "none" : "unknown";
  }
  S.FURNISHING = { none: "Eşyasız", partial: "Kısmi eşyalı / eşyası eski", furnished: "Eşyalı", good: "Eşyalı, iyi durumda", new: "Eşyalı, sıfır / yeni", unknown: "Bilinmiyor" };
  /** {total, lines:[[label, amount]]} */
  S.effectiveCost = function (ad, p) {
    const c = S.costOf(p);
    const lines = [];
    lines.push(["Kira", ad.price_value]);
    lines.push([ad.dues == null ? "Aidat (belirtilmemiş, ortanca varsayıldı)" : "Aidat", ad.dues == null ? medianDues() : ad.dues]);
    const heat = ad.heating in c.heating ? c.heating[ad.heating] : c.heating.other;
    lines.push([`Isınma (${ad.heating || "?"})`, heat]);
    const comm = ad.is_owner ? 0 : c.commission * ad.price_value;
    const f = furnishing(ad);
    const furn = f === "none" ? c.furnitureNone : f === "partial" ? c.furniturePartial : f === "unknown" ? c.furnitureUnknown : 0;
    if (comm) lines.push([`Komisyon ${H.num(c.commission)} × kira ÷ ${c.months} ay`, comm / c.months]);
    if (furn) lines.push([`Eşya masrafı (${S.FURNISHING[f]}) ÷ ${c.months} ay`, furn / c.months]);
    if (c.includeTransport) {
      const t = H.transportCost(ad, p.mode);
      if (t != null) lines.push([`Ulaşım (${H.MODES[p.mode].label.toLowerCase()})`, t]);
    }
    return { total: Math.round(lines.reduce((s, [, v]) => s + v, 0)), lines };
  };

  // ---------- derived categories ----------
  S.FLOOR_TYPES = ["Ara kat", "Yüksek giriş", "Giriş / bahçe", "En üst kat", "Kot"];
  function floorType(ad) {
    const raw = (ad._floor_label || "").toLocaleLowerCase("tr-TR");
    if (ad.floor < 0 || /kot|bodrum/.test(raw)) return "Kot";
    if (/yüksek giriş/.test(raw)) return "Yüksek giriş";
    if (ad.floor === 0 || ad.is_ground_floor) return "Giriş / bahçe";
    if (ad.is_top_floor || (ad.floor_count && ad.floor >= ad.floor_count)) return "En üst kat";
    return "Ara kat";
  }
  const parking = (ad) => (ad.has_closed_parking ? "Kapalı" : ad.has_parking ? "Açık" : ad.has_parking === false ? "Yok" : null);
  const elevator = (ad) => (ad.elevator === true ? "Var" : ad.elevator === false ? (ad.floor >= 3 ? "Yok, 3. kat ve üstü" : "Yok, 2. kat ve altı") : null);

  // ---------- fields ----------
  const notesX = (ad) => H.notes(ad.id).extra;
  const VIRTUAL = {
    _eff_cost: { label: "Efektif aylık maliyet (kira + aidat + ısınma + komisyon/eşya ÷ ay + ulaşım)", group: "Fiyat", type: "number", unit: "TL", get: (ad, p) => S.effectiveCost(ad, p).total },
    _total: { label: "Ulaşım dahil aylık (kira + aidat + ulaşım)", group: "Fiyat", type: "number", unit: "TL", get: (ad, p) => H.totalCost(ad, p.mode) },
    _area_diff: { label: "m² kirası bölge ortancasına göre (%)", group: "Fiyat", type: "number", unit: "%", get: (ad) => (ad._area ? Math.round(ad._area.diff * 1000) / 10 : null) },
    _d2d: { label: "Kapıdan kapıya günlük (profilin ulaşım tipi)", group: "Yolculuk", type: "number", unit: "dk", get: (ad, p) => ad[H.MODES[p.mode].d2d] },
    _d2d_min: { label: "Kapıdan kapıya günlük, toplu taşıma / araçtan kısa olan", group: "Yolculuk", type: "number", unit: "dk", get: (ad) => Math.min(ad._d2d_transit ?? Infinity, ad._d2d_drive ?? Infinity) },
    _daily: { label: "Günlük yolculuk, beklemesiz (profilin ulaşım tipi)", group: "Yolculuk", type: "number", unit: "dk", get: (ad, p) => ad[H.MODES[p.mode].daily] },
    _am: { label: "Sabah yolculuk (profilin ulaşım tipi)", group: "Yolculuk", type: "number", unit: "dk", get: (ad, p) => ad[H.MODES[p.mode].am] },
    _pm: { label: "Akşam yolculuk (profilin ulaşım tipi)", group: "Yolculuk", type: "number", unit: "dk", get: (ad, p) => ad[H.MODES[p.mode].pm] },
    _station_walk: { label: "Raylı sistem durağına yürüme (tahmini)", group: "Yolculuk", type: "number", unit: "dk", get: (ad) => (ad._station_m == null ? null : Math.round((ad._station_m * 1.3) / 80)) },
    _floor_type: { label: "Kat türü", group: "Daire", type: "enum", options: S.FLOOR_TYPES, get: floorType },
    _parking: { label: "Otopark", group: "Bina & Site", type: "enum", options: ["Kapalı", "Açık", "Yok"], get: parking },
    _elevator: { label: "Asansör (kata göre)", group: "Bina & Site", type: "enum", options: ["Var", "Yok, 2. kat ve altı", "Yok, 3. kat ve üstü"], get: elevator },
    _listing_age: { label: "İlan yaşı", group: "Diğer", type: "number", unit: "gün", get: (ad) => (ad.listing_date ? Math.max(0, Math.floor((Date.now() - new Date(ad.listing_date + "T00:00:00")) / DAY)) : null) },
    _dup_other: { label: "Aynı dairenin daha ucuz ilanı var", group: "Diğer", type: "boolean", get: (ad) => !!(ad._dup && ad._dup[0] !== ad.id) },
    // the user's own notes
    _favorite: { label: "Favorim", group: "Notlarım", type: "boolean", get: (ad) => H.notes(ad.id).favorite },
    _rating: { label: "Puanım (yıldız)", group: "Notlarım", type: "number", unit: "★", get: (ad) => H.notes(ad.id).rating },
    _status: { label: "Durum", group: "Notlarım", type: "enum", options: Object.keys(H.STATUS), optLabel: (v) => H.STATUS[v] || v, get: (ad) => H.notes(ad.id).status },
    _furnishing: { label: "Eşya durumu (notum, yoksa ilan)", group: "Notlarım", type: "enum", options: Object.keys(S.FURNISHING), optLabel: (v) => S.FURNISHING[v] || v, get: furnishing },
    _pets: { label: "Evcil hayvan kabulü (notum)", group: "Notlarım", type: "enum", options: ["yes", "no"], optLabel: (v) => ({ yes: "Kabul ediliyor", no: "Kabul edilmiyor" })[v] || v, get: (ad) => notesX(ad).pets || null },
    _interior_age: { label: "İç mekân yaşı (tadilat notum, yoksa bina yaşı)", group: "Notlarım", type: "number", unit: "yıl", get: (ad) => notesX(ad).interior_age ?? ad.building_age_min },
    _env: { label: "Çevre puanım (1–5)", group: "Notlarım", type: "number", unit: "/5", get: (ad) => notesX(ad).env ?? null },
    _security: { label: "Güvenlik puanım (1–5)", group: "Notlarım", type: "number", unit: "/5", get: (ad) => notesX(ad).security ?? null },
    _checklist_done: { label: "Gezme kontrol listesinde işaretli madde", group: "Notlarım", type: "number", unit: "adet", get: (ad) => Object.keys(H.notes(ad.id).checklist).length },
    _friends: { label: "Arkadaş listelerinde geçme sayısı", group: "Notlarım", type: "number", unit: "kişi", get: (ad) => H.friendsFor(ad.id).length },
  };
  const SKIP = new Set(["id", "title", "price_currency", "price_raw", "city", "latitude", "longitude", "rooms", "living_rooms", "building_age_max", "ad_json", "features_all", "auto_pros", "auto_cons", "seller_name", "complex_name", "am_transit_lines", "pm_transit_lines"]);

  /** All usable fields: [{key, label, group, type: number|boolean|enum|list|feature, options?, unit?}]. */
  S.fields = function (index) {
    if (S._fields && S._fieldsFor === index) return S._fields;
    const FI = index.field_info;
    const out = [];
    for (const [key, v] of Object.entries(VIRTUAL)) out.push({ key, ...v });
    for (const [key, info] of Object.entries(FI)) {
      if (SKIP.has(key)) continue;
      const base = { key, label: info.label, group: info.group, unit: info.unit };
      if (info.filter === "range" || key === "photo_count") out.push({ ...base, type: "number", unit: key === "photo_count" ? "adet" : info.unit });
      else if (info.filter === "time") out.push({ ...base, type: "number", unit: "saat", time: true });
      else if (info.filter === "boolean") out.push({ ...base, type: "boolean" });
      else if (info.filter === "multi") {
        const isList = index.ads.some((a) => Array.isArray(a[key]));
        out.push({ ...base, type: isList ? "list" : "enum", options: info.options, optLabel: (v) => H.fmtField(key, v, info) });
      }
    }
    for (const [group, items] of Object.entries(index.feature_catalog || {})) {
      for (const it of items) if (it.relevant && it.count > 0) out.push({ key: "f:" + it.name, label: it.name, group: "Özellik: " + group, type: "feature" });
    }
    S._fields = out;
    S._fieldsFor = index;
    S._byKey = new Map(out.map((f) => [f.key, f]));
    return out;
  };
  S.field = (key) => (S._byKey && S._byKey.get(key)) || null;

  S.value = function (ad, key, profile) {
    if (VIRTUAL[key]) {
      const v = VIRTUAL[key].get(ad, profile);
      return v === Infinity || v === undefined ? null : v;
    }
    if (key.startsWith("f:")) return ad.checklist_quality === "filled" ? (ad.features_all || []).includes(key.slice(2)) : null;
    const f = S.field(key);
    const v = ad[key];
    if (f && f.time) return H.hhmmToMin(v);
    return v === undefined ? null : v;
  };
  S.optLabel = (key, v) => {
    const f = S.field(key);
    if (v === true || v === "true") return "Evet / var";
    if (v === false || v === "false") return "Hayır / yok";
    return f && f.optLabel ? f.optLabel(v) : String(v);
  };
  S.fmt = function (key, v) {
    const f = S.field(key);
    if (v == null) return "?";
    if (f && f.time) return H.minToHhmm(v);
    if (typeof v === "boolean") return v ? "var" : "yok";
    if (f && (f.type === "enum" || f.type === "list")) return [].concat(v).map((x) => S.optLabel(key, x)).join(", ");
    if (f && f.unit === "TL") return H.money(v);
    if (f && f.unit === "dk") return H.mins(v);
    return H.num(v) + (f && f.unit && f.unit !== "saat" ? " " + f.unit : "");
  };

  // ---------- criteria ----------
  /** Options a yes/no or category criterion maps to a %. */
  S.critOptions = (key) => {
    const f = S.field(key);
    if (!f) return [];
    if (f.type === "boolean" || f.type === "feature") return ["true", "false"];
    return f.options || [];
  };
  S.critType = (key) => {
    const f = S.field(key);
    return !f ? null : f.type === "number" ? "number" : ["boolean", "feature", "enum"].includes(f.type) ? "map" : null;
  };
  function bounds(c, profile, ads) {
    const vals = ads.map((a) => S.value(a, c.field, profile)).filter((v) => typeof v === "number");
    const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
    const autoBest = c.dir === "high" ? hi : lo, autoWorst = c.dir === "high" ? lo : hi;
    return { best: c.best != null && c.best !== "" ? Number(c.best) : autoBest, worst: c.worst != null && c.worst !== "" ? Number(c.worst) : autoWorst, lo, hi, count: vals.length };
  }
  S.bounds = bounds;
  function critN(c, v, b) {
    if (S.critType(c.field) === "map") {
      if (v == null) return null;
      const k = typeof v === "boolean" ? String(v) : v;
      const pct = c.map && k in c.map ? Number(c.map[k]) : k === "true" ? 100 : k === "false" ? 0 : 50;
      return Math.max(0, Math.min(1, pct / 100));
    }
    if (typeof v !== "number") return null;
    if (b.best === b.worst) return v === b.best ? 1 : 0;
    return Math.max(0, Math.min(1, (v - b.worst) / (b.best - b.worst)));
  }

  // ---------- rules ----------
  S.OPS = {
    number: [["gte", "≥"], ["lte", "≤"], ["between", "arasında"], ["per_above", "üstündeki her birim için"], ["per_below", "altındaki her birim için"], ["null", "bilinmiyor"]],
    boolean: [["true", "var / evet"], ["false", "yok / hayır"], ["null", "bilinmiyor"]],
    feature: [["true", "işaretli"], ["false", "işaretli değil"], ["null", "liste boş (bilinmiyor)"]],
    enum: [["in", "şunlardan biri"], ["not_in", "şunlardan biri değil"], ["null", "bilinmiyor"]],
    list: [["in", "şunlardan birini içerir"], ["not_in", "hiçbirini içermez"]],
  };
  /** Does a condition hold? Returns the per-unit multiplier (≥0) or 0 = no. */
  function test(cond, ad, profile) {
    const f = S.field(cond.field);
    if (!f) return 0;
    const v = S.value(ad, cond.field, profile);
    const a = Number(cond.value), b = Number(cond.value2);
    switch (cond.op) {
      case "null": return v == null ? 1 : 0;
      case "true": return v === true ? 1 : 0;
      case "false": return v === false ? 1 : 0;
      case "gte": return v != null && v >= a ? 1 : 0;
      case "lte": return v != null && v <= a ? 1 : 0;
      case "between": return v != null && v >= Math.min(a, b) && v <= Math.max(a, b) ? 1 : 0;
      case "per_above": return v != null && v > a ? v - a : 0;
      case "per_below": return v != null && v < a ? a - v : 0;
      case "in":
      case "not_in": {
        const vals = cond.values || [];
        const has = v != null && [].concat(v).some((x) => vals.includes(x));
        return (cond.op === "in" ? has : v != null && !has) ? 1 : 0;
      }
    }
    return 0;
  }
  /** {kind: "points"|"exclude"|"multiply", value} or null when the rule doesn't apply. */
  S.applyRule = function (rule, ad, profile) {
    const m = test(rule, ad, profile);
    if (!m) return null;
    if (rule.and && rule.and.field && !test(rule.and, ad, profile)) return null;
    if (rule.action === "exclude") return { kind: "exclude" };
    if (rule.action === "multiply") return { kind: "multiply", value: Number(rule.factor ?? 1) };
    return { kind: "points", value: Math.round(Number(rule.points || 0) * m * 10) / 10 };
  };
  function describeCond(c) {
    const f = S.field(c.field);
    if (!f) return "(bilinmeyen alan)";
    const op = (S.OPS[f.type] || []).find(([k]) => k === c.op);
    let cond = op ? op[1] : c.op;
    if (["gte", "lte"].includes(c.op)) cond += " " + S.fmt(c.field, Number(c.value));
    if (c.op === "between") cond = `${S.fmt(c.field, Number(c.value))} – ${S.fmt(c.field, Number(c.value2))}`;
    if (c.op === "per_above") cond = `${S.fmt(c.field, Number(c.value))} üstündeki her birim`;
    if (c.op === "per_below") cond = `${S.fmt(c.field, Number(c.value))} altındaki her birim`;
    if (c.op === "in" || c.op === "not_in") cond = (c.op === "in" ? "= " : "≠ ") + (c.values || []).map((x) => S.optLabel(c.field, x)).join(" / ");
    return `${f.label}: ${cond}`;
  }
  S.describeRule = (r) => describeCond(r) + (r.and && r.and.field ? " ve " + describeCond(r.and) : "");

  // ---------- scoring ----------
  /** Score every ad with a profile. Returns Map id → result; results also sorted in .ranked. */
  S.run = function (profile, ads) {
    S.fields(H.index);
    const crit = (profile.criteria || []).filter((c) => S.field(c.field) && S.critType(c.field) && Number(c.weight) > 0);
    const b = crit.map((c) => (S.critType(c.field) === "number" ? bounds(c, profile, ads) : null));
    const wsum = crit.reduce((s, c) => s + Number(c.weight), 0);
    const results = new Map();
    for (const ad of ads) {
      const parts = crit.map((c, i) => {
        const v = S.value(ad, c.field, profile);
        const n0 = critN(c, v, b[i]);
        const n = n0 == null ? 0.5 : n0; // unknown: neutral
        return { field: c.field, label: S.field(c.field).label, weight: Number(c.weight), value: v, n, unknown: n0 == null, pts: wsum ? (100 * Number(c.weight) * n) / wsum : 0, max: wsum ? (100 * Number(c.weight)) / wsum : 0 };
      });
      const base = parts.reduce((s, x) => s + x.pts, 0);
      const hits = [], mults = [], excluded = [];
      for (const r of profile.rules || []) {
        if (r.enabled === false) continue;
        const res = S.applyRule(r, ad, profile);
        if (!res) continue;
        if (res.kind === "exclude") excluded.push(S.describeRule(r));
        else if (res.kind === "multiply") mults.push({ label: S.describeRule(r), factor: res.value });
        else if (res.value) hits.push({ label: S.describeRule(r), pts: res.value });
      }
      // Feature points: every yes/no field and checklist feature can carry "+x if present / −y if absent".
      for (const [key, fp] of Object.entries(profile.features || {})) {
        const f = S.field(key);
        if (!f) continue;
        const v = S.value(ad, key, profile);
        if (v === true && Number(fp.yes)) hits.push({ label: `${f.label}: var`, pts: Number(fp.yes), feature: true });
        else if (v === false && Number(fp.no)) hits.push({ label: `${f.label}: yok`, pts: Number(fp.no), feature: true });
      }
      const bonus = hits.reduce((s, h) => s + h.pts, 0);
      const factor = mults.reduce((s, m) => s * m.factor, 1);
      const total = (base + bonus) * factor;
      results.set(ad.id, { id: ad.id, base: Math.round(base * 10) / 10, bonus: Math.round(bonus * 10) / 10, factor, total: Math.round(total * 10) / 10, parts, hits, mults, excluded });
    }
    const ranked = [...results.values()].sort((x, y) => !!x.excluded.length - !!y.excluded.length || y.total - x.total);
    let rank = 0;
    for (const r of ranked) r.rank = r.excluded.length ? null : ++rank;
    results.ranked = ranked;
    results.bounds = b;
    return results;
  };

  // ---------- profiles ----------
  const uid = () => Math.random().toString(36).slice(2, 9);
  S.newId = uid;
  const crit = (field, weight, extra) => ({ id: uid(), field, weight, dir: "low", best: null, worst: null, ...extra });
  const rule = (field, op, extra) => ({ id: uid(), field, op, action: "points", points: 0, enabled: true, ...extra });
  S.PRESETS = {
    balanced: "Dengeli (önerilen)",
    cheap: "Ucuzluk öncelikli",
    commute: "Ulaşım öncelikli",
    comfort: "Konfor öncelikli",
  };
  /** Built from the user's earlier spreadsheet scoring, with commute weighted up now that
   * commute times come from real timetables instead of estimates. */
  S.defaultProfile = function (name, kind) {
    kind = kind || "balanced";
    const p = {
      id: uid(), name: name || S.PRESETS[kind] || S.PRESETS.balanced, mode: "transit", version: 2,
      cost: JSON.parse(JSON.stringify(S.COST_DEFAULTS)),
      criteria: [
        crit("_eff_cost", 30, { best: 43000, worst: 62000 }),
        crit("_d2d", 24, { best: 100, worst: 170 }),
        crit("_floor_type", 8, { map: { "Ara kat": 100, "Yüksek giriş": 70, "Giriş / bahçe": 50, "En üst kat": 40, Kot: 0 } }),
        crit("area_net_m2", 7, { dir: "high", best: 105, worst: 70 }),
        crit("in_complex", 5, { map: { true: 100, false: 0 } }),
        crit("building_age_min", 5, { best: 5, worst: 30 }),
        crit("price_per_m2_net", 4, { best: 320, worst: 600 }),
        crit("_parking", 4, { map: { Kapalı: 100, Açık: 50, Yok: 0 } }),
        crit("_elevator", 4, { map: { Var: 100, "Yok, 2. kat ve altı": 100, "Yok, 3. kat ve üstü": 0 } }),
        crit("_interior_age", 3, { best: 5, worst: 30 }),
        crit("_station_walk", 3, { best: 5, worst: 25 }),
        crit("balcony", 2, { map: { true: 100, false: 0 } }),
        crit("_env", 2, { dir: "high", best: 5, worst: 1 }),
        crit("_security", 1, { dir: "high", best: 5, worst: 1 }),
      ],
      rules: [
        rule("_status", "in", { values: ["rejected", "no_longer_listed"], action: "exclude" }),
        // bonuses
        rule("_furnishing", "in", { values: ["new"], points: 3 }),
        rule("_furnishing", "in", { values: ["good"], points: 1.5 }),
        rule("bathrooms", "gte", { value: 2, points: 2 }),
        rule("_pets", "in", { values: ["yes"], points: 2 }),
        rule("has_insulation", "true", { points: 1.5, and: { field: "building_age_min", op: "gte", value: 15 } }),
        rule("_rating", "per_above", { value: 0, points: 1.5 }),
        // penalties
        rule("_pets", "in", { values: ["no"], points: -3 }),
        rule("_listing_age", "between", { value: 21, value2: 44, points: -3 }),
        rule("_listing_age", "between", { value: 45, value2: 89, points: -6 }),
        rule("_listing_age", "gte", { value: 90, points: -10 }),
        rule("photo_count", "between", { value: 1, value2: 5, points: -3 }),
        rule("photo_count", "lte", { value: 0, points: -6 }),
        rule("has_squat_toilet", "true", { action: "multiply", factor: 0.5 }),
      ],
      // "var" / "yok" points per feature (edit all of them in the Özellik puanları table)
      features: {
        _favorite: { yes: 3 },
        has_gym: { yes: 2 }, has_pool: { yes: 2 }, has_indoor_pool: { yes: 0.5 }, has_sauna: { yes: 0.5 },
        has_security: { yes: 1 }, has_camera: { yes: 0.5 }, has_concierge: { yes: 0.5 }, has_generator: { yes: 0.5 },
        has_water_tank: { yes: 0.5 }, has_insulation: { yes: 1 }, has_sound_insulation: { yes: 1 }, has_ev_charger: { yes: 0.5 },
        has_double_glazing: { yes: 1.5, no: -1 }, has_steel_door: { yes: 0.5 }, has_fiber: { yes: 1.5 }, has_video_intercom: { yes: 0.5 },
        has_ensuite: { yes: 1 }, separate_kitchen: { yes: 1 }, has_closed_balcony: { yes: 0.5 }, has_built_in_kitchen: { yes: 0.5 },
        has_built_in_wardrobe: { yes: 0.5 }, has_dishwasher: { yes: 0.5 }, has_washing_machine: { yes: 0.5 }, has_ac: { yes: 0.5 },
        south_facing: { yes: 1.5 }, view_nature: { yes: 0.5 }, view_city: { yes: 0.5 },
        transit_uses_rail: { yes: 1.5 }, near_market: { yes: 0.5 }, near_park: { yes: 0.5 }, near_gym: { yes: 0.5 },
        has_squat_toilet: {}, // handled by the × 0.5 rule
        tenant_inside: { yes: -2 }, _timing_sensitive: { yes: -3 }, _loc_suspect: { yes: -5 }, _dup_other: { yes: -2 },
      },
    };
    const w = (field, weight) => {
      const c = p.criteria.find((x) => x.field === field);
      if (c) c.weight = weight;
    };
    if (kind === "cheap") { w("_eff_cost", 45); w("_d2d", 15); w("area_net_m2", 4); }
    if (kind === "commute") { w("_d2d", 40); w("_eff_cost", 22); w("_station_walk", 6); }
    if (kind === "comfort") { w("_eff_cost", 18); w("_d2d", 18); w("area_net_m2", 12); w("building_age_min", 8); w("_interior_age", 6); w("_parking", 6); }
    return p;
  };
  S.load = function () {
    let st = H.store.get(KEY, null);
    if (!st || !st.profiles || !Object.keys(st.profiles).length) {
      const p = S.defaultProfile();
      st = { active: p.id, profiles: { [p.id]: p } };
    }
    if (!st.profiles[st.active]) st.active = Object.keys(st.profiles)[0];
    return st;
  };
  S.save = (st) => {
    H.store.set(KEY, st);
    document.dispatchEvent(new CustomEvent("house:scoring"));
  };
  S.active = () => {
    const st = S.load();
    return st.profiles[st.active];
  };

  // Cached scores for the active profile (list sort / compare / triage / detail).
  let cache = null;
  S.activeResults = function () {
    if (!H.index) return new Map();
    const p = S.active();
    const sig = JSON.stringify(p) + "|" + JSON.stringify(H.costSettings()) + "|" + JSON.stringify(H.localNotes());
    if (!cache || cache.sig !== sig) cache = { sig, res: S.run(p, H.index.ads) };
    return cache.res;
  };
  S.scoreOf = (id) => S.activeResults().get(id) || null;

  // Share a profile through a link: /house-renting/score/#p=<base64url JSON>
  S.encode = (p) => btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  S.decode = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
  /** Validate an imported profile; returns a clean copy or throws. */
  S.sanitize = function (p) {
    if (!p || typeof p !== "object" || !Array.isArray(p.criteria) || !Array.isArray(p.rules)) throw new Error("Geçersiz puanlama profili");
    const num = (x) => (x === null || x === "" || x === undefined ? null : Number.isFinite(Number(x)) ? Number(x) : null);
    const ops = new Set(Object.values(S.OPS).flat().map(([k]) => k));
    const cond = (c) => (c && typeof c === "object" && ops.has(c.op) ? { field: String(c.field), op: c.op, value: num(c.value), value2: num(c.value2), values: Array.isArray(c.values) ? c.values.map(String).slice(0, 50) : undefined } : undefined);
    const map = (m) => (m && typeof m === "object" ? Object.fromEntries(Object.entries(m).slice(0, 30).map(([k, v]) => [String(k), Math.max(0, Math.min(100, Number(v) || 0))])) : undefined);
    const cost = p.cost && typeof p.cost === "object" ? p.cost : {};
    const heating = Object.fromEntries(Object.entries(cost.heating || {}).slice(0, 10).map(([k, v]) => [String(k), num(v) || 0]));
    return {
      id: uid(),
      name: String(p.name || "Paylaşılan profil").slice(0, 60),
      mode: p.mode === "drive" ? "drive" : "transit",
      version: 2,
      cost: {
        ...S.COST_DEFAULTS,
        ...Object.fromEntries(["commission", "furnitureNone", "furniturePartial", "furnitureUnknown", "months"].filter((k) => num(cost[k]) != null).map((k) => [k, num(cost[k])])),
        heating: { ...S.COST_DEFAULTS.heating, ...heating },
        includeTransport: cost.includeTransport !== false,
      },
      criteria: p.criteria.slice(0, 40).map((c) => ({ id: uid(), field: String(c.field), weight: Math.max(0, Math.min(100, Number(c.weight) || 0)), dir: c.dir === "high" ? "high" : "low", best: num(c.best), worst: num(c.worst), map: map(c.map) })),
      features: Object.fromEntries(
        Object.entries(p.features && typeof p.features === "object" ? p.features : {}).slice(0, 400).map(([k, v]) => [String(k), { yes: num(v && v.yes) || 0, no: num(v && v.no) || 0 }])
      ),
      rules: p.rules.slice(0, 150).filter((r) => ops.has(r.op)).map((r) => ({
        ...cond(r), id: uid(),
        action: ["exclude", "multiply"].includes(r.action) ? r.action : "points",
        points: num(r.points) || 0, factor: num(r.factor) ?? 1, enabled: r.enabled !== false, and: cond(r.and),
      })),
    };
  };
})();
