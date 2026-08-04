import type { OnChainEscrow } from "@ctd/sdk";
import { Addr } from "../addr";

export function EscrowStateCard({ state }: { state: OnChainEscrow | null }) {
  return (
    <section className="nb-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="nb-panel-title text-sm">Order escrow state</h2>
        <span className="nb-status">
          {state?.status ?? "Not initialized"}
        </span>
      </div>
      {state ? (
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <Role label="Alberto · Customer / Payer" address={state.payer} />
          <Role label="Buju B. · Payment receiver" address={state.receiver} />
          <Role label="Ziggy · Store operator / Approver" address={state.approver} />
        </dl>
      ) : (
        <p className="nb-copy-muted mt-3 text-xs leading-relaxed">
          The contract is deployed but has no roles yet. The approver initializes it once.
        </p>
      )}
    </section>
  );
}

function Role({ label, address }: { label: string; address: string }) {
  return (
    <div className="nb-stat">
      <dt>{label}</dt>
      <dd className="mt-2"><Addr value={address} /></dd>
    </div>
  );
}
