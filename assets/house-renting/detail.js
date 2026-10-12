/* Detail page: /house-renting/ad/?id=<id> */
(function () {
  "use strict";
  const { el, clear } = H;
  const root = document.getElementById("detail");
  const WORK = [39.8966714, 32.7736614];
  let redrawNotes = () => {};

  const id = new URLSearchParams(location.search).get("id") || "";
  if (!H.validId(id)) {
    H.fail(root, "Geçersiz ilan numarası");
    return;
  }

  Promise.all([H.loadIndex(), H.loadAd(id)])
    .then(([index, ad]) => render(index, H.byId.get(id), ad))
    .catch((err) => H.fail(root, err));

  function panel(title, ...children) {
    return el("section", { class: "h-panel" }, title ? el("h2", { text: title }) : null, ...children);
  }
  function linkBtn(href, text, primary) {
    if (!href || !/^https?:\/\//i.test(href)) return null;
    return el("a", { class: "h-btn" + (primary ? " h-btn-primary" : ""), href, target: "_blank", rel: "noopener noreferrer", text });
  }
  function stat(label, value, title) {
    return el("div", { class: "h-stat", title }, el("span", { text: label }), el("b", { text: value }));
  }

  function render(index, row, ad) {
    document.title = `${ad.title} · Kiralık 2+1`;
    clear(root);
    const FI = index.field_info;
    const back = el("a", { href: H.cfg.root, text: "← İlanlar" });
    back.addEventListener("click", (e) => {
      if (document.referrer && new URL(document.referrer).pathname === new URL(H.cfg.root, location.href).pathname) {
        e.preventDefault();
        history.back();
      }
    });
    root.append(el("p", { class: "h-back" }, back));

    // Header
    const statusSlot = el("span");
    const syncStatus = () => clear(statusSlot).append(H.statusTag(H.notes(id).status));
    syncStatus();
    document.addEventListener("house:notes", syncStatus);
    const loc = ad.location || {};
    const fav = el("span");
    const syncFav = () => {
      clear(fav).append(H.favButton(id, () => redrawNotes()));
    };
    syncFav();
    document.addEventListener("house:notes", syncFav);
    root.append(
      el(
        "div",
        { class: "h-detail-head" },
        el(
          "div",
          { style: "min-width:0;flex:1 1 420px" },
          el("h1", { text: ad.title }),
          el("div", { class: "h-muted" }, [loc.district, loc.neighborhood, row && row.complex_name].filter(Boolean).join(" · "), " · İlan no ", ad.id, row ? " · " + H.date(row.listing_date) : ""),
          el("div", { class: "h-tags", style: "margin-top:6px" }, statusSlot, row && row.is_owner ? el("span", { class: "h-tag pro", text: "Sahibinden (emlakçısız)" }) : null, row && H.CHECKLIST_WARN[row.checklist_quality] ? el("span", { class: "h-tag warn", text: H.CHECKLIST_WARN[row.checklist_quality] }) : null, row && row.tenant_inside ? el("span", { class: "h-tag warn", text: "Şu an kiracılı" }) : null)
        ),
        el(
          "div",
          { style: "text-align:right" },
          el("div", { class: "h-big-price", text: H.money(ad.price && ad.price.value) }),
          row ? el("div", { class: "h-muted", text: `Aylık toplam ${H.money(row.monthly_cost)}${row.dues_known ? "" : " (aidat bilinmiyor)"}` }) : null
        )
      )
    );
    const md = (ad.location_tab && ad.location_tab.map_details) || {};
    root.append(
      el(
        "div",
        { class: "h-actions", style: "margin-bottom:16px" },
        fav,
        el("span", { class: "h-btn" }, H.compareToggle(id)),
        linkBtn(ad.source_url, "İlanı aç ↗", true),
        linkBtn(md.directions_url, "Yol tarifi ↗"),
        linkBtn(md.street_view_url, "Sokak görünümü ↗"),
        linkBtn(ad.contact && ad.contact.message_url, "İlan sahibine mesaj ↗")
      )
    );

    const left = el("div");
    const right = el("div");
    root.append(el("div", { class: "h-grid-2" }, left, right));

    left.append(photosPanel(ad));
    if (row) left.append(pricePanel(row, FI));
    left.append(commutePanel(ad));
    const desc = ad.classified_detail && ad.classified_detail.description;
    if (desc) left.append(panel("Açıklama", el("div", { class: "h-desc", text: desc })));
    left.append(featuresPanel(ad));

    right.append(notesPanel(row));
    right.append(mapPanel(ad));
    right.append(detailsPanel(ad));
    right.append(sellerPanel(ad));
  }

  // ---------- photos ----------
  function photosPanel(ad) {
    const photos = (ad.photos || []).filter((p) => p.thumbnail || p.large);
    if (!photos.length) return panel(null, el("p", { class: "h-muted", text: "Fotoğraf yok." }));
    let current = Math.max(0, photos.findIndex((p) => p.large));

    const hero = el("img", { class: "h-hero", alt: "İlan fotoğrafı", referrerpolicy: "no-referrer" });
    const counter = el("span", { class: "h-gallery-count", "aria-live": "polite" });
    const note = el("div", { class: "h-hint", hidden: true, text: "Büyük fotoğraf yüklenemedi (ilan kalkmış olabilir); küçük önizleme gösteriliyor." });
    const strip = el("div", { class: "h-thumbs" });
    const bigUrl = (p) => (p.large ? H.photoUrl(ad.id, p.large) : p.remote_url && /^https:\/\//.test(p.remote_url) ? p.remote_url : null);
    const preload = (i) => {
      const url = bigUrl(photos[(i + photos.length) % photos.length]);
      if (url) Object.assign(new Image(), { referrerPolicy: "no-referrer", src: url });
    };

    const show = (i) => {
      current = (i + photos.length) % photos.length;
      const p = photos[current];
      const url = bigUrl(p);
      note.hidden = true;
      hero.classList.remove("small");
      hero.onerror = null;
      if (url && !p.large) {
        hero.onerror = () => {
          hero.onerror = null;
          hero.classList.add("small");
          hero.src = H.photoUrl(ad.id, p.thumbnail);
          note.hidden = false;
        };
      }
      if (url) hero.src = url;
      else {
        hero.classList.add("small");
        hero.src = H.photoUrl(ad.id, p.thumbnail);
      }
      hero.alt = `İlan fotoğrafı ${current + 1} / ${photos.length}`;
      counter.textContent = `${current + 1} / ${photos.length}`;
      strip.querySelectorAll("button").forEach((b, j) => {
        b.setAttribute("aria-current", j === current);
        if (j === current) b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      });
      preload(current + 1);
      preload(current - 1);
    };

    photos.forEach((p, i) => {
      const btn = el("button", { type: "button", "aria-label": `Fotoğraf ${i + 1}` }, el("img", { src: H.photoUrl(ad.id, p.thumbnail || p.large), alt: "", loading: "lazy", width: 100, height: 75 }));
      btn.addEventListener("click", () => show(i));
      strip.append(btn);
    });

    const arrow = (dir, label, text) => el("button", { type: "button", class: "h-gallery-nav " + dir, "aria-label": label, title: label + " (← →)", text, onclick: () => show(current + (dir === "next" ? 1 : -1)) });
    const stage = el("div", { class: "h-gallery" }, hero, photos.length > 1 ? [arrow("prev", "Önceki fotoğraf", "‹"), arrow("next", "Sonraki fotoğraf", "›")] : null, counter);

    // Keyboard: arrow keys anywhere on the page, except while typing.
    document.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
      if (e.key === "ArrowLeft") show(current - 1);
      else if (e.key === "ArrowRight") show(current + 1);
      else return;
      e.preventDefault();
    });
    // Touch: swipe left / right on the photo.
    let x0 = null;
    stage.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    });

    show(current);
    return panel(null, stage, note, strip, el("div", { class: "h-hint", text: `${photos.length} fotoğraf · oklar, ← → tuşları veya kaydırarak gez` }));
  }

  // ---------- price ----------
  function pricePanel(row, FI) {
    return panel(
      "Fiyat",
      el(
        "div",
        { class: "h-stats" },
        stat("Kira", H.money(row.price_value)),
        stat("Aidat", row.dues == null ? "belirtilmemiş" : H.money(row.dues)),
        stat("Aylık toplam", H.money(row.monthly_cost)),
        stat(row.deposit == null ? "Depozito" : `Depozito · ${H.num(row.deposit_months)} ay`, row.deposit == null ? "belirtilmemiş" : H.money(row.deposit)),
        stat("Taşınma maliyeti", row.move_in_cost == null ? "?" : H.money(row.move_in_cost), FI.move_in_cost.label + "; emlakçı komisyonu dahil değil"),
        stat("Net m² başına", H.num(row.price_per_m2_net) + " ₺")
      )
    );
  }

  // ---------- commute ----------
  const RIDE_ICON = { BUS: "🚌", SHARE_TAXI: "🚐", SUBWAY: "🚇", METRO_RAIL: "🚇", LIGHT_RAIL: "🚈", TRAM: "🚊", HEAVY_RAIL: "🚆", COMMUTER_TRAIN: "🚆" };
  function timeline(route) {
    const ol = el("ol", { class: "h-timeline" });
    for (const s of (route && route.segments) || []) {
      let icon, main, meta;
      if (s.mode === "walk") {
        icon = "🚶";
        main = el("span", {}, el("b", { text: "Yürü" }), ` ${H.mins(s.minutes)}`);
        meta = s.distance_m ? `${H.num(s.distance_m)} m` : null;
      } else if (s.mode === "ring") {
        icon = "🚐";
        main = el("span", {}, el("b", { text: "ODTÜ ring" }), ` ~${s.minutes} dk`);
        meta = `${s.from_stop || ""} → ${s.to_stop || ""} · varsayım`;
      } else {
        icon = RIDE_ICON[s.vehicle] || "🚌";
        main = el(
          "span",
          {},
          el("b", { class: "h-line", text: s.line || "?" }),
          " ",
          el("span", { class: "h-time", text: s.departure_time || "?" }),
          ` ${s.from_stop || ""} → `,
          el("span", { class: "h-time", text: s.arrival_time || "?" }),
          ` ${s.to_stop || ""}`
        );
        meta = [s.vehicle_tr, s.line_name, s.stop_count ? `${s.stop_count} durak` : null, s.minutes ? H.mins(s.minutes) : null, s.headsign ? `yön: ${s.headsign}` : null].filter(Boolean).join(" · ");
      }
      ol.append(el("li", { class: "seg-" + s.mode }, el("span", { class: "h-tl-icon", text: icon, "aria-hidden": "true" }), el("div", {}, main, meta ? el("div", { class: "h-tl-meta", text: meta }) : null)));
    }
    return ol;
  }
  function transitTrip(title, t, route, evening) {
    if (!t || !t.route_found) return el("div", { class: "h-trip" }, el("div", { class: "h-trip-head", text: title + ": rota bulunamadı" }));
    const head = evening ? `${title}: işten ${t.leave_at} çık → evde ${t.arrive_at}` : `${title}: evden ${t.leave_at} çık → işte ${t.arrive_at}`;
    const facts = [`yolculuk ${H.mins(t.duration_min)}`, `EGO ${H.mins(t.to_ring_stop_min)} + ring ${H.mins(t.ring_min)}`];
    if (route) {
      facts.push(`${route.transfers} aktarma`, `${H.mins(route.walk_min)} yürüme`);
      if (route.uses_rail) facts.push("raylı sistem var");
    }
    if (evening && t.wait_min != null) facts.push(`ilk araca ${H.mins(t.wait_min)} bekleme` + (route && route.leave_ring_stop_at ? ` (A2'den ${route.leave_ring_stop_at})` : ""));
    return el(
      "div",
      { class: "h-trip" },
      el("div", { class: "h-trip-head" }, el("span", { text: head }), el("span", { class: "h-muted", text: route && route.lines ? route.lines : "" })),
      el("div", { class: "h-small h-muted", style: "margin-bottom:6px", text: facts.join(" · ") }),
      timeline(route)
    );
  }
  function driveTrip(title, d, evening) {
    if (!d || !d.route_found) return el("div", { class: "h-trip" }, el("div", { class: "h-trip-head", text: title + ": rota bulunamadı" }));
    const traffic = d.duration_without_traffic_min != null ? d.duration_min - d.duration_without_traffic_min : null;
    const head = evening ? `${title}: işten ${d.leave_at} çık → evde ${d.arrive_at}` : `${title}: evden ${d.leave_at} çık → işte ${d.arrive_at}`;
    return el(
      "div",
      { class: "h-trip" },
      el("div", { class: "h-trip-head", text: head }),
      el("div", { class: "h-small h-muted", text: [`${H.mins(d.duration_min)}`, d.duration_without_traffic_min != null ? `trafiksiz ${H.mins(d.duration_without_traffic_min)}` : null, traffic != null ? `trafik +${H.mins(traffic)}` : null, d.distance_km != null ? `${H.num(d.distance_km)} km` : null].filter(Boolean).join(" · ") })
    );
  }
  function commutePanel(ad) {
    const c = ad.commute || {};
    const am = c.morning || {}, pm = c.evening || {};
    const daily = c.daily_total_min || {};
    const p = panel(
      "Yolculuk → ODTÜ Teknokent",
      el(
        "div",
        { class: "h-stats h-stats-commute" },
        el("div", { class: "h-stats-label", text: "🚌 Toplu taşıma" }),
        stat("Sabah", H.mins(am.transit && am.transit.duration_min)),
        stat("Akşam", H.mins(pm.transit && pm.transit.duration_min)),
        stat("Günlük", H.mins(daily.transit)),
        el("div", { class: "h-stats-label", text: "🚗 Araç" }),
        stat("Sabah", H.mins(am.drive && am.drive.duration_min)),
        stat("Akşam", H.mins(pm.drive && pm.drive.duration_min)),
        stat("Günlük", H.mins(daily.drive))
      ),
      el("div", { class: "h-hint", style: "margin:-4px 0 12px", text: `Kuş uçuşu ${ad.distance_to_work && ad.distance_to_work.straight_line_km != null ? H.num(ad.distance_to_work.straight_line_km) + " km" : "?"}` }),
      el("h3", { text: "🚌 Toplu taşıma" }),
      transitTrip("Sabah", am.transit, am.transit_route, false),
      transitTrip("Akşam", pm.transit, pm.transit_route, true),
      el("h3", { text: "🚗 Araç" }),
      driveTrip("Sabah", am.drive, false),
      driveTrip("Akşam", pm.drive, true),
      el(
        "div",
        { class: "h-note" },
        "Varsayımlar: ODTÜ ring (A2 Metro Kapısı ↔ Teknokent) sabit ~15 dk sayıldı; ring saatleri dönemden döneme değişir ve Google verisinde yok. ",
        `Süreler tek bir hafta içi günü (${(am.transit_route && am.transit_route.computed_for) || "2026-10-12"}) için Google Maps'ten alındı. `,
        "Yolculuk süresi ilk araç için beklemeyi içermez; saatler gerçek sefer saatlerine göredir."
      )
    );
    return p;
  }

  // ---------- features / details ----------
  function featuresPanel(ad) {
    const cd = ad.classified_detail || {};
    const feats = cd.features || {};
    const checklist = (ad.auto_review && ad.auto_review.checklist) || {};
    const body = el("div");
    for (const [group, list] of Object.entries(feats)) {
      const q = checklist[group];
      body.append(
        el("h3", { style: "margin-top:10px" }, group, " ", q && q !== "filled" ? el("span", { class: "h-tag warn", text: q === "empty" ? "boş" : "hepsi işaretli" }) : null),
        list && list.length ? el("div", { class: "h-tags" }, list.map((f) => el("span", { class: "h-tag", text: f }))) : el("div", { class: "h-muted h-small", text: "İşaretlenmiş özellik yok" })
      );
    }
    return panel("İlandaki özellikler", body);
  }
  function detailsPanel(ad) {
    const dl = el("dl", { class: "h-kv" });
    for (const [k, v] of Object.entries(ad.details || {})) dl.append(el("dt", { text: k }), el("dd", { text: v == null ? "–" : String(v) }));
    return panel("İlan bilgileri", dl);
  }
  function sellerPanel(ad) {
    const c = ad.contact || {};
    const dl = el("dl", { class: "h-kv" });
    const add = (k, v) => v && dl.append(el("dt", { text: k }), el("dd", { text: v }));
    add("Satıcı", H.SELLER_TYPE[c.seller_type] || c.seller_type);
    add("Ofis", c.office_name);
    add("Yetki belge no", c.license_no);
    add("Üyelik", c.member_since);
    // Names and phone numbers are intentionally never shown (and stripped from the published data).
    return panel("Satıcı", dl, el("div", { class: "h-hint", style: "margin-top:8px", text: "İletişim bilgileri yayından kaldırıldı; iletişim için “İlanı aç” veya “mesaj” bağlantısını kullan." }));
  }

  // ---------- map ----------
  function mapPanel(ad) {
    const lat = ad.location && ad.location.latitude, lon = ad.location && ad.location.longitude;
    const box = el("div", { class: "h-map h-map-small" });
    const p = panel("Konum", box, el("div", { class: "h-hint", style: "margin-top:6px", text: "Konum ilan sahibinin işaretlediği yaklaşık noktadır." }));
    if (lat == null || lon == null || !window.L) {
      box.replaceWith(el("p", { class: "h-muted", text: "Harita için konum yok." }));
      return p;
    }
    requestAnimationFrame(() => {
      const m = L.map(box, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      L.circleMarker([lat, lon], { radius: 9, color: "#222", weight: 2, fillColor: "#2563a6", fillOpacity: 0.9 }).addTo(m).bindTooltip("Ev");
      L.marker(WORK, { icon: L.divIcon({ className: "", html: '<div style="font-size:24px;line-height:1">🏢</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
        .addTo(m)
        .bindTooltip("ODTÜ Teknokent");
      m.fitBounds([[lat, lon], WORK], { padding: [30, 30] });
    });
    return p;
  }

  // ---------- notes ----------
  function notesPanel(row) {
    const p = el("section", { class: "h-panel" });
    const draw = () => {
      const n = H.notes(id);
      clear(p);
      p.append(el("h2", { text: "Notlarım" }));
      const form = el("div", { class: "h-form" });

      const status = el("select", { class: "h-input", "aria-label": "Durum" });
      for (const [k, label] of Object.entries(H.STATUS)) status.append(el("option", { value: k, text: label, selected: k === n.status }));
      status.addEventListener("change", () => save({ status: status.value }));

      const stars = el("span", { class: "h-stars", role: "group", "aria-label": "Puan" });
      for (let i = 1; i <= 5; i++) {
        stars.append(el("button", { type: "button", class: n.rating >= i ? "on" : "", text: "★", "aria-label": `${i} puan`, title: n.rating === i ? "Puanı kaldır" : `${i} puan`, onclick: () => save({ rating: n.rating === i ? null : i }) }));
      }
      const visited = el("input", { type: "date", class: "h-input", value: n.visited_on || "" });
      visited.addEventListener("change", () => save({ visited_on: visited.value || null }));
      const favBox = el("input", { type: "checkbox", checked: n.favorite });
      favBox.addEventListener("change", () => save({ favorite: favBox.checked }));

      form.append(
        el("div", { class: "h-form-row" }, el("label", {}, "Durum ", status), el("label", { class: "h-check" }, favBox, "Favori ★")),
        el("div", { class: "h-form-row" }, el("span", { text: "Puan" }), stars),
        el("div", { class: "h-form-row" }, el("label", {}, "Gezme tarihi ", visited))
      );
      form.append(editList("Artılar", "pro", n.pros, row ? row.auto_pros : [], (list) => save({ pros: list })));
      form.append(editList("Eksiler", "con", n.cons, row ? row.auto_cons : [], (list) => save({ cons: list })));

      const note = el("textarea", { class: "h-input", placeholder: "Notlar: kiminle konuşuldu, gezme izlenimleri…", "aria-label": "Not" });
      note.value = n.note;
      let t;
      note.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => H.patchNotes(id, { note: note.value }), 400);
      });
      note.addEventListener("blur", () => {
        clearTimeout(t);
        if (note.value !== H.notes(id).note) save({ note: note.value });
      });
      form.append(el("label", { text: "Not" }), note);

      const local = H.hasLocalNotes(id);
      form.append(
        el(
          "div",
          { class: "h-note" },
          local
            ? ["Bu ilandaki değişiklikler sadece bu tarayıcıda kayıtlı. Herkesin görmesi için ", el("a", { href: H.cfg.root + "notes/", text: "Notlarım" }), " sayfasından JSON'u dışa aktarıp assets/notes.json dosyasına yapıştır. ", el("button", { type: "button", class: "h-btn h-btn-small", text: "Dosyadaki hale döndür", onclick: () => { if (confirm("Bu ilandaki tarayıcı değişiklikleri silinsin mi?")) { H.clearLocalNotes(id); draw(); } } })]
            : "Notlar assets/notes.json dosyasından geliyor. Değişiklik yaparsan bu tarayıcıda saklanır."
        )
      );
      p.append(form);
    };
    const save = (patch) => {
      H.patchNotes(id, patch);
      draw();
    };
    redrawNotes = draw;
    draw();
    return p;
  }

  function editList(title, cls, list, auto, onChange) {
    const isAuto = H.isAutoList(list, auto);
    const box = el("div");
    box.append(
      el(
        "div",
        { class: "h-form-row", style: "justify-content:space-between" },
        el("strong", {}, title, " ", isAuto ? el("span", { class: "h-tag", text: "otomatik" }) : el("span", { class: "h-tag", text: "düzenlendi" })),
        !isAuto && auto && auto.length ? el("button", { type: "button", class: "h-btn h-btn-small", text: "Otomatiğe döndür", onclick: () => onChange([...auto]) }) : null
      )
    );
    const chips = el("div", { class: "h-editlist" });
    const LIMIT = 12;
    const collapsed = list.length > LIMIT + 3;
    list.forEach((item, i) =>
      chips.append(
        el("span", { class: "h-tag " + cls }, item, el("button", { type: "button", "aria-label": `“${item}” sil`, title: "Sil", text: "✕", onclick: () => onChange(list.filter((_, j) => j !== i)) }))
      )
    );
    if (collapsed) {
      const extra = [...chips.children].slice(LIMIT);
      extra.forEach((c) => (c.hidden = true));
      const more = el("button", { type: "button", class: "h-btn h-btn-small", text: `Tümünü göster (+${extra.length})` });
      more.addEventListener("click", () => {
        extra.forEach((c) => (c.hidden = false));
        more.remove();
      });
      chips.append(more);
    }
    if (!list.length) chips.append(el("span", { class: "h-muted h-small", text: "Boş" }));
    const input = el("input", { class: "h-input", placeholder: cls === "pro" ? "Artı ekle (ör. güneş alıyor)" : "Eksi ekle (ör. komşular gürültülü)" });
    const add = () => {
      const v = input.value.trim();
      if (v) onChange([...list, v]);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    });
    box.append(chips, el("div", { class: "h-add", style: "margin-top:6px" }, input, el("button", { type: "button", class: "h-btn", text: "Ekle", onclick: add })));
    return box;
  }
})();
