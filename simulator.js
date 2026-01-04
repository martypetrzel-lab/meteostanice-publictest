// simulator.js – frontend listener (BEZE ZMĚN LOGIKY, jen čas + progress)

window.addEventListener("simulator:update", (e) => {
  const d = e.detail;
  const now = new Date(d.time.now);

  /* ===== HLAVIČKA ===== */
  document.getElementById("message").textContent = d.message;
  document.getElementById("time").textContent = now.toLocaleTimeString("cs-CZ");
  document.getElementById("mode").textContent = d.mode;

  /* ===== DEN SIMULACE ===== */
  const start = d.time.start;        // timestamp startu simulace (ze serveru)
  const day = Math.floor((d.time.now - start) / (1000 * 60 * 60 * 24)) + 1;
  document.getElementById("day").textContent = `Den ${day} / 21`;

  const progress = Math.min(100, (day / 21) * 100);
  document.getElementById("dayProgress").style.width = progress + "%";

  /* ===== TILES ===== */
  document.getElementById("temp").textContent =
    d.sensors.temperature.toFixed(1) + " °C";
  document.getElementById("battery").textContent =
    d.battery.voltage.toFixed(2) + " V";
  document.getElementById("light").textContent =
    Math.round(d.environment.light) + " lx";
  document.getElementById("fan").textContent =
    d.fan ? `zapnut (${d.fanPower}%)` : "vypnut";

  document.getElementById("details").textContent =
    d.details.join(" · ");
});
