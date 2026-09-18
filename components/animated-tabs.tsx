"use client";

import { useEffect, useRef } from "react";

export interface AnimatedTab {
  label: string;
  value: string;
}

interface AnimatedTabsProps {
  tabs: AnimatedTab[];
  value: string;
  onChange: (value: string) => void;
}

// A pill tab bar with a sliding dark highlight behind the active tab. The
// highlight is a second, duplicate row of the same tabs, clipped down to
// just the active tab's rect via clip-path — animating that clip is what
// makes the highlight slide instead of just snapping between tabs.
export function AnimatedTabs({ tabs, value, onChange }: AnimatedTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const activeTabElement = activeTabRef.current;
    if (!container || !activeTabElement) return;

    const { offsetLeft, offsetWidth } = activeTabElement;
    const clipLeft = offsetLeft;
    const clipRight = offsetLeft + offsetWidth;

    container.style.clipPath = `inset(0 ${Number(
      100 - (clipRight / container.offsetWidth) * 100
    ).toFixed(2)}% 0 ${Number((clipLeft / container.offsetWidth) * 100).toFixed(2)}% round 9999px)`;
  }, [value, tabs]);

  return (
    <div className="relative bg-slate-100 border border-slate-200 inline-flex w-fit items-center rounded-full p-1">
      {/* Sliding highlight layer — a non-interactive duplicate of the tabs below */}
      <div
        ref={containerRef}
        className="absolute inset-1 z-10 overflow-hidden [transition:clip-path_0.25s_ease]"
        aria-hidden="true"
      >
        <div className="relative flex h-full w-full bg-slate-900 rounded-full">
          {tabs.map((tab) => (
            <span
              key={tab.value}
              className="flex h-full items-center justify-center rounded-full px-4 text-xs font-semibold text-white whitespace-nowrap"
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      {/* Real, clickable tabs */}
      <div className="relative flex">
        {tabs.map((tab) => {
          const isActive = value === tab.value;
          return (
            <button
              key={tab.value}
              ref={isActive ? activeTabRef : null}
              type="button"
              onClick={() => onChange(tab.value)}
              className="flex h-8 items-center rounded-full px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
