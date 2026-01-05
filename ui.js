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

/* ================== NAV ================== */
$("btnToday")?.addEventListener("click", e => show("today", e.target));
$("btnHistory")?.addEventListener("click", e => show("history", e.target));
$("btnEnergy")?.addEventListener("click", e => show("energy", e.target));
$("btnBrain")?.addEventListener("click", e => show("brain", e.target));

/* ================== GRAFY ================== */
const todayChart = $("todayChart")
  ? new Chart($("todayChart"), {
      type: "line",
      data: {
        labels: [],
        datasets: [{ label: "Teplota (°C)", data: [], borderColor: "#3b82f6", tension: 0.3 }]
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

/* ================== DATA ================== */
async function loadState() {
  try {
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error("API not ready");
    const s = await res.json();

    /* ⏱️ ČAS */
    if (s.time?.now) {
      safeSet("time", new Date(s.time.now).toLocaleTimeString("cs-CZ"));
    }

    /* 🧠 STAV */
    safeSet("mode", s.mode ?? "--");
    safeSet("message", s.message ?? "—");

    if (Array.isArray(s.details)) {
      $("details").innerText = s.details.join(" · ");
    }

    /* 🌡️ SENZORY */
    if (s.sensors) {
      safeSet("temp", `${s.sensors.temperature.toFixed(1)} °C`);
      safeSet("light", `${Math.round(s.sensors.light)} lx`);
    }

    /* 🔋 BATERIE */
    if (s.battery) {
      safeSet("battery", `${s.battery.voltage.toFixed(2)} V`);
    }

    /* 🌀 VĚTRÁK */
    safeSet("fan", s.fan ? "ON" : "OFF");

    /* 📈 TEPLOTA DNES */
    if (todayChart && s.memory?.today?.temperature?.length) {
      todayChart.data.labels = s.memory.today.temperature.map(p => p.t);
      todayChart.data.datasets[0].data = s.memory.today.temperature.map(p => p.v);
      todayChart.update();
    }

    /* ⚡ ENERGIE */
    if (s.power) {
      safeSet("energyIn", `${s.power.solarInW.toFixed(2)} W`);
      safeSet("energyOut", `${s.power.loadW.toFixed(2)} W`);
      safeSet("energyBalance", `${s.power.balanceWh.toFixed(4)} Wh`);
      const net = s.power.solarInW - s.power.loadW;
      safeSet("energyState", net > 0 ? "Nabíjí se" : net < 0 ? "Vybíjí se" : "Stabilní");
    }

    if (energyTodayChart && s.memory?.today?.energyIn?.length) {
      energyTodayChart.data.labels = s.memory.today.energyIn.map(p => p.t);
      energyTodayChart.data.datasets[0].data = s.memory.today.energyIn.map(p => p.v);
      energyTodayChart.data.datasets[1].data = s.memory.today.energyOut.map(p => p.v);
      energyTodayChart.update();
    }

  } catch (e) {
    console.warn("UI čeká na backend…");
  }
}

/* 🔁 1 SEKUNDA = 1 SEKUNDA */
loadState();
setInterval(loadState, 1000);
