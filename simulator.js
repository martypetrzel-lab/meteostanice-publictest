// simulator.js – FRONTEND
// ⚠️ NEROZBÍJÍ UI, jen čte stav ze serveru

const API_URL = "https://meteostanice-simulator-node-production.up.railway.app/state";

window.STATE = null;

// ==============================
// Pomocné funkce
// ==============================
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("cs-CZ", { hour12: false });
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// ==============================
// Hlavní načtení stavu
// ==============================
async function loadState() {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Backend nedostupný");

    const state = await res.json();
    window.STATE = state;

    applyStateToUI(state);
  } catch (err) {
    console.error("Chyba spojení s backendem:", err);
  }
}

// ==============================
// MAPOVÁNÍ NA PŮVODNÍ UI
// ==============================
function applyStateToUI(state) {
  // ⏱️ ČAS
  const timeEl = document.querySelector("#sim-time");
  if (timeEl && state.simTime) {
    timeEl.textContent = formatTime(state.simTime);
  }

  // 📅 DEN / 21
  const dayEl = document.querySelector("#sim-day");
  if (dayEl && typeof state.dayIndex === "number") {
    dayEl.textContent = `${state.dayIndex} / 21`;
  }

  // 📊 PROGRESS BAR (den nebo celý cyklus)
  const progressEl = document.querySelector("#sim-progress");
  if (progressEl && typeof state.cycleProgress === "number") {
    const pct = clamp(state.cycleProgress * 100, 0, 100);
    progressEl.style.width = `${pct}%`;
  }

  // 🌡️ TEPLOTA
  if (typeof updateTemperature === "function") {
    updateTemperature(state.temperature);
  }

  // 🔋 BATERIE
  if (typeof updateBattery === "function") {
    updateBattery(state.batteryVoltage, state.batteryState);
  }

  // ☀️ SVĚTLO
  if (typeof updateLight === "function") {
    updateLight(state.lightLux);
  }

  // 🌬️ VĚTRÁK
  if (typeof updateFan === "function") {
    updateFan(state.fanOn);
  }

  // ⚙️ REŽIM
  const modeEl = document.querySelector("#sim-mode");
  if (modeEl && state.mode) {
    modeEl.textContent = state.mode;
  }

  // 📈 GRAFY – původní logika zůstává
  if (typeof pushCharts === "function") {
    pushCharts(state);
  }
}

// ==============================
// START
// ==============================
loadState();               // hned po načtení
setInterval(loadState, 1000); // 1s = 1s simulace
