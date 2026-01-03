/* ================================
   experience.js
   Učení ze zkušeností
   ================================ */

const Experience = {

  state: {
    riskPatterns: [] // uložené špatné scénáře
  },

  /* ===== ULOŽENÍ ŠPATNÉ ZKUŠENOSTI ===== */
  recordFailure(context, result) {
    this.state.riskPatterns.push({
      context,
      result,
      count: 1
    });
  },

  /* ===== NAJDI PODOBNOU ZKUŠENOST ===== */
  findRisk(context) {
    return this.state.riskPatterns.find(p =>
      p.context.tempLevel === context.tempLevel &&
      p.context.energyLevel === context.energyLevel &&
      p.context.daytime === context.daytime
    );
  },

  /* ===== UČENÍ ===== */
  learn(context, result) {
    const existing = this.findRisk(context);
    if (existing) {
      existing.count++;
    } else {
      this.recordFailure(context, result);
    }
  }
};

export default Experience;
