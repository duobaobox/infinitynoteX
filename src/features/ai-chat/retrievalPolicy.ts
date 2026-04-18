export interface AIRetrievalPolicy {
  /** 是否允许 AI 主动检索用户资料 */
  allowActiveRetrieval: boolean;
  /** 是否回退到前端预检索 RAG */
  useFallbackRag: boolean;
}

export function resolveAIRetrievalPolicy(args: {
  useKnowledgeBase: boolean;
  supportsToolCalling: boolean;
}): AIRetrievalPolicy {
  void args.supportsToolCalling;
  const allowActiveRetrieval = args.useKnowledgeBase;

  return {
    allowActiveRetrieval,
    // 统一由主进程 retrieval orchestrator 负责检索决策。
    useFallbackRag: false,
  };
}
