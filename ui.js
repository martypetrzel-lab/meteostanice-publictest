const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

async function loadState() {
  const res = await fetch(API);
  const s = await res.json();

  if (!s || !s.memory) return;

  renderStatus(s);
  renderDecision(s);
  renderPlan(s);
  renderSampling(s);
}

function renderStatus(s) {
  document.getElementById("status").innerHTML = `
    🌡️ Venek: ${s.environment.temperature.toFixed(1)} °C<br>
    🌡️ Vnitřek: ${s.environment.insideTemp.toFixed(1)} °C<br>
    🔋 Baterie: ${s.battery.voltage.toFixed(2)} V (${Math.round(s.battery.soc * 100)} %)<br>
    ⚡ Solár: ${s.power.solarInW.toFixed(2)} W / Zátěž: ${s.power.loadW.toFixed(2)} W<br>
    🌀 Větrák: ${s.fan ? "ZAPNUT" : "VYPNUT"}
  `;
}

function renderDecision(s) {
  document.getElementById("decision").innerHTML = `
    <b>Režim:</b> ${s.mode}<br>
    <b>Zpráva:</b> ${s.message}<br>
    <b>Důvody:</b>
    <ul>
      ${s.details.map(d => `<li>${d}</li>`).join("")}
    </ul>
  `;
}

function renderPlan(s) {
  const p = s.memory.dailyPlan;
  if (!p || !p.date) {
    document.getElementById("dailyPlan").innerHTML =
      "Plán dne zatím není vytvořen.";
    return;
  }

  document.getElementById("dailyPlan").innerHTML = `
    📅 Datum: ${p.date}<br>
    🔋 Energetická strategie: <b>${p.energyStrategy}</b><br>
    🌡️ Tepelná strategie: ${p.thermalStrategy}<br>
    📈 Sampling bias: ${p.samplingBias}<br>
    🎯 Důvěra: ${Math.round(p.confidence * 100)} %<br>
    📝 Poznámka: ${p.notes}
  `;
}

function renderSampling(s) {
  document.getElementById("sampling").innerHTML = `
    ⏱️ Profil: <b>${s.sampling.profile}</b><br>
    ⏲️ Interval: ${s.sampling.intervalMin} min<br>
    🌩️ Event: ${s.events?.active || "žádný"}
  `;
}

setInterval(loadState, 3000);
loadState();
