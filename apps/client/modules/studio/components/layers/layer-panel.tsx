"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Music4,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Video,
  Wand2,
} from "lucide-react";
import type { Layer } from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { PremiumEmptyState } from "@/components/premium";
import { useEditorStore } from "../../stores/editor-store";

/**
 * The layer panel (§16) — the answer to "what exists?".
 *
 * Rows are ordered front-to-back to match the timeline and how designers read
 * a stack. Every row reads and writes the same document the canvas does, so
 * renaming here renames on the timeline, and hiding here hides on the canvas.
 */

const TYPE_ICON: Record<Layer["type"], React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  video: Video,
  shape: Shapes,
  icon: Sparkles,
  gradient: Wand2,
};

export function LayerPanel({ className }: { className?: string }) {
  const layers = useEditorStore((s) => s.document?.layers);
  const audioTracks = useEditorStore((s) => s.document?.audioTracks);
  const selectedIds = useEditorStore((s) => s.selectedLayerIds);

  const ordered = React.useMemo(
    () => (layers ? [...layers].sort((a, b) => b.zIndex - a.zIndex) : []),
    [layers],
  );

  const store = useEditorStore.getState;
  const hasSelection = selectedIds.length > 0;

  return (
    <section className={cn("flex min-h-0 flex-col", className)} aria-label="Layers">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-border/70 px-3">
        <h2 className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Layers
        </h2>
        <div className="flex items-center gap-0.5">
          <IconAction
            label="Bring forward"
            disabled={!hasSelection}
            onClick={() => store().reorderSelectedLayers("forward")}
          >
            <ArrowUp className="size-3.5" />
          </IconAction>
          <IconAction
            label="Send backward"
            disabled={!hasSelection}
            onClick={() => store().reorderSelectedLayers("backward")}
          >
            <ArrowDown className="size-3.5" />
          </IconAction>
          <IconAction
            label="Duplicate"
            disabled={!hasSelection}
            onClick={() => store().duplicateSelectedLayers()}
          >
            <Copy className="size-3.5" />
          </IconAction>
          <IconAction
            label="Delete"
            disabled={!hasSelection}
            destructive
            onClick={() => store().removeSelectedLayers()}
          >
            <Trash2 className="size-3.5" />
          </IconAction>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {ordered.length === 0 && !audioTracks?.length ? (
          <PremiumEmptyState
            quiet
            icon={Shapes}
            title="No layers yet"
            description="Add text, media or an element from the tools on the left."
            className="py-10"
          />
        ) : (
          <ul className="p-1.5">
            {ordered.map((layer) => (
              <LayerRow key={layer.id} layer={layer} />
            ))}
            {audioTracks?.map((track) => (
              <AudioRow key={track.id} id={track.id} name={track.name} muted={track.muted} />
            ))}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}

function LayerRow({ layer }: { layer: Layer }) {
  const selected = useEditorStore((s) => s.selectedLayerIds.includes(layer.id));
  const [renaming, setRenaming] = React.useState(false);
  const Icon = TYPE_ICON[layer.type];
  const store = useEditorStore.getState;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
          selected ? "bg-primary/12 ring-1 ring-primary/25" : "hover:bg-muted/60",
          layer.hidden && "opacity-50",
        )}
      >
        <button
          type="button"
          onClick={(event) =>
            store().selectLayer(layer.id, {
              additive: event.shiftKey || event.metaKey || event.ctrlKey,
            })
          }
          onDoubleClick={() => setRenaming(true)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-current={selected}
        >
          <Icon className={cn("size-3.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />

          {renaming ? (
            <input
              autoFocus
              defaultValue={layer.name}
              aria-label="Rename layer"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                store().renameLayer(layer.id, e.target.value);
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-full min-w-0 rounded border border-primary/50 bg-card px-1 py-0.5 text-[11px] outline-none"
            />
          ) : (
            <span
              className={cn(
                "truncate text-[11px] font-medium",
                selected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {layer.name}
            </span>
          )}
        </button>

        {/* Controls stay visible for locked/hidden layers so the state is
            always reversible without hunting for a hover target. */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity",
            layer.hidden || layer.locked || selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          <RowToggle
            label={layer.hidden ? "Show layer" : "Hide layer"}
            active={layer.hidden}
            onClick={() => store().toggleLayerVisibility(layer.id)}
          >
            {layer.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </RowToggle>
          <RowToggle
            label={layer.locked ? "Unlock layer" : "Lock layer"}
            active={layer.locked}
            onClick={() => store().toggleLayerLock(layer.id)}
          >
            {layer.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
          </RowToggle>
        </div>
      </div>
    </li>
  );
}

function AudioRow({ id, name, muted }: { id: string; name: string; muted: boolean }) {
  const selected = useEditorStore((s) => s.selectedAudioId === id);
  return (
    <li>
      <button
        type="button"
        onClick={() => useEditorStore.getState().selectAudio(id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          selected ? "bg-primary/12 ring-1 ring-primary/25" : "hover:bg-muted/60",
          muted && "opacity-50",
        )}
      >
        <Music4 className={cn("size-3.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
        <span
          className={cn(
            "truncate text-[11px] font-medium",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {name}
        </span>
      </button>
    </li>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            className={cn("text-muted-foreground", destructive && "hover:text-destructive")}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RowToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-5 place-items-center rounded transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
