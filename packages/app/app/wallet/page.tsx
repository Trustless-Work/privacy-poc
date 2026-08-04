"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfidentialWallet, type WalletView, type TxPhase } from "@/lib/wallet";
import { useActiveDeployment } from "@/lib/active-deployment";
import { errMsg } from "@/lib/err";
import { stroopsToXlm, xlmToStroops } from "@/lib/format";
import { useLog } from "@/lib/use-log";
import { EventsPanel } from "./events-panel";
import { PageShell } from "../page-shell";
import { ErrorBox } from "../error-box";
import { LogPanel } from "../log-panel";
import { Addr } from "../addr";
import { AccountSwitchReminder } from "../escrow/guide";
import { OrderCard } from "../escrow/irie-order";

type ActionTab = "deposit" | "withdraw" | "transfer" | "merge";

// Per-action visual identity. Colors match the activity-panel badges
// (deposit = sky, withdraw = amber); classes are literal so Tailwind sees them.
const ACTIONS: Record<
  ActionTab,
  { icon: string; title: string; hint: string; card: string; panel: string; btn: string }
> = {
  deposit: {
    icon: "↓",
    title: "Deposit",
    hint: "Public underlying asset → your receiving balance.",
    card: "border-sky-500/60 bg-sky-500/15 text-sky-300",
    panel: "border-sky-500/30 bg-sky-500/5",
    btn: "bg-sky-600 hover:bg-sky-500",
  },
  withdraw: {
    icon: "↑",
    title: "Withdraw",
    hint: "Spendable → public underlying asset (to yourself).",
    card: "border-amber-500/60 bg-amber-500/15 text-amber-300",
    panel: "border-amber-500/30 bg-amber-500/5",
    btn: "bg-amber-600 hover:bg-amber-500",
  },
  transfer: {
    icon: "→",
    title: "Transfer",
    hint: "Send to another registered account's receiving balance — amount stays private.",
    card: "border-violet-500/60 bg-violet-500/15 text-violet-300",
    panel: "border-violet-500/30 bg-violet-500/5",
    btn: "bg-violet-600 hover:bg-violet-500",
  },
  merge: {
    icon: "⊕",
    title: "Merge",
    hint: "Fold your receiving balance into spendable.",
    card: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
    panel: "border-emerald-500/30 bg-emerald-500/5",
    btn: "bg-emerald-600 hover:bg-emerald-500",
  },
};

export default function Page() {
  const { active } = useActiveDeployment();
  const [wallet, setWallet] = useState<ConfidentialWallet | null>(null);
  const [view, setView] = useState<WalletView | null>(null);
  const [logs, log] = useLog(60);
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ActionTab>("deposit");
  const [recipients, setRecipients] = useState<string[] | null>(null);
  const [mergeNotice, setMergeNotice] = useState<"incoming" | "deposit" | null>(null);
  const [eventsKey, setEventsKey] = useState(0);

  const [depositAmt, setDepositAmt] = useState("10");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmt, setTransferAmt] = useState("40");
  const [withdrawAmt, setWithdrawAmt] = useState("40");

  const loadRecipients = useCallback(
    async (w: ConfidentialWallet) => {
      try {
        setRecipients(await w.registeredRecipients());
      } catch (e) {
        log(`failed to list registered accounts: ${errMsg(e)}`);
        setRecipients([]);
      }
    },
    [log],
  );

  const connect = useCallback(async () => {
    setError(null);
    setBusy("connecting");
    try {
      const w = await ConfidentialWallet.connect(active, log);
      setWallet(w);
      const v = await w.refresh();
      setView(v);
      if (v.receiving > 0n) setMergeNotice("incoming");
      void loadRecipients(w);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, [active, log, loadRecipients]);

  // Switching deployment invalidates the connected wallet (different token →
  // different keys, balances, and event history). Reset so the user reconnects
  // against the newly-active deployment, freeing the old wallet's cached bb.js
  // provers (workers/WASM) first.
  useEffect(() => {
    setWallet((prev) => {
      void prev?.destroy();
      return null;
    });
    setView(null);
    setRecipients(null);
    setMergeNotice(null);
    setError(null);
  }, [active.contracts.token]);

  const run = useCallback(
    (label: string, fn: (w: ConfidentialWallet) => Promise<void>) => async () => {
      if (!wallet) return;
      setError(null);
      setBusy(label);
      setPhase(null);
      try {
        await fn(wallet);
        const v = await wallet.refresh();
        setView(v);
        if (v.receiving === 0n) setMergeNotice(null);
        else if (label === "deposit") setMergeNotice("deposit");
        if (label !== "refresh") setEventsKey((k) => k + 1);
      } catch (e) {
        setError(errMsg(e));
        log(`error: ${errMsg(e)}`);
      } finally {
        setBusy(null);
        setPhase(null);
      }
    },
    [wallet, log],
  );

  const showMerge = (view?.receiving ?? 0n) > 0n;
  const activeTab: ActionTab = tab === "merge" && !showMerge ? "deposit" : tab;
  const tabs: ActionTab[] = showMerge
    ? ["deposit", "withdraw", "transfer", "merge"]
    : ["deposit", "withdraw", "transfer"];

  return (
    <PageShell
      title="Prepare the order wallets"
      subtitle="Before Ziggy initializes the order, give Buju B. a private receiving account and prepare Alberto's confidential USDC. Connect one character at a time."
      back={{ href: "/escrow", label: "Back to order walkthrough" }}
    >
      <div className="mb-6"><OrderCard compact /></div>
      <section className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Order step 1 of 5 · Place order</p>
        <h2 className="mt-1 text-lg font-semibold">Which character are you preparing?</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Buju B. only needs registration to receive. Alberto registers, deposits, and merges enough private USDC for the order.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <WalletRoleCard
            role="Buju B. · Payment receiver"
            step="Prepare to receive"
            items={[
              "Select Buju B.'s account in Freighter, then refresh this page.",
              "Connect Freighter and verify the displayed G… address.",
              "Click Register and approve the Testnet transaction.",
              "Stop when Registered is shown. The Receiver needs no deposit.",
            ]}
            success="Registered · Spendable 0 · Receiving 0"
          />
          <WalletRoleCard
            role="Alberto · Customer"
            step="Prepare to buy"
            items={[
              "Select Alberto's account in Freighter, then refresh this page.",
              "Connect, verify the G… address, and click Register.",
              "Open Deposit, enter at least 25 USDC, and approve.",
              "Open Merge and merge the entire Receiving balance.",
            ]}
            success="Registered · Receiving 0 · Spendable greater than 0"
          />
        </div>
      </section>
      <div className="mb-6"><AccountSwitchReminder /></div>

      {error && <ErrorBox className="mb-6">{error}</ErrorBox>}

      {!wallet ? (
        <button
          onClick={connect}
          disabled={busy !== null}
          className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "connecting" ? "Connecting…" : "Connect Freighter"}
        </button>
      ) : (
        <div className="space-y-6">
          <Balances view={view} assetCode={active.assetCode} />

          {view?.registered && mergeNotice && showMerge && (
            <div className="flex items-center justify-between gap-3 rounded border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-300">
              <span>
                {mergeNotice === "deposit"
                  ? `Deposit landed in your receiving balance (${stroopsToXlm(view.receiving)} ${active.assetCode}). Merge it before you can transfer or withdraw.`
                  : `You have an incoming balance of ${stroopsToXlm(view.receiving)} ${active.assetCode}. Merge it to make it spendable.`}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setTab("merge")}
                  className="rounded bg-amber-700 px-3 py-1 font-medium text-amber-100 hover:bg-amber-600"
                >
                  Go to merge
                </button>
                <button
                  onClick={() => setMergeNotice(null)}
                  className="rounded px-2 py-1 text-amber-400 hover:text-amber-200"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {!view?.registered ? (
            <section className="rounded border border-neutral-800 p-4">
              <h3 className="font-medium">Register</h3>
              <p className="mb-3 mt-0.5 text-xs text-neutral-400">
                Bind your confidential keys to the contract (one-time). All other actions unlock
                once you&apos;re registered.
              </p>
              <button
                onClick={run("register", (w) => w.register(setPhase))}
                disabled={busy !== null}
                className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy === "register" ? phaseLabel(phase) : "Register"}
              </button>
            </section>
          ) : (
            <section className="rounded border border-neutral-800">
              <div className="flex gap-2 border-b border-neutral-800 bg-neutral-900/40 p-3">
                {tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`relative flex flex-1 flex-col items-center gap-1 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                      activeTab === t
                        ? ACTIONS[t].card
                        : "border-neutral-800 bg-neutral-900/60 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                    }`}
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {ACTIONS[t].icon}
                    </span>
                    {ACTIONS[t].title}
                    {t === "merge" && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500/20 px-1.5 text-[10px] leading-4 text-emerald-300">
                        {stroopsToXlm(view.receiving)}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === "deposit" && (
                  <ActionPanel action="deposit">
                    <AmountInput value={depositAmt} onChange={setDepositAmt} assetCode={active.assetCode} className="sm:w-36" />
                    <button
                      onClick={run("deposit", (w) => w.deposit(xlmToStroops(depositAmt)))}
                      disabled={busy !== null}
                      className={`${btnCls} ${ACTIONS.deposit.btn}`}
                    >
                      {busy === "deposit" ? "Submitting tx…" : "Deposit"}
                    </button>
                  </ActionPanel>
                )}

                {activeTab === "withdraw" && (
                  <ActionPanel action="withdraw">
                    <AmountInput value={withdrawAmt} onChange={setWithdrawAmt} assetCode={active.assetCode} className="sm:w-36" />
                    <button
                      onClick={run("withdraw", (w) => w.withdraw(xlmToStroops(withdrawAmt), setPhase))}
                      disabled={busy !== null}
                      className={`${btnCls} ${ACTIONS.withdraw.btn}`}
                    >
                      {busy === "withdraw" ? phaseLabel(phase) : "Withdraw"}
                    </button>
                  </ActionPanel>
                )}

                {activeTab === "transfer" && (
                  <ActionPanel action="transfer">
                    <RecipientSelect
                      recipients={recipients}
                      value={transferTo}
                      onChange={setTransferTo}
                    />
                    <AmountInput value={transferAmt} onChange={setTransferAmt} assetCode={active.assetCode} className="sm:w-28" />
                    <button
                      onClick={run("transfer", (w) => w.transfer(transferTo, xlmToStroops(transferAmt), setPhase))}
                      disabled={busy !== null || !transferTo}
                      className={`${btnCls} ${ACTIONS.transfer.btn}`}
                    >
                      {busy === "transfer" ? phaseLabel(phase) : "Send"}
                    </button>
                  </ActionPanel>
                )}

                {activeTab === "merge" && (
                  <ActionPanel action="merge">
                    <button
                      onClick={run("merge", (w) => w.merge())}
                      disabled={busy !== null}
                      className={`${btnCls} ${ACTIONS.merge.btn}`}
                    >
                      {busy === "merge" ? "Submitting tx…" : `Merge ${stroopsToXlm(view.receiving)} ${active.assetCode}`}
                    </button>
                  </ActionPanel>
                )}
              </div>
            </section>
          )}

          <EventsPanel wallet={wallet} reloadKey={eventsKey} />

          <button
            onClick={run("refresh", async (w) => {
              void loadRecipients(w);
            })}
            disabled={busy !== null}
            className="text-sm text-neutral-400 underline hover:text-neutral-200 disabled:opacity-50"
          >
            {busy === "refresh"
              ? "Syncing…"
              : active.indexerUrl
                ? "Sync events (RPC + indexer)"
                : "Sync from RPC events"}
          </button>
        </div>
      )}

      <LogPanel logs={logs} />
    </PageShell>
  );
}

function WalletRoleCard({
  role,
  step,
  items,
  success,
}: {
  role: "Alberto · Customer" | "Buju B. · Payment receiver";
  step: string;
  items: string[];
  success: string;
}) {
  const tone = role.startsWith("Alberto")
    ? "border-sky-500/25 bg-sky-500/5 text-sky-200"
    : "border-emerald-500/25 bg-emerald-500/5 text-emerald-200";
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{role}</h3>
        <span className="text-xs opacity-80">{step}</span>
      </div>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2 text-xs leading-relaxed text-neutral-300">
            <span className="font-semibold text-current">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs">
        <strong>Done when:</strong> {success}
      </p>
    </div>
  );
}
const inputCls =
  "rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const btnCls = "rounded px-4 py-2 text-sm font-medium disabled:opacity-50";

function phaseLabel(phase: TxPhase | null): string {
  if (phase === "submitting") return "Submitting tx…";
  if (phase === "proving") return "Proving…";
  return "Preparing…";
}

function RecipientSelect(props: {
  recipients: string[] | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const { recipients, value, onChange } = props;
  const empty = recipients !== null && recipients.length === 0;
  return (
    <select
      className={`${inputCls} min-w-0 flex-1`}
      value={empty ? "" : value}
      onChange={(e) => onChange(e.target.value)}
    >
      {recipients === null ? (
        <option value="">Loading registered accounts…</option>
      ) : empty ? (
        <option value="">
          No other registered accounts yet — switch your Freighter account to load another
          address, register it, then refresh this page
        </option>
      ) : (
        <>
          <option value="">Select recipient…</option>
          {recipients.map((a) => (
            <option key={a} value={a}>
              {`${a.slice(0, 12)}…${a.slice(-12)}`}
            </option>
          ))}
        </>
      )}
    </select>
  );
}

function ActionPanel(props: { action: ActionTab; children: React.ReactNode }) {
  const meta = ACTIONS[props.action];
  return (
    <div className={`rounded-md border p-4 ${meta.panel}`}>
      <p className="mb-3 text-xs text-neutral-400">{meta.hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{props.children}</div>
    </div>
  );
}

function Balances({ view, assetCode }: { view: WalletView | null; assetCode: string }) {
  if (!view) return null;
  return (
    <section className="rounded border border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Addr value={view.address} full className="text-sm text-neutral-400" />
        {view.matchesChain !== null && (
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              view.matchesChain ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"
            }`}
            title="Local reconstruction re-committed and compared to on-chain commitments"
          >
            {view.matchesChain ? "state matches chain ✓" : "state mismatch ✗"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Spendable" value={stroopsToXlm(view.spendable)} assetCode={assetCode} />
        <Stat label="Receiving" value={stroopsToXlm(view.receiving)} assetCode={assetCode} />
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        {view.registered ? `synced through ledger ${view.syncedLedger}` : "not registered yet"}
      </p>
    </section>
  );
}

function Stat({ label, value, assetCode }: { label: string; value: string; assetCode: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-2xl">
        {value} <span className="text-sm text-neutral-500">{assetCode}</span>
      </div>
    </div>
  );
}

/** Seven-decimal asset amount field with a trailing unit chip. */
function AmountInput({
  value,
  onChange,
  className = "",
  assetCode,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  assetCode: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        className={`${inputCls} w-full pr-12`}
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
        {assetCode}
      </span>
    </div>
  );
}
