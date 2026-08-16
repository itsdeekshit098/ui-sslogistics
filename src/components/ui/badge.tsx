import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-[var(--badge-radius)] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                success:
                    "border-transparent bg-success text-success-foreground hover:bg-success/80",
                warning:
                    "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
                info:
                    "border-transparent bg-info text-info-foreground hover:bg-info/80",
                outline: "text-foreground",
                // Tinted-surface variants for status inside dense tables — a
                // whole column of solid-fill badges reads as noisy; a soft
                // tint carries the same meaning more quietly.
                "success-subtle":
                    "border-success/20 bg-success-subtle text-success-subtle-foreground",
                "warning-subtle":
                    "border-warning/25 bg-warning-subtle text-warning-subtle-foreground",
                "destructive-subtle":
                    "border-destructive/20 bg-destructive-subtle text-destructive-subtle-foreground",
                "info-subtle":
                    "border-info/20 bg-info-subtle text-info-subtle-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    /** Leading status dot in the badge's own color, instead of colored text alone. */
    dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props}>
            {dot && (
                <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                />
            )}
            {children}
        </div>
    )
}

export { Badge, badgeVariants }
