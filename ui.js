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
  data: {
    labels: [],
    datasets: [{
      label: "Teplota (°C)",
      data: [],
      borderColor: "#3b82f6",
      tension: 0.35,
      pointRadius: 2
    }]
  },
  options: { animation: false, plugins: { legend: { display: false } } }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Minimum (°C)", data: [], borderColor: "#60a5fa", tension: 0.3 },
      { label: "Maximum (°C)", data: [], borderColor: "#ef4444", tension: 0.3 }
    ]
  },
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Příjem (W)", data: [], borderColor: "#22c55e", tension: 0.35 },
      { label: "Výdej (W)", data: [], borderColor: "#ef4444", tension: 0.35 }
    ]
  },
  options: {
    animation: false,
    scales: { y: { beginAtZero: true } }
  }
});

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [{
      label: "Denní bilance (Wh)",
      data: [],
      backgroundColor: "#3b82f6"
    }]
  },
  options: { animation: false }
});

/* ===== STAV ===== */
let lastTempUpdate = 0;
let lastEnergyUpdate = 0;
const INTERVAL = 60 * 1000;

let energyTodayWh = 0;
let historyDays = [];
let energyDays = [];

/* ===== UPDATE ===== */
window.addEventListener("simulator:update", (e) => {
  const d = e.detail;
  const now = new Date(d.time.now);
  const label = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");

  /* ===== TEXTY ===== */
  $("message").textContent = d.message;
  $("time").textContent = now.toLocaleTimeString();
  $("mode").textContent = d.mode;
  $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = d.battery.voltage.toFixed(2) + " V";
  $("light").textContent = Math.round(d.environment.light) + " lx";
  $("fan").textContent = d.fan ? `zapnut (${d.fanPower}%)` : "vypnut";
  $("details").textContent = d.details.join(" · ");

  /* ===== OKAMŽITÁ ENERGIE (NOVÉ) ===== */
  const inW = d.power.solarInW;
  const outW = d.power.loadW;
  const balance = inW - outW;

  $("energyIn").textContent = inW.toFixed(2) + " W";
  $("energyOut").textContent = outW.toFixed(2) + " W";
  $("energyBalance").textContent =
    (balance >= 0 ? "+" : "") + balance.toFixed(2) + " W";

  $("energyState").textContent =
    balance > 0.05 ? "nabíjí se" :
    balance < -0.05 ? "vybíjí se" :
    "stabilní";

  /* ===== TEPLOTA – 1× ZA MINUTU ===== */
  if (d.time.now - lastTempUpdate >= INTERVAL) {
    todayChart.data.labels.push(label);
    todayChart.data.datasets[0].data.push(d.sensors.temperature);

    if (todayChart.data.labels.length > 1440) {
      todayChart.data.labels.shift();
      todayChart.data.datasets[0].data.shift();
    }

    todayChart.update();
    lastTempUpdate = d.time.now;
  }

  /* ===== ENERGIE – GRAF 1× ZA MINUTU ===== */
  if (d.time.now - lastEnergyUpdate >= INTERVAL) {
    energyTodayChart.data.labels.push(label);
    energyTodayChart.data.datasets[0].data.push(inW);
    energyTodayChart.data.datasets[1].data.push(outW);

    if (energyTodayChart.data.labels.length > 1440) {
      energyTodayChart.data.labels.shift();
      energyTodayChart.data.datasets.forEach(ds => ds.data.shift());
    }

    energyTodayChart.update();
    lastEnergyUpdate = d.time.now;
  }

  /* ===== WH VÝPOČET ===== */
  energyTodayWh += balance / 3600;
  $("energySummary").textContent =
    `Bilance dnes: ${energyTodayWh.toFixed(2)} Wh`;

  /* ===== UZAVŘENÍ DNE ===== */
  if (now.getHours() === 23 && now.getMinutes() === 59) {

    historyDays.push({
      day: now.toLocaleDateString("cs-CZ", { weekday: "short" }),
      min: Math.min(...todayChart.data.datasets[0].data),
      max: Math.max(...todayChart.data.datasets[0].data)
    });
    if (historyDays.length > 7) historyDays.shift();

    historyChart.data.labels = historyDays.map(d => d.day);
    historyChart.data.datasets[0].data = historyDays.map(d => d.min);
    historyChart.data.datasets[1].data = historyDays.map(d => d.max);
    historyChart.update();

    energyDays.push({
      day: now.toLocaleDateString("cs-CZ", { weekday: "short" }),
      wh: +energyTodayWh.toFixed(2)
    });
    if (energyDays.length > 7) energyDays.shift();

    energyWeekChart.data.labels = energyDays.map(d => d.day);
    energyWeekChart.data.datasets[0].data = energyDays.map(d => d.wh);
    energyWeekChart.update();

    energyTodayWh = 0;
    energyTodayChart.data.labels = [];
    energyTodayChart.data.datasets.forEach(ds => ds.data = []);
    energyTodayChart.update();
  }
});
