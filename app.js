const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";

const el = (id) => document.getElementById(id);
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };

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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function riskClass(r) {
  if (r >= 70) return "bad";
  if (r >= 45) return "warn";
  return "ok";
}

function toHHMM(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ---------------------------
   Timeline
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

/* ---------------------------
   Risk trend (lokální)
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
   Charts (FIX: ruční sizing canvas, responsive OFF)
---------------------------- */
let chartTemp = null;
let chartPower = null;
let chartLight = null;
let chartBrainRisk = null;
let chartWeekTemp = null;
let chartWeekEnergy = null;

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

function setCanvasSize(canvas) {
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;

  // Chart.js si bere velikost z width/height atributů když responsive:false
  const w = Math.max(50, parent.clientWidth);
  const h = Math.max(120, parent.clientHeight || 320);

  // nastav jen když se liší (aby to neházelo layout sem a tam)
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

function makeLineChart(canvasId, labels, datasets, yTitle = "") {
  const c = el(canvasId);
  if (!c || !window.Chart) return null;

  // ✅ důležité: fixni velikost ještě před vytvořením grafu
  setCanvasSize(c);

  return new Chart(c, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: false,          // ✅ hlavní fix: žádné resize při scrollu
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#e9eefc" } } },
      scales: {
        x: { ticks: { color: "#9fb0d8", maxRotation: 0 }, grid: { color: "rgba(255,255,255,.06)" } },
        y: {
          ticks: { color: "#9fb0d8" },
          grid: { color: "rgba(255,255,255,.06)" },
          title: { display: !!yTitle, text: yTitle, color: "#9fb0d8" }
        }
      }
    }
  });
}

function updateLineChart(chart, labels, datasets) {
  if (!chart) return;

  // ✅ udrž velikost stabilní
  setCanvasSize(chart.canvas);

  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update("none");
}

function resizeAllCharts() {
  const charts = [chartTemp, chartPower, chartLight, chartBrainRisk, chartWeekTemp, chartWeekEnergy].filter(Boolean);
  for (const ch of charts) {
    setCanvasSize(ch.canvas);
    ch.resize();
    ch.update("none");
  }
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

window.addEventListener("resize", debounce(() => {
  // resize jen když už grafy existují
  resizeAllCharts();
}, 150));

function alignTo(masterLabels, labels, data) {
  const map = new Map();
  for (let i = 0; i < labels.length; i++) map.set(String(labels[i]), data[i]);
  return masterLabels.map(l => map.has(String(l)) ? map.get(String(l)) : null);
}

function fillDaySelect(days) {
  const sel = el("daySelect");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const key = d?.key || d?.dayKey || d?.date || `den ${i + 1}`;
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = key;
    sel.appendChild(opt);
  }
  if (prev !== "" && Number(prev) < days.length) sel.value = prev;
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

function parseHMS(s) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || "").trim());
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]), ss = Number(m[3] ?? "0");
  if (![hh, mm, ss].every(Number.isFinite)) return null;
  return hh * 3600 + mm * 60 + ss;
}

function estimateWhFromWSeries(labels, watts) {
  const pts = [];
  for (let i = 0; i < labels.length; i++) {
    const t = parseHMS(labels[i]);
    const w = watts[i];
    if (t === null || !Number.isFinite(w)) continue;
    pts.push({ t, w });
  }
  if (pts.length < 2) return null;

  let wh = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(0, pts[i].t - pts[i - 1].t);
    const wAvg = (pts[i].w + pts[i - 1].w) / 2;
    wh += (wAvg * dt) / 3600;
  }
  return wh;
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
  if (s.maxRisk !== null && s.maxRisk >= 70) return "Dnes to nebylo úplně klidné – hlídal jsem rizika a šetřil energii.";
  if (s.netWh !== null && s.netWh > 0.5) return "Pěkný den – energie spíš přibývala a sběr běžel v pohodě.";
  if (s.netWh !== null && s.netWh < -0.5) return "Energie spíš ubývala, tak jsem hrál bezpečněji.";
  if (s.thunderCount > 0) return "Objevily se bouřkové podmínky, sběr byl opatrnější.";
  return "Běžný den – průběžně sleduju energii a podmínky.";
}

function renderDailySummary(day) {
  const sTemp = normalizeSeries(day, "temperature");
  const sIn = normalizeSeries(day, "energyIn");
  const sOut = normalizeSeries(day, "energyOut");
  const sLight = normalizeSeries(day, "light");
  const sRisk = normalizeSeries(day, "risk");

  const stT = statsOf(sTemp.data);
  const stL = statsOf(sLight.data);
  const stR = statsOf(sRisk.data);

  let inWh = pickNumber(day, ["energyInWh", "solarWh", "inWh", "dayInWh"]);
  let outWh = pickNumber(day, ["energyOutWh", "loadWh", "outWh", "dayOutWh"]);
  const ti = pickNumber(day?.totals, ["energyInWh", "solarWh", "inWh"]);
  const to = pickNumber(day?.totals, ["energyOutWh", "loadWh", "outWh"]);
  if (!Number.isFinite(inWh) && Number.isFinite(ti)) inWh = ti;
  if (!Number.isFinite(outWh) && Number.isFinite(to)) outWh = to;

  if (!Number.isFinite(inWh)) inWh = estimateWhFromWSeries(sIn.labels, sIn.data);
  if (!Number.isFinite(outWh)) outWh = estimateWhFromWSeries(sOut.labels, sOut.data);

  const netWh = (Number.isFinite(inWh) && Number.isFinite(outWh)) ? (inWh - outWh) : null;
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

  setText("daySummaryNote", makeDailySentence({ maxRisk: stR.max, netWh, thunderCount }));
}

function renderWeeklySummary(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

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
   History: render jen když je potřeba
---------------------------- */
let lastState = null;
let currentDayIndex = 0;

let lastHistorySignature = "";
let lastHistoryDayIndex = -1;
let historyChartsInitialized = false;

function isHistoryTabActive() {
  const btn = document.querySelector(".tab.active");
  return btn?.getAttribute("data-tab") === "history";
}

function historySignatureFromState(state) {
  const days = Array.isArray(state?.memory?.days) ? state.memory.days : [];
  if (!days.length) return "0";
  const last = days[days.length - 1];
  const lastKey = last?.key || last?.dayKey || last?.date || "";
  const lastLenT = Array.isArray(last?.temperature) ? last.temperature.length : 0;
  const lastLenIn = Array.isArray(last?.energyIn) ? last.energyIn.length : 0;
  const lastLenOut = Array.isArray(last?.energyOut) ? last.energyOut.length : 0;
  const lastLenL = Array.isArray(last?.light) ? last.light.length : 0;
  return `${days.length}|${lastKey}|${lastLenT}|${lastLenIn}|${lastLenOut}|${lastLenL}`;
}

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

  if (!chartWeekTemp) {
    chartWeekTemp = makeLineChart(
      "chartWeekTemp",
      labels,
      [
        { label: "Min (°C)", data: minT, tension: 0.25, pointRadius: 0 },
        { label: "Max (°C)", data: maxT, tension: 0.25, pointRadius: 0 }
      ],
      "°C"
    );
  } else {
    updateLineChart(chartWeekTemp, labels, [
      { label: "Min (°C)", data: minT, tension: 0.25, pointRadius: 0 },
      { label: "Max (°C)", data: maxT, tension: 0.25, pointRadius: 0 }
    ]);
  }

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

  if (!chartWeekEnergy) {
    chartWeekEnergy = makeLineChart(
      "chartWeekEnergy",
      labels,
      [
        { label: "Energie IN (Wh)", data: inWh, tension: 0.25, pointRadius: 0 },
        { label: "Energie OUT (Wh)", data: outWh, tension: 0.25, pointRadius: 0 }
      ],
      "Wh"
    );
  } else {
    updateLineChart(chartWeekEnergy, labels, [
      { label: "Energie IN (Wh)", data: inWh, tension: 0.25, pointRadius: 0 },
      { label: "Energie OUT (Wh)", data: outWh, tension: 0.25, pointRadius: 0 }
    ]);
  }

  renderWeeklySummary(days);
}

function renderHistoryCharts(state) {
  const days = Array.isArray(state?.memory?.days) ? state.memory.days : [];
  if (!days.length) {
    setText("dayInfo", "Žádná historie v memory.days");
    return;
  }

  fillDaySelect(days);

  const sel = el("daySelect");
  let idx = chooseDayIndex(days);
  if (sel) idx = Number(sel.value || idx);
  if (!Number.isFinite(idx) || idx < 0 || idx >= days.length) idx = chooseDayIndex(days);

  const day = days[idx] || {};
  const dayKey = day?.key || day?.dayKey || day?.date || `den ${idx + 1}`;

  const sTemp = normalizeSeries(day, "temperature");
  const sIn = normalizeSeries(day, "energyIn");
  const sOut = normalizeSeries(day, "energyOut");
  const sLight = normalizeSeries(day, "light");
  const sRisk = normalizeSeries(day, "risk");

  setText("dayInfo", `Vybráno: ${dayKey} • vzorků T:${sTemp.data.filter(v=>v!==null).length} S:${sIn.data.filter(v=>v!==null).length} Z:${sOut.data.filter(v=>v!==null).length}`);

  if (!chartTemp) {
    chartTemp = makeLineChart("chartTemp", sTemp.labels, [
      { label: "Teplota (°C)", data: sTemp.data, tension: 0.25, pointRadius: 0 }
    ], "°C");
  } else {
    updateLineChart(chartTemp, sTemp.labels, [
      { label: "Teplota (°C)", data: sTemp.data, tension: 0.25, pointRadius: 0 }
    ]);
  }

  const labelsPower = (sIn.labels.length >= sOut.labels.length) ? sIn.labels : sOut.labels;
  const dsPower = [
    { label: "Solár (W)", data: alignTo(labelsPower, sIn.labels, sIn.data), tension: 0.25, pointRadius: 0 },
    { label: "Zátěž (W)", data: alignTo(labelsPower, sOut.labels, sOut.data), tension: 0.25, pointRadius: 0 }
  ];
  if (!chartPower) chartPower = makeLineChart("chartPower", labelsPower, dsPower, "W");
  else updateLineChart(chartPower, labelsPower, dsPower);

  if (!chartLight) {
    chartLight = makeLineChart("chartLight", sLight.labels, [
      { label: "Světlo (lx)", data: sLight.data, tension: 0.25, pointRadius: 0 }
    ], "lx");
  } else {
    updateLineChart(chartLight, sLight.labels, [
      { label: "Světlo (lx)", data: sLight.data, tension: 0.25, pointRadius: 0 }
    ]);
  }

  if (!chartBrainRisk) {
    chartBrainRisk = makeLineChart("chartBrainRisk", sRisk.labels, [
      { label: "Riziko (0–100)", data: sRisk.data, tension: 0.25, pointRadius: 0 }
    ], "risk");
  } else {
    updateLineChart(chartBrainRisk, sRisk.labels, [
      { label: "Riziko (0–100)", data: sRisk.data, tension: 0.25, pointRadius: 0 }
    ]);
  }

  renderDailySummary(day);
  renderWeeklyCharts(days);

  currentDayIndex = idx;
  historyChartsInitialized = true;

  // ✅ po vykreslení jednou srovnej size všech grafů (na jistotu)
  resizeAllCharts();
}

function maybeUpdateHistory(state, force = false) {
  if (!state) return;
  if (!isHistoryTabActive() && !force) return;

  const sig = historySignatureFromState(state);
  const days = Array.isArray(state?.memory?.days) ? state.memory.days : [];
  const idx = chooseDayIndex(days);

  const selectedIdx = Number(el("daySelect")?.value);
  const effectiveIdx = Number.isFinite(selectedIdx) ? selectedIdx : idx;

  const need =
    force ||
    !historyChartsInitialized ||
    sig !== lastHistorySignature ||
    effectiveIdx !== lastHistoryDayIndex;

  if (!need) return;

  lastHistorySignature = sig;
  lastHistoryDayIndex = effectiveIdx;

  renderHistoryCharts(state);
}

/* ---------------------------
   UI render (DNES + ENERGIE)
---------------------------- */
let lastMode = "";
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

  setText("uiMsg", state?.message || "—");
  const det = Array.isArray(state?.details) ? state.details.join(" • ") : (state?.details || "—");
  setText("uiDetails", det || "—");

  const brain = state?.brain || {};
  const risk = Number.isFinite(brain?.risk) ? brain.risk : null;
  const mode = brain?.mode || "—";

  // timeline – jen při změně režimu
  if (mode && mode !== "—" && mode !== lastMode) {
    pushTL("mode", "Režim mozku", `Aktuálně: ${mode}`);
    lastMode = mode;
  }
  renderTL();

  // ✅ KLÍČ: historie se nebude hýbat při scrollu, a aktualizuje se jen při změně
  maybeUpdateHistory(state);

  setText("statusText", "Dashboard • OK");

  // risk canvas
  if (risk !== null) {
    const series = pushRiskPoint(risk);
    drawRisk(el("riskCanvas"), series);
  }

  // Sun line
  const sun = env.sun || {};
  const sunset = sun.sunsetTs ? toHHMM(sun.sunsetTs) : null;
  const sunrise = sun.sunriseTs ? toHHMM(sun.sunriseTs) : null;
  setText("uiSunLine", (sunrise && sunset) ? `🌅 ${sunrise}  •  🌇 ${sunset}` : "—");
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

      // ✅ při přepnutí na historii: jednou vykresli + resize grafů (na jistotu)
      if (name === "history" && lastState) {
        maybeUpdateHistory(lastState, true);
        resizeAllCharts();
      }
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
        if (lastState) maybeUpdateHistory(lastState, true);
        resizeAllCharts();
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
    if (lastState) maybeUpdateHistory(lastState, true);
    resizeAllCharts();
  });

  if (next) next.addEventListener("click", () => {
    if (!lastState?.memory?.days?.length) return;
    let idx = chooseDayIndex(lastState.memory.days);
    idx = Math.min(lastState.memory.days.length - 1, idx + 1);
    setDayIndex(idx);
    currentDayIndex = idx;
    if (sel) sel.value = String(idx);
    if (lastState) maybeUpdateHistory(lastState, true);
    resizeAllCharts();
  });
}

(async function boot() {
  setupTabs();
  setupSettings();
  setupHistoryControls();

  try {
    const s = await fetchState();
    render(s);
  } catch (e) {
    setText("statusText", `Dashboard • chyba: ${e.message}`);
  }
  startLoop();
})();
