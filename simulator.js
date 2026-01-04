import World from "./world.js";
import Device from "./device.js";
import Memory from "./memory.js";
import Brain from "./brain.js";

const STORAGE_KEY = "meteostation_sim_state_v2";

let simStart = null;

const Simulator = {
  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      World.state = s.world;
      Device.state = s.device;
      Memory.state = s.memory;
      Brain.internal = s.brain;
      simStart = s.simStart;
    } else {
      World.init();
      Device.init();
      simStart = Date.now();
    }

    setInterval(() => this.tick(), 1000);
  },

  tick() {
    const world = World.tick();
    const deviceBefore = Device.getState();

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
      brain: Brain.internal,
      simStart
    }));

    window.dispatchEvent(new CustomEvent("simulator:update", {
      detail: {
        time: { ...world.time, start: simStart },
        environment: world.environment,
        sensors: device.sensors,
        battery: device.battery,
        power: device.power,
        fan: brain.fan,
        mode: brain.mode,
        message: brain.mainMessage,
        details: brain.details
      }
    }));
  }
};

window.addEventListener("DOMContentLoaded", () => Simulator.init());
