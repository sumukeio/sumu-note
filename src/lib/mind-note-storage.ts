"use client";

import { supabase } from "./supabase";

// ==================== 类型定义 ====================

export interface MindNote {
  id: string;
  user_id: string;
  title: string;
  root_node_id: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface MindNoteNode {
  id: string;
  mind_note_id: string;
  parent_id: string | null;
  content: string;
  order_index: number;
  is_expanded: boolean;
  created_at: string;
  updated_at: string;
}

export interface MindNoteNodeTree extends MindNoteNode {
  children?: MindNoteNodeTree[];
}

export interface CreateMindNoteData {
  title: string;
  folder_id?: string | null;
}

export interface UpdateMindNoteData {
  title?: string;
  root_node_id?: string | null;
  folder_id?: string | null;
  is_deleted?: boolean;
}

export interface CreateNodeData {
  content: string;
  parent_id?: string | null;
  order_index?: number;
  is_expanded?: boolean;
}

export interface UpdateNodeData {
  content?: string;
  parent_id?: string | null;
  order_index?: number;
  is_expanded?: boolean;
}

// ==================== 思维笔记 CRUD ====================

/**
 * 创建思维笔记
 */
export async function createMindNote(
  userId: string,
  data: CreateMindNoteData
): Promise<MindNote> {
  const { data: mindNote, error } = await supabase
    .from("mind_notes")
    .insert({
      user_id: userId,
      title: data.title || "未命名思维笔记",
      folder_id: data.folder_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create mind note:", error);
    throw new Error(error.message || "创建思维笔记失败");
  }

  // 创建根节点
  const rootNode = await createNode(mindNote.id, {
    content: "",
    parent_id: null,
    order_index: 0,
    is_expanded: true,
  });

  // 更新思维笔记的 root_node_id
  const { data: updatedNote, error: updateError } = await supabase
    .from("mind_notes")
    .update({ root_node_id: rootNode.id })
    .eq("id", mindNote.id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update root_node_id:", updateError);
    // 不抛出错误，根节点已创建成功
  }

  return (updatedNote || mindNote) as MindNote;
}

/**
 * 获取用户的所有思维笔记
 */
export interface MindNoteQueryOptions {
  folderId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface MindNoteListResult {
  notes: MindNote[];
  total: number;
}

export async function getMindNotes(
  userId: string,
  options: MindNoteQueryOptions = {}
): Promise<MindNoteListResult> {
  const {
    folderId,
    search = "",
    page = 1,
    pageSize = 20,
  } = options;

  let query = supabase
    .from("mind_notes")
    .select(
      "id,user_id,title,root_node_id,folder_id,created_at,updated_at,is_deleted",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .eq("is_deleted", false);

  // 文件夹过滤
  if (folderId !== undefined) {
    if (folderId === null) {
      query = query.is("folder_id", null);
    } else {
      query = query.eq("folder_id", folderId);
    }
  }

  // 搜索（标题）
  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  // 排序 & 分页
  const offset = (page - 1) * pageSize;
  query = query.order("updated_at", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch mind notes:", error);
    throw new Error(error.message || "获取思维笔记列表失败");
  }

  return {
    notes: (data || []) as MindNote[],
    total: typeof count === "number" ? count : (data?.length ?? 0),
  };
}

/**
 * 根据 ID 获取单个思维笔记
 */
export async function getMindNoteById(id: string): Promise<MindNote | null> {
  const { data, error } = await supabase
    .from("mind_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch mind note:", error);
    throw new Error(error.message || "获取思维笔记失败");
  }

  return data as MindNote | null;
}

/**
 * 更新思维笔记
 */
export async function updateMindNote(
  id: string,
  data: UpdateMindNoteData
): Promise<MindNote> {
  const { data: updatedNote, error } = await supabase
    .from("mind_notes")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update mind note:", error);
    throw new Error(error.message || "更新思维笔记失败");
  }

  return updatedNote as MindNote;
}

/**
 * 删除思维笔记（软删除）
 */
export async function deleteMindNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("mind_notes")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) {
    console.error("Failed to delete mind note:", error);
    throw new Error(error.message || "删除思维笔记失败");
  }
}

// ==================== 节点 CRUD ====================

/**
 * 创建节点
 */
export async function createNode(
  mindNoteId: string,
  data: CreateNodeData
): Promise<MindNoteNode> {
  // 如果没有指定 order_index，自动计算
  let orderIndex = data.order_index;
  if (orderIndex === undefined) {
    const { data: siblings } = await supabase
      .from("mind_note_nodes")
      .select("order_index")
      .eq("mind_note_id", mindNoteId)
      .eq("parent_id", data.parent_id || null)
      .order("order_index", { ascending: false })
      .limit(1);

    orderIndex = siblings && siblings.length > 0 ? (siblings[0].order_index + 1) : 0;
  }

  const { data: node, error } = await supabase
    .from("mind_note_nodes")
    .insert({
      mind_note_id: mindNoteId,
      parent_id: data.parent_id || null,
      content: data.content || "",
      order_index: orderIndex,
      is_expanded: data.is_expanded !== undefined ? data.is_expanded : true,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create node:", error);
    throw new Error(error.message || "创建节点失败");
  }

  return node as MindNoteNode;
}

/**
 * 更新节点
 */
export async function updateNode(
  id: string,
  data: UpdateNodeData
): Promise<MindNoteNode> {
  const { data: updatedNode, error } = await supabase
    .from("mind_note_nodes")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update node:", error);
    throw new Error(error.message || "更新节点失败");
  }

  return updatedNode as MindNoteNode;
}

/**
 * 删除节点（级联删除子节点）
 */
export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase
    .from("mind_note_nodes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete node:", error);
    throw new Error(error.message || "删除节点失败");
  }
}

/**
 * 获取思维笔记的所有节点
 */
export async function getNodesByMindNoteId(
  mindNoteId: string
): Promise<MindNoteNode[]> {
  const { data, error } = await supabase
    .from("mind_note_nodes")
    .select("*")
    .eq("mind_note_id", mindNoteId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Failed to fetch nodes:", error);
    throw new Error(error.message || "获取节点列表失败");
  }

  return (data || []) as MindNoteNode[];
}

/**
 * 更新节点顺序和层级
 */
export async function updateNodeOrder(
  mindNoteId: string,
  nodeId: string,
  newParentId: string | null,
  newOrderIndex: number
): Promise<void> {
  // 获取当前节点
  const { data: currentNode, error: fetchError } = await supabase
    .from("mind_note_nodes")
    .select("*")
    .eq("id", nodeId)
    .single();

  if (fetchError || !currentNode) {
    throw new Error("节点不存在");
  }

  // 如果移动到新位置，需要调整其他节点的 order_index
  if (currentNode.parent_id !== newParentId || currentNode.order_index !== newOrderIndex) {
    // 从原位置移除：将原位置后面的节点 order_index 减 1
    if (currentNode.parent_id !== null || currentNode.order_index !== undefined) {
      const { data: nodesToDecrement } = await supabase
        .from("mind_note_nodes")
        .select("id, order_index")
        .eq("mind_note_id", mindNoteId)
        .eq("parent_id", currentNode.parent_id)
        .gt("order_index", currentNode.order_index);

      if (nodesToDecrement && nodesToDecrement.length > 0) {
        await Promise.all(
          nodesToDecrement.map((node) =>
            supabase
              .from("mind_note_nodes")
              .update({ order_index: node.order_index - 1 })
              .eq("id", node.id)
          )
        );
      }
    }

    // 在新位置插入：将新位置后面的节点 order_index 加 1
    const { data: nodesToIncrement } = await supabase
      .from("mind_note_nodes")
      .select("id, order_index")
      .eq("mind_note_id", mindNoteId)
      .eq("parent_id", newParentId)
      .gte("order_index", newOrderIndex)
      .neq("id", nodeId); // 排除当前节点

    if (nodesToIncrement && nodesToIncrement.length > 0) {
      await Promise.all(
        nodesToIncrement.map((node) =>
          supabase
            .from("mind_note_nodes")
            .update({ order_index: node.order_index + 1 })
            .eq("id", node.id)
        )
      );
    }
  }

  // 更新节点
  const { error } = await supabase
    .from("mind_note_nodes")
    .update({
      parent_id: newParentId,
      order_index: newOrderIndex,
    })
    .eq("id", nodeId);

  if (error) {
    console.error("Failed to update node order:", error);
    throw new Error(error.message || "更新节点顺序失败");
  }
}

/**
 * 批量更新节点顺序（用于拖拽后批量更新）
 */
export async function batchUpdateNodeOrder(
  updates: Array<{
    id: string;
    parent_id: string | null;
    order_index: number;
  }>
): Promise<void> {
  // 使用 Promise.all 并行更新
  await Promise.all(
    updates.map((update) =>
      supabase
        .from("mind_note_nodes")
        .update({
          parent_id: update.parent_id,
          order_index: update.order_index,
        })
        .eq("id", update.id)
    )
  );
}

