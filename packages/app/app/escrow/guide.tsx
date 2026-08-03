import Link from "next/link";

export function BeginnerGuide({
  step,
  title,
  account,
  before,
  actions,
  expected,
  next,
}: {
  step: string;
  title: string;
  account: string;
  before: string[];
  actions: string[];
  expected: string;
  next?: { href: string; label: string };
}) {
  return (
    <section className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">{step}</p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-100">{title}</h2>
        </div>
        <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
          Use: {account}
        </span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Before you click anything</h3>
          <ul className="mt-3 space-y-2">
            {before.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-neutral-300">
                <span aria-hidden className="mt-0.5 text-amber-300">□</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Do this now</h3>
          <ol className="mt-3 space-y-2">
            {actions.map((item, index) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-neutral-200">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-[11px] font-semibold text-indigo-200">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-200">
        <strong className="font-semibold">Success looks like:</strong> {expected}
      </div>

      {next && (
        <p className="mt-4 text-xs leading-relaxed text-neutral-400">
          After this succeeds: <Link href={next.href} className="font-medium text-indigo-300 hover:text-indigo-200">{next.label} →</Link>
        </p>
      )}
    </section>
  );
}

export function AccountSwitchReminder() {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-relaxed text-neutral-300">
      <strong className="text-amber-200">Changed accounts in Freighter?</strong>{" "}
      Refresh this page, connect again, and verify the displayed <code className="text-xs text-neutral-100">G…</code> address before submitting.
    </div>
  );
}
