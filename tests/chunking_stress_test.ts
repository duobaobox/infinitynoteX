/**
 * 高难度分块压力测试脚本 (Chunking Stress Test)
 * 用于自动化评估 Markdown 分块质量
 */
import fs from 'fs';
import path from 'path';

interface TextChunk {
  text: string;
  index: number;
}

// ============ 1. 注入当前的新版算法 (从 knowledgeIndex.ts 复制) ============
// 我们直接把新算法粘贴在这里，确保测试的是最新逻辑
function chunkText(
  text: string,
  chunkSize: number = 800, // 提升默认 chunk 大小
  chunkOverlap: number = 100,
): TextChunk[] {
  if (!text || text.length === 0) {
    return [];
  }

  // 如果文本小于块大小，直接返回
  if (text.length <= chunkSize) {
    return [{ text, index: 0 }];
  }

  const lines = text.split('\n');
  const chunks: TextChunk[] = [];

  // ============ 配置常量 ============
  const MAX_ATOMIC_SIZE = 3000; // 原子块（代码/表格）允许的最大字符数
  const MIN_CHUNK_SIZE = 200; // 避免切出太碎的标题块

  // 状态机变量
  let currentChunkLines: string[] = [];
  let currentChunkLength = 0;
  let chunkIndex = 0;

  // 表格状态
  let tableHeader: string[] = []; // 缓存表头（第一行 + 分隔行）
  let inTable = false;
  let tableHeaderCollected = false;

  // 代码块状态
  let inCodeBlock = false;
  let codeBlockLang: string | undefined = undefined;

  // 正则表达式
  const tableRowRegex = /^\s*\|.*\|\s*$/;
  const tableSeparatorRegex = /^\s*\|[\s\-:|]+\|\s*$/;
  const codeBlockStartRegex = /^\s*```(\w*)/;
  const codeBlockEndRegex = /^\s*```\s*$/;
  const headerRegex = /^#{1,3}\s/; // 匹配 H1-H3

  /**
   * 提交当前 chunk
   */
  const commitChunk = () => {
    if (currentChunkLines.length > 0) {
      const chunkText = currentChunkLines.join('\n').trim();
      if (chunkText.length > 0) {
        chunks.push({ text: chunkText, index: chunkIndex });
        chunkIndex++;
      }
    }
    currentChunkLines = [];
    currentChunkLength = 0;
  };

  /**
   * 计算重叠行数（基于字符数回溯）
   */
  const getOverlapLines = (): string[] => {
    if (chunkOverlap <= 0 || currentChunkLines.length === 0) return [];

    const overlapLines: string[] = [];
    let overlapLength = 0;

    for (let i = currentChunkLines.length - 1; i >= 0; i--) {
      const line = currentChunkLines[i];
      if (overlapLength + line.length + 1 > chunkOverlap) break;
      overlapLines.unshift(line);
      overlapLength += line.length + 1;
    }

    return overlapLines;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline

    // Snapshot state BEFORE processing line (to detect context transitions)
    const wasInCodeBlock = inCodeBlock;

    // ============ 状态更新 ============

    // 1. 代码块检测
    if (!inCodeBlock) {
      const codeStart = line.match(codeBlockStartRegex);
      if (codeStart) {
        inCodeBlock = true;
        codeBlockLang = codeStart[1] || '';
      }
    } else {
      if (codeBlockEndRegex.test(line)) {
        inCodeBlock = false;
        // codeBlockLang reset happens later to allow injection logic to see it
      }
    }

    // 2. 表格检测
    const isTableRow = tableRowRegex.test(line);
    const isTableSeparator = tableSeparatorRegex.test(line);

    if (isTableRow) {
      if (!inTable) {
        inTable = true;
        tableHeader = [line];
        tableHeaderCollected = false;
      } else if (!tableHeaderCollected && isTableSeparator) {
        tableHeader.push(line);
        tableHeaderCollected = true;
      }
    } else {
      if (inTable) {
        inTable = false;
        tableHeader = [];
        tableHeaderCollected = false;
      }
    }

    // ============ 切分决策 ============

    const projectedLength = currentChunkLength + lineLength;
    const isHeader = headerRegex.test(line) && !inCodeBlock;

    // 决策 A: 标题切分 (Semantic Split)
    // 如果遇到标题，且当前 chunk 已经有一定内容，则主动切分
    if (isHeader && currentChunkLength > MIN_CHUNK_SIZE && !inCodeBlock && !inTable) {
      commitChunk();
    }

    // 决策 B: 长度强制切分
    // 如果加上当前行会超过 limit
    let limit = chunkSize;

    // 原子性保护：如果在代码块或表格中，允许扩展 limit 到 MAX_ATOMIC_SIZE
    if (inCodeBlock || inTable) {
      limit = MAX_ATOMIC_SIZE;
    }

    if (projectedLength > limit && currentChunkLines.length > 0) {
      // 必须切分了
      const overlapLines = getOverlapLines();
      commitChunk();

      // ============ Context Injection (注入修复) ============

      // 1. 表格注入
      if (inTable && tableHeaderCollected && tableHeader.length > 0) {
        // 确保不重复注入
        const hasHeader = overlapLines.some((l) => tableHeader.includes(l));
        if (!hasHeader) {
          currentChunkLines.push(...tableHeader);
          currentChunkLength += tableHeader.reduce((sum, h) => sum + h.length + 1, 0);
        }
      }

      // 2. 代码块注入
      if (inCodeBlock && codeBlockLang !== undefined) {
        // 只有当重叠区没有包含代码开始标记时才注入
        const hasCodeStart = overlapLines.some((l) => codeBlockStartRegex.test(l));
        if (!hasCodeStart) {
          const codeStart = '```' + codeBlockLang;
          currentChunkLines.push(codeStart);
          currentChunkLength += codeStart.length + 1;
        }
      }

      // 添加重叠内容
      for (const ol of overlapLines) {
        currentChunkLines.push(ol);
        currentChunkLength += ol.length + 1;
      }
    }

    // 追加当前行
    currentChunkLines.push(line);
    currentChunkLength += lineLength;

    // Post-loop state cleanup
    if (!inCodeBlock && wasInCodeBlock) {
      codeBlockLang = '';
    }
  }

  // 提交最后一个 chunk
  commitChunk();

  return chunks;
}

// ============ 2. 只有Scenario D: Real World ============

function runTest() {
  // Scenario D: Real World Document (v2025Q4 Report)
  const reportPath = path.resolve(process.cwd(), 'docs/组件解耦与架构优化报告-2025Q4.md');
  let reportContent = '';
  try {
    reportContent = fs.readFileSync(reportPath, 'utf-8');
    console.log(`Loaded report from ${reportPath}, length: ${reportContent.length}`);
  } catch (e) {
    console.error('❌ ERROR: Could not load report file. Ensure path is correct.');
    process.exit(1);
  }

  console.log('\n==== Scenario D: Real World Atomic Check ====');
  // chunkSize = 800, MAX_ATOMIC = 2000
  const chunksD = chunkText(reportContent, 800, 100);

  console.log(`Chunks generated: ${chunksD.length}`);

  // Specific Check: Does the file tree stay in one chunk?
  // previous version split it into 4 chunks (1, 2, 3, 4)
  // We identify the file tree by identifying a chunk that has BOTH the start and end of the tree structure.

  // The tree structure starts with "infinitynotex/"
  // It contains "layout/" (line 46) and "store/" (line 57)
  const treeChunk = chunksD.find(
    (c) =>
      c.text.includes('infinitynotex/') && c.text.includes('layout/') && c.text.includes('store/'),
  );

  if (treeChunk) {
    console.log(`\n✅ SUCCESS: File Tree preserved in a single chunk (Index ${treeChunk.index})!`);
    console.log(`   Chunk Length: ${treeChunk.text.length} (Allowed > 800 because < 2000)`);
    console.log('   Preview Start: ' + treeChunk.text.slice(0, 50).replace(/\n/g, ' '));
    console.log('   Preview End:   ' + treeChunk.text.slice(-50).replace(/\n/g, ' '));
  } else {
    console.log(`\n❌ FAILURE: File Tree appears to be fragmented.`);
    chunksD.forEach((c) => {
      if (c.text.includes('infinitynotex/'))
        console.log(`   Found 'infinitynotex/' in Chunk ${c.index}`);
      if (c.text.includes('src/features/layout'))
        console.log(`   Found 'src/features/layout' in Chunk ${c.index}`);
    });
  }

  // Check Table
  const tableChunk = chunksD.find(
    (c) => c.text.includes('组件解耦度') && c.text.includes('技术债务'),
  );
  if (tableChunk) {
    console.log(
      `\n✅ SUCCESS: Core Conclusions Table preserved in a single chunk (Index ${tableChunk.index})!`,
    );
  } else {
    console.log(`\n❌ FAILURE: Table appears fragmented.`);
  }
}

runTest();
