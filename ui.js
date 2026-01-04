const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

const $ = id => document.getElementById(id);
const safeSet = (id, value) => {
  const el = $(id);
  if (el) el.innerText = value;
};

/* ===== ZÁLOŽKY ===== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy")
};

function show(view, btn) {
  Object.values(views).forEach(v => v && v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));
  views[view]?.classList.add("active");
  btn.classList.add("active");
}

$("btnToday")?.addEventListener("click", () => show("today", $("btnToday")));
$("btnHistory")?.addEventListener("click", () => show("history", $("btnHistory")));
$("btnEnergy")?.addEventListener("click", () => show("energy", $("btnEnergy")));

/* ===== GRAFY (vždy existují) ===== */
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

/* ===== DATA ===== */
async function loadState() {
  try {
    const res = await fetch(API);
    const s = await res.json();

    /* HLAVIČKA */
    safeSet("time", new Date(s.time.now).toLocaleTimeString());
    safeSet("mode", s.mode);

    /* DNES – KARTY */
    safeSet("temp", `${s.sensors.temperature.toFixed(1)} °C`);
    safeSet("battery", `${s.battery.voltage.toFixed(2)} V`);
    safeSet("light", `${Math.round(s.sensors.light)} lx`);
    safeSet("fan", s.fan ? "ON" : "OFF");

    safeSet("message", s.message);

    /* DNES – GRAF */
    todayChart.data.labels = s.memory.today.temperature.map(p => p.t.slice(11, 16));
    todayChart.data.datasets[0].data = s.memory.today.temperature.map(p => p.v);
    todayChart.update();

    /* HISTORIE – TÝDEN */
    historyChart.data.labels = s.memory.history.map(d => d.day);
    historyChart.data.datasets[0].data = s.memory.history.map(d => d.min);
    historyChart.data.datasets[1].data = s.memory.history.map(d => d.max);
    historyChart.update();

    /* ENERGIE – KARTY */
    safeSet("energyIn", `${s.power.solarInW.toFixed(2)} W`);
    safeSet("energyOut", `${s.power.loadW.toFixed(2)} W`);
    safeSet("energyBalance", `${s.power.balanceWh.toFixed(3)} Wh`);

    /* ENERGIE – STAV */
    const net = s.power.solarInW - s.power.loadW;
    if (Math.abs(net) < 0.01) {
      safeSet("energyState", "Stabilní");
    } else if (net > 0) {
      const hours = ((1 - s.battery.soc) * 12 / net).toFixed(1);
      safeSet("energyState", `Nabíjí se (~${hours} h)`);
    } else {
      const hours = (s.battery.soc * 12 / Math.abs(net)).toFixed(1);
      safeSet("energyState", `Vybíjí se (~${hours} h)`);
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
