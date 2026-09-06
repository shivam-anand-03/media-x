"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, LayoutTemplate, Loader2, Play, Search, Sparkles } from "lucide-react";
import { TEMPLATE_CATEGORIES, type ProjectDocument } from "@workspace/motion";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeader, PremiumEmptyState } from "@/components/premium";
import {
  useLazyGetTemplateQuery,
  useListTemplatesQuery,
  type TemplateSummary,
} from "../api/studio-api";
import { CreateProjectDialog } from "../components/dashboard/create-project-dialog";
import { PreviewModal } from "../components/editor/preview-modal";

/**
 * The template browser (§8).
 *
 * Full template documents are only fetched when a card is actually previewed or
 * used — the grid renders from lightweight summaries, so opening this page
 * doesn't download ten complete projects.
 */
export function TemplatesView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [category, setCategory] = React.useState<string>("Featured");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [previewDoc, setPreviewDoc] = React.useState<ProjectDocument | null>(null);
  const [pendingSlug, setPendingSlug] = React.useState<string | null>(null);
  const [seed, setSeed] = React.useState<{ name: string; templateSlug: string } | null>(null);

  const [fetchTemplate] = useLazyGetTemplateQuery();

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch } = useListTemplatesQuery({
    category: category === "Featured" ? undefined : category,
    featured: category === "Featured" || undefined,
    search: debounced || undefined,
  });

  const templates = data?.items ?? [];

  // Deep link: /templates?use=slug opens the create dialog straight away.
  React.useEffect(() => {
    const slug = searchParams.get("use");
    if (!slug || !templates.length) return;
    const match = templates.find((t) => t.slug === slug);
    if (match) setSeed({ name: match.name, templateSlug: match.slug });
  }, [searchParams, templates]);

  const preview = async (template: TemplateSummary) => {
    setPendingSlug(template.slug);
    try {
      const full = await fetchTemplate(template.slug).unwrap();
      setPreviewDoc(full.projectData);
    } catch {
      // The card keeps its normal state; nothing was destroyed.
    } finally {
      setPendingSlug(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={
          <>
            <LayoutTemplate className="size-3" />
            Templates
          </>
        }
        title="Start from a template"
        description="Every template is a real, editable project — open one and change anything."
        actions={
          <Button variant="outline" className="gap-1.5" onClick={() => router.push("/dashboard")}>
            Back to workspace
          </Button>
        }
      />

      {/* ---- Filters ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TEMPLATE_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              aria-pressed={category === option}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                category === option
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="relative w-full shrink-0 sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ---- Grid ---- */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border/70">
              <Skeleton className="aspect-[4/5]" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/6 p-8 text-center">
          <AlertCircle className="mx-auto mb-2 size-6 text-destructive" />
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load templates</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <PremiumEmptyState
          icon={Search}
          title="No templates here yet"
          description={
            debounced
              ? `Nothing matches “${debounced}”. Try another search or category.`
              : "Try a different category."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              busy={pendingSlug === template.slug}
              onPreview={() => void preview(template)}
              onUse={() => setSeed({ name: template.name, templateSlug: template.slug })}
            />
          ))}
        </div>
      )}

      <PreviewModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />

      <CreateProjectDialog
        open={Boolean(seed)}
        onOpenChange={(open) => !open && setSeed(null)}
        seed={seed ?? undefined}
      />
    </div>
  );
}

function TemplateCard({
  template,
  busy,
  onPreview,
  onUse,
}: {
  template: TemplateSummary;
  busy: boolean;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_2px_4px_color-mix(in_oklab,var(--foreground)_5%,transparent),0_18px_40px_-20px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
      <div
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${template.accent[0] ?? "#d4af37"}, ${template.accent[1] ?? "#1a1408"})`,
        }}
      >
        {/* A scene strip stands in for a bitmap thumbnail and communicates the
            template's structure at a glance. */}
        <div className="flex w-full flex-col items-center gap-2 px-4">
          <Sparkles className="size-5 text-white/70" />
          <div className="flex w-full gap-1">
            {Array.from({ length: Math.min(template.sceneCount, 5) }).map((_, i) => (
              <span key={i} className="h-1 flex-1 rounded-full bg-white/35" />
            ))}
          </div>
        </div>

        {/* Hover actions (§8). */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <Button size="sm" className="w-28 gap-1.5" onClick={onUse}>
            Use template
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-28 gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={onPreview}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Preview
          </Button>
        </div>

        <span className="absolute top-2 left-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/90 backdrop-blur-sm">
          {template.duration}s
        </span>
      </div>

      <div className="p-3">
        <h3 className="truncate text-xs font-semibold text-foreground">{template.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
          {template.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {template.category}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground tabular-nums">
            {template.sceneCount} scenes
          </span>
        </div>
      </div>
    </article>
  );
}
