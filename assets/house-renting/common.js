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
    transit: { label: "Toplu taşıma", icon: "🚌", am: "am_transit_min", pm: "pm_transit_min", daily: "daily_transit_min", leave: "am_leave_transit", arrive: "pm_arrive_transit" },
    drive: { label: "Araç", icon: "🚗", am: "am_drive_min", pm: "pm_drive_min", daily: "daily_drive_min", leave: "am_leave_drive", arrive: "pm_arrive_drive" },
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
      ]).then(([index, notesFile, photos]) => {
        for (const ad of index.ads) ad._photo = photos[ad.id] || null;
        H.index = index;
        H.byId = new Map(index.ads.map((a) => [a.id, a]));
        H.notesFile = notesFile && typeof notesFile === "object" ? notesFile : { ads: {} };
        if (!H.notesFile.ads || typeof H.notesFile.ads !== "object") H.notesFile.ads = {};
        H.pruneLocalNotes();
        H.updateFavBadge();
        return index;
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
    return out;
  }
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
