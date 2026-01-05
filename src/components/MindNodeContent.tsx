"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMindNoteById, getNodesByMindNoteId, type MindNote } from "@/lib/mind-note-storage";
import { buildNodeTree } from "@/lib/mind-note-utils";
import { Loader2 } from "lucide-react";

interface MindNodeContentProps {
  content: string;
  isEditing?: boolean;
}

/**
 * 解析节点内容，提取内嵌链接
 */
function parseContent(content: string): Array<{ type: "text" | "link"; value: string; target?: string; display?: string }> {
  const result: Array<{ type: "text" | "link"; value: string; target?: string; display?: string }> = [];
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    // 添加链接前的文本
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        value: content.slice(lastIndex, match.index),
      });
    }

    // 解析链接内容
    const linkContent = match[1];
    const parts = linkContent.split("|");
    const target = parts[0].trim();
    const display = parts.length > 1 ? parts[1].trim() : target;

    result.push({
      type: "link",
      value: match[0],
      target,
      display,
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余的文本
  if (lastIndex < content.length) {
    result.push({
      type: "text",
      value: content.slice(lastIndex),
    });
  }

  // 如果没有匹配到任何链接，返回整个文本
  if (result.length === 0) {
    result.push({
      type: "text",
      value: content,
    });
  }

  return result;
}

export default function MindNodeContent({ content, isEditing = false }: MindNodeContentProps) {
  const router = useRouter();
  const [previewNote, setPreviewNote] = useState<MindNote | null>(null);
  const [previewNodes, setPreviewNodes] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const parts = parseContent(content);

  const handleLinkClick = async (target: string) => {
    try {
      setPreviewLoading(true);
      setPreviewOpen(true);

      // 尝试获取思维笔记
      const note = await getMindNoteById(target);
      if (note) {
        setPreviewNote(note);
        const nodeList = await getNodesByMindNoteId(note.id);
        const tree = buildNodeTree(nodeList);
        setPreviewNodes(tree);
      } else {
        // 如果找不到，尝试跳转
        router.push(`/dashboard/mind-notes/${target}`);
      }
    } catch (error) {
      console.error("Failed to load mind note:", error);
      // 跳转到思维笔记页面
      router.push(`/dashboard/mind-notes/${target}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 编辑模式下显示原始文本
  if (isEditing) {
    return <>{content}</>;
  }

  return (
    <>
      <span>
        {parts.map((part, index) => {
          if (part.type === "text") {
            return <span key={index}>{part.value}</span>;
          } else {
            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  if (part.target) {
                    handleLinkClick(part.target);
                  }
                }}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer mx-0.5 px-1 rounded hover:bg-blue-500/10"
              >
                {part.display || part.target}
              </button>
            );
          }
        })}
      </span>

      {/* 预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {previewNote?.title || "思维笔记预览"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewNodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                这个思维笔记还没有节点
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                {previewNodes.map((node) => (
                  <div
                    key={node.id}
                    className="pl-4 ml-1 border-l border-dashed border-muted-foreground/40"
                  >
                    <div className="font-medium mb-1">{node.content || "无内容"}</div>
                    {node.children && node.children.length > 0 && (
                      <div className="ml-4 text-xs text-muted-foreground">
                        {node.children.length} 个子节点
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              关闭
            </Button>
            {previewNote && (
              <Button
                onClick={() => {
                  setPreviewOpen(false);
                  router.push(`/dashboard/mind-notes/${previewNote.id}`);
                }}
              >
                打开完整页面
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

