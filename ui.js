const API = "https://meteostanice-simulator-node-production.up.railway.app/state";
const $ = id => document.getElementById(id);

/* ===== ZÁLOŽKY ===== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy")
};

function show(view, btn) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));
  views[view].classList.add("active");
  btn.classList.add("active");
}

$("btnToday").onclick   = () => show("today", $("btnToday"));
$("btnHistory").onclick = () => show("history", $("btnHistory"));
$("btnEnergy").onclick  = () => show("energy", $("btnEnergy"));

/* ===== GRAFY ===== */

// DNES – teplota
const todayChart = new Chart($("todayChart"), {
  type: "line",
  data: { labels: [], datasets: [{
    label: "Teplota (°C)",
    data: [],
    borderColor: "#3b82f6",
    tension: 0.3
  }]},
  options: { animation: false }
});

// HISTORIE – týden min/max
const historyChart = new Chart($("historyChart"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      { label: "Minimum (°C)", data: [], backgroundColor: "#3b82f6" },
      { label: "Maximum (°C)", data: [], backgroundColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

// ENERGIE – dnes
const energyTodayChart = new Chart($("energyTodayChart"), {
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

// ENERGIE – týdenní bilance
const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [{
      label: "Denní bilance (Wh)",
      data: [],
      backgroundColor: "#60a5fa"
    }]
  },
  options: { animation: false }
});

/* ===== NAČTENÍ STAVU ===== */

async function loadState() {
  try {
    const res = await fetch(API);
    const s = await res.json();

    /* ===== HLAVIČKA ===== */
    $("timeNow").innerText = new Date(s.time.now).toLocaleTimeString("cs-CZ");
    $("mode").innerText = s.mode;

    /* ===== DNES – hodnoty ===== */
    $("temp").innerText    = s.sensors.temperature.toFixed(1);
    $("battery").innerText = s.battery.voltage.toFixed(2);
    $("light").innerText   = Math.round(s.sensors.light);
    $("fan").innerText     = s.fan ? "ON" : "OFF";

    /* ===== DNES – graf ===== */
    const t = s.memory.today.temperature || [];
    todayChart.data.labels = t.map(p => new Date(p.t).toLocaleTimeString("cs-CZ").slice(0,5));
    todayChart.data.datasets[0].data = t.map(p => p.v);
    todayChart.update();

    /* ===== HISTORIE – TÝDEN ===== */
    const h = s.memory.history || [];
    historyChart.data.labels = h.map(d => d.day);
    historyChart.data.datasets[0].data = h.map(d => d.min);
    historyChart.data.datasets[1].data = h.map(d => d.max);
    historyChart.update();

    /* ===== ENERGIE – hodnoty ===== */
    $("energyIn").innerText  = s.power.solarInW.toFixed(2);
    $("energyOut").innerText = s.power.loadW.toFixed(2);
    $("energyBalance").innerText = s.power.balanceWh.toFixed(3);

    /* ===== ENERGIE – DNES ===== */
    const ei = s.memory.today.energyIn || [];
    const eo = s.memory.today.energyOut || [];

    energyTodayChart.data.labels = ei.map(p => new Date(p.t).toLocaleTimeString("cs-CZ").slice(0,5));
    energyTodayChart.data.datasets[0].data = ei.map(p => p.v);
    energyTodayChart.data.datasets[1].data = eo.map(p => p.v);
    energyTodayChart.update();

    /* ===== ENERGIE – TÝDEN ===== */
    const ed = s.memory.energyDays || [];
    energyWeekChart.data.labels = ed.map(d => d.day);
    energyWeekChart.data.datasets[0].data = ed.map(d => d.balance);
    energyWeekChart.update();

  } catch (e) {
    console.error("Chyba načtení stavu", e);
  }
}

/* ===== START ===== */
loadState();
setInterval(loadState, 1000);
