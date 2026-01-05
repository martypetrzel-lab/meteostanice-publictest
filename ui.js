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
  Object.values(views).forEach(v => v.classList.remove("active"));
  document.querySelectorAll("header button").forEach(b => b.classList.remove("active"));
  views[view].classList.add("active");
  btn.classList.add("active");
}

$("btnToday").onclick   = () => show("today", $("btnToday"));
$("btnHistory").onclick = () => show("history", $("btnHistory"));
$("btnEnergy").onclick  = () => show("energy", $("btnEnergy"));
$("btnBrain").onclick   = () => show("brain", $("btnBrain"));

/* ================== GRAFY ================== */
const todayChart = new Chart($("todayChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [{ label: "Teplota (°C)", data: [], borderColor: "#3b82f6", tension: 0.3 }]
  },
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
    datasets: [{ label: "Denní bilance (Wh)", data: [], backgroundColor: "#3b82f6" }]
  },
  options: { animation: false }
});

/* ================== STRES / EVENT ================== */
function stressInfo(s) {
  const stresses = [];

  if (s.events?.active) stresses.push(s.events.active);
  if (!s.time.isDay) stresses.push("noc");
  if (s.battery.soc < 0.3) stresses.push("nízká baterie");
  if (s.power.loadW > s.power.solarInW + 0.5) stresses.push("vysoká spotřeba");
  if (s.fan) stresses.push("aktivní chlazení");

  return stresses;
}

function stressMessage(stresses) {
  if (!stresses.length) return null;
  return "⚠️ STRESOVÁ SITUACE: " + stresses.join(", ");
}

/* ================== HLÁŠKY ================== */
function humanMessage(s) {
  const net = s.power.solarInW - s.power.loadW;
  const soc = s.battery.soc;

  if (!s.time.isDay && soc < 0.3) return "🌙 Je noc a energie rychle ubývá.";
  if (!s.time.isDay) return "🌙 Je noc, šetřím energii.";
  if (soc < 0.25) return "⚠️ Energie je kriticky nízká.";
  if (soc < 0.45) return "🔋 Baterie není v ideálním stavu.";
  if (net > 0.3) return "☀️ Slunce pomáhá, ukládám energii.";
  if (net < 0) return "🔄 Spotřeba převyšuje příjem.";
  if (s.fan) return "🌀 Aktivně chladím zařízení.";
  return "✅ Podmínky jsou stabilní.";
}

function humanReason(s, stresses) {
  if (stresses.length) {
    return "Reaguji na stresovou situaci: " + stresses.join(", ") + ".";
  }

  const reasons = [];
  reasons.push(s.time.isDay ? "je den" : "je noc");
  reasons.push(`SOC ${Math.round(s.battery.soc * 100)} %`);
  reasons.push(`sampling ${s.sampling.profile}`);
  return "Protože " + reasons.join(", ") + ".";
}

/* ================== DATA ================== */
async function loadState() {
  const res = await fetch(API);
  const s = await res.json();

  safeSet("time", new Date(s.time.now).toLocaleTimeString());
  safeSet("mode", s.mode);

  const stresses = stressInfo(s);
  const stressLine = stressMessage(stresses);

  safeSet("message", stressLine || humanMessage(s));
  $("details").innerText = humanReason(s, stresses);

  /* DNES */
  safeSet("temp", `${s.sensors.temperatureOutside.toFixed(1)} °C`);
  safeSet("battery", `${s.battery.voltage.toFixed(2)} V`);
  safeSet("light", `${Math.round(s.sensors.light)} lx`);
  safeSet("fan", s.fan ? "ON" : "OFF");

  if (s.memory?.today?.temperature?.length) {
    todayChart.data.labels = s.memory.today.temperature.map(p => p.t.slice(11,16));
    todayChart.data.datasets[0].data = s.memory.today.temperature.map(p => p.v);
    todayChart.update();
  }

  /* HISTORIE */
  if (s.memory?.history?.length) {
    historyChart.data.labels = s.memory.history.map(d => d.day);
    historyChart.data.datasets[0].data = s.memory.history.map(d => d.min);
    historyChart.data.datasets[1].data = s.memory.history.map(d => d.max);
    historyChart.update();
  }

  /* ENERGIE */
  safeSet("energyIn", `${s.power.solarInW.toFixed(2)} W`);
  safeSet("energyOut", `${s.power.loadW.toFixed(2)} W`);
  safeSet("energyBalance", `${s.power.balanceWh.toFixed(3)} Wh`);

  const net = s.power.solarInW - s.power.loadW;
  safeSet("energyState", net > 0 ? "Nabíjí se" : net < 0 ? "Vybíjí se" : "Stabilní");

  if (s.memory?.today?.energyIn?.length) {
    energyTodayChart.data.labels = s.memory.today.energyIn.map(p => p.t.slice(11,16));
    energyTodayChart.data.datasets[0].data = s.memory.today.energyIn.map(p => p.v);
    energyTodayChart.data.datasets[1].data = s.memory.today.energyOut.map(p => p.v);
    energyTodayChart.update();
  }

  if (s.memory?.energyDays?.length) {
    energyWeekChart.data.labels = s.memory.energyDays.map(d => d.day);
    energyWeekChart.data.datasets[0].data = s.memory.energyDays.map(d => d.wh);
    energyWeekChart.update();
  }

  /* MOZEK */
  $("brainContent").innerHTML = `
    Režim: ${s.mode}<br>
    Aktivní stresy: ${stresses.length ? stresses.join(", ") : "žádné"}<br>
    Strategie: ${s.memory.dailyPlan.energyStrategy}<br>
    Sampling: ${s.sampling.profile} (${s.sampling.intervalMin} min)
  `;
}

loadState();
setInterval(loadState, 5000);
