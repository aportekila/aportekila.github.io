/* "Notlarım" page: overview of all notes, quick edits, export / import of assets/notes.json. */
(function () {
  "use strict";
  const { el, clear } = H;
  const root = document.getElementById("notes");
  const EDIT_URL = "https://github.com/aportekila/aportekila.github.io/edit/main/assets/notes.json";
  const STATUS_ORDER = Object.keys(H.STATUS);

  let filter = H.store.get("house.notesFilter", "touched");

  H.loadIndex()
    .then(render)
    .catch((err) => H.fail(root, err));

  function isTouched(id) {
    const n = H.notes(id), d = H.notesDefaults(id);
    return n.status !== "new" || n.favorite || n.rating || n.note || n.visited_on || !H.isAutoList(n.pros, d.pros) || !H.isAutoList(n.cons, d.cons);
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = el("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- visit plan: ads marked "Gezme planlandı", in a chosen order ----------
  const ORDER_KEY = "house.visitOrder";
  const MAX_STOPS = 10; // Google Maps: destination + 9 waypoints
  let planMap = null;

  function planIds(index) {
    const planned = new Set(index.ads.filter((a) => H.notes(a.id).status === "visit_planned").map((a) => a.id));
    const saved = (H.store.get(ORDER_KEY, []) || []).filter((id) => planned.has(id));
    return [...saved, ...[...planned].filter((id) => !saved.includes(id))];
  }
  /** Greedy nearest-neighbour order, starting from the first stop. */
  function shortestOrder(ids) {
    if (ids.length < 3) return ids;
    const left = ids.slice(1).map((id) => H.byId.get(id));
    const order = [H.byId.get(ids[0])];
    while (left.length) {
      const last = order[order.length - 1];
      let best = 0;
      left.forEach((a, i) => (H.distanceM(last, a) < H.distanceM(last, left[best]) ? (best = i) : 0));
      order.push(left.splice(best, 1)[0]);
    }
    return order.map((a) => a.id);
  }
  function routeUrl(ads) {
    const pt = (a) => `${a.latitude},${a.longitude}`;
    const p = new URLSearchParams({ api: "1", destination: pt(ads[ads.length - 1]), travelmode: "driving" });
    if (ads.length > 1) p.set("waypoints", ads.slice(0, -1).map(pt).join("|"));
    return "https://www.google.com/maps/dir/?" + p.toString(); // no origin = start from current location
  }

  function visitPlan(index) {
    const ids = planIds(index);
    const ads = ids.map((id) => H.byId.get(id));
    const sec = el("section", { class: "h-panel" }, el("h2", { text: "🗺 Gezme planı" }));
    if (!ads.length) {
      sec.append(el("p", { class: "h-hint", text: "Bir ilanın durumunu “Gezme planlandı” yapınca burada sıralı bir rota olarak görünür; Google Maps'te tek tıkla açabilirsin." }));
      return sec;
    }
    const save = (order) => {
      H.store.set(ORDER_KEY, order);
      render(index);
    };
    const list = el("ol", { class: "h-plan" });
    ads.forEach((a, i) => {
      const n = H.notes(a.id);
      const move = (d) => {
        const o = [...ids];
        [o[i], o[i + d]] = [o[i + d], o[i]];
        save(o);
      };
      list.append(
        el(
          "li",
          {},
          el("span", { class: "h-plan-num", text: i + 1 }),
          el("div", { class: "h-plan-body" }, el("a", { href: H.adPage(a.id), text: a.title }), el("div", { class: "h-muted h-small", text: [H.money(a.price_value), a.neighborhood, a.complex_name, n.visited_on ? "📅 " + H.date(n.visited_on) : null].filter(Boolean).join(" · ") })),
          el(
            "span",
            { class: "h-plan-move" },
            el("button", { type: "button", class: "h-btn h-btn-small", text: "↑", "aria-label": "Yukarı taşı", disabled: i === 0, onclick: () => move(-1) }),
            el("button", { type: "button", class: "h-btn h-btn-small", text: "↓", "aria-label": "Aşağı taşı", disabled: i === ads.length - 1, onclick: () => move(1) })
          )
        )
      );
    });
    const mapBox = el("div", { class: "h-map h-map-small" });
    const located = ads.filter((a) => a.latitude != null);
    sec.append(
      ...[
      el("p", { class: "h-hint", text: `${ads.length} durak. Sırayı oklarla değiştir ya da en kısa sıraya dizdir; rota bulunduğun konumdan başlar.` }),
      el("div", { class: "h-grid-2" }, list, mapBox),
      el(
        "div",
        { class: "h-actions", style: "margin-top:12px" },
        el("button", { type: "button", class: "h-btn", text: "Sırayı en kısa yola göre diz", onclick: () => save(shortestOrder(ids)) }),
        located.length ? el("a", { class: "h-btn h-btn-primary", href: routeUrl(located.slice(0, MAX_STOPS)), target: "_blank", rel: "noopener noreferrer", text: "Google Maps'te rotayı aç ↗" }) : null
      ),
      located.length > MAX_STOPS ? el("p", { class: "h-hint", text: `Google Maps en fazla ${MAX_STOPS} durak alıyor; ilk ${MAX_STOPS} durak açılır.` }) : null,
      ].filter(Boolean)
    );
    requestAnimationFrame(() => {
      if (!window.L || !located.length || !mapBox.isConnected) return;
      if (planMap) planMap.remove();
      planMap = L.map(mapBox, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(planMap);
      const pts = located.map((a) => [a.latitude, a.longitude]);
      L.polyline(pts, { color: "#3156d3", weight: 3, dashArray: "6 6" }).addTo(planMap);
      located.forEach((a, i) =>
        L.marker([a.latitude, a.longitude], { icon: L.divIcon({ className: "", html: `<div class="h-pin">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
          .bindTooltip(a.title)
          .addTo(planMap)
      );
      planMap.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    });
    return sec;
  }

  function render(index) {
    clear(root);
    const localIds = Object.keys(H.localNotes()).filter((id) => H.byId.has(id) || id in H.notesFile.ads);
    root.append(el("h1", { text: "Notlarım" }));

    // Export / import
    const json = () => JSON.stringify(H.exportNotes(), null, 2) + "\n";
    const copyBtn = el("button", {
      type: "button", class: "h-btn", text: "JSON'u kopyala",
      onclick: () =>
        navigator.clipboard
          ? navigator.clipboard.writeText(json()).then(() => (copyBtn.textContent = "Kopyalandı ✓"), () => alert("Kopyalanamadı; “İndir”i kullan."))
          : alert("Tarayıcı panoya erişime izin vermiyor; “İndir”i kullan."),
    });
    const file = el("input", { type: "file", accept: ".json,application/json", hidden: true });
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (!f) return;
      f.text()
        .then((t) => {
          const n = H.importNotes(JSON.parse(t));
          alert(`${n} ilanın notu içe aktarıldı (bu tarayıcıya).`);
          render(index);
        })
        .catch((e) => alert("İçe aktarılamadı: " + e.message));
    });
    root.append(
      el(
        "section",
        { class: "h-panel" },
        el("h2", { text: "Paylaş / yedekle" }),
        el(
          "p",
          { class: "h-small" },
          localIds.length
            ? `Bu tarayıcıda ${localIds.length} ilanda dosyaya kaydedilmemiş değişiklik var. `
            : "Bu tarayıcıda kaydedilmemiş değişiklik yok. ",
          "Arkadaşlarının da görmesi için JSON'u kopyala ve GitHub'da ",
          el("a", { href: EDIT_URL, target: "_blank", rel: "noopener noreferrer", text: "assets/notes.json" }),
          " dosyasının içeriğini tamamen bununla değiştirip kaydet. Site yeniden yayınlandığında, dosyayla aynı olan yerel değişiklikler kendiliğinden temizlenir."
        ),
        el(
          "div",
          { class: "h-actions" },
          copyBtn,
          el("button", { type: "button", class: "h-btn", text: "İndir (notes.json)", onclick: () => download("notes.json", json()) }),
          el("button", { type: "button", class: "h-btn", text: "İçe aktar…", onclick: () => file.click() }),
          file,
          localIds.length
            ? el("button", {
                type: "button", class: "h-btn", text: "Yerel değişiklikleri sil",
                onclick: () => {
                  if (confirm("Bu tarayıcıdaki tüm not değişiklikleri silinsin mi? (assets/notes.json etkilenmez)")) {
                    H.clearLocalNotes();
                    render(index);
                  }
                },
              })
            : null
        )
      )
    );

    // Sharing favourites + offline download
    const offBtn = el("button", { type: "button", class: "h-btn", text: "⬇ Çevrimdışı kullanım için indir" });
    offBtn.addEventListener("click", async () => {
      if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
        alert("Çevrimdışı önbellek henüz hazır değil; sayfayı bir kez yenileyip tekrar dene.");
        return;
      }
      offBtn.disabled = true;
      const failed = await H.downloadForOffline((d, t) => (offBtn.textContent = `İndiriliyor… ${d}/${t}`));
      offBtn.textContent = failed ? `Bitti (${failed} dosya alınamadı)` : "✓ Tüm ilanlar çevrimdışı hazır";
    });
    root.append(
      el(
        "section",
        { class: "h-panel" },
        el("h2", { text: "Telefonda kullan" }),
        el("p", { class: "h-small", text: "Tarayıcı menüsünden “Ana ekrana ekle” dersen uygulama gibi açılır. Gezmelerde çekim zayıfsa önce buradan tüm ilanları indir; ilan detayları ve fotoğraflar internetsiz de açılır (harita yalnızca daha önce bakılan bölgeler için)." }),
        el("div", { class: "h-actions" }, offBtn, el("button", { type: "button", class: "h-btn", text: "⤴ Favorilerimi paylaş", onclick: () => H.shareFavorites() }))
      )
    );

    // Summary by status
    const counts = {};
    let favs = 0;
    for (const ad of index.ads) {
      const n = H.notes(ad.id);
      counts[n.status] = (counts[n.status] || 0) + 1;
      if (n.favorite) favs++;
    }
    root.append(
      el(
        "div",
        { class: "h-tags", style: "margin-bottom:12px" },
        el("span", { class: "h-tag", text: `★ ${favs} favori` }),
        STATUS_ORDER.filter((s) => counts[s]).map((s) => el("span", { class: "h-tag st-" + s, text: `${H.STATUS[s]}: ${counts[s]}` }))
      )
    );

    root.append(visitPlan(index));

    // Table
    const sel = el("select", { class: "h-input", "aria-label": "Göster" });
    const FILTERS = { touched: "Not alınanlar / değiştirilenler", fav: "Favoriler", local: "Bu tarayıcıda değişenler", all: "Hepsi" };
    for (const [k, v] of Object.entries(FILTERS)) sel.append(el("option", { value: k, text: v, selected: k === filter }));
    sel.addEventListener("change", () => {
      filter = sel.value;
      H.store.set("house.notesFilter", filter);
      render(index);
    });
    root.append(el("div", { class: "h-toolbar" }, el("label", { class: "h-sort" }, "Göster", sel)));

    const rows = index.ads
      .filter((ad) => {
        if (filter === "fav") return H.notes(ad.id).favorite;
        if (filter === "local") return H.hasLocalNotes(ad.id);
        if (filter === "touched") return isTouched(ad.id);
        return true;
      })
      .sort((a, b) => {
        const na = H.notes(a.id), nb = H.notes(b.id);
        return nb.favorite - na.favorite || STATUS_ORDER.indexOf(na.status) - STATUS_ORDER.indexOf(nb.status) || (nb.rating || 0) - (na.rating || 0) || a.price_value - b.price_value;
      });

    if (!rows.length) {
      root.append(el("div", { class: "h-panel h-empty" }, "Bu görünümde ilan yok. İlan detay sayfasından not ekleyebilir ya da “Hepsi”ni seçebilirsin."));
      return;
    }
    const tbody = el("tbody");
    for (const ad of rows) {
      const n = H.notes(ad.id);
      const status = el("select", { class: "h-input", "aria-label": "Durum" });
      for (const [k, label] of Object.entries(H.STATUS)) status.append(el("option", { value: k, text: label, selected: k === n.status }));
      status.addEventListener("change", () => {
        H.patchNotes(ad.id, { status: status.value });
        render(index);
      });
      tbody.append(
        el(
          "tr",
          {},
          el("td", {}, H.favButton(ad.id, () => render(index))),
          el("td", {}, status),
          el("td", { text: n.rating ? "★".repeat(n.rating) : "–" }),
          el("td", { class: "wrap" }, el("a", { href: H.adPage(ad.id), text: ad.title }), el("div", { class: "h-muted h-small", text: [ad.district, ad.neighborhood].filter(Boolean).join(" · ") })),
          el("td", { class: "num", text: H.money(ad.price_value) }),
          el("td", { class: "num", text: `🚌 ${H.mins(ad.daily_transit_min)} · 🚗 ${H.mins(ad.daily_drive_min)}` }),
          el("td", { text: n.visited_on ? H.date(n.visited_on) : "–" }),
          el("td", { class: "wrap" }, n.note ? el("div", { class: "h-desc h-small", text: n.note.length > 160 ? n.note.slice(0, 160) + "…" : n.note }) : "–"),
          el("td", {}, H.hasLocalNotes(ad.id) ? el("span", { class: "h-tag warn", text: "kaydedilmedi", title: "Sadece bu tarayıcıda; dışa aktarıp notes.json'a yapıştır" }) : "")
        )
      );
    }
    const head = el("tr", {}, ["★", "Durum", "Puan", "İlan", "Kira", "Günlük yolculuk", "Gezme", "Not", ""].map((t) => el("th", { scope: "col", text: t })));
    root.append(el("div", { class: "h-table-wrap" }, el("table", { class: "h-table h-notes-table" }, el("thead", {}, head), tbody)));
  }
})();
