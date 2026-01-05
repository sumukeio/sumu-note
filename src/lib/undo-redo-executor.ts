import type { MindNoteNodeTree } from "./mind-note-storage";
import type { UndoRedoAction } from "@/hooks/useUndoRedo";
import { deleteNodeFromTree, moveNodeInTree, findNodeById } from "./mind-note-utils";

/**
 * 执行撤销/重做操作，返回新的节点树和标题
 */
export function executeUndoRedoActions(
  actions: UndoRedoAction[],
  currentNodes: MindNoteNodeTree[],
  currentTitle: string
): { nodes: MindNoteNodeTree[]; title: string } {
  let nodes = [...currentNodes];
  let title = currentTitle;

  // 按相反顺序执行操作（撤销时）
  for (const action of actions) {
    switch (action.type) {
      case "CREATE_NODE":
        // 撤销创建 = 删除节点
        nodes = deleteNodeFromTree(nodes, action.nodeId);
        break;

      case "DELETE_NODE":
        // 撤销删除 = 恢复节点
        const restoreNode = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
          if (action.parentId === null) {
            // 恢复为根节点
            const restored: MindNoteNodeTree = {
              id: action.nodeId,
              mind_note_id: tree[0]?.mind_note_id || "",
              parent_id: null,
              content: action.content,
              order_index: action.order,
              is_expanded: action.isExpanded,
              children: action.children || [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const result = [...tree];
            result.splice(action.order, 0, restored);
            // 更新 order_index
            return result.map((node, index) => ({
              ...node,
              order_index: index,
            }));
          } else {
            // 恢复为子节点
            return tree.map((node) => {
              if (node.id === action.parentId) {
                const children = node.children || [];
                const restored: MindNoteNodeTree = {
                  id: action.nodeId,
                  mind_note_id: node.mind_note_id,
                  parent_id: action.parentId,
                  content: action.content,
                  order_index: action.order,
                  is_expanded: action.isExpanded,
                  children: action.children || [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                const newChildren = [...children];
                newChildren.splice(action.order, 0, restored);
                // 更新 order_index
                const updatedChildren = newChildren.map((child, index) => ({
                  ...child,
                  order_index: index,
                }));
                return { ...node, children: updatedChildren };
              }
              if (node.children) {
                return { ...node, children: restoreNode(node.children) };
              }
              return node;
            });
          }
        };
        nodes = restoreNode(nodes);
        break;

      case "UPDATE_NODE_CONTENT":
        // 撤销更新 = 恢复旧内容
        const updateContentRecursive = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
          return tree.map((node) => {
            if (node.id === action.nodeId) {
              return { ...node, content: action.oldContent };
            }
            if (node.children) {
              return { ...node, children: updateContentRecursive(node.children) };
            }
            return node;
          });
        };
        nodes = updateContentRecursive(nodes);
        break;

      case "MOVE_NODE":
        // 撤销移动 = 移回原位置
        nodes = moveNodeInTree(nodes, action.nodeId, action.oldParentId, action.oldOrder);
        break;

      case "CHANGE_DEPTH":
        // 撤销层级变化 = 恢复原父节点
        const node = findNodeById(nodes, action.nodeId);
        if (node) {
          const oldParent = findNodeById(nodes, action.oldParentId || "");
          const oldOrder = oldParent?.children?.findIndex((c) => c.id === action.nodeId) ?? 0;
          nodes = moveNodeInTree(nodes, action.nodeId, action.oldParentId, oldOrder);
        }
        break;

      case "TOGGLE_EXPAND":
        // 撤销展开/折叠 = 恢复原状态
        const updateExpandRecursive = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
          return tree.map((node) => {
            if (node.id === action.nodeId) {
              return { ...node, is_expanded: action.oldExpanded };
            }
            if (node.children) {
              return { ...node, children: updateExpandRecursive(node.children) };
            }
            return node;
          });
        };
        nodes = updateExpandRecursive(nodes);
        break;

      case "UPDATE_TITLE":
        // 撤销标题更新 = 恢复旧标题
        title = action.oldTitle;
        break;
    }
  }

  return { nodes, title };
}

/**
 * 执行重做操作（与撤销相反）
 */
export function executeRedoActions(
  actions: UndoRedoAction[],
  currentNodes: MindNoteNodeTree[],
  currentTitle: string
): { nodes: MindNoteNodeTree[]; title: string } {
  let nodes = [...currentNodes];
  let title = currentTitle;

  for (const action of actions) {
    switch (action.type) {
      case "CREATE_NODE":
        // 重做创建 = 创建节点（需要从删除操作中恢复）
        // 这个逻辑与 DELETE_NODE 的撤销相同
        const restoreNode = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
          if (action.parentId === null) {
            const restored: MindNoteNodeTree = {
              id: action.nodeId,
              mind_note_id: tree[0]?.mind_note_id || "",
              parent_id: null,
              content: "",
              order_index: action.order,
              is_expanded: true,
              children: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const result = [...tree];
            result.splice(action.order, 0, restored);
            return result.map((node, index) => ({
              ...node,
              order_index: index,
            }));
          } else {
            return tree.map((node) => {
              if (node.id === action.parentId) {
                const children = node.children || [];
                const restored: MindNoteNodeTree = {
                  id: action.nodeId,
                  mind_note_id: node.mind_note_id,
                  parent_id: action.parentId,
                  content: "",
                  order_index: action.order,
                  is_expanded: true,
                  children: [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                const newChildren = [...children];
                newChildren.splice(action.order, 0, restored);
                const updatedChildren = newChildren.map((child, index) => ({
                  ...child,
                  order_index: index,
                }));
                return { ...node, children: updatedChildren };
              }
              if (node.children) {
                return { ...node, children: restoreNode(node.children) };
              }
              return node;
            });
          }
        };
        nodes = restoreNode(nodes);
        break;

      case "DELETE_NODE":
        // 重做删除 = 删除节点
        nodes = deleteNodeFromTree(nodes, action.nodeId);
        break;

      case "UPDATE_NODE_CONTENT":
        // 重做更新 = 应用新内容
        const updateContentRecursive = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
          return tree.map((node) => {
            if (node.id === action.nodeId) {
              return { ...node, content: action.newContent };
            }
            if (node.children) {
              return { ...node, children: updateContentRecursive(node.children) };
            }
            return node;
          });
        };
        nodes = updateContentRecursive(nodes);
        break;

      case "MOVE_NODE":
        // 重做移动 = 移动到新位置
        nodes = moveNodeInTree(nodes, action.nodeId, action.newParentId, action.newOrder);
        break;

      case "CHANGE_DEPTH":
        // 重做层级变化 = 应用新父节点
        const node = findNodeById(nodes, action.nodeId);
        if (node) {
          const newParent = findNodeById(nodes, action.newParentId || "");
          const newOrder = newParent?.children?.length ?? 0;
          nodes = moveNodeInTree(nodes, action.nodeId, action.newParentId, newOrder);
        }
        break;

      case "TOGGLE_EXPAND":
        // 重做展开/折叠 = 应用新状态
        const updateExpandRecursive = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
          return tree.map((node) => {
            if (node.id === action.nodeId) {
              return { ...node, is_expanded: action.newExpanded };
            }
            if (node.children) {
              return { ...node, children: updateExpandRecursive(node.children) };
            }
            return node;
          });
        };
        nodes = updateExpandRecursive(nodes);
        break;

      case "UPDATE_TITLE":
        // 重做标题更新 = 应用新标题
        title = action.newTitle;
        break;
    }
  }

  return { nodes, title };
}

