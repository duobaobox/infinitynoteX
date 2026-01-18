/**
 * 这是一个独立的测试脚本，用于验证新的智能分块算法
 * 包含表头注入和代码块保护功能
 */

interface TextChunk {
  text: string;
  index: number;
}

// ============ 新算法复刻 ============

function chunkText(text: string, chunkSize: number = 500, chunkOverlap: number = 50): TextChunk[] {
  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [{ text, index: 0 }];
  }

  const lines = text.split('\n');
  const chunks: TextChunk[] = [];

  let currentChunkLines: string[] = [];
  let currentChunkLength = 0;
  let chunkIndex = 0;

  let tableHeader: string[] = [];
  let inTable = false;
  let tableHeaderCollected = false;

  let inCodeBlock = false;
  let codeBlockLang = '';

  const tableRowRegex = /^\s*\|.*\|\s*$/;
  const tableSeparatorRegex = /^\s*\|[\s\-:|]+\|\s*$/;
  const codeBlockStartRegex = /^\s*```(\w*)/;
  const codeBlockEndRegex = /^\s*```\s*$/;

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
    const lineLength = line.length + 1;

    if (!inCodeBlock) {
      const codeStart = line.match(codeBlockStartRegex);
      if (codeStart) {
        inCodeBlock = true;
        codeBlockLang = codeStart[1] || '';
      }
    } else {
      if (codeBlockEndRegex.test(line) && !codeBlockStartRegex.test(line)) {
        inCodeBlock = false;
        codeBlockLang = '';
      }
    }

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

    const projectedLength = currentChunkLength + lineLength;

    if (lineLength > chunkSize) {
      commitChunk();
      chunks.push({ text: line.trim(), index: chunkIndex });
      chunkIndex++;
      continue;
    }

    if (projectedLength > chunkSize && currentChunkLines.length > 0) {
      const overlapLines = getOverlapLines();
      commitChunk();

      if (isTableRow && tableHeaderCollected && tableHeader.length > 0) {
        const hasHeader = overlapLines.some((l) => tableHeader.includes(l));
        if (!hasHeader) {
          currentChunkLines.push(...tableHeader);
          currentChunkLength += tableHeader.reduce((sum, h) => sum + h.length + 1, 0);
        }
      }

      if (inCodeBlock && codeBlockLang !== undefined) {
        const codeStart = '```' + codeBlockLang;
        currentChunkLines.push(codeStart);
        currentChunkLength += codeStart.length + 1;
      }

      for (const ol of overlapLines) {
        currentChunkLines.push(ol);
        currentChunkLength += ol.length + 1;
      }
    }

    currentChunkLines.push(line);
    currentChunkLength += lineLength;
  }

  commitChunk();
  return chunks;
}

// ============ 测试数据构建 ============

// 模拟一个标准 Markdown 表格，内容足够长以触发分块
const header = '| 场景 | 命令 | 说明 |\n| --- | --- | --- |\n';
const rows = [
  '| 启动运行 | `lumina` | 自动交互式运维模式（正式环境推荐） |\n',
  "| 单次任务 | `lumina '检查磁盘'` | 直接执行指定任务并退出 |\n",
  '| 调试模式 | `lumina -d` | 显示详细内部 Trace 日志（排障用） |\n',
  '| API 配置 | `lumina /model` | (交互模式) 快速配置 API |\n',
  '| SSH 配置 | `lumina /ssh` | (交互模式) 配置远程 PVE 连接 |\n',
  '| 路径自查 | `lumina config info` | 一键查找日志在哪里、安装在哪 |\n',
  '| 技能度初始化 | `lumina skills init` | 将内置技能注到本地目录以使 vi 修改 |\n',
  '| 查技能清单 | `lumina skills list` | 查看当前加载了哪些技能及其文件路径 |\n',
  '| 重配 API | `lumina config setup` | 重新进入 API 地址/密钥配置向导 |\n',
];

// 重复多遍以确保足够长
let markdownTable = header;
for (let i = 0; i < 5; i++) {
  markdownTable += rows.join('');
}

// 在表格前后加一些普通文本
const fullMarkdown = `# Lumina-Ops 部署手册

本手册专为交付人员编写。

${markdownTable}

## 结束语
希望这本手册能帮助到你。
`;

// ============ 运行测试 ============

const chunks = chunkText(fullMarkdown, 300, 50); // 稍微调小 chunkSize 以更容易复现切分

console.log(`\n=== 测试信息 ===`);
console.log(`总长度: ${fullMarkdown.length} 字符`);
console.log(`Chunk Size: 300`);
console.log(`Chunk Overlap: 50`);
console.log(`生成 Chunks 数量: ${chunks.length}`);

chunks.forEach((chunk, i) => {
  console.log(`\n--- Chunk ${i} ---`);
  console.log(chunk.text);
  console.log(`------------------`);

  // 检查点分析
  if (i > 0) {
    console.log(`[分析 Chunk ${i}]:`);
    if (!chunk.text.includes('| 场景 |')) {
      console.log('❌ 缺失表头！这会导致 AI 不知道列的含义。');
    }
    if (chunk.text.trim().startsWith('|')) {
      console.log('⚠️ 从表格中间开始，但没有表头。');
    } else {
      console.log('⚠️ 可能从行内被切断了。');
    }
  }
});
