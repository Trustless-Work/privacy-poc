"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnChainEscrow } from "@ctd/sdk";
import { SingletonEscrow, type EscrowTxPhase } from "@/lib/escrow";
import { useActiveDeployment } from "@/lib/active-deployment";
import { clientsFor } from "@/lib/rpc";
import { errMsg } from "@/lib/err";
import { useLog } from "@/lib/use-log";
import { PageShell } from "../../page-shell";
import { ErrorBox } from "../../error-box";
import { LogPanel } from "../../log-panel";
import { EscrowStateCard } from "../escrow-state";
import { AccountSwitchReminder, BeginnerGuide } from "../guide";

export default function ApproverPage() {
  const { active } = useActiveDeployment();
  const escrowAddress = active.contracts.escrow;
  const [controller, setController] = useState<SingletonEscrow | null>(null);
  const [state, setState] = useState<OnChainEscrow | null>(null);
  const [payer, setPayer] = useState("");
  const [receiver, setReceiver] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<EscrowTxPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, log] = useLog(40);

  const approver = controller?.approverAddress ?? "";
  const cleanPayer = payer.trim();
  const cleanReceiver = receiver.trim();
  const addressPattern = /^G[A-Z2-7]{55}$/;
  const roleError = (() => {
    if (!cleanPayer || !cleanReceiver || !approver) return null;
    if (!addressPattern.test(cleanPayer)) return "The payer address is not a valid Stellar G… address.";
    if (!addressPattern.test(cleanReceiver)) return "The receiver address is not a valid Stellar G… address.";
    if (cleanPayer === cleanReceiver || cleanPayer === approver || cleanReceiver === approver) {
      return "Payer, receiver, and approver must be three different accounts.";
    }
    return null;
  })();

  const refresh = useCallback(async () => {
    if (!escrowAddress) return setState(null);
    setState(await clientsFor(active).client.escrowState(escrowAddress));
  }, [active, escrowAddress]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { void controller?.destroy(); }, [controller]);

  const connect = async () => {
    setBusy("connect"); setError(null);
    try { setController(await SingletonEscrow.connect(active, log)); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  };

  const run = (label: string, action: (c: SingletonEscrow) => Promise<void>) => async () => {
    if (!controller) return;
    setBusy(label); setPhase(null); setError(null);
    try { await action(controller); await refresh(); }
    catch (e) { setError(errMsg(e)); log(`error: ${errMsg(e)}`); }
    finally { setBusy(null); setPhase(null); }
  };

  return (
    <PageShell title="Escrow approver" subtitle="Initialize the one shared contract once, then approve the milestone and atomically release its complete private allowance.">
      {!escrowAddress && <ErrorBox className="mb-6">No singleton escrow is configured. Run the testnet deployment first.</ErrorBox>}
      {error && <ErrorBox className="mb-6">{error}</ErrorBox>}
      <div className="space-y-6">
        {!state ? (
          <BeginnerGuide
            step="Step 4 of 7"
            title="Initialize the escrow as the approver"
            account="Escrow Approver"
            before={[
              "Freighter is on Testnet and the Approver account is selected.",
              "You have copied the Payer and Receiver public G… addresses.",
              "Payer, Receiver, and Approver are three different accounts.",
            ]}
            actions={[
              "Connect the approver wallet below.",
              "Paste the Payer address and the Receiver address in the correct fields.",
              "Check that neither address matches the connected Approver address.",
              "Click Initialize singleton escrow and approve the Freighter request.",
            ]}
            expected="Shared escrow state changes from “Not initialized” to “Initialized” and shows all three roles."
            next={{ href: "/escrow/payer", label: "switch to the Payer account and fund the milestone" }}
          />
        ) : (
          <BeginnerGuide
            step="Step 6 of 7"
            title="Approve and release the full payment"
            account="Escrow Approver"
            before={[
              "Freighter is on Testnet and the configured Approver account is selected.",
              "Shared escrow state says Funded. If it says Initialized, the Payer must fund it first.",
              "The Receiver was registered in the confidential wallet before release.",
            ]}
            actions={[
              "Connect the approver wallet below.",
              "Confirm the connected address matches the Approver shown in Shared escrow state.",
              "Click Approve & release all and approve the Freighter request.",
              "Wait while the app generates the proof and submits the transaction.",
            ]}
            expected="Shared escrow state changes to “Released”."
            next={{ href: "/escrow/receiver", label: "switch to the Receiver account and collect the payment" }}
          />
        )}
        <AccountSwitchReminder />
        <EscrowStateCard state={state} />
        {!controller ? (
          <button onClick={connect} disabled={busy !== null || !escrowAddress} className="rounded bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500 disabled:opacity-50">
            {busy === "connect" ? "Connecting…" : "Connect approver wallet"}
          </button>
        ) : !state ? (
          <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-5">
            <h2 className="font-semibold">Initialize fixed roles</h2>
            <p className="mt-2 text-xs text-neutral-400">This can happen only once. The connected wallet becomes the approver.</p>
            <p className="mt-3 rounded border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-300">
              Connected Approver: <span className="break-all font-mono">{approver}</span>
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AddressInput label="Payer address" value={payer} onChange={setPayer} />
              <AddressInput label="Receiver address" value={receiver} onChange={setReceiver} />
            </div>
            {roleError && <ErrorBox className="mt-3" size="sm">{roleError}</ErrorBox>}
            <button onClick={run("initialize", (c) => c.initialize(cleanPayer, cleanReceiver, setPhase))} disabled={busy !== null || !cleanPayer || !cleanReceiver || Boolean(roleError)} className="mt-4 rounded bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
              {busy === "initialize" ? (phase === "proving" ? "Generating proof…" : "Initializing…") : "Initialize singleton escrow"}
            </button>
          </section>
        ) : (
          <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-5">
            <h2 className="font-semibold">Approve and release</h2>
            <p className="mt-2 text-sm text-neutral-300">One approval releases the entire confidential allowance. No amount or receiver can be edited here.</p>
            {controller.approverAddress !== state.approver && <p className="mt-3 text-sm text-amber-300">The connected wallet is not the configured approver.</p>}
            <button onClick={run("release", (c) => c.approveAndRelease(setPhase))} disabled={busy !== null || state.status !== "Funded" || controller.approverAddress !== state.approver} className="mt-4 rounded bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
              {busy === "release" ? (phase === "proving" ? "Proving full release…" : "Submitting release…") : state.status === "Released" ? "Already released" : "Approve & release all"}
            </button>
          </section>
        )}
        <LogPanel logs={logs} />
      </div>
    </PageShell>
  );
}

function AddressInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs text-neutral-400">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder="G…" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-violet-500" /></label>;
}
