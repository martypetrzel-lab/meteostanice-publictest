/* ================== API ================== */
const API = "https://meteostanice-simulator-node-production.up.railway.app/state";
const $ = id => document.getElementById(id);

/* ================== ZÁLOŽKY ================== */
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

/* ================== GRAFY ================== */
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
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Minimum (°C)",
        data: [],
        borderColor: "#60a5fa",
        tension: 0.3
      },
      {
        label: "Maximum (°C)",
        data: [],
        borderColor: "#ef4444",
        tension: 0.3
      }
    ]
  },
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Příjem (W)",
        data: [],
        borderColor: "#22c55e",
        tension: 0.3
      },
      {
        label: "Výdej (W)",
        data: [],
        borderColor: "#ef4444",
        tension: 0.3
      }
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

/* ================== UPDATE UI ================== */
function updateUI(state) {
  /* === TEXTY === */
  $("time").innerText = new Date(state.time.now).toLocaleTimeString("cs-CZ");
  $("mode").innerText = state.mode || "--";

  $("temp").innerText    = state.sensors.temperature.toFixed(1) + " °C";
  $("battery").innerText = state.battery.voltage.toFixed(2) + " V";
  $("light").innerText   = Math.round(state.sensors.light) + " lx";
  $("fan").innerText     = state.fan ? "ON" : "OFF";

  $("energyIn").innerText  = state.power.solarInW.toFixed(2) + " W";
  $("energyOut").innerText = state.power.loadW.toFixed(2) + " W";
  $("energyBalance").innerText = state.power.balanceWh.toFixed(3) + " Wh";

  /* === DNES – TEPLOTA === */
  const temp = state.memory?.today?.temperature || [];

  todayChart.data.labels = temp.map(p =>
    new Date(p.t).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
  );
  todayChart.data.datasets[0].data = temp.map(p => p.v);
  todayChart.update();

  /* === ENERGIE DNES === */
  const eIn  = state.memory?.today?.energyIn || [];
  const eOut = state.memory?.today?.energyOut || [];

  energyTodayChart.data.labels = eIn.map(p =>
    new Date(p.t).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
  );
  energyTodayChart.data.datasets[0].data = eIn.map(p => p.v);
  energyTodayChart.data.datasets[1].data = eOut.map(p => p.v);
  energyTodayChart.update();

  /* === HISTORIE TÝDEN (zatím prázdná – připraveno) === */
  const hist = state.memory?.history || [];
  historyChart.data.labels = hist.map(d => d.day);
  historyChart.data.datasets[0].data = hist.map(d => d.min);
  historyChart.data.datasets[1].data = hist.map(d => d.max);
  historyChart.update();

  /* === ENERGIE TÝDEN === */
  const days = state.memory?.energyDays || [];
  energyWeekChart.data.labels = days.map(d => d.day);
  energyWeekChart.data.datasets[0].data = days.map(d => d.balance);
  energyWeekChart.update();
}

/* ================== LOOP ================== */
async function loop() {
  try {
    const res = await fetch(API, { cache: "no-store" });
    const state = await res.json();
    updateUI(state);
  } catch (e) {
    console.error("API error", e);
  }
}

setInterval(loop, 5000);
loop();
