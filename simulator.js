// simulator.js – frontend napojený na Railway backend

const API_URL = "https://meteostanice-simulator-node-production.up.railway.app/state";

// globální stav
window.STATE = null;

// ===== HELPERY =====
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("cs-CZ");
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// ===== UI UPDATE =====
function updateMetaUI(state) {
  // reálný čas
  const timeEl = document.getElementById("real-time");
  if (timeEl) {
    timeEl.textContent = `Čas: ${formatTime(state.time.now)}`;
  }

  // den simulace
  const start = state.simulation?.startTime;
  const now = state.time.now;

  if (start) {
    const dayIndex = Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
    const day = clamp(dayIndex, 1, 21);

    const dayEl = document.getElementById("sim-day");
    if (dayEl) {
      dayEl.textContent = `Den ${day} / 21`;
    }

    const progress = (day / 21) * 100;
    const bar = document.getElementById("sim-progress");
    if (bar) {
      bar.style.width = `${progress}%`;
    }
  }
}

// ===== HLAVNÍ NAČTENÍ DAT =====
async function loadState() {
  try {
    const res = await fetch(API_URL, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error("Backend nedostupný");
    }

    const state = await res.json();
    window.STATE = state;

    // předání do UI
    if (typeof updateUI === "function") {
      updateUI(state);
    }

    updateMetaUI(state);

    // debug
    console.log("STATE:", state);

  } catch (err) {
    console.error("Chyba spojení s backendem:", err);
  }
}

// ===== START =====
loadState();
setInterval(loadState, 1000);
