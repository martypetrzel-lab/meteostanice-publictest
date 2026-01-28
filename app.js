// app.js – Meteostanice UI (robust schema adapter) – UI 3.36.1 (ESP32 HW compatible)
// HW FIX: device.fan je boolean (ESP32 posílá doc["device"]["fan"] = true/false)
// HW FIX: tolerantnější čtení isDay a solarPotentialW (ESP32 používá time.isDay + world.environment.solarPotentialW)
// UX: Historie label teploty: "Venkovní teplota"

const UI_VERSION = "3.36.1";
const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";

const el = (id) => document.getElementById(id);
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHtml = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };
const show = (id, on) => { const e = el(id); if (e) e.classList.toggle("hidden", !on); };

const fmt0 = (x) => (Number.isFinite(x) ? Math.round(x) : "—");
const fmt1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10) : "—");
const fmt3 = (x) => (Number.isFinite(x) ? (Math.round(x * 1000) / 1000) : "—");

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function num(x, fallback = NaN) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function deepGet(o, path, fallback = undefined) {
  try {
    return path.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), o) ?? fallback;
  } catch { return fallback; }
}
function pick(o, paths, fallback = undefined) {
  for (const p of paths) {
    const v = deepGet(o, p, undefined);
    if (v !== undefined && v !== null) return v;
  }
  return fallback;
}
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function toLocalTimeLabel(tsOrStr) {
  if (tsOrStr === null || tsOrStr === undefined) return "—";
  if (typeof tsOrStr === "string" && /^\d{2}:\d{2}/.test(tsOrStr)) return tsOrStr.slice(0, 5);

  const t = (typeof tsOrStr === "string") ? Date.parse(tsOrStr) : Number(tsOrStr);
  if (!Number.isFinite(t)) return String(tsOrStr).slice(0, 8);

  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function toPercentMaybe01(x) {
  if (!Number.isFinite(x)) return NaN;
  return x <= 1.2 ? x * 100 : x;
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
  } catch { return null; }
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
        x: { ticks: { color: "#9fb0d8", maxRotation: 0 }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: {
          ticks: { color: "#9fb0d8" },
          grid: { color: "rgba(255,255,255,0.06)" },
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
      { label: "Venkovní teplota (°C)", data: [], borderWidth: 2, pointRadius: 0, tension: 0.2 }
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
// HW FIX helpers
// ---------------------------
function getFanOn(s) {
  // ESP32: device.fan = boolean
  const v = pick(s, ["device.fan", "device.fan.on", "fan.on", "device.sensors.fan", "device.power.fan"], null);
  return v === true || v === 1 || v === "1" || v === "ON";
}
function getIsDay(s) {
  const v = pick(s, ["time.isDay", "world.environment.isDay", "world.environment.phase", "phase"], null);
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const u = v.toUpperCase();
    if (u === "DAY") return true;
    if (u === "NIGHT") return false;
  }
  return null;
}

// ---------------------------
// SCHEMA ADAPTERS
// ---------------------------
function getNowTs(s) {
  return num(pick(s, ["time.now", "now", "ts", "timestamp"], Date.now()), Date.now());
}

function getWorld(s) {
  const w = pick(s, ["world", "state.world", "sim.world", "simulator.world"], {});
  const env = pick(w, ["environment", "env"], w);

  const lux = num(pick(env, [
    "light", "lightLux", "lux", "bh1750Lux", "worldLux", "environmentLux"
  ], NaN), NaN);

  // ESP32: world.environment.solarPotentialW = aktuální PinW
  const solarPot = num(pick(env, [
    "solarPotentialW", "solarPotential", "solarPotential_w", "solarPotentialWatts", "solarPotentialPowerW",
    "solarInW" // fallback
  ], NaN), NaN);

  const outdoorTemp = num(pick(env, [
    "outdoorTempC", "airTempC", "temperature", "tempOutdoorC", "outsideTempC", "ds18b20C", "outTempC"
  ], NaN), NaN);

  const boxTemp = num(pick(env, [
    "boxTempC", "indoorTempC", "tempBoxC", "enclosureTempC", "sht40TempC", "insideTempC", "tempC"
  ], NaN), NaN);

  const indoorHum = num(pick(env, ["indoorHumPct", "indoorHum", "humidity", "humPct", "sht40HumPct"], NaN), NaN);

  const scenario = pick(env, ["scenario", "scenarioName", "stressPattern"], pick(w, [
    "scenario", "activeScenario", "scenarioName", "scenarioId", "scenarioType",
    "weatherScenario", "weather.scenario", "worldScenario", "simScenario"
  ], "—"));

  const cyclePhase = pick(env, ["phase", "cyclePhase", "cycle.phase", "cyclePhaseName"], pick(w, [
    "cyclePhase", "phase", "cycle.phase", "cyclePhaseName"
  ], "—"));

  const wind = num(pick(env, ["windMs", "wind_mps", "wind"], NaN), NaN);
  const raining = !!pick(env, ["raining", "rain", "isRaining"], false);
  const thunder = !!pick(env, ["thunder", "storm", "isThunder"], false);
  const snowing = !!pick(env, ["snowing", "snow", "isSnowing"], false);

  return { lux, solarPot, outdoorTemp, boxTemp, indoorHum, scenario, cyclePhase, wind, raining, thunder, snowing };
}

function getEnergy(s) {
  const e = pick(s, ["energy", "state.energy", "power", "state.power"], {});
  const inaIn = pick(e, ["ina_in", "inaIn", "in"], {});
  const inaOut = pick(e, ["ina_out", "inaOut", "out"], {});
  const sum = pick(e, ["summary", "totals", "stats"], {});

  // ESP32: ina_in.p_raw / p_ema
  const pIn = num(pick(e, ["p_in_raw", "pInW"], pick(inaIn, ["p_raw", "p", "powerW"], pick(sum, ["p_in_raw", "p_in", "pIn"], NaN))), NaN);
  const pOut = num(pick(e, ["p_out_raw", "pOutW"], pick(inaOut, ["p_raw", "p", "powerW"], pick(sum, ["p_out_raw", "p_out", "pOut"], NaN))), NaN);

  const pInEma = num(pick(inaIn, ["p_ema", "ema", "powerEmaW"], pick(sum, ["p_in_ema", "pInEma"], NaN)), NaN);
  const pOutEma = num(pick(inaOut, ["p_ema", "ema", "powerEmaW"], pick(sum, ["p_out_ema", "pOutEma"], NaN)), NaN);

  // ESP32: energy.states.power_state + power_path_state
  const powerState = pick(e, ["states.power_state", "power_state", "powerState"], pick(sum, ["power_state", "powerState"], "—"));
  const powerPath = pick(e, ["states.power_path_state", "power_path_state", "powerPathState"], pick(sum, ["power_path_state", "powerPathState"], "—"));

  const qIn = num(pick(inaIn, ["signal_quality", "quality", "q"], pick(sum, ["q_in", "qIn"], NaN)), NaN);
  const qOut = num(pick(inaOut, ["signal_quality", "quality", "q"], pick(sum, ["q_out", "qOut"], NaN)), NaN);

  const deadbandW = num(pick(e, ["deadbandW", "deadband_w", "deadband"], NaN), NaN);

  const whInToday = num(pick(e, ["totals.wh_in_today", "wh_in_today", "whInToday"], pick(sum, ["wh_in_today", "whInToday"], NaN)), NaN);
  const whOutToday = num(pick(e, ["totals.wh_out_today", "wh_out_today", "whOutToday"], pick(sum, ["wh_out_today", "whOutToday"], NaN)), NaN);
  const whNetToday = num(pick(e, ["totals.wh_net_today", "wh_net_today", "whNetToday"], pick(sum, ["wh_net_today", "whNetToday"], NaN)), NaN);

  const whIn24 = num(pick(e, ["rolling24h.wh_in_24h", "wh_in_24h", "whIn24h"], pick(sum, ["wh_in_24h", "whIn24h"], NaN)), NaN);
  const whOut24 = num(pick(e, ["rolling24h.wh_out_24h", "wh_out_24h", "whOut24h"], pick(sum, ["wh_out_24h", "whOut24h"], NaN)), NaN);
  const whNet24 = num(pick(e, ["rolling24h.wh_net_24h", "wh_net_24h", "whNet24h"], pick(sum, ["wh_net_24h", "whNet24h"], NaN)), NaN);

  const socEst = num(pick(e, ["soc.soc_est", "soc_est"], pick(sum, ["soc_est", "socEst"], NaN)), NaN);
  const socConf = num(pick(e, ["soc.soc_confidence", "soc_confidence"], pick(sum, ["soc_confidence", "socConfidence"], NaN)), NaN);

  return {
    pIn, pOut, pInEma, pOutEma,
    powerState, powerPath,
    qIn, qOut,
    deadbandW,
    whInToday, whOutToday, whNetToday,
    whIn24, whOut24, whNet24,
    socEst, socConf
  };
}

function getBattery(s) {
  // 1) ESP32: SOC je v energy.soc.soc_est (0..1)
  const soc01 = num(pick(s, ["energy.soc.soc_est"], NaN), NaN);

  // 2) Sim/legacy: SOC může být v device.battery.soc nebo podobně
  const b = pick(s, ["device.battery", "battery", "state.battery"], {});
  const socRaw = num(
    pick(b, ["soc", "socPct", "percent"], pick(s, ["soc", "batterySoc"], NaN)),
    NaN
  );

  // rozhodnutí zdroje
  let socPct = NaN;
  if (Number.isFinite(soc01)) {
    socPct = soc01 * 100;
  } else if (Number.isFinite(socRaw)) {
    socPct = toPercentMaybe01(socRaw);
  }

  // Wh: ESP32 posílá batteryWh v brain.nightBudget.batteryWh
  const wh = num(
    pick(s, [
      "brain.nightBudget.batteryWh",  // ESP32
      "device.battery.wh",
      "battery.wh",
      "batteryWh",
      "energy.batteryWh",
      "state.energy.batteryWh"
    ], NaN),
    NaN
  );

  return { socPct, wh };
}


function getNightBudget(s) {
  const nb = pick(s, ["brain.nightBudget", "nightBudget", "brain.batterySafe.nightBudget", "brain.battery_safe.nightBudget"], {});

  const coveragePct = num(pick(nb, ["coveragePct", "coverage", "coverage_percent"], NaN), NaN);
  const deficitWh = num(pick(nb, ["deficitWh", "deficit", "deficit_wh"], NaN), NaN);

  const remainingNightHours = num(pick(nb, ["remainingNightHours", "remainingHours", "hoursToMorning"], NaN), NaN);
  const pNightSelectedW = num(pick(nb, ["pNightSelectedW", "pNightW", "pNightSelected"], NaN), NaN);
  const nightNeedWh = num(pick(nb, ["nightNeedWh", "needWh", "night_need_wh"], NaN), NaN);
  const reserveWh = num(pick(nb, ["reserveWh", "reserve", "reserve_wh"], NaN), NaN);
  const totalNightBudgetWh = num(pick(nb, ["totalNightBudgetWh", "totalWh", "budgetWh"], NaN), NaN);

  const availableWh = num(pick(nb, ["availableWh", "availWh", "available_wh", "battery.availableWh"], NaN), NaN);

  const batteryWh = num(pick(nb, [
    "batteryWh", "batWh", "battery_wh",
    "battery.batteryWh",
    "battery.wh", "battery.Wh", "batteryEnergyWh",
    "energy.batteryWh"
  ], NaN), NaN);

  const batteryWhAt5 = num(pick(nb, [
    "batteryWhAt5", "floorWh", "whAt5", "battery_wh_at_5",
    "battery.batteryWhAt5",
    "floor.wh", "batteryFloorWh",
    "batterySafe.floorWh", "battery_safe.floorWh",
    "limits.batteryWhAt5"
  ], NaN), NaN);

  return {
    coveragePct, deficitWh,
    remainingNightHours, pNightSelectedW,
    nightNeedWh, reserveWh, totalNightBudgetWh,
    availableWh, batteryWh, batteryWhAt5
  };
}

function getBatterySafeMode(s) {
  const mode = pick(s, [
    "brain.mode",
    "brain.policy.mode",
    "brain.batterySafe.mode",
    "brain.battery_safe.mode",
    "brain.batterySafeMode",
    "brain.battery_safe_mode",
    "batterySafe.mode",
    "battery_safe.mode",
    "batterySafeMode",
    "battery_safe_mode"
  ], "—");
  return mode || "—";
}

function getEvents(s) {
  const list =
    (Array.isArray(pick(s, ["events"], null)) ? s.events : null) ||
    (Array.isArray(pick(s, ["state.events"], null)) ? s.state.events : null) ||
    (Array.isArray(pick(s, ["brain.events"], null)) ? s.brain.events : null) ||
    (Array.isArray(pick(s, ["brain.eventLog"], null)) ? s.brain.eventLog : null) ||
    [];
  return Array.isArray(list) ? list : [];
}

function getMemoryDays(s) {
  // ESP32: memory = { version, days:[], today:{} }
  const days = pick(s, ["memory.days", "history.days", "days"], []);
  const out = Array.isArray(days) ? [...days] : [];

  const today = pick(s, ["memory.today"], null);
  if (today && typeof today === "object") {
    const key = today.key || today.day || today.date;
    if (key) {
      const merged = {
        key,
        temperature: today.temperature || [],
        light: today.light || [],
        brainRisk: today.brainRisk || [],
        energyIn: today.energyIn || [],
        energyOut: today.energyOut || [],
        totals: today.totals || {}
      };
      const i = out.findIndex(d => (d.key || d.day || d.date) === key);
      if (i >= 0) out[i] = merged;
      else out.push(merged);
    }
  }
  return out;
}

// ---------------------------
// HISTORIE helpers
// ---------------------------
function normalizeSeries(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(p => {
    const t = (p.t !== undefined) ? p.t : (p.ts !== undefined ? p.ts : (p.time !== undefined ? p.time : p.x));
    const v = (p.v !== undefined) ? p.v : (p.value !== undefined ? p.value : p.y);
    return { t, v };
  }).filter(p => p.t !== undefined);
}
function dayToSeries(day) {
  const t1 = normalizeSeries(day.temperature || day.temp || []);
  const l1 = normalizeSeries(day.light || day.lux || []);
  const in1 = normalizeSeries(day.energyIn || day.solar || day.pIn || []);
  const out1 = normalizeSeries(day.energyOut || day.load || day.pOut || []);
  const r1 = normalizeSeries(day.brainRisk || day.risk || []);
  if (t1.length || l1.length || in1.length || out1.length || r1.length) {
    return { temp: t1, light: l1, ein: in1, eout: out1, risk: r1 };
  }

  const samples = Array.isArray(day.samples) ? day.samples : (Array.isArray(day.points) ? day.points : []);
  if (!samples.length) return { temp: [], light: [], ein: [], eout: [], risk: [] };

  const temp = [], light = [], ein = [], eout = [], risk = [];
  for (const p of samples) {
    const ts = p.ts ?? p.t ?? p.time ?? p.x;

    const tempV =
      p.outdoorTempC ?? p.airTempC ?? p.outTempC ?? p.ds18b20C ??
      p.boxTempC ?? p.indoorTempC ?? p.tempC ?? p.temperatureC ?? p.enclosureTempC ?? p.sht40TempC;

    const luxV = p.lux ?? p.lightLux;
    const inV = p.solarW ?? p.pInW ?? p.inW;
    const outV = p.loadW ?? p.pOutW ?? p.outW;
    const riskV = p.risk ?? p.brainRisk;

    if (tempV !== undefined) temp.push({ t: ts, v: tempV });
    if (luxV !== undefined) light.push({ t: ts, v: luxV });
    if (inV !== undefined) ein.push({ t: ts, v: inV });
    if (outV !== undefined) eout.push({ t: ts, v: outV });
    if (riskV !== undefined) risk.push({ t: ts, v: riskV });
  }
  return { temp, light, ein, eout, risk };
}

let selectedDayKey = null;

function populateDaySelect(days) {
  const sel = el("daySelect");
  if (!sel) return;

  const cur = selectedDayKey || "";
  sel.innerHTML = "";

  for (const d of days) {
    const key = d.key || d.day || d.date || "—";
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = key;
    sel.appendChild(opt);
  }

  if (cur && [...sel.options].some(o => o.value === cur)) {
    sel.value = cur;
  } else if (days.length) {
    sel.value = days[days.length - 1].key || days[days.length - 1].day || days[days.length - 1].date;
    selectedDayKey = sel.value;
  }
}

// ---------------------------
// render: TODAY cards
// ---------------------------
function renderTodayCards(s) {
  const w = getWorld(s);

  setText("uiLight", fmt0(w.lux));
  setText("uiSolarPot", fmt1(w.solarPot));

  setText("uiBoxTemp", fmt1(w.boxTemp));
  setText("uiHum", fmt0(w.indoorHum));
  setText("uiOutdoorTemp", fmt1(w.outdoorTemp));

  setText("uiScenario", String(w.scenario || "—"));
  setText("uiPhase", String(w.cyclePhase || "—"));

  const chips = [];
  if (w.raining) chips.push("Déšť");
  if (w.thunder) chips.push("Bouřka");
  if (w.snowing) chips.push("Sníh");
  if (Number.isFinite(w.wind)) chips.push(`Vítr ${fmt1(w.wind)} m/s`);
  setHtml("uiWeatherChips", chips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));

  const bat = getBattery(s);
  setText("uiSoc", Number.isFinite(bat.socPct) ? fmt0(bat.socPct) : "—");

  const e = getEnergy(s);
  setText("uiSolar", Number.isFinite(e.pIn) ? fmt3(e.pIn) : "—");
  setText("uiLoad", Number.isFinite(e.pOut) ? fmt3(e.pOut) : "—");

  // HW FIX: device.fan je boolean
  setText("uiFan", getFanOn(s) ? "ON" : "OFF");

  const mode = getBatterySafeMode(s);         // NORMAL/CAUTION/...
  const isDay = !!pick(s, ["time.isDay"], false); // true/false
  setText("uiBatSafe", mode || (isDay ? "DAY" : "NIGHT"));


  const nb = getNightBudget(s);
  setText("uiCovQuick", Number.isFinite(nb.coveragePct) ? fmt0(nb.coveragePct) : "—");
  setText("uiDefQuick", Number.isFinite(nb.deficitWh) ? fmt1(nb.deficitWh) : "—");

  setText("uiPowerState", powerStateCz(e.powerState));
  setText("uiPowerPath", powerPathCz(e.powerPath));

  // (volitelně) můžeš si v HTML někde zobrazit i isDay, ale UI už má phase
  // const isDay = getIsDay(s);
}

// ---------------------------
// render: Night budget panel
// ---------------------------
function renderNightBudget(s) {  const isDay = !!pick(s, ["time.isDay"], false);
  if (isDay) {
    // ve dne noční panel jen informativně
    setText("uiNightMode", getBatterySafeMode(s));
    setText("uiNightCoverage", "—");
    setText("uiNightDeficit", "—");
    setText("uiNightHours", "—");
    setText("uiNightP", "—");
    setText("uiNightNeed", "—");
    setText("uiNightReserve", "—");
    setText("uiNightTotal", "—");
    setText("uiNightAvail", "—");
    setText("uiNightBat", "—");
    setText("uiNightFloor", "—");
    return;
  }

  const nb = getNightBudget(s);

  setText("uiNightMode", getBatterySafeMode(s));
  setText("uiNightCoverage", Number.isFinite(nb.coveragePct) ? fmt0(nb.coveragePct) : "—");
  setText("uiNightDeficit", Number.isFinite(nb.deficitWh) ? fmt1(nb.deficitWh) : "—");

  setText("uiNightHours", Number.isFinite(nb.remainingNightHours) ? fmt1(nb.remainingNightHours) : "—");
  setText("uiNightP", Number.isFinite(nb.pNightSelectedW) ? fmt3(nb.pNightSelectedW) : "—");

  setText("uiNightNeed", Number.isFinite(nb.nightNeedWh) ? fmt1(nb.nightNeedWh) : "—");
  setText("uiNightReserve", Number.isFinite(nb.reserveWh) ? fmt1(nb.reserveWh) : "—");
  setText("uiNightTotal", Number.isFinite(nb.totalNightBudgetWh) ? fmt1(nb.totalNightBudgetWh) : "—");

  setText("uiNightAvail", Number.isFinite(nb.availableWh) ? fmt1(nb.availableWh) : "—");
  setText("uiNightBat", Number.isFinite(nb.batteryWh) ? fmt1(nb.batteryWh) : "—");
  setText("uiNightFloor", Number.isFinite(nb.batteryWhAt5) ? fmt1(nb.batteryWhAt5) : "—");
}

// ---------------------------
// render: Brain
// ---------------------------
function renderBrain(s) {
  const msgText = pick(s, [
    "brain.dailyMessage",   // ESP32 HW
    "brain.message.text",   // fallback
    "brain.message",
    "brain.msg"
  ], "—");

  const details = pick(s, ["brain.message.details", "brain.details"], []);
  const mode = pick(s, ["brain.mode", "brain.policy.mode"], "—");

  setText("uiMsg", msgText || "—");
  setText("uiDetails", Array.isArray(details) ? details.join(" • ") : String(details || "—"));
  setText("uiModeBadge", mode || "—");

  const risk = num(pick(s, ["brain.risk", "brain.riskScore", "brain.riskPct"], NaN), NaN);
  setText("uiRisk", Number.isFinite(risk) ? fmt0(risk) : "—");
  const bar = el("uiRiskBar");
  if (bar && Number.isFinite(risk)) bar.style.width = `${clamp(risk, 0, 100)}%`;

  setText("uiBatHours", fmt1(num(pick(s, ["brain.battery.hours", "brain.batteryHours"], NaN), NaN)));
  setText("uiSunLine", String(pick(s, ["brain.time.hoursToSunset", "brain.hoursToSunset", "hoursToSunsetEst"], "—")));
  setText("uiSunHint", String(pick(s, ["brain.solar.untilSunsetWh", "brain.solarRemainingWhToSunset", "solarRemainingWhToSunset"], "—")));

  const chips = [];
  const bs = getBatterySafeMode(s);
  if (bs && bs !== "—") chips.push(`Režim: ${bs}`);
  const cov = num(pick(s, ["brain.nightBudget.coveragePct", "nightBudget.coveragePct"], NaN), NaN);
  if (Number.isFinite(cov)) chips.push(`Noční bilance: ${fmt0(cov)}%`);
  setHtml("uiBrainChips", chips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(""));
}

// ---------------------------
// render: Energy tab
// ---------------------------
function renderEnergyTab(s) {
  const e = getEnergy(s);
  const bat = getBattery(s);

  setText("uiSolar2", Number.isFinite(e.pIn) ? fmt3(e.pIn) : "—");
  setText("uiLoad2", Number.isFinite(e.pOut) ? fmt3(e.pOut) : "—");
  setText("uiSolarEma", Number.isFinite(e.pInEma) ? fmt3(e.pInEma) : "—");
  setText("uiLoadEma", Number.isFinite(e.pOutEma) ? fmt3(e.pOutEma) : "—");

  setText("uiSoc2", Number.isFinite(bat.socPct) ? fmt0(bat.socPct) : "—");

  setText("uiSocEst", Number.isFinite(e.socEst) ? `${fmt0(e.socEst * 100)} %` : "—");
  setText("uiSocConf", Number.isFinite(e.socConf) ? `${fmt0(e.socConf * 100)} %` : "—");

  setText("uiPowerState2", powerStateCz(e.powerState));
  setText("uiPowerPath2", powerPathCz(e.powerPath));

  setText("uiQIn", fmtQ(e.qIn));
  setText("uiQOut", fmtQ(e.qOut));

  setText("uiDeadband", Number.isFinite(e.deadbandW) ? fmt3(e.deadbandW) : "—");

  setText("uiWhInToday", Number.isFinite(e.whInToday) ? fmt1(e.whInToday) : "—");
  setText("uiWhOutToday", Number.isFinite(e.whOutToday) ? fmt1(e.whOutToday) : "—");
  setText("uiWhNetToday", Number.isFinite(e.whNetToday) ? fmt1(e.whNetToday) : "—");

  setText("uiWhIn24h", Number.isFinite(e.whIn24) ? fmt1(e.whIn24) : "—");
  setText("uiWhOut24h", Number.isFinite(e.whOut24) ? fmt1(e.whOut24) : "—");
  setText("uiWhNet24h", Number.isFinite(e.whNet24) ? fmt1(e.whNet24) : "—");

  setText("uiBatHint", (Number.isFinite(e.pIn) && Number.isFinite(e.pOut)) ? `Net: ${fmt3(e.pIn - e.pOut)} W` : "—");
}

// ---------------------------
// render: History charts
// ---------------------------
function renderHistory(s) {
  ensureCharts();

  const days = getMemoryDays(s);
  populateDaySelect(days);

  const sel = el("daySelect");
  if (sel) selectedDayKey = sel.value || selectedDayKey;

  const dayObj =
    days.find(d => (d.key || d.day || d.date) === selectedDayKey) ||
    days[days.length - 1] ||
    null;

  setText("dayInfo", dayObj ? String(dayObj.key || dayObj.day || dayObj.date) : "—");

  const series = dayObj ? dayToSeries(dayObj) : { temp: [], light: [], ein: [], eout: [], risk: [] };

  const tempLabels = series.temp.map(p => toLocalTimeLabel(p.t));
  const powerLabels = (series.ein.length ? series.ein : series.eout).map(p => toLocalTimeLabel(p.t));
  const lightLabels = series.light.map(p => toLocalTimeLabel(p.t));
  const riskLabels = series.risk.map(p => toLocalTimeLabel(p.t));

  updateLineChart(chartTemp, tempLabels, [
    { label: "Venkovní teplota (°C)", data: series.temp.map(p => num(p.v)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartPower, powerLabels, [
    { label: "Solár (W)", data: series.ein.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 },
    { label: "Zátěž (W)", data: series.eout.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartLight, lightLabels, [
    { label: "Světlo (lx)", data: series.light.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  updateLineChart(chartBrainRisk, riskLabels, [
    { label: "Riziko", data: series.risk.map(p => num(p.v, 0)), borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  const last7 = days.slice(-7);
  const labels = last7.map(d => d.key || d.day || d.date || "—");

  const mins = last7.map(d => {
    const arr = dayToSeries(d).temp.map(p => num(p.v)).filter(Number.isFinite);
    return arr.length ? Math.min(...arr) : NaN;
  });
  const maxs = last7.map(d => {
    const arr = dayToSeries(d).temp.map(p => num(p.v)).filter(Number.isFinite);
    return arr.length ? Math.max(...arr) : NaN;
  });

  updateLineChart(chartWeekTemp, labels, [
    { label: "Min (°C)", data: mins, borderWidth: 2, pointRadius: 0, tension: 0.2 },
    { label: "Max (°C)", data: maxs, borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  const balances = last7.map(d => {
    const t = d.totals || d.total || {};
    const inWh = num(pick(t, ["energyInWh", "whIn", "inWh"], NaN), NaN);
    const outWh = num(pick(t, ["energyOutWh", "whOut", "outWh"], NaN), NaN);
    if (Number.isFinite(inWh) && Number.isFinite(outWh)) return inWh - outWh;
    return NaN;
  });

  updateLineChart(chartWeekEnergy, labels, [
    { label: "Bilance (Wh)", data: balances, borderWidth: 2, pointRadius: 0, tension: 0.2 }
  ]);

  const headline = dayObj
    ? `Záznamy: T=${series.temp.length}, L=${series.light.length}, IN=${series.ein.length}, OUT=${series.eout.length}`
    : "—";
  setText("daySummaryHeadline", headline);
}

// ---------------------------
// render: Events tab
// ---------------------------
function renderEventsTab(s) {
  const arr = getEvents(s);

  if (arr.length === 0) {
    setHtml("eventsList", `<div class="muted">— žádné události —</div>`);
    return;
  }

  const items = [...arr].slice(-200).reverse().map(ev => {
    const ts = num(ev.ts, NaN);
    const when = Number.isFinite(ts) ? new Date(ts).toLocaleString("cs-CZ") : (ev.t ? escapeHtml(ev.t) : "—");

    const key = ev.key || ev.type || ev.kind || "event";
    const action = ev.action || "";
    const level = ev.level || "";

    const titleParts = [key, action, level].filter(Boolean).map(x => String(x).toUpperCase());
    const title = escapeHtml(titleParts.join(" • ") || String(key));

    const msg = escapeHtml(ev.message || ev.msg || ev.text || "");
    const meta = ev.meta ? escapeHtml(JSON.stringify(ev.meta)) : "";

    return `
      <div class="tlItem">
        <div class="tlTime">${when}</div>
        <div class="tlBody">
          <div class="tlTitle">${title}</div>
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
  renderHistory(s);
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
      setText("statusText", `Dashboard • ${new Date(getNowTs(s)).toLocaleString("cs-CZ")} • UI ${UI_VERSION}`);
      render(s);
    } catch (e) {
      setText("statusText", `Dashboard • chyba: ${e.message} • UI ${UI_VERSION}`);
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

    setTimeout(resizeAllCharts, 80);
  };

  tabs.forEach(btn => btn.addEventListener("click", () => activate(btn.getAttribute("data-tab"))));
}

function setupHistoryControls() {
  const sel = el("daySelect");
  const prev = el("btnDayPrev");
  const next = el("btnDayNext");

  const step = (dir) => {
    const s = sel;
    if (!s || s.options.length === 0) return;
    const i = s.selectedIndex;
    const ni = clamp(i + dir, 0, s.options.length - 1);
    s.selectedIndex = ni;
    selectedDayKey = s.value;
  };

  if (sel) sel.addEventListener("change", () => { selectedDayKey = sel.value; });
  if (prev) prev.addEventListener("click", () => step(-1));
  if (next) next.addEventListener("click", () => step(1));
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
      setText("statusText", `Dashboard • backend uložen • UI ${UI_VERSION}`);
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
  setupHistoryControls();
  setupSettings();

  const q = getBackendFromQuery();
  if (q) setBackend(q);

  startLoop();
})();
