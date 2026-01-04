const $ = id => document.getElementById(id);

/* ===== ZÁLOŽKY ===== */
const views = {
  today: $("view-today"),
  history: $("view-history"),
  energy: $("view-energy")
};

function show(view, btn) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  $("btnToday").classList.remove("active");
  $("btnHistory").classList.remove("active");
  $("btnEnergy").classList.remove("active");

  views[view].classList.add("active");
  btn.classList.add("active");
}

$("btnToday").onclick = () => show("today", $("btnToday"));
$("btnHistory").onclick = () => show("history", $("btnHistory"));
$("btnEnergy").onclick = () => show("energy", $("btnEnergy"));

/* ===== GRAFY ===== */
const todayChart = new Chart($("todayChart"), {
  type: "line",
  data: { labels: [], datasets: [{
    label: "Teplota (°C)",
    data: [],
    borderColor: "#3b82f6",
    tension: 0.35,
    pointRadius: 2
  }]},
  options: { animation: false, plugins: { legend: { display: false } } }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Minimum", data: [], borderColor: "#60a5fa" },
      { label: "Maximum", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
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

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: { labels: [], datasets: [{
    label: "Denní bilance (Wh)",
    data: [],
    backgroundColor: "#3b82f6"
  }]},
  options: { animation: false }
});

/* ===== STAV ===== */
let lastMinute = null;
let energyTodayWh = 0;

/* ===== HLAVNÍ FETCH ZE SERVERU ===== */
async function fetchState() {
  try {
    const res = await fetch(
      "https://meteostanice-simulator-node-production.up.railway.app/state"
    );
    const d = await res.json();

    const now = new Date(d.time.now);
    const label = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");

    /* TEXTY */
    $("message").textContent = d.message;
    $("time").textContent = now.toLocaleTimeString();
    $("mode").textContent = d.mode;
    $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
    $("battery").textContent = d.battery.voltage.toFixed(2) + " V";
    $("light").textContent = Math.round(d.environment.light) + " lx";
    $("fan").textContent = d.fan ? `zapnut (${d.fanPower}%)` : "vypnut";
    $("details").textContent = d.details.join(" · ");

    /* ENERGIE */
    const inW = d.power.solarInW;
    const outW = d.power.loadW;
    const balance = inW - outW;

    $("energyIn").textContent = inW.toFixed(2) + " W";
    $("energyOut").textContent = outW.toFixed(2) + " W";
    $("energyBalance").textContent =
      (balance >= 0 ? "+" : "") + balance.toFixed(2) + " W";

    $("energyState").textContent =
      balance > 0.05 ? "nabíjí se" :
      balance < -0.05 ? "vybíjí se" : "stabilní";

    /* GRAFY – 1× ZA MINUTU */
    if (lastMinute !== now.getMinutes()) {
      todayChart.data.labels.push(label);
      todayChart.data.datasets[0].data.push(d.sensors.temperature);
      todayChart.update();

      energyTodayChart.data.labels.push(label);
      energyTodayChart.data.datasets[0].data.push(inW);
      energyTodayChart.data.datasets[1].data.push(outW);
      energyTodayChart.update();

      energyTodayWh += balance / 60;
      $("energySummary").textContent =
        `Bilance dnes: ${energyTodayWh.toFixed(2)} Wh`;

      lastMinute = now.getMinutes();
    }

  } catch (e) {
    console.error("❌ Nelze načíst stav ze serveru", e);
  }
}

/* ===== CYKLUS ===== */
setInterval(fetchState, 1000);
fetchState();
