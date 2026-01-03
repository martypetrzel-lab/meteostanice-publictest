// simulator.js – frontend napojený na Railway backend

const API_URL = "https://meteostanice-simulator-node-production.up.railway.app/state";

// globální stav
window.STATE = null;

// hlavní načtení dat
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

    // předání dat UI
    if (typeof updateUI === "function") {
      updateUI(state);
    }

    // debug
    console.log("STATE:", state);

  } catch (err) {
    console.error("Chyba spojení s backendem:", err);
  }
}

// první načtení
loadState();

// živá aktualizace – 1s = 1s simulace
loadState();
setInterval(loadState, 1000);
