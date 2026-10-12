/* Scoring page: cost model, weighted criteria, per-feature points, rules; live ranking. */
(function () {
  "use strict";
  const { el, clear } = H;
  const S = H.scoring;
  const editor = document.getElementById("score-editor");
  const ranking = document.getElementById("score-ranking");

  let st, profile, fields, ADS;
  let showAll = false;
  let featureQuery = "";
  const ruleCounters = new Map();
  const openDetails = new Set();
  const openGroups = new Set(H.store.get("house.scoreOpen", ["_crit", "_feat", "_rules"]) || []);

  H.loadIndex()
    .then((index) => {
      ADS = index.ads;
      fields = S.fields(index);
      st = S.load();
      importFromHash();
      profile = st.profiles[st.active];
      drawEditor();
      refresh();
    })
    .catch((err) => H.fail(editor, err));

  // ---------- persistence ----------
  let saveTimer;
  function changed(structural) {
    st.profiles[profile.id] = profile;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => S.save(st), 250);
    if (structural) drawEditor();
    scheduleRefresh();
  }
  let raf = 0;
  function scheduleRefresh() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      refresh();
    });
  }
  function uniqueName(name) {
    const taken = new Set(Object.values(st.profiles).map((p) => p.name));
    if (!taken.has(name)) return name;
    for (let i = 1; ; i++) {
      const n = `${name} (paylaşılan${i > 1 ? " " + i : ""})`;
      if (!taken.has(n)) return n;
    }
  }
  function adopt(p) {
    st.profiles[p.id] = p;
    st.active = p.id;
    profile = p;
    S.save(st);
    drawEditor();
    refresh();
  }
  function importFromHash() {
    const m = location.hash.match(/^#p=([\w-]+)$/);
    if (!m) return;
    history.replaceState(null, "", location.pathname);
    try {
      const p = S.sanitize(S.decode(m[1]));
      p.name = uniqueName(p.name);
      if (!confirm(`“${p.name}” puanlama profili eklensin mi?`)) return;
      st.profiles[p.id] = p;
      st.active = p.id;
      S.save(st);
      H.toast(`“${p.name}” eklendi`);
    } catch (e) {
      alert("Paylaşılan profil okunamadı: " + e.message);
    }
  }

  // ---------- small widgets ----------
  function fieldSelect(value, types, onChange) {
    const sel = el("select", { class: "h-input h-field-select", "aria-label": "Alan" });
    const groups = new Map();
    for (const f of fields) {
      if (!types.includes(f.type)) continue;
      if (!groups.has(f.group)) groups.set(f.group, []);
      groups.get(f.group).push(f);
    }
    for (const [g, list] of groups) {
      const og = el("optgroup", { label: g });
      for (const f of list) og.append(el("option", { value: f.key, text: f.label, selected: f.key === value }));
      sel.append(og);
    }
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }
  const numInput = (value, placeholder, onInput, label, cls) => {
    const i = el("input", { type: "number", class: "h-input h-num-input " + (cls || ""), step: "any", value: value ?? "", placeholder: placeholder ?? "", "aria-label": label });
    i.addEventListener("input", () => onInput(i.value === "" ? null : Number(i.value)));
    return i;
  };
  function block(key, title, hint, ...children) {
    const det = el("details", { class: "h-panel h-block", open: openGroups.has(key) || null });
    det.addEventListener("toggle", () => {
      det.open ? openGroups.add(key) : openGroups.delete(key);
      H.store.set("house.scoreOpen", [...openGroups]);
    });
    det.append(el("summary", {}, el("h2", {}, ...[].concat(title))), hint ? el("p", { class: "h-hint", text: hint }) : null, ...children);
    return det;
  }

  // ---------- editor ----------
  function drawEditor() {
    clear(editor);
    editor.append(profileBar(), costBlock(), criteriaBlock(), featuresBlock(), rulesBlock());
  }

  function profileBar() {
    const sel = el("select", { class: "h-input", "aria-label": "Puanlama profili" });
    for (const p of Object.values(st.profiles)) sel.append(el("option", { value: p.id, text: p.name, selected: p.id === profile.id }));
    sel.addEventListener("change", () => {
      st.active = sel.value;
      profile = st.profiles[st.active];
      S.save(st);
      drawEditor();
      refresh();
    });
    const newSel = el("select", { class: "h-input", "aria-label": "Yeni profil" }, el("option", { value: "", text: "+ Yeni profil…" }), el("option", { value: "copy", text: "Bu profilin kopyası" }));
    for (const [k, label] of Object.entries(S.PRESETS)) newSel.append(el("option", { value: k, text: "Hazır: " + label }));
    newSel.addEventListener("change", () => {
      const v = newSel.value;
      newSel.value = "";
      if (!v) return;
      const name = (prompt("Yeni profilin adı?", v === "copy" ? profile.name + " (kopya)" : S.PRESETS[v]) || "").trim();
      if (!name) return;
      adopt(v === "copy" ? { ...JSON.parse(JSON.stringify(profile)), id: S.newId(), name: name.slice(0, 60) } : S.defaultProfile(name.slice(0, 60), v));
    });
    const file = el("input", { type: "file", accept: ".json,application/json", hidden: true });
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (!f) return;
      f.text()
        .then((t) => {
          const p = S.sanitize(JSON.parse(t));
          p.name = uniqueName(p.name);
          adopt(p);
          H.toast(`“${p.name}” içe aktarıldı`);
        })
        .catch((e) => alert("İçe aktarılamadı: " + e.message));
    });
    const download = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }));
      const a = el("a", { href: url, download: `puanlama-${profile.name.replace(/[^\p{L}\p{N}]+/gu, "-")}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const seg = el("div", { class: "h-seg", role: "group", "aria-label": "Ulaşım tipi" });
    for (const [m, info] of Object.entries(H.MODES))
      seg.append(el("button", { type: "button", "aria-pressed": profile.mode === m, text: `${info.icon} ${info.label}`, onclick: () => { profile.mode = m; changed(true); } }));
    return el(
      "div",
      { class: "h-panel h-profile-bar" },
      el("h1", { text: "🏆 Puanlama" }),
      el("p", { class: "h-hint", text: "Puan = ağırlıklı kriterler (0–100) + özellik puanları + kurallar, sonra çarpanlar. Her değişiklik anında kaydedilir ve sağdaki sıralama, İlanlar sayfasındaki “Uygunluk puanı” sıralaması, karşılaştırma ve detay sayfaları buna göre güncellenir." }),
      el("div", { class: "h-form-row" }, el("label", { class: "h-sort" }, "Profil", sel), newSel),
      el("div", { class: "h-form-row" }, el("span", { class: "h-muted h-small", text: "Yolculuk ve maliyet:" }), seg),
      el(
        "div",
        { class: "h-actions" },
        el("button", { type: "button", class: "h-btn h-btn-small", text: "Yeniden adlandır", onclick: () => { const n = (prompt("Profil adı", profile.name) || "").trim(); if (n) { profile.name = n.slice(0, 60); changed(true); } } }),
        el("button", {
          type: "button", class: "h-btn h-btn-small", text: "Varsayılana sıfırla",
          onclick: () => {
            if (!confirm("Bu profildeki tüm ağırlık ve kurallar varsayılana dönsün mü?")) return;
            const d = S.defaultProfile(profile.name);
            d.id = profile.id;
            adopt(d);
          },
        }),
        el("button", {
          type: "button", class: "h-btn h-btn-small", text: "Sil",
          onclick: () => {
            if (Object.keys(st.profiles).length < 2) return alert("Son profil silinemez.");
            if (!confirm(`“${profile.name}” silinsin mi?`)) return;
            delete st.profiles[profile.id];
            st.active = Object.keys(st.profiles)[0];
            profile = st.profiles[st.active];
            S.save(st);
            drawEditor();
            refresh();
          },
        }),
        el("button", { type: "button", class: "h-btn h-btn-small", text: "⤴ Paylaş", onclick: () => H.share(`Puanlama: ${profile.name}`, new URL(`${H.cfg.root}score/#p=${S.encode(profile)}`, location.href).toString()) }),
        el("button", { type: "button", class: "h-btn h-btn-small", text: "Dışa aktar", onclick: download }),
        el("button", { type: "button", class: "h-btn h-btn-small", text: "İçe aktar…", onclick: () => file.click() }),
        file
      )
    );
  }

  // ----- cost model -----
  function costBlock() {
    profile.cost = S.costOf(profile);
    const c = profile.cost;
    const row = (label, value, onInput, unit) => el("label", { class: "h-num-row" }, el("span", { text: label }), el("span", {}, numInput(value, "", onInput, label), unit ? el("small", { class: "h-muted", text: " " + unit }) : null));
    const set = (k) => (v) => { c[k] = v ?? 0; changed(false); };
    const heat = Object.keys(S.COST_DEFAULTS.heating);
    const tr = el("input", { type: "checkbox", checked: c.includeTransport });
    tr.addEventListener("change", () => { c.includeTransport = tr.checked; changed(false); });
    const example = el("div", { class: "h-cost-example" });
    costExample = () => {
      const top = (S.run(profile, ADS).ranked[0] || {}).id;
      const ad = H.byId.get(top);
      if (!ad) return;
      const e = S.effectiveCost(ad, profile);
      clear(example).append(
        el("div", { class: "h-sub", text: "Örnek: sıralamadaki 1. ilan" }),
        el("table", { class: "h-breakdown" }, e.lines.map(([l, v]) => el("tr", {}, el("td", { text: l }), el("td", { class: "num", text: H.money(Math.round(v)) }))), el("tr", { class: "sum" }, el("td", { text: "Efektif aylık" }), el("td", { class: "num", text: H.money(e.total) })))
      );
    };
    return block(
      "_cost",
      "💰 Efektif aylık maliyet",
      "Efektif aylık = kira + aidat + ısınma + (komisyon + eşya masrafı) ÷ ay + ulaşım. Aidatı belirtilmemiş ilanlarda ortanca aidat kullanılır. Eşya durumu notlardan, yoksa ilandaki “Eşyalı” bilgisinden alınır.",
      el(
        "div",
        { class: "h-cost-grid" },
        row("Komisyon (× kira, emlakçıda)", c.commission, set("commission"), "× kira"),
        row("Tek seferlik giderler kaç aya bölünsün", c.months, set("months"), "ay"),
        row("Eşya: eşyasız", c.furnitureNone, set("furnitureNone"), "₺"),
        row("Eşya: kısmi / eski", c.furniturePartial, set("furniturePartial"), "₺"),
        row("Eşya: bilinmiyor", c.furnitureUnknown, set("furnitureUnknown"), "₺"),
        ...heat.map((h) => row(`Isınma: ${h === "other" ? "diğer" : h}`, c.heating[h], (v) => { c.heating[h] = v ?? 0; changed(false); }, "₺/ay")),
        el("label", { class: "h-check" }, tr, "Ulaşım maliyetini ekle (İlanlar sayfasındaki ulaşım varsayımlarıyla)")
      ),
      example
    );
  }
  let costExample = () => {};

  // ----- weighted criteria -----
  function criteriaBlock() {
    const wsum = profile.criteria.reduce((s, c) => s + Number(c.weight || 0), 0);
    const box = el("div", { class: "h-rules" });
    profile.criteria.forEach((c, i) => box.append(criterionRow(c, i, wsum)));
    return block(
      "_crit",
      ["⚖️ Ağırlıklı kriterler ", el("span", { class: "h-muted h-small", text: `→ 0–100 taban puan · ${profile.criteria.length} kriter` })],
      "Sayısal kriterler “en iyi” değerde tam, “en kötü” değerde sıfır puan alır (arası doğrusal). Evet/hayır ve kategori kriterlerinde her seçeneğe yüzde verirsin. Ağırlıklar otomatik olarak 100'e ölçeklenir. Bilinmeyen değer yarım puan alır.",
      box,
      el("button", { type: "button", class: "h-btn h-btn-small", text: "+ Kriter ekle", onclick: () => { profile.criteria.push({ id: S.newId(), field: "area_net_m2", weight: 5, dir: "high", best: null, worst: null }); changed(true); } })
    );
  }
  function criterionRow(c, i, wsum) {
    const type = S.critType(c.field);
    const share = el("span", { class: "h-share", text: wsum ? `%${H.num(Math.round((1000 * c.weight) / wsum) / 10)}` : "–" });
    const wNum = numInput(c.weight, "0", (v) => { c.weight = Math.max(0, v || 0); wRange.value = c.weight; updateShares(); changed(false); }, "Ağırlık", "h-w-input");
    const wRange = el("input", { type: "range", min: 0, max: 50, step: 1, value: Math.min(50, c.weight), class: "h-single", "aria-label": "Ağırlık" });
    wRange.addEventListener("input", () => { c.weight = Number(wRange.value); wNum.value = c.weight; updateShares(); changed(false); });
    const body = el("div", { class: "h-rule-mid" });
    if (type === "number") {
      const b = S.bounds(c, profile, ADS);
      const dir = el("div", { class: "h-seg h-seg-small", role: "group", "aria-label": "Yön" },
        el("button", { type: "button", "aria-pressed": c.dir !== "high", text: "↓ düşük iyi", onclick: () => { c.dir = "low"; c.best = c.worst = null; changed(true); } }),
        el("button", { type: "button", "aria-pressed": c.dir === "high", text: "↑ yüksek iyi", onclick: () => { c.dir = "high"; c.best = c.worst = null; changed(true); } })
      );
      const autoBest = c.dir === "high" ? b.hi : b.lo, autoWorst = c.dir === "high" ? b.lo : b.hi;
      body.append(dir, el("span", { class: "h-small", text: "tam puan" }), numInput(c.best, autoBest, (v) => { c.best = v; changed(false); }, "En iyi değer"),
        el("span", { class: "h-small", text: "sıfır puan" }), numInput(c.worst, autoWorst, (v) => { c.worst = v; changed(false); }, "En kötü değer"),
        el("span", { class: "h-muted h-small", text: b.count ? `veride ${S.fmt(c.field, b.lo)} – ${S.fmt(c.field, b.hi)}` : "henüz değer yok (ilan detayındaki notlardan girilir)" }));
    } else if (type === "map") {
      c.map = c.map || {};
      for (const opt of S.critOptions(c.field)) {
        const def = opt === "true" ? 100 : opt === "false" ? 0 : 50;
        body.append(el("label", { class: "h-map-opt" }, el("span", { text: S.optLabel(c.field, opt) }), numInput(c.map[opt] ?? def, def, (v) => { c.map[opt] = Math.max(0, Math.min(100, v ?? def)); changed(false); }, S.optLabel(c.field, opt) + " yüzdesi"), el("small", { text: "%" })));
      }
    }
    return el(
      "div",
      { class: "h-rule h-crit" },
      el("div", { class: "h-rule-top" },
        fieldSelect(c.field, ["number", "boolean", "enum", "feature"], (v) => { c.field = v; c.best = c.worst = null; c.map = undefined; c.dir = "low"; changed(true); }),
        el("button", { type: "button", class: "h-icon-btn", title: "Kriteri sil", "aria-label": "Kriteri sil", text: "✕", onclick: () => { profile.criteria.splice(i, 1); changed(true); } })
      ),
      el("div", { class: "h-rule-mid h-weight" }, el("span", { text: "Ağırlık" }), wRange, wNum, share),
      body
    );
  }
  function updateShares() {
    const sum = profile.criteria.reduce((s, x) => s + Number(x.weight || 0), 0);
    editor.querySelectorAll(".h-crit").forEach((row, j) => (row.querySelector(".h-share").textContent = sum ? `%${H.num(Math.round((1000 * profile.criteria[j].weight) / sum) / 10)}` : "–"));
  }

  // ----- per-feature points -----
  function featuresBlock() {
    profile.features = profile.features || {};
    const list = fields.filter((f) => f.type === "boolean" || f.type === "feature");
    const counts = new Map(list.map((f) => [f.key, ADS.reduce((n, a) => n + (S.value(a, f.key, profile) === true ? 1 : 0), 0)]));
    const groups = new Map();
    for (const f of list) {
      if (!groups.has(f.group)) groups.set(f.group, []);
      groups.get(f.group).push(f);
    }
    const active = Object.values(profile.features).filter((v) => Number(v.yes) || Number(v.no)).length;
    const wrap = el("div", { class: "h-feat-groups" });
    const draw = () => {
      clear(wrap);
      const q = featureQuery.toLocaleLowerCase("tr-TR");
      for (const [g, items] of groups) {
        const shown = items.filter((f) => !q || f.label.toLocaleLowerCase("tr-TR").includes(q));
        if (!shown.length) continue;
        const nActive = items.filter((f) => profile.features[f.key] && (Number(profile.features[f.key].yes) || Number(profile.features[f.key].no))).length;
        const det = el("details", { class: "h-feat-group", open: q || openGroups.has("fg:" + g) || null });
        det.addEventListener("toggle", () => { if (!q) { det.open ? openGroups.add("fg:" + g) : openGroups.delete("fg:" + g); H.store.set("house.scoreOpen", [...openGroups]); } });
        det.append(el("summary", {}, g, " ", el("span", { class: "h-badge", text: `${nActive}/${items.length}` })));
        const tbl = el("div", { class: "h-feat-table" }, el("div", { class: "h-feat-head" }, el("span", { text: "Özellik" }), el("span", { text: "Var" }), el("span", { text: "Yok" })));
        for (const f of shown) {
          const fp = profile.features[f.key] || {};
          const set = (k) => (v) => {
            profile.features[f.key] = { ...(profile.features[f.key] || {}), [k]: v || 0 };
            line.classList.toggle("on", !!(Number(profile.features[f.key].yes) || Number(profile.features[f.key].no)));
            changed(false);
          };
          const line = el("div", { class: "h-feat-row" + (Number(fp.yes) || Number(fp.no) ? " on" : "") },
            el("span", {}, f.label, " ", el("small", { class: "h-muted", text: `${counts.get(f.key)} ilanda var` })),
            numInput(fp.yes || null, "0", set("yes"), `${f.label}: var ise puan`),
            numInput(fp.no || null, "0", set("no"), `${f.label}: yok ise puan`)
          );
          tbl.append(line);
        }
        det.append(tbl);
        wrap.append(det);
      }
    };
    const search = el("input", { type: "search", class: "h-input", placeholder: "Özellik ara: havuz, ısıcam, metro…", value: featureQuery, "aria-label": "Özellik ara" });
    search.addEventListener("input", () => { featureQuery = search.value.trim(); draw(); });
    draw();
    return block(
      "_feat",
      ["✨ Özellik puanları ", el("span", { class: "h-muted h-small", text: `${active} özellik puanlı` })],
      "Her var/yok bilgisine ve ilan özellik listesindeki her maddeye puan ver: “var” sütunu özellik varken, “yok” sütunu yokken eklenir (ceza için eksi yaz). İlanda bilgi yoksa puan eklenmez.",
      search,
      wrap
    );
  }

  // ----- rules -----
  function rulesBlock() {
    ruleCounters.clear();
    const box = el("div", { class: "h-rules" });
    profile.rules.forEach((r, i) => box.append(ruleRow(r, i)));
    return block(
      "_rules",
      ["➕➖ Kurallar ", el("span", { class: "h-muted h-small", text: `${profile.rules.length} kural` })],
      "Koşula bağlı puan, eleme ya da çarpan. “her birim için” kuralları farkla çarpılır (ör. 150 dk üstündeki her dakika −0,3). “Ve” ile ikinci koşul ekleyebilirsin (ör. mantolama var VE bina ≥ 15 yaş). Çarpanlar en son uygulanır (ör. alaturka tuvalet × 0,5).",
      box,
      el("div", { class: "h-actions" },
        el("button", { type: "button", class: "h-btn h-btn-small", text: "+ Bonus / ceza", onclick: () => addRule("points") }),
        el("button", { type: "button", class: "h-btn h-btn-small", text: "+ Çarpan", onclick: () => addRule("multiply") }),
        el("button", { type: "button", class: "h-btn h-btn-small", text: "+ Eleme kuralı", onclick: () => addRule("exclude") })
      )
    );
  }
  function addRule(action) {
    profile.rules.push({ id: S.newId(), field: "_d2d", op: "gte", value: 150, action, points: action === "points" ? -5 : 0, factor: 0.8, enabled: true });
    changed(true);
  }
  /** Field + operator + value(s) editor for a rule or its "and" condition. */
  function condEditor(cond, types) {
    const f = S.field(cond.field) || fields[0];
    const ops = S.OPS[f.type] || [];
    if (!ops.some(([k]) => k === cond.op)) cond.op = ops[0][0];
    const opSel = el("select", { class: "h-input", "aria-label": "Koşul" });
    for (const [k, label] of ops) opSel.append(el("option", { value: k, text: label, selected: k === cond.op }));
    opSel.addEventListener("change", () => { cond.op = opSel.value; changed(true); });
    const values = el("span", { class: "h-rule-values" });
    const unit = f.unit && !f.time ? el("span", { class: "h-muted h-small", text: f.unit }) : null;
    if (["gte", "lte", "per_above", "per_below"].includes(cond.op)) values.append(numInput(cond.value, "değer", (v) => { cond.value = v; changed(false); }, "Değer"), unit);
    else if (cond.op === "between") values.append(numInput(cond.value, "en az", (v) => { cond.value = v; changed(false); }, "En az"), "–", numInput(cond.value2, "en çok", (v) => { cond.value2 = v; changed(false); }, "En çok"), unit);
    else if (cond.op === "in" || cond.op === "not_in") {
      cond.values = cond.values || [];
      for (const opt of f.options || []) {
        const chip = el("button", { type: "button", class: "h-chip", "aria-pressed": cond.values.includes(opt), text: S.optLabel(cond.field, opt) });
        chip.addEventListener("click", () => {
          cond.values = cond.values.includes(opt) ? cond.values.filter((x) => x !== opt) : [...cond.values, opt];
          chip.setAttribute("aria-pressed", cond.values.includes(opt));
          changed(false);
        });
        values.append(chip);
      }
    }
    if (f.time && ["gte", "lte", "between", "per_above", "per_below"].includes(cond.op)) values.append(el("span", { class: "h-muted h-small", text: "gece yarısından dk (07:30 = 450)" }));
    return {
      field: fieldSelect(cond.field, types, (v) => { cond.field = v; cond.op = (S.OPS[S.field(v).type] || [["true"]])[0][0]; cond.values = []; cond.value = cond.value2 = null; changed(true); }),
      op: opSel,
      values,
    };
  }
  const RULE_TYPES = ["number", "boolean", "enum", "list", "feature"];
  function ruleRow(r, i) {
    const count = el("span", { class: "h-rule-count", title: "Bu kurala uyan ilan sayısı" });
    ruleCounters.set(r.id, count);
    const main = condEditor(r, RULE_TYPES);
    const actSel = el("select", { class: "h-input", "aria-label": "Sonuç" },
      el("option", { value: "points", text: "puan", selected: r.action === "points" }),
      el("option", { value: "multiply", text: "× çarp", selected: r.action === "multiply" }),
      el("option", { value: "exclude", text: "ELE", selected: r.action === "exclude" })
    );
    actSel.addEventListener("change", () => { r.action = actSel.value; changed(true); });
    const per = r.op === "per_above" || r.op === "per_below";
    let amount = null;
    if (r.action === "points") amount = el("span", { class: "h-points" }, numInput(r.points, "0", (v) => { r.points = v || 0; row.classList.toggle("neg", (v || 0) < 0); changed(false); }, "Puan"), per ? el("span", { class: "h-muted h-small", text: "/ birim" }) : null);
    if (r.action === "multiply") amount = el("span", { class: "h-points" }, "×", numInput(r.factor ?? 1, "1", (v) => { r.factor = v ?? 1; changed(false); }, "Çarpan"));
    const on = el("input", { type: "checkbox", checked: r.enabled !== false, title: "Kural açık / kapalı", "aria-label": "Kural açık" });
    on.addEventListener("change", () => { r.enabled = on.checked; row.classList.toggle("off", !on.checked); changed(false); });

    let andRow = null;
    if (r.and && r.and.field) {
      const a = condEditor(r.and, RULE_TYPES);
      andRow = el("div", { class: "h-rule-mid h-rule-and" }, el("strong", { text: "VE" }), a.field, a.op, a.values,
        el("button", { type: "button", class: "h-icon-btn", title: "“Ve” koşulunu kaldır", "aria-label": "Ve koşulunu kaldır", text: "✕", onclick: () => { delete r.and; changed(true); } }));
    }
    const row = el(
      "div",
      { class: "h-rule" + (r.action === "exclude" ? " exclude" : r.action === "multiply" ? " mult" : Number(r.points) < 0 ? " neg" : "") + (r.enabled === false ? " off" : "") },
      el("div", { class: "h-rule-top" }, on, main.field, count,
        el("button", { type: "button", class: "h-icon-btn", title: "Kuralı sil", "aria-label": "Kuralı sil", text: "✕", onclick: () => { profile.rules.splice(i, 1); changed(true); } })),
      el("div", { class: "h-rule-mid" }, main.op, main.values),
      andRow,
      el("div", { class: "h-rule-mid" },
        el("span", { class: "h-rule-then", text: "→" }), actSel, amount,
        !r.and ? el("button", { type: "button", class: "h-btn h-btn-small", text: "+ ve koşulu", onclick: () => { r.and = { field: "building_age_min", op: "gte", value: 15 }; changed(true); } }) : null)
    );
    return row;
  }

  // ---------- ranking ----------
  function refresh() {
    const res = S.run(profile, ADS);
    for (const r of profile.rules) {
      const span = ruleCounters.get(r.id);
      if (!span) continue;
      const n = ADS.filter((a) => S.applyRule(r, a, profile)).length;
      span.textContent = `${n} ilan`;
      span.classList.toggle("zero", !n);
    }
    costExample();
    clear(ranking);
    const ranked = res.ranked.filter((r) => !r.excluded.length);
    const excluded = res.ranked.filter((r) => r.excluded.length);
    const top = Math.max(1, ...ranked.map((r) => r.total));
    const shown = showAll ? ranked : ranked.slice(0, 30);
    ranking.append(
      el("div", { class: "h-rank-head" },
        el("h2", { text: `Sıralama · ${profile.name}` }),
        el("span", { class: "h-muted h-small", text: `${ranked.length} ilan puanlandı${excluded.length ? `, ${excluded.length} elendi` : ""}` }),
        el("a", { class: "h-btn h-btn-small", href: `${H.cfg.root}?s=_score&m=${profile.mode}`, text: "İlanlar sayfasında aç" })
      )
    );
    const list = el("ol", { class: "h-rank" });
    for (const r of shown) list.append(rankRow(r, top));
    ranking.append(list);
    if (ranked.length > shown.length) ranking.append(el("button", { type: "button", class: "h-btn", text: `Tümünü göster (${ranked.length})`, onclick: () => { showAll = true; refresh(); } }));
    if (excluded.length) {
      const det = el("details", { class: "h-panel h-excluded" }, el("summary", { text: `Elenenler (${excluded.length})` }));
      const ul = el("ul", { class: "h-simlist" });
      for (const r of excluded) {
        const ad = H.byId.get(r.id);
        ul.append(el("li", {}, el("a", { href: H.adPage(ad.id), text: ad.title }), el("div", { class: "h-muted h-small", text: "Elenme sebebi: " + r.excluded.join("; ") })));
      }
      det.append(ul);
      ranking.append(det);
    }
  }

  function rankRow(r, top) {
    const ad = H.byId.get(r.id);
    const photo = H.cardPhoto(ad);
    const mode = H.MODES[profile.mode];
    const pos = r.hits.filter((h) => h.pts > 0).reduce((s, h) => s + h.pts, 0);
    const neg = r.hits.filter((h) => h.pts < 0).reduce((s, h) => s + h.pts, 0);
    const det = el("details", { class: "h-rank-detail", open: openDetails.has(r.id) || null });
    det.addEventListener("toggle", () => (det.open ? openDetails.add(r.id) : openDetails.delete(r.id)));
    det.append(el("summary", { text: "Puan dökümü" }));
    const tbl = el("table", { class: "h-breakdown" });
    for (const p of r.parts)
      tbl.append(el("tr", {}, el("td", { text: p.label }), el("td", { class: "h-muted", text: p.unknown ? "bilinmiyor" : S.fmt(p.field, p.value) }), el("td", { class: "num", text: `${H.num(Math.round(p.pts * 10) / 10)} / ${H.num(Math.round(p.max * 10) / 10)}` })));
    tbl.append(el("tr", { class: "sum" }, el("td", { text: "Taban puan" }), el("td"), el("td", { class: "num", text: H.num(r.base) })));
    for (const h of r.hits.filter((x) => !x.feature)) tbl.append(el("tr", { class: h.pts < 0 ? "neg" : "pos" }, el("td", { text: h.label }), el("td"), el("td", { class: "num", text: (h.pts > 0 ? "+" : "") + H.num(h.pts) })));
    const feats = r.hits.filter((x) => x.feature);
    if (feats.length) {
      const fsum = Math.round(feats.reduce((s, h) => s + h.pts, 0) * 10) / 10;
      tbl.append(el("tr", { class: fsum < 0 ? "neg" : "pos" }, el("td", { text: `Özellik puanları (${feats.length})`, title: feats.map((h) => `${h.label} ${h.pts > 0 ? "+" : ""}${H.num(h.pts)}`).join("\n") }), el("td", { class: "h-muted h-small", text: feats.slice(0, 4).map((h) => h.label.replace(/: (var|yok)$/, "")).join(", ") + (feats.length > 4 ? "…" : "") }), el("td", { class: "num", text: (fsum > 0 ? "+" : "") + H.num(fsum) })));
    }
    for (const m of r.mults) tbl.append(el("tr", { class: "neg" }, el("td", { text: m.label }), el("td"), el("td", { class: "num", text: "× " + H.num(m.factor) })));
    tbl.append(el("tr", { class: "sum" }, el("td", { text: "Toplam" }), el("td"), el("td", { class: "num", text: H.num(r.total) })));
    det.append(tbl);
    return el(
      "li",
      { class: "h-rank-row" },
      el("span", { class: "h-rank-no", text: r.rank }),
      photo ? el("img", { src: photo, alt: "", loading: "lazy", class: "h-rank-img" }) : el("span"),
      el(
        "div",
        { class: "h-rank-body" },
        el("a", { href: H.adPage(ad.id), class: "h-rank-title", text: ad.title }),
        el("div", { class: "h-muted h-small", text: [H.money(ad.price_value), `efektif ${H.money(S.effectiveCost(ad, profile).total)}`, `${ad.area_net_m2} m²`, `${mode.icon} ${H.mins(ad[mode.d2d])}`, ad.neighborhood].filter(Boolean).join(" · ") }),
        el("div", { class: "h-rank-bar", title: `Taban ${H.num(r.base)} · bonus +${H.num(pos)} · ceza ${H.num(neg)}` },
          el("span", { class: "base", style: `width:${Math.max(0, (Math.min(r.base, r.total) / top) * 100)}%` }),
          pos ? el("span", { class: "pos", style: `width:${(pos / top) * 100}%` }) : null),
        el("div", { class: "h-tags" },
          pos ? el("span", { class: "h-tag pro", text: `bonus +${H.num(Math.round(pos * 10) / 10)}` }) : null,
          neg ? el("span", { class: "h-tag con", text: `ceza ${H.num(Math.round(neg * 10) / 10)}` }) : null,
          r.mults.length ? el("span", { class: "h-tag con", text: `× ${H.num(r.factor)}` }) : null,
          H.notes(ad.id).favorite ? el("span", { class: "h-tag rating", text: "★ favori" }) : null),
        det
      ),
      el("span", { class: "h-rank-score", text: H.num(Math.round(r.total)) })
    );
  }

  document.addEventListener("house:notes", () => H.index && scheduleRefresh());
})();
