// src/index.ts
function rankHybrid(fts, vec, alpha = 0.6) {
  const map = /* @__PURE__ */ new Map();
  for (const h of fts) {
    map.set(h.id, { ...h, score: h.score * (1 - alpha) });
  }
  for (const h of vec) {
    const prev = map.get(h.id);
    if (prev) {
      map.set(h.id, { ...prev, score: prev.score + h.score * alpha });
    } else {
      map.set(h.id, { ...h, score: h.score * alpha });
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}
function traverseDecisions(nodes, fromId, maxDepth = 5) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const queue = [
    { id: fromId, depth: 0 }
  ];
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (seen.has(id) || depth > maxDepth) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    out.push(node);
    for (const p of node.parents) queue.push({ id: p, depth: depth + 1 });
  }
  return out;
}
export {
  rankHybrid,
  traverseDecisions
};
