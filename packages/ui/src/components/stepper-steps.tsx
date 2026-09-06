"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@workspace/ui/lib/utils";

interface Step {
  id: number;
  label: string;
  key?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (stepId: number) => void;
}

/**
 * The multi-step wizard rail.
 *
 * Desktop shows every node with a progress line that fills as you advance;
 * mobile collapses to a single progress bar with the current step's label.
 * All colour comes from theme tokens, so it reads correctly in dark mode.
 */
export function StepperSteps({
  steps,
  currentStep,
  onStepChange,
}: StepperProps) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStep),
  );
  // Fraction of the rail between the first and last node that is complete.
  const progress =
    steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 100;

  return (
    <div className="w-full">
      {/* Mobile — a single bar plus the current step's name. */}
      <div className="w-full md:hidden">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Step {activeIndex + 1} of {steps.length}
          </span>
          <span className="truncate text-sm font-extrabold text-primary">
            {steps.find((s) => s.id === currentStep)?.label}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-primary to-brand-pink"
            initial={false}
            animate={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
          />
        </div>
      </div>

      {/* Desktop — nodes on a rail. */}
      <div className="relative hidden md:block">
        {/* Rail sits behind the nodes, inset by half a node so it starts and
            ends at the node centres. */}
        <div
          className="absolute top-6 right-0 left-0 mx-[calc(50%/var(--steps))] h-0.5"
          style={{ "--steps": steps.length } as React.CSSProperties}
        >
          <div className="h-full w-full rounded-full bg-border" />
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-primary to-brand-pink"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] }}
          />
        </div>

        <ol className="relative flex items-start justify-between">
          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <li
                key={step.id}
                className="flex flex-1 flex-col items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => onStepChange(step.id)}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Step ${step.id}: ${step.label}`}
                  className={cn(
                    "relative grid size-12 place-items-center rounded-full border-2 transition-all duration-300",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isActive &&
                      "border-primary bg-card text-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]",
                    !isActive &&
                      !isCompleted &&
                      "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
                  )}
                >
                  {/* Halo that pulses on the step you're currently on. */}
                  {isActive && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
                  )}

                  {isCompleted ? (
                    <Check className="size-5" strokeWidth={3} />
                  ) : (
                    <span
                      className={cn(
                        "text-sm font-extrabold tabular-nums",
                        isActive && "text-primary",
                      )}
                    >
                      {step.id}
                    </span>
                  )}
                </button>

                <span
                  className={cn(
                    "max-w-28 px-1 text-center text-xs leading-snug font-semibold transition-colors duration-300",
                    isActive || isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
