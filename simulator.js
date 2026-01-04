const API_URL = "https://meteostanice-simulator-node-production.up.railway.app/state";

async function tick() {
  try {
    const r = await fetch(API_URL, { cache: "no-store" });
    const data = await r.json();

    window.dispatchEvent(new CustomEvent("simulator:update", {
      detail: data
    }));
  } catch (e) {
    console.error("Backend nedostupný");
  }
}

tick();
setInterval(tick, 1000);
