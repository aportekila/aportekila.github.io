/* List page: filter panel, sorting, cards, map. State lives in the URL query string. */
(function () {
  "use strict";
  const { el, clear } = H;

  // Fields shown at the top of the panel; they are left out of the per-group sections.
  const QUICK_BOOLS = ["is_owner", "in_complex", "has_pool", "has_gym", "near_gym", "furnished", "separate_kitchen", "has_closed_parking", "elevator", "transit_uses_rail"];
  const COMMUTE = { c_am: "Sabah (eve → işe, 08:50'de varış)", c_pm: "Akşam (18:00'de çıkış → ev)", c_daily: "Günlük toplam (sabah + akşam)" };
  const COMMUTE_KEY = { c_am: "am", c_pm: "pm", c_daily: "daily" };
  const SKIP_IN_GROUPS = new Set(["price_value", ...QUICK_BOOLS, "am_transit_min", "pm_transit_min", "daily_transit_min", "am_drive_min", "pm_drive_min", "daily_drive_min"]);
  const TIME_HINT = { am_leave_transit: "Evden çıkış saati aralığı", am_leave_drive: "Evden çıkış saati aralığı", pm_arrive_transit: "Eve varış saati aralığı", pm_arrive_drive: "Eve varış saati aralığı" };
  const AVOID = new Set(["is_ground_floor", "has_squat_toilet", "tenant_inside"]);
  const SORTS = [
    { key: "price_value", label: "Kira", dir: "asc" },
    { key: "monthly_cost", label: "Aylık toplam (kira + aidat)", dir: "asc" },
    { key: "c_daily", label: "Günlük yolculuk (seçili tip)", dir: "asc" },
    { key: "daily_transit_min", label: "Günlük toplu taşıma", dir: "asc" },
    { key: "daily_drive_min", label: "Günlük araç", dir: "asc" },
    { key: "c_am", label: "Sabah yolculuk (seçili tip)", dir: "asc" },
    { key: "price_per_m2_net", label: "m² başına kira", dir: "asc" },
    { key: "area_net_m2", label: "Net m²", dir: "desc" },
    { key: "building_age_min", label: "Bina yaşı", dir: "asc" },
    { key: "move_in_cost", label: "Taşınma maliyeti", dir: "asc" },
    { key: "listing_date", label: "İlan tarihi", dir: "desc" },
    { key: "_rating", label: "Puanım", dir: "desc" },
  ];
  const DEFAULT_SORT = "price_value";

  let FI, ADS, CATALOG, TIME_RANGE = {};
  let state;
  const openSections = new Set(["_quick"]);
  const cardCache = new Map();
  let map = null, markers = new Map(), mapFitted = false;

  // ---------- state ----------
  function emptyState() {
    return { mode: H.getMode(), q: "", sort: DEFAULT_SORT, dir: null, view: "list", hideUnknown: false, fav: false, hideRejected: false, statuses: [], ranges: {}, bools: {}, multi: {}, feats: {} };
  }
  const sortDef = (k) => SORTS.find((s) => s.key === k) || SORTS[0];
  const sortDir = () => state.dir || sortDef(state.sort).dir;

  function fromQuery(qs) {
    const p = new URLSearchParams(qs);
    const s = emptyState();
    if (p.get("m") === "drive" || p.get("m") === "transit") s.mode = p.get("m");
    s.q = p.get("q") || "";
    if (SORTS.some((x) => x.key === p.get("s"))) s.sort = p.get("s");
    if (p.get("d") === "asc" || p.get("d") === "desc") s.dir = p.get("d");
    if (p.get("v") === "map") s.view = "map";
    s.hideUnknown = p.get("hu") === "1";
    s.fav = p.get("fav") === "1";
    s.hideRejected = p.get("hr") === "1";
    s.statuses = p.getAll("st").filter((x) => x in H.STATUS);
    for (const [k, v] of p) {
      if (k.startsWith("r_")) {
        const [lo, hi] = v.split("_").map(Number);
        if (!isNaN(lo) && !isNaN(hi)) s.ranges[k.slice(2)] = [lo, hi];
      } else if (k.startsWith("b_") && (v === "y" || v === "n")) s.bools[k.slice(2)] = v === "y" ? 1 : -1;
      else if (k.startsWith("x_")) (s.multi[k.slice(2)] = s.multi[k.slice(2)] || []).push(v);
      else if (k === "fy") s.feats[v] = 1;
      else if (k === "fn") s.feats[v] = -1;
    }
    return s;
  }
  function toQuery() {
    const p = new URLSearchParams();
    p.set("m", state.mode);
    if (state.q) p.set("q", state.q);
    if (state.sort !== DEFAULT_SORT) p.set("s", state.sort);
    if (state.dir) p.set("d", state.dir);
    if (state.view === "map") p.set("v", "map");
    if (state.hideUnknown) p.set("hu", "1");
    if (state.fav) p.set("fav", "1");
    if (state.hideRejected) p.set("hr", "1");
    state.statuses.forEach((x) => p.append("st", x));
    for (const [k, [lo, hi]] of Object.entries(state.ranges)) p.set("r_" + k, lo + "_" + hi);
    for (const [k, v] of Object.entries(state.bools)) p.set("b_" + k, v > 0 ? "y" : "n");
    for (const [k, vs] of Object.entries(state.multi)) vs.forEach((v) => p.append("x_" + k, v));
    for (const [k, v] of Object.entries(state.feats)) p.append(v > 0 ? "fy" : "fn", k);
    return p.toString();
  }
  function saveUrl() {
    const qs = toQuery();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
    H.store.set("house.lastQuery", qs);
    H.setMode(state.mode);
  }

  // ---------- field access ----------
  function fieldOf(key) {
    return key in COMMUTE_KEY ? H.MODES[state.mode][COMMUTE_KEY[key]] : key;
  }
  function value(ad, key) {
    if (key === "_rating") return H.notes(ad.id).rating;
    const f = fieldOf(key);
    const v = ad[f];
    return TIME_RANGE[f] ? H.hhmmToMin(v) : v;
  }
  function rangeSpec(key) {
    const f = fieldOf(key);
    const info = FI[f];
    if (TIME_RANGE[f]) return { ...TIME_RANGE[f], step: 5, fmt: H.minToHhmm, label: info.label };
    let step = 1;
    if (info.unit === "TL") step = info.max - info.min >= 10000 ? 500 : 50;
    else if (!Number.isInteger(info.min) || !Number.isInteger(info.max)) step = 0.1;
    const round = (x) => Math.round(x * 1000) / 1000;
    return {
      min: round(Math.floor(info.min / step) * step),
      max: round(Math.ceil(info.max / step) * step),
      step,
      fmt: (v) => H.fmtField(f, v, info),
      label: key in COMMUTE ? COMMUTE[key] : info.label,
    };
  }

  // ---------- filtering ----------
  function lc(s) {
    return String(s || "").toLocaleLowerCase("tr-TR");
  }
  /**
   * Run every active filter on an ad. Returns the ids of the filters it fails
   * ("q", "fav", "hr", "st", "r:<key>", "b:<field>", "x:<field>", "f:<feature>") and
   * the labels of active filters whose value is unknown for it. The ad is shown when
   * nothing fails; an ad failing only filter X counts towards X's option counts.
   */
  function evaluate(ad) {
    const fails = [];
    const unknown = [];
    const miss = (id, label) => {
      if (state.hideUnknown) fails.push(id);
      else if (!unknown.includes(label)) unknown.push(label);
    };
    if (state.q) {
      const hay = lc([ad.title, ad.neighborhood, ad.district, ad.complex_name, ad.id, ...(ad.features_all || [])].join(" | "));
      if (!lc(state.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) fails.push("q");
    }
    const n = H.notes(ad.id);
    if (state.fav && !n.favorite) fails.push("fav");
    if (state.hideRejected && n.status === "rejected") fails.push("hr");
    if (state.statuses.length && !state.statuses.includes(n.status)) fails.push("st");
    for (const [key, [lo, hi]] of Object.entries(state.ranges)) {
      const v = value(ad, key);
      if (v == null) miss("r:" + key, rangeSpec(key).label);
      else if (v < lo || v > hi) fails.push("r:" + key);
    }
    for (const [f, want] of Object.entries(state.bools)) {
      const v = ad[f];
      if (v == null) miss("b:" + f, FI[f].label);
      else if ((want > 0) !== (v === true)) fails.push("b:" + f);
    }
    for (const [f, vals] of Object.entries(state.multi)) {
      if (!vals.length) continue;
      const v = ad[f];
      if (v == null || (Array.isArray(v) && !v.length)) miss("x:" + f, FI[f].label);
      else if (!(Array.isArray(v) ? v.some((x) => vals.includes(x)) : vals.includes(v))) fails.push("x:" + f);
    }
    const featEntries = Object.entries(state.feats);
    if (featEntries.length) {
      const filled = ad.checklist_quality === "filled";
      const have = new Set(ad.features_all || []);
      for (const [name, want] of featEntries) {
        if (!filled) miss("f:" + name, "Özellik listesi");
        else if ((want > 0) !== have.has(name)) fails.push("f:" + name);
      }
    }
    return { fails, unknown };
  }

  // ---------- live option counts ----------
  // Each control registers an updater; apply() calls them with facet(id) = the ads that
  // pass every active filter except filter `id` (so a chip's count says what you'd get).
  let facetUpdaters = [];
  const onFacets = (fn) => facetUpdaters.push(fn);
  function makeFacet(evals) {
    const cache = new Map();
    return (id) => {
      if (!cache.has(id)) cache.set(id, evals.filter(([, e]) => !e.fails.length || (e.fails.length === 1 && e.fails[0] === id)).map(([ad]) => ad));
      return cache.get(id);
    };
  }

  function compare(a, b) {
    const va = value(a, state.sort), vb = value(b, state.sort);
    if (va == null && vb == null) return a.price_value - b.price_value;
    if (va == null) return 1;
    if (vb == null) return -1;
    let c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    if (sortDir() === "desc") c = -c;
    return c || a.price_value - b.price_value || a.id.localeCompare(b.id);
  }

  // ---------- filter panel ----------
  function section(key, title, activeCount, build) {
    const det = el("details", { class: "h-fsec", open: openSections.has(key) || activeCount > 0 });
    det.addEventListener("toggle", () => (det.open ? openSections.add(key) : openSections.delete(key)));
    det.append(el("summary", {}, title, activeCount ? el("span", { class: "h-badge", text: activeCount }) : null));
    const body = el("div", { class: "h-fsec-body" });
    build(body);
    det.append(body);
    return det;
  }

  function rangeControl(key) {
    const spec = rangeSpec(key);
    const cur = state.ranges[key] || [spec.min, spec.max];
    const out = el("output");
    const wrap = el("div", { class: "h-range" });
    const lo = el("input", { type: "range", min: spec.min, max: spec.max, step: spec.step, value: cur[0], "aria-label": spec.label + " en az" });
    const hi = el("input", { type: "range", min: spec.min, max: spec.max, step: spec.step, value: cur[1], "aria-label": spec.label + " en çok" });
    const info = FI[fieldOf(key)];
    const dual = el("div", { class: "h-dual" }, lo, hi);
    const sync = () => {
      let a = Number(lo.value), b = Number(hi.value);
      if (a > b) [a, b] = [b, a];
      const pct = (x) => ((x - spec.min) / (spec.max - spec.min || 1)) * 100;
      dual.style.setProperty("--a", pct(a) + "%");
      dual.style.setProperty("--b", pct(b) + "%");
      const active = a > spec.min || b < spec.max;
      if (active) state.ranges[key] = [a, b];
      else delete state.ranges[key];
      out.textContent = active ? `${spec.fmt(a)} – ${spec.fmt(b)}` : "hepsi";
      wrap.classList.toggle("active", active);
    };
    const onInput = () => {
      sync();
      scheduleApply();
    };
    lo.addEventListener("input", onInput);
    hi.addEventListener("input", onInput);
    wrap.append(el("label", {}, el("span", { text: spec.label }), out), dual);
    if (info && info.missing) {
      const hint = el("div", { class: "h-hint" });
      wrap.append(hint);
      const f = fieldOf(key);
      onFacets((facet) => {
        const n = facet("r:" + key).filter((ad) => ad[f] == null).length;
        hint.textContent = `${n} ilanda bilinmiyor`;
      });
    }
    sync();
    return wrap;
  }

  function triControl(f, labelText, extra) {
    const info = FI[f];
    const row = el("div", { class: "h-tri" });
    const counts = el("small");
    row.append(el("span", { class: "h-tri-name" }, labelText || info.label, " ", counts, extra ? el("small", { text: " · " + extra }) : null));
    onFacets((facet) => {
      const ads = facet("b:" + f);
      const yes = ads.filter((ad) => ad[f] === true).length;
      const unk = ads.filter((ad) => ad[f] == null).length;
      counts.textContent = `(${yes} var, ${ads.length - yes - unk} yok` + (unk ? `, ${unk} ?)` : ")");
      row.classList.toggle("zero", !yes && !state.bools[f]);
    });
    const btns = el("span", { class: "h-tri-btns", role: "group", "aria-label": info.label });
    const opts = [[0, "Farketmez"], [1, "Olsun"], [-1, "Olmasın"]];
    const sync = () => btns.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.v) === (state.bools[f] || 0)));
    for (const [v, t] of opts) {
      btns.append(
        el("button", {
          type: "button", dataset: { v }, text: t,
          onclick: () => {
            if (v) state.bools[f] = v;
            else delete state.bools[f];
            sync();
            apply(true);
          },
        })
      );
    }
    row.append(btns);
    sync();
    return row;
  }

  function multiControl(f, options, labelFor) {
    const info = FI[f];
    const box = el("div", {}, el("div", { class: "h-sub", text: info.label }));
    const chips = el("div", { class: "h-chips" });
    for (const opt of options) {
      const count = el("small");
      const chip = el("button", { type: "button", class: "h-chip" }, labelFor ? labelFor(opt) : opt, " ", count);
      onFacets((facet) => {
        const n = facet("x:" + f).filter((ad) => [].concat(ad[f] ?? []).includes(opt)).length;
        count.textContent = n;
        chip.classList.toggle("zero", !n);
      });
      const sync = () => chip.setAttribute("aria-pressed", (state.multi[f] || []).includes(opt));
      chip.addEventListener("click", () => {
        const cur = new Set(state.multi[f] || []);
        cur.has(opt) ? cur.delete(opt) : cur.add(opt);
        if (cur.size) state.multi[f] = [...cur];
        else delete state.multi[f];
        sync();
        apply(true);
      });
      sync();
      chips.append(chip);
    }
    box.append(chips);
    return box;
  }

  function featureChip(item) {
    const count = el("small");
    const chip = el("button", { type: "button", class: "h-chip" + (item.important ? " imp" : ""), title: "Tıkla: olsun → olmasın → farketmez" }, item.name, " ", count);
    onFacets((facet) => {
      const n = facet("f:" + item.name).filter((ad) => (ad.features_all || []).includes(item.name)).length;
      count.textContent = n;
      chip.classList.toggle("zero", !n);
    });
    const sync = () => {
      const v = state.feats[item.name] || 0;
      chip.classList.toggle("yes", v > 0);
      chip.classList.toggle("no", v < 0);
      chip.setAttribute("aria-label", item.name + (v > 0 ? ": olsun" : v < 0 ? ": olmasın" : ": farketmez"));
    };
    chip.addEventListener("click", () => {
      const v = state.feats[item.name] || 0;
      const next = v === 0 ? 1 : v === 1 ? -1 : 0;
      if (next) state.feats[item.name] = next;
      else delete state.feats[item.name];
      sync();
      apply(true);
    });
    sync();
    return chip;
  }

  function buildPanel() {
    const panel = clear(document.getElementById("filter-panel"));
    facetUpdaters = [];
    const countIn = (keys) => keys.filter((k) => k in state.ranges || k in state.bools || (state.multi[k] || []).length).length;

    // Quick filters
    panel.append(
      section("_quick", "Hızlı filtreler", countIn(["price_value", ...Object.keys(COMMUTE), ...QUICK_BOOLS]) + (state.hideUnknown ? 1 : 0), (b) => {
        b.append(rangeControl("price_value"));
        b.append(el("div", { class: "h-sub", text: `${H.MODES[state.mode].icon} ${H.MODES[state.mode].label} süreleri` }));
        for (const k of Object.keys(COMMUTE)) b.append(rangeControl(k));
        b.append(el("div", { class: "h-sub", text: "Olmazsa olmazlar" }));
        for (const f of QUICK_BOOLS) if (FI[f]) b.append(triControl(f));
        const hu = el("input", { type: "checkbox", checked: state.hideUnknown });
        hu.addEventListener("change", () => {
          state.hideUnknown = hu.checked;
          apply(true);
        });
        b.append(el("label", { class: "h-check" }, hu, "Bilinmeyenleri gizle"));
        b.append(el("div", { class: "h-hint", text: "Kapalıyken, bilgisi olmayan ilanlar filtrede kalır ve “?” rozetiyle gösterilir." }));
      })
    );

    // Notes
    const noteActive = (state.fav ? 1 : 0) + (state.hideRejected ? 1 : 0) + (state.statuses.length ? 1 : 0);
    panel.append(
      section("_notes", "Notlarım", noteActive, (b) => {
        const fav = el("input", { type: "checkbox", checked: state.fav });
        fav.addEventListener("change", () => {
          state.fav = fav.checked;
          apply(true);
        });
        const hr = el("input", { type: "checkbox", checked: state.hideRejected });
        hr.addEventListener("change", () => {
          state.hideRejected = hr.checked;
          apply(true);
        });
        b.append(el("label", { class: "h-check" }, fav, "Sadece favoriler ★"), el("label", { class: "h-check" }, hr, "Elenenleri gizle"));
        const chips = el("div", { class: "h-chips" });
        for (const [k, label] of Object.entries(H.STATUS)) {
          const count = el("small");
          const chip = el("button", { type: "button", class: "h-chip" }, label, " ", count);
          onFacets((facet) => {
            const n = facet("st").filter((ad) => H.notes(ad.id).status === k).length;
            count.textContent = n;
            chip.classList.toggle("zero", !n);
          });
          const sync = () => chip.setAttribute("aria-pressed", state.statuses.includes(k));
          chip.addEventListener("click", () => {
            state.statuses = state.statuses.includes(k) ? state.statuses.filter((x) => x !== k) : [...state.statuses, k];
            sync();
            apply(true);
          });
          sync();
          chips.append(chip);
        }
        b.append(el("div", { class: "h-sub", text: "Durum" }), chips);
      })
    );

    // One section per field_info group
    const groups = new Map();
    for (const [f, info] of Object.entries(FI)) {
      if (SKIP_IN_GROUPS.has(f)) continue;
      const usable =
        (info.filter === "range" && info.min != null && info.max > info.min) ||
        (info.filter === "boolean" && info.true_count > 0) ||
        (info.filter === "multi" && info.options && info.options.length > 1) ||
        (info.filter === "time" && TIME_RANGE[f]);
      if (!usable) continue;
      if (!groups.has(info.group)) groups.set(info.group, []);
      groups.get(info.group).push(f);
    }
    for (const [group, fields] of groups) {
      panel.append(
        section("g:" + group, group, countIn(fields), (b) => {
          for (const f of fields) {
            const info = FI[f];
            if (info.filter === "range" || info.filter === "time") b.append(rangeControl(f));
            else if (info.filter === "multi") b.append(multiControl(f, info.options, f === "seller_type" ? (v) => H.SELLER_TYPE[v] || v : f === "checklist_quality" ? (v) => H.CHECKLIST[v] || v : null));
          }
          const bools = fields.filter((f) => FI[f].filter === "boolean");
          if (bools.length) b.append(el("div", { class: "h-sub", text: "Var / yok" }));
          for (const f of bools) b.append(triControl(f, null, AVOID.has(f) ? "genelde istenmez" : null));
        })
      );
    }

    // Every checklist feature
    const featCount = Object.keys(state.feats).length;
    panel.append(
      section("_features", "Özellikler (ilan işaretlemeleri)", featCount, (b) => {
        b.append(el("div", { class: "h-hint", text: "Tıkla: yeşil = olsun, kırmızı = olmasın, tekrar = farketmez. ★ önemli. Özellik listesi boş olan ilanlar “bilinmiyor” sayılır." }));
        for (const [group, items] of Object.entries(CATALOG)) {
          const list = items.filter((i) => i.relevant && i.count > 0).sort((a, b) => b.important - a.important || b.count - a.count);
          if (!list.length) continue;
          const active = list.filter((i) => i.name in state.feats).length;
          b.append(section("f:" + group, group, active, (inner) => inner.append(el("div", { class: "h-chips" }, list.map(featureChip)))));
        }
      })
    );
  }

  // ---------- active filter summary ----------
  function activeChips() {
    const box = clear(document.getElementById("active-chips"));
    const add = (text, remove) =>
      box.append(el("button", { type: "button", class: "h-chip", title: "Kaldır", onclick: () => { remove(); buildPanel(); apply(true); } }, text, " ✕"));
    if (state.q) add(`“${state.q}”`, () => { state.q = ""; document.getElementById("search").value = ""; });
    for (const [k, [lo, hi]] of Object.entries(state.ranges)) {
      const s = rangeSpec(k);
      add(`${s.label}: ${s.fmt(lo)} – ${s.fmt(hi)}`, () => delete state.ranges[k]);
    }
    for (const [f, v] of Object.entries(state.bools)) add(`${FI[f].label}: ${v > 0 ? "olsun" : "olmasın"}`, () => delete state.bools[f]);
    for (const [f, vs] of Object.entries(state.multi)) add(`${FI[f].label}: ${vs.map((v) => H.fmtField(f, v, FI[f])).join(", ")}`, () => delete state.multi[f]);
    for (const [n, v] of Object.entries(state.feats)) add(`${n}: ${v > 0 ? "olsun" : "olmasın"}`, () => delete state.feats[n]);
    if (state.fav) add("Favoriler", () => (state.fav = false));
    if (state.hideRejected) add("Elenenler gizli", () => (state.hideRejected = false));
    if (state.statuses.length) add("Durum: " + state.statuses.map((s) => H.STATUS[s]).join(", "), () => (state.statuses = []));
    if (state.hideUnknown) add("Bilinmeyenler gizli", () => (state.hideUnknown = false));
  }

  // ---------- cards ----------
  function buildCard(ad) {
    const n = H.notes(ad.id);
    const mode = H.MODES[state.mode];
    const photo = H.cardPhoto(ad);
    const link = H.adPage(ad.id);
    const dailyInfo = FI[mode.daily];
    const heat = H.heat((ad[mode.daily] - dailyInfo.min) / (dailyInfo.max - dailyInfo.min || 1));
    const card = el("article", { class: "h-card" + (n.status === "rejected" ? " rejected" : "") });

    const badges = el("div", { class: "h-photo-badges" });
    if (n.status !== "new") badges.append(H.statusTag(n.status));
    if (ad.is_owner) badges.append(el("span", { class: "h-tag owner", text: "Sahibinden" }));
    card.append(
      el(
        "div",
        { class: "h-card-photo" },
        el("a", { href: link, tabindex: -1, "aria-hidden": "true" }, photo ? el("img", { src: photo, alt: "", loading: "lazy", width: 528, height: 396 }) : null),
        badges,
        H.favButton(ad.id, () => apply(false)),
        el(
          "div",
          { class: "h-photo-price" },
          el("b", { text: H.money(ad.price_value) }),
          el("span", { text: ad.dues_known ? `aylık toplam ${H.money(ad.monthly_cost)}` : "aidat belirtilmemiş" })
        )
      )
    );

    const body = el("div", { class: "h-card-body" });
    body.append(el("a", { class: "h-card-title", href: link, text: ad.title }));
    body.append(
      el("div", { class: "h-card-loc" }, el("span", { text: [ad.district, ad.neighborhood].filter(Boolean).join(" · ") }), ad.complex_name ? el("span", { class: "h-muted", text: ad.complex_name }) : null)
    );
    body.append(
      el(
        "div",
        { class: "h-commute", title: `${mode.label}: sabah evden çıkış ${ad[mode.leave] || "?"}, akşam eve varış ${ad[mode.arrive] || "?"}` },
        el("div", {}, el("span", { text: "Sabah" }), el("b", { text: H.mins(ad[mode.am]) })),
        el("div", {}, el("span", { text: "Akşam" }), el("b", { text: H.mins(ad[mode.pm]) })),
        el("div", { class: "daily", style: `--heat:${heat}` }, el("span", { text: mode.icon + " Günlük" }), el("b", { text: H.mins(ad[mode.daily]) }))
      )
    );
    const age = ad.building_age_max == null ? `${ad.building_age_min}+ yaş` : ad.building_age_min === ad.building_age_max ? `${ad.building_age_min} yaş` : `${ad.building_age_min}–${ad.building_age_max} yaş`;
    body.append(
      el(
        "ul",
        { class: "h-specs", "aria-label": "Özet" },
        el("li", { text: `${ad.area_net_m2} m²` }),
        el("li", { text: `Kat ${ad.floor}/${ad.floor_count}` }),
        el("li", { text: age }),
        el("li", { text: ad.heating || "Isıtma ?" })
      )
    );
    body.append(
      el(
        "div",
        { class: "h-route h-muted" },
        state.mode === "transit"
          ? `🚏 ${ad.am_transit_lines || "?"} · ${ad.am_leave_transit || "?"}'de çık`
          : `🚦 trafik +${H.mins(ad.am_drive_traffic_min)} · ${ad.am_leave_drive || "?"}'de çık`
      )
    );

    const tags = el("div", { class: "h-tags" });
    if (n.rating) tags.append(el("span", { class: "h-tag rating", text: "★".repeat(n.rating) }));
    if (H.CHECKLIST_WARN[ad.checklist_quality]) tags.append(el("span", { class: "h-tag warn", text: H.CHECKLIST_WARN[ad.checklist_quality] }));
    const unk = el("span", { class: "h-tag unk", hidden: true });
    tags.append(unk);
    body.append(tags);
    if (n.pros.length || n.cons.length) {
      body.append(el("div", { class: "h-proscons" }, n.pros.length ? H.tagList(n.pros, "pro", 3) : null, n.cons.length ? H.tagList(n.cons, "con", 2) : null));
    }
    body.append(
      el("div", { class: "h-card-foot" }, H.compareToggle(ad.id), el("span", { class: "h-muted h-small", text: H.date(ad.listing_date) }), el("a", { class: "h-more", href: link, text: "Detay →" }))
    );
    card.append(body);
    card._unk = unk;
    return card;
  }
  function cardFor(ad) {
    if (!cardCache.has(ad.id)) cardCache.set(ad.id, buildCard(ad));
    return cardCache.get(ad.id);
  }

  // ---------- map ----------
  function initMap() {
    if (map || !window.L) return;
    map = L.map("map", { scrollWheelZoom: true }).setView([39.93, 32.7], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const work = [39.8966714, 32.7736614];
    L.marker(work, { icon: L.divIcon({ className: "", html: '<div style="font-size:28px;line-height:1">🏢</div>', iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup("ODTÜ Teknokent (iş)");
    L.circleMarker([39.9073794, 32.7650499], { radius: 5, color: "#333", fillColor: "#fff", fillOpacity: 1, weight: 2 })
      .addTo(map)
      .bindPopup("ODTÜ A2 Metro Kapısı (ring buradan, ~15 dk)");
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const d = el("div", { class: "h-legend" });
      legend._div = d;
      return d;
    };
    legend.addTo(map);
    map._legend = legend;
  }
  function markerColor(ad) {
    const info = FI[H.MODES[state.mode].daily];
    return H.heat((ad[H.MODES[state.mode].daily] - info.min) / (info.max - info.min || 1));
  }
  function popupFor(ad) {
    const mode = H.MODES[state.mode];
    const n = H.notes(ad.id);
    const photo = H.cardPhoto(ad);
    return el(
      "div",
      { class: "h-popup" },
      photo ? el("img", { src: photo, alt: "" }) : null,
      el("a", { href: H.adPage(ad.id), text: ad.title }),
      el("div", {}, el("b", { text: H.money(ad.price_value) }), ` · ${ad.area_net_m2} m² · ${ad.neighborhood || ""}`),
      el("div", { text: `${mode.icon} sabah ${H.mins(ad[mode.am])} · akşam ${H.mins(ad[mode.pm])} · günlük ${H.mins(ad[mode.daily])}` }),
      n.status !== "new" || n.favorite ? el("div", {}, n.favorite ? "★ " : "", H.statusTag(n.status)) : null
    );
  }
  function updateMap(visible) {
    if (!map) return;
    const ids = new Set(visible.map((a) => a.id));
    for (const ad of ADS) {
      if (ad.latitude == null || ad.longitude == null) continue;
      let m = markers.get(ad.id);
      if (!m) {
        m = L.circleMarker([ad.latitude, ad.longitude], { radius: 8, weight: 1.5, color: "#222", fillOpacity: 0.9 });
        m.bindPopup(() => popupFor(ad));
        m.bindTooltip(() => `${H.money(ad.price_value)} · ${H.mins(ad[H.MODES[state.mode].daily])}`);
        markers.set(ad.id, m);
      }
      const fav = H.notes(ad.id).favorite;
      m.setStyle({ fillColor: markerColor(ad), weight: fav ? 3 : 1.5 });
      m.setRadius(fav ? 11 : 8);
      if (ids.has(ad.id)) m.addTo(map);
      else m.remove();
    }
    const info = FI[H.MODES[state.mode].daily];
    const d = map._legend._div;
    clear(d).append(
      el("div", { text: `Günlük ${H.MODES[state.mode].label.toLowerCase()}` }),
      el("div", { class: "h-legend-bar" }),
      el("div", { style: "display:flex;justify-content:space-between" }, el("span", { text: H.mins(info.min) }), el("span", { text: H.mins(info.max) })),
      el("div", { text: "Büyük daire = favori" })
    );
    if (!mapFitted && visible.length) {
      const pts = visible.filter((a) => a.latitude != null).map((a) => [a.latitude, a.longitude]);
      pts.push([39.8966714, 32.7736614]);
      map.fitBounds(pts, { padding: [30, 30] });
      mapFitted = true;
    }
  }

  // ---------- apply ----------
  let pending = 0;
  function scheduleApply() {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      apply(true);
    });
  }
  function apply(writeUrl) {
    const evals = ADS.map((ad) => [ad, evaluate(ad)]);
    const results = evals.filter(([, e]) => !e.fails.length);
    const facet = makeFacet(evals);
    for (const fn of facetUpdaters) fn(facet);
    results.sort((a, b) => compare(a[0], b[0]));
    const visible = results.map((r) => r[0]);

    const count = document.getElementById("count");
    count.textContent = `${visible.length} / ${ADS.length} ilan`;
    const container = document.getElementById("cards");
    const frag = document.createDocumentFragment();
    for (const [ad, r] of results) {
      const card = cardFor(ad);
      card._unk.hidden = !r.unknown.length;
      card._unk.textContent = "? " + r.unknown.join(", ");
      card._unk.title = "Bu ilanda bilinmiyor: " + r.unknown.join(", ");
      frag.append(card);
    }
    clear(container).append(frag);
    if (!visible.length) {
      const msg = state.fav && !H.favCount() ? "Henüz favori yok. Kartlardaki ☆ düğmesiyle ekleyebilirsin." : "Filtrelere uyan ilan yok.";
      container.append(el("p", { class: "h-empty", text: msg }));
    }

    document.getElementById("map").hidden = state.view !== "map";
    container.hidden = state.view === "map";
    if (state.view === "map") {
      initMap();
      if (map) setTimeout(() => map.invalidateSize(), 0);
      updateMap(visible);
    }
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === state.mode));
    document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === state.view));
    document.getElementById("sort").value = state.sort;
    document.getElementById("fav-toggle").setAttribute("aria-pressed", state.fav);
    // The header has separate "İlanlar" and "Favoriler" entries for this same page.
    document.querySelectorAll("[data-nav=list], [data-nav=fav]").forEach((a) => {
      if ((a.dataset.nav === "fav") === state.fav) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const dirBtn = document.getElementById("sort-dir");
    dirBtn.textContent = sortDir() === "asc" ? "↑ artan" : "↓ azalan";
    activeChips();
    updateCompareBar();
    if (writeUrl) saveUrl();
  }

  function updateCompareBar() {
    const ids = H.getCompare();
    document.getElementById("compare-bar").hidden = !ids.length;
    document.getElementById("compare-bar-text").textContent = `${ids.length} ilan seçili (en fazla ${H.MAX_COMPARE})`;
  }

  // ---------- wiring ----------
  function wire() {
    const search = document.getElementById("search");
    search.value = state.q;
    let t;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = search.value.trim();
        apply(true);
      }, 200);
    });
    const sort = document.getElementById("sort");
    for (const s of SORTS) sort.append(el("option", { value: s.key, text: s.label }));
    sort.addEventListener("change", () => {
      state.sort = sort.value;
      state.dir = null;
      apply(true);
    });
    document.getElementById("sort-dir").addEventListener("click", () => {
      state.dir = sortDir() === "asc" ? "desc" : "asc";
      if (state.dir === sortDef(state.sort).dir) state.dir = null;
      apply(true);
    });
    document.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        if (state.mode === b.dataset.mode) return;
        state.mode = b.dataset.mode;
        for (const k of Object.keys(COMMUTE)) delete state.ranges[k];
        cardCache.clear();
        buildPanel();
        apply(true);
      })
    );
    document.querySelectorAll("[data-view]").forEach((b) =>
      b.addEventListener("click", () => {
        state.view = b.dataset.view;
        apply(true);
      })
    );
    document.getElementById("reset-filters").addEventListener("click", () => {
      const keep = { mode: state.mode, view: state.view };
      state = { ...emptyState(), ...keep };
      search.value = "";
      buildPanel();
      apply(true);
    });
    const filters = document.getElementById("filters");
    document.getElementById("open-filters").addEventListener("click", () => filters.classList.add("open"));
    document.getElementById("close-filters").addEventListener("click", () => filters.classList.remove("open"));
    document.getElementById("compare-clear").addEventListener("click", () => H.setCompare([]));
    const toggleFav = () => {
      state.fav = !state.fav;
      buildPanel();
      apply(true);
    };
    document.getElementById("fav-toggle").addEventListener("click", toggleFav);
    // Header links point at this page; switch in place instead of reloading.
    document.querySelectorAll("[data-nav=list], [data-nav=fav]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if ((a.dataset.nav === "fav") !== state.fav) toggleFav();
        window.scrollTo({ top: 0 });
      })
    );
    document.addEventListener("house:compare", updateCompareBar);
    document.addEventListener("house:notes", (e) => {
      if (e.detail && e.detail.id) cardCache.delete(e.detail.id);
      else cardCache.clear();
    });
    window.addEventListener("pageshow", (e) => {
      // Back from the detail page: notes or compare picks may have changed there.
      if (e.persisted) {
        cardCache.clear();
        H.updateCompareBadge();
        apply(false);
      }
    });
  }

  H.loadIndex()
    .then((index) => {
      FI = index.field_info;
      ADS = index.ads;
      CATALOG = index.feature_catalog;
      for (const [f, info] of Object.entries(FI)) {
        if (info.filter !== "time") continue;
        const vals = ADS.map((a) => H.hhmmToMin(a[f])).filter((v) => v != null);
        if (vals.length) TIME_RANGE[f] = { min: Math.floor(Math.min(...vals) / 5) * 5, max: Math.ceil(Math.max(...vals) / 5) * 5 };
      }
      const qs = location.search.slice(1) || H.store.get("house.lastQuery", "") || "";
      state = fromQuery(qs);
      // Drop URL entries that point at fields that no longer exist.
      for (const k of Object.keys(state.bools)) if (!FI[k]) delete state.bools[k];
      for (const k of Object.keys(state.multi)) if (!FI[k]) delete state.multi[k];
      for (const k of Object.keys(state.ranges)) if (!(k in COMMUTE) && !FI[k]) delete state.ranges[k];
      wire();
      buildPanel();
      apply(true);
    })
    .catch((err) => {
      H.fail(document.getElementById("cards"), err);
      clear(document.getElementById("filter-panel"));
    });
})();
