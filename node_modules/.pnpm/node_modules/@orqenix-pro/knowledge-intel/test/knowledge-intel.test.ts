import { describe, it, expect } from "vitest";
import { rankHybrid, traverseDecisions } from "../src/index.js";

describe("rankHybrid", () => {
  it("merges fts + vec scores by alpha", () => {
    const out = rankHybrid(
      [{ id: "a", score: 1, source: "docs" }],
      [{ id: "a", score: 1, source: "docs" }],
      0.5
    );
    expect(out[0]?.score).toBeCloseTo(1);
  });

  it("orders by descending merged score", () => {
    const out = rankHybrid(
      [{ id: "a", score: 0.2, source: "docs" }, { id: "b", score: 0.9, source: "docs" }],
      [{ id: "a", score: 0.9, source: "docs" }, { id: "b", score: 0.1, source: "docs" }],
      0.7
    );
    expect(out[0]?.id).toBe("a");
  });
});

describe("traverseDecisions", () => {
  it("returns ancestors up to maxDepth", () => {
    const nodes = [
      { id: "1", title: "root", decidedAt: 0, rationale: "", parents: [] },
      { id: "2", title: "child", decidedAt: 0, rationale: "", parents: ["1"] },
      { id: "3", title: "grand", decidedAt: 0, rationale: "", parents: ["2"] },
    ];
    const out = traverseDecisions(nodes, "3", 5);
    expect(out.map((n) => n.id)).toEqual(["3", "2", "1"]);
  });

  it("stops at maxDepth", () => {
    const nodes = [
      { id: "1", title: "", decidedAt: 0, rationale: "", parents: [] },
      { id: "2", title: "", decidedAt: 0, rationale: "", parents: ["1"] },
      { id: "3", title: "", decidedAt: 0, rationale: "", parents: ["2"] },
    ];
    const out = traverseDecisions(nodes, "3", 1);
    expect(out.map((n) => n.id)).toEqual(["3", "2"]);
  });
});
