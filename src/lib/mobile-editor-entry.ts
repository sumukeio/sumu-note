/**
 * 移动端打开笔记时是否先进入「阅读态」（需再点一下才编辑）。
 * issue001：新建/空白笔记应直接进入编辑态，避免「先一页再点编辑换一页」。
 */
export function shouldStartInMobileReadingMode(note: {
  title?: string | null;
  content?: string | null;
}): boolean {
  const hasTitle = !!(note.title && note.title.trim());
  const hasContent = !!(note.content && note.content.trim());
  // 已有内容 → 阅读态；空白新建 → 直接编辑
  return hasTitle || hasContent;
}
