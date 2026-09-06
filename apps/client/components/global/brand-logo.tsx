import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
}

export function BrandLogo({ className, showText = true }: BrandLogoProps) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90",
        className
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
        <Layers className="size-4.5" />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="text-base font-extrabold tracking-tight text-foreground leading-none">
            Essento<span className="text-primary">Labs</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase mt-0.5">
            Starter App
          </span>
        </div>
      )}
    </Link>
  );
}
