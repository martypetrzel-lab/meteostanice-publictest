const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ================== HELPERY ================== */
const $ = id => document.getElementById(id);
const safeSet = (id, v) => {
  const el = $(id);
  if (el) el.innerText = v;
};

/* ================== ZÁLOŽKY ================== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy"),
  brain: $("view-brain")
};

function showView(name) {
  // skryj všechny views
  Object.values(views).forEach(v => v && v.classList.remove("active"));

  // odeber active tlačítkům
  document
    .querySelectorAll("header button")
    .forEach(b => b.classList.remove("active"));

  // zobraz vybraný view
  views[name]?.classList.add("active");

  // aktivuj správné tlačítko
  const btn = $("btn" + name.charAt(0).toUpperCase() + name.slice(1));
  btn?.classList.add("active");
}

/* NAVÁZÁNÍ KLIKŮ */
$("btnToday")?.addEventListener("click", () => showView("today"));
$("btnHistory")?.addEventListener("click", () => showView("history"));
$("btnEnergy")?.addEventListener("click", () => showView("energy"));
$("btnBrain")?.addEventListener("click", () => showView("brain"));

/* ================== GRAFY ================== */
let initialized = false;
let todayChart = null;
let energyChart = null;

function initCharts(s) {
  if (initialized || !window.Chart) return;

  if ($("todayChart")) {
    todayChart = new Chart($("todayChart"), {
      type: "line",
      data: {
        labels: s.memory.today.temperature.map(x => x.t),
        datasets: [{
          label: "Teplota (°C)",
          data: s.memory.today.temperature.map(x => x.v),
          borderColor: "#3b82f6",
          tension: 0.3
        }]
      },
      options: { animation: false }
    });
  }

  if ($("energyTodayChart")) {
    energyChart = new Chart($("energyTodayChart"), {
      type: "line",
      data: {
        labels: s.memory.today.energyIn.map(x => x.t),
        datasets: [
          {
            label: "Příjem (W)",
            data: s.memory.today.energyIn.map(x => x.v),
            borderColor: "#22c55e",
            tension: 0.3
          },
          {
            label: "Výdej (W)",
            data: s.memory.today.energyOut.map(x => x.v),
            borderColor: "#ef4444",
            tension: 0.3
          }
        ]
      },
      options: { animation: false }
    });
  }

  initialized = true;
}

/* ================== LIVE UPDATE ================== */
async function loadState() {
  try {
    const s = await fetch(API, { cache: "no-store" }).then(r => r.json());

    safeSet("time", new Date(s.time.now).toLocaleTimeString());
    safeSet("message", s.message);
    safeSet("temp", `${s.device.temperature.toFixed(1)} °C`);
    safeSet("battery", `${s.device.battery.voltage.toFixed(2)} V`);
    safeSet("light", `${Math.round(s.device.light)} lx`);
    safeSet("fan", s.device.fan ? "ON" : "OFF");

    initCharts(s);
  } catch (e) {
    console.warn("UI čeká na backend…");
  }
}

/* START */
showView("today");   // výchozí záložka
loadState();
setInterval(loadState, 1000);
