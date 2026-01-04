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

$("btnToday").onclick = () => show("today", $("btnToday"));
$("btnHistory").onclick = () => show("history", $("btnHistory"));
$("btnEnergy").onclick = () => show("energy", $("btnEnergy"));

/* ===== GRAFY ===== */
const todayChart = new Chart($("todayChart"), {
  type: "line",
  data: { labels: [], datasets: [{
    label: "Teplota (°C)",
    data: [],
    borderColor: "#3b82f6",
    tension: 0.3,
    pointRadius: 0
  }]},
  options: { animation: false }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { label: "Min (°C)", data: [], borderColor: "#60a5fa", tension: 0.3 },
    { label: "Max (°C)", data: [], borderColor: "#ef4444", tension: 0.3 }
  ]},
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { label: "Příjem (W)", data: [], borderColor: "#22c55e", tension: 0.3 },
    { label: "Výdej (W)", data: [], borderColor: "#ef4444", tension: 0.3 }
  ]},
  options: { animation: false, scales: { y: { beginAtZero: true } } }
});

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: { labels: [], datasets: [{
    label: "Denní bilance (Wh)",
    data: [],
    backgroundColor: "#3b82f6"
  }]},
  options: { animation: false }
});

/* ===== NAČTENÍ DAT ZE SERVERU ===== */
async function loadState() {
  try {
    const res = await fetch(API, { cache: "no-store" });
    const d = await res.json();
    render(d);
  } catch (e) {
    console.error("Chyba načtení stavu", e);
  }
}

/* ===== RENDER ===== */
function render(d) {
  const now = new Date(d.time.now);

  $("message").textContent = d.message;
  $("time").textContent = now.toLocaleTimeString();
  $("mode").textContent = d.mode;
  $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = d.battery.voltage.toFixed(2) + " V";
  $("light").textContent = Math.round(d.sensors.light) + " lx";
  $("fan").textContent = d.fan ? "zapnut" : "vypnut";
  $("details").textContent = d.details.join(" · ");

  $("energyIn").textContent = d.power.solarInW.toFixed(2) + " W";
  $("energyOut").textContent = d.power.loadW.toFixed(2) + " W";
  $("energyBalance").textContent =
    (d.power.solarInW - d.power.loadW).toFixed(2) + " W";

  /* ===== DNES – TEPLOTA ===== */
  todayChart.data.labels = d.memory.today.temperature.map(p =>
    new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  todayChart.data.datasets[0].data = d.memory.today.temperature.map(p => p.v);
  todayChart.update();

  /* ===== HISTORIE ===== */
  historyChart.data.labels = d.memory.history.map(h => h.day);
  historyChart.data.datasets[0].data = d.memory.history.map(h => h.min);
  historyChart.data.datasets[1].data = d.memory.history.map(h => h.max);
  historyChart.update();

  /* ===== ENERGIE DNES ===== */
  energyTodayChart.data.labels = d.memory.today.energyIn.map(p =>
    new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  energyTodayChart.data.datasets[0].data = d.memory.today.energyIn.map(p => p.v);
  energyTodayChart.data.datasets[1].data = d.memory.today.energyOut.map(p => p.v);
  energyTodayChart.update();

  /* ===== ENERGIE TÝDEN ===== */
  energyWeekChart.data.labels = d.memory.energyDays.map(d => d.day);
  energyWeekChart.data.datasets[0].data = d.memory.energyDays.map(d => d.wh);
  energyWeekChart.update();
}

/* ===== START ===== */
loadState();
setInterval(loadState, 5000);
