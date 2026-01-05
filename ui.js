const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ================== HELPERY ================== */
const $ = (id) => document.getElementById(id);
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

function show(view, btn) {
  Object.values(views).forEach(v => v && v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));
  views[view]?.classList.add("active");
  btn?.classList.add("active");
}

$("btnToday")?.addEventListener("click", e => show("today", e.target));
$("btnHistory")?.addEventListener("click", e => show("history", e.target));
$("btnEnergy")?.addEventListener("click", e => show("energy", e.target));
$("btnBrain")?.addEventListener("click", e => show("brain", e.target));

/* ================== GRAFY ================== */
let todayChart = null;
let energyTodayChart = null;

if (window.Chart && $("todayChart")) {
  todayChart = new Chart($("todayChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Teplota (°C)",
        data: [],
        borderColor: "#3b82f6",
        tension: 0.3
      }]
    },
    options: { animation: false }
  });
}

if (window.Chart && $("energyTodayChart")) {
  energyTodayChart = new Chart($("energyTodayChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Příjem (W)", data: [], borderColor: "#22c55e", tension: 0.3 },
        { label: "Výdej (W)", data: [], borderColor: "#ef4444", tension: 0.3 }
      ]
    },
    options: { animation: false }
  });
}

/* ================== LIVE UPDATE ================== */
async function loadState() {
  try {
    const res = await fetch(API, { cache: "no-store" });
    const s = await res.json();

    /* HEADER */
    safeSet("time", new Date(s.time.now).toLocaleTimeString());
    safeSet("message", s.message);

    /* HODNOTY */
    safeSet("temperature", `${s.device.temperature.toFixed(1)} °C`);
    safeSet("battery", `${s.device.battery.voltage.toFixed(2)} V`);
    safeSet("light", `${Math.round(s.device.light)} lx`);
    safeSet("fan", s.device.fan ? "ON" : "OFF");

    /* TEPL. GRAF */
    if (todayChart && s.memory?.today?.temperature?.length) {
      const t = s.memory.today.temperature.at(-1);
      if (typeof t.v === "number") {
        todayChart.data.labels.push(t.t);
        todayChart.data.datasets[0].data.push(t.v);

        if (todayChart.data.labels.length > 120) {
          todayChart.data.labels.shift();
          todayChart.data.datasets[0].data.shift();
        }
        todayChart.update();
      }
    }

    /* ENERGIE */
    if (energyTodayChart && s.memory?.today?.energyIn?.length) {
      const i = s.memory.today.energyIn.at(-1);
      const o = s.memory.today.energyOut.at(-1);

      energyTodayChart.data.labels.push(i.t);
      energyTodayChart.data.datasets[0].data.push(i.v);
      energyTodayChart.data.datasets[1].data.push(o.v);

      if (energyTodayChart.data.labels.length > 120) {
        energyTodayChart.data.labels.shift();
        energyTodayChart.data.datasets.forEach(d => d.data.shift());
      }
      energyTodayChart.update();
    }

  } catch (e) {
    console.warn("UI čeká na backend…", e);
  }
}

/* ⏱️ 1 SEKUNDA = 1 TICK */
loadState();
setInterval(loadState, 1000);
