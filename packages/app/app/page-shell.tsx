import { ServingBadge } from "./serving-badge";
import Link from "next/link";

/**
 * Shared `<main>` + header wrapper for the persona workflow pages (wallet,
 * verify, auditor, admin, advanced) — same max width, padding, and heading
 * treatment everywhere; only the copy (and whether the serving badge applies)
 * differs per page.
 */
export function PageShell({
  title,
  subtitle,
  badge = true,
  back,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: boolean;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-10">
        {back && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <Link href={back.href} className="inline-flex items-center gap-2 text-xs font-black uppercase text-orange-600 underline decoration-2 underline-offset-4 hover:text-orange-500">
              <span aria-hidden>←</span> {back.label}
            </Link>
          </nav>
        )}
        <span className="nb-kicker mb-5">Private escrow · Testnet</span>
        <h1 className="nb-title">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-neutral-400">{subtitle}</p>}
        {badge && <ServingBadge className="mt-4" />}
      </header>
      {children}
    </main>
  );
}
