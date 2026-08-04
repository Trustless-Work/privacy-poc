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
import { ActorContext } from "../irie-order";

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
    <PageShell title="Ziggy runs the order" subtitle="Act as the store operator: initialize Alberto's order, deliver the product, then release payment to Buju B." back={{ href: "/escrow", label: "Back to order walkthrough" }}>
      {!active.contracts.factory && <ErrorBox className="mb-6">No shared escrow factory is configured. Run the one-time Testnet protocol deployment first.</ErrorBox>}
      {error && <ErrorBox className="mb-6">{error}</ErrorBox>}
      <div className="space-y-6">
        <ActorContext actor="Ziggy">Ziggy takes Alberto&apos;s order, initializes its escrow, delivers the product, and confirms the real-world handoff.</ActorContext>
        {!state ? (
          <BeginnerGuide
            step="Order step 2 of 5"
            title="Open escrow for order #IRIE-001"
            account="Ziggy · Store operator"
            before={[
              "Freighter is on Testnet and Ziggy's account is selected.",
              "You have copied Alberto's and Buju B.'s public G… addresses.",
              "Payer, Receiver, and Approver are three different accounts.",
            ]}
            actions={[
              "Paste Alberto's address as Customer and Buju B.'s as Payment receiver.",
              "Check that neither address matches Ziggy's connected address.",
              "Click Open order escrow and approve the deployment request.",
              "Sign the escrow key message, then approve the initialization request.",
            ]}
            expected="A new escrow contract is created, selected in the app, and shows Initialized with all three roles."
            next={{ href: "/escrow/payer", label: "switch to Alberto and lock the order payment" }}
          />
        ) : (
          <BeginnerGuide
            step="Order step 4 of 5"
            title="Confirm delivery and release"
            account="Ziggy · Store operator"
            before={[
              "Freighter is on Testnet and Ziggy's account is selected.",
              "Shared escrow state says Funded. If it says Initialized, the Payer must fund it first.",
              "The Receiver was registered in the confidential wallet before release.",
            ]}
            actions={[
              "Connect Ziggy's wallet below.",
              "Confirm the connected address matches Ziggy in Order escrow state.",
              "Click Confirm delivery & release and approve the Freighter request.",
              "Wait while the app generates the proof and submits the transaction.",
            ]}
            expected="Shared escrow state changes to “Released”."
            next={{ href: "/escrow/receiver", label: "hand off to Buju B. so he can collect the private payment" }}
          />
        )}
        <AccountSwitchReminder />
        <EscrowStateCard state={state} />
        {escrowAddress && !state && (
          <section className="nb-panel-guide">
            <h2 className="nb-panel-title">Resume a deployed escrow</h2>
            <p className="nb-copy-muted mt-2 text-xs leading-relaxed">
              This escrow was deployed but is not initialized yet. This can happen if the second
              Freighter request was cancelled or failed. Reconnect, keep the same Payer and Receiver,
              and finish initialization instead of deploying another contract.
            </p>
            {!controller ? (
              <button onClick={connect} disabled={busy !== null} className="nb-secondary-action mt-4 px-4 py-2 text-sm disabled:opacity-50">
                {busy === "connect" ? "Connecting…" : "Connect Approver to resume"}
              </button>
            ) : (
              <button onClick={run("initialize", (c) => c.initialize(cleanPayer, cleanReceiver, setPhase))} disabled={busy !== null || !cleanPayer || !cleanReceiver || Boolean(roleError)} className="nb-secondary-action mt-4 px-4 py-2 text-sm disabled:opacity-50">
                {busy === "initialize" ? (phase === "proving" ? "Generating proof…" : "Finishing initialization…") : "Finish initialization"}
              </button>
            )}
          </section>
        )}
        {(showCreate || !state) && (
          <section className="nb-panel-action">
            <h2 className="nb-panel-title">Open a fresh order escrow</h2>
            <p className="nb-copy-muted mt-2 text-xs">The connected Freighter account becomes Ziggy, the store operator and technical approver. Each order gets a separate contract with fresh state.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AddressInput label="Alberto · Customer address" value={payer} onChange={setPayer} />
              <AddressInput label="Buju B. · Payment receiver address" value={receiver} onChange={setReceiver} />
            </div>
            {roleError && <ErrorBox className="mt-3" size="sm">{roleError}</ErrorBox>}
            <button onClick={create} disabled={busy !== null || !active.contracts.factory || !cleanPayer || !cleanReceiver || Boolean(roleError)} className="nb-action mt-4 px-4 py-2 text-sm disabled:opacity-50">
              {busy === "create"
                ? phase === "deploying" ? "Deploying escrow…" : phase === "proving" ? "Generating proof…" : "Initializing escrow…"
                : "Open order escrow"}
            </button>
          </section>
        )}
        {state && !showCreate && (
          <section className="nb-panel">
            <h2 className="nb-panel-title">Escrow instances</h2>
            <p className="nb-copy-muted mt-2 text-xs">You have {escrows.length || 1} escrow{(escrows.length || 1) === 1 ? "" : "s"} in this deployment. Use the Escrow selector in the top bar to switch instances.</p>
            <button type="button" onClick={startCreate} disabled={busy !== null} className="nb-secondary-action mt-4 px-4 py-2 text-sm disabled:opacity-50">
              Create new escrow instance
            </button>
          </section>
        )}
        {state && !showCreate && !controller && (
          <button onClick={connect} disabled={busy !== null} className="nb-action px-4 py-2 disabled:opacity-50">
            {busy === "connect" ? "Connecting…" : "Connect as Ziggy"}
          </button>
        )}
        {state && !showCreate && controller && (
          <section className="nb-panel-success">
            <h2 className="nb-panel-title">Delivery confirmation</h2>
            <p className="nb-copy-muted mt-2 text-sm">Ziggy has delivered the package. One confirmation releases the complete private payment to Buju B.; the amount and recipient cannot be edited here.</p>
            {controller.approverAddress !== state.approver && <p className="nb-alert mt-3 text-sm">The connected wallet is not the configured approver.</p>}
            <button onClick={run("release", (c) => c.approveAndRelease(setPhase))} disabled={busy !== null || state.status !== "Funded" || controller.approverAddress !== state.approver} className="nb-action mt-4 px-4 py-2 text-sm disabled:opacity-50">
              {busy === "release" ? (phase === "proving" ? "Generating privacy proof…" : "Releasing payment…") : state.status === "Released" ? "Delivery confirmed · payment released" : "Confirm delivery & release"}
            </button>
          </section>
        )}
        <LogPanel logs={logs} />
      </div>
    </PageShell>
  );
}

function AddressInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="nb-field-label">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder="G…" className="nb-field font-mono text-sm" /></label>;
}
