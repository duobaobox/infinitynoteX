# 便签RAG功能开发计划报告

## 项目概述

基于当前InfinityNoteX项目的AI功能和便签系统，开发类似NotebookLLM和Notion的RAG（检索增强生成）功能，实现基于便签内容的智能引用回复、总结和思维发散等功能。

## 当前项目AI功能分析

### 现有AI架构

- **AI配置系统**: 支持多种AI提供商（DeepSeek、阿里百炼、智谱AI、硅基流动、OpenAI）
- **AI聊天组件**: 基于Ant Design X构建的统一对话解决方案
- **流式对话**: 支持实时流式响应和思维链显示
- **对话管理**: 完整的对话历史保存和管理功能

### 便签数据结构

```typescript
interface Note {
  id: string;
  folderId: string;
  title: string;
  content: TipTapJSONContent; // 富文本JSON格式
  tags: string[];
  pinned: boolean;
  color?: NoteColor;
  createdAt: number;
  updatedAt: number;
}
```

### 技术栈优势

- **TipTap编辑器**: 支持富文本内容，便于内容提取和处理
- **Electron架构**: 本地存储，数据安全可控
- **TypeScript**: 类型安全，便于扩展
- **Zustand状态管理**: 轻量级状态管理

## RAG功能设计方案

### 1. 核心功能模块

#### 1.1 内容索引服务 (ContentIndexService)

```typescript
interface ContentIndexService {
  // 索引管理
  buildIndex(notes: Note[]): Promise<void>;
  updateIndex(noteId: string, content: TipTapJSONContent): Promise<void>;
  deleteFromIndex(noteId: string): Promise<void>;

  // 内容检索
  searchSimilar(query: string, limit?: number): Promise<SearchResult[]>;
  searchByKeywords(keywords: string[]): Promise<SearchResult[]>;

  // 向量化
  embedText(text: string): Promise<number[]>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}

interface SearchResult {
  noteId: string;
  title: string;
  excerpt: string;
  similarity: number;
  matchedContent: string;
  context: string;
}
```

#### 1.2 RAG对话服务 (RAGChatService)

```typescript
interface RAGChatService {
  // RAG增强对话
  chatWithContext(
    query: string,
    contextNotes: SearchResult[],
    chatHistory: AIMessage[],
  ): Promise<RAGResponse>;

  // 便签总结
  summarizeNotes(noteIds: string[]): Promise<SummaryResponse>;

  // 思维发散
  brainstormFromNotes(noteIds: string[], direction: string): Promise<BrainstormResponse>;

  // 引用回复
  replyWithReferences(query: string, noteIds: string[]): Promise<ReplyResponse>;
}
```

#### 1.3 内容提取器 (ContentExtractor)

```typescript
interface ContentExtractor {
  // 从TipTap JSON提取纯文本
  extractPlainText(content: TipTapJSONContent): string;

  // 提取结构化内容
  extractStructuredContent(content: TipTapJSONContent): StructuredContent;

  // 提取关键词
  extractKeywords(text: string): string[];

  // 分块处理
  chunkContent(text: string, maxChunkSize: number): ContentChunk[];
}

interface StructuredContent {
  headings: string[];
  paragraphs: string[];
  lists: string[];
  codeBlocks: string[];
  links: string[];
  images: string[];
}

interface ContentChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  metadata: Record<string, any>;
}
```

### 2. 向量化方案

#### 2.1 本地向量化（推荐）

- **优势**: 数据隐私、离线可用、成本可控
- **方案**: 使用轻量级模型如sentence-transformers
- **实现**: 通过Node.js addon或WASM集成

```typescript
// 本地向量化配置
interface LocalEmbeddingConfig {
  modelPath: string; // 本地模型路径
  modelType: 'sentence-transformers' | 'universal-sentence-encoder';
  dimensions: number; // 向量维度
  batchSize: number; // 批处理大小
}
```

#### 2.2 API向量化（备选）

- **方案**: 使用OpenAI Embeddings API或其他兼容服务
- **优势**: 效果更好，无需本地模型
- **劣势**: 需要网络连接，有成本

### 3. 存储方案

#### 3.1 向量数据库

```typescript
interface VectorStore {
  // 向量存储
  storeVector(id: string, vector: number[], metadata: any): Promise<void>;

  // 相似性搜索
  searchSimilar(queryVector: number[], topK: number): Promise<VectorSearchResult[]>;

  // 批量操作
  batchStore(items: VectorItem[]): Promise<void>;
  batchDelete(ids: string[]): Promise<void>;

  // 索引管理
  buildIndex(): Promise<void>;
  optimizeIndex(): Promise<void>;
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: any;
}
```

#### 3.2 实现方案

- **SQLite + 向量扩展**: 使用sqlite-vss或类似扩展
- **本地文件存储**: JSON格式存储向量和元数据
- **内存索引**: 启动时加载到内存，定期持久化

### 4. UI组件设计

#### 4.1 RAG聊天面板

```typescript
interface RAGChatPanelProps {
  // 基础聊天功能
  conversationId: string;

  // RAG特有功能
  enableRAG: boolean;
  selectedNotes?: string[]; // 指定参考便签
  searchScope?: 'all' | 'folder' | 'selected'; // 搜索范围

  // 回调函数
  onNoteReference?: (noteId: string) => void;
  onSummaryGenerated?: (summary: string, noteIds: string[]) => void;
}
```

#### 4.2 便签引用组件

```typescript
interface NoteReferenceProps {
  noteId: string;
  excerpt: string;
  similarity?: number;
  onNavigate?: () => void;
  onRemove?: () => void;
}
```

#### 4.3 RAG工具栏

```typescript
interface RAGToolbarProps {
  selectedNotes: string[];
  onSummarize: () => void;
  onBrainstorm: () => void;
  onAskQuestion: () => void;
  onGenerateOutline: () => void;
}
```

### 5. 功能特性

#### 5.1 智能引用回复

- **功能**: 基于便签内容回答用户问题
- **实现**: 检索相关便签 → 构建上下文 → AI生成回复
- **特色**: 显示引用来源，支持跳转到原便签

#### 5.2 便签总结

- **功能**: 对选中便签进行智能总结
- **类型**:
  - 单篇总结：提取关键信息
  - 多篇总结：找出共同主题和差异
  - 主题总结：按标签或关键词聚合

#### 5.3 思维发散

- **功能**: 基于便签内容进行创意扩展
- **方向**:
  - 相关主题探索
  - 反向思考
  - 类比联想
  - 实践应用

#### 5.4 智能问答

- **功能**: 针对便签内容进行问答
- **特色**:
  - 支持复杂查询
  - 多便签综合回答
  - 历史对话上下文

### 6. 实现路线图

#### Phase 1: 基础架构 (2-3周)

1. **内容提取器开发**
   - TipTap JSON解析
   - 纯文本提取
   - 结构化内容识别

2. **向量化服务**
   - 本地embedding模型集成
   - 向量存储设计
   - 相似性搜索算法

3. **基础RAG服务**
   - 内容索引构建
   - 简单检索功能
   - 上下文构建逻辑

#### Phase 2: 核心功能 (3-4周)

1. **RAG聊天集成**
   - 扩展现有AI聊天组件
   - 添加上下文检索
   - 引用显示功能

2. **便签总结功能**
   - 单篇总结
   - 多篇总结
   - 总结结果保存

3. **UI组件开发**
   - RAG工具栏
   - 引用组件
   - 搜索结果展示

#### Phase 3: 高级功能 (2-3周)

1. **思维发散功能**
   - 创意生成算法
   - 多方向探索
   - 结果可视化

2. **智能问答优化**
   - 复杂查询处理
   - 多轮对话支持
   - 上下文记忆

3. **性能优化**
   - 索引优化
   - 缓存策略
   - 增量更新

#### Phase 4: 完善与优化 (1-2周)

1. **用户体验优化**
   - 交互流程优化
   - 响应速度提升
   - 错误处理完善

2. **功能扩展**
   - 批量操作
   - 导出功能
   - 配置选项

### 7. 技术实现细节

#### 7.1 文件结构

```
src/
├── services/
│   ├── rag/
│   │   ├── ContentIndexService.ts
│   │   ├── RAGChatService.ts
│   │   ├── ContentExtractor.ts
│   │   ├── VectorStore.ts
│   │   └── EmbeddingService.ts
│   └── ...
├── components/
│   ├── RAGChat/
│   │   ├── RAGChatPanel.tsx
│   │   ├── NoteReference.tsx
│   │   ├── RAGToolbar.tsx
│   │   └── SearchResults.tsx
│   └── ...
├── hooks/
│   ├── useRAGChat.ts
│   ├── useNoteSearch.ts
│   └── useContentIndex.ts
└── types/
    └── rag.ts
```

#### 7.2 数据流设计

```
用户输入 → 内容检索 → 上下文构建 → AI生成 → 结果展示
    ↓           ↓           ↓           ↓           ↓
便签索引 → 向量搜索 → 相关便签 → RAG提示 → 引用回复
```

#### 7.3 性能考虑

- **增量索引**: 只对新增/修改的便签重新索引
- **缓存策略**: 缓存常用查询结果和向量
- **异步处理**: 大批量操作使用Worker线程
- **分页加载**: 大量搜索结果分页展示

### 8. 风险评估与应对

#### 8.1 技术风险

- **向量化性能**: 本地模型可能较慢
  - 应对: 提供API向量化备选方案
- **存储空间**: 向量数据占用空间较大
  - 应对: 压缩算法和清理策略
- **准确性问题**: 检索结果可能不准确
  - 应对: 多种检索策略结合，用户反馈优化

#### 8.2 用户体验风险

- **响应延迟**: RAG处理可能较慢
  - 应对: 异步处理，进度提示
- **学习成本**: 新功能需要用户学习
  - 应对: 详细文档和引导教程

### 9. 成功指标

#### 9.1 功能指标

- 内容检索准确率 > 85%
- 响应时间 < 3秒
- 支持1000+便签的实时检索

#### 9.2 用户体验指标

- 用户采用率 > 60%
- 功能满意度 > 4.0/5.0
- 日活跃使用次数 > 10次

### 10. 总结

本RAG功能开发计划基于现有的AI架构和便签系统，通过增加内容索引、向量检索和上下文增强等功能，实现智能的便签知识库。整个方案注重数据隐私、性能优化和用户体验，分阶段实施，风险可控。

预计总开发周期8-12周，将显著提升InfinityNoteX的智能化水平，为用户提供类似NotebookLLM的强大知识管理和AI辅助功能。
