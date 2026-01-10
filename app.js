// app.js (UI B 3.29)
// Dashboard pro meteostanici – čte /state z backendu (Railway) a vykresluje hodnoty + grafy.
// Fixy v této verzi:
// - Doplněné renderování všech UI polí (uiTemp/uiLight/...)
// - Fallbacky mezi world/device/brain strukturami (aby UI neukazovalo jen "—")
// - Trend rizika (riskCanvas) v prohlížeči (poslední ~2h)
// - Responzivní Chart.js bez "statického obrázku" (responsive:false + ruční resize)
// - Podpora ?api=... v URL (GitHub Pages)

// ---------------------------
// Config
// ---------------------------
const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";
const RISK_STORE_KEY = "risk_trend_v1"; // localStorage
const RISK_WINDOW_MS = 2 * 60 * 60 * 1000; // ~2h
const MAX_RISK_POINTS = 360; // při 20s interval ~2h

// ---------------------------
// DOM helpers
// ---------------------------
const el = (id) => document.getElementById(id);
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHtml = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };

const fmt1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10) : "—");
const fmt2 = (x) => (Number.isFinite(x) ? (Math.round(x * 100) / 100) : "—");
const fmt0 = (x) => (Number.isFinite(x) ? Math.round(x) : "—");

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function bool(x) { return !!x; }
function num(x, fallback = NaN) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function deepGet(o, path, fallback = null) {
  try {
    return path.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), o) ?? fallback;
  } catch { return fallback; }
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toHHMM(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ---------------------------
// Backend selection (?api= + localStorage)
// ---------------------------
function getBackendFromQuery() {
  try {
    const u = new URL(window.location.href);
    const api = u.searchParams.get("api");
    if (api && api.trim()) return api.trim().replace(/\/+$/, "");
    return null;
  } catch {
    return null;
  }
}
function getBackend() {
  const saved = localStorage.getItem("backendUrl");
  return (saved && saved.trim()) ? saved.trim().replace(/\/+$/, "") : DEFAULT_BACKEND;
}
function setBackend(url) {
  localStorage.setItem("backendUrl", String(url || "").trim().replace(/\/+$/, ""));
}
function normalizeBackend(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

// ---------------------------
// Risk trend storage (local, ~2h)
// ---------------------------
function loadRiskTrend() {
  try {
    const arr = JSON.parse(localStorage.getItem(RISK_STORE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveRiskTrend(arr) {
  const trimmed = arr.slice(-MAX_RISK_POINTS);
  localStorage.setItem(RISK_STORE_KEY, JSON.stringify(trimmed));
}
function pushRiskPoint(ts, risk) {
  const arr = loadRiskTrend();
  arr.push({ ts, v: risk });
  const cutoff = ts - RISK_WINDOW_MS;
  const filtered = arr.filter(p => p.ts >= cutoff);
  saveRiskTrend(filtered);
  return filtered;
}

// ---------------------------
// Fetch
// ---------------------------
async function fetchState() {
  const backend = getBackend();
  setHref("stateLink", `${backend}/state`);
  const r = await fetch(`${backend}/state`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

// ---------------------------
// Charts (Chart.js)
// ---------------------------
function setCanvasSize(canvas) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const w = Math.max(280, parent.clientWidth - 8);
  const h = Math.max(160, Math.min(320, Math.round(w * 0.38)));
  canvas.width = w;
  canvas.height = h;
}

function createChart(canvasId, labels, datasets, yTitle = "") {
  const c = el(canvasId);
  if (!c || !window.Chart) return null;

  setCanvasSize(c);

  return new Chart(c, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: false,
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
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update("none");
}

let chartTemp = null;
let chartPower = null;
let chartLight = null;
let chartBrainRisk = null;
let chartWeekTemp = null;
let chartWeekEnergy = null;

function ensureCharts() {
  if (!chartTemp) {
    chartTemp = createChart("chartTemp", [], [
      { label: "Teplota (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "°C");
  }
  if (!chartPower) {
    chartPower = createChart("chartPower", [], [
      { label: "Solár (W)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: "Zátěž (W)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "W");
  }
  if (!chartLight) {
    chartLight = createChart("chartLight", [], [
      { label: "Světlo (lux)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "lux");
  }
  if (!chartBrainRisk) {
    chartBrainRisk = createChart("chartBrainRisk", [], [
      { label: "Riziko", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "0–100");
  }
  if (!chartWeekTemp) {
    chartWeekTemp = createChart("chartWeekTemp", [], [
      { label: "Min/Max (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "°C");
  }
  if (!chartWeekEnergy) {
    chartWeekEnergy = createChart("chartWeekEnergy", [], [
      { label: "Bilance (Wh)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "Wh");
  }
}

function resizeAllCharts() {
  const ids = ["chartTemp", "chartPower", "chartLight", "chartBrainRisk", "chartWeekTemp", "chartWeekEnergy"];
  ids.forEach(id => {
    const c = el(id);
    if (c) setCanvasSize(c);
  });
  [chartTemp, chartPower, chartLight, chartBrainRisk, chartWeekTemp, chartWeekEnergy].forEach(ch => {
    if (ch) ch.resize();
  });
}

window.addEventListener("resize", () => {
  clearTimeout(window.__rzT);
  window.__rzT = setTimeout(resizeAllCharts, 120);
});

// ---------------------------
// riskCanvas (ne Chart.js – jednoduchý sparkline)
// riskCanvas (ne Chart.js – jednoduchý sparkline)
// ---------------------------
function drawRiskCanvas(points) {
  const c = el("riskCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  // přizpůsob šířku rodiči
  const parent = c.parentElement;
  if (parent) {
    const w = Math.max(320, parent.clientWidth - 8);
    c.width = w;
  }
  const w = c.width;
  const h = c.height;

  ctx.clearRect(0, 0, w, h);

  // pozadí grid
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const y = (h / 5) * i;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (!points || points.length < 2) return;

  const minV = 0;
  const maxV = 100;

  const minTs = points[0].ts;
  const maxTs = points[points.length - 1].ts;
  const span = Math.max(1, maxTs - minTs);

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = ((p.ts - minTs) / span) * (w - 2) + 1;
    const y = h - (((clamp(p.v, minV, maxV) - minV) / (maxV - minV)) * (h - 2) + 1);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ---------------------------
// Rendering
// ---------------------------
let lastState = null;
let loopTimer = null;
let intervalMs = Number(localStorage.getItem("refreshInterval") || "1000");
let currentDayIndex = 0; // 0=today, 1=yesterday...

function renderHeader(s) {
  const nowTs = deepGet(s, "time.now", Date.now());
  const isDay = bool(deepGet(s, "time.isDay", false));

  setText("statusText", `Dashboard • ${isDay ? "den" : "noc"} • ${new Date(nowTs).toLocaleString("cs-CZ")}`);

  const env = deepGet(s, "world.environment", {}) || {};
  const airTemp = num(env.airTempC, num(deepGet(s, "device.temperature")));
  const hum = num(env.humidity, num(deepGet(s, "device.humidity")));
  const pres = num(env.pressureHpa);
  const wind = num(env.windMs);

  setText("hTemp", `${fmt1(airTemp)} °C`);
  setText("hHumidity", `${fmt0(hum)} %`);
  setText("hPressure", `${fmt0(pres)} hPa`);
  setText("hWind", `${fmt1(wind)} m/s`);

  setText("hSunrise", toHHMM(num(deepGet(s, "world.environment.sun.sunriseTs")) || 0));
  setText("hSunset", toHHMM(num(deepGet(s, "world.environment.sun.sunsetTs")) || 0));

  const bat = num(deepGet(s, "device.battery.percent"),
    num(deepGet(s, "device.socPct"),
      num(deepGet(s, "brain.battery.socPercent"))
    )
  );
  const solarW = num(deepGet(s, "device.power.solarInW"), num(deepGet(s, "device.solarInW"), 0));
  const loadW = num(deepGet(s, "device.power.loadW"), num(deepGet(s, "device.loadW"), 0));
  const balWh = num(deepGet(s, "device.power.balanceWh"), 0);

  setText("hBattery", Number.isFinite(bat) ? `${fmt0(bat)} %` : "—");
  setText("hSolar", `${fmt1(solarW)} W`);
  setText("hLoad", `${fmt1(loadW)} W`);
  setText("hBalance", `${fmt1(balWh)} Wh`);
}

function renderTodayCards(s) {
  const env = deepGet(s, "world.environment", {}) || {};

  const lightLux = num(env.light, num(deepGet(s, "device.light")));
  const airTemp = num(env.airTempC, num(deepGet(s, "device.temperature")));
  const hum = num(env.humidity, num(deepGet(s, "device.humidity")));
  const boxT = num(env.boxTempC, num(env.temperature, NaN));

  // T 3.31.0 / B 3.32.0: world metadata
  const scenario = deepGet(s, "world.environment.scenario", env.scenario, "—");
  const phase = deepGet(s, "world.cycle.phase", env.phase, "—");
  const dayIn21 = num(deepGet(s, "world.cycle.day"), NaN);
  const solarPotW = num(env.solarPotentialW, NaN);

  setText("uiLight", fmt0(lightLux));
  setText("uiTemp", fmt1(airTemp));
  setText("uiHum", fmt0(hum));
  setText("uiBoxTemp", fmt1(boxT));

  setText("uiOutdoorTemp", fmt1(airTemp));
  setText("uiSolarPot", Number.isFinite(solarPotW) ? fmt2(solarPotW) : "—");
  setText("uiScenario", scenario || "—");
  setText("uiPhase", (phase ? String(phase) : "—") + (Number.isFinite(dayIn21) ? ` (den ${fmt0(dayIn21)}/21)` : ""));

  const soc = num(deepGet(s, "brain.battery.socPercent"),
    num(deepGet(s, "device.battery.percent"),
      num(deepGet(s, "device.socPct"))
    )
  );
  const solarW = num(deepGet(s, "device.power.solarInW"), num(deepGet(s, "device.solarInW"), 0));
  const loadW = num(deepGet(s, "device.power.loadW"), num(deepGet(s, "device.loadW"), 0));
  const fan = bool(deepGet(s, "device.fan", false));

  setText("uiSoc", Number.isFinite(soc) ? fmt0(soc) : "—");
  setText("uiSolar", fmt1(solarW));
  setText("uiLoad", fmt1(loadW));
  setText("uiFan", fan ? "ON" : "OFF");

  // Weather chips (events)
  const chips = [];
  if (env.raining) chips.push("🌧️ déšť");
  if (env.snowing) chips.push("🌨️ sníh");
  if (env.thunder) chips.push("⛈️ bouřka");
  if (env.events?.fog) chips.push("🌫️ mlha");
  if (env.events?.gust) chips.push("💨 náraz");
  if (env.events?.storm) chips.push("🌪️ vítr");
  if (typeof env.cloud === "number") chips.push(`☁️ oblačnost ${fmt0(env.cloud * 100)} %`);
  setHtml("uiWeatherChips", chips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));
}

function renderBrain(s) {
  const b = deepGet(s, "brain", {}) || {};
  const env = deepGet(s, "world.environment", {}) || {};
  const risk = num(b.risk, NaN);
  const hours = num(deepGet(b, "battery.hours", NaN), NaN);

  setText("uiRisk", Number.isFinite(risk) ? `${fmt0(risk)}` : "—");
  const bar = el("uiRiskBar");
  if (bar && Number.isFinite(risk)) bar.style.width = `${clamp(risk, 0, 100)}%`;
  if (bar && !Number.isFinite(risk)) bar.style.width = "0%";

  setText("uiBatHours", Number.isFinite(hours) ? fmt1(hours) : "—");
  setText("uiBatHours2", Number.isFinite(hours) ? fmt1(hours) : "—");

  const sunrise = num(deepGet(s, "world.environment.sun.sunriseTs"), 0);
  const sunset = num(deepGet(s, "world.environment.sun.sunsetTs"), 0);
  const nowTs = num(deepGet(s, "time.now"), Date.now());
  const sunHint = (sunrise && sunset) ? `Východ ${toHHMM(sunrise)} • Západ ${toHHMM(sunset)}` : "—";
  setText("uiSunLine", sunHint);

  const solarLeftWh = num(deepGet(b, "solar.untilSunsetWh"), NaN);
  setText("uiSunHint", Number.isFinite(solarLeftWh) ? `Odhad do západu: ${fmt1(solarLeftWh)} Wh` : "—");

  // message + details
  setText("uiMsg", deepGet(s, "message", "—") || "—");
  const details = deepGet(s, "details", []);
  if (Array.isArray(details) && details.length) {
    setHtml("uiDetails", details.map(d => `<div class="detailLine">${escapeHtml(String(d))}</div>`).join(""));
  } else {
    setHtml("uiDetails", "");
  }

  // mode badge
  const mode = String(b.mode || "").toUpperCase();
  setText("uiModeBadge", mode ? mode : "—");

  // brain chips (diagnostika)
  const brainChips = [];
  if (mode) brainChips.push(`🧠 ${mode}`);
  const sampling = String(b.sampling || "");
  if (sampling) brainChips.push(`📈 ${sampling}`);
  if (Number.isFinite(num(env.windMs))) brainChips.push(`💨 ${fmt1(num(env.windMs))} m/s`);
  if (Number.isFinite(num(env.pressureHpa))) brainChips.push(`📟 ${fmt0(num(env.pressureHpa))} hPa`);
  setHtml("uiBrainChips", brainChips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));

  // local risk trend
  if (Number.isFinite(risk)) {
    const pts = pushRiskPoint(nowTs, clamp(risk, 0, 100));
    drawRiskCanvas(pts);
  } else {
    drawRiskCanvas(loadRiskTrend());
  }
}

function renderEnergyTab(s) {
  const solarW = num(deepGet(s, "device.power.solarInW"), num(deepGet(s, "device.solarInW"), 0));
  const loadW = num(deepGet(s, "device.power.loadW"), num(deepGet(s, "device.loadW"), 0));
  const netW = solarW - loadW;

  const soc = num(deepGet(s, "brain.battery.socPercent"),
    num(deepGet(s, "device.battery.percent"),
      num(deepGet(s, "device.socPct"))
    )
  );

  setText("uiSolar2", fmt1(solarW));
  setText("uiLoad2", fmt1(loadW));
  setText("uiSoc2", Number.isFinite(soc) ? fmt0(soc) : "—");

  // endurance (prefer brain)
  const hours = num(deepGet(s, "brain.battery.hours", NaN), NaN);
  setText("uiBatHint", Number.isFinite(netW) ? `Net: ${fmt1(netW)} W` : "—");
  setText("uiNet", fmt1(netW));
  setText("uiBatHours2", Number.isFinite(hours) ? fmt1(hours) : "—");

  // today solar Wh (prefer memory totals)
  const todayInWh = num(deepGet(s, "memory.today.totals.energyInWh", NaN), NaN);
  setText("uiTodaySolarWh", Number.isFinite(todayInWh) ? fmt1(todayInWh) : "—");
}
function renderCharts(s) {
  ensureCharts();

  const today = deepGet(s, "memory.today", {}) || {};
  const temp = Array.isArray(today.temperature) ? today.temperature : [];
  const ein = Array.isArray(today.energyIn) ? today.energyIn : [];
  const eout = Array.isArray(today.energyOut) ? today.energyOut : [];
  const light = Array.isArray(today.light) ? today.light : [];
  const risk = Array.isArray(today.brainRisk) ? today.brainRisk : [];

  updateLineChart(chartTemp, temp.map(p => p.t), [
    { label: "Teplota (°C)", data: temp.map(p => num(p.v)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartPower, ein.map(p => p.t), [
    { label: "Solár (W)", data: ein.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 },
    { label: "Zátěž (W)", data: eout.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartLight, light.map(p => p.t), [
    { label: "Světlo (lux)", data: light.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartBrainRisk, risk.map(p => p.t), [
    { label: "Riziko", data: risk.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);
}

function renderHistoryAndEnergyWeek(s) {
  // Jednoduchý týdenní přehled z memory.days (posledních 7)
  const days = Array.isArray(deepGet(s, "memory.days", [])) ? deepGet(s, "memory.days", []) : [];
  const last7 = days.slice(-7);

  // Temp week: použijeme min/max z uložených bodů
  const labels = last7.map(d => d.key || "—");
  const mins = last7.map(d => {
    const arr = Array.isArray(d.temperature) ? d.temperature : [];
    const vals = arr.map(p => num(p.v)).filter(Number.isFinite);
    return vals.length ? Math.min(...vals) : NaN;
  });
  const maxs = last7.map(d => {
    const arr = Array.isArray(d.temperature) ? d.temperature : [];
    const vals = arr.map(p => num(p.v)).filter(Number.isFinite);
    return vals.length ? Math.max(...vals) : NaN;
  });

  if (chartWeekTemp) {
    updateLineChart(chartWeekTemp, labels, [
      { label: "Min (°C)", data: mins, borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: "Max (°C)", data: maxs, borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ]);
  }

  // Energy week: bilance = inWh - outWh
  const balances = last7.map(d => {
    const t = d.totals || {};
    const inWh = num(t.energyInWh, NaN);
    const outWh = num(t.energyOutWh, NaN);
    return (Number.isFinite(inWh) && Number.isFinite(outWh)) ? (inWh - outWh) : NaN;
  });
  if (chartWeekEnergy) {
    updateLineChart(chartWeekEnergy, labels, [
      { label: "Bilance (Wh)", data: balances, borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ]);
  }
}

function render(s) {
  lastState = s;
  renderHeader(s);
  renderTodayCards(s);
  renderBrain(s);
  renderEnergyTab(s);
  renderCharts(s);
  renderHistoryAndEnergyWeek(s);

  const raw = el("rawJson");
  if (raw) raw.textContent = JSON.stringify(s, null, 2);
}

// ---------------------------
// Loop
// ---------------------------
function startLoop() {
  if (loopTimer) clearInterval(loopTimer);

  const run = async () => {
    try {
      const s = await fetchState();
      render(s);
    } catch (e) {
      setText("statusText", `Dashboard • chyba: ${e.message}`);
    }
  };

  run();
  loopTimer = setInterval(run, Math.max(400, intervalMs));
}

// ---------------------------
// UI wiring
// ---------------------------
function setupTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  const activate = (name) => {
    tabs.forEach(x => x.classList.remove("active"));
    const btn = tabs.find(b => b.getAttribute("data-tab") === name);
    if (btn) btn.classList.add("active");

    panels.forEach(p => p.classList.remove("active"));
    const panel = el(`tab-${name}`);
    if (panel) panel.classList.add("active");

    // fix resize grafů při přepnutí karty
    setTimeout(resizeAllCharts, 60);
  };

  tabs.forEach(btn => btn.addEventListener("click", () => activate(btn.getAttribute("data-tab"))));
}

function setupSettings() {
  const input = el("backendInput");
  const btn = el("backendSave");
  const interval = el("refreshInterval");

  if (input) input.value = getBackend();
  if (interval) interval.value = String(intervalMs);

  if (btn && input) {
    btn.addEventListener("click", () => {
      const v = normalizeBackend(input.value);
      if (!v) return;
      setBackend(v);
      setText("statusText", `Dashboard • backend: ${v}`);
      fetchState().then(render).catch(e => setText("statusText", `Dashboard • chyba: ${e.message}`));
    });
  }

  if (interval) {
    interval.addEventListener("change", () => {
      const v = Math.max(400, Number(interval.value || "1000"));
      intervalMs = v;
      localStorage.setItem("refreshInterval", String(v));
      startLoop();
    });
  }
}

function setupHistoryControls() {
  const sel = el("historyDaySelect");
  if (!sel) return;
  sel.addEventListener("change", () => {
    currentDayIndex = Number(sel.value || "0");
    setTimeout(resizeAllCharts, 50);
  });
}

// ---------------------------
// Boot
// ---------------------------
(async function boot() {
  setupTabs();
  setupSettings();
  setupHistoryControls();

  const q = getBackendFromQuery();
  if (q) setBackend(q);

  try {
    const s = await fetchState();
    render(s);
  } catch (e) {
    setText("statusText", `Dashboard • chyba: ${e.message}`);
  }

  startLoop();
})();
