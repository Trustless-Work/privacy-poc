"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OnChainEscrow } from "@ctd/sdk";
import { ConfidentialWallet, type TxPhase, type WalletView } from "@/lib/wallet";
import { useActiveDeployment } from "@/lib/active-deployment";
import { clientsFor } from "@/lib/rpc";
import { errMsg } from "@/lib/err";
import { stroopsToXlm, xlmToStroops } from "@/lib/format";
import { useLog } from "@/lib/use-log";
import { PageShell } from "../../page-shell";
import { ErrorBox } from "../../error-box";
import { LogPanel } from "../../log-panel";
import { EscrowStateCard } from "../escrow-state";
import { AccountSwitchReminder, BeginnerGuide } from "../guide";
import { ActorContext } from "../green-road-order";

export default function PayerPage() {
  const { active } = useActiveDeployment();
  const escrowAddress = active.contracts.escrow;
  const [state, setState] = useState<OnChainEscrow | null>(null);
  const [wallet, setWallet] = useState<ConfidentialWallet | null>(null);
  const [view, setView] = useState<WalletView | null>(null);
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, log] = useLog(40);

  const refreshState = useCallback(async () => {
    if (!escrowAddress) return setState(null);
    setState(await clientsFor(active).client.escrowState(escrowAddress));
  }, [active, escrowAddress]);

  useEffect(() => { void refreshState(); }, [refreshState]);
  useEffect(() => () => { void wallet?.destroy(); }, [wallet]);

  const connect = async () => {
    setBusy("connect"); setError(null);
    try {
      const next = await ConfidentialWallet.connect(active, log);
      setWallet(next);
      setView(await next.refresh());
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  };

  const fund = async () => {
    if (!wallet || !escrowAddress) return;
    setBusy("fund"); setError(null); setPhase(null);
    try {
      const latest = await clientsFor(active).client.latestLedger();
      await wallet.fundEscrow(escrowAddress, xlmToStroops(amount), latest + 120_960, setPhase);
      setView(await wallet.refresh());
      await refreshState();
    } catch (e) { setError(errMsg(e)); log(`error: ${errMsg(e)}`); }
    finally { setBusy(null); setPhase(null); }
  };

  const ready = Boolean(
    state?.status === "Initialized"
      && view?.registered
      && view.matchesChain !== false
      && wallet?.address === state.payer,
  );

  return (
    <PageShell title="Alberto funds the order" subtitle="Act as the customer and fund order #GR-001 without publishing its 25 USDC amount on-chain." back={{ href: "/escrow", label: "Back to order walkthrough" }}>
      {!escrowAddress && <ErrorBox className="mb-6">No order escrow is selected. Ask Ziggy to open one first.</ErrorBox>}
      {error && <ErrorBox className="mb-6">{error}</ErrorBox>}
      <div className="space-y-6">
        <ActorContext actor="Alberto">Connect Alberto&apos;s Freighter account. The expected customer address is shown in the order escrow below.</ActorContext>
        <BeginnerGuide
          step="Order step 3 of 5"
          title="Lock the order payment"
          account="Alberto · Customer"
          before={[
            "Freighter is on Testnet and Alberto's account is selected.",
            "Shared escrow state says Initialized.",
            "The Payer is registered and has a positive Spendable USDC balance in Wallet.",
          ]}
          actions={[
            "Connect Alberto's wallet below.",
            "Confirm the connected G… address matches Alberto in Order escrow state.",
            "Enter 25 USDC, no greater than the displayed Spendable balance.",
            "Click Lock order payment, approve Freighter, and wait for proof generation.",
          ]}
          expected="Shared escrow state changes from “Initialized” to “Funded”."
          next={{ href: "/escrow/approver", label: "switch to Ziggy after the package is delivered" }}
        />
        <AccountSwitchReminder />
        <EscrowStateCard state={state} />
        {!wallet ? (
          <button onClick={connect} disabled={busy !== null || !escrowAddress} className="nb-action px-4 py-2 disabled:opacity-50">
            {busy === "connect" ? "Connecting…" : "Connect as Alberto"}
          </button>
        ) : (
          <section className="nb-panel-action">
            <h2 className="nb-panel-title">Order payment</h2>
            <p className="nb-copy-muted mt-2 text-xs">
              Alberto connected: {wallet.address}. Private spendable: {view ? stroopsToXlm(view.spendable) : "—"} USDC.
            </p>
            {!view?.registered && <p className="nb-alert mt-3 text-sm">Not ready: open Wallet, register this Payer account, deposit USDC, then merge it.</p>}
            {view?.registered && view.spendable === 0n && <p className="nb-alert mt-3 text-sm">Not ready: Spendable is 0 USDC. Deposit USDC in Wallet and merge the Receiving balance first.</p>}
            {view?.matchesChain === false && (
              <p className="nb-alert mt-3 text-sm">
                Funding is paused because this browser cannot reconstruct Alberto&apos;s latest
                private balance checkpoint. Open Wallet for recovery guidance; do not generate a
                funding proof from mismatched state.
              </p>
            )}
            {state && wallet.address !== state.payer && <p className="nb-alert mt-3 text-sm">This wallet is not the configured payer.</p>}
            {state?.status !== "Initialized" && <p className="nb-alert mt-3 text-sm">Not ready: escrow status must be Initialized.</p>}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="nb-field-label">Private order amount
                <span className="mt-1 flex items-center gap-2">
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="nb-field mt-0 w-32 text-sm" />
                  <span className="nb-chip px-3 py-2">USDC</span>
                </span>
              </label>
              <button onClick={fund} disabled={!ready || busy !== null} className="nb-action px-4 py-2 text-sm disabled:opacity-50">
                {busy === "fund" ? (phase === "proving" ? "Generating privacy proof…" : "Locking payment…") : "Lock order payment"}
              </button>
            </div>
            <p className="nb-copy-muted mt-3 text-xs">The allowance expires after roughly seven days. The amount is known to participants but never appears in the escrow call or storage.</p>
            <Link href="/wallet" className="mt-4 inline-block text-xs font-black text-orange-600 underline decoration-2 underline-offset-4 hover:text-orange-500">Need a Spendable balance? Open Wallet preparation →</Link>
          </section>
        )}
        <LogPanel logs={logs} />
      </div>
    </PageShell>
  );
}
