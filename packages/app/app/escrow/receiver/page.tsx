"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnChainEscrow } from "@ctd/sdk";
import { ConfidentialWallet, type WalletView } from "@/lib/wallet";
import { useActiveDeployment } from "@/lib/active-deployment";
import { clientsFor } from "@/lib/rpc";
import { errMsg } from "@/lib/err";
import { stroopsToXlm } from "@/lib/format";
import { useLog } from "@/lib/use-log";
import { PageShell } from "../../page-shell";
import { ErrorBox } from "../../error-box";
import { LogPanel } from "../../log-panel";
import { EscrowStateCard } from "../escrow-state";
import { AccountSwitchReminder, BeginnerGuide } from "../guide";

export default function ReceiverPage() {
  const { active } = useActiveDeployment();
  const escrowAddress = active.contracts.escrow;
  const [state, setState] = useState<OnChainEscrow | null>(null);
  const [wallet, setWallet] = useState<ConfidentialWallet | null>(null);
  const [view, setView] = useState<WalletView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
    try { const next = await ConfidentialWallet.connect(active, log); setWallet(next); setView(await next.refresh()); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  };
  const merge = async () => {
    if (!wallet) return;
    setBusy("merge"); setError(null);
    try { await wallet.merge(); setView(await wallet.refresh()); await refreshState(); }
    catch (e) { setError(errMsg(e)); log(`error: ${errMsg(e)}`); }
    finally { setBusy(null); }
  };

  const isReceiver = Boolean(wallet && state && wallet.address === state.receiver);
  return (
    <PageShell title="Escrow receiver" subtitle="Discover the released confidential USDC and merge it from receiving into the receiver's spendable private balance.">
      {!escrowAddress && <ErrorBox className="mb-6">No singleton escrow is configured. Run the testnet deployment first.</ErrorBox>}
      {error && <ErrorBox className="mb-6">{error}</ErrorBox>}
      <div className="space-y-6">
        <BeginnerGuide
          step="Step 7 of 7"
          title="Collect the payment as the receiver"
          account="Escrow Receiver"
          before={[
            "Freighter is on Testnet and the configured Receiver account is selected.",
            "The Receiver was registered on the Wallet page before the release.",
            "Shared escrow state says Released.",
          ]}
          actions={[
            "Connect the receiver wallet below.",
            "Confirm the connected G… address matches the Receiver in Shared escrow state.",
            "Wait for Receiving to show the incoming USDC amount.",
            "Click Merge received funds and approve the Freighter request.",
          ]}
          expected="Receiving becomes 0 USDC and Spendable increases by the released amount. The demo is complete."
        />
        <AccountSwitchReminder />
        <EscrowStateCard state={state} />
        {!wallet ? <button onClick={connect} disabled={busy !== null || !escrowAddress} className="rounded bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50">{busy === "connect" ? "Connecting…" : "Connect receiver wallet"}</button> : (
          <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-5">
            <h2 className="font-semibold">Receive and merge</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-neutral-500">Receiving</dt><dd className="mt-1 text-lg font-semibold">{view ? stroopsToXlm(view.receiving) : "—"} USDC</dd></div><div><dt className="text-neutral-500">Spendable</dt><dd className="mt-1 text-lg font-semibold">{view ? stroopsToXlm(view.spendable) : "—"} USDC</dd></div></dl>
            {!isReceiver && <p className="mt-3 text-sm text-amber-300">This wallet is not the configured receiver.</p>}
            {isReceiver && !view?.registered && <p className="mt-3 text-sm text-amber-300">Not ready: register this Receiver account on the Wallet page first.</p>}
            {isReceiver && state?.status !== "Released" && <p className="mt-3 text-sm text-amber-300">Not ready: the Approver must release the escrow first.</p>}
            {isReceiver && view?.registered && view.receiving === 0n && state?.status === "Released" && <p className="mt-3 text-sm text-amber-300">No receiving balance found yet. Sync the wallet or refresh this page, then check again.</p>}
            <button onClick={merge} disabled={busy !== null || !isReceiver || !view?.registered || view.receiving === 0n} className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">{busy === "merge" ? "Merging…" : "Merge received funds"}</button>
          </section>
        )}
        <LogPanel logs={logs} />
      </div>
    </PageShell>
  );
}
