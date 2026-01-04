import World from "./world.js";
import Device from "./device.js";
import Memory from "./memory.js";
import Brain from "./brain.js";

const STORAGE_KEY = "meteostation_sim_state_v2";
let lastClosedDay = null;

/* ===== PERSISTENTNÍ ČAS ===== */
let realStart = null;
let simStart = null;

const Simulator = {

  init() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const s = JSON.parse(saved);

      World.state = s.world;
      Device.state = s.device;
      Memory.state = s.memory;
      Brain.internal = s.brainInternal;
      lastClosedDay = s.lastClosedDay;

      realStart = s.realStart;
      simStart = s.simStart;
    } else {
      World.init();
      Device.init();
      Memory.state = undefined;
      Brain.internal = { lastTemp: null, tempTrend: 0 };

      realStart = Date.now();
      simStart = Date.now();
    }

    setInterval(() => this.tick(), 1000);
  },

  tick() {
    /* ===== DOPOČET REÁLNÉHO ČASU ===== */
    const nowReal = Date.now();
    const simNow = simStart + (nowReal - realStart);

    World.state.time.now = simNow;
    const world = World.tick(false); // ⚠️ NEPOSOUVAT ČAS INTERNĚ

    const now = new Date(simNow);
    const deviceBefore = Device.getState();

    Memory.update({
      temperature: deviceBefore.sensors.temperature,
      energyInW: deviceBefore.power.solarInW,
      energyOutW: deviceBefore.power.loadW
    });

    const dayKey = now.toDateString();
    if (now.getHours() === 23 && now.getMinutes() === 59 && lastClosedDay !== dayKey) {
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

    /* ===== ULOŽENÍ ===== */
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      world: World.state,
      device: Device.state,
      memory: Memory.state,
      brainInternal: Brain.internal,
      lastClosedDay,
      realStart,
      simStart
    }));

    /* ===== EVENT PRO UI (KLÍČOVÉ!) ===== */
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
