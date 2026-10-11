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
    const favStyle = "background:var(--surface-2);color:var(--text)";
    root.querySelectorAll(".h-fav-btn").forEach((b) => (b.style.cssText = favStyle));
  }
})();
