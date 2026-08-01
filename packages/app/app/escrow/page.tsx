"use client";

import { useState } from "react";
import { useActiveDeployment } from "@/lib/active-deployment";
import { Addr } from "../addr";

type Step = {
  id: number;
  phase: string;
  actor: "Payer" | "Approver" | "Receiver" | "Auditor";
  title: string;
  summary: string;
  action: string;
  public: string[];
  private: string[];
  mechanics: string[];
};

const STEPS: Step[] = [
  {
    id: 1,
    phase: "Setup",
    actor: "Payer",
    title: "Prepare confidential USDC",
    summary:
      "The payer registers a confidential account, deposits USDC into the wrapper, and merges it into a spendable private balance.",
    action: "Prepare payer wallet",
    public: ["Payer address", "Deposit amount", "Deposit transaction"],
    private: ["Resulting confidential balance", "Future escrow amount"],
    mechanics: [
      "Public USDC moves into the confidential-token wrapper.",
      "The payer receives a hidden balance commitment.",
      "Merge makes the receiving balance available to spend.",
    ],
  },
  {
    id: 2,
    phase: "Create",
    actor: "Approver",
    title: "Initialize one-milestone escrow",
    summary:
      "The approver fixes the payer, receiver, and approver addresses. The escrow contract registers as a confidential spender.",
    action: "Initialize escrow",
    public: ["Payer, receiver, and approver", "Escrow contract", "Initialized status"],
    private: ["Confidential spender secret"],
    mechanics: [
      "The contract stores the three fixed roles.",
      "A registration proof binds confidential keys to the escrow address.",
      "The amount is not chosen or stored during initialization.",
    ],
  },
  {
    id: 3,
    phase: "Fund",
    actor: "Payer",
    title: "Fund the private milestone",
    summary:
      "The payer enters the complete milestone amount. A browser-generated proof converts it into a confidential allowance controlled by the escrow.",
    action: "Fund milestone",
    public: ["Payer and escrow addresses", "Funded status", "Allowance expiry"],
    private: ["Milestone amount", "Remaining payer balance", "Allowance value"],
    mechanics: [
      "The amount never appears in the escrow call or escrow storage.",
      "The proof demonstrates that the payer had enough confidential USDC.",
      "The allowance itself represents the complete one-milestone escrow.",
    ],
  },
  {
    id: 4,
    phase: "Approve",
    actor: "Approver",
    title: "Approve and release all funds",
    summary:
      "One approval creates a zero-knowledge proof and atomically releases the entire live allowance to the fixed receiver.",
    action: "Approve & release",
    public: ["Approver action", "Released status", "Receiver address", "Transaction time"],
    private: ["Released amount", "Payer and receiver balances"],
    mechanics: [
      "The release circuit requires the remaining allowance to equal zero.",
      "The approver cannot select a smaller amount or another receiver.",
      "If the transfer fails, the escrow cannot be marked Released.",
    ],
  },
  {
    id: 5,
    phase: "Receive",
    actor: "Receiver",
    title: "Receive and merge",
    summary:
      "The receiver discovers the incoming confidential payment and merges it into their spendable private balance.",
    action: "Merge received funds",
    public: ["Receiver address", "Merge transaction"],
    private: ["Incoming amount", "New spendable balance"],
    mechanics: [
      "The receiver decrypts the incoming transfer locally.",
      "Funds first arrive in a separate receiving commitment.",
      "Merge combines receiving and spendable commitments without revealing either value.",
    ],
  },
  {
    id: 6,
    phase: "Verify",
    actor: "Auditor",
    title: "Audit or disclose the payment",
    summary:
      "The designated auditor can decrypt the transfer, while a participant can prove this one payment to an external verifier.",
    action: "Open verification tools",
    public: ["Escrow transaction reference", "Proof validity"],
    private: ["Amount, unless deliberately disclosed", "Other transfers and balances"],
    mechanics: [
      "Auditor ciphertexts provide standing access to the designated auditor.",
      "Selective disclosure reveals only the chosen transfer amount.",
      "The verifier checks the proof against the original on-chain event.",
    ],
  },
];

const actorTone: Record<Step["actor"], string> = {
  Payer: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  Approver: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  Receiver: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  Auditor: "border-amber-500/40 bg-amber-500/10 text-amber-300",
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
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">What happens under the hood</p>
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

          <button
            type="button"
            disabled={!escrow}
            title={!escrow ? "Available after the integrated testnet deployment" : undefined}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {escrow ? step.action : `${step.action} — deployment required`}
          </button>
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
