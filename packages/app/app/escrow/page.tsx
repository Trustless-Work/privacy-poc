"use client";

import Link from "next/link";
import { useActiveDeployment } from "@/lib/active-deployment";
import { Addr } from "../addr";
import { OrderCard, PrivacyPath } from "./green-road-order";

type Step = {
  id: number;
  phase: string;
  actor: "Alberto" | "Ziggy" | "Buju B.";
  title: string;
  summary: string;
  action: string;
  public: string[];
  private: string[];
  mechanics: string[];
  expected: string;
  href: string;
};

const STEPS: Step[] = [
  {
    id: 1,
    phase: "Place order",
    actor: "Alberto",
    title: "Alberto calls Ziggy",
    summary:
      "Alberto calls Ziggy and orders an Irie Oregano Kit. Before checkout, prepare three separate wallets and the private balances the order needs.",
    action: "Prepare the order wallets",
    public: ["Three public Testnet addresses"],
    private: ["Recovery phrases and private keys"],
    mechanics: [
      "Set Freighter to Testnet.",
      "Create accounts labelled Alberto, Ziggy, and Buju B.",
      "Fund every account with Testnet XLM for transaction fees.",
      "Register Buju B. so he can receive privately.",
      "Register Alberto, deposit at least 25 Testnet USDC, and Merge it into Spendable.",
    ],
    expected: "Buju B. is registered, Alberto has at least 25 Spendable USDC, and all three G… addresses are different.",
    href: "/wallet",
  },
  {
    id: 2,
    phase: "Initialize",
    actor: "Ziggy",
    title: "Ziggy initializes the order",
    summary:
      "Ziggy takes Alberto's order and opens a fresh escrow, assigning Alberto as payer, Buju B. as receiver, and himself as approver.",
    action: "Initialize order escrow",
    public: ["Payer, receiver, and approver addresses", "Initialized status"],
    private: ["Escrow confidential key"],
    mechanics: [
      "Switch Freighter to Ziggy and refresh the Store Operator page.",
      "Paste Alberto's address as Customer and Buju B.'s as Payment receiver.",
      "Open the order escrow, sign the key message, and approve initialization.",
    ],
    expected: "A fresh order contract is selected and its state says Initialized.",
    href: "/escrow/approver",
  },
  {
    id: 3,
    phase: "Fund",
    actor: "Alberto",
    title: "Alberto funds the escrow",
    summary:
      "Alberto locks the 25 USDC order payment. The network verifies the escrow is funded without publishing the amount.",
    action: "Fund order escrow",
    public: ["Payer and escrow addresses", "Funded status"],
    private: ["Order amount", "Alberto's remaining private balance"],
    mechanics: [
      "Switch Freighter to Alberto and refresh the Customer page.",
      "Connect and confirm the wallet matches the escrow payer.",
      "Enter 25 USDC and click Lock order payment.",
    ],
    expected: "The shared escrow state changes from Initialized to Funded.",
    href: "/escrow/payer",
  },
  {
    id: 4,
    phase: "Deliver",
    actor: "Ziggy",
    title: "Ziggy delivers the product",
    summary:
      "Ziggy delivers the Irie Oregano Kit and confirms the real-world handoff, authorizing the escrow to release its private payment.",
    action: "Confirm delivery and release",
    public: ["Approver action", "Receiver address", "Released status"],
    private: ["Released amount", "Participant balances"],
    mechanics: [
      "Switch Freighter to Ziggy and refresh the Store Operator page.",
      "Confirm the escrow says Funded and the product was delivered.",
      "Click Confirm delivery & release and wait for proof generation.",
    ],
    expected: "The shared escrow state changes from Funded to Released.",
    href: "/escrow/approver",
  },
  {
    id: 5,
    phase: "Receive",
    actor: "Buju B.",
    title: "Buju B. receives payment",
    summary:
      "Buju B., the boss, discovers the released confidential USDC and merges it into his spendable private balance.",
    action: "Receive private payment",
    public: ["Receiver address", "Merge transaction"],
    private: ["Incoming amount", "Buju B.'s new spendable balance"],
    mechanics: [
      "Switch Freighter to Buju B. and refresh the Payment Receiver page.",
      "Connect and sync until Receiving shows the private payment.",
      "Click Make payment spendable and approve the transaction.",
    ],
    expected: "Receiving becomes 0 and Spendable increases. The demo is complete.",
    href: "/escrow/receiver",
  },
];

const actorTone: Record<Step["actor"], string> = {
  Alberto: "bg-orange-500 text-neutral-950",
  Ziggy: "bg-amber-300 text-neutral-950",
  "Buju B.": "bg-emerald-500 text-neutral-950",
};

export default function EscrowWalkthroughPage() {
  const { active } = useActiveDeployment();
  const escrow = active.contracts.escrow;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <header className="mb-10 grid items-end gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="nb-kicker">Green Road · Order #GR-001</span>
          <span className="nb-chip px-2.5 py-1">
            Happy path · Private payment · Real contracts
          </span>
        </div>
        <h1 className="nb-title">A private order, from cart to cash.</h1>
        <p className="nb-copy-muted mt-3 max-w-3xl text-sm leading-relaxed">
          Alberto calls Ziggy to place an order. Ziggy initializes the escrow, Alberto funds it, Ziggy delivers the product, and Buju B. receives the payment.
        </p>
        </div>
        <OrderCard compact />
      </header>

      {!escrow && (
        <div className="nb-card-guide mb-8 p-4">
          <div className="flex gap-3">
            <span aria-hidden className="mt-0.5 text-amber-300">●</span>
            <div>
              <p className="text-sm font-black uppercase">Start order #GR-001</p>
              <p className="mt-1 text-xs leading-relaxed">
                Meet the crew, prepare Buju B. and Alberto, then let Ziggy open the order escrow.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="nb-card-guide mb-6 p-4 text-sm font-bold">
        Open each step in order. Every dropdown explains the story, the wallet to use, and the exact action to complete.
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Order walkthrough" className="space-y-4">
          {STEPS.map((step) => (
            <details key={step.id} open={step.id === 1} className="group nb-card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden sm:p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-neutral-950 bg-orange-500 text-sm font-black text-neutral-950 shadow-[2px_2px_0_#151515]">{step.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-500">{step.phase}</span>
                  <span className="block font-black uppercase">{step.title}</span>
                </span>
                <span className={`hidden rounded-full border-2 border-neutral-950 px-2.5 py-1 text-xs font-black shadow-[2px_2px_0_#151515] sm:inline ${actorTone[step.actor]}`}>{step.actor}</span>
                <span aria-hidden className="text-xl font-black transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t-[3px] border-neutral-950 p-5 sm:p-6">
                <p className="nb-copy-muted text-sm leading-relaxed">{step.summary}</p>
                <div className="mt-5 border-l-4 border-neutral-950 bg-amber-300/20 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">Do this</p>
                  <ol className="mt-3 space-y-3">
                    {step.mechanics.map((item, index) => (
                      <li key={item} className="nb-copy-muted flex gap-3 text-sm leading-relaxed">
                        <span className="grid h-5 w-5 shrink-0 place-items-center border-2 border-neutral-950 bg-amber-300 text-[10px] font-black text-neutral-950">{index + 1}</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <VisibilityCard title="Visible on-chain" tone="public" items={step.public} />
                  <VisibilityCard title="Kept confidential" tone="private" items={step.private} />
                </div>
                <div className="nb-card-success mt-5 p-3 text-sm"><strong>Success looks like:</strong> {step.expected}</div>
                {escrow || step.id <= 2 ? (
                  <Link href={step.href} className="nb-action mt-5 block w-full px-4 py-3 text-center text-sm">{step.action}</Link>
                ) : (
                  <button type="button" disabled className="nb-control mt-5 w-full cursor-not-allowed px-4 py-3 text-sm opacity-50">{step.action} — initialize an escrow first</button>
                )}
              </div>
            </details>
          ))}
        </section>

        <aside className="space-y-4">
          <section className="nb-card p-4 text-xs">
            <p className="font-black uppercase">Technical details</p>
            <dl className="nb-copy-muted mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <dt>Token wrapper</dt>
                <dd><Addr value={active.contracts.token} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Escrow</dt>
                <dd>{escrow ? <Addr value={escrow} /> : "Not deployed"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Asset</dt>
                <dd>USDC target</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <div className="mt-8"><PrivacyPath /></div>

      <section className="nb-card nb-copy-muted mt-8 p-4 text-xs leading-relaxed">
        <strong className="font-black">Known v0 limitation:</strong> the payer can revoke or let the
        confidential allowance expire before approval. Release then fails safely and the escrow remains Funded.
      </section>
    </main>
  );
}

function VisibilityCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "public" | "private";
  items: string[];
}) {
  const styles = tone === "public"
    ? "bg-amber-300 text-neutral-950"
    : "bg-emerald-500 text-neutral-950";
  return (
    <section className={`rounded-sm border-[3px] border-neutral-950 p-4 shadow-[4px_4px_0_#151515] ${styles}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
      <ul className="mt-3 space-y-2 text-xs text-neutral-950/75">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-current">{tone === "public" ? "○" : "●"}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
