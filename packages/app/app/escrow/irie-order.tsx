import Link from "next/link";

export const IRIE_ORDER = {
  id: "IRIE-001",
  product: "Irie Oregano Kit",
  description: "Caribbean herbs, hot sauce, and recipe cards",
  amount: "25 USDC",
  buyer: "Alberto",
  seller: "Bruno",
  approver: "Ziggy",
} as const;

const CAST = {
  Alberto: { emoji: "👨🏽‍💻", label: "Buyer", action: "Locks the private payment" },
  Bruno: { emoji: "🧑🏽‍🍳", label: "Seller", action: "Prepares the order" },
  Ziggy: { emoji: "🚲", label: "Delivery partner", action: "Confirms delivery" },
} as const;

export type IrieActor = keyof typeof CAST;

export function CastCard({ actor }: { actor: IrieActor }) {
  const person = CAST[actor];
  return (
    <article className="nb-card flex items-center gap-3 p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-neutral-950 bg-amber-300 text-2xl shadow-[2px_2px_0_#151515]" aria-hidden>
        {person.emoji}
      </span>
      <div>
        <p className="font-black uppercase leading-tight">{actor}</p>
        <p className="text-xs font-bold text-orange-600">{person.label}</p>
        <p className="mt-1 text-xs text-neutral-500">{person.action}</p>
      </div>
    </article>
  );
}

export function OrderCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className="nb-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-neutral-950 bg-amber-300 px-4 py-3 text-neutral-950">
        <p className="text-xs font-black uppercase tracking-wider">Irie Market order</p>
        <span className="border-2 border-neutral-950 bg-white px-2 py-0.5 font-mono text-[10px] font-black">#{IRIE_ORDER.id}</span>
      </div>
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <div className="flex gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center border-[3px] border-neutral-950 bg-lime-500 text-3xl shadow-[3px_3px_0_#151515]" aria-hidden>🌿</span>
          <div>
            <h2 className="text-xl font-black uppercase leading-tight">{IRIE_ORDER.product}</h2>
            <p className="mt-1 text-sm text-neutral-500">{IRIE_ORDER.description}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-neutral-950 pt-4 text-xs sm:grid-cols-4">
          <OrderFact label="Buyer" value={IRIE_ORDER.buyer} />
          <OrderFact label="Seller" value={IRIE_ORDER.seller} />
          <OrderFact label="Delivery" value={IRIE_ORDER.approver} />
          <OrderFact label="Price" value={`${IRIE_ORDER.amount} · private`} />
        </dl>
      </div>
    </section>
  );
}

function OrderFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-bold uppercase text-neutral-500">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>;
}

export function ActorContext({ actor, children }: { actor: IrieActor; children?: React.ReactNode }) {
  const person = CAST[actor];
  return (
    <section className="nb-card-guide mb-6 flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>{person.emoji}</span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider">You are acting as</p>
          <p className="text-lg font-black uppercase">{actor} · {person.label}</p>
        </div>
      </div>
      <div className="text-xs font-bold sm:max-w-xs sm:text-right">{children ?? person.action}</div>
    </section>
  );
}

export function PrivacyPath() {
  return (
    <section className="nb-card p-5 sm:p-6">
      <p className="nb-kicker">What stays private?</p>
      <h2 className="mt-4 text-xl font-black uppercase">The value moves. The amount stays hidden.</h2>
      <div className="mt-5 grid gap-2 text-center text-xs font-black sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <div className="border-2 border-neutral-950 bg-white p-3 text-neutral-950">Alberto&apos;s private funds</div>
        <span className="text-xl" aria-hidden>→</span>
        <div className="border-2 border-neutral-950 bg-orange-500 p-3 text-neutral-950">Confidential escrow</div>
        <span className="text-xl" aria-hidden>→</span>
        <div className="border-2 border-neutral-950 bg-lime-500 p-3 text-neutral-950">Bruno&apos;s private balance</div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-neutral-500">
        Stellar shows that the order was funded and released, but not the amount or either participant&apos;s confidential balance. Addresses and lifecycle events remain public.
      </p>
      <Link href="/escrow" className="mt-4 inline-block text-sm font-black text-orange-600 underline decoration-2 underline-offset-4">See the five-part journey →</Link>
    </section>
  );
}
