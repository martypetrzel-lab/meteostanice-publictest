const DEFAULT_BACKEND = "https://meteostanice-simulator-node-production.up.railway.app";

const el = (id) => document.getElementById(id);

// bezpečné settery
const setText = (id, text) => { const e = el(id); if (e) e.textContent = text; };
const setHref = (id, href) => { const e = el(id); if (e) e.href = href; };
const setValue = (id, val) => { const e = el(id); if (e) e.value = val; };
const toggleClass = (id, cls, on) => { const e = el(id); if (e) e.classList.toggle(cls, !!on); };

const fmt1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : "—");
const fmt0 = (x) => (Number.isFinite(x) ? Math.round(x) : "—");

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

function pushRiskPoint(risk) {
  const key = "riskSeries";
  const now = Date.now();
  const keepMs = 2 * 60 * 60 * 1000; // ~2h
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch { arr = []; }
  arr.push({ t: now, r: risk });

  // prune
  arr = arr.filter(p => (now - p.t) <= keepMs);

  // de-dup (max 1 point per ~10s)
  const out = [];
  for (const p of arr) {
    const last = out[out.length - 1];
    if (!last || (p.t - last.t) >= 10_000) out.push(p);
  }

  localStorage.setItem(key, JSON.stringify(out));
  return out;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function drawRisk(canvas, series) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // grid
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
  const backend = getBackend();
  setHref("stateLink", `${backend}/state`);

  // env basics
  const env = state?.world?.environment || {};
  const light = env.light ?? state?.environment?.light;
  const temp = env.airTempC ?? env.temperature ?? state?.environment?.temperature;
  const hum = env.humidity ?? state?.environment?.humidity;

  setText("uiLight", fmt0(light));
  setText("uiTemp", fmt1(temp));
  setText("uiHum", fmt0(hum));

  // energy
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

  // message
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

  // brain
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

  // sun info
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

  // risk trend
  if (risk !== null) {
    const series = pushRiskPoint(risk);
    drawRisk(el("riskCanvas"), series);
  }

  // energy prediction placeholders
  const pred = state?.prediction || null;
  setText("uiNet", pred?.netW !== undefined ? fmt1(Number(pred.netW)) : "—");
  setText("uiTodaySolarWh", pred?.todaySolarWh !== undefined ? fmt0(Number(pred.todaySolarWh)) : "—");

  // history dumps (debug)
  setText("uiHistory", JSON.stringify(state?.memory?.days ?? [], null, 2));
  setText("uiWeeks", JSON.stringify(state?.memory?.weeks ?? [], null, 2));

  setText("statusText", "Dashboard • OK");
}

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
  // tyto prvky jsou volitelné – pokud nejsou, nic se nerozbije
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

  // RAW JSON toggle (volitelné)
  const chk = el("chkRaw");
  const raw = el("rawJson");
  if (chk && raw) {
    chk.addEventListener("change", () => {
      raw.classList.toggle("hidden", !chk.checked);
    });
  }
}

(async function boot() {
  setupTabs();
  setupSettings();

  try {
    const s = await fetchState();
    render(s);
  } catch (e) {
    setText("statusText", `Dashboard • chyba: ${e.message}`);
  }

  startLoop();
})();
