"use client";

import * as React from "react";
import { MonitorSmartphone } from "lucide-react";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../../stores/editor-store";
import { useAutosave } from "../../hooks/use-autosave";
import { useAudioPlayback, usePlaybackClock } from "../../hooks/use-playback";
import { useKeyboardShortcuts } from "../../hooks/use-keyboard-shortcuts";
import { usePersistedLayout } from "../../hooks/use-persisted-layout";
import { useThumbnailCapture } from "../../hooks/use-thumbnail";
import { ToolPanel, ToolRail } from "../panels/tool-rail";
import { CanvasWorkspace } from "../canvas/canvas-workspace";
import { PropertiesPanel } from "../inspector/properties-panel";
import { LayerPanel } from "../layers/layer-panel";
import { Timeline } from "../timeline/timeline";
import { EditorToolbar } from "./editor-toolbar";
import { PreviewModal } from "./preview-modal";
import { ExportDialog } from "./export-dialog";
import { ShortcutsDialog } from "./shortcuts-dialog";

/**
 * The editor shell (§9).
 *
 * Owns the layout and the three cross-cutting concerns every panel depends on:
 * the playback clock, autosave, and keyboard shortcuts. Panel sizes are
 * remembered per browser (see `usePersistedLayout`).
 */
export function EditorShell() {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  const doc = useEditorStore((s) => s.document);
  const projectId = useEditorStore((s) => s.projectId);
  const leftPanelOpen = useEditorStore((s) => s.leftPanelOpen);

  usePlaybackClock();
  useAudioPlayback(!previewOpen);
  const { saveNow } = useAutosave();

  const verticalLayout = usePersistedLayout("vertical");
  const horizontalLayout = usePersistedLayout("horizontal");
  const { capture } = useThumbnailCapture();

  // Refresh the dashboard poster frame periodically while the project has
  // content, and once more on the way out. Throttled inside the hook.
  React.useEffect(() => {
    const timer = setInterval(() => {
      if ((useEditorStore.getState().document?.layers.length ?? 0) > 0) void capture();
    }, 60_000);
    return () => {
      clearInterval(timer);
      if ((useEditorStore.getState().document?.layers.length ?? 0) > 0) {
        void capture({ force: true });
      }
    };
  }, [capture]);

  const handlers = React.useMemo(
    () => ({
      onSave: () => void saveNow(),
      onPreview: () => setPreviewOpen(true),
      onExport: () => setExportOpen(true),
      onShowShortcuts: () => setShortcutsOpen(true),
    }),
    [saveNow],
  );

  // Shortcuts are suspended while a modal owns the keyboard.
  useKeyboardShortcuts(handlers, !previewOpen && !exportOpen && !shortcutsOpen);

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <EditorToolbar
          onSave={handlers.onSave}
          onPreview={handlers.onPreview}
          onExport={handlers.onExport}
          onShowShortcuts={handlers.onShowShortcuts}
        />

        <ResizablePanelGroup
          orientation="vertical"
          className="min-h-0 flex-1"
          defaultLayout={verticalLayout.defaultLayout}
          onLayoutChanged={verticalLayout.onLayoutChanged}
        >
          {/* ---- Upper: tools | canvas | inspector ---- */}
          <ResizablePanel id="stage" defaultSize="68%" minSize="35%">
            <div className="flex h-full min-h-0">
              <ToolRail />

              <ResizablePanelGroup
                orientation="horizontal"
                className="min-w-0 flex-1"
                defaultLayout={horizontalLayout.defaultLayout}
                onLayoutChanged={horizontalLayout.onLayoutChanged}
              >
                {leftPanelOpen && (
                  <>
                    <ResizablePanel id="tools" defaultSize="20%" minSize="180px" maxSize="34%" className="bg-card">
                      <ToolPanel />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                  </>
                )}

                <ResizablePanel id="canvas" defaultSize="56%" minSize="30%">
                  <CanvasWorkspace className="h-full" />
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel id="inspector" defaultSize="24%" minSize="240px" maxSize="34%">
                  <div className="flex h-full min-h-0 flex-col border-l border-border bg-card">
                    <PropertiesPanel className="min-h-0 flex-1" />
                    <LayerPanel className="h-56 shrink-0 border-t border-border" />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ---- Lower: timeline ---- */}
          <ResizablePanel id="timeline" defaultSize="32%" minSize="160px" maxSize="60%">
            <Timeline className="h-full" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} document={doc} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projectId={projectId}
        document={doc}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </TooltipProvider>
  );
}

/**
 * Small-screen guard (§41).
 *
 * The editor needs real estate for precise work, so below `lg` it offers an
 * honest explanation and a way through rather than a cramped, broken layout.
 */
export function SmallScreenGate({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = React.useState(false);

  return (
    <>
      <div className={cn("hidden lg:block", override && "block")}>{children}</div>

      <div className={cn("flex min-h-screen items-center justify-center p-6 lg:hidden", override && "hidden")}>
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <MonitorSmartphone className="size-6" />
          </span>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Best experienced on a larger screen
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The motion graphics editor needs a wider workspace for precise editing — the canvas,
            timeline and inspector all need room to work side by side.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => setOverride(true)}>
            Continue anyway
          </Button>
        </div>
      </div>
    </>
  );
}
