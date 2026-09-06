"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  AI_STYLES,
  CANVAS_PRESETS,
  DEFAULT_CANVAS_PRESET_ID,
  type AdvertisementPlan,
  type AiStyle,
  type ProjectDocument,
} from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Slider } from "@workspace/ui/components/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  useCreateProjectMutation,
  useGenerateAdvertisementMutation,
} from "../../api/studio-api";

/**
 * The AI advertisement generator (§36).
 *
 * Two steps on purpose: generate a plan and show it, then create the project.
 * The user sees the copy and scene breakdown the model produced *before*
 * anything is written, and the document itself is compiled server-side by
 * deterministic code — the model never positions a layer.
 */

type Phase = "form" | "generating" | "review" | "creating";

const STYLE_LABELS: Record<AiStyle, string> = {
  modern: "Modern",
  bold: "Bold",
  minimal: "Minimal",
  playful: "Playful",
  elegant: "Elegant",
  technical: "Technical",
};

export function AiGenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [generate] = useGenerateAdvertisementMutation();
  const [createProject] = useCreateProjectMutation();

  const [phase, setPhase] = React.useState<Phase>("form");
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [style, setStyle] = React.useState<AiStyle>("modern");
  const [presetId, setPresetId] = React.useState(DEFAULT_CANVAS_PRESET_ID);
  const [duration, setDuration] = React.useState(10);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    document: ProjectDocument;
    plan: AdvertisementPlan;
    generator: string;
    suggestedName: string;
  } | null>(null);

  React.useEffect(() => {
    if (open) {
      setPhase("form");
      setError(null);
      setResult(null);
    }
  }, [open]);

  const canSubmit = subject.trim().length >= 2 && description.trim().length >= 10;

  const runGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || phase !== "form") return;

    setPhase("generating");
    setError(null);
    try {
      const data = await generate({
        subject: subject.trim(),
        description: description.trim(),
        style,
        preset: presetId,
        duration,
      }).unwrap();
      setResult(data);
      setPhase("review");
    } catch (err) {
      setPhase("form");
      setError(extractMessage(err));
    }
  };

  const acceptPlan = async () => {
    if (!result) return;
    setPhase("creating");
    setError(null);
    try {
      const project = await createProject({
        name: result.suggestedName || subject.trim() || "AI Advertisement",
        canvas: result.document.canvas,
        document: result.document,
      }).unwrap();

      onOpenChange(false);
      router.push(`/editor/${project.id}`);
    } catch (err) {
      setPhase("review");
      setError(extractMessage(err));
    }
  };

  const busy = phase === "generating" || phase === "creating";

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-primary/12 text-primary">
              <Sparkles className="size-3.5" />
            </span>
            Generate with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you&apos;re promoting and we&apos;ll draft a complete, editable
            advertisement.
          </DialogDescription>
        </DialogHeader>

        {result && (phase === "review" || phase === "creating") ? (
          <PlanReview
            plan={result.plan}
            generator={result.generator}
            error={error}
            busy={phase === "creating"}
            onBack={() => setPhase("form")}
            onAccept={() => void acceptPlan()}
          />
        ) : (
          <form onSubmit={runGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ai-subject" className="text-xs">
                What are you promoting?
              </Label>
              <Input
                id="ai-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="College Tech Fest"
                maxLength={120}
                disabled={busy}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-description" className="text-xs">
                Tell us about it
              </Label>
              <Textarea
                id="ai-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Annual technology festival for students. 40+ events, hackathons, robotics and a ₹5L prize pool. 20 September 2026."
                rows={4}
                maxLength={1200}
                disabled={busy}
                className="resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                {description.trim().length < 10
                  ? "A sentence or two works best."
                  : `${description.length} / 1200 characters`}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium">Style</span>
              <div className="flex flex-wrap gap-1.5">
                {AI_STYLES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={busy}
                    onClick={() => setStyle(option)}
                    aria-pressed={style === option}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      style === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {STYLE_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-format" className="text-xs">
                  Platform
                </Label>
                <select
                  id="ai-format"
                  value={presetId}
                  disabled={busy}
                  onChange={(e) => setPresetId(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-transparent px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {CANVAS_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label className="text-xs">Duration</Label>
                  <span className="text-[11px] font-semibold tabular-nums">{duration}s</span>
                </div>
                <div className="flex h-9 items-center">
                  <Slider
                    value={duration}
                    min={5}
                    max={30}
                    step={1}
                    disabled={busy}
                    aria-label="Duration in seconds"
                    onValueChange={(v) => setDuration(Array.isArray(v) ? (v[0] ?? 10) : v)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit || busy} className="min-w-40 gap-1.5">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                {busy ? "Writing your advert…" : "Generate advertisement"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Shows the plan before anything is created, so nothing is a surprise. */
function PlanReview({
  plan,
  generator,
  error,
  busy,
  onBack,
  onAccept,
}: {
  plan: AdvertisementPlan;
  generator: string;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
        <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Headline
        </p>
        <p className="mt-1 text-lg leading-tight font-extrabold tracking-tight text-foreground">
          {plan.headline}
        </p>
        {plan.subheadline && (
          <p className="mt-1 text-xs text-muted-foreground">{plan.subheadline}</p>
        )}

        <div className="mt-3 flex gap-1.5">
          {plan.palette.map((color) => (
            <span
              key={color}
              title={color}
              className="size-5 rounded-md ring-1 ring-inset ring-black/10"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          {plan.scenes.length} scenes
        </p>
        <ol className="space-y-1.5">
          {plan.scenes.map((scene, index) => (
            <li
              key={index}
              className="flex gap-2.5 rounded-md border border-border/70 bg-card px-3 py-2"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-primary/12 text-[10px] font-bold text-primary tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {scene.title}
                </span>
                {scene.body && (
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {scene.body}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
        <span className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          CTA
        </span>
        <span className="text-xs font-semibold text-foreground">{plan.cta}</span>
      </div>

      {generator === "heuristic" && (
        <p className="rounded-md border border-info/25 bg-info/8 px-3 py-2 text-[11px] leading-relaxed text-info">
          Written by the built-in planner — no AI provider is configured on this server. Set
          <code className="mx-1 rounded bg-info/15 px-1 font-mono">OPEN_AI_API_KEY</code>
          to use a language model instead.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onBack}>
          Start over
        </Button>
        <Button size="sm" disabled={busy} onClick={onAccept} className="min-w-36 gap-1.5">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {busy ? "Creating…" : "Open in editor"}
        </Button>
      </div>
    </div>
  );
}

function extractMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { data?: { message?: string } };
    if (err.data?.message) return err.data.message;
  }
  return "We couldn't generate an advertisement. Please try again.";
}
