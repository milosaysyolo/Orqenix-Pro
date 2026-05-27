interface InstinctObservation {
    id: string;
    sessionId: string;
    pattern: string;
    weight: number;
    observedAt: number;
}
interface InstinctPromotion {
    observationId: string;
    promotedAt: number;
    toSkillId: string;
}
interface LearningLoopConfig {
    promotionThreshold: number;
    observationWindowMs: number;
}
declare class LearningLoop {
    private readonly config;
    private observations;
    private promotions;
    constructor(config?: LearningLoopConfig);
    observe(o: InstinctObservation): void;
    candidates(now?: number): InstinctObservation[];
    promote(observationId: string, toSkillId: string, now?: number): InstinctPromotion;
    getPromotions(): readonly InstinctPromotion[];
}

export { type InstinctObservation, type InstinctPromotion, LearningLoop, type LearningLoopConfig };
