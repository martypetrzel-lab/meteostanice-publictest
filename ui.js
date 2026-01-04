const $ = id => document.getElementById(id);

/* ZÁLOŽKY */
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

/* GRAFY */
const todayChart = new Chart($("todayChart"), {
  type: "line",
  data: { labels: [], datasets: [{ data: [], borderColor: "#3b82f6", tension: 0.3 }] },
  options: { animation: false, plugins: { legend: { display: false } } }
});

const historyChart = new Chart($("historyChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Min", data: [], borderColor: "#60a5fa" },
      { label: "Max", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyTodayChart = new Chart($("energyTodayChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Příjem", data: [], borderColor: "#22c55e" },
      { label: "Výdej", data: [], borderColor: "#ef4444" }
    ]
  },
  options: { animation: false }
});

const energyWeekChart = new Chart($("energyWeekChart"), {
  type: "bar",
  data: { labels: [], datasets: [{ data: [], backgroundColor: "#3b82f6" }] },
  options: { animation: false }
});

/* UPDATE */
window.addEventListener("simulator:update", e => {
  const d = e.detail;
  const now = new Date(d.time.now);
  const start = d.time.start;

  $("time").textContent = now.toLocaleTimeString();
  $("mode").textContent = d.mode;
  $("message").textContent = d.message;
  $("temp").textContent = d.sensors.temperature.toFixed(1) + " °C";
  $("battery").textContent = d.battery.voltage.toFixed(2) + " V";
  $("light").textContent = Math.round(d.environment.light) + " lx";
  $("fan").textContent = d.fan ? "zapnut" : "vypnut";
  $("details").textContent = d.details.join(" · ");

  const day = Math.min(Math.floor((d.time.now - start) / 86400000) + 1, 21);
  $("day").textContent = day;
  $("progress").style.width = (day / 21 * 100) + "%";
});
