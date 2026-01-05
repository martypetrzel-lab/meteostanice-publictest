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

  views[name]?.classList.add("active");
  $("btn" + name.charAt(0).toUpperCase() + name.slice(1))?.classList.add("active");
}

$("btnToday")?.addEventListener("click", () => showView("today"));
$("btnHistory")?.addEventListener("click", () => showView("history"));
$("btnEnergy")?.addEventListener("click", () => showView("energy"));
$("btnBrain")?.addEventListener("click", () => showView("brain"));

/* ================== GRAFY ================== */
let todayChart = null;
let energyChart = null;
let initialized = false;

// poslední vykreslené časy
let lastTempLabel = null;
let lastEnergyLabel = null;

function initCharts(s) {
  if (initialized || !window.Chart) return;

  const tempData = s.memory.today.temperature;
  const energyIn = s.memory.today.energyIn;
  const energyOut = s.memory.today.energyOut;

  if ($("todayChart")) {
    todayChart = new Chart($("todayChart"), {
      type: "line",
      data: {
        labels: tempData.map(x => x.t),
        datasets: [{
          label: "Teplota (°C)",
          data: tempData.map(x => x.v),
          borderColor: "#3b82f6",
          tension: 0.3
        }]
      },
      options: { animation: false }
    };

    lastTempLabel = tempData.at(-1)?.t ?? null;
  }

  if ($("energyTodayChart")) {
    energyChart = new Chart($("energyTodayChart"), {
      type: "line",
      data: {
        labels: energyIn.map(x => x.t),
        datasets: [
          {
            label: "Příjem (W)",
            data: energyIn.map(x => x.v),
            borderColor: "#22c55e",
            tension: 0.3
          },
          {
            label: "Výdej (W)",
            data: energyOut.map(x => x.v),
            borderColor: "#ef4444",
            tension: 0.3
          }
        ]
      },
      options: { animation: false }
    };

    lastEnergyLabel = energyIn.at(-1)?.t ?? null;
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

    initCharts(s);

    /* ➕ DOPLNĚNÍ NOVÝCH BODŮ */
    const tempArr = s.memory.today.temperature;
    const energyInArr = s.memory.today.energyIn;
    const energyOutArr = s.memory.today.energyOut;

    if (todayChart && tempArr.length) {
      const last = tempArr.at(-1);
      if (last.t !== lastTempLabel) {
        todayChart.data.labels.push(last.t);
        todayChart.data.datasets[0].data.push(last.v);
        lastTempLabel = last.t;
        todayChart.update();
      }
    }

    if (energyChart && energyInArr.length) {
      const lastI = energyInArr.at(-1);
      const lastO = energyOutArr.at(-1);
      if (lastI.t !== lastEnergyLabel) {
        energyChart.data.labels.push(lastI.t);
        energyChart.data.datasets[0].data.push(lastI.v);
        energyChart.data.datasets[1].data.push(lastO.v);
        lastEnergyLabel = lastI.t;
        energyChart.update();
      }
    }

  } catch {
    console.warn("UI čeká na backend…");
  }
}

/* START */
showView("today");
loadState();
setInterval(loadState, 1000);
