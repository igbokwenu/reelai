import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { GuideTooltip, type TooltipSide } from "@/components/ui/guide-tooltip";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  tooltip?: string;
  tooltipClassName?: string;
  tooltipSide?: TooltipSide;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  tooltip,
  tooltipClassName,
  tooltipSide,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  const button = (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  );

  return tooltip ? (
    <GuideTooltip
      className={tooltipClassName}
      content={tooltip}
      side={tooltipSide}
    >
      {button}
    </GuideTooltip>
  ) : (
    button
  );
}

export { Button, buttonVariants };
