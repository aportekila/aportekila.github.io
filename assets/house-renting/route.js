/* Visit route planner: pick a list (my favourites, a friend's shared list, a status…), get the
 * best visiting order — whole district / neighbourhood before moving on — split into days with
 * arrival times, a call list grouped by agent, Google Maps links and a shareable text plan. */
(function () {
  "use strict";
  const { el, clear } = H;
  const root = document.getElementById("route");
  const KEY = "house.routeSettings";
  const START_POINTS = {
    work: { label: "ODTÜ Teknokent (iş)", latitude: 39.8966714, longitude: 32.7736614 },
    a2: { label: "ODTÜ A2 Metro Kapısı", latitude: 39.9073794, longitude: 32.7650499 },
    kizilay: { label: "Kızılay", latitude: 39.9208, longitude: 32.8541 },
    here: { label: "Bulunduğum konum" },
  };
  const SPEED = { drive: 24, transit: 14 }; // km/h in town, incl. traffic / waits
  const HOP_BUFFER = { drive: 6, transit: 8 }; // parking, finding the building, walking
  const DETOUR = 1.35; // road distance ≈ straight line × 1.35
  const PENALTY_DISTRICT = 4000, PENALTY_HOOD = 600; // metres: keep a district / neighbourhood together
  const DAY_COLORS = ["#3156d3", "#d9480f", "#2b8a3e", "#ae3ec9", "#e8590c", "#0c8599", "#5c940d"];

  let ADS, contacts = new Map(), map = null, layer = null, here = null;
  const details = new Map(); // id → {url, office, type, message} from the (stripped) ad.json
  let st = {
    source: "fav", start: "work", mode: "drive", startTime: "10:00", visitMin: 30, perDay: 6, skipRejected: true,
    ...(H.store.get(KEY, {}) || {}),
  };
  const save = () => H.store.set(KEY, st);

  Promise.all([H.loadIndex(), H.loadContacts()])
    .then(([index, c]) => {
      ADS = index.ads;
      contacts = c;
      const q = new URLSearchParams(location.search).get("list");
      if (q && H.sharedLists()[q]) st.source = "friend:" + q;
      render();
    })
    .catch((err) => H.fail(root, err));

  // ---------- which ads ----------
  function sources() {
    const out = [
      ["fav", "★ Favorilerim"],
      ["visit_planned", "Gezme planlandı durumundakiler"],
      ["interested", "İlgileniyorum durumundakiler"],
      ["compare", "Karşılaştırmadaki ilanlar"],
      ["score10", "Puanlamada ilk 10"],
    ];
    for (const name of Object.keys(H.sharedLists())) out.push(["friend:" + name, `★ ${H.genitive(name)} favorileri`]);
    return out;
  }
  function pickAds() {
    let ids;
    if (st.source === "fav") ids = ADS.filter((a) => H.notes(a.id).favorite).map((a) => a.id);
    else if (st.source === "visit_planned" || st.source === "interested") ids = ADS.filter((a) => H.notes(a.id).status === st.source).map((a) => a.id);
    else if (st.source === "compare") ids = H.getCompare();
    else if (st.source === "score10") ids = H.scoring.activeResults().ranked.filter((r) => !r.excluded.length).slice(0, 10).map((r) => r.id);
    else if (st.source.startsWith("friend:")) ids = H.sharedLists()[st.source.slice(7)] || [];
    else ids = [];
    return ids
      .map((id) => H.byId.get(id))
      .filter((a) => a && a.latitude != null && !(st.skipRejected && ["rejected", "no_longer_listed"].includes(H.notes(a.id).status)));
  }

  // ---------- routing ----------
  const metres = (a, b) => H.distanceM(a, b) * DETOUR;
  function cost(a, b) {
    let c = metres(a, b);
    if (a.district && b.district) {
      if (a.district !== b.district) c += PENALTY_DISTRICT;
      else if (a.neighborhood !== b.neighborhood) c += PENALTY_HOOD;
    }
    return c;
  }
  const pathCost = (start, seq) => seq.reduce((s, x, i) => s + cost(i ? seq[i - 1] : start, x), 0);
  /** Nearest neighbour from the start, then 2-opt; open path (no return). */
  function order(start, ads) {
    const left = [...ads], seq = [];
    let cur = start;
    while (left.length) {
      let bi = 0;
      left.forEach((a, i) => (cost(cur, a) < cost(cur, left[bi]) ? (bi = i) : 0));
      cur = left.splice(bi, 1)[0];
      seq.push(cur);
    }
    let improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let i = 0; i < seq.length - 1; i++)
        for (let j = i + 1; j < seq.length; j++) {
          const cand = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
          if (pathCost(start, cand) + 1 < pathCost(start, seq)) {
            seq.splice(0, seq.length, ...cand);
            improved = true;
          }
        }
    }
    return seq;
  }
  /** Split the ordered route into days of ≤ perDay stops, preferring breaks at district changes. */
  function splitDays(seq, perDay) {
    const days = [];
    let i = 0;
    while (i < seq.length) {
      let end = Math.min(seq.length, i + perDay);
      if (end < seq.length) {
        for (let k = end; k > i + Math.max(1, perDay - 2); k--) {
          if (seq[k].district !== seq[k - 1].district) {
            end = k;
            break;
          }
        }
      }
      days.push(seq.slice(i, end));
      i = end;
    }
    return days;
  }
  function travelMin(a, b) {
    return Math.round(((metres(a, b) / 1000) / SPEED[st.mode]) * 60 + HOP_BUFFER[st.mode]);
  }
  function plan(startPt, ads) {
    const days = splitDays(order(startPt, ads), Math.max(1, st.perDay)).map((d) => order(startPt, d));
    let n = 0;
    return days.map((stops) => {
      let t = H.hhmmToMin(st.startTime) ?? 600, prev = startPt, km = 0;
      const out = stops.map((ad) => {
        const tm = travelMin(prev, ad), d = metres(prev, ad) / 1000;
        km += d;
        const arrive = t + tm;
        t = arrive + Number(st.visitMin || 0);
        prev = ad;
        return { ad, no: ++n, travel: tm, km: d, arrive, leave: t };
      });
      return { stops: out, km, end: t, districts: [...new Set(stops.map((a) => a.district))] };
    });
  }

  // ---------- contacts ----------
  function contactOf(ad) {
    const c = contacts.get(ad.id) || {}, d = details.get(ad.id) || {};
    return { name: c.name || null, office: c.office || d.office || null, type: c.type || d.type || ad.seller_type, phones: c.phones || [], message: c.message_url || d.message || null };
  }
  /** Load ad.json of the route's ads once (real listing URL, agency name, message link). */
  function ensureDetails(ads) {
    const missing = ads.filter((a) => !details.has(a.id));
    if (!missing.length) return null;
    return Promise.all(
      missing.map((a) =>
        H.loadAd(a.id)
          .then((d) => details.set(a.id, { url: d.source_url, office: d.contact && d.contact.office_name, type: d.contact && d.contact.seller_type, message: d.contact && d.contact.message_url }))
          .catch(() => details.set(a.id, {}))
      )
    );
  }
  /** One entry per person / agency to call, with the stops they cover. */
  function callList(days) {
    const groups = new Map();
    for (const d of days)
      for (const s of d.stops) {
        const c = contactOf(s.ad);
        const key = (c.phones[0] && c.phones[0].tel) || c.office || c.name || "ilan:" + s.ad.id;
        if (!groups.has(key)) groups.set(key, { c, stops: [] });
        groups.get(key).stops.push(s);
      }
    return [...groups.values()];
  }
  function phoneButtons(c, ad, small) {
    const out = [];
    for (const p of c.phones) {
      if (!p.tel) continue;
      out.push(el("a", { class: "h-btn h-btn-small h-call", href: "tel:" + p.tel, title: `${p.label || "Telefon"}: ${p.number}` }, "📞 ", small ? p.label || "Ara" : p.number));
      const wa = H.whatsapp(p.tel, `Merhaba, sahibinden.com'daki ${ad.id} numaralı ilanınız için yazıyorum. Daireyi görmek isterim; ne zaman uygun olur?`);
      if (wa) out.push(el("a", { class: "h-btn h-btn-small h-wa", href: wa, target: "_blank", rel: "noopener noreferrer", title: "WhatsApp" }, "WhatsApp"));
    }
    if (c.message) out.push(el("a", { class: "h-btn h-btn-small", href: c.message, target: "_blank", rel: "noopener noreferrer", text: "✉ sahibinden mesaj" }));
    if (!c.phones.length && !c.message && ad) out.push(el("a", { class: "h-btn h-btn-small", href: sourceUrl(ad), target: "_blank", rel: "noopener noreferrer", text: "İlanı aç ↗" }));
    return out;
  }
  const sourceUrl = (ad) => (details.get(ad.id) || {}).url || H.adPage(ad.id);
  const who = (c) => [c.name, c.office].filter(Boolean).join(" · ") || (c.type === "individual" ? "Ev sahibi" : "Emlakçı");

  // ---------- Google Maps ----------
  function mapsUrl(startPt, stops) {
    const pt = (a) => `${a.latitude},${a.longitude}`;
    const p = new URLSearchParams({ api: "1", destination: pt(stops[stops.length - 1].ad), travelmode: st.mode === "drive" ? "driving" : "transit" });
    if (startPt.latitude != null && st.start !== "here") p.set("origin", pt(startPt));
    if (stops.length > 1) p.set("waypoints", stops.slice(0, -1).map((s) => pt(s.ad)).join("|"));
    return "https://www.google.com/maps/dir/?" + p.toString();
  }

  // ---------- rendering ----------
  function startPoint() {
    if (st.start === "here") return here ? { label: START_POINTS.here.label, ...here } : { ...START_POINTS.work, label: "Konum alınamadı → Teknokent" };
    return START_POINTS[st.start] || START_POINTS.work;
  }
  function controls() {
    const sel = (key, opts, label) => {
      const s = el("select", { class: "h-input", "aria-label": label });
      for (const [v, t] of opts) s.append(el("option", { value: v, text: t, selected: String(st[key]) === v }));
      s.addEventListener("change", () => {
        st[key] = s.value;
        save();
        if (key === "start" && s.value === "here" && !here) locate();
        else render();
      });
      return el("label", { class: "h-route-field" }, el("span", { text: label }), s);
    };
    const num = (key, label, min, max, unit) => {
      const i = el("input", { type: "number", class: "h-input h-num-input", min, max, value: st[key], "aria-label": label });
      i.addEventListener("change", () => {
        st[key] = Math.max(min, Math.min(max, Number(i.value) || min));
        save();
        render();
      });
      return el("label", { class: "h-route-field" }, el("span", { text: label }), el("span", {}, i, unit ? el("small", { class: "h-muted", text: " " + unit }) : null));
    };
    const time = el("input", { type: "time", class: "h-input", value: st.startTime, "aria-label": "Başlangıç saati" });
    time.addEventListener("change", () => {
      st.startTime = time.value || "10:00";
      save();
      render();
    });
    const skip = el("input", { type: "checkbox", checked: st.skipRejected });
    skip.addEventListener("change", () => {
      st.skipRejected = skip.checked;
      save();
      render();
    });
    return el(
      "div",
      { class: "h-panel h-route-controls" },
      sel("source", sources(), "Liste"),
      sel("start", Object.entries(START_POINTS).map(([k, v]) => [k, v.label]), "Başlangıç"),
      sel("mode", [["drive", "🚗 Araçla"], ["transit", "🚌 Toplu taşımayla"]], "Ulaşım"),
      el("label", { class: "h-route-field" }, el("span", { text: "Başlangıç saati" }), time),
      num("visitMin", "Ev başına süre", 5, 120, "dk"),
      num("perDay", "Günde en fazla", 1, 20, "ev"),
      el("label", { class: "h-check" }, skip, "Elenen / kalkan ilanları alma")
    );
  }
  function locate() {
    if (!navigator.geolocation) return render();
    navigator.geolocation.getCurrentPosition(
      (p) => {
        here = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        render();
      },
      () => {
        H.toast("Konum alınamadı; Teknokent'ten başlatıldı");
        render();
      },
      { timeout: 8000 }
    );
  }

  function render() {
    clear(root);
    root.append(el("h1", { text: "🗺 Gezme rotası" }), controls());
    const ads = pickAds();
    if (!ads.length) {
      root.append(el("div", { class: "h-panel h-empty", text: "Bu listede gezilecek ilan yok. Favorilere ilan ekle, bir ilanı “Gezme planlandı” yap ya da arkadaşının favori linkini aç." }));
      return;
    }
    const pending = ensureDetails(ads);
    if (pending) {
      root.append(el("p", { class: "h-muted", text: "İlan bilgileri yükleniyor…" }));
      pending.then(render);
      return;
    }
    const startPt = startPoint();
    const days = plan(startPt, ads);
    const totalKm = days.reduce((s, d) => s + d.km, 0);
    const hasPhones = ads.some((a) => contactOf(a).phones.length);

    root.append(
      el(
        "div",
        { class: "h-stats h-route-summary" },
        el("div", { class: "h-stat" }, el("span", { text: "İlan" }), el("b", { text: ads.length })),
        el("div", { class: "h-stat" }, el("span", { text: "Gün" }), el("b", { text: days.length })),
        el("div", { class: "h-stat" }, el("span", { text: "Toplam yol (tahmini)" }), el("b", { text: `${H.num(Math.round(totalKm * 10) / 10)} km` })),
        el("div", { class: "h-stat" }, el("span", { text: "İlçeler" }), el("b", { text: [...new Set(ads.map((a) => a.district))].join(", ") }))
      ),
      el(
        "div",
        { class: "h-actions", style: "margin-bottom:14px" },
        el("button", {
          type: "button", class: "h-btn h-btn-primary", text: "📋 Planı metin olarak kopyala",
          onclick: () => {
            const text = planText(startPt, days);
            (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
              .then(() => H.toast("Plan kopyalandı; WhatsApp'a yapıştırabilirsin"))
              .catch(() => prompt("Planı kopyala:", text));
          },
        }),
        navigator.share
          ? el("button", { type: "button", class: "h-btn", text: "⤴ Paylaş", onclick: () => navigator.share({ title: "Gezme planı", text: planText(startPt, days) }).catch(() => {}) })
          : null,
        el("button", { type: "button", class: "h-btn", text: "🖨 Yazdır", onclick: () => window.print() }),
        el("button", {
          type: "button", class: "h-btn", text: "Hepsini “Gezme planlandı” yap",
          onclick: () => {
            ads.forEach((a) => H.notes(a.id).status === "new" || H.notes(a.id).status === "interested" ? H.patchNotes(a.id, { status: "visit_planned" }) : null);
            H.toast("Durumlar güncellendi");
            render();
          },
        })
      )
    );

    const mapBox = el("div", { class: "h-map h-route-map" });
    const left = el("div");
    root.append(el("div", { class: "h-grid-2 h-route-grid" }, left, el("div", {}, el("div", { class: "h-route-sticky" }, mapBox))));

    // Call list
    const calls = callList(days);
    const callPanel = el("section", { class: "h-panel" }, el("h2", { text: `📞 Aranacaklar (${calls.length})` }));
    if (!hasPhones)
      callPanel.append(el("p", { class: "h-note h-note-warn", text: "Telefon numaraları yüklenmedi (assets/house-renting/contacts.json yok). Numaraları eklemek için bilgisayarında: python bin/export_contacts.py \"<ham database klasörü>\" çalıştırıp dosyayı commit'le. O zamana kadar sahibinden mesaj / ilan linkleri gösteriliyor." }));
    else callPanel.append(el("p", { class: "h-hint", text: "Aynı kişi / emlakçıya ait ilanlar birlikte; tek aramada hepsi için randevu iste. Sıra numaraları rotadaki duraklardır." }));
    const ul = el("ul", { class: "h-calls" });
    for (const g of calls) {
      const first = g.stops[0];
      ul.append(
        el(
          "li",
          {},
          el("div", { class: "h-call-who" }, el("strong", { text: who(g.c) }), g.c.type === "individual" ? el("span", { class: "h-tag pro", text: "Sahibinden" }) : null),
          el("div", { class: "h-call-stops" }, g.stops.map((s) => el("a", { href: H.adPage(s.ad.id), class: "h-tag", title: s.ad.title, text: `#${s.no} ${s.ad.neighborhood || ""} · ${H.money(s.ad.price_value)}` }))),
          el("div", { class: "h-actions" }, phoneButtons(g.c, first.ad, false))
        )
      );
    }
    callPanel.append(ul);
    left.append(callPanel);

    // Days
    days.forEach((d, di) => {
      const sec = el("section", { class: "h-panel h-route-day", style: `--day:${DAY_COLORS[di % DAY_COLORS.length]}` });
      sec.append(
        el("div", { class: "h-route-day-head" },
          el("h2", { text: days.length > 1 ? `${di + 1}. gün` : "Rota" }),
          el("span", { class: "h-muted h-small", text: `${d.districts.join(" → ")} · ${d.stops.length} ev · ${st.startTime}–${H.minToHhmm(d.end % 1440)} · ~${H.num(Math.round(d.km * 10) / 10)} km` }),
          el("a", { class: "h-btn h-btn-small h-btn-primary", href: mapsUrl(startPt, d.stops), target: "_blank", rel: "noopener noreferrer", text: "Google Maps'te aç ↗" })
        )
      );
      if (d.stops.length > 10) sec.append(el("p", { class: "h-hint", text: "Google Maps en fazla 10 durak açar; günü bölmek için “Günde en fazla”yı azalt." }));
      const ol = el("ol", { class: "h-route-stops" });
      let lastDistrict = null, lastHood = null;
      for (const s of d.stops) {
        const a = s.ad, c = contactOf(a), n = H.notes(a.id);
        if (a.district !== lastDistrict || a.neighborhood !== lastHood) {
          ol.append(el("li", { class: "h-route-area", text: `📍 ${a.district} · ${a.neighborhood || ""}` }));
          lastDistrict = a.district;
          lastHood = a.neighborhood;
        }
        const statusSel = el("select", { class: "h-input h-route-status", "aria-label": "Durum" });
        for (const [k, label] of Object.entries(H.STATUS)) statusSel.append(el("option", { value: k, text: label, selected: k === n.status }));
        statusSel.addEventListener("change", () => H.patchNotes(a.id, { status: statusSel.value }));
        ol.append(
          el(
            "li",
            { class: "h-route-stop" },
            el("span", { class: "h-pin", text: s.no }),
            el(
              "div",
              { class: "h-route-body" },
              el("div", { class: "h-route-time" }, el("b", { text: `${H.minToHhmm(s.arrive % 1440)}–${H.minToHhmm(s.leave % 1440)}` }), el("span", { class: "h-muted h-small", text: ` · önceki duraktan ~${H.num(Math.round(s.km * 10) / 10)} km, ${s.travel} dk` })),
              el("a", { href: H.adPage(a.id), class: "h-rank-title", text: a.title }),
              el("div", { class: "h-muted h-small", text: [H.money(a.price_value), `${a.area_net_m2} m²`, `kat ${a.floor}/${a.floor_count}`, a.complex_name].filter(Boolean).join(" · ") }),
              el("div", { class: "h-small", text: "👤 " + who(c) }),
              el("div", { class: "h-actions" }, phoneButtons(c, a, true), el("a", { class: "h-btn h-btn-small", href: `https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`, target: "_blank", rel: "noopener noreferrer", text: "Yol tarifi" }), statusSel)
            )
          )
        );
      }
      sec.append(ol);
      left.append(sec);
    });
    left.append(el("p", { class: "h-hint", text: `Süreler tahminidir: yol ≈ kuş uçuşu × ${DETOUR}, ${st.mode === "drive" ? "araçla" : "toplu taşımayla"} ortalama ${SPEED[st.mode]} km/sa + durak başına ${HOP_BUFFER[st.mode]} dk. Aynı ilçe ve mahalledeki evler art arda gezilecek şekilde sıralandı. Konumlar ilan sahibinin işaretlediği yaklaşık noktalardır.` }));

    drawMap(mapBox, startPt, days);
  }

  function drawMap(box, startPt, days) {
    if (!window.L) return;
    requestAnimationFrame(() => {
      if (map) map.remove();
      map = L.map(box, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      H.addRailLayer(map, { control: false });
      layer = L.layerGroup().addTo(map);
      const pts = [[startPt.latitude, startPt.longitude]];
      L.marker(pts[0], { icon: L.divIcon({ className: "", html: '<div class="h-pin h-pin-start">S</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).bindTooltip("Başlangıç: " + startPt.label).addTo(layer);
      days.forEach((d, di) => {
        const color = DAY_COLORS[di % DAY_COLORS.length];
        const line = [[startPt.latitude, startPt.longitude]];
        for (const s of d.stops) {
          const ll = [s.ad.latitude, s.ad.longitude];
          line.push(ll);
          pts.push(ll);
          L.marker(ll, { icon: L.divIcon({ className: "", html: `<div class="h-pin" style="background:${color}">${s.no}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
            .bindTooltip(`#${s.no} ${s.ad.neighborhood || ""} · ${H.money(s.ad.price_value)}`)
            .addTo(layer);
        }
        L.polyline(line, { color, weight: 3, dashArray: "6 6", opacity: 0.85 }).addTo(layer);
      });
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    });
  }

  function planText(startPt, days) {
    const lines = ["🏠 Gezme planı", `Başlangıç: ${startPt.label} · ${st.mode === "drive" ? "araçla" : "toplu taşımayla"}`, ""];
    days.forEach((d, di) => {
      lines.push(days.length > 1 ? `— ${di + 1}. gün (${d.districts.join(" → ")}) —` : `— ${d.districts.join(" → ")} —`);
      for (const s of d.stops) {
        const c = contactOf(s.ad);
        const phone = c.phones.find((p) => p.tel);
        lines.push(`${s.no}. ${H.minToHhmm(s.arrive % 1440)} · ${s.ad.district}/${s.ad.neighborhood} · ${s.ad.complex_name ? s.ad.complex_name + " · " : ""}${H.money(s.ad.price_value)}`);
        lines.push(`   ${who(c)}${phone ? " · " + phone.number : ""}`);
        lines.push(`   ${sourceUrl(s.ad)}`);
        lines.push(`   Konum: https://www.google.com/maps/search/?api=1&query=${s.ad.latitude},${s.ad.longitude}`);
      }
      lines.push(`   Rota: ${mapsUrl(startPt, d.stops)}`, "");
    });
    return lines.join("\n");
  }

  document.addEventListener("house:notes", () => {
    /* statuses changed via the selects; keep the page as is */
  });
})();
