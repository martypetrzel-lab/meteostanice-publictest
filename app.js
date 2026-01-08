/* UI Prototype – reads /state from configured backend */

const DEFAULT_RAILWAY = "https://meteostanice-simulator-node-production.up.railway.app";

function $(id){ return document.getElementById(id); }

function fmt(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (typeof v !== "number") return String(v);
  return v.toFixed(digits);
}

function safeGet(obj, path, fallback = null) {
  try {
    return path.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeBaseUrl(u) {
  if (!u) return "";
  return String(u).trim().replace(/\/+$/, "");
}

function isGithubPages() {
  return /github\.io$/i.test(location.hostname);
}

function getApiBase() {
  // 1) query param ?api=
  const params = new URLSearchParams(location.search);
  const qp = normalizeBaseUrl(params.get("api") || "");
  if (qp) return qp;

  // 2) localStorage
  const ls = normalizeBaseUrl(localStorage.getItem("api_base") || "");
  if (ls) return ls;

  // 3) auto default: když běžím na GitHub Pages, použij Railway
  if (isGithubPages()) return DEFAULT_RAILWAY;

  // 4) jinak same-origin
  return "";
}

let API_BASE = "";
let els = null;

// --- Time formatting (real vs simulated) ---
const PRAGUE_TZ = "Europe/Prague";

function fmtTimePrague(dateObj) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      timeZone: PRAGUE_TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(dateObj);
  } catch {
    // fallback – pokud by Intl/timeZone nebylo k dispozici
    return dateObj.toLocaleTimeString("cs-CZ", { hour12: false });
  }
}

function fmtTimeFromMsPrague(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  return fmtTimePrague(new Date(Number(ms)));
}

// --- Chart.js guarded ---
let tempChart = null;
let powerChart = null;

function ensureCharts() {
  if (typeof Chart === "undefined") {
    if (els?.chartHintTemp) els.chartHintTemp.textContent = "Grafy: Chart.js se nenačetl (CDN). UI běží dál.";
    if (els?.chartHintPower) els.chartHintPower.textContent = "Grafy: Chart.js se nenačetl (CDN). UI běží dál.";
    return;
  }

  if (!tempChart && $("chartTemp")) {
    tempChart = new Chart($("chartTemp").getContext("2d"), {
      type: "line",
      data: { labels: [], datasets: [{ label: "Teplota (°C)", data: [] }] },
      options: { responsive: true, animation: false }
    });
    if (els?.chartHintTemp) els.chartHintTemp.textContent = "";
  }

  if (!powerChart && $("chartPower")) {
    powerChart = new Chart($("chartPower").getContext("2d"), {
      type: "line",
      data: { labels: [], datasets: [{ label: "Solár (W)", data: [] }, { label: "Zátěž (W)", data: [] }] },
      options: { responsive: true, animation: false }
    });
    if (els?.chartHintPower) els.chartHintPower.textContent = "";
  }
}

function updateCharts(state) {
  ensureCharts();
  if (!tempChart || !powerChart) return;

  const memT = safeGet(state, "memory.today.temperature", []);
  const memIn = safeGet(state, "memory.today.energyIn", []);
  const memOut = safeGet(state, "memory.today.energyOut", []);

  const N = 240;
  const tSlice = memT.slice(-N);
  const inSlice = memIn.slice(-N);
  const outSlice = memOut.slice(-N);

  tempChart.data.labels = tSlice.map(p => p.t);
  tempChart.data.datasets[0].data = tSlice.map(p => p.v);
  tempChart.update();

  powerChart.data.labels = inSlice.map(p => p.t);
  powerChart.data.datasets[0].data = inSlice.map(p => p.v);
  powerChart.data.datasets[1].data = outSlice.map(p => p.v);
  powerChart.update();
}

function apiUrl(path) {
  return API_BASE ? (API_BASE + path) : path;
}

function setApiBase(newBase) {
  API_BASE = normalizeBaseUrl(newBase);
  if (API_BASE) localStorage.setItem("api_base", API_BASE);
  else localStorage.removeItem("api_base");
  if (els?.backendUrl) els.backendUrl.value = API_BASE;
}

function setPill(text, level) {
  els.pillStatus.textContent = text || "—";
  els.pillStatus.classList.remove("ok", "warn", "bad");
  if (level) els.pillStatus.classList.add(level);
}

function setIcons(state, ok) {
  const isDay = !!safeGet(state, "time.isDay", true);
  els.icoDay.textContent = isDay ? "☀️" : "🌙";
  els.icoWifi.textContent = ok ? "📶" : "❌";

  const socPct = safeGet(state, "device.socPct", Math.round((safeGet(state, "device.battery.soc", 0) * 100)));
  if (socPct >= 70) els.icoBattery.textContent = "🔋";
  else if (socPct >= 30) els.icoBattery.textContent = "🪫";
  else els.icoBattery.textContent = "🟥";

  const fan = !!safeGet(state, "device.fan", false);
  els.icoFan.textContent = fan ? "🌀" : "💤";
}

function computeFallbacks(state) {
  const light = safeGet(state, "world.environment.light", safeGet(state, "device.light", null));
  const temp = safeGet(state, "world.environment.temperature", safeGet(state, "device.temperature", null));

  const socPct = safeGet(
    state, "device.socPct",
    Math.round((safeGet(state, "device.battery.soc", 0) * 100))
  );

  const solarW = safeGet(state, "device.solarInW", safeGet(state, "device.power.solarInW", null));
  const loadW  = safeGet(state, "device.loadW",    safeGet(state, "device.power.loadW", null));

  return { light, temp, socPct, solarW, loadW };
}

function render(state, ok = true) {
  const adv = els.toggleAdvanced.checked;
  const { light, temp, socPct, solarW, loadW } = computeFallbacks(state);

  // --- time: real vs sim ---
  const realNow = fmtTimePrague(new Date());
  const simMs = safeGet(state, "time.now", null);
  const simNow = fmtTimeFromMsPrague(simMs);

  const baseInfo = API_BASE ? `API: ${API_BASE}` : "API: same-origin";
  els.subtitle.textContent = `Reálný čas: ${realNow} • Sim: ${simNow} • ${baseInfo}`;

  // pill
  if (!ok) setPill("OFFLINE – nejde /state", "bad");
  else {
    const msg = state?.message || "OK";
    const level =
      /přehř|overheat|krit/i.test(msg) ? "bad" :
      /šetř|risk|nízk/i.test(msg) ? "warn" : "ok";
    setPill(msg, level);
  }

  setIcons(state, ok);

  els.envLight.textContent = fmt(Number(light), 0);
  els.envTemp.textContent  = adv ? fmt(Number(temp), 2) : fmt(Number(temp), 1);

  els.socPct.textContent   = fmt(Number(socPct), 0);
  els.solarW.textContent   = adv ? fmt(Number(solarW), 3) : fmt(Number(solarW), 2);
  els.loadW.textContent    = adv ? fmt(Number(loadW), 3)  : fmt(Number(loadW), 2);

  els.fanState.textContent = safeGet(state, "device.fan", false) ? "ZAPNUTÝ" : "VYPNUTÝ";
  els.fanReason.textContent = state?.message ? `Důvod: ${state.message}` : "Důvod: —";

  els.brainMsg.textContent = state?.message || "—";
  const details = Array.isArray(state?.details) ? state.details : [];
  els.brainDetails.innerHTML = details.slice(0, adv ? 8 : 4).map(d => `<li>${d}</li>`).join("");

  // energy hint
  const inWh  = safeGet(state, "memory.today.totals.energyInWh", null);
  const outWh = safeGet(state, "memory.today.totals.energyOutWh", null);
  if (inWh !== null && outWh !== null) {
    const bal = Number(inWh) - Number(outWh);
    els.energyHint.textContent = adv
      ? `Dnes: In ${fmt(Number(inWh), 3)} Wh • Out ${fmt(Number(outWh), 3)} Wh • Bilance ${fmt(bal, 3)} Wh`
      : `Dnes bilance: ${fmt(bal, 2)} Wh`;
  } else {
    els.energyHint.textContent = "Bilance dne: —";
  }

  // flow
  els.flowSolar.textContent = adv ? fmt(Number(solarW), 3) : fmt(Number(solarW), 2);
  els.flowSoc.textContent   = fmt(Number(socPct), 0);
  els.flowLoad.textContent  = adv ? fmt(Number(loadW), 3)  : fmt(Number(loadW), 2);
  els.flowNet.textContent   = `Net: ${adv ? fmt(Number(solarW) - Number(loadW), 3) : fmt(Number(solarW) - Number(loadW), 2)} W`;

  // prediction
  const pred = state?.prediction;
  if (pred) {
    els.predNet.textContent   = adv ? fmt(Number(pred.netW), 3) : fmt(Number(pred.netW), 2);
    els.predSolar.textContent = fmt(Number(pred.expectedSolarWh), 2);
    els.predHours.textContent = pred.hoursLeft === null ? "∞ (net > 0)" : `${fmt(Number(pred.hoursLeft), 2)} h`;
  } else {
    els.predNet.textContent = "—";
    els.predSolar.textContent = "—";
    els.predHours.textContent = "—";
  }

  // raw
  if (els.toggleRaw.checked) {
    els.rawJson.classList.remove("hidden");
    els.rawJson.textContent = JSON.stringify(state, null, 2);
  } else {
    els.rawJson.classList.add("hidden");
  }

  updateCharts(state);
}

async function fetchState() {
  try {
    const r = await fetch(apiUrl("/state"), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const state = await r.json();
    render(state, true);
  } catch (e) {
    render({ message: "OFFLINE – nelze načíst /state" }, false);
  }
}

let timer = null;
function restartLoop() {
  if (timer) clearInterval(timer);
  const ms = Number(els.refreshSelect.value || 1000);
  fetchState();
  timer = setInterval(fetchState, ms);
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function loadSettings() {
  els.toggleAdvanced.checked = (localStorage.getItem("ui_adv") === "1");
  els.toggleRaw.checked = (localStorage.getItem("ui_raw") === "1");
  els.refreshSelect.value = localStorage.getItem("ui_refresh") || "1000";

  setApiBase(getApiBase());
  els.backendStatus.textContent = API_BASE ? `Používám: ${API_BASE}` : "Používám: same-origin";
}

function bindSettings() {
  els.toggleAdvanced.addEventListener("change", () => {
    localStorage.setItem("ui_adv", els.toggleAdvanced.checked ? "1" : "0");
  });

  els.toggleRaw.addEventListener("change", () => {
    localStorage.setItem("ui_raw", els.toggleRaw.checked ? "1" : "0");
  });

  els.refreshSelect.addEventListener("change", () => {
    localStorage.setItem("ui_refresh", String(els.refreshSelect.value));
    restartLoop();
  });

  els.btnSaveBackend.addEventListener("click", () => {
    setApiBase(els.backendUrl.value);
    els.backendStatus.textContent = API_BASE ? `Uloženo: ${API_BASE}` : "Uloženo: same-origin";
    restartLoop();
  });

  els.btnTestBackend.addEventListener("click", async () => {
    const base = normalizeBaseUrl(els.backendUrl.value);
    const url = (base ? base : "") + "/health";
    els.backendStatus.textContent = `Testuji: ${url}`;

    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      els.backendStatus.textContent = `OK: ${j.version || "health"} • now=${j.now ?? "?"}`;
    } catch {
      els.backendStatus.textContent = "CHYBA: /health nedostupné (URL nebo CORS)";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  els = {
    subtitle: $("subtitle"),
    pillStatus: $("pillStatus"),
    icoDay: $("icoDay"),
    icoWifi: $("icoWifi"),
    icoBattery: $("icoBattery"),
    icoFan: $("icoFan"),

    envLight: $("envLight"),
    envTemp: $("envTemp"),
    socPct: $("socPct"),
    solarW: $("solarW"),
    loadW: $("loadW"),
    energyHint: $("energyHint"),

    fanState: $("fanState"),
    fanBadge: $("fanBadge"),
    fanReason: $("fanReason"),

    brainMsg: $("brainMsg"),
    brainDetails: $("brainDetails"),

    flowSolar: $("flowSolar"),
    flowSoc: $("flowSoc"),
    flowLoad: $("flowLoad"),
    flowNet: $("flowNet"),

    predNet: $("predNet"),
    predHours: $("predHours"),
    predSolar: $("predSolar"),

    backendUrl: $("backendUrl"),
    btnSaveBackend: $("btnSaveBackend"),
    btnTestBackend: $("btnTestBackend"),
    backendStatus: $("backendStatus"),

    toggleAdvanced: $("toggleAdvanced"),
    refreshSelect: $("refreshSelect"),
    toggleRaw: $("toggleRaw"),
    rawJson: $("rawJson"),

    chartHintTemp: $("chartHintTemp"),
    chartHintPower: $("chartHintPower"),
  };

  setupTabs();
  loadSettings();
  bindSettings();
  restartLoop();
});
