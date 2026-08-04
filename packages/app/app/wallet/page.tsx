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
import { OrderCard } from "../escrow/green-road-order";

type ActionTab = "deposit" | "withdraw" | "transfer" | "merge";

const ACTIONS: Record<
  ActionTab,
  { icon: string; title: string; hint: string; active: string; panel: string; btn: string }
> = {
  deposit: {
    icon: "↓",
    title: "Deposit",
    hint: "Public underlying asset → your receiving balance.",
    active: "nb-wallet-action-tab--deposit",
    panel: "nb-panel-guide",
    btn: "nb-action",
  },
  withdraw: {
    icon: "↑",
    title: "Withdraw",
    hint: "Spendable → public underlying asset (to yourself).",
    active: "nb-wallet-action-tab--action",
    panel: "nb-panel-action",
    btn: "nb-action",
  },
  transfer: {
    icon: "→",
    title: "Transfer",
    hint: "Send to another registered account's receiving balance — amount stays private.",
    active: "nb-wallet-action-tab--action",
    panel: "nb-panel-action",
    btn: "nb-action",
  },
  merge: {
    icon: "⊕",
    title: "Merge",
    hint: "Fold your receiving balance into spendable.",
    active: "nb-wallet-action-tab--merge",
    panel: "nb-panel-success",
    btn: "nb-secondary-action",
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

  const [depositAmt, setDepositAmt] = useState("25");
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
  const stateMismatch = view?.matchesChain === false;

  return (
    <PageShell
      title="Prepare the order wallets"
      subtitle="Before Ziggy initializes the order, give Buju B. a private receiving account and prepare Alberto's confidential USDC. Connect one character at a time."
      back={{ href: "/escrow", label: "Back to order walkthrough" }}
    >
      <div className="mb-6"><OrderCard compact /></div>
      <section className="nb-wallet-steps mb-6">
        <p className="nb-kicker">Order step 1 of 5 · Place order</p>
        <h2 className="mt-4 text-xl font-black uppercase">Which character are you preparing?</h2>
        <p className="nb-copy-muted mt-2 text-sm leading-relaxed">
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
          className="nb-action px-5 py-3 disabled:opacity-50"
        >
          {busy === "connecting" ? "Connecting…" : "Connect Freighter"}
        </button>
      ) : (
        <div className="space-y-6">
          <Balances view={view} assetCode={active.assetCode} />

          {view?.registered && mergeNotice && showMerge && (
            <div className="nb-alert flex flex-col justify-between gap-3 text-sm sm:flex-row sm:items-center">
              <span>
                {mergeNotice === "deposit"
                  ? `Deposit landed in your receiving balance (${stroopsToXlm(view.receiving)} ${active.assetCode}). Merge it before you can transfer or withdraw.`
                  : `You have an incoming balance of ${stroopsToXlm(view.receiving)} ${active.assetCode}. Merge it to make it spendable.`}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setTab("merge")}
                  className="nb-secondary-action px-3 py-1.5 text-xs"
                >
                  Go to merge
                </button>
                <button
                  onClick={() => setMergeNotice(null)}
                  className="nb-control px-2 py-1 text-xs"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {!view?.registered ? (
            <section className="nb-panel-action">
              <p className="nb-kicker">One-time setup</p>
              <h3 className="nb-panel-title mt-3">Register this private wallet</h3>
              <p className="nb-copy-muted mb-4 mt-1 text-xs">
                Bind your confidential keys to the contract (one-time). All other actions unlock
                once you&apos;re registered.
              </p>
              <button
                onClick={run("register", (w) => w.register(setPhase))}
                disabled={busy !== null}
                className="nb-action px-4 py-2 disabled:opacity-50"
              >
                {busy === "register" ? phaseLabel(phase) : "Register"}
              </button>
            </section>
          ) : (
            <section className="nb-panel p-0">
              <div className="grid grid-cols-2 gap-2 border-b-[3px] border-neutral-950 bg-amber-300 p-3 sm:grid-cols-4">
                {tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`nb-wallet-action-tab relative flex flex-col items-center gap-1 py-2.5 text-sm font-black uppercase transition-colors ${
                      activeTab === t
                        ? ACTIONS[t].active
                        : "nb-wallet-action-tab--idle"
                    }`}
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {ACTIONS[t].icon}
                    </span>
                    {ACTIONS[t].title}
                    {t === "merge" && (
                      <span className="absolute right-1.5 top-1.5 border border-neutral-950 bg-lime-500 px-1.5 text-[10px] leading-4 text-neutral-950">
                        {stroopsToXlm(view.receiving)}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-5">
                {activeTab === "deposit" && (
                  <ActionPanel action="deposit">
                    <AmountInput value={depositAmt} onChange={setDepositAmt} assetCode={active.assetCode} className="sm:w-36" />
                    <button
                      onClick={run("deposit", (w) => w.deposit(xlmToStroops(depositAmt)))}
                      disabled={busy !== null || stateMismatch}
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
                      disabled={busy !== null || stateMismatch}
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
                      disabled={busy !== null || !transferTo || stateMismatch}
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
                      disabled={busy !== null || stateMismatch}
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
            className="nb-control px-4 py-2 text-sm disabled:opacity-50"
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
  const tone = role.startsWith("Alberto") ? "nb-wallet-role-card--customer" : "nb-wallet-role-card--receiver";
  return (
    <div className={`nb-wallet-role-card ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black uppercase">{role}</h3>
        <span className="nb-wallet-role-step px-2 py-0.5 text-[10px]">{step}</span>
      </div>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={item} className="nb-wallet-role-copy flex gap-2 text-xs font-medium leading-relaxed">
            <span className="font-black">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t-2 border-[var(--nb-ink)] pt-3 text-xs">
        <strong>Done when:</strong> {success}
      </p>
    </div>
  );
}
const inputCls = "nb-field mt-0 px-3 py-2 text-sm outline-none";
const btnCls = "px-4 py-2 text-sm disabled:opacity-50";

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
    <div className={meta.panel}>
      <p className="nb-copy-muted mb-3 text-xs font-bold">{meta.hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{props.children}</div>
    </div>
  );
}

function Balances({ view, assetCode }: { view: WalletView | null; assetCode: string }) {
  if (!view) return null;
  return (
    <section className="nb-panel">
      <div className="mb-3 flex items-center justify-between">
        <Addr value={view.address} full className="nb-copy-muted text-sm" />
        {view.matchesChain !== null && (
          <span
            className={`border-2 border-neutral-950 px-2 py-0.5 text-xs font-black uppercase shadow-[2px_2px_0_#151515] ${
              view.matchesChain ? "bg-lime-500 text-neutral-950" : "bg-red-500 text-white"
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
      <p className="nb-copy-muted mt-3 text-xs font-bold">
        {view.registered ? `synced through ledger ${view.syncedLedger}` : "not registered yet"}
      </p>
      {view.matchesChain === false && (
        <div className="nb-alert mt-4 text-sm">
          <strong>Private balance recovery required.</strong> This browser does not have the
          latest private checkpoint for this account, so balance-changing actions are paused to
          prevent an invalid proof. Use the browser where this account last funded an escrow, or
          prepare a fresh Testnet account for this deployment.
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, assetCode }: { label: string; value: string; assetCode: string }) {
  return (
    <div className="nb-stat">
      <div className="nb-field-label">{label}</div>
      <div className="mt-1 text-2xl font-black">
        {value} <span className="nb-copy-muted text-sm">{assetCode}</span>
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
      <span className="nb-copy-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-black">
        {assetCode}
      </span>
    </div>
  );
}
