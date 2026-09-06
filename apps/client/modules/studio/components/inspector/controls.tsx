"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@workspace/ui/components/slider";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

/**
 * The inspector's control vocabulary.
 *
 * One implementation per control shape, so every panel has identical label
 * placement, field height and spacing. Anything an inspector row needs is here;
 * panels never hand-roll a labelled input.
 */

export function InspectorSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border/60 px-4 py-4 last:border-b-0", className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

/**
 * A numeric field that also scrubs.
 *
 * Keeps its own draft string so a user can clear the box and retype without
 * the value snapping to 0 mid-edit; the store is only written on a valid
 * parse, and the draft is discarded on blur.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  suffix,
  disabled,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = React.useId();
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? formatNumber(value, precision);

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      onChange(clamp(parsed, min, max));
    }
    setDraft(null);
  };

  // Drag the label to scrub — the standard affordance in design tools.
  const startScrub = (event: React.PointerEvent) => {
    if (disabled) return;
    event.preventDefault();
    const startX = event.clientX;
    const startValue = value;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) * step;
      onChange(clamp(round(startValue + delta, precision), min, max));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        onPointerDown={startScrub}
        className={cn(
          "block text-[11px] font-medium text-muted-foreground select-none",
          !disabled && "cursor-ew-resize hover:text-foreground",
        )}
        title={disabled ? undefined : "Drag to adjust"}
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={display}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") setDraft(null);
            e.stopPropagation();
          }}
          className={cn(
            "h-8 pr-6 text-xs tabular-nums",
            // Native spinners fight with the scrub affordance.
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** A labelled slider with a live numeric readout. */
export function SliderField({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  format,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Fired on release — used to close a transient history group. */
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? min) : next)}
        onValueCommitted={onCommit}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger className="h-8 w-full text-xs" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A segmented control — for small, mutually exclusive choices like alignment. */
export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label?: string;
  value: T;
  options: readonly { value: T; label: React.ReactNode; title?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {label && <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>}
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-full rounded-md border border-border bg-muted/40 p-0.5"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.title ?? option.value}
              title={option.title}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex flex-1 items-center justify-center rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A row of icon toggles, e.g. bold / italic / uppercase. */
export function ToggleRow({
  label,
  items,
}: {
  label?: string;
  items: { key: string; icon: React.ReactNode; active: boolean; title: string; onToggle: () => void }[];
}) {
  return (
    <div className="space-y-1.5">
      {label && <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>}
      <div className="flex gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.active}
            aria-label={item.title}
            title={item.title}
            onClick={item.onToggle}
            className={cn(
              "grid size-8 place-items-center rounded-md border transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              item.active
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, precision: number): string {
  return Number.isFinite(value) ? round(value, precision).toString() : "0";
}
