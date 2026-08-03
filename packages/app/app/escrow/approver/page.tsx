"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnChainEscrow } from "@ctd/sdk";
import { SingletonEscrow, type EscrowCreatePhase } from "@/lib/escrow";
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
  const { active, escrows, setActiveEscrow } = useActiveDeployment();
  const escrowAddress = active.contracts.escrow;
  const [controller, setController] = useState<SingletonEscrow | null>(null);
  const [state, setState] = useState<OnChainEscrow | null>(null);
  const [payer, setPayer] = useState("");
  const [receiver, setReceiver] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(!escrowAddress);
  const [phase, setPhase] = useState<EscrowCreatePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, log] = useLog(40);

  const approver = controller?.approverAddress ?? "";
  const cleanPayer = payer.trim();
  const cleanReceiver = receiver.trim();
  const addressPattern = /^G[A-Z2-7]{55}$/;
  const roleError = (() => {
    if (!cleanPayer || !cleanReceiver) return null;
    if (!addressPattern.test(cleanPayer)) return "The payer address is not a valid Stellar G… address.";
    if (!addressPattern.test(cleanReceiver)) return "The receiver address is not a valid Stellar G… address.";
    if (cleanPayer === cleanReceiver) {
      return "Payer and Receiver must be different Stellar accounts.";
    }
    if (approver && (cleanPayer === approver || cleanReceiver === approver)) {
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
  useEffect(() => {
    setError(null);
    setShowCreate(!escrowAddress);
    if (controller && controller.address !== escrowAddress) setController(null);
  }, [controller, escrowAddress]);

  const connect = async () => {
    setBusy("connect"); setError(null);
    try { setController(await SingletonEscrow.connect(active, log)); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  };

  const create = async () => {
    setBusy("create"); setPhase(null); setError(null);
    try {
      const created = await SingletonEscrow.create(
        active,
        cleanPayer,
        cleanReceiver,
        log,
        setPhase,
        setActiveEscrow,
      );
      setController(created);
      setState(await created.state());
      setShowCreate(false);
    } catch (e) {
      setError(errMsg(e)); log(`error: ${errMsg(e)}`);
    } finally {
      setBusy(null); setPhase(null);
    }
  };

  const startCreate = () => {
    setPayer(state?.payer || "");
    setReceiver(state?.receiver || "");
    setError(null);
    setShowCreate(true);
  };

  const run = (label: string, action: (c: SingletonEscrow) => Promise<void>) => async () => {
    if (!controller) return;
    setBusy(label); setPhase(null); setError(null);
    try {
      await action(controller);
      await refresh();
      if (label === "initialize") setShowCreate(false);
    }
    catch (e) { setError(errMsg(e)); log(`error: ${errMsg(e)}`); }
    finally { setBusy(null); setPhase(null); }
  };

  return (
    <PageShell title="Escrow approver" subtitle="Create a fresh escrow with Freighter, then approve its milestone and atomically release the complete private allowance.">
      {!active.contracts.factory && <ErrorBox className="mb-6">No shared escrow factory is configured. Run the one-time Testnet protocol deployment first.</ErrorBox>}
      {error && <ErrorBox className="mb-6">{error}</ErrorBox>}
      <div className="space-y-6">
        {!state ? (
          <BeginnerGuide
            step="Step 4 of 7"
            title="Create the escrow as the approver"
            account="Escrow Approver"
            before={[
              "Freighter is on Testnet and the Approver account is selected.",
              "You have copied the Payer and Receiver public G… addresses.",
              "Payer, Receiver, and Approver are three different accounts.",
            ]}
            actions={[
              "Paste the Payer address and the Receiver address in the correct fields.",
              "Check that neither address matches the connected Approver address.",
              "Click Create escrow with Freighter and approve the deployment request.",
              "Sign the escrow key message, then approve the initialization request.",
            ]}
            expected="A new escrow contract is created, selected in the app, and shows Initialized with all three roles."
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
        {escrowAddress && !state && (
          <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-5">
            <h2 className="font-semibold text-amber-200">Resume a deployed escrow</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              This escrow was deployed but is not initialized yet. This can happen if the second
              Freighter request was cancelled or failed. Reconnect, keep the same Payer and Receiver,
              and finish initialization instead of deploying another contract.
            </p>
            {!controller ? (
              <button onClick={connect} disabled={busy !== null} className="mt-4 rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500 disabled:opacity-50">
                {busy === "connect" ? "Connecting…" : "Connect Approver to resume"}
              </button>
            ) : (
              <button onClick={run("initialize", (c) => c.initialize(cleanPayer, cleanReceiver, setPhase))} disabled={busy !== null || !cleanPayer || !cleanReceiver || Boolean(roleError)} className="mt-4 rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500 disabled:opacity-50">
                {busy === "initialize" ? (phase === "proving" ? "Generating proof…" : "Finishing initialization…") : "Finish initialization"}
              </button>
            )}
          </section>
        )}
        {(showCreate || !state) && (
          <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-5">
            <h2 className="font-semibold">Create a fresh escrow</h2>
            <p className="mt-2 text-xs text-neutral-400">The Freighter account you select becomes the Approver. You may reuse the same three role addresses; every click deploys a separate contract with fresh state.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AddressInput label="Payer address" value={payer} onChange={setPayer} />
              <AddressInput label="Receiver address" value={receiver} onChange={setReceiver} />
            </div>
            {roleError && <ErrorBox className="mt-3" size="sm">{roleError}</ErrorBox>}
            <button onClick={create} disabled={busy !== null || !active.contracts.factory || !cleanPayer || !cleanReceiver || Boolean(roleError)} className="mt-4 rounded bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
              {busy === "create"
                ? phase === "deploying" ? "Deploying escrow…" : phase === "proving" ? "Generating proof…" : "Initializing escrow…"
                : "Create escrow with Freighter"}
            </button>
          </section>
        )}
        {state && !showCreate && (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-5">
            <h2 className="font-semibold">Escrow instances</h2>
            <p className="mt-2 text-xs text-neutral-400">You have {escrows.length || 1} escrow{(escrows.length || 1) === 1 ? "" : "s"} in this deployment. Use the Escrow selector in the top bar to switch instances.</p>
            <button type="button" onClick={startCreate} disabled={busy !== null} className="mt-4 rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-violet-500 hover:text-white disabled:opacity-50">
              Create new escrow instance
            </button>
          </section>
        )}
        {state && !showCreate && !controller && (
          <button onClick={connect} disabled={busy !== null} className="rounded bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500 disabled:opacity-50">
            {busy === "connect" ? "Connecting…" : "Connect approver wallet"}
          </button>
        )}
        {state && !showCreate && controller && (
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
