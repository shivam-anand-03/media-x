"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clapperboard,
  Film,
  LayoutTemplate,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { PageHeader, PremiumEmptyState, StatTile } from "@/components/premium";
import { useUser } from "@/hooks/use-user";
import {
  useDeleteProjectMutation,
  useDuplicateProjectMutation,
  useListProjectsQuery,
  useListTemplatesQuery,
  useUpdateProjectMutation,
  type ProjectSummary,
} from "../api/studio-api";
import { ProjectCard, ProjectCardSkeleton } from "../components/dashboard/project-card";
import { CreateProjectDialog } from "../components/dashboard/create-project-dialog";
import { AiGenerateDialog } from "../components/dashboard/ai-generate-dialog";

/**
 * The workspace dashboard (§6).
 *
 * Greeting, one clear primary action, then the user's work. The metric strip
 * reports counts derived from the real project list — never invented numbers.
 */
export function DashboardView() {
  const router = useRouter();
  const { user } = useUser();

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [renaming, setRenaming] = React.useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = React.useState<ProjectSummary | null>(null);

  // Debounce so typing doesn't fire a request per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch, isFetching } = useListProjectsQuery({
    limit: 24,
    search: debounced || undefined,
  });
  const { data: templateData } = useListTemplatesQuery({ featured: true });

  const [deleteProject] = useDeleteProjectMutation();
  const [duplicateProject] = useDuplicateProjectMutation();
  const [updateProject] = useUpdateProjectMutation();

  const projects = data?.items ?? [];
  const total = data?.total ?? 0;
  const exported = projects.filter((p) => p.status === "EXPORTED").length;

  const firstName = user?.firstName?.trim() || "there";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={
          <>
            <Clapperboard className="size-3" />
            Motion Studio
          </>
        }
        title={`${greeting()}, ${firstName}`}
        description="Create something amazing. Design, animate and export short-form advertisements in one workspace."
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => setAiOpen(true)}>
              <Sparkles className="size-4" />
              Generate with AI
            </Button>
            <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create advertisement
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Projects" value={String(total)} icon={Film} />
          <StatTile label="Exported" value={String(exported)} icon={Clapperboard} />
          <StatTile label="Templates" value={String(templateData?.items.length ?? 0)} icon={LayoutTemplate} />
          <StatTile
            label="Last edited"
            value={projects[0] ? shortTime(projects[0].updatedAt) : "—"}
            icon={Sparkles}
          />
        </div>
      </PageHeader>

      {/* ---- Recent projects ---- */}
      <section aria-labelledby="recent-projects">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-projects" className="text-lg font-bold tracking-tight text-foreground">
            Recent projects
          </h2>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="h-9 pl-8 text-xs"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : projects.length === 0 ? (
          debounced ? (
            <PremiumEmptyState
              quiet
              icon={Search}
              title={`No projects match “${debounced}”`}
              description="Try a different search, or create something new."
              action={
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <PremiumEmptyState
              icon={Film}
              title="No projects yet"
              description="Create your first advertisement and bring your idea to life."
              action={
                <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" />
                  Create advertisement
                </Button>
              }
            />
          )
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
              // Dim while a background refetch is in flight, rather than
              // swapping the grid for skeletons and losing scroll position.
              isFetching && "opacity-60",
            )}
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={setRenaming}
                onDelete={setDeleting}
                onDuplicate={async (p) => {
                  const copy = await duplicateProject(p.id).unwrap();
                  router.push(`/editor/${copy.id}`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- Start from a template ---- */}
      {templateData && templateData.items.length > 0 && (
        <section aria-labelledby="featured-templates">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="featured-templates" className="text-lg font-bold tracking-tight text-foreground">
              Start from a template
            </h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/templates")}>
              Browse all
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {templateData.items.slice(0, 5).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => router.push(`/templates?use=${template.slug}`)}
                className="group overflow-hidden rounded-xl border border-border/70 bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  className="flex aspect-[4/5] items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${template.accent[0] ?? "#d4af37"}, ${template.accent[1] ?? "#1a1408"})`,
                  }}
                >
                  <span className="text-[10px] font-bold tracking-[0.16em] text-white/80 uppercase">
                    {template.sceneCount} scenes
                  </span>
                </span>
                <span className="block p-2.5">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {template.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground tabular-nums">
                    {template.duration}s · {template.category}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AiGenerateDialog open={aiOpen} onOpenChange={setAiOpen} />

      <RenameDialog
        project={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (renaming) await updateProject({ id: renaming.id, name }).unwrap();
          setRenaming(null);
        }}
      />

      <DeleteDialog
        project={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteProject(deleting.id).unwrap();
          setDeleting(null);
        }}
      />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/6 p-8 text-center">
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-destructive/12 text-destructive">
        <AlertCircle className="size-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">We couldn&apos;t load your projects</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Your work is safe — this is only a problem fetching the list. Check your connection and try
        again.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function RenameDialog({
  project,
  onClose,
  onSave,
}: {
  project: ProjectSummary | null;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (project) setName(project.name);
  }, [project]);

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await onSave(name.trim() || project!.name);
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  project,
  onClose,
  onConfirm,
}: {
  project: ProjectSummary | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = React.useState(false);

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete “{project?.name}”?</DialogTitle>
          <DialogDescription>
            This permanently removes the project and its export history. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await onConfirm();
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function shortTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}
