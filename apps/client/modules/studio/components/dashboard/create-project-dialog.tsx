"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  CANVAS_PRESETS,
  DEFAULT_CANVAS_PRESET_ID,
  type CanvasPreset,
  type ProjectDocument,
} from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { useCreateProjectMutation } from "../../api/studio-api";
import { AiGenerateDialog } from "./ai-generate-dialog";

/**
 * The create-project flow (§7).
 *
 * A format is picked first because it determines everything downstream — the
 * canvas, the default duration and how templates get rescaled. The aspect-ratio
 * previews are drawn to scale so "9:16" is something you can see rather than
 * something you have to parse.
 */

type Phase = "idle" | "creating" | "created";

export function CreateProjectDialog({
  open,
  onOpenChange,
  /** Pre-seed from a template or an AI generation. */
  seed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed?: { name?: string; templateSlug?: string; document?: ProjectDocument };
}) {
  const router = useRouter();
  const [createProject] = useCreateProjectMutation();

  const [presetId, setPresetId] = React.useState(DEFAULT_CANVAS_PRESET_ID);
  const [name, setName] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [aiOpen, setAiOpen] = React.useState(false);

  // Reset per opening so a previous attempt's error or name never leaks in.
  React.useEffect(() => {
    if (open) {
      setName(seed?.name ?? "");
      setPhase("idle");
      setError(null);
      // A seeded document brings its own canvas; match the preset to it.
      if (seed?.document) {
        const match = CANVAS_PRESETS.find(
          (p) => p.width === seed.document!.canvas.width && p.height === seed.document!.canvas.height,
        );
        if (match) setPresetId(match.id);
      }
    }
  }, [open, seed]);

  const preset = CANVAS_PRESETS.find((p) => p.id === presetId) ?? CANVAS_PRESETS[0]!;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (phase !== "idle") return;

    setPhase("creating");
    setError(null);

    try {
      const project = await createProject({
        name: name.trim() || "Untitled Advertisement",
        canvas: {
          width: preset.width,
          height: preset.height,
          fps: preset.fps,
          duration: seed?.document?.canvas.duration ?? preset.duration,
        },
        templateSlug: seed?.templateSlug,
        document: seed?.document,
      }).unwrap();

      // Brief "Created" state so the morph reads as completion (§37).
      setPhase("created");
      setTimeout(() => {
        onOpenChange(false);
        router.push(`/editor/${project.id}`);
      }, 450);
    } catch (err) {
      setPhase("idle");
      setError(extractMessage(err));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => phase === "idle" && onOpenChange(next)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create advertisement</DialogTitle>
            <DialogDescription>
              Pick a format to start from. You can change it later without losing your work.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <fieldset>
              <legend className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Format
              </legend>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {CANVAS_PRESETS.map((option) => (
                  <PresetTile
                    key={option.id}
                    preset={option}
                    selected={option.id === presetId}
                    onSelect={() => setPresetId(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs">
                Project name
              </Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled Advertisement"
                maxLength={120}
                autoComplete="off"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-primary hover:text-primary"
                onClick={() => {
                  onOpenChange(false);
                  setAiOpen(true);
                }}
              >
                <Sparkles className="size-3.5" />
                Generate with AI
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={phase !== "idle"}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={phase !== "idle"} className="min-w-32 gap-1.5">
                  {phase === "creating" && <Loader2 className="size-3.5 animate-spin" />}
                  {phase === "created" && <Check className="size-3.5" />}
                  {phase === "idle" ? "Create project" : phase === "creating" ? "Creating…" : "Created"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AiGenerateDialog open={aiOpen} onOpenChange={setAiOpen} />
    </>
  );
}

/** A format tile with a to-scale aspect preview. */
function PresetTile({
  preset,
  selected,
  onSelect,
}: {
  preset: CanvasPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  // Normalise every preview into a 44px box so ratios are visually comparable.
  const BOX = 44;
  const ratio = preset.width / preset.height;
  const w = ratio >= 1 ? BOX : BOX * ratio;
  const h = ratio >= 1 ? BOX / ratio : BOX;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-2.5 transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/8 ring-1 ring-primary/25"
          : "border-border/70 hover:border-primary/40 hover:bg-muted/50",
      )}
    >
      <span className="grid h-11 place-items-center">
        <span
          className={cn(
            "block rounded-[3px] transition-colors",
            selected ? "bg-primary" : "bg-muted-foreground/35",
          )}
          style={{ width: w, height: h }}
        />
      </span>
      <span className="text-center">
        <span className={cn("block text-[10px] font-semibold leading-tight", selected ? "text-primary" : "text-foreground")}>
          {preset.label}
        </span>
        <span className="mt-0.5 block text-[9px] text-muted-foreground tabular-nums">{preset.ratio}</span>
      </span>
    </button>
  );
}

function extractMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { data?: { message?: string } };
    if (err.data?.message) return err.data.message;
  }
  return "We couldn't create the project. Please try again.";
}
