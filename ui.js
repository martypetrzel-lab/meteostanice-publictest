const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ================== HELPERY ================== */
const $ = id => document.getElementById(id);
const safe = (v, d = "--") => (v === undefined || v === null ? d : v);

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
  views[view]?.classList.add("active");
  btn?.classList.add("active");
}

$("btnToday").onclick   = () => show("today", $("btnToday"));
$("btnHistory").onclick = () => show("history", $("btnHistory"));
$("btnEnergy").onclick  = () => show("energy", $("btnEnergy"));
$("btnBrain").onclick   = () => show("brain", $("btnBrain"));

/* ================== GRAFY ================== */
const todayChart = new Chart(document.createElement("canvas"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "Teplota (°C)", data: [], borderColor: "#3b82f6" }] },
  options: { animation: false }
});

const energyChart = new Chart(document.createElement("canvas"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Příjem (W)", data: [], borderColor: "#22c55e" },
      { label: "Výdej (W)", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

/* ================== DATA ================== */
async function loadState() {
  const res = await fetch(API);
  const s = await res.json();

  /* ===== DNES ===== */
  if (s.memory?.today?.temperature) {
    todayChart.data.labels = s.memory.today.temperature.map(p => p.t.slice(11,16));
    todayChart.data.datasets[0].data = s.memory.today.temperature.map(p => p.v);
    todayChart.update();
  }

  /* ===== ENERGIE ===== */
  if (s.memory?.today?.energyIn) {
    energyChart.data.labels = s.memory.today.energyIn.map(p => p.t.slice(11,16));
    energyChart.data.datasets[0].data = s.memory.today.energyIn.map(p => p.v);
    energyChart.data.datasets[1].data = s.memory.today.energyOut.map(p => p.v);
    energyChart.update();
  }

  /* ===== MOZEK ===== */
  $("brainContent").innerHTML = `
    <b>Režim:</b> ${s.mode}<br>
    <b>Zpráva:</b> ${s.message}<br>
    <b>Sezóna:</b> ${safe(s.memory?.dailyPlan?.seasonPhase)}<br>
    <b>Strategie:</b> ${safe(s.memory?.dailyPlan?.energyStrategy)}<br>
    <b>Sampling:</b> ${safe(s.sampling?.profile)} (${safe(s.sampling?.intervalMin)} min)
  `;
}

setInterval(loadState, 5000);
loadState();
