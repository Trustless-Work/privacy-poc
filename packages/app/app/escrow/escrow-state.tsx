import type { OnChainEscrow } from "@ctd/sdk";
import { Addr } from "../addr";

export function EscrowStateCard({ state }: { state: OnChainEscrow | null }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Shared escrow state</h2>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
          {state?.status ?? "Not initialized"}
        </span>
      </div>
      {state ? (
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <Role label="Payer" address={state.payer} />
          <Role label="Receiver" address={state.receiver} />
          <Role label="Approver" address={state.approver} />
        </dl>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          The contract is deployed but has no roles yet. The approver initializes it once.
        </p>
      )}
    </section>
  );
}

function Role({ label, address }: { label: string; address: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="mt-1"><Addr value={address} className="text-neutral-200" /></dd>
    </div>
  );
}
