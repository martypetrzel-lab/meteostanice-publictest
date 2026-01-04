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

/* ===== GRAFY ===== */
const todayChart = new Chart($("todayChart"), {
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

/* ===== POMOCNÉ ===== */
function hoursToText(h) {
  if (!isFinite(h) || h <= 0) return "--";
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${hh} h ${mm} min`;
}

/* ===== LOAD STATE ===== */
async function loadState() {
  try {
    const res = await fetch(API);
    const s = await res.json();

    /* ===== HLAVIČKA ===== */
    $("time").innerText = new Date(s.time.now).toLocaleTimeString("cs-CZ");
    $("mode").innerText = s.mode;
    $("headline").innerText = s.message ?? "";

    /* ===== DEN xx / 21 + PROGRESS ===== */
    const now = new Date(s.time.now);
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(24, 0, 0, 0);
    const progress = ((now - start) / (end - start)) * 100;

    $("dayLabel").innerText = `${Math.floor(progress / 100 * 21) + 1} / 21`;
    $("dayProgress").style.width = `${progress.toFixed(1)}%`;

    /* ===== DNES DATA ===== */
    $("temp").innerText = s.sensors.temperature.toFixed(1);
    $("battery").innerText = s.battery.voltage.toFixed(2);
    $("light").innerText = Math.round(s.sensors.light);
    $("fan").innerText = s.fan ? "ON" : "OFF";

    /* ===== GRAF TEPLOTA ===== */
    const t = s.memory.today.temperature;
    todayChart.data.labels = t.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    todayChart.data.datasets[0].data = t.map(x => x.v);
    todayChart.update();

    /* ===== ENERGIE STAT ===== */
    const inW = s.power.solarInW;
    const outW = s.power.loadW;
    const netW = inW - outW;

    $("energyIn").innerText = inW.toFixed(2);
    $("energyOut").innerText = outW.toFixed(2);
    $("energyBalance").innerText = s.power.balanceWh.toFixed(3);

    const CAPACITY_WH = 12;
    const soc = s.battery.soc;
    const storedWh = soc * CAPACITY_WH;

    let stateText = "--";

    if (Math.abs(netW) < 0.01) {
      stateText = "Stabilní";
    } else if (netW > 0) {
      const missing = CAPACITY_WH - storedWh;
      stateText = `Nabíjí se (${hoursToText(missing / netW)})`;
    } else {
      stateText = `Vybíjí se (${hoursToText(storedWh / Math.abs(netW))})`;
    }

    $("energyState").innerText = stateText;

    /* ===== ENERGIE DNES GRAF ===== */
    const ei = s.memory.today.energyIn;
    const eo = s.memory.today.energyOut;
    energyTodayChart.data.labels = ei.map(x => new Date(x.t).toLocaleTimeString("cs-CZ"));
    energyTodayChart.data.datasets[0].data = ei.map(x => x.v);
    energyTodayChart.data.datasets[1].data = eo.map(x => x.v);
    energyTodayChart.update();

    $("loading").style.display = "none";

  } catch (e) {
    console.error("Chyba načtení stavu", e);
  }
}

/* ===== START ===== */
loadState();
setInterval(loadState, 5000);
