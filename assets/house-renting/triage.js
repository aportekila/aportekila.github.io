/* Triage page: go through ads one by one and mark them quickly.
 * Queue = the list page's current filtered order (sessionStorage) or every ad by rent. */
(function () {
  "use strict";
  const { el, clear } = H;
  const root = document.getElementById("triage");
  const ONLY_NEW_KEY = "house.triageOnlyNew";

  let queue = [], pos = 0, history_ = [], onlyNew = H.store.get(ONLY_NEW_KEY, true);
  let source = [];

  H.loadIndex()
    .then((index) => {
      // The list page's "Hızlı eleme" button passes its filtered order (and ?from=list).
      let ids = null;
      if (new URLSearchParams(location.search).get("from") === "list") {
        try {
          ids = JSON.parse(sessionStorage.getItem("house.triage") || "null");
        } catch (e) {
          /* ignore */
        }
      }
      source = (Array.isArray(ids) && ids.length ? ids : [...index.ads].sort((a, b) => a.price_value - b.price_value).map((a) => a.id)).filter((id) => H.byId.has(id));
      buildQueue();
      document.addEventListener("keydown", onKey);
      draw();
    })
    .catch((err) => H.fail(root, err));

  function buildQueue() {
    queue = source.filter((id) => !onlyNew || H.notes(id).status === "new");
    pos = 0;
    history_ = [];
  }

  function decide(action) {
    const id = queue[pos];
    if (!id) return;
    const before = H.notes(id);
    history_.push({ id, pos, status: before.status, favorite: before.favorite, action });
    if (action === "reject") H.patchNotes(id, { status: "rejected" });
    else if (action === "keep") H.patchNotes(id, { status: "interested" });
    else if (action === "later") queue.push(queue.splice(pos, 1)[0]);
    if (action !== "later") pos++;
    draw(action);
  }
  function toggleFav() {
    const id = queue[pos];
    if (!id) return;
    H.patchNotes(id, { favorite: !H.notes(id).favorite });
    draw();
  }
  function undo() {
    const last = history_.pop();
    if (!last) return;
    H.patchNotes(last.id, { status: last.status, favorite: last.favorite });
    if (last.action === "later") queue.splice(last.pos, 0, queue.pop());
    pos = last.pos;
    draw();
  }
  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    const map = { ArrowLeft: () => decide("reject"), ArrowRight: () => decide("keep"), " ": () => decide("later"), ArrowDown: () => decide("later"), f: toggleFav, F: toggleFav, z: undo, Z: undo };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  }

  function cardFor(ad) {
    const n = H.notes(ad.id);
    const photo = H.cardPhoto(ad);
    const t = H.MODES.transit, d = H.MODES.drive;
    const tags = el("div", { class: "h-tags" });
    const sr = H.scoring.scoreOf(ad.id);
    if (sr) tags.append(el("span", { class: "h-tag score", text: sr.excluded.length ? "🏆 elendi" : `🏆 ${H.num(Math.round(sr.total))} · ${sr.rank}.` }));
    if (ad.is_owner) tags.append(el("span", { class: "h-tag owner", text: "Sahibinden" }));
    if (ad._dup) tags.append(el("span", { class: "h-tag dup", text: `≈ aynı daire, ${ad._dup.length} ilan` + (ad._dup[0] === ad.id ? " · en ucuzu" : "") }));
    if (ad._area && Math.abs(ad._area.diff) >= 0.08) tags.append(el("span", { class: "h-tag " + (ad._area.diff < 0 ? "pro" : "con"), text: H.areaText(ad._area) }));
    for (const f of H.friendsFor(ad.id)) tags.append(el("span", { class: "h-tag friend", text: `★ ${f}` }));
    if (ad._loc_warn) tags.append(el("span", { class: "h-tag warn", title: ad._loc_warn, text: "📍 Konum şüpheli" }));
    if (ad._timing) tags.append(el("span", { class: "h-tag warn", title: ad._timing.join("; "), text: "⏱ Sefer saatine hassas" }));
    if (ad._station) tags.append(el("span", { class: "h-tag", text: `🚇 ${H.stationText(ad)}` }));
    if (H.CHECKLIST_WARN[ad.checklist_quality]) tags.append(el("span", { class: "h-tag warn", text: H.CHECKLIST_WARN[ad.checklist_quality] }));
    return el(
      "article",
      { class: "h-tri-card" },
      el(
        "div",
        { class: "h-card-photo" },
        photo ? el("img", { src: photo, alt: "", width: 528, height: 396 }) : null,
        n.favorite ? el("span", { class: "h-tri-fav", text: "★" }) : null,
        el("div", { class: "h-photo-price" }, el("b", { text: H.money(ad.price_value) }), el("span", { text: ad.dues_known ? `aylık toplam ${H.money(ad.monthly_cost)}` : "aidat belirtilmemiş" }))
      ),
      el(
        "div",
        { class: "h-card-body" },
        el("a", { class: "h-card-title", href: H.adPage(ad.id), target: "_blank", rel: "noopener", text: ad.title + " ↗" }),
        el("div", { class: "h-card-loc" }, [ad.district, ad.neighborhood, ad.complex_name].filter(Boolean).join(" · ")),
        el(
          "div",
          { class: "h-commute h-commute-2" },
          el("div", {}, el("span", { text: "🚌 Kapıdan kapıya" }), el("b", { text: H.mins(ad[t.d2d]) })),
          el("div", {}, el("span", { text: "🚌 Sabah / akşam" }), el("b", { text: `${H.mins(ad[t.am])} / ${H.mins(ad[t.pm])}` })),
          el("div", {}, el("span", { text: "🚗 Kapıdan kapıya" }), el("b", { text: H.mins(ad[d.d2d]) }))
        ),
        el("ul", { class: "h-specs" }, el("li", { text: `${ad.area_net_m2} m²` }), el("li", { text: `Kat ${ad.floor}/${ad.floor_count}` }), el("li", { text: `${ad.building_age_min}${ad.building_age_max == null ? "+" : ad.building_age_max !== ad.building_age_min ? "–" + ad.building_age_max : ""} yaş` }), el("li", { text: ad.heating || "Isıtma ?" })),
        tags,
        n.pros.length ? H.tagList(n.pros, "pro", 6) : null,
        n.cons.length ? H.tagList(n.cons, "con", 4) : null
      )
    );
  }

  function attachSwipe(card) {
    let x0 = null, dx = 0;
    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || e.target.closest("a")) return;
      x0 = e.clientX;
      dx = 0;
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener("pointermove", (e) => {
      if (x0 == null) return;
      dx = e.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
      card.dataset.hint = dx > 60 ? "keep" : dx < -60 ? "reject" : "";
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null;
      if (dx > 90) decide("keep");
      else if (dx < -90) decide("reject");
      else {
        card.style.transform = "";
        card.dataset.hint = "";
      }
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function draw(lastAction) {
    clear(root);
    const only = el("input", { type: "checkbox", checked: onlyNew });
    only.addEventListener("change", () => {
      onlyNew = only.checked;
      H.store.set(ONLY_NEW_KEY, onlyNew);
      buildQueue();
      draw();
    });
    const total = queue.length;
    const head = el(
      "div",
      { class: "h-tri-head" },
      el("h1", { text: "⚡ Hızlı eleme" }),
      el("label", { class: "h-check" }, only, "Sadece “Yeni” durumdakiler"),
      el("span", { class: "h-muted h-small", text: source.length !== H.index.ads.length ? `İlanlar sayfasındaki filtrelenmiş liste (${source.length} ilan)` : "Tüm ilanlar, kiraya göre" })
    );
    const progress = el("div", { class: "h-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": Math.min(pos, total) }, el("span", { style: `width:${total ? (Math.min(pos, total) / total) * 100 : 100}%` }));
    root.append(head, progress);

    const ad = H.byId.get(queue[pos]);
    if (!ad) {
      const counts = {};
      for (const h of history_) counts[h.action] = (counts[h.action] || 0) + 1;
      root.append(
        el(
          "div",
          { class: "h-panel h-empty" },
          el("h2", { text: total ? "Bitti! 🎉" : "Elenecek ilan yok" }),
          total ? el("p", { text: `${counts.keep || 0} ilgileniyorum · ${counts.reject || 0} elendi` }) : el("p", { text: onlyNew ? "Bu listede “Yeni” durumda ilan kalmadı. Kutuyu kaldırarak hepsini tekrar gözden geçirebilirsin." : "Liste boş." }),
          el(
            "div",
            { class: "h-actions", style: "justify-content:center" },
            history_.length ? el("button", { type: "button", class: "h-btn", text: "↶ Geri al (Z)", onclick: undo }) : null,
            el("a", { class: "h-btn h-btn-primary", href: `${H.cfg.root}?st=interested`, text: "İlgilendiklerimi gör" }),
            el("a", { class: "h-btn", href: H.cfg.root, text: "İlanlara dön" })
          )
        )
      );
      return;
    }

    const card = cardFor(ad);
    if (lastAction) card.classList.add("enter");
    attachSwipe(card);
    const fav = H.notes(ad.id).favorite;
    root.append(
      el("p", { class: "h-tri-count", text: `${pos + 1} / ${total}` }),
      card,
      el(
        "div",
        { class: "h-tri-actions" },
        el("button", { type: "button", class: "h-tri-btn reject", onclick: () => decide("reject") }, el("b", { text: "✕" }), el("span", { text: "Elendi" }), el("kbd", { text: "←" })),
        el("button", { type: "button", class: "h-tri-btn later", onclick: () => decide("later") }, el("b", { text: "↷" }), el("span", { text: "Sonra" }), el("kbd", { text: "boşluk" })),
        el("button", { type: "button", class: "h-tri-btn fav" + (fav ? " on" : ""), onclick: toggleFav }, el("b", { text: fav ? "★" : "☆" }), el("span", { text: "Favori" }), el("kbd", { text: "F" })),
        el("button", { type: "button", class: "h-tri-btn keep", onclick: () => decide("keep") }, el("b", { text: "✓" }), el("span", { text: "İlgileniyorum" }), el("kbd", { text: "→" }))
      ),
      el(
        "p",
        { class: "h-hint", style: "text-align:center" },
        "Telefonda kartı sağa / sola kaydırabilirsin. ",
        history_.length ? el("button", { type: "button", class: "h-btn h-btn-small", text: "↶ Geri al (Z)", onclick: undo }) : null
      )
    );
  }
})();
