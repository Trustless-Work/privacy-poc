/** Shared inline error banner used across the persona pages. */
export function ErrorBox({
  children,
  className = "",
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  /** "sm" — compact, for inline panel errors. "md" (default) — page-level errors. */
  size?: "sm" | "md";
}) {
  const sizeCls = size === "sm" ? "p-2 text-xs" : "p-3 text-sm";
  return (
    <div className={`nb-card-guide ${sizeCls} ${className}`} role="alert">
      <strong className="mr-1 font-black uppercase">Check this:</strong> {children}
    </div>
  );
}
