import { authImage } from "@/const";
import Image from "next/image";
import React from "react";

const AuthCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={className}>
      {children}
      {/* RIGHT SIDE GRAPHIC AREA */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 m-2 overflow-hidden rounded-[1.75rem] bg-slate-950 text-white min-h-145">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.3),transparent_60%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.2),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px]"></div>

        {/* Background Image with overlay */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none">
          <Image
            src={authImage}
            alt="Auth Background"
            fill
            priority
            className="object-cover"
          />
        </div>

        {/* Top brand icon */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur-md shadow-inner">
            <span className="text-base font-bold text-white bg-clip-text">
              E
            </span>
          </div>
          <div>
            <span className="text-xs font-bold tracking-wider uppercase text-purple-300 block">
              EssentoLabs
            </span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">
              Fullstack Monorepo Starter
            </span>
          </div>
        </div>

        {/* Middle interactive statistics widget */}
        <div className="relative z-10 my-auto py-12 flex flex-col items-center">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs text-slate-400">Total Active Users</p>
                <h4 className="text-3xl font-extrabold text-white mt-1 tracking-tight">
                  24,580
                </h4>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                +32.4%
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-350">System Performance</span>
                  <span className="font-semibold text-purple-400">
                    99.98% Uptime
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[96%] rounded-full bg-linear-to-r from-purple-500 via-fuchsia-500 to-cyan-400"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                <div>
                  <span className="text-slate-450 text-[10px] block uppercase font-medium">
                    API Speed
                  </span>
                  <span className="font-bold text-slate-200 text-sm">
                    42ms
                  </span>
                </div>
                <div>
                  <span className="text-slate-450 text-[10px] block uppercase font-medium">
                    Requests / Sec
                  </span>
                  <span className="font-bold text-slate-200 text-sm">
                    12,450
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Testimonial */}
        <div className="relative z-10 mt-auto pt-6 border-t border-white/10">
          <blockquote className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed font-light italic">
              "A modern, robust fullstack boilerplate with Next.js, Express, MongoDB, Vector DB, Redux Toolkit, and Tailwind CSS ready to build any application."
            </p>
            <footer className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-linear-to-tr from-purple-500 via-violet-600 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-purple-500/20">
                EL
              </div>
              <div>
                <cite className="not-italic text-xs font-semibold text-white block">
                  EssentoLabs Team
                </cite>
                <cite className="not-italic text-[10px] text-purple-300 block">
                  Engineered for Performance
                </cite>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
};

export default AuthCard;
