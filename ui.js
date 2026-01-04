const API = "https://meteostanice-simulator-node-production.up.railway.app/state";

const todayChart = new Chart(todayChartEl, {
  type: "line",
  data: { labels: [], datasets: [{ data: [], borderColor: "#3b82f6" }] },
  options: { animation: false }
});

const energyChart = new Chart(energyTodayChart, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Bilance (W)", data: [], borderColor: "#22c55e" }
    ]
  },
  options: { animation: false }
});

const historyChart = new Chart(historyChartEl, {
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

async function update() {
  const d = await fetch(API).then(r => r.json());

  message.textContent = d.message;
  time.textContent = new Date(d.time.now).toLocaleTimeString("cs-CZ");
  temp.textContent = d.sensors.temperature.toFixed(1) + " °C";

  todayChart.data.labels = d.today.tempSeries.map(x => x.t.slice(11));
  todayChart.data.datasets[0].data = d.today.tempSeries.map(x => x.v);
  todayChart.update();

  energyChart.data.labels = d.today.energySeries.map(x => x.t.slice(11));
  energyChart.data.datasets[0].data = d.today.energySeries.map(x => x.v);
  energyChart.update();

  historyChart.data.labels = d.week.temp.map(x => x.day);
  historyChart.data.datasets[0].data = d.week.temp.map(x => x.min);
  historyChart.data.datasets[1].data = d.week.temp.map(x => x.max);
  historyChart.update();
}

setInterval(update, 5000);
update();
