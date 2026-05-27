import { describe, it, expect } from "vitest";
import { LearningLoop } from "../src/index.js";

describe("LearningLoop", () => {
  it("returns no candidates below threshold", () => {
    const ll = new LearningLoop({
      promotionThreshold: 3,
      observationWindowMs: 86400000,
    });
    ll.observe({
      id: "1",
      sessionId: "s",
      pattern: "p1",
      weight: 1,
      observedAt: Date.now(),
    });
    expect(ll.candidates()).toHaveLength(0);
  });

  it("returns candidate when threshold met", () => {
    const ll = new LearningLoop({
      promotionThreshold: 2,
      observationWindowMs: 86400000,
    });
    const now = Date.now();
    ll.observe({ id: "1", sessionId: "s", pattern: "p1", weight: 1, observedAt: now });
    ll.observe({ id: "2", sessionId: "s", pattern: "p1", weight: 5, observedAt: now });
    const c = ll.candidates(now);
    expect(c).toHaveLength(1);
    expect(c[0]?.weight).toBe(5);
  });

  it("ignores observations outside window", () => {
    const ll = new LearningLoop({
      promotionThreshold: 2,
      observationWindowMs: 1000,
    });
    const now = Date.now();
    ll.observe({ id: "1", sessionId: "s", pattern: "p1", weight: 1, observedAt: now - 5000 });
    ll.observe({ id: "2", sessionId: "s", pattern: "p1", weight: 1, observedAt: now });
    expect(ll.candidates(now)).toHaveLength(0);
  });

  it("records promotion", () => {
    const ll = new LearningLoop();
    ll.promote("obs-1", "skill-x", 12345);
    expect(ll.getPromotions()).toHaveLength(1);
    expect(ll.getPromotions()[0]?.toSkillId).toBe("skill-x");
  });
});
