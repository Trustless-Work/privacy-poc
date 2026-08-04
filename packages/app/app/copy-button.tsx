"use client";

import { useState } from "react";

export function CopyButton({ label, payload }: { label: string; payload: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(payload());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="nb-secondary-action px-2 py-1 text-xs"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
