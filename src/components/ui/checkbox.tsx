"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, onChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate || false;
      }
    }, [indeterminate]);

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "checked:bg-primary checked:text-primary-foreground",
            "indeterminate:bg-primary",
            className
          )}
          ref={inputRef}
          checked={checked}
          onChange={onChange}
          {...props}
        />
        {checked && !indeterminate && (
          <Check className="absolute left-0 top-0 h-4 w-4 text-primary-foreground pointer-events-none opacity-0 peer-checked:opacity-100 peer-checked:z-10" />
        )}
        {indeterminate && (
          <div className="absolute left-0 top-0 h-4 w-4 flex items-center justify-center pointer-events-none">
            <div className="h-0.5 w-2 bg-primary-foreground" />
          </div>
        )}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
