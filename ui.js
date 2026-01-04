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
  options: { animation: false }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Min", data: [], borderColor: "#60a5fa" },
      { label: "Max", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Příjem", data: [], borderColor: "#22c55e" },
      { label: "Výdej", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: { labels: [], datasets: [{ data: [], backgroundColor: "#3b82f6" }] },
  options: { animation: false }
});

/* ===== UPDATE ===== */
async function update() {
  const r = await fetch(API);
  const d = await r.json();

  const now = new Date(d.time.now);
  $("time").textContent = now.toLocaleTimeString();
  $("message").textContent = d.message;
  $("mode").textContent = d.mode;
  $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = d.battery.voltage.toFixed(2) + " V";

  /* ===== DNES ===== */
  todayChart.data.labels = d.memory.today.map(p => p.time);
  todayChart.data.datasets[0].data = d.memory.today.map(p => p.temp);
  todayChart.update();

  /* ===== HISTORIE ===== */
  historyChart.data.labels = d.memory.days.map(d => d.day);
  historyChart.data.datasets[0].data = d.memory.days.map(d => d.min);
  historyChart.data.datasets[1].data = d.memory.days.map(d => d.max);
  historyChart.update();

  /* ===== ENERGIE ===== */
  energyTodayChart.data.labels = d.memory.today.map(p => p.time);
  energyTodayChart.data.datasets[0].data = d.memory.today.map(p => p.inW);
  energyTodayChart.data.datasets[1].data = d.memory.today.map(p => p.outW);
  energyTodayChart.update();

  energyWeekChart.data.labels = d.memory.energyDays.map(d => d.day);
  energyWeekChart.data.datasets[0].data = d.memory.energyDays.map(d => d.wh);
  energyWeekChart.update();
}

setInterval(update, 1000);
