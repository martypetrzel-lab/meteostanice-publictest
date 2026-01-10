const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";

const el = (id) => document.getElementById(id);
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };

const fmt1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : "—");
const fmt0 = (x) => (Number.isFinite(x) ? Math.round(x) : "—");
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

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
  localStorage.setItem("backendUrl", url.trim().replace(/\/+$/, ""));
}
function normalizeBackend(url) {
  return String(url || "").trim().replace(/\/+$/, "");
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
function pushTL(type, text, nowTs) {
  const arr = loadTL();
  arr.push({ ts: nowTs || Date.now(), type, text: String(text || "") });
  saveTL(arr);
}

/* ---------------------------
   Canvas sizing for Chart.js
   (fix: canvas, responsive OFF)
---------------------------- */
function setCanvasSize(canvas) {
  // rodič (card) drží layout; canvas nastavíme natvrdo podle aktuální šířky
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

/* ---------------------------
   Global state
---------------------------- */
let lastState = null;

let chartTemp = null;
let chartPower = null;
let chartLight = null;
let chartBrainRisk = null;
let chartWeekTemp = null;
let chartWeekEnergy = null;

let loopTimer = null;
let intervalMs = Number(localStorage.getItem("refreshInterval") || "1000");

let currentDayIndex = 0; // 0 = today, 1 = yesterday atd.

function resizeAllCharts() {
  const ids = ["chartTemp", "chartPower", "chartLight", "chartBrainRisk", "chartWeekTemp", "chartWeekEnergy"];
  ids.forEach(id => {
    const c = el(id);
    if (c) setCanvasSize(c);
  });
  // po resize překresli
  [chartTemp, chartPower, chartLight, chartBrainRisk, chartWeekTemp, chartWeekEnergy].forEach(ch => {
    if (ch) ch.resize();
  });
}

window.addEventListener("resize", () => {
  // jemný debounce
  clearTimeout(window.__rzT);
  window.__rzT = setTimeout(resizeAllCharts, 120);
});

/* ---------------------------
   Fetch
---------------------------- */
async function fetchState() {
  const backend = getBackend();
  setHref("stateLink", `${backend}/state`);
  const r = await fetch(`${backend}/state`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

/* ---------------------------
   Rendering helpers
---------------------------- */
function deepGet(o, path, fallback = null) {
  try {
    return path.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), o) ?? fallback;
  } catch { return fallback; }
}

function num(x, fallback = NaN) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function bool(x) { return !!x; }

function renderHeader(s) {
  const nowTs = deepGet(s, "time.now", Date.now());
  const isDay = bool(deepGet(s, "time.isDay", false));
  const env = deepGet(s, "world.environment", {}) || {};

  setText("statusText", `Dashboard • ${isDay ? "den" : "noc"} • ${new Date(nowTs).toLocaleString("cs-CZ")}`);

  // základní summary (na header kartách)
  setText("hTemp", `${fmt1(num(env.airTempC))} °C`);
  setText("hHumidity", `${fmt0(num(env.humidity))} %`);
  setText("hPressure", `${fmt0(num(env.pressureHpa))} hPa`);
  setText("hWind", `${fmt1(num(env.windMs))} m/s`);

  // sunrise/sunset
  setText("hSunrise", toHHMM(num(deepGet(s, "world.environment.sun.sunriseTs")) || 0) || "—");
  setText("hSunset", toHHMM(num(deepGet(s, "world.environment.sun.sunsetTs")) || 0) || "—");

  // battery/power
  const bat = num(deepGet(s, "device.battery.percent"));
  const solarW = num(deepGet(s, "device.power.solarInW"), 0);
  const loadW = num(deepGet(s, "device.power.loadW"), 0);
  const balWh = num(deepGet(s, "device.power.balanceWh"), 0);

  setText("hBattery", Number.isFinite(bat) ? `${fmt0(bat)} %` : "—");
  setText("hSolar", `${fmt1(solarW)} W`);
  setText("hLoad", `${fmt1(loadW)} W`);
  setText("hBalance", `${fmt1(balWh)} Wh`);
}

/* ---------------------------
   Charts (update)
---------------------------- */
function updateLineChart(chart, labels, datasets) {
  if (!chart) return;
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update("none");
}

function ensureCharts(s) {
  // temp today
  if (!chartTemp) {
    chartTemp = createChart("chartTemp", [], [
      { label: "Teplota (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "°C");
  }
  // power
  if (!chartPower) {
    chartPower = createChart("chartPower", [], [
      { label: "Solár (W)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: "Zátěž (W)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "W");
  }
  // light
  if (!chartLight) {
    chartLight = createChart("chartLight", [], [
      { label: "Světlo (lux)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "lux");
  }
  // brain risk
  if (!chartBrainRisk) {
    chartBrainRisk = createChart("chartBrainRisk", [], [
      { label: "Risk", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "0–1");
  }
  // week temp
  if (!chartWeekTemp) {
    chartWeekTemp = createChart("chartWeekTemp", [], [
      { label: "Min/Max (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "°C");
  }
  // week energy
  if (!chartWeekEnergy) {
    chartWeekEnergy = createChart("chartWeekEnergy", [], [
      { label: "Bilance (Wh)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
    ], "Wh");
  }
}

function renderTodayCharts(s) {
  const today = deepGet(s, "memory.today", {}) || {};
  const temp = Array.isArray(today.temperature) ? today.temperature : [];
  const ein = Array.isArray(today.energyIn) ? today.energyIn : [];
  const eout = Array.isArray(today.energyOut) ? today.energyOut : [];

  // teplota dnes
  const labelsT = temp.map(p => p.t);
  const dataT = temp.map(p => num(p.v));
  updateLineChart(chartTemp, labelsT, [
    { label: "Teplota (°C)", data: dataT, borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  // power
  const labelsP = ein.map(p => p.t);
  const dataIn = ein.map(p => num(p.v, 0));
  const dataOut = eout.map(p => num(p.v, 0));
  updateLineChart(chartPower, labelsP, [
    { label: "Solár (W)", data: dataIn, borderWidth: 2, pointRadius: 0, tension: 0.2 },
    { label: "Zátěž (W)", data: dataOut, borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  // light
  const lightArr = Array.isArray(deepGet(s, "memory.today.light")) ? deepGet(s, "memory.today.light") : [];
  const labelsL = lightArr.map(p => p.t);
  const dataL = lightArr.map(p => num(p.v));
  updateLineChart(chartLight, labelsL, [
    { label: "Světlo (lux)", data: dataL, borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  // brain risk
  const riskArr = Array.isArray(deepGet(s, "memory.today.brainRisk")) ? deepGet(s, "memory.today.brainRisk") : [];
  const labelsR = riskArr.map(p => p.t);
  const dataR = riskArr.map(p => num(p.v));
  updateLineChart(chartBrainRisk, labelsR, [
    { label: "Risk", data: dataR, borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);
}

function maybeUpdateHistory(s, force = false) {
  // placeholder: v tvé verzi už to máš navázané, jen tady nechávám existující logiku
  // (já do historie logiky teď nezasahoval, jen fix ?api a backend caps)
}

/* ---------------------------
   Main render
---------------------------- */
function render(s) {
  lastState = s;
  ensureCharts(s);
  renderHeader(s);
  renderTodayCharts(s);

  const raw = el("rawJson");
  if (raw) raw.textContent = JSON.stringify(s, null, 2);
}

/* ---------------------------
   Loop
---------------------------- */
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

/* ---------------------------
   UI wiring
---------------------------- */
function setupTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  const activate = (name) => {
    // aktivuj tlačítko
    tabs.forEach(x => x.classList.remove("active"));
    const btn = tabs.find(b => b.getAttribute("data-tab") === name);
    if (btn) btn.classList.add("active");

    // aktivuj panel (HTML používá #tab-<name> a class .panel.active)
    panels.forEach(p => p.classList.remove("active"));
    const panel = el(`tab-${name}`);
    if (panel) panel.classList.add("active");
  };

  tabs.forEach(btn => {
    btn.addEventListener("click", () => activate(btn.getAttribute("data-tab")));
  });
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
      // okamžitě refresh
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
    const idx = Number(sel.value || "0");
    currentDayIndex = idx;
    if (lastState) maybeUpdateHistory(lastState, true);
    resizeAllCharts();
  });
}

(async function boot() {
  setupTabs();
  setupSettings();
  setupHistoryControls();

  // podpora ?api=<backend> v URL (např. GitHub Pages link)
  const q = getBackendFromQuery();
  if (q) {
    // uložíme do localStorage a hned použijeme
    setBackend(q);
  }

  try {
    const s = await fetchState();
    render(s);
  } catch (e) {
    setText("statusText", `Dashboard • chyba: ${e.message}`);
  }
  startLoop();
})();
