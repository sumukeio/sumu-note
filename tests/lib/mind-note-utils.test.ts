import { describe, it, expect } from 'vitest';
import {
  buildNodeTree,
  findNodeById,
  getVisibleNodes,
  getNextVisibleNode,
  getPreviousVisibleNode,
  moveNodeInTree,
  deleteNodeFromTree,
  getAllDescendants,
  canMoveNode,
  getNodeDepth,
  getNodePath,
} from '@/lib/mind-note-utils';
import type { MindNoteNode, MindNoteNodeTree } from '@/lib/mind-note-storage';

describe('mind-note-utils', () => {
  // 测试数据
  const createMockNode = (
    id: string,
    content: string,
    parentId: string | null = null,
    orderIndex: number = 0
  ): MindNoteNode => ({
    id,
    mind_note_id: 'note-1',
    parent_id: parentId,
    content,
    order_index: orderIndex,
    is_expanded: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  describe('buildNodeTree', () => {
    it('应该构建简单的树形结构', () => {
      const nodes: MindNoteNode[] = [
        createMockNode('1', '根节点1', null, 0),
        createMockNode('2', '根节点2', null, 1),
        createMockNode('3', '子节点1', '1', 0),
        createMockNode('4', '子节点2', '1', 1),
      ];

      const tree = buildNodeTree(nodes);

      expect(tree).toHaveLength(2);
      expect(tree[0].id).toBe('1');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children![0].id).toBe('3');
      expect(tree[0].children![1].id).toBe('4');
    });

    it('应该处理空数组', () => {
      const tree = buildNodeTree([]);
      expect(tree).toHaveLength(0);
    });

    it('应该按 order_index 排序', () => {
      const nodes: MindNoteNode[] = [
        createMockNode('1', '节点1', null, 2),
        createMockNode('2', '节点2', null, 0),
        createMockNode('3', '节点3', null, 1),
      ];

      const tree = buildNodeTree(nodes);
      expect(tree[0].id).toBe('2');
      expect(tree[1].id).toBe('3');
      expect(tree[2].id).toBe('1');
    });
  });

  describe('findNodeById', () => {
    it('应该找到根节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
      ];

      const found = findNodeById(tree, '1');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('1');
    });

    it('应该找到深层嵌套的节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [
                {
                  ...createMockNode('3', '节点3'),
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const found = findNodeById(tree, '3');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('3');
    });

    it('应该返回 null 当节点不存在时', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
      ];

      const found = findNodeById(tree, '999');
      expect(found).toBeNull();
    });
  });

  describe('getVisibleNodes', () => {
    it('应该返回所有展开节点的可见节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          is_expanded: true,
          children: [
            {
              ...createMockNode('2', '节点2'),
              is_expanded: true,
              children: [],
            },
            {
              ...createMockNode('3', '节点3'),
              is_expanded: false,
              children: [
                {
                  ...createMockNode('4', '节点4'),
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const visible = getVisibleNodes(tree);
      expect(visible).toHaveLength(3); // 节点1, 2, 3
      expect(visible.map((n) => n.id)).toEqual(['1', '2', '3']);
    });

    it('应该排除折叠节点的子节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          is_expanded: false,
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [],
            },
          ],
        },
      ];

      const visible = getVisibleNodes(tree);
      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe('1');
    });
  });

  describe('getNextVisibleNode', () => {
    it('应该返回下一个可见节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          is_expanded: true,
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [],
            },
          ],
        },
        {
          ...createMockNode('3', '节点3'),
          children: [],
        },
      ];

      const next = getNextVisibleNode(tree, '1');
      expect(next).not.toBeNull();
      expect(next?.id).toBe('2');
    });

    it('应该返回 null 当是最后一个节点时', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
      ];

      const next = getNextVisibleNode(tree, '1');
      expect(next).toBeNull();
    });
  });

  describe('getPreviousVisibleNode', () => {
    it('应该返回上一个可见节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          is_expanded: true,
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [],
            },
          ],
        },
        {
          ...createMockNode('3', '节点3'),
          children: [],
        },
      ];

      const prev = getPreviousVisibleNode(tree, '3');
      expect(prev).not.toBeNull();
      expect(prev?.id).toBe('2');
    });

    it('应该返回 null 当是第一个节点时', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
      ];

      const prev = getPreviousVisibleNode(tree, '1');
      expect(prev).toBeNull();
    });
  });

  describe('moveNodeInTree', () => {
    it('应该移动节点到新位置', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [],
            },
          ],
        },
        {
          ...createMockNode('3', '节点3'),
          children: [],
        },
      ];

      const moved = moveNodeInTree(tree, '2', null, 1);
      expect(moved).toHaveLength(3);
      expect(moved[1].id).toBe('2');
      expect(moved[1].parent_id).toBeNull();
    });

    it('应该移动节点到另一个节点的子节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
        {
          ...createMockNode('2', '节点2'),
          children: [],
        },
      ];

      const moved = moveNodeInTree(tree, '2', '1', 0);
      expect(moved).toHaveLength(1);
      expect(moved[0].children).toHaveLength(1);
      expect(moved[0].children![0].id).toBe('2');
    });
  });

  describe('deleteNodeFromTree', () => {
    it('应该删除指定节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [],
            },
          ],
        },
      ];

      const deleted = deleteNodeFromTree(tree, '2');
      expect(deleted[0].children).toHaveLength(0);
    });

    it('应该删除根节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
      ];

      const deleted = deleteNodeFromTree(tree, '1');
      expect(deleted).toHaveLength(0);
    });
  });

  describe('getAllDescendants', () => {
    it('应该返回所有后代节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [
                {
                  ...createMockNode('3', '节点3'),
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const descendants = getAllDescendants(tree, '1');
      expect(descendants).toHaveLength(2);
      expect(descendants.map((n) => n.id)).toEqual(['2', '3']);
    });
  });

  describe('canMoveNode', () => {
    it('应该允许移动到根节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [],
        },
      ];

      expect(canMoveNode(tree, '1', null)).toBe(true);
    });

    it('应该防止移动到自己的子节点', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [],
            },
          ],
        },
      ];

      expect(canMoveNode(tree, '1', '2')).toBe(false);
    });
  });

  describe('getNodeDepth', () => {
    it('应该正确计算节点深度', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [
                {
                  ...createMockNode('3', '节点3'),
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      expect(getNodeDepth(tree, '1')).toBe(0);
      expect(getNodeDepth(tree, '2')).toBe(1);
      expect(getNodeDepth(tree, '3')).toBe(2);
    });
  });

  describe('getNodePath', () => {
    it('应该返回从根到目标节点的路径', () => {
      const tree: MindNoteNodeTree[] = [
        {
          ...createMockNode('1', '节点1'),
          children: [
            {
              ...createMockNode('2', '节点2'),
              children: [
                {
                  ...createMockNode('3', '节点3'),
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const path = getNodePath(tree, '3');
      expect(path).toHaveLength(3);
      expect(path.map((n) => n.id)).toEqual(['1', '2', '3']);
    });
  });
});
















