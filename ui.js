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

/* ===== LOAD STATE ===== */
async function loadState() {
  try {
    const res = await fetch(API);
    const s = await res.json();

    /* === HLAVNÍ DATA === */
    if ($("time")) $("time").innerText = new Date(s.time.now).toLocaleTimeString("cs-CZ");
    if ($("mode")) $("mode").innerText = s.mode;

    if ($("temp")) $("temp").innerText = s.sensors.temperature.toFixed(1);
    if ($("battery")) $("battery").innerText = s.battery.voltage.toFixed(2);
    if ($("light")) $("light").innerText = Math.round(s.sensors.light);
    if ($("fan")) $("fan").innerText = s.fan ? "ON" : "OFF";

    /* === TEPLOTA DNES === */
    const t = s.memory.today.temperature;
    todayChart.data.labels = t.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    todayChart.data.datasets[0].data = t.map(x => x.v);
    todayChart.update();

    /* === ENERGIE === */
    if ($("energyIn")) $("energyIn").innerText = s.power.solarInW.toFixed(2);
    if ($("energyOut")) $("energyOut").innerText = s.power.loadW.toFixed(2);
    if ($("energyBalance")) $("energyBalance").innerText = s.power.balanceWh.toFixed(3);

    const ei = s.memory.today.energyIn;
    const eo = s.memory.today.energyOut;
    energyTodayChart.data.labels = ei.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    energyTodayChart.data.datasets[0].data = ei.map(x => x.v);
    energyTodayChart.data.datasets[1].data = eo.map(x => x.v);
    energyTodayChart.update();

    if ($("loading")) $("loading").style.display = "none";

  } catch (e) {
    console.error("Chyba načtení stavu", e);
  }
}

/* ===== START ===== */
loadState();
setInterval(loadState, 5000);
