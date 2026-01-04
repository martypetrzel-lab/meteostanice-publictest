window.addEventListener("simulator:update", (e) => {
  const d = e.detail;
  const now = new Date(d.time.now);

  document.getElementById("time").textContent =
    now.toLocaleTimeString("cs-CZ");

  const start = d.time.start;
  const day = Math.floor((d.time.now - start) / 86400000) + 1;

  document.getElementById("day").textContent =
    `Den ${day} / 21`;

  document.getElementById("dayProgress").style.width =
    Math.min(100, (day / 21) * 100) + "%";
});
