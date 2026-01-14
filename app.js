// app.js – Meteostanice UI
// - načítá /state a vykresluje dashboard
// - T 3.33.0: doplněné zobrazování energie (power_state/power_path/SoC odhad/Wh today/24h/quality)
// - B 3.35.x: NightBudget panel + UDÁLOSTI tab (event log)

const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";

const RISK_STORE_KEY = "risk_trend_v1";
const RISK_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_RISK_POINTS = 360;

const el = (id) => document.getElementById(id);
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHtml = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };
const show = (id, on) => { const e = el(id); if (e) e.classList.toggle("hidden", !on); };

const fmt0 = (x) => (Number.isFinite(x) ? Math.round(x) : "—");
const fmt1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10) : "—");
const fmt2 = (x) => (Number.isFinite(x) ? (Math.round(x * 100) / 100) : "—");
const fmt3 = (x) => (Number.isFinite(x) ? (Math.round(x * 1000) / 1000) : "—");

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
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
// backend selection
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
  return (saved && saved.trim()) ? saved.trim() : DEFAULT_BACKEND;
}
function normalizeBackend(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  return s.replace(/\/+$/, "");
}
function setBackend(v) {
  localStorage.setItem("backendUrl", normalizeBackend(v));
  setHref("stateLink", `${getBackend()}/state`);
}

async function fetchState() {
  const backend = getBackend();
  setHref("stateLink", `${backend}/state`);
  const r = await fetch(`${backend}/state`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------------------------
// risk history store
// ---------------------------
function loadRiskTrend() {
  try {
    const raw = localStorage.getItem(RISK_STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
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
        x: { ticks: { color: "#9fb0d8", maxRotation: 0 }, grid: { color: "rgba(255,255,255,06)" } },
        y: {
          ticks: { color: "#9fb0d8" },
          grid: { color: "rgba(255,255,255,06)" },
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
      { label: "Světlo (lx)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "lx");
  }
  if (!chartBrainRisk) {
    chartBrainRisk = createChart("chartBrainRisk", [], [
      { label: "Riziko", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "0–100");
  }
  if (!chartWeekTemp) {
    chartWeekTemp = createChart("chartWeekTemp", [], [
      { label: "Min (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: "Max (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
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
// riskCanvas (simple sparkline)
// ---------------------------
function drawRiskCanvas(points) {
  const c = el("riskCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  const parent = c.parentElement;
  if (parent) {
    const w = Math.max(320, parent.clientWidth - 8);
    c.width = w;
  }
  const w = c.width;
  const h = c.height;

  ctx.clearRect(0, 0, w, h);

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
// label maps
// ---------------------------
function powerStateCz(s) {
  const m = { CHARGING: "NABÍJÍ", DISCHARGING: "VYBÍJÍ", IDLE: "IDLE", MIXED: "SMÍŠENÉ", UNKNOWN: "NEZNÁMÉ" };
  return m[s] || (s || "—");
}
function powerPathCz(s) {
  const m = {
    SOLAR_TO_LOAD: "SOLÁR → ZÁTĚŽ",
    SOLAR_TO_BATT: "SOLÁR → BATERIE",
    BATT_TO_LOAD: "BATERIE → ZÁTĚŽ",
    FLOAT: "FLOAT",
    UNKNOWN: "NEZNÁMÉ"
  };
  return m[s] || (s || "—");
}
function fmtQ(q) {
  if (!Number.isFinite(q)) return "—";
  return `${Math.round(q * 100)} %`;
}

// ---------------------------
// render: TODAY cards
// ---------------------------
function renderTodayCards(s) {
  const env = deepGet(s, "world.environment", {}) || {};

  setText("uiLight", fmt0(num(env.lightLux, NaN)));
  setText("uiSolarPot", fmt1(num(env.solarPotentialW, NaN)));

  // dva senzory: vnitřní (SHT40) + venkovní (DS18B20)
  setText("uiTemp", fmt1(num(env.indoorTempC, num(env.airTempC, NaN))));
  setText("uiHum", fmt0(num(env.indoorHumPct, num(env.humidity, NaN))));
  setText("uiOutdoorTemp", fmt1(num(env.outdoorTempC, NaN)));
  setText("uiBoxTemp", fmt1(num(env.boxTempC, NaN)));

  setText("uiScenario", String(deepGet(s, "world.scenario", "—")));
  setText("uiPhase", String(deepGet(s, "world.cyclePhase", "—")));

  // simple chips
  const chips = [];
  if (env.raining) chips.push("Déšť");
  if (env.thunder) chips.push("Bouřka");
  if (env.snowing) chips.push("Sníh");
  if (Number.isFinite(num(env.windMs, NaN))) chips.push(`Vítr ${fmt1(num(env.windMs))} m/s`);
  setHtml("uiWeatherChips", chips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));

  // energy quick
  const soc = num(deepGet(s, "device.battery.soc", deepGet(s, "device.battery", NaN)), NaN);
  setText("uiSoc", Number.isFinite(soc) ? fmt0(soc <= 1.2 ? soc * 100 : soc) : "—");

  const pIn = num(deepGet(s, "energy.summary.p_in_raw", deepGet(s, "energy.ina_in.p_raw", NaN)), NaN);
  const pOut = num(deepGet(s, "energy.summary.p_out_raw", deepGet(s, "energy.ina_out.p_raw", NaN)), NaN);
  setText("uiSolar", Number.isFinite(pIn) ? fmt3(pIn) : "—");
  setText("uiLoad", Number.isFinite(pOut) ? fmt3(pOut) : "—");

  // fan
  setText("uiFan", deepGet(s, "device.fan.on", null) ? "ON" : "—");

  // battery-safe
  const batSafe = deepGet(s, "brain.batterySafe.mode", deepGet(s, "brain.batterySafeMode", "—"));
  setText("uiBatSafe", batSafe || "—");

  // night budget quick
  const nb = deepGet(s, "brain.nightBudget", {}) || {};
  const cov = num(nb.coveragePct, NaN);
  const def = num(nb.deficitWh, NaN);
  setText("uiCovQuick", Number.isFinite(cov) ? fmt0(cov) : "—");
  setText("uiDefQuick", Number.isFinite(def) ? fmt1(def) : "—");

  // power state/path quick
  const ps = deepGet(s, "energy.summary.power_state", deepGet(s, "energy.states.power_state", "—"));
  const pp = deepGet(s, "energy.summary.power_path_state", deepGet(s, "energy.states.power_path_state", "—"));
  setText("uiPowerState", powerStateCz(ps));
  setText("uiPowerPath", powerPathCz(pp));
}

// ---------------------------
// render: Night budget panel
// ---------------------------
function renderNightBudget(s) {
  const nb = deepGet(s, "brain.nightBudget", {}) || {};
  const mode = deepGet(s, "brain.batterySafe.mode", deepGet(s, "brain.batterySafeMode", "—"));

  setText("uiNightMode", mode || "—");

  const cov = num(nb.coveragePct, NaN);
  setText("uiNightCoverage", Number.isFinite(cov) ? fmt0(cov) : "—");

  const deficit = num(nb.deficitWh, NaN);
  setText("uiNightDeficit", Number.isFinite(deficit) ? fmt1(deficit) : "—");

  setText("uiNightHours", Number.isFinite(num(nb.remainingNightHours, NaN)) ? fmt1(num(nb.remainingNightHours)) : "—");
  setText("uiNightP", Number.isFinite(num(nb.pNightSelectedW, NaN)) ? fmt3(num(nb.pNightSelectedW)) : "—");

  setText("uiNightNeed", Number.isFinite(num(nb.nightNeedWh, NaN)) ? fmt1(num(nb.nightNeedWh)) : "—");
  setText("uiNightReserve", Number.isFinite(num(nb.reserveWh, NaN)) ? fmt1(num(nb.reserveWh)) : "—");
  setText("uiNightTotal", Number.isFinite(num(nb.totalNightBudgetWh, NaN)) ? fmt1(num(nb.totalNightBudgetWh)) : "—");

  setText("uiNightAvail", Number.isFinite(num(nb.availableWh, NaN)) ? fmt1(num(nb.availableWh)) : "—");
  setText("uiNightBat", Number.isFinite(num(nb.batteryWh, NaN)) ? fmt1(num(nb.batteryWh)) : "—");
  setText("uiNightFloor", Number.isFinite(num(nb.batteryWhAt5, NaN)) ? fmt1(num(nb.batteryWhAt5)) : "—");
}

// ---------------------------
// render: Brain
// ---------------------------
function renderBrain(s) {
  const msg = deepGet(s, "brain.message.text", deepGet(s, "brain.message", "—"));
  const details = deepGet(s, "brain.message.details", []);
  const mode = deepGet(s, "brain.mode", deepGet(s, "brain.policy.mode", "—"));

  setText("uiMsg", msg || "—");
  setText("uiDetails", Array.isArray(details) ? details.join(" • ") : String(details || "—"));
  setText("uiModeBadge", mode || "—");

  const risk = num(deepGet(s, "brain.risk", NaN), NaN);
  setText("uiRisk", Number.isFinite(risk) ? fmt0(risk) : "—");
  const bar = el("uiRiskBar");
  if (bar && Number.isFinite(risk)) bar.style.width = `${clamp(risk, 0, 100)}%`;

  // battery hours / sun line (pokud existují)
  setText("uiBatHours", fmt1(num(deepGet(s, "brain.battery.hours", deepGet(s, "brain.batteryHours", NaN)), NaN)));
  setText("uiSunLine", String(deepGet(s, "brain.time.hoursToSunset", "—")));
  setText("uiSunHint", String(deepGet(s, "brain.solar.untilSunsetWh", "—")));

  // risk trend local
  const now = num(deepGet(s, "time.now", Date.now()), Date.now());
  if (Number.isFinite(risk)) {
    const pts = pushRiskPoint(now, clamp(risk, 0, 100));
    drawRiskCanvas(pts);
  }

  // chips
  const chips = [];
  const bs = deepGet(s, "brain.batterySafe.mode", null);
  if (bs) chips.push(`Battery-safe: ${bs}`);
  const cov = num(deepGet(s, "brain.nightBudget.coveragePct", NaN), NaN);
  if (Number.isFinite(cov)) chips.push(`Noční bilance: ${fmt0(cov)}%`);
  setHtml("uiBrainChips", chips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));
}

// ---------------------------
// render: Energy tab
// ---------------------------
function renderEnergyTab(s) {
  const pIn = num(deepGet(s, "energy.ina_in.p_raw", deepGet(s, "energy.summary.p_in_raw", NaN)), NaN);
  const pOut = num(deepGet(s, "energy.ina_out.p_raw", deepGet(s, "energy.summary.p_out_raw", NaN)), NaN);
  const pInEma = num(deepGet(s, "energy.ina_in.p_ema", deepGet(s, "energy.summary.p_in_ema", NaN)), NaN);
  const pOutEma = num(deepGet(s, "energy.ina_out.p_ema", deepGet(s, "energy.summary.p_out_ema", NaN)), NaN);

  setText("uiSolar2", Number.isFinite(pIn) ? fmt3(pIn) : "—");
  setText("uiLoad2", Number.isFinite(pOut) ? fmt3(pOut) : "—");
  setText("uiSolarEma", Number.isFinite(pInEma) ? fmt3(pInEma) : "—");
  setText("uiLoadEma", Number.isFinite(pOutEma) ? fmt3(pOutEma) : "—");

  // SoC
  const soc = num(deepGet(s, "device.battery.soc", deepGet(s, "device.battery", NaN)), NaN);
  setText("uiSoc2", Number.isFinite(soc) ? fmt0(soc <= 1.2 ? soc * 100 : soc) : "—");

  const socEst = num(deepGet(s, "energy.summary.soc_est", deepGet(s, "energy.soc.soc_est", NaN)), NaN);
  const socConf = num(deepGet(s, "energy.summary.soc_confidence", deepGet(s, "energy.soc.soc_confidence", NaN)), NaN);
  setText("uiSocEst", Number.isFinite(socEst) ? `${fmt0(socEst * 100)} %` : "—");
  setText("uiSocConf", Number.isFinite(socConf) ? `${fmt0(socConf * 100)} %` : "—");

  // state/path
  const ps = deepGet(s, "energy.summary.power_state", deepGet(s, "energy.states.power_state", "—"));
  const pp = deepGet(s, "energy.summary.power_path_state", deepGet(s, "energy.states.power_path_state", "—"));
  setText("uiPowerState2", powerStateCz(ps));
  setText("uiPowerPath2", powerPathCz(pp));

  // quality
  const qIn = num(deepGet(s, "energy.ina_in.signal_quality", deepGet(s, "energy.summary.q_in", NaN)), NaN);
  const qOut = num(deepGet(s, "energy.ina_out.signal_quality", deepGet(s, "energy.summary.q_out", NaN)), NaN);
  setText("uiQIn", fmtQ(qIn));
  setText("uiQOut", fmtQ(qOut));

  // deadband
  const deadband = num(deepGet(s, "energy.deadbandW", NaN), NaN);
  setText("uiDeadband", Number.isFinite(deadband) ? fmt3(deadband) : "—");

  // Wh today + 24h
  const whInToday = num(deepGet(s, "energy.totals.wh_in_today", deepGet(s, "energy.summary.wh_in_today", NaN)), NaN);
  const whOutToday = num(deepGet(s, "energy.totals.wh_out_today", deepGet(s, "energy.summary.wh_out_today", NaN)), NaN);
  const whNetToday = num(deepGet(s, "energy.totals.wh_net_today", deepGet(s, "energy.summary.wh_net_today", NaN)), NaN);

  const whIn24 = num(deepGet(s, "energy.rolling24h.wh_in_24h", deepGet(s, "energy.summary.wh_in_24h", NaN)), NaN);
  const whOut24 = num(deepGet(s, "energy.rolling24h.wh_out_24h", deepGet(s, "energy.summary.wh_out_24h", NaN)), NaN);
  const whNet24 = num(deepGet(s, "energy.rolling24h.wh_net_24h", deepGet(s, "energy.summary.wh_net_24h", NaN)), NaN);

  setText("uiWhInToday", Number.isFinite(whInToday) ? fmt1(whInToday) : "—");
  setText("uiWhOutToday", Number.isFinite(whOutToday) ? fmt1(whOutToday) : "—");
  setText("uiWhNetToday", Number.isFinite(whNetToday) ? fmt1(whNetToday) : "—");

  setText("uiWhIn24h", Number.isFinite(whIn24) ? fmt1(whIn24) : "—");
  setText("uiWhOut24h", Number.isFinite(whOut24) ? fmt1(whOut24) : "—");
  setText("uiWhNet24h", Number.isFinite(whNet24) ? fmt1(whNet24) : "—");

  // hint u výdrže (na DNES)
  setText("uiBatHint", (Number.isFinite(pIn) && Number.isFinite(pOut)) ? `Net: ${fmt3(pIn - pOut)} W` : "—");
}

// ---------------------------
// render: Charts (HISTORIE)
// ---------------------------
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
    { label: "Světlo (lx)", data: light.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartBrainRisk, risk.map(p => p.t), [
    { label: "Riziko", data: risk.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  // týdenní grafy
  const days = Array.isArray(deepGet(s, "memory.days", [])) ? deepGet(s, "memory.days", []) : [];
  const last7 = days.slice(-7);

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

// ---------------------------
// render: Events tab
// ---------------------------
function renderEventsTab(s) {
  const list =
    (Array.isArray(deepGet(s, "events", null)) ? deepGet(s, "events", []) : null) ||
    (Array.isArray(deepGet(s, "brain.events", null)) ? deepGet(s, "brain.events", []) : null) ||
    (Array.isArray(deepGet(s, "state.events", null)) ? deepGet(s, "state.events", []) : null) ||
    [];

  if (!Array.isArray(list) || list.length === 0) {
    setHtml("eventsList", `<div class="muted">— žádné události —</div>`);
    return;
  }

  // nejnovější nahoře
  const items = [...list].slice(-200).reverse().map(ev => {
    const ts = num(ev.ts, NaN);
    const when = Number.isFinite(ts) ? new Date(ts).toLocaleString("cs-CZ") : "—";
    const type = escapeHtml(ev.type || ev.kind || "event");
    const msg = escapeHtml(ev.msg || ev.message || "");
    const meta = ev.meta ? escapeHtml(JSON.stringify(ev.meta)) : "";
    return `
      <div class="tlItem">
        <div class="tlTime">${when}</div>
        <div class="tlBody">
          <div class="tlTitle">${type}</div>
          <div class="tlMsg">${msg}</div>
          ${meta ? `<div class="muted small">${meta}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  setHtml("eventsList", items);
}

// ---------------------------
// master render
// ---------------------------
function render(s) {
  renderTodayCards(s);
  renderNightBudget(s);
  renderBrain(s);
  renderEnergyTab(s);
  renderCharts(s);
  renderEventsTab(s);

  const rawOn = !!el("chkRaw")?.checked;
  show("rawJson", rawOn);
  if (rawOn) setText("rawJson", JSON.stringify(s, null, 2));
}

// ---------------------------
// Loop + UI wiring
// ---------------------------
let loopTimer = null;
let intervalMs = Number(localStorage.getItem("refreshInterval") || "1000");

function startLoop() {
  if (loopTimer) clearInterval(loopTimer);

  const run = async () => {
    try {
      const s = await fetchState();
      setText("statusText", `Dashboard • ${new Date(num(deepGet(s, "time.now"), Date.now())).toLocaleString("cs-CZ")}`);
      render(s);
    } catch (e) {
      setText("statusText", `Dashboard • chyba: ${e.message}`);
    }
  };

  run();
  loopTimer = setInterval(run, Math.max(400, intervalMs));
}

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

    // důležité: chart canvas se musí přepočítat až když je panel vidět
    setTimeout(resizeAllCharts, 60);
  };

  tabs.forEach(btn => btn.addEventListener("click", () => activate(btn.getAttribute("data-tab"))));
}

function setupSettings() {
  const backendInput = el("backendUrl");
  const btnSave = el("btnSave");
  const btnTest = el("btnTest");
  const healthOut = el("healthOut");
  const chkRaw = el("chkRaw");

  if (backendInput) backendInput.value = getBackend();

  if (btnSave && backendInput) {
    btnSave.addEventListener("click", () => {
      const v = normalizeBackend(backendInput.value);
      if (!v) return;
      setBackend(v);
      setText("statusText", `Dashboard • backend uložen`);
    });
  }

  if (btnTest) {
    btnTest.addEventListener("click", async () => {
      try {
        const backend = getBackend();
        const r = await fetch(`${backend}/health`, { cache: "no-store" });
        const ok = r.ok;
        if (healthOut) healthOut.textContent = ok ? "OK" : `Chyba ${r.status}`;
      } catch (e) {
        if (healthOut) healthOut.textContent = `Chyba: ${e.message}`;
      }
    });
  }

  // refresh buttons
  const btns = Array.from(document.querySelectorAll(".chipBtn"));
  btns.forEach(b => b.addEventListener("click", () => {
    const v = Number(b.getAttribute("data-interval") || "1000");
    intervalMs = Math.max(400, v);
    localStorage.setItem("refreshInterval", String(intervalMs));
    startLoop();
  }));

  if (chkRaw) chkRaw.addEventListener("change", () => {
    const raw = el("rawJson");
    if (!raw) return;
    raw.classList.toggle("hidden", !chkRaw.checked);
  });
}

(async function boot() {
  setupTabs();
  setupSettings();

  const q = getBackendFromQuery();
  if (q) setBackend(q);

  startLoop();
})();
