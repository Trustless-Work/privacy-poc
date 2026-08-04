import { pointCoords } from "../src/crypto/grumpkin.ts";
import { parseUmbraEvent } from "../src/chain/umbra-history.ts";

const ACCOUNT = "GCRYH6M5YLTGZTCAALJPIJGQZY4Z6XFFUVTINCELQG4OGLADUBTAE3OU";
const RECIPIENT = "GCV76XYE4MG555A76L3KHRCZ54FOOEYLKHJOGCXFSQDOULTKZOWSRJRB";
const TX = "f2b32b87e181871f3927255d1e9a3ba72138becaa430b92aee0a42d0e6ca35e4";

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

const event = parseUmbraEvent({
  event_id: "3916358-9-0",
  ledger: 3916358,
  tx_hash: TX,
  kind: "transfer",
  addresses: [ACCOUNT, RECIPIENT],
  payload: {
    r_e: "H5KYnMPOzTLcjguLvct+g0ocKMls3WPv2pFbILL9DswAUOoBOTnOwd1ETAL3AqTyA2GTM0m51mYytRSr2Ylt5A==",
    sigma: "AKzbSGbHmr8g65whnAgI5U0vK19KqAqHEyH1HTFUTs8=",
    b_aud_s: "HHp8H4aQtJn/pmKmprefjSpcZtw5SfLtQuAWQIaUhZg=",
    b_tilde: "HhW0wQzKJEbYFBBG3gG/N297ptK8lmm8pX0PuO7WXT0=",
    r_aud_r: "D4IMvVFlzg1HBUdzrmt7KzmYhkooSI2u1e3JQgiYhXM=",
    v_aud_r: "EyBZ2TPvBzihaHNd1uotzLSLYrE3Fuau4ozAXdnWAbM=",
    v_aud_s: "H6dj4T/AuKnRDt3dPCN2/UIoGtjRlTP3LIuJmblFbWo=",
    v_tilde: "Ef7DPw5ftUpDuxfi8o/dHMllNMsr9RkIoJ8YEF4YTuU=",
  },
});

console.log("Umbra normalized history decoder:");
check("decodes a transfer", event?.type === "transfer");
check("maps account-scoped addresses", event?.from === ACCOUNT && event?.to === RECIPIENT);
check("normalizes the event id", event?.cursor === `3916358-${TX}-9-0`);
check("decodes 32-byte fields", event?.sigma > 0n && event?.bTilde > 0n);
const point = event?.type === "transfer" ? pointCoords(event.rE) : null;
check("decodes the 64-byte ephemeral point", Boolean(point && point.x > 0n && point.y > 0n));
check("ignores unknown event kinds", parseUmbraEvent({ ...event, kind: "set_spender" }) === null);

console.log(`\numbra-history: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
