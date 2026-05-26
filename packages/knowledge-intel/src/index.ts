import { gate } from "@orqenix-pro/license";

export function register(host: any) {
  if (!gate("knowledge-intel")) return;

  host.registerReranker("knowledge-intel.semantic-tuner", {
    rerank: async (query: string, results: any[]) => {
      return results
        .map((r: any) => ({
          ...r,
          score: r.score * 1.1,
        }))
        .sort((a: any, b: any) => b.score - a.score);
    },
  });

  host.registerSummarizer("knowledge-intel.auto-summarize", {
    summarize: async (results: any[], opts: any) => {
      return results.slice(0, 3);
    },
  });

  host.registerVersioningHook("knowledge-intel.kb-version", {
    onIndexComplete: async (kbId: string, generation: number) => {
      return;
    },
  });
}
