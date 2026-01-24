"use client";

import { useState } from "react";
import SegmentedEditor from "@/components/SegmentedEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TestSegmentedEditorPage() {
  const router = useRouter();
  const [content, setContent] = useState(`这是一段普通文本。

| 姓名 | 年龄 | 城市 |
|------|------|------|
| 张三 | 25   | 北京 |
| 李四 | 30   | 上海 |

这是表格后的文本。

| 产品 | 价格 | 库存 |
|------|------|------|
| 苹果 | 10   | 100  |
| 香蕉 | 8    | 150  |

最后一段文本。`);

  const [markdownPreview, setMarkdownPreview] = useState("");

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setMarkdownPreview(newContent);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">SegmentedEditor 测试页面</h1>
            <p className="text-sm text-muted-foreground mt-1">
              测试新的分段编辑器：表格直接显示为可视化表格
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 编辑器区域 */}
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <h2 className="text-lg font-semibold mb-4">编辑器</h2>
              <SegmentedEditor
                content={content}
                onChange={handleContentChange}
                placeholder="开始输入内容..."
                className="min-h-[500px]"
              />
            </div>
          </div>

          {/* 预览和 Markdown 源码区域 */}
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <h2 className="text-lg font-semibold mb-4">Markdown 源码</h2>
              <pre className="text-xs font-mono bg-muted p-4 rounded overflow-auto max-h-[500px] whitespace-pre-wrap">
                {markdownPreview || content}
              </pre>
            </div>

            <div className="border border-border rounded-lg p-4 bg-card">
              <h2 className="text-lg font-semibold mb-4">测试说明</h2>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p>✅ <strong>测试点1：</strong>编辑表格单元格，检查是否正常更新</p>
                <p>✅ <strong>测试点2：</strong>添加/删除表格行列，检查是否正常</p>
                <p>✅ <strong>测试点3：</strong>编辑文本段，检查光标是否正常</p>
                <p>✅ <strong>测试点4：</strong>检查表格和文本之间的切换是否流畅</p>
                <p>✅ <strong>测试点5：</strong>检查 Markdown 源码是否正确同步</p>
                <p>✅ <strong>测试点6：</strong>检查是否有 React 错误或控制台警告</p>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 bg-card">
              <h2 className="text-lg font-semibold mb-4">快速操作</h2>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newTable = `| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 值1 | 值2 | 值3 |`;
                    setContent(content + "\n\n" + newTable);
                  }}
                  className="w-full"
                >
                  插入新表格
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContent("这是一段新的文本内容。");
                  }}
                  className="w-full"
                >
                  重置为简单文本
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
