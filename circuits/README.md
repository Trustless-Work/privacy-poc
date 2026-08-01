# PoC circuits

This directory vendors the Noir source required to fund and release the PoC escrow.

- Upstream: `OpenZeppelin/stellar-contracts`
- Branch: `feat/confidential-verifier-ultrahonk`
- Pinned source commit: `539968f158e0d779f584de2821090f715a3b25e1`
- Expected compiler: `nargo 1.0.0-beta.9`
- Expected proving backend: `bb 0.87.0`

`spender_transfer_full_release` retains the upstream `SpenderTransfer` public-input layout and adds one constraint: the post-transfer allowance plaintext must equal zero. This keeps it wire-compatible with the confidential-token contract while giving the PoC its release-all invariant.

The generated ACIR artifact and verification key must replace the upstream `spender_transfer` artifact/VK together. Never deploy the upstream partial-spend VK and claim that the escrow enforces complete release.

`set_spender` is the exact pinned upstream funding circuit. Run
`pnpm build:escrow-circuits` to rebuild both browser proving artifacts and
their packed Soroban verification keys.
