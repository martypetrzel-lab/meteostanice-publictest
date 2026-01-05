const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ================== HELPERY ================== */
const $ = id => document.getElementById(id);

function safeSet(id, value) {
  const el = $(id);
  if (el) el.innerText = value;
}

/* ================== ZÁLOŽKY ================== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy"),
  brain: $("view-brain")
};

function show(view, btn) {
  Object.values(views).forEach(v => v && v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));
  if (views[view]) views[view].classList.add("active");
  if (btn) btn.classList.add("active");
}

/* === NAVĚŠENÍ EVENTŮ (SPRÁVNĚ) === */
const btnToday = $("btnToday");
const btnHistory = $("btnHistory");
const btnEnergy = $("btnEnergy");
const btnBrain = $("btnBrain");

if (btnToday) btnToday.onclick = () => show("today", btnToday);
if (btnHistory) btnHistory.onclick = () => show("history", btnHistory);
if (btnEnergy) btnEnergy.onclick = () => show("energy", btnEnergy);
if (btnBrain) btnBrain.onclick = () => show("brain", btnBrain);

/* ================== GRAFY ================== */
const todayChart = $("todayChart")
  ? new Chart($("todayChart"), {
      type: "line",
      data: { labels: [], datasets: [{ label: "Teplota (°C)", data: [], borderColor: "#3b82f6", tension: 0.3 }] },
      options: { animation: false }
    })
  : null;

const historyChart = $("historyChart")
  ? new Chart($("historyChart"), {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          { label: "Minimum (°C)", data: [], backgroundColor: "#60a5fa" },
          { label: "Maximum (°C)", data: [], backgroundColor: "#ef4444" }
        ]
      },
      options: { animation: false }
    })
  : null;

const energyTodayChart = $("energyTodayChart")
  ? new Chart($("energyTodayChart"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Příjem (W)", data: [], borderColor: "#22c55e", tension: 0.3 },
          { label: "Výdej (W)", data: [], borderColor: "#ef4444", tension: 0.3 }
        ]
      },
      options: { animation: false }
    })
  : null;

const energyWeekChart = $("energyWeekChart")
  ? new Chart($("energyWeekChart"), {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Denní bilance (Wh)", data: [], backgroundColor: "#3b82f6" }] },
      options: { animation: false }
    })
  : null;

/* ================== DATA ================== */
async function loadState() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("API not ready");
    const s = await res.json();

    if (s.time?.now) safeSet("time", new Date(s.time.now).toLocaleTimeString());
    safeSet("mode", s.mode ?? "--");
    safeSet("message", s.message ?? "Čekám na data…");

    if (Array.isArray(s.details)) {
      $("details").innerHTML = s.details.join(" · ");
    }

    if (s.sensors) {
      safeSet("temp", `${s.sensors.temperatureOutside?.toFixed(1) ?? "--"} °C`);
      safeSet("light", `${Math.round(s.sensors.light ?? 0)} lx`);
    }

    if (s.battery) {
      safeSet("battery", `${s.battery.voltage.toFixed(2)} V`);
    }

    safeSet("fan", s.fan ? "ON" : "OFF");

    if (todayChart && s.memory?.today?.temperature?.length) {
      todayChart.data.labels = s.memory.today.temperature.map(p => p.t.slice(11, 16));
      todayChart.data.datasets[0].data = s.memory.today.temperature.map(p => p.v);
      todayChart.update();
    }

    if (historyChart && s.memory?.history?.length) {
      historyChart.data.labels = s.memory.history.map(d => d.day);
      historyChart.data.datasets[0].data = s.memory.history.map(d => d.min);
      historyChart.data.datasets[1].data = s.memory.history.map(d => d.max);
      historyChart.update();
    }

    if (s.power) {
      safeSet("energyIn", `${s.power.solarInW.toFixed(2)} W`);
      safeSet("energyOut", `${s.power.loadW.toFixed(2)} W`);
      safeSet("energyBalance", `${s.power.balanceWh.toFixed(3)} Wh`);
      const net = s.power.solarInW - s.power.loadW;
      safeSet("energyState", net > 0 ? "Nabíjí se" : net < 0 ? "Vybíjí se" : "Stabilní");
    }

    if (energyTodayChart && s.memory?.today?.energyIn?.length) {
      energyTodayChart.data.labels = s.memory.today.energyIn.map(p => p.t.slice(11, 16));
      energyTodayChart.data.datasets[0].data = s.memory.today.energyIn.map(p => p.v);
      energyTodayChart.data.datasets[1].data = s.memory.today.energyOut.map(p => p.v);
      energyTodayChart.update();
    }

    if (energyWeekChart && s.memory?.energyDays?.length) {
      energyWeekChart.data.labels = s.memory.energyDays.map(d => d.day);
      energyWeekChart.data.datasets[0].data = s.memory.energyDays.map(d => d.wh);
      energyWeekChart.update();
    }

    if ($("brainContent") && s.memory?.dailyPlan) {
      $("brainContent").innerHTML = `
        Režim: ${s.mode}<br>
        Strategie energie: ${s.memory.dailyPlan.energyStrategy}<br>
        Sezóna: ${s.memory.dailyPlan.seasonPhase}<br>
        Sampling: ${s.sampling?.profile} (${s.sampling?.intervalMin} min)<br>
        Event: ${s.events?.active ?? "žádný"}
      `;
    }

  } catch (e) {
    console.warn("UI čeká na backend…");
  }
}

loadState();
setInterval(loadState, 5000);
