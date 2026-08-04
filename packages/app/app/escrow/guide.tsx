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
    <section className="nb-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="nb-kicker">{step}</p>
          <h2 className="mt-3 text-xl font-black uppercase">{title}</h2>
        </div>
        <span className="nb-chip px-3 py-1 text-xs">
          Character: {account}
        </span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Before you click anything</h3>
          <ul className="mt-3 space-y-2">
            {before.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-neutral-300">
                <span aria-hidden className="mt-0.5 font-black text-amber-300">□</span>
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
                <span className="grid h-5 w-5 shrink-0 place-items-center border-2 border-neutral-950 bg-orange-500 text-[11px] font-black text-neutral-950">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="nb-card-success mt-5 p-3 text-sm">
        <strong className="font-semibold">Success looks like:</strong> {expected}
      </div>

      {next && (
        <p className="mt-4 text-xs leading-relaxed text-neutral-400">
          Next in the order: <Link href={next.href} className="font-black text-orange-600 hover:text-orange-500">{next.label} →</Link>
        </p>
      )}
    </section>
  );
}

export function AccountSwitchReminder() {
  return (
    <div className="nb-card-guide p-4 text-sm leading-relaxed">
      <strong className="font-black uppercase">Changing characters?</strong>{" "}
      Switch accounts in Freighter, refresh this page, reconnect, and verify the displayed <code className="text-xs">G…</code> address before submitting.
    </div>
  );
}
