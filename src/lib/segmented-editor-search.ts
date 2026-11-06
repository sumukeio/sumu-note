/**
 * 编辑态页内查找：将全文 Match 偏移映射到 SegmentedEditor 段索引 / 本地选区。
 * 分段规则与 SegmentedEditor.parseContent 对齐（含 trim 后的文本段内容）。
 */

export interface SearchMatchRange {
  start: number;
  end: number;
}

export type SegmentMatchLocation =
  | { kind: "text"; segmentIndex: number; localStart: number; localEnd: number }
  | { kind: "table"; segmentIndex: number }
  | { kind: "plain"; localStart: number; localEnd: number };

interface SegmentRange {
  type: "text" | "table";
  /** 文本段：与编辑器 value 一致的 trim 后内容起点（相对全文） */
  textStartInContent: number;
  textContent: string;
  /** 表格：原文中表格行覆盖区间 [rawStart, rawEnd) */
  rawStart: number;
  rawEnd: number;
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\|[\s\S]*\|$/.test(trimmed);
}

function isTableDataRow(line: string): boolean {
  const trimmed = line.trim();
  return /^\|[\s\S]*\|$/.test(trimmed) && !/^\|[\s-|:]*\|$/.test(trimmed);
}

function lineStarts(text: string): { lines: string[]; starts: number[] } {
  const lines = text.split("\n");
  const starts: number[] = [];
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    starts.push(pos);
    pos += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }
  return { lines, starts };
}

/**
 * 计算 trim 后子串在 raw 中的起点；空串返回 0。
 */
function trimmedStartOffset(raw: string, trimmed: string): number {
  if (!trimmed) return 0;
  const idx = raw.indexOf(trimmed);
  return idx >= 0 ? idx : 0;
}

/**
 * 与 SegmentedEditor.parseContent 同结构的段区间（供查找定位）。
 */
export function buildSegmentRanges(text: string): SegmentRange[] {
  if (!text.trim()) {
    return [];
  }

  const { lines, starts } = lineStarts(text);
  const result: SegmentRange[] = [];
  let currentText = "";
  let currentTextStart = 0;
  let accumulating = false;
  let i = 0;
  const processedLines = new Set<number>();

  const flushText = () => {
    if (!currentText.trim()) {
      currentText = "";
      accumulating = false;
      return;
    }
    const trimmed = currentText.trim();
    const localTrimStart = trimmedStartOffset(currentText, trimmed);
    result.push({
      type: "text",
      textStartInContent: currentTextStart + localTrimStart,
      textContent: trimmed,
      rawStart: currentTextStart,
      rawEnd: currentTextStart + currentText.length,
    });
    currentText = "";
    accumulating = false;
  };

  while (i < lines.length) {
    if (processedLines.has(i)) {
      i++;
      continue;
    }

    const trimmed = lines[i].trim();

    if (isTableDataRow(trimmed)) {
      flushText();

      let tableStartLine = i;
      while (
        tableStartLine > 0 &&
        isTableLine(lines[tableStartLine - 1].trim()) &&
        !processedLines.has(tableStartLine - 1)
      ) {
        tableStartLine--;
      }

      let tableEndLine = i;
      while (
        tableEndLine < lines.length - 1 &&
        isTableLine(lines[tableEndLine + 1].trim())
      ) {
        tableEndLine++;
      }

      for (let j = tableStartLine; j <= tableEndLine; j++) {
        processedLines.add(j);
      }

      // 与 parseContent 一致：至少一行数据才建表段
      let hasDataRow = false;
      for (let j = tableStartLine; j <= tableEndLine; j++) {
        if (isTableDataRow(lines[j].trim())) {
          hasDataRow = true;
          break;
        }
      }

      if (hasDataRow) {
        const rawStart = starts[tableStartLine];
        const rawEnd =
          tableEndLine < lines.length - 1
            ? starts[tableEndLine + 1]
            : text.length;
        result.push({
          type: "table",
          textStartInContent: rawStart,
          textContent: "",
          rawStart,
          rawEnd,
        });
        i = tableEndLine + 1;
        continue;
      }
    }

    if (!accumulating) {
      currentTextStart = starts[i];
      accumulating = true;
    }
    // 与 parseContent 一致：每行后追加 \n
    currentText += lines[i] + "\n";
    i++;
  }

  if (currentText.trim() || result.length === 0) {
    flushText();
  }

  // flushText 在仅空白时可能不推段；保证与 parseContent「至少一段」对齐
  if (result.length === 0 && text.trim()) {
    const trimmed = text.trim();
    const localTrimStart = trimmedStartOffset(text, trimmed);
    result.push({
      type: "text",
      textStartInContent: localTrimStart,
      textContent: trimmed,
      rawStart: 0,
      rawEnd: text.length,
    });
  }

  return result;
}

/**
 * 将全文匹配区间映射到 SegmentedEditor 可操作的定位信息。
 */
export function locateMatchInContent(
  content: string,
  match: SearchMatchRange
): SegmentMatchLocation | null {
  if (
    match.start < 0 ||
    match.end < match.start ||
    match.end > content.length
  ) {
    return null;
  }

  if (!content.trim()) {
    return {
      kind: "plain",
      localStart: match.start,
      localEnd: match.end,
    };
  }

  const ranges = buildSegmentRanges(content);
  if (ranges.length === 0) {
    return {
      kind: "plain",
      localStart: match.start,
      localEnd: match.end,
    };
  }

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.type === "text") {
      const segStart = r.textStartInContent;
      const segEnd = segStart + r.textContent.length;
      if (match.start < segEnd && match.end > segStart) {
        const localStart = Math.max(0, match.start - segStart);
        const localEnd = Math.min(r.textContent.length, match.end - segStart);
        if (localStart < localEnd) {
          return {
            kind: "text",
            segmentIndex: i,
            localStart,
            localEnd,
          };
        }
      }
    } else if (match.start < r.rawEnd && match.end > r.rawStart) {
      return { kind: "table", segmentIndex: i };
    }
  }

  return null;
}

/**
 * 计算为了让「选区视口 Y」落在容器可见区中线，外层 scrollTop 需要增加的增量。
 * topInset：查找条等顶部遮挡高度。
 */
export function computeScrollDeltaToCenter(params: {
  caretViewportY: number;
  containerTop: number;
  containerHeight: number;
  topInset?: number;
}): number {
  const inset = Math.max(0, params.topInset ?? 0);
  const visibleTop = params.containerTop + inset;
  const visibleHeight = Math.max(1, params.containerHeight - inset);
  const targetY = visibleTop + visibleHeight / 2;
  return params.caretViewportY - targetY;
}

/**
 * 用镜像 DOM 测量 textarea 内 offset 处相对内容顶部的像素高度（不含 scrollTop）。
 * 仅浏览器环境可用。
 */
export function measureTextareaOffsetTop(
  textarea: HTMLTextAreaElement,
  offset: number
): number {
  const clamped = Math.max(0, Math.min(offset, textarea.value.length));
  const styles = window.getComputedStyle(textarea);
  const measureDiv = document.createElement("div");
  measureDiv.style.position = "absolute";
  measureDiv.style.visibility = "hidden";
  measureDiv.style.whiteSpace = "pre-wrap";
  measureDiv.style.wordWrap = "break-word";
  measureDiv.style.overflowWrap = "break-word";
  measureDiv.style.font = styles.font;
  measureDiv.style.fontSize = styles.fontSize;
  measureDiv.style.fontFamily = styles.fontFamily;
  measureDiv.style.fontWeight = styles.fontWeight;
  measureDiv.style.lineHeight = styles.lineHeight;
  measureDiv.style.letterSpacing = styles.letterSpacing;
  measureDiv.style.padding = styles.padding;
  measureDiv.style.border = styles.border;
  measureDiv.style.boxSizing = styles.boxSizing;
  measureDiv.style.width = `${textarea.clientWidth}px`;
  measureDiv.textContent = textarea.value.slice(0, clamped) || "\u200b";
  document.body.appendChild(measureDiv);
  const height = measureDiv.offsetHeight;
  document.body.removeChild(measureDiv);
  return height;
}

/**
 * 将 textarea 内某偏移处滚到外层滚动容器可视中区（不滚动整块 textarea）。
 */
export function scrollContainerToTextareaOffset(params: {
  container: HTMLElement;
  textarea: HTMLTextAreaElement;
  offset: number;
  topInset?: number;
}): void {
  const { container, textarea, offset } = params;
  const offsetTop = measureTextareaOffsetTop(textarea, offset);
  const textareaRect = textarea.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  // overflow-hidden 的撑高 textarea：scrollTop≈0；仍减去以兼容兜底单框
  const caretViewportY = textareaRect.top + offsetTop - textarea.scrollTop;
  const delta = computeScrollDeltaToCenter({
    caretViewportY,
    containerTop: containerRect.top,
    containerHeight: containerRect.height,
    topInset: params.topInset,
  });
  if (Math.abs(delta) < 1) return;
  container.scrollTop += delta;
}

/**
 * 将任意元素中心滚到外层容器可视中区。
 */
export function scrollContainerToElementCenter(params: {
  container: HTMLElement;
  element: HTMLElement;
  topInset?: number;
}): void {
  const { container, element } = params;
  const elRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const caretViewportY = (elRect.top + elRect.bottom) / 2;
  const delta = computeScrollDeltaToCenter({
    caretViewportY,
    containerTop: containerRect.top,
    containerHeight: containerRect.height,
    topInset: params.topInset,
  });
  if (Math.abs(delta) < 1) return;
  container.scrollTop += delta;
}
