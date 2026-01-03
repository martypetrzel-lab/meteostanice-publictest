/* ================================
   brain.js
   Lidský mozek s denním kontextem
   ================================ */

const Brain = {

  internal: {
    lastTemp: null,
    tempTrend: 0,

    lastMessage: "",
    lastMessageTime: 0,

    dayStartHour: null,
    daySummary: "Den začíná, sbírám data."
  },

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  evaluate(input) {
    const { env, battery, power, time } = input;
    const date = new Date(time.now);
    const hour = date.getHours();

    /* ===== START NOVÉHO DNE ===== */
    if (hour === 0 && this.internal.dayStartHour !== date.getDate()) {
      this.internal.dayStartHour = date.getDate();
      this.internal.daySummary = "Nový den začíná, sleduji podmínky.";
    }

    /* ===== TREND TEPLOTY ===== */
    if (this.internal.lastTemp !== null) {
      this.internal.tempTrend = env.temperature - this.internal.lastTemp;
    }
    this.internal.lastTemp = env.temperature;

    const rising = this.internal.tempTrend > 0.02;

    /* ===== ENERGIE ===== */
    let mode = "NORMAL";
    if (battery.voltage < 3.4) mode = "SAVE";
    if (battery.voltage < 3.2) mode = "CRITICAL";

    /* ===== DENNÍ SHRNUTÍ ===== */
    if (mode === "CRITICAL") {
      this.internal.daySummary =
        "Dnes je energie kriticky nízká, provoz je výrazně omezen.";
    }
    else if (mode === "SAVE") {
      this.internal.daySummary =
        "Dnes je potřeba šetřit energií, stanice běží úsporně.";
    }
    else if (env.temperature >= 30) {
      this.internal.daySummary =
        "Dnešek je teplý, zařízení sleduje riziko přehřátí.";
    }
    else if (power.solarInW > power.loadW) {
      this.internal.daySummary =
        "Podmínky jsou příznivé, energie se dnes daří udržet.";
    }

    /* ===== HLAVNÍ VĚTA (POMALÁ) ===== */
    let message = this.internal.daySummary;

    const MESSAGE_INTERVAL = 15 * 60 * 1000; // 15 minut

    if (
      this.internal.lastMessage &&
      time.now - this.internal.lastMessageTime < MESSAGE_INTERVAL
    ) {
      message = this.internal.lastMessage;
    } else {
      this.internal.lastMessage = message;
      this.internal.lastMessageTime = time.now;
    }

    /* ===== VĚTRÁK (STEJNÁ LOGIKA JAKO DŘÍV) ===== */
    let fanPower = 0;
    if (mode !== "CRITICAL" && battery.voltage > 3.5) {
      if (env.temperature >= 32) fanPower = time.isDay ? 60 : 30;
      else if (env.temperature >= 28 && rising) fanPower = time.isDay ? 40 : 20;

      if (power.solarInW < power.loadW) fanPower *= 0.6;
    }

    fanPower = Math.round(Math.min(100, Math.max(0, fanPower)));

    return {
      mode,
      fan: fanPower > 0,
      fanPower,
      mainMessage: message,
      details: [
        `Teplota ${env.temperature.toFixed(1)} °C`,
        rising ? "Teplota roste" : "Teplota stabilní",
        `Baterie ${battery.voltage.toFixed(2)} V`,
        fanPower > 0 ? `Větrák ${fanPower}%` : "Větrák vypnut"
      ]
    };
  }
};

export default Brain;
