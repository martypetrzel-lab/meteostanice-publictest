/* ================================
   world.js
   Reálný čas = reálný den / noc
   ================================ */

const World = {

  state: {
    time: {
      now: Date.now(),
      isDay: true
    },
    environment: {
      temperature: 16,
      targetTemp: 16,

      light: 0,
      targetLight: 0,

      cloudiness: 0.3 // 0 = jasno, 1 = zataženo
    }
  },

  init() {
    // ⏰ NAVÁZÁNÍ NA REÁLNÝ ČAS
    this.state.time.now = Date.now();

    // startovní hodnoty (jen jednou)
    this.state.environment.temperature = 16;
    this.state.environment.light = 0;
  },

  tick() {
    // ⏱ POSUN ČASU – 1 s = 1 s reality
    this.state.time.now += 1000;

    const date = new Date(this.state.time.now);
    const hour = date.getHours();
    const minute = date.getMinutes();

    // 🌞 DEN / NOC
    this.state.time.isDay = hour >= 6 && hour < 20;

    /* ===== OBLAČNOST (POMALÁ, REALISTICKÁ) ===== */
    if (Math.random() < 0.001) {
      this.state.environment.cloudiness += (Math.random() - 0.5) * 0.05;
      this.state.environment.cloudiness =
        Math.min(1, Math.max(0, this.state.environment.cloudiness));
    }

    /* ===== SVĚTLO ===== */
    if (this.state.time.isDay) {
      const dayProgress = (hour + minute / 60 - 6) / 14; // 6–20
      const sunStrength = Math.sin(dayProgress * Math.PI);
      const maxLux = 1000;

      this.state.environment.targetLight =
        maxLux * sunStrength * (1 - this.state.environment.cloudiness);
    } else {
      // noc
      this.state.environment.targetLight = 2;
    }

    // setrvačnost světla
    const lightDiff =
      this.state.environment.targetLight - this.state.environment.light;
    this.state.environment.light += lightDiff * 0.05;

    /* ===== TEPLOTA ===== */
    const dayTarget =
      this.state.time.isDay
        ? 16 + (hour - 6) * 0.4
        : 14;

    this.state.environment.targetTemp = dayTarget;

    const tempDiff =
      this.state.environment.targetTemp - this.state.environment.temperature;
    this.state.environment.temperature += tempDiff * 0.02;

    return this.state;
  }
};

export default World;
