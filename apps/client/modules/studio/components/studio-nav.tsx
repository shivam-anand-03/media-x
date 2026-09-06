"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { FolderOpen, HelpCircle, LayoutGrid, LayoutTemplate, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { BrandLogo } from "@/components/global/brand-logo";
import { ThemeToggle } from "@/components/global/theme-toggle";
import { ShortcutsDialog } from "./editor/shortcuts-dialog";

/** Workspace navigation (§6). */
const LINKS = [
  { href: "/dashboard", label: "Projects", icon: LayoutGrid },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/assets", label: "Assets", icon: FolderOpen },
];

export function StudioNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = React.useState(false);



  return (
    <TooltipProvider delay={400}>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLogo />

          <nav aria-label="Workspace" className="ml-4 hidden items-center gap-0.5 sm:flex">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Search projects"
                    className="text-muted-foreground"
                    onClick={() => router.push("/dashboard")}
                  >
                    <Search className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Search projects</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Keyboard shortcuts"
                    className="text-muted-foreground"
                    onClick={() => setHelpOpen(true)}
                  >
                    <HelpCircle className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Keyboard shortcuts</TooltipContent>
            </Tooltip>

            <ThemeToggle className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />

          </div>
        </div>

        {/* Mobile nav */}
        <nav aria-label="Workspace" className="flex gap-1 border-t border-border/60 px-4 py-1.5 sm:hidden">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </TooltipProvider>
  );
}
