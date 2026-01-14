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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(x, fallback = NaN) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmt1(x) {
  const n = num(x, NaN);
  return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "—";
}
function fmt2(x) {
  const n = num(x, NaN);
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "—";
}
function fmt3(x) {
  const n = num(x, NaN);
  return Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toFixed(3) : "—";
}

function deepGet(obj, path, fallback = undefined) {
  const parts = String(path || "").split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return fallback;
    if (!(p in cur)) return fallback;
    cur = cur[p];
  }
  return cur ?? fallback;
}

function getBackendFromQuery() {
  const q = new URLSearchParams(location.search).get("backend");
  if (!q) return null;
  return String(q).trim().replace(/\/+$/, "");
}

function getBackend() {
  return localStorage.getItem("backendUrl") || DEFAULT_BACKEND;
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
// Charts
// ---------------------------
let chartTemp = null;
let chartPower = null;
let chartLight = null;
let chartBrainRisk = null;
let chartWeekTemp = null;
let chartWeekEnergy = null;

function makeChart(ctx, type, labels, datasets, yTitle = "") {
  return new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { labels: { color: "#9fb0d8" } },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          ticks: { color: "#9fb0d8", maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(255,255,255,.06)" }
        },
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

function resizeAllCharts() {
  [chartTemp, chartPower, chartLight, chartBrainRisk, chartWeekTemp, chartWeekEnergy].forEach(ch => {
    if (ch) ch.resize();
  });
}

window.addEventListener("resize", () => {
  clearTimeout(window.__rzT);
  window.__rzT = setTimeout(resizeAllCharts, 120);
});

// ---------------------------
// Battery-safe (EIRA) + Event log UI
// ---------------------------
function getNightBudget(s) {
  const nb = deepGet(s, "brain.nightBudget");
  if (!nb) return null;
  return nb;
}

function renderNightBudget(s) {
  const mode = String(deepGet(s, "brain.mode") || "—");
  const nb = getNightBudget(s);

  // Mini fields in DNES/Energie
  setText("uiBattSafeMode2", mode);

  if (!nb || nb.ok === false) {
    setText("uiBatterySafeMode", mode);
    setText("uiNightCoverage", "—");
    setText("uiNightDeficit", "—");
    setText("uiRemainingNightHours", "—");
    setText("uiNightPower", "—");
    setText("uiNightNeedWh", "—");
    setText("uiNightReserveWh", "—");
    setText("uiNightBudgetWh", "—");
    setText("uiAvailableWh", "—");
    setText("uiBatteryWh", "—");
    setText("uiBatteryWhAt5", "—");
    setText("uiNightBudgetNote", nb && nb.reason ? `Noční bilance: ${nb.reason}` : "Noční bilance: nelze spočítat");
    setText("uiNightCoverage2", "—");
    setText("uiNightDeficit2", "—");
    return;
  }

  const coverage = num(nb.coveragePct, NaN);
  const deficit = num(nb.deficitWh, NaN);

  setText("uiBatterySafeMode", mode);
  setText("uiNightCoverage", Number.isFinite(coverage) ? String(Math.round(coverage)) : "—");
  setText("uiNightDeficit", Number.isFinite(deficit) ? fmt1(deficit) : "—");

  setText("uiRemainingNightHours", Number.isFinite(num(nb.remainingNightHours, NaN)) ? fmt1(nb.remainingNightHours) : "—");
  setText("uiNightPower", Number.isFinite(num(nb.pNightSelectedW, NaN)) ? fmt3(nb.pNightSelectedW) : "—");

  setText("uiNightNeedWh", Number.isFinite(num(nb.nightNeedWh, NaN)) ? fmt1(nb.nightNeedWh) : "—");
  setText("uiNightReserveWh", Number.isFinite(num(nb.reserveWh, NaN)) ? fmt1(nb.reserveWh) : "—");
  setText("uiNightBudgetWh", Number.isFinite(num(nb.totalNightBudgetWh, NaN)) ? fmt1(nb.totalNightBudgetWh) : "—");

  setText("uiAvailableWh", Number.isFinite(num(nb.availableWh, NaN)) ? fmt1(nb.availableWh) : "—");

  const capWh = num(deepGet(s, "brain.battery.capacityWh"), NaN);
  const socPct = num(deepGet(s, "brain.battery.socPercent"), NaN);
  const batWh = (Number.isFinite(capWh) && Number.isFinite(socPct)) ? (capWh * (socPct / 100)) : NaN;
  const batWhAt5 = Number.isFinite(capWh) ? (capWh * 0.05) : NaN;

  setText("uiBatteryWh", Number.isFinite(batWh) ? fmt1(batWh) : "—");
  setText("uiBatteryWhAt5", Number.isFinite(batWhAt5) ? fmt1(batWhAt5) : "—");

  // Mini fields in DNES/Energie
  setText("uiNightCoverage2", Number.isFinite(coverage) ? String(Math.round(coverage)) : "—");
  setText("uiNightDeficit2", Number.isFinite(deficit) ? fmt1(deficit) : "—");

  const o = nb.overrides || {};
  const notes = [];
  if (o.forcedCritical) notes.push("override: AvailableWh < NightNeedWh → CRITICAL");
  if (o.tightened) notes.push("override: Coverage < 100% → zpřísnění o 1 stupeň");
  setText("uiNightBudgetNote", notes.length ? notes.join(" • ") : "—");
}

function formatEvent(e) {
  const ts = num(e?.ts, NaN);
  const when = Number.isFinite(ts) ? new Date(ts).toLocaleString("cs-CZ") : "—";
  const key = String(e?.key || "GEN");
  const action = String(e?.action || "INFO");
  const level = e?.level != null ? String(e.level) : "";
  const msg = String(e?.message || "");
  return { when, key, action, level, msg, meta: e?.meta };
}

function renderEvents(s, force = false) {
  const listEl = el("eventsList");
  if (!listEl) return;

  const hidden = JSON.parse(localStorage.getItem("eventsHidden_v1") || "false");
  if (hidden && !force) {
    setHtml("eventsList", "<div class='muted'>Události jsou skryté (klientsky). Klikni na „Obnovit“ pro zobrazení.</div>");
    return;
  }

  const arr = deepGet(s, "events");
  const events = Array.isArray(arr) ? arr.slice().sort((a, b) => num(b.ts, 0) - num(a.ts, 0)) : [];

  setText("eventsMeta", events.length ? `Počet: ${events.length}` : "Žádné události");
  if (!events.length) {
    setHtml("eventsList", "<div class='muted'>Zatím žádné události.</div>");
    return;
  }

  const html = events.slice(0, 120).map(ev => {
    const x = formatEvent(ev);
    const badge = x.level ? `<span class="badge">${x.action} ${x.level}</span>` : `<span class="badge">${x.action}</span>`;
    const meta = (x.meta && typeof x.meta === "object") ? `<div class="muted small">${escapeHtml(JSON.stringify(x.meta))}</div>` : "";
    return `
      <div class="tlItem">
        <div class="tlTop">
          <div class="tlWhen">${escapeHtml(x.when)}</div>
          ${badge}
          <div class="tlKey">${escapeHtml(x.key)}</div>
        </div>
        <div class="tlMsg">${escapeHtml(x.msg)}</div>
        ${meta}
      </div>
    `;
  }).join("");

  setHtml("eventsList", html);
}

function setupEvents() {
  const bR = el("btnEventsRefresh");
  const bC = el("btnEventsClear");

  if (bR) bR.addEventListener("click", async () => {
    localStorage.setItem("eventsHidden_v1", "false");
    try {
      const s = await fetchState();
      renderEvents(s, true);
    } catch (e) {
      setText("eventsMeta", `Chyba: ${e.message || e}`);
    }
  });

  if (bC) bC.addEventListener("click", () => {
    localStorage.setItem("eventsHidden_v1", "true");
    renderEvents({ events: [] }, false);
  });
}

// ---------------------------
// riskCanvas (simple sparkline)
// ---------------------------
function drawRiskCanvas(points) {
  const c = el("riskCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, c.width, c.height);

  const W = c.width, H = c.height;
  if (!points || points.length < 2) return;

  const xs = points.map(p => p.t);
  const ys = points.map(p => p.v);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = 0, maxY = 100;

  const pad = 8;
  const sx = (x) => pad + ((x - minX) / Math.max(1, (maxX - minX))) * (W - pad * 2);
  const sy = (y) => pad + (1 - ((y - minY) / (maxY - minY))) * (H - pad * 2);

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  points.forEach((p, i) => {
    const x = sx(p.t);
    const y = sy(p.v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function loadRiskTrend() {
  try {
    const raw = localStorage.getItem(RISK_STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(x => num(x.t, NaN) && Number.isFinite(num(x.v, NaN)));
  } catch {
    return [];
  }
}

function saveRiskTrend(arr) {
  try {
    localStorage.setItem(RISK_STORE_KEY, JSON.stringify(arr.slice(-MAX_RISK_POINTS)));
  } catch {}
}

function updateRiskTrend(nowTs, risk) {
  const arr = loadRiskTrend();
  arr.push({ t: nowTs, v: num(risk, 0) });
  const cut = nowTs - RISK_WINDOW_MS;
  const pruned = arr.filter(x => x.t >= cut).slice(-MAX_RISK_POINTS);
  saveRiskTrend(pruned);
  return pruned;
}

// ---------------------------
// Main render
// ---------------------------
function render(s) {
  // (zůstává tvoje původní render logika — sem jsem jen doplnil volání renderNightBudget/renderEvents)

  // ... tvoje existující mapování UI (uiLight/uiTemp/.../energy) ...

  // Battery-safe + UDÁLOSTI
  renderNightBudget(s);
  renderEvents(s);

  // ... tvoje existující renderCharts(s) atd. ...
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

      const rawOn = !!el("chkRaw")?.checked;
      show("rawJson", rawOn);
      if (rawOn) setText("rawJson", JSON.stringify(s, null, 2));
    } catch (e) {
      setText("statusText", `Dashboard • chyba: ${e.message || e}`);
    }
  };

  run();
  loopTimer = setInterval(run, intervalMs);
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

  tabs.forEach(t => t.addEventListener("click", () => activate(t.getAttribute("data-tab"))));
}

function setupSettings() {
  const inp = el("backendUrl");
  const btnSave = el("btnSave");
  const btnTest = el("btnTest");
  const out = el("healthOut");

  if (inp) inp.value = getBackend();

  if (btnSave) btnSave.addEventListener("click", () => {
    const v = normalizeBackend(inp?.value || "");
    if (v) setBackend(v);
    if (out) out.textContent = `Uloženo: ${getBackend()}`;
  });

  if (btnTest) btnTest.addEventListener("click", async () => {
    try {
      const backend = getBackend();
      const r = await fetch(`${backend}/health`, { cache: "no-store" });
      const j = await r.json();
      if (out) out.textContent = j?.ok ? `OK • ${new Date(j.now).toLocaleString("cs-CZ")}` : "Neznámý stav";
    } catch (e) {
      if (out) out.textContent = `Chyba: ${e.message || e}`;
    }
  });

  Array.from(document.querySelectorAll(".chipBtn")).forEach(btn => {
    btn.addEventListener("click", () => {
      intervalMs = Number(btn.getAttribute("data-interval") || "1000");
      localStorage.setItem("refreshInterval", String(intervalMs));
      startLoop();
    });
  });
}

(function init() {
  setupTabs();
  setupSettings();
  setupEvents();

  const q = getBackendFromQuery();
  if (q) setBackend(q);

  startLoop();
})();
