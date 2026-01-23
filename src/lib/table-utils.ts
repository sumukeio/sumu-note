/**
 * 表格工具函数
 * 提供 Markdown 表格的解析、检测和编辑功能
 */

export interface TableInfo {
  startLine: number;
  endLine: number;
  rows: string[][];
  rowCount: number;
  colCount: number;
}

/**
 * 检测光标位置是否在表格内
 * @param content 笔记内容
 * @param cursorPosition 光标位置（字符索引）
 * @returns 表格信息，如果不在表格内返回 null
 */
export function detectTableAtCursor(
  content: string,
  cursorPosition: number
): TableInfo | null {
  const lines = content.split('\n');
  let currentPos = 0;
  let cursorLine = -1;
  
  // 找到光标所在的行
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (cursorPosition >= currentPos && cursorPosition < currentPos + lineLength) {
      cursorLine = i;
      break;
    }
    currentPos += lineLength;
  }
  
  if (cursorLine === -1) return null;
  
  // 检查当前行是否是表格行
  const currentLine = lines[cursorLine].trim();
  if (!isTableRow(currentLine)) {
    return null;
  }
  
  // 向上查找表格开始
  let startLine = cursorLine;
  while (startLine > 0 && isTableRow(lines[startLine].trim())) {
    startLine--;
  }
  if (!isTableRow(lines[startLine].trim())) {
    startLine++;
  }
  
  // 向下查找表格结束
  let endLine = cursorLine;
  while (endLine < lines.length - 1 && isTableRow(lines[endLine].trim())) {
    endLine++;
  }
  if (!isTableRow(lines[endLine].trim())) {
    endLine--;
  }
  
  // 解析表格
  const tableLines = lines.slice(startLine, endLine + 1);
  const rows: string[][] = [];
  let colCount = 0;
  
  for (const line of tableLines) {
    if (line.trim().match(/^\|[\s\S]*\|$/)) {
      // 跳过分隔行（|--|--|）
      if (line.trim().match(/^\|[\s-|:]*\|$/)) {
        continue;
      }
      
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      if (cells.length > 0) {
        rows.push(cells);
        colCount = Math.max(colCount, cells.length);
      }
    }
  }
  
  if (rows.length === 0) return null;
  
  // 确保所有行的列数一致
  rows.forEach(row => {
    while (row.length < colCount) {
      row.push('');
    }
  });
  
  return {
    startLine,
    endLine,
    rows,
    rowCount: rows.length,
    colCount,
  };
}

/**
 * 检查一行是否是表格行
 */
function isTableRow(line: string): boolean {
  return /^\|[\s\S]*\|$/.test(line.trim());
}

/**
 * 在表格末尾添加一行
 * @param content 笔记内容
 * @param cursorPosition 光标位置
 * @returns 更新后的内容和新的光标位置
 */
export function addTableRow(
  content: string,
  cursorPosition: number
): { newContent: string; newCursorPosition: number } {
  const tableInfo = detectTableAtCursor(content, cursorPosition);
  if (!tableInfo) {
    return { newContent: content, newCursorPosition: cursorPosition };
  }
  
  const lines = content.split('\n');
  const newRow = '|' + '  |'.repeat(tableInfo.colCount) + '  |';
  
  // 在表格末尾插入新行
  lines.splice(tableInfo.endLine + 1, 0, newRow);
  const newContent = lines.join('\n');
  
  // 计算新光标位置（新行的第一个单元格）
  let newCursorPosition = 0;
  for (let i = 0; i <= tableInfo.endLine + 1; i++) {
    newCursorPosition += lines[i].length + 1; // +1 for newline
  }
  newCursorPosition += 2; // 移动到第一个单元格（| 之后）
  
  return { newContent, newCursorPosition };
}

/**
 * 在表格末尾添加一列
 * @param content 笔记内容
 * @param cursorPosition 光标位置
 * @returns 更新后的内容和新的光标位置
 */
export function addTableColumn(
  content: string,
  cursorPosition: number
): { newContent: string; newCursorPosition: number } {
  const tableInfo = detectTableAtCursor(content, cursorPosition);
  if (!tableInfo) {
    return { newContent: content, newCursorPosition: cursorPosition };
  }
  
  const lines = content.split('\n');
  
  // 更新表格的每一行
  for (let i = tableInfo.startLine; i <= tableInfo.endLine; i++) {
    const line = lines[i].trim();
    if (isTableRow(line) && !line.match(/^\|[\s-|:]*\|$/)) {
      // 数据行：在末尾添加新列
      if (line.endsWith('|')) {
        lines[i] = line.slice(0, -1) + '  |  |';
      } else {
        lines[i] = line + '  |';
      }
    } else if (line.match(/^\|[\s-|:]*\|$/)) {
      // 分隔行：添加新的分隔符
      lines[i] = line.slice(0, -1) + '--|';
    }
  }
  
  const newContent = lines.join('\n');
  return { newContent, newCursorPosition: cursorPosition };
}

/**
 * 格式化表格（对齐列）
 * @param content 笔记内容
 * @param cursorPosition 光标位置
 * @returns 更新后的内容
 */
export function formatTable(
  content: string,
  cursorPosition: number
): string {
  const tableInfo = detectTableAtCursor(content, cursorPosition);
  if (!tableInfo) {
    return content;
  }
  
  const lines = content.split('\n');
  const formattedRows: string[] = [];
  
  // 计算每列的最大宽度
  const colWidths: number[] = new Array(tableInfo.colCount).fill(0);
  tableInfo.rows.forEach(row => {
    row.forEach((cell, colIndex) => {
      colWidths[colIndex] = Math.max(colWidths[colIndex], cell.length);
    });
  });
  
  // 格式化数据行
  tableInfo.rows.forEach((row, rowIndex) => {
    const cells = row.map((cell, colIndex) => {
      return cell.padEnd(colWidths[colIndex], ' ');
    });
    formattedRows.push('| ' + cells.join(' | ') + ' |');
  });
  
  // 生成分隔行
  const separator = '|' + colWidths.map(w => '-'.repeat(Math.max(3, w + 1))).join('|') + '|';
  
  // 替换表格内容
  const tableStart = tableInfo.startLine;
  const tableEnd = tableInfo.endLine;
  const beforeTable = lines.slice(0, tableStart).join('\n');
  const afterTable = lines.slice(tableEnd + 1).join('\n');
  
  const newTable = [
    formattedRows[0],
    separator,
    ...formattedRows.slice(1)
  ].join('\n');
  
  let newContent = beforeTable;
  if (beforeTable) newContent += '\n';
  newContent += newTable;
  if (afterTable) {
    newContent += '\n' + afterTable;
  }
  
  return newContent;
}

/**
 * 将 Markdown 表格转换为 HTML 表格
 */
export function markdownTableToHTML(markdown: string): string {
  const lines = markdown.trim().split('\n');
  const rows: string[][] = [];
  let colCount = 0;
  
  for (const line of lines) {
    if (line.trim().match(/^\|[\s-|:]*\|$/)) {
      continue; // 跳过分隔行
    }
    if (line.trim().match(/^\|[\s\S]*\|$/)) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      if (cells.length > 0) {
        rows.push(cells);
        colCount = Math.max(colCount, cells.length);
      }
    }
  }
  
  if (rows.length === 0) return '';
  
  let html = '<table>\n';
  rows.forEach((row, index) => {
    html += '  <tr>\n';
    row.forEach(cell => {
      const tag = index === 0 ? 'th' : 'td';
      html += `    <${tag}>${cell}</${tag}>\n`;
    });
    // 补齐列数
    while (row.length < colCount) {
      const tag = index === 0 ? 'th' : 'td';
      html += `    <${tag}></${tag}>\n`;
    }
    html += '  </tr>\n';
  });
  html += '</table>';
  
  return html;
}

/**
 * 将表格数据转换为 Markdown 表格
 */
export function tableDataToMarkdown(rows: string[][]): string {
  if (rows.length === 0) return '';
  
  const colCount = Math.max(...rows.map(row => row.length));
  
  // 确保所有行的列数一致
  const normalizedRows = rows.map(row => {
    const newRow = [...row];
    while (newRow.length < colCount) {
      newRow.push('');
    }
    return newRow;
  });
  
  // 生成 Markdown 表格
  let markdown = '';
  normalizedRows.forEach((row, index) => {
    markdown += '| ' + row.join(' | ') + ' |\n';
    
    // 在第一行后添加分隔行
    if (index === 0) {
      markdown += '|' + '---|'.repeat(colCount) + '\n';
    }
  });
  
  return markdown.trim();
}

/**
 * 将 HTML 表格转换为 Markdown 表格
 */
export function htmlTableToMarkdown(html: string): string {
  if (typeof window === 'undefined') {
    // 服务端渲染时，直接解析 HTML 字符串
    const tableMatch = html.match(/<table>([\s\S]*?)<\/table>/);
    if (!tableMatch) return '';
    
    const tableContent = tableMatch[1];
    const rows: string[][] = [];
    const trMatches = tableContent.matchAll(/<tr>([\s\S]*?)<\/tr>/g);
    
    for (const trMatch of trMatches) {
      const trContent = trMatch[1];
      const cells: string[] = [];
      
      // 匹配 th 和 td
      const cellMatches = trContent.matchAll(/<(th|td)>([\s\S]*?)<\/(th|td)>/g);
      for (const cellMatch of cellMatches) {
        cells.push(cellMatch[2].trim());
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    return tableDataToMarkdown(rows);
  }
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  
  if (!table) return '';
  
  const rows: string[][] = [];
  const trs = table.querySelectorAll('tr');
  
  trs.forEach(tr => {
    const cells: string[] = [];
    const ths = tr.querySelectorAll('th');
    const tds = tr.querySelectorAll('td');
    
    ths.forEach(th => cells.push(th.textContent?.trim() || ''));
    tds.forEach(td => cells.push(td.textContent?.trim() || ''));
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  });
  
  return tableDataToMarkdown(rows);
}
