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

/* ===== GRAFY – VŽDY SE VYTVOŘÍ ===== */
const todayChart = new Chart($("todayChart"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "Teplota (°C)", data: [], borderColor: "#3b82f6", tension: 0.3 }] },
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

/* ===== STAV ===== */
async function loadState() {
  try {
    const res = await fetch(API);
    const s = await res.json();

    /* HLAVIČKA */
    $("time").innerText = new Date(s.time.now).toLocaleTimeString();
    $("mode").innerText = s.mode;

    /* DNES – KARTY + JEDNOTKY */
    $("temp").innerText = `${s.sensors.temperature.toFixed(1)} °C`;
    $("battery").innerText = `${s.battery.voltage.toFixed(2)} V`;
    $("light").innerText = `${Math.round(s.sensors.light)} lx`;
    $("fan").innerText = s.fan ? "ON" : "OFF";

    $("message").innerText = s.message;

    /* DNES – TEPLOTA */
    todayChart.data.labels = s.memory.today.temperature.map(p => p.t.slice(11, 16));
    todayChart.data.datasets[0].data = s.memory.today.temperature.map(p => p.v);
    todayChart.update();

    /* HISTORIE – VŽDY AKTUALIZUJ */
    historyChart.data.labels = s.memory.history.map(d => d.day);
    historyChart.data.datasets[0].data = s.memory.history.map(d => d.min);
    historyChart.data.datasets[1].data = s.memory.history.map(d => d.max);
    historyChart.update();

    /* ENERGIE – KARTY */
    $("energyIn").innerText = `${s.power.solarInW.toFixed(2)} W`;
    $("energyOut").innerText = `${s.power.loadW.toFixed(2)} W`;
    $("energyBalance").innerText = `${s.power.balanceWh.toFixed(3)} Wh`;

    /* ENERGIE – STAV */
    const net = s.power.solarInW - s.power.loadW;
    if (Math.abs(net) < 0.01) {
      $("energyState").innerText = "Stabilní";
    } else if (net > 0) {
      const hours = ((1 - s.battery.soc) * 12 / net).toFixed(1);
      $("energyState").innerText = `Nabíjí se (~${hours} h)`;
    } else {
      const hours = (s.battery.soc * 12 / Math.abs(net)).toFixed(1);
      $("energyState").innerText = `Vybíjí se (~${hours} h)`;
    }

    /* ENERGIE – GRAFY */
    energyTodayChart.data.labels = s.memory.today.energyIn.map(p => p.t.slice(11, 16));
    energyTodayChart.data.datasets[0].data = s.memory.today.energyIn.map(p => p.v);
    energyTodayChart.data.datasets[1].data = s.memory.today.energyOut.map(p => p.v);
    energyTodayChart.update();

    energyWeekChart.data.labels = s.memory.energyDays.map(d => d.day);
    energyWeekChart.data.datasets[0].data = s.memory.energyDays.map(d => d.balance);
    energyWeekChart.update();

  } catch (e) {
    console.error("Chyba načtení stavu", e);
  }
}

setInterval(loadState, 5000);
loadState();
