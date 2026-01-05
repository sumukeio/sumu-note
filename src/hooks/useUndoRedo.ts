import { useState, useCallback } from "react";
import type { MindNoteNodeTree } from "@/lib/mind-note-storage";

export type UndoRedoAction =
  | { type: "CREATE_NODE"; nodeId: string; parentId: string | null; order: number }
  | { type: "DELETE_NODE"; nodeId: string; parentId: string | null; order: number; content: string; isExpanded: boolean; children?: MindNoteNodeTree[] }
  | { type: "UPDATE_NODE_CONTENT"; nodeId: string; oldContent: string; newContent: string }
  | { type: "MOVE_NODE"; nodeId: string; oldParentId: string | null; oldOrder: number; newParentId: string | null; newOrder: number }
  | { type: "CHANGE_DEPTH"; nodeId: string; oldParentId: string | null; newParentId: string | null }
  | { type: "TOGGLE_EXPAND"; nodeId: string; oldExpanded: boolean; newExpanded: boolean }
  | { type: "UPDATE_TITLE"; oldTitle: string; newTitle: string };

interface UndoRedoState {
  past: UndoRedoAction[][]; // 撤销栈：每个操作可能包含多个动作
  future: UndoRedoAction[][]; // 重做栈
}

const MAX_HISTORY_SIZE = 50; // 最多保存50步历史

export function useUndoRedo() {
  const [state, setState] = useState<UndoRedoState>({
    past: [],
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  // 记录操作到撤销栈
  const recordAction = useCallback((actions: UndoRedoAction[]) => {
    if (actions.length === 0) return;

    setState((prev) => {
      const newPast = [...prev.past, actions];
      // 限制历史记录数量
      const trimmedPast = newPast.slice(-MAX_HISTORY_SIZE);
      // 执行新操作时，清空重做栈
      return {
        past: trimmedPast,
        future: [],
      };
    });
  }, []);

  // 撤销操作
  const undo = useCallback((): UndoRedoAction[] | null => {
    if (!canUndo) return null;

    let actionsToUndo: UndoRedoAction[] | null = null;

    setState((prev) => {
      const lastActions = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      const newFuture = [lastActions, ...prev.future];

      actionsToUndo = lastActions;

      return {
        past: newPast,
        future: newFuture,
      };
    });

    return actionsToUndo;
  }, [canUndo]);

  // 重做操作
  const redo = useCallback((): UndoRedoAction[] | null => {
    if (!canRedo) return null;

    let actionsToRedo: UndoRedoAction[] | null = null;

    setState((prev) => {
      const firstActions = prev.future[0];
      const newFuture = prev.future.slice(1);
      const newPast = [...prev.past, firstActions];

      actionsToRedo = firstActions;

      return {
        past: newPast,
        future: newFuture,
      };
    });

    return actionsToRedo;
  }, [canRedo]);

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setState({
      past: [],
      future: [],
    });
  }, []);

  return {
    canUndo,
    canRedo,
    recordAction,
    undo,
    redo,
    clearHistory,
  };
}

