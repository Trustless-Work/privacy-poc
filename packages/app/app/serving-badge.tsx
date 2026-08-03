"use client";

/**
 * "Serving [token addr] — [kind]" status chip. Rendered on the landing page and
 * every persona page so the active deployment (the built-in default vs. an
 * advanced one) is always visible at a glance. Reads the active deployment from
 * context; pass `className` to control placement (e.g. margin).
 *
 * Flashes an emerald highlight whenever the served token address changes (the
 * Default ↔ Advanced nav toggle, or a redeploy overwriting the advanced slot)
 * so the update reads as a distinct event rather than a silent text swap.
 */

import { useEffect, useRef, useState } from "react";
import { useActiveDeployment } from "@/lib/active-deployment";
import { kindLabel } from "@/lib/deployment";
import { Addr } from "./addr";

export function ServingBadge({ className = "" }: { className?: string }) {
  const { active } = useActiveDeployment();
  const [justUpdated, setJustUpdated] = useState(false);
  const prevTokenRef = useRef(active.contracts.token);

  useEffect(() => {
    if (prevTokenRef.current === active.contracts.token) return;
    prevTokenRef.current = active.contracts.token;
    setJustUpdated(true);
    const t = setTimeout(() => setJustUpdated(false), 900);
    return () => clearTimeout(t);
  }, [active.contracts.token]);

  return (
    <div
      className={`nb-control inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs transition-all ease-out ${
        justUpdated
          ? "duration-200 scale-[1.04]"
          : "duration-700 scale-100"
      } ${className}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 ring-2 ring-neutral-950" aria-hidden />
      <span className="text-neutral-500">Serving</span>
      <Addr value={active.contracts.token} className="font-medium text-neutral-200" />
      <span className="text-neutral-600">—</span>
      <span className="text-neutral-300">{kindLabel(active.kind)}</span>
    </div>
  );
}
