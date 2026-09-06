"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Kbd } from "@workspace/ui/components/kbd";
import { SHORTCUT_GROUPS } from "../../hooks/use-keyboard-shortcuts";

/** The keyboard shortcut reference (§24). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Show the right modifier glyph for the platform rather than always "Ctrl".
  const [modKey, setModKey] = React.useState("Ctrl");
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setModKey("⌘");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster without leaving the canvas.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label + item.keys.join()} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <Kbd key={key}>{key === "Mod" ? modKey : key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
