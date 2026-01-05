const API =
  "https://meteostanice-simulator-node-production.up.railway.app/state";

/* ===== TAB SYSTEM ===== */
function showTab(id) {
  document.querySelectorAll(".tab").forEach(t => {
    t.style.display = "none";
  });

  document.querySelectorAll(".tabs button").forEach(b => {
    b.classList.remove("active");
  });

  document.getElementById(id).style.display = "block";

  document
    .querySelector(`button[onclick="showTab('${id}')"]`)
    .classList.add("active");
}

/* ===== FETCH ===== */
async function loadState() {
  const res = await fetch(API);
  const state = await res.json();
  if (!state || !state.time) return;

  renderToday(state);
  renderHistory(state);
  renderEnergy(state);
  renderBrain(state);
}

/* ===== DNES ===== */
function renderToday(s) {
  document.getElementById("todayContent").innerHTML = `
    <b>Čas:</b> ${new Date(s.time.now).toLocaleTimeString()}<br>
    <b>Režim:</b> ${s.mode}<br>
    <b>Zpráva:</b> ${s.message}<br><br>

    🌡️ Venek: ${s.environment.temperature.toFixed(1)} °C<br>
    🌡️ Vnitřek: ${s.environment.insideTemp.toFixed(1)} °C<br>
    🔋 Baterie: ${s.battery.voltage.toFixed(2)} V (${Math.round(
      s.battery.soc * 100
    )} %)<br>
    ☀️ Světlo: ${s.environment.light.toFixed(0)} lx<br>
    🌀 Větrák: ${s.fan ? "ZAPNUT" : "VYPNUT"}
  `;
}

/* ===== HISTORIE ===== */
function renderHistory(s) {
  if (!s.memory.history.length) {
    document.getElementById("historyContent").innerText =
      "Zatím žádná historie.";
    return;
  }

  document.getElementById("historyContent").innerHTML = s.memory.history
    .map(
      d => `
      <div>
        <b>${d.day}</b><br>
        Min: ${d.min.toFixed(1)} °C / Max: ${d.max.toFixed(1)} °C<br>
        Režim: ${d.mode}<br>
        Plán: ${d.plan.energyStrategy}
      </div><hr>`
    )
    .join("");
}

/* ===== ENERGIE ===== */
function renderEnergy(s) {
  if (!s.memory.energyDays.length) {
    document.getElementById("energyContent").innerText =
      "Energetická data zatím nejsou k dispozici.";
    return;
  }

  document.getElementById("energyContent").innerHTML = s.memory.energyDays
    .map(
      d => `
      <div>
        <b>${d.day}</b> – ${d.wh.toFixed(2)} Wh
      </div>`
    )
    .join("");
}

/* ===== MOZEK ===== */
function renderBrain(s) {
  const p = s.memory.dailyPlan;
  const samp = s.sampling;

  document.getElementById("brainContent").innerHTML = `
    <b>Aktuální režim:</b> ${s.mode}<br>
    <b>Rozhodnutí:</b> ${s.message}<br><br>

    <b>📅 Plán dne</b><br>
    Strategie: ${p.energyStrategy}<br>
    Tepelná strategie: ${p.thermalStrategy}<br>
    Sezónní fáze: ${p.seasonPhase}<br>
    Důvěra: ${Math.round(p.confidence * 100)} %<br>
    Poznámka: ${p.notes}<br><br>

    <b>⏱️ Sampling</b><br>
    Profil: ${samp.profile}<br>
    Interval: ${samp.intervalMin} min<br><br>

    <b>🌩️ Event</b><br>
    ${s.events?.active || "Žádný"}
  `;
}

/* ===== LOOP ===== */
setInterval(loadState, 3000);
loadState();
