// app.js – Meteostanice UI
// - načítá /state a vykresluje dashboard
// - T 3.33.0: doplněné zobrazování energie (power_state/power_path/SoC odhad/Wh today/24h/quality)

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
  return (saved && saved.trim()) ? saved.trim().replace(/\/+$/, "") : DEFAULT_BACKEND;
}
function setBackend(url) {
  localStorage.setItem("backendUrl", String(url || "").trim().replace(/\/+$/, ""));
}
function normalizeBackend(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

async function fetchState() {
  const backend = getBackend();
  setHref("stateLink", `${backend}/state`);
  const r = await fetch(`${backend}/state`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

// ---------------------------
// risk trend storage
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
// Překlady stavů (T 3.33.0)
// ---------------------------
function powerStateCz(s) {
  switch (String(s || "").toUpperCase()) {
    case "CHARGING": return "Nabíjí";
    case "DISCHARGING": return "Vybíjí";
    case "IDLE": return "Klid (IDLE)";
    case "MIXED": return "Smíšený tok";
    default: return "Neznámý";
  }
}
function powerPathCz(s) {
  switch (String(s || "").toUpperCase()) {
    case "SOLAR_TO_LOAD": return "Solár → zátěž";
    case "SOLAR_TO_BATT": return "Solár → baterie";
    case "BATT_TO_LOAD": return "Baterie → zátěž";
    case "FLOAT": return "Float (solár bez zátěže)";
    default: return "Neznámý";
  }
}
function fmtQ(x) {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(clamp(x, 0, 1) * 100)} %`;
}

// ---------------------------
// Rendering
// ---------------------------
function renderTodayCards(s) {
  const env = deepGet(s, "world.environment", {}) || {};

  const lightLux = num(env.light, num(deepGet(s, "device.light")));
  const airTemp = num(env.airTempC, num(deepGet(s, "device.temperature")));
  const hum = num(env.humidity, num(deepGet(s, "device.humidity")));
  const boxT = num(env.boxTempC, num(env.temperature, NaN));

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
  const fan = !!deepGet(s, "device.fan", false);

  setText("uiSoc", Number.isFinite(soc) ? fmt0(soc) : "—");
  setText("uiSolar", fmt1(solarW));
  setText("uiLoad", fmt1(loadW));
  setText("uiFan", fan ? "ON" : "OFF");

  // T 3.33.0 quick states (DNES)
  const ps = deepGet(s, "energy.states.power_state", deepGet(s, "energy.summary.power_state", "UNKNOWN"));
  const pp = deepGet(s, "energy.states.power_path_state", deepGet(s, "energy.summary.power_path_state", "UNKNOWN"));
  setText("uiPowerState", powerStateCz(ps));
  setText("uiPowerPath", powerPathCz(pp));

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

  const sunrise = num(deepGet(s, "world.environment.sun.sunriseTs"), 0);
  const sunset = num(deepGet(s, "world.environment.sun.sunsetTs"), 0);
  const sunHint = (sunrise && sunset) ? `Východ ${toHHMM(sunrise)} • Západ ${toHHMM(sunset)}` : "—";
  setText("uiSunLine", sunHint);

  const solarLeftWh = num(deepGet(b, "solar.untilSunsetWh"), NaN);
  setText("uiSunHint", Number.isFinite(solarLeftWh) ? `Odhad do západu: ${fmt1(solarLeftWh)} Wh` : "—");

  setText("uiMsg", deepGet(s, "message", "—") || "—");
  const details = deepGet(s, "details", []);
  if (Array.isArray(details) && details.length) {
    setHtml("uiDetails", details.map(d => `<div class="detailLine">${escapeHtml(String(d))}</div>`).join(""));
  } else {
    setHtml("uiDetails", "");
  }

  const mode = String(b.mode || "").toUpperCase();
  setText("uiModeBadge", mode ? mode : "—");

  const brainChips = [];
  if (mode) brainChips.push(`🧠 ${mode}`);
  const sampling = String(b.sampling || "");
  if (sampling) brainChips.push(`📈 ${sampling}`);
  if (Number.isFinite(num(env.windMs))) brainChips.push(`💨 ${fmt1(num(env.windMs))} m/s`);
  if (Number.isFinite(num(env.pressureHpa))) brainChips.push(`📟 ${fmt0(num(env.pressureHpa))} hPa`);
  setHtml("uiBrainChips", brainChips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));

  const nowTs = num(deepGet(s, "time.now"), Date.now());
  if (Number.isFinite(risk)) {
    const pts = pushRiskPoint(nowTs, clamp(risk, 0, 100));
    drawRiskCanvas(pts);
  } else {
    drawRiskCanvas(loadRiskTrend());
  }
}

function renderEnergyTab(s) {
  const solarW = num(deepGet(s, "energy.ina_in.p_raw"), num(deepGet(s, "device.power.solarInW"), num(deepGet(s, "device.solarInW"), 0)));
  const loadW = num(deepGet(s, "energy.ina_out.p_raw"), num(deepGet(s, "device.power.loadW"), num(deepGet(s, "device.loadW"), 0)));
  const solarEma = num(deepGet(s, "energy.ina_in.p_ema"), NaN);
  const loadEma = num(deepGet(s, "energy.ina_out.p_ema"), NaN);

  const netW = solarW - loadW;

  const socUi = num(deepGet(s, "device.battery.percent"),
    num(deepGet(s, "brain.battery.socPercent"),
      num(deepGet(s, "device.socPct"))
    )
  );

  setText("uiSolar2", fmt1(solarW));
  setText("uiLoad2", fmt1(loadW));
  setText("uiSolarEma", Number.isFinite(solarEma) ? fmt1(solarEma) : "—");
  setText("uiLoadEma", Number.isFinite(loadEma) ? fmt1(loadEma) : "—");
  setText("uiSoc2", Number.isFinite(socUi) ? fmt0(socUi) : "—");

  // T 3.33.0 SoC interpretace
  const socEst = num(deepGet(s, "energy.soc.soc_est"), num(deepGet(s, "energy.summary.soc_est"), NaN));
  const socConf = num(deepGet(s, "energy.soc.soc_confidence"), num(deepGet(s, "energy.summary.soc_confidence"), NaN));
  setText("uiSocEst", Number.isFinite(socEst) ? `${fmt0(socEst * 100)} %` : "—");
  setText("uiSocConf", Number.isFinite(socConf) ? fmtQ(socConf) : "—");

  // Stavy (T 3.33.0)
  const ps = deepGet(s, "energy.states.power_state", deepGet(s, "energy.summary.power_state", "UNKNOWN"));
  const pp = deepGet(s, "energy.states.power_path_state", deepGet(s, "energy.summary.power_path_state", "UNKNOWN"));
  setText("uiPowerState2", powerStateCz(ps));
  setText("uiPowerPath2", powerPathCz(pp));

  // quick on TODAY card too
  setText("uiPowerState", powerStateCz(ps));
  setText("uiPowerPath", powerPathCz(pp));

  // quality
  const qIn = num(deepGet(s, "energy.ina_in.signal_quality"), num(deepGet(s, "energy.summary.q_in"), NaN));
  const qOut = num(deepGet(s, "energy.ina_out.signal_quality"), num(deepGet(s, "energy.summary.q_out"), NaN));
  setText("uiQIn", fmtQ(qIn));
  setText("uiQOut", fmtQ(qOut));

  // deadband
  const deadband = num(deepGet(s, "energy.deadbandW"), NaN);
  setText("uiDeadband", Number.isFinite(deadband) ? fmt3(deadband) : "—");

  // Wh today + 24h
  const whInToday = num(deepGet(s, "energy.totals.wh_in_today"), num(deepGet(s, "energy.summary.wh_in_today"), NaN));
  const whOutToday = num(deepGet(s, "energy.totals.wh_out_today"), num(deepGet(s, "energy.summary.wh_out_today"), NaN));
  const whNetToday = num(deepGet(s, "energy.totals.wh_net_today"), num(deepGet(s, "energy.summary.wh_net_today"), NaN));

  const whIn24 = num(deepGet(s, "energy.rolling24h.wh_in_24h"), num(deepGet(s, "energy.summary.wh_in_24h"), NaN));
  const whOut24 = num(deepGet(s, "energy.rolling24h.wh_out_24h"), num(deepGet(s, "energy.summary.wh_out_24h"), NaN));
  const whNet24 = num(deepGet(s, "energy.rolling24h.wh_net_24h"), num(deepGet(s, "energy.summary.wh_net_24h"), NaN));

  setText("uiWhInToday", Number.isFinite(whInToday) ? fmt1(whInToday) : "—");
  setText("uiWhOutToday", Number.isFinite(whOutToday) ? fmt1(whOutToday) : "—");
  setText("uiWhNetToday", Number.isFinite(whNetToday) ? fmt1(whNetToday) : "—");

  setText("uiWhIn24h", Number.isFinite(whIn24) ? fmt1(whIn24) : "—");
  setText("uiWhOut24h", Number.isFinite(whOut24) ? fmt1(whOut24) : "—");
  setText("uiWhNet24h", Number.isFinite(whNet24) ? fmt1(whNet24) : "—");

  // Net info do hintu u výdrže (na kartě DNES)
  setText("uiBatHint", `Net: ${fmt1(netW)} W`);
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

function render(s) {
  renderTodayCards(s);
  renderBrain(s);
  renderEnergyTab(s);
  renderCharts(s);

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
