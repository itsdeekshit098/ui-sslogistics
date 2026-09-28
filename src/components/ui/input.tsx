import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, onWheel, ...props }, ref) => {
        // Prevent scroll-to-increment on number inputs globally
        const handleWheel: React.WheelEventHandler<HTMLInputElement> = (e) => {
            if (type === "number") {
                e.currentTarget.blur();
            }
            onWheel?.(e);
        };

        return (
            <input
                type={type}
                className={cn(
                    "flex h-11 w-full rounded-[var(--input-radius)] border border-input bg-background px-3 py-2 text-base ring-offset-background md:h-10 md:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-placeholder-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                onWheel={handleWheel}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
