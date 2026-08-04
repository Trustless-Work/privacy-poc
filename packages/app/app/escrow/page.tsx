"use client";

import { useState } from "react";
import Link from "next/link";
import { useActiveDeployment } from "@/lib/active-deployment";
import { Addr } from "../addr";
import { OrderCard, PrivacyPath } from "./irie-order";

type Step = {
  id: number;
  phase: string;
  actor: "Setup" | "Alberto" | "Ziggy" | "Bruno";
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
    phase: "Meet the crew",
    actor: "Setup",
    title: "Set up the three characters",
    summary:
      "Create separate Freighter accounts for Alberto, Ziggy, and Bruno. Each character signs only their part of the order.",
    action: "Open wallet preparation",
    public: ["Three public Testnet addresses"],
    private: ["Recovery phrases and private keys"],
    mechanics: [
      "Set Freighter to Testnet.",
      "Create accounts labelled Alberto, Ziggy, and Bruno.",
      "Fund every account with Testnet XLM for transaction fees.",
    ],
    expected: "You have three different G… addresses and each account has Testnet XLM.",
    href: "/wallet",
  },
  {
    id: 2,
    phase: "Receiver",
    actor: "Bruno",
    title: "Give Bruno a private receiving account",
    summary:
      "Register Bruno before delivery so the confidential payment has a valid private destination.",
    action: "Register receiver",
    public: ["Receiver address", "Registration transaction"],
    private: ["Receiver confidential keys"],
    mechanics: [
      "Switch Freighter to Bruno and refresh the Wallet page.",
      "Connect and confirm the displayed G… address is Bruno's.",
      "Click Register and approve the Testnet transaction.",
    ],
    expected: "Wallet shows Registered and both balances begin at 0 USDC.",
    href: "/wallet",
  },
  {
    id: 3,
    phase: "Payer",
    actor: "Alberto",
    title: "Prepare Alberto's private funds",
    summary:
      "Register Alberto, deposit public Testnet USDC, and turn it into a spendable confidential balance.",
    action: "Prepare payer",
    public: ["Payer address", "Public deposit amount"],
    private: ["Spendable confidential balance"],
    mechanics: [
      "Switch Freighter to Alberto, refresh, connect, and Register.",
      "Deposit enough Testnet USDC for the 25 USDC order.",
      "Click Merge so Receiving becomes Spendable.",
    ],
    expected: "Payer Wallet shows Registered, Receiving 0, and a positive Spendable USDC balance.",
    href: "/wallet",
  },
  {
    id: 4,
    phase: "Initialize",
    actor: "Ziggy",
    title: "Open the order escrow",
    summary:
      "Ziggy opens a fresh escrow for order #IRIE-001 and assigns Alberto as buyer and Bruno as seller.",
    action: "Create escrow",
    public: ["Payer, Receiver, and Approver addresses", "Initialized status"],
    private: ["Escrow confidential key"],
    mechanics: [
      "Switch Freighter to Ziggy and refresh the Delivery Partner page.",
      "Paste Alberto's and Bruno's G… addresses into the labelled fields.",
      "Click Create escrow with Freighter and approve the deployment request.",
      "Sign the key message, then approve initialization.",
    ],
    expected: "A new contract is selected and its state says Initialized with all three roles.",
    href: "/escrow/approver",
  },
  {
    id: 5,
    phase: "Fund",
    actor: "Alberto",
    title: "Lock the private payment",
    summary:
      "Alberto locks the order payment in escrow. The chain can verify that it is funded without revealing the amount.",
    action: "Fund milestone",
    public: ["Payer and escrow addresses", "Funded status"],
    private: ["Milestone amount", "Remaining payer balance"],
    mechanics: [
      "Switch Freighter to Alberto and refresh the Buyer page.",
      "Enter 25 USDC, no greater than Alberto's Spendable balance.",
      "Click Lock order payment and wait for proof generation.",
    ],
    expected: "Shared escrow state changes from Initialized to Funded.",
    href: "/escrow/payer",
  },
  {
    id: 6,
    phase: "Release",
    actor: "Ziggy",
    title: "Confirm delivery and release",
    summary:
      "After delivering the package, Ziggy confirms delivery and releases the complete private payment to Bruno.",
    action: "Approve & release",
    public: ["Approver action", "Receiver address", "Released status"],
    private: ["Released amount", "Participant balances"],
    mechanics: [
      "Switch Freighter to Ziggy and refresh the Delivery Partner page.",
      "Confirm Shared escrow state says Funded.",
      "Click Confirm delivery & release and wait for proof generation.",
    ],
    expected: "Shared escrow state changes from Funded to Released.",
    href: "/escrow/approver",
  },
  {
    id: 7,
    phase: "Collect",
    actor: "Bruno",
    title: "Collect Bruno's private payment",
    summary:
      "Bruno discovers the incoming confidential USDC and merges it into his spendable private balance.",
    action: "Collect payment",
    public: ["Receiver address", "Merge transaction"],
    private: ["Incoming amount", "New spendable balance"],
    mechanics: [
      "Switch Freighter to Bruno and refresh the Seller page.",
      "Connect and sync until Receiving shows the private payment.",
      "Click Make payment spendable and approve the transaction.",
    ],
    expected: "Receiving becomes 0 and Spendable increases. The demo is complete.",
    href: "/escrow/receiver",
  },
];

const actorTone: Record<Step["actor"], string> = {
  Setup: "bg-amber-400 text-neutral-950",
  Alberto: "bg-orange-500 text-neutral-950",
  Ziggy: "bg-amber-300 text-neutral-950",
  Bruno: "bg-emerald-500 text-neutral-950",
};

export default function EscrowWalkthroughPage() {
  const { active } = useActiveDeployment();
  const [selected, setSelected] = useState(1);
  const step = STEPS[selected - 1];
  const escrow = active.contracts.escrow;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <header className="mb-10 grid items-end gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="nb-kicker">Irie Market · Order #IRIE-001</span>
          <span className="nb-chip px-2.5 py-1">
            Happy path · Private payment · Real contracts
          </span>
        </div>
        <h1 className="nb-title">A private order, from cart to cash.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-400">
          Alberto buys from Bruno. Ziggy delivers the package and confirms fulfillment. Follow the order story first; open the technical details when you want to see the protocol underneath.
        </p>
        </div>
        <OrderCard compact />
      </header>

      {!escrow && (
        <div className="nb-card-guide mb-8 p-4">
          <div className="flex gap-3">
            <span aria-hidden className="mt-0.5 text-amber-300">●</span>
            <div>
              <p className="text-sm font-black uppercase">Start order #IRIE-001</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                Meet the three characters, prepare Bruno and Alberto, then let Ziggy open the order escrow.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="nb-card-guide mb-4 p-4 text-sm font-bold">
        Five story chapters: setup → prepare funds → open escrow → lock payment → deliver and collect. The seven numbered actions below expose the exact on-chain operations.
      </div>
      <section aria-label="Order progress" className="mb-7 overflow-x-auto pb-2">
        <ol className="flex min-w-[760px] items-start">
          {STEPS.map((item, index) => {
            const activeStep = item.id === selected;
            return (
              <li key={item.id} className="relative flex flex-1 items-start">
                {index < STEPS.length - 1 && (
                  <span className="absolute left-7 right-0 top-4 h-[3px] bg-neutral-800" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(item.id)}
                  aria-current={activeStep ? "step" : undefined}
                  className="relative z-10 flex w-full flex-col items-start text-left"
                >
                  <span
                    className={`grid h-8 w-8 place-items-center border-2 border-neutral-950 text-xs font-black transition-colors ${
                      activeStep
                        ? "bg-orange-500 text-neutral-950 shadow-[2px_2px_0_#151515]"
                        : "bg-neutral-950 text-neutral-500 hover:bg-amber-300 hover:text-neutral-950"
                    }`}
                  >
                    {item.id}
                  </span>
                  <span className={`mt-2 text-xs font-medium ${activeStep ? "text-neutral-100" : "text-neutral-500"}`}>
                    {item.phase}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="nb-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center border-2 border-neutral-950 bg-orange-500 text-sm font-black text-neutral-950 shadow-[2px_2px_0_#151515]">
                {step.id}
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{step.phase}</p>
                <h2 className="text-lg font-semibold">{step.title}</h2>
              </div>
            </div>
            <span className={`rounded-full border-2 border-neutral-950 px-2.5 py-1 text-xs font-black shadow-[2px_2px_0_#151515] ${actorTone[step.actor]}`}>
              {step.actor}
            </span>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-neutral-300">{step.summary}</p>

          <div className="mt-6 border-l-4 border-neutral-950 bg-amber-300/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Do this</p>
            <ol className="mt-3 space-y-3">
              {step.mechanics.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-neutral-300">
                  <span className="grid h-5 w-5 shrink-0 place-items-center border-2 border-neutral-950 bg-amber-300 text-[10px] font-black text-neutral-950">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          <div className="nb-card-success mt-5 p-3 text-sm">
            <strong className="font-semibold">Success looks like:</strong> {step.expected}
          </div>

          {escrow || step.id <= 4 ? (
            <Link href={step.href} className="nb-action mt-6 block w-full px-4 py-3 text-center text-sm">
              {step.action}
            </Link>
          ) : (
            <button type="button" disabled className="mt-6 w-full cursor-not-allowed rounded-lg bg-neutral-800 px-4 py-3 text-sm font-semibold text-neutral-500">
              {step.action} — create an escrow first
            </button>
          )}
        </section>

        <aside className="space-y-4">
          <VisibilityCard title="Visible on-chain" tone="public" items={step.public} />
          <VisibilityCard title="Kept confidential" tone="private" items={step.private} />

          <section className="nb-card p-4 text-xs">
            <p className="font-black uppercase">Technical details</p>
            <dl className="mt-3 space-y-2 text-neutral-500">
              <div className="flex items-center justify-between gap-3">
                <dt>Token wrapper</dt>
                <dd><Addr value={active.contracts.token} className="text-neutral-300" /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Escrow</dt>
                <dd>{escrow ? <Addr value={escrow} className="text-neutral-300" /> : "Not deployed"}</dd>
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

      <section className="nb-card mt-8 p-4 text-xs leading-relaxed text-neutral-500">
        <strong className="font-medium text-neutral-300">Known v0 limitation:</strong> the payer can revoke or let the
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
      <ul className="mt-3 space-y-2 text-xs text-neutral-400">
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
