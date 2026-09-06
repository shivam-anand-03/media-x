import React from "react";
import { ThemeToggle } from "@/components/global/theme-toggle";
import { Link } from "next-view-transitions";
import Image from "next/image";
import { logoIcon } from "@/const";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background text-foreground transition-colors duration-500 overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Dynamic Background Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* SVG Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70"></div>

        {/* Floating Ambient Blobs */}
        <div className="absolute top-[-10%] left-[-10%] h-125 w-125 rounded-full bg-purple-400/20 dark:bg-purple-600/15 blur-[120px] animate-float-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-150 w-150 rounded-full bg-cyan-300/25 dark:bg-blue-600/15 blur-[130px] animate-float-medium"></div>
        <div className="absolute top-[30%] right-[20%] h-100 w-100 rounded-full bg-pink-300/20 dark:bg-fuchsia-600/10 blur-[110px] animate-float-reverse"></div>
      </div>

      {/* Floating Header Actions */}
      <div className="absolute top-6 left-6 right-6 z-50 flex items-center justify-between pointer-events-none">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-2 group transition-all duration-300"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-all group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-900">
            <Image
              src={logoIcon}
              alt="Upgence"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            Upgence
          </span>
        </Link>

        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-950/60 p-1.5 backdrop-blur-md shadow-sm">
          <ThemeToggle className="text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors p-2" />
        </div>
      </div>

      <div className="relative z-10 w-full flex items-center justify-center pt-28 pb-12 sm:py-20">
        {children}
      </div>
    </main>
  );
};

export default Layout;
