const API = "https://meteostanice-simulator-node-production.up.railway.app/state";
const $ = id => document.getElementById(id);
const safeSet = (id, v) => $(id) && ( $(id).innerText = v );

let initialized = false;
let todayChart, energyChart;

function initCharts(s) {
  if (initialized || !window.Chart) return;

  todayChart = new Chart($("todayChart"), {
    type: "line",
    data: {
      labels: s.memory.today.temperature.map(x => x.t),
      datasets: [{
        label: "Teplota (°C)",
        data: s.memory.today.temperature.map(x => x.v),
        borderColor: "#3b82f6",
        tension: 0.3
      }]
    },
    options: { animation: false }
  });

  energyChart = new Chart($("energyTodayChart"), {
    type: "line",
    data: {
      labels: s.memory.today.energyIn.map(x => x.t),
      datasets: [
        {
          label: "Příjem (W)",
          data: s.memory.today.energyIn.map(x => x.v),
          borderColor: "#22c55e",
          tension: 0.3
        },
        {
          label: "Výdej (W)",
          data: s.memory.today.energyOut.map(x => x.v),
          borderColor: "#ef4444",
          tension: 0.3
        }
      ]
    },
    options: { animation: false }
  });

  initialized = true;
}

async function loadState() {
  const s = await fetch(API, { cache: "no-store" }).then(r => r.json());

  safeSet("time", new Date(s.time.now).toLocaleTimeString());
  safeSet("message", s.message);
  safeSet("temp", `${s.device.temperature.toFixed(1)} °C`);
  safeSet("battery", `${s.device.battery.voltage.toFixed(2)} V`);
  safeSet("light", `${Math.round(s.device.light)} lx`);
  safeSet("fan", s.device.fan ? "ON" : "OFF");

  initCharts(s);
}

loadState();
setInterval(loadState, 1000);
