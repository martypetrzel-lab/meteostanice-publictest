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
      tension: 0.3,
      pointRadius: 0
    }]
  },
  options: { animation: false }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Minimum (°C)", data: [], borderColor: "#60a5fa", tension: 0.3 },
      { label: "Maximum (°C)", data: [], borderColor: "#ef4444", tension: 0.3 }
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
    datasets: [{
      label: "Denní bilance (Wh)",
      data: [],
      backgroundColor: "#3b82f6"
    }]
  },
  options: { animation: false }
});

/* ===== UPDATE UI ===== */
async function updateUI() {
  const res = await fetch(API);
  const state = await res.json();

  const now = new Date(state.time.now);

  $("time").textContent = now.toLocaleTimeString();
  $("mode").textContent = state.mode;
  $("temp").textContent = state.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = state.battery.voltage.toFixed(2) + " V";
  $("light").textContent = Math.round(state.environment.light) + " lx";
  $("fan").textContent = state.fan ? `zapnut (${state.fanPower}%)` : "vypnut";
  $("message").textContent = state.message;
  $("details").textContent = state.details.join(" · ");

  /* ===== DNES – TEPLOTA ===== */
  const today = state.memory.currentDay;
  if (today?.samples?.length) {
    todayChart.data.labels = today.samples.map(s =>
      new Date(s.time).toLocaleTimeString().slice(0, 5)
    );
    todayChart.data.datasets[0].data = today.samples.map(s => s.temperature);
    todayChart.update();
  }

  /* ===== HISTORIE ===== */
  const days = state.memory.days || [];
  historyChart.data.labels = days.map(d => d.day);
  historyChart.data.datasets[0].data = days.map(d => d.min);
  historyChart.data.datasets[1].data = days.map(d => d.max);
  historyChart.update();

  /* ===== ENERGIE – OKAMŽITÁ ===== */
  const inW = state.power.solarInW;
  const outW = state.power.loadW;
  const balance = inW - outW;

  $("energyIn").textContent = inW.toFixed(2) + " W";
  $("energyOut").textContent = outW.toFixed(2) + " W";
  $("energyBalance").textContent =
    (balance >= 0 ? "+" : "") + balance.toFixed(2) + " W";

  $("energyState").textContent =
    balance > 0.05 ? "nabíjí se" :
    balance < -0.05 ? "vybíjí se" :
    "stabilní";

  /* ===== ENERGIE DNES ===== */
  if (today?.energy?.samples?.length) {
    energyTodayChart.data.labels =
      today.energy.samples.map(s => new Date(s.time).toLocaleTimeString().slice(0,5));
    energyTodayChart.data.datasets[0].data =
      today.energy.samples.map(s => s.in);
    energyTodayChart.data.datasets[1].data =
      today.energy.samples.map(s => s.out);
    energyTodayChart.update();

    $("energySummary").textContent =
      `Bilance dnes: ${today.energy.wh.toFixed(2)} Wh`;
  }

  /* ===== ENERGIE TÝDEN ===== */
  energyWeekChart.data.labels = days.map(d => d.day);
  energyWeekChart.data.datasets[0].data =
    days.map(d => d.energyWh ?? 0);
  energyWeekChart.update();
}

/* ===== LOOP ===== */
setInterval(updateUI, 5000);
updateUI();
