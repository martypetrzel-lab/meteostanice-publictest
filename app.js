const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";

const el = (id) => document.getElementById(id);
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };
const setValue = (id, val) => { const e = el(id); if (e) e.value = val; };

const fmt1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : "—");
const fmt0 = (x) => (Number.isFinite(x) ? Math.round(x) : "—");

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function getBackend() {
  const saved = localStorage.getItem("backendUrl");
  return (saved && saved.trim()) ? saved.trim().replace(/\/+$/, "") : DEFAULT_BACKEND;
}
function setBackend(url) {
  localStorage.setItem("backendUrl", url.trim().replace(/\/+$/, ""));
}

function riskClass(r) {
  if (r >= 70) return "bad";
  if (r >= 45) return "warn";
  return "ok";
}

function setChip(container, text, cls) {
  if (!container) return;
  const d = document.createElement("span");
  d.className = `chip ${cls || ""}`.trim();
  d.textContent = text;
  container.appendChild(d);
}

function toHHMM(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ---------------------------
   Timeline (B 3.26)
---------------------------- */
const TL_KEY = "timelineEvents_v1";
function loadTL() { try { return JSON.parse(localStorage.getItem(TL_KEY) || "[]"); } catch { return []; } }
function saveTL(arr) { localStorage.setItem(TL_KEY, JSON.stringify(arr.slice(-200))); }
function pushTL(type, title, body, meta = {}) {
  const now = Date.now();
  let arr = loadTL();
  const last = arr[arr.length - 1];
  if (last && last.type === type && (now - last.t) < 120000) return;
  arr.push({ t: now, type, title, body, meta });
  saveTL(arr);
}
function renderTL() {
  const box = el("timeline");
  if (!box) return;
  const arr = loadTL().slice(-30).reverse();
  if (!arr.length) { box.textContent = "—"; return; }
  box.innerHTML = "";
  for (const it of arr) {
    const d = document.createElement("div");
    d.className = "tItem";
    const time = new Date(it.t);
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    const ss = String(time.getSeconds()).padStart(2, "0");
    d.innerHTML = `
      <div class="tTop">
        <div class="tTitle">${escapeHtml(it.title)}</div>
        <div class="tTime">${hh}:${mm}:${ss}</div>
      </div>
      <div class="tBody">${escapeHtml(it.body || "")}</div>
    `;
    box.appendChild(d);
  }
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------------------
   Risk trend
---------------------------- */
function pushRiskPoint(risk) {
  const key = "riskSeries";
  const now = Date.now();
  const keepMs = 2 * 60 * 60 * 1000;
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch { arr = []; }
  arr.push({ t: now, r: risk });
  arr = arr.filter(p => (now - p.t) <= keepMs);
  const out = [];
  for (const p of arr) {
    const last = out[out.length - 1];
    if (!last || (p.t - last.t) >= 10_000) out.push(p);
  }
  localStorage.setItem(key, JSON.stringify(out));
  return out;
}

function drawRisk(canvas, series) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const y = (h * i) / 5;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (!series || series.length < 2) return;

  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const dt = Math.max(1, t1 - t0);

  const xOf = (t) => ((t - t0) / dt) * (w - 20) + 10;
  const yOf = (r) => (h - 18) - (clamp(r, 0, 100) / 100) * (h - 26);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7cc0ff";
  ctx.beginPath();
  ctx.moveTo(xOf(series[0].t), yOf(series[0].r));
  for (let i = 1; i < series.length; i++) ctx.lineTo(xOf(series[i].t), yOf(series[i].r));
  ctx.stroke();

  const last = series[series.length - 1];
  ctx.fillStyle = "#53e3a6";
  ctx.beginPath();
  ctx.arc(xOf(last.t), yOf(last.r), 4, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------------------
   Charts
---------------------------- */
let chartTemp = null;
let chartPower = null;
let chartLight = null;
let chartBrainRisk = null;
let chartWeekTemp = null;
let chartWeekEnergy = null;

function destroyChart(ch) { if (ch && typeof ch.destroy === "function") ch.destroy(); }

function normalizeSeries(dayObj, key) {
  const arr = Array.isArray(dayObj?.[key]) ? dayObj[key] : [];
  const labels = [];
  const data = [];
  for (const p of arr) {
    const t = (p && p.t !== undefined) ? String(p.t) : "";
    const v = Number(p?.v);
    labels.push(t);
    data.push(Number.isFinite(v) ? v : null);
  }
  return { labels, data };
}

function makeLineChart(canvasId, labels, datasets, yTitle = "") {
  const c = el(canvasId);
  if (!c || !window.Chart) return null;
  return new Chart(c, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#e9eefc" } } },
      scales: {
        x: { ticks: { color: "#9fb0d8", maxRotation: 0 }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9fb0d8" }, grid: { color: "rgba(255,255,255,.06)" },
             title: { display: !!yTitle, text: yTitle, color: "#9fb0d8" } }
      }
    }
  });
}

function alignTo(masterLabels, labels, data) {
  const map = new Map();
  for (let i = 0; i < labels.length; i++) map.set(String(labels[i]), data[i]);
  return masterLabels.map(l => map.has(String(l)) ? map.get(String(l)) : null);
}

function fillDaySelect(days) {
  const sel = el("daySelect");
  if (!sel) return;
  sel.innerHTML = "";
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const key = d?.key || d?.dayKey || d?.date || `den ${i + 1}`;
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = key;
    sel.appendChild(opt);
  }
}

function chooseDayIndex(days) {
  const key = "selectedDayIndex";
  const saved = Number(localStorage.getItem(key));
  if (Number.isFinite(saved) && saved >= 0 && saved < days.length) return saved;
  return Math.max(0, days.length - 1);
}
function setDayIndex(i) { localStorage.setItem("selectedDayIndex", String(i)); }

function pickNumber(obj, keys) {
  for (const k of keys) {
    const v = Number(obj?.[k]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/* ---------------------------
   Summary (Variant B)
---------------------------- */
function statsOf(arr) {
  const xs = arr.filter(v => Number.isFinite(v));
  if (!xs.length) return { n: 0, min: null, max: null, avg: null };
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (const v of xs) { mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; }
  return { n: xs.length, min: mn, max: mx, avg: sum / xs.length };
}

// Odhad Wh z časové řady W: integrace s prům. dt (sekundy)
function estimateWhFromWSeries(labels, watts) {
  // labels jsou "HH:MM:SS" → přepočítáme na sekundy od půlnoci
  const pts = [];
  for (let i = 0; i < labels.length; i++) {
    const t = parseHMS(labels[i]);
    const w = watts[i];
    if (t === null || !Number.isFinite(w)) continue;
    pts.push({ t, w });
  }
  if (pts.length < 2) return null;

  // trapezoid
  let wh = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(0, pts[i].t - pts[i - 1].t); // seconds
    const wAvg = (pts[i].w + pts[i - 1].w) / 2;
    wh += (wAvg * dt) / 3600; // W*s -> Wh
  }
  return wh;
}

function parseHMS(s) {
  // "15:43:18"
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || "").trim());
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]), ss = Number(m[3] ?? "0");
  if (![hh, mm, ss].every(Number.isFinite)) return null;
  return hh * 3600 + mm * 60 + ss;
}

function makeSummaryCards(containerId, items) {
  const box = el(containerId);
  if (!box) return;
  box.innerHTML = "";
  for (const it of items) {
    const d = document.createElement("div");
    d.className = "sCard";
    d.innerHTML = `<div class="sK">${escapeHtml(it.k)}</div><div class="sV">${escapeHtml(it.v)}</div>`;
    box.appendChild(d);
  }
}

function makeDailySentence(s) {
  // velmi "tiché" a lidské
  // rozhodnutí podle energie a rizik
  if (s.maxRisk !== null && s.maxRisk >= 70) return "Dnes to nebylo úplně klidné – mozek musel hlídat rizika.";
  if (s.netWh !== null && s.netWh > 0.5) return "Pěkný den – energie spíš přibývala a data se sbírala v pohodě.";
  if (s.netWh !== null && s.netWh < -0.5) return "Energie spíš ubývala, takže mozek hrál bezpečněji.";
  if (s.thunderCount > 0) return "Během dne se objevily bouřkové podmínky, sběr byl opatrnější.";
  return "Běžný den – průběžně sleduju energii a podmínky.";
}

function renderDailySummary(day) {
  // série
  const sTemp = normalizeSeries(day, "temperature");
  const sIn = normalizeSeries(day, "energyIn");
  const sOut = normalizeSeries(day, "energyOut");
  const sLight = normalizeSeries(day, "light");
  const sRisk = normalizeSeries(day, "risk");

  const stT = statsOf(sTemp.data);
  const stL = statsOf(sLight.data);
  const stR = statsOf(sRisk.data);

  // energie Wh: preferuj backend totals, jinak odhad z W řad
  let inWh = pickNumber(day, ["energyInWh", "solarWh", "inWh", "dayInWh"]);
  let outWh = pickNumber(day, ["energyOutWh", "loadWh", "outWh", "dayOutWh"]);
  const ti = pickNumber(day?.totals, ["energyInWh", "solarWh", "inWh"]);
  const to = pickNumber(day?.totals, ["energyOutWh", "loadWh", "outWh"]);
  if (!Number.isFinite(inWh) && Number.isFinite(ti)) inWh = ti;
  if (!Number.isFinite(outWh) && Number.isFinite(to)) outWh = to;

  if (!Number.isFinite(inWh)) inWh = estimateWhFromWSeries(sIn.labels, sIn.data);
  if (!Number.isFinite(outWh)) outWh = estimateWhFromWSeries(sOut.labels, sOut.data);

  const netWh = (Number.isFinite(inWh) && Number.isFinite(outWh)) ? (inWh - outWh) : null;

  // události (pokud backend někde loguje eventy do dne; když ne, necháme 0)
  const thunderCount = Number.isFinite(day?.thunderCount) ? day.thunderCount : 0;

  const headline = [];
  if (stT.min !== null && stT.max !== null) headline.push(`Teplota ${fmt1(stT.min)} → ${fmt1(stT.max)} °C`);
  if (Number.isFinite(inWh)) headline.push(`Solár ~${fmt1(inWh)} Wh`);
  if (Number.isFinite(outWh)) headline.push(`Zátěž ~${fmt1(outWh)} Wh`);
  if (netWh !== null) headline.push(`Bilance ${netWh >= 0 ? "+" : ""}${fmt1(netWh)} Wh`);

  setText("daySummaryHeadline", headline.length ? headline.join(" • ") : "—");

  makeSummaryCards("daySummaryGrid", [
    { k: "Vzorků teploty", v: stT.n ? String(stT.n) : "—" },
    { k: "Min/Max teplota", v: (stT.min !== null) ? `${fmt1(stT.min)} / ${fmt1(stT.max)} °C` : "—" },
    { k: "Průměr teploty", v: (stT.avg !== null) ? `${fmt1(stT.avg)} °C` : "—" },
    { k: "Světlo max", v: (stL.max !== null) ? `${fmt0(stL.max)} lx` : "—" },

    { k: "Energie IN", v: Number.isFinite(inWh) ? `${fmt1(inWh)} Wh` : "—" },
    { k: "Energie OUT", v: Number.isFinite(outWh) ? `${fmt1(outWh)} Wh` : "—" },
    { k: "Bilance", v: (netWh !== null) ? `${netWh >= 0 ? "+" : ""}${fmt1(netWh)} Wh` : "—" },
    { k: "Max riziko", v: (stR.max !== null) ? `${fmt0(stR.max)}/100` : "—" },
  ]);

  const noteObj = {
    maxRisk: stR.max,
    netWh,
    thunderCount
  };
  setText("daySummaryNote", makeDailySentence(noteObj));
}

function renderWeeklySummary(days) {
  // po 7 dnech
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // souhrn: nejnižší/nejvyšší teplota napříč týdny + energie
  let globalMin = Infinity, globalMax = -Infinity;
  let sumIn = 0, sumOut = 0;
  let okIn = false, okOut = false;

  for (const w of weeks) {
    for (const d of w) {
      const tArr = Array.isArray(d?.temperature) ? d.temperature : [];
      for (const p of tArr) {
        const v = Number(p?.v);
        if (!Number.isFinite(v)) continue;
        globalMin = Math.min(globalMin, v);
        globalMax = Math.max(globalMax, v);
      }

      let inWh = pickNumber(d, ["energyInWh","solarWh","inWh","dayInWh"]);
      let outWh = pickNumber(d, ["energyOutWh","loadWh","outWh","dayOutWh"]);
      const ti = pickNumber(d?.totals, ["energyInWh","solarWh","inWh"]);
      const to = pickNumber(d?.totals, ["energyOutWh","loadWh","outWh"]);
      if (!Number.isFinite(inWh) && Number.isFinite(ti)) inWh = ti;
      if (!Number.isFinite(outWh) && Number.isFinite(to)) outWh = to;

      if (!Number.isFinite(inWh)) {
        const sIn = normalizeSeries(d, "energyIn");
        inWh = estimateWhFromWSeries(sIn.labels, sIn.data);
      }
      if (!Number.isFinite(outWh)) {
        const sOut = normalizeSeries(d, "energyOut");
        outWh = estimateWhFromWSeries(sOut.labels, sOut.data);
      }

      if (Number.isFinite(inWh)) { sumIn += inWh; okIn = true; }
      if (Number.isFinite(outWh)) { sumOut += outWh; okOut = true; }
    }
  }

  const net = (okIn && okOut) ? (sumIn - sumOut) : null;

  const headline = [];
  if (Number.isFinite(globalMin) && Number.isFinite(globalMax)) headline.push(`Rozsah teplot: ${fmt1(globalMin)} → ${fmt1(globalMax)} °C`);
  if (okIn) headline.push(`Solár ~${fmt1(sumIn)} Wh`);
  if (okOut) headline.push(`Zátěž ~${fmt1(sumOut)} Wh`);
  if (net !== null) headline.push(`Bilance ${net >= 0 ? "+" : ""}${fmt1(net)} Wh`);

  setText("weekSummaryHeadline", headline.length ? headline.join(" • ") : "—");

  makeSummaryCards("weekSummaryGrid", [
    { k: "Počet dní", v: String(days.length) },
    { k: "Min/Max teplota", v: (Number.isFinite(globalMin) ? `${fmt1(globalMin)} / ${fmt1(globalMax)} °C` : "—") },
    { k: "Energie IN", v: okIn ? `${fmt1(sumIn)} Wh` : "—" },
    { k: "Energie OUT", v: okOut ? `${fmt1(sumOut)} Wh` : "—" },
    { k: "Bilance", v: (net !== null) ? `${net >= 0 ? "+" : ""}${fmt1(net)} Wh` : "—" },
    { k: "Týdny", v: String(Math.ceil(days.length / 7)) }
  ]);
}

/* ---------------------------
   History charts + weekly charts
---------------------------- */
function renderWeeklyCharts(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const labels = weeks.map((w, wi) => {
    const first = w[0]?.key || `týden ${wi + 1}`;
    return `T${wi + 1} (${first})`;
  });

  const minT = [];
  const maxT = [];
  for (const w of weeks) {
    let mn = Infinity, mx = -Infinity;
    for (const d of w) {
      const arr = Array.isArray(d?.temperature) ? d.temperature : [];
      for (const p of arr) {
        const v = Number(p?.v);
        if (!Number.isFinite(v)) continue;
        mn = Math.min(mn, v);
        mx = Math.max(mx, v);
      }
    }
    minT.push(Number.isFinite(mn) ? mn : null);
    maxT.push(Number.isFinite(mx) ? mx : null);
  }

  destroyChart(chartWeekTemp);
  chartWeekTemp = makeLineChart(
    "chartWeekTemp",
    labels,
    [
      { label: "Min (°C)", data: minT, tension: 0.25, pointRadius: 0 },
      { label: "Max (°C)", data: maxT, tension: 0.25, pointRadius: 0 }
    ],
    "°C"
  );

  // Energie týdně: prefer Wh, jinak odhad
  const inWh = [];
  const outWh = [];

  for (const w of weeks) {
    let sumIn = 0, sumOut = 0, okIn = false, okOut = false;

    for (const d of w) {
      let di = pickNumber(d, ["energyInWh","solarWh","inWh","dayInWh"]);
      let do_ = pickNumber(d, ["energyOutWh","loadWh","outWh","dayOutWh"]);

      const ti = pickNumber(d?.totals, ["energyInWh","solarWh","inWh"]);
      const to = pickNumber(d?.totals, ["energyOutWh","loadWh","outWh"]);
      if (!Number.isFinite(di) && Number.isFinite(ti)) di = ti;
      if (!Number.isFinite(do_) && Number.isFinite(to)) do_ = to;

      if (!Number.isFinite(di)) {
        const sIn = normalizeSeries(d, "energyIn");
        di = estimateWhFromWSeries(sIn.labels, sIn.data);
      }
      if (!Number.isFinite(do_)) {
        const sOut = normalizeSeries(d, "energyOut");
        do_ = estimateWhFromWSeries(sOut.labels, sOut.data);
      }

      if (Number.isFinite(di)) { sumIn += di; okIn = true; }
      if (Number.isFinite(do_)) { sumOut += do_; okOut = true; }
    }

    inWh.push(okIn ? sumIn : null);
    outWh.push(okOut ? sumOut : null);
  }

  destroyChart(chartWeekEnergy);
  chartWeekEnergy = makeLineChart(
    "chartWeekEnergy",
    labels,
    [
      { label: "Energie IN (Wh)", data: inWh, tension: 0.25, pointRadius: 0 },
      { label: "Energie OUT (Wh)", data: outWh, tension: 0.25, pointRadius: 0 }
    ],
    "Wh"
  );

  // Weekly summary (B)
  renderWeeklySummary(days);
}

function renderHistoryCharts(state) {
  const days = Array.isArray(state?.memory?.days) ? state.memory.days : [];
  if (!days.length) {
    setText("dayInfo", "Žádná historie v memory.days");
    return;
  }

  fillDaySelect(days);
  let idx = chooseDayIndex(days);
  const sel = el("daySelect");
  if (sel) sel.value = String(idx);

  const day = days[idx] || {};
  const dayKey = day?.key || day?.dayKey || day?.date || `den ${idx + 1}`;

  const sTemp = normalizeSeries(day, "temperature");
  const sIn = normalizeSeries(day, "energyIn");
  const sOut = normalizeSeries(day, "energyOut");
  const sLight = normalizeSeries(day, "light");
  const sRisk = normalizeSeries(day, "risk");

  setText("dayInfo", `Vybráno: ${dayKey} • vzorků T:${sTemp.data.filter(v=>v!==null).length}  S:${sIn.data.filter(v=>v!==null).length}  Z:${sOut.data.filter(v=>v!==null).length}`);

  destroyChart(chartTemp); destroyChart(chartPower); destroyChart(chartLight); destroyChart(chartBrainRisk);

  chartTemp = makeLineChart(
    "chartTemp",
    sTemp.labels,
    [{ label: "Teplota (°C)", data: sTemp.data, tension: 0.25, pointRadius: 0 }],
    "°C"
  );

  const labelsPower = (sIn.labels.length >= sOut.labels.length) ? sIn.labels : sOut.labels;
  chartPower = makeLineChart(
    "chartPower",
    labelsPower,
    [
      { label: "Solár (W)", data: alignTo(labelsPower, sIn.labels, sIn.data), tension: 0.25, pointRadius: 0 },
      { label: "Zátěž (W)", data: alignTo(labelsPower, sOut.labels, sOut.data), tension: 0.25, pointRadius: 0 }
    ],
    "W"
  );

  chartLight = makeLineChart(
    "chartLight",
    sLight.labels,
    [{ label: "Světlo (lx)", data: sLight.data, tension: 0.25, pointRadius: 0 }],
    "lx"
  );

  chartBrainRisk = makeLineChart(
    "chartBrainRisk",
    sRisk.labels,
    [{ label: "Riziko (0–100)", data: sRisk.data, tension: 0.25, pointRadius: 0 }],
    "risk"
  );

  // Daily summary (B)
  renderDailySummary(day);

  // Weekly charts + summary
  renderWeeklyCharts(days);

  currentDayIndex = idx;
}

/* ---------------------------
   Export (B 3.27)
---------------------------- */
function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportJSON(filename, obj) { downloadText(filename, JSON.stringify(obj, null, 2), "application/json"); }

function csvFromSeries(labels, cols) {
  const esc = (s) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  const header = ["t", ...cols.map(c => c.name)].map(esc).join(",");
  const lines = [header];
  for (let i = 0; i < labels.length; i++) {
    const row = [labels[i], ...cols.map(c => c.data[i] ?? "")].map(esc).join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

let lastState = null;
let currentDayIndex = 0;

function safeName(day) {
  const key = day?.key || day?.dayKey || day?.date || `day_${currentDayIndex + 1}`;
  return String(key).replaceAll(":", "-").replaceAll(" ", "_");
}

function wireExports() {
  const btnState = el("btnExportState");
  const btnMem = el("btnExportMemory");
  const btnCSVTemp = el("btnExportCSVTemp");
  const btnCSVPower = el("btnExportCSVPower");
  const btnCSVLight = el("btnExportCSVLight");

  if (btnState) btnState.onclick = () => { if (lastState) exportJSON(`meteostanice_state_${Date.now()}.json`, lastState); };
  if (btnMem) btnMem.onclick = () => { exportJSON(`meteostanice_memory_days_${Date.now()}.json`, lastState?.memory?.days ?? []); };

  if (btnCSVTemp) btnCSVTemp.onclick = () => {
    const day = (lastState?.memory?.days ?? [])[currentDayIndex] || {};
    const s = normalizeSeries(day, "temperature");
    const csv = csvFromSeries(s.labels, [{ name: "temperatureC", data: s.data }]);
    downloadText(`day_temperature_${safeName(day)}.csv`, csv, "text/csv");
  };

  if (btnCSVPower) btnCSVPower.onclick = () => {
    const day = (lastState?.memory?.days ?? [])[currentDayIndex] || {};
    const sIn = normalizeSeries(day, "energyIn");
    const sOut = normalizeSeries(day, "energyOut");
    const labels = (sIn.labels.length >= sOut.labels.length) ? sIn.labels : sOut.labels;
    const csv = csvFromSeries(labels, [
      { name: "solarW", data: alignTo(labels, sIn.labels, sIn.data) },
      { name: "loadW", data: alignTo(labels, sOut.labels, sOut.data) }
    ]);
    downloadText(`day_power_${safeName(day)}.csv`, csv, "text/csv");
  };

  if (btnCSVLight) btnCSVLight.onclick = () => {
    const day = (lastState?.memory?.days ?? [])[currentDayIndex] || {};
    const s = normalizeSeries(day, "light");
    const csv = csvFromSeries(s.labels, [{ name: "lightLux", data: s.data }]);
    downloadText(`day_light_${safeName(day)}.csv`, csv, "text/csv");
  };
}

/* ---------------------------
   UI render
---------------------------- */
function setModeBadge(badgeEl, mode, risk) {
  if (!badgeEl) return;
  badgeEl.textContent = mode || "—";
  const cls = riskClass(risk);
  badgeEl.style.borderColor =
    cls === "bad" ? "rgba(255,92,124,.45)" :
    cls === "warn" ? "rgba(255,209,102,.45)" :
    "rgba(83,227,166,.45)";
  badgeEl.style.background =
    cls === "bad" ? "rgba(255,92,124,.10)" :
    cls === "warn" ? "rgba(255,209,102,.10)" :
    "rgba(83,227,166,.10)";
}

function render(state) {
  lastState = state;
  const backend = getBackend();
  setHref("stateLink", `${backend}/state`);

  const env = state?.world?.environment || {};
  const light = env.light ?? state?.environment?.light;
  const temp = env.airTempC ?? env.temperature ?? state?.environment?.temperature;
  const hum = env.humidity ?? state?.environment?.humidity;
  const boxT = env.boxTempC;

  setText("uiLight", fmt0(light));
  setText("uiTemp", fmt1(temp));
  setText("uiHum", fmt0(hum));
  setText("uiBoxTemp", boxT === undefined ? "—" : fmt1(Number(boxT)));

  const soc = state?.brain?.battery?.socPercent ?? state?.device?.battery?.soc ?? state?.device?.battery ?? null;
  const solar = state?.device?.power?.solarInW ?? env.solarPotentialW ?? null;
  const load = state?.device?.power?.loadW ?? null;
  const fan = state?.device?.fan;

  setText("uiSoc", (soc === null || soc === undefined) ? "—" : fmt0(Number(soc)));
  setText("uiSolar", fmt1(Number(solar)));
  setText("uiLoad", fmt1(Number(load)));
  setText("uiFan", (fan === true) ? "ON" : (fan === false) ? "OFF" : "—");

  setText("uiSolar2", fmt1(Number(solar)));
  setText("uiSoc2", (soc === null || soc === undefined) ? "—" : fmt0(Number(soc)));
  setText("uiLoad2", fmt1(Number(load)));

  setText("uiMsg", state?.message || "—");
  const det = Array.isArray(state?.details) ? state.details.join(" • ") : (state?.details || "—");
  setText("uiDetails", det || "—");

  // weather chips
  const wc = el("uiWeatherChips");
  if (wc) {
    wc.innerHTML = "";
    if (env.summary?.sky) setChip(wc, env.summary.sky, "ok");
    if (env.summary?.precip) setChip(wc, env.summary.precip, (env.raining || env.snowing) ? "warn" : "ok");
    if (env.summary?.wind) setChip(wc, `vítr: ${env.summary.wind}`, (env.windMs >= 12) ? "warn" : "ok");
    if (env.thunder) setChip(wc, "bouřka", "bad");
    if (env.events?.fog) setChip(wc, "mlha", "warn");
    if (env.events?.gust) setChip(wc, "nárazy", "warn");
  }

  const brain = state?.brain || {};
  const risk = Number.isFinite(brain?.risk) ? brain.risk : null;
  const mode = brain?.mode || "—";
  setText("uiRisk", (risk === null) ? "—" : String(risk));

  const rf = el("uiRiskBar");
  if (rf) {
    rf.style.width = `${clamp(risk ?? 0, 0, 100)}%`;
    const rc = riskClass(risk ?? 0);
    rf.style.background =
      rc === "bad" ? "linear-gradient(90deg, rgba(255,92,124,.95), rgba(255,209,102,.65))" :
      rc === "warn" ? "linear-gradient(90deg, rgba(255,209,102,.95), rgba(124,192,255,.65))" :
      "linear-gradient(90deg, rgba(83,227,166,.95), rgba(124,192,255,.75))";
  }
  setModeBadge(el("uiModeBadge"), mode, risk ?? 0);

  const bh = brain?.battery?.hours;
  setText("uiBatHours", (bh === null || bh === undefined) ? "—" : fmt1(Number(bh)));
  setText("uiBatHours2", (bh === null || bh === undefined) ? "—" : fmt1(Number(bh)));
  setText("uiBatHint", (soc === null || soc === undefined) ? "—" : `SOC ${fmt0(Number(soc))} %`);

  const sun = env.sun || {};
  const sunset = sun.sunsetTs ? toHHMM(sun.sunsetTs) : null;
  const sunrise = sun.sunriseTs ? toHHMM(sun.sunriseTs) : null;
  const dayMin = Number.isFinite(sun.daylightMin) ? sun.daylightMin : null;

  const hToSunset = brain?.time?.hoursToSunset;
  const hToSunrise = brain?.time?.hoursToSunrise;

  setText("uiSunLine", (sunrise && sunset) ? `🌅 ${sunrise}  •  🌇 ${sunset}` : "—");
  const sunBits = [];
  if (Number.isFinite(hToSunset)) sunBits.push(`do západu ${fmt1(hToSunset)} h`);
  if (Number.isFinite(hToSunrise)) sunBits.push(`do východu ${fmt1(hToSunrise)} h`);
  if (dayMin !== null) sunBits.push(`den ${fmt0(dayMin)} min`);
  setText("uiSunHint", sunBits.length ? sunBits.join(" • ") : "—");

  // brain chips
  const bc = el("uiBrainChips");
  if (bc) {
    bc.innerHTML = "";
    if (risk !== null) setChip(bc, `riziko ${risk}/100`, riskClass(risk));
    if (brain?.sampling) setChip(bc, `sampling: ${brain.sampling}`, (brain.sampling === "LOW") ? "warn" : "ok");
    if (brain?.solar?.untilSunsetWh !== null && brain?.solar?.untilSunsetWh !== undefined) {
      setChip(bc, `do západu ~${fmt1(Number(brain.solar.untilSunsetWh))} Wh`, "ok");
    }
    if (env.boxTempC !== undefined) {
      const bt = Number(env.boxTempC);
      setChip(bc, `box ${fmt1(bt)} °C`, (bt >= 45 || bt <= -10) ? "warn" : "ok");
    }
    if (env.thunder) setChip(bc, "bouřka", "bad");
    if (env.events?.storm) setChip(bc, "storm event", "bad");
    if (env.events?.gust) setChip(bc, "nárazy větru", "warn");
    if (env.events?.fog) setChip(bc, "mlha", "warn");
    if (env.snowing) setChip(bc, "sněžení", "warn");
  }

  if (risk !== null) {
    const series = pushRiskPoint(risk);
    drawRisk(el("riskCanvas"), series);
  }

  // timeline
  if (mode && mode !== "—") pushTL("mode", "Režim mozku", `Aktuálně: ${mode}`);
  if (env.thunder || env.events?.storm) pushTL("storm", "Bouřka / storm", "Zaznamenána bouřková aktivita.");
  if (env.events?.fog) pushTL("fog", "Mlha", "Zhoršená viditelnost (mlha).");
  if (env.events?.gust) pushTL("gust", "Nárazy větru", `Vítr: ${fmt1(Number(env.windMs ?? 0))} m/s`);
  if (env.snowing) pushTL("snow", "Sněžení", `Sníh: ${fmt1(Number(env.snowDepthCm ?? 0))} cm`);
  renderTL();

  // history charts + summaries
  renderHistoryCharts(state);

  setText("statusText", "Dashboard • OK");
}

/* ---------------------------
   Fetch loop
---------------------------- */
async function fetchState() {
  const backend = getBackend();
  const url = `${backend}/state`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

let timer = null;
let intervalMs = Number(localStorage.getItem("refreshInterval") || "1000");

function startLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    try {
      const s = await fetchState();
      render(s);
      const raw = el("rawJson");
      if (raw && !raw.classList.contains("hidden")) raw.textContent = JSON.stringify(s, null, 2);
    } catch (e) {
      setText("statusText", `Dashboard • chyba: ${e.message}`);
    }
  }, intervalMs);
}

/* ---------------------------
   Tabs + Settings + History controls
---------------------------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.getAttribute("data-tab");
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      const panel = el(`tab-${name}`);
      if (panel) panel.classList.add("active");
    });
  });
}

function setupSettings() {
  const backendInput = el("backendUrl");
  if (backendInput) backendInput.value = getBackend();

  const btnSave = el("btnSave");
  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const v = backendInput ? backendInput.value : getBackend();
      setBackend(v);
      setText("healthOut", "Uloženo");
      startLoop();
    });
  }

  const btnTest = el("btnTest");
  if (btnTest) {
    btnTest.addEventListener("click", async () => {
      const backend = (backendInput ? backendInput.value : getBackend()).trim().replace(/\/+$/, "");
      if (!backend) return;
      try {
        const res = await fetch(`${backend}/health`, { cache: "no-store" });
        setText("healthOut", res.ok ? "OK" : `HTTP ${res.status}`);
      } catch (e) {
        setText("healthOut", `chyba: ${e.message}`);
      }
    });
  }

  document.querySelectorAll(".chipBtn").forEach(b => {
    b.addEventListener("click", () => {
      intervalMs = Number(b.getAttribute("data-interval"));
      localStorage.setItem("refreshInterval", String(intervalMs));
      startLoop();
    });
  });

  const chk = el("chkRaw");
  const raw = el("rawJson");
  if (chk && raw) chk.addEventListener("change", () => raw.classList.toggle("hidden", !chk.checked));
}

function setupHistoryControls() {
  const sel = el("daySelect");
  const prev = el("btnDayPrev");
  const next = el("btnDayNext");

  if (sel) {
    sel.addEventListener("change", () => {
      const idx = Number(sel.value);
      if (Number.isFinite(idx)) {
        setDayIndex(idx);
        currentDayIndex = idx;
        if (lastState) renderHistoryCharts(lastState);
      }
    });
  }

  if (prev) prev.addEventListener("click", () => {
    if (!lastState?.memory?.days?.length) return;
    let idx = chooseDayIndex(lastState.memory.days);
    idx = Math.max(0, idx - 1);
    setDayIndex(idx);
    currentDayIndex = idx;
    if (sel) sel.value = String(idx);
    renderHistoryCharts(lastState);
  });

  if (next) next.addEventListener("click", () => {
    if (!lastState?.memory?.days?.length) return;
    let idx = chooseDayIndex(lastState.memory.days);
    idx = Math.min(lastState.memory.days.length - 1, idx + 1);
    setDayIndex(idx);
    currentDayIndex = idx;
    if (sel) sel.value = String(idx);
    renderHistoryCharts(lastState);
  });
}

function wireExports() {
  // už definováno výš, voláme jen kvůli pořadí
  // (funkce zůstává v souboru)
}

(async function boot() {
  setupTabs();
  setupSettings();
  setupHistoryControls();
  wireExports();

  try {
    const s = await fetchState();
    render(s);
  } catch (e) {
    setText("statusText", `Dashboard • chyba: ${e.message}`);
  }
  startLoop();
})();
