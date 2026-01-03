import World from "./world.js";
import Device from "./device.js";
import Memory from "./memory.js";
import Brain from "./brain.js";

const STORAGE_KEY = "meteostation_sim_state_v1";

function hasResetParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("reset") === "1";
}

let lastClosedDay = null;

const Simulator = {

  init() {
    const forceReset = hasResetParam();

    if (forceReset) {
      console.warn("⚠️ Reset simulace vyžádán URL parametrem");
      localStorage.removeItem(STORAGE_KEY);
    }

    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const s = JSON.parse(saved);

        if (s.world) World.state = s.world;
        else World.init();

        if (s.device) Device.state = s.device;
        else Device.init();

        if (s.memory) Memory.state = s.memory;
        if (s.brainInternal) Brain.internal = s.brainInternal;

        lastClosedDay = s.lastClosedDay ?? null;

      } catch (e) {
        console.error("❌ Obnova stavu selhala, startuji čistý běh", e);
        World.init();
        Device.init();
        Memory.state = undefined;
        Brain.internal = { lastTemp: null, tempTrend: 0 };
        lastClosedDay = null;
      }
    } else {
      World.init();
      Device.init();
    }

    setInterval(() => this.tick(), 1000);
  },

  tick() {
    const world = World.tick();
    const now = new Date(world.time.now);

    const deviceBefore = Device.getState();

    /* ===== PAMĚŤ (SBĚR DAT) ===== */
    Memory.update({
      temperature: deviceBefore.sensors.temperature,
      energyInW: deviceBefore.power.solarInW,
      energyOutW: deviceBefore.power.loadW
    });

    /* ===== UZAVŘENÍ DNE (SIMULOVANÝ ČAS) ===== */
    const dayKey = now.toDateString();

    if (
      now.getHours() === 23 &&
      now.getMinutes() === 59 &&
      lastClosedDay !== dayKey
    ) {
      Memory.closeDay(now);
      lastClosedDay = dayKey;
    }

    const brain = Brain.evaluate({
      time: world.time,
      env: world.environment,
      battery: deviceBefore.battery,
      power: deviceBefore.power
    });

    const device = Device.tick(world, brain);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      world: World.state,
      device: Device.state,
      memory: Memory.state,
      brainInternal: Brain.internal,
      lastClosedDay
    }));

    window.dispatchEvent(new CustomEvent("simulator:update", {
      detail: {
        time: world.time,
        environment: world.environment,
        sensors: device.sensors,
        battery: device.battery,
        power: device.power,
        fan: brain.fan,
        fanPower: brain.fanPower,
        mode: brain.mode,
        message: brain.mainMessage,
        details: brain.details
      }
    }));
  }
};

window.addEventListener("DOMContentLoaded", () => Simulator.init());
