const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ===== SAFE HELPERS ===== */
const el = id => document.getElementById(id);

const setText = (id, value) => {
  const e = el(id);
  if (e) e.innerText = value;
};

const setHtml = (id, value) => {
  const e = el(id);
  if (e) e.innerHTML = value;
};

/* ===== ZÁLOŽKY ===== */
const views = {
  today: el("view-today"),
  history: el("view-history"),
  energy: el("view-energy")
};

function show(view, btn) {
  Object.values(views).forEach(v => v && v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));
  if (views[view]) views[view].classList.add("active");
  if (btn) btn.classList.add("active");
}

el("btnToday")?.addEventListener("click", () => show("today", el("btnToday")));
el("btnHistory")?.addEventListener("click", () => show("history", el("btnHistory")));
el("btnEnergy")?.addEventListener("click", () => show("energy", el("btnEnergy")));

/* ===== GRAFY ===== */
const todayChart = new Chart(el("todayChart"), {
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

const energyTodayChart = new Chart(el("energyTodayChart"), {
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
    setText("time", new Date(s.time.now).toLocaleTimeString("cs-CZ"));
    setText("mode", s.mode);

    setText("temp", s.sensors.temperature.toFixed(1));
    setText("battery", s.battery.voltage.toFixed(2));
    setText("light", Math.round(s.sensors.light));
    setText("fan", s.fan ? "ON" : "OFF");

    /* === TEPLOTA DNES === */
    const t = s.memory?.today?.temperature ?? [];
    todayChart.data.labels = t.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    todayChart.data.datasets[0].data = t.map(x => x.v);
    todayChart.update();

    /* === ENERGIE === */
    setText("energyIn", s.power.solarInW.toFixed(2));
    setText("energyOut", s.power.loadW.toFixed(2));
    setText("energyBalance", s.power.balanceWh.toFixed(3));

    const ei = s.memory?.today?.energyIn ?? [];
    const eo = s.memory?.today?.energyOut ?? [];

    energyTodayChart.data.labels = ei.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    energyTodayChart.data.datasets[0].data = ei.map(x => x.v);
    energyTodayChart.data.datasets[1].data = eo.map(x => x.v);
    energyTodayChart.update();

    const loading = el("loading");
    if (loading) loading.style.display = "none";

  } catch (err) {
    console.error("Chyba načtení stavu:", err);
  }
}

/* ===== START ===== */
loadState();
setInterval(loadState, 5000);
