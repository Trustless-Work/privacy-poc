import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import { ChainClient } from "../src/chain/client.ts";

const account = (byte) => Keypair.fromRawEd25519Seed(Uint8Array.from({ length: 32 }, () => byte)).publicKey();
const PAYER = account(1);
const RECEIVER = account(2);
const APPROVER = account(3);
const TOKEN = Address.contract(Buffer.alloc(32)).toString();

const sym = (value) => xdr.ScVal.scvSymbol(value);
const entry = (key, value) => new xdr.ScMapEntry({ key: sym(key), val: value });
const response = xdr.ScVal.scvMap([
  entry("approver", new Address(APPROVER).toScVal()),
  entry("confidential_token", new Address(TOKEN).toScVal()),
  entry("payer", new Address(PAYER).toScVal()),
  entry("receiver", new Address(RECEIVER).toScVal()),
  entry("status", xdr.ScVal.scvVec([sym("Funded")])),
]);

class MockClient extends ChainClient {
  async simulate() { return response; }
}

const client = new MockClient({
  rpcUrl: "http://localhost:8000",
  networkPassphrase: "test",
  contracts: { token: TOKEN, verifier: TOKEN, auditor: TOKEN },
});
const state = await client.escrowState(TOKEN);
if (!state) throw new Error("expected escrow state");
if (state.payer !== PAYER || state.receiver !== RECEIVER || state.approver !== APPROVER) {
  throw new Error("escrow roles were decoded incorrectly");
}
if (state.confidentialToken !== TOKEN || state.status !== "Funded") {
  throw new Error("escrow token/status were decoded incorrectly");
}

console.log("escrow-state: 5 passed, 0 failed");
