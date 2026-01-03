/* ================================
   memory.js
   ================================ */

const Memory = {
  state: {
    today: {
      samples: 0,
      tempSum: 0
    }
  },

  update(sample) {
    this.state.today.samples++;
    this.state.today.tempSum += sample.temperature;
  },

  getComparison() {
    return null;
  },

  getWeekAverages() {
    return null;
  },

  getTrends() {
    return { tempRising: false, energyDeclining: false };
  }
};

export default Memory;
