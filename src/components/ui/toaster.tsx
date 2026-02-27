"use client"

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, undoAction, ...props }) {
        // 如果传了 undoAction，就在右侧渲染「撤销」按钮
        const undoElement = undoAction
          ? (
            <ToastAction
              altText="撤销"
              className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
              onClick={() => {
                undoAction()
                dismiss(id)
              }}
            >
              撤销
            </ToastAction>
          )
          : null

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {undoElement ?? action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
