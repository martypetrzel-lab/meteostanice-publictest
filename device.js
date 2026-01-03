/* ================================
   device.js
   Virtuální ESP32 + energie
   ================================ */

const Device = {

  config: {
    battery: {
      capacityWh: 12.0,        // 18650 ~ 2000 mAh @ 3.7 V
      minVoltage: 3.0,
      maxVoltage: 4.2
    },

    solar: {
      maxPowerW: 1.0           // 5 V / 1 W panel
    },

    consumption: {
      baseW: 0.18,             // ESP32 + senzory
      fanW: 1.0                // VĚTRÁČEK: 5 V × 200 mA = 1 W
    }
  },

  state: {
    battery: {
      voltage: 3.85,
      energyWh: 7.2,
      soc: 0.6
    },

    power: {
      solarInW: 0,
      loadW: 0,
      balanceWh: 0
    },

    sensors: {
      temperature: 0,
      humidity: 0,
      light: 0
    },

    actuators: {
      fan: false
    }
  },

  /* ===== INIT ===== */
  init() {
    this.state.battery.energyWh =
      this.config.battery.capacityWh * this.state.battery.soc;

    this.updateVoltage();
  },

  /* ===== HLAVNÍ KROK (1 s) ===== */
  tick(worldState, brainState) {

    /* --- senzory --- */
    this.state.sensors.temperature = worldState.environment.temperature;
    this.state.sensors.light = worldState.environment.light;

    /* --- akční členy --- */
    this.state.actuators.fan = brainState.fan;

    /* --- solární příjem --- */
    this.calculateSolar(worldState);

    /* --- spotřeba --- */
    this.calculateLoad(brainState);

    /* --- bilance --- */
    this.updateEnergy();

    return this.getState();
  },

  /* ===== SOLÁR ===== */
  calculateSolar(world) {
    const light = world.environment.light;

    let solar =
      (light / 1000) * this.config.solar.maxPowerW;

    if (world.events && world.events.solarDrop) {
      solar *= 0.1;
    }

    this.state.power.solarInW =
      Math.min(this.config.solar.maxPowerW, Math.max(0, solar));
  },

  /* ===== SPOTŘEBA ===== */
  calculateLoad(brain) {
    let load = this.config.consumption.baseW;

    if (brain.fan) {
      load += this.config.consumption.fanW; // +1.0 W
    }

    // úsporné režimy
    if (brain.mode === "SAVE") {
      load *= 0.7;
    }

    if (brain.mode === "CRITICAL") {
      load *= 0.4;
    }

    this.state.power.loadW = load;
  },

  /* ===== ENERGIE ===== */
  updateEnergy() {
    const inWh = this.state.power.solarInW / 3600;
    const outWh = this.state.power.loadW / 3600;

    const delta = inWh - outWh;

    this.state.battery.energyWh =
      Math.max(0, Math.min(
        this.config.battery.capacityWh,
        this.state.battery.energyWh + delta
      ));

    this.state.power.balanceWh += delta;

    this.state.battery.soc =
      this.state.battery.energyWh / this.config.battery.capacityWh;

    this.updateVoltage();
  },

  /* ===== NAPĚTÍ ===== */
  updateVoltage() {
    const { minVoltage, maxVoltage } = this.config.battery;

    this.state.battery.voltage =
      +(minVoltage +
        (maxVoltage - minVoltage) * this.state.battery.soc
      ).toFixed(2);
  },

  /* ===== EXPORT STAVU ===== */
  getState() {
    return {
      battery: { ...this.state.battery },
      power: { ...this.state.power },
      sensors: { ...this.state.sensors },
      actuators: { ...this.state.actuators }
    };
  }
};

export default Device;
