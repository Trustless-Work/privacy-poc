"use client";

/**
 * Account-activity panel. The confidential token leans on events for all
 * client-visible state, so this lists every token-contract event concerning
 * the connected account (inside the RPC retention window), loaded on landing.
 *
 * Transfers are split by direction — received vs. sent — and each hosts the
 * holder side of the matching selective-disclosure flow
 * (SELECTIVE_DISCLOSURE.md §12): paste a disclosure receiver's request (P_R, ν),
 * generate a D-recipient or D-sender proof in-browser, copy the bundle back.
 */

import { useCallback, useEffect, useState } from "react";
import type { ConfidentialEvent, TransferEvent, SpenderTransferEvent, DisclosureRequest } from "@ctd/sdk";
import type { ConfidentialWallet } from "@/lib/wallet";
import { useActiveDeployment } from "@/lib/active-deployment";
import { errMsg } from "@/lib/err";
import { stroopsToXlm } from "@/lib/format";
import { CopyButton } from "../copy-button";
import { ErrorBox } from "../error-box";
import { Addr } from "../addr";
import { TxLink } from "../tx-link";

export function EventsPanel({ wallet, reloadKey = 0 }: { wallet: ConfidentialWallet; reloadKey?: number }) {
  const { active } = useActiveDeployment();
  const [events, setEvents] = useState<ConfidentialEvent[] | null>(null);
  const [amounts, setAmounts] = useState<Map<string, bigint>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await wallet.listEvents();
      setAmounts(await wallet.discloseHistoryAmounts(next));
      setEvents(next);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [wallet]);

  // Events are the dashboard's ground truth — load on landing, and again
  // whenever the parent bumps reloadKey (after each submitted tx).
  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <section className="nb-panel">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="nb-panel-title">Your private wallet activity</h3>
        <button
          onClick={load}
          disabled={busy}
          className="nb-secondary-action px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? "Loading…" : "Reload"}
        </button>
      </div>
      <p className="nb-copy-muted mb-3 text-xs">
        Events involving your account ({active.accountHistoryUrl
          ? "durable account history via Umbra + live RPC"
          : active.indexerUrl
            ? "full history via indexer"
            : "~7-day RPC retention"}).
        Disclose a transfer to prove its amount to a third party — as its receiver or as its sender.
      </p>
      {error && (
        <ErrorBox size="sm" className="mb-3">
          {error}
        </ErrorBox>
      )}
      {events && events.length === 0 && (
        <p className="nb-alert text-sm">No activity in the retention window.</p>
      )}
      {!events && busy && <p className="nb-copy-muted text-sm font-bold">Loading events…</p>}
      {events && (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow
              key={ev.cursor}
              ev={ev}
              wallet={wallet}
              assetCode={active.assetCode}
              disclosedAmount={amounts.get(ev.cursor)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

type Direction = "received" | "sent" | null;

function EventRow({
  ev,
  wallet,
  assetCode,
  disclosedAmount,
}: {
  ev: ConfidentialEvent;
  wallet: ConfidentialWallet;
  assetCode: string;
  disclosedAmount?: bigint;
}) {
  const [showDisclose, setShowDisclose] = useState(false);

  const isPayment = ev.type === "transfer" || ev.type === "spender_transfer";
  const direction: Direction = !isPayment ? null : ev.to === wallet.address ? "received" : "sent";
  // Sender disclosure re-derives the ephemeral scalar from this wallet's keys.
  const canDisclose =
    ev.type === "transfer" &&
    (direction === "received" || (direction === "sent" && wallet.canDiscloseSent(ev)));

  // Transfer amounts are confidential on-chain but decryptable by either party.
  // Decrypt for display; `loading` until resolved, `value` null if unrecoverable.
  const [amt, setAmt] = useState<{ loading: boolean; value: bigint | null }>({
    loading: isPayment && disclosedAmount === undefined,
    value: disclosedAmount ?? null,
  });
  useEffect(() => {
    if (ev.type !== "transfer" && ev.type !== "spender_transfer") return;
    if (disclosedAmount !== undefined) {
      setAmt({ loading: false, value: disclosedAmount });
      return;
    }
    let cancelled = false;
    wallet
      .transferAmount(ev as TransferEvent | SpenderTransferEvent)
      .then((value) => !cancelled && setAmt({ loading: false, value }))
      .catch(() => !cancelled && setAmt({ loading: false, value: null }));
    return () => {
      cancelled = true;
    };
  }, [ev, wallet, disclosedAmount]);

  return (
    <li className="border-2 border-neutral-950 bg-white p-3 text-neutral-950 shadow-[2px_2px_0_#151515]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeCls(ev.type, direction)}`}>
          {direction ?? ev.type}
        </span>
        <span className="flex-1" />
        {direction && canDisclose && (
          <button
            onClick={() => setShowDisclose((v) => !v)}
            className="nb-secondary-action px-2 py-1 text-xs"
          >
            {showDisclose ? "Close disclosure" : "Disclose amount"}
          </button>
        )}
        <TxLink hash={ev.txHash} variant="button" />
        {direction === "sent" && !canDisclose && (
          <span
            className="text-xs text-neutral-600"
            title="This transfer's R_e doesn't match the ephemeral scalar derived from this wallet's keys (it was sent with different keys or a non-deterministic r_e), so a D-sender proof can't be built."
          >
            third-party proof unavailable
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-neutral-700">
        {summary(ev, wallet.address, isPayment ? amt : undefined, assetCode)}
      </div>
      {showDisclose && direction && (
        <DiscloseFlow ev={ev as TransferEvent} direction={direction} wallet={wallet} />
      )}
    </li>
  );
}

/** Holder side of §12: request in, bundle out. */
function DiscloseFlow({
  ev,
  direction,
  wallet,
}: {
  ev: TransferEvent;
  direction: "received" | "sent";
  wallet: ConfidentialWallet;
}) {
  const [requestJson, setRequestJson] = useState("");
  const [bundleJson, setBundleJson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setBundleJson(null);
    try {
      const request = parseRequest(requestJson);
      const bundle =
        direction === "received"
          ? await wallet.discloseReceived(ev, request)
          : await wallet.discloseSent(ev, request);
      setBundleJson(JSON.stringify(bundle, null, 2));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [requestJson, ev, direction, wallet]);

  return (
    <div className="nb-panel-guide mt-3 space-y-3 p-3">
      <p className="text-xs font-medium text-neutral-800">
        {direction === "received"
          ? "Prove this transfer paid you its exact amount."
          : "Prove you sent this transfer and what it paid the recipient."}{" "}
        Paste the disclosure request you received from the verifying party (their <code>pR</code> key
        and one-time nonce <code>nu</code>). The proof binds to that pair — it is useless to anyone else.
      </p>
      <textarea
        className="nb-field h-24 p-2 font-mono text-xs outline-none"
        placeholder='{"pR":{"x":"0x…","y":"0x…"},"nu":"0x…"}'
        value={requestJson}
        onChange={(e) => setRequestJson(e.target.value)}
      />
      <button
        onClick={generate}
        disabled={busy || !requestJson.trim()}
        className="nb-action px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy ? "Proving…" : "Generate disclosure proof"}
      </button>
      {error && <ErrorBox size="sm">{error}</ErrorBox>}
      {bundleJson && (
        <div className="space-y-2">
          <textarea
            readOnly
            className="nb-field h-32 p-2 font-mono text-xs"
            value={bundleJson}
          />
          <CopyButton label="Copy bundle" payload={() => bundleJson} />
          <p className="text-xs font-medium text-neutral-700">
            Send this bundle back to the requester over your usual channel — it never touches the chain.
          </p>
        </div>
      )}
    </div>
  );
}

function parseRequest(json: string): DisclosureRequest {
  let req: unknown;
  try {
    req = JSON.parse(json);
  } catch {
    throw new Error("request is not valid JSON");
  }
  const r = req as DisclosureRequest;
  if (!r?.pR?.x || !r?.pR?.y || !r?.nu) {
    throw new Error("request must contain pR {x,y} and nu");
  }
  return r;
}

/** A distinct mono amount chip. Public amounts and locally-decrypted transfer
 *  amounts share the styling; `title` carries the confidentiality note. */
function Amt({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="border border-neutral-950 bg-amber-300 px-1.5 py-0.5 font-mono text-xs font-black text-neutral-950"
    >
      {children}
    </span>
  );
}

const You = () => <span className="font-black text-neutral-950">you</span>;
const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-neutral-500">{children}</span>
);

/** For a transfer row, render the decrypted amount, a loading hint, or fall
 *  back to "confidential" when this wallet can't recover it. */
function TransferAmount({ amt, assetCode }: { amt: { loading: boolean; value: bigint | null }; assetCode: string }) {
  if (amt.loading) return <Muted>decrypting…</Muted>;
  if (amt.value === null) return <Muted>amount confidential</Muted>;
  return (
    <Amt title="Decrypted with your key — still confidential on-chain">
      {stroopsToXlm(amt.value)} {assetCode}
    </Amt>
  );
}

function summary(
  ev: ConfidentialEvent,
  me: string,
  transferAmt?: { loading: boolean; value: bigint | null },
  assetCode = "XLM",
) {
  const who = (a: string) => (a === me ? <You /> : <Addr value={a} className="font-bold text-neutral-800" />);
  switch (ev.type) {
    case "register":
      return (
        <>
          <span>with</span> <Muted>auditor #{ev.auditorId}</Muted>
        </>
      );
    case "deposit":
      return (
        <>
          <Amt>{stroopsToXlm(ev.amount)} {assetCode}</Amt> <Muted>(public)</Muted>
        </>
      );
    case "merge":
      return (
        <Muted>receiving → spendable</Muted>
      );
    case "withdraw":
      return (
        <>
          <Amt>{stroopsToXlm(ev.amount)} {assetCode}</Amt> <Muted>(public)</Muted>
        </>
      );
    case "transfer": {
      const amt = transferAmt ?? { loading: false, value: null };
      return ev.to === me ? (
        <>
          <span className="font-black text-green-700">from</span> {who(ev.from)}{" "}
          <span className="text-neutral-500">·</span> <TransferAmount amt={amt} assetCode={assetCode} />
          <Muted>(confidential)</Muted>
        </>
      ) : (
        <>
          <span className="font-black text-orange-600">to</span> {who(ev.to)}{" "}
          <span className="text-neutral-500">·</span> <TransferAmount amt={amt} assetCode={assetCode} />
          <Muted>(confidential)</Muted>
        </>
      );
    }
    case "spender_transfer": {
      const amt = transferAmt ?? { loading: false, value: null };
      return ev.to === me ? (
        <>
          <span className="font-black text-green-700">escrow release from</span> {who(ev.from)}{" "}
          <span className="text-neutral-500">·</span> <TransferAmount amt={amt} assetCode={assetCode} />
          <Muted>(confidential)</Muted>
        </>
      ) : (
        <>
          <span className="font-black text-orange-600">escrow released to</span> {who(ev.to)}
        </>
      );
    }
    default:
      // Compliance/policy events are not shown in the wallet activity list.
      return ev.type;
  }
}

function badgeCls(type: ConfidentialEvent["type"], direction: Direction): string {
  if (direction === "received") return "border border-neutral-950 bg-lime-500 text-neutral-950";
  if (direction === "sent") return "border border-neutral-950 bg-orange-500 text-neutral-950";
  switch (type) {
    case "deposit":
      return "border border-neutral-950 bg-yellow-300 text-neutral-950";
    case "withdraw":
      return "border border-neutral-950 bg-orange-500 text-neutral-950";
    case "register":
      return "border border-neutral-950 bg-amber-300 text-neutral-950";
    case "merge":
      return "border border-neutral-950 bg-lime-500 text-neutral-950";
    default:
      return "border border-neutral-950 bg-white text-neutral-950";
  }
}
