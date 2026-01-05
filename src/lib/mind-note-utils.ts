"use client";

import type { MindNoteNode, MindNoteNodeTree } from "./mind-note-storage";

// ==================== 树形结构操作 ====================

/**
 * 将扁平节点数组构建为树形结构
 */
export function buildNodeTree(nodes: MindNoteNode[]): MindNoteNodeTree[] {
  // 创建节点映射表
  const nodeMap = new Map<string, MindNoteNodeTree>();
  const rootNodes: MindNoteNodeTree[] = [];

  // 第一遍：创建所有节点的映射
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // 第二遍：构建树形结构
  nodes.forEach((node) => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parent_id === null) {
      // 根节点
      rootNodes.push(treeNode);
    } else {
      // 子节点，添加到父节点的 children 中
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(treeNode);
      }
    }
  });

  // 对每个节点的 children 按 order_index 排序
  const sortChildren = (node: MindNoteNodeTree) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => a.order_index - b.order_index);
      node.children.forEach(sortChildren);
    }
  };

  rootNodes.forEach(sortChildren);

  return rootNodes;
}

/**
 * 将树形结构扁平化
 */
export function flattenNodeTree(
  tree: MindNoteNodeTree[],
  result: MindNoteNode[] = []
): MindNoteNode[] {
  tree.forEach((node) => {
    const { children, ...nodeData } = node;
    result.push(nodeData as MindNoteNode);
    if (children && children.length > 0) {
      flattenNodeTree(children, result);
    }
  });
  return result;
}

/**
 * 在树中查找节点
 */
export function findNodeById(
  tree: MindNoteNodeTree[],
  id: string
): MindNoteNodeTree | null {
  for (const node of tree) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * 获取节点路径（从根节点到目标节点的路径）
 */
export function getNodePath(
  tree: MindNoteNodeTree[],
  id: string
): MindNoteNodeTree[] {
  const path: MindNoteNodeTree[] = [];

  const findPath = (
    nodes: MindNoteNodeTree[],
    targetId: string,
    currentPath: MindNoteNodeTree[]
  ): boolean => {
    for (const node of nodes) {
      const newPath = [...currentPath, node];
      if (node.id === targetId) {
        path.push(...newPath);
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (findPath(node.children, targetId, newPath)) {
          return true;
        }
      }
    }
    return false;
  };

  findPath(tree, id, []);
  return path;
}

/**
 * 计算新节点的排序索引
 */
export function calculateNewOrderIndex(
  parentId: string | null,
  siblings: MindNoteNode[]
): number {
  if (siblings.length === 0) {
    return 0;
  }
  // 找到同一父节点下的最大 order_index
  const maxIndex = Math.max(
    ...siblings
      .filter((node) => node.parent_id === parentId)
      .map((node) => node.order_index)
  );
  return maxIndex + 1;
}

// ==================== 节点内容处理 ====================

/**
 * 解析节点内容（提取格式化标记）
 */
export interface ParsedNodeContent {
  text: string;
  boldRanges: Array<{ start: number; end: number }>;
  highlightRanges: Array<{ start: number; end: number; color?: string }>;
  links: Array<{ start: number; end: number; target: string; display: string }>;
}

export function parseNodeContent(content: string): ParsedNodeContent {
  const result: ParsedNodeContent = {
    text: content,
    boldRanges: [],
    highlightRanges: [],
    links: [],
  };

  // 解析加粗标记 **text**
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldRegex.exec(content)) !== null) {
    result.boldRanges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // 解析高亮标记 ==text==
  const highlightRegex = /==([^=]+)==/g;
  while ((match = highlightRegex.exec(content)) !== null) {
    result.highlightRanges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // 解析双向链接 [[noteId|显示名称]] 或 [[笔记标题]]
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  while ((match = linkRegex.exec(content)) !== null) {
    const linkContent = match[1];
    const parts = linkContent.split("|");
    const target = parts[0].trim();
    const display = parts.length > 1 ? parts[1].trim() : target;
    result.links.push({
      start: match.index,
      end: match.index + match[0].length,
      target,
      display,
    });
  }

  return result;
}

/**
 * 渲染节点内容为 HTML（用于预览）
 */
export function renderNodeContent(content: string): string {
  let html = content;

  // 转义 HTML 特殊字符
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 渲染加粗 **text** -> <strong>text</strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 渲染高亮 ==text== -> <mark>text</mark>
  html = html.replace(/==([^=]+)==/g, "<mark>$1</mark>");

  // 渲染双向链接 [[noteId|显示名称]] -> <a href="/notes/noteId">显示名称</a>
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    (match, linkContent) => {
      const parts = linkContent.split("|");
      const target = parts[0].trim();
      const display = parts.length > 1 ? parts[1].trim() : target;
      const href = `/notes/${encodeURIComponent(target)}`;
      return `<a href="${href}" class="mind-note-link">${display}</a>`;
    }
  );

  // 将换行符转换为 <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

/**
 * 移除所有格式化标记，获取纯文本
 */
export function getPlainText(content: string): string {
  return content
    .replace(/\*\*([^*]+)\*\*/g, "$1") // 移除加粗标记
    .replace(/==([^=]+)==/g, "$1") // 移除高亮标记
    .replace(/\[\[([^\]]+)\]\]/g, (match, linkContent) => {
      // 移除链接标记，保留显示文本
      const parts = linkContent.split("|");
      return parts.length > 1 ? parts[1].trim() : parts[0].trim();
    });
}

// ==================== 节点操作工具 ====================

/**
 * 获取节点的所有子节点（包括子节点的子节点）
 */
export function getAllDescendants(
  tree: MindNoteNodeTree[],
  nodeId: string
): MindNoteNodeTree[] {
  const node = findNodeById(tree, nodeId);
  if (!node) {
    return [];
  }

  const descendants: MindNoteNodeTree[] = [];
  const collectDescendants = (n: MindNoteNodeTree) => {
    if (n.children && n.children.length > 0) {
      n.children.forEach((child) => {
        descendants.push(child);
        collectDescendants(child);
      });
    }
  };

  collectDescendants(node);
  return descendants;
}

/**
 * 获取节点的深度（层级）
 */
export function getNodeDepth(
  tree: MindNoteNodeTree[],
  nodeId: string
): number {
  const path = getNodePath(tree, nodeId);
  return path.length - 1; // 减去根节点本身
}

/**
 * 检查节点是否可以移动到目标位置（防止循环引用）
 */
export function canMoveNode(
  tree: MindNoteNodeTree[],
  nodeId: string,
  targetParentId: string | null
): boolean {
  // 不能移动到自己的子节点下
  if (targetParentId === null) {
    return true; // 可以移动到根节点
  }

  const descendants = getAllDescendants(tree, nodeId);
  return !descendants.some((desc) => desc.id === targetParentId);
}

/**
 * 在树中移动节点（乐观更新用）
 */
export function moveNodeInTree(
  tree: MindNoteNodeTree[],
  nodeId: string,
  newParentId: string | null,
  newOrderIndex: number
): MindNoteNodeTree[] {
  // 1. 找到并移除节点（保留其子节点结构）
  let nodeToMove: MindNoteNodeTree | null = null;
  
  const removeNode = (nodes: MindNoteNodeTree[]): MindNoteNodeTree[] => {
    const result: MindNoteNodeTree[] = [];
    for (const node of nodes) {
      if (node.id === nodeId) {
        nodeToMove = { ...node };
        continue; // 跳过当前节点
      }
      if (node.children && node.children.length > 0) {
        result.push({
          ...node,
          children: removeNode(node.children),
        });
      } else {
        result.push(node);
      }
    }
    return result;
  };

  const treeWithoutNode = removeNode(tree);
  if (!nodeToMove) return tree; // 节点不存在

  // 2. 将节点插入到新位置
  const insertNode = (nodes: MindNoteNodeTree[]): MindNoteNodeTree[] => {
    if (newParentId === null) {
      // 插入到根节点
      const result = [...nodes];
      const nodeWithNewParent = {
        ...nodeToMove!,
        parent_id: null,
        order_index: newOrderIndex,
      };
      result.splice(newOrderIndex, 0, nodeWithNewParent);
      // 更新 order_index
      return result.map((node, index) => ({
        ...node,
        order_index: index,
      }));
    }

    // 插入到子节点
    return nodes.map((node) => {
      if (node.id === newParentId) {
        const children = node.children || [];
        const newChildren = [...children];
        const nodeWithNewParent = {
          ...nodeToMove!,
          parent_id: newParentId,
          order_index: newOrderIndex,
        };
        newChildren.splice(newOrderIndex, 0, nodeWithNewParent);
        // 更新子节点的 order_index
        const updatedChildren = newChildren.map((child, index) => ({
          ...child,
          order_index: index,
        }));
        return { ...node, children: updatedChildren };
      }
      if (node.children && node.children.length > 0) {
        return { ...node, children: insertNode(node.children) };
      }
      return node;
    });
  };

  return insertNode(treeWithoutNode);
}

/**
 * 从树中删除节点
 */
export function deleteNodeFromTree(
  tree: MindNoteNodeTree[],
  nodeId: string
): MindNoteNodeTree[] {
  return tree
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.children) {
        return {
          ...node,
          children: deleteNodeFromTree(node.children, nodeId),
        };
      }
      return node;
    });
}

/**
 * 展开/折叠节点及其所有子节点
 */
export function toggleNodeExpanded(
  tree: MindNoteNodeTree[],
  nodeId: string,
  expanded: boolean
): void {
  const node = findNodeById(tree, nodeId);
  if (!node) {
    return;
  }

  node.is_expanded = expanded;

  // 递归设置所有子节点
  const setChildrenExpanded = (n: MindNoteNodeTree) => {
    if (n.children && n.children.length > 0) {
      n.children.forEach((child) => {
        child.is_expanded = expanded;
        setChildrenExpanded(child);
      });
    }
  };

  setChildrenExpanded(node);
}

/**
 * 展开所有节点
 */
export function expandAllNodes(tree: MindNoteNodeTree[]): void {
  const expand = (nodes: MindNoteNodeTree[]) => {
    nodes.forEach((node) => {
      node.is_expanded = true;
      if (node.children && node.children.length > 0) {
        expand(node.children);
      }
    });
  };
  expand(tree);
}

/**
 * 折叠所有节点
 */
export function collapseAllNodes(tree: MindNoteNodeTree[]): void {
  const collapse = (nodes: MindNoteNodeTree[]) => {
    nodes.forEach((node) => {
      node.is_expanded = false;
      if (node.children && node.children.length > 0) {
        collapse(node.children);
      }
    });
  };
  collapse(tree);
}

