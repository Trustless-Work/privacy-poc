# ADR 0002: Accept payer revocation in v0

## Status

Accepted for the first proof of concept.

## Decision

The payer may revoke the confidential delegation before the approver releases it. The escrow contract does not attempt to prevent or override that upstream capability.

If the delegation is absent, expired, or revoked, `approve_and_release` must fail atomically and the escrow must remain in `Funded` state. The UI should report that the release could not be completed and must not imply that funds were transferred.

## Why

Preventing revocation requires changing the confidential-token protocol's delegation semantics. That is outside the first PoC's research question, which is whether one approval can release an entire confidential allowance without publishing its amount.

## Consequences

- Funding is not irrevocable in v0.
- `Funded` means the funding transaction succeeded; it does not guarantee that the delegation still exists later.
- A live-delegation read is useful UX but is not a substitute for the atomic transfer result.
- Escrow state changes to `Released` only after the nested confidential transfer succeeds.
