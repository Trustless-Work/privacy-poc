"use client";

import { useState } from "react";
import Link from "next/link";
import { useActiveDeployment } from "@/lib/active-deployment";
import { Addr } from "../addr";

type Step = {
  id: number;
  phase: string;
  actor: "Setup" | "Payer" | "Approver" | "Receiver";
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
    phase: "Accounts",
    actor: "Setup",
    title: "Create three Testnet accounts",
    summary:
      "Create separate Freighter accounts for Payer, Approver, and Receiver. Keep their public G… addresses nearby.",
    action: "Open wallet preparation",
    public: ["Three public Testnet addresses"],
    private: ["Recovery phrases and private keys"],
    mechanics: [
      "Set Freighter to Testnet.",
      "Create and clearly label three different accounts.",
      "Fund every account with Testnet XLM for transaction fees.",
    ],
    expected: "You have three different G… addresses and each account has Testnet XLM.",
    href: "/wallet",
  },
  {
    id: 2,
    phase: "Receiver",
    actor: "Receiver",
    title: "Register the receiver",
    summary:
      "Register the Receiver before any payment is released so the confidential transfer has a valid destination.",
    action: "Register receiver",
    public: ["Receiver address", "Registration transaction"],
    private: ["Receiver confidential keys"],
    mechanics: [
      "Switch Freighter to Escrow Receiver and refresh the Wallet page.",
      "Connect and confirm the displayed G… address is the Receiver.",
      "Click Register and approve the Testnet transaction.",
    ],
    expected: "Wallet shows Registered and both balances begin at 0 USDC.",
    href: "/wallet",
  },
  {
    id: 3,
    phase: "Payer",
    actor: "Payer",
    title: "Prepare the payer balance",
    summary:
      "Register the Payer, deposit public Testnet USDC, and merge it into a spendable confidential balance.",
    action: "Prepare payer",
    public: ["Payer address", "Public deposit amount"],
    private: ["Spendable confidential balance"],
    mechanics: [
      "Switch Freighter to Escrow Payer, refresh, connect, and Register.",
      "Deposit a small Testnet USDC amount such as 10 USDC.",
      "Click Merge so Receiving becomes Spendable.",
    ],
    expected: "Payer Wallet shows Registered, Receiving 0, and a positive Spendable USDC balance.",
    href: "/wallet",
  },
  {
    id: 4,
    phase: "Initialize",
    actor: "Approver",
    title: "Initialize the escrow",
    summary:
      "The connected Approver sets the fixed Payer and Receiver addresses. All three roles must be different.",
    action: "Initialize escrow",
    public: ["Payer, Receiver, and Approver addresses", "Initialized status"],
    private: ["Escrow confidential key"],
    mechanics: [
      "Switch Freighter to Escrow Approver and refresh the Approver page.",
      "Paste the Payer and Receiver G… addresses into the labeled fields.",
      "Click Initialize and approve the Freighter request.",
    ],
    expected: "Shared escrow state says Initialized and displays all three roles.",
    href: "/escrow/approver",
  },
  {
    id: 5,
    phase: "Fund",
    actor: "Payer",
    title: "Fund the private milestone",
    summary:
      "The Payer converts part of the spendable confidential balance into the escrow's complete private allowance.",
    action: "Fund milestone",
    public: ["Payer and escrow addresses", "Funded status"],
    private: ["Milestone amount", "Remaining payer balance"],
    mechanics: [
      "Switch Freighter to Escrow Payer and refresh the Payer page.",
      "Enter an amount no greater than the displayed Spendable balance.",
      "Click Fund milestone privately and wait for proof generation.",
    ],
    expected: "Shared escrow state changes from Initialized to Funded.",
    href: "/escrow/payer",
  },
  {
    id: 6,
    phase: "Release",
    actor: "Approver",
    title: "Approve and release everything",
    summary:
      "The Approver authorizes one atomic action that releases the escrow's complete private allowance to the fixed Receiver.",
    action: "Approve & release",
    public: ["Approver action", "Receiver address", "Released status"],
    private: ["Released amount", "Participant balances"],
    mechanics: [
      "Switch Freighter to Escrow Approver and refresh the Approver page.",
      "Confirm Shared escrow state says Funded.",
      "Click Approve & release all and wait for proof generation.",
    ],
    expected: "Shared escrow state changes from Funded to Released.",
    href: "/escrow/approver",
  },
  {
    id: 7,
    phase: "Collect",
    actor: "Receiver",
    title: "Merge the received payment",
    summary:
      "The Receiver discovers the incoming confidential USDC and merges it into the spendable private balance.",
    action: "Collect payment",
    public: ["Receiver address", "Merge transaction"],
    private: ["Incoming amount", "New spendable balance"],
    mechanics: [
      "Switch Freighter to Escrow Receiver and refresh the Receiver page.",
      "Connect and wait for Receiving to show the incoming amount.",
      "Click Merge received funds and approve the transaction.",
    ],
    expected: "Receiving becomes 0 and Spendable increases. The demo is complete.",
    href: "/escrow/receiver",
  },
];

const actorTone: Record<Step["actor"], string> = {
  Setup: "border-neutral-500/40 bg-neutral-500/10 text-neutral-300",
  Payer: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  Approver: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  Receiver: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export default function EscrowWalkthroughPage() {
  const { active } = useActiveDeployment();
  const [selected, setSelected] = useState(1);
  const step = STEPS[selected - 1];
  const escrow = active.contracts.escrow;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-medium text-rose-300">
            Testnet PoC
          </span>
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-neutral-400">
            One milestone · One approval · Full release
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Private milestone escrow</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-400">
          Follow one confidential USDC payment from funding to release. The people and lifecycle
          remain visible on Stellar; the milestone amount and balances remain private.
        </p>
      </header>

      {!escrow && (
        <div className="mb-7 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex gap-3">
            <span aria-hidden className="mt-0.5 text-amber-300">●</span>
            <div>
              <p className="text-sm font-medium text-amber-300">Guided UI preview</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                The escrow contract is not configured in this deployment yet. You can explore the
                complete journey below; live wallet actions unlock after the integrated USDC
                testnet deployment is added.
              </p>
            </div>
          </div>
        </div>
      )}

      <section aria-label="Escrow progress" className="mb-7 overflow-x-auto pb-2">
        <ol className="flex min-w-[760px] items-start">
          {STEPS.map((item, index) => {
            const activeStep = item.id === selected;
            return (
              <li key={item.id} className="relative flex flex-1 items-start">
                {index < STEPS.length - 1 && (
                  <span className="absolute left-7 right-0 top-4 h-px bg-neutral-800" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(item.id)}
                  aria-current={activeStep ? "step" : undefined}
                  className="relative z-10 flex w-full flex-col items-start text-left"
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-colors ${
                      activeStep
                        ? "border-indigo-400 bg-indigo-500 text-white"
                        : "border-neutral-700 bg-neutral-950 text-neutral-500 hover:border-neutral-500"
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
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-300">
                {step.id}
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{step.phase}</p>
                <h2 className="text-lg font-semibold">{step.title}</h2>
              </div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${actorTone[step.actor]}`}>
              {step.actor}
            </span>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-neutral-300">{step.summary}</p>

          <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Do this</p>
            <ol className="mt-3 space-y-3">
              {step.mechanics.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-neutral-300">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-800 text-[10px] text-neutral-400">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-200">
            <strong className="font-semibold">Success looks like:</strong> {step.expected}
          </div>

          {escrow ? (
            <Link href={step.href} className="mt-6 block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500">
              {step.action}
            </Link>
          ) : (
            <button type="button" disabled className="mt-6 w-full cursor-not-allowed rounded-lg bg-neutral-800 px-4 py-3 text-sm font-semibold text-neutral-500">
              {step.action} — deployment required
            </button>
          )}
        </section>

        <aside className="space-y-4">
          <VisibilityCard title="Visible on-chain" tone="public" items={step.public} />
          <VisibilityCard title="Kept confidential" tone="private" items={step.private} />

          <section className="rounded-lg border border-neutral-800 p-4 text-xs">
            <p className="font-medium text-neutral-300">Active contracts</p>
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

      <section className="mt-7 rounded-lg border border-neutral-800 p-4 text-xs leading-relaxed text-neutral-500">
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
    ? "border-sky-500/25 bg-sky-500/5 text-sky-300"
    : "border-emerald-500/25 bg-emerald-500/5 text-emerald-300";
  return (
    <section className={`rounded-lg border p-4 ${styles}`}>
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
