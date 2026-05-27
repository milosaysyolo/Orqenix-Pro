// src/index.ts
var DEFAULT_CONFIG = {
  promotionThreshold: 3,
  observationWindowMs: 7 * 864e5
};
var LearningLoop = class {
  constructor(config = DEFAULT_CONFIG) {
    this.config = config;
  }
  config;
  observations = [];
  promotions = [];
  observe(o) {
    this.observations.push(o);
  }
  candidates(now = Date.now()) {
    const cutoff = now - this.config.observationWindowMs;
    const recent = this.observations.filter((o) => o.observedAt >= cutoff);
    const byPattern = /* @__PURE__ */ new Map();
    for (const o of recent) {
      const arr = byPattern.get(o.pattern) ?? [];
      arr.push(o);
      byPattern.set(o.pattern, arr);
    }
    const out = [];
    for (const [, group] of byPattern) {
      if (group.length >= this.config.promotionThreshold) {
        const top = group.reduce((a, b) => a.weight >= b.weight ? a : b);
        out.push(top);
      }
    }
    return out;
  }
  promote(observationId, toSkillId, now = Date.now()) {
    const p = {
      observationId,
      promotedAt: now,
      toSkillId
    };
    this.promotions.push(p);
    return p;
  }
  getPromotions() {
    return this.promotions;
  }
};
export {
  LearningLoop
};
