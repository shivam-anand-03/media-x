"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps extends Omit<
  React.ComponentProps<"section">,
  "title"
> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Shown as a badge when a group is not required. */
  optional?: boolean;
  /** Right-aligned control, e.g. an "Add" button. */
  action?: React.ReactNode;
  contentClassName?: string;
}

/**
 * A labelled group of fields inside a form.
 *
 * Long profile/job forms are broken into these so each screen reads as a short
 * checklist rather than one long column of inputs. The left rule ties the
 * group's fields together visually on desktop.
 */
export function FormSection({
  title,
  description,
  icon: Icon,
  optional,
  action,
  className,
  contentClassName,
  children,
  ...props
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "relative rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5",
        "transition-colors duration-300 focus-within:border-primary/35",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="size-4.5" />
            </span>
          )}
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                {title}
              </h3>
              {optional && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  Optional
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs leading-relaxed font-light text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}

/** A responsive two-column field grid — the default layout inside a section. */
export function FormGrid({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** Makes a field span the full width of a `FormGrid`. */
export function FormGridFull({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("md:col-span-2", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * The sticky action bar at the bottom of a multi-step form.
 * Keeps Back/Skip/Continue reachable without scrolling to the end.
 */
export function FormActions({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col-reverse gap-3 border-t border-border/70 bg-card/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default FormSection;
