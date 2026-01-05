const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ================== HELPERY ================== */
const $ = id => document.getElementById(id);

function safeSet(id, v) {
  const el = $(id);
  if (el) el.innerText = v;
}

/* ================== ZÁLOŽKY ================== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy"),
  brain: $("view-brain")
};

function showView(name) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove("active");
  });

  document.querySelectorAll("header button").forEach(b => {
    b.classList.remove("active");
  });

  if (views[name]) views[name].classList.add("active");

  const btn = $("btn" + name.charAt(0).toUpperCase() + name.slice(1));
  if (btn) btn.classList.add("active");
}

/* NAVÁZÁNÍ KLIKŮ – BEZ ?. */
[
  ["btnToday", "today"],
  ["btnHistory", "history"],
  ["btnEnergy", "energy"],
  ["btnBrain", "brain"]
].forEach(([id, view]) => {
  const btn = $(id);
  if (btn) btn.onclick = () => showView(view);
});

/* ================== GRAFY ================== */
let todayChart = null;
let energyChart = null;
let initialized = false;

let lastTempLabel = null;
let lastEnergyLabel = null;

function initCharts(s) {
  if (initialized || !window.Chart) return;
  if (!s.memory || !s.memory.today) return;

  const t = s.memory.today.temperature || [];
  const ei = s.memory.today.energyIn || [];
  const eo = s.memory.today.energyOut || [];

  const tempCanvas = $("todayChart");
  if (tempCanvas && t.length) {
    todayChart = new Chart(tempCanvas, {
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
    lastTempLabel = t[t.length - 1].t;
  }

  const energyCanvas = $("energyTodayChart");
  if (energyCanvas && ei.length && eo.length) {
    energyChart = new Chart(energyCanvas, {
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
    lastEnergyLabel = ei[ei.length - 1].t;
  }

  initialized = true;
}

/* ================== LIVE UPDATE ================== */
async function loadState() {
  try {
    const res = await fetch(API, { cache: "no-store" });
    const s = await res.json();

    /* HLAVIČKA */
    safeSet("time", new Date(s.time.now).toLocaleTimeString());
    safeSet("message", s.message || "--");

    /* HODNOTY */
    if (s.device) {
      if (typeof s.device.temperature === "number") {
        safeSet("temp", `${s.device.temperature.toFixed(1)} °C`);
      }

      if (s.device.battery) {
        safeSet("battery", `${s.device.battery.voltage.toFixed(2)} V`);
      }

      if (typeof s.device.light === "number") {
        safeSet("light", `${Math.round(s.device.light)} lx`);
      }

      safeSet("fan", s.device.fan ? "ON" : "OFF");

      if (s.device.power) {
        safeSet("energyIn", `${s.device.power.solarInW.toFixed(2)} W`);
        safeSet("energyOut", `${s.device.power.loadW.toFixed(2)} W`);
        safeSet("energyBalance", `${s.device.power.balanceWh.toFixed(3)} Wh`);
      }
    }

    initCharts(s);

    /* DOPLNĚNÍ TEPLOTY */
    if (todayChart && s.memory?.today?.temperature?.length) {
      const arr = s.memory.today.temperature;
      const last = arr[arr.length - 1];

      if (last.t !== lastTempLabel) {
        todayChart.data.labels.push(last.t);
        todayChart.data.datasets[0].data.push(last.v);
        lastTempLabel = last.t;

        if (todayChart.data.labels.length > 120) {
          todayChart.data.labels.shift();
          todayChart.data.datasets[0].data.shift();
        }

        todayChart.update();
      }
    }

    /* DOPLNĚNÍ ENERGIE */
    if (
      energyChart &&
      s.memory?.today?.energyIn?.length &&
      s.memory?.today?.energyOut?.length
    ) {
      const ei = s.memory.today.energyIn;
      const eo = s.memory.today.energyOut;

      const last = ei[ei.length - 1];

      if (last.t !== lastEnergyLabel) {
        energyChart.data.labels.push(last.t);
        energyChart.data.datasets[0].data.push(last.v);
        energyChart.data.datasets[1].data.push(eo[eo.length - 1].v);

        lastEnergyLabel = last.t;

        if (energyChart.data.labels.length > 120) {
          energyChart.data.labels.shift();
          energyChart.data.datasets.forEach(d => d.data.shift());
        }

        energyChart.update();
      }
    }

  } catch (e) {
    console.warn("UI čeká na backend…", e);
  }
}

/* ================== START ================== */
showView("today");
loadState();

/* POZDĚJI ZPOMALÍME – TEĎ 1s */
setInterval(loadState, 1000);
