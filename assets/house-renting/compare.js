/* Compare page: up to 4 ads side by side. Ads come from ?ids=a,b or the saved selection. */
(function () {
  "use strict";
  const { el, clear } = H;
  const root = document.getElementById("compare");

  // Which direction is better for numeric rows (others are not highlighted).
  const LOWER = new Set(["_d2d_transit", "_d2d_drive", "_station_m", "price_value", "monthly_cost", "dues", "deposit", "price_per_m2_net", "deposit_months", "move_in_cost", "am_transit_min", "pm_transit_min", "daily_transit_min", "am_drive_min", "pm_drive_min", "daily_drive_min", "am_transit_transfers", "pm_transit_transfers", "am_transit_walk_min", "pm_transit_walk_min", "am_transit_first_walk_min", "am_drive_traffic_min", "pm_transit_wait_min", "distance_to_work_km", "drive_km", "transit_km", "building_age_min", "cons_count", "pm_arrive_transit", "pm_arrive_drive"]);
  const HIGHER = new Set(["area_net_m2", "area_gross_m2", "bathrooms", "pros_count", "am_leave_transit", "am_leave_drive"]);
  const SKIP = new Set(["id", "title", "price_currency", "price_raw", "city", "latitude", "longitude", "rooms", "living_rooms", "building_age_max", "is_top_floor", "seller_name", "photo_count", "features_all", "auto_pros", "auto_cons", "ad_json", "listing_date"]);

  let onlyDiff = H.store.get("house.compareOnlyDiff", false);
  // Groups collapsed by default: long and rarely decisive.
  const collapsed = new Set(H.store.get("house.compareCollapsed", ["Çevre (ilan beyanı)", "Satıcı", "Artı / Eksi", "Diğer", "Otomatik artı / eksi"]) || []);
  // Keep the sticky column header just below the site header (its height changes on phones).
  const setTop = () => document.documentElement.style.setProperty("--sticky-top", (document.querySelector(".h-top") || { offsetHeight: 60 }).offsetHeight + "px");
  window.addEventListener("resize", setTop);

  const fromUrl = (new URLSearchParams(location.search).get("ids") || "").split(",").filter(H.validId);
  if (fromUrl.length) {
    H.setCompare(fromUrl);
    history.replaceState(null, "", location.pathname);
  }

  H.loadIndex()
    .then(render)
    .catch((err) => H.fail(root, err));
  document.addEventListener("house:compare", () => H.index && render(H.index));

  function cellValue(f, ad, info) {
    const v = ad[f];
    if (info.filter === "time") return H.hhmmToMin(v);
    return v;
  }

  function render(index) {
    const FI = index.field_info;
    const ads = H.getCompare().map((id) => H.byId.get(id)).filter(Boolean);
    clear(root);
    root.append(el("h1", { text: "Karşılaştır" }));
    if (!ads.length) {
      root.append(el("div", { class: "h-panel h-empty" }, "Henüz ilan seçilmedi. ", el("a", { href: H.cfg.root, text: "İlanlar" }), " sayfasında kartlardaki “Karşılaştır” kutusunu işaretle (en fazla 4)."));
      return;
    }

    const diff = el("input", { type: "checkbox", checked: onlyDiff });
    diff.addEventListener("change", () => {
      onlyDiff = diff.checked;
      H.store.set("house.compareOnlyDiff", onlyDiff);
      render(index);
    });
    const share = el("button", {
      type: "button", class: "h-btn", text: "Bağlantıyı kopyala",
      onclick: () => {
        const url = new URL(location.href);
        url.search = "?ids=" + ads.map((a) => a.id).join(",");
        navigator.clipboard && navigator.clipboard.writeText(url.toString()).then(() => (share.textContent = "Kopyalandı ✓"), () => prompt("Bağlantı:", url.toString()));
      },
    });
    root.append(
      el("div", { class: "h-toolbar" }, el("label", { class: "h-check" }, diff, "Sadece farklı olan satırlar"), share, el("button", { type: "button", class: "h-btn", text: "Hepsini kaldır", onclick: () => H.setCompare([]) })),
      el("p", { class: "h-hint", text: "Yeşil = o satırdaki en iyi değer. ✓ var · – yok (işaretli değil) · ? bilinmiyor." })
    );

    setTop();
    const table = el("table", { class: "h-table h-cmp", style: `--n:${ads.length}` });
    const head = el("tr", {}, el("th", { class: "h-cmp-corner", scope: "col" }, el("span", { class: "h-muted h-small", text: `${ads.length} ilan` })));
    ads.forEach((ad, i) => {
      const photo = H.cardPhoto(ad);
      const n = H.notes(ad.id);
      const sr = H.scoring.scoreOf(ad.id);
      head.append(
        el(
          "th",
          { class: "h-cmp-col", scope: "col" },
          el("div", { class: "h-cmp-head" },
            el("a", { class: "h-cmp-thumb", href: H.adPage(ad.id), tabindex: -1, "aria-hidden": "true" }, photo ? el("img", { src: photo, alt: "" }) : null, el("span", { class: "h-cmp-idx", text: i + 1 })),
            el("div", { class: "h-cmp-meta" },
              el("a", { class: "h-cmp-title", href: H.adPage(ad.id), text: ad.title }),
              el("div", { class: "h-cmp-sub" },
                el("b", { text: H.money(ad.price_value) }),
                sr && !sr.excluded.length ? el("span", { class: "h-tag score", text: `🏆 ${H.num(Math.round(sr.total))}` }) : null,
                n.favorite ? el("span", { class: "h-cmp-fav", title: "Favori", text: "★" }) : null
              )
            ),
            el("button", { type: "button", class: "h-icon-btn h-cmp-remove", title: "Karşılaştırmadan çıkar", "aria-label": `${ad.title} karşılaştırmadan çıkar`, text: "✕", onclick: () => H.setCompare(H.getCompare().filter((x) => x !== ad.id)) })
          )
        )
      );
    });
    table.append(el("thead", {}, head));
    const body = el("tbody");
    table.append(body);

    let curGroup = null;
    const group = (title) => {
      curGroup = title;
      const closed = collapsed.has(title);
      const btn = el("button", { type: "button", class: "h-group-btn", "aria-expanded": !closed }, title, el("span", { class: "h-group-count" }));
      btn.addEventListener("click", () => {
        const open = collapsed.has(title);
        open ? collapsed.delete(title) : collapsed.add(title);
        H.store.set("house.compareCollapsed", [...collapsed]);
        btn.setAttribute("aria-expanded", open);
        body.querySelectorAll(`tr[data-group="${CSS.escape(title)}"]`).forEach((r) => (r.hidden = !open));
      });
      body.append(el("tr", { class: "h-group" }, el("th", { colspan: ads.length + 1, scope: "rowgroup" }, btn)));
    };
    const row = (label, cells, opts = {}) => {
      if (onlyDiff && !opts.always && new Set(cells.map((c) => c.key)).size <= 1) return false;
      const tr = el("tr", { dataset: { group: curGroup || "" }, hidden: collapsed.has(curGroup) }, el("th", { scope: "row", text: label }));
      for (const c of cells) tr.append(el("td", { class: (c.best ? "best " : "") + (c.num ? "num" : "") }, c.node));
      body.append(tr);
      return true;
    };

    // Summary: the rows that usually decide.
    group("Özet");
    const notes = ads.map((a) => H.notes(a.id));
    const sc = ads.map((a) => H.scoring.scoreOf(a.id));
    const okTotals = sc.filter((r) => r && !r.excluded.length).map((r) => r.total);
    const bestTotal = okTotals.length > 1 ? Math.max(...okTotals) : null;
    row("🏆 Puan", sc.map((r) => ({ key: r && r.total, node: !r ? "–" : r.excluded.length ? "elendi" : `${H.num(Math.round(r.total))} · ${r.rank}. sıra`, best: r && !r.excluded.length && r.total === bestTotal, num: true })), { always: true });
    const profile = H.scoring.active();
    const summaryNum = (label, vals, fmt, better) => {
      const ok = vals.filter((v) => typeof v === "number");
      const best = ok.length > 1 && new Set(ok).size > 1 ? (better === "low" ? Math.min(...ok) : Math.max(...ok)) : null;
      row(label, vals.map((v) => ({ key: v, node: v == null ? "–" : fmt(v), best: best != null && v === best, num: true })), { always: true });
    };
    summaryNum("Kira", ads.map((a) => a.price_value), H.money, "low");
    summaryNum("Efektif aylık", ads.map((a) => H.scoring.effectiveCost(a, profile).total), H.money, "low");
    summaryNum("🚌 Kapıdan kapıya", ads.map((a) => a._d2d_transit), H.mins, "low");
    summaryNum("🚗 Kapıdan kapıya", ads.map((a) => a._d2d_drive), H.mins, "low");
    summaryNum("Net m²", ads.map((a) => a.area_net_m2), (v) => v + " m²", "high");
    row("Kat", ads.map((a) => ({ key: a.floor + "/" + a.floor_count, node: `${H.scoring.value(a, "_floor_type", profile)} · ${a.floor}/${a.floor_count}` })), { always: true });
    summaryNum("Bina yaşı", ads.map((a) => a.building_age_min), (v) => v + " yaş", "low");
    row("En yakın istasyon", ads.map((a) => ({ key: a._station_m, node: H.stationText(a) || "–" })), { always: true });

    group("Notlarım");
    row("Puanım", notes.map((n) => ({ key: n.rating, node: n.rating ? "★".repeat(n.rating) : "–", best: false })));
    row("Artılar", notes.map((n) => ({ key: JSON.stringify(n.pros), node: n.pros.length ? H.tagList(n.pros, "pro", 3) : "–" })), { always: true });
    row("Eksiler", notes.map((n) => ({ key: JSON.stringify(n.cons), node: n.cons.length ? H.tagList(n.cons, "con", 3) : "–" })), { always: true });
    row("Not", notes.map((n) => ({ key: n.note, node: n.note ? el("div", { class: "h-desc h-small", text: n.note.length > 200 ? n.note.slice(0, 200) + "…" : n.note }) : "–" })));

    let currentGroup = null;
    let pendingGroup = null;
    // Keep each group together (derived fields are appended to field_info at the end).
    const groupOrder = [...new Set(Object.values(FI).map((i) => i.group))];
    const entries = Object.entries(FI).sort((x, y) => groupOrder.indexOf(x[1].group) - groupOrder.indexOf(y[1].group));
    for (const [f, info] of entries) {
      if (SKIP.has(f) || ["none", "list", "features"].includes(info.filter)) continue;
      if (info.filter === "boolean" && !info.true_count && !info.unknown) continue;
      if (info.group !== currentGroup) {
        currentGroup = info.group;
        pendingGroup = info.group;
      }
      const vals = ads.map((a) => cellValue(f, a, info));
      const nums = vals.filter((v) => typeof v === "number");
      let best = null;
      if (nums.length > 1 && new Set(nums).size > 1) {
        if (LOWER.has(f)) best = Math.min(...nums);
        else if (HIGHER.has(f)) best = Math.max(...nums);
      }
      const cells = ads.map((a, i) => {
        const raw = a[f];
        let text = H.fmtField(f, raw, info);
        if (f === "monthly_cost" && !a.dues_known) text += " (aidat ?)";
        return { key: JSON.stringify(raw), node: text, best: best != null && vals[i] === best, num: typeof raw === "number" };
      });
      if (onlyDiff && new Set(cells.map((c) => c.key)).size <= 1) continue;
      if (pendingGroup) {
        group(pendingGroup);
        pendingGroup = null;
      }
      row(info.label, cells, { always: true });
    }

    group("Ulaşım dahil aylık maliyet");
    for (const mode of ["transit", "drive"]) {
      const vals = ads.map((a) => H.totalCost(a, mode));
      const ok = vals.filter((v) => v != null);
      const best = ok.length > 1 && new Set(ok).size > 1 ? Math.min(...ok) : null;
      row(`${H.MODES[mode].icon} ${H.MODES[mode].label} ile`, ads.map((a, i) => ({ key: vals[i], node: H.money(vals[i]), best: best != null && vals[i] === best, num: true })), { always: true });
    }
    row("En yakın raylı sistem durağı", ads.map((a) => ({ key: a._station_m, node: H.stationText(a) || "–" })));

    group("Bölge ve tekrar eden ilanlar");
    const diffs = ads.map((a) => (a._area ? a._area.diff : null));
    const known = diffs.filter((d) => d != null);
    const bestDiff = known.length > 1 && new Set(known).size > 1 ? Math.min(...known) : null;
    row("m² kirası bölgeye göre", ads.map((a, i) => ({ key: diffs[i], node: a._area ? `${H.areaText(a._area)} (${a._area.scope})` : "–", best: bestDiff != null && diffs[i] === bestDiff })), { always: true });
    row("Muhtemelen aynı daire", ads.map((a) => ({ key: JSON.stringify(a._dup), node: a._dup ? `${a._dup.length} ilan` + (a._dup[0] === a.id ? " · en ucuzu bu" : "") : "–" })), { always: true });

    group("Otomatik artı / eksi");
    row("Artılar (ilk 3)", ads.map((a) => ({ key: JSON.stringify(a.auto_pros), node: H.tagList(a.auto_pros || [], "pro", 3) })), { always: true });
    row("Eksiler (ilk 3)", ads.map((a) => ({ key: JSON.stringify(a.auto_cons), node: (a.auto_cons || []).length ? H.tagList(a.auto_cons, "con", 3) : "–" })), { always: true });

    root.append(el("div", { class: "h-table-wrap" }, table));
  }
})();
