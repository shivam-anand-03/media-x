"use client";

import * as React from "react";
import { Check, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Slider } from "@workspace/ui/components/slider";
import { useEditorStore, selectProjectColors } from "../../stores/editor-store";

/**
 * The colour picker (§23).
 *
 * An HSV square plus hue and alpha rails, with HEX/RGB/HSL readouts and two
 * palettes: colours already used in this project, and the user's recent picks.
 * Recents are per-browser (localStorage) because they are a personal
 * convenience, not part of the document.
 */

const RECENTS_KEY = "motion-studio:recent-colors";
const MAX_RECENTS = 12;

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired once when the user stops dragging, to close a history group. */
  onCommit?: () => void;
  label: string;
  /** Allow clearing to "no colour" — used for optional fills. */
  allowClear?: boolean;
  onClear?: () => void;
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  onCommit,
  label,
  allowClear,
  onClear,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const projectColors = useEditorStore(selectProjectColors);
  const [recents, setRecents] = React.useState<string[]>([]);

  React.useEffect(() => {
    setRecents(readRecents());
  }, []);

  const pushRecent = React.useCallback((hex: string) => {
    setRecents((current) => {
      const next = [hex.toLowerCase(), ...current.filter((c) => c !== hex.toLowerCase())].slice(0, MAX_RECENTS);
      writeRecents(next);
      return next;
    });
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      pushRecent(value);
      onCommit?.();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value}`}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2 text-left transition-colors hover:border-primary/40",
            "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            className,
          )}
        >
          <Swatch color={value} className="size-4 shrink-0" />
          <span className="font-mono text-[11px] text-foreground uppercase">{value}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-3">
        <ColorPickerBody
          value={value}
          onChange={onChange}
          projectColors={projectColors}
          recents={recents}
          allowClear={allowClear}
          onClear={() => {
            onClear?.();
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ColorPickerBody({
  value,
  onChange,
  projectColors,
  recents,
  allowClear,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  projectColors: string[];
  recents: string[];
  allowClear?: boolean;
  onClear: () => void;
}) {
  const { h, s, v, a } = React.useMemo(() => hexToHsva(value), [value]);
  const [hexDraft, setHexDraft] = React.useState<string | null>(null);

  const emit = (next: { h?: number; s?: number; v?: number; a?: number }) => {
    onChange(hsvaToHex({ h: next.h ?? h, s: next.s ?? s, v: next.v ?? v, a: next.a ?? a }));
  };

  const rgb = hexToRgb(value);
  const hsl = hsvToHsl(h, s, v);

  return (
    <div className="space-y-3">
      {/* Saturation / value square. */}
      <SaturationSquare hue={h} s={s} v={v} onChange={(ns, nv) => emit({ s: ns, v: nv })} />

      <div className="flex items-center gap-2">
        <Swatch color={value} className="size-8 shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Slider
            value={h}
            min={0}
            max={359}
            step={1}
            aria-label="Hue"
            onValueChange={(next) => emit({ h: Array.isArray(next) ? (next[0] ?? 0) : next })}
            className="[&_[data-slot=slider-track]]:bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] [&_[data-slot=slider-range]]:bg-transparent"
          />
          <Slider
            value={Math.round(a * 100)}
            min={0}
            max={100}
            step={1}
            aria-label="Opacity"
            onValueChange={(next) => emit({ a: (Array.isArray(next) ? (next[0] ?? 100) : next) / 100 })}
            className="[&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-track]]:bg-[linear-gradient(to_right,transparent,currentColor)]"
            style={{ color: stripAlpha(value) }}
          />
        </div>
      </div>

      {/* HEX + RGB + HSL readouts. */}
      <div className="space-y-2">
        <Input
          value={hexDraft ?? value.toUpperCase()}
          aria-label="Hex colour"
          spellCheck={false}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => {
            if (hexDraft && isValidHex(normalizeHex(hexDraft))) onChange(normalizeHex(hexDraft));
            setHexDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setHexDraft(null);
            e.stopPropagation();
          }}
          className="h-8 font-mono text-[11px] uppercase"
        />
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <p className="truncate rounded border border-border/70 bg-muted/40 px-2 py-1 tabular-nums">
            RGB {rgb.r}, {rgb.g}, {rgb.b}
          </p>
          <p className="truncate rounded border border-border/70 bg-muted/40 px-2 py-1 tabular-nums">
            HSL {Math.round(hsl.h)}°, {Math.round(hsl.s)}%, {Math.round(hsl.l)}%
          </p>
        </div>
      </div>

      {projectColors.length > 0 && (
        <Palette
          title="Project colours"
          colors={projectColors}
          current={value}
          onPick={onChange}
        />
      )}

      {recents.length > 0 && (
        <Palette title="Recent" colors={recents} current={value} onPick={onChange} />
      )}

      <Palette title="Presets" colors={PRESET_COLORS} current={value} onPick={onChange} />

      {allowClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pipette className="size-3" />
          Remove colour
        </button>
      )}
    </div>
  );
}

/** The saturation/value gradient square. */
function SaturationSquare({
  hue,
  s,
  v,
  onChange,
}: {
  hue: number;
  s: number;
  v: number;
  onChange: (s: number, v: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const update = React.useCallback(
    (clientX: number, clientY: number) => {
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const nextS = clamp01((clientX - rect.left) / rect.width);
      // The square's vertical axis is inverted: top is full value.
      const nextV = 1 - clamp01((clientY - rect.top) / rect.height);
      onChange(nextS, nextV);
    },
    [onChange],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    update(event.clientX, event.clientY);
    const onMove = (e: PointerEvent) => update(e.clientX, e.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Saturation and brightness"
      onPointerDown={onPointerDown}
      className="relative h-32 w-full cursor-crosshair rounded-md border border-border"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
      />
    </div>
  );
}

function Palette({
  title,
  colors,
  current,
  onPick,
}: {
  title: string;
  colors: readonly string[];
  current: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((color) => {
          const active = color.toLowerCase() === current.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              title={color}
              onClick={() => onPick(color)}
              className={cn(
                "relative grid size-5 place-items-center rounded-[5px] ring-1 ring-inset ring-black/10 transition-transform hover:scale-110",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active && "ring-2 ring-primary",
              )}
              style={{ background: color }}
            >
              {active && <Check className="size-3 text-white mix-blend-difference" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("rounded ring-1 ring-inset ring-black/15", className)}
      style={{
        // Checkerboard shows through for translucent colours.
        backgroundImage: `linear-gradient(${color}, ${color}), conic-gradient(#ccc 0 25%, #fff 0 50%, #ccc 0 75%, #fff 0)`,
        backgroundSize: "100% 100%, 8px 8px",
      }}
    />
  );
}

const PRESET_COLORS = [
  "#ffffff", "#e5e5e5", "#a3a3a3", "#525252", "#0a0a0a",
  "#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f43f5e",
] as const;

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function isValidHex(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function normalizeHex(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function expand(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

function stripAlpha(hex: string): string {
  return expand(hex).slice(0, 7);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const full = expand(hex);
  const r = parseInt(full.slice(1, 3), 16) || 0;
  const g = parseInt(full.slice(3, 5), 16) || 0;
  const b = parseInt(full.slice(5, 7), 16) || 0;
  const a = full.length === 9 ? (parseInt(full.slice(7, 9), 16) || 0) / 255 : 1;
  return { r, g, b, a };
}

function hexToHsva(hex: string): { h: number; s: number; v: number; a: number } {
  const { r, g, b, a } = hexToRgb(hex);
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / delta + 2);
    else h = 60 * ((rr - gg) / delta + 4);
  }
  if (h < 0) h += 360;

  return { h, s: max === 0 ? 0 : delta / max, v: max, a };
}

function hsvaToHex({ h, s, v, a }: { h: number; s: number; v: number; a: number }): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  const [r1, g1, b1] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  const base = `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
  // Only carry an alpha channel when the colour is actually translucent, so
  // fully-opaque colours stay in the friendlier 6-digit form.
  if (a >= 0.999) return base;
  return `${base}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}

function hsvToHsl(h: number, s: number, v: number): { h: number; s: number; l: number } {
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s: sl * 100, l: l * 100 };
}

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    // Private mode or blocked storage — recents are a nicety, not a feature.
    return [];
  }
}

function writeRecents(colors: string[]): void {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(colors));
  } catch {
    // Ignore: failing to remember a swatch must never break the picker.
  }
}
