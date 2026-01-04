const API_URL = "https://meteostanice-simulator-node-production.up.railway.app/state";

async function loadState() {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Backend nedostupný");

    const state = await res.json();
    window.STATE = state;

    if (typeof updateUI === "function") {
      updateUI(state);
    }
  } catch (err) {
    console.error("Chyba spojení s backendem:", err);
  }
}

loadState();
setInterval(loadState, 1000);
