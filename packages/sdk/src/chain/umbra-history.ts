/**
 * Account-scoped durable history from Umbra.
 *
 * Unlike the Goldsky indexer, Umbra exposes the events that concern one
 * account at `/v1/ct/:token/history/:address`. That is exactly what the state
 * engine needs to rebuild confidential balance openings on a new browser.
 * Payloads remain untrusted: callers must verify the reconstructed openings
 * against the commitments stored by the token contract.
 */

import { fromBytesBE, hexToBytes } from "../crypto/field.js";
import { pointFromBytes } from "../crypto/grumpkin.js";
import {
  KNOWN,
  buildConfidentialEvent,
  naturalEventId,
  type ConfidentialEvent,
  type EventDataAccessor,
} from "./events.js";

export interface UmbraHistoryConfig {
  /** API origin, e.g. `https://umbra-production-d30f.up.railway.app`. */
  baseUrl: string;
}

interface UmbraEventRow {
  event_id: string;
  ledger: number;
  tx_hash: string;
  kind: string;
  addresses: string[];
  amount_public?: string;
  payload?: Record<string, unknown>;
}

interface UmbraHistoryResponse {
  token_id: string;
  address: string;
  since_ledger?: number;
  events?: UmbraEventRow[];
}

export class UmbraHistoryClient {
  constructor(readonly cfg: UmbraHistoryConfig) {}

  async fetchAccountHistory(opts: {
    contractId: string;
    address: string;
    sinceLedger?: number;
  }): Promise<ConfidentialEvent[]> {
    const base = this.cfg.baseUrl.replace(/\/?$/, "/");
    const url = new URL(
      `v1/ct/${encodeURIComponent(opts.contractId)}/history/${encodeURIComponent(opts.address)}`,
      base,
    );
    if (opts.sinceLedger !== undefined) {
      url.searchParams.set("since_ledger", String(opts.sinceLedger));
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Umbra history ${resp.status}: ${await safeText(resp)}`);
    }
    const body = (await resp.json()) as UmbraHistoryResponse;
    if (body.token_id !== opts.contractId || body.address !== opts.address) {
      throw new Error("Umbra history response does not match the requested token and account");
    }

    const events = (body.events ?? [])
      .map(parseUmbraEvent)
      .filter((event): event is ConfidentialEvent => event !== null)
      .sort((a, b) => a.ledger - b.ledger);
    return events;
  }
}

export function parseUmbraEvent(row: UmbraEventRow): ConfidentialEvent | null {
  if (!KNOWN.has(row.kind)) return null;
  const coords = umbraEventCoords(row.event_id);
  const base = {
    ledger: Number(row.ledger),
    txHash: row.tx_hash,
    cursor: naturalEventId({
      ledger: Number(row.ledger),
      txHash: row.tx_hash,
      opIndex: coords.opIndex,
      eventIndex: coords.eventIndex,
    }),
  };
  const addr = (index: number): string => {
    const address = row.addresses[index - 1];
    if (!address) throw new Error(`Umbra event "${row.kind}" missing address ${index}`);
    return address;
  };
  return buildConfidentialEvent(row.kind, base, addr, umbraData(row));
}

function umbraEventCoords(id: string): { opIndex: number; eventIndex: number } {
  const match = /^(?:\d+)-(\d+)-(\d+)$/.exec(id);
  if (!match) throw new Error(`unrecognized Umbra event id "${id}"`);
  return { opIndex: Number(match[1]), eventIndex: Number(match[2]) };
}

function umbraData(row: UmbraEventRow): EventDataAccessor {
  const payload = row.payload ?? {};
  const get = (name: string): unknown => {
    if (!(name in payload)) throw new Error(`Umbra event data missing field "${name}"`);
    return payload[name];
  };
  return {
    field: (name) => fromBytesBE(decodeBytes(get(name))),
    point: (name) => pointFromBytes(padTo(decodeBytes(get(name)), 64)),
    i128: (name) => {
      if (name === "amount" && row.amount_public !== undefined) return BigInt(row.amount_public);
      return BigInt(String(get(name)));
    },
    u32: (name) => Number(get(name)),
  };
}

function decodeBytes(value: unknown): Uint8Array {
  if (typeof value !== "string") throw new Error("expected an Umbra base64/hex string");
  if (value.startsWith("0x")) return hexToBytes(value.slice(2));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function padTo(bytes: Uint8Array, length: number): Uint8Array {
  if (bytes.length === length) return bytes;
  if (bytes.length > length) throw new Error(`expected <= ${length} bytes, got ${bytes.length}`);
  const out = new Uint8Array(length);
  out.set(bytes, length - bytes.length);
  return out;
}

async function safeText(resp: Response): Promise<string> {
  try {
    return (await resp.text()).slice(0, 200);
  } catch {
    return "";
  }
}
