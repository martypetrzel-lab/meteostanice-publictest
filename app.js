/* UI Prototype – reads /state from configured backend */

const $ = (id) => document.getElementById(id);

const els = {
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

  historyList: $("historyList"),
  weeksList: $("weeksList"),

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
};

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
  u = String(u).trim();
  if (!u) return "";
  // remove trailing slash
  u = u.replace(/\/+$/, "");
  return u;
}

function getApiBase() {
  // 1) query param ?api=
  const params = new URLSearchParams(location.search);
  const qp = normalizeBaseUrl(params.get("api") || "");
  if (qp) return qp;

  // 2) localStorage
  const ls = normalizeBaseUrl(localStorage.getItem("api_base") || "");
  if (ls) return ls;

  // 3) same origin fallback (works on Railway where /state exists)
  return "";
}

let API_BASE = getApiBase();

function setApiBase(newBase) {
  API_BASE = normalizeBaseUrl(newBase);
  if (API_BASE) localStorage.setItem("api_base", API_BASE);
  else localStorage.removeItem("api_base");
  els.backendUrl.value = API_BASE;
}

function apiUrl(path) {
  // if API_BASE empty => same-origin
  if (!API_BASE) return path;
  return API_BASE + path;
}

function setStatusPill(state) {
  els.pillStatus.textContent = state?.message || "—";
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

  const socPct =
    safeGet(state, "device.socPct",
      Math.round((safeGet(state, "device.battery.soc", null) ?? 0) * 100)
    );

  const solarW = safeGet(state, "device.solarInW", safeGet(state, "device.power.solarInW", null));
  const loadW = safeGet(state, "device.loadW", safeGet(state, "device.power.loadW", null));

  return { light, temp, socPct, solarW, loadW };
}

/* -------- Charts -------- */
let tempChart, powerChart;

function ensureCharts() {
  if (!tempChart) {
    const ctx = $("chartTemp").getContext("2d");
    tempChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Teplota (°C)", data: [] }] },
      options: { responsive: true, animation: false, scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { ticks: { maxTicksLimit: 6 } } } }
    });
  }
  if (!powerChart) {
    const ctx = $("chartPower").getContext("2d");
    powerChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Solár (W)", data: [] }, { label: "Zátěž (W)", data: [] }] },
      options: { responsive: true, animation: false, scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { ticks: { maxTicksLimit: 6 } } } }
    });
  }
}

function updateCharts(state) {
  ensureCharts();
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

/* -------- Tabs -------- */
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

/* -------- Rendering -------- */
function render(state, ok = true) {
  const adv = els.toggleAdvanced.checked;
  const { light, temp, socPct, solarW, loadW } = computeFallbacks(state);

  const baseInfo = API_BASE ? `API: ${API_BASE}` : "API: same-origin";
  els.subtitle.textContent = `Dashboard • ${baseInfo} • ${ok ? "OK" : "chyba"} • ${new Date().toLocaleTimeString()}`;

  setStatusPill(state);
  setIcons(state, ok);

  els.envLight.textContent = fmt(Number(light), 0);
  els.envTemp.textContent = adv ? fmt(Number(temp), 2) : fmt(Number(temp), 1);

  els.socPct.textContent = fmt(Number(socPct), 0);
  els.solarW.textContent = adv ? fmt(Number(solarW), 3) : fmt(Number(solarW), 2);
  els.loadW.textContent = adv ? fmt(Number(loadW), 3) : fmt(Number(loadW), 2);

  const inWh = safeGet(state, "memory.today.totals.energyInWh", null);
  const outWh = safeGet(state, "memory.today.totals.energyOutWh", null);
  if (inWh !== null && outWh !== null) {
    const bal = Number(inWh) - Number(outWh);
    els.energyHint.textContent = adv
      ? `Dnes: In ${fmt(Number(inWh), 3)} Wh • Out ${fmt(Number(outWh), 3)} Wh • Bilance ${fmt(bal, 3)} Wh`
      : `Dnes bilance: ${fmt(bal, 2)} Wh`;
  } else {
    els.energyHint.textContent = "Bilance dne: —";
  }

  const fan = !!safeGet(state, "device.fan", false);
  els.fanState.textContent = fan ? "ZAPNUTÝ" : "VYPNUTÝ";
  els.fanReason.textContent = state?.message ? `Důvod: ${state.message}` : "Důvod: —";

  els.brainMsg.textContent = state?.message || "—";
  const details = Array.isArray(state?.details) ? state.details : [];
  els.brainDetails.innerHTML = details.slice(0, adv ? 8 : 4).map(d => `<li>${d}</li>`).join("");

  els.flowSolar.textContent = adv ? fmt(Number(solarW), 3) : fmt(Number(solarW), 2);
  els.flowSoc.textContent = fmt(Number(socPct), 0);
  els.flowLoad.textContent = adv ? fmt(Number(loadW), 3) : fmt(Number(loadW), 2);
  const netW = (Number(solarW) - Number(loadW));
  els.flowNet.textContent = `Net: ${adv ? fmt(netW, 3) : fmt(netW, 2)} W`;

  const pred = state?.prediction;
  if (pred) {
    els.predNet.textContent = adv ? fmt(Number(pred.netW), 3) : fmt(Number(pred.netW), 2);
    els.predSolar.textContent = fmt(Number(pred.expectedSolarWh), 2);
    els.predHours.textContent = pred.hoursLeft === null ? "∞ (net > 0)" : `${fmt(Number(pred.hoursLeft), 2)} h`;
  } else {
    els.predNet.textContent = "—";
    els.predSolar.textContent = "—";
    els.predHours.textContent = "—";
  }

  const days = safeGet(state, "memory.days", []);
  els.historyList.innerHTML = (days && days.length)
    ? days.slice(-14).reverse().map(d => {
        const key = d.key || "—";
        const stats = d.stats || {};
        const minT = stats.minT ?? null;
        const maxT = stats.maxT ?? null;
        const avgT = stats.avgT ?? null;

        const totals = d.totals || {};
        const inWhD = totals.energyInWh ?? null;
        const outWhD = totals.energyOutWh ?? null;
        const bal = (inWhD !== null && outWhD !== null) ? (Number(inWhD) - Number(outWhD)) : null;

        const meta =
          (minT !== null && maxT !== null && avgT !== null)
            ? `T: ${fmt(Number(minT),1)} / ${fmt(Number(maxT),1)} • avg ${fmt(Number(avgT),1)}`
            : `vzorků: ${(d.temperature || []).length}`;

        const right = bal !== null ? `Bilance: ${fmt(bal, 2)} Wh` : "—";

        return `
          <div class="rowitem">
            <div class="left">
              <div class="date">${key}</div>
              <div class="meta">${meta}</div>
            </div>
            <div class="right">${right}</div>
          </div>
        `;
      }).join("")
    : `<div class="hint">Zatím žádná historie (memory.days je prázdné).</div>`;

  const weeks = safeGet(state, "memory.weeks", []);
  els.weeksList.innerHTML = (weeks && weeks.length)
    ? weeks.slice(-12).reverse().map(w => {
        const key = w.key || "—";
        const meta = (w.minT !== null && w.maxT !== null)
          ? `T: ${fmt(Number(w.minT),1)} / ${fmt(Number(w.maxT),1)} • avg ${fmt(Number(w.avgT),1)}`
          : "—";
        const bal = (w.energyInWh !== undefined && w.energyOutWh !== undefined)
          ? (Number(w.energyInWh) - Number(w.energyOutWh))
          : null;
        const right = bal !== null ? `Bilance: ${fmt(bal, 2)} Wh` : "—";

        return `
          <div class="rowitem">
            <div class="left">
              <div class="date">${key}</div>
              <div class="meta">${meta}</div>
            </div>
            <div class="right">${right}</div>
          </div>
        `;
      }).join("")
    : `<div class="hint">Týdny nejsou k dispozici (memory.weeks chybí nebo je prázdné).</div>`;

  updateCharts(state);

  if (els.toggleRaw.checked) {
    els.rawJson.classList.remove("hidden");
    els.rawJson.textContent = JSON.stringify(state, null, 2);
  } else {
    els.rawJson.classList.add("hidden");
  }
}

/* -------- Fetch loop -------- */
let timer = null;

async function fetchState() {
  try {
    const r = await fetch(apiUrl("/state"), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const state = await r.json();
    render(state, true);
  } catch (e) {
    render({}, false);
  }
}

function restartLoop() {
  if (timer) clearInterval(timer);
  const ms = Number(els.refreshSelect.value || 1000);
  fetchState();
  timer = setInterval(fetchState, ms);
}

/* -------- Settings persistence -------- */
function loadSettings() {
  const adv = localStorage.getItem("ui_adv") === "1";
  const raw = localStorage.getItem("ui_raw") === "1";
  const ms = localStorage.getItem("ui_refresh") || "1000";

  els.toggleAdvanced.checked = adv;
  els.toggleRaw.checked = raw;
  els.refreshSelect.value = ms;

  // api base
  setApiBase(getApiBase());
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
    const v = normalizeBaseUrl(els.backendUrl.value);
    setApiBase(v);
    els.backendStatus.textContent = API_BASE ? `Uloženo: ${API_BASE}` : "Uloženo: same-origin";
    restartLoop();
  });

  els.btnTestBackend.addEventListener("click", async () => {
    const base = normalizeBaseUrl(els.backendUrl.value);
    const url = (base ? base : "") + "/health";
    els.backendStatus.textContent = "Testuji…";
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      els.backendStatus.textContent = `OK: ${j.version || "health"} • persistent=${j.persistent ?? "?"}`;
    } catch {
      els.backendStatus.textContent = "Chyba: nejde /health (URL nebo CORS)";
    }
  });
}

/* init */
setupTabs();
loadSettings();
bindSettings();
restartLoop();
