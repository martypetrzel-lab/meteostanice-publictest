let chart;

async function loadState() {
  const res = await fetch("/state");
  const state = await res.json();

  document.getElementById("light").textContent =
    Math.round(state.world.environment.light);

  document.getElementById("temp").textContent =
    state.device.temperature ?? "—";

  document.getElementById("soc").textContent =
    Math.round(state.device.battery.soc * 100);

  document.getElementById("load").textContent =
    state.device.power.loadW.toFixed(2);

  document.getElementById("fan").textContent =
    state.device.fan ? "ZAPNUTÝ 🌬️" : "VYPNUTÝ";

  // --- MOZEK ---
  document.getElementById("summary").textContent =
    state.brain.summary ?? "";

  const reasons = document.getElementById("reasons");
  reasons.innerHTML = "";
  (state.brain.reasons || []).forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    reasons.appendChild(li);
  });

  document.getElementById("alternatives").textContent =
    (state.brain.alternatives || []).join(" | ");

  // --- GRAF ---
  const labels = state.memory.today.light.map(p => p.t);
  const values = state.memory.today.light.map(p => p.v);

  if (!chart) {
    const ctx = document.getElementById("chart");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Světlo (lx)",
          data: values
        }]
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
  }
}

setInterval(loadState, 2000);
loadState();
