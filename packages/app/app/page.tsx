"use client";

import Link from "next/link";
import { ServingBadge } from "./serving-badge";
import { CastCard, OrderCard, PrivacyPath } from "./escrow/irie-order";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
      <header className="grid items-center gap-8 lg:grid-cols-[1.08fr_.92fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3"><span className="nb-kicker">Irie Market · Stellar Testnet</span><ServingBadge /></div>
          <h1 className="mt-6 max-w-[12ch] text-5xl font-black uppercase leading-[.9] tracking-[-.065em] sm:text-7xl">Buy privately. Deliver fairly.</h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-neutral-500">
            Alberto calls Ziggy to order an Irie Oregano Kit. Ziggy opens the escrow and delivers the product; Buju B., the boss, receives the confidential payment.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/escrow" className="nb-action px-6 py-3 text-sm uppercase">Start the guided demo →</Link>
            <a href="#privacy" className="nb-control px-6 py-3 text-sm uppercase">How privacy works</a>
          </div>
        </div>
        <OrderCard />
      </header>

      <section className="mt-14">
        <p className="nb-kicker">Meet the order crew</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3"><CastCard actor="Alberto" /><CastCard actor="Ziggy" /><CastCard actor="Buju B." /></div>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="nb-card-guide p-6">
          <p className="text-xs font-black uppercase tracking-wider">The happy path</p>
          <ol className="mt-5 space-y-4">
            {[
              "Alberto calls Ziggy and places the order.",
              "Ziggy initializes the order escrow.",
              "Alberto funds it with confidential USDC.",
              "Ziggy delivers the Irie Oregano Kit.",
              "Buju B. receives the private payment.",
            ].map((item, index) => <li key={item} className="flex gap-3 text-sm font-bold"><span className="grid h-6 w-6 shrink-0 place-items-center border-2 border-neutral-950 bg-white text-xs">{index + 1}</span><span>{item}</span></li>)}
          </ol>
        </div>
        <div id="privacy"><PrivacyPath /></div>
      </section>

      <section className="nb-card-guide mt-14 flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center">
        <div><p className="text-xs font-black uppercase tracking-wider">Ready to place order #{"IRIE-001"}?</p><h2 className="mt-1 text-2xl font-black uppercase">See confidential commerce in action.</h2></div>
        <Link href="/escrow" className="nb-control shrink-0 bg-white px-6 py-3 text-sm uppercase">Start demo →</Link>
      </section>
    </main>
  );
}
