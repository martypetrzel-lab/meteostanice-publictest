/* ================================
   world.js
   Reálný den / noc podle skutečného času
   ================================ */

const World = {

  state: {
    time: {
      now: Date.now(),
      isDay: true
    },
    environment: {
      temperature: 20,
      targetTemp: 20,

      light: 0,
      targetLight: 0,

      cloudiness: 0.3 // 0 = jasno, 1 = zataženo
    }
  },

  init() {
    this.state.time.now = Date.now();
    this.state.environment.temperature = 20;
    this.state.environment.light = 0;
  },

  tick() {
    // === SIMULOVANÝ ČAS (běží dál) ===
    this.state.time.now += 1000;

    // === REÁLNÝ ČAS (pro světlo) ===
    const realNow = new Date();
    const hour = realNow.getHours();
    const minute = realNow.getMinutes();

    // zjednodušený den/noc model (později půjde zpřesnit)
    this.state.time.isDay = hour >= 7 && hour < 17;

    /* ===== OBLAČNOST (POMALÁ ZMĚNA) ===== */
    if (Math.random() < 0.002) {
      this.state.environment.cloudiness += (Math.random() - 0.5) * 0.1;
      this.state.environment.cloudiness =
        Math.min(1, Math.max(0, this.state.environment.cloudiness));
    }

    /* ===== SVĚTLO PODLE REÁLNÉHO ČASU ===== */
    if (this.state.time.isDay) {
      const dayProgress = (hour + minute / 60 - 7) / 10; // 7–17
      const sunStrength = Math.sin(dayProgress * Math.PI);
      const maxLux = 1000;

      this.state.environment.targetLight =
        maxLux * sunStrength * (1 - this.state.environment.cloudiness);
    } else {
      this.state.environment.targetLight = 2; // noc
    }

    // setrvačnost světla
    const lightDiff =
      this.state.environment.targetLight - this.state.environment.light;
    this.state.environment.light += lightDiff * 0.08;

    /* ===== TEPLOTA (STÁLE SIMULOVANÁ) ===== */
    const dayTarget = this.state.time.isDay
      ? 18 + (hour - 7) * 0.4
      : 16;

    this.state.environment.targetTemp = dayTarget;

    const tempDiff =
      this.state.environment.targetTemp - this.state.environment.temperature;
    this.state.environment.temperature += tempDiff * 0.02;

    return this.state;
  }
};

export default World;
