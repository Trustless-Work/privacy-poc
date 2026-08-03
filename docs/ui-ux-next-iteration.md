# UI/UX next iteration

## Objective

Turn the technically successful PoC into a walkthrough that a new tester can complete without understanding confidential-token internals, while making dangerous context mistakes difficult.

The next iteration should improve comprehension and confidence without changing contract or cryptographic behavior.

## Product principles

- Always show the user's active role, wallet, deployment, and escrow before an action.
- Explain private balances in user language while retaining technical detail on demand.
- Treat proof generation, wallet approval, submission, and confirmation as separate progress states.
- Present the next valid action, not every technically possible action.
- Make recovery and errors actionable; never reduce them to raw RPC messages alone.
- Preserve the functional neo-brutalist visual language and semantic palette.

## Semantic palette

| Color | Role |
|---|---|
| `#FB6107` | Primary action |
| `#F3DE2C` | Guidance and pending state |
| `#7CB518` | Success |
| `#5C8001` | Verified or completed state |
| `#FBB02D` | Secondary emphasis |
| Black/off-white | Structure, contrast, and content hierarchy |

## Priority 0: transaction safety and context

### Active context header

Every role page should persistently show:

- role;
- connected Freighter address;
- whether it matches the expected role address;
- active escrow label and shortened contract ID;
- active deployment/network; and
- escrow lifecycle state.

Block state-changing actions when the connected account is not the expected signer. The error should name both the connected and required roles and provide a direct recovery action.

### Escrow switching

Replace a bare numbered selector with entries containing:

- user-defined label;
- short contract ID;
- status;
- Payer and Receiver abbreviations; and
- creation date when available.

Switching must clear any controller, proof, or pending transaction derived from the previous escrow and request explicit reconnection.

### Acceptance criteria

- A tester can identify the active role, wallet, network, and escrow without scrolling.
- A wrong-wallet transaction cannot be started.
- Switching escrows cannot reuse stale transaction state.
- The user can distinguish two escrows using the same participants.

## Priority 1: explain the confidential balance model

### Balance card

Present four conceptual locations:

1. Public USDC
2. Private Receiving
3. Private Spendable
4. Escrow allowance

Use short descriptions and a visual path. In context, show the exact next movement: Deposit, Merge, Fund, Release, or Withdraw.

Explicitly explain that:

- an escrow release first arrives in Receiver `Receiving`;
- Merge remains private; and
- only Withdraw returns the amount to Freighter's ordinary USDC balance.

### State verification

Replace `state matches chain` and `state mismatch` as the primary copy with:

- **Private balance verified**; or
- **Private balance needs recovery**.

Keep the raw commitment comparison inside a details panel. For recovery, provide **Sync again**, expected duration, last scanned ledger, and a copyable diagnostic bundle.

### Acceptance criteria

- A new tester can explain Receiving versus Spendable after reading the page once.
- The Receiver knows why released funds are not yet visible in Freighter.
- A mismatch presents a safe recovery sequence and discourages redeployment or duplicate release.

## Priority 1: state-aware journey

The seven-step walkthrough should derive completion from on-chain and reconstructed state, not only manual navigation.

Each step needs one of four states:

- Not started
- Ready
- In progress
- Complete

Show one primary action for the current step and de-emphasize future actions. Completed steps should retain transaction links and key outputs.

For multi-wallet testing, include a clear handoff card: “Switch Freighter to Receiver” with the expected shortened address and a confirmation check after reconnection.

### Acceptance criteria

- Refreshing the page preserves accurate journey progress.
- A tester always knows the next valid action.
- Wallet handoffs explicitly identify the next account.
- Released, merged, and withdrawn are separate Receiver states.

## Priority 1: proof and transaction progress

Long operations should show a staged progress component:

1. Preparing inputs
2. Generating proof
3. Waiting for wallet approval
4. Submitting transaction
5. Confirming on Testnet
6. Updating local state

Show elapsed time and let the user copy technical details without presenting the operation as failed while it is still processing. Prevent accidental duplicate submission.

### Acceptance criteria

- Every long action visibly advances through stages.
- Closing or rejecting Freighter produces a distinct state from a contract failure.
- Confirmed transactions expose a Stellar Expert link and copyable hash.
- Retrying cannot submit an already-confirmed operation twice.

## Priority 2: multi-escrow management

Add:

- naming during creation;
- rename/archive for browser organization;
- import by contract ID;
- discovery from indexed factory events when available; and
- a list view with role, participants, status, and recent activity.

Browser labels may remain local initially. Contract IDs and on-chain roles remain authoritative.

### Acceptance criteria

- An escrow created in another browser can be imported safely.
- Duplicate contract IDs are rejected.
- Imported contracts are verified before appearing as usable.
- Local labels never replace or alter authoritative on-chain identities.

## Priority 2: diagnostics

Create a user-facing error taxonomy:

| Category | Example | Primary recovery |
|---|---|---|
| Wallet | Wrong signer or request rejected | Switch/reconnect wallet |
| Configuration | Factory lacks `deploy_escrow` | Verify deployment configuration |
| Build | SDK export missing at runtime | Rebuild SDK and restart app |
| Contract | Invalid lifecycle transition | Show current and required state |
| Proof | Witness/proof generation failed | Regenerate with preserved safe inputs |
| Sync | Local commitment mismatch | Historical sync and diagnostic export |

Keep the raw log available behind **Technical details**. Add a **Copy diagnostic bundle** action containing no secrets and including network, contract IDs, wallet address, escrow, ledger/cursor, transaction hash, error category, and app version.

## Research plan

Run five moderated walkthroughs with technically literate users who have not worked on this implementation.

Observe:

- whether they understand why multiple wallets are needed;
- whether they can predict where funds appear after each action;
- where they hesitate before wallet approvals;
- whether the active escrow remains clear after creating a second instance;
- whether they can recover from one seeded wrong-wallet error; and
- what they believe “released” means before and after using the Receiver page.

Measure:

- completion rate;
- time to first funded escrow;
- time from release to Receiver verification;
- wrong-wallet attempts;
- duplicate-action attempts;
- help requests per step; and
- comprehension of private Receiving, Spendable, and public USDC.

## Delivery slices

### Slice 1: safety shell

Active role/wallet/escrow context, signer validation, improved selector, and stale-controller reset visibility.

### Slice 2: balance comprehension

Balance lifecycle visualization, clearer verification/recovery states, and Receiver-specific guidance.

### Slice 3: guided execution

State-derived journey, explicit wallet handoffs, proof/transaction progress, and duplicate prevention.

### Slice 4: management and recovery

Labels, import, escrow list, diagnostic bundle, and user-tested error states.

## Definition of done

- Five first-time testers can complete the flow without developer intervention.
- No tester submits a transaction from the wrong role wallet.
- At least four of five can correctly describe the private balance lifecycle.
- A seeded Receiver-sync problem can be diagnosed without redeploying or releasing twice.
- Two escrows using the same participant addresses remain clearly distinguishable.
- Production build, TypeScript, regression tests, keyboard navigation, focus visibility, and contrast checks pass.
