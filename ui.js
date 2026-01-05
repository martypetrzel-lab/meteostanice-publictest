const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ================== HELPERY ================== */
const $ = id => document.getElementById(id);
const safeSet = (id, v) => {
  const el = $(id);
  if (el) el.innerText = v;
};

/* ================== ZÁLOŽKY ================== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy"),
  brain: $("view-brain")
};

function showView(name) {
  Object.values(views).forEach(v => v && v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));

  if (views[name]) views[name].classList.add("active");

  const btn = $("btn" + name.charAt(0).toUpperCase() + name.slice(1));
  if (btn) btn.classList.add("active");
}

/* NAVÁZÁNÍ KLIKŮ – BEZ ?. */
const btnToday = $("btnToday");
if (btnToday) btnToday.onclick = () => showView("today");

const btnHistory = $("btnHistory");
if (btnHistory) btnHistory.onclick = () => showView("history");

const btnEnergy = $("btnEnergy");
if (btnEnergy) btnEnergy.onclick = () => showView("energy");

const btnBrain = $("btnBrain");
if (btnBrain) btnBrain.onclick = () => showView("brain");

/* ================== GRAFY ================== */
let todayChart = null;
let energyChart = null;
let initialized = false;

let lastTempLabel = null;
let lastEnergyLabel = null;

function initCharts(s) {
  if (initialized || !window.Chart) return;

  const t = s.memory.today.temperature;
  const ei = s.memory.today.energyIn;
  const eo = s.memory.today.energyOut;

  if ($("todayChart")) {
    todayChart = new Chart($("todayChart"), {
      type: "line",
      data: {
        labels: t.map(x => x.t),
        datasets: [{
          label: "Teplota (°C)",
          data: t.map(x => x.v),
          borderColor: "#3b82f6",
          tension: 0.3
        }]
      },
      options: { animation: false }
    });
    lastTempLabel = t.at(-1)?.t;
  }

  if ($("energyTodayChart")) {
    energyChart = new Chart($("energyTodayChart"), {
      type: "line",
      data: {
        labels: ei.map(x => x.t),
        datasets: [
          {
            label: "Příjem (W)",
            data: ei.map(x => x.v),
            borderColor: "#22c55e",
            tension: 0.3
          },
          {
            label: "Výdej (W)",
            data: eo.map(x => x.v),
            borderColor: "#ef4444",
            tension: 0.3
          }
        ]
      },
      options: { animation: false }
    });
    lastEnergyLabel = ei.at(-1)?.t;
  }

  initialized = true;
}

/* ================== LIVE UPDATE ================== */
async function loadState() {
  try {
    const s = await fetch(API, { cache: "no-store" }).then(r => r.json());

    safeSet("time", new Date(s.time.now).toLocaleTimeString());
    safeSet("message", s.message);

    safeSet("temp", `${s.device.temperature.toFixed(1)} °C`);
    safeSet("battery", `${s.device.battery.voltage.toFixed(2)} V`);
    safeSet("light", `${Math.round(s.device.light)} lx`);
    safeSet("fan", s.device.fan ? "ON" : "OFF");

    safeSet("energyIn", `${s.device.power.solarInW.toFixed(2)} W`);
    safeSet("energyOut", `${s.device.power.loadW.toFixed(2)} W`);
    safeSet("energyBalance", `${s.device.power.balanceWh.toFixed(3)} Wh`);
    safeSet("energyState", s.device.mode);

    initCharts(s);

    const tArr = s.memory.today.temperature;
    if (todayChart && tArr.length) {
      const last = tArr.at(-1);
      if (last.t !== lastTempLabel) {
        todayChart.data.labels.push(last.t);
        todayChart.data.datasets[0].data.push(last.v);
        lastTempLabel = last.t;
        todayChart.update();
      }
    }

    const ei = s.memory.today.energyIn;
    const eo = s.memory.today.energyOut;
    if (energyChart && ei.length) {
      const last = ei.at(-1);
      if (last.t !== lastEnergyLabel) {
        energyChart.data.labels.push(last.t);
        energyChart.data.datasets[0].data.push(last.v);
        energyChart.data.datasets[1].data.push(eo.at(-1).v);
        lastEnergyLabel = last.t;
        👉 energyChart.update();
      }
    }

  } catch (e) {
    console.warn("UI čeká na backend…", e);
  }
}

/* START */
showView("today");
loadState();
setInterval(loadState, 1000);
