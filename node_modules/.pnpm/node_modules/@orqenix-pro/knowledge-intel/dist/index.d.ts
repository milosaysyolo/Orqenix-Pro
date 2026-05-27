interface DecisionNode {
    id: string;
    title: string;
    decidedAt: number;
    rationale: string;
    parents: string[];
}
interface RankingHit {
    id: string;
    score: number;
    source: "docs" | "code" | "decisions";
}
declare function rankHybrid(fts: RankingHit[], vec: RankingHit[], alpha?: number): RankingHit[];
declare function traverseDecisions(nodes: DecisionNode[], fromId: string, maxDepth?: number): DecisionNode[];

export { type DecisionNode, type RankingHit, rankHybrid, traverseDecisions };
