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
  data: { labels: [], datasets: [{ data: [], borderColor: "#3b82f6", tension: 0.35 }] },
  options: { animation: false, plugins: { legend: { display: false } } }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { data: [], borderColor: "#60a5fa" },
    { data: [], borderColor: "#ef4444" }
  ]},
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { data: [], borderColor: "#22c55e" },
    { data: [], borderColor: "#ef4444" }
  ]},
  options: { animation: false }
});

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: { labels: [], datasets: [{ data: [], backgroundColor: "#3b82f6" }] },
  options: { animation: false }
});

/* ===== UPDATE ===== */
window.addEventListener("simulator:update", (e) => {
  const d = e.detail;
  const now = new Date(d.time.now);

  $("time").textContent = now.toLocaleTimeString("cs-CZ");
  $("dayIndex").textContent = d.time.dayIndex;

  const progress = ((now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()) / 86400) * 100;
  $("dayProgress").style.width = progress + "%";

  $("message").textContent = d.message;
  $("details").textContent = d.details.join(" · ");
  $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = d.battery.voltage.toFixed(2) + " V";
  $("light").textContent = Math.round(d.environment.light) + " lx";
  $("fan").textContent = d.fan ? "zapnut" : "vypnut";

  $("energyIn").textContent = d.power.solarInW.toFixed(2) + " W";
  $("energyOut").textContent = d.power.loadW.toFixed(2) + " W";
  $("energyBalance").textContent = (d.power.solarInW - d.power.loadW).toFixed(2) + " W";
});
