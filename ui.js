document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function updateUI(state) {
  if (!state) return;

  const now = new Date(state.time.now);
  document.getElementById("timeText").textContent =
    "Čas: " + now.toLocaleTimeString("cs-CZ");

  const day = Math.floor((state.time.now / 1000 / 86400) % 21) + 1;
  document.getElementById("dayText").textContent = `Den ${day} / 21`;

  const dayProgress = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100;
  document.getElementById("dayProgress").style.width = `${dayProgress}%`;

  document.getElementById("modeText").textContent = `Režim: ${state.mode}`;

  document.getElementById("temp").textContent = state.sensors.temperature.toFixed(1);
  document.getElementById("battery").textContent = state.battery.voltage.toFixed(2);
  document.getElementById("light").textContent = Math.round(state.sensors.light);
  document.getElementById("fan").textContent = state.fan ? "Zapnutý" : "Vypnutý";

  const list = document.getElementById("details");
  list.innerHTML = "";
  state.details.forEach(d => {
    const li = document.createElement("li");
    li.textContent = d;
    list.appendChild(li);
  });
}
