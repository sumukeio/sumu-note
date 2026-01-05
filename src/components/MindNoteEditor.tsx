"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2, Plus, Minus, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DraggableMindNode from "./DraggableMindNode";
import MindNodeToolbar from "./MindNodeToolbar";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  type Active,
  type Over,
} from "@dnd-kit/core";
import {
  getMindNoteById,
  getNodesByMindNoteId,
  updateMindNote,
  createNode,
  updateNode,
  deleteNode,
  updateNodeOrder,
  type MindNote,
  type MindNoteNodeTree,
} from "@/lib/mind-note-storage";
import {
  buildNodeTree,
  expandAllNodes,
  collapseAllNodes,
  moveNodeInTree,
  deleteNodeFromTree,
  getNextVisibleNode,
  getPreviousVisibleNode,
  getVisibleNodes,
} from "@/lib/mind-note-utils";
import { cn } from "@/lib/utils";
import { useUndoRedo, type UndoRedoAction } from "@/hooks/useUndoRedo";
import { executeUndoRedoActions, executeRedoActions } from "@/lib/undo-redo-executor";

interface MindNoteEditorProps {
  mindNoteId: string;
  userId: string;
}

type SaveStatus = "saved" | "saving" | "error" | "unsaved";

// 在树中查找节点的工具函数（移到组件外部避免 useCallback 递归问题）
function findNodeInTree(
  tree: MindNoteNodeTree[],
  nodeId: string
): MindNoteNodeTree | null {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

export default function MindNoteEditor({
  mindNoteId,
  userId,
}: MindNoteEditorProps) {
  const router = useRouter();
  const [mindNote, setMindNote] = useState<MindNote | null>(null);
  const [nodes, setNodes] = useState<MindNoteNodeTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nodeUpdateTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14); // 默认字体大小
  
  // 撤销/重做功能
  const { canUndo, canRedo, recordAction, undo, redo, clearHistory } = useUndoRedo();
  const isUndoRedoExecuting = useRef(false); // 防止撤销/重做操作本身被记录

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 移动端长按延迟250ms，平衡响应速度和误触
        tolerance: 10, // 增加容差到10px，避免轻微移动触发拖拽
      },
    })
  );

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const note = await getMindNoteById(mindNoteId);
      if (!note) {
        router.push("/dashboard/mind-notes");
        return;
      }

      setMindNote(note);
      setTitle(note.title || "");

      const nodeList = await getNodesByMindNoteId(mindNoteId);
      const tree = buildNodeTree(nodeList);
      setNodes(tree);
    } catch (error) {
      console.error("Failed to load mind note:", error);
      alert("加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [mindNoteId, router]);

  useEffect(() => {
    loadData();
    // 加载数据后清空历史记录
    clearHistory();
  }, [loadData, clearHistory]);

  // 保存标题
  const saveTitle = useCallback(
    async (newTitle: string) => {
      if (!mindNote || newTitle === mindNote.title) return;

      setSaveStatus("saving");
      try {
        const updated = await updateMindNote(mindNote.id, { title: newTitle });
        setMindNote(updated);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to save title:", error);
        setSaveStatus("error");
      }
    },
    [mindNote]
  );

  // 执行撤销操作
  const handleUndo = useCallback(async () => {
    if (!canUndo || isUndoRedoExecuting.current) return;
    
    isUndoRedoExecuting.current = true;
    const actions = undo();
    
    if (actions) {
      const { nodes: newNodes, title: newTitle } = executeUndoRedoActions(
        actions,
        nodes,
        title
      );
      
      setNodes(newNodes);
      if (newTitle !== title) {
        setTitle(newTitle);
        await saveTitle(newTitle);
      }
      
      // 同步到数据库（异步，不阻塞）
      // 这里需要根据操作类型同步更新数据库
      setSaveStatus("saving");
      try {
        // TODO: 根据 actions 类型同步更新数据库
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to sync undo to database:", error);
        setSaveStatus("error");
      }
    }
    
    isUndoRedoExecuting.current = false;
  }, [canUndo, undo, nodes, title, saveTitle]);

  // 执行重做操作
  const handleRedo = useCallback(async () => {
    if (!canRedo || isUndoRedoExecuting.current) return;
    
    isUndoRedoExecuting.current = true;
    const actions = redo();
    
    if (actions) {
      const { nodes: newNodes, title: newTitle } = executeRedoActions(
        actions,
        nodes,
        title
      );
      
      setNodes(newNodes);
      if (newTitle !== title) {
        setTitle(newTitle);
        await saveTitle(newTitle);
      }
      
      // 同步到数据库
      setSaveStatus("saving");
      try {
        // TODO: 根据 actions 类型同步更新数据库
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to sync redo to database:", error);
        setSaveStatus("error");
      }
    }
    
    isUndoRedoExecuting.current = false;
  }, [canRedo, redo, nodes, title, saveTitle]);

  // 点击外部关闭工具栏（移动端）
  useEffect(() => {
    if (!selectedNodeId) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // 如果点击的是工具栏或节点，不关闭
      if (
        target.closest("[data-toolbar]") ||
        target.closest("[data-node-id]")
      ) {
        return;
      }
      setSelectedNodeId(null);
    };

    // 延迟添加监听器，避免立即触发
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("touchend", handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside, true);
      document.removeEventListener("touchend", handleClickOutside, true);
    };
  }, [selectedNodeId]);

  // 全部展开/折叠功能
  const handleToggleAllExpand = useCallback(async () => {
    if (nodes.length === 0) return;

    const allExpanded = nodes.every((node) => {
      const checkExpanded = (n: MindNoteNodeTree): boolean => {
        if (!n.is_expanded) return false;
        if (n.children && n.children.length > 0) {
          return n.children.every(checkExpanded);
        }
        return true;
      };
      return checkExpanded(node);
    });

    const newExpanded = !allExpanded;

    // 更新所有节点的展开状态
    const updateAllExpanded = async (tree: MindNoteNodeTree[]) => {
      for (const node of tree) {
        await updateNode(node.id, { is_expanded: newExpanded });
        if (node.children && node.children.length > 0) {
          await updateAllExpanded(node.children);
        }
      }
    };

    setSaveStatus("saving");
    try {
      await updateAllExpanded(nodes);
      // 更新本地状态
      const updateLocalState = (tree: MindNoteNodeTree[]): MindNoteNodeTree[] => {
        return tree.map((node) => ({
          ...node,
          is_expanded: newExpanded,
          children: node.children
            ? updateLocalState(node.children)
            : undefined,
        }));
      };
      setNodes(updateLocalState(nodes));
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to toggle all expand:", error);
      setSaveStatus("error");
    }
  }, [nodes]);

  // 标题变更处理（自动保存）
  const handleTitleChange = (newTitle: string) => {
    if (!isUndoRedoExecuting.current && title !== newTitle) {
      // 记录操作
      recordAction([
        {
          type: "UPDATE_TITLE",
          oldTitle: title,
          newTitle: newTitle,
        },
      ]);
    }
    
    setTitle(newTitle);
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveTitle(newTitle);
    }, 1500);
  };


  // 更新节点内容的辅助函数（乐观更新）
  const updateNodeInTree = useCallback(
    (
      tree: MindNoteNodeTree[],
      nodeId: string,
      updater: (node: MindNoteNodeTree) => MindNoteNodeTree
    ): MindNoteNodeTree[] => {
      return tree.map((node) => {
        if (node.id === nodeId) {
          return updater(node);
        }
        if (node.children) {
          return {
            ...node,
            children: updateNodeInTree(node.children, nodeId, updater),
          };
        }
        return node;
      });
    },
    []
  );

  // 更新节点内容（乐观更新 + 防抖）
  const handleUpdateNode = useCallback(
    (nodeId: string, content: string) => {
      // 获取旧内容
      const oldNode = findNodeInTree(nodes, nodeId);
      const oldContent = oldNode?.content || "";
      
      if (!isUndoRedoExecuting.current && oldContent !== content) {
        // 记录操作
        recordAction([
          {
            type: "UPDATE_NODE_CONTENT",
            nodeId,
            oldContent,
            newContent: content,
          },
        ]);
      }
      
      // 乐观更新：立即更新本地状态
      setNodes((prevNodes) =>
        updateNodeInTree(prevNodes, nodeId, (node) => ({ ...node, content }))
      );
      setSaveStatus("unsaved");

      // 清除之前的定时器
      const existingTimer = nodeUpdateTimerRef.current.get(nodeId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 防抖保存：800ms 后保存到数据库
      const timer = setTimeout(async () => {
        try {
          setSaveStatus("saving");
          await updateNode(nodeId, { content });
          setSaveStatus("saved");
        } catch (error) {
          console.error("Failed to update node:", error);
          setSaveStatus("error");
          // 保存失败时，可以选择重新加载数据或显示错误提示
        } finally {
          nodeUpdateTimerRef.current.delete(nodeId);
        }
      }, 800);

      nodeUpdateTimerRef.current.set(nodeId, timer);
    },
    [updateNodeInTree, nodes, recordAction]
  );

  // 切换展开/折叠（乐观更新）
  const handleToggleExpand = useCallback(
    (nodeId: string) => {
      setNodes((prevNodes) => {
        const node = findNodeInTree(prevNodes, nodeId);
        if (!node) return prevNodes;

        const newExpanded = !node.is_expanded;
        
        if (!isUndoRedoExecuting.current) {
          // 记录操作
          recordAction([
            {
              type: "TOGGLE_EXPAND",
              nodeId,
              oldExpanded: node.is_expanded,
              newExpanded,
            },
          ]);
        }
        
        // 乐观更新
        const updated = updateNodeInTree(prevNodes, nodeId, (n) => ({
          ...n,
          is_expanded: newExpanded,
        }));

        // 异步保存（不阻塞 UI）
        updateNode(nodeId, { is_expanded: newExpanded }).catch((error) => {
          console.error("Failed to update expand state:", error);
        });

        return updated;
      });
    },
    [updateNodeInTree, recordAction]
  );

  // 添加子节点（乐观更新）
  const handleAddChild = useCallback(
    async (parentId: string) => {
      if (!mindNote) return;

      // 创建临时节点 ID（用于乐观更新）
      const tempId = `temp-${Date.now()}`;
      const tempNode: MindNoteNodeTree = {
        id: tempId,
        mind_note_id: mindNote.id,
        parent_id: parentId,
        content: "",
        order_index: 0,
        is_expanded: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 乐观更新：立即添加到 UI
      setNodes((prevNodes) => {
        const addChildToTree = (
          tree: MindNoteNodeTree[]
        ): MindNoteNodeTree[] => {
          return tree.map((node) => {
            if (node.id === parentId) {
              return {
                ...node,
                children: [...(node.children || []), tempNode],
              };
            }
            if (node.children) {
              return { ...node, children: addChildToTree(node.children) };
            }
            return node;
          });
        };
        return addChildToTree(prevNodes);
      });

      setSaveStatus("saving");

      try {
        // 异步创建节点
        const newNode = await createNode(mindNote.id, {
          content: "",
          parent_id: parentId,
        });

        // 记录操作（使用真实节点 ID）
        if (!isUndoRedoExecuting.current) {
          const parentNode = findNodeInTree(nodes, parentId);
          recordAction([
            {
              type: "CREATE_NODE",
              nodeId: newNode.id,
              parentId: parentId,
              order: parentNode?.children?.length || 0,
            },
          ]);
        }

        // 替换临时节点为真实节点
        setNodes((prevNodes) => {
          const replaceTempNode = (
            tree: MindNoteNodeTree[]
          ): MindNoteNodeTree[] => {
            return tree.map((node) => {
              if (node.id === tempId) {
                return { ...newNode, children: [] };
              }
              if (node.children) {
                return { ...node, children: replaceTempNode(node.children) };
              }
              return node;
            });
          };
          return replaceTempNode(prevNodes);
        });

        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to add child node:", error);
        setSaveStatus("error");
        // 失败时移除临时节点
        setNodes((prevNodes) => {
          const removeTempNode = (
            tree: MindNoteNodeTree[]
          ): MindNoteNodeTree[] => {
            return tree
              .filter((node) => node.id !== tempId)
              .map((node) => {
                if (node.children) {
                  return { ...node, children: removeTempNode(node.children) };
                }
                return node;
              });
          };
          return removeTempNode(prevNodes);
        });
      }
    },
    [mindNote, nodes, recordAction]
  );

  // 添加同级节点（乐观更新）
  const handleAddSibling = useCallback(
    async (nodeId: string) => {
      if (!mindNote) return;

      const currentNode = findNodeInTree(nodes, nodeId);
      if (!currentNode) return;

      // 创建临时节点
      const tempId = `temp-${Date.now()}`;
      const tempNode: MindNoteNodeTree = {
        id: tempId,
        mind_note_id: mindNote.id,
        parent_id: currentNode.parent_id,
        content: "",
        order_index: currentNode.order_index + 1,
        is_expanded: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 乐观更新：立即添加到 UI
      setNodes((prevNodes) => {
        const addSiblingToTree = (
          tree: MindNoteNodeTree[]
        ): MindNoteNodeTree[] => {
          for (let i = 0; i < tree.length; i++) {
            if (tree[i].id === nodeId) {
              // 在当前节点后插入
              return [
                ...tree.slice(0, i + 1),
                tempNode,
                ...tree.slice(i + 1),
              ];
            }
            if (tree[i].children) {
              const updated = addSiblingToTree(tree[i].children!);
              if (updated !== tree[i].children) {
                return [
                  ...tree.slice(0, i),
                  { ...tree[i], children: updated },
                  ...tree.slice(i + 1),
                ];
              }
            }
          }
          return tree;
        };
        return addSiblingToTree(prevNodes);
      });

      setSaveStatus("saving");

      try {
        const newNode = await createNode(mindNote.id, {
          content: "",
          parent_id: currentNode.parent_id,
          order_index: currentNode.order_index + 1,
        });

        // 替换临时节点
        setNodes((prevNodes) => {
          const replaceTempNode = (
            tree: MindNoteNodeTree[]
          ): MindNoteNodeTree[] => {
            return tree.map((node) => {
              if (node.id === tempId) {
                return { ...newNode, children: [] };
              }
              if (node.children) {
                return { ...node, children: replaceTempNode(node.children) };
              }
              return node;
            });
          };
          return replaceTempNode(prevNodes);
        });

        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to add sibling node:", error);
        setSaveStatus("error");
        // 失败时移除临时节点
        setNodes((prevNodes) => {
          const removeTempNode = (
            tree: MindNoteNodeTree[]
          ): MindNoteNodeTree[] => {
            return tree
              .filter((node) => node.id !== tempId)
              .map((node) => {
                if (node.children) {
                  return { ...node, children: removeTempNode(node.children) };
                }
                return node;
              });
          };
          return removeTempNode(prevNodes);
        });
      }
    },
    [mindNote, nodes]
  );

  // 提升层级（Shift+Tab）- 乐观更新
  const handleOutdent = useCallback(
    async (nodeId: string) => {
      if (!mindNote) return;

      const currentNode = findNodeInTree(nodes, nodeId);
      if (!currentNode) return;

      // 找到父节点
      const findParent = (
        tree: MindNoteNodeTree[],
        targetId: string
      ): MindNoteNodeTree | null => {
        for (const node of tree) {
          if (node.children) {
            for (const child of node.children) {
              if (child.id === targetId) {
                return node;
              }
            }
            const found = findParent(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const parent = findParent(nodes, nodeId);
      if (!parent) return; // 已经是根节点

      // 乐观更新：立即更新 UI
      setNodes((prevNodes) =>
        moveNodeInTree(
          prevNodes,
          nodeId,
          parent.parent_id,
          parent.order_index + 1
        )
      );

      setSaveStatus("saving");

      // 异步保存
      try {
        await updateNodeOrder(
          mindNote.id,
          nodeId,
          parent.parent_id,
          parent.order_index + 1
        );
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to outdent node:", error);
        setSaveStatus("error");
        // 失败时重新加载
        loadData();
      }
    },
    [mindNote, nodes, loadData]
  );

  // 降低层级（缩进）- 乐观更新
  const handleIndent = useCallback(
    async (nodeId: string) => {
      if (!mindNote) return;

      const currentNode = findNodeInTree(nodes, nodeId);
      if (!currentNode) return;

      // 找到前一个兄弟节点
      const findPrevSibling = (
        tree: MindNoteNodeTree[],
        targetId: string
      ): MindNoteNodeTree | null => {
        for (let i = 0; i < tree.length; i++) {
          if (tree[i].id === targetId) {
            return i > 0 ? tree[i - 1] : null;
          }
          if (tree[i].children) {
            const found = findPrevSibling(tree[i].children!, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const prevSibling = findPrevSibling(nodes, nodeId);
      if (!prevSibling) return; // 没有前一个兄弟节点

      // 乐观更新：立即更新 UI
      setNodes((prevNodes) =>
        moveNodeInTree(prevNodes, nodeId, prevSibling.id, 0)
      );

      setSaveStatus("saving");

      // 异步保存
      try {
        await updateNodeOrder(mindNote.id, nodeId, prevSibling.id, 0);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to indent node:", error);
        setSaveStatus("error");
        // 失败时重新加载
        loadData();
      }
    },
    [mindNote, nodes, loadData]
  );

  // 查找节点及其所有子节点 ID
  const getAllNodeIds = useCallback((node: MindNoteNodeTree): string[] => {
    const ids = [node.id];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        ids.push(...getAllNodeIds(child));
      });
    }
    return ids;
  }, []);

  // 删除节点 - 乐观更新
  const handleDeleteNode = useCallback(
    async (nodeId: string, skipConfirm: boolean = false) => {
      if (!skipConfirm) {
        // 检查节点是否有子节点
        const nodeToDelete = findNodeInTree(nodes, nodeId);
        if (nodeToDelete && nodeToDelete.children && nodeToDelete.children.length > 0) {
          // 有子节点时，需要确认
          if (!confirm("确定要删除这个节点吗？所有子节点也会被删除。")) {
            return;
          }
        }
      }

      // 记录操作（在删除前记录）
      const nodeToDelete = findNodeInTree(nodes, nodeId);
      if (!isUndoRedoExecuting.current && nodeToDelete) {
        recordAction([
          {
            type: "DELETE_NODE",
            nodeId,
            parentId: nodeToDelete.parent_id,
            order: nodeToDelete.order_index,
            content: nodeToDelete.content,
            isExpanded: nodeToDelete.is_expanded,
            children: nodeToDelete.children,
          },
        ]);
      }

      // 乐观更新：立即从 UI 中移除
      setNodes((prevNodes) => deleteNodeFromTree(prevNodes, nodeId));

      setSaveStatus("saving");

      // 异步删除
      try {
        await deleteNode(nodeId);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to delete node:", error);
        setSaveStatus("error");
        // 失败时重新加载
        loadData();
      }
    },
    [nodes, loadData, recordAction]
  );

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // 禁用页面滚动
    document.body.style.overflow = "hidden";
    // 禁用文本选择
    document.body.style.userSelect = "none";
  }, []);

  // 拖拽结束 - 乐观更新
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      // 恢复页面滚动
      document.body.style.overflow = "";
      // 恢复文本选择
      document.body.style.userSelect = "";

      if (!over || !mindNote) return;

      const draggedNodeId = active.id as string;
      const targetDropId = over.id as string;

      // 从 drop zone ID 中提取节点 ID
      // 支持格式：drop-child-${nodeId} 或 drop-sibling-${nodeId}
      let targetNodeId: string | null = null;
      if (targetDropId.startsWith("drop-child-")) {
        targetNodeId = targetDropId.replace("drop-child-", "");
      } else if (targetDropId.startsWith("drop-sibling-")) {
        targetNodeId = targetDropId.replace("drop-sibling-", "");
      } else if (targetDropId.startsWith("drop-")) {
        targetNodeId = targetDropId.replace("drop-", "");
      }

      if (!targetNodeId) return;

      // 如果拖到自己的位置，不做任何操作
      if (draggedNodeId === targetNodeId) {
        return;
      }

      // 获取拖拽的节点
      const draggedNode = findNodeInTree(nodes, draggedNodeId);
      if (!draggedNode) return;

      // 检查是否拖到自己子节点下（防止循环引用）
      const draggedNodeDescendants = getAllNodeIds(draggedNode);
      if (draggedNodeDescendants.includes(targetNodeId)) {
        alert("不能将节点移动到自己的子节点下");
        return;
      }

      // 获取目标节点
      const targetNode = findNodeInTree(nodes, targetNodeId);
      if (!targetNode) return;

      // 计算新的位置
      let newParentId: string | null = null;
      let newOrderIndex = 0;

      // 判断拖拽位置：检查 over.data 中的信息
      const overData = over.data.current;
      if (overData?.type === "mind-node-child" || targetDropId.startsWith("drop-child-")) {
        // 拖到节点上，作为子节点
        newParentId = targetNodeId;
        newOrderIndex = 0;
      } else if (overData?.type === "mind-node-sibling" || targetDropId.startsWith("drop-sibling-")) {
        // 拖到节点后，作为同级节点
        newParentId = targetNode.parent_id;
        newOrderIndex = targetNode.order_index + 1;
      } else {
        // 兼容旧逻辑：默认作为同级节点
        newParentId = targetNode.parent_id;
        newOrderIndex = targetNode.order_index + 1;
      }

      // 乐观更新：立即更新 UI
      setNodes((prevNodes) =>
        moveNodeInTree(prevNodes, draggedNodeId, newParentId, newOrderIndex)
      );

      setSaveStatus("saving");

      // 异步保存
      try {
        await updateNodeOrder(
          mindNote.id,
          draggedNodeId,
          newParentId,
          newOrderIndex
        );
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to move node:", error);
        setSaveStatus("error");
        alert("移动节点失败，请稍后重试");
        // 失败时重新加载
        loadData();
      }
    },
    [nodes, mindNote, getAllNodeIds, loadData]
  );

  // 获取拖拽中的节点
  const getActiveNode = useCallback((): MindNoteNodeTree | null => {
    if (!activeId) return null;
    return findNodeInTree(nodes, activeId);
  }, [activeId, nodes]);

  // 获取选中的节点
  const getSelectedNode = useCallback((): MindNoteNodeTree | null => {
    if (!selectedNodeId) return null;
    return findNodeInTree(nodes, selectedNodeId);
  }, [selectedNodeId, nodes]);

  // 处理节点选择
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // 处理工具栏操作
  const handleToolbarEdit = useCallback(() => {
    if (!selectedNodeId) return;
    // 直接设置编辑状态
    setEditingNodeId(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId]);
  
  // 处理节点编辑状态变化
  const handleNodeEditStart = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);
  
  const handleNodeEditEnd = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  const handleToolbarIndent = useCallback(() => {
    if (!selectedNodeId) return;
    handleIndent(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId, handleIndent]);

  const handleToolbarOutdent = useCallback(() => {
    if (!selectedNodeId) return;
    handleOutdent(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId, handleOutdent]);

  const handleToolbarDelete = useCallback(() => {
    if (!selectedNodeId) return;
    handleDeleteNode(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId, handleDeleteNode]);

  const handleToolbarAddChild = useCallback(() => {
    if (!selectedNodeId) return;
    handleAddChild(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId, handleAddChild]);

  const handleToolbarAddSibling = useCallback(() => {
    if (!selectedNodeId) return;
    handleAddSibling(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId, handleAddSibling]);

  // 检查是否可以升级
  const canOutdent = useCallback((): boolean => {
    if (!selectedNodeId) return false;
    const node = findNodeInTree(nodes, selectedNodeId);
    if (!node) return false;
    return node.parent_id !== null;
  }, [selectedNodeId, nodes]);

  // 全局快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y / Cmd+Y 或 Ctrl+Shift+Z / Cmd+Shift+Z: 重做
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+N / Cmd+N: 新建思维笔记
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        router.push("/dashboard/mind-notes");
        return;
      }

      // Ctrl+F / Cmd+F: 聚焦搜索框（如果存在）
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        // TODO: 如果将来有搜索框，聚焦它
        return;
      }

      // Ctrl+S / Cmd+S: 手动保存
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        // 触发保存（如果有未保存的内容）
        if (saveStatus === "unsaved") {
          // 强制保存所有待保存的内容
          // TODO: 实现强制保存逻辑
        }
        return;
      }

      // Ctrl+/ / Cmd+/: 显示/隐藏快捷键帮助
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsShortcutHelpOpen((prev) => !prev);
        return;
      }

      // Alt + . : 全部展开/折叠（仅桌面端）
      if (e.altKey && e.key === ".") {
        e.preventDefault();
        handleToggleAllExpand();
        return;
      }

      // 方向键导航（仅在非编辑模式）
      if (!editingNodeId && selectedNodeId) {
        // 方向键上：选择上一个可见节点
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const prevNode = getPreviousVisibleNode(nodes, selectedNodeId);
          if (prevNode) {
            setSelectedNodeId(prevNode.id);
            // 滚动到可见区域
            setTimeout(() => {
              const element = document.querySelector(`[data-node-id="${prevNode.id}"]`);
              element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 0);
          }
          return;
        }

        // 方向键下：选择下一个可见节点
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const nextNode = getNextVisibleNode(nodes, selectedNodeId);
          if (nextNode) {
            setSelectedNodeId(nextNode.id);
            // 滚动到可见区域
            setTimeout(() => {
              const element = document.querySelector(`[data-node-id="${nextNode.id}"]`);
              element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 0);
          }
          return;
        }

        // 方向键左：折叠节点（如果有子节点）
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const currentNode = findNodeInTree(nodes, selectedNodeId);
          if (currentNode && currentNode.children && currentNode.children.length > 0 && currentNode.is_expanded) {
            handleToggleExpand(selectedNodeId);
          }
          return;
        }

        // 方向键右：展开节点（如果有子节点）
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const currentNode = findNodeInTree(nodes, selectedNodeId);
          if (currentNode && currentNode.children && currentNode.children.length > 0 && !currentNode.is_expanded) {
            handleToggleExpand(selectedNodeId);
          }
          return;
        }

        // 空格键：切换展开/折叠状态
        if (e.key === " ") {
          e.preventDefault();
          const currentNode = findNodeInTree(nodes, selectedNodeId);
          if (currentNode && currentNode.children && currentNode.children.length > 0) {
            handleToggleExpand(selectedNodeId);
          }
          return;
        }
      }

      // Shift + Tab: 提升层级（PC端）
      if (e.shiftKey && e.key === "Tab") {
        const activeElement = document.activeElement;
        // 如果正在编辑输入框，不处理（让输入框自己处理）
        if (
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        
        // 如果有选中的节点，提升层级
        if (selectedNodeId) {
          e.preventDefault();
          handleOutdent(selectedNodeId);
          return;
        }
      }

      // Tab: 创建子节点（PC端，仅在非编辑状态）
      if (e.key === "Tab" && !e.shiftKey) {
        const activeElement = document.activeElement;
        // 如果正在编辑输入框，不处理（让输入框自己处理）
        if (
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        
        // 如果有选中的节点，创建子节点
        if (selectedNodeId) {
          e.preventDefault();
          handleAddChild(selectedNodeId);
          return;
        }
      }

      // 如果正在编辑输入框，不处理其他快捷键
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA"
      ) {
        // 移动端：在输入框中按 Enter 创建同级节点
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          activeElement.tagName === "INPUT"
        ) {
          const input = activeElement as HTMLInputElement;
          const nodeId = input.getAttribute("data-node-id");
          if (nodeId) {
            e.preventDefault();
            // 先保存当前编辑
            const node = findNodeInTree(nodes, nodeId);
            if (node) {
              handleUpdateNode(nodeId, input.value);
            }
            // 然后创建同级节点
            setTimeout(() => {
              handleAddSibling(nodeId);
            }, 100);
          }
        }
        return;
      }

      // Enter: 在根节点创建同级节点（浏览模式）
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (selectedNodeId) {
          // 如果有选中的节点，在选中节点后创建同级节点
          handleAddSibling(selectedNodeId);
        } else if (nodes.length > 0 && mindNote?.root_node_id) {
          handleAddSibling(nodes[0].id);
        } else if (mindNote?.root_node_id) {
          handleAddChild(mindNote.root_node_id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    nodes,
    mindNote,
    selectedNodeId,
    editingNodeId,
    handleToggleAllExpand,
    handleAddSibling,
    handleAddChild,
    handleUpdateNode,
    handleOutdent,
    handleToggleExpand,
    handleUndo,
    handleRedo,
    saveStatus,
    router,
    getNextVisibleNode,
    getPreviousVisibleNode,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!mindNote) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部工具栏 */}
      <header className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/mind-notes")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-3xl font-bold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent h-auto"
              placeholder="未命名思维笔记"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* 字体大小调节 */}
            <div className="flex items-center gap-1 border border-border rounded-md px-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setFontSize((prev) => Math.max(10, prev - 1))}
                title="减小字体"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[2rem] text-center">
                {fontSize}px
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setFontSize((prev) => Math.min(24, prev + 1))}
                title="增大字体"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleAllExpand}
              className="hidden sm:flex text-xs"
              title="全部展开/折叠 (Alt + .)"
            >
              {nodes.length > 0 && nodes.some((n) => {
                const checkExpanded = (node: MindNoteNodeTree): boolean => {
                  if (!node.is_expanded) return false;
                  if (node.children && node.children.length > 0) {
                    return node.children.every(checkExpanded);
                  }
                  return true;
                };
                return !checkExpanded(n);
              }) ? "展开全部" : "折叠全部"}
            </Button>
            {/* 撤销/重做按钮 */}
            <div className="flex items-center gap-1 border border-border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleUndo}
                disabled={!canUndo}
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRedo}
                disabled={!canRedo}
                title="重做 (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex text-xs"
              onClick={() => setIsShortcutHelpOpen(true)}
            >
              快捷键
            </Button>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  保存中...
                </>
              ) : saveStatus === "error" ? (
                "保存失败"
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  已保存
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 编辑区域 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {nodes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="mb-4">还没有节点</p>
              <Button
                onClick={() => {
                  if (mindNote.root_node_id) {
                    handleAddChild(mindNote.root_node_id);
                  }
                }}
                variant="outline"
              >
                创建第一个节点
              </Button>
            </div>
          ) : (
            <div className="space-y-0">
              {nodes.map((node, index) => (
                <DraggableMindNode
                  key={node.id}
                  node={node}
                  depth={0}
                  onUpdate={handleUpdateNode}
                  onToggleExpand={handleToggleExpand}
                  onAddChild={handleAddChild}
                  onAddSibling={handleAddSibling}
                  onIndent={handleIndent}
                  onOutdent={handleOutdent}
                  onDelete={handleDeleteNode}
                  onSelect={handleNodeSelect}
                  isSelected={selectedNodeId === node.id}
                  selectedNodeId={selectedNodeId}
                  editingNodeId={editingNodeId}
                  onEditStart={handleNodeEditStart}
                  onEditEnd={handleNodeEditEnd}
                  parentExpanded={true}
                  isLastChild={index === nodes.length - 1}
                  fontSize={fontSize}
                />
              ))}
            </div>
          )}
          <DragOverlay>
            {activeId ? (
              <div className="px-3 py-2 text-sm bg-background border-2 border-blue-500 rounded-lg shadow-2xl max-w-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="truncate font-medium">
                    {getActiveNode()?.content || "节点"}
                  </div>
                </div>
                {getActiveNode()?.children && getActiveNode()!.children!.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 ml-4">
                    包含 {getActiveNode()!.children!.length} 个子节点
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* 快捷键帮助 */}
      <Dialog open={isShortcutHelpOpen} onOpenChange={setIsShortcutHelpOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>快捷键指引（PC 端）</DialogTitle>
            <DialogDescription>
              提高编辑效率的常用快捷键说明
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-6">
            {/* 编辑节点时 */}
            <div>
              <div className="font-semibold text-base mb-3 pb-2 border-b border-border">
                编辑节点时（光标在输入框内）
              </div>
              <div className="space-y-2">
                {[
                  { key: "Ctrl + A", desc: "全选当前节点内容" },
                  { key: "Enter", desc: "保存并在下方创建同级节点" },
                  { key: "Shift + Enter", desc: "换行" },
                  { key: "Tab", desc: "保存并在下方创建子节点" },
                  { key: "Shift + Tab", desc: "保存并提升当前节点层级" },
                  { key: "Backspace", desc: "光标在行首且内容为空时，删除当前节点（有子节点时会确认）" },
                  { key: "Esc", desc: "取消编辑" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    <div className="flex-shrink-0 min-w-[140px]">
                      <kbd className="px-2.5 py-1.5 text-xs font-semibold text-foreground bg-background border border-border rounded-md shadow-sm flex items-center justify-center gap-1">
                        {item.key.split(" + ").map((k, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-muted-foreground">+</span>}
                            <span>{k}</span>
                          </span>
                        ))}
                      </kbd>
                    </div>
                    <div className="flex-1 text-sm text-foreground pt-0.5">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 浏览/选中节点时 */}
            <div>
              <div className="font-semibold text-base mb-3 pb-2 border-b border-border">
                浏览/选中节点时
              </div>
              <div className="space-y-2">
                {[
                  { key: "Ctrl + Z", desc: "撤销上一步操作" },
                  { key: "Ctrl + Y", desc: "重做上一步操作" },
                  { key: "Ctrl + Shift + Z", desc: "重做（Mac 端）" },
                  { key: "Ctrl + N", desc: "新建思维笔记" },
                  { key: "Ctrl + S", desc: "手动保存" },
                  { key: "Ctrl + /", desc: "显示/隐藏快捷键帮助" },
                  { key: "↑ ↓", desc: "在节点间上下切换选择" },
                  { key: "← →", desc: "折叠/展开节点（有子节点时）" },
                  { key: "Space", desc: "切换选中节点的展开/折叠状态" },
                  { key: "Enter", desc: "在选中节点下方创建同级节点" },
                  { key: "Tab", desc: "在选中节点下方创建子节点" },
                  { key: "Shift + Tab", desc: "提升选中节点层级" },
                  { key: "Alt + .", desc: "全部展开 / 折叠" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    <div className="flex-shrink-0 min-w-[140px]">
                      <kbd className="px-2.5 py-1.5 text-xs font-semibold text-foreground bg-background border border-border rounded-md shadow-sm flex items-center justify-center gap-1">
                        {item.key.split(" + ").map((k, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-muted-foreground">+</span>}
                            <span>{k}</span>
                          </span>
                        ))}
                      </kbd>
                    </div>
                    <div className="flex-1 text-sm text-foreground pt-0.5">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 移动端提示 */}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded">
                💡 移动端可通过长按节点 + 底部工具栏完成同样的操作
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 移动端工具栏 */}
      <MindNodeToolbar
        isVisible={selectedNodeId !== null}
        onEdit={handleToolbarEdit}
        onIndent={handleToolbarIndent}
        onOutdent={handleToolbarOutdent}
        onDelete={handleToolbarDelete}
        onAddChild={handleToolbarAddChild}
        onAddSibling={handleToolbarAddSibling}
        canOutdent={canOutdent()}
      />
    </div>
  );
}

