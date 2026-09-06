"use client";

import * as React from "react";
import {
  Image as ImageIcon,
  LayoutTemplate,
  Music4,
  PanelLeftClose,
  Paintbrush,
  Shapes,
  Type,
  Upload,
} from "lucide-react";
import { BACKGROUND_PRESETS, type Background } from "@workspace/motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useEditorStore, type ToolId } from "../../stores/editor-store";
import { Field, InspectorSection, SliderField } from "../inspector/controls";
import { SegmentedField } from "../inspector/controls";
import { ColorPicker } from "../inspector/color-picker";
import { AudioPanel, ElementsPanel, MediaPanel, TemplatesPanel, TextPanel } from "./tool-panels";

/**
 * The left rail and its contextual panel (§11).
 *
 * The rail is always visible so the seven tools stay one click away; clicking
 * the active tool collapses the panel, which is how a user reclaims canvas
 * space without losing their place.
 */

const TOOLS: { id: ToolId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "text", label: "Text", icon: Type },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "elements", label: "Elements", icon: Shapes },
  { id: "audio", label: "Audio", icon: Music4 },
  { id: "background", label: "Background", icon: Paintbrush },
  { id: "uploads", label: "Uploads", icon: Upload },
];

export function ToolRail() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const open = useEditorStore((s) => s.leftPanelOpen);
  const store = useEditorStore.getState;

  return (
    <nav
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-2"
      aria-label="Editor tools"
    >
      {TOOLS.map(({ id, label, icon: Icon }) => {
        const active = activeTool === id && open;
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => {
                    // Clicking the open tool collapses the panel.
                    if (activeTool === id && open) store().setLeftPanelOpen(false);
                    else store().setActiveTool(id);
                  }}
                  className={cn(
                    "group flex size-11 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4.5" />
                  <span className="text-[8.5px] leading-none font-semibold tracking-tight">
                    {label}
                  </span>
                </button>
              }
            />
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={open ? "Collapse panel" : "Expand panel"}
                onClick={() => store().setLeftPanelOpen(!open)}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <PanelLeftClose className={cn("size-4 transition-transform", !open && "rotate-180")} />
              </button>
            }
          />
          <TooltipContent side="right">{open ? "Collapse panel" : "Expand panel"}</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}

/** Renders whichever tool panel is active. */
export function ToolPanel() {
  const activeTool = useEditorStore((s) => s.activeTool);

  switch (activeTool) {
    case "text":
      return <TextPanel />;
    case "elements":
      return <ElementsPanel />;
    case "media":
      return <MediaPanel kind="media" />;
    case "uploads":
      return <MediaPanel kind="uploads" />;
    case "audio":
      return <AudioPanel />;
    case "background":
      return <BackgroundPanel />;
    case "templates":
    default:
      return <TemplatesPanel />;
  }
}

/** The background tool (§11). Mirrors the inspector's background controls so
 *  the setting is reachable whether or not something is selected. */
function BackgroundPanel() {
  const background = useEditorStore((s) => s.document?.background);
  const setBackground = (next: Background) => useEditorStore.getState().setBackground(next);

  if (!background) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border/70 px-4 py-3">
        <h2 className="text-sm font-bold tracking-tight text-foreground">Background</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Sets the base colour behind every layer.
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <InspectorSection title="Presets">
          <div className="grid grid-cols-2 gap-2">
            {BACKGROUND_PRESETS.map((preset) => {
              const active = isSameBackground(preset.background, background);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setBackground(preset.background)}
                  className={cn(
                    "group overflow-hidden rounded-lg border transition-all",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "border-primary ring-2 ring-primary/25" : "border-border/70 hover:border-primary/40",
                  )}
                >
                  <span className="block h-14 w-full" style={{ background: previewCss(preset.background) }} />
                  <span className="block px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </InspectorSection>

        <InspectorSection title="Custom">
          <SegmentedField
            value={background.type === "gradient" ? "gradient" : "solid"}
            onChange={(type) => {
              if (type === "solid") setBackground({ type: "solid", value: "#07060c" });
              else setBackground({ type: "gradient", from: "#2e1065", to: "#07060c", angle: 165 });
            }}
            options={[
              { value: "solid", label: "Solid" },
              { value: "gradient", label: "Gradient" },
            ]}
          />

          {background.type === "solid" && (
            <Field label="Colour">
              <ColorPicker
                label="Background colour"
                value={background.value}
                onChange={(value) => setBackground({ type: "solid", value })}
              />
            </Field>
          )}

          {background.type === "gradient" && (
            <>
              <Field label="From">
                <ColorPicker
                  label="Gradient start"
                  value={background.from}
                  onChange={(from) => setBackground({ ...background, from })}
                />
              </Field>
              <Field label="To">
                <ColorPicker
                  label="Gradient end"
                  value={background.to}
                  onChange={(to) => setBackground({ ...background, to })}
                />
              </Field>
              <SliderField
                label="Angle"
                value={background.angle}
                min={0}
                max={360}
                format={(v) => `${v}°`}
                onChange={(angle) => setBackground({ ...background, angle })}
              />
            </>
          )}
        </InspectorSection>
      </ScrollArea>
    </div>
  );
}

function isSameBackground(a: Background, b: Background): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "solid" && b.type === "solid") return a.value.toLowerCase() === b.value.toLowerCase();
  if (a.type === "gradient" && b.type === "gradient") {
    return a.from.toLowerCase() === b.from.toLowerCase() && a.to.toLowerCase() === b.to.toLowerCase();
  }
  return false;
}

function previewCss(background: Background): string {
  if (background.type === "solid") return background.value;
  if (background.type === "gradient")
    return `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
  return "#000";
}
