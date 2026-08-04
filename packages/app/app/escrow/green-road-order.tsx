import Link from "next/link";

export const GREEN_ROAD_ORDER = {
  id: "GR-001",
  product: "Irie Oregano Kit",
  description: "Caribbean herbs, hot sauce, and recipe cards",
  amount: "25 USDC",
  buyer: "Alberto",
  operator: "Ziggy",
  receiver: "Buju B.",
} as const;

type CastMember = {
  emoji?: string;
  image?: string;
  label: string;
  action: string;
};

const CAST: Record<"Alberto" | "Ziggy" | "Buju B.", CastMember> = {
  Alberto: {
    image: "/characters/alberto-pixel.svg",
    label: "Customer",
    action: "Places and funds the private order",
  },
  Ziggy: {
    image: "/characters/ziggy.png",
    label: "Store operator",
    action: "Takes, initializes, and delivers the order",
  },
  "Buju B.": {
    image: "/characters/buju-b.png",
    label: "Boss · Payment receiver",
    action: "Receives the private payment",
  },
};

export type GreenRoadActor = keyof typeof CAST;

type PortraitVariant = "card" | "context";

function CharacterPortrait({ person, variant }: { person: CastMember; variant: PortraitVariant }) {
  const frameClass = variant === "card"
    ? "mx-auto aspect-square w-full max-w-44 border-[3px] bg-amber-300 shadow-[4px_4px_0_#151515]"
    : "h-28 w-28 border-[3px] bg-white shadow-[3px_3px_0_#151515] sm:h-32 sm:w-32";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden border-neutral-950 text-4xl ${frameClass}`}
      aria-hidden
    >
      {person.image ? (
        <img
          src={person.image}
          alt=""
          className="h-full w-full object-contain [image-rendering:pixelated]"
        />
      ) : person.emoji}
    </span>
  );
}

export function CastCard({ actor }: { actor: GreenRoadActor }) {
  const person = CAST[actor];
  return (
    <article className="nb-card flex flex-col gap-4 p-5">
      <CharacterPortrait person={person} variant="card" />
      <div className="w-full border-t-2 border-neutral-950 pt-4">
        <p className="text-lg font-black uppercase leading-tight">{actor}</p>
        <p className="mt-1 text-xs font-bold text-orange-600">{person.label}</p>
        <p className="nb-copy-muted mt-2 text-xs leading-relaxed">{person.action}</p>
      </div>
    </article>
  );
}

export function OrderCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className="nb-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-neutral-950 bg-amber-300 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-wider">Green Road order</p>
        <span className="border-2 border-neutral-950 bg-white px-2 py-0.5 text-[10px] font-black">#{GREEN_ROAD_ORDER.id}</span>
      </div>
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <div className="flex gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center border-[3px] border-neutral-950 bg-lime-500 text-3xl shadow-[3px_3px_0_#151515]" aria-hidden>🌿</span>
          <div>
            <h2 className="text-xl font-black uppercase leading-tight">{GREEN_ROAD_ORDER.product}</h2>
            <p className="nb-copy-muted mt-1 text-sm">{GREEN_ROAD_ORDER.description}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-neutral-950 pt-4 text-xs sm:grid-cols-4">
          <OrderFact label="Customer" value={GREEN_ROAD_ORDER.buyer} />
          <OrderFact label="Store operator" value={GREEN_ROAD_ORDER.operator} />
          <OrderFact label="Payment receiver" value={GREEN_ROAD_ORDER.receiver} />
          <OrderFact label="Price" value={`${GREEN_ROAD_ORDER.amount} · private`} />
        </dl>
      </div>
    </section>
  );
}

function OrderFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="nb-copy-muted font-bold uppercase">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>;
}

export function ActorContext({ actor, children }: { actor: GreenRoadActor; children?: React.ReactNode }) {
  const person = CAST[actor];
  return (
    <section className="nb-card-guide mb-6 flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
        <CharacterPortrait person={person} variant="context" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider">You are acting as</p>
          <p className="mt-1 text-xl font-black uppercase sm:text-2xl">{actor} · {person.label}</p>
        </div>
      </div>
      <div className="text-xs font-bold leading-relaxed sm:max-w-xs sm:text-right">{children ?? person.action}</div>
    </section>
  );
}

export function PrivacyPath() {
  return (
    <section className="nb-card p-5 sm:p-6">
      <p className="nb-kicker">What stays private?</p>
      <h2 className="mt-4 text-xl font-black uppercase">The value moves. The amount stays hidden.</h2>
      <div className="mt-5 grid gap-2 text-center text-xs font-black sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <div className="border-2 border-neutral-950 bg-amber-500 p-3 text-neutral-950">Alberto&apos;s private funds</div>
        <span className="text-xl" aria-hidden>→</span>
        <div className="border-2 border-neutral-950 bg-orange-500 p-3 text-neutral-950">Confidential escrow</div>
        <span className="text-xl" aria-hidden>→</span>
        <div className="border-2 border-neutral-950 bg-lime-500 p-3 text-neutral-950">Buju B.&apos;s private balance</div>
      </div>
      <p className="nb-copy-muted mt-4 text-sm leading-relaxed">
        Stellar shows that the order was funded and released, but not the amount or either participant&apos;s confidential balance. Addresses and lifecycle events remain public.
      </p>
      <Link href="/escrow" className="mt-4 inline-block text-sm font-black text-orange-600 underline decoration-2 underline-offset-4">See the five-part journey →</Link>
    </section>
  );
}
