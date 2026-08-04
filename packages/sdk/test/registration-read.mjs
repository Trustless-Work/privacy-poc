import { ChainClient } from "../src/chain/client.ts";

const client = new ChainClient({
  rpcUrl: "https://example.invalid",
  networkPassphrase: "test",
  contracts: {
    token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    verifier: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    auditor: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  },
});

let pass = 0;
let fail = 0;
function check(name, condition) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

client.simulate = async () => {
  throw new Error("HostError: Error(Contract, #3501)");
};
check(
  "known not-registered contract error returns null",
  (await client.confidentialBalance("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")) === null,
);

client.simulate = async () => {
  throw new Error("RPC request failed: CORS blocked");
};
let propagated = false;
try {
  await client.confidentialBalance("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
} catch (error) {
  propagated = error instanceof Error && error.message.includes("CORS blocked");
}
check("RPC failures are not mislabeled as unregistered", propagated);

console.log(`\nregistration-read: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
