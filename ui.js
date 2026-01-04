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

const historyChart = new Chart($("historyChart"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      { label: "Minimum (°C)", data: [], backgroundColor: "#60a5fa" },
      { label: "Maximum (°C)", data: [], backgroundColor: "#ef4444" }
    ]
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

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      { label: "Denní bilance (Wh)", data: [], backgroundColor: "#3b82f6" }
    ]
  },
  options: { animation: false }
});

/* ===== LOAD STATE ===== */
async function loadState() {
  try {
    const res = await fetch(API);
    const s = await res.json();

    /* --- HLAVIČKA --- */
    $("time").innerText = new Date(s.time.now).toLocaleTimeString("cs-CZ");
    $("mode").innerText = s.mode;
    $("headline").innerText = s.message ?? "";

    /* --- DNES DATA --- */
    $("temp").innerText = s.sensors.temperature.toFixed(1);
    $("battery").innerText = s.battery.voltage.toFixed(2);
    $("light").innerText = Math.round(s.sensors.light);
    $("fan").innerText = s.fan ? "ON" : "OFF";

    /* --- ENERGIE STAT --- */
    $("energyIn").innerText = s.power.solarInW.toFixed(2);
    $("energyOut").innerText = s.power.loadW.toFixed(2);
    $("energyBalance").innerText = s.power.balanceWh.toFixed(3);
    $("energyState").innerText = Math.round(s.battery.soc * 100) + " %";

    /* --- DNES GRAF TEPLOTA --- */
    const t = s.memory.today.temperature;
    todayChart.data.labels = t.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    todayChart.data.datasets[0].data = t.map(x => x.v);
    todayChart.update();

    /* --- ENERGIE DNES --- */
    const ei = s.memory.today.energyIn;
    const eo = s.memory.today.energyOut;
    energyTodayChart.data.labels = ei.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    energyTodayChart.data.datasets[0].data = ei.map(x => x.v);
    energyTodayChart.data.datasets[1].data = eo.map(x => x.v);
    energyTodayChart.update();

    /* --- HISTORIE TEPLOT --- */
    historyChart.data.labels = s.memory.history.map(d => d.day);
    historyChart.data.datasets[0].data = s.memory.history.map(d => d.min);
    historyChart.data.datasets[1].data = s.memory.history.map(d => d.max);
    historyChart.update();

    /* --- TÝDEN ENERGIE --- */
    energyWeekChart.data.labels = s.memory.energyDays.map(d => d.day);
    energyWeekChart.data.datasets[0].data = s.memory.energyDays.map(d => d.balance);
    energyWeekChart.update();

    $("loading").style.display = "none";
  } catch (e) {
    console.error("Chyba načtení stavu", e);
  }
}

/* ===== START ===== */
loadState();
setInterval(loadState, 5000);
