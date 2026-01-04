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
  data: { labels: [], datasets: [{ data: [], borderColor: "#3b82f6", tension: 0.3 }] },
  options: { animation: false, plugins: { legend: { display: false } } }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Min (°C)", data: [], borderColor: "#60a5fa" },
      { label: "Max (°C)", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Příjem (W)", data: [], borderColor: "#22c55e" },
      { label: "Výdej (W)", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: { labels: [], datasets: [{ label: "Denní bilance (Wh)", data: [], backgroundColor: "#3b82f6" }] },
  options: { animation: false }
});

/* ===== FETCH ===== */
async function load() {
  const res = await fetch(API, { cache: "no-store" });
  const d = await res.json();

  const now = new Date(d.time.now);
  $("time").textContent = now.toLocaleTimeString();
  $("mode").textContent = d.mode;
  $("message").textContent = d.message;

  $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = d.battery.voltage.toFixed(2) + " V";
  $("light").textContent = Math.round(d.environment.light) + " lx";
  $("fan").textContent = d.fan ? "zapnut" : "vypnut";
  $("details").textContent = d.details.join(" · ");

  const seconds = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  $("dayProgress").style.width = (seconds / 86400 * 100) + "%";
  $("dayIndex").textContent = d.time.dayIndex;

  /* ===== PAMĚŤ ZE SERVERU ===== */
  if (d.memory) {
    todayChart.data.labels = d.memory.today.labels;
    todayChart.data.datasets[0].data = d.memory.today.temperatures;
    todayChart.update();

    historyChart.data.labels = d.memory.week.labels;
    historyChart.data.datasets[0].data = d.memory.week.min;
    historyChart.data.datasets[1].data = d.memory.week.max;
    historyChart.update();

    energyTodayChart.data.labels = d.memory.today.labels;
    energyTodayChart.data.datasets[0].data = d.memory.today.energyIn;
    energyTodayChart.data.datasets[1].data = d.memory.today.energyOut;
    energyTodayChart.update();

    energyWeekChart.data.labels = d.memory.week.labels;
    energyWeekChart.data.datasets[0].data = d.memory.week.energyWh;
    energyWeekChart.update();
  }
}

setInterval(load, 1000);
load();
